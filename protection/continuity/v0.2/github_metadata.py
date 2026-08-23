#!/usr/bin/env python3
import argparse, datetime as dt, hashlib, json, subprocess
from pathlib import Path

REQ=("repository","main_branch","issues","pulls","issue_comments","pull_review_comments","releases","workflow_runs")
OPT=("rulesets","discussions")

def utc(): return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
def dump(o): return (json.dumps(o,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def sha(b): return hashlib.sha256(b).hexdigest()
def run(a):
 p=subprocess.run(a,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode: raise RuntimeError(f"command failed ({p.returncode}): {' '.join(a)}\n{p.stderr.strip()}")
 return p.stdout

def api(ep,pages=False):
 a=["gh","api"]+(["--paginate","--slurp"] if pages else [])+[ep]
 o=json.loads(run(a))
 if pages and isinstance(o,list) and all(isinstance(x,list) for x in o):
  return [y for x in o for y in x]
 return o

def discussions(repo):
 owner,name=repo.split('/',1)
 q='query($owner:String!,$name:String!){repository(owner:$owner,name:$name){discussions(first:100){nodes{number title body url createdAt updatedAt closedAt author{login} category{name slug} comments(first:100){totalCount nodes{body url createdAt updatedAt author{login}}}}}}}'
 o=json.loads(run(["gh","api","graphql","-f",f"owner={owner}","-f",f"name={name}","-f",f"query={q}"]))
 return o.get('data',{}).get('repository',{}).get('discussions',{}).get('nodes',[])

def live(repo):
 d,e={},{}
 eps={
  "repository":(f"repos/{repo}",False),"main_branch":(f"repos/{repo}/branches/main",False),
  "issues":(f"repos/{repo}/issues?state=all&per_page=100",True),"pulls":(f"repos/{repo}/pulls?state=all&per_page=100",True),
  "issue_comments":(f"repos/{repo}/issues/comments?per_page=100",True),"pull_review_comments":(f"repos/{repo}/pulls/comments?per_page=100",True),
  "releases":(f"repos/{repo}/releases?per_page=100",True),"rulesets":(f"repos/{repo}/rulesets?per_page=100",True)}
 for k,(ep,p) in eps.items():
  try: d[k]=api(ep,p)
  except Exception as x: e[k]=str(x)
 try:
  ps=api(f"repos/{repo}/actions/runs?per_page=100",True); runs=[]; total=0
  for p in ps if isinstance(ps,list) else [ps]:
   if isinstance(p,dict): total=max(total,int(p.get('total_count',0))); runs+=p.get('workflow_runs') or []
  d['workflow_runs']={'total_count_reported':total,'captured_count':len(runs),'workflow_runs':runs}
 except Exception as x: e['workflow_runs']=str(x)
 try: d['discussions']=discussions(repo)
 except Exception as x: e['discussions']=str(x)
 miss=[k for k in REQ if k not in d]
 if miss: raise RuntimeError('required metadata unavailable: '+', '.join(miss)+'\n'+json.dumps(e,indent=2))
 return d,e

def fixture(p):
 o=json.loads(Path(p).read_text()); d=o.get('datasets',o); miss=[k for k in REQ if k not in d]
 if miss: raise RuntimeError('fixture missing: '+', '.join(miss))
 return d,o.get('errors',{})

def frontier(d):
 r,b=d['repository'],d['main_branch']; c=b.get('commit',{}); s=c.get('sha'); t=(c.get('commit',{}).get('tree',{}) or {}).get('sha')
 if not s: raise RuntimeError('main branch payload lacks SHA')
 return {'repository_full_name':r.get('full_name'),'default_branch':r.get('default_branch'),'main_sha':s,'main_tree_sha':t}

def capture(a):
 d,e=fixture(a.fixture) if a.fixture else live(a.repo); f=frontier(d)
 if a.repo and f.get('repository_full_name') and f['repository_full_name'].lower()!=a.repo.lower(): raise RuntimeError('repository identity mismatch')
 out=Path(a.out)/dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ'); out.mkdir(parents=True,exist_ok=False); ent={}
 for k,o in sorted(d.items()):
  b=dump(o); p=out/f'{k}.json'; p.write_bytes(b); ent[k]={'file':p.name,'sha256':sha(b),'bytes':len(b),'status':'captured'}
 for k in OPT:
  if k not in d: ent[k]={'file':None,'sha256':None,'bytes':0,'status':'unavailable','error':e.get(k,'unavailable')}
 m={'schema':'urn:uu-aap:continuity:github-metadata-manifest:v0.2','captured_at':utc(),'capture_mode':'fixture' if a.fixture else 'github_api_read_only','frontier':f,'datasets':ent,
 'coverage_limits':{'issue_endpoint_may_include_pull_request_shaped_issues':True,'discussion_top_level_comments_per_discussion_max':100,'discussion_pagination_complete':False,'pull_review_submissions_complete':False},
 'boundaries':{'git_objects_included':False,'credentials_included':False,'release_asset_bytes_included':False,'workflow_artifact_bytes_included':False,'workflow_logs_included':False,'repository_authority_transferred':False,'canonical_successor_created':False}}
 p=out/'metadata-manifest.json'; p.write_bytes(dump(m)); print(p)

def verify(a):
 p=Path(a.manifest); m=json.loads(p.read_text()); bad=[]
 for k,x in m['datasets'].items():
  if x.get('status')!='captured': continue
  q=p.parent/x['file']
  if not q.is_file(): bad.append(k+':missing'); continue
  b=q.read_bytes()
  if sha(b)!=x['sha256']: bad.append(k+':sha256')
  if len(b)!=x['bytes']: bad.append(k+':size')
  try: json.loads(b)
  except Exception: bad.append(k+':json')
 if bad: raise RuntimeError('metadata verification failed: '+'; '.join(bad))
 print('metadata continuity verification: OK')

def main():
 p=argparse.ArgumentParser(); s=p.add_subparsers(dest='cmd',required=True); c=s.add_parser('capture'); c.add_argument('--repo'); c.add_argument('--out',required=True); c.add_argument('--fixture'); c.set_defaults(fn=capture); v=s.add_parser('verify'); v.add_argument('--manifest',required=True); v.set_defaults(fn=verify); a=p.parse_args()
 if a.cmd=='capture' and not a.fixture and not a.repo: p.error('capture requires --repo unless --fixture is used')
 a.fn(a)
if __name__=='__main__': main()
