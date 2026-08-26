#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = ROOT / "products" / "marketer-pessimist" / "v0.1" / "product-contract.json"
SCHEMA_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "product-contract.schema.json"
BASE_VALIDATOR_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "validate_product_contract.py"

EXPECTED_FRONTIER = "70c1dfe0e2d4f3e8401050c4e7f56a5e76d11b4d"
EXPECTED_ANALYSIS_EFFECTS = {
    "claim-decomposition",
    "counterargument-map",
    "causal-alternative-map",
    "falsifier-map",
    "missing-evidence-map",
    "bounded-recommendation-candidate",
}
EXPECTED_ACTORS = {
    "human-product-owner",
    "human-requester",
    "marketer-pessimist-analysis-system",
}
EXPECTED_EVIDENCE = {
    "claim-package",
    "supporting-evidence",
    "decision-constraints",
}
EXPECTED_DATA_CLASSES = {
    "claim-content",
    "evidence-bundle",
    "decision-context",
    "derived-stress-test",
}
EXPECTED_DEPENDENCIES = {
    "uu-aap-core",
    "ial",
    "ai-transport",
    "freeshield",
}
EXPECTED_RECEIPTS = {
    "MarketerPessimistStressTestReceipt",
    "MarketerPessimistDispositionReceipt",
}
EXPECTED_CRITERIA = {
    "material-claim-classification",
    "recommendation-falsifiability",
    "no-external-effect",
}
EXPECTED_ANTI_GOALS = {
    "Do not treat pessimism, criticism or a negative scenario as truth",
    "Do not automatically reject, sabotage or suppress a claim, plan, product or person",
    "Do not optimize persuasion, psychological pressure, personal vulnerability targeting or deceptive influence",
    "Do not send campaigns, publish content, access advertising accounts, spend funds, upload audiences or mutate external systems",
}
EXPECTED_INCLUDED_ARTIFACTS = {
    "products/marketer-pessimist/v0.1/product-contract.json",
    "products/marketer-pessimist/v0.1/README.ru.md",
    "products/marketer-pessimist/v0.1/validate_contract.py",
    ".github/workflows/marketer-pessimist-contract-v0.1-validation.yml",
}
PRODUCT_ASSERTIONS = {
    "Маркетолог Пессимиста is bounded to local evidence-first claim and strategy stress testing",
    "Pessimism and counterargument generation do not receive privileged truth status",
}
PRODUCT_NON_EFFECTS = {
    "Pessimistic Analysis != Truth",
    "Counterargument != Rejection",
    "Risk Hypothesis != Proof of Harm",
    "Negative Possibility != Negative Intent or Liability",
    "Audience Description != Permission to Profile a Person",
    "Marketing Recommendation != Campaign Authority",
    "Candidate Output != Publication Authority",
    "Available Evidence != Permission to Inspect",
    "Missing Evidence != Negative Evidence",
}


class MarketerPessimistContractError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise MarketerPessimistContractError(message)


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
        document["contract_id"] == "marketer-pessimist-product-contract",
        "contract id substitution",
    )
    require(document["contract_status"] == "candidate", "contract status overclaim")

    product = document["product"]
    require(product["id"] == "marketer-pessimist", "product id substitution")
    require(product["name"] == "Маркетолог Пессимиста", "product name substitution")
    require(product["version"] == "0.1", "product version drift")
    require(product["kind"] == "domain_product", "product kind drift")
    require(product["maturity"] == "definition", "product maturity overclaim")
    require(product["portfolio_product"] is True, "portfolio identity lost")
    require(product["core_member"] is False, "product promoted into Core")
    require(
        product["product_owner_role_id"] == "human-product-owner",
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
        "effect authority introduced into no-effect contract",
    )

    require(
        ids(document["evidence"]["inputs"]) == EXPECTED_EVIDENCE,
        "evidence inventory drift",
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
        "personal targeting data admitted",
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

    gates = document["human_gates"]
    require(len(gates) == 1, "human-gate inventory drift")
    gate = gates[0]
    require(gate["id"] == "analysis-disposition-gate", "gate id substitution")
    require(gate["owner_role_id"] == "human-product-owner", "gate owner substitution")
    require(
        set(gate["required_evidence_ids"]) == EXPECTED_EVIDENCE,
        "gate evidence weakened",
    )
    require(
        set(gate["decision_values"])
        == {"REJECT", "CORRECT", "REQUEST_MORE_EVIDENCE", "ACCEPT_FOR_HUMAN_USE"},
        "gate decision vocabulary drift",
    )
    require(gate["default_decision"] == "REJECT", "gate default is not fail-closed")
    require(gate["fail_closed"] is True, "gate became fail-open")

    failure = document["failure_uncertainty"]
    require(
        set(failure["states"])
        == {
            "UNKNOWN",
            "CONFLICT",
            "INSUFFICIENT_EVIDENCE",
            "CANDIDATE_READY",
            "REJECTED",
            "ACCEPTED_FOR_HUMAN_USE",
        },
        "failure-state inventory drift",
    )
    require(
        set(failure["terminal_states"])
        == {"INSUFFICIENT_EVIDENCE", "REJECTED", "ACCEPTED_FOR_HUMAN_USE"},
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
        failure["reconciliation_owner_role_id"] == "human-product-owner",
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
        contestability["challenge_owner_role_id"] == "human-product-owner",
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
            for dependency_id in {"ial", "ai-transport", "freeshield"}
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
    stress_receipt = next(
        receipt
        for receipt in document["receipts"]
        if receipt["type"] == "MarketerPessimistStressTestReceipt"
    )
    require(
        "The receipt does not certify truth" in stress_receipt["non_effects"],
        "truth-certification boundary removed",
    )
    require(
        "The receipt does not reject the claim or person"
        in stress_receipt["non_effects"],
        "automatic rejection boundary removed",
    )
    require(
        "The receipt does not authorize publication, campaign execution, spending, targeting or account mutation"
        in stress_receipt["non_effects"],
        "external-effect receipt boundary removed",
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
        ip_boundary["object_id"] == "marketer-pessimist-product-contract-v0.1",
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
        MarketerPessimistContractError,
        KeyError,
        TypeError,
        StopIteration,
    ):
        return
    raise AssertionError(f"unsafe mutation unexpectedly passed: {name}")


def run_negative_suite(
    document: dict[str, Any],
    schema: dict[str, Any],
    base_validator: Any,
) -> int:
    mutations: list[
        tuple[str, Callable[[dict[str, Any]], None], bool]
    ] = [
        ("product id substitution", lambda d: d["product"].__setitem__("id", "optimistic-marketer"), True),
        ("product name substitution", lambda d: d["product"].__setitem__("name", "Pessimist Marketer"), True),
        ("product version drift", lambda d: d["product"].__setitem__("version", "0.2"), True),
        ("product maturity promotion", lambda d: d["product"].__setitem__("maturity", "pilot"), True),
        ("portfolio identity removed", lambda d: d["product"].__setitem__("portfolio_product", False), True),
        ("Core membership", lambda d: d["product"].__setitem__("core_member", True), True),
        ("owner role substitution", lambda d: d["product"].__setitem__("product_owner_role_id", "human-requester"), True),
        ("contract accepted without separate gate", lambda d: d.__setitem__("contract_status", "accepted"), True),
        ("frontier substitution", lambda d: d["frontier"].__setitem__("revision", "0" * 40), True),
        ("repository substitution", lambda d: d["frontier"].__setitem__("repository", "other/repo"), True),
        ("remove truth anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not treat pessimism, criticism or a negative scenario as truth"), True),
        ("remove rejection anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not automatically reject, sabotage or suppress a claim, plan, product or person"), True),
        ("remove persuasion anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not optimize persuasion, psychological pressure, personal vulnerability targeting or deceptive influence"), True),
        ("remove no-send anti-goal", lambda d: d["purpose"]["anti_goals"].remove("Do not send campaigns, publish content, access advertising accounts, spend funds, upload audiences or mutate external systems"), True),
        ("remove human owner", lambda d: d["actors"].__setitem__(slice(None), [actor for actor in d["actors"] if actor["id"] != "human-product-owner"]), True),
        ("AI authorizes effects", lambda d: by_id(d["actors"], "marketer-pessimist-analysis-system").__setitem__("may_authorize_effects", True), True),
        ("human owner authorizes effects in no-effect contract", lambda d: by_id(d["actors"], "human-product-owner").__setitem__("may_authorize_effects", True), True),
        ("remove supporting evidence", lambda d: d["evidence"]["inputs"].__setitem__(slice(None), [item for item in d["evidence"]["inputs"] if item["id"] != "supporting-evidence"]), True),
        ("add personal targeting data", lambda d: d["data_governance"]["classes"].append({"id": "personal-audience", "class": "personal", "collection_scope": "Identifiable audience", "minimization_rule": "None", "retention_mode": "bounded", "retention_limit": "1 day", "disclosure_scope": "Analysis system", "correction_supported": True, "deletion_supported": True}), True),
        ("allow cross-context correlation", lambda d: d["data_governance"].__setitem__("cross_context_correlation_default", "allowed"), True),
        ("allow identity resolution", lambda d: d["data_governance"].__setitem__("identity_resolution_default", "allowed"), True),
        ("remove claim decomposition", lambda d: d["effects"]["analysis_effects"].__setitem__(slice(None), [effect for effect in d["effects"]["analysis_effects"] if effect["id"] != "claim-decomposition"]), True),
        ("add persuasion optimization", lambda d: d["effects"]["analysis_effects"].append({"id": "persuasion-optimization", "description": "Optimize influence", "external_effect": False}), True),
        ("add external campaign effect", lambda d: d["effects"]["external_effects"].append({"id": "campaign-send"}), True),
        ("external default allowed", lambda d: d["effects"].__setitem__("default_external_effect_admission", "allowed"), True),
        ("add second gate", lambda d: d["human_gates"].append(copy.deepcopy(d["human_gates"][0])), True),
        ("gate default accept", lambda d: d["human_gates"][0].__setitem__("default_decision", "ACCEPT_FOR_HUMAN_USE"), True),
        ("gate fail-open", lambda d: d["human_gates"][0].__setitem__("fail_closed", False), True),
        ("gate evidence weakened", lambda d: d["human_gates"][0]["required_evidence_ids"].remove("supporting-evidence"), True),
        ("automatic approve vocabulary", lambda d: d["human_gates"][0]["decision_values"].append("AUTO_APPROVE"), True),
        ("UNKNOWN becomes success", lambda d: d["failure_uncertainty"].__setitem__("unknown_is_success", True), True),
        ("automatic retry", lambda d: d["failure_uncertainty"].__setitem__("automatic_retry_on_unknown", True), True),
        ("observe-before-retry disabled", lambda d: d["failure_uncertainty"].__setitem__("observe_before_retry", False), True),
        ("CONFLICT reconciliation disabled", lambda d: d["failure_uncertainty"].__setitem__("conflict_requires_reconciliation", False), True),
        ("candidate becomes terminal success", lambda d: d["failure_uncertainty"]["terminal_states"].append("CANDIDATE_READY"), True),
        ("challenge disabled", lambda d: d["contestability"].__setitem__("challenge_supported", False), True),
        ("human appeal removed", lambda d: d["contestability"].__setitem__("appeal_mode", "not_applicable"), True),
        ("Core dependency optional", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("required", False), True),
        ("FREESHIELD required before materialization", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("required", True), True),
        ("dependency authority transfer", lambda d: by_id(d["dependencies"], "ai-transport").__setitem__("authority_transfer", True), True),
        ("remove stress-test receipt", lambda d: d["receipts"].__setitem__(slice(None), [receipt for receipt in d["receipts"] if receipt["type"] != "MarketerPessimistStressTestReceipt"]), True),
        ("truth-certification receipt boundary removed", lambda d: next(receipt for receipt in d["receipts"] if receipt["type"] == "MarketerPessimistStressTestReceipt")["non_effects"].remove("The receipt does not certify truth"), True),
        ("remove no-external-effect criterion", lambda d: d["success_criteria"]["criteria"].__setitem__(slice(None), [criterion for criterion in d["success_criteria"]["criteria"] if criterion["id"] != "no-external-effect"]), True),
        ("success creates authority", lambda d: d["success_criteria"].__setitem__("success_creates_successor_authority", True), True),
        ("failure creates liability", lambda d: d["success_criteria"].__setitem__("failure_creates_liability", True), True),
        ("future versions included", lambda d: d["ip_boundary"].__setitem__("future_versions_included", True), True),
        ("registration claimed", lambda d: d["ip_boundary"].__setitem__("registration_claimed", True), True),
        ("legal outcome claimed", lambda d: d["ip_boundary"].__setitem__("legal_outcome_claimed", True), True),
        ("remove pessimism truth non-effect", lambda d: d["non_effects"].remove("Pessimistic Analysis != Truth"), True),
        ("remove counterargument rejection non-effect", lambda d: d["non_effects"].remove("Counterargument != Rejection"), True),
        ("remove audience profiling non-effect", lambda d: d["non_effects"].remove("Audience Description != Permission to Profile a Person"), True),
        ("execution authorization", lambda d: d["contract_effect"].__setitem__("execution_authorized", True), True),
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
        "Маркетолог Пессимиста Product Contract v0.1 validation: "
        f"PASS ({rejected} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
