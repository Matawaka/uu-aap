#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import runner

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
PREDECESSOR = "1473ab2005c876816dab12ae46ed7f39bbfbad6b"

CLASSES = [
    "OBSERVATION_TO_BROAD_TRUTH",
    "CONTEXT_TO_AUTHORITY",
    "DECLARED_TO_VERIFIED_CONTEXT",
    "STALE_MEMORY_TO_CURRENT_AUTHORITY",
    "APPROVAL_TO_PERFORMED_ACTION",
    "INVOCATION_TO_COMPLETED_EFFECT",
    "PROVENANCE_TO_CAUSALITY",
    "IDENTITY_TO_AUTHORITY",
    "REVIEW_TO_EXECUTION_PERMISSION",
    "AVAILABILITY_TO_INTENT",
]

DOMAINS = [
    "AUTHORSHIP_REVIEW",
    "ENTERPRISE_DISCLOSURE",
    "REPOSITORY_ACTION",
    "PURCHASE_ACTION",
    "DEPLOYMENT_EFFECT",
    "ANALYTICAL_DECISION",
]

PROFILE_DETECTS = {
    "MATAWAKA_TYPED_PROFILE": set(CLASSES),
    "WEXP_LIKE_EXECUTION_PROFILE": {
        "OBSERVATION_TO_BROAD_TRUTH",
        "APPROVAL_TO_PERFORMED_ACTION",
        "INVOCATION_TO_COMPLETED_EFFECT",
        "PROVENANCE_TO_CAUSALITY",
        "IDENTITY_TO_AUTHORITY",
        "REVIEW_TO_EXECUTION_PERMISSION",
    },
    "STATEBENCH_LIKE_STATE_PROFILE": {
        "OBSERVATION_TO_BROAD_TRUTH",
        "CONTEXT_TO_AUTHORITY",
        "STALE_MEMORY_TO_CURRENT_AUTHORITY",
        "IDENTITY_TO_AUTHORITY",
    },
    "SPECIALIZED_UNION_PROFILE": set(CLASSES),
    "NAIVE_SCHEMA_PROFILE": set(),
}

PROFILE_KINDS = {
    "MATAWAKA_TYPED_PROFILE": "LOCAL_SYNTHETIC_PROFILE",
    "WEXP_LIKE_EXECUTION_PROFILE": "LOCAL_SYNTHETIC_PROFILE_NOT_UPSTREAM_WEXP",
    "STATEBENCH_LIKE_STATE_PROFILE": "LOCAL_SYNTHETIC_PROFILE_NOT_UPSTREAM_STATEBENCH",
    "SPECIALIZED_UNION_PROFILE": "LOCAL_SYNTHETIC_UNION_OF_NARROW_CHECKS",
    "NAIVE_SCHEMA_PROFILE": "LOCAL_SHAPE_ONLY_PROFILE",
    "LLM_POLICY_JUDGE": "EXTERNAL_MODEL_BASELINE",
}

ABLATIONS = {
    "EPISTEMIC_AVAILABILITY_CONSIDERATION": ["AVAILABILITY_TO_INTENT"],
    "IDENTITY_AUTHORITY": ["CONTEXT_TO_AUTHORITY", "IDENTITY_TO_AUTHORITY"],
    "REVIEW_PERMISSION": ["REVIEW_TO_EXECUTION_PERMISSION"],
    "INVOCATION_EFFECT": ["APPROVAL_TO_PERFORMED_ACTION", "INVOCATION_TO_COMPLETED_EFFECT"],
    "PROVENANCE_CAUSALITY": ["OBSERVATION_TO_BROAD_TRUTH", "DECLARED_TO_VERIFIED_CONTEXT", "PROVENANCE_TO_CAUSALITY"],
    "FRESHNESS_CURRENT_AUTHORITY": ["STALE_MEMORY_TO_CURRENT_AUTHORITY"],
}

V04_BLOBS = {
    "research/related-work-novelty-boundary-2025-2026/v0.4/README.md": "35840253423bade1ee3759ee371ded62dcef7306",
    "research/related-work-novelty-boundary-2025-2026/v0.4/SOURCES.md": "23eb538444f994aa7ef715b8bd9e4c8495d79a8b",
    "research/related-work-novelty-boundary-2025-2026/v0.4/TAXONOMY-RESULT.md": "23043dbc8fbc1b22b2a14c797fdee9274fd3bdb8",
    "research/related-work-novelty-boundary-2025-2026/v0.4/implementation-receipt.json": "1b9517fd0f483224526fb8667d2aa150208a1be8",
    "research/related-work-novelty-boundary-2025-2026/v0.4/implementation-receipt.schema.json": "8c900f86ccd6578b7cab6a7e0e13b1d116c99a4b",
    "research/related-work-novelty-boundary-2025-2026/v0.4/promotion-matrix.json": "ad5e1ac0978e2b57c4fd3032cbf42f9446ba57d8",
    "research/related-work-novelty-boundary-2025-2026/v0.4/promotion-matrix.schema.json": "f9d93b73d1ae463dc70fc150163ebb2564d0ae84",
    "research/related-work-novelty-boundary-2025-2026/v0.4/qualification-receipt.json": "1ce8190e7985d824ed788afe0efd557c993e9d0d",
    "research/related-work-novelty-boundary-2025-2026/v0.4/qualification-receipt.schema.json": "96d21ba43b512c2d15f55df21999145605f89d19",
    "research/related-work-novelty-boundary-2025-2026/v0.4/taxonomy-ledger.json": "4ef6228752655f9760b07836f5b354475eb307da",
    "research/related-work-novelty-boundary-2025-2026/v0.4/taxonomy-ledger.schema.json": "fbcc167fdc775268c333016c3945c2721a941cbd",
    "research/related-work-novelty-boundary-2025-2026/v0.4/test_taxonomy.py": "bb6e1d25703ae49aba3b8808592ff4122bb525ea",
    "research/related-work-novelty-boundary-2025-2026/v0.4/validate_implementation.py": "290eeabd3d46bfd43680c7b349abcfd5aa63e912",
    "research/related-work-novelty-boundary-2025-2026/v0.4/validate_qualification.py": "7754da8326169f06802b07f3003990c175ce0ff0",
    "research/related-work-novelty-boundary-2025-2026/v0.4/validate_taxonomy.py": "5fadd997d4344165106c8ddedd0f4a3dc1de626e",
}


def fail(msg: str) -> None:
    raise ValueError(msg)


def exact_keys(obj: dict[str, Any], expected: set[str], where: str) -> None:
    if set(obj) != expected:
        fail(f"{where}: key mismatch missing={sorted(expected-set(obj))} extra={sorted(set(obj)-expected)}")


def validate_data(b: dict[str, Any]) -> None:
    exact_keys(b, {"schema", "issue", "predecessor", "fixture_model", "domains", "promotion_classes", "base_state", "mutations", "profiles", "ablation_families", "acceptance_results", "non_effects"}, "benchmark")
    if b["schema"] != "matawaka.synthetic-semantic-escalation-benchmark/v0.5" or b["issue"] != 964 or b["predecessor"] != PREDECESSOR:
        fail("benchmark identity/predecessor mismatch")
    if b["fixture_model"] != "SAME_BASE_STATE_PLUS_SINGLE_UNSUPPORTED_SEMANTIC_PROMOTION":
        fail("fixture model drift")

    if [x.get("id") for x in b["domains"]] != DOMAINS:
        fail("domain set/order drift")
    for i, d in enumerate(b["domains"]):
        exact_keys(d, {"id", "description"}, f"domain[{i}]")
        if len(d["description"]) < 20:
            fail("domain description too weak")

    if b["promotion_classes"] != CLASSES:
        fail("promotion class set/order drift")

    exact_keys(b["base_state"], {"claims", "support"}, "base_state")
    if set(b["base_state"]["claims"]) != set(CLASSES) or set(b["base_state"]["support"]) != set(CLASSES):
        fail("base-state class coverage mismatch")
    if any(v is not True for v in b["base_state"]["claims"].values()) or any(v is not True for v in b["base_state"]["support"].values()):
        fail("benign base state must support every asserted claim")

    if len(b["mutations"]) != len(CLASSES) or [m.get("class") for m in b["mutations"]] != CLASSES:
        fail("mutation set/order drift")
    for i, m in enumerate(b["mutations"]):
        exact_keys(m, {"class", "description"}, f"mutation[{i}]")
        if len(m["description"]) < 20:
            fail("mutation description too weak")

    profiles = b["profiles"]
    ids = [p.get("id") for p in profiles]
    if ids != ["MATAWAKA_TYPED_PROFILE", "WEXP_LIKE_EXECUTION_PROFILE", "STATEBENCH_LIKE_STATE_PROFILE", "SPECIALIZED_UNION_PROFILE", "NAIVE_SCHEMA_PROFILE", "LLM_POLICY_JUDGE"]:
        fail("profile set/order drift")
    for p in profiles:
        pid = p["id"]
        if p.get("kind") != PROFILE_KINDS[pid]:
            fail(f"profile kind drift: {pid}")
        if pid == "LLM_POLICY_JUDGE":
            exact_keys(p, {"id", "kind", "measurement_status"}, pid)
            if p["measurement_status"] != "NOT_YET_MEASURED":
                fail("LLM judge cannot be promoted without external execution evidence")
        else:
            exact_keys(p, {"id", "kind", "detects"}, pid)
            if set(p["detects"]) != PROFILE_DETECTS[pid] or len(p["detects"]) != len(PROFILE_DETECTS[pid]):
                fail(f"synthetic profile coverage drift: {pid}")

    if b["ablation_families"] != ABLATIONS:
        fail("ablation family mapping drift")
    flattened = [c for xs in ABLATIONS.values() for c in xs]
    if sorted(flattened) != sorted(CLASSES):
        fail("ablation families must partition all promotion classes")

    if b["acceptance_results"] != ["SYNTHETIC_CROSS_LAYER_ADVANTAGE_OBSERVED", "NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION", "BENCHMARK_DESIGN_INSUFFICIENT"]:
        fail("acceptance result vocabulary drift")

    non = b["non_effects"]
    expected_non = {"upstream_wexp_measured", "upstream_statebench_measured", "llm_policy_judge_measured", "real_world_superiority_established", "novelty_established", "world_first", "merge_authorized"}
    exact_keys(non, expected_non, "non_effects")
    if any(non[k] is not False for k in expected_non):
        fail("benchmark non-effect promotion")


def validate_v04_blobs(repo_root: Path = ROOT) -> None:
    for path, expected in V04_BLOBS.items():
        p = subprocess.run(["git", "rev-parse", f"HEAD:{path}"], cwd=repo_root, text=True, capture_output=True)
        if p.returncode != 0:
            fail(f"frozen v0.4 path missing: {path}")
        if p.stdout.strip() != expected:
            fail(f"frozen v0.4 blob drift: {path}")


def validate_results(b: dict[str, Any]) -> None:
    expected_synthetic = runner.compute_synthetic(b)
    expected_ablation = runner.compute_ablations(b)
    if json.loads((BASE / "synthetic-results.json").read_text(encoding="utf-8")) != expected_synthetic:
        fail("checked-in synthetic results do not reproduce")
    if json.loads((BASE / "ablation-results.json").read_text(encoding="utf-8")) != expected_ablation:
        fail("checked-in ablation results do not reproduce")
    if expected_synthetic["comparison"]["top_result"] != "NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION":
        fail("qualified synthetic top result drift")
    if expected_synthetic["comparison"]["recall_delta"] != 0.0:
        fail("unexpected synthetic recall advantage")


def validate_repository() -> None:
    b = json.loads((BASE / "benchmark.json").read_text(encoding="utf-8"))
    validate_data(b)
    validate_v04_blobs()
    validate_results(b)


if __name__ == "__main__":
    validate_repository()
    print("PASS: v0.5 benchmark, frozen v0.4 bindings, synthetic results and no-advantage result are consistent")
