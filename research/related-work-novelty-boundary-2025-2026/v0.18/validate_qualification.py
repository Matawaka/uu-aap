"""Require new independently executed evidence to match the first A/B observation."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

FIRST = '49a161c3fa67589b9e3393cb5b162db0a24948d5'
FROZEN_HASHES = {'evidence-members.json': '3a1a253b8d51278edaca9e3385c71e6b5da4750216126a9c9c37bd721833d368',
 'qualification-receipt.json': '33500e1858c6b4fa5c67f19c894fbc62bdad91a900eff2c8d175adc5c547014d',
 'results.json': '041800590327928c6a414e7f9284c26cf58eec7081e6b89775cf3d2e040f0c24'}
SOURCE_BLOBS = {'README.md': 'e477f6b05957d9de19dccbd7422346ea6feb0845',
 'adapter.py': '9ed5294978ef4cb7a3f145cc5e9dde13a67c503c',
 'contract.json': '7bc175cfcb4f67f4c2133cc87a029396c51a5720',
 'gate.py': '7968debb3af38fdc0a102822d6beb845044a4836',
 'replay_predecessor.py': '581cca0e12e89ddd5825978b052fc42eb802bdd4',
 'semantic-controls.json': 'ee72a522adda9ee7a1d7f87aa0b47bc57b3586c1'}
WORKFLOW_BLOB = 'dc9cfd58544455caaed65c40f415b7ffe1c2568e'
ROOT = 'research/related-work-novelty-boundary-2025-2026/v0.18'
WORKFLOW = '.github/workflows/statebench-bound-scoring-v0.18.yml'


def require(ok, reason):
    if not ok: raise ValueError(reason)


def sha(data): return hashlib.sha256(data).hexdigest()

def blob(data): return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def bound(path, digest):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_EVIDENCE_REQUIRED')
    data = path.read_bytes()
    require(sha(data) == digest, 'FROZEN_OR_FRESH_DIGEST_MISMATCH:' + path.name)
    return data


def exact(a, b):
    require(a == b, 'FRESH_EVIDENCE_DIFFERS')


def inventory(root):
    files = {}
    for p in sorted(root.rglob('*')):
        require(not p.is_symlink(), 'EVIDENCE_SYMLINK_FORBIDDEN')
        if p.is_file():
            d = p.read_bytes(); files[p.relative_to(root).as_posix()] = {'bytes': len(d), 'sha256': sha(d)}
    return files


def validate(repo, evidence):
    root = repo / ROOT
    require(evidence.resolve() != root.resolve(), 'SEPARATE_FRESH_EVIDENCE_REQUIRED')
    for name, digest in SOURCE_BLOBS.items():
        require(blob((root/name).read_bytes()) == digest, 'FIRST_EXECUTED_SOURCE_CHANGED:' + name)
    sp = importlib.util.spec_from_file_location('frozen018gate', root/'gate.py')
    require(sp is not None and sp.loader is not None, 'GATE_MODULE_REQUIRED')
    gate = importlib.util.module_from_spec(sp); sp.loader.exec_module(gate)
    gate.boundary(repo)
    gate.git(repo, 'merge-base', '--is-ancestor', FIRST, 'HEAD')
    for name,digest in SOURCE_BLOBS.items():
        require(gate.git(repo, 'rev-parse', FIRST+':'+ROOT+'/'+name) == digest, 'HISTORICAL_SOURCE_MISMATCH')
    require(gate.git(repo, 'rev-parse', FIRST+':'+WORKFLOW) == WORKFLOW_BLOB, 'HISTORICAL_WORKFLOW_MISMATCH')
    data = {n:bound(root/n,h) for n,h in FROZEN_HASHES.items()}
    result=json.loads(data['results.json']); receipt=json.loads(data['qualification-receipt.json'])
    manifest=json.loads(data['evidence-members.json'])
    require(receipt['first_head']==FIRST and receipt['first_workflow_blob']==WORKFLOW_BLOB,'FIRST_RECEIPT_BINDING_MISMATCH')
    jobs=receipt['first_jobs']
    require(set(jobs)=={'A','B'} and all(j['conclusion']=='success' for j in jobs.values()), 'FIRST_PAIR_INCOMPLETE')
    require(jobs['A']['job_id']!=jobs['B']['job_id'] and jobs['A']['runner_id']!=jobs['B']['runner_id'], 'DISTINCT_FIRST_JOBS_REQUIRED')
    require(receipt['first_members_identical'] is True, 'FIRST_PAIR_NOT_IDENTICAL')
    require(receipt['result_sha256']==FROZEN_HASHES['results.json'] and receipt['manifest_sha256']==FROZEN_HASHES['evidence-members.json'], 'RECEIPT_DIGEST_BINDING_MISMATCH')
    exact(inventory(evidence),manifest)
    exact(bound(evidence/'results.json',FROZEN_HASHES['results.json']),data['results.json'])
    gate.no_promotion(result)
    require(result['status']=='BOUND_SYNTHETIC_SCORING_ADAPTER_EXECUTED_PASS','ADAPTER_NOT_PASS')
    require(result['original_task_compatibility']=='NONPASS' and result['invalid_input_native_calls']==0,'BOUNDARY_PROMOTION')
    b=json.loads((evidence/'batch.json').read_bytes())
    require(b['aggregate_computed'] is False and len(b['records'])==251,'BATCH_OR_AGGREGATION_MISMATCH')
    require(b['response_origin']==gate.CONTRACT['response_origin'],'RESPONSE_ORIGIN_PROMOTION')
    controls=json.loads((evidence/'semantic-trace.json').read_bytes())
    require(len(controls)==16 and all(c['projection_matches'] is True for c in controls),'SEMANTIC_CONTROLS_NOT_PASS')
    for c in controls:
        gate.equal({k:c['native_result'][k] for k in c['input']['expected_projection']},c['input']['expected_projection'])
    denied=json.loads((evidence/'rejections.json').read_bytes())
    require(len(denied)==46 and all(c['native_judge_calls']==0 for c in denied),'ADMISSION_BOUNDARY_FAILED')
    old=json.loads(bound(evidence/'predecessor/results.json',gate.PRIOR_RESULT))
    require(old['scoring_compatibility']=='NONPASS','HISTORICAL_NONPASS_ERASED')
    exact((evidence/'namespace-after-bound-scoring.json').read_bytes(),(evidence/'predecessor/namespace-after-scoring.json').read_bytes())
    exact((evidence/'imports-after-bound-scoring.json').read_bytes(),(evidence/'predecessor/imports-after-scoring.json').read_bytes())
    print('STATEBENCH_BOUND_SYNTHETIC_SCORING_V0.18_QUALIFIED_BOUNDED_SCOPE')
    print('ORIGINAL_SCORING=NONPASS; AGGREGATE_BENCHMARK=false; MERGE_AUTHORIZED=false')
    print('RESULT_SHA256='+FROZEN_HASHES['results.json'])


class Tests(unittest.TestCase):
    def test_same_bytes(self): exact(b'abc',b'abc')
    def test_changed_bytes(self):
        with self.assertRaises(ValueError): exact(b'abc',b'abd')
    def test_missing_member(self):
        with self.assertRaises(ValueError): exact({'a':1},{'a':1,'b':2})
    def test_extra_member(self):
        with self.assertRaises(ValueError): exact({'a':1,'b':2},{'a':1})
    def test_status_promotion(self):
        with self.assertRaises(ValueError): exact(b'NONPASS',b'PASS')
    def test_frozen_bindings(self):
        root=Path(__file__).resolve().parent
        for n,h in FROZEN_HASHES.items(): bound(root/n,h)
        for n,h in SOURCE_BLOBS.items(): require(blob((root/n).read_bytes())==h,'SOURCE_CHANGED')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,default=Path.cwd())
    p.add_argument('--evidence',type=Path)
    p.add_argument('--self-test',action='store_true')
    a=p.parse_args()
    if a.self_test:
        r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
        raise SystemExit(0 if r.wasSuccessful() else 1)
    require(a.evidence is not None,'FRESH_EVIDENCE_REQUIRED_NO_FALLBACK')
    validate(a.repo.resolve(),a.evidence.resolve())


if __name__=='__main__': main()
