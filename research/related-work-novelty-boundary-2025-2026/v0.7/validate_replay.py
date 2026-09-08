#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from replay_statebench import REPO_ROOT, git_blob_sha1

HERE = Path(__file__).resolve().parent
EXPECTED_PREDECESSOR = "6823b9765894f410960c15ad797c4f6949c6225e"
EXPECTED_V06_TREE = "9372de8b191fd4d4a024e16723556eba097e2cfc"
EXPECTED_MAPPING_BLOB = "f108b84827d4076c7ace196480c94aa4e127d3de"
EXPECTED_SOURCE_BLOB = "3d0bcce1a7725384cf7c25eb4695a784e6a275cd"
EXPECTED_SOURCE_COMMIT = "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
EXPECTED_BYTES = 638933
EXPECTED_FIXTURES = 209


def load(name: str) -> Any:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def validate_static() -> None:
    protocol = load("protocol.json")
    manifest = load("source-manifest.json")

    assert protocol["schema"] == "matawaka.statebench-full-payload-replay-protocol/v0.7"
    assert protocol["issue"] == 970
    assert protocol["predecessor"] == EXPECTED_PREDECESSOR
    assert protocol["predecessor_v06_tree"] == EXPECTED_V06_TREE
    assert protocol["execution_evidence_level"] == "UPSTREAM_DATASET_ADAPTED"
    assert protocol["target_replay_status"] == "FULL_PINNED_TEST_PAYLOAD_REPLAYED"
    assert protocol["requirements"]["require_exact_fixture_count"] == EXPECTED_FIXTURES
    assert all(value is None for value in protocol["performance_fields"].values())
    assert protocol["non_effects"]["upstream_implementation_executed"] is False
    assert protocol["non_effects"]["statebench_baseline_executed"] is False
    assert protocol["non_effects"]["merge_authorized"] is False

    assert manifest["schema"] == "matawaka.statebench-pinned-source-manifest/v0.7"
    source = manifest["source"]
    assert source["repository"] == "Parslee-ai/statebench"
    assert source["commit"] == EXPECTED_SOURCE_COMMIT
    assert source["path"] == "data/releases/v1.0/test.jsonl"
    assert source["git_blob_sha1"] == EXPECTED_SOURCE_BLOB
    assert source["expected_bytes"] == EXPECTED_BYTES
    assert source["expected_fixture_count"] == EXPECTED_FIXTURES
    assert manifest["frozen_predecessor"]["commit"] == EXPECTED_PREDECESSOR
    assert manifest["frozen_predecessor"]["v06_tree"] == EXPECTED_V06_TREE
    assert manifest["frozen_predecessor"]["track_mapping_git_blob_sha1"] == EXPECTED_MAPPING_BLOB
    assert manifest["evidence_boundary"]["dataset_replay_status_before_execution"] == "NOT_EXECUTED"
    assert manifest["evidence_boundary"]["upstream_implementation_executed"] is False

    mapping_path = REPO_ROOT / manifest["frozen_predecessor"]["track_mapping_path"]
    assert git_blob_sha1(mapping_path.read_bytes()) == EXPECTED_MAPPING_BLOB


def validate_result(result: dict[str, Any]) -> None:
    required_top = {
        "schema",
        "predecessor",
        "source",
        "dataset_replay_status",
        "execution_evidence_level",
        "payload",
        "fixture_counts",
        "mapping_counts",
        "track_counts",
        "domain_counts",
        "query_counts",
        "unexpected_tracks",
        "performance",
        "non_effects",
    }
    assert set(result) == required_top
    assert result["schema"] == "matawaka.statebench-full-payload-replay-results/v0.7"
    assert result["predecessor"] == EXPECTED_PREDECESSOR
    assert result["source"] == {
        "repository": "Parslee-ai/statebench",
        "commit": EXPECTED_SOURCE_COMMIT,
        "path": "data/releases/v1.0/test.jsonl",
        "git_blob_sha1": EXPECTED_SOURCE_BLOB,
    }
    assert result["dataset_replay_status"] == "FULL_PINNED_TEST_PAYLOAD_REPLAYED"
    assert result["execution_evidence_level"] == "UPSTREAM_DATASET_ADAPTED"
    assert result["payload"]["bytes"] == EXPECTED_BYTES
    assert result["payload"]["git_blob_sha1"] == EXPECTED_SOURCE_BLOB
    assert len(result["payload"]["sha256"]) == 64
    int(result["payload"]["sha256"], 16)
    assert result["payload"]["utf8_valid"] is True
    assert result["payload"]["jsonl_records"] == EXPECTED_FIXTURES
    assert result["fixture_counts"] == {"total": 209, "unique_ids": 209, "missing_ids": 0}
    assert set(result["mapping_counts"]) == {"DIRECT", "PARTIAL", "AMBIGUOUS", "UNMAPPED"}
    assert sum(result["mapping_counts"].values()) == EXPECTED_FIXTURES
    assert all(isinstance(v, int) and v >= 0 for v in result["mapping_counts"].values())
    assert sum(result["track_counts"].values()) == EXPECTED_FIXTURES
    assert result["query_counts"]["with_ground_truth"] + result["query_counts"]["without_ground_truth"] == result["query_counts"]["events"]
    assert all(value is None for value in result["performance"].values())
    non_effects = result["non_effects"]
    assert set(non_effects) == {
        "upstream_implementation_executed",
        "external_model_executed",
        "statebench_baseline_executed",
        "detection_advantage_established",
        "detection_non_advantage_established",
        "novelty_established",
        "world_first",
        "merge_authorized",
    }
    assert not any(non_effects.values())


def main() -> int:
    validate_static()
    results_path = HERE / "results.json"
    if results_path.exists():
        validate_result(json.loads(results_path.read_text(encoding="utf-8")))
        print("PASS: v0.7 static boundary and checked-in replay result are valid")
    else:
        print("PASS: v0.7 static boundary valid; independent payload replay result not yet checked in")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
