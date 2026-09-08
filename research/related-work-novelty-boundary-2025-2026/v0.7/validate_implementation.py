#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from validate_replay import validate_result, validate_static

HERE = Path(__file__).resolve().parent
RESULT_SHA256 = "983a183510688345a2f8c75e28051782867d8e7006dc5227e1e83f4cd8704d43"
PAYLOAD_SHA256 = "7df54da79653488bcc2253c9431dc35fd5c2411ec12afe1f22958ed09395a7c9"
FIRST_GREEN_HEAD = "55c9ef9d368f6ca4ecdbc4ae80954fe86a51ca65"


def load(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def main() -> int:
    validate_static()
    results = load("results.json")
    validate_result(results)
    raw_result = (HERE / "results.json").read_bytes()
    assert hashlib.sha256(raw_result).hexdigest() == RESULT_SHA256
    assert (HERE / "results.sha256").read_text(encoding="ascii").strip() == RESULT_SHA256

    receipt = load("implementation-receipt.json")
    assert receipt["schema"] == "matawaka.statebench-full-payload-replay-implementation-receipt/v0.7"
    assert receipt["issue"] == 970
    assert receipt["pull_request"] == 971
    assert receipt["predecessor"] == "6823b9765894f410960c15ad797c4f6949c6225e"
    assert receipt["first_independent_green_head"] == FIRST_GREEN_HEAD
    assert receipt["workflow_run_id"] == 34183720674
    assert receipt["workflow_job_id"] == 101927787273
    assert receipt["workflow_name"] == "StateBench Full Payload Replay v0.7"

    source = receipt["source"]
    assert source["repository"] == results["source"]["repository"]
    assert source["commit"] == results["source"]["commit"]
    assert source["path"] == results["source"]["path"]
    assert source["bytes"] == results["payload"]["bytes"] == 638933
    assert source["git_blob_sha1"] == results["payload"]["git_blob_sha1"]
    assert source["payload_sha256"] == results["payload"]["sha256"] == PAYLOAD_SHA256

    replay = receipt["replay"]
    assert replay["status"] == results["dataset_replay_status"] == "FULL_PINNED_TEST_PAYLOAD_REPLAYED"
    assert replay["execution_evidence_level"] == results["execution_evidence_level"] == "UPSTREAM_DATASET_ADAPTED"
    assert replay["fixture_count"] == results["fixture_counts"]["total"] == 209
    assert replay["unique_fixture_ids"] == results["fixture_counts"]["unique_ids"] == 209
    assert replay["query_events"] == results["query_counts"]["events"] == 251
    assert replay["query_events_with_ground_truth"] == results["query_counts"]["with_ground_truth"] == 251
    assert replay["unexpected_tracks"] == results["unexpected_tracks"] == []
    assert replay["mapping_counts"] == results["mapping_counts"] == {
        "DIRECT": 15,
        "PARTIAL": 62,
        "AMBIGUOUS": 45,
        "UNMAPPED": 87,
    }
    assert replay["deterministic_result_sha256"] == RESULT_SHA256

    q = receipt["qualification_evidence"]
    assert q == {
        "job_conclusion": "success",
        "frozen_v01_v06_revalidated": True,
        "offline_baseline_hostile_checks": "18/18",
        "exact_network_payload_replayed": True,
        "exact_v06_predecessor_bound": True,
        "exact_v06_tree_bound": True,
        "exact_v06_mapping_blob_bound": True,
        "additive_only_boundary_proven": True,
        "predecessor_and_runtime_product_surfaces_unchanged": True,
    }
    assert all(value is None for value in receipt["performance"].values())
    assert receipt["performance"] == results["performance"]
    assert receipt["non_effects"]
    assert not any(receipt["non_effects"].values())
    assert receipt["non_effects"]["merge_authorized"] is False

    print("PASS: v0.7 implementation receipt matches exact first independent full-payload replay and preserves all non-effects")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
