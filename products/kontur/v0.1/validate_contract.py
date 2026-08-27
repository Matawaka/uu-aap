#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any, Callable

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "products" / "kontur" / "v0.1"
CONTRACT_PATH = BASE / "product-contract.json"
MANIFEST_PATH = BASE / "family-manifest.json"
MANIFEST_SCHEMA_PATH = BASE / "family-manifest.schema.json"
REUSABLE_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "validate_product_contract.py"
PRODUCT_SCHEMA_PATH = ROOT / "schemas" / "product-contract" / "v0.1" / "product-contract.schema.json"

ORIGIN_FRONTIER = "04078a72415b681bc588d801169fc5d9abee3e9b"
ORIGIN_TREE = "88ee6c1b7417ed3e5758d9b08c2b1252328d23b5"
OBSERVED_AT = "2026-08-27T01:20:49Z"
EXPECTED_CONTRACT_HASH = "sha256:21597d591cc4fbe2974c8ac63d669c79158734336c6c64f8ba6a91602835b1b5"
EXPECTED_MANIFEST_HASH = "sha256:90da81f7c33f44f34410790e9269bf8b05a5ad47db596437b214b8301701a5a1"

MEMBERS = {
    "readiness-aggregator",
    "activation-boundary",
    "responsibility-kernel",
    "responsibility-ledger",
    "live-host-boundary",
    "game-companion",
}
MEMBER_STATUS = {
    "readiness-aggregator": "implemented_experimental",
    "activation-boundary": "implemented_experimental",
    "responsibility-kernel": "implemented_experimental",
    "responsibility-ledger": "implemented_experimental",
    "live-host-boundary": "implemented_experimental",
    "game-companion": "canonical_pilot_evidence",
}
MEMBER_RUNTIME = {
    "readiness-aggregator": "not_activated",
    "activation-boundary": "not_activated",
    "responsibility-kernel": "not_activated",
    "responsibility-ledger": "not_activated",
    "live-host-boundary": "not_activated",
    "game-companion": "not_applicable",
}
PATHS = {
    "readiness-aggregator": {
        "server/kontur/v0.1/READINESS_AGGREGATOR.md",
        "server/kontur/v0.1/readiness-aggregator.js",
        "server/kontur/v0.1/test-readiness-aggregator.js",
        "server/kontur/v0.1/kontur-readiness-aggregation.schema.json",
    },
    "activation-boundary": {
        "server/kontur/v0.1/ACTIVATION_BOUNDARY.md",
        "server/kontur/v0.1/ACTIVATION_PREFLIGHT.md",
        "server/kontur/v0.1/HUMAN_ACTIVATION_REVIEW.md",
        "server/kontur/v0.1/activation-preflight.js",
    },
    "responsibility-kernel": {
        "server/kontur/v0.1/README.md",
        "server/kontur/v0.1/responsibility-kernel.js",
        "server/kontur/v0.1/test-responsibility-kernel.js",
        "server/kontur/v0.1/kontur-responsibility-policy.schema.json",
    },
    "responsibility-ledger": {
        "server/kontur/v0.1/RESPONSIBILITY_LEDGER.md",
        "server/kontur/v0.1/responsibility-ledger.js",
        "server/kontur/v0.1/responsibility-ledger-replica.js",
        "server/kontur/v0.1/test-responsibility-ledger.js",
    },
    "live-host-boundary": {
        "server/kontur/v0.1/LIVE_HOST_ELIGIBILITY.md",
        "server/kontur/v0.1/LIVE_HOST_DESIGNATION.md",
        "server/kontur/v0.1/LIVE_HOST_EXECUTOR_BINDING.md",
        "server/kontur/v0.1/LIVE_HOST_RUNTIME_REOBSERVATION.md",
    },
    "game-companion": {
        "pilots/kontur-game-companion/dependency-contract/README.md",
        "pilots/kontur-game-companion/dependency-contract/game-companion-chain.json",
        "pilots/kontur-game-companion/dependency-contract/validate.py",
    },
}
EDGES = {
    ("readiness-aggregator", "activation-boundary"): "established_evidence_dependency",
    ("live-host-boundary", "activation-boundary"): "established_evidence_dependency",
    ("activation-boundary", "responsibility-kernel"): "established_evidence_dependency",
    ("responsibility-kernel", "responsibility-ledger"): "established_evidence_dependency",
    ("responsibility-kernel", "game-companion"): "planned_interface",
    ("game-companion", "responsibility-ledger"): "planned_interface",
}
ACTORS = {
    "human-kontur-family-owner",
    "human-kontur-activation-reviewer",
    "human-kontur-pilot-reviewer",
    "kontur-family-validation-software",
    "kontur-game-companion-pilot",
}
EVIDENCE = {
    "family-manifest",
    "readiness-evidence",
    "responsibility-evidence",
    "activation-host-evidence",
    "game-companion-evidence",
    "sanitized-field-evidence",
    "family-challenge",
}
DATA_CLASSES = {
    "family-contract-data",
    "readiness-data",
    "responsibility-data",
    "activation-host-data",
    "pilot-evidence-data",
    "field-evidence-data",
    "challenge-data",
}
EFFECTS = {
    "family-manifest-validation",
    "component-interface-review",
    "readiness-inspection",
    "responsibility-lineage-review",
    "activation-host-review",
    "game-companion-chain-review",
    "field-evidence-consolidation",
}
GATES = {"family-consolidation-gate", "activation-referral-gate", "pilot-evidence-gate"}
STATES = {
    "UNKNOWN",
    "CONFLICT",
    "STALE_FRONTIER",
    "INCOMPLETE_FAMILY_EVIDENCE",
    "COMPONENT_DRIFT",
    "ACTIVATION_BOUNDARY_UNSATISFIED",
    "PILOT_EVIDENCE_EXCLUDED",
    "CONSOLIDATION_CANDIDATE_READY",
    "REJECTED_FAMILY_PACKET",
    "REFERRED_TO_SEPARATE_ACTIVATION_REVIEW",
    "CORRECTED_SUCCESSOR_STATE",
}
TERMINAL_STATES = {
    "STALE_FRONTIER",
    "INCOMPLETE_FAMILY_EVIDENCE",
    "COMPONENT_DRIFT",
    "ACTIVATION_BOUNDARY_UNSATISFIED",
    "PILOT_EVIDENCE_EXCLUDED",
    "REJECTED_FAMILY_PACKET",
    "REFERRED_TO_SEPARATE_ACTIVATION_REVIEW",
    "CORRECTED_SUCCESSOR_STATE",
}
DEPENDENCIES = {"uu-aap-core", "ial", "ai-transport", "freeshield"}
RECEIPTS = {
    "KONTURFamilyManifestReceipt",
    "KONTURFamilyConsolidationReceipt",
    "KONTURActivationBoundaryReviewReceipt",
    "KONTURPilotEvidenceReceipt",
    "KONTURFamilyChallengeReceipt",
}
CRITERIA = {
    "family-member-binding-coverage",
    "interface-non-transfer-coverage",
    "readiness-activation-separation",
    "responsibility-lineage-closure",
    "game-companion-chain-closure",
    "field-evidence-minimization",
    "zero-external-effect",
}
INCLUDED = {
    "products/kontur/v0.1/product-contract.json",
    "products/kontur/v0.1/family-manifest.schema.json",
    "products/kontur/v0.1/family-manifest.json",
    "products/kontur/v0.1/README.ru.md",
    "products/kontur/v0.1/validate_contract.py",
    ".github/workflows/kontur-family-contract-v0.1-validation.yml",
}
FAMILY_ASSERTIONS = {
    "The family member inventory and established/planned interfaces are explicit",
    "Readiness, activation, responsibility state, ledger evidence and product-pilot evidence remain distinct",
    "KONTUR Game Companion remains a bounded pilot line rather than a server responsibility holder",
    "All family review effects are local and non-executing",
}
FAMILY_NON_EFFECTS = {
    "KONTUR Product Family Contract != KONTUR Activation",
    "Readiness Aggregation != Kernel Activation",
    "Ready Signal != ActionPermit",
    "Responsibility State != Execution Authority",
    "Family Membership != Shared Data Access",
    "Game Companion Pilot != Server Responsibility Holder",
    "Field Evidence != Production Readiness",
    "Live Host Eligibility != Live Host Designation",
    "Designation != Activation",
    "Activation Review != Activation Execution",
    "Observed Runtime != Permitted Runtime Mutation",
    "Pause or Recovery Evidence != Successor Authority",
    "Product Family != Stable Core",
}


class KONTURFamilyContractError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise KONTURFamilyContractError(message)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_reusable() -> Any:
    spec = importlib.util.spec_from_file_location("product_contract_validator", REUSABLE_PATH)
    require(spec is not None and spec.loader is not None, "cannot load reusable validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def manifest_hash(document: dict[str, Any]) -> str:
    projected = copy.deepcopy(document)
    projected["identity"]["content_hash"] = ""
    encoded = json.dumps(
        projected,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def rehash_manifest(document: dict[str, Any]) -> None:
    document["identity"]["content_hash"] = manifest_hash(document)


def index(items: list[dict[str, Any]], key: str, label: str) -> dict[str, dict[str, Any]]:
    values = [item[key] for item in items]
    require(len(values) == len(set(values)), f"duplicate {label}")
    return {item[key]: item for item in items}


def by_id(items: list[dict[str, Any]], identifier: str) -> dict[str, Any]:
    return next(item for item in items if item.get("id") == identifier)


def by_type(items: list[dict[str, Any]], name: str) -> dict[str, Any]:
    return next(item for item in items if item.get("type") == name)


def validate_manifest(document: dict[str, Any], schema: dict[str, Any]) -> None:
    errors = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(document),
        key=lambda error: list(error.absolute_path),
    )
    if errors:
        first = errors[0]
        path = ".".join(str(part) for part in first.absolute_path) or "<root>"
        raise KONTURFamilyContractError(f"manifest schema violation at {path}: {first.message}")
    require(document["identity"]["content_hash"] == manifest_hash(document), "manifest hash mismatch")


def validate(
    contract: dict[str, Any],
    manifest: dict[str, Any],
    product_schema: dict[str, Any],
    manifest_schema: dict[str, Any],
    reusable: Any,
    *,
    enforce_identity: bool = True,
) -> None:
    reusable.validate_contract(contract, product_schema)
    validate_manifest(manifest, manifest_schema)

    if enforce_identity:
        require(contract["identity"]["content_hash"] == EXPECTED_CONTRACT_HASH, "contract identity drift")
        require(manifest["identity"]["content_hash"] == EXPECTED_MANIFEST_HASH, "manifest identity drift")

    require(contract["contract_id"] == "kontur-product-family-contract", "contract id drift")
    require(contract["contract_status"] == "candidate", "contract status drift")
    product = contract["product"]
    require(product == {
        "id": "kontur-family",
        "name": "KONTUR Product Family",
        "version": "0.1",
        "kind": "product_family",
        "maturity": "pilot",
        "portfolio_product": True,
        "core_member": False,
        "product_owner_role_id": "human-kontur-family-owner",
    }, "product identity or status drift")
    require(contract["frontier"] == {
        "binding": "exact",
        "repository": "Matawaka/uu-aap",
        "revision": ORIGIN_FRONTIER,
        "observed_at": OBSERVED_AT,
    }, "contract frontier drift")

    require(manifest["frontier"] == {
        "repository": "Matawaka/uu-aap",
        "revision": ORIGIN_FRONTIER,
        "tree": ORIGIN_TREE,
        "observed_at": OBSERVED_AT,
    }, "manifest frontier drift")
    require(manifest["family"]["id"] == "kontur", "family id drift")
    require(manifest["family"]["version"] == "0.1", "family version drift")
    require(manifest["family"]["core_member"] is False, "family promoted into Core")
    require(manifest["family"]["activated"] is False, "family declared activated")
    require(manifest["family"]["production_ready"] is False, "production readiness overclaim")

    members = index(manifest["members"], "id", "member id")
    require(set(members) == MEMBERS, "member inventory drift")
    for member_id, member in members.items():
        require(member["evidence_status"] == MEMBER_STATUS[member_id], f"member status drift: {member_id}")
        require(member["runtime_activation_state"] == MEMBER_RUNTIME[member_id], f"runtime state drift: {member_id}")
        require(set(member["canonical_paths"]) == PATHS[member_id], f"path inventory drift: {member_id}")
        for path in member["canonical_paths"]:
            require((ROOT / path).exists(), f"missing canonical path: {path}")
        for field in ("core_member", "authority_source", "responsibility_holder", "shared_data_access", "external_effect_authorized"):
            require(member[field] is False, f"unsafe member field {field}: {member_id}")

    edges: dict[tuple[str, str], dict[str, Any]] = {}
    for edge in manifest["edges"]:
        key = (edge["from"], edge["to"])
        require(key not in edges, f"duplicate edge: {key}")
        edges[key] = edge
        require(edge["from"] in members and edge["to"] in members and edge["from"] != edge["to"], f"invalid edge: {key}")
        for field in ("authority_transfer", "responsibility_transfer", "shared_data_access", "activation_authorized"):
            require(edge[field] is False, f"unsafe edge field {field}: {key}")
    require(set(edges) == set(EDGES), "edge inventory drift")
    for key, status in EDGES.items():
        require(edges[key]["status"] == status, f"edge status drift: {key}")

    policy = manifest["consolidation_policy"]
    require(policy["member_roles_remain_distinct"] is True, "member roles collapsed")
    require(policy["single_member_may_self_certify_family_readiness"] is False, "self-certification enabled")
    for field in (
        "automatic_activation",
        "automatic_host_designation",
        "automatic_ledger_mutation",
        "automatic_runtime_start",
        "automatic_external_effect",
        "automatic_stable_core_promotion",
    ):
        require(policy[field] is False, f"unsafe policy enabled: {field}")
    require(policy["cross_member_data_access_default"] == "denied", "cross-member data access enabled")
    require(policy["human_activation_boundary_required"] is True, "human activation boundary removed")
    require(policy["fresh_frontier_required"] is True, "fresh frontier removed")
    require(policy["observe_before_retry"] is True, "observe-before-retry removed")

    actors = index(contract["actors"], "id", "actor id")
    require(set(actors) == ACTORS, "actor inventory drift")
    for actor_id in (
        "human-kontur-family-owner",
        "human-kontur-activation-reviewer",
        "human-kontur-pilot-reviewer",
    ):
        require(actors[actor_id]["kind"] == "human", f"human actor drift: {actor_id}")
    require(actors["kontur-family-validation-software"]["kind"] == "software", "validator actor drift")
    require(actors["kontur-game-companion-pilot"]["kind"] == "ai_system", "pilot actor drift")
    require(all(actor["may_authorize_effects"] is False for actor in actors.values()), "actor gained effect authority")

    evidence = index(contract["evidence"]["inputs"], "id", "evidence id")
    require(set(evidence) == EVIDENCE, "evidence inventory drift")
    for evidence_id in (
        "family-manifest",
        "readiness-evidence",
        "responsibility-evidence",
        "activation-host-evidence",
        "game-companion-evidence",
    ):
        require(evidence[evidence_id]["absence_handling"] == "fail_closed", f"required evidence fail-open: {evidence_id}")
    require(evidence["sanitized-field-evidence"]["absence_handling"] == "not_available", "field absence drift")
    require(evidence["family-challenge"]["absence_handling"] == "not_available", "challenge absence drift")
    require(all(item["provenance_required"] is True for item in evidence.values()), "provenance disabled")
    require(all(value is False for value in contract["boundary_invariants"].values()), "boundary amplification")

    classes = index(contract["data_governance"]["classes"], "id", "data class id")
    require(set(classes) == DATA_CLASSES, "data class inventory drift")
    require(all(item["class"] != "sensitive_personal" for item in classes.values()), "sensitive-personal class admitted")
    require(classes["activation-host-data"]["class"] == "confidential", "activation-host class drift")
    require(classes["pilot-evidence-data"]["class"] == "internal", "pilot class drift")
    require(classes["field-evidence-data"]["class"] == "derived", "field class drift")
    minimization = " ".join(item["minimization_rule"] for item in classes.values()).lower()
    for phrase in (
        "no scalar readiness score",
        "no execution authority",
        "no credentials",
        "no behavioral, psychological, mood or attention profiling",
        "no raw game history",
        "challenge does not become a negative",
    ):
        require(phrase in minimization, f"minimization boundary missing: {phrase}")
    require(contract["data_governance"]["cross_context_correlation_default"] == "denied", "correlation enabled")
    require(contract["data_governance"]["identity_resolution_default"] == "denied", "identity resolution enabled")

    effect = contract["contract_effect"]
    for field in (
        "execution_authorized",
        "action_permit_created",
        "responsibility_accepted",
        "stable_core_promotion_authorized",
        "legal_outcome_established",
    ):
        require(effect[field] is False, f"contract effect enabled: {field}")

    effects = index(contract["effects"]["analysis_effects"], "id", "effect id")
    require(set(effects) == EFFECTS, "effect inventory drift")
    require(contract["effects"]["external_effects"] == [], "external effect admitted")
    require(contract["effects"]["default_external_effect_admission"] == "denied", "external admission fail-open")
    require(all(item["external_effect"] is False for item in effects.values()), "analysis effect became external")
    require("without activation" in effects["readiness-inspection"]["description"].lower(), "readiness activation boundary missing")
    require("without state or ledger mutation" in effects["responsibility-lineage-review"]["description"].lower(), "responsibility mutation boundary missing")
    require("without activation, host designation or control" in effects["activation-host-review"]["description"].lower(), "activation-host boundary missing")
    require("without live responses" in effects["game-companion-chain-review"]["description"].lower(), "Game Companion live-response boundary missing")

    gates = index(contract["human_gates"], "id", "gate id")
    require(set(gates) == GATES, "gate inventory drift")
    expected_gate_data = {
        "family-consolidation-gate": (
            "human-kontur-family-owner",
            "REJECT_FAMILY_PACKET",
            {"family-manifest", "readiness-evidence", "responsibility-evidence", "activation-host-evidence", "game-companion-evidence"},
            {"REJECT_FAMILY_PACKET", "CORRECT_FAMILY_PACKET", "REQUEST_MORE_EVIDENCE", "ACCEPT_CONSOLIDATION_CANDIDATE"},
        ),
        "activation-referral-gate": (
            "human-kontur-activation-reviewer",
            "PAUSE_ACTIVATION_REFERRAL",
            {"family-manifest", "readiness-evidence", "activation-host-evidence"},
            {"PAUSE_ACTIVATION_REFERRAL", "REQUIRE_FRESH_FRONTIER", "REFER_TO_SEPARATE_ACTIVATION_REVIEW"},
        ),
        "pilot-evidence-gate": (
            "human-kontur-pilot-reviewer",
            "EXCLUDE_PILOT_EVIDENCE",
            {"game-companion-evidence", "sanitized-field-evidence"},
            {"EXCLUDE_PILOT_EVIDENCE", "CORRECT_PILOT_EVIDENCE", "REQUEST_MORE_SANITIZED_EVIDENCE", "ACCEPT_AS_BOUNDED_PILOT_EVIDENCE"},
        ),
    }
    forbidden = {"ACTIVATE", "EXECUTE", "DESIGNATE_HOST", "START_RUNTIME", "WRITE_LEDGER", "SEND_RESPONSE", "AUTO_MERGE"}
    for gate_id, (owner, default, required, decisions) in expected_gate_data.items():
        gate = gates[gate_id]
        require(gate["owner_role_id"] == owner, f"gate owner drift: {gate_id}")
        require(gate["default_decision"] == default, f"gate default drift: {gate_id}")
        require(gate["fail_closed"] is True, f"gate fail-open: {gate_id}")
        require(set(gate["required_evidence_ids"]) == required, f"gate evidence drift: {gate_id}")
        require(set(gate["decision_values"]) == decisions, f"gate decisions drift: {gate_id}")
        require(not (forbidden & decisions), f"forbidden decision admitted: {gate_id}")

    failure = contract["failure_uncertainty"]
    require(set(failure["states"]) == STATES, "state inventory drift")
    require(set(failure["terminal_states"]) == TERMINAL_STATES, "terminal inventory drift")
    require(failure["unknown_is_success"] is False, "UNKNOWN became success")
    require(failure["automatic_retry_on_unknown"] is False, "automatic retry enabled")
    require(failure["observe_before_retry"] is True, "observe-before-retry removed")
    require(failure["conflict_requires_reconciliation"] is True, "conflict reconciliation removed")
    require(failure["reconciliation_owner_role_id"] == "human-kontur-family-owner", "reconciliation owner drift")

    contest = contract["contestability"]
    require(contest["challenge_supported"] is True and contest["correction_supported"] is True, "contestability removed")
    require(contest["appeal_mode"] == "human_review", "appeal mode drift")
    require(contest["challenge_owner_role_id"] == "human-kontur-family-owner", "challenge owner drift")
    require(contest["decision_receipt_required"] is True, "challenge receipt removed")
    require(contest["original_evidence_preserved"] is True, "history rewrite enabled")
    require(contest["correction_creates_successor_state"] is True, "successor correction removed")
    scope = contest["challenge_input_scope"].lower()
    for phrase in ("member identity", "canonical path", "frontier", "readiness", "activation boundary", "pilot evidence", "non-effect"):
        require(phrase in scope, f"challenge scope missing: {phrase}")

    dependencies = index(contract["dependencies"], "id", "dependency id")
    require(set(dependencies) == DEPENDENCIES, "dependency inventory drift")
    require(dependencies["uu-aap-core"]["kind"] == "core" and dependencies["uu-aap-core"]["required"] is True, "Core dependency drift")
    require(dependencies["ial"]["kind"] == "language" and dependencies["ial"]["required"] is False, "IAL dependency drift")
    require(dependencies["ai-transport"]["kind"] == "transport" and dependencies["ai-transport"]["required"] is False, "transport dependency drift")
    require(dependencies["freeshield"]["kind"] == "protective" and dependencies["freeshield"]["required"] is False, "FREESHIELD dependency drift")
    require("kontur" not in dependencies and "kontur-family" not in dependencies, "self dependency admitted")
    for dependency in dependencies.values():
        for field in ("authority_transfer", "responsibility_transfer", "reverse_core_dependency"):
            require(dependency[field] is False, f"dependency transfer enabled: {dependency['id']}:{field}")

    receipts = index(contract["receipts"], "type", "receipt type")
    require(set(receipts) == RECEIPTS, "receipt inventory drift")
    require(any("does not activate" in item.lower() for item in receipts["KONTURFamilyConsolidationReceipt"]["non_effects"]), "consolidation activation non-effect missing")
    require(any("not activation execution" in item.lower() for item in receipts["KONTURActivationBoundaryReviewReceipt"]["non_effects"]), "referral non-effect missing")
    require(any("not production readiness" in item.lower() for item in receipts["KONTURPilotEvidenceReceipt"]["non_effects"]), "pilot readiness non-effect missing")
    require(any("does not erase predecessor" in item.lower() for item in receipts["KONTURFamilyChallengeReceipt"]["non_effects"]), "history non-effect missing")

    criteria = index(contract["success_criteria"]["criteria"], "id", "criterion id")
    require(set(criteria) == CRITERIA, "criterion inventory drift")
    require(criteria["family-member-binding-coverage"]["threshold"] == "100 percent of required members and paths are repository-resolvable", "member threshold drift")
    require(criteria["interface-non-transfer-coverage"]["threshold"] == "100 percent of edges keep transfer, activation and access fields false", "edge threshold drift")
    require(criteria["zero-external-effect"]["threshold"] == "Zero external effects", "zero-effect threshold drift")
    require(contract["success_criteria"]["success_creates_successor_authority"] is False, "success created authority")
    require(contract["success_criteria"]["failure_creates_liability"] is False, "failure created liability")

    ip = contract["ip_boundary"]
    require(ip["object_id"] == "kontur-product-family-contract-v0.1", "IP object drift")
    require(set(ip["included_artifacts"]) == INCLUDED, "IP included-artifact drift")
    excluded = " ".join(ip["excluded_artifacts"]).lower()
    for phrase in ("activation commands", "game companion user data", "third-party models", "future family versions"):
        require(phrase in excluded, f"IP exclusion missing: {phrase}")
    require(ip["future_versions_included"] is False, "future versions claimed")
    require(ip["registration_claimed"] is False, "registration claimed")
    require(ip["legal_outcome_claimed"] is False, "legal outcome claimed")

    require(FAMILY_ASSERTIONS <= set(contract["assertions"]), "family assertion missing")
    require(FAMILY_NON_EFFECTS <= set(contract["non_effects"]), "family non-effect missing")
    require(FAMILY_NON_EFFECTS <= set(manifest["non_effects"]), "manifest non-effect missing")


def expect_fail(
    base_contract: dict[str, Any],
    base_manifest: dict[str, Any],
    product_schema: dict[str, Any],
    manifest_schema: dict[str, Any],
    reusable: Any,
    name: str,
    target: str,
    mutate: Callable[[dict[str, Any]], None],
    *,
    rehash_after: bool = True,
) -> None:
    contract = copy.deepcopy(base_contract)
    manifest = copy.deepcopy(base_manifest)
    candidate = contract if target == "contract" else manifest
    mutate(candidate)
    if rehash_after:
        if target == "contract":
            reusable.rehash(contract)
        else:
            rehash_manifest(manifest)
    try:
        validate(contract, manifest, product_schema, manifest_schema, reusable, enforce_identity=False)
    except (KONTURFamilyContractError, reusable.ProductContractError, KeyError, TypeError, StopIteration, ValueError):
        return
    raise AssertionError(f"unsafe mutation unexpectedly passed: {name}")


def external_effect() -> dict[str, Any]:
    return {
        "id": "activate-kontur",
        "description": "Activate KONTUR",
        "allowed_scope": "one host",
        "default_admission": "denied",
        "requires_action_permit": True,
        "requires_human_gate": True,
        "human_gate_id": "activation-referral-gate",
        "requires_frontier_revalidation": True,
        "unknown_outcome_policy": "observe_before_retry",
        "automatic_retry_on_unknown": False,
        "idempotency_profile": "single-use",
        "actuator_binding": "activation actuator",
    }


def run_negative_suite(
    contract: dict[str, Any],
    manifest: dict[str, Any],
    product_schema: dict[str, Any],
    manifest_schema: dict[str, Any],
    reusable: Any,
) -> int:
    tests: list[tuple[str, str, Callable[[dict[str, Any]], None], bool]] = [
        ("contract id", "contract", lambda d: d.__setitem__("contract_id", "other-contract"), True),
        ("contract status", "contract", lambda d: d.__setitem__("contract_status", "accepted"), True),
        ("product id", "contract", lambda d: d["product"].__setitem__("id", "other-family"), True),
        ("product kind", "contract", lambda d: d["product"].__setitem__("kind", "responsibility_runtime"), True),
        ("product maturity", "contract", lambda d: d["product"].__setitem__("maturity", "released"), True),
        ("product Core", "contract", lambda d: d["product"].__setitem__("core_member", True), True),
        ("product owner", "contract", lambda d: d["product"].__setitem__("product_owner_role_id", "kontur-family-validation-software"), True),
        ("contract frontier", "contract", lambda d: d["frontier"].__setitem__("revision", "0" * 40), True),
        ("contract time", "contract", lambda d: d["frontier"].__setitem__("observed_at", "2026-08-27T01:20:50Z"), True),
        ("manifest id", "manifest", lambda d: d.__setitem__("manifest_id", "other-manifest"), True),
        ("manifest status", "manifest", lambda d: d.__setitem__("status", "accepted"), True),
        ("manifest frontier", "manifest", lambda d: d["frontier"].__setitem__("revision", "1" * 40), True),
        ("manifest tree", "manifest", lambda d: d["frontier"].__setitem__("tree", "2" * 40), True),
        ("family activated", "manifest", lambda d: d["family"].__setitem__("activated", True), True),
        ("family production ready", "manifest", lambda d: d["family"].__setitem__("production_ready", True), True),
        ("family Core", "manifest", lambda d: d["family"].__setitem__("core_member", True), True),
        ("remove readiness member", "manifest", lambda d: d["members"].remove(by_id(d["members"], "readiness-aggregator")), True),
        ("remove activation member", "manifest", lambda d: d["members"].remove(by_id(d["members"], "activation-boundary")), True),
        ("remove kernel member", "manifest", lambda d: d["members"].remove(by_id(d["members"], "responsibility-kernel")), True),
        ("remove ledger member", "manifest", lambda d: d["members"].remove(by_id(d["members"], "responsibility-ledger")), True),
        ("remove host member", "manifest", lambda d: d["members"].remove(by_id(d["members"], "live-host-boundary")), True),
        ("remove pilot member", "manifest", lambda d: d["members"].remove(by_id(d["members"], "game-companion")), True),
        ("duplicate member", "manifest", lambda d: d["members"].append(copy.deepcopy(d["members"][0])), True),
        ("member status", "manifest", lambda d: by_id(d["members"], "game-companion").__setitem__("evidence_status", "implemented_experimental"), True),
        ("kernel runtime state", "manifest", lambda d: by_id(d["members"], "responsibility-kernel").__setitem__("runtime_activation_state", "not_applicable"), True),
        ("member authority", "manifest", lambda d: by_id(d["members"], "readiness-aggregator").__setitem__("authority_source", True), True),
        ("member responsibility", "manifest", lambda d: by_id(d["members"], "responsibility-kernel").__setitem__("responsibility_holder", True), True),
        ("member data access", "manifest", lambda d: by_id(d["members"], "game-companion").__setitem__("shared_data_access", True), True),
        ("member effect", "manifest", lambda d: by_id(d["members"], "live-host-boundary").__setitem__("external_effect_authorized", True), True),
        ("member path", "manifest", lambda d: by_id(d["members"], "game-companion")["canonical_paths"].__setitem__(0, "README.md"), True),
        ("remove edge", "manifest", lambda d: d["edges"].pop(), True),
        ("duplicate edge", "manifest", lambda d: d["edges"].append(copy.deepcopy(d["edges"][0])), True),
        ("edge status", "manifest", lambda d: next(e for e in d["edges"] if e["from"] == "responsibility-kernel" and e["to"] == "game-companion").__setitem__("status", "established_evidence_dependency"), True),
        ("edge authority", "manifest", lambda d: d["edges"][0].__setitem__("authority_transfer", True), True),
        ("edge responsibility", "manifest", lambda d: d["edges"][0].__setitem__("responsibility_transfer", True), True),
        ("edge data", "manifest", lambda d: d["edges"][0].__setitem__("shared_data_access", True), True),
        ("edge activation", "manifest", lambda d: d["edges"][0].__setitem__("activation_authorized", True), True),
        ("roles collapsed", "manifest", lambda d: d["consolidation_policy"].__setitem__("member_roles_remain_distinct", False), True),
        ("self certification", "manifest", lambda d: d["consolidation_policy"].__setitem__("single_member_may_self_certify_family_readiness", True), True),
        ("auto activation", "manifest", lambda d: d["consolidation_policy"].__setitem__("automatic_activation", True), True),
        ("auto designation", "manifest", lambda d: d["consolidation_policy"].__setitem__("automatic_host_designation", True), True),
        ("auto ledger", "manifest", lambda d: d["consolidation_policy"].__setitem__("automatic_ledger_mutation", True), True),
        ("auto runtime", "manifest", lambda d: d["consolidation_policy"].__setitem__("automatic_runtime_start", True), True),
        ("auto effect", "manifest", lambda d: d["consolidation_policy"].__setitem__("automatic_external_effect", True), True),
        ("auto Core", "manifest", lambda d: d["consolidation_policy"].__setitem__("automatic_stable_core_promotion", True), True),
        ("cross member data", "manifest", lambda d: d["consolidation_policy"].__setitem__("cross_member_data_access_default", "allowed"), True),
        ("human boundary", "manifest", lambda d: d["consolidation_policy"].__setitem__("human_activation_boundary_required", False), True),
        ("fresh frontier", "manifest", lambda d: d["consolidation_policy"].__setitem__("fresh_frontier_required", False), True),
        ("observe retry", "manifest", lambda d: d["consolidation_policy"].__setitem__("observe_before_retry", False), True),
        ("remove family owner", "contract", lambda d: d["actors"].remove(by_id(d["actors"], "human-kontur-family-owner")), True),
        ("remove activation reviewer", "contract", lambda d: d["actors"].remove(by_id(d["actors"], "human-kontur-activation-reviewer")), True),
        ("remove pilot reviewer", "contract", lambda d: d["actors"].remove(by_id(d["actors"], "human-kontur-pilot-reviewer")), True),
        ("actor authority", "contract", lambda d: by_id(d["actors"], "kontur-family-validation-software").__setitem__("may_authorize_effects", True), True),
        ("remove manifest evidence", "contract", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "family-manifest")), True),
        ("remove readiness evidence", "contract", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "readiness-evidence")), True),
        ("remove responsibility evidence", "contract", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "responsibility-evidence")), True),
        ("remove activation evidence", "contract", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "activation-host-evidence")), True),
        ("remove pilot evidence", "contract", lambda d: d["evidence"]["inputs"].remove(by_id(d["evidence"]["inputs"], "game-companion-evidence")), True),
        ("required evidence fail-open", "contract", lambda d: by_id(d["evidence"]["inputs"], "readiness-evidence").__setitem__("absence_handling", "not_available"), True),
        ("field absence overclaim", "contract", lambda d: by_id(d["evidence"]["inputs"], "sanitized-field-evidence").__setitem__("absence_handling", "fail_closed"), True),
        ("provenance off", "contract", lambda d: by_id(d["evidence"]["inputs"], "family-manifest").__setitem__("provenance_required", False), True),
        ("sensitive class", "contract", lambda d: d["data_governance"]["classes"].append({"id":"sensitive-profile","class":"sensitive_personal","collection_scope":"Profiles","minimization_rule":"None","retention_mode":"bounded","retention_limit":"Forever","disclosure_scope":"All","correction_supported":True,"deletion_supported":True}), True),
        ("activation class", "contract", lambda d: by_id(d["data_governance"]["classes"], "activation-host-data").__setitem__("class", "public"), True),
        ("pilot class", "contract", lambda d: by_id(d["data_governance"]["classes"], "pilot-evidence-data").__setitem__("class", "personal"), True),
        ("field class", "contract", lambda d: by_id(d["data_governance"]["classes"], "field-evidence-data").__setitem__("class", "personal"), True),
        ("profiling minimization", "contract", lambda d: by_id(d["data_governance"]["classes"], "pilot-evidence-data").__setitem__("minimization_rule", "Collect behavior"), True),
        ("raw history", "contract", lambda d: by_id(d["data_governance"]["classes"], "field-evidence-data").__setitem__("minimization_rule", "Keep raw game history"), True),
        ("credentials", "contract", lambda d: by_id(d["data_governance"]["classes"], "activation-host-data").__setitem__("minimization_rule", "Include credentials"), True),
        ("correlation", "contract", lambda d: d["data_governance"].__setitem__("cross_context_correlation_default", "allowed"), True),
        ("identity resolution", "contract", lambda d: d["data_governance"].__setitem__("identity_resolution_default", "allowed"), True),
        ("execution", "contract", lambda d: d["contract_effect"].__setitem__("execution_authorized", True), True),
        ("permit", "contract", lambda d: d["contract_effect"].__setitem__("action_permit_created", True), True),
        ("responsibility accepted", "contract", lambda d: d["contract_effect"].__setitem__("responsibility_accepted", True), True),
        ("Core promotion", "contract", lambda d: d["contract_effect"].__setitem__("stable_core_promotion_authorized", True), True),
        ("legal outcome", "contract", lambda d: d["contract_effect"].__setitem__("legal_outcome_established", True), True),
        ("external effect", "contract", lambda d: d["effects"]["external_effects"].append(external_effect()), True),
        ("remove effect", "contract", lambda d: d["effects"]["analysis_effects"].remove(by_id(d["effects"]["analysis_effects"], "activation-host-review")), True),
        ("effect external", "contract", lambda d: by_id(d["effects"]["analysis_effects"], "family-manifest-validation").__setitem__("external_effect", True), True),
        ("readiness activates", "contract", lambda d: by_id(d["effects"]["analysis_effects"], "readiness-inspection").__setitem__("description", "Inspect and activate"), True),
        ("responsibility mutates", "contract", lambda d: by_id(d["effects"]["analysis_effects"], "responsibility-lineage-review").__setitem__("description", "Write ledger state"), True),
        ("host designates", "contract", lambda d: by_id(d["effects"]["analysis_effects"], "activation-host-review").__setitem__("description", "Designate host and activate"), True),
        ("pilot live response", "contract", lambda d: by_id(d["effects"]["analysis_effects"], "game-companion-chain-review").__setitem__("description", "Generate live responses"), True),
        ("remove family gate", "contract", lambda d: d["human_gates"].remove(by_id(d["human_gates"], "family-consolidation-gate")), True),
        ("remove activation gate", "contract", lambda d: d["human_gates"].remove(by_id(d["human_gates"], "activation-referral-gate")), True),
        ("remove pilot gate", "contract", lambda d: d["human_gates"].remove(by_id(d["human_gates"], "pilot-evidence-gate")), True),
        ("family gate default", "contract", lambda d: by_id(d["human_gates"], "family-consolidation-gate").__setitem__("default_decision", "ACCEPT_CONSOLIDATION_CANDIDATE"), True),
        ("family gate evidence", "contract", lambda d: by_id(d["human_gates"], "family-consolidation-gate")["required_evidence_ids"].remove("activation-host-evidence"), True),
        ("activation gate default", "contract", lambda d: by_id(d["human_gates"], "activation-referral-gate").__setitem__("default_decision", "REFER_TO_SEPARATE_ACTIVATION_REVIEW"), True),
        ("activation decision", "contract", lambda d: by_id(d["human_gates"], "activation-referral-gate")["decision_values"].append("ACTIVATE"), True),
        ("pilot gate default", "contract", lambda d: by_id(d["human_gates"], "pilot-evidence-gate").__setitem__("default_decision", "ACCEPT_AS_BOUNDED_PILOT_EVIDENCE"), True),
        ("UNKNOWN removed", "contract", lambda d: d["failure_uncertainty"]["states"].remove("UNKNOWN"), True),
        ("CONFLICT removed", "contract", lambda d: d["failure_uncertainty"]["states"].remove("CONFLICT"), True),
        ("state drift", "contract", lambda d: d["failure_uncertainty"]["states"].append("AUTO_ACTIVATED"), True),
        ("UNKNOWN success", "contract", lambda d: d["failure_uncertainty"].__setitem__("unknown_is_success", True), True),
        ("auto retry", "contract", lambda d: d["failure_uncertainty"].__setitem__("automatic_retry_on_unknown", True), True),
        ("challenge off", "contract", lambda d: d["contestability"].__setitem__("challenge_supported", False), True),
        ("history rewrite", "contract", lambda d: d["contestability"].__setitem__("original_evidence_preserved", False), True),
        ("challenge scope", "contract", lambda d: d["contestability"].__setitem__("challenge_input_scope", "Formatting"), True),
        ("Core dependency", "contract", lambda d: d["dependencies"].remove(by_id(d["dependencies"], "uu-aap-core")), True),
        ("self dependency", "contract", lambda d: d["dependencies"].append({"id":"kontur-family","kind":"runtime","version_range":"v0.1","relationship":"Self","required":True,"authority_transfer":False,"responsibility_transfer":False,"reverse_core_dependency":False}), True),
        ("dependency authority", "contract", lambda d: by_id(d["dependencies"], "freeshield").__setitem__("authority_transfer", True), True),
        ("dependency responsibility", "contract", lambda d: by_id(d["dependencies"], "ai-transport").__setitem__("responsibility_transfer", True), True),
        ("reverse Core", "contract", lambda d: by_id(d["dependencies"], "uu-aap-core").__setitem__("reverse_core_dependency", True), True),
        ("remove manifest receipt", "contract", lambda d: d["receipts"].remove(by_type(d["receipts"], "KONTURFamilyManifestReceipt")), True),
        ("consolidation non-effect", "contract", lambda d: by_type(d["receipts"], "KONTURFamilyConsolidationReceipt")["non_effects"].pop(0), True),
        ("referral non-effect", "contract", lambda d: by_type(d["receipts"], "KONTURActivationBoundaryReviewReceipt")["non_effects"].pop(0), True),
        ("pilot non-effect", "contract", lambda d: by_type(d["receipts"], "KONTURPilotEvidenceReceipt")["non_effects"].pop(0), True),
        ("history non-effect", "contract", lambda d: by_type(d["receipts"], "KONTURFamilyChallengeReceipt")["non_effects"].pop(0), True),
        ("remove member criterion", "contract", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "family-member-binding-coverage")), True),
        ("remove edge criterion", "contract", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "interface-non-transfer-coverage")), True),
        ("remove activation criterion", "contract", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "readiness-activation-separation")), True),
        ("remove pilot criterion", "contract", lambda d: d["success_criteria"]["criteria"].remove(by_id(d["success_criteria"]["criteria"], "game-companion-chain-closure")), True),
        ("zero effect threshold", "contract", lambda d: by_id(d["success_criteria"]["criteria"], "zero-external-effect").__setitem__("threshold", "One external effect"), True),
        ("success authority", "contract", lambda d: d["success_criteria"].__setitem__("success_creates_successor_authority", True), True),
        ("failure liability", "contract", lambda d: d["success_criteria"].__setitem__("failure_creates_liability", True), True),
        ("IP id", "contract", lambda d: d["ip_boundary"].__setitem__("object_id", "all-kontur"), True),
        ("IP scope", "contract", lambda d: d["ip_boundary"]["included_artifacts"].append("server/kontur/v0.1"), True),
        ("IP future", "contract", lambda d: d["ip_boundary"].__setitem__("future_versions_included", True), True),
        ("IP registration", "contract", lambda d: d["ip_boundary"].__setitem__("registration_claimed", True), True),
        ("IP legal", "contract", lambda d: d["ip_boundary"].__setitem__("legal_outcome_claimed", True), True),
        ("assertion removed", "contract", lambda d: d["assertions"].remove("The family member inventory and established/planned interfaces are explicit"), True),
        ("activation non-effect", "contract", lambda d: d["non_effects"].remove("KONTUR Product Family Contract != KONTUR Activation"), True),
        ("pilot holder non-effect", "contract", lambda d: d["non_effects"].remove("Game Companion Pilot != Server Responsibility Holder"), True),
        ("manifest non-effect", "manifest", lambda d: d["non_effects"].remove("Ready Signal != ActionPermit"), True),
        ("contract hash", "contract", lambda d: d["identity"].__setitem__("content_hash", "sha256:" + "0" * 64), False),
        ("manifest hash", "manifest", lambda d: d["identity"].__setitem__("content_hash", "sha256:" + "0" * 64), False),
    ]

    for name, target, mutate, rehash_after in tests:
        expect_fail(
            contract,
            manifest,
            product_schema,
            manifest_schema,
            reusable,
            name,
            target,
            mutate,
            rehash_after=rehash_after,
        )
    return len(tests)


def main() -> None:
    reusable = load_reusable()
    product_schema = load_json(PRODUCT_SCHEMA_PATH)
    manifest_schema = load_json(MANIFEST_SCHEMA_PATH)
    contract = load_json(CONTRACT_PATH)
    manifest = load_json(MANIFEST_PATH)

    Draft202012Validator.check_schema(manifest_schema)
    validate(contract, manifest, product_schema, manifest_schema, reusable)
    rejected = run_negative_suite(contract, manifest, product_schema, manifest_schema, reusable)
    print(
        "KONTUR Product Family Contract v0.1 validation: "
        f"PASS ({rejected} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
