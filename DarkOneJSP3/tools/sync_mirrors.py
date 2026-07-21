#!/usr/bin/env python3
"""Synchronise the deliberate DarkOneJSP3 compatibility source mirrors."""
from __future__ import annotations

from pathlib import Path
import argparse
import sys

NETWORK_START = '// == DARKONEJSP3 SHARED NETWORK COORDINATOR =='
NETWORK_END = '// == END DARKONEJSP3 SHARED NETWORK COORDINATOR =='


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


def paths(root: Path) -> dict[str, Path]:
    samples = root / 'user-components-x64' / 'foo_jscript_panel3' / 'samples' / 'js'
    return {
        'queue_canonical': root / 'DarkOneJSP3' / 'jscript' / 'js' / 'Queue_Viewer.js',
        'queue_mirror': samples / 'queue_viewer.js',
        'network_canonical': samples / 'darkone_network.js',
        'network_host': samples / 'common.js',
    }


def check(root: Path) -> list[str]:
    p = paths(root)
    errors: list[str] = []
    for name, path in p.items():
        if not path.exists():
            errors.append(f'missing {name}: {path.relative_to(root)}')
    if errors:
        return errors

    if p['queue_canonical'].read_bytes() != p['queue_mirror'].read_bytes():
        errors.append('queue_viewer.js differs from canonical Queue_Viewer.js')

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
    p['queue_mirror'].write_bytes(p['queue_canonical'].read_bytes())
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
