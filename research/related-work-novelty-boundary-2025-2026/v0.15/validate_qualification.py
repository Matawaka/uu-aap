"""Require fresh v0.15 evidence identical to the first observed A/B pair."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

FIRST = '71aeeade1450e11aaeb8b0b1d90c372f23733e1c'
ROOT = 'research/related-work-novelty-boundary-2025-2026/v0.15'
WORKFLOW = '.github/workflows/statebench-model-free-adapter-v0.15.yml'
FIRST_WORKFLOW = '2418ee3625163d6343ddf7cad1d744ab104602a5'
CODE = {
    'adapter.py': '2bbcc1d996b5b0586371894027153b3765e98c7c',
    'gate.py': '74dc9af16ae0aee11afde8ffb97a5c194d54aa28',
    'replay_environment.py': '8cd1854cb2d4d018c2f5a05eb48e0e6cc02d54eb',
}
FROZEN = {'config-delta.json': 'ccd3dd8d9b1909a59518ebd979d43e8ff86f3645813485e39032879df6bd5485',
 'evidence-members.json': 'e9e68fb413e84d862bad51f9ce00847dfbb491498775f57ba2575a96df0036b9',
 'history/initial-adapter-group-nonpass.json': 'e81c1766087db8e51cd457f997a543b48066dbb3385dfcd0f69e93114e69e882',
 'qualification-receipt.json': '5ccfce6ed29ef05b6e1ac3a940347b31e0c2726b811c1664ec3f6f7fcf68ad64',
 'results.json': 'f83a8be7bb64ed2b8950641c44c7944cbc317f776c1683a043b739168f1605f6'}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def bound(path, digest):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_EVIDENCE_REQUIRED')
    data = path.read_bytes()
    require(sha(data) == digest, 'FROZEN_OR_FRESH_HASH_MISMATCH:' + path.name)
    return data


def members(directory):
    require(directory.is_dir() and not directory.is_symlink(), 'EVIDENCE_DIRECTORY_REQUIRED')
    result = {}
    for path in sorted(directory.rglob('*')):
        require(not path.is_symlink(), 'EVIDENCE_SYMLINK')
        if path.is_file():
            data = path.read_bytes()
            result[path.relative_to(directory).as_posix()] = {'bytes': len(data), 'sha256': sha(data)}
    return result


def exact(observed, frozen):
    require(observed == frozen, 'FRESH_EVIDENCE_DIFFERS')


def validate(repo, evidence):
    root = repo / ROOT
    require(evidence.resolve() != root.resolve(), 'SEPARATE_FRESH_EVIDENCE_REQUIRED')
    for name, digest in CODE.items():
        require(blob((root / name).read_bytes()) == digest, 'FIRST_RUNTIME_CODE_CHANGED:' + name)
    spec = importlib.util.spec_from_file_location('v015_frozen_gate', root / 'gate.py')
    require(spec and spec.loader, 'GATE_IMPORT_REQUIRED')
    gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
    gate.boundary(repo)
    gate.git(repo, 'merge-base', '--is-ancestor', FIRST, 'HEAD')
    require(gate.git(repo, 'rev-parse', FIRST + ':' + WORKFLOW) == FIRST_WORKFLOW, 'FIRST_WORKFLOW_CHANGED')
    for name, digest in CODE.items():
        require(gate.git(repo, 'rev-parse', FIRST + ':' + ROOT + '/' + name) == digest, 'FIRST_CODE_HISTORY_CHANGED')
    frozen = {name: bound(root / name, digest) for name, digest in FROZEN.items()}
    receipt = json.loads(frozen['qualification-receipt.json'])
    require(receipt['first_head'] == FIRST and receipt['code_blobs'] == CODE, 'FIRST_RECEIPT_BINDING_CHANGED')
    lanes = receipt['first_jobs']
    require(set(lanes) == {'A', 'B'} and all(x['conclusion'] == 'success' for x in lanes.values()), 'FIRST_AB_PAIR_REQUIRED')
    require(lanes['A']['job_id'] != lanes['B']['job_id'] and lanes['A']['runner_id'] != lanes['B']['runner_id'], 'DISTINCT_FIRST_JOBS_REQUIRED')
    require(receipt['all_first_members_equal'] is True, 'CROSS_LANE_EVIDENCE_MISSING')
    manifest = json.loads(frozen['evidence-members.json'])
    exact(members(evidence), manifest)
    exact(bound(evidence / 'results.json', FROZEN['results.json']), frozen['results.json'])
    exact(bound(evidence / 'config-delta.json', FROZEN['config-delta.json']), frozen['config-delta.json'])
    result = json.loads(frozen['results.json'])
    gate.no_promotion(result)
    require(result['status'] == 'MODEL_FREE_TASK_ADAPTER_EXECUTED_PASS', 'NAMED_ADAPTER_NOT_PASS')
    require(result['actual_upstream_processing_calls'] == 4 and result['fresh_adapter_repetitions'] == 2, 'REAL_PROCESSING_COUNTS_CHANGED')
    require(result['hostile_exact_document_mutations_rejected'] == 6 and result['forbidden_effect_attempts'] == [], 'MUTATION_OR_EFFECT_GUARDS_FAILED')
    require(receipt['non_effects'] == gate.NON_EFFECTS and receipt['original_task_compatibility'] == 'NONPASS', 'RECEIPT_PROMOTION')
    exact((evidence / 'documents.json').read_bytes(), (evidence / 'predecessor/v012/documents.json').read_bytes())
    exact((evidence / 'format-trace.json').read_bytes(), (evidence / 'predecessor/v013/format-trace.json').read_bytes())
    exact((evidence / 'namespace-after-adapter.json').read_bytes(), (evidence / 'predecessor/namespace-after.json').read_bytes())
    exact((evidence / 'imports-after-adapter.json').read_bytes(), (evidence / 'predecessor/imports-after.json').read_bytes())
    require(sha((evidence / 'predecessor/results.json').read_bytes()) == gate.ENV_RESULT, 'ENVIRONMENT_REPLAY_CHANGED')
    print('STATEBENCH_MODEL_FREE_TASK_ADAPTER_V0.15_QUALIFIED_BOUNDED_SCOPE')
    print('ORIGINAL_TASK=NONPASS; SCORING=false; MODEL=false; MERGE_AUTHORIZED=false')
    print('RESULT_SHA256=' + FROZEN['results.json'])


class Tests(unittest.TestCase):
    def test_equal(self):
        exact(b'NONPASS', b'NONPASS')
    def test_status_promotion(self):
        with self.assertRaises(ValueError): exact(b'PASS', b'NONPASS')
    def test_semantic_not_byte_equal(self):
        with self.assertRaises(ValueError): exact(b'{"x":1}', b'{"x": 1}')
    def test_missing_member(self):
        with self.assertRaises(ValueError): exact({'a': 1}, {'a': 1, 'b': 2})
    def test_changed_member(self):
        with self.assertRaises(ValueError): exact({'a': 1}, {'a': 2})
    def test_frozen_files(self):
        root = Path(__file__).resolve().parent
        for name, digest in FROZEN.items(): bound(root / name, digest)
        for name, digest in CODE.items(): require(blob((root / name).read_bytes()) == digest, 'CODE_CHANGED')


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
