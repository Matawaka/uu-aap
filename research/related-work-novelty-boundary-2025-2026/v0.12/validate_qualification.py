"""Validate the frozen first observation and a separately executed successor result.

This validator does not regenerate an expected benchmark result. It compares a fresh
network-isolated run with the exact bytes emitted by the first independent GREEN.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unittest

FIRST_HEAD = "0f85ce0821eea91bb76ee0e426d58936060e9769"
GATE_BLOB = "f6ac50eec00710fe955fe5ce168e31522c30006c"
WORKFLOW_BLOB = "bb5c7cf13aa3da42429d75484c74d1ac186fd0e4"
RESULT_SHA = "677c354a5edf1052e1a616da65f84ca04d0df6e1eba60821e4080236250ceac3"
RECEIPT_SHA = "4b05ca7d9bee37d2aaf589f3e73341e4f74038c236e8d4b74b650ff3f49b0b8e"
DOCUMENTS_SHA = "30b756a7eb85db5ceeae843f178c34bff3fa1690c73635160d25ed73cabd78f0"
NORMALIZATION_SHA = "240080ccdfeca319d98da16479907b9433536715fa80c9ee8768fa29379f0602"
ROOT = "research/related-work-novelty-boundary-2025-2026/v0.12"
WORKFLOW = ".github/workflows/statebench-exact-data-processing-v0.12.yml"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def read_bound(path: Path, expected: str) -> bytes:
    require(path.is_file() and not path.is_symlink(), "REGULAR_EVIDENCE_FILE_REQUIRED:" + path.name)
    data = path.read_bytes()
    require(sha(data) == expected, "FROZEN_EVIDENCE_DIGEST_MISMATCH:" + path.name)
    return data


def assert_equal_bytes(observed: bytes, frozen: bytes) -> None:
    require(observed == frozen, "FRESH_RESULT_DIFFERS_FROM_FIRST_GREEN_BYTES")


def validate(repo: Path, observed: Path) -> None:
    root = repo / ROOT
    gate_path = root / "gate.py"
    require(git_blob(gate_path.read_bytes()) == GATE_BLOB, "FIRST_GREEN_PROCESSING_CODE_CHANGED")
    spec = importlib.util.spec_from_file_location("frozen_v012_gate", gate_path)
    require(spec is not None and spec.loader is not None, "FROZEN_GATE_IMPORT_MISSING")
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)

    frozen_data = read_bound(root / "results.json", RESULT_SHA)
    receipt_data = read_bound(root / "qualification-receipt.json", RECEIPT_SHA)
    require((root / "results.sha256").read_bytes() == (RESULT_SHA + "  results.json\n").encode(), "FROZEN_DIGEST_FILE_MISMATCH")
    frozen = json.loads(frozen_data)
    receipt = json.loads(receipt_data)
    require(frozen["status"] == "EXACT_DATA_PLUGIN_PROCESSING_EXECUTED_PASS", "FIRST_RESULT_NOT_PASS")
    require(frozen["non_effects"] == receipt["non_effects"] == gate.NON_EFFECTS, "NON_EFFECTS_CHANGED")
    require(all(v is False for v in frozen["non_effects"].values()), "NON_EFFECT_PROMOTION")
    require(frozen["roundtrip"]["timelines"] == frozen["roundtrip"]["unique_ids"] == 209, "TIMELINE_COUNT_CHANGED")
    require(frozen["processing"]["query_documents"] == 251, "QUERY_COUNT_CHANGED")
    require(frozen["roundtrip"]["normalized_roundtrip_equal"] is True, "NORMALIZED_ROUNDTRIP_FAILED")
    require(frozen["roundtrip"]["raw_json_roundtrip_equal"] is False, "RAW_FIDELITY_OVERCLAIM")
    require(frozen["roundtrip"]["raw_schema_change_counts"] == {"SCHEMA_ADDED_FIELD": 753}, "SCHEMA_CHANGE_HISTORY_CHANGED")
    require(receipt["qualified_candidate_head"] == FIRST_HEAD, "FIRST_GREEN_HEAD_CHANGED")
    require(receipt["workflow_run"] == 34212883127 and receipt["workflow_job"] == 102017759350, "FIRST_GREEN_RUN_CHANGED")
    require(receipt["result_sha256"] == RESULT_SHA, "RECEIPT_RESULT_BINDING_MISMATCH")
    require(gate.git(repo, "rev-parse", FIRST_HEAD + ":" + ROOT + "/gate.py") == GATE_BLOB, "HISTORICAL_GATE_BLOB_MISMATCH")
    require(gate.git(repo, "rev-parse", FIRST_HEAD + ":" + WORKFLOW) == WORKFLOW_BLOB, "HISTORICAL_WORKFLOW_BLOB_MISMATCH")
    gate.git(repo, "merge-base", "--is-ancestor", FIRST_HEAD, "HEAD")
    gate.boundary(repo)

    # The observed directory must be produced by the separate preceding runtime step.
    # No fallback, synthesis, missing-evidence skip or model invocation exists here.
    require(observed.resolve() != root.resolve(), "INDEPENDENT_OBSERVATION_DIRECTORY_REQUIRED")
    actual = read_bound(observed / "results.json", RESULT_SHA)
    assert_equal_bytes(actual, frozen_data)
    require((observed / "results.sha256").read_bytes() == (root / "results.sha256").read_bytes(), "OBSERVED_DIGEST_FILE_MISMATCH")
    documents = json.loads(read_bound(observed / "documents.json", DOCUMENTS_SHA))
    normalization = json.loads(read_bound(observed / "normalization.json", NORMALIZATION_SHA))
    require(type(documents) is list and len(documents) == 251, "FRESH_DOCUMENT_COUNT_MISMATCH")
    require(type(normalization) is list and len(normalization) == 753, "FRESH_NORMALIZATION_COUNT_MISMATCH")
    require(all(set(entry) == {"timeline_id", "kind", "path"} and entry["kind"] == "SCHEMA_ADDED_FIELD" for entry in normalization), "FRESH_NORMALIZATION_SCHEMA_MISMATCH")
    paths = Counter(re.sub(r"/\d+(?=/|$)", "/N", entry["path"]) for entry in normalization)
    print("SCHEMA_DEFAULT_PATH_COUNTS=" + json.dumps(dict(sorted(paths.items())), sort_keys=True))
    print("RESULT_SHA256=" + RESULT_SHA)
    print("DOCUMENTS_SHA256=" + DOCUMENTS_SHA)
    print("NORMALIZATION_SHA256=" + NORMALIZATION_SHA)
    print("STATEBENCH_EXACT_DATA_PROCESSING_V0.12_FROZEN_RESULT_AND_QUALIFICATION_VALID")


class EvidenceMutationTests(unittest.TestCase):
    def test_identical_bytes(self):
        assert_equal_bytes(b'{"n":209}\n', b'{"n":209}\n')

    def test_changed_count(self):
        with self.assertRaises(ValueError):
            assert_equal_bytes(b'{"n":208}\n', b'{"n":209}\n')

    def test_semantic_equal_not_byte_equal(self):
        with self.assertRaises(ValueError):
            assert_equal_bytes(b'{"n": 209}\n', b'{"n":209}\n')

    def test_non_effect_promotion(self):
        with self.assertRaises(ValueError):
            assert_equal_bytes(b'{"merge_authorized":true}\n', b'{"merge_authorized":false}\n')

    def test_bound_frozen_local_files(self):
        root = Path(__file__).resolve().parent
        read_bound(root / "results.json", RESULT_SHA)
        read_bound(root / "qualification-receipt.json", RECEIPT_SHA)
        require(git_blob((root / "gate.py").read_bytes()) == GATE_BLOB, "PROCESSING_CODE_CHANGED")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--observed", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(EvidenceMutationTests))
        raise SystemExit(0 if result.wasSuccessful() else 1)
    require(args.observed is not None, "--observed IS REQUIRED; NO FALLBACK TO FROZEN FILES")
    validate(args.repo.resolve(), args.observed.resolve())


if __name__ == "__main__":
    main()
