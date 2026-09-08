"""Bind two first clean runs and require fresh evidence, never synthesize observations."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

FIRST = 'a6abd8ba9f382be48774a609496cebf09d9ceeaf'
GATE = '8390dc543e838d1aaea7a3835de3f36a6a8f3650'
WF_BLOB = '320c86d553bf3eabb1c46b3e87419caae667b4d7'
RESULT = '7c341beee6680a2d743d723e622f1baa6debdd65b946504144adfbcb40f8e3ff'
RECEIPT = '97919864a5cea3494fc0a200c1b208cff7b0c3de7e47e294981b2e0598be6cf6'
MANIFEST = '580227182b0f41a751baabbf0aa33a5709b8f17fd0d970d0c1151f24fec6f33b'
ROOT = 'research/related-work-novelty-boundary-2025-2026/v0.14'
WF = '.github/workflows/statebench-namespace-safe-env-v0.14.yml'


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def read_bound(path, expected):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_FILE_REQUIRED:' + path.name)
    data = path.read_bytes()
    require(sha(data) == expected, 'FROZEN_OR_OBSERVED_HASH_MISMATCH:' + path.name)
    return data


def members(root):
    files = {}
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(), 'EVIDENCE_SYMLINK')
        if path.is_file():
            data = path.read_bytes()
            files[path.relative_to(root).as_posix()] = {'bytes': len(data), 'sha256': sha(data)}
    return files


def exact(a, b):
    require(a == b, 'FRESH_EVIDENCE_NOT_IDENTICAL')


def validate(repo, evidence):
    root = repo / ROOT
    require(evidence.resolve() != root.resolve(), 'FRESH_EVIDENCE_DIRECTORY_REQUIRED')
    require(blob((root / 'gate.py').read_bytes()) == GATE, 'FIRST_PROBE_CODE_CHANGED')
    spec = importlib.util.spec_from_file_location('gate014_frozen', root / 'gate.py')
    require(spec and spec.loader, 'GATE_MODULE_MISSING')
    gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
    gate.boundary(repo)
    require(gate.git(repo, 'rev-parse', FIRST + ':' + ROOT + '/gate.py') == GATE, 'HISTORICAL_GATE_MISMATCH')
    require(gate.git(repo, 'rev-parse', FIRST + ':' + WF) == WF_BLOB, 'HISTORICAL_WORKFLOW_MISMATCH')
    gate.git(repo, 'merge-base', '--is-ancestor', FIRST, 'HEAD')
    frozen = read_bound(root / 'results.json', RESULT)
    manifest = json.loads(read_bound(root / 'evidence-members.json', MANIFEST))
    receipt = json.loads(read_bound(root / 'qualification-receipt.json', RECEIPT))
    require(receipt['first_head'] == FIRST and receipt['probe_blob'] == GATE and receipt['workflow_blob'] == WF_BLOB, 'FIRST_RUN_BINDING_CHANGED')
    require(receipt['result_sha256'] == RESULT and receipt['members_sha256'] == MANIFEST, 'RESULT_OR_MANIFEST_BINDING_CHANGED')
    lanes = receipt['first_jobs']
    require(set(lanes) == {'A', 'B'} and lanes['A']['job_id'] != lanes['B']['job_id'], 'TWO_DISTINCT_FIRST_JOBS_REQUIRED')
    require(all(item['conclusion'] == 'success' for item in lanes.values()), 'FIRST_JOB_NOT_SUCCESS')
    require(lanes['A']['runner_id'] != lanes['B']['runner_id'], 'DISTINCT_FIRST_RUNNERS_REQUIRED')
    require(receipt['both_first_artifacts_members_equal'] is True, 'CROSS_JOB_COMPARISON_MISSING')
    require(receipt['non_effects'] == gate.NON_EFFECTS, 'RECEIPT_AUTHORITY_PROMOTION')
    exact(members(evidence), manifest)
    exact(read_bound(evidence / 'results.json', RESULT), frozen)
    result = json.loads(frozen)
    require(result['status'] == 'NAMESPACE_SAFE_SELECTED_ENVIRONMENT_EXECUTED_PASS', 'ENVIRONMENT_NOT_PASS')
    require(result['task_compatibility'] == 'NONPASS' and result['historical_v013_remains_blocked'] is True, 'HISTORY_OR_TASK_PROMOTION')
    require(result['non_effects'] == gate.NON_EFFECTS, 'RESULT_AUTHORITY_PROMOTION')
    require(result['installed_distribution_count'] == 129, 'MEMBERSHIP_CHANGED')
    census = json.loads(read_bound(evidence / 'namespace-before.json', result['namespace_census_sha256']))
    require(census['namespace_owner'] == 'lm-eval' and census['conflicting_or_unowned_files'] == [], 'OWNERSHIP_NOT_SAFE')
    require(census['namespace_file_count'] == result['namespace_file_count'], 'NAMESPACE_COUNT_CHANGED')
    require(census['installed_distributions'] == json.loads(read_bound(root / 'selected-distributions.json', receipt['selected_distributions_sha256'])), 'SELECTED_DISTRIBUTIONS_CHANGED')
    require(census['excluded_distribution_present'] is False, 'EXCLUDED_DISTRIBUTION_PRESENT')
    exact((evidence / 'namespace-before.json').read_bytes(), (evidence / 'namespace-after.json').read_bytes())
    exact((evidence / 'imports-before.json').read_bytes(), (evidence / 'imports-after.json').read_bytes())
    for name, expected in gate.EXPECTED_REPLAY.items():
        read_bound(evidence / name, expected)
    print('STATEBENCH_NAMESPACE_SAFE_ENVIRONMENT_V0.14_QUALIFIED_ENVIRONMENT_ONLY')
    print('UPSTREAM_TASK_COMPATIBILITY=NONPASS; MERGE_AUTHORIZED=false')
    print('RESULT_SHA256=' + RESULT)


class Tests(unittest.TestCase):
    def test_same_bytes(self):
        exact(b'NONPASS\n', b'NONPASS\n')
    def test_status_promotion(self):
        with self.assertRaises(ValueError): exact(b'PASS\n', b'NONPASS\n')
    def test_member_removed(self):
        with self.assertRaises(ValueError): exact({'a': 1}, {'a': 1, 'b': 2})
    def test_member_changed(self):
        with self.assertRaises(ValueError): exact({'a': 1}, {'a': 2})
    def test_no_fallback(self):
        with self.assertRaises(ValueError): exact({}, {'required': 1})
    def test_frozen_binding(self):
        root = Path(__file__).resolve().parent
        read_bound(root / 'results.json', RESULT)
        read_bound(root / 'qualification-receipt.json', RECEIPT)
        read_bound(root / 'evidence-members.json', MANIFEST)
        require(blob((root / 'gate.py').read_bytes()) == GATE, 'GATE_CHANGED')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo', type=Path, default=Path.cwd())
    p.add_argument('--evidence', type=Path)
    p.add_argument('--self-test', action='store_true')
    a = p.parse_args()
    if a.self_test:
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
        raise SystemExit(0 if result.wasSuccessful() else 1)
    require(a.evidence is not None, 'FRESH_EVIDENCE_REQUIRED_NO_FALLBACK')
    validate(a.repo.resolve(), a.evidence.resolve())


if __name__ == '__main__':
    main()
