from __future__ import annotations

import json
import re

from .context import ValidationContext
from . import manifest_checks
from .expectations import REQUIRED_PATHS, EXPECTED_MODULE_VERSIONS


def run(ctx: ValidationContext) -> None:
    root = ctx.root
    project = ctx.project
    samples = ctx.samples
    docs = ctx.docs
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    require = ctx.require

    for relative_path in REQUIRED_PATHS:
        require(root / relative_path)

    # Package hygiene for a public release.
    for prototype_note in [
            root / 'QUICK_SEARCH_TESTING.txt',
            root / 'QUICK_SEARCH_BACKGROUND_TESTING.txt',
            root / 'LAYOUT_VISUALISER_TESTING.txt']:
        if prototype_note.exists():
            errors.append('Prototype testing note must not be distributed: ' + rel(prototype_note))
    all_files = [
        path for path in root.rglob('*')
        if path.is_file() and path.suffix.lower() != '.fcl'
    ]
    obsolete_references = [
        'foo' + '_quicksearch',
        'foo' + '_uie_quicksearch',
        'foo' + '_queue_viewer',
        'quick search' + ' toolbar',
        'darkonejsp3 ' + 'native',
        'native queue' + ' viewer',
        'native quick' + ' search',
        'queue viewer' + ' component',
        'marc2k3.github.io/component/' + 'queue-viewer',
        'native_component_' + 'alternative',
        'native_component_' + 'used_by_current_bundled_fcl',
        'native_component_' + 'full_editing',
        'native_viewer_' + 'optional',
        'native_viewer_' + 'required_for_bundled_fcl_import',
        'native_queue_component_' + 'required_for_import',
        'native_quick_search_component_' + 'required_for_import',
        'native_' + 'layout',
    ]
    searchable_suffixes = {'.js', '.json', '.md', '.py', '.txt'}
    immutable_history_paths = {
        docs / 'CHANGELOG.txt',
        docs / 'MIGRATION_REFERENCE.txt',
        project / 'reference' / 'Original DarkOne2021 PSS and panel map.txt',
    }
    for path in all_files:
        if path.suffix.lower() not in searchable_suffixes and path.name != '.gitignore':
            continue
        # Historical records describe what earlier layouts actually shipped and
        # required. Obsolete-reference checks apply only to current package
        # material, never to immutable changelog or migration reference files.
        if path in immutable_history_paths:
            continue
        body = text(path).casefold()
        collapsed_body = re.sub(r'\s+', ' ', body)
        for token in obsolete_references:
            if token in body or token in collapsed_body:
                errors.append(
                    'Obsolete queue/search dependency or layout reference in ' +
                    rel(path) + ': ' + token
                )
    casefold_paths: dict[str, list[str]] = {}
    suspicious_name = re.compile(r'(?:~|\.(?:bak|old|orig|rej|tmp|swp|pyc))$', re.I)
    for path in all_files:
        relative = rel(path)
        casefold_paths.setdefault(relative.casefold(), []).append(relative)
        if suspicious_name.search(path.name) or '__pycache__' in path.parts or \
                path.name in {'.DS_Store', 'Thumbs.db'}:
            errors.append('Temporary or backup file must not be distributed: ' + relative)
        if path.stat().st_size == 0:
            errors.append('Empty package file: ' + relative)
        if path.name.casefold() in {
                'bottom-area-state.txt',
                'darkonejsp3.bottom-area-state.txt',
                'darkonejsp3.bottom-area-command.txt',
                'darkonejsp3.reset-command.txt',
                'darkonejsp3.queue-state.json',
                'darkonejsp3.queue-command.json',
                'darkonejsp3.queue-command-result.json',
                'darkonejsp3.quicksearch-layout-command.txt',
                'darkonejsp3.quicksearch-context-tags.json',
                'darkonejsp3.view-command.txt',
                'darkonejsp3.infostack-menu-state.json'}:
            errors.append('Runtime-generated state must not be distributed: ' + relative)
    for paths in casefold_paths.values():
        if len(paths) > 1:
            errors.append('Case-insensitive path collision: ' + ', '.join(sorted(paths)))

    # Keep project-owned JSplitter source histories readable and deterministic.
    # Legacy enhanced-sample build identifiers are intentionally left untouched.
    for path in (project / 'jsplitter').glob('*.js'):
        body = text(path)
        if 'Version history (newest first):' not in body:
            continue
        versions = []
        for line in body.splitlines()[:160]:
            match = re.match(r'\s*//\s*v(\d+)\.(\d+)\.(\d+)\b', line)
            if match:
                versions.append(tuple(int(part) for part in match.groups()))
        if len(versions) > 1 and versions != sorted(versions, reverse=True):
            errors.append('JS version history is not newest-first: ' + rel(path))

    # JSP3 3.x API guard. Keep this scoped to scripts that run inside JScript
    # Panel 3; JSplitter intentionally exposes a different SMP-derived API.
    jsp3_sources = list((project / 'jscript').rglob('*.js')) + list((project / 'jscript').rglob('*.txt')) + \
        list(samples.rglob('*.js')) + list(samples.rglob('*.txt'))
    jsp3_forbidden_tokens = {
        'fb.GetQueryItems(': 'legacy fb.GetQueryItems(); use IMetadbHandleList.GetQueryItems()',
        'plman.PlaylistItemCount(': 'SMP/JSplitter PlaylistItemCount(); JSP3 uses plman.GetPlaylistItemCount()',
        'gr.FillSolidRect(': 'JSplitter FillSolidRect(); JSP3 uses FillRectangle()',
        'on_fonts_changed': 'invalid callback; JSP3 callback is on_font_changed()',
    }
    native_typeof = re.compile(r"typeof\s+[^\n;]+\.(?:Dispose|Find|GetItem)\s*(?:===?|!==?)\s*['\"]function['\"]")
    chained_handle_list = re.compile(r"plman\.GetPlaylist(?:Selected)?Items\([^\n;]*\)\s*\.")
    for path in jsp3_sources:
        body = text(path)
        for token, message in jsp3_forbidden_tokens.items():
            if token in body:
                errors.append('JSP3 API guard: ' + rel(path) + ' retains ' + message)
        if native_typeof.search(body):
            errors.append('JSP3 API guard: ' + rel(path) + ' gates a native wrapper method with typeof == function')
        if chained_handle_list.search(body):
            errors.append('JSP3 API guard: ' + rel(path) + ' chains a temporary playlist handle list without an explicit Dispose() opportunity')

    gitignore = root / '.gitignore'
    if gitignore.exists():
        ignored = text(gitignore).replace('\\', '/').splitlines()
        for runtime_path in [
                'js_data/darkonejsp3.bottom-area-state.txt',
                'js_data/darkonejsp3.bottom-area-command.txt',
                'js_data/darkonejsp3.reset-command.txt',
                'js_data/darkonejsp3.queue-state.json',
                'js_data/darkonejsp3.queue-command.json',
                'js_data/darkonejsp3.queue-command-result.json',
                'js_data/darkonejsp3.quicksearch-layout-command.txt',
                'js_data/darkonejsp3.quicksearch-context-tags.json',
                'js_data/darkonejsp3.view-command.txt',
                'js_data/darkonejsp3.infostack-menu-state.json',
                'DarkOneJSP3/shared/bottom-area-state.txt']:
            if runtime_path not in ignored:
                errors.append('.gitignore does not exclude runtime state: ' + runtime_path)

    # Build metadata is the single version source.
    version = ''
    build: dict = {}
    if (project / 'build-info.json').exists():
        try:
            build = json.loads(text(project / 'build-info.json'))
            version = str(build.get('version', '')).strip()
        except Exception as exc:
            errors.append('Invalid build-info.json: ' + str(exc))
        if not re.fullmatch(r'\d+\.\d+\.\d+', version):
            errors.append('build-info.json has an invalid semantic version')
        if build.get('release') != f'DarkOneJSP3 v{version}':
            errors.append('build-info release string does not match its version')
        modules = build.get('modules', {})
        for module_name, (expected, label) in EXPECTED_MODULE_VERSIONS.items():
            if modules.get(module_name) != expected:
                errors.append(
                    f'build-info {label} version is not {expected}'
                )
    # Active runtime namespace checks.
    legacy_runtime = re.compile(r'(?<!DarkOne)DOJS3|DARKONEJS3|DarkOneJS3')
    active: list[str] = []
    for base in [project / 'jscript', project / 'jsplitter', project / 'shared', samples]:
        if not base.exists():
            continue
        for path in base.rglob('*'):
            if path.is_file() and path.suffix.lower() in {'.js', '.txt', '.json'}:
                try:
                    body = text(path)
                except Exception:
                    continue
                if legacy_runtime.search(body):
                    active.append(rel(path))
    if active:
        errors.append('Legacy runtime identifiers remain in: ' + ', '.join(active[:20]))

    # Obsolete stable-release marker files must not return.
    for removed in [docs / 'RENAMING_TO_DARKONEJSP3.txt']:
        if removed.exists():
            errors.append('Obsolete stable-release marker remains: ' + rel(removed))

    # Public documentation must use only the current project identifiers.
    former_doc_identifiers = ['DarkOneJS3', 'DOJS3', 'DARKONEJS3']
    for path in [root / 'README.md', *sorted(docs.glob('*.txt'))]:
        if not path.exists():
            continue
        body = text(path)
        for identifier in former_doc_identifiers:
            if identifier in body:
                errors.append(rel(path) + ' contains a former project identifier: ' + identifier)
    retired_doc_aliases = [
        'DOJSP3.InfoSource',
        'DOJSP3.MusicBrainz',
        'DOJSP3.Allmusic',
    ]
    for path in [root / 'README.md', *sorted(docs.glob('*.txt'))]:
        if not path.exists():
            continue
        body = text(path)
        for alias in retired_doc_aliases:
            if alias in body:
                errors.append(rel(path) + ' contains a retired title alias: ' + alias)

    for stale_reference in ['RENAMING_TO_DARKONEJSP3.txt']:
        for path in [root / 'README.md', *sorted(docs.glob('*.txt'))]:
            if path.exists() and stale_reference in text(path):
                errors.append(rel(path) + ' contains a stale marker reference: ' + stale_reference)

    # The public manifest describes durable release contracts. Behavioural test
    # inventory belongs in the validator itself rather than self-reporting flags.
    manifest_path = project / 'darkonejsp3-layout-manifest.json'
    if manifest_path.exists():
        try:
            manifest = json.loads(text(manifest_path))
        except Exception as exc:
            errors.append('Invalid layout manifest: ' + str(exc))
        else:
            manifest_checks.run(ctx, manifest, build, version)


    ctx.version = version
