#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import runner

BASE = Path(__file__).resolve().parent
PRED = "186b4a68267f911840ba3a78001dd587fad9af67"
V05_TREE = "d735e56df71952bbd98f09b2d8884db44d511f0b"
V05_PATH = "research/related-work-novelty-boundary-2025-2026/v0.5"
PROMOTIONS = {
    "OBSERVATION_TO_BROAD_TRUTH", "CONTEXT_TO_AUTHORITY", "DECLARED_TO_VERIFIED_CONTEXT",
    "STALE_MEMORY_TO_CURRENT_AUTHORITY", "APPROVAL_TO_PERFORMED_ACTION", "INVOCATION_TO_COMPLETED_EFFECT",
    "PROVENANCE_TO_CAUSALITY", "IDENTITY_TO_AUTHORITY", "REVIEW_TO_EXECUTION_PERMISSION", "AVAILABILITY_TO_INTENT",
}
CLASSIFICATIONS = {"DIRECT", "PARTIAL", "AMBIGUOUS", "UNMAPPED"}


def load(name: str) -> dict[str, Any]:
    return json.loads((BASE / name).read_text(encoding="utf-8"))


def fail(message: str) -> None:
    raise ValueError(message)


def exact_keys(obj: dict[str, Any], expected: set[str], label: str) -> None:
    if set(obj) != expected:
        fail(f"{label}: unexpected keys {sorted(set(obj) ^ expected)}")


def validate_data(protocol: dict[str, Any], ledger: dict[str, Any], mapping: dict[str, Any], benign: dict[str, Any], results: dict[str, Any], check_tree: bool = True) -> None:
    if protocol.get("schema") != "matawaka.operational-generalization-protocol/v0.6" or protocol.get("issue") != 966:
        fail("protocol identity mismatch")
    if protocol.get("predecessor") != PRED or protocol.get("predecessor_v05_tree") != V05_TREE:
        fail("protocol predecessor binding mismatch")
    if protocol.get("frozen_v05_result") != "NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION":
        fail("v0.5 negative result was rewritten")
    sel = protocol.get("selection_recipe", {})
    if any(sel.get(k) is not False for k in ("payload_replayed", "derived_fixture_snapshot_materialized", "fixture_performance_scored")):
        fail("selection recipe inflates execution state")
    if any(protocol["non_effects"].values()):
        fail("protocol non-effect promoted")

    if ledger.get("schema") != "matawaka.operational-upstream-ledger/v0.6" or ledger.get("predecessor") != PRED:
        fail("upstream ledger identity mismatch")
    if len(ledger.get("sources", [])) != 1:
        fail("exactly one upstream source is admitted in v0.6")
    source = ledger["sources"][0]
    required_source = {
        "id", "repository", "repository_visibility", "commit", "license", "release", "release_created", "path",
        "git_blob_sha", "declared_test_fixture_count", "release_seed", "evidence_level", "upstream_implementation_executed",
        "external_model_executed", "full_payload_replayed_in_v06", "adapter_basis", "allowed_claim", "forbidden_claims"
    }
    exact_keys(source, required_source, "upstream source")
    expected_source = {
        "id": "STATEBENCH_V1_0_TEST",
        "repository": "Parslee-ai/statebench",
        "repository_visibility": "PUBLIC",
        "commit": "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7",
        "license": "MIT",
        "release": "v1.0",
        "release_created": "2025-12-24",
        "path": "data/releases/v1.0/test.jsonl",
        "git_blob_sha": "3d0bcce1a7725384cf7c25eb4695a784e6a275cd",
        "declared_test_fixture_count": 209,
        "release_seed": 42,
        "evidence_level": "UPSTREAM_DATASET_ADAPTED",
        "upstream_implementation_executed": False,
        "external_model_executed": False,
        "full_payload_replayed_in_v06": False,
    }
    for key, expected in expected_source.items():
        if source.get(key) != expected:
            fail(f"upstream source {key} drift")
    if len(source.get("forbidden_claims", [])) != 4:
        fail("upstream forbidden-claim boundary weakened")

    if mapping.get("schema") != "matawaka.statebench-track-mapping/v0.6" or mapping.get("upstream_source") != source["id"]:
        fail("mapping identity mismatch")
    if mapping.get("mapping_basis") != "PINNED_RELEASE_DOCUMENTATION_PLUS_BOUNDED_TEST_INSPECTION":
        fail("mapping evidence basis drift")
    if mapping.get("actual_test_track_set_fully_replayed") is not False:
        fail("track-set replay promoted")
    rows = mapping.get("mappings", [])
    if len(rows) != 13 or len({r.get("track") for r in rows}) != 13:
        fail("mapping must retain exactly 13 unique documented tracks")
    counts = {c: 0 for c in CLASSIFICATIONS}
    for row in rows:
        exact_keys(row, {"track", "classification", "candidate_promotions", "reason"}, f"mapping {row.get('track')}")
        cls = row.get("classification")
        if cls not in CLASSIFICATIONS:
            fail("unknown mapping classification")
        counts[cls] += 1
        refs = row.get("candidate_promotions", [])
        if len(refs) != len(set(refs)) or not set(refs) <= PROMOTIONS:
            fail("invalid promotion reference")
        if cls == "UNMAPPED" and refs:
            fail("unmapped track cannot silently acquire promotion mapping")
        if cls == "DIRECT" and len(refs) != 1:
            fail("direct mapping must bind exactly one promotion")
        if len(row.get("reason", "")) < 40:
            fail("mapping rationale too weak")
    expected_counts = {"DIRECT": 1, "PARTIAL": 4, "AMBIGUOUS": 3, "UNMAPPED": 5}
    if counts != expected_counts:
        fail(f"mapping counts drift: {counts}")
    if mapping.get("counts") != {"documented_tracks_under_audit": 13, "direct": 1, "partial": 4, "ambiguous": 3, "unmapped": 5}:
        fail("declared mapping counts drift")
    if any(mapping["non_effects"].values()):
        fail("mapping non-effect promoted")

    if benign.get("schema") != "matawaka.operational-ambiguous-benign/v0.6" or len(benign.get("cases", [])) != 6:
        fail("ambiguous benign design drift")
    if benign.get("measurement_status") != "DESIGN_ONLY_NOT_EXECUTED":
        fail("benign controls falsely promoted to measurement")
    if any(benign["non_effects"].values()):
        fail("benign non-effect promoted")

    expected_result = runner.compute()
    if results != expected_result:
        fail("results do not reproduce from admitted evidence")
    if results.get("top_result") != "INSUFFICIENT_EVIDENCE":
        fail("operational conclusion inflated")
    performance = results["performance"]
    if any(performance[k] is not None for k in ("admitted_fixture_count", "held_out_detection_recall", "benign_false_positive_rate")):
        fail("performance metric fabricated without execution evidence")
    if performance.get("fixture_level_mapping_count") != 0:
        fail("fixture-level mapping fabricated")
    if any(results["advantages"].values()):
        fail("operational advantage/non-advantage fabricated")
    if any(results["non_effects"].values()):
        fail("result non-effect promoted")
    if results["verdict_provenance"] != {"required_fields": 8, "present_fields": 8, "completeness": 1.0}:
        fail("provenance accounting drift")

    if check_tree:
        observed = subprocess.check_output(["git", "rev-parse", f"{PRED}:{V05_PATH}"], text=True).strip()
        if observed != V05_TREE:
            fail(f"qualified v0.5 subtree moved: {observed}")


def main() -> None:
    validate_data(load("protocol.json"), load("upstream-ledger.json"), load("track-mapping.json"), load("ambiguous-benign.json"), load("results.json"), check_tree=True)
    print("PASS: v0.6 operational audit is evidence-level bounded and exact-v0.5 bound")


if __name__ == "__main__":
    main()
