#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = ROOT / "network-user-surface-externalization-review" / "review.py"

spec = importlib.util.spec_from_file_location("network_surface_activation_grant_review", REVIEW)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class NetworkUserSurfaceActivationGrantError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceActivationGrantError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


GRANTED_SCOPE = "THIS_REVIEWED_SYNTHETIC_SURFACE_ONLY"
GRANTED_CAPABILITY = "ACTIVATE_REVIEWED_SYNTHETIC_NETWORK_USER_SURFACE"
GRANTED_DURATION = "ONE_SESSION"
EXPIRY_BOUNDARY = "SESSION_END"
REVOCATION_MODE = "EXPLICIT_OR_SESSION_END"
GRANTOR_CLAIM = "SYNTHETIC_EXTERNALIZATION_ACTIVATION_GRANT_AUTHORITY"
GRANT_RECEIPT_SCOPE = "THIS_ACTIVATION_GRANT_ONLY"

REFERENCE_FIELDS = review.REFERENCE_FIELDS

FORBIDDEN_REQUESTS = (
    "network_enablement_requested",
    "user_surface_enablement_requested",
    "external_transport_binding_requested",
    "live_runtime_enablement_requested",
    "send_permit_requested",
    "send_authority_requested",
    "transport_invocation_requested",
    "delivery_attempt_requested",
    "credential_material_requested",
    "secret_material_requested",
    "endpoint_credential_requested",
    "bearer_credential_requested",
    "payload_persistence_requested",
    "proactive_messaging_requested",
    "background_messaging_requested",
    "autonomous_gameplay_requested",
    "account_control_requested",
    "profiling_requested",
    "persistent_activation_requested",
    "cross_session_activation_requested",
    "cross_game_scope_requested",
    "automatic_renewal_requested",
    "scope_expansion_requested",
    "capability_expansion_requested",
)

FALSE_EFFECTS = (
    "activation_token_created",
    "bearer_credential_created",
    "endpoint_credential_created",
    "credential_material_created",
    "secret_material_created",
    "real_world_activation_authority_created",
    "network_connection_created",
    "user_surface_exposure_created",
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


def validate_review_receipt(item):
    req(item.get("schema_version") == "kontur-game-companion-network-user-surface-externalization-review-receipt-v0.1", "review receipt schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "review receipt status")
    req(item.get("decision") in {
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
    }, "review receipt decision")
    digest = item.get("externalization_review_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "review receipt digest")
    req(digest == review.sha({k: v for k, v in item.items() if k != "externalization_review_receipt_digest"}), "review receipt digest binding")
    req(item.get("externalization_review_scope") == review.REVIEW_SCOPE, "review receipt scope")
    req(item.get("activation_challenge_scope") == review.challenge.ACTIVATION_SCOPE, "reviewed activation scope")
    req(item.get("requested_capability") == review.challenge.REQUESTED_CAPABILITY, "reviewed activation capability")
    for field in review.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream review external effect: {field}")
    req(item.get("runtime_connectedness") == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL", "upstream review connectedness")

    complete = item["decision"] == "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED"
    req(item.get("externalization_sufficiency_confirmed") is complete, "review sufficiency marker")
    req(item.get("separate_activation_step_required") is complete, "separate activation step marker")
    if complete:
        req(item.get("review_completed") is True, "review completion marker")
        for field in (
            "network_contract_sufficient_for_activation",
            "user_surface_contract_sufficient_for_activation",
            "rollback_contract_sufficient_for_activation",
            "delivery_audit_sink_sufficient_for_activation",
            "binding_freshness_valid_for_activation",
            "activation_scope_valid_for_activation",
            "requested_capability_valid_for_activation",
        ):
            req(item.get(field) is True, f"review sufficiency: {field}")
        for field in REFERENCE_FIELDS:
            req(isinstance(item.get(field), str) and len(item[field]) == 64, f"reviewed reference: {field}")


def revocation_handle_for(item):
    return sha({
        "kind": "KONTUR_SYNTHETIC_SURFACE_ACTIVATION_GRANT_REVOCATION_HANDLE_V0.1",
        "source_externalization_review_receipt_digest": item["externalization_review_receipt_digest"],
    })


def default_grant_context(item):
    validate_review_receipt(item)
    ctx = {
        "schema_version": "kontur-game-companion-network-user-surface-activation-grant-context-v0.1",
        "source_externalization_review_receipt_digest": item["externalization_review_receipt_digest"],
        "grantor_claim": GRANTOR_CLAIM,
        "grant_authority_basis_ref": "e" * 64,
        "grant_issuance_requested": False,
        "granted_scope": GRANTED_SCOPE,
        "granted_capability": GRANTED_CAPABILITY,
        "granted_duration": GRANTED_DURATION,
        "expiry_boundary": EXPIRY_BOUNDARY,
        "revocation_mode": REVOCATION_MODE,
        "revocation_handle": revocation_handle_for(item),
        "revocation_requested": False,
        "expiry_boundary_reached": False,
        "activation_challenge_scope": item.get("activation_challenge_scope"),
        "requested_capability": item.get("requested_capability"),
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in REFERENCE_FIELDS:
        ctx[field] = item.get(field)
    for field in FORBIDDEN_REQUESTS:
        ctx[field] = False
    return ctx


def validate_grant_context(item, ctx):
    validate_review_receipt(item)
    req(ctx.get("schema_version") == "kontur-game-companion-network-user-surface-activation-grant-context-v0.1", "grant context schema")
    req(ctx.get("source_externalization_review_receipt_digest") == item.get("externalization_review_receipt_digest"), "review receipt provenance")
    req(ctx.get("grantor_claim") == GRANTOR_CLAIM, "grantor claim")
    req(isinstance(ctx.get("grant_authority_basis_ref"), str) and len(ctx["grant_authority_basis_ref"]) == 64, "grant authority basis ref")
    for field in ("grant_issuance_requested", "revocation_requested", "expiry_boundary_reached"):
        req(type(ctx.get(field)) is bool, f"grant lifecycle bool: {field}")
    req(ctx.get("granted_scope") == GRANTED_SCOPE, "grant scope")
    req(ctx.get("granted_capability") == GRANTED_CAPABILITY, "grant capability")
    req(ctx.get("granted_duration") == GRANTED_DURATION, "grant duration")
    req(ctx.get("expiry_boundary") == EXPIRY_BOUNDARY, "grant expiry")
    req(ctx.get("revocation_mode") == REVOCATION_MODE, "grant revocation mode")
    req(ctx.get("revocation_handle") == revocation_handle_for(item), "grant revocation handle")
    req(ctx.get("activation_challenge_scope") == item.get("activation_challenge_scope"), "activation challenge scope provenance")
    req(ctx.get("requested_capability") == item.get("requested_capability"), "requested capability provenance")
    for field in REFERENCE_FIELDS:
        req(ctx.get(field) == item.get(field), f"reviewed surface binding: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(ctx.get(field) is False, f"forbidden activation grant request: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "grant context effects")
    if ctx["revocation_requested"] or ctx["expiry_boundary_reached"]:
        req(ctx["grant_issuance_requested"] is True, "lifecycle transition without grant issuance")
    req(not (ctx["revocation_requested"] and ctx["expiry_boundary_reached"]), "revoked and expired simultaneously")
    if item["decision"] != "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED":
        req(ctx["grant_issuance_requested"] is False, "activation grant requested without complete review")
        req(ctx["revocation_requested"] is False and ctx["expiry_boundary_reached"] is False, "grant lifecycle on non-grantable review")


def grant(item, grant_context=None):
    validate_review_receipt(item)
    ctx = default_grant_context(item) if grant_context is None else copy.deepcopy(grant_context)
    validate_grant_context(item, ctx)

    if item["decision"] != "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED":
        decision, reason = "NOT_APPLICABLE", "EXTERNALIZATION_REVIEW_NOT_COMPLETE_FOR_ACTIVATION_GRANT"
    elif not ctx["grant_issuance_requested"]:
        decision, reason = "ACTIVATION_GRANT_NOT_ISSUED", "SEPARATE_ACTIVATION_GRANT_DECISION_ABSENT"
    elif ctx["revocation_requested"]:
        decision, reason = "ACTIVATION_GRANT_REVOKED", "EXPLICIT_ACTIVATION_GRANT_REVOCATION_APPLIED"
    elif ctx["expiry_boundary_reached"]:
        decision, reason = "ACTIVATION_GRANT_EXPIRED", "ACTIVATION_GRANT_SESSION_EXPIRY_BOUNDARY_REACHED"
    else:
        decision, reason = "BOUNDED_ACTIVATION_GRANT_ISSUED", "BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY_ISSUED"

    historical = decision in {"BOUNDED_ACTIVATION_GRANT_ISSUED", "ACTIVATION_GRANT_REVOKED", "ACTIVATION_GRANT_EXPIRED"}
    active = decision == "BOUNDED_ACTIVATION_GRANT_ISSUED"
    authority_effect = {
        "BOUNDED_ACTIVATION_GRANT_ISSUED": "CREATE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY",
        "ACTIVATION_GRANT_REVOKED": "REVOKE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY",
        "ACTIVATION_GRANT_EXPIRED": "EXPIRE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY",
    }.get(decision, "NONE")

    out = {
        "schema_version": "kontur-game-companion-network-user-surface-activation-grant-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_externalization_review_receipt_digest": item["externalization_review_receipt_digest"],
        "grant_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "activation_grant_receipt_scope": GRANT_RECEIPT_SCOPE,
        "grantor_claim": ctx["grantor_claim"],
        "grantor_identity_proven": False,
        "grantor_real_world_authority_proven": False,
        "grant_authority_basis_ref": ctx["grant_authority_basis_ref"],
        "grant_authority_basis_validated_for_synthetic_scope": historical,
        "granted_scope": ctx["granted_scope"],
        "granted_capability": ctx["granted_capability"],
        "granted_duration": ctx["granted_duration"],
        "expiry_boundary": ctx["expiry_boundary"],
        "revocation_mode": ctx["revocation_mode"],
        "revocation_handle": ctx["revocation_handle"],
        "activation_challenge_scope": ctx["activation_challenge_scope"],
        "requested_capability": ctx["requested_capability"],
        "activation_grant_historically_issued": historical,
        "activation_grant_currently_active": active,
        "activation_grant_revoked": decision == "ACTIVATION_GRANT_REVOKED",
        "activation_grant_expired": decision == "ACTIVATION_GRANT_EXPIRED",
        "activation_scope_authorized_now": active,
        "activation_capability_authorized_now": active,
        "activation_authority_granted": active,
        "network_activation_authority_granted": active,
        "user_surface_activation_authority_granted": active,
        "activation_grant_receipt_created": historical,
        "activation_materialization_required": active,
        "network_enablement_step_required": active,
        "user_surface_enablement_step_required": active,
        "send_permit_required_after_surface_activation": active,
        "synthetic_authority_only": historical,
        "activation_token_created": False,
        "bearer_credential_created": False,
        "endpoint_credential_created": False,
        "credential_material_created": False,
        "secret_material_created": False,
        "real_world_activation_authority_created": False,
        "network_connection_created": False,
        "user_surface_exposure_created": False,
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
        "authority_effect": authority_effect,
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL",
    }
    for field in REFERENCE_FIELDS:
        out[field] = ctx[field]

    validate_grant_receipt(item, ctx, out)
    out["activation_grant_receipt_digest"] = sha(out)
    return out


def validate_grant_receipt(item, ctx, out):
    validate_grant_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-network-user-surface-activation-grant-receipt-v0.1", "grant receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "grant receipt status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "grant receipt source")
    req(out.get("source_externalization_review_receipt_digest") == item.get("externalization_review_receipt_digest"), "review receipt digest binding")
    req(out.get("grant_context_digest") == sha(ctx), "grant context digest binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "ACTIVATION_GRANT_NOT_ISSUED", "BOUNDED_ACTIVATION_GRANT_ISSUED", "ACTIVATION_GRANT_REVOKED", "ACTIVATION_GRANT_EXPIRED"}, "grant decision")
    req(out.get("activation_grant_receipt_scope") == GRANT_RECEIPT_SCOPE, "grant receipt scope")
    req(out.get("grantor_claim") == GRANTOR_CLAIM, "grantor binding")
    req(out.get("grantor_identity_proven") is False and out.get("grantor_real_world_authority_proven") is False, "grantor proof overclaim")
    req(out.get("grant_authority_basis_ref") == ctx.get("grant_authority_basis_ref"), "grant authority basis binding")
    req(out.get("granted_scope") == GRANTED_SCOPE and out.get("granted_capability") == GRANTED_CAPABILITY and out.get("granted_duration") == GRANTED_DURATION, "grant bounds")
    req(out.get("expiry_boundary") == EXPIRY_BOUNDARY and out.get("revocation_mode") == REVOCATION_MODE, "grant lifecycle bounds")
    req(out.get("revocation_handle") == revocation_handle_for(item), "revocation handle binding")
    req(out.get("activation_challenge_scope") == item.get("activation_challenge_scope"), "activation challenge scope binding")
    req(out.get("requested_capability") == item.get("requested_capability"), "requested capability binding")
    for field in REFERENCE_FIELDS:
        req(out.get(field) == item.get(field), f"reviewed surface grant binding: {field}")

    if item["decision"] != "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED":
        expected = "NOT_APPLICABLE"
    elif not ctx["grant_issuance_requested"]:
        expected = "ACTIVATION_GRANT_NOT_ISSUED"
    elif ctx["revocation_requested"]:
        expected = "ACTIVATION_GRANT_REVOKED"
    elif ctx["expiry_boundary_reached"]:
        expected = "ACTIVATION_GRANT_EXPIRED"
    else:
        expected = "BOUNDED_ACTIVATION_GRANT_ISSUED"
    req(out.get("decision") == expected, "activation grant lifecycle decision")

    historical = expected in {"BOUNDED_ACTIVATION_GRANT_ISSUED", "ACTIVATION_GRANT_REVOKED", "ACTIVATION_GRANT_EXPIRED"}
    active = expected == "BOUNDED_ACTIVATION_GRANT_ISSUED"
    req(out.get("grant_authority_basis_validated_for_synthetic_scope") is historical, "synthetic authority basis marker")
    req(out.get("activation_grant_historically_issued") is historical, "historical issuance marker")
    req(out.get("activation_grant_currently_active") is active, "current grant marker")
    req(out.get("activation_grant_revoked") is (expected == "ACTIVATION_GRANT_REVOKED"), "revocation marker")
    req(out.get("activation_grant_expired") is (expected == "ACTIVATION_GRANT_EXPIRED"), "expiry marker")
    for field in (
        "activation_scope_authorized_now",
        "activation_capability_authorized_now",
        "activation_authority_granted",
        "network_activation_authority_granted",
        "user_surface_activation_authority_granted",
        "activation_materialization_required",
        "network_enablement_step_required",
        "user_surface_enablement_step_required",
        "send_permit_required_after_surface_activation",
    ):
        req(out.get(field) is active, f"active grant marker: {field}")
    req(out.get("activation_grant_receipt_created") is historical, "grant receipt marker")
    req(out.get("synthetic_authority_only") is historical, "synthetic authority scope marker")

    expected_authority_effect = {
        "BOUNDED_ACTIVATION_GRANT_ISSUED": "CREATE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY",
        "ACTIVATION_GRANT_REVOKED": "REVOKE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY",
        "ACTIVATION_GRANT_EXPIRED": "EXPIRE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY",
    }.get(expected, "NONE")
    req(out.get("authority_effect") == expected_authority_effect, "authority effect")
    req(out.get("action_effect") == out.get("successor_effect") == "NONE", "non-authority effects")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"activation grant external effect: {field}")
    req(out.get("runtime_connectedness") == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL", "grant connectedness")
