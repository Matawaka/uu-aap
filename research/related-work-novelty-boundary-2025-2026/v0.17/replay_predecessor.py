"""Replay every run block of the exact v0.16 workflow in its own worktree."""
from __future__ import annotations
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

BASE = 'a5fd76f8d0c21359edd8ec60c22456484db9c240'
WORKFLOW = '.github/workflows/statebench-request-construction-v0.16.yml'
BLOB = 'c92bc04a6d471f48d1105ca78f45c89bcae85fea'
NAMES = ['Validate request contract helpers and frozen predecessor',
         'Reproduce complete frozen v0.15 and selected environment',
         'Build exact plain requests with no cache or dispatch',
         'Recheck namespace public imports and historical immutability',
         'Require fresh requests identical to first complete A/B evidence']


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
        raise ValueError('FROZEN_V016_WORKFLOW_CHANGED')
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
        raise ValueError('FROZEN_V016_BLOCKS_DIFFER')
    env = {**os.environ, 'PREDECESSOR16': str(a.worktree.resolve())}
    for name, script in blocks:
        print('::group::Frozen v0.16: ' + name, flush=True)
        subprocess.run(['/bin/bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', '-c',
                        script.replace('$GITHUB_WORKSPACE', '$PREDECESSOR16')], cwd=a.worktree, env=env, check=True)
        print('::endgroup::', flush=True)


if __name__ == '__main__':
    main()
