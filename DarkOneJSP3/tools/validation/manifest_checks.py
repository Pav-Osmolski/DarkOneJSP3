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
    'recommended_setup': 'manual layout from LAYOUT_AND_PANEL_MAP.txt',
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

EXPECTED_PANEL_CONTRACTS = {
    'DOJSP3.Queue': {
        'type': 'JScript Panel 3',
        'source': 'DarkOneJSP3/jscript/DarkOneJSP3 - Queue Viewer.txt',
        'script': 'DarkOneJSP3/jscript/DarkOneJSP3 - Queue Viewer.txt',
    },
    'DOJSP3.QuickSearch': {
        'type': 'JScript Panel 3',
        'source': 'DarkOneJSP3/jscript/DarkOneJSP3 - Quick Search.txt',
    },
    'DOJSP3.Spectrum': {
        'type': 'Enhanced Spectrum Analyser',
        'source': 'native component',
    },
    'DOJSP3.Waveform': {
        'type': 'Waveform Minibar (mod)',
        'source': 'native component',
    },
}

EXPECTED_INFO_STACK_TAB_AREA = {
    'automatic_label': 'Automatic height (follows tab font sizing)',
    'fixed_override_label': 'Set fixed tab area height...',
    'automatic_value': 0,
}


def _check_inventory(ctx: ValidationContext, manifest: dict[str, Any]) -> None:
    errors = ctx.errors
    project = ctx.project
    samples = ctx.samples
    root = ctx.root
    rel = ctx.rel

    jsplitters = manifest.get('jsplitters', [])
    if not isinstance(jsplitters, list) or len(jsplitters) != 6:
        errors.append('Layout manifest must declare exactly six JSplitters')
        jsplitters = []
    numbers: list[int] = []
    titles: list[str] = []
    scripts: list[str] = []
    for item in jsplitters:
        if not isinstance(item, dict):
            errors.append('Layout manifest contains an invalid JSplitter entry')
            continue
        number = item.get('number')
        title = str(item.get('title', '')).strip()
        script = str(item.get('script', '')).strip()
        if isinstance(number, int) and not isinstance(number, bool):
            numbers.append(number)
        else:
            errors.append('Layout manifest JSplitter number is invalid')
        titles.append(title)
        scripts.append(script)
        if not title or not script:
            errors.append('Layout manifest JSplitter entry is incomplete')
        elif not (project / 'jsplitter' / script).is_file():
            errors.append(
                'Layout manifest JSplitter source is missing: ' +
                rel(project / 'jsplitter' / script))
    if sorted(numbers) != list(range(1, 7)):
        errors.append('Layout manifest JSplitter numbers must be unique 1-6')
    if len(set(titles)) != len(titles):
        errors.append('Layout manifest contains duplicate JSplitter titles')
    if len(set(scripts)) != len(scripts):
        errors.append('Layout manifest contains duplicate JSplitter scripts')

    panels = manifest.get('panels', [])
    if not isinstance(panels, list) or len(panels) != 14:
        errors.append('Layout manifest must declare exactly fourteen panels')
        panels = []
    numbers = []
    titles = []
    panels_by_title: dict[str, dict[str, Any]] = {}
    for item in panels:
        if not isinstance(item, dict):
            errors.append('Layout manifest contains an invalid panel entry')
            continue
        number = item.get('number')
        title = str(item.get('title', '')).strip()
        source = str(item.get('source', '')).strip()
        if isinstance(number, int) and not isinstance(number, bool):
            numbers.append(number)
        else:
            errors.append('Layout manifest panel number is invalid')
        titles.append(title)
        if title:
            panels_by_title[title] = item
        if not title or not source:
            errors.append('Layout manifest panel entry is incomplete')
            continue
        if source == 'native component':
            continue
        if source.startswith('samples/'):
            target = samples / source[len('samples/'):]
        elif source.startswith('DarkOneJSP3/'):
            target = root / source
        else:
            errors.append('Layout manifest panel source is unsupported: ' + source)
            continue
        if not target.is_file():
            errors.append('Layout manifest panel source is missing: ' + rel(target))
            continue
        declared_version = item.get('version')
        if declared_version is not None:
            match = re.search(
                r'^//\s*@version\s+"([^"]+)"',
                ctx.text(target),
                re.MULTILINE,
            )
            if not isinstance(declared_version, str) or not declared_version:
                errors.append('Layout manifest panel version is invalid: ' + title)
            elif not match:
                errors.append('Layout manifest panel source lacks @version: ' + title)
            elif declared_version != match.group(1):
                errors.append('Layout manifest panel version differs from source: ' + title)
    if sorted(numbers) != list(range(1, 15)):
        errors.append('Layout manifest panel numbers must be unique 1-14')
    if len(set(titles)) != len(titles):
        errors.append('Layout manifest contains duplicate panel titles')

    for title, expected in EXPECTED_PANEL_CONTRACTS.items():
        panel = panels_by_title.get(title)
        if panel is None:
            errors.append('Layout manifest panel inventory is missing ' + title)
            continue
        for key, value in expected.items():
            if panel.get(key) != value:
                errors.append(
                    f'Layout manifest {title} {key} is incorrect')


def run(ctx: ValidationContext, manifest: dict[str, Any],
        build: dict[str, Any], version: str) -> None:
    errors = ctx.errors

    if set(manifest) != EXPECTED_TOP_LEVEL_KEYS:
        errors.append('Layout manifest top-level schema is incorrect')
    if str(manifest.get('version', '')) != version:
        errors.append('Layout manifest version does not match build-info.json')
    if manifest.get('target') != build.get('targets'):
        errors.append('Layout manifest targets do not match build-info.json')
    if manifest.get('credits') != 'DarkOneJSP3/docs/CREDITS.txt':
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
