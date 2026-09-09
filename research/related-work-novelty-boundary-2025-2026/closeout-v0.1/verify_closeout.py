"""Offline source/decision checks for terminal synthesis, not a new experiment."""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import unittest

BASE = 'ec4e6826ff2a1be90751e44077d8fec3e96ecbb2'
MAIN = '0e74f89695bbcb02c759000752696c322d908f7a'
ROOT = 'research/related-work-novelty-boundary-2025-2026'
HERE = ROOT + '/closeout-v0.1'
WF = '.github/workflows/research-closeout-v0.1.yml'
ISSUES = [956,958,960,962,964,966,970,972,974,976,978,980,982,984,986,989,991,993,995]
FINDINGS = {
 'foundational_claims':'THREE_DEFEATED_TWO_NARROWED_NONE_UNCHANGED',
 'broad_taxonomy_novelty':'NOT_ESTABLISHED_BROAD_CLAIM_DEFEATED',
 'synthetic_comparison':'NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION',
 'operational_value':'INSUFFICIENT_EVIDENCE',
 'named_integration_path':'BOUNDED_SYNTHETIC_INTEROPERABILITY_DEMONSTRATED',
 'original_upstream_task':'NONPASS','original_upstream_metric':'NONPASS','model_performance':'NOT_MEASURED'}
BACKLOG = {'aggregation-v020':'DEFERRED_NOT_REQUIRED_FOR_CLOSEOUT',
 'full-evaluator':'DEFERRED_NOT_REQUIRED_FOR_CLOSEOUT','model-experiment':'DEFERRED_SEPARATE_AUTHORITY',
 'expanded-filters-judge':'DEFERRED_CONSUMER_DRIVEN','operational-comparison':'DEFERRED_WITH_INSUFFICIENT_EVIDENCE',
 'upstream-outreach':'DRAFT_ONLY_NOT_SENT','global-roadmap-cleanup':'ADMINISTRATIVE_FOLLOWUP_NOT_BLOCKING'}
NON_EFFECT_KEYS = {'new_experiment_executed','aggregation_executed','native_runtime_replayed_in_closeout',
 'model_executed','provider_api_called','evaluator_dispatched','upstream_contacted','novelty_established',
 'operational_advantage_established','operational_non_advantage_established','external_scientific_review_completed',
 'old_research_or_receipts_changed','main_roadmap_or_registry_changed','product_authority_changed',
 'stable_core_changed','bulk_issues_closed','merge_authorized','release_authorized'}
TOP_KEYS = {'schema','issue','observed_on','scope','main_observed','experimental_frontier','experimental_subtree',
 'checkpoint_ref','status','planning_decision','mandatory_new_experiments','findings','version_coverage','backlog',
 'remaining_acceptance','source_blobs','archive_recheck','non_effects'}


def require(ok, reason):
 if not ok: raise ValueError(reason)


def encode(x):
 return json.dumps(x,sort_keys=True,ensure_ascii=False,allow_nan=False).encode()


def exact(a,b): require(encode(a)==encode(b),'TYPED_VALUE_MISMATCH')


def blob(data):
 return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()


def git(repo,*args):
 return subprocess.check_output(['git','-c','core.hooksPath=/dev/null','-C',str(repo),*args])


def check(data):
 require(type(data) is dict and set(data)==TOP_KEYS,'CLOSED_TOP_LEVEL_REQUIRED')
 exact(data['schema'],'matawaka.research-closeout/v0.1')
 exact(data['issue'],997)
 exact(data['main_observed'],MAIN)
 exact(data['experimental_frontier'],BASE)
 exact(data['experimental_subtree'],'5a868b26429fdd0dddccf55ef5bdae8b2c638404')
 exact(data['status'],'INTERNAL_RESEARCH_SYNTHESIS_READY_FOR_REVIEW')
 exact(data['planning_decision'],'STOP_AUTOMATIC_EXPERIMENTAL_SUCCESSORS_AT_V019')
 exact(data['scope'],'RELATED_WORK_AND_STATEBENCH_V01_TO_V019_ONLY')
 exact(data['mandatory_new_experiments'],[])
 exact(data['findings'],FINDINGS)
 require(type(data['version_coverage']) is list and len(data['version_coverage'])==19,'ALL_VERSIONS_REQUIRED')
 for i,item in enumerate(data['version_coverage']):
  require(set(item)=={'version','issue','disposition'},'CLOSED_VERSION_ENTRY_REQUIRED')
  exact(item['version'],'v0.'+str(i+1));exact(item['issue'],ISSUES[i])
  require(type(item['disposition']) is str and item['disposition'].endswith('_RETAINED'),'HISTORICAL_RETENTION_REQUIRED')
 require(type(data['backlog']) is list and len(data['backlog'])==len(BACKLOG),'FINITE_BACKLOG_REQUIRED')
 require(len({b['id'] for b in data['backlog']})==len(BACKLOG),'DUPLICATE_BACKLOG')
 exact({b['id']:b['state'] for b in data['backlog']},BACKLOG)
 for item in data['backlog']:
  require(set(item)=={'id','state','reactivation'} and type(item['reactivation']) is str and len(item['reactivation'])>30,'EXPLICIT_REOPEN_CONDITION_REQUIRED')
 exact(data['remaining_acceptance'],[{'id':'independent_review','state':'PENDING','automatic':False},
  {'id':'repository_disposition','state':'PENDING_SEPARATE_AUTHORITY','automatic':False}])
 exact(data['non_effects'],{k:False for k in NON_EFFECT_KEYS})
 require(type(data['source_blobs']) is dict and len(data['source_blobs'])==12,'SOURCE_COVERAGE_REQUIRED')
 for path,value in data['source_blobs'].items():
  require(not Path(path).is_absolute() and '..' not in Path(path).parts,'SOURCE_PATH_INVALID')
  require(type(value) is str and len(value)==40 and all(c in '0123456789abcdef' for c in value),'EXACT_SOURCE_BLOB_REQUIRED')
 archive=data['archive_recheck']
 exact(archive['sha256'],'8867882099eede96210917a014446a43c68063c2812b0c087679c9101b8612e4')
 exact(archive['bytes'],27836872)
 exact(archive['original_archives'],4);exact(archive['equal_members_per_archive'],61)
 exact(archive['bound_documents'],251);exact(archive['preserved_rejection_records_per_job'],94)
 for k in ('native_runtime_rerun','independent_judge_semantics_proven','authenticity_proven','full_runtime_snapshots_git_committed','user_long_term_custody_confirmed'):
  require(archive[k] is False,'ARCHIVE_EVIDENCE_PROMOTION')


def verify(repo):
 directory=repo/HERE
 data=json.loads((directory/'closeout.json').read_bytes());check(data)
 git(repo,'merge-base','--is-ancestor',MAIN,BASE)
 git(repo,'merge-base','--is-ancestor',BASE,'HEAD')
 require(git(repo,'rev-parse',f'HEAD:{ROOT}/v0.19').decode().strip()==data['experimental_subtree'],'FROZEN_V019_TREE_CHANGED')
 for i in range(1,20):
  path=f'{ROOT}/v0.{i}'
  exact(git(repo,'rev-parse',f'{BASE}:{path}').decode().strip(),git(repo,'rev-parse',f'HEAD:{path}').decode().strip())
 changes=git(repo,'diff','--no-renames','--name-status',BASE,'HEAD').decode().splitlines()
 allowed={HERE+'/README.md',HERE+'/closeout.json',HERE+'/verify_closeout.py',WF}
 for line in changes:
  status,path=line.split('\t',1)
  require(status=='A' and path in allowed,'CLOSEOUT_ONLY_ADDITIVE_DIFF_REQUIRED')
 require({line.split('\t',1)[1] for line in changes}==allowed,'EXACT_CLOSEOUT_DELIVERABLE_SET_REQUIRED')
 require(not git(repo,'diff','--name-only').strip(),'TRACKED_WORKTREE_MUTATION')
 for path,expected in data['source_blobs'].items():
  before=git(repo,'show',f'{BASE}:{path}')
  require(blob(before)==expected,'SOURCE_SNAPSHOT_MISMATCH:'+path)
  require((repo/path).read_bytes()==before,'CURRENT_SOURCE_REWRITTEN:'+path)
 q5=json.loads((repo/ROOT/'v0.5/qualification-receipt.json').read_bytes())
 exact(q5['result']['top_result'],FINDINGS['synthetic_comparison'])
 exact(q5['result']['recall_delta'],0.0)
 q6=json.loads((repo/ROOT/'v0.6/qualification-receipt.json').read_bytes())
 exact(q6['result']['top_result'],FINDINGS['operational_value'])
 for k in ('operational_advantage_established','operational_non_advantage_established'):
  require(q6['non_effects'][k] is False,'OPERATIONAL_RESULT_PROMOTION')
 q17=json.loads((repo/ROOT/'v0.17/results.json').read_bytes())
 exact(q17['scoring_compatibility'],'NONPASS')
 q19=json.loads((repo/ROOT/'v0.19/results.json').read_bytes())
 exact(q19['status'],'BOUND_SINGLE_RESPONSE_FILTER_BRIDGE_EXECUTED_PASS')
 exact(q19['original_metric_compatibility'],'NONPASS');exact(q19['original_task_compatibility'],'NONPASS')
 require(q19['non_effects']['model_executed'] is False and q19['non_effects']['aggregate_benchmark_score_established'] is False,'EXPERIMENT_SCOPE_PROMOTION')
 print('CLOSEOUT_SOURCE_AND_DECISION_CHECK_PASS')
 print('19 historical trees unchanged; 12 source bindings checked; 0 new experiments')
 print('Independent review=PENDING; repository disposition=PENDING_SEPARATE_AUTHORITY')


class Tests(unittest.TestCase):
 def setUp(self):self.data=json.loads(Path(__file__).with_name('closeout.json').read_bytes())
 def test_valid(self):check(self.data)
 def test_unknown_field(self):
  self.data['extra']=1
  with self.assertRaises(ValueError):check(self.data)
 def test_new_required_gate(self):
  self.data['mandatory_new_experiments']=['v0.20']
  with self.assertRaises(ValueError):check(self.data)
 def test_novelty_promotion(self):
  self.data['non_effects']['novelty_established']=True
  with self.assertRaises(ValueError):check(self.data)
 def test_non_advantage_promotion(self):
  self.data['findings']['operational_value']='NO_OPERATIONAL_VALUE'
  with self.assertRaises(ValueError):check(self.data)
 def test_history_dropped(self):
  self.data['version_coverage'].pop()
  with self.assertRaises(ValueError):check(self.data)
 def test_backlog_reactivated(self):
  self.data['backlog'][0]['state']='CURRENT'
  with self.assertRaises(ValueError):check(self.data)
 def test_review_fabricated(self):
  self.data['remaining_acceptance'][0]['state']='COMPLETE'
  with self.assertRaises(ValueError):check(self.data)
 def test_authentication_overclaim(self):
  self.data['archive_recheck']['authenticity_proven']=True
  with self.assertRaises(ValueError):check(self.data)
 def test_numeric_false_not_boolean(self):
  self.data['non_effects']['model_executed']=0
  with self.assertRaises(ValueError):check(self.data)


def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--repo',type=Path,default=Path.cwd())
 parser.add_argument('--self-test',action='store_true')
 args=parser.parse_args()
 if args.self_test:
  result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
  raise SystemExit(0 if result.wasSuccessful() else 1)
 verify(args.repo.resolve())


if __name__=='__main__':main()
