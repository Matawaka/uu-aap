"""Freeze a negative observation, not benchmark quality or scoring compatibility."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

FIRST = 'b878e1caedd739380e17e3f276a90161a2383f60'
GATE = '414adb20e87543a35939e40af1eca8dbfe58b916'
REPLAY = 'a6e6a42fca309bf8695374802577376e3c97cf23'
WORKFLOW = '3f1a8ab3fa51a325f73e679a119f03a6c41a64a9'
RESULT = 'ed7b625a4fed8699d7e94de294037bbb1502146c1306ea8bb457d167efac1631'
RECEIPT = 'e3788b5121a113c4aecfe4c99ee3edcf7c0280a9bd96ee7f7a6fba64201698cd'
MANIFEST = '32210da203e3138b92ff616bbcab24345093ba0f584106ee22245a87f26dd5bf'
ROOT = 'research/related-work-novelty-boundary-2025-2026/v0.17'
WF = '.github/workflows/statebench-scoring-contract-v0.17.yml'


def require(ok, why):
    if not ok:
        raise ValueError(why)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def bound(path, digest):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_EVIDENCE_REQUIRED')
    data=path.read_bytes()
    require(sha(data)==digest, 'FROZEN_OR_OBSERVED_DIGEST_MISMATCH:' + path.name)
    return data


def equal(a,b):
    require(a==b,'EXACT_EVIDENCE_MISMATCH')


def members(root):
    result={}
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(),'EVIDENCE_SYMLINK')
        if path.is_file():
            data=path.read_bytes()
            result[path.relative_to(root).as_posix()]={'bytes':len(data),'sha256':sha(data)}
    return result


def validate(repo,evidence):
    root=repo/ROOT
    require(root.resolve()!=evidence.resolve(),'FRESH_OBSERVATION_DIRECTORY_REQUIRED')
    require(blob((root/'gate.py').read_bytes())==GATE,'FIRST_GATE_CHANGED')
    require(blob((root/'replay_predecessor.py').read_bytes())==REPLAY,'FIRST_REPLAY_CHANGED')
    spec=importlib.util.spec_from_file_location('frozen_v017_gate',root/'gate.py')
    require(spec and spec.loader,'GATE_IMPORT_REQUIRED')
    gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
    gate.boundary(repo)
    require(gate.git(repo,'rev-parse',FIRST+':'+ROOT+'/gate.py')==GATE,'HISTORICAL_GATE_BINDING')
    require(gate.git(repo,'rev-parse',FIRST+':'+WF)==WORKFLOW,'HISTORICAL_WORKFLOW_BINDING')
    gate.git(repo,'merge-base','--is-ancestor',FIRST,'HEAD')
    frozen=bound(root/'results.json',RESULT)
    receipt=json.loads(bound(root/'qualification-receipt.json',RECEIPT))
    manifest=json.loads(bound(root/'evidence-members.json',MANIFEST))
    equal(members(evidence),manifest)
    equal(bound(evidence/'results.json',RESULT),frozen)
    require(receipt['first_head']==FIRST and receipt['gate_blob']==GATE,'FIRST_RECEIPT_BINDING')
    require(receipt['workflow_blob']==WORKFLOW and receipt['result_sha256']==RESULT,'FIRST_RESULT_WORKFLOW_BINDING')
    require(receipt['manifest_sha256']==MANIFEST,'MANIFEST_BINDING')
    jobs=receipt['first_jobs']
    require(set(jobs)=={'A','B'},'BOTH_FIRST_JOBS_REQUIRED')
    require(all(j['conclusion']=='success' for j in jobs.values()),'FIRST_JOB_NOT_COMPLETE')
    require(jobs['A']['job_id']!=jobs['B']['job_id'] and jobs['A']['runner_id']!=jobs['B']['runner_id'],'DISTINCT_JOBS_RUNNERS_REQUIRED')
    require(receipt['members_identical_across_first_pair'] is True,'FIRST_PAIR_COMPARISON_REQUIRED')
    result=json.loads(frozen)
    gate.no_promotion(result)
    require(result['audit_execution']=='COMPLETED' and result['status']=='SYNTHETIC_SCORING_CONTRACT_AUDIT_EXECUTED_NONPASS','AUDIT_NOT_COMPLETED_NONPASS')
    trace=json.loads(bound(evidence/'scoring-trace.json',result['scoring_trace_sha256']))
    docs=json.loads(bound(evidence/'predecessor/predecessor/documents.json',gate.DOCS))
    require(len(trace['documents'])==len(docs)==251,'EXACT_ALL_DOCUMENTS_REQUIRED')
    for i,(entry,doc) in enumerate(zip(trace['documents'],docs)):
        require(entry['document_id']==i and entry['timeline_id']==doc['timeline_id'] and entry['query_idx']==doc['query_idx'],'ORDER_OR_BINDING_CHANGED')
        require(entry['document_sha256']==sha(gate.encode(doc)),'DOCUMENT_BYTES_CHANGED')
        equal(entry['disabled_result'],{})
        equal(entry['task_metric_inputs'],[{'predictions':[gate.MARKER],'reference_types':['str'],'string_references':[doc['expected_decision']]}])
        chain=entry['task_metric_error']['chain']
        require(chain[0]['type']=='TypeError' and 'references' in chain[0]['message'],'FALLBACK_EXCEPTION_CHANGED')
        require(any(e['type']=='TypeError' and 'string indices' in e['message'] for e in chain[1:]),'ORIGINAL_EXCEPTION_LOST')
        direct=entry['document_reference_metric_error']['chain'][0]
        require(direct['type']=='AttributeError' and 'extract_decision' in direct['message'],'MISSING_METHOD_FINDING_CHANGED')
    controls=trace['native_controls']
    equal([e['case'] for e in controls],gate.CASES)
    equal([e['result']['decision_correct'] for e in controls],[True,False,True,False])
    require(all(e['origin']=='FULLY_SYNTHETIC_CONTROL' for e in controls),'SYNTHETIC_ORIGIN_LOST')
    equal((evidence/'namespace-after-scoring.json').read_bytes(),(evidence/'predecessor/namespace-after-requests.json').read_bytes())
    equal((evidence/'imports-after-scoring.json').read_bytes(),(evidence/'predecessor/imports-after-requests.json').read_bytes())
    print('STATEBENCH_SCORING_CONTRACT_V0.17_QUALIFIED_NEGATIVE_OBSERVATION')
    print('SCORING_COMPATIBILITY=NONPASS; MODEL_EXECUTED=false; MERGE_AUTHORIZED=false')
    print('RESULT_SHA256='+RESULT)


class Tests(unittest.TestCase):
    def test_equal(self): equal(b'NONPASS',b'NONPASS')
    def test_promotion(self):
        with self.assertRaises(ValueError): equal(b'PASS',b'NONPASS')
    def test_missing_member(self):
        with self.assertRaises(ValueError): equal({}, {'required':1})
    def test_content_changed(self):
        with self.assertRaises(ValueError): equal({'a':'1'},{'a':'2'})
    def test_no_fallback(self):
        with self.assertRaises(ValueError): bound(Path('/nonexistent-v017-evidence'),RESULT)
    def test_frozen(self):
        root=Path(__file__).resolve().parent
        bound(root/'results.json',RESULT)
        bound(root/'qualification-receipt.json',RECEIPT)
        bound(root/'evidence-members.json',MANIFEST)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',type=Path,default=Path.cwd())
    p.add_argument('--evidence',type=Path)
    p.add_argument('--self-test',action='store_true')
    args=p.parse_args()
    if args.self_test:
        r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
        raise SystemExit(0 if r.wasSuccessful() else 1)
    require(args.evidence is not None,'FRESH_EVIDENCE_REQUIRED_NO_FALLBACK')
    validate(args.repo.resolve(),args.evidence.resolve())


if __name__=='__main__': main()
