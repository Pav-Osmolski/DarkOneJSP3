from __future__ import annotations

from pathlib import Path
import importlib.util
import json
import re
import shutil
import subprocess
import tempfile

from .context import ValidationContext


NODE_SYNTAX_RUNNER = r"""
const fs = require('fs');
const vm = require('vm');
const targets = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const failures = [];
for (const target of targets) {
    try {
        new vm.Script(fs.readFileSync(target.path, 'utf8'), {
            filename: target.display
        });
    } catch (error) {
        failures.push({
            kind: target.kind,
            display: target.display,
            message: String(error && error.message || error)
        });
    }
}
if (failures.length) {
    process.stdout.write(JSON.stringify(failures));
    process.exitCode = 1;
}
"""


RUNTIME_SUITE_FILES = (
    'popup_tests.js',
    'queue_tests.js',
    'quick_search_tests.js',
    'rendering_tests.js',
    'reset_tests.js',
)


def _resolve_import(root: Path, project: Path, samples: Path,
                    value: str) -> Path | None:
    if value.startswith('%fb2k_component_path%helpers.txt'):
        return root / 'user-components-x64' / 'foo_jscript_panel3' / 'helpers.txt'
    if value.startswith('%fb2k_component_path%samples\\'):
        return samples / value.split(
            '%fb2k_component_path%samples\\', 1)[1].replace('\\', '/')
    if value.startswith('%fb2k_profile_path%DarkOneJSP3\\'):
        return project / value.split(
            '%fb2k_profile_path%DarkOneJSP3\\', 1)[1].replace('\\', '/')
    if value == 'lodash':
        return None
    raise ValueError(value)


def _extract_js_function(source: str, name: str) -> str:
    marker = 'function ' + name + '('
    start = source.find(marker)
    if start < 0:
        raise ValueError('missing JavaScript function: ' + name)
    brace = source.find('{', start)
    if brace < 0:
        raise ValueError('missing JavaScript function body: ' + name)

    depth = 0
    quote = ''
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(source):
        char = source[index]
        next_char = source[index + 1] if index + 1 < len(source) else ''
        if line_comment:
            if char == '\n':
                line_comment = False
        elif block_comment:
            if char == '*' and next_char == '/':
                block_comment = False
                index += 1
        elif quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = ''
        else:
            if char == '/' and next_char == '/':
                line_comment = True
                index += 1
            elif char == '/' and next_char == '*':
                block_comment = True
                index += 1
            elif char in {'"', "'"}:
                quote = char
            elif char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    return source[start:index + 1]
        index += 1
    raise ValueError('unterminated JavaScript function: ' + name)


def _runtime_replacements(ctx: ValidationContext) -> dict[str, str]:
    samples = ctx.samples
    project = ctx.project
    text = ctx.text

    playlist_main = text(samples / 'jsplaylist' / 'main.js')
    playlist_view = text(samples / 'jsplaylist' / 'playlist.js')
    manager = text(samples / 'smooth' / 'jsspm.js')
    config = text(project / 'jscript' / 'js' / 'Config_Global_Script.js')

    return {
        '/*__PLAYLIST_VIEWPORT_FUNCTION__*/': _extract_js_function(
            playlist_view, 'get_playlist_viewport_row_load_count'),
        '/*__PLAYLIST_RATE_FUNCTIONS__*/': '\n\n'.join(
            _extract_js_function(playlist_main, name)
            for name in (
                'full_repaint',
                'repaint_scroll_frame',
                'stop_playlist_scroll_frame_if_idle',
                'stop_smooth_scroll',
                'get_free_scroll_max_px',
                'stop_free_wheel_scroll',
                'reset_free_wheel_scroll',
                'apply_free_wheel_position',
                'repaint_playlist_scrollbar_drag_frame',
                'ensure_playlist_scrollbar_drag_frame',
                'begin_playlist_scrollbar_drag',
                'update_playlist_scrollbar_drag',
                'playlist_scrollbar_drag_frame_tick',
                'finish_playlist_scrollbar_drag',
                'cancel_playlist_scrollbar_drag',
                'start_smooth_scroll_timer',
                'start_free_wheel_scroll_timer',
                'playlist_scroll_frame_tick',
                'ensure_playlist_scroll_frame',
                'reschedule_active_playlist_scroll_timers',
                'apply_playlist_refresh_interval',
                'set_playlist_refresh_interval',
            )),
        '/*__MANAGER_RATE_FUNCTIONS__*/': '\n\n'.join((
            _extract_js_function(
                manager, 'apply_playlist_manager_refresh_rate'),
            _extract_js_function(
                manager, 'set_playlist_manager_refresh_rate'),
        )),
        '/*__CONFIG_RESET_FUNCTIONS__*/': '\n'.join(
            _extract_js_function(config, name)
            for name in (
                'darkOneNormaliseResetScope',
                'darkOneResetScope',
                'darkOneApplyResetDefaults',
                'darkOneHandleResetNotification',
                'darkOneConfirmFactoryReset',
            )),
    }


def _write_runtime_bundle(ctx: ValidationContext, target: Path) -> bool:
    suite_dir = ctx.project / 'tools' / 'validation' / 'js'
    try:
        replacements = _runtime_replacements(ctx)
    except (OSError, ValueError) as exc:
        ctx.errors.append('Runtime-suite setup failed: ' + str(exc))
        return False

    chunks: list[str] = []
    for name in RUNTIME_SUITE_FILES:
        path = suite_dir / name
        try:
            source = ctx.text(path)
        except OSError as exc:
            ctx.errors.append('Runtime-suite module is unreadable: ' + str(exc))
            return False
        for token, value in replacements.items():
            source = source.replace(token, value)
        unresolved = re.findall(r'/\*__[A-Z0-9_]+__\*/', source)
        if unresolved:
            ctx.errors.append(
                name + ' contains unresolved runtime placeholders: ' +
                ', '.join(sorted(set(unresolved))))
            return False
        chunks.append(source)

    target.write_text('\n\n'.join(chunks), encoding='utf-8')
    return True


def _check_mirrors(ctx: ValidationContext) -> None:
    path = ctx.project / 'tools' / 'sync_mirrors.py'
    if not path.exists():
        return
    try:
        spec = importlib.util.spec_from_file_location(
            'darkonejsp3_sync_mirrors', path)
        if spec is None or spec.loader is None:
            raise RuntimeError('could not load sync_mirrors.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        mirror_errors = module.check(ctx.root)
    except Exception as exc:
        ctx.errors.append('Compatibility mirror check failed: ' + str(exc))
        return
    for error in mirror_errors:
        ctx.errors.append('Compatibility mirror check failed: ' + error)


def _run_syntax_checks(ctx: ValidationContext, node: str,
                       temp_dir: Path) -> None:
    root = ctx.root
    project = ctx.project
    samples = ctx.samples
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    import_re = re.compile(r'^//\s*@import\s+"([^"]+)"', re.M)
    combined_entries = sorted(samples.glob('*.txt')) + sorted(
        (project / 'jscript').glob('*.txt'))
    loader_entries = sorted((project / 'jsplitter' / 'loaders').glob('*.txt'))

    syntax_targets = [
        {
            'kind': 'JavaScript',
            'display': rel(path),
            'path': str(path),
        }
        for path in sorted(root.rglob('*.js'))
    ]
    syntax_targets.extend({
        'kind': 'Entry-script',
        'display': rel(path),
        'path': str(path),
    } for path in loader_entries)

    preprocessor_re = re.compile(
        r'// ==PREPROCESSOR==.*?// ==/PREPROCESSOR==\s*', re.S)
    for index, path in enumerate(combined_entries):
        source = text(path)
        chunks: list[str] = []
        unresolved = False
        for value in import_re.findall(source):
            try:
                target_path = _resolve_import(root, project, samples, value)
            except ValueError:
                unresolved = True
                errors.append(
                    rel(path) + ' has an unsupported preprocessor import: ' +
                    value)
                break
            if target_path is None:
                continue
            if not target_path.exists():
                unresolved = True
                errors.append(
                    rel(path) + ' imports missing file ' + rel(target_path))
                break
            chunks.append(text(target_path))
        if unresolved:
            continue
        chunks.append(preprocessor_re.sub('', source))
        target = temp_dir / f'preprocessed_{index}.js'
        target.write_text('\n'.join(chunks), encoding='utf-8')
        syntax_targets.append({
            'kind': 'Preprocessed entry',
            'display': rel(path),
            'path': str(target),
        })

    syntax_manifest = temp_dir / 'syntax-targets.json'
    syntax_manifest.write_text(json.dumps(syntax_targets), encoding='utf-8')
    result = subprocess.run(
        [node, '-e', NODE_SYNTAX_RUNNER, str(syntax_manifest)],
        capture_output=True, text=True)
    if not result.returncode:
        return
    try:
        failures = json.loads(result.stdout)
    except Exception:
        errors.append(
            'JavaScript syntax batch failed: ' +
            (result.stdout + result.stderr).strip())
        return
    for failure in failures:
        errors.append(
            failure['kind'] + ' syntax failed for ' + failure['display'] +
            ': ' + failure['message'])


def _run_behaviour_suites(ctx: ValidationContext, node: str,
                          temp_dir: Path) -> None:
    bundle = temp_dir / 'runtime-suites.js'
    if not _write_runtime_bundle(ctx, bundle):
        return
    harness = ctx.project / 'tools' / 'validation' / 'js' / 'harness.js'
    result = subprocess.run(
        [node, str(harness), str(ctx.root), str(bundle), '15000', '32'],
        capture_output=True, text=True)
    if not result.returncode:
        return
    try:
        failures = json.loads(result.stdout)
    except Exception:
        ctx.errors.append(
            'Runtime-suite harness failed: ' +
            (result.stdout + result.stderr).strip())
        return
    for failure in failures:
        ctx.errors.append(
            'Runtime suite failed [' + str(failure.get('name', 'unknown')) +
            ']: ' + str(failure.get('message', 'unknown failure')))


def _check_python_syntax(ctx: ValidationContext) -> None:
    for path in sorted(ctx.project.rglob('*.py')):
        try:
            compile(ctx.text(path), str(path), 'exec')
        except (OSError, SyntaxError) as exc:
            ctx.errors.append(
                'Python compilation failed for ' + ctx.rel(path) + ': ' +
                str(exc))


def run(ctx: ValidationContext) -> None:
    root = ctx.root
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    import_re = re.compile(r'^//\s*@import\s+"([^"]+)"', re.M)

    # Prove that every distributed sample entry resolves with only the
    # component tree staged and no DarkOneJSP3 project directory available.
    with tempfile.TemporaryDirectory() as temp:
        staged_root = Path(temp)
        shutil.copytree(
            root / 'user-components-x64',
            staged_root / 'user-components-x64')
        staged_component = (
            staged_root / 'user-components-x64' / 'foo_jscript_panel3')
        staged_samples = staged_component / 'samples'
        for entry in sorted(staged_samples.glob('*.txt')):
            for value in import_re.findall(text(entry)):
                if value.startswith('%fb2k_profile_path%DarkOneJSP3\\'):
                    errors.append(
                        rel(entry) + ' cannot run in component-only staging')
                    continue
                target = None
                if value.startswith('%fb2k_component_path%helpers.txt'):
                    target = staged_component / 'helpers.txt'
                elif value.startswith('%fb2k_component_path%samples\\'):
                    target = staged_samples / value.split(
                        '%fb2k_component_path%samples\\', 1
                    )[1].replace('\\', '/')
                elif value == 'lodash':
                    continue
                if target is not None and not target.exists():
                    errors.append(
                        'Component-only staging import is missing for ' +
                        rel(entry) + ': ' + value)

    _check_mirrors(ctx)

    node = shutil.which('node')
    if not node:
        errors.append('Node.js is required for JavaScript syntax validation')
    else:
        with tempfile.TemporaryDirectory() as temp:
            temp_dir = Path(temp)
            _run_syntax_checks(ctx, node, temp_dir)
            _run_behaviour_suites(ctx, node, temp_dir)

    _check_python_syntax(ctx)
