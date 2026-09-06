from __future__ import annotations

from pathlib import Path
import os
import re

from .context import ValidationContext
from .expectations import MENU_DOCUMENTATION_EXPECTATIONS


def _section(body: str, title: str, level: int = 2) -> str:
    hashes = '#' * level
    match = re.search(
        rf'^{re.escape(hashes)} {re.escape(title)}\s*$\n(.*?)(?=^#{{1,{level}}}\s|\Z)',
        body,
        re.MULTILINE | re.DOTALL,
    )
    return match.group(1).strip() if match else ''


def _github_heading_slug(title: str) -> str:
    # GitHub-style heading anchors used by the package TOCs: lowercase, remove
    # punctuation, retain word characters/hyphens and replace whitespace with
    # hyphens. Duplicate suffixes are handled by _markdown_heading_anchors().
    slug = title.strip().lower()
    slug = re.sub(r'[^\w\- ]', '', slug, flags=re.UNICODE)
    slug = re.sub(r'\s+', '-', slug)
    return slug


def _markdown_heading_anchors(body: str) -> set[str]:
    anchors: set[str] = set()
    counts: dict[str, int] = {}
    in_fence = False
    for line in body.splitlines():
        if line.startswith('```'):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = re.match(r'^#{1,6} (.+?)\s*#*$', line)
        if not match:
            continue
        base = _github_heading_slug(match.group(1))
        if not base:
            continue
        duplicate = counts.get(base, 0)
        anchor = base if duplicate == 0 else f'{base}-{duplicate}'
        counts[base] = duplicate + 1
        anchors.add(anchor)
    return anchors


def _numbered_document_sections(
        body: str) -> tuple[list[tuple[int, str]], list[tuple[int, str]], list[tuple[int, str]]]:
    contents: list[tuple[int, str]] = []
    links: list[tuple[int, str]] = []
    section_body = _section(body, 'Contents')
    if section_body:
        for line in section_body.splitlines():
            stripped = line.strip()
            linked = re.fullmatch(r'(\d+)\. \[([^\]]+)\]\((#[^)]+)\)', stripped)
            if linked:
                number = int(linked.group(1))
                contents.append((number, linked.group(2)))
                links.append((number, linked.group(3)))
                continue
            plain = re.fullmatch(r'(\d+)\. (.+)', stripped)
            if plain:
                contents.append((int(plain.group(1)), plain.group(2)))

    sections = [
        (int(match.group(1)), match.group(2))
        for match in re.finditer(r'^## (\d+)\. (.+)$', body, re.MULTILINE)
    ]
    return contents, sections, links


def _fenced_code_blocks(body: str) -> list[str]:
    return [
        match.group(1)
        for match in re.finditer(r'^```(?:text)?\s*$\n(.*?)^```\s*$', body, re.MULTILINE | re.DOTALL)
    ]


def _fenced_block_contains(body: str, *tokens: str) -> bool:
    return any(all(token in block for token in tokens) for block in _fenced_code_blocks(body))


def _local_markdown_targets(body: str) -> list[str]:
    targets = re.findall(r'(?<!!)\[[^\]]*\]\(([^)]+)\)', body)
    targets += re.findall(r'!\[[^\]]*\]\(([^)]+)\)', body)
    return targets


def run(ctx: ValidationContext) -> None:
    root = ctx.root
    docs = ctx.docs
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    version = ctx.version

    # Documentation consistency.
    version_docs = [root / 'README.md', docs / 'README.md', docs / 'VALIDATION_REPORT.md']
    for path in version_docs:
        if path.exists() and version and version not in text(path):
            errors.append(rel(path) + ' does not identify the current version')

    # Public user documentation may identify the current package, but release
    # history belongs only in CHANGELOG.md.
    public_docs = [root / 'README.md'] + [
        path for path in sorted(docs.glob('*.md')) if path.name != 'CHANGELOG.md'
    ]
    waveform_release_url = (
        'https://github.com/Pav-Osmolski/'
        'foo_wave_minibar_mod-patched/releases'
    )
    obsolete_waveform_url = (
        'https://www.foobar2000.org/components/view/foo_wave_minibar_mod'
    )
    for path in public_docs:
        if not path.exists():
            continue
        body = text(path)
        if obsolete_waveform_url in body:
            errors.append(
                rel(path) + ' restores the superseded Waveform Minibar component URL'
            )
        for documented_version in re.findall(r'\bv(\d+\.\d+\.\d+)\b', body):
            if documented_version != version:
                errors.append(
                    rel(path) + ' references an earlier package version outside CHANGELOG.md: v' +
                    documented_version
                )

    changelog = docs / 'CHANGELOG.md'
    if changelog.exists():
        lines = text(changelog).splitlines()
        if not lines or lines[0] != '# DarkOneJSP3 Changelog':
            errors.append('CHANGELOG.md title is not at the beginning')
        if lines.count('# DarkOneJSP3 Changelog') != 1:
            errors.append('CHANGELOG.md must contain exactly one document title')
        if not re.search(rf'^## v{re.escape(version)} - .+$', text(changelog), re.MULTILINE):
            errors.append('CHANGELOG.md does not contain the current release')
        release_headings = [
            line for line in lines
            if re.fullmatch(r'## v\d+\.\d+(?:\.\d+)?(?:\.x)?(?:-v\d+\.\d+(?:\.\d+)?)? - .+', line)
        ]
        if not release_headings:
            errors.append('CHANGELOG.md contains no Markdown release headings')

    readme_path = root / 'README.md'
    if readme_path.exists():
        readme_body = text(readme_path)
        if waveform_release_url not in readme_body:
            errors.append('README.md is missing the patched Waveform Minibar release URL')
        enhanced_samples_target = 'DarkOneJSP3/docs/ENHANCED_SAMPLES.md'
        if '## Enhanced Sample Library' not in readme_body:
            errors.append('README.md is missing the Enhanced Sample Library section')
        if f']({enhanced_samples_target})' not in readme_body:
            errors.append('README.md is missing a link to the enhanced sample guide')
        readme_flat = re.sub(r'\s+', ' ', readme_body)
        for token in [
            'one saved layout, `DarkOneJSP3`',
            'scripted Queue Viewer',
            'JScript Panel 3 Quick Search',
        ]:
            if token not in readme_flat:
                errors.append('README.md Queue Viewer/Quick Search/FCL documentation is missing: ' + token)

        requirements_body = _section(readme_body, 'Requirements')
        if requirements_body:
            for component in [
                    'foobar2000 v2 x64', 'Columns UI', 'JScript Panel 3.8.5',
                    'JSplitter 4.x', 'Enhanced Spectrum Analyser',
                    'Waveform Minibar (mod)']:
                if component not in requirements_body:
                    errors.append('README.md no longer lists ' + component + ' as a requirement')

        installation_path = docs / 'INSTALLATION.md'
        docs_readme_path = docs / 'README.md'
        installation_body = text(installation_path) if installation_path.exists() else ''
        docs_readme_body = text(docs_readme_path) if docs_readme_path.exists() else ''
        install_requirements = _section(installation_body, '1. Requirements')
        docs_environment = _section(docs_readme_body, 'Supported environment')
        for label, body in [
                ('INSTALLATION.md requirements', install_requirements),
                ('docs/README.md supported environment', docs_environment)]:
            for component in [
                    'foobar2000 v2 x64', 'Columns UI', 'JScript Panel 3',
                    'JSplitter 4.x', 'Enhanced Spectrum Analyser',
                    'Waveform Minibar (mod)']:
                if component not in body:
                    errors.append(label + ' no longer lists ' + component)
        for label, body in [('README.md', readme_body), ('INSTALLATION.md', installation_body)]:
            for token in ['one saved layout', '`DarkOneJSP3`', 'JScript Panel 3 Quick Search']:
                if token not in body:
                    errors.append(label + ' does not preserve the current single-layout FCL description: ' + token)
        for token in [
            'Waveform Minibar component preferences',
            'Waveform Minibar (mod) 1.2.69-patched',
            waveform_release_url,
            'Transparent background (requires Columns UI): enabled',
            'Draw window border: disabled',
            'Enable anti-aliasing: enabled (default',
            '25, 30, 50, 60, 100, 120 and 144 FPS',
            'native ancestor repaint events',
            'guarded 100 ms fallback',
            'Waveform Minibar stores its own component preferences',
        ]:
            if token not in installation_body:
                errors.append('INSTALLATION.md Waveform Minibar setup guidance is missing: ' + token)
        for token in [
            'Enhanced Spectrum Analyser component preferences',
            'Peak colours, top to bottom: RGB 0, 128, 192 (#0080C0)',
            'Color Count 6; Alpha 255; Peak Hold 0 ms; Velocity 20 dB/s',
            'Alpha 96; Peak Hold 1000 ms; Velocity 3 dB/s',
            'Alpha 128; Peak Hold 3000 ms; Velocity 3 dB/s',
            'Color to RGB 3, 7, 7 (#030707)',
            'Tilt 4.5 dB/oct',
            'Refresh Time 8 ms; Window Function HANNING; FFT Size 16384',
            'Average Time 400 ms',
        ]:
            if token not in installation_body:
                errors.append(
                    'INSTALLATION.md Enhanced Spectrum Analyser setup guidance is missing: ' + token
                )

        # Promotional artwork is maintained in the GitHub repository and may be
        # omitted from runtime release archives. When an assets folder is present,
        # however, every referenced repository image must also be present.
        repository_only_assets = {
            'assets/darkonejsp3-logo.png',
            'assets/darkonejsp3-screenshot-main.webp',
            'assets/darkonejsp3-screenshot-albumnotes.webp',
            'assets/darkonejsp3-screenshot-wide.webp',
        }
        readme_targets = _local_markdown_targets(readme_body)
        readme_targets += re.findall(r'<img\s+[^>]*src=["\']([^"\']+)', readme_body, re.I)
        repository_assets_present = (root / 'assets').is_dir()
        for target in readme_targets:
            target = target.split('#', 1)[0].strip()
            if not target or '://' in target or target.startswith(('mailto:', '#')):
                continue
            if Path(target).suffix.lower() == '.fcl':
                continue
            if target in repository_only_assets and not repository_assets_present:
                continue
            resolved = (root / target.replace('/', os.sep)).resolve()
            if not resolved.exists():
                errors.append('README link target is missing: ' + target)

    # Markdown-only documentation contract and local-link integrity.
    for path in sorted(docs.glob('*.md')):
        body = text(path)
        lines = body.splitlines()
        if not lines or not lines[0].startswith('# '):
            errors.append(rel(path) + ' must begin with a level-1 Markdown heading')
        h1_count = sum(1 for line in lines if re.fullmatch(r'# [^#].*', line))
        if h1_count != 1:
            errors.append(rel(path) + ' must contain exactly one level-1 Markdown heading')
        for i, line in enumerate(lines):
            stripped = line.strip()
            if len(stripped) >= 3 and len(set(stripped)) == 1 and stripped[0] in '=-~^':
                errors.append(rel(path) + f' retains a legacy underline heading marker at line {i + 1}')
            if re.match(r'^#{1,6} ', line):
                if i > 0 and lines[i - 1] != '':
                    errors.append(rel(path) + f' heading lacks a blank line before line {i + 1}')
                if i + 1 < len(lines) and lines[i + 1] != '':
                    errors.append(rel(path) + f' heading lacks a blank line after line {i + 1}')

        fence_count = sum(1 for line in lines if line.startswith('```'))
        if fence_count % 2:
            errors.append(rel(path) + ' contains an unbalanced fenced code block')

        local_anchors = _markdown_heading_anchors(body)
        for target in _local_markdown_targets(body):
            raw_target = target.strip()
            if not raw_target or raw_target.startswith('mailto:') or '://' in raw_target:
                continue
            if raw_target.startswith('#'):
                if raw_target[1:] not in local_anchors:
                    errors.append(rel(path) + ' Markdown heading link target is missing: ' + raw_target)
                continue
            target_path, _, target_anchor = raw_target.partition('#')
            if not target_path:
                continue
            resolved = (path.parent / target_path.replace('/', os.sep)).resolve()
            if not resolved.exists():
                errors.append(rel(path) + ' local Markdown link target is missing: ' + raw_target)
                continue
            if target_anchor and resolved.suffix.lower() == '.md':
                target_body = text(resolved)
                if target_anchor not in _markdown_heading_anchors(target_body):
                    errors.append(rel(path) + ' local Markdown heading target is missing: ' + raw_target)

    for path in [
        docs / 'CONFIGURATION_GUIDE.md',
        docs / 'INSTALLATION.md',
        docs / 'TROUBLESHOOTING.md',
    ]:
        if not path.exists():
            continue
        body = text(path)
        contents_sections, body_sections, contents_links = _numbered_document_sections(body)
        if contents_sections != body_sections:
            errors.append(rel(path) + ' contents do not match its numbered sections')
        numbers = [number for number, _ in body_sections]
        if numbers != list(range(1, len(numbers) + 1)):
            errors.append(rel(path) + ' numbered sections are not unique and sequential')
        if len(contents_links) != len(body_sections):
            errors.append(rel(path) + ' contents entries must all be clickable Markdown links')
        else:
            expected_links = [
                (number, '#' + _github_heading_slug(f'{number}. {title}'))
                for number, title in body_sections
            ]
            if contents_links != expected_links:
                errors.append(rel(path) + ' contents links do not target the matching numbered headings')

    # Whitespace-sensitive diagrams, path lists and property references must
    # remain explicit fenced text blocks. This prevents Markdown conversion or
    # later editing from collapsing their alignment into ordinary paragraphs.
    fenced_contracts = {
        docs / 'README.md': (
            ('DarkOneJSP3\\', 'user-components-x64\\foo_jscript_panel3\\samples\\'),
        ),
        docs / 'LAYOUT_AND_PANEL_MAP.md': (
            ('Column', 'DOJSP3.Root', 'DOJSP3.ControlsRight'),
            ('01  samples\\Smooth Playlist Manager.txt', '12  <profile>\\DarkOneJSP3\\jscript\\DarkOneJSP3 - Control Panel - Right.txt'),
            ('01  loaders\\JSplitter 01 - Root.txt', 'controller: jsplitter\\06_display_waveform.js'),
            ('PSS01 -> JSplitter 01', 'PSS06 -> JSplitter 06'),
        ),
        docs / 'INSTALLATION.md': (
            ('DarkOneJSP3\\', 'user-components-x64\\'),
            ('%APPDATA%\\foobar2000-v2\\profile\\DarkOneJSP3\\', 'foo_jscript_panel3\\samples\\'),
            ('DarkOneJSP3\\jsplitter\\loaders\\JSplitter 01 - Root.txt', 'JSplitter 06 - Display and Waveform.txt'),
            ('DOJSP3.Queue',),
            ('DarkOneJSP3\\jscript\\DarkOneJSP3 - Queue Viewer.txt',),
        ),
        docs / 'CONFIGURATION_GUIDE.md': (
            ('DOJSP3.Queue',),
            ('DarkOneJSP3\\jscript\\DarkOneJSP3 - Queue Viewer.txt',),
            ('DarkOneJSP3\\jscript\\DarkOneJSP3 - Quick Search.txt',),
            ('js_data\\darkonejsp3.album-identity.json', 'js_data\\musicbrainz.artist-map.json'),
            ('Startup', 'DARKONEJSP3.STARTUP.TRANSITION', 'Waveform host', 'DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay'),
        ),
        docs / 'TROUBLESHOOTING.md': (
            ('Display accent colour > Default - DarkOne blue', 'Display accent colour > Set custom colour...'),
        ),
        docs / 'MIGRATION_REFERENCE.md': (
            ('Panel Stack Splitter 01', 'Waveform Minibar', 'Right Controls'),
            ('DarkOneJSP3\\reference\\Original DarkOne2021 PSS and panel map.txt',),
        ),
        docs / 'CREDITS.md': (
            ('user-components-x64\\foo_jscript_panel3\\licenses\\',),
        ),
    }
    for path, contracts in fenced_contracts.items():
        if not path.exists():
            continue
        body = text(path)
        for tokens in contracts:
            if not _fenced_block_contains(body, *tokens):
                errors.append(rel(path) + ' is missing a required fenced text structure: ' + tokens[0])

    config_guide = docs / 'CONFIGURATION_GUIDE.md'
    if config_guide.exists():
        body = text(config_guide)
        if '## 13. Resetting DarkOneJSP3' not in body:
            errors.append('Configuration guide contents omit the reset section')
        if body.count('Album Notes cache files and downloaded provider data') > 1:
            errors.append('Configuration guide repeats cache-preservation guidance')
        for phrase in [
            'The enhanced JS Playlist participates in behaviour and full resets',
            'additionally clears its saved scroll anchors',
            'Automatic base scale ranges from 50% to 200%',
            'size bypasses responsive calculation',
            'Alternating row shading',
            'DarkOneJSP3-managed defaults',
            'DarkOne dark grey: RGB 24, 24, 24',
            'Generic upstream',
            'Scripted Queue Viewer',
            'Album Art/Spectrum side dividers',
            'Side divider colour',
            'InfoStack tab strip',
            'generic image panel rather than an InfoStack text page',
            'Transparent / inherit parent',
            'The lower control-panel dividers',
            'Enable Dynamic',
            'Page background',
            'Selected background',
            'DarkOne dark grey: RGB 24, 24, 24 (default)',
            'Each panel instance stores its choice independently',
            'Native Waveform Minibar menu',
            'Enable anti-aliasing',
            '25, 30, 50, 60, 100, 120 and 144 FPS choices',
            'event-driven path does not require a DarkOneJSP3-specific plugin notification',
            'guarded 100 ms fallback',
        ]:
            if phrase not in body:
                errors.append('Configuration guide playlist reset coverage is missing: ' + phrase)

        for expectation in MENU_DOCUMENTATION_EXPECTATIONS:
            source_path = root / expectation['source']
            if not source_path.exists():
                errors.append('Menu documentation source is missing: ' + expectation['source'])
                continue
            source_body = text(source_path)
            for label in expectation['labels']:
                if label not in source_body:
                    errors.append(expectation['name'] + ' source menu label is missing: ' + label)
                if label not in body:
                    errors.append(
                        'Configuration guide omits ' + expectation['name'] +
                        ' menu label: ' + label
                    )

    troubleshooting = docs / 'TROUBLESHOOTING.md'
    if troubleshooting.exists():
        body = text(troubleshooting)
        if ('## 8. Factory reset' not in body or '## 9. Performance and smoothness' not in body or
                '## 10. Diagnostics to include in a bug report' not in body):
            errors.append('Troubleshooting sections are not in the expected order')
        if re.search(r'\bv\d+\.\d+\.\d+\b', body) or 'Install v' in body:
            errors.append('Troubleshooting contains development-version upgrade advice')
        if 'disable its Transparent' in body or 'disable Transparent background' in body:
            errors.append('Troubleshooting retains obsolete Waveform Minibar transparency advice')
        for phrase in [
            'SupportPseudoTransparency',
            'The DarkOneJSP3 Queue Viewer wrapper must import the component-local',
            'DarkOneJSP3-managed properties',
            'DarkOneJSP3 wrapper rather than the generic sample entry',
            'Right-click the InfoStack tab strip',
            'generic Album Art JScript Panel',
            'cross-component notification path is not reliable',
            'The supported Startup menu is under TOOLS',
            'explicitly reactivates an idle same-album lookup',
            '1.2.69-patched',
            waveform_release_url,
            'native ancestor repaint events',
            'Entire waveform flashes when clicking a playlist or InfoStack',
            'Waveform playback uses more CPU than desired',
        ]:
            if phrase not in body:
                errors.append('Troubleshooting current-state guidance is missing: ' + phrase)
