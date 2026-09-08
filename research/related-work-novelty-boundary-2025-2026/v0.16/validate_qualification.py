"""Require a fresh complete request run matching the frozen first A/B observation."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

FIRST = '3918bd05054e722d7110b5084e610bfa7ea7991d'
GATE = 'f63454b95b3ae6f748447eba0150bb58375723a6'
REPLAY = 'a060a88fcaf35930433f4b92667fc1d899465b08'
FIRST_WORKFLOW = '47d374947e9d47b174503195ca150af87c74bd57'
CONTRACT = 'f1fda311f73a6c3efd57acde3b923d1374f957b50d306c88eb62c9bd2c5abf87'
RESULT = 'fbee1820bd69778462ca8ea74d91f9ea28a0d547a4e7921af05c881538186d5b'
MANIFEST = 'faabdde9b2364589efb872813c284ef00486aa82082abba15b68feacce4c815e'
RECEIPT = '227b4a6c62d3d3923bad5948830d5b9c4009271cd88f55d3849a351488cfb5b4'
ROOT = 'research/related-work-novelty-boundary-2025-2026/v0.16'
WF = '.github/workflows/statebench-request-construction-v0.16.yml'


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def bound(path, expected):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_EVIDENCE_REQUIRED')
    data = path.read_bytes()
    require(sha(data) == expected, 'EVIDENCE_HASH_MISMATCH:' + path.name)
    return data


def members(root):
    out = {}
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(), 'EVIDENCE_SYMLINK')
        if path.is_file():
            data = path.read_bytes()
            out[path.relative_to(root).as_posix()] = {'bytes': len(data), 'sha256': sha(data)}
    return out


def exact(a, b):
    require(a == b, 'FRESH_EVIDENCE_NOT_IDENTICAL')


def validate(repo, evidence):
    root = repo / ROOT
    require(evidence.resolve() != root.resolve(), 'FRESH_OBSERVATION_REQUIRED')
    require(blob((root / 'gate.py').read_bytes()) == GATE, 'FIRST_GATE_CHANGED')
    require(blob((root / 'replay_predecessor.py').read_bytes()) == REPLAY, 'REPLAY_CHANGED')
    spec = importlib.util.spec_from_file_location('frozen_v016_qualification', root / 'gate.py')
    require(spec and spec.loader, 'GATE_IMPORT_REQUIRED')
    gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
    gate.boundary(repo)
    gate.git(repo, 'merge-base', '--is-ancestor', FIRST, 'HEAD')
    require(gate.git(repo, 'rev-parse', FIRST + ':' + ROOT + '/gate.py') == GATE, 'HISTORICAL_GATE_BINDING')
    require(gate.git(repo, 'rev-parse', FIRST + ':' + WF) == FIRST_WORKFLOW, 'HISTORICAL_WORKFLOW_BINDING')
    contract = json.loads(bound(root / 'request-contract.json', CONTRACT))
    bound(root / 'history/initial-observer-serialization-nonpass.json', '33288cbb687252adb20b1e0a8df4a3716f645dc9a045b04410e79e32685dcad9')
    require(gate.git(repo, 'rev-parse', '175e6672f141dfddcd5239b2248ce7a6b68874ad:' + ROOT + '/gate.py') == 'b456a0930d6a21bb84fc45ffb19e34efbb3044b5', 'INITIAL_OBSERVER_HISTORY_CHANGED')
    frozen = bound(root / 'results.json', RESULT)
    receipt = json.loads(bound(root / 'qualification-receipt.json', RECEIPT))
    manifest = json.loads(bound(root / 'evidence-members.json', MANIFEST))
    require(receipt['first_head'] == FIRST and receipt['first_gate_blob'] == GATE, 'FIRST_RECEIPT_BINDING')
    lanes = receipt['first_jobs']
    require(set(lanes) == {'A','B'} and all(j['conclusion'] == 'success' for j in lanes.values()), 'TWO_FIRST_GREEN_JOBS_REQUIRED')
    require(lanes['A']['job_id'] != lanes['B']['job_id'] and lanes['A']['runner_id'] != lanes['B']['runner_id'], 'DISTINCT_FIRST_RUNNERS_REQUIRED')
    require(receipt['member_identity_verified'] is True, 'FIRST_MEMBER_COMPARISON_MISSING')
    require(receipt['non_effects'] == gate.NON_EFFECTS, 'RECEIPT_AUTHORITY_PROMOTION')
    exact(members(evidence), manifest)
    exact(bound(evidence / 'results.json', RESULT), frozen)
    result = json.loads(frozen)
    gate.no_promotion(result)
    require(result['status'] == 'MODEL_FREE_PLAIN_REQUEST_CONSTRUCTION_EXECUTED_PASS', 'REQUEST_GATE_NOT_PASS')
    require(result['requests'] == 251 and result['builds'] == 3, 'COUNT_CHANGED')
    require(result['actual_calls'] == contract['expected_call_counts'], 'REAL_CALL_COUNTS_CHANGED')
    docs = json.loads(bound(evidence / 'predecessor/documents.json', gate.DOCS))
    requests = json.loads(bound(evidence / 'requests.json', contract['expected_requests_sha256']))
    gate.validate_trace(requests, gate.reference_requests(docs))
    require(result['request_contract_sha256'] == CONTRACT, 'CONTRACT_RESULT_BINDING')
    require(result['forbidden_effect_attempts'] == [], 'FORBIDDEN_EFFECT_ATTEMPT')
    exact((evidence / 'namespace-after-requests.json').read_bytes(), (evidence / 'predecessor/namespace-after-adapter.json').read_bytes())
    exact((evidence / 'imports-after-requests.json').read_bytes(), (evidence / 'predecessor/imports-after-adapter.json').read_bytes())
    print('STATEBENCH_PLAIN_REQUEST_CONSTRUCTION_V0.16_QUALIFIED_BOUNDED_SCOPE')
    print('RESULT_SHA256=' + RESULT)
    print('REQUESTS_SHA256=' + contract['expected_requests_sha256'])
    print('ORIGINAL_TASK=NONPASS; DISPATCH_AUTHORIZED=false; MERGE_AUTHORIZED=false')


class Tests(unittest.TestCase):
    def test_identical_bytes(self):
        exact(b'plain\n', b'plain\n')
    def test_format_is_bytes(self):
        with self.assertRaises(ValueError): exact(b'{"a":1}', b'{"a": 1}')
    def test_missing_member(self):
        with self.assertRaises(ValueError): exact({}, {'requests': 1})
    def test_changed_member(self):
        with self.assertRaises(ValueError): exact({'a': 1}, {'a': 2})
    def test_no_authority_promotion(self):
        with self.assertRaises(ValueError): exact({'dispatch': True}, {'dispatch': False})
    def test_frozen_files(self):
        root = Path(__file__).resolve().parent
        bound(root / 'results.json', RESULT)
        bound(root / 'qualification-receipt.json', RECEIPT)
        bound(root / 'evidence-members.json', MANIFEST)
        bound(root / 'request-contract.json', CONTRACT)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo', type=Path, default=Path.cwd())
    p.add_argument('--evidence', type=Path)
    p.add_argument('--self-test', action='store_true')
    a = p.parse_args()
    if a.self_test:
        r = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
        raise SystemExit(0 if r.wasSuccessful() else 1)
    require(a.evidence is not None, 'FRESH_EVIDENCE_REQUIRED_NO_FALLBACK')
    validate(a.repo.resolve(), a.evidence.resolve())


if __name__ == '__main__':
    main()
