#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent

EXPECTED_IDENTITY = {
    "schema": "matawaka.synthetic-semantic-escalation-qualification-receipt/v0.5",
    "issue": 964,
    "pull_request": 965,
    "predecessor": "1473ab2005c876816dab12ae46ed7f39bbfbad6b",
    "qualified_head": "e5c32d878a8a925453c8544cbeb9be36527b56ad",
    "workflow_run_id": 34132180712,
    "workflow_job_id": 101774643578,
    "workflow_name": "Empirical Semantic-Escalation Benchmark v0.5",
}


def fail(msg: str) -> None:
    raise ValueError(msg)


def main() -> None:
    receipt = json.loads((BASE / "qualification-receipt.json").read_text(encoding="utf-8"))
    for key, expected in EXPECTED_IDENTITY.items():
        if receipt.get(key) != expected:
            fail(f"qualification identity drift: {key}")

    if receipt.get("qualification") != {
        "job_conclusion": "success",
        "frozen_v01_v04_revalidated": True,
        "v05_benchmark_reproduced": True,
        "baseline_hostile_checks": "34/34",
        "exact_stacked_predecessor_bound": True,
        "additive_only_boundary_proven": True,
        "predecessor_and_runtime_surfaces_unchanged": True,
    }:
        fail("qualification facts drift")

    expected_result = {
        "top_result": "NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION",
        "matawaka_recall": 1.0,
        "specialized_union_recall": 1.0,
        "recall_delta": 0.0,
        "llm_policy_judge": "NOT_YET_MEASURED",
    }
    if receipt.get("result") != expected_result:
        fail("qualified synthetic result drift/promotion")

    result = json.loads((BASE / "synthetic-results.json").read_text(encoding="utf-8"))["comparison"]
    if result["top_result"] != expected_result["top_result"] or result["recall_delta"] != 0.0:
        fail("frozen qualification contradicts checked-in synthetic results")

    expected_false = {"upstream_implementations_measured", "llm_policy_judge_measured", "real_world_superiority_established", "novelty_established", "world_first", "stable_core_changed", "poai_changed", "c2pa_changed", "runtime_changed", "merge_authorized"}
    non = receipt.get("non_effects", {})
    if set(non) != expected_false or any(non[k] is not False for k in expected_false):
        fail("qualification non-effects drift")

    print("PASS: first independent v0.5 qualification remains frozen and preserves the no-advantage result")


if __name__ == "__main__":
    main()
