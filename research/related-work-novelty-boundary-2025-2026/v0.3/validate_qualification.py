#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent

EXPECTED = {
    "schema": "matawaka.foundational-pressure-qualification-receipt/v0.3",
    "issue": 960,
    "pull_request": 961,
    "predecessor": "8aabf16b791ac3564c8178c4bf1e325bba5df59e",
    "qualified_head": "7a7e547fc98b05c7777a629b9d6e65737f7d1994",
    "workflow_run_id": 34128437255,
    "workflow_job_id": 101762504998,
    "workflow_name": "Foundational Novelty Pressure v0.3",
}


def fail(message: str) -> None:
    raise ValueError(message)


def main():
    receipt = json.loads((BASE / "qualification-receipt.json").read_text(encoding="utf-8"))
    for key, value in EXPECTED.items():
        if receipt.get(key) != value:
            fail(f"qualification identity drift: {key}")

    q = receipt.get("qualification", {})
    expected_q = {
        "job_conclusion": "success",
        "frozen_v01_v02_revalidated": True,
        "v03_foundational_evidence_validated": True,
        "baseline_hostile_checks": "24/24",
        "exact_stacked_predecessor_bound": True,
        "additive_only_boundary_proven": True,
        "predecessor_research_and_semantic_runtime_surfaces_unchanged": True,
    }
    if q != expected_q:
        fail("qualification gate drift")

    claims = receipt.get("claims", {})
    if claims != {
        "foundational_pressure_result_qualified": True,
        "defeated": 3,
        "materially_narrowed": 2,
        "survives_foundational_pressure": 0,
    }:
        fail("qualification result drift")

    non_effects = receipt.get("non_effects", {})
    expected_keys = {
        "novelty_established", "world_first", "patentability_established", "complete_prior_art_search",
        "v01_v02_rewritten", "stable_core_changed", "poai_changed", "c2pa_changed", "runtime_changed", "merge_authorized",
    }
    if set(non_effects) != expected_keys or any(non_effects.values()):
        fail("qualification non-effects drift")

    print("PASS: first independent v0.3 qualification remains frozen and non-promoting")


if __name__ == "__main__":
    main()
