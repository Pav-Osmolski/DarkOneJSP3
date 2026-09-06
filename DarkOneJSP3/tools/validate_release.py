#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import argparse
import sys

sys.dont_write_bytecode = True

from validation import ValidationContext
from validation import runtime_checks, static_checks
from validation.markdown_checks import run_wiki


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Validate a complete DarkOneJSP3 release tree')
    parser.add_argument('root', nargs='?', default='.')
    parser.add_argument('--wiki', type=Path, help='Also validate the standalone Wiki tree')
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    ctx = ValidationContext(root)

    static_checks.run(ctx)
    runtime_checks.run(ctx)
    if args.wiki:
        run_wiki(args.wiki.resolve(), ctx.errors, ctx)

    if ctx.errors:
        print(f'DarkOneJSP3 v{ctx.version or "unknown"} validation FAILED')
        for error in ctx.errors:
            print('- ' + error)
        return 1

    count = sum(
        1 for path in root.rglob('*')
        if path.is_file() and '__pycache__' not in path.parts and
        path.suffix.lower() != '.fcl'
    )
    print(
        f'DarkOneJSP3 v{ctx.version} validation passed: '
        f'{count} audited files, zero warnings; FCL excluded.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
