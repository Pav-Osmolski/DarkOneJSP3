#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

sys.dont_write_bytecode = True

from validation import ValidationContext
from validation import runtime_checks, static_checks


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    root = Path(args[0] if args else '.').resolve()
    ctx = ValidationContext(root)

    static_checks.run(ctx)
    runtime_checks.run(ctx)

    if ctx.errors:
        print(f'DarkOneJSP3 v{ctx.version or "unknown"} validation FAILED')
        for error in ctx.errors:
            print('- ' + error)
        return 1

    count = sum(
        1 for path in root.rglob('*')
        if path.is_file() and '__pycache__' not in path.parts
    )
    print(
        f'DarkOneJSP3 v{ctx.version} validation passed: '
        f'{count} files, zero warnings.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
