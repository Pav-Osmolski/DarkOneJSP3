"""Explicit release path allowlist; optional FCL bytes remain user-managed."""
import json
import struct

INVENTORY = 'DarkOneJSP3/tools/release-inventory.json'
FCL = 'DarkOneJSP3/fcl/DarkOneJSP3.fcl'


def run(ctx):
    try:
        expected = json.loads((ctx.root / INVENTORY).read_text(encoding='utf-8'))
        if not isinstance(expected, list) or not all(isinstance(x, str) for x in expected):
            raise ValueError('inventory must be an array of paths')
        if expected != sorted(set(expected)) or INVENTORY not in expected or FCL in expected:
            raise ValueError('inventory must be sorted, unique, include itself and exclude optional FCL')
        actual = set()
        for path in ctx.root.rglob('*'):
            relative = path.relative_to(ctx.root).as_posix()
            if path.is_symlink():
                ctx.errors.append('Release symlink is forbidden: ' + relative)
            if path.is_file() and relative != FCL:
                actual.add(relative)
                if path.suffix.lower() == '.bmp':
                    data = path.read_bytes()
                    if len(data) < 54 or data[:2] != b'BM':
                        ctx.errors.append('Invalid bitmap header: ' + relative)
                    else:
                        size = struct.unpack_from('<I', data, 2)[0]
                        offset = struct.unpack_from('<I', data, 10)[0]
                        header, width, height, planes, bits, compression = struct.unpack_from('<IiiHHI', data, 14)
                        stride = ((width * bits + 31) // 32) * 4
                        if (size != len(data) or header < 40 or width <= 0 or height == 0 or
                                planes != 1 or bits not in {1, 4, 8, 16, 24, 32} or
                                offset < 14 + header or offset >= size or
                                (compression == 0 and offset + stride * abs(height) > size)):
                            ctx.errors.append('Invalid bitmap dimensions or payload: ' + relative)
        for missing in sorted(set(expected) - actual):
            ctx.errors.append('Release inventory missing file: ' + missing)
        for extra in sorted(actual - set(expected)):
            ctx.errors.append('Unexpected release file: ' + extra)
    except (OSError, ValueError) as exc:
        ctx.errors.append('Invalid release inventory: ' + str(exc))
