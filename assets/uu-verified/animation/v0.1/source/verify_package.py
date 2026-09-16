#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Read-only verification of the complete visual delivery package; no issuance."""
import argparse
import hashlib
import json
from pathlib import Path
import sys


def verify(root: Path) -> bool:
    root = root.resolve()
    manifest = json.loads((root/'artifact-manifest.json').read_text(encoding='utf-8'))
    if manifest.get('type') != 'UU_VERIFIED_VISUAL_ASSET_MANIFEST':
        raise ValueError('Unexpected manifest type')
    ok = True
    for record in manifest['files']:
        relative = Path(record['path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe manifest path')
        target = (root/relative).resolve()
        if not target.is_relative_to(root):
            raise ValueError('Manifest file resolves outside the package')
        if not target.is_file():
            print(f'MISSING {relative}')
            ok = False
            continue
        digest = hashlib.sha256()
        with target.open('rb') as f:
            for block in iter(lambda: f.read(1024*1024), b''):
                digest.update(block)
        passed = target.stat().st_size == record['bytes'] and digest.hexdigest() == record['sha256']
        print(f'{"MATCH" if passed else "MISMATCH"} {relative}')
        ok = ok and passed
    print('PACKAGE_BYTES_MATCH' if ok else 'PACKAGE_INCOMPLETE_OR_CHANGED')
    print('Artwork integrity only; not UU VERIFIED issuance or independent review.')
    return ok


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    sys.exit(0 if verify(args.root) else 1)
