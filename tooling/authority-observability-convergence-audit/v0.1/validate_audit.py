#!/usr/bin/env python3
"""Validate the authority-observability convergence audit without promoting it."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
AUDIT_PATH = HERE / "audit.json"
SCHEMA_PATH = HERE / "audit.schema.json"

TOP_KEYS = {
    "schema",
    "version",
    "origin_main",
    "tracking_issue",
    "admission_predecessor",
    "source_bindings",
    "domains",
    "components",
    "findings",
    "decision",
    "semantic_guards",
    "non_effects",
}

EXPECTED_SOURCES = {
    "c2pa_authority_admission": ("scripts/c2pa-authority-admission/gate.py", "6f6882c2f70585eb80d93b005c7210b7cfc3df51", "primary_domain"),
    "observable_authority_consistency": ("scripts/observable-authority-consistency/receipt.py", "93a0921ccf04630fe1c3ccb287a9ef879474c3a3", "primary_domain"),
    "authority_surface_triangulation": ("scripts/authority-surface-triangulation/receipt.py", "1e6bb9f243c17a22af6ff3d007796ba0c21a837c", "primary_domain"),
    "authority_surface_transition": ("scripts/authority-surface-transition/receipt.py", "83485b89c5ea590568d118aee70804b575b71132", "primary_domain"),
    "authority_surface_continuity": ("scripts/authority-surface-continuity-chain/receipt.py", "42c68dfd5b864d141c7b1304698e01242fa60089", "primary_domain"),
    "observed_branch_divergence": ("scripts/observed-authority-branch-divergence/receipt.py", "07fb09bad10d2398a4a3b67d085917850e28a60d", "primary_domain"),
    "observed_branch_set": ("scripts/observed-authority-branch-set/receipt.py", "5246f27c8c377b397e962b22a51c5963f482b179", "primary_domain"),
    "observed_branch_set_transition": ("scripts/observed-authority-branch-set-transition/receipt.py", "73dd39f6acab61dd3a1eba871200e674f733ea8d", "primary_domain"),
    "observed_branch_set_transition_chain": ("scripts/observed-authority-branch-set-transition-chain/receipt.py", "e9fb9b962deb7d113657018795b804e6411fb757", "primary_domain"),
    "public_review_checkpoint": ("tooling/public-review-observation-checkpoint/v0.1/README.md", "8a0eadb4fea57d9d55c773b5abb4e10c8a629c23", "independent_domain"),
    "public_review_disposition": ("tooling/public-review-disposition-ledger/v0.1/README.md", "eb1ab362e2ac85c18e4145cca81dadfda4ce6912", "independent_domain"),
    "kontur_responsibility": ("server/kontur/v0.1/README.md", "b7c9763ca4d06ee9b26e2f987c8b72d9c78ce798", "independent_domain"),
    "life_situation_resolver": ("pilots/life-situation-resolver/v0.1/README.md", "e8fd5ce0e2f7eacc484f082a3670deb8c62b934d", "independent_domain_partial"),
    "bounded_action_e2e": ("protocols/integration/bounded-action-e2e/v0.1/README.md", "25b9edce3f397b305a61dabe7ad51d2c5fbb6888", "existing_downstream"),
    "ambient_observability": ("protocols/integration/ambient-observability-non-identification/v0.1/README.md", "8b229487f719e641f48a7cedf60e2b1803b0dbdb", "existing_reusable"),
    "circumstantial_provenance": ("protocols/integration/circumstantial-provenance/v0.1/README.md", "6937c35599d79a7562a055d834fb27f27f2f8ab7", "existing_reusable"),
    "event_hash_minimalism": ("protocols/integration/event-hash-minimalism/v0.1/README.md", "0000d831c15d74b8bd8186b5dad2f5b9ce6920b9", "existing_reusable"),
    "current_roadmap": ("docs/ROADMAP-CURRENT.md", "6063ce07c479c6a59c78091e4212fc5d09c27a04", "governance_boundary"),
}

EXPECTED_DOMAINS = {
    "c2pa_authority_observability": (False, "DOMAIN_IMPLEMENTED", None, True),
    "public_review": (True, "SECOND_DOMAIN_SEMANTIC_MATCH", "STRONG", False),
    "kontur": (True, "SECOND_DOMAIN_SEMANTIC_MATCH", "STRONG", False),
    "life_situation_resolver": (True, "SECOND_DOMAIN_SEMANTIC_MATCH", "PARTIAL", False),
    "bounded_action": (True, "REUSE_EXISTING", None, False),
    "workbench": (True, "DEFER", None, False),
}

EXPECTED_COMPONENT_DECISIONS = {
    "authority_admission_consistency": "REUSE_EXISTING",
    "explainability_observable_consistency": "REUSE_EXISTING",
    "multi_surface_triangulation": "PROFILE_EXTRACTION_CANDIDATE",
    "observation_set_calculus": "PROFILE_EXTRACTION_CANDIDATE",
    "c2pa_authority_surface_adapter": "DOMAIN_IMPLEMENTED",
}

SEMANTIC_GUARDS = {
    "semantic_match_implies_direct_reuse",
    "profile_candidate_implies_core_admission",
    "validation_similarity_implies_shared_runtime",
    "observation_evidence_mints_action_authority",
    "public_review_observation_mints_disposition",
    "kontur_readiness_mints_activation",
    "lsr_attention_mints_required_action",
    "workbench_reactivated",
}

NON_EFFECTS = {
    "stable_core_changed",
    "spec_changed",
    "interface_registry_changed",
    "c2pa_reclassified",
    "kontur_activated",
    "lsr_actuated",
    "action_permit_created",
    "workbench_reactivated",
    "release_or_tag_created",
    "external_effect_performed",
}


class AuditError(ValueError):
    pass


def fail(message: str) -> None:
    raise AuditError(message)


def exact_keys(value: Any, expected: set[str], name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail(f"{name} must be object")
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        fail(f"{name} keys mismatch missing={missing} unknown={unknown}")
    return value


def git_blob(path: str) -> str:
    full = REPO / path
    if not full.is_file():
        fail(f"bound source missing: {path}")
    proc = subprocess.run(
        ["git", "hash-object", path],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        fail(f"git hash-object failed for {path}: {proc.stderr.strip()}")
    return proc.stdout.strip()


def require_text(path: str, fragments: list[str]) -> None:
    text = (REPO / path).read_text(encoding="utf-8")
    for fragment in fragments:
        if fragment not in text:
            fail(f"semantic marker missing from {path}: {fragment}")


def validate(data: dict[str, Any], *, verify_repo: bool = True) -> dict[str, Any]:
    exact_keys(data, TOP_KEYS, "audit")
    if data["schema"] != "urn:uu-aap:authority-observability-convergence-audit:0.1":
        fail("unexpected audit schema")
    if data["version"] != "0.1":
        fail("unexpected audit version")
    if data["origin_main"] != "928249c2e356d4cfaa9255a9701d30b82bb19cd9":
        fail("origin_main drift")
    if data["tracking_issue"] != 907:
        fail("tracking issue drift")

    predecessor = exact_keys(data["admission_predecessor"], {"path", "blob_sha1", "rule"}, "admission_predecessor")
    if predecessor["path"] != "protocols/integration/reusable-component-admission-audit/v0.1/README.md":
        fail("admission predecessor path drift")
    if predecessor["blob_sha1"] != "ee5568b246db76044bbf109607c86c97b0c233be":
        fail("admission predecessor blob drift")
    if "two genuinely independent current consumer families" not in predecessor["rule"]:
        fail("admission threshold weakened")

    bindings = data["source_bindings"]
    if not isinstance(bindings, list):
        fail("source_bindings must be array")
    by_id: dict[str, dict[str, Any]] = {}
    for item in bindings:
        item = exact_keys(item, {"id", "path", "blob_sha1", "role"}, "source_binding")
        if item["id"] in by_id:
            fail(f"duplicate source id: {item['id']}")
        by_id[item["id"]] = item
    if set(by_id) != set(EXPECTED_SOURCES):
        fail("source binding set drift")
    for source_id, expected in EXPECTED_SOURCES.items():
        path, blob, role = expected
        item = by_id[source_id]
        if (item["path"], item["blob_sha1"], item["role"]) != expected:
            fail(f"source binding drift: {source_id}")
        if verify_repo and git_blob(path) != blob:
            fail(f"repository blob drift: {source_id}")

    domains = data["domains"]
    if not isinstance(domains, list):
        fail("domains must be array")
    domain_map: dict[str, dict[str, Any]] = {}
    for item in domains:
        allowed = {"id", "independent", "match", "strength", "direct_consumer", "excluded_from_demand_count", "notes"}
        if not isinstance(item, dict) or not set(item).issubset(allowed):
            fail("domain shape invalid")
        required = {"id", "independent", "match", "direct_consumer", "notes"}
        if not required.issubset(item):
            fail("domain required fields missing")
        if item["id"] in domain_map:
            fail("duplicate domain")
        domain_map[item["id"]] = item
    if set(domain_map) != set(EXPECTED_DOMAINS):
        fail("domain set drift")
    for domain_id, (independent, match, strength, direct) in EXPECTED_DOMAINS.items():
        item = domain_map[domain_id]
        if item["independent"] is not independent or item["match"] != match or item["direct_consumer"] is not direct:
            fail(f"domain classification drift: {domain_id}")
        if strength is None:
            if "strength" in item:
                fail(f"unexpected strength on {domain_id}")
        elif item.get("strength") != strength:
            fail(f"domain strength drift: {domain_id}")
    if domain_map["workbench"].get("excluded_from_demand_count") is not True:
        fail("Workbench must remain excluded from demand count while paused")

    components = data["components"]
    if not isinstance(components, list):
        fail("components must be array")
    component_map: dict[str, dict[str, Any]] = {}
    allowed_component = {"id", "primary_sources", "second_domain_matches", "partial_matches", "direct_reuse_proven", "decision", "reason"}
    for item in components:
        if not isinstance(item, dict) or not set(item).issubset(allowed_component):
            fail("component shape invalid")
        required = {"id", "primary_sources", "second_domain_matches", "direct_reuse_proven", "decision", "reason"}
        if not required.issubset(item):
            fail("component required fields missing")
        if item["id"] in component_map:
            fail("duplicate component")
        component_map[item["id"]] = item
    if set(component_map) != set(EXPECTED_COMPONENT_DECISIONS):
        fail("component set drift")
    for component_id, decision in EXPECTED_COMPONENT_DECISIONS.items():
        item = component_map[component_id]
        if item["decision"] != decision:
            fail(f"component decision drift: {component_id}")
        expected_direct = component_id == "c2pa_authority_surface_adapter"
        if item["direct_reuse_proven"] is not expected_direct:
            fail(f"component direct-reuse drift: {component_id}")
    for candidate in ("multi_surface_triangulation", "observation_set_calculus"):
        matches = set(component_map[candidate]["second_domain_matches"])
        if not {"public_review", "kontur"}.issubset(matches):
            fail(f"candidate missing strong independent domains: {candidate}")

    findings = exact_keys(data["findings"], {
        "semantic_reusable_demand",
        "strong_independent_second_domain_match_count",
        "strong_independent_second_domain_matches",
        "partial_independent_matches",
        "direct_generic_api_reuse_proven",
        "existing_reusable_observation_provenance_composition_available",
        "profile_extraction_candidate",
        "generic_runtime_helper_justified",
        "new_action_lifecycle_justified",
        "workbench_reactivation_justified",
    }, "findings")
    if findings["semantic_reusable_demand"] != "CONFIRMED":
        fail("semantic demand result drift")
    if findings["strong_independent_second_domain_match_count"] != 2:
        fail("strong independent domain count drift")
    if findings["strong_independent_second_domain_matches"] != ["public_review", "kontur"]:
        fail("strong independent domain list drift")
    if findings["partial_independent_matches"] != ["life_situation_resolver"]:
        fail("partial independent domain list drift")
    if findings["direct_generic_api_reuse_proven"] is not False:
        fail("direct generic API reuse is not proven")
    if findings["existing_reusable_observation_provenance_composition_available"] is not True:
        fail("existing observation/provenance composition must be preserved")
    if findings["profile_extraction_candidate"] is not True:
        fail("profile extraction candidate result drift")
    for key in ("generic_runtime_helper_justified", "new_action_lifecycle_justified", "workbench_reactivation_justified"):
        if findings[key] is not False:
            fail(f"unsafe finding escalation: {key}")

    decision = exact_keys(data["decision"], {
        "overall", "stable_core_admission", "interface_registry_admission", "generic_runtime_implementation",
        "next_safe_action", "recommended_first_adapter_domain", "required_reference_adapter_domain",
        "kontur_role", "lsr_role", "workbench_role",
    }, "decision")
    expected_decision = {
        "overall": "PROFILE_EXTRACTION_CANDIDATE_NO_CORE_ADMISSION",
        "stable_core_admission": "NO_CORE_ADMISSION",
        "interface_registry_admission": "DEFER",
        "generic_runtime_implementation": "DEFER",
        "next_safe_action": "PROVE_TWO_DOMAIN_ADAPTERS_TO_CANDIDATE_NEUTRAL_PROFILE",
        "recommended_first_adapter_domain": "public_review",
        "required_reference_adapter_domain": "c2pa_authority_observability",
        "kontur_role": "SEMANTIC_CROSS_CHECK_NOT_FIRST_ADAPTER",
        "lsr_role": "PARTIAL_EPISTEMIC_CROSS_CHECK_ONLY",
        "workbench_role": "EXCLUDED_WHILE_PAUSED",
    }
    if decision != expected_decision:
        fail("decision drift")

    guards = exact_keys(data["semantic_guards"], SEMANTIC_GUARDS, "semantic_guards")
    if any(value is not False for value in guards.values()):
        fail("semantic guard escalation")
    non_effects = exact_keys(data["non_effects"], NON_EFFECTS, "non_effects")
    if any(value is not False for value in non_effects.values()):
        fail("non-effect escalation")

    if verify_repo:
        if git_blob(predecessor["path"]) != predecessor["blob_sha1"]:
            fail("admission predecessor repository blob drift")
        require_text("protocols/integration/reusable-component-admission-audit/v0.1/README.md", [
            "ADMIT` requires at least two genuinely independent current consumer families",
            "Composition Need != New Primitive Need",
        ])
        require_text("tooling/public-review-observation-checkpoint/v0.1/README.md", [
            "no new source observed on covered GitHub surfaces",
            "!= no external review exists anywhere",
        ])
        require_text("tooling/public-review-disposition-ledger/v0.1/README.md", [
            "indexed disposition != new disposition",
            "accept_for_followup != accepted as truth",
        ])
        require_text("server/kontur/v0.1/README.md", ["readiness", "!= authority", "TransitionReceipt"])
        require_text("pilots/life-situation-resolver/v0.1/README.md", [
            "Scenario != Forecast != Intent != Authorization",
            "Observed transaction != Family need",
        ])
        require_text("protocols/integration/bounded-action-e2e/v0.1/README.md", [
            "manifest is an index and verifier, not an issuer",
            "create future/general permission",
        ])
        require_text("protocols/integration/ambient-observability-non-identification/v0.1/README.md", ["Observation != Identification", "Observation cannot mint authority"])
        require_text("protocols/integration/circumstantial-provenance/v0.1/README.md", ["No Missing Link != Proof of Complete History", "Assessment Result != Canonical Verdict"])
        require_text("protocols/integration/event-hash-minimalism/v0.1/README.md", ["Hash Commitment != Full Surveillance Log", "does not by itself establish"])
        require_text("docs/ROADMAP-CURRENT.md", ["Workbench — `PAUSED_EXTERNAL_PRODUCT`", "Keep Workbench paused until a separate human decision resumes that product line"])

    return {
        "overall": decision["overall"],
        "strong_second_domains": findings["strong_independent_second_domain_matches"],
        "direct_generic_api_reuse_proven": findings["direct_generic_api_reuse_proven"],
        "next_safe_action": decision["next_safe_action"],
    }


def load_audit() -> dict[str, Any]:
    return json.loads(AUDIT_PATH.read_text(encoding="utf-8"))


def main() -> None:
    try:
        result = validate(load_audit(), verify_repo=True)
    except (OSError, json.JSONDecodeError, AuditError) as exc:
        print(f"authority-observability convergence audit: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print("authority-observability convergence audit: PASS")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
