#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHALLENGE = ROOT / "network-user-surface-activation-challenge" / "challenge.py"

spec = importlib.util.spec_from_file_location("network_surface_externalization_review_challenge", CHALLENGE)
challenge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(challenge)


class NetworkUserSurfaceExternalizationReviewError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceExternalizationReviewError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


REVIEW_SCOPE = "THIS_ACTIVATION_CHALLENGE_ONLY"
REVIEWER_CLAIM = "SYNTHETIC_EXTERNALIZATION_REVIEWER"

REVIEW_DIMENSIONS = (
    "network_contract_reviewed",
    "user_surface_contract_reviewed",
    "rollback_contract_reviewed",
    "delivery_audit_sink_reviewed",
    "binding_freshness_reviewed",
    "activation_scope_reviewed",
    "requested_capability_reviewed",
)

RESULT_BINDINGS = (
    ("network_contract_reviewed", "network_contract_sufficient"),
    ("user_surface_contract_reviewed", "user_surface_contract_sufficient"),
    ("rollback_contract_reviewed", "rollback_contract_sufficient"),
    ("delivery_audit_sink_reviewed", "delivery_audit_sink_sufficient"),
    ("binding_freshness_reviewed", "binding_freshness_valid"),
    ("activation_scope_reviewed", "activation_scope_valid"),
    ("requested_capability_reviewed", "requested_capability_valid"),
)

REFERENCE_FIELDS = (
    "binding_object_digest",
    "runtime_binding_ref",
    "transport_binding_ref",
    "endpoint_binding_ref",
    "network_contract_ref",
    "user_surface_contract_ref",
    "rollback_contract_ref",
    "delivery_audit_sink_ref",
)

FALSE_EFFECTS = (
    "network_activation_authorized",
    "user_surface_activation_authorized",
    "activation_decision_present",
    "activation_token_created",
    "network_enabled",
    "user_surface_enabled",
    "live_runtime_enabled",
    "live_runtime_bound",
    "external_transport_bound",
    "send_permit",
    "send_authority",
    "response_authority_created",
    "external_effect_authorized",
    "transport_invoked",
    "delivery_attempted",
    "delivery_receipt_created",
    "credential_material_created",
    "secret_material_created",
    "endpoint_credential_created",
    "bearer_credential_created",
    "action_permit_created",
    "successor_permit_created",
    "payload_persisted",
    "proactive_messaging_enabled",
    "background_messaging_enabled",
    "autonomous_gameplay_enabled",
    "account_control_enabled",
    "profiling_enabled",
    "persistent_activation_created",
    "cross_session_activation_enabled",
    "cross_game_scope_enabled",
    "stable_core_promotion",
)


def validate_activation_challenge(item):
    req(item.get("schema_version") == "kontur-game-companion-network-user-surface-activation-challenge-v0.1", "challenge schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "challenge status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "ACTIVATION_NOT_REQUESTED",
        "NETWORK_CONTRACT_REQUIRED",
        "USER_SURFACE_CONTRACT_REQUIRED",
        "ROLLBACK_CONTRACT_REQUIRED",
        "DELIVERY_AUDIT_SINK_REQUIRED",
        "BINDING_FRESHNESS_RECHECK_REQUIRED",
        "READY_FOR_EXTERNALIZATION_REVIEW",
    }, "challenge decision")
    digest = item.get("activation_challenge_digest")
    req(isinstance(digest, str) and len(digest) == 64, "challenge digest")
    req(digest == challenge.sha({k: v for k, v in item.items() if k != "activation_challenge_digest"}), "challenge digest binding")
    req(item.get("activation_challenge_scope") == challenge.ACTIVATION_SCOPE, "challenge scope")
    req(item.get("requested_capability") == challenge.REQUESTED_CAPABILITY, "challenge capability")
    ready = item["decision"] == "READY_FOR_EXTERNALIZATION_REVIEW"
    req(item.get("activation_review_ready") is ready, "challenge review readiness")
    for field in challenge.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream challenge effect: {field}")
    req(item.get("runtime_connectedness") == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL", "challenge connectedness")
    if ready:
        for field in REFERENCE_FIELDS:
            req(isinstance(item.get(field), str) and len(item[field]) == 64, f"ready challenge ref: {field}")
        req(item.get("binding_freshness_rechecked") is True, "challenge freshness recheck")
        req(item.get("binding_object_current_confirmed") is True, "challenge binding current")
        req(item.get("binding_grant_current_confirmed") is True, "challenge grant current")
        for field in (
            "network_contract_sufficiency_evaluated",
            "user_surface_contract_sufficiency_evaluated",
            "rollback_sufficiency_evaluated",
            "audit_sink_sufficiency_evaluated",
            "network_activation_authorized",
            "user_surface_activation_authorized",
        ):
            req(item.get(field) is False, f"review performed upstream: {field}")


def default_review_context(item):
    validate_activation_challenge(item)
    ctx = {
        "schema_version": "kontur-game-companion-network-user-surface-externalization-review-context-v0.1",
        "source_activation_challenge_digest": item["activation_challenge_digest"],
        "review_scope": REVIEW_SCOPE,
        "reviewer_claim": REVIEWER_CLAIM,
        "independent_review_asserted": True,
        "activation_challenge_scope": item.get("activation_challenge_scope"),
        "requested_capability": item.get("requested_capability"),
        "network_contract_reviewed": False,
        "network_contract_sufficient": False,
        "user_surface_contract_reviewed": False,
        "user_surface_contract_sufficient": False,
        "rollback_contract_reviewed": False,
        "rollback_contract_sufficient": False,
        "delivery_audit_sink_reviewed": False,
        "delivery_audit_sink_sufficient": False,
        "binding_freshness_reviewed": False,
        "binding_freshness_valid": False,
        "activation_scope_reviewed": False,
        "activation_scope_valid": False,
        "requested_capability_reviewed": False,
        "requested_capability_valid": False,
        "activation_decision_present": False,
        "activation_token_present": False,
        "network_enablement_present": False,
        "user_surface_enablement_present": False,
        "send_permit_available": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in REFERENCE_FIELDS:
        ctx[field] = item.get(field)
    return ctx


def validate_review_context(item, ctx):
    validate_activation_challenge(item)
    req(ctx.get("schema_version") == "kontur-game-companion-network-user-surface-externalization-review-context-v0.1", "review context schema")
    req(ctx.get("source_activation_challenge_digest") == item.get("activation_challenge_digest"), "challenge binding")
    req(ctx.get("review_scope") == REVIEW_SCOPE, "review scope")
    req(ctx.get("reviewer_claim") == REVIEWER_CLAIM, "reviewer claim")
    req(ctx.get("independent_review_asserted") is True, "independent review assertion")
    req(ctx.get("activation_challenge_scope") == item.get("activation_challenge_scope"), "activation scope provenance")
    req(ctx.get("requested_capability") == item.get("requested_capability"), "capability provenance")
    for field in REFERENCE_FIELDS:
        req(ctx.get(field) == item.get(field), f"reference binding: {field}")
    for field in REVIEW_DIMENSIONS:
        req(type(ctx.get(field)) is bool, f"review marker: {field}")
    for _, result in RESULT_BINDINGS:
        req(type(ctx.get(result)) is bool, f"review result: {result}")
    for reviewed, result in RESULT_BINDINGS:
        if ctx[result]:
            req(ctx[reviewed] is True, f"result without review: {result}")
    for field in (
        "activation_decision_present",
        "activation_token_present",
        "network_enablement_present",
        "user_surface_enablement_present",
        "send_permit_available",
    ):
        req(ctx.get(field) is False, f"forbidden review context effect: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "review context effects")
    if item["decision"] != "READY_FOR_EXTERNALIZATION_REVIEW":
        for field in REVIEW_DIMENSIONS:
            req(ctx[field] is False, "review before challenge ready")
        for _, result in RESULT_BINDINGS:
            req(ctx[result] is False, "review result before challenge ready")


def review(item, review_context=None):
    validate_activation_challenge(item)
    ctx = default_review_context(item) if review_context is None else copy.deepcopy(review_context)
    validate_review_context(item, ctx)

    applicable = item["decision"] == "READY_FOR_EXTERNALIZATION_REVIEW"
    all_reviewed = applicable and all(ctx[field] for field in REVIEW_DIMENSIONS)

    if not applicable:
        decision, reason = "NOT_APPLICABLE", "ACTIVATION_CHALLENGE_NOT_READY_FOR_REVIEW"
    elif not all_reviewed:
        decision, reason = "REVIEW_INCOMPLETE", "ONE_OR_MORE_EXTERNALIZATION_REVIEW_DIMENSIONS_INCOMPLETE"
    elif not ctx["network_contract_sufficient"]:
        decision, reason = "REVIEW_REJECTED_NETWORK_CONTRACT", "NETWORK_CONTRACT_INSUFFICIENT"
    elif not ctx["user_surface_contract_sufficient"]:
        decision, reason = "REVIEW_REJECTED_USER_SURFACE_CONTRACT", "USER_SURFACE_CONTRACT_INSUFFICIENT"
    elif not ctx["rollback_contract_sufficient"]:
        decision, reason = "REVIEW_REJECTED_ROLLBACK", "ROLLBACK_CONTRACT_INSUFFICIENT"
    elif not ctx["delivery_audit_sink_sufficient"]:
        decision, reason = "REVIEW_REJECTED_AUDIT_SINK", "DELIVERY_AUDIT_SINK_INSUFFICIENT"
    elif not ctx["binding_freshness_valid"]:
        decision, reason = "REVIEW_REJECTED_FRESHNESS", "BINDING_OR_GRANT_FRESHNESS_INVALID"
    elif not ctx["activation_scope_valid"]:
        decision, reason = "REVIEW_REJECTED_SCOPE", "ACTIVATION_SCOPE_OUTSIDE_BOUNDED_REVIEW"
    elif not ctx["requested_capability_valid"]:
        decision, reason = "REVIEW_REJECTED_CAPABILITY", "REQUESTED_CAPABILITY_OUTSIDE_BOUNDED_REVIEW"
    else:
        decision, reason = "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED", "EXTERNALIZATION_SUFFICIENCY_CONFIRMED_SEPARATE_ACTIVATION_STEP_REQUIRED"

    complete = decision == "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED"
    out = {
        "schema_version": "kontur-game-companion-network-user-surface-externalization-review-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_activation_challenge_digest": item["activation_challenge_digest"],
        "review_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "externalization_review_scope": REVIEW_SCOPE,
        "reviewer_claim": ctx["reviewer_claim"],
        "independent_review_asserted": True,
        "reviewer_identity_proven": False,
        "independent_review_proven": False,
        "activation_challenge_scope": item.get("activation_challenge_scope"),
        "requested_capability": item.get("requested_capability"),
        "network_contract_reviewed": ctx["network_contract_reviewed"],
        "network_contract_sufficient_for_activation": ctx["network_contract_sufficient"],
        "user_surface_contract_reviewed": ctx["user_surface_contract_reviewed"],
        "user_surface_contract_sufficient_for_activation": ctx["user_surface_contract_sufficient"],
        "rollback_contract_reviewed": ctx["rollback_contract_reviewed"],
        "rollback_contract_sufficient_for_activation": ctx["rollback_contract_sufficient"],
        "delivery_audit_sink_reviewed": ctx["delivery_audit_sink_reviewed"],
        "delivery_audit_sink_sufficient_for_activation": ctx["delivery_audit_sink_sufficient"],
        "binding_freshness_reviewed": ctx["binding_freshness_reviewed"],
        "binding_freshness_valid_for_activation": ctx["binding_freshness_valid"],
        "activation_scope_reviewed": ctx["activation_scope_reviewed"],
        "activation_scope_valid_for_activation": ctx["activation_scope_valid"],
        "requested_capability_reviewed": ctx["requested_capability_reviewed"],
        "requested_capability_valid_for_activation": ctx["requested_capability_valid"],
        "review_completed": all_reviewed,
        "externalization_sufficiency_confirmed": complete,
        "separate_activation_step_required": complete,
        "network_activation_authorized": False,
        "user_surface_activation_authorized": False,
        "activation_decision_present": False,
        "activation_token_created": False,
        "network_enabled": False,
        "user_surface_enabled": False,
        "live_runtime_enabled": False,
        "live_runtime_bound": False,
        "external_transport_bound": False,
        "send_permit": False,
        "send_authority": False,
        "response_authority_created": False,
        "external_effect_authorized": False,
        "transport_invoked": False,
        "delivery_attempted": False,
        "delivery_receipt_created": False,
        "credential_material_created": False,
        "secret_material_created": False,
        "endpoint_credential_created": False,
        "bearer_credential_created": False,
        "action_permit_created": False,
        "successor_permit_created": False,
        "payload_persisted": False,
        "proactive_messaging_enabled": False,
        "background_messaging_enabled": False,
        "autonomous_gameplay_enabled": False,
        "account_control_enabled": False,
        "profiling_enabled": False,
        "persistent_activation_created": False,
        "cross_session_activation_enabled": False,
        "cross_game_scope_enabled": False,
        "stable_core_promotion": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL",
    }
    for field in REFERENCE_FIELDS:
        out[field] = item.get(field)

    validate_review_receipt(item, ctx, out)
    out["externalization_review_receipt_digest"] = sha(out)
    return out


def validate_review_receipt(item, ctx, out):
    validate_review_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-network-user-surface-externalization-review-receipt-v0.1", "receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "receipt status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "receipt source")
    req(out.get("source_activation_challenge_digest") == item.get("activation_challenge_digest"), "challenge digest binding")
    req(out.get("review_context_digest") == sha(ctx), "review context digest")
    req(out.get("decision") in {
        "NOT_APPLICABLE",
        "REVIEW_INCOMPLETE",
        "REVIEW_REJECTED_NETWORK_CONTRACT",
        "REVIEW_REJECTED_USER_SURFACE_CONTRACT",
        "REVIEW_REJECTED_ROLLBACK",
        "REVIEW_REJECTED_AUDIT_SINK",
        "REVIEW_REJECTED_FRESHNESS",
        "REVIEW_REJECTED_SCOPE",
        "REVIEW_REJECTED_CAPABILITY",
        "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED",
    }, "receipt decision")
    req(out.get("externalization_review_scope") == REVIEW_SCOPE, "receipt scope")
    req(out.get("reviewer_claim") == REVIEWER_CLAIM, "reviewer binding")
    req(out.get("independent_review_asserted") is True, "independent review marker")
    req(out.get("reviewer_identity_proven") is False and out.get("independent_review_proven") is False, "reviewer proof overclaim")
    req(out.get("activation_challenge_scope") == item.get("activation_challenge_scope"), "receipt activation scope binding")
    req(out.get("requested_capability") == item.get("requested_capability"), "receipt capability binding")
    for field in REFERENCE_FIELDS:
        req(out.get(field) == item.get(field), f"receipt provenance binding: {field}")

    mappings = (
        ("network_contract_reviewed", "network_contract_sufficient_for_activation", "network_contract_sufficient"),
        ("user_surface_contract_reviewed", "user_surface_contract_sufficient_for_activation", "user_surface_contract_sufficient"),
        ("rollback_contract_reviewed", "rollback_contract_sufficient_for_activation", "rollback_contract_sufficient"),
        ("delivery_audit_sink_reviewed", "delivery_audit_sink_sufficient_for_activation", "delivery_audit_sink_sufficient"),
        ("binding_freshness_reviewed", "binding_freshness_valid_for_activation", "binding_freshness_valid"),
        ("activation_scope_reviewed", "activation_scope_valid_for_activation", "activation_scope_valid"),
        ("requested_capability_reviewed", "requested_capability_valid_for_activation", "requested_capability_valid"),
    )
    for reviewed, receipt_result, ctx_result in mappings:
        req(out.get(reviewed) is ctx.get(reviewed), f"review marker binding: {reviewed}")
        req(out.get(receipt_result) is ctx.get(ctx_result), f"review result binding: {receipt_result}")

    applicable = item["decision"] == "READY_FOR_EXTERNALIZATION_REVIEW"
    all_reviewed = applicable and all(ctx[field] for field in REVIEW_DIMENSIONS)
    req(out.get("review_completed") is all_reviewed, "review completion")
    complete = out["decision"] == "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED"
    req(out.get("externalization_sufficiency_confirmed") is complete, "externalization sufficiency marker")
    req(out.get("separate_activation_step_required") is complete, "separate activation marker")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"review receipt effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "receipt effects")
    req(out.get("runtime_connectedness") == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL", "receipt connectedness")

    if not applicable:
        expected = "NOT_APPLICABLE"
    elif not all_reviewed:
        expected = "REVIEW_INCOMPLETE"
    elif not ctx["network_contract_sufficient"]:
        expected = "REVIEW_REJECTED_NETWORK_CONTRACT"
    elif not ctx["user_surface_contract_sufficient"]:
        expected = "REVIEW_REJECTED_USER_SURFACE_CONTRACT"
    elif not ctx["rollback_contract_sufficient"]:
        expected = "REVIEW_REJECTED_ROLLBACK"
    elif not ctx["delivery_audit_sink_sufficient"]:
        expected = "REVIEW_REJECTED_AUDIT_SINK"
    elif not ctx["binding_freshness_valid"]:
        expected = "REVIEW_REJECTED_FRESHNESS"
    elif not ctx["activation_scope_valid"]:
        expected = "REVIEW_REJECTED_SCOPE"
    elif not ctx["requested_capability_valid"]:
        expected = "REVIEW_REJECTED_CAPABILITY"
    else:
        expected = "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED"
    req(out.get("decision") == expected, "review decision derivation")
