"""Require separately executed v0.19 evidence identical to the first A/B pair."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

FIRST = 'dfda99dc27d0d62b324864359331ff84f64abc70'
WF = '.github/workflows/statebench-response-filter-v0.19.yml'
WF_BLOB = 'f00de7ffd8fcce27b7c61514baa9ce5fd9790f98'
ROOT = 'research/related-work-novelty-boundary-2025-2026/v0.19'
SOURCES = {'adapter.py':'f6735ed35e3474feb63ef68bb089e73518c9fc60',
           'gate.py':'3285166c132043caa7ee6e104e154a0a4ce388f4',
           'replay_predecessor.py':'6f5871c31a7e1069c55f4e815e06866ea71a6c35'}
RESULT = 'd36235a0b6fd3d708e15dde16b736b70015be524e7486408d77e10048da6bdae'
MANIFEST = '4095f20fc89d3ca9585d3fc9694643e298de199066fea2a7e05a46b853c3315b'
RECEIPT = 'e37b55d0e79824a3febc1a23fbeb8e10e06eb9fe6f96bbe60b69325ae3a56255'


def require(ok,reason):
    if not ok:raise ValueError(reason)


def sha(data):return hashlib.sha256(data).hexdigest()


def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()


def read_bound(path,expected):
    require(path.is_file() and not path.is_symlink(),'REGULAR_EVIDENCE_FILE_REQUIRED')
    data=path.read_bytes();require(sha(data)==expected,'EVIDENCE_DIGEST_MISMATCH:'+path.name)
    return data


def exact(a,b):require(a==b,'FRESH_EVIDENCE_NOT_IDENTICAL')


def members(root):
    result={}
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(),'EVIDENCE_SYMLINK')
        if path.is_file():
            data=path.read_bytes();result[path.relative_to(root).as_posix()]={'bytes':len(data),'sha256':sha(data)}
    return result


def validate(repo,evidence):
    root=repo/ROOT
    require(evidence.is_dir() and evidence.resolve()!=root.resolve(),'FRESH_OBSERVATION_DIRECTORY_REQUIRED')
    for path,expected in SOURCES.items():require(blob((root/path).read_bytes())==expected,'FROZEN_SOURCE_CHANGED:'+path)
    spec=importlib.util.spec_from_file_location('qualified_v019_gate',root/'gate.py')
    require(spec is not None and spec.loader is not None,'GATE_MODULE_REQUIRED')
    gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
    gate.boundary(repo)
    gate.git(repo,'merge-base','--is-ancestor',FIRST,'HEAD')
    for path,expected in SOURCES.items():require(gate.git(repo,'rev-parse',FIRST+':'+ROOT+'/'+path)==expected,'HISTORICAL_SOURCE_CHANGED')
    require(gate.git(repo,'rev-parse',FIRST+':'+WF)==WF_BLOB,'HISTORICAL_WORKFLOW_CHANGED')
    receipt=json.loads(read_bound(root/'qualification-receipt.json',RECEIPT))
    require(receipt['first_head']==FIRST and receipt['workflow_blob']==WF_BLOB,'FIRST_PAIR_BINDING')
    require(receipt['source_blobs']==SOURCES,'SOURCE_RECEIPT_BINDING')
    pair=receipt['first_jobs']
    require(set(pair)=={'A','B'} and all(x['conclusion']=='success' for x in pair.values()),'FIRST_PAIR_NOT_GREEN')
    require(pair['A']['job_id']!=pair['B']['job_id'] and pair['A']['runner_id']!=pair['B']['runner_id'],'INDEPENDENT_FIRST_JOBS_REQUIRED')
    require(receipt['all_first_members_equal'] is True,'FIRST_ARTIFACT_COMPARISON_REQUIRED')
    exact(receipt['non_effects'],gate.NON_EFFECTS)
    frozen=read_bound(root/'results.json',RESULT)
    manifest=json.loads(read_bound(root/'evidence-members.json',MANIFEST))
    require(manifest['schema']=='matawaka.layered-evidence-members/v0.19','MANIFEST_SCHEMA')
    require(manifest['predecessor_manifest_sha256']=='3a1a253b8d51278edaca9e3385c71e6b5da4750216126a9c9c37bd721833d368','PREDECESSOR_MANIFEST_BINDING')
    prior=json.loads(read_bound(root.parent/'v0.18/evidence-members.json',manifest['predecessor_manifest_sha256']))
    require(not any(n.startswith('predecessor/') for n in manifest['new_members']),'MANIFEST_OVERLAP')
    expected={**manifest['new_members'],**{'predecessor/'+n:v for n,v in prior.items()}}
    require(len(expected)==manifest['total_file_count'],'MANIFEST_COUNT')
    exact(members(evidence),expected)
    exact(read_bound(evidence/'results.json',RESULT),frozen)
    result=json.loads(frozen)
    require(result['status']=='BOUND_SINGLE_RESPONSE_FILTER_BRIDGE_EXECUTED_PASS','RESULT_NOT_PASS')
    require(result['original_metric_compatibility']==result['original_task_compatibility']=='NONPASS','HISTORY_PROMOTION')
    require(result['documents']==251 and result['repetitions']==2 and result['rejection_records']==94,'SCOPE_COUNTS_CHANGED')
    exact(result['non_effects'],gate.NON_EFFECTS)
    require(result['filter']=={'name':'none','components':['take_first']},'FILTER_SCOPE_CHANGED')
    require(result['raw_upstream_partial_write_observed'] is True,'RAW_NEGATIVE_ERASED')
    for name,digest in result['evidence_sha256'].items():read_bound(evidence/name,digest)
    exact((evidence/'namespace-after-filter.json').read_bytes(),(evidence/'predecessor/namespace-after-bound-scoring.json').read_bytes())
    exact((evidence/'imports-after-filter.json').read_bytes(),(evidence/'predecessor/imports-after-bound-scoring.json').read_bytes())
    print('STATEBENCH_SINGLE_RESPONSE_FILTER_V0.19_QUALIFIED_BOUNDED_SCOPE')
    print('ORIGINAL_TASK_AND_METRIC=NONPASS; MODEL_DISPATCH_AND_MERGE_AUTHORIZED=false')
    print('RESULT_SHA256='+RESULT)


class Tests(unittest.TestCase):
    def test_exact(self):exact(b'abc',b'abc')
    def test_changed_bytes(self):
        with self.assertRaises(ValueError):exact(b'abc',b'abd')
    def test_semantic_not_byte_identity(self):
        with self.assertRaises(ValueError):exact(b'{"x":1}',b'{"x": 1}')
    def test_missing_member(self):
        with self.assertRaises(ValueError):exact({}, {'required':1})
    def test_status_promotion(self):
        with self.assertRaises(ValueError):exact('PASS','NONPASS')
    def test_frozen_bindings(self):
        root=Path(__file__).resolve().parent
        for name,digest in [('results.json',RESULT),('evidence-members.json',MANIFEST),('qualification-receipt.json',RECEIPT)]:read_bound(root/name,digest)
        for name,digest in SOURCES.items():require(blob((root/name).read_bytes())==digest,'SOURCE_CHANGED')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,default=Path.cwd());p.add_argument('--evidence',type=Path);p.add_argument('--self-test',action='store_true')
    a=p.parse_args()
    if a.self_test:
        r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests));raise SystemExit(0 if r.wasSuccessful() else 1)
    require(a.evidence is not None,'FRESH_EVIDENCE_REQUIRED_NO_FALLBACK')
    validate(a.repo.resolve(),a.evidence.resolve())


if __name__=='__main__':main()
