#!/usr/bin/env python3
import argparse, datetime as dt, hashlib, json, subprocess
from pathlib import Path
from urllib.parse import urlsplit

def utc(): return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
def run(a):
 p=subprocess.run(a,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode: raise RuntimeError(f"command failed: {' '.join(a)}\n{p.stderr.strip()}")
 return p.stdout
def safe(u):
 if '://' in u and urlsplit(u).password is not None: raise RuntimeError('credential-bearing URL is forbidden')
 return u
def refs(u):
 out=run(['git','ls-remote',safe(u)]); m={}
 for line in out.splitlines():
  if not line.strip(): continue
  s,r=line.split('\t',1)
  if r=='HEAD' or r.startswith('refs/heads/') or r.startswith('refs/tags/'): m[r]=s
 return dict(sorted(m.items()))
def digest(m): return hashlib.sha256((json.dumps(m,sort_keys=True,separators=(',',':'))+'\n').encode()).hexdigest()
def main():
 p=argparse.ArgumentParser(); p.add_argument('--canonical',required=True); p.add_argument('--mirror',required=True); p.add_argument('--out',required=True); a=p.parse_args()
 c,m=refs(a.canonical),refs(a.mirror)
 missing={k:v for k,v in c.items() if k not in m}; extra={k:v for k,v in m.items() if k not in c}; divergent={k:{'canonical':v,'mirror':m[k]} for k,v in c.items() if k in m and m[k]!=v}; exact=not missing and not extra and not divergent
 r={'schema':'urn:uu-aap:continuity:mirror-verification-receipt:v0.2','observed_at':utc(),'canonical_url':a.canonical,'mirror_url':a.mirror,'canonical_refs_sha256':digest(c),'mirror_refs_sha256':digest(m),'canonical_main':c.get('refs/heads/main'),'mirror_main':m.get('refs/heads/main'),'exact_ref_match':exact,'missing_refs':missing,'extra_refs':extra,'divergent_refs':divergent,'authority_transfer':False,'canonical_successor_created':False,'remote_mutation_performed':False}
 q=Path(a.out); q.parent.mkdir(parents=True,exist_ok=True); q.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n',encoding='utf-8'); print(q)
 if not exact: raise SystemExit(2)
if __name__=='__main__': main()
