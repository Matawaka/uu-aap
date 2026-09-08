#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from validate_implementation import main as validate_implementation

HERE = Path(__file__).resolve().parent


def load(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def main() -> int:
    validate_implementation()
    receipt = load("qualification-receipt.json")
    implementation = load("implementation-receipt.json")
    results = load("results.json")

    assert receipt["schema"] == "matawaka.statebench-full-payload-replay-qualification-receipt/v0.7"
    assert receipt["issue"] == 970
    assert receipt["pull_request"] == 971
    assert receipt["predecessor"] == "6823b9765894f410960c15ad797c4f6949c6225e"
    assert receipt["qualified_head"] == "55c9ef9d368f6ca4ecdbc4ae80954fe86a51ca65"
    assert receipt["qualified_head"] == implementation["first_independent_green_head"]
    assert receipt["workflow_run_id"] == implementation["workflow_run_id"] == 34183720674
    assert receipt["workflow_job_id"] == implementation["workflow_job_id"] == 101927787273
    assert receipt["workflow_name"] == implementation["workflow_name"] == "StateBench Full Payload Replay v0.7"

    q = receipt["qualification"]
    assert q["job_conclusion"] == "success"
    assert q["baseline_hostile_checks"] == "18/18"
    for key, value in q.items():
        if key not in {"job_conclusion", "baseline_hostile_checks"}:
            assert value is True, key

    r = receipt["result"]
    assert r["dataset_replay_status"] == results["dataset_replay_status"] == "FULL_PINNED_TEST_PAYLOAD_REPLAYED"
    assert r["execution_evidence_level"] == results["execution_evidence_level"] == "UPSTREAM_DATASET_ADAPTED"
    assert r["payload_sha256"] == results["payload"]["sha256"] == "7df54da79653488bcc2253c9431dc35fd5c2411ec12afe1f22958ed09395a7c9"
    assert r["deterministic_result_sha256"] == implementation["replay"]["deterministic_result_sha256"] == "983a183510688345a2f8c75e28051782867d8e7006dc5227e1e83f4cd8704d43"
    assert r["fixtures"] == results["fixture_counts"]["total"] == 209
    assert r["queries_with_ground_truth"] == results["query_counts"]["with_ground_truth"] == 251
    assert (r["direct"], r["partial"], r["ambiguous"], r["unmapped"]) == (15, 62, 45, 87)
    assert r["held_out_detection_recall"] is None
    assert r["benign_false_positive_rate"] is None

    assert receipt["non_effects"]
    assert not any(receipt["non_effects"].values())
    assert receipt["non_effects"]["merge_authorized"] is False

    print("PASS: first independent v0.7 qualification remains frozen, full-payload-replayed, and non-promoting")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
