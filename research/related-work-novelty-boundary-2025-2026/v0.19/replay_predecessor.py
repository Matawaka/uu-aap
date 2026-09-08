"""Replay all run blocks of the exact v0.18 workflow, retaining all old gates."""
from __future__ import annotations
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

BASE = '648811172c9711a8b2c482e93ff8cee493ef3b50'
WORKFLOW = '.github/workflows/statebench-bound-scoring-v0.18.yml'
BLOB = 'f036e930b118fba7279d34da28c001b19eb3a63c'
NAMES = ['Validate bound scoring helpers and immutable predecessor',
         'Reproduce exact v0.17 negative observation and all predecessor gates',
         'Execute bound synthetic scoring and predeclared semantic controls',
         'Recheck namespace public imports and preserve predecessor evidence',
         'Preserve fixed scoring bridge source for recovery',
         'Require fresh bound scoring evidence identical to first A/B pair']


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo', required=True, type=Path)
    p.add_argument('--worktree', required=True, type=Path)
    a = p.parse_args()
    if a.worktree.exists(): raise ValueError('FRESH_PREDECESSOR_WORKTREE_REQUIRED')
    subprocess.run(['git','-C',str(a.repo),'worktree','add','--detach',str(a.worktree),BASE],check=True)
    data=(a.worktree/WORKFLOW).read_bytes()
    if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=BLOB:
        raise ValueError('FROZEN_V018_WORKFLOW_CHANGED')
    lines,blocks,name=data.decode().splitlines(),[],''
    for i,line in enumerate(lines):
        if line.startswith('      - name: '):name=line[len('      - name: '):]
        if line=='        run: |':
            chunk=[]
            for part in lines[i+1:]:
                if part and not part.startswith('          '):break
                chunk.append(part[10:] if part else '')
            blocks.append((name,'\n'.join(chunk)+'\n'))
    if [n for n,_ in blocks]!=NAMES:raise ValueError('FROZEN_V018_BLOCKS_DIFFER')
    env={**os.environ,'PREDECESSOR18':str(a.worktree.resolve())}
    for name,script in blocks:
        print('::group::Frozen v0.18: '+name,flush=True)
        subprocess.run(['/bin/bash','--noprofile','--norc','-e','-o','pipefail','-c',
                        script.replace('$GITHUB_WORKSPACE','$PREDECESSOR18')],cwd=a.worktree,env=env,check=True)
        print('::endgroup::',flush=True)


if __name__=='__main__':main()
