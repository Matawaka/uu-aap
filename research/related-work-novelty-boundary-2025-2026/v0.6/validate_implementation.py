#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent


def load(name):
    return json.loads((BASE / name).read_text(encoding="utf-8"))


def fail(message):
    raise ValueError(message)


def main():
    receipt = load("implementation-receipt.json")
    results = load("results.json")
    mapping = load("track-mapping.json")
    benign = load("ambiguous-benign.json")
    ledger = load("upstream-ledger.json")

    if receipt.get("schema") != "matawaka.operational-generalization-implementation-receipt/v0.6":
        fail("receipt schema mismatch")
    if receipt.get("issue") != 966 or receipt.get("predecessor") != "186b4a68267f911840ba3a78001dd587fad9af67":
        fail("receipt identity mismatch")
    if receipt.get("predecessor_v05_tree") != "d735e56df71952bbd98f09b2d8884db44d511f0b":
        fail("receipt v0.5 tree mismatch")
    if receipt.get("upstream_source_count") != len(ledger["sources"]):
        fail("receipt upstream count mismatch")
    if receipt.get("documented_track_count") != len(mapping["mappings"]):
        fail("receipt track count mismatch")
    if receipt.get("mapping_counts") != {"direct": 1, "partial": 4, "ambiguous": 3, "unmapped": 5}:
        fail("receipt mapping counts mismatch")
    if receipt.get("ambiguous_benign_design_count") != len(benign["cases"]):
        fail("receipt benign design count mismatch")
    if receipt.get("hostile_check_count") != 37:
        fail("receipt hostile check count mismatch")
    if receipt.get("top_result") != results["top_result"] or receipt.get("evidence_level") != results["evidence_level"]:
        fail("receipt result/evidence mismatch")
    if any(v is not None for v in receipt["performance_measurements"].values()):
        fail("receipt fabricates performance measurement")
    claims = receipt["claims"]
    if claims != {"exact_v05_tree_bound": True, "statebench_source_pinned": True, "deterministic_track_adapter_present": True, "operational_advantage_established": False, "operational_non_advantage_established": False}:
        fail("receipt claim set drift")
    if any(receipt["non_effects"].values()):
        fail("receipt non-effect promoted")
    print("PASS: v0.6 implementation receipt preserves the insufficient-evidence boundary")


if __name__ == "__main__":
    main()
