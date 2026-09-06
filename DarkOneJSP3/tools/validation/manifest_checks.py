from __future__ import annotations

from typing import Any
import re

from .context import ValidationContext


EXPECTED_TOP_LEVEL_KEYS = {
    'version',
    'target',
    'jsplitters',
    'panels',
    'credits',
    'public_attribution',
    'build_info',
    'panel_title_policy',
    'fcl_policy',
    'features',
}

EXPECTED_FCL_POLICY = {
    'recommended_setup': 'manual layout from LAYOUT_AND_PANEL_MAP.md',
    'optional_path': 'DarkOneJSP3/fcl/DarkOneJSP3.fcl',
    'may_be_distributed': True,
    'required': False,
    'patched_or_generated': False,
    'user_managed': True,
    'included_in_hotfixes': False,
    'bundled_layouts': ['DarkOneJSP3'],
    'single_layout': True,
    'default_layout': 'DarkOneJSP3',
    'default_layout_queue': 'scripted Queue Viewer',
    'default_layout_search': 'scripted JScript Panel 3 Quick Search',
}

EXPECTED_INFO_STACK_TAB_AREA = {
    'automatic_label': 'Automatic height (follows tab font sizing)',
    'fixed_override_label': 'Set fixed tab area height...',
    'automatic_value': 0,
}

EXPECTED_SPLITTERS = (
    ('DOJSP3.Root', '01_root.js'),
    ('DOJSP3.Main', '02_main_columns.js'),
    ('DOJSP3.InfoStack', '03_info_stack_tabs.js'),
    ('DOJSP3.ArtSpectrum', '04_art_spectrum.js'),
    ('DOJSP3.Controls', '05_bottom_controls.js'),
    ('DOJSP3.DisplayStack', '06_display_waveform.js'),
)

# Complete durable inventory; source headers remain the version authority.
EXPECTED_PANELS = (
    ('DOJSP3.PlaylistManager', 'samples/Smooth Playlist Manager.txt'),
    ('DOJSP3.LastfmBio', 'samples/Last.fm Bio.txt'),
    ('DOJSP3.LastfmInfo', 'samples/Last.fm Artist Info + User Info.txt'),
    ('DOJSP3.AlbumNotes', 'samples/Album Notes.txt'),
    ('DOJSP3.Queue', 'DarkOneJSP3/jscript/DarkOneJSP3 - Queue Viewer.txt'),
    ('DOJSP3.Properties', 'samples/Properties.txt'),
    ('DOJSP3.AlbumArt', 'samples/Album Art.txt'),
    ('DOJSP3.Spectrum', 'native component'),
    ('DOJSP3.Playlist', 'samples/JS Playlist.txt'),
    ('DOJSP3.ControlsLeft', 'DarkOneJSP3/jscript/DarkOneJSP3 - Control Panel - Left.txt'),
    ('DOJSP3.QuickSearch', 'DarkOneJSP3/jscript/DarkOneJSP3 - Quick Search.txt'),
    ('DOJSP3.Display', 'DarkOneJSP3/jscript/DarkOneJSP3 - Display Panel.txt'),
    ('DOJSP3.Waveform', 'native component'),
    ('DOJSP3.ControlsRight', 'DarkOneJSP3/jscript/DarkOneJSP3 - Control Panel - Right.txt'),
)


def _check_exact_entries(ctx, entries, expected, splitters=False):
    for index, item in enumerate(entries):
        if not isinstance(item, dict) or index >= len(expected):
            ctx.errors.append('Layout manifest contains an invalid entry')
            continue
        title, source = expected[index]
        if splitters:
            contract = {'number': index + 1, 'title': title, 'script': source}
            if item != contract:
                ctx.errors.append('Layout manifest JSplitter contract differs: ' + title)
            continue
        kind = {'DOJSP3.Spectrum': 'Enhanced Spectrum Analyser',
                'DOJSP3.Waveform': 'Waveform Minibar (mod)'}.get(title, 'JScript Panel 3')
        contract = {'number': index + 1, 'title': title, 'source': source, 'type': kind}
        if title == 'DOJSP3.Queue':
            contract['script'] = source
        if source != 'native component':
            target = ctx.samples / source[8:] if source.startswith('samples/') else ctx.root / source
            if target.is_file():
                match = re.search(r'^//\s*@version\s+"([^"]+)"', ctx.text(target), re.M)
                if match:
                    contract['version'] = match.group(1)
                else:
                    ctx.errors.append('Panel source lacks @version: ' + title)
            else:
                ctx.errors.append('Layout manifest panel source is missing: ' + source)
        if item != contract:
            ctx.errors.append('Layout manifest panel contract differs: ' + title)


def _check_inventory(ctx: ValidationContext, manifest: dict[str, Any]) -> None:
    for key, expected, splitters in (
            ('jsplitters', EXPECTED_SPLITTERS, True),
            ('panels', EXPECTED_PANELS, False)):
        entries = manifest.get(key)
        if not isinstance(entries, list) or len(entries) != len(expected):
            ctx.errors.append(f'Layout manifest must declare exactly {len(expected)} {key}')
            continue
        _check_exact_entries(ctx, entries, expected, splitters)


def run(ctx: ValidationContext, manifest: dict[str, Any],
        build: dict[str, Any], version: str) -> None:
    errors = ctx.errors

    if not isinstance(manifest, dict) or not isinstance(build, dict):
        errors.append('Layout manifest and build metadata must be JSON objects')
        return

    if set(manifest) != EXPECTED_TOP_LEVEL_KEYS:
        errors.append('Layout manifest top-level schema is incorrect')
    if str(manifest.get('version', '')) != version:
        errors.append('Layout manifest version does not match build-info.json')
    if manifest.get('target') != build.get('targets'):
        errors.append('Layout manifest targets do not match build-info.json')
    if manifest.get('credits') != 'DarkOneJSP3/docs/CREDITS.md':
        errors.append('Layout manifest credits path is incorrect')
    if manifest.get('public_attribution') != 'DeViLhoOD':
        errors.append('Layout manifest public attribution is incorrect')
    if manifest.get('build_info') != 'DarkOneJSP3/build-info.json':
        errors.append('Layout manifest build-info path is incorrect')
    if manifest.get('panel_title_policy') != {
            'information_source': {
                'required': 'DOJSP3.AlbumNotes',
                'legacy_aliases_supported': False,
                'tested_layout_title': 'DOJSP3.AlbumNotes'}}:
        errors.append('Layout manifest information-source title policy is incorrect')
    if manifest.get('fcl_policy') != EXPECTED_FCL_POLICY:
        errors.append('Layout manifest bundled-FCL policy is incorrect')
    if manifest.get('features') != {
            'info_stack_tab_area_menu': EXPECTED_INFO_STACK_TAB_AREA}:
        errors.append('Layout manifest user-facing feature contract is incorrect')

    _check_inventory(ctx, manifest)
