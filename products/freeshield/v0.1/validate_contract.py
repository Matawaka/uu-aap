#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = ROOT / "products" / "freeshield" / "v0.1" / "product-contract.json"
SCHEMA_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "product-contract.schema.json"
BASE_VALIDATOR_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "validate_product_contract.py"

EXPECTED_FRONTIER = "c831b643a9b984a274c5093033c28ea4a8a26794"
EXPECTED_OUTCOMES = {
    "ALLOW_ANALYSIS",
    "NARROW_SCOPE",
    "REQUIRE_EVIDENCE",
    "HUMAN_REVIEW",
    "BLOCK_EFFECT",
}
EXPECTED_ANALYSIS_EFFECTS = {
    "candidate-envelope-inspection",
    "contract-authority-consistency-check",
    "evidence-sufficiency-assessment",
    "scope-risk-hypothesis-map",
    "protective-outcome-candidate",
    "protective-reconciliation-candidate",
}
EXPECTED_ACTORS = {
    "human-protection-owner",
    "human-request-owner",
    "freeshield-analysis-system",
}
EXPECTED_EVIDENCE = {
    "request-or-effect-candidate",
    "product-contract-and-authority-evidence",
    "constraints-and-non-effects",
    "frontier-observation",
}
EXPECTED_DATA_CLASSES = {
    "candidate-envelope",
    "contract-authority-bundle",
    "constraint-bundle",
    "frontier-state",
    "protective-assessment",
}
EXPECTED_DEPENDENCIES = {
    "uu-aap-core",
    "ial",
    "ai-transport",
    "kontur",
}
EXPECTED_RECEIPTS = {
    "FreeShieldProtectiveAssessmentReceipt",
    "FreeShieldDispositionReceipt",
}
EXPECTED_CRITERIA = {
    "exact-boundary-coverage",
    "outcome-scope-integrity",
    "contestable-protection",
}
EXPECTED_ANTI_GOALS = {
    "Do not execute, permit, deny or physically block an actuator",
    "Do not treat a risk hypothesis, missing evidence or a protective outcome as proof of harm, intent, guilt, illegality or liability",
    "Do not create global actor or product scores, hidden blacklists, sanctions, account restrictions or permanent prohibitions",
    "Do not infer protected attributes, identity across contexts or psychological vulnerability, and do not inspect undeclared data",
    "Do not own another product, replace its responsible human role or broaden any authority scope",
}
EXPECTED_INCLUDED_ARTIFACTS = {
    "products/freeshield/v0.1/product-contract.json",
    "products/freeshield/v0.1/README.ru.md",
    "products/freeshield/v0.1/validate_contract.py",
    ".github/workflows/freeshield-contract-v0.1-validation.yml",
}
PRODUCT_ASSERTIONS = {
    "FREESHIELD is bounded to local evidence-first protective assessment of one exact candidate",
    "A protective assessment may narrow or request review but cannot broaden authority",
    "BLOCK_EFFECT denotes scoped non-admissibility of one exact effect candidate under the reviewed evidence and frontier",
}
PRODUCT_NON_EFFECTS = {
    "Protective Review != Authority",
    "Protective Assessment != ActionPermit",
    "Risk Hypothesis != Proof of Harm",
    "BLOCK_EFFECT != Global Prohibition",
    "Scope Narrowing != Product Ownership",
    "Human Review Requirement != Negative Judgment",
    "Missing Evidence != Evidence of Safety or Harm",
    "Protective Outcome != Legal Judgment",
    "Protective Assessment != Sanction or Blacklist",
    "Available Evidence != Permission to Inspect",
}


class FreeShieldContractError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise FreeShieldContractError(message)


def load_base_validator() -> Any:
    spec = importlib.util.spec_from_file_location(
        "uu_aap_product_contract_validator",
        BASE_VALIDATOR_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load reusable Product Contract validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ids(items: list[dict[str, Any]]) -> set[str]:
    return {item["id"] for item in items}


def by_id(items: list[dict[str, Any]], identifier: str) -> dict[str, Any]:
    return next(item for item in items if item["id"] == identifier)


def validate_product_semantics(document: dict[str, Any]) -> None:
    require(document["document_class"] == "product_contract", "document class drift")
    require(
        document["contract_id"] == "freeshield-protective-contract",
        "contract id substitution",
    )
    require(document["contract_status"] == "candidate", "contract status overclaim")

    product = document["product"]
    require(product["id"] == "freeshield", "product id substitution")
    require(product["name"] == "FREESHIELD", "product name substitution")
    require(product["version"] == "0.1", "product version drift")
    require(product["kind"] == "protective_plane", "product kind drift")
    require(product["maturity"] == "definition", "product maturity overclaim")
    require(product["portfolio_product"] is True, "portfolio identity lost")
    require(product["core_member"] is False, "product promoted into Core")
    require(
        product["product_owner_role_id"] == "human-protection-owner",
        "product owner substitution",
    )

    frontier = document["frontier"]
    require(frontier["repository"] == "Matawaka/uu-aap", "repository substitution")
    require(frontier["revision"] == EXPECTED_FRONTIER, "frontier substitution")

    require(
        set(document["purpose"]["anti_goals"]) == EXPECTED_ANTI_GOALS,
        "anti-goal boundary drift",
    )
    require(
        PRODUCT_ASSERTIONS <= set(document["assertions"]),
        "product assertion missing",
    )
    require(
        PRODUCT_NON_EFFECTS <= set(document["non_effects"]),
        "product non-effect missing",
    )

    require(ids(document["actors"]) == EXPECTED_ACTORS, "actor inventory drift")
    require(
        all(actor["may_authorize_effects"] is False for actor in document["actors"]),
        "effect authority introduced into no-effect protective contract",
    )

    require(
        ids(document["evidence"]["inputs"]) == EXPECTED_EVIDENCE,
        "evidence inventory drift",
    )
    require(
        all(item["provenance_required"] is True for item in document["evidence"]["inputs"]),
        "evidence provenance weakened",
    )
    require(
        document["evidence"]["missing_evidence_is_not_negative_evidence"] is True,
        "missing evidence converted into negative evidence",
    )
    require(
        document["evidence"]["available_evidence_is_not_permission_to_inspect"] is True,
        "evidence availability converted into inspection authority",
    )

    require(
        ids(document["data_governance"]["classes"]) == EXPECTED_DATA_CLASSES,
        "data-class inventory drift",
    )
    require(
        all(
            policy["class"] not in {"personal", "sensitive_personal"}
            for policy in document["data_governance"]["classes"]
        ),
        "personal or sensitive-personal profile data admitted",
    )
    require(
        document["data_governance"]["cross_context_correlation_default"] == "denied",
        "cross-context correlation enabled",
    )
    require(
        document["data_governance"]["identity_resolution_default"] == "denied",
        "identity resolution enabled",
    )

    effects = document["effects"]
    require(
        ids(effects["analysis_effects"]) == EXPECTED_ANALYSIS_EFFECTS,
        "analysis-effect inventory drift",
    )
    require(effects["external_effects"] == [], "external effect introduced")
    require(
        effects["default_external_effect_admission"] == "denied",
        "external effect default opened",
    )
    outcome_effect = by_id(effects["analysis_effects"], "protective-outcome-candidate")
    for outcome in EXPECTED_OUTCOMES:
        require(outcome in outcome_effect["description"], f"protective outcome removed: {outcome}")

    gates = document["human_gates"]
    require(len(gates) == 1, "human-gate inventory drift")
    gate = gates[0]
    require(gate["id"] == "protective-disposition-gate", "gate id substitution")
    require(gate["owner_role_id"] == "human-protection-owner", "gate owner substitution")
    require(
        set(gate["required_evidence_ids"]) == EXPECTED_EVIDENCE,
        "gate evidence weakened",
    )
    require(
        set(gate["decision_values"])
        == {
            "REJECT_ASSESSMENT",
            "CORRECT_ASSESSMENT",
            "REQUEST_MORE_EVIDENCE",
            "ACCEPT_PROTECTIVE_ASSESSMENT",
        },
        "gate decision vocabulary drift",
    )
    require(
        gate["default_decision"] == "REJECT_ASSESSMENT",
        "gate default is not fail-closed",
    )
    require(gate["fail_closed"] is True, "gate became fail-open")

    failure = document["failure_uncertainty"]
    require(
        set(failure["states"])
        == {
            "UNKNOWN",
            "CONFLICT",
            "INSUFFICIENT_EVIDENCE",
            "SCOPE_UNBOUND",
            "ASSESSMENT_READY",
            "REJECTED",
            "ACCEPTED_PROTECTIVE_ASSESSMENT",
        },
        "failure-state inventory drift",
    )
    require(
        set(failure["terminal_states"])
        == {
            "INSUFFICIENT_EVIDENCE",
            "SCOPE_UNBOUND",
            "REJECTED",
            "ACCEPTED_PROTECTIVE_ASSESSMENT",
        },
        "terminal-state inventory drift",
    )
    require(failure["unknown_is_success"] is False, "UNKNOWN became success")
    require(
        failure["automatic_retry_on_unknown"] is False,
        "automatic retry enabled",
    )
    require(failure["observe_before_retry"] is True, "observe-before-retry lost")
    require(
        failure["conflict_requires_reconciliation"] is True,
        "CONFLICT reconciliation removed",
    )
    require(
        failure["reconciliation_owner_role_id"] == "human-protection-owner",
        "reconciliation owner substitution",
    )

    contestability = document["contestability"]
    require(contestability["challenge_supported"] is True, "challenge disabled")
    require(contestability["correction_supported"] is True, "correction disabled")
    require(
        contestability["appeal_mode"] == "human_review",
        "human appeal boundary removed",
    )
    require(
        contestability["challenge_owner_role_id"] == "human-protection-owner",
        "challenge owner substitution",
    )

    require(ids(document["dependencies"]) == EXPECTED_DEPENDENCIES, "dependency drift")
    dependencies = {
        dependency["id"]: dependency for dependency in document["dependencies"]
    }
    require(dependencies["uu-aap-core"]["required"] is True, "Core dependency lost")
    require(
        all(
            dependencies[dependency_id]["required"] is False
            for dependency_id in {"ial", "ai-transport", "kontur"}
        ),
        "planned dependency treated as current requirement",
    )
    require(
        all(
            dependency["authority_transfer"] is False
            and dependency["responsibility_transfer"] is False
            and dependency["reverse_core_dependency"] is False
            for dependency in document["dependencies"]
        ),
        "dependency transfer or reverse Core dependency introduced",
    )

    require(
        {receipt["type"] for receipt in document["receipts"]} == EXPECTED_RECEIPTS,
        "receipt inventory drift",
    )
    assessment_receipt = next(
        receipt
        for receipt in document["receipts"]
        if receipt["type"] == "FreeShieldProtectiveAssessmentReceipt"
    )
    outcome_assertion = (
        "The protective outcome candidate is one of "
        "ALLOW_ANALYSIS, NARROW_SCOPE, REQUIRE_EVIDENCE, HUMAN_REVIEW or BLOCK_EFFECT"
    )
    require(
        outcome_assertion in assessment_receipt["assertions"],
        "protective outcome vocabulary removed from receipt",
    )
    require(
        "The receipt does not execute, permit or physically block an actuator"
        in assessment_receipt["non_effects"],
        "actuator boundary removed",
    )
    require(
        "BLOCK_EFFECT is not a global prohibition, sanction, blacklist entry or permanent product judgment"
        in assessment_receipt["non_effects"],
        "scoped BLOCK_EFFECT boundary removed",
    )
    require(
        "The receipt does not create, broaden, renew or infer an ActionPermit"
        in assessment_receipt["non_effects"],
        "ActionPermit boundary removed",
    )

    require(
        ids(document["success_criteria"]["criteria"]) == EXPECTED_CRITERIA,
        "success-criterion inventory drift",
    )
    require(
        document["success_criteria"]["success_creates_successor_authority"] is False,
        "success created successor authority",
    )
    require(
        document["success_criteria"]["failure_creates_liability"] is False,
        "failure created liability",
    )

    ip_boundary = document["ip_boundary"]
    require(
        ip_boundary["object_id"] == "freeshield-protective-contract-v0.1",
        "IP object substitution",
    )
    require(
        set(ip_boundary["included_artifacts"]) == EXPECTED_INCLUDED_ARTIFACTS,
        "IP included-artifact boundary drift",
    )
    require(
        ip_boundary["future_versions_included"] is False,
        "future versions included",
    )
    require(ip_boundary["registration_claimed"] is False, "registration claimed")
    require(ip_boundary["legal_outcome_claimed"] is False, "legal outcome claimed")

    contract_effect = document["contract_effect"]
    require(
        contract_effect["execution_authorized"] is False,
        "contract authorized execution",
    )
    require(
        contract_effect["action_permit_created"] is False,
        "contract created ActionPermit",
    )
    require(
        contract_effect["responsibility_accepted"] is False,
        "contract accepted responsibility",
    )
    require(
        contract_effect["stable_core_promotion_authorized"] is False,
        "contract promoted Stable Core",
    )
    require(
        contract_effect["legal_outcome_established"] is False,
        "contract established legal outcome",
    )


def validate_contract(
    document: dict[str, Any],
    schema: dict[str, Any],
    base_validator: Any,
) -> None:
    base_validator.validate_contract(document, schema)
    validate_product_semantics(document)


def expect_fail(
    base_document: dict[str, Any],
    schema: dict[str, Any],
    base_validator: Any,
    name: str,
    mutate: Callable[[dict[str, Any]], None],
    *,
    rehash_after: bool = True,
) -> None:
    candidate = copy.deepcopy(base_document)
    mutate(candidate)
    if rehash_after:
        base_validator.rehash(candidate)
    try:
        validate_contract(candidate, schema, base_validator)
    except (
        base_validator.ProductContractError,
        FreeShieldContractError,
        KeyError,
        TypeError,
        StopIteration,
    ):
        return
    raise AssertionError(f"unsafe mutation unexpectedly passed: {name}")


def external_effect_fixture() -> dict[str, Any]:
    return {
        "id": "direct-block-effect",
        "description": "Attempt to mutate or block an external actuator directly.",
        "allowed_scope": "One target",
        "default_admission": "denied",
        "requires_action_permit": True,
        "requires_human_gate": True,
        "human_gate_id": "protective-disposition-gate",
        "requires_frontier_revalidation": True,
        "unknown_outcome_policy": "observe_before_retry",
        "automatic_retry_on_unknown": False,
        "idempotency_profile": "single-use",
        "actuator_binding": "external-actuator",
    }


def run_negative_suite(
    document: dict[str, Any],
    schema: dict[str, Any],
    base_validator: Any,
) -> int:
    mutations: list[
        tuple[str, Callable[[dict[str, Any]], None], bool]
    ] = [
        ("product id substitution", lambda d: d["product"].__setitem__("id", "shield-authority"), True),
        ("product name substitution", lambda d: d["product"].__setitem__("name", "FREEBAN"), True),
        ("product version drift", lambda d: d["product"].__setitem__("version", "0.2"), True),
        ("product kind drift", lambda d: d["product"].__setitem__("kind", "domain_product"), True),
        ("product maturity promotion", lambda d: d["product"].__setitem__("maturity", "pilot"), True),
        ("portfolio identity removed", lambda d: d["product"].__setitem__("portfolio_product", False), True),
        ("Core membership", lambda d: d["product"].__setitem__("core_member", True), True),
        ("owner role substitution", lambda d: d["product"].__setitem__("product_owner_role_id", "human-request-owner"), True),
        ("contract accepted without separate gate", lambda d: d.__setitem__("contract_status", "accepted"), True),
        ("frontier substitution", lambda d: d["frontier"].__setitem__("revision", "0" * 40), True),
        ("repository substitution", lambda d: d["frontier"].__setitem__("repository", "other/repo"), True),
        ("remove actuator anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not execute, permit, deny or physically block an actuator"), True),
        ("remove proof anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not treat a risk hypothesis, missing evidence or a protective outcome as proof of harm, intent, guilt, illegality or liability"), True),
        ("remove blacklist anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not create global actor or product scores, hidden blacklists, sanctions, account restrictions or permanent prohibitions"), True),
        ("remove profiling anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not infer protected attributes, identity across contexts or psychological vulnerability, and do not inspect undeclared data"), True),
        ("remove ownership anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not own another product, replace its responsible human role or broaden any authority scope"), True),
        ("remove scoped-block assertion", lambda d: d["assertions"].remove("BLOCK_EFFECT denotes scoped non-admissibility of one exact effect candidate under the reviewed evidence and frontier"), True),
        ("remove protective-authority non-effect", lambda d: d["non_effects"].remove("Protective Review != Authority"), True),
        ("remove global-prohibition non-effect", lambda d: d["non_effects"].remove("BLOCK_EFFECT != Global Prohibition"), True),
        ("actor inventory drift", lambda d: d["actors"].pop(), True),
        ("AI authorizes effects", lambda d: by_id(d["actors"], "freeshield-analysis-system").__setitem__("may_authorize_effects", True), True),
        ("protection owner authorizes effects", lambda d: by_id(d["actors"], "human-protection-owner").__setitem__("may_authorize_effects", True), True),
        ("evidence inventory drift", lambda d: d["evidence"]["inputs"].pop(), True),
        ("evidence provenance disabled", lambda d: by_id(d["evidence"]["inputs"], "frontier-observation").__setitem__("provenance_required", False), True),
        ("missing evidence treated negatively", lambda d: d["evidence"].__setitem__("missing_evidence_is_not_negative_evidence", False), True),
        ("inspection authority inferred", lambda d: d["evidence"].__setitem__("available_evidence_is_not_permission_to_inspect", False), True),
        ("personal profile data admitted", lambda d: by_id(d["data_governance"]["classes"], "protective-assessment").__setitem__("class", "personal"), True),
        ("cross-context correlation enabled", lambda d: d["data_governance"].__setitem__("cross_context_correlation_default", "allowed"), True),
        ("identity resolution enabled", lambda d: d["data_governance"].__setitem__("identity_resolution_default", "allowed"), True),
        ("analysis effect inventory drift", lambda d: d["effects"]["analysis_effects"].pop(), True),
        ("direct external block introduced", lambda d: d["effects"]["external_effects"].append(external_effect_fixture()), True),
        ("external effects opened", lambda d: d["effects"].__setitem__("default_external_effect_admission", "allowed"), True),
        ("remove ALLOW_ANALYSIS outcome", lambda d: by_id(d["effects"]["analysis_effects"], "protective-outcome-candidate").__setitem__("description", "Produce NARROW_SCOPE, REQUIRE_EVIDENCE, HUMAN_REVIEW or BLOCK_EFFECT."), True),
        ("remove BLOCK_EFFECT outcome", lambda d: by_id(d["effects"]["analysis_effects"], "protective-outcome-candidate").__setitem__("description", "Produce ALLOW_ANALYSIS, NARROW_SCOPE, REQUIRE_EVIDENCE or HUMAN_REVIEW."), True),
        ("gate id substitution", lambda d: d["human_gates"][0].__setitem__("id", "automatic-block-gate"), True),
        ("gate owner substitution", lambda d: d["human_gates"][0].__setitem__("owner_role_id", "freeshield-analysis-system"), True),
        ("gate evidence weakened", lambda d: d["human_gates"][0]["required_evidence_ids"].remove("frontier-observation"), True),
        ("automatic block decision added", lambda d: d["human_gates"][0]["decision_values"].append("AUTO_BLOCK"), True),
        ("gate default accepts", lambda d: d["human_gates"][0].__setitem__("default_decision", "ACCEPT_PROTECTIVE_ASSESSMENT"), True),
        ("gate fail-open", lambda d: d["human_gates"][0].__setitem__("fail_closed", False), True),
        ("failure state removed", lambda d: d["failure_uncertainty"]["states"].remove("SCOPE_UNBOUND"), True),
        ("unknown is success", lambda d: d["failure_uncertainty"].__setitem__("unknown_is_success", True), True),
        ("automatic retry on unknown", lambda d: d["failure_uncertainty"].__setitem__("automatic_retry_on_unknown", True), True),
        ("observe-before-retry disabled", lambda d: d["failure_uncertainty"].__setitem__("observe_before_retry", False), True),
        ("conflict reconciliation disabled", lambda d: d["failure_uncertainty"].__setitem__("conflict_requires_reconciliation", False), True),
        ("reconciliation owner substitution", lambda d: d["failure_uncertainty"].__setitem__("reconciliation_owner_role_id", "freeshield-analysis-system"), True),
        ("challenge disabled", lambda d: d["contestability"].__setitem__("challenge_supported", False), True),
        ("correction disabled", lambda d: d["contestability"].__setitem__("correction_supported", False), True),
        ("human appeal removed", lambda d: d["contestability"].__setitem__("appeal_mode", "not_applicable"), True),
        ("challenge owner substitution", lambda d: d["contestability"].__setitem__("challenge_owner_role_id", "freeshield-analysis-system"), True),
        ("dependency inventory drift", lambda d: d["dependencies"].pop(), True),
        ("Core dependency optional", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("required", False), True),
        ("IAL dependency made mandatory", lambda d: by_id(d["dependencies"], "ial").__setitem__("required", True), True),
        ("dependency authority transfer", lambda d: by_id(d["dependencies"], "ai-transport").__setitem__("authority_transfer", True), True),
        ("dependency responsibility transfer", lambda d: by_id(d["dependencies"], "kontur").__setitem__("responsibility_transfer", True), True),
        ("reverse Core dependency", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("reverse_core_dependency", True), True),
        ("receipt inventory drift", lambda d: d["receipts"].pop(), True),
        ("outcome receipt vocabulary removed", lambda d: next(r for r in d["receipts"] if r["type"] == "FreeShieldProtectiveAssessmentReceipt")["assertions"].pop(), True),
        ("actuator receipt boundary removed", lambda d: next(r for r in d["receipts"] if r["type"] == "FreeShieldProtectiveAssessmentReceipt")["non_effects"].remove("The receipt does not execute, permit or physically block an actuator"), True),
        ("block scope receipt boundary removed", lambda d: next(r for r in d["receipts"] if r["type"] == "FreeShieldProtectiveAssessmentReceipt")["non_effects"].remove("BLOCK_EFFECT is not a global prohibition, sanction, blacklist entry or permanent product judgment"), True),
        ("permit receipt boundary removed", lambda d: next(r for r in d["receipts"] if r["type"] == "FreeShieldProtectiveAssessmentReceipt")["non_effects"].remove("The receipt does not create, broaden, renew or infer an ActionPermit"), True),
        ("success criterion inventory drift", lambda d: d["success_criteria"]["criteria"].pop(), True),
        ("success creates authority", lambda d: d["success_criteria"].__setitem__("success_creates_successor_authority", True), True),
        ("failure creates liability", lambda d: d["success_criteria"].__setitem__("failure_creates_liability", True), True),
        ("IP object substitution", lambda d: d["ip_boundary"].__setitem__("object_id", "all-protection-ideas"), True),
        ("IP artifact removed", lambda d: d["ip_boundary"]["included_artifacts"].pop(), True),
        ("future versions included", lambda d: d["ip_boundary"].__setitem__("future_versions_included", True), True),
        ("registration claimed", lambda d: d["ip_boundary"].__setitem__("registration_claimed", True), True),
        ("legal outcome claimed", lambda d: d["ip_boundary"].__setitem__("legal_outcome_claimed", True), True),
        ("execution authorized", lambda d: d["contract_effect"].__setitem__("execution_authorized", True), True),
        ("ActionPermit created", lambda d: d["contract_effect"].__setitem__("action_permit_created", True), True),
        ("responsibility accepted", lambda d: d["contract_effect"].__setitem__("responsibility_accepted", True), True),
        ("Stable Core promotion", lambda d: d["contract_effect"].__setitem__("stable_core_promotion_authorized", True), True),
        ("legal outcome established", lambda d: d["contract_effect"].__setitem__("legal_outcome_established", True), True),
        ("content hash mismatch", lambda d: d["identity"].__setitem__("content_hash", "sha256:" + "0" * 64), False),
    ]
    for name, mutate, rehash_after in mutations:
        expect_fail(
            document,
            schema,
            base_validator,
            name,
            mutate,
            rehash_after=rehash_after,
        )
    return len(mutations)


def main() -> None:
    base_validator = load_base_validator()
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    document = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

    validate_contract(document, schema, base_validator)
    rejected = run_negative_suite(document, schema, base_validator)

    print(
        "FREESHIELD Protective Contract v0.1 validation: "
        f"PASS ({rejected} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
