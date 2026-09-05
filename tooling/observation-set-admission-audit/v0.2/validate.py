#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import subprocess
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
ASSESSMENT_PATH = HERE / "assessment.json"
SCHEMA_PATH = HERE / "assessment.schema.json"
ORIGIN_MAIN = "552d0f293efaffd6c62c69d415fae17d7c5aff9a"

EXPECTED_SOURCE_IDS = {
    "candidate_profile", "c2pa_adapter", "public_review_adapter", "two_domain_proof",
    "convergence_audit", "reusable_component_admission_v0_1", "interface_registry_v0_2",
    "ambient_observability", "circumstantial_provenance", "event_hash_minimalism"
}


def fail(msg: str) -> None:
    raise ValueError(msg)


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git_blob(path: str) -> str:
    return subprocess.check_output(["git", "hash-object", path], cwd=REPO_ROOT, text=True).strip()


def validate(assessment: dict) -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(assessment), key=lambda e: list(e.absolute_path))
    if errors:
        fail(f"schema validation failed: {errors[0].message}")

    if assessment["origin_main"] != ORIGIN_MAIN:
        fail("origin main drift")
    if assessment["tracking_issue"] != 911:
        fail("tracking issue drift")

    bindings = assessment["source_bindings"]
    ids = [item["id"] for item in bindings]
    if len(ids) != len(set(ids)) or set(ids) != EXPECTED_SOURCE_IDS:
        fail("source binding id set drift")
    for item in bindings:
        actual = git_blob(item["path"])
        if actual != item["blob_sha1"]:
            fail(f"source byte drift: {item['path']}: {actual}")

    old_assessment = json.loads((REPO_ROOT / "protocols/integration/reusable-component-admission-audit/v0.1/assessment.json").read_text(encoding="utf-8"))
    threshold = old_assessment["admission_threshold"]
    if threshold != {
        "minimum_independent_consumer_families": 2,
        "requires_no_adequate_existing_reusable_interface": True,
        "stable_core_promotion_implied": False,
        "interface_registry_promotion_implied": False,
    }:
        fail("historical reusable admission threshold drift")

    proof_module = load_module(
        "two_domain_proof_for_admission_audit",
        REPO_ROOT / "tooling/observation-set-calculus-two-domain-proof/v0.1/prove.py",
    )
    proof = proof_module.build_proof()
    direct = proof["direct_reuse"]
    if direct["independent_adapter_count"] != 2:
        fail("two-domain proof no longer establishes two adapters")
    if direct["direct_shared_implementation_reuse_proven"] is not True:
        fail("direct shared implementation reuse not proven")
    if not all(
        direct[key] is True
        for key in (
            "same_resolved_profile_path", "same_profile_bytes",
            "same_set_receipt_schema", "both_invoked_candidate_set_evaluator"
        )
    ):
        fail("shared set runtime proof incomplete")

    c2pa = proof["adapters"]["c2pa"]
    public_review = proof["adapters"]["public_review"]
    if not (c2pa["set_reuse"] and c2pa["transition_reuse"] and c2pa["chain_reuse"]):
        fail("C2PA candidate API coverage drift")
    if public_review["set_reuse"] is not True:
        fail("Public Review no longer directly reuses set API")
    if public_review["transition_reuse"] or public_review["chain_reuse"]:
        fail("Public Review transition/chain reuse was fabricated or unexpectedly widened")

    registry = json.loads((REPO_ROOT / "protocols/interface-registry/v0.2/interface-registry-delta.json").read_text(encoding="utf-8"))
    if registry["release_registry_equivalent"] is not False:
        fail("interface registry became release registry equivalent")
    if any(entry["status"] != "experimental" for entry in registry["additions"]):
        fail("v0.2 registry experimental status drift")
    if "stable_core_membership" not in registry["non_claims"]:
        fail("registry stable-core non-claim missing")

    candidate_text = (REPO_ROOT / "protocols/integration/observation-set-calculus-candidate/v0.1/profile.py").read_text(encoding="utf-8")
    for marker in ("scope_binding_sha256", "semantic_fingerprint_sha256", "source_binding_sha256", "def evaluate_set"):
        if marker not in candidate_text:
            fail(f"candidate set-contract marker missing: {marker}")

    substrate_markers = {
        "protocols/integration/ambient-observability-non-identification/v0.1/README.md": "Observation != Identification",
        "protocols/integration/circumstantial-provenance/v0.1/README.md": "Evidence Count != Evidence Independence",
        "protocols/integration/event-hash-minimalism/v0.1/README.md": "Event Hash != Event Payload",
    }
    for path, marker in substrate_markers.items():
        text = (REPO_ROOT / path).read_text(encoding="utf-8")
        if marker not in text:
            fail(f"existing reusable substrate semantic marker drift: {path}")

    apis = {item["id"]: item for item in assessment["api_assessments"]}
    if set(apis) != {"ObservationSet", "ObservationSetTransition", "LocalObservationSetChain"}:
        fail("API assessment set drift")

    obs = apis["ObservationSet"]
    if obs["decision"] != "ELIGIBLE_EXPERIMENTAL_INTERFACE_ADMISSION":
        fail("ObservationSet admission decision drift")
    if obs["independent_direct_consumer_families"] != 2:
        fail("ObservationSet consumer count drift")
    if obs.get("adequate_existing_reusable_interface") is not False:
        fail("ObservationSet existing-interface assessment drift")
    if obs["registry_scope_if_later_admitted"] != "SET_ONLY":
        fail("ObservationSet registry scope widened")
    if obs["stable_core_admission"] != "NO_CORE_ADMISSION":
        fail("ObservationSet Stable Core escalation")

    for api_id in ("ObservationSetTransition", "LocalObservationSetChain"):
        item = apis[api_id]
        if item["decision"] != "DEFER_SECOND_DOMAIN_DIRECT_REUSE":
            fail(f"{api_id} premature admission")
        if item["independent_direct_consumer_families"] != 1:
            fail(f"{api_id} fabricated second consumer")
        if item["stable_core_admission"] != "NO_CORE_ADMISSION":
            fail(f"{api_id} Stable Core escalation")

    package = assessment["package_assessment"]
    if package["decision"] != "DEFER_SPLIT_REQUIRED":
        fail("monolithic package decision drift")
    if package["monolithic_registry_admission_eligible"] is not False:
        fail("monolithic candidate was promoted")
    if package["set_only_registry_admission_eligible"] is not True:
        fail("set-only eligibility lost")

    if assessment["overall_result"] != "PARTIAL_ADMISSION_ELIGIBLE_SET_ONLY_NO_CORE_ADMISSION":
        fail("overall result drift")
    if assessment["next_safe_action"] != "MATERIALIZE_SET_ONLY_EXPERIMENTAL_INTERFACE_REGISTRY_DELTA":
        fail("next safe action drift")
    if assessment["human_or_successor_boundary"] != "REGISTRY_MUTATION_REQUIRES_SEPARATE_SUCCESSOR":
        fail("registry mutation boundary drift")
    if any(assessment["non_effects"].values()):
        fail("audit claimed a mutation or external effect")


def main() -> None:
    assessment = json.loads(ASSESSMENT_PATH.read_text(encoding="utf-8"))
    validate(assessment)
    print("OBSERVATION_SET_ADMISSION_AUDIT_V0_2_VALID")


if __name__ == "__main__":
    main()
