#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Callable

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "schemas" / "product-contract" / "v0.1"
SCHEMA_PATH = BASE / "product-contract.schema.json"
TEMPLATE_PATH = BASE / "templates" / "product-contract.template.json"
EXAMPLE_PATH = BASE / "examples" / "local-evidence-review.example.json"

REQUIRED_ASSERTIONS = {
    "Product boundary described for the declared version and frontier",
    "Effects are descriptive and denied by default",
    "Human gates and contestability are explicit",
    "Data handling is purpose-limited",
}
REQUIRED_NON_EFFECTS = {
    "Product Contract != Product Runtime",
    "Product Contract != ActionPermit",
    "Described Effect != Authorized Effect",
    "Dependency Edge != Authority Transfer",
    "Product Success != Stable-Core Requirement",
    "Contract Acceptance != Responsibility Acceptance",
    "Contract Version != Future Version",
    "IP Object Boundary != Registration Outcome",
}


class ProductContractError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ProductContractError(message)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def identity_projection(document: dict[str, Any]) -> dict[str, Any]:
    projected = copy.deepcopy(document)
    projected["identity"]["content_hash"] = ""
    return projected


def compute_content_hash(document: dict[str, Any]) -> str:
    encoded = json.dumps(
        identity_projection(document),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def rehash(document: dict[str, Any]) -> None:
    document["identity"]["content_hash"] = compute_content_hash(document)


def unique_ids(items: list[dict[str, Any]], label: str) -> set[str]:
    ids = [item["id"] for item in items]
    require(len(ids) == len(set(ids)), f"duplicate {label} id")
    return set(ids)


def validate_schema(document: dict[str, Any], schema: dict[str, Any]) -> None:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(document), key=lambda error: list(error.absolute_path))
    if errors:
        first = errors[0]
        path = ".".join(str(part) for part in first.absolute_path) or "<root>"
        raise ProductContractError(f"schema violation at {path}: {first.message}")


def validate_semantics(document: dict[str, Any]) -> None:
    require(
        document["identity"]["content_hash"] == compute_content_hash(document),
        "content hash mismatch",
    )
    require(REQUIRED_ASSERTIONS <= set(document["assertions"]), "required assertion missing")
    require(REQUIRED_NON_EFFECTS <= set(document["non_effects"]), "required non-effect missing")

    document_class = document["document_class"]
    frontier = document["frontier"]
    product = document["product"]

    if document_class == "template":
        require(document["contract_status"] == "template", "template status drift")
        require(frontier["binding"] == "template_unbound", "template frontier bound")
        require(frontier["revision"] == "UNBOUND_TEMPLATE", "template revision substitution")
        require(frontier["observed_at"] is None, "template observation fabricated")
        require(product["portfolio_product"] is False, "template promoted into portfolio")
        require(product["id"] == "replace-me-product", "template placeholder product id drift")
    else:
        require(frontier["binding"] == "exact", "non-template frontier is not exact")
        require(bool(re.fullmatch(r"[0-9a-f]{40}", frontier["revision"])), "invalid exact revision")
        serialized = json.dumps(document, ensure_ascii=False)
        require("Replace with" not in serialized, "unresolved template instruction")
        require("replace-me" not in serialized, "unresolved template identifier")

    if document_class == "example":
        require(product["portfolio_product"] is False, "example promoted into portfolio")

    actor_ids = unique_ids(document["actors"], "actor")
    actors = {actor["id"]: actor for actor in document["actors"]}
    human_or_org_ids = {
        actor["id"]
        for actor in document["actors"]
        if actor["kind"] in {"human", "organization"}
    }
    require(any(actor["kind"] == "human" for actor in document["actors"]), "human role missing")
    require(product["product_owner_role_id"] in actor_ids, "product owner role missing")
    for actor in document["actors"]:
        if actor["may_authorize_effects"]:
            require(
                actor["kind"] in {"human", "organization"},
                f"non-human authority source: {actor['id']}",
            )

    data_class_ids = unique_ids(document["data_governance"]["classes"], "data class")
    for policy in document["data_governance"]["classes"]:
        mode = policy["retention_mode"]
        limit = policy["retention_limit"]
        if mode == "none":
            require(limit is None, f"retention limit present for none: {policy['id']}")
        else:
            require(isinstance(limit, str) and bool(limit.strip()), f"retention limit missing: {policy['id']}")

    evidence_ids = unique_ids(document["evidence"]["inputs"], "evidence")
    for evidence in document["evidence"]["inputs"]:
        require(
            set(evidence["data_class_ids"]) <= data_class_ids,
            f"unknown data class in evidence: {evidence['id']}",
        )

    gate_ids = unique_ids(document["human_gates"], "human gate")
    gates = {gate["id"]: gate for gate in document["human_gates"]}
    for gate in document["human_gates"]:
        require(gate["owner_role_id"] in human_or_org_ids, f"human gate owner is not human/org: {gate['id']}")
        require(set(gate["required_evidence_ids"]) <= evidence_ids, f"unknown gate evidence: {gate['id']}")
        require(gate["default_decision"] in gate["decision_values"], f"gate default not in decisions: {gate['id']}")

    analysis_ids = unique_ids(document["effects"]["analysis_effects"], "analysis effect")
    external_ids = unique_ids(document["effects"]["external_effects"], "external effect")
    require(not (analysis_ids & external_ids), "analysis/external effect id collision")
    for effect in document["effects"]["external_effects"]:
        require(effect["human_gate_id"] in gate_ids, f"external effect gate missing: {effect['id']}")
        gate_owner = gates[effect["human_gate_id"]]["owner_role_id"]
        require(actors[gate_owner]["may_authorize_effects"] is True, f"effect gate owner cannot authorize: {effect['id']}")

    states = set(document["failure_uncertainty"]["states"])
    terminal_states = set(document["failure_uncertainty"]["terminal_states"])
    require(terminal_states <= states, "terminal state not declared")
    require(
        document["failure_uncertainty"]["reconciliation_owner_role_id"] in human_or_org_ids,
        "reconciliation owner is not human/org",
    )

    contestability = document["contestability"]
    require(
        contestability["challenge_owner_role_id"] in human_or_org_ids,
        "challenge owner is not human/org",
    )

    dependency_ids = unique_ids(document["dependencies"], "dependency")
    require(product["id"] not in dependency_ids, "product self-dependency")
    for dependency in document["dependencies"]:
        require(dependency["authority_transfer"] is False, f"dependency authority transfer: {dependency['id']}")
        require(dependency["responsibility_transfer"] is False, f"dependency responsibility transfer: {dependency['id']}")
        require(dependency["reverse_core_dependency"] is False, f"reverse Core dependency: {dependency['id']}")

    receipt_types = [receipt["type"] for receipt in document["receipts"]]
    require(len(receipt_types) == len(set(receipt_types)), "duplicate receipt type")
    for receipt in document["receipts"]:
        require(receipt["non_effects"], f"receipt non-effects missing: {receipt['type']}")

    criterion_ids = unique_ids(document["success_criteria"]["criteria"], "success criterion")
    require(bool(criterion_ids), "success criterion missing")
    for criterion in document["success_criteria"]["criteria"]:
        require(
            set(criterion["evidence_source_ids"]) <= evidence_ids,
            f"unknown success evidence: {criterion['id']}",
        )

    included = set(document["ip_boundary"]["included_artifacts"])
    excluded = set(document["ip_boundary"]["excluded_artifacts"])
    require(not (included & excluded), "IP included/excluded artifact collision")

    effect = document["contract_effect"]
    require(effect["execution_authorized"] is False, "contract authorized execution")
    require(effect["action_permit_created"] is False, "contract created ActionPermit")
    require(effect["responsibility_accepted"] is False, "contract accepted responsibility")
    require(effect["stable_core_promotion_authorized"] is False, "contract promoted Stable Core")
    require(effect["legal_outcome_established"] is False, "contract established legal outcome")


def validate_contract(document: dict[str, Any], schema: dict[str, Any]) -> None:
    validate_schema(document, schema)
    validate_semantics(document)


def by_id(items: list[dict[str, Any]], identifier: str) -> dict[str, Any]:
    return next(item for item in items if item["id"] == identifier)


def expect_fail(
    base: dict[str, Any],
    schema: dict[str, Any],
    name: str,
    mutate: Callable[[dict[str, Any]], None],
    *,
    rehash_after: bool = True,
) -> None:
    candidate = copy.deepcopy(base)
    mutate(candidate)
    if rehash_after:
        rehash(candidate)
    try:
        validate_contract(candidate, schema)
    except (ProductContractError, KeyError, TypeError, StopIteration):
        return
    raise AssertionError(f"unsafe mutation unexpectedly passed: {name}")


def run_negative_suite(template: dict[str, Any], schema: dict[str, Any]) -> int:
    mutations: list[tuple[str, Callable[[dict[str, Any]], None], bool]] = [
        ("schema version drift", lambda d: d.__setitem__("schema_version", "9.9"), True),
        ("template becomes product contract while unbound", lambda d: d.__setitem__("document_class", "product_contract"), True),
        ("Core membership", lambda d: d["product"].__setitem__("core_member", True), True),
        ("execution authorization", lambda d: d["contract_effect"].__setitem__("execution_authorized", True), True),
        ("ActionPermit creation", lambda d: d["contract_effect"].__setitem__("action_permit_created", True), True),
        ("responsibility acceptance", lambda d: d["contract_effect"].__setitem__("responsibility_accepted", True), True),
        ("Stable Core promotion", lambda d: d["contract_effect"].__setitem__("stable_core_promotion_authorized", True), True),
        ("legal outcome", lambda d: d["contract_effect"].__setitem__("legal_outcome_established", True), True),
        ("remove human actor", lambda d: d["actors"].__setitem__(slice(None), [a for a in d["actors"] if a["kind"] != "human"]), True),
        ("AI authorizes effects", lambda d: by_id(d["actors"], "product-system").__setitem__("may_authorize_effects", True), True),
        ("evidence provenance disabled", lambda d: by_id(d["evidence"]["inputs"], "primary-evidence").__setitem__("provenance_required", False), True),
        ("missing evidence treated negatively", lambda d: d["evidence"].__setitem__("missing_evidence_is_not_negative_evidence", False), True),
        ("possibility implies intent", lambda d: d["boundary_invariants"].__setitem__("possibility_implies_intent", True), True),
        ("exposure implies intent", lambda d: d["boundary_invariants"].__setitem__("exposure_implies_intent", True), True),
        ("contract implies permit", lambda d: d["boundary_invariants"].__setitem__("contract_implies_action_permit", True), True),
        ("dependency implies authority", lambda d: d["boundary_invariants"].__setitem__("dependency_implies_authority_transfer", True), True),
        ("data minimization disabled", lambda d: d["data_governance"].__setitem__("default_minimization", False), True),
        ("correlation default allowed", lambda d: d["data_governance"].__setitem__("cross_context_correlation_default", "allowed"), True),
        ("identity resolution allowed", lambda d: d["data_governance"].__setitem__("identity_resolution_default", "allowed"), True),
        ("external effect allowed by default", lambda d: by_id(d["effects"]["external_effects"], "example-external-effect").__setitem__("default_admission", "allowed"), True),
        ("external effect without permit", lambda d: by_id(d["effects"]["external_effects"], "example-external-effect").__setitem__("requires_action_permit", False), True),
        ("external effect without human gate", lambda d: by_id(d["effects"]["external_effects"], "example-external-effect").__setitem__("requires_human_gate", False), True),
        ("external effect without revalidation", lambda d: by_id(d["effects"]["external_effects"], "example-external-effect").__setitem__("requires_frontier_revalidation", False), True),
        ("external effect automatic retry", lambda d: by_id(d["effects"]["external_effects"], "example-external-effect").__setitem__("automatic_retry_on_unknown", True), True),
        ("external effect unknown retry policy", lambda d: by_id(d["effects"]["external_effects"], "example-external-effect").__setitem__("unknown_outcome_policy", "retry"), True),
        ("external effect missing gate", lambda d: by_id(d["effects"]["external_effects"], "example-external-effect").__setitem__("human_gate_id", "missing-gate"), True),
        ("gate fail-open", lambda d: by_id(d["human_gates"], "external-effect-gate").__setitem__("fail_closed", False), True),
        ("gate owner missing", lambda d: by_id(d["human_gates"], "external-effect-gate").__setitem__("owner_role_id", "missing-owner"), True),
        ("gate default absent", lambda d: by_id(d["human_gates"], "external-effect-gate").__setitem__("default_decision", "NOT_DECLARED"), True),
        ("unknown is success", lambda d: d["failure_uncertainty"].__setitem__("unknown_is_success", True), True),
        ("automatic retry on unknown", lambda d: d["failure_uncertainty"].__setitem__("automatic_retry_on_unknown", True), True),
        ("observe-before-retry disabled", lambda d: d["failure_uncertainty"].__setitem__("observe_before_retry", False), True),
        ("conflict reconciliation disabled", lambda d: d["failure_uncertainty"].__setitem__("conflict_requires_reconciliation", False), True),
        ("terminal state undeclared", lambda d: d["failure_uncertainty"]["terminal_states"].append("MISSING_STATE"), True),
        ("challenge disabled", lambda d: d["contestability"].__setitem__("challenge_supported", False), True),
        ("correction disabled", lambda d: d["contestability"].__setitem__("correction_supported", False), True),
        ("dependency authority transfer", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("authority_transfer", True), True),
        ("dependency responsibility transfer", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("responsibility_transfer", True), True),
        ("reverse Core dependency", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("reverse_core_dependency", True), True),
        ("success creates authority", lambda d: d["success_criteria"].__setitem__("success_creates_successor_authority", True), True),
        ("failure creates liability", lambda d: d["success_criteria"].__setitem__("failure_creates_liability", True), True),
        ("future versions included", lambda d: d["ip_boundary"].__setitem__("future_versions_included", True), True),
        ("registration claimed", lambda d: d["ip_boundary"].__setitem__("registration_claimed", True), True),
        ("legal outcome claimed", lambda d: d["ip_boundary"].__setitem__("legal_outcome_claimed", True), True),
        ("required non-effect removed", lambda d: d["non_effects"].remove("Product Contract != ActionPermit"), True),
        ("duplicate actor id", lambda d: d["actors"].append(copy.deepcopy(d["actors"][0])), True),
        ("unknown evidence data class", lambda d: by_id(d["evidence"]["inputs"], "primary-evidence")["data_class_ids"].append("unknown-class"), True),
        ("unknown gate evidence", lambda d: by_id(d["human_gates"], "external-effect-gate")["required_evidence_ids"].append("unknown-evidence"), True),
        ("unknown success evidence", lambda d: by_id(d["success_criteria"]["criteria"], "bounded-outcome-evidence")["evidence_source_ids"].append("unknown-evidence"), True),
        ("content hash mismatch", lambda d: d["identity"].__setitem__("content_hash", "sha256:" + "0" * 64), False),
    ]
    for name, mutate, rehash_after in mutations:
        expect_fail(template, schema, name, mutate, rehash_after=rehash_after)
    return len(mutations)


def main() -> None:
    schema = load_json(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)

    template = load_json(TEMPLATE_PATH)
    example = load_json(EXAMPLE_PATH)

    validate_contract(template, schema)
    validate_contract(example, schema)
    rejected = run_negative_suite(template, schema)

    print(
        "UU-AAP Product Contract v0.1 validation: "
        f"PASS (2 positive fixtures; {rejected} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
