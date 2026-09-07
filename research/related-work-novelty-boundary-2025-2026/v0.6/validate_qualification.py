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
    q = load("qualification-receipt.json")
    results = load("results.json")
    if q.get("schema") != "matawaka.operational-generalization-qualification-receipt/v0.6":
        fail("qualification schema mismatch")
    expected_identity = {
        "issue": 966,
        "pull_request": 969,
        "predecessor": "186b4a68267f911840ba3a78001dd587fad9af67",
        "qualified_head": "80655fffad40d78159ae293a383a731bdcd19f3a",
        "workflow_run_id": 34135495805,
        "workflow_job_id": 101785353488,
        "workflow_name": "Operational Generalization v0.6",
    }
    for key, expected in expected_identity.items():
        if q.get(key) != expected:
            fail(f"qualification identity drift: {key}")
    expected_qualification = {
        "job_conclusion": "success",
        "frozen_v01_v05_revalidated": True,
        "operational_evidence_boundary_validated": True,
        "baseline_hostile_checks": "37/37",
        "exact_stacked_predecessor_bound": True,
        "exact_v05_tree_bound": True,
        "additive_only_boundary_proven": True,
        "predecessor_and_runtime_product_surfaces_unchanged": True,
    }
    if q.get("qualification") != expected_qualification:
        fail("qualification gate set drift")
    qr = q["result"]
    if qr.get("top_result") != results["top_result"] or qr.get("evidence_level") != results["evidence_level"]:
        fail("qualification result/evidence drift")
    if qr.get("documented_track_count") != results["mapping"]["documented_tracks"]:
        fail("qualification track count drift")
    for key in ("direct", "partial", "ambiguous", "unmapped"):
        if qr.get(key) != results["mapping"][key]:
            fail(f"qualification mapping drift: {key}")
    if qr.get("held_out_detection_recall") is not None or qr.get("benign_false_positive_rate") is not None:
        fail("qualification fabricates performance")
    if any(q["non_effects"].values()):
        fail("qualification non-effect promoted")
    print("PASS: first independent v0.6 qualification remains frozen and evidence-bounded")


if __name__ == "__main__":
    main()
