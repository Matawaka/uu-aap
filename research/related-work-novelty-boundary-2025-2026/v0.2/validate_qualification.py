#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent

receipt = json.loads((BASE / "qualification-receipt.json").read_text(encoding="utf-8"))
matrix = json.loads((BASE / "candidate-pressure-matrix.json").read_text(encoding="utf-8"))
implementation = json.loads((BASE / "implementation-receipt.json").read_text(encoding="utf-8"))

expected = {
    "schema": "matawaka.novelty-pressure-qualification-receipt/v0.2",
    "issue": 958,
    "pull_request": 959,
    "predecessor": "80850c1fb3da81b5af40049b35473e4c50123218",
    "qualified_head": "25a18ec2a94e7c008d9794ec2c301f78961ac3c2",
    "workflow_run_id": 34122097659,
    "workflow_job_id": 101742256257,
    "workflow_name": "Novelty Pressure Test v0.2",
}
for key, value in expected.items():
    if receipt.get(key) != value:
        raise SystemExit(f"qualification binding mismatch: {key}")

q = receipt.get("qualification", {})
if q != {
    "job_conclusion": "success",
    "frozen_v01_revalidated": True,
    "v02_pressure_evidence_validated": True,
    "baseline_hostile_checks": "21/21",
    "exact_stacked_predecessor_bound": True,
    "additive_only_boundary_proven": True,
    "v01_and_semantic_runtime_surfaces_unchanged": True,
}:
    raise SystemExit("qualification facts drift")

counts = {"MATERIALLY_NARROWED": 0, "SURVIVES_BOUNDED_PRESSURE": 0}
for candidate in matrix["candidates"]:
    if candidate["result"] in counts:
        counts[candidate["result"]] += 1
if receipt.get("claims") != {
    "bounded_pressure_result_qualified": True,
    "materially_narrowed": counts["MATERIALLY_NARROWED"],
    "survives_bounded_pressure": counts["SURVIVES_BOUNDED_PRESSURE"],
}:
    raise SystemExit("qualification result counts drift")

if implementation.get("results", {}).get("materially_narrowed") != 4 or implementation.get("results", {}).get("survives_bounded_pressure") != 1:
    raise SystemExit("implementation/qualification result mismatch")

expected_non_effects = {
    "novelty_established": False,
    "world_first": False,
    "patentability_established": False,
    "complete_prior_art_search": False,
    "v01_rewritten": False,
    "stable_core_changed": False,
    "poai_changed": False,
    "c2pa_changed": False,
    "runtime_changed": False,
    "merge_authorized": False,
}
if receipt.get("non_effects") != expected_non_effects:
    raise SystemExit("qualification non-effects promotion or drift")

print("PASS: frozen first independent v0.2 qualification remains exact and non-promoting")
