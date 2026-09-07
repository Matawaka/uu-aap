#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
PRED = "e4c5c88d3703968334069026873a5fa880bad226"


def fail(msg: str) -> None:
    raise ValueError(msg)


def main():
    receipt = json.loads((BASE / "implementation-receipt.json").read_text(encoding="utf-8"))
    ledger = json.loads((BASE / "taxonomy-ledger.json").read_text(encoding="utf-8"))
    matrix = json.loads((BASE / "promotion-matrix.json").read_text(encoding="utf-8"))

    expected_keys = {"schema", "issue", "predecessor", "source_count", "promotion_class_count", "classification_counts", "hostile_check_count", "claims", "non_effects"}
    if set(receipt) != expected_keys:
        fail("implementation receipt key drift")
    if receipt["schema"] != "matawaka.semantic-escalation-taxonomy-implementation-receipt/v0.4" or receipt["issue"] != 962 or receipt["predecessor"] != PRED:
        fail("implementation receipt identity mismatch")
    if receipt["source_count"] != len(ledger["sources"]) or receipt["source_count"] != 14:
        fail("source count mismatch")
    if receipt["promotion_class_count"] != len(matrix["classes"]) or receipt["promotion_class_count"] != 10:
        fail("promotion class count mismatch")
    if receipt["hostile_check_count"] != 35:
        fail("hostile check count mismatch")

    counts = {
        "predecessor_named_and_tested": 0,
        "predecessor_named_not_unified": 0,
        "post_publication_convergence": 0,
        "exact_materialization_not_found": 0,
        "insufficient_evidence": 0,
    }
    mapping = {
        "PREDECESSOR_NAMED_AND_TESTED": "predecessor_named_and_tested",
        "PREDECESSOR_NAMED_NOT_UNIFIED": "predecessor_named_not_unified",
        "POST_PUBLICATION_CONVERGENCE": "post_publication_convergence",
        "EXACT_MATERIALIZATION_NOT_FOUND_IN_BOUNDED_AUDIT": "exact_materialization_not_found",
        "INSUFFICIENT_EVIDENCE": "insufficient_evidence",
    }
    for c in matrix["classes"]:
        counts[mapping[c["classification"]]] += 1
    if receipt["classification_counts"] != counts or counts != {
        "predecessor_named_and_tested": 3,
        "predecessor_named_not_unified": 5,
        "post_publication_convergence": 1,
        "exact_materialization_not_found": 1,
        "insufficient_evidence": 0,
    }:
        fail("classification count drift")

    if receipt["claims"] != {
        "broad_taxonomy_claim_defeated": True,
        "unified_cross_layer_benchmark_candidate": True,
        "qualified_foundational_v03_byte_bound": True,
    }:
        fail("implementation claim drift")
    if matrix["top_result"] != "UNIFIED_CROSS_LAYER_BENCHMARK_CANDIDATE" or matrix["broad_taxonomy_claim_defeated"] is not True:
        fail("matrix no longer supports implementation claim")

    if any(receipt["non_effects"].values()):
        fail("implementation receipt contains promoted non-effect")

    print("PASS: v0.4 implementation receipt matches bounded taxonomy result")


if __name__ == "__main__":
    main()
