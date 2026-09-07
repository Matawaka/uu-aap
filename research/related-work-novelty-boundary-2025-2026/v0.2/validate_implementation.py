#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent

receipt = json.loads((BASE / "implementation-receipt.json").read_text(encoding="utf-8"))
ledger = json.loads((BASE / "pressure-ledger.json").read_text(encoding="utf-8"))
matrix = json.loads((BASE / "candidate-pressure-matrix.json").read_text(encoding="utf-8"))

if receipt.get("schema") != "matawaka.novelty-pressure-implementation-receipt/v0.2":
    raise SystemExit("implementation receipt schema mismatch")
if receipt.get("issue") != 958:
    raise SystemExit("issue binding mismatch")
if receipt.get("predecessor") != "80850c1fb3da81b5af40049b35473e4c50123218":
    raise SystemExit("predecessor binding mismatch")
if receipt.get("pressure_source_count") != len(ledger["sources"]):
    raise SystemExit("pressure source count mismatch")
if receipt.get("candidate_count") != len(matrix["candidates"]):
    raise SystemExit("candidate count mismatch")

counts = {
    "materially_narrowed": 0,
    "survives_bounded_pressure": 0,
    "defeated": 0,
    "insufficient_evidence": 0,
}
map_result = {
    "MATERIALLY_NARROWED": "materially_narrowed",
    "SURVIVES_BOUNDED_PRESSURE": "survives_bounded_pressure",
    "DEFEATED_AS_NOVELTY_CANDIDATE": "defeated",
    "INSUFFICIENT_EVIDENCE": "insufficient_evidence",
}
for candidate in matrix["candidates"]:
    counts[map_result[candidate["result"]]] += 1
if receipt.get("results") != counts:
    raise SystemExit(f"result counts mismatch: {receipt.get('results')} != {counts}")
if receipt.get("hostile_check_count") != 21:
    raise SystemExit("hostile check count mismatch")
if receipt.get("claims") != {
    "v01_preserved": True,
    "all_candidates_repressured": True,
    "broad_claims_narrowed": True,
}:
    raise SystemExit("claims block mismatch")
expected_non_effects = {
    "novelty_established": False,
    "world_first": False,
    "patentability_established": False,
    "complete_prior_art_search": False,
    "stable_core_changed": False,
    "poai_changed": False,
    "c2pa_changed": False,
    "runtime_changed": False,
    "merge_authorized": False,
}
if receipt.get("non_effects") != expected_non_effects:
    raise SystemExit("non-effects promotion or drift")

print("PASS: v0.2 implementation receipt matches the pressure evidence and preserves all non-effects")
