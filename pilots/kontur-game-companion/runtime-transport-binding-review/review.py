#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHALLENGE = ROOT / "runtime-transport-binding-challenge" / "binding.py"

spec = importlib.util.spec_from_file_location("runtime_transport_binding_review_source", CHALLENGE)
binding = importlib.util.module_from_spec(spec)
spec.loader.exec_module(binding)


class RuntimeTransportBindingReviewError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise RuntimeTransportBindingReviewError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


REVIEW_SCOPE = "THIS_BINDING_CHALLENGE_ONLY"
REVIEWER_CLAIM = "SYNTHETIC_BINDING_REVIEWER"

REVIEW_DIMENSIONS = (
    "runtime_descriptor_reviewed",
    "transport_descriptor_reviewed",
    "endpoint_descriptor_reviewed",
    "runtime_attestation_reviewed",
    "transport_attestation_reviewed",
    "scope_match_reviewed",
    "capability_match_reviewed",
    "lifecycle_reviewed",
)

SUFFICIENCY_BINDINGS = (
    ("runtime_descriptor_reviewed", "runtime_descriptor_sufficient"),
    ("transport_descriptor_reviewed", "transport_descriptor_sufficient"),
    ("endpoint_descriptor_reviewed", "endpoint_descriptor_sufficient"),
    ("runtime_attestation_reviewed", "runtime_attestation_sufficient"),
    ("transport_attestation_reviewed", "transport_attestation_sufficient"),
    ("scope_match_reviewed", "scope_match_valid"),
    ("capability_match_reviewed", "capability_match_valid"),
    ("lifecycle_reviewed", "lifecycle_current_and_valid"),
)

FALSE_EFFECTS = (
    "binding_authorized", "binding_decision_present", "binding_token_created",
    "runtime_binding_created", "transport_binding_created", "live_runtime_enabled",
    "live_runtime_bound", "external_transport_bound", "network_enabled", "user_surface_enabled",
    "send_permit", "send_authority", "response_authority_created", "external_effect_authorized",
    "delivery_attempted", "transport_invoked", "delivery_receipt_created", "action_permit_created",
    "successor_permit_created", "payload_persisted", "credential_material_created",
    "secret_material_created", "proactive_messaging_enabled", "background_messaging_enabled",
    "autonomous_gameplay_enabled", "account_control_enabled", "profiling_enabled",
    "cross_game_scope_enabled", "persistent_binding_created", "stable_core_promotion",
)

COPIED_CHALLENGE_FIELDS = (
    "grant_active_confirmed", "granted_scope", "granted_capability", "granted_duration",
    "runtime_class", "transport_class", "endpoint_class",
)

REFERENCE_FIELDS = (
    "runtime_descriptor_ref", "transport_descriptor_ref", "endpoint_descriptor_ref",
    "runtime_attestation_ref", "transport_attestation_ref",
)


def validate_challenge(item):
    req(item.get("schema_version") == "kontur-game-companion-runtime-transport-binding-challenge-v0.1", "challenge schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "challenge status")
    decisions = {
        "NOT_APPLICABLE", "BINDING_NOT_REQUESTED", "RUNTIME_DESCRIPTOR_REQUIRED",
        "TRANSPORT_DESCRIPTOR_REQUIRED", "ENDPOINT_DESCRIPTOR_REQUIRED", "RUNTIME_ATTESTATION_REQUIRED",
        "TRANSPORT_ATTESTATION_REQUIRED", "SCOPE_MATCH_REVIEW_REQUIRED", "CAPABILITY_MATCH_REVIEW_REQUIRED",
        "LIFECYCLE_CHECK_REQUIRED", "READY_FOR_BINDING_REVIEW",
    }
    req(item.get("decision") in decisions, "challenge decision")
    req(item.get("binding_challenge_scope") == binding.BINDING_SCOPE, "challenge scope")
    req(item.get("binding_challenge_digest") == binding.sha({k: v for k, v in item.items() if k != "binding_challenge_digest"}), "challenge digest")
    for field in binding.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream challenge effect: {field}")
    req(item.get("runtime_connectedness") == "AUTHORITY_PLANE_ONLY_NOT_BOUND", "challenge connectedness")
    ready = item["decision"] == "READY_FOR_BINDING_REVIEW"
    req(item.get("binding_review_ready") is ready, "review readiness")
    if ready:
        req(item.get("grant_active_confirmed") is True, "active grant required")
        for field in REFERENCE_FIELDS:
            req(isinstance(item.get(field), str) and len(item[field]) == 64, f"ready reference: {field}")
        for field in (
            "runtime_attestation_present", "transport_attestation_present", "scope_match_asserted",
            "capability_match_asserted", "grant_lifecycle_checked", "grant_not_revoked_confirmed",
            "grant_not_expired_confirmed",
        ):
            req(item.get(field) is True, f"ready marker: {field}")
        for field in (
            "descriptor_sufficiency_evaluated", "attestation_sufficiency_evaluated",
            "runtime_identity_proven", "transport_identity_proven", "endpoint_validated",
            "scope_binding_validated", "capability_binding_validated",
        ):
            req(item.get(field) is False, f"review performed upstream: {field}")


def default_review_context(item):
    validate_challenge(item)
    ctx = {
        "schema_version": "kontur-game-companion-runtime-transport-binding-review-context-v0.1",
        "source_binding_challenge_digest": item["binding_challenge_digest"],
        "review_scope": REVIEW_SCOPE,
        "reviewer_claim": REVIEWER_CLAIM,
        "independent_review_asserted": True,
        "binding_decision_present": False,
        "binding_token_present": False,
        "runtime_binding_present": False,
        "transport_binding_present": False,
        "send_permit_available": False,
        "network_enabled": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in REFERENCE_FIELDS:
        ctx[field] = item.get(field)
    for field in REVIEW_DIMENSIONS:
        ctx[field] = False
    for _, field in SUFFICIENCY_BINDINGS:
        ctx[field] = False
    return ctx


def validate_review_context(item, ctx):
    validate_challenge(item)
    req(ctx.get("schema_version") == "kontur-game-companion-runtime-transport-binding-review-context-v0.1", "review context schema")
    req(ctx.get("source_binding_challenge_digest") == item.get("binding_challenge_digest"), "challenge binding")
    req(ctx.get("review_scope") == REVIEW_SCOPE, "review scope")
    req(ctx.get("reviewer_claim") == REVIEWER_CLAIM, "reviewer claim")
    req(ctx.get("independent_review_asserted") is True, "independent review assertion")
    for field in REFERENCE_FIELDS:
        req(ctx.get(field) == item.get(field), f"reference binding: {field}")
    for field in REVIEW_DIMENSIONS:
        req(type(ctx.get(field)) is bool, f"review marker: {field}")
    for reviewed, result in SUFFICIENCY_BINDINGS:
        req(type(ctx.get(result)) is bool, f"review outcome: {result}")
        if ctx[result]:
            req(ctx[reviewed] is True, f"outcome without review: {result}")
    for field in (
        "binding_decision_present", "binding_token_present", "runtime_binding_present",
        "transport_binding_present", "send_permit_available", "network_enabled",
    ):
        req(ctx.get(field) is False, f"forbidden review context effect: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "review context effects")
    if item["decision"] != "READY_FOR_BINDING_REVIEW":
        for field in REVIEW_DIMENSIONS:
            req(ctx[field] is False, "review before challenge ready")
        for _, result in SUFFICIENCY_BINDINGS:
            req(ctx[result] is False, "review outcome before challenge ready")


def _decision(item, ctx):
    applicable = item["decision"] == "READY_FOR_BINDING_REVIEW"
    all_reviewed = applicable and all(ctx[field] for field in REVIEW_DIMENSIONS)
    if not applicable:
        return "NOT_APPLICABLE", "BINDING_CHALLENGE_NOT_READY_FOR_REVIEW"
    if not all_reviewed:
        return "REVIEW_INCOMPLETE", "ONE_OR_MORE_BINDING_REVIEW_DIMENSIONS_INCOMPLETE"
    ordered = (
        ("runtime_descriptor_sufficient", "REVIEW_REJECTED_RUNTIME_DESCRIPTOR", "RUNTIME_DESCRIPTOR_INSUFFICIENT"),
        ("transport_descriptor_sufficient", "REVIEW_REJECTED_TRANSPORT_DESCRIPTOR", "TRANSPORT_DESCRIPTOR_INSUFFICIENT"),
        ("endpoint_descriptor_sufficient", "REVIEW_REJECTED_ENDPOINT_DESCRIPTOR", "ENDPOINT_DESCRIPTOR_OUTSIDE_BOUNDED_BINDING_REQUIREMENTS"),
        ("runtime_attestation_sufficient", "REVIEW_REJECTED_RUNTIME_ATTESTATION", "RUNTIME_ATTESTATION_INSUFFICIENT"),
        ("transport_attestation_sufficient", "REVIEW_REJECTED_TRANSPORT_ATTESTATION", "TRANSPORT_ATTESTATION_INSUFFICIENT"),
        ("scope_match_valid", "REVIEW_REJECTED_SCOPE", "BINDING_SCOPE_DOES_NOT_MATCH_ACTIVE_GRANT"),
        ("capability_match_valid", "REVIEW_REJECTED_CAPABILITY", "BINDING_CAPABILITY_DOES_NOT_MATCH_ACTIVE_GRANT"),
        ("lifecycle_current_and_valid", "REVIEW_REJECTED_LIFECYCLE", "GRANT_LIFECYCLE_NOT_CURRENT_FOR_BINDING"),
    )
    for field, decision, reason in ordered:
        if not ctx[field]:
            return decision, reason
    return "REVIEW_COMPLETE_BINDING_REQUIRED", "BOUNDED_BINDING_REVIEW_COMPLETE_SEPARATE_BINDING_STEP_REQUIRED"


def review(item, review_context=None):
    validate_challenge(item)
    ctx = default_review_context(item) if review_context is None else copy.deepcopy(review_context)
    validate_review_context(item, ctx)
    decision, reason = _decision(item, ctx)
    applicable = item["decision"] == "READY_FOR_BINDING_REVIEW"
    all_reviewed = applicable and all(ctx[field] for field in REVIEW_DIMENSIONS)
    descriptor_reviewed = applicable and all(ctx[f] for f in ("runtime_descriptor_reviewed", "transport_descriptor_reviewed", "endpoint_descriptor_reviewed"))
    attestation_reviewed = applicable and all(ctx[f] for f in ("runtime_attestation_reviewed", "transport_attestation_reviewed"))
    complete = decision == "REVIEW_COMPLETE_BINDING_REQUIRED"

    out = {
        "schema_version": "kontur-game-companion-runtime-transport-binding-review-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_binding_challenge_digest": item["binding_challenge_digest"],
        "review_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "binding_review_receipt_scope": REVIEW_SCOPE,
        "reviewer_claim": ctx["reviewer_claim"],
        "independent_review_asserted": True,
        "reviewer_identity_proven": False,
        "independent_review_proven": False,
        "descriptor_sufficiency_evaluated": descriptor_reviewed,
        "attestation_sufficiency_evaluated": attestation_reviewed,
        "review_completed": all_reviewed,
        "binding_sufficiency_confirmed": complete,
        "separate_binding_step_required": complete,
        "runtime_identity_proven": False,
        "transport_identity_proven": False,
        "endpoint_credential_created": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "AUTHORITY_PLANE_ONLY_NOT_BOUND",
    }
    for field in COPIED_CHALLENGE_FIELDS:
        out[field] = item.get(field)
    for field in REFERENCE_FIELDS:
        out[field] = ctx[field]
    mappings = (
        ("runtime_descriptor_reviewed", "runtime_descriptor_sufficient_for_binding", "runtime_descriptor_sufficient"),
        ("transport_descriptor_reviewed", "transport_descriptor_sufficient_for_binding", "transport_descriptor_sufficient"),
        ("endpoint_descriptor_reviewed", "endpoint_descriptor_sufficient_for_binding", "endpoint_descriptor_sufficient"),
        ("runtime_attestation_reviewed", "runtime_attestation_sufficient_for_binding", "runtime_attestation_sufficient"),
        ("transport_attestation_reviewed", "transport_attestation_sufficient_for_binding", "transport_attestation_sufficient"),
        ("scope_match_reviewed", "scope_match_valid_for_binding", "scope_match_valid"),
        ("capability_match_reviewed", "capability_match_valid_for_binding", "capability_match_valid"),
        ("lifecycle_reviewed", "lifecycle_current_and_valid_for_binding", "lifecycle_current_and_valid"),
    )
    for reviewed, receipt_result, ctx_result in mappings:
        out[reviewed] = ctx[reviewed]
        out[receipt_result] = ctx[ctx_result]
    for field in FALSE_EFFECTS:
        out[field] = False
    validate_receipt(item, ctx, out)
    out["binding_review_receipt_digest"] = sha(out)
    return out


def validate_receipt(item, ctx, out):
    validate_review_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-runtime-transport-binding-review-receipt-v0.1", "receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "receipt status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "receipt source")
    req(out.get("source_binding_challenge_digest") == item.get("binding_challenge_digest"), "challenge digest binding")
    req(out.get("review_context_digest") == sha(ctx), "review context digest")
    expected_decision, expected_reason = _decision(item, ctx)
    req(out.get("decision") == expected_decision, "receipt decision state")
    req(out.get("reason") == expected_reason, "receipt reason state")
    req(out.get("binding_review_receipt_scope") == REVIEW_SCOPE, "receipt scope")
    req(out.get("reviewer_claim") == REVIEWER_CLAIM, "reviewer binding")
    req(out.get("independent_review_asserted") is True, "independent review marker")
    req(out.get("reviewer_identity_proven") is False and out.get("independent_review_proven") is False, "reviewer proof overclaim")
    for field in COPIED_CHALLENGE_FIELDS:
        req(out.get(field) == item.get(field), f"challenge field binding: {field}")
    for field in REFERENCE_FIELDS:
        req(out.get(field) == ctx.get(field), f"receipt ref binding: {field}")

    mappings = (
        ("runtime_descriptor_reviewed", "runtime_descriptor_sufficient_for_binding", "runtime_descriptor_sufficient"),
        ("transport_descriptor_reviewed", "transport_descriptor_sufficient_for_binding", "transport_descriptor_sufficient"),
        ("endpoint_descriptor_reviewed", "endpoint_descriptor_sufficient_for_binding", "endpoint_descriptor_sufficient"),
        ("runtime_attestation_reviewed", "runtime_attestation_sufficient_for_binding", "runtime_attestation_sufficient"),
        ("transport_attestation_reviewed", "transport_attestation_sufficient_for_binding", "transport_attestation_sufficient"),
        ("scope_match_reviewed", "scope_match_valid_for_binding", "scope_match_valid"),
        ("capability_match_reviewed", "capability_match_valid_for_binding", "capability_match_valid"),
        ("lifecycle_reviewed", "lifecycle_current_and_valid_for_binding", "lifecycle_current_and_valid"),
    )
    for reviewed, receipt_result, ctx_result in mappings:
        req(out.get(reviewed) is ctx.get(reviewed), f"review marker binding: {reviewed}")
        req(out.get(receipt_result) is ctx.get(ctx_result), f"review outcome binding: {receipt_result}")

    applicable = item["decision"] == "READY_FOR_BINDING_REVIEW"
    expected_all_reviewed = applicable and all(ctx[field] for field in REVIEW_DIMENSIONS)
    expected_descriptor_reviewed = applicable and all(ctx[f] for f in ("runtime_descriptor_reviewed", "transport_descriptor_reviewed", "endpoint_descriptor_reviewed"))
    expected_attestation_reviewed = applicable and all(ctx[f] for f in ("runtime_attestation_reviewed", "transport_attestation_reviewed"))
    req(out.get("review_completed") is expected_all_reviewed, "review completion")
    req(out.get("descriptor_sufficiency_evaluated") is expected_descriptor_reviewed, "descriptor sufficiency evaluation")
    req(out.get("attestation_sufficiency_evaluated") is expected_attestation_reviewed, "attestation sufficiency evaluation")
    complete = expected_decision == "REVIEW_COMPLETE_BINDING_REQUIRED"
    req(out.get("binding_sufficiency_confirmed") is complete, "binding sufficiency marker")
    req(out.get("separate_binding_step_required") is complete, "binding step marker")
    req(out.get("runtime_identity_proven") is False and out.get("transport_identity_proven") is False, "identity proof overclaim")
    req(out.get("endpoint_credential_created") is False, "endpoint credential overclaim")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"review receipt effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "receipt effects")
    req(out.get("runtime_connectedness") == "AUTHORITY_PLANE_ONLY_NOT_BOUND", "receipt connectedness")


if __name__ == "__main__":
    print("runtime transport binding review is library-first; run validate.py")
