#!/usr/bin/env python3
"""Validate and reproducibly package a full build and its separately supplied Wiki.

FCL is copied byte-for-byte when present; never parsed, patched or generated.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import tempfile
import zipfile

sys.dont_write_bytecode = True
from validation.inventory_checks import FCL


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_archive(path: Path, source: Path):
    """Inspect actual members and compare every byte with the validated tree."""
    expected = {p.relative_to(source).as_posix(): p for p in source.rglob('*') if p.is_file()}
    seen = set()
    folded = set()
    with zipfile.ZipFile(path) as archive:
        for member in archive.infolist():
            name = member.filename
            parts = PurePosixPath(name).parts
            mode = member.external_attr >> 16
            if (not name or '\\' in name or ':' in name or name.startswith('/') or
                    '..' in parts or name != '/'.join(parts) or member.is_dir() or
                    name in seen or name.casefold() in folded or stat.S_ISLNK(mode)):
                raise ValueError('Unsafe or duplicate ZIP member: ' + name)
            if name not in expected:
                raise ValueError('Unexpected ZIP member: ' + name)
            if member.date_time != (2020, 1, 1, 0, 0, 0) or mode != stat.S_IFREG | 0o644:
                raise ValueError('Noncanonical ZIP metadata: ' + name)
            if archive.read(member) != expected[name].read_bytes():
                raise ValueError('ZIP bytes differ from validated source: ' + name)
            seen.add(name)
            folded.add(name.casefold())
    if seen != set(expected):
        raise ValueError('ZIP inventory differs from validated source')


def package(source: Path, output: Path):
    records = {}
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(source.rglob('*')):
            if path.is_symlink():
                raise ValueError('Cannot package a symlink: ' + str(path))
            if not path.is_file():
                continue
            name = path.relative_to(source).as_posix()
            data = path.read_bytes()
            info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            records[name] = digest(data)
    validate_archive(output, source)
    return {'sha256': digest(output.read_bytes()), 'files': records}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--wiki', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(argv)
    root, wiki, output = args.root.resolve(), args.wiki.resolve(), args.output.resolve()
    if output.is_relative_to(root) or output.is_relative_to(wiki):
        parser.error('Output must be outside both source trees')
    result = subprocess.run([sys.executable, '-B', str(root / 'DarkOneJSP3/tools/validate_release.py'),
                             str(root), '--wiki', str(wiki)], timeout=120)
    if result.returncode:
        return result.returncode
    version = json.loads((root / 'DarkOneJSP3/build-info.json').read_text())['version']
    names = [f'DarkOneJSP3_Full_v{version}.zip', f'DarkOneJSP3_GitHub_Wiki_v{version}.zip',
             f'DarkOneJSP3_Validation_v{version}.json']
    output.mkdir(parents=True, exist_ok=True)
    if any((output / name).exists() for name in names):
        parser.error('Output files already exist; choose a fresh output directory')
    with tempfile.TemporaryDirectory(prefix='darkone-build-', dir=output) as temp:
        staging = Path(temp)
        report = {'version': version, 'behaviour_suites': 36,
                  'native_foobar2000_tested': False, 'archives': {}}
        for source, name in zip((root, wiki), names[:2]):
            report['archives'][name] = package(source, staging / name)
        report['fcl_policy'] = 'Copied byte-for-byte when present; not parsed, patched or generated'
        report['fcl_sha256'] = digest((root / FCL).read_bytes()) if (root / FCL).is_file() else None
        (staging / names[2]).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        for name in names:
            (staging / name).rename(output / name)
            print(output / name)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, zipfile.BadZipFile, subprocess.TimeoutExpired) as exc:
        print('Release packaging failed: ' + str(exc), file=sys.stderr)
        raise SystemExit(1)
