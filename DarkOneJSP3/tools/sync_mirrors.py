#!/usr/bin/env python3
"""Synchronise deliberate DarkOneJSP3 and standalone-sample source mirrors."""
from __future__ import annotations

from pathlib import Path
import argparse
import re

NETWORK_START = '// == DARKONEJSP3 SHARED NETWORK COORDINATOR =='
NETWORK_END = '// == END DARKONEJSP3 SHARED NETWORK COORDINATOR =='
HELPERS_START = '// == JSP3 ENHANCED SAMPLE COMPATIBILITY HELPERS =='
HELPERS_END = '// == END JSP3 ENHANCED SAMPLE COMPATIBILITY HELPERS =='
LEGACY_DEFAULTS_START = '// == JSP3 ENHANCED LEGACY SAMPLE DEFAULTS =='
LEGACY_DEFAULTS_END = '// == END JSP3 ENHANCED LEGACY SAMPLE DEFAULTS =='
LEGACY_BRIDGE_START = '// == JSP3 ENHANCED LEGACY RESET BRIDGE =='
LEGACY_BRIDGE_END = '// == END JSP3 ENHANCED LEGACY RESET BRIDGE =='


def read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8-sig')


def replace_network_block(common: str, canonical: str) -> str:
    if NETWORK_START not in common or NETWORK_END not in common:
        raise ValueError('common.js does not contain the DarkOneNetwork mirror markers')
    prefix, remainder = common.split(NETWORK_START, 1)
    _, suffix = remainder.split(NETWORK_END, 1)
    return (
        prefix.rstrip() + '\n\n' + NETWORK_START + '\n' +
        canonical.strip() + '\n' + NETWORK_END + '\n' + suffix.lstrip('\r\n')
    )



def replace_helpers_block(helpers: str, performance: str, cadence: str) -> str:
    canonical = performance.strip() + '\n\n' + cadence.strip()
    if HELPERS_START not in helpers or HELPERS_END not in helpers:
        return helpers.rstrip() + '\n\n' + HELPERS_START + '\n' + canonical + '\n' + HELPERS_END + '\n'
    prefix, remainder = helpers.split(HELPERS_START, 1)
    _, suffix = remainder.split(HELPERS_END, 1)
    return (
        prefix.rstrip() + '\n\n' + HELPERS_START + '\n' + canonical +
        '\n' + HELPERS_END + '\n' + suffix.lstrip('\r\n')
    )


def strip_use_strict(source: str) -> str:
    return re.sub(r'^\s*"use strict";\s*', '', source, count=1)


def build_legacy_reset_adapter(defaults: str, bridge: str) -> str:
    return (
        '"use strict";\n\n'
        '// Generated compatibility adapter for saved pre-v0.9.17 sample entries.\n'
        '// Do not edit directly; run sync_mirrors.py after changing the canonical\n'
        '// sample-default registry or neutral reset bridge.\n\n'
        + LEGACY_DEFAULTS_START + '\n' + strip_use_strict(defaults).strip() + '\n'
        + LEGACY_DEFAULTS_END + '\n\n'
        + LEGACY_BRIDGE_START + '\n' + strip_use_strict(bridge).strip() + '\n'
        + LEGACY_BRIDGE_END + '\n'
    )

def paths(root: Path) -> dict[str, Path]:
    samples = root / 'user-components-x64' / 'foo_jscript_panel3' / 'samples'
    sample_js = samples / 'js'
    sample_shared = samples / 'shared'
    project_shared = root / 'DarkOneJSP3' / 'shared'
    return {
        'queue_canonical': root / 'DarkOneJSP3' / 'jscript' / 'js' / 'Queue_Viewer.js',
        'queue_mirror': sample_js / 'queue_viewer.js',
        'network_canonical': sample_js / 'darkone_network.js',
        'network_host': sample_js / 'common.js',
        'performance_canonical': sample_shared / 'performance_utils.js',
        'performance_mirror': project_shared / 'performance_utils.js',
        'cadence_canonical': sample_shared / 'ui_cadence.js',
        'cadence_mirror': project_shared / 'ui_cadence.js',
        'colour_canonical': sample_shared / 'colour_utils.js',
        'colour_mirror': project_shared / 'colour_utils.js',
        'sample_defaults_canonical': sample_shared / 'sample_defaults.js',
        'reset_bridge_canonical': sample_js / 'jsp3_enhanced_reset.js',
        'reset_bridge_legacy': sample_js / 'darkonejsp3_reset.js',
        'helpers_host': root / 'user-components-x64' / 'foo_jscript_panel3' / 'helpers.txt',
    }


FILE_MIRROR_PAIRS = (
    ('queue_canonical', 'queue_mirror', 'queue_viewer.js differs from canonical Queue_Viewer.js'),
    ('performance_canonical', 'performance_mirror', 'project performance helper differs from standalone canonical helper'),
    ('cadence_canonical', 'cadence_mirror', 'project UI-cadence helper differs from standalone canonical helper'),
    ('colour_canonical', 'colour_mirror', 'project colour helper differs from standalone canonical helper'),
)


def check(root: Path) -> list[str]:
    p = paths(root)
    errors: list[str] = []
    for name, path in p.items():
        if not path.exists():
            errors.append(f'missing {name}: {path.relative_to(root)}')
    if errors:
        return errors

    for canonical, mirror, message in FILE_MIRROR_PAIRS:
        if p[canonical].read_bytes() != p[mirror].read_bytes():
            errors.append(message)

    helpers = read_text(p['helpers_host'])
    performance = read_text(p['performance_canonical']).strip()
    cadence = read_text(p['cadence_canonical']).strip()
    try:
        embedded = helpers.split(HELPERS_START, 1)[1].split(HELPERS_END, 1)[0].strip()
    except IndexError:
        errors.append('helpers.txt does not contain the enhanced compatibility helper block')
    else:
        if embedded != performance + '\n\n' + cadence:
            errors.append('helpers.txt enhanced compatibility block differs from canonical helpers')

    legacy_expected = build_legacy_reset_adapter(
        read_text(p['sample_defaults_canonical']),
        read_text(p['reset_bridge_canonical']),
    )
    if read_text(p['reset_bridge_legacy']) != legacy_expected:
        errors.append('legacy reset adapter differs from canonical defaults and bridge')

    common = read_text(p['network_host'])
    canonical = read_text(p['network_canonical']).strip()
    try:
        mirrored = common.split(NETWORK_START, 1)[1].split(NETWORK_END, 1)[0].strip()
    except IndexError:
        errors.append('common.js does not contain a complete DarkOneNetwork mirror block')
    else:
        if mirrored != canonical:
            errors.append('common.js DarkOneNetwork block differs from darkone_network.js')
    return errors


def sync(root: Path) -> None:
    p = paths(root)
    for canonical, mirror, _ in FILE_MIRROR_PAIRS:
        p[mirror].write_bytes(p[canonical].read_bytes())

    p['reset_bridge_legacy'].write_text(
        build_legacy_reset_adapter(
            read_text(p['sample_defaults_canonical']),
            read_text(p['reset_bridge_canonical']),
        ),
        encoding='utf-8',
        newline='\n',
    )

    helpers = read_text(p['helpers_host'])
    p['helpers_host'].write_text(
        replace_helpers_block(
            helpers,
            read_text(p['performance_canonical']),
            read_text(p['cadence_canonical']),
        ),
        encoding='utf-8',
        newline='\n',
    )

    common = read_text(p['network_host'])
    canonical = read_text(p['network_canonical'])
    p['network_host'].write_text(
        replace_network_block(common, canonical),
        encoding='utf-8',
        newline='\n',
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('root', nargs='?', default='.')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = Path(args.root).resolve()

    if not args.check:
        sync(root)

    errors = check(root)
    for error in errors:
        print('ERROR:', error)
    if errors:
        print(f'FAILED: {len(errors)} mirror mismatch(es)')
        return 1
    print('PASS: compatibility source mirrors are synchronised')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
