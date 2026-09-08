"""Replay every run block of the exact v0.17 workflow in its own worktree."""
from __future__ import annotations
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

BASE = '05c6cfc746517e6c7befd6995d31be0d0fb738f6'
WORKFLOW = '.github/workflows/statebench-scoring-contract-v0.17.yml'
BLOB = 'dbebb685c85aa1a1842fb5c6c294c701b8706cb5'
NAMES = ['Validate synthetic contract helpers and exact predecessor',
         'Reproduce every frozen v0.16 run block without weakening history',
         'Execute synthetic scoring contract audit twice without model or provider',
         'Recheck namespace imports and preserve exact predecessor evidence',
         'Preserve fixed audit source for recovery',
         'Require fresh scoring NONPASS evidence identical to first A/B pair']


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
        raise ValueError('FROZEN_V017_WORKFLOW_CHANGED')
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
        raise ValueError('FROZEN_V017_BLOCKS_DIFFER')
    env = {**os.environ, 'PREDECESSOR17': str(a.worktree.resolve())}
    for name, script in blocks:
        print('::group::Frozen v0.17: ' + name, flush=True)
        subprocess.run(['/bin/bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', '-c',
                        script.replace('$GITHUB_WORKSPACE', '$PREDECESSOR17')], cwd=a.worktree, env=env, check=True)
        print('::endgroup::', flush=True)


if __name__ == '__main__':
    main()
