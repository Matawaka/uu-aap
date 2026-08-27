#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = ROOT / "products" / "honest-hiring" / "v0.1" / "product-contract.json"
REUSABLE_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "validate_product_contract.py"
SCHEMA_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "product-contract.schema.json"

ORIGIN_FRONTIER = "18a57f46eac60576ecc7ff9777888cd2b45230a2"
EXPECTED_CONTRACT_HASH = "sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae"

EXPECTED_ACTORS = {
    "human-hiring-owner",
    "human-hiring-reviewer",
    "candidate-participant",
    "human-appeal-reviewer",
    "honest-hiring-analysis-system",
    "freeshield-protective-system",
}
EXPECTED_EVIDENCE = {
    "role-requirements",
    "candidate-evidence-package",
    "candidate-declared-context",
    "review-constraints",
    "freeshield-assessment",
    "candidate-challenge",
}
EXPECTED_DATA_CLASSES = {
    "role-requirement-data",
    "candidate-job-evidence",
    "candidate-declared-context-data",
    "hiring-process-context",
    "derived-job-relevance-map",
    "protective-assessment-data",
    "challenge-record-data",
}
EXPECTED_ANALYSIS_EFFECTS = {
    "role-requirement-normalization",
    "candidate-evidence-lineage",
    "job-relevance-map",
    "uncertainty-missing-evidence-map",
    "bounded-comparison-candidate",
    "freeshield-protective-input",
    "human-review-packet",
    "challenge-correction-candidate",
}
EXPECTED_GATES = {
    "comparison-disposition-gate",
    "challenge-resolution-gate",
}
EXPECTED_STATES = {
    "UNKNOWN",
    "CONFLICT",
    "INSUFFICIENT_JOB_RELEVANT_EVIDENCE",
    "PROHIBITED_FEATURE_RISK",
    "COMPARISON_CANDIDATE_READY",
    "REJECTED_ANALYSIS",
    "ACCEPTED_FOR_HUMAN_REVIEW",
    "CHALLENGE_PENDING",
    "CORRECTED_SUCCESSOR_STATE",
}
EXPECTED_TERMINAL_STATES = {
    "INSUFFICIENT_JOB_RELEVANT_EVIDENCE",
    "PROHIBITED_FEATURE_RISK",
    "REJECTED_ANALYSIS",
    "ACCEPTED_FOR_HUMAN_REVIEW",
    "CORRECTED_SUCCESSOR_STATE",
}
EXPECTED_DEPENDENCIES = {
    "uu-aap-core",
    "ial",
    "ai-transport",
    "freeshield",
    "kontur",
}
EXPECTED_RECEIPTS = {
    "HonestHiringRequirementReceipt",
    "HonestHiringComparisonReceipt",
    "HonestHiringDispositionReceipt",
    "HonestHiringChallengeReceipt",
}
EXPECTED_CRITERIA = {
    "requirement-attribution-coverage",
    "candidate-evidence-lineage-coverage",
    "prohibited-feature-exclusion",
    "no-global-ranking",
    "uncertainty-visibility",
    "contestability-closure",
    "zero-external-effect",
}
EXPECTED_INCLUDED_ARTIFACTS = {
    "products/honest-hiring/v0.1/product-contract.json",
    "products/honest-hiring/v0.1/README.ru.md",
    "products/honest-hiring/v0.1/validate_contract.py",
    ".github/workflows/honest-hiring-contract-v0.1-validation.yml",
}
REQUIRED_PRODUCT_ASSERTIONS = {
    "The product emits only local job-relevance and evidence-lineage candidates",
    "FREESHIELD assessment is an input to human review and not rejection authority",
    "Candidate challenges create reviewable successor states and are not negative signals",
    "A separate human-controlled employment-decision process remains outside this contract",
}
REQUIRED_PRODUCT_NON_EFFECTS = {
    "Hiring Support != Hiring Authority",
    "Candidate Evidence != Candidate Identity or Worth",
    "Missing Evidence != Negative Evidence",
    "Job-Relevant Comparison != Global Person Ranking",
    "Model Score != Employment Decision",
    "Protected Attribute != Job-Relevant Feature",
    "Proxy Correlation != Permission to Infer a Protected Attribute",
    "Interview Observation != Personality, Health or Disability Diagnosis",
    "Human Review != Rubber-Stamping",
    "Disposition != Unappealable Finality",
    "Candidate Challenge != Negative Signal",
    "FREESHIELD Assessment != Automatic Rejection",
}


class HonestHiringContractError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise HonestHiringContractError(message)


def load_reusable():
    spec = importlib.util.spec_from_file_location("uu_aap_product_contract_validator", REUSABLE_PATH)
    require(spec is not None and spec.loader is not None, "cannot load reusable Product Contract validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def index_by(items: list[dict[str, Any]], key: str, label: str) -> dict[str, dict[str, Any]]:
    values = [item[key] for item in items]
    require(len(values) == len(set(values)), f"duplicate {label}")
    return {item[key]: item for item in items}


def validate_honest_hiring(
    document: dict[str, Any],
    schema: dict[str, Any],
    reusable: Any,
    *,
    enforce_identity: bool = True,
) -> None:
    reusable.validate_contract(document, schema)

    require(document["contract_id"] == "honest-hiring-product-contract", "contract id drift")
    require(document["contract_status"] == "candidate", "contract status drift")
    if enforce_identity:
        require(document["identity"]["content_hash"] == EXPECTED_CONTRACT_HASH, "contract identity drift")

    product = document["product"]
    require(product["id"] == "honest-hiring", "product id drift")
    require(product["name"] == "Честный найм", "product name drift")
    require(product["version"] == "0.1", "product version drift")
    require(product["kind"] == "domain_product", "product kind drift")
    require(product["maturity"] == "definition", "product maturity drift")
    require(product["portfolio_product"] is True, "portfolio product flag lost")
    require(product["core_member"] is False, "product promoted into Core")
    require(product["product_owner_role_id"] == "human-hiring-owner", "product owner drift")

    frontier = document["frontier"]
    require(frontier["binding"] == "exact", "frontier is not exact")
    require(frontier["repository"] == "Matawaka/uu-aap", "repository substitution")
    require(frontier["revision"] == ORIGIN_FRONTIER, "origin frontier substitution")
    require(frontier["observed_at"] == "2026-08-26T19:18:31Z", "frontier observation drift")

    purpose = document["purpose"]
    joined_outcomes = " ".join(purpose["user_outcomes"]).lower()
    joined_anti_goals = " ".join(purpose["anti_goals"]).lower()
    require("provenance-preserving" in joined_outcomes, "provenance outcome missing")
    require("global person ranking" in joined_outcomes, "no-global-ranking outcome missing")
    require("candidate correction and challenge" in joined_outcomes, "contestability outcome missing")
    for phrase in (
        "automatically reject",
        "global ranking",
        "protected attributes",
        "personality",
        "social profiles",
        "ats",
    ):
        require(phrase in joined_anti_goals, f"anti-goal missing: {phrase}")

    actors = index_by(document["actors"], "id", "actor id")
    require(set(actors) == EXPECTED_ACTORS, "actor inventory drift")
    require(actors["human-hiring-owner"]["kind"] == "human", "hiring owner is not human")
    require(actors["human-hiring-reviewer"]["kind"] == "human", "hiring reviewer is not human")
    require(actors["candidate-participant"]["kind"] == "human", "candidate role is not human")
    require(actors["human-appeal-reviewer"]["kind"] == "human", "appeal reviewer is not human")
    require(actors["honest-hiring-analysis-system"]["kind"] == "ai_system", "analysis system kind drift")
    require(actors["freeshield-protective-system"]["kind"] == "ai_system", "FREESHIELD system kind drift")
    require(all(actor["may_authorize_effects"] is False for actor in actors.values()), "actor gained effect authority")
    require(
        "challenge as a negative signal" in " ".join(actors["human-appeal-reviewer"]["responsibilities"]).lower(),
        "appeal non-retaliation responsibility missing",
    )

    evidence = index_by(document["evidence"]["inputs"], "id", "evidence id")
    require(set(evidence) == EXPECTED_EVIDENCE, "evidence inventory drift")
    require(evidence["role-requirements"]["source_class"] == "user_supplied", "role source class drift")
    require(evidence["role-requirements"]["absence_handling"] == "fail_closed", "role requirements fail-open")
    require(evidence["candidate-evidence-package"]["source_class"] == "user_supplied", "candidate evidence source drift")
    require(evidence["candidate-evidence-package"]["absence_handling"] == "unknown", "candidate evidence absence overinterpreted")
    require(evidence["candidate-declared-context"]["absence_handling"] == "not_available", "declared context absence drift")
    require(evidence["review-constraints"]["absence_handling"] == "fail_closed", "review constraints fail-open")
    require(evidence["freeshield-assessment"]["source_class"] == "derived", "FREESHIELD assessment source drift")
    require(evidence["freeshield-assessment"]["absence_handling"] == "fail_closed", "protective assessment fail-open")
    require(evidence["candidate-challenge"]["source_class"] == "user_supplied", "challenge source drift")
    require(evidence["candidate-challenge"]["absence_handling"] == "not_available", "challenge absence drift")
    require(all(item["provenance_required"] is True for item in evidence.values()), "evidence provenance disabled")

    boundary_invariants = document["boundary_invariants"]
    require(all(value is False for value in boundary_invariants.values()), "boundary invariant amplification")

    data_classes = index_by(document["data_governance"]["classes"], "id", "data class id")
    require(set(data_classes) == EXPECTED_DATA_CLASSES, "data-class inventory drift")
    require(all(item["class"] != "sensitive_personal" for item in data_classes.values()), "sensitive-personal class admitted")
    require(data_classes["candidate-job-evidence"]["class"] == "personal", "candidate evidence class drift")
    require(data_classes["candidate-declared-context-data"]["class"] == "personal", "candidate context class drift")
    require(data_classes["derived-job-relevance-map"]["class"] == "derived", "derived relevance class drift")
    require(data_classes["protective-assessment-data"]["class"] == "derived", "protective data class drift")
    require(data_classes["challenge-record-data"]["class"] == "personal", "challenge data class drift")
    require(
        data_classes["candidate-job-evidence"]["minimization_rule"]
        == "Exclude protected attributes, unrelated personal history, social-profile data, behavioral biometrics and hidden third-party data",
        "candidate-evidence minimization drift",
    )
    require(
        data_classes["derived-job-relevance-map"]["minimization_rule"]
        == "No global ranking, employability score, protected-attribute proxy, personality or cross-role profile",
        "derived relevance minimization drift",
    )
    require(
        data_classes["challenge-record-data"]["minimization_rule"]
        == "A challenge must not be converted into a negative candidate signal or cross-process profile",
        "challenge minimization drift",
    )
    combined_minimization = " ".join(item["minimization_rule"] for item in data_classes.values()).lower()
    for phrase in (
        "protected attribute",
        "social-profile",
        "global ranking",
        "negative candidate signal",
    ):
        require(phrase in combined_minimization, f"data minimization boundary missing: {phrase}")
    require(document["data_governance"]["cross_context_correlation_default"] == "denied", "cross-context correlation enabled")
    require(document["data_governance"]["identity_resolution_default"] == "denied", "identity resolution enabled")

    contract_effect = document["contract_effect"]
    require(contract_effect["execution_authorized"] is False, "execution authorized")
    require(contract_effect["action_permit_created"] is False, "ActionPermit created")
    require(contract_effect["responsibility_accepted"] is False, "responsibility accepted")
    require(contract_effect["stable_core_promotion_authorized"] is False, "Stable Core promotion authorized")
    require(contract_effect["legal_outcome_established"] is False, "legal outcome established")

    analysis_effects = index_by(document["effects"]["analysis_effects"], "id", "analysis effect id")
    require(set(analysis_effects) == EXPECTED_ANALYSIS_EFFECTS, "analysis effect inventory drift")
    require(document["effects"]["external_effects"] == [], "external effect described or admitted")
    require(document["effects"]["default_external_effect_admission"] == "denied", "external effects fail-open")
    require(all(item["external_effect"] is False for item in analysis_effects.values()), "analysis effect became external")
    effect_text = " ".join(item["description"] for item in analysis_effects.values()).lower()
    require("without producing a global person ranking" in effect_text, "no-ranking effect boundary missing")
    require("does not decide, rank, reject, shortlist, offer or contact" in effect_text, "human-review packet boundary missing")

    gates = index_by(document["human_gates"], "id", "human gate id")
    require(set(gates) == EXPECTED_GATES, "human gate inventory drift")
    comparison_gate = gates["comparison-disposition-gate"]
    require(comparison_gate["owner_role_id"] == "human-hiring-owner", "comparison gate owner drift")
    require(
        set(comparison_gate["required_evidence_ids"])
        == {"role-requirements", "candidate-evidence-package", "review-constraints", "freeshield-assessment"},
        "comparison gate evidence drift",
    )
    require(
        set(comparison_gate["decision_values"])
        == {"REJECT_ANALYSIS", "CORRECT_ANALYSIS", "REQUEST_MORE_JOB_RELEVANT_EVIDENCE", "ACCEPT_FOR_HUMAN_REVIEW"},
        "comparison decision vocabulary drift",
    )
    require(comparison_gate["default_decision"] == "REJECT_ANALYSIS", "comparison gate is not fail-closed by default")
    require(comparison_gate["fail_closed"] is True, "comparison gate fail-open")
    require(comparison_gate["records_receipt_type"] == "HonestHiringDispositionReceipt", "comparison receipt drift")

    challenge_gate = gates["challenge-resolution-gate"]
    require(challenge_gate["owner_role_id"] == "human-appeal-reviewer", "challenge gate owner drift")
    require(
        set(challenge_gate["required_evidence_ids"])
        == {"role-requirements", "candidate-evidence-package", "review-constraints", "candidate-challenge"},
        "challenge gate evidence drift",
    )
    require(
        set(challenge_gate["decision_values"])
        == {"PAUSE_FOR_REVIEW", "REQUEST_MORE_EVIDENCE", "UPHOLD_WITH_REASONS", "CORRECT_SUCCESSOR_STATE"},
        "challenge decision vocabulary drift",
    )
    require(challenge_gate["default_decision"] == "PAUSE_FOR_REVIEW", "challenge gate is not paused by default")
    require(challenge_gate["fail_closed"] is True, "challenge gate fail-open")
    require(challenge_gate["records_receipt_type"] == "HonestHiringChallengeReceipt", "challenge receipt drift")

    forbidden_decisions = {"HIRE", "OFFER", "SHORTLIST", "REJECT_CANDIDATE", "AUTO_REJECT", "AUTO_HIRE"}
    for gate in gates.values():
        require(not (forbidden_decisions & set(gate["decision_values"])), f"employment decision admitted: {gate['id']}")

    failure = document["failure_uncertainty"]
    require(set(failure["states"]) == EXPECTED_STATES, "failure-state inventory drift")
    require(set(failure["terminal_states"]) == EXPECTED_TERMINAL_STATES, "terminal-state inventory drift")
    require(failure["reconciliation_owner_role_id"] == "human-appeal-reviewer", "reconciliation owner drift")
    require(failure["unknown_is_success"] is False, "UNKNOWN became success")
    require(failure["automatic_retry_on_unknown"] is False, "automatic retry admitted")
    require(failure["observe_before_retry"] is True, "observe-before-retry removed")
    require(failure["conflict_requires_reconciliation"] is True, "conflict reconciliation removed")

    contestability = document["contestability"]
    require(contestability["challenge_supported"] is True, "challenge support removed")
    require(contestability["correction_supported"] is True, "correction support removed")
    require(contestability["appeal_mode"] == "human_review", "appeal mode drift")
    require(contestability["challenge_owner_role_id"] == "human-appeal-reviewer", "challenge owner drift")
    require(contestability["decision_receipt_required"] is True, "challenge decision receipt removed")
    require(contestability["original_evidence_preserved"] is True, "predecessor evidence rewrite enabled")
    require(contestability["correction_creates_successor_state"] is True, "successor correction removed")
    challenge_scope = contestability["challenge_input_scope"].lower()
    for phrase in ("role requirements", "evidence lineage", "job relevance", "uncertainty", "protective"):
        require(phrase in challenge_scope, f"challenge scope missing: {phrase}")

    dependencies = index_by(document["dependencies"], "id", "dependency id")
    require(set(dependencies) == EXPECTED_DEPENDENCIES, "dependency inventory drift")
    require(dependencies["uu-aap-core"]["kind"] == "core", "Core dependency kind drift")
    require(dependencies["uu-aap-core"]["required"] is True, "Core dependency lost")
    require(dependencies["ial"]["kind"] == "language" and dependencies["ial"]["required"] is False, "IAL dependency drift")
    require(dependencies["ai-transport"]["kind"] == "transport" and dependencies["ai-transport"]["required"] is False, "transport dependency drift")
    require(dependencies["freeshield"]["kind"] == "protective", "FREESHIELD dependency kind drift")
    require(dependencies["freeshield"]["required"] is True, "FREESHIELD protective review no longer required")
    require(dependencies["freeshield"]["version_range"] == "v0.1-candidate", "FREESHIELD version binding drift")
    require(dependencies["kontur"]["kind"] == "runtime" and dependencies["kontur"]["required"] is False, "KONTUR dependency drift")
    for dependency in dependencies.values():
        require(dependency["authority_transfer"] is False, f"dependency authority transfer: {dependency['id']}")
        require(dependency["responsibility_transfer"] is False, f"dependency responsibility transfer: {dependency['id']}")
        require(dependency["reverse_core_dependency"] is False, f"reverse Core dependency: {dependency['id']}")

    receipts = index_by(document["receipts"], "type", "receipt type")
    require(set(receipts) == EXPECTED_RECEIPTS, "receipt inventory drift")
    require(
        "No global person ranking or automatic disposition is emitted"
        in receipts["HonestHiringComparisonReceipt"]["assertions"],
        "comparison no-ranking assertion missing",
    )
    require(
        "The challenge itself is not treated as a negative candidate signal"
        in receipts["HonestHiringChallengeReceipt"]["assertions"],
        "challenge non-retaliation assertion missing",
    )
    require(
        any("employment offer, rejection, shortlist or final decision" in item
            for item in receipts["HonestHiringDispositionReceipt"]["non_effects"]),
        "disposition employment-decision non-effect missing",
    )

    criteria = index_by(document["success_criteria"]["criteria"], "id", "success criterion id")
    require(set(criteria) == EXPECTED_CRITERIA, "success-criterion inventory drift")
    require(criteria["prohibited-feature-exclusion"]["threshold"] == "Zero prohibited feature uses or inferences in the exact packet", "prohibited-feature threshold drift")
    require(criteria["no-global-ranking"]["threshold"] == "No global numerical or ordinal candidate ranking is emitted", "no-ranking threshold drift")
    require(criteria["zero-external-effect"]["threshold"] == "Zero external effects", "zero-effect threshold drift")
    require(document["success_criteria"]["success_creates_successor_authority"] is False, "success created authority")
    require(document["success_criteria"]["failure_creates_liability"] is False, "failure created liability")

    ip_boundary = document["ip_boundary"]
    require(ip_boundary["object_id"] == "honest-hiring-product-contract-v0.1", "IP object id drift")
    require(set(ip_boundary["included_artifacts"]) == EXPECTED_INCLUDED_ARTIFACTS, "IP included-artifact scope drift")
    excluded_text = " ".join(ip_boundary["excluded_artifacts"]).lower()
    for phrase in ("candidate resumes", "employment decisions", "third-party models", "future product versions"):
        require(phrase in excluded_text, f"IP exclusion missing: {phrase}")
    require(ip_boundary["future_versions_included"] is False, "future versions claimed")
    require(ip_boundary["registration_claimed"] is False, "registration claimed")
    require(ip_boundary["legal_outcome_claimed"] is False, "legal outcome claimed")

    require(REQUIRED_PRODUCT_ASSERTIONS <= set(document["assertions"]), "required product assertion missing")
    require(REQUIRED_PRODUCT_NON_EFFECTS <= set(document["non_effects"]), "required product non-effect missing")

    serialized = json.dumps(document, ensure_ascii=False).lower()
    require("external_effects" in serialized, "effects boundary missing")
    require("candidate challenge != negative signal" in serialized, "challenge non-effect missing")
    require("freeshield assessment != automatic rejection" in serialized, "FREESHIELD non-effect missing")


def by_id(items: list[dict[str, Any]], identifier: str) -> dict[str, Any]:
    return next(item for item in items if item.get("id") == identifier)


def by_type(items: list[dict[str, Any]], type_name: str) -> dict[str, Any]:
    return next(item for item in items if item.get("type") == type_name)


def expect_fail(
    base: dict[str, Any],
    schema: dict[str, Any],
    reusable: Any,
    name: str,
    mutate: Callable[[dict[str, Any]], None],
    *,
    rehash_after: bool = True,
) -> None:
    candidate = copy.deepcopy(base)
    mutate(candidate)
    if rehash_after:
        reusable.rehash(candidate)
    try:
        validate_honest_hiring(candidate, schema, reusable, enforce_identity=False)
    except (HonestHiringContractError, reusable.ProductContractError, KeyError, TypeError, StopIteration, ValueError):
        return
    raise AssertionError(f"unsafe mutation unexpectedly passed: {name}")


def valid_external_effect() -> dict[str, Any]:
    return {
        "id": "ats-mutation",
        "description": "Mutate an external applicant tracking system.",
        "allowed_scope": "One candidate record",
        "default_admission": "denied",
        "requires_action_permit": True,
        "requires_human_gate": True,
        "human_gate_id": "comparison-disposition-gate",
        "requires_frontier_revalidation": True,
        "unknown_outcome_policy": "observe_before_retry",
        "automatic_retry_on_unknown": False,
        "idempotency_profile": "single-use",
        "actuator_binding": "external ATS actuator",
    }


def valid_analysis_effect(identifier: str, description: str) -> dict[str, Any]:
    return {"id": identifier, "description": description, "external_effect": False}


def valid_dependency(identifier: str) -> dict[str, Any]:
    return {
        "id": identifier,
        "kind": "external_service",
        "version_range": "v0.1",
        "relationship": "Unsafe added dependency",
        "required": False,
        "authority_transfer": False,
        "responsibility_transfer": False,
        "reverse_core_dependency": False,
    }


def run_negative_suite(
    contract: dict[str, Any],
    schema: dict[str, Any],
    reusable: Any,
) -> int:
    mutations: list[tuple[str, Callable[[dict[str, Any]], None], bool]] = [
        ("contract id", lambda d: d.__setitem__("contract_id", "other-contract"), True),
        ("contract status", lambda d: d.__setitem__("contract_status", "accepted"), True),
        ("product id", lambda d: d["product"].__setitem__("id", "other-product"), True),
        ("product name", lambda d: d["product"].__setitem__("name", "Opaque Hiring"), True),
        ("product version", lambda d: d["product"].__setitem__("version", "0.2"), True),
        ("product kind", lambda d: d["product"].__setitem__("kind", "infrastructure_product"), True),
        ("product maturity", lambda d: d["product"].__setitem__("maturity", "released"), True),
        ("portfolio flag", lambda d: d["product"].__setitem__("portfolio_product", False), True),
        ("Core membership", lambda d: d["product"].__setitem__("core_member", True), True),
        ("product owner", lambda d: d["product"].__setitem__("product_owner_role_id", "honest-hiring-analysis-system"), True),
        ("frontier repository", lambda d: d["frontier"].__setitem__("repository", "other/repo"), True),
        ("frontier revision", lambda d: d["frontier"].__setitem__("revision", "0" * 40), True),
        ("frontier observation", lambda d: d["frontier"].__setitem__("observed_at", "2026-08-26T19:18:32Z"), True),
        ("remove provenance outcome", lambda d: d["purpose"]["user_outcomes"].pop(0), True),
        ("remove no-ranking outcome", lambda d: d["purpose"]["user_outcomes"].pop(1), True),
        ("remove challenge outcome", lambda d: d["purpose"]["user_outcomes"].pop(2), True),
        ("remove auto-reject anti-goal", lambda d: d["purpose"]["anti_goals"].pop(0), True),
        ("remove global-ranking anti-goal", lambda d: d["purpose"]["anti_goals"].pop(1), True),
        ("remove protected-attribute anti-goal", lambda d: d["purpose"]["anti_goals"].pop(2), True),
        ("remove personality anti-goal", lambda d: d["purpose"]["anti_goals"].pop(3), True),
        ("remove social-profile anti-goal", lambda d: d["purpose"]["anti_goals"].pop(4), True),
        ("remove ATS anti-goal", lambda d: d["purpose"]["anti_goals"].pop(5), True),
        ("remove candidate actor", lambda d: d["actors"].remove(by_id(d["actors"], "candidate-participant")), True),
        ("remove appeal reviewer", lambda d: d["actors"].remove(by_id(d["actors"], "human-appeal-reviewer")), True),
        ("remove FREESHIELD actor", lambda d: d["actors"].remove(by_id(d["actors"], "freeshield-protective-system")), True),
        ("candidate actor becomes AI", lambda d: by_id(d["actors"], "candidate-participant").__setitem__("kind", "ai_system"), True),
        ("analysis system authorizes effects", lambda d: by_id(d["actors"], "honest-hiring-analysis-system").__setitem__("may_authorize_effects", True), True),
        ("hiring owner authorizes effects", lambda d: by_id(d["actors"], "human-hiring-owner").__setitem__("may_authorize_effects", True), True),
        ("appeal non-retaliation responsibility removed", lambda d: by_id(d["actors"], "human-appeal-reviewer")["responsibilities"].pop(1), True),
        ("remove role requirements", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "role-requirements")), True),
        ("remove candidate evidence", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "candidate-evidence-package")), True),
        ("remove FREESHIELD evidence", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "freeshield-assessment")), True),
        ("remove challenge evidence", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "candidate-challenge")), True),
        ("role requirements fail-open", lambda d: by_id(d["evidence"]["inputs"], "role-requirements").__setitem__("absence_handling", "unknown"), True),
        ("candidate absence treated fail-closed", lambda d: by_id(d["evidence"]["inputs"], "candidate-evidence-package").__setitem__("absence_handling", "fail_closed"), True),
        ("declared context absence drift", lambda d: by_id(d["evidence"]["inputs"], "candidate-declared-context").__setitem__("absence_handling", "unknown"), True),
        ("review constraints fail-open", lambda d: by_id(d["evidence"]["inputs"], "review-constraints").__setitem__("absence_handling", "unknown"), True),
        ("FREESHIELD source drift", lambda d: by_id(d["evidence"]["inputs"], "freeshield-assessment").__setitem__("source_class", "system_observed"), True),
        ("FREESHIELD absence fail-open", lambda d: by_id(d["evidence"]["inputs"], "freeshield-assessment").__setitem__("absence_handling", "unknown"), True),
        ("challenge source drift", lambda d: by_id(d["evidence"]["inputs"], "candidate-challenge").__setitem__("source_class", "derived"), True),
        ("challenge absence drift", lambda d: by_id(d["evidence"]["inputs"], "candidate-challenge").__setitem__("absence_handling", "unknown"), True),
        ("evidence provenance disabled", lambda d: by_id(d["evidence"]["inputs"], "candidate-evidence-package").__setitem__("provenance_required", False), True),
        ("add sensitive data class", lambda d: d["data_governance"]["classes"].append({"id": "sensitive-profile", "class": "sensitive_personal", "collection_scope": "Protected attributes", "minimization_rule": "None", "retention_mode": "bounded", "retention_limit": "Forever", "disclosure_scope": "Hiring system", "correction_supported": True, "deletion_supported": True}), True),
        ("candidate evidence class drift", lambda d: by_id(d["data_governance"]["classes"], "candidate-job-evidence").__setitem__("class", "internal"), True),
        ("candidate context class drift", lambda d: by_id(d["data_governance"]["classes"], "candidate-declared-context-data").__setitem__("class", "internal"), True),
        ("derived relevance class drift", lambda d: by_id(d["data_governance"]["classes"], "derived-job-relevance-map").__setitem__("class", "personal"), True),
        ("protective class drift", lambda d: by_id(d["data_governance"]["classes"], "protective-assessment-data").__setitem__("class", "personal"), True),
        ("challenge class drift", lambda d: by_id(d["data_governance"]["classes"], "challenge-record-data").__setitem__("class", "derived"), True),
        ("remove protected minimization", lambda d: by_id(d["data_governance"]["classes"], "candidate-job-evidence").__setitem__("minimization_rule", "Collect all available data"), True),
        ("remove social-profile minimization", lambda d: by_id(d["data_governance"]["classes"], "candidate-job-evidence").__setitem__("minimization_rule", "Collect protected attributes and all social data"), True),
        ("remove global-ranking minimization", lambda d: by_id(d["data_governance"]["classes"], "derived-job-relevance-map").__setitem__("minimization_rule", "Create a global score"), True),
        ("challenge becomes negative signal", lambda d: by_id(d["data_governance"]["classes"], "challenge-record-data").__setitem__("minimization_rule", "Use challenges as a negative candidate signal"), True),
        ("cross-context correlation enabled", lambda d: d["data_governance"].__setitem__("cross_context_correlation_default", "allowed"), True),
        ("identity resolution enabled", lambda d: d["data_governance"].__setitem__("identity_resolution_default", "allowed"), True),
        ("execution authorized", lambda d: d["contract_effect"].__setitem__("execution_authorized", True), True),
        ("ActionPermit created", lambda d: d["contract_effect"].__setitem__("action_permit_created", True), True),
        ("responsibility accepted", lambda d: d["contract_effect"].__setitem__("responsibility_accepted", True), True),
        ("Stable Core promotion", lambda d: d["contract_effect"].__setitem__("stable_core_promotion_authorized", True), True),
        ("legal outcome established", lambda d: d["contract_effect"].__setitem__("legal_outcome_established", True), True),
        ("add external effect", lambda d: d["effects"]["external_effects"].append(valid_external_effect()), True),
        ("remove role normalization", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "role-requirement-normalization")), True),
        ("remove evidence lineage", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "candidate-evidence-lineage")), True),
        ("remove relevance map", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "job-relevance-map")), True),
        ("remove uncertainty map", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "uncertainty-missing-evidence-map")), True),
        ("remove bounded comparison", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "bounded-comparison-candidate")), True),
        ("remove FREESHIELD input", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "freeshield-protective-input")), True),
        ("remove human packet", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "human-review-packet")), True),
        ("remove challenge candidate", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "challenge-correction-candidate")), True),
        ("add global ranking effect", lambda d: d["effects"]["analysis_effects"].append(valid_analysis_effect("global-candidate-ranking", "Create a global candidate ranking")), True),
        ("analysis effect becomes external", lambda d: by_id(d["effects"]["analysis_effects"], "job-relevance-map").__setitem__("external_effect", True), True),
        ("ranking boundary removed from effect", lambda d: by_id(d["effects"]["analysis_effects"], "job-relevance-map").__setitem__("description", "Rank every candidate globally"), True),
        ("human packet decides", lambda d: by_id(d["effects"]["analysis_effects"], "human-review-packet").__setitem__("description", "Automatically reject or hire"), True),
        ("remove comparison gate", lambda d: d["human_gates"].remove(by_id(d["human_gates"], "comparison-disposition-gate")), True),
        ("remove challenge gate", lambda d: d["human_gates"].remove(by_id(d["human_gates"], "challenge-resolution-gate")), True),
        ("comparison gate owner drift", lambda d: by_id(d["human_gates"], "comparison-disposition-gate").__setitem__("owner_role_id", "honest-hiring-analysis-system"), True),
        ("comparison gate loses FREESHIELD", lambda d: by_id(d["human_gates"], "comparison-disposition-gate")["required_evidence_ids"].remove("freeshield-assessment"), True),
        ("comparison gate adds hire", lambda d: by_id(d["human_gates"], "comparison-disposition-gate")["decision_values"].append("HIRE"), True),
        ("comparison gate adds reject candidate", lambda d: by_id(d["human_gates"], "comparison-disposition-gate")["decision_values"].append("REJECT_CANDIDATE"), True),
        ("comparison default accept", lambda d: by_id(d["human_gates"], "comparison-disposition-gate").__setitem__("default_decision", "ACCEPT_FOR_HUMAN_REVIEW"), True),
        ("comparison gate fail-open", lambda d: by_id(d["human_gates"], "comparison-disposition-gate").__setitem__("fail_closed", False), True),
        ("comparison receipt drift", lambda d: by_id(d["human_gates"], "comparison-disposition-gate").__setitem__("records_receipt_type", "EmploymentDecisionReceipt"), True),
        ("challenge gate owner drift", lambda d: by_id(d["human_gates"], "challenge-resolution-gate").__setitem__("owner_role_id", "human-hiring-owner"), True),
        ("challenge gate loses challenge", lambda d: by_id(d["human_gates"], "challenge-resolution-gate")["required_evidence_ids"].remove("candidate-challenge"), True),
        ("challenge gate adds auto reject", lambda d: by_id(d["human_gates"], "challenge-resolution-gate")["decision_values"].append("AUTO_REJECT"), True),
        ("challenge default uphold", lambda d: by_id(d["human_gates"], "challenge-resolution-gate").__setitem__("default_decision", "UPHOLD_WITH_REASONS"), True),
        ("challenge gate fail-open", lambda d: by_id(d["human_gates"], "challenge-resolution-gate").__setitem__("fail_closed", False), True),
        ("challenge receipt drift", lambda d: by_id(d["human_gates"], "challenge-resolution-gate").__setitem__("records_receipt_type", "OpaqueAppealReceipt"), True),
        ("remove UNKNOWN state", lambda d: d["failure_uncertainty"]["states"].remove("UNKNOWN"), True),
        ("remove CONFLICT state", lambda d: d["failure_uncertainty"]["states"].remove("CONFLICT"), True),
        ("state inventory addition", lambda d: d["failure_uncertainty"]["states"].append("AUTO_HIRED"), True),
        ("terminal-state drift", lambda d: d["failure_uncertainty"]["terminal_states"].append("UNKNOWN"), True),
        ("reconciliation owner drift", lambda d: d["failure_uncertainty"].__setitem__("reconciliation_owner_role_id", "honest-hiring-analysis-system"), True),
        ("UNKNOWN becomes success", lambda d: d["failure_uncertainty"].__setitem__("unknown_is_success", True), True),
        ("automatic retry", lambda d: d["failure_uncertainty"].__setitem__("automatic_retry_on_unknown", True), True),
        ("observe-before-retry removed", lambda d: d["failure_uncertainty"].__setitem__("observe_before_retry", False), True),
        ("conflict reconciliation removed", lambda d: d["failure_uncertainty"].__setitem__("conflict_requires_reconciliation", False), True),
        ("challenge support removed", lambda d: d["contestability"].__setitem__("challenge_supported", False), True),
        ("correction support removed", lambda d: d["contestability"].__setitem__("correction_supported", False), True),
        ("appeal mode removed", lambda d: d["contestability"].__setitem__("appeal_mode", "not_applicable"), True),
        ("challenge owner drift", lambda d: d["contestability"].__setitem__("challenge_owner_role_id", "human-hiring-owner"), True),
        ("decision receipt removed", lambda d: d["contestability"].__setitem__("decision_receipt_required", False), True),
        ("predecessor rewrite enabled", lambda d: d["contestability"].__setitem__("original_evidence_preserved", False), True),
        ("successor correction removed", lambda d: d["contestability"].__setitem__("correction_creates_successor_state", False), True),
        ("challenge scope narrowed", lambda d: d["contestability"].__setitem__("challenge_input_scope", "Only formatting"), True),
        ("remove Core dependency", lambda d: d["dependencies"].remove(by_id(d["dependencies"], "uu-aap-core")), True),
        ("Core no longer required", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("required", False), True),
        ("IAL required drift", lambda d: by_id(d["dependencies"], "ial").__setitem__("required", True), True),
        ("transport required drift", lambda d: by_id(d["dependencies"], "ai-transport").__setitem__("required", True), True),
        ("remove FREESHIELD dependency", lambda d: d["dependencies"].remove(by_id(d["dependencies"], "freeshield")), True),
        ("FREESHIELD no longer required", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("required", False), True),
        ("FREESHIELD kind drift", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("kind", "runtime"), True),
        ("FREESHIELD version drift", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("version_range", "latest"), True),
        ("KONTUR required drift", lambda d: by_id(d["dependencies"], "kontur").__setitem__("required", True), True),
        ("dependency authority transfer", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("authority_transfer", True), True),
        ("dependency responsibility transfer", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("responsibility_transfer", True), True),
        ("reverse Core dependency", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("reverse_core_dependency", True), True),
        ("add unknown dependency", lambda d: d["dependencies"].append(valid_dependency("opaque-ranking-service")), True),
        ("remove requirement receipt", lambda d: d["receipts"].remove(by_type(d["receipts"], "HonestHiringRequirementReceipt")), True),
        ("remove comparison receipt", lambda d: d["receipts"].remove(by_type(d["receipts"], "HonestHiringComparisonReceipt")), True),
        ("remove disposition receipt", lambda d: d["receipts"].remove(by_type(d["receipts"], "HonestHiringDispositionReceipt")), True),
        ("remove challenge receipt", lambda d: d["receipts"].remove(by_type(d["receipts"], "HonestHiringChallengeReceipt")), True),
        ("comparison ranking assertion removed", lambda d: by_type(d["receipts"], "HonestHiringComparisonReceipt")["assertions"].remove("No global person ranking or automatic disposition is emitted"), True),
        ("challenge non-retaliation assertion removed", lambda d: by_type(d["receipts"], "HonestHiringChallengeReceipt")["assertions"].remove("The challenge itself is not treated as a negative candidate signal"), True),
        ("disposition decision non-effect removed", lambda d: by_type(d["receipts"], "HonestHiringDispositionReceipt")["non_effects"].pop(0), True),
        ("remove requirement criterion", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "requirement-attribution-coverage")), True),
        ("remove lineage criterion", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "candidate-evidence-lineage-coverage")), True),
        ("remove prohibited criterion", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "prohibited-feature-exclusion")), True),
        ("remove no-ranking criterion", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "no-global-ranking")), True),
        ("remove uncertainty criterion", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "uncertainty-visibility")), True),
        ("remove contestability criterion", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "contestability-closure")), True),
        ("remove zero-effect criterion", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "zero-external-effect")), True),
        ("prohibited threshold weakened", lambda d: by_id(d["success_criteria"]["criteria"], "prohibited-feature-exclusion").__setitem__("threshold", "Best effort"), True),
        ("ranking threshold weakened", lambda d: by_id(d["success_criteria"]["criteria"], "no-global-ranking").__setitem__("threshold", "A hidden score is acceptable"), True),
        ("zero-effect threshold weakened", lambda d: by_id(d["success_criteria"]["criteria"], "zero-external-effect").__setitem__("threshold", "One external effect"), True),
        ("success creates authority", lambda d: d["success_criteria"].__setitem__("success_creates_successor_authority", True), True),
        ("failure creates liability", lambda d: d["success_criteria"].__setitem__("failure_creates_liability", True), True),
        ("IP object id drift", lambda d: d["ip_boundary"].__setitem__("object_id", "all-hiring-intelligence"), True),
        ("IP included artifacts drift", lambda d: d["ip_boundary"]["included_artifacts"].append("candidate-resumes"), True),
        ("IP exclusion removed", lambda d: d["ip_boundary"]["excluded_artifacts"].pop(0), True),
        ("future versions included", lambda d: d["ip_boundary"].__setitem__("future_versions_included", True), True),
        ("registration claimed", lambda d: d["ip_boundary"].__setitem__("registration_claimed", True), True),
        ("legal outcome claimed", lambda d: d["ip_boundary"].__setitem__("legal_outcome_claimed", True), True),
        ("remove local-only assertion", lambda d: d["assertions"].remove("The product emits only local job-relevance and evidence-lineage candidates"), True),
        ("remove FREESHIELD assertion", lambda d: d["assertions"].remove("FREESHIELD assessment is an input to human review and not rejection authority"), True),
        ("remove challenge assertion", lambda d: d["assertions"].remove("Candidate challenges create reviewable successor states and are not negative signals"), True),
        ("remove employment-boundary assertion", lambda d: d["assertions"].remove("A separate human-controlled employment-decision process remains outside this contract"), True),
        ("remove hiring-authority non-effect", lambda d: d["non_effects"].remove("Hiring Support != Hiring Authority"), True),
        ("remove identity-worth non-effect", lambda d: d["non_effects"].remove("Candidate Evidence != Candidate Identity or Worth"), True),
        ("remove missing-evidence non-effect", lambda d: d["non_effects"].remove("Missing Evidence != Negative Evidence"), True),
        ("remove global-ranking non-effect", lambda d: d["non_effects"].remove("Job-Relevant Comparison != Global Person Ranking"), True),
        ("remove score-decision non-effect", lambda d: d["non_effects"].remove("Model Score != Employment Decision"), True),
        ("remove protected-attribute non-effect", lambda d: d["non_effects"].remove("Protected Attribute != Job-Relevant Feature"), True),
        ("remove proxy non-effect", lambda d: d["non_effects"].remove("Proxy Correlation != Permission to Infer a Protected Attribute"), True),
        ("remove diagnosis non-effect", lambda d: d["non_effects"].remove("Interview Observation != Personality, Health or Disability Diagnosis"), True),
        ("remove human-review non-effect", lambda d: d["non_effects"].remove("Human Review != Rubber-Stamping"), True),
        ("remove finality non-effect", lambda d: d["non_effects"].remove("Disposition != Unappealable Finality"), True),
        ("remove challenge non-effect", lambda d: d["non_effects"].remove("Candidate Challenge != Negative Signal"), True),
        ("remove FREESHIELD rejection non-effect", lambda d: d["non_effects"].remove("FREESHIELD Assessment != Automatic Rejection"), True),
        ("possibility implies intent", lambda d: d["boundary_invariants"].__setitem__("possibility_implies_intent", True), True),
        ("stored relation permits correlation", lambda d: d["boundary_invariants"].__setitem__("stored_relation_implies_permitted_correlation", True), True),
        ("available evidence active knowledge", lambda d: d["boundary_invariants"].__setitem__("available_evidence_implies_active_knowledge", True), True),
        ("content hash mismatch", lambda d: d["identity"].__setitem__("content_hash", "sha256:" + "0" * 64), False),
    ]

    for name, mutate, rehash_after in mutations:
        expect_fail(contract, schema, reusable, name, mutate, rehash_after=rehash_after)
    return len(mutations)


def main() -> None:
    reusable = load_reusable()
    schema = reusable.load_json(SCHEMA_PATH)
    contract = reusable.load_json(CONTRACT_PATH)

    validate_honest_hiring(contract, schema, reusable)
    rejected = run_negative_suite(contract, schema, reusable)

    print(
        "Честный найм Product Contract v0.1 validation: "
        f"PASS ({rejected} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
