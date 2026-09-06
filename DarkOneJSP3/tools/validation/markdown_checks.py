"""Shared formatting and local-link checks for release docs and Wiki pages."""
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

from .documentation_checks import _markdown_heading_anchors, _fenced_block_contains

WIKI_PAGES = {
    'Architecture-and-Repository-Structure', 'Configuration-Guide',
    'Credits-and-Attribution', 'Enhanced-Sample-Library', 'FAQ', 'Home',
    'Installation-and-Upgrading', 'Layout-and-Panel-Map', 'Migration-from-DarkOne2021',
    'Quick-Start', 'Release-History', 'Troubleshooting', 'Validation-and-Maintenance',
    '_Footer', '_Sidebar',
}


def check_pages(paths, boundary: Path, errors: list[str], wiki=False):
    boundary = boundary.resolve()
    for path in paths:
        try:
            body = path.read_text(encoding='utf-8-sig')
        except (OSError, UnicodeError) as exc:
            errors.append(f'Cannot read Markdown {path.name}: {exc}')
            continue
        lines = body.splitlines()
        in_fence = False
        outside = []
        for index, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('```'):
                if not in_fence and not stripped[3:]:
                    errors.append(f'{path.name}:{index + 1}: code fence needs a language (use text for trees/paths)')
                in_fence = not in_fence
                outside.append('')
                continue
            if in_fence:
                outside.append('')
                continue
            outside.append(line)
            if re.match(r'^#{1,6} ', line):
                if index and lines[index - 1].strip():
                    errors.append(f'{path.name}:{index + 1}: missing blank line before heading')
                if index + 1 < len(lines) and lines[index + 1].strip():
                    errors.append(f'{path.name}:{index + 1}: missing blank line after heading')
            if re.match(r'^[-*] .+ \((?:https?://|\[https?://)', line):
                errors.append(f'{path.name}:{index + 1}: use a descriptive component link')
            if re.match(r'^Panel Stack Splitter \d+', line):
                errors.append(f'{path.name}:{index + 1}: hierarchy must be in a text fence')
        if in_fence:
            errors.append(path.name + ': unclosed code fence')
        prose = '\n'.join(outside)
        for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', prose):
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc:
                continue
            relative = unquote(parsed.path)
            dest = path if not relative else path.parent / relative
            if wiki and relative and not dest.suffix:
                dest = dest.with_suffix('.md')
            dest = dest.resolve()
            if not dest.is_relative_to(boundary):
                errors.append(f'{path.name}: local link escapes documentation boundary: {target}')
            elif not dest.exists():
                errors.append(f'{path.name}: missing local link target: {target}')
            elif parsed.fragment and dest.suffix == '.md':
                anchors = _markdown_heading_anchors(dest.read_text(encoding='utf-8-sig'))
                if unquote(parsed.fragment) not in anchors:
                    errors.append(f'{path.name}: missing local heading: {target}')
        if wiki and not path.name.startswith('_') and len(re.findall(r'^# ', prose, re.M)) != 1:
            errors.append(path.name + ': Wiki page must contain one H1')
        if path.name in {'Migration-from-DarkOne2021.md', 'MIGRATION_REFERENCE.md'}:
            if not _fenced_block_contains(body, 'Panel Stack Splitter 01', '    Right Controls'):
                errors.append(path.name + ': original hierarchy must be preserved in a text fence')


def run_wiki(root: Path, errors: list[str], ctx=None):
    if not root.is_dir():
        errors.append('Wiki directory is missing: ' + str(root))
        return
    actual = {p.name for p in root.iterdir()}
    expected = {name + '.md' for name in WIKI_PAGES}
    if actual != expected:
        errors.append('Wiki inventory differs: ' + ', '.join(sorted(actual ^ expected)))
    check_pages(sorted(root.glob('*.md')), root, errors, wiki=True)
    maintenance = root / 'Validation-and-Maintenance.md'
    if maintenance.is_file():
        body = maintenance.read_text(encoding='utf-8-sig')
        source_section = body.split('## Source documents', 1)[-1]
        if re.search(r'^- (?!\[)', source_section, re.M):
            errors.append('Wiki Source documents contains an orphan non-link bullet')
    if ctx:
        mapping = {
            'MIGRATION_REFERENCE.md': 'Migration-from-DarkOne2021.md',
            'LAYOUT_AND_PANEL_MAP.md': 'Layout-and-Panel-Map.md',
        }
        from .documentation_checks import _fenced_code_blocks
        for document, page in mapping.items():
            if not (root / page).is_file():
                continue
            original = _fenced_code_blocks(ctx.text(ctx.docs / document))
            mirrored = _fenced_code_blocks((root / page).read_text(encoding='utf-8-sig'))
            if original != mirrored:
                errors.append(page + ': structural examples differ from the full documentation')
        from .expectations import MENU_DOCUMENTATION_EXPECTATIONS
        config = root / 'Configuration-Guide.md'
        if config.is_file():
            body = config.read_text(encoding='utf-8-sig')
            for section in MENU_DOCUMENTATION_EXPECTATIONS:
                for label in section['labels']:
                    if label not in body:
                        errors.append('Wiki configuration menu label is missing: ' + label)


def run(ctx):
    check_pages([ctx.root / 'README.md', *sorted(ctx.docs.glob('*.md'))], ctx.root, ctx.errors)
