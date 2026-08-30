from __future__ import annotations

from pathlib import Path
import os
import re

from .context import ValidationContext
from .expectations import MENU_DOCUMENTATION_EXPECTATIONS


def run(ctx: ValidationContext) -> None:
    root = ctx.root
    docs = ctx.docs
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    version = ctx.version
    # Documentation consistency.
    version_docs = [root / 'README.md', docs / 'README.txt', docs / 'VALIDATION_REPORT.txt']
    for path in version_docs:
        if path.exists() and version and version not in text(path):
            errors.append(rel(path) + ' does not identify the current version')

    # Public user documentation may identify the current package, but release
    # history belongs only in CHANGELOG.txt.
    public_docs = [root / 'README.md'] + [
        path for path in docs.glob('*.txt') if path.name != 'CHANGELOG.txt'
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
                    rel(path) + ' references an earlier package version outside CHANGELOG.txt: v' +
                    documented_version
                )

    changelog = docs / 'CHANGELOG.txt'
    if changelog.exists():
        lines = text(changelog).splitlines()
        if not lines or lines[0] != 'DarkOneJSP3 Changelog':
            errors.append('CHANGELOG.txt title is not at the beginning')
        if lines.count('DarkOneJSP3 Changelog') != 1:
            errors.append('CHANGELOG.txt must contain exactly one title')
        if f'v{version} - ' not in text(changelog):
            errors.append('CHANGELOG.txt does not contain the current release')
        for i, line in enumerate(lines[:-1]):
            if re.fullmatch(r'v\d+\.\d+(?:\.\d+)?(?:\.x)? - .+', line):
                if lines[i + 1] != '-' * len(line):
                    errors.append(f'CHANGELOG heading underline mismatch at line {i + 1}')


    readme_path = root / 'README.md'
    if readme_path.exists():
        readme_body = text(readme_path)
        if waveform_release_url not in readme_body:
            errors.append('README.md is missing the patched Waveform Minibar release URL')
        enhanced_samples_target = 'DarkOneJSP3/docs/ENHANCED_SAMPLES.txt'
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
        requirements_match = re.search(r'## Requirements\s+(.*?)(?:\n## |\Z)', readme_body, re.S)
        if requirements_match:
            requirements_body = requirements_match.group(1)
            for component in [
                    'foobar2000 v2 x64', 'Columns UI', 'JScript Panel 3.8.5',
                    'JSplitter 4.x', 'Enhanced Spectrum Analyser',
                    'Waveform Minibar (mod)']:
                if component not in requirements_body:
                    errors.append('README.md no longer lists ' + component + ' as a requirement')
        installation_body = text(docs / 'INSTALLATION.txt') if (docs / 'INSTALLATION.txt').exists() else ''
        docs_readme_body = text(docs / 'README.txt') if (docs / 'README.txt').exists() else ''
        install_match = re.search(r'1\. Requirements\n-+\n(.*?)\n2\. Back up first\n-+', installation_body, re.S)
        install_requirements = install_match.group(1) if install_match else ''
        environment_match = re.search(r'Supported environment\n-+\n(.*?)\nDocumentation map\n-+', docs_readme_body, re.S)
        docs_environment = environment_match.group(1) if environment_match else ''
        for label, body in [('INSTALLATION.txt requirements', install_requirements), ('docs/README.txt supported environment', docs_environment)]:
            for component in [
                    'foobar2000 v2 x64', 'Columns UI', 'JScript Panel 3',
                    'JSplitter 4.x', 'Enhanced Spectrum Analyser',
                    'Waveform Minibar (mod)']:
                if component not in body:
                    errors.append(label + ' no longer lists ' + component)
        for label, body in [('README.md', readme_body), ('INSTALLATION.txt', installation_body)]:
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
                errors.append('INSTALLATION.txt Waveform Minibar setup guidance is missing: ' + token)
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
                    'INSTALLATION.txt Enhanced Spectrum Analyser setup guidance is missing: ' +
                    token
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
        readme_targets = re.findall(r'\[[^\]]+\]\(([^)]+)\)', readme_body)
        readme_targets += re.findall(r'<img\s+[^>]*src=["\']([^"\']+)', readme_body, re.I)
        repository_assets_present = (root / 'assets').is_dir()
        for target in readme_targets:
            if '://' in target or target.startswith('#'):
                continue
            if Path(target).suffix.lower() == '.fcl':
                continue
            if target in repository_only_assets and not repository_assets_present:
                continue
            resolved = (root / target.replace('/', os.sep)).resolve()
            if not resolved.exists():
                errors.append('README link target is missing: ' + target)

    def is_heading_underline(value: str) -> bool:
        return len(value) >= 3 and len(set(value)) == 1 and value[0] in '=-~'


    def numbered_document_sections(path: Path) -> tuple[list[tuple[int, str]], list[tuple[int, str]]]:
        lines = text(path).splitlines()
        contents: list[tuple[int, str]] = []
        body: list[tuple[int, str]] = []

        try:
            contents_index = lines.index('Contents')
        except ValueError:
            contents_index = -1
        if contents_index >= 0:
            i = contents_index + 2
            while i < len(lines) and not lines[i].strip():
                i += 1
            while i < len(lines) and lines[i].strip():
                match = re.fullmatch(r'(\d+)\. (.+)', lines[i])
                if match:
                    contents.append((int(match.group(1)), match.group(2)))
                i += 1

        for i in range(len(lines) - 1):
            match = re.fullmatch(r'(\d+)\. (.+)', lines[i])
            if match and set(lines[i + 1]) == {'-'}:
                body.append((int(match.group(1)), match.group(2)))

        return contents, body


    for path in docs.glob('*.txt'):
        lines = text(path).splitlines()
        for i, line in enumerate(lines):
            if is_heading_underline(line) and (i == 0 or len(line) != len(lines[i - 1])):
                errors.append(f'{rel(path)} heading underline mismatch at line {i + 1}')

    for path in [
        docs / 'CONFIGURATION_GUIDE.txt',
        docs / 'INSTALLATION.txt',
        docs / 'TROUBLESHOOTING.txt',
    ]:
        if not path.exists():
            continue
        contents_sections, body_sections = numbered_document_sections(path)
        if contents_sections != body_sections:
            errors.append(rel(path) + ' contents do not match its numbered sections')
        numbers = [number for number, _ in body_sections]
        if numbers != list(range(1, len(numbers) + 1)):
            errors.append(rel(path) + ' numbered sections are not unique and sequential')

    config_guide = docs / 'CONFIGURATION_GUIDE.txt'
    if config_guide.exists():
        body = text(config_guide)
        guide_lines = body.splitlines()
        for i in range(len(guide_lines) - 1):
            if not (
                    is_heading_underline(guide_lines[i + 1]) and
                    len(guide_lines[i]) == len(guide_lines[i + 1])):
                continue
            if i > 0 and guide_lines[i - 1] != '':
                errors.append(
                    'Configuration guide heading lacks a blank line before line ' +
                    str(i + 1)
                )
            if i + 2 < len(guide_lines) and guide_lines[i + 2] != '':
                errors.append(
                    'Configuration guide heading lacks a blank line after line ' +
                    str(i + 2)
                )
        if '13. Resetting DarkOneJSP3' not in body:
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
                errors.append(
                    'Menu documentation source is missing: ' + expectation['source']
                )
                continue
            source_body = text(source_path)
            for label in expectation['labels']:
                if label not in source_body:
                    errors.append(
                        expectation['name'] + ' source menu label is missing: ' + label
                    )
                if label not in body:
                    errors.append(
                        'Configuration guide omits ' + expectation['name'] +
                        ' menu label: ' + label
                    )
    troubleshooting = docs / 'TROUBLESHOOTING.txt'
    if troubleshooting.exists():
        body = text(troubleshooting)
        if ('8. Factory reset' not in body or '9. Performance and smoothness' not in body or
                '10. Diagnostics to include in a bug report' not in body):
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
