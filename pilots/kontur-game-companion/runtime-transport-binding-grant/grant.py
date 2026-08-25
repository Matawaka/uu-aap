#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = ROOT / "runtime-transport-binding-review" / "review.py"

spec = importlib.util.spec_from_file_location("binding_grant_review_source", REVIEW)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class RuntimeTransportBindingGrantError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise RuntimeTransportBindingGrantError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


GRANTED_SCOPE = "THIS_REVIEWED_BINDING_ONLY"
GRANTED_CAPABILITY = "MATERIALIZE_REVIEWED_SYNTHETIC_BINDING"
GRANTED_DURATION = "ONE_SESSION"
EXPIRY_BOUNDARY = "SESSION_END"
REVOCATION_MODE = "EXPLICIT_OR_SESSION_END"
GRANTOR_CLAIM = "SYNTHETIC_BINDING_GRANT_AUTHORITY"

REFERENCE_FIELDS = (
    "runtime_descriptor_ref", "transport_descriptor_ref", "endpoint_descriptor_ref",
    "runtime_attestation_ref", "transport_attestation_ref",
)

RUNTIME_FALSE_EFFECTS = (
    "binding_token_created", "bearer_credential_created", "endpoint_credential_created",
    "credential_material_created", "secret_material_created", "real_world_binding_authority_created",
    "runtime_binding_created", "transport_binding_created", "live_runtime_enabled", "live_runtime_bound",
    "external_transport_bound", "network_enabled", "user_surface_enabled", "send_permit", "send_authority",
    "response_authority_created", "external_effect_authorized", "delivery_attempted", "transport_invoked",
    "delivery_receipt_created", "action_permit_created", "successor_permit_created", "payload_persisted",
    "proactive_messaging_enabled", "background_messaging_enabled", "autonomous_gameplay_enabled",
    "account_control_enabled", "profiling_enabled", "cross_game_scope_enabled", "cross_session_binding_enabled",
    "persistent_binding_created", "stable_core_promotion",
)


def validate_review_receipt(receipt):
    req(receipt.get("schema_version") == "kontur-game-companion-runtime-transport-binding-review-receipt-v0.1", "review receipt schema")
    req(receipt.get("status") == "SYNTHETIC_NON_EXECUTING", "review receipt status")
    req(receipt.get("decision") in {
        "NOT_APPLICABLE", "REVIEW_INCOMPLETE", "REVIEW_REJECTED_RUNTIME_DESCRIPTOR",
        "REVIEW_REJECTED_TRANSPORT_DESCRIPTOR", "REVIEW_REJECTED_ENDPOINT_DESCRIPTOR",
        "REVIEW_REJECTED_RUNTIME_ATTESTATION", "REVIEW_REJECTED_TRANSPORT_ATTESTATION",
        "REVIEW_REJECTED_SCOPE", "REVIEW_REJECTED_CAPABILITY", "REVIEW_REJECTED_LIFECYCLE",
        "REVIEW_COMPLETE_BINDING_REQUIRED",
    }, "review receipt decision")
    req(receipt.get("binding_review_receipt_scope") == review.REVIEW_SCOPE, "review receipt scope")
    req(receipt.get("binding_review_receipt_digest") == review.sha({k: v for k, v in receipt.items() if k != "binding_review_receipt_digest"}), "review receipt digest")
    for field in review.FALSE_EFFECTS:
        req(receipt.get(field) is False, f"upstream review effect: {field}")
    req(receipt.get("runtime_connectedness") == "AUTHORITY_PLANE_ONLY_NOT_BOUND", "upstream connectedness")
    if receipt["decision"] == "REVIEW_COMPLETE_BINDING_REQUIRED":
        req(receipt.get("review_completed") is True, "complete review marker")
        req(receipt.get("descriptor_sufficiency_evaluated") is True, "descriptor review marker")
        req(receipt.get("attestation_sufficiency_evaluated") is True, "attestation review marker")
        req(receipt.get("binding_sufficiency_confirmed") is True, "binding sufficiency")
        req(receipt.get("separate_binding_step_required") is True, "separate binding step")
        for field in REFERENCE_FIELDS:
            req(isinstance(receipt.get(field), str) and len(receipt[field]) == 64, f"review reference: {field}")
    else:
        req(receipt.get("binding_sufficiency_confirmed") is False, "binding sufficiency before complete review")


def revocation_handle_for(receipt):
    return sha({
        "kind": "KONTUR_SYNTHETIC_BINDING_GRANT_REVOCATION_HANDLE_V0.1",
        "source_binding_review_receipt_digest": receipt["binding_review_receipt_digest"],
    })


def default_grant_context(receipt):
    validate_review_receipt(receipt)
    ctx = {
        "schema_version": "kontur-game-companion-runtime-transport-binding-grant-context-v0.1",
        "source_binding_review_receipt_digest": receipt["binding_review_receipt_digest"],
        "grantor_claim": GRANTOR_CLAIM,
        "grant_authority_basis_ref": "9" * 64,
        "grant_issuance_requested": False,
        "granted_scope": GRANTED_SCOPE,
        "granted_capability": GRANTED_CAPABILITY,
        "granted_duration": GRANTED_DURATION,
        "expiry_boundary": EXPIRY_BOUNDARY,
        "revocation_mode": REVOCATION_MODE,
        "revocation_handle": revocation_handle_for(receipt),
        "revocation_requested": False,
        "expiry_boundary_reached": False,
        "binding_materialization_requested": False,
        "credential_material_requested": False,
        "secret_material_requested": False,
        "persistent_binding_requested": False,
        "cross_session_binding_requested": False,
        "automatic_renewal_requested": False,
        "scope_expansion_requested": False,
        "capability_expansion_requested": False,
        "network_enablement_requested": False,
        "user_surface_enablement_requested": False,
        "send_permit_requested": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in REFERENCE_FIELDS:
        ctx[field] = receipt.get(field)
    return ctx


def validate_grant_context(receipt, ctx):
    validate_review_receipt(receipt)
    req(ctx.get("schema_version") == "kontur-game-companion-runtime-transport-binding-grant-context-v0.1", "grant context schema")
    req(ctx.get("source_binding_review_receipt_digest") == receipt.get("binding_review_receipt_digest"), "review binding")
    req(ctx.get("grantor_claim") == GRANTOR_CLAIM, "grantor claim")
    req(isinstance(ctx.get("grant_authority_basis_ref"), str) and len(ctx["grant_authority_basis_ref"]) == 64, "grant basis ref")
    for field in ("grant_issuance_requested", "revocation_requested", "expiry_boundary_reached"):
        req(type(ctx.get(field)) is bool, f"grant lifecycle bool: {field}")
    req(ctx.get("granted_scope") == GRANTED_SCOPE, "grant scope")
    req(ctx.get("granted_capability") == GRANTED_CAPABILITY, "grant capability")
    req(ctx.get("granted_duration") == GRANTED_DURATION, "grant duration")
    req(ctx.get("expiry_boundary") == EXPIRY_BOUNDARY, "grant expiry")
    req(ctx.get("revocation_mode") == REVOCATION_MODE, "revocation mode")
    req(ctx.get("revocation_handle") == revocation_handle_for(receipt), "revocation handle")
    for field in REFERENCE_FIELDS:
        req(ctx.get(field) == receipt.get(field), f"reviewed material binding: {field}")
    for field in (
        "binding_materialization_requested", "credential_material_requested", "secret_material_requested",
        "persistent_binding_requested", "cross_session_binding_requested", "automatic_renewal_requested",
        "scope_expansion_requested", "capability_expansion_requested", "network_enablement_requested",
        "user_surface_enablement_requested", "send_permit_requested",
    ):
        req(ctx.get(field) is False, f"forbidden binding grant request: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "grant context effects")
    if ctx["revocation_requested"] or ctx["expiry_boundary_reached"]:
        req(ctx["grant_issuance_requested"] is True, "lifecycle transition without grant issuance")
    req(not (ctx["revocation_requested"] and ctx["expiry_boundary_reached"]), "revoked and expired simultaneously")
    if receipt["decision"] != "REVIEW_COMPLETE_BINDING_REQUIRED":
        req(ctx["grant_issuance_requested"] is False, "binding grant requested without complete review")
        req(ctx["revocation_requested"] is False and ctx["expiry_boundary_reached"] is False, "lifecycle on non-grantable review")


def grant(receipt, grant_context=None):
    validate_review_receipt(receipt)
    ctx = default_grant_context(receipt) if grant_context is None else copy.deepcopy(grant_context)
    validate_grant_context(receipt, ctx)
    if receipt["decision"] != "REVIEW_COMPLETE_BINDING_REQUIRED":
        decision, reason = "NOT_APPLICABLE", "BINDING_REVIEW_NOT_COMPLETE_FOR_GRANT"
    elif not ctx["grant_issuance_requested"]:
        decision, reason = "BINDING_GRANT_NOT_ISSUED", "SEPARATE_BINDING_GRANT_DECISION_ABSENT"
    elif ctx["revocation_requested"]:
        decision, reason = "BINDING_GRANT_REVOKED", "EXPLICIT_BINDING_GRANT_REVOCATION_APPLIED"
    elif ctx["expiry_boundary_reached"]:
        decision, reason = "BINDING_GRANT_EXPIRED", "BINDING_GRANT_SESSION_EXPIRY_BOUNDARY_REACHED"
    else:
        decision, reason = "BOUNDED_BINDING_GRANT_ISSUED", "BOUNDED_SYNTHETIC_BINDING_AUTHORITY_ISSUED"

    historical = decision in {"BOUNDED_BINDING_GRANT_ISSUED", "BINDING_GRANT_REVOKED", "BINDING_GRANT_EXPIRED"}
    active = decision == "BOUNDED_BINDING_GRANT_ISSUED"
    authority_effect = {
        "BOUNDED_BINDING_GRANT_ISSUED": "CREATE_BOUNDED_BINDING_AUTHORITY",
        "BINDING_GRANT_REVOKED": "REVOKE_BOUNDED_BINDING_AUTHORITY",
        "BINDING_GRANT_EXPIRED": "EXPIRE_BOUNDED_BINDING_AUTHORITY",
    }.get(decision, "NONE")

    out = {
        "schema_version": "kontur-game-companion-runtime-transport-binding-grant-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": receipt.get("scope_id"),
        "source_turn": receipt.get("source_turn"),
        "source_binding_review_receipt_digest": receipt["binding_review_receipt_digest"],
        "grant_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "binding_grant_receipt_scope": "THIS_BINDING_GRANT_ONLY",
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
        "binding_grant_historically_issued": historical,
        "binding_grant_currently_active": active,
        "binding_grant_revoked": decision == "BINDING_GRANT_REVOKED",
        "binding_grant_expired": decision == "BINDING_GRANT_EXPIRED",
        "binding_scope_authorized_now": active,
        "binding_capability_authorized_now": active,
        "binding_authority_granted": active,
        "binding_grant_receipt_created": historical,
        "runtime_binding_materialization_required": active,
        "transport_binding_materialization_required": active,
        "send_permit_required_after_binding": active,
        "binding_token_created": False,
        "bearer_credential_created": False,
        "endpoint_credential_created": False,
        "credential_material_created": False,
        "secret_material_created": False,
        "real_world_binding_authority_created": False,
        "runtime_binding_created": False,
        "transport_binding_created": False,
        "live_runtime_enabled": False,
        "live_runtime_bound": False,
        "external_transport_bound": False,
        "network_enabled": False,
        "user_surface_enabled": False,
        "send_permit": False,
        "send_authority": False,
        "response_authority_created": False,
        "external_effect_authorized": False,
        "delivery_attempted": False,
        "transport_invoked": False,
        "delivery_receipt_created": False,
        "action_permit_created": False,
        "successor_permit_created": False,
        "payload_persisted": False,
        "proactive_messaging_enabled": False,
        "background_messaging_enabled": False,
        "autonomous_gameplay_enabled": False,
        "account_control_enabled": False,
        "profiling_enabled": False,
        "cross_game_scope_enabled": False,
        "cross_session_binding_enabled": False,
        "persistent_binding_created": False,
        "stable_core_promotion": False,
        "authority_effect": authority_effect,
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "AUTHORITY_PLANE_ONLY_NOT_BOUND",
    }
    for field in REFERENCE_FIELDS:
        out[field] = ctx[field]
    validate_grant_receipt(receipt, ctx, out)
    out["binding_grant_receipt_digest"] = sha(out)
    return out


def validate_grant_receipt(receipt, ctx, out):
    validate_grant_context(receipt, ctx)
    req(out.get("schema_version") == "kontur-game-companion-runtime-transport-binding-grant-receipt-v0.1", "grant receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "grant receipt status")
    req(out.get("scope_id") == receipt.get("scope_id") and out.get("source_turn") == receipt.get("source_turn"), "grant source")
    req(out.get("source_binding_review_receipt_digest") == receipt.get("binding_review_receipt_digest"), "review digest binding")
    req(out.get("grant_context_digest") == sha(ctx), "grant context binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "BINDING_GRANT_NOT_ISSUED", "BOUNDED_BINDING_GRANT_ISSUED", "BINDING_GRANT_REVOKED", "BINDING_GRANT_EXPIRED"}, "grant decision")
    req(out.get("binding_grant_receipt_scope") == "THIS_BINDING_GRANT_ONLY", "grant receipt scope")
    req(out.get("grantor_claim") == GRANTOR_CLAIM, "grantor binding")
    req(out.get("grantor_identity_proven") is False and out.get("grantor_real_world_authority_proven") is False, "grantor proof overclaim")
    req(out.get("grant_authority_basis_ref") == ctx.get("grant_authority_basis_ref"), "grant basis binding")
    req(out.get("granted_scope") == GRANTED_SCOPE and out.get("granted_capability") == GRANTED_CAPABILITY and out.get("granted_duration") == GRANTED_DURATION, "grant bounds")
    req(out.get("expiry_boundary") == EXPIRY_BOUNDARY and out.get("revocation_mode") == REVOCATION_MODE, "grant lifecycle bounds")
    req(out.get("revocation_handle") == revocation_handle_for(receipt), "revocation handle binding")
    for field in REFERENCE_FIELDS:
        req(out.get(field) == receipt.get(field), f"reviewed material grant binding: {field}")

    if receipt["decision"] != "REVIEW_COMPLETE_BINDING_REQUIRED":
        expected = "NOT_APPLICABLE"
    elif not ctx["grant_issuance_requested"]:
        expected = "BINDING_GRANT_NOT_ISSUED"
    elif ctx["revocation_requested"]:
        expected = "BINDING_GRANT_REVOKED"
    elif ctx["expiry_boundary_reached"]:
        expected = "BINDING_GRANT_EXPIRED"
    else:
        expected = "BOUNDED_BINDING_GRANT_ISSUED"
    req(out.get("decision") == expected, "binding grant lifecycle decision")

    historical = expected in {"BOUNDED_BINDING_GRANT_ISSUED", "BINDING_GRANT_REVOKED", "BINDING_GRANT_EXPIRED"}
    active = expected == "BOUNDED_BINDING_GRANT_ISSUED"
    req(out.get("binding_grant_historically_issued") is historical, "historical grant marker")
    req(out.get("binding_grant_currently_active") is active, "active grant marker")
    req(out.get("binding_grant_revoked") is (expected == "BINDING_GRANT_REVOKED"), "revoked marker")
    req(out.get("binding_grant_expired") is (expected == "BINDING_GRANT_EXPIRED"), "expired marker")
    req(out.get("binding_scope_authorized_now") is active and out.get("binding_capability_authorized_now") is active, "current binding bounds")
    req(out.get("binding_authority_granted") is active, "binding authority marker")
    req(out.get("binding_grant_receipt_created") is historical and out.get("grant_authority_basis_validated_for_synthetic_scope") is historical, "grant issuance marker")
    req(out.get("runtime_binding_materialization_required") is active and out.get("transport_binding_materialization_required") is active, "downstream binding materialization")
    req(out.get("send_permit_required_after_binding") is active, "downstream send permit requirement")

    expected_effect = {
        "BOUNDED_BINDING_GRANT_ISSUED": "CREATE_BOUNDED_BINDING_AUTHORITY",
        "BINDING_GRANT_REVOKED": "REVOKE_BOUNDED_BINDING_AUTHORITY",
        "BINDING_GRANT_EXPIRED": "EXPIRE_BOUNDED_BINDING_AUTHORITY",
    }.get(expected, "NONE")
    req(out.get("authority_effect") == expected_effect, "authority effect")
    req(out.get("action_effect") == out.get("successor_effect") == "NONE", "action/successor effects")
    for field in RUNTIME_FALSE_EFFECTS:
        req(out.get(field) is False, f"binding grant runtime effect: {field}")
    req(out.get("runtime_connectedness") == "AUTHORITY_PLANE_ONLY_NOT_BOUND", "grant connectedness")


if __name__ == "__main__":
    print("runtime transport binding grant is library-first; run validate.py")
