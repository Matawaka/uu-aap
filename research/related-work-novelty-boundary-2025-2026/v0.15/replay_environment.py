"""Execute all ten frozen v0.14 run blocks in its exact detached worktree.

The only execution-path substitution is $GITHUB_WORKSPACE -> $PREDECESSOR14,
so historical additive guards inspect their historical HEAD, not the successor.
All predecessor files, selected sync flags, effect restrictions and assertions
remain unchanged. Actions checkout/setup/upload are not re-executed here.
"""
from __future__ import annotations
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

BASE = '997df26af32d23a5fe98dc9f89bba0f37dc1b7ca'
WORKFLOW = '.github/workflows/statebench-namespace-safe-env-v0.14.yml'
WORKFLOW_BLOB = '8d82c76d69a9f88330fd12ea923a2cf6cf93a5ba'
NAMES = [
    'Preflight exact profile and historical worktrees',
    'Validate frozen history without weakening predecessor guards',
    'Single fresh frozen installation with explicit distribution exclusion',
    'Census namespace ownership and first public import before data probes',
    'Re-execute old import probe in new explicitly selected environment',
    'Acquire unchanged external plugin source and explicit BPE side input',
    'Re-execute unchanged exact-data probe and compare frozen bytes',
    'Re-execute unchanged Task NONPASS without implementing an adapter',
    'Repeat census and fresh public import after probes and close environment result',
    'Require fresh byte-identical result and first A/B qualification receipt',
]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo', required=True, type=Path)
    p.add_argument('--worktree', required=True, type=Path)
    args = p.parse_args()
    if args.worktree.exists():
        raise ValueError('FRESH_PREDECESSOR_WORKTREE_REQUIRED')
    subprocess.run(['git', '-C', str(args.repo), 'worktree', 'add', '--detach', str(args.worktree), BASE], check=True)
    data = (args.worktree / WORKFLOW).read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if blob != WORKFLOW_BLOB:
        raise ValueError('EXACT_FROZEN_WORKFLOW_REQUIRED')
    lines, blocks, name = data.decode().splitlines(), [], ''
    for i, line in enumerate(lines):
        if line.startswith('      - name: '):
            name = line[len('      - name: '):]
        if line == '        run: |':
            chunk = []
            for part in lines[i + 1:]:
                if part and not part.startswith('          '):
                    break
                chunk.append(part[10:] if part else '')
            blocks.append((name, '\n'.join(chunk) + '\n'))
    if [name for name, _ in blocks] != NAMES:
        raise ValueError('FROZEN_WORKFLOW_BLOCKS_DIFFER')
    env = {**os.environ, 'PREDECESSOR14': str(args.worktree.resolve())}
    for name, script in blocks:
        print('::group::Frozen v0.14 replay: ' + name, flush=True)
        subprocess.run(['/bin/bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', '-c',
                        script.replace('$GITHUB_WORKSPACE', '$PREDECESSOR14')],
                       cwd=args.worktree, env=env, check=True)
        print('::endgroup::', flush=True)


if __name__ == '__main__':
    main()
