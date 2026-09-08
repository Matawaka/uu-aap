"""Freeze an observed negative result; never replace a fresh run with stored evidence."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

FIRST = "0f2f1023f8fe1e73e566b4bc00a0ffeba3c4041b"
GATE = "713082bcc9c0aae15f6ec8d6106f3cc819beac89"
WORKFLOW = "94a5a207393e580778bfb8958200033d04a82963"
RESULT = "2528206426613f1efce19ff3f4dab17a1daac34f828af37df021c054e78c16d8"
RECEIPT = "d6c5a4062b68b60335225f002ef3d9c55ee3e930f456c8090c07f346bfe69bc9"
TRACE = "3685c45f32574313d11bfdaf8d70ced7843ecd236af4de0e6690a14f176806f3"
ROOT = "research/related-work-novelty-boundary-2025-2026/v0.13"
WF = ".github/workflows/statebench-task-compatibility-v0.13.yml"


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_bound(path, expected):
    require(path.is_file() and not path.is_symlink(), "REGULAR_FILE_REQUIRED")
    data = path.read_bytes()
    require(sha(data) == expected, "OBSERVED_OR_FROZEN_DIGEST_MISMATCH:" + path.name)
    return data


def exact(observed, frozen):
    require(observed == frozen, "OBSERVED_BYTES_DIFFER_FROM_FIRST_NEGATIVE_RESULT")


def validate(repo, observed):
    root = repo / ROOT
    require(observed.resolve() != root.resolve(), "SEPARATE_RUNTIME_OUTPUT_REQUIRED")
    gate_bytes = (root / "gate.py").read_bytes()
    require(hashlib.sha1(b"blob " + str(len(gate_bytes)).encode() + b"\0" + gate_bytes).hexdigest() == GATE, "EXPERIMENT_CODE_CHANGED")
    spec = importlib.util.spec_from_file_location("frozen_v013", root / "gate.py")
    require(spec is not None and spec.loader is not None, "FROZEN_GATE_IMPORT_REQUIRED")
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)
    initial = json.loads(read_bound(root / "history/initial-inconclusive-results.json", "43cdf77ede5a1dc8847568ed7c570dd0ace9d34556481c6b671677d3e8f87699"))
    require(initial["audit_execution"] == "INCONCLUSIVE" and initial["compatibility"] == "NOT_ESTABLISHED", "INITIAL_RUN_RETROSPECTIVELY_PROMOTED")
    require(gate.git(repo, "rev-parse", "ed795acdc0dfdb0faa46547fef9094d89f096729:" + ROOT + "/gate.py") == "d9664ada03728fc89aa233dc0651df40732a2462", "ORIGINAL_OBSERVER_HISTORY_CHANGED")
    second = json.loads(read_bound(root / "history/second-inconclusive-results.json", "f8f2e8a17652e7bf6c6ff910722a1059fb8949aa360279d049ade148b57ba508"))
    require(second["audit_execution"] == "INCONCLUSIVE" and second["compatibility"] == "NOT_ESTABLISHED", "SECOND_RUN_RETROSPECTIVELY_PROMOTED")
    require(gate.git(repo, "rev-parse", "14370037dee6eccc26e2b7d4502046653880b043:" + ROOT + "/gate.py") == "38df40a9801f94d265cf7940f134d8c955e27ba9", "SECOND_OBSERVER_HISTORY_CHANGED")
    frozen = read_bound(root / "results.json", RESULT)
    receipt = json.loads(read_bound(root / "qualification-receipt.json", RECEIPT))
    require(receipt["first_observation_head"] == FIRST and receipt["compatibility"] == "NONPASS", "HISTORICAL_OBSERVATION_CHANGED")
    require(receipt["result_sha256"] == RESULT and receipt["format_trace_sha256"] == TRACE, "RECEIPT_RESULT_BINDING_FAILED")
    require(receipt["workflow_run"] == 34216120618 and receipt["workflow_job"] == 102028146188, "FIRST_RUN_ID_CHANGED")
    require(receipt["experiment_code_blob"] == GATE and receipt["first_workflow_blob"] == WORKFLOW, "RECEIPT_CODE_BINDING_CHANGED")
    require(receipt["non_effects"] == gate.NON_EFFECTS, "RECEIPT_AUTHORITY_PROMOTION")
    require(gate.git(repo, "rev-parse", FIRST + ":" + ROOT + "/gate.py") == GATE, "HISTORICAL_CODE_BINDING_FAILED")
    require(gate.git(repo, "rev-parse", FIRST + ":" + WF) == WORKFLOW, "HISTORICAL_WORKFLOW_BINDING_FAILED")
    gate.git(repo, "merge-base", "--is-ancestor", FIRST, "HEAD")
    gate.boundary(repo)
    exact(read_bound(observed / "results.json", RESULT), frozen)
    expected_digest = (RESULT + "  results.json\n").encode()
    exact((root / "results.sha256").read_bytes(), expected_digest)
    exact((observed / "results.sha256").read_bytes(), expected_digest)
    result = json.loads(frozen)
    gate.qualified_observation(result)
    trace = json.loads(read_bound(observed / "format-trace.json", TRACE))
    require(len(trace) == 251 and [r["index"] for r in trace] == list(range(251)), "FORMAT_TRACE_COUNT_OR_ORDER_CHANGED")
    require(len({(r["timeline_id"], r["query_idx"]) for r in trace}) == 251, "FORMAT_TRACE_DUPLICATES")
    print("STATEBENCH_TASK_COMPATIBILITY_V0.13_QUALIFIED_NONPASS")
    print("AUDIT_EXECUTION=COMPLETED; UPSTREAM_COMPATIBILITY=NONPASS")
    print("RESULT_SHA256=" + RESULT)
    print("FORMAT_TRACE_SHA256=" + TRACE)


class FrozenEvidenceTests(unittest.TestCase):
    def test_exact_bytes(self):
        exact(b"NONPASS\n", b"NONPASS\n")
    def test_status_promotion(self):
        with self.assertRaises(ValueError): exact(b"PASS\n", b"NONPASS\n")
    def test_semantic_not_byte_equal(self):
        with self.assertRaises(ValueError): exact(b'{"a":1}', b'{"a": 1}')
    def test_missing_observation(self):
        with self.assertRaises(ValueError): exact(b"", b"NONPASS\n")
    def test_frozen_files(self):
        root = Path(__file__).resolve().parent
        read_bound(root / "results.json", RESULT)
        read_bound(root / "qualification-receipt.json", RECEIPT)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--observed", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        tests = unittest.defaultTestLoader.loadTestsFromTestCase(FrozenEvidenceTests)
        raise SystemExit(0 if unittest.TextTestRunner(verbosity=2).run(tests).wasSuccessful() else 1)
    require(args.observed is not None, "FRESH_OBSERVATION_REQUIRED_NO_FALLBACK")
    validate(args.repo.resolve(), args.observed.resolve())


if __name__ == "__main__":
    main()
