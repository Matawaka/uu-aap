"""Execute the five exact v0.15 workflow run blocks in its own worktree."""
from __future__ import annotations
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

BASE = '4b4a7959b6821fa93c31ef2ba2e015b415d5ada9'
WORKFLOW = '.github/workflows/statebench-model-free-adapter-v0.15.yml'
BLOB = 'b477e0436ce3a66cfd51f67c0f349265879a9268'
NAMES = ['Check adapter hostile tests and immutable predecessor boundary',
         'Reproduce all v0.14 environment and historical evidence gates',
         'Execute named model-free adapter and exact format fidelity twice',
         'Recheck installed namespace and public imports after adapter execution',
         'Require fresh adapter evidence identical to the first A/B pair']


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo', required=True, type=Path)
    p.add_argument('--worktree', required=True, type=Path)
    a = p.parse_args()
    if a.worktree.exists():
        raise ValueError('FRESH_PREDECESSOR_WORKTREE_REQUIRED')
    subprocess.run(['git', '-C', str(a.repo), 'worktree', 'add', '--detach', str(a.worktree), BASE], check=True)
    data = (a.worktree / WORKFLOW).read_bytes()
    if hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() != BLOB:
        raise ValueError('FROZEN_V015_WORKFLOW_CHANGED')
    lines, blocks, name = data.decode().splitlines(), [], ''
    for i, line in enumerate(lines):
        if line.startswith('      - name: '):
            name = line[len('      - name: '):]
        if line == '        run: |':
            chunk = []
            for part in lines[i+1:]:
                if part and not part.startswith('          '):
                    break
                chunk.append(part[10:] if part else '')
            blocks.append((name, '\n'.join(chunk) + '\n'))
    if [name for name, _ in blocks] != NAMES:
        raise ValueError('FROZEN_V015_BLOCKS_DIFFER')
    env = {**os.environ, 'PREDECESSOR15': str(a.worktree.resolve())}
    for name, script in blocks:
        print('::group::Frozen v0.15: ' + name, flush=True)
        subprocess.run(['/bin/bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', '-c',
                        script.replace('$GITHUB_WORKSPACE', '$PREDECESSOR15')], cwd=a.worktree, env=env, check=True)
        print('::endgroup::', flush=True)


if __name__ == '__main__':
    main()
