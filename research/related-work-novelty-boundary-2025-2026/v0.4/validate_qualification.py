#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent

EXPECTED = {
    "schema": "matawaka.semantic-escalation-taxonomy-qualification-receipt/v0.4",
    "issue": 962,
    "pull_request": 963,
    "predecessor": "e4c5c88d3703968334069026873a5fa880bad226",
    "qualified_head": "e3bb6957136c43633a8aa43a7b4c7b1f122cded8",
    "workflow_run_id": 34130374439,
    "workflow_job_id": 101768791681,
    "workflow_name": "Semantic-Escalation Taxonomy v0.4",
}


def fail(msg: str) -> None:
    raise ValueError(msg)


def main() -> None:
    receipt = json.loads((BASE / "qualification-receipt.json").read_text(encoding="utf-8"))
    for key, value in EXPECTED.items():
        if receipt.get(key) != value:
            fail(f"qualification identity drift: {key}")

    q = receipt.get("qualification", {})
    if q != {
        "job_conclusion": "success",
        "frozen_v01_v03_revalidated": True,
        "taxonomy_evidence_validated": True,
        "baseline_hostile_checks": "35/35",
        "exact_stacked_predecessor_bound": True,
        "additive_only_boundary_proven": True,
        "predecessor_and_runtime_surfaces_unchanged": True,
    }:
        fail("qualification facts drift")

    claims = receipt.get("claims", {})
    if claims != {
        "broad_taxonomy_claim_defeated": True,
        "top_result": "UNIFIED_CROSS_LAYER_BENCHMARK_CANDIDATE",
        "promotion_class_count": 10,
        "public_predecessor_supported_classes": 8,
        "post_publication_convergence_classes": 1,
        "exact_materialization_not_found_classes": 1,
    }:
        fail("qualified bounded result drift")

    non = receipt.get("non_effects", {})
    required_false = {
        "novelty_established", "world_first", "complete_prior_art_search",
        "foundational_novelty_revived", "v01_v03_rewritten", "stable_core_changed",
        "poai_changed", "c2pa_changed", "runtime_changed", "merge_authorized"
    }
    if set(non) != required_false or any(non[k] is not False for k in required_false):
        fail("qualification non-effects drift")

    print("PASS: first independent v0.4 qualification remains frozen and non-promoting")


if __name__ == "__main__":
    main()
