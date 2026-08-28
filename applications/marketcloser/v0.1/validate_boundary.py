#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
MANIFEST_PATH = HERE / "application-boundary.json"
SCHEMA_PATH = HERE / "application-boundary.schema.json"
FIXTURE_PATH = HERE / "examples" / "synthetic-boundary-case.json"
MARKETER_CONTRACT_PATH = ROOT / "products" / "marketer-pessimist" / "v0.1" / "product-contract.json"

ORIGIN_REVISION = "9d30ec25b64430235389526267c742ea37d36dba"
ORIGIN_TREE = "ce7daa841e56ace21e05a982e0ca069113e56746"
MARKETER_CONTRACT_HASH = "sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6"
EXPECTED_HASH = "sha256:b0c04caeb52dfca7258303ad8540b6ac119a4addf3078a9c795ff06b3a071289"

EXPECTED_STATES = [
    "REVIEW_OBSERVED",
    "EVIDENCE_RECORDED",
    "MINIMIZATION_REQUIRED",
    "ANALYSIS_CANDIDATE_READY",
    "RESPONSE_CANDIDATE_READY",
    "HUMAN_APPROVAL_REQUIRED",
    "APPROVED_FOR_COPY_EXPORT",
    "COPIED_PUBLICATION_UNVERIFIED",
    "PUBLICATION_OBSERVED",
    "OUTCOME_EVIDENCE_RECORDED",
]

EXPECTED_NON_EFFECTS = {
    "MarketCloser Application != Marketer Pessimist Core",
    "Public Review != Verified Fact",
    "Merchant Explanation != Verified Fact",
    "Business Pressure != Epistemic Weight",
    "Urgency != Permission to Manipulate",
    "Public Content != Non-Personal Data",
    "Heuristic Redaction != Privacy Guarantee",
    "Minimized Claim != Raw Review Identity",
    "Evidence Reference != Independently Verified Evidence",
    "Response Candidate != Approved Response",
    "Approved Response != Published Response",
    "Copied Response != Published Response",
    "Publication Observation != Publication Authority",
    "Deployment URL != Source Provenance Without Binding",
    "Audit Export != Full Case Export",
    "Audit Digest != Independent Attestation Without Declared Canonicalization",
}

CASE_TOP_KEYS = {
    "protocol", "version", "artifact_type", "synthetic", "case_id", "source", "privacy",
    "claim", "evidence", "pressure_context", "marketer_boundary", "response_lifecycle", "controls",
}
SOURCE_KEYS = {"mode", "platform", "public_review_observed", "raw_review_may_contain_personal_data"}
PRIVACY_KEYS = {
    "raw_review_kept_application_side", "human_minimization_reviewed", "minimized_personal_data_present",
    "minimized_sensitive_personal_data_present", "raw_identity_crossed_marketer_boundary",
}
CLAIM_KEYS = {"customer_claim_epistemic_status", "merchant_explanation_epistemic_status", "minimized_claim_text"}
EVIDENCE_KEYS = {"evidence_ref", "epistemic_status", "finding", "independently_verified"}
PRESSURE_KEYS = {
    "platform_dependency_percent", "reserve_weeks", "data_age_days", "triage_only",
    "epistemic_weight", "truth_override", "privacy_override",
}
MARKETER_BOUNDARY_KEYS = {
    "minimized_representation_ready", "raw_review_transferred", "authority_transferred", "responsibility_transferred",
}
RESPONSE_KEYS = {
    "response_candidate_created", "human_approved_for_copy_export", "copied", "external_publication_authorized",
    "publication_observed", "published_claimed", "state",
}
CASE_CONTROL_KEYS = {
    "network_access_available", "platform_mutation_available", "external_publication_available",
    "identity_resolution_available", "action_permit_created", "pilot_permit_created",
    "execution_admitted", "external_effect_performed",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str):
    if not condition:
        raise ValueError(message)


def exact_keys(value: dict, expected: set[str], label: str):
    require(isinstance(value, dict), f"{label} must be an object")
    actual = set(value)
    require(actual == expected, f"{label} key mismatch: missing={sorted(expected-actual)} extra={sorted(actual-expected)}")


def canonical_payload(value: dict) -> bytes:
    working = copy.deepcopy(value)
    working.pop("content_hash", None)
    return json.dumps(
        working,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def content_hash(value: dict) -> str:
    return "sha256:" + hashlib.sha256(canonical_payload(value)).hexdigest()


def validate_manifest(manifest: dict, schema: dict, marketer_contract: dict):
    Draft202012Validator(schema).validate(manifest)

    require(manifest["origin_frontier"]["revision"] == ORIGIN_REVISION, "origin revision mismatch")
    require(manifest["origin_frontier"]["tree"] == ORIGIN_TREE, "origin tree mismatch")

    dep = manifest["dependency"]
    require(dep["product_contract_hash"] == MARKETER_CONTRACT_HASH, "dependency hash mismatch")
    require(marketer_contract["product"]["id"] == "marketer-pessimist", "dependency product mismatch")
    require(marketer_contract["product"]["version"] == "0.1", "dependency version mismatch")
    require(marketer_contract["identity"]["content_hash"] == MARKETER_CONTRACT_HASH, "canonical Product Contract hash drift")
    require(dep["authority_transfer"] is False, "dependency cannot transfer authority")
    require(dep["responsibility_transfer"] is False, "dependency cannot transfer responsibility")
    require(dep["raw_review_transfer"] is False, "raw reviews cannot transfer into analytical core")
    require(dep["reverse_core_dependency"] is False, "application cannot become reverse core dependency")

    boundaries = manifest["data_boundaries"]
    raw = boundaries["raw_review_content"]
    require(raw["may_contain_personal_data"] is True, "raw public review must be treated as potentially personal")
    require(raw["application_side_only"] is True, "raw review must remain application-side")
    require(raw["allowed_to_cross_marketer_boundary"] is False, "raw review cannot cross Marketer boundary")

    minimized = boundaries["minimized_claim_evidence"]
    require(minimized["personal_data_allowed"] is False, "minimized Marketer input cannot admit personal data")
    require(minimized["sensitive_personal_data_allowed"] is False, "minimized Marketer input cannot admit sensitive personal data")
    require(minimized["human_minimization_review_required"] is True, "human minimization review required")
    require(minimized["allowed_to_cross_marketer_boundary"] is True, "only minimized representation may cross Marketer boundary")

    evidence = boundaries["evidence_reference"]
    require(evidence["independent_verification_default"] is False, "evidence references cannot default to independently verified")
    require(evidence["unavailable_means_false"] is False, "unavailable evidence cannot mean claim false")
    require(evidence["missing_means_false"] is False, "missing evidence cannot mean claim false")

    pressure = boundaries["business_pressure_context"]
    require(pressure["triage_use_allowed"] is True, "pressure context may remain available for triage")
    require(pressure["epistemic_weight_allowed"] is False, "business pressure cannot change epistemic weight")
    require(pressure["truth_override_allowed"] is False, "business pressure cannot override truth status")
    require(pressure["privacy_override_allowed"] is False, "business pressure cannot override privacy")

    audit = boundaries["audit_metadata"]
    require(audit["full_case_content_implied"] is False, "audit metadata cannot imply raw case content")
    require(audit["publication_receipt_implied"] is False, "audit metadata cannot imply publication")
    require(audit["truth_certification_implied"] is False, "audit metadata cannot certify truth")

    require(manifest["workflow_states"] == EXPECTED_STATES, "workflow state order/set mismatch")

    distinctions = manifest["state_distinctions"]
    for key, value in distinctions.items():
        require(value is False, f"state distinction must remain false: {key}")

    deployment = manifest["deployment_boundary"]
    require(deployment["operator_supplied_url_is_source_provenance"] is False, "operator URL cannot equal source provenance")
    require(deployment["network_fetch_available"] is False, "network fetch unavailable in boundary contract")
    require(deployment["deployment_binding_receipt_available"] is False, "deployment binding is a successor artifact")

    controls = manifest["controls"]
    require(controls["read_only_contract"] is True, "boundary contract must be read-only")
    for key, value in controls.items():
        if key == "read_only_contract":
            continue
        require(value is False, f"effect capability must remain false: {key}")

    canon = manifest["canonicalization"]
    require(canon == {
        "id": "MARKETCLOSER-SORTED-JSON-v0.1",
        "encoding": "UTF-8",
        "object_keys": "lexicographic",
        "array_order": "preserved",
        "insignificant_whitespace": "removed",
        "content_hash_field_omitted": True,
    }, "canonicalization profile mismatch")

    require(set(manifest["non_effects"]) == EXPECTED_NON_EFFECTS, "non-effect set mismatch")
    require(manifest["next_safe_action"] == "DEPLOYMENT_BOUND_OBSERVATION_RECEIPT_REQUIRED", "next safe action mismatch")
    require(manifest["content_hash"] == EXPECTED_HASH, "manifest expected hash mismatch")
    require(content_hash(manifest) == EXPECTED_HASH, "manifest hash is not reproducible")


def validate_case(case: dict):
    exact_keys(case, CASE_TOP_KEYS, "case")
    require(case["protocol"] == "MARKETCLOSER-APPLICATION-BOUNDARY", "case protocol mismatch")
    require(case["version"] == "0.1", "case version mismatch")
    require(case["artifact_type"] == "MarketCloserSyntheticBoundaryCase", "case type mismatch")
    require(case["synthetic"] is True, "repository conformance case must remain synthetic")
    require(case["case_id"].startswith("urn:uu-aap:marketcloser:synthetic-boundary-case:"), "case id mismatch")

    exact_keys(case["source"], SOURCE_KEYS, "case.source")
    require(case["source"]["mode"] == "synthetic_conformance", "only synthetic fixture may be committed")
    require(case["source"]["platform"].startswith("fictional-"), "fixture platform must be explicitly fictional")
    require(case["source"]["public_review_observed"] is True, "synthetic review observation required")
    require(case["source"]["raw_review_may_contain_personal_data"] is True, "raw review risk must be represented")

    exact_keys(case["privacy"], PRIVACY_KEYS, "case.privacy")
    privacy = case["privacy"]
    require(privacy["raw_review_kept_application_side"] is True, "raw review must remain application-side")
    require(privacy["human_minimization_reviewed"] is True, "human minimization review required")
    require(privacy["minimized_personal_data_present"] is False, "minimized input cannot contain personal data")
    require(privacy["minimized_sensitive_personal_data_present"] is False, "minimized input cannot contain sensitive personal data")
    require(privacy["raw_identity_crossed_marketer_boundary"] is False, "raw identity cannot cross Marketer boundary")

    exact_keys(case["claim"], CLAIM_KEYS, "case.claim")
    claim = case["claim"]
    require(claim["customer_claim_epistemic_status"] == "unverified_user_claim", "customer claim cannot default to verified")
    require(claim["merchant_explanation_epistemic_status"] == "unverified_user_claim", "merchant explanation cannot default to verified")
    require(isinstance(claim["minimized_claim_text"], str) and claim["minimized_claim_text"].strip(), "minimized claim required")

    require(isinstance(case["evidence"], list) and case["evidence"], "synthetic evidence vector required")
    for item in case["evidence"]:
        exact_keys(item, EVIDENCE_KEYS, "case.evidence item")
        require(item["epistemic_status"] == "user_asserted_evidence_reference", "evidence reference status mismatch")
        require(item["independently_verified"] is False, "fixture evidence must remain unverified")
        require(item["finding"] in {"available", "unavailable", "conflicting"}, "evidence finding invalid")

    exact_keys(case["pressure_context"], PRESSURE_KEYS, "case.pressure_context")
    pressure = case["pressure_context"]
    require(0 <= pressure["platform_dependency_percent"] <= 100, "platform dependency out of range")
    require(pressure["reserve_weeks"] >= 0 and pressure["data_age_days"] >= 0, "pressure values invalid")
    require(pressure["triage_only"] is True, "pressure context must remain triage-only")
    require(pressure["epistemic_weight"] is False, "pressure context cannot gain epistemic weight")
    require(pressure["truth_override"] is False, "pressure cannot override truth")
    require(pressure["privacy_override"] is False, "pressure cannot override privacy")

    exact_keys(case["marketer_boundary"], MARKETER_BOUNDARY_KEYS, "case.marketer_boundary")
    marketer = case["marketer_boundary"]
    require(marketer["minimized_representation_ready"] is True, "minimized representation must be explicit")
    require(marketer["raw_review_transferred"] is False, "raw review cannot transfer")
    require(marketer["authority_transferred"] is False, "authority cannot transfer")
    require(marketer["responsibility_transferred"] is False, "responsibility cannot transfer")

    exact_keys(case["response_lifecycle"], RESPONSE_KEYS, "case.response_lifecycle")
    response = case["response_lifecycle"]
    require(response["response_candidate_created"] is True, "response candidate required for vector")
    require(response["human_approved_for_copy_export"] is True, "synthetic vector should exercise approval/copy distinction")
    require(response["copied"] is True, "synthetic vector should exercise copied state")
    require(response["external_publication_authorized"] is False, "copy approval cannot authorize publication")
    require(response["publication_observed"] is False, "fixture must preserve unverified publication gap")
    require(response["published_claimed"] is False, "fixture cannot claim publication without observation")
    require(response["state"] == "COPIED_PUBLICATION_UNVERIFIED", "copied/unverified state mismatch")

    exact_keys(case["controls"], CASE_CONTROL_KEYS, "case.controls")
    for key, value in case["controls"].items():
        require(value is False, f"synthetic case effect must remain false: {key}")


def assert_mutation_rejected(manifest, schema, contract, mutator, label):
    candidate = copy.deepcopy(manifest)
    mutator(candidate)
    try:
        validate_manifest(candidate, schema, contract)
    except Exception:
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def assert_case_mutation_rejected(case, mutator, label):
    candidate = copy.deepcopy(case)
    mutator(candidate)
    try:
        validate_case(candidate)
    except Exception:
        return
    raise AssertionError(f"case mutation unexpectedly accepted: {label}")


def main():
    manifest = load_json(MANIFEST_PATH)
    schema = load_json(SCHEMA_PATH)
    fixture = load_json(FIXTURE_PATH)
    marketer_contract = load_json(MARKETER_CONTRACT_PATH)

    validate_manifest(manifest, schema, marketer_contract)
    validate_case(fixture)

    mutations = [
        (lambda x: x["dependency"].__setitem__("authority_transfer", True), "authority transfer"),
        (lambda x: x["dependency"].__setitem__("raw_review_transfer", True), "raw review transfer"),
        (lambda x: x["data_boundaries"]["raw_review_content"].__setitem__("allowed_to_cross_marketer_boundary", True), "raw review crosses core"),
        (lambda x: x["data_boundaries"]["minimized_claim_evidence"].__setitem__("personal_data_allowed", True), "personal data enters core"),
        (lambda x: x["data_boundaries"]["business_pressure_context"].__setitem__("epistemic_weight_allowed", True), "pressure gains epistemic weight"),
        (lambda x: x["data_boundaries"]["evidence_reference"].__setitem__("independent_verification_default", True), "evidence defaults verified"),
        (lambda x: x["state_distinctions"].__setitem__("copied_response_is_published_response", True), "copy equals publish"),
        (lambda x: x["deployment_boundary"].__setitem__("operator_supplied_url_is_source_provenance", True), "URL equals provenance"),
        (lambda x: x["controls"].__setitem__("external_publication_available", True), "publication capability"),
        (lambda x: x.__setitem__("next_safe_action", "PUBLISH_RESPONSE"), "unsafe next action"),
    ]
    for mutator, label in mutations:
        assert_mutation_rejected(manifest, schema, marketer_contract, mutator, label)

    case_mutations = [
        (lambda x: x["privacy"].__setitem__("raw_identity_crossed_marketer_boundary", True), "raw identity crosses core"),
        (lambda x: x["pressure_context"].__setitem__("epistemic_weight", True), "pressure becomes evidence"),
        (lambda x: x["evidence"][0].__setitem__("independently_verified", True), "unverified reference promoted"),
        (lambda x: x["response_lifecycle"].__setitem__("published_claimed", True), "publication claimed without observation"),
        (lambda x: x["response_lifecycle"].__setitem__("external_publication_authorized", True), "copy approval authorizes publication"),
        (lambda x: x["controls"].__setitem__("external_effect_performed", True), "external effect performed"),
    ]
    for mutator, label in case_mutations:
        assert_case_mutation_rejected(fixture, mutator, label)

    print("MarketCloser Application Boundary v0.1 validation: PASS")
    print(f"({len(mutations) + len(case_mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
