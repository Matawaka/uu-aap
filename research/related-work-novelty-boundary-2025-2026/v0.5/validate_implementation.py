#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent


def fail(msg: str) -> None:
    raise ValueError(msg)


def main() -> None:
    receipt = json.loads((BASE / "implementation-receipt.json").read_text(encoding="utf-8"))
    expected_keys = {"schema", "issue", "predecessor", "fixture_counts", "profile_count", "hostile_check_count", "result", "claims", "non_effects"}
    if set(receipt) != expected_keys:
        fail("implementation receipt key drift")
    if receipt["schema"] != "matawaka.synthetic-semantic-escalation-implementation-receipt/v0.5" or receipt["issue"] != 964:
        fail("implementation receipt identity mismatch")
    if receipt["predecessor"] != "1473ab2005c876816dab12ae46ed7f39bbfbad6b":
        fail("implementation predecessor mismatch")
    if receipt["fixture_counts"] != {"domains": 6, "promotion_classes": 10, "benign": 6, "hostile": 60, "total": 66}:
        fail("fixture count drift")
    if receipt["profile_count"] != 6 or receipt["hostile_check_count"] != 34:
        fail("profile/hostile count drift")

    result = receipt["result"]
    if result != {
        "top_result": "NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION",
        "matawaka_recall": 1.0,
        "specialized_union_recall": 1.0,
        "recall_delta": 0.0,
        "llm_policy_judge": "NOT_YET_MEASURED",
    }:
        fail("synthetic result promotion/drift")

    if receipt["claims"] != {
        "v04_byte_bound": True,
        "synthetic_results_reproducible": True,
        "ablation_results_reproducible": True,
        "negative_result_preserved": True,
    }:
        fail("implementation claims drift")

    expected_false = {"upstream_implementations_measured", "llm_policy_judge_measured", "real_world_superiority_established", "novelty_established", "world_first", "stable_core_changed", "poai_changed", "c2pa_changed", "runtime_changed", "merge_authorized"}
    non = receipt["non_effects"]
    if set(non) != expected_false or any(non[k] is not False for k in expected_false):
        fail("implementation non-effects drift")

    results = json.loads((BASE / "synthetic-results.json").read_text(encoding="utf-8"))
    if results["comparison"]["top_result"] != result["top_result"] or results["comparison"]["recall_delta"] != 0.0:
        fail("receipt/result mismatch")

    print("PASS: v0.5 implementation receipt preserves the reproducible no-advantage synthetic result")


if __name__ == "__main__":
    main()
