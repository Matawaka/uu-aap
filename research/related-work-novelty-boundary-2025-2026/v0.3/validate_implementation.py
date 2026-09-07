#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
PREDECESSOR = "8aabf16b791ac3564c8178c4bf1e325bba5df59e"


def fail(message: str) -> None:
    raise ValueError(message)


def exact_keys(obj, keys, where):
    if set(obj) != set(keys):
        fail(f"{where}: key mismatch")


def main():
    receipt = json.loads((BASE / "implementation-receipt.json").read_text(encoding="utf-8"))
    ledger = json.loads((BASE / "foundational-ledger.json").read_text(encoding="utf-8"))
    matrix = json.loads((BASE / "foundational-matrix.json").read_text(encoding="utf-8"))

    exact_keys(receipt, ["schema", "issue", "predecessor", "foundational_source_count", "claim_count", "results", "hostile_check_count", "claims", "non_effects"], "receipt")
    if receipt["schema"] != "matawaka.foundational-pressure-implementation-receipt/v0.3" or receipt["issue"] != 960 or receipt["predecessor"] != PREDECESSOR:
        fail("receipt identity mismatch")
    if receipt["foundational_source_count"] != len(ledger["sources"]) or receipt["foundational_source_count"] != 14:
        fail("foundational source count mismatch")
    if receipt["claim_count"] != len(matrix["claims"]) or receipt["claim_count"] != 5:
        fail("claim count mismatch")
    if receipt["hostile_check_count"] != 24:
        fail("hostile count mismatch")

    expected_results = {
        "materially_narrowed": 2,
        "survives_foundational_pressure": 0,
        "defeated": 3,
        "insufficient_evidence": 0,
    }
    if receipt["results"] != expected_results:
        fail("result summary mismatch")

    expected_claims = {
        "v02_preserved": True,
        "all_candidates_foundationally_pressured": True,
        "integration_value_separated_from_foundational_novelty": True,
    }
    if receipt["claims"] != expected_claims:
        fail("implementation claims mismatch")

    required_non_effects = {
        "novelty_established", "world_first", "patentability_established", "complete_prior_art_search",
        "stable_core_changed", "poai_changed", "c2pa_changed", "runtime_changed", "merge_authorized",
    }
    exact_keys(receipt["non_effects"], required_non_effects, "non_effects")
    if any(receipt["non_effects"].values()):
        fail("implementation receipt contains promoted effect")

    counts = {"MATERIALLY_NARROWED": 0, "SURVIVES_FOUNDATIONAL_PRESSURE": 0, "DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE": 0, "INSUFFICIENT_EVIDENCE": 0}
    for claim in matrix["claims"]:
        counts[claim["result"]] += 1
    if counts != {
        "MATERIALLY_NARROWED": 2,
        "SURVIVES_FOUNDATIONAL_PRESSURE": 0,
        "DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE": 3,
        "INSUFFICIENT_EVIDENCE": 0,
    }:
        fail("matrix/result summary drift")

    print("PASS: v0.3 implementation receipt matches bounded foundational result")


if __name__ == "__main__":
    main()
