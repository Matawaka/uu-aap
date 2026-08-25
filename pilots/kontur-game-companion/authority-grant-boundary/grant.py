#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = ROOT / "authority-review-receipt" / "review.py"

spec = importlib.util.spec_from_file_location("authority_grant_review_source", REVIEW)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

class AuthorityGrantError(ValueError):
    pass

def req(condition, message):
    if not condition:
        raise AuthorityGrantError(message)

def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()

GRANTED_SCOPE = review.challenge.REQUEST_SCOPE
GRANTED_CAPABILITY = review.challenge.REQUEST_CAPABILITY
GRANTED_DURATION = review.challenge.DURATION
EXPIRY_BOUNDARY = "SESSION_END"
REVOCATION_MODE = "EXPLICIT_OR_SESSION_END"

RUNTIME_FALSE_EFFECTS = (
    "live_runtime_enabled", "live_runtime_bound", "external_transport_bound", "network_enabled",
    "user_surface_enabled", "send_permit", "send_authority", "response_authority_created",
    "external_effect_authorized", "delivery_attempted", "transport_invoked", "delivery_receipt_created",
    "action_permit_created", "successor_permit_created", "payload_persisted",
    "proactive_messaging_enabled", "background_messaging_enabled", "autonomous_gameplay_enabled",
    "account_control_enabled", "profiling_enabled", "cross_game_scope_enabled", "persistent_authority_created",
    "stable_core_promotion", "grant_token_created", "bearer_credential_created", "real_world_authority_created",
)

def validate_review_receipt(receipt):
    req(receipt.get("schema_version") == "kontur-game-companion-authority-review-receipt-v0.1", "review receipt schema")
    req(receipt.get("status") == "SYNTHETIC_NON_EXECUTING", "review receipt status")
    req(receipt.get("decision") in {
        "NOT_APPLICABLE", "REVIEW_INCOMPLETE", "REVIEW_REJECTED_IDENTITY", "REVIEW_REJECTED_AUTHORITY",
        "REVIEW_REJECTED_SCOPE", "REVIEW_REJECTED_CAPABILITY", "REVIEW_REJECTED_DURATION",
        "REVIEW_COMPLETE_GRANT_REQUIRED",
    }, "review receipt decision")
    req(receipt.get("review_receipt_scope") == "THIS_REVIEW_ONLY", "review receipt scope")
    req(receipt.get("authority_review_receipt_digest") == review.sha({k: v for k, v in receipt.items() if k != "authority_review_receipt_digest"}), "review receipt digest")
    for field in review.FALSE_EFFECTS:
        req(receipt.get(field) is False, f"upstream review effect: {field}")
    req(receipt.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "upstream review runtime")
    if receipt["decision"] == "REVIEW_COMPLETE_GRANT_REQUIRED":
        req(receipt.get("review_completed") is True, "complete review marker")
        req(receipt.get("evidence_sufficiency_evaluated") is True, "review sufficiency marker")
        req(receipt.get("identity_evidence_sufficient_for_request") is True, "identity sufficiency")
        req(receipt.get("authority_basis_sufficient_for_request") is True, "authority sufficiency")
        req(receipt.get("scope_within_reviewed_bounds") is True, "scope review")
        req(receipt.get("capability_within_reviewed_bounds") is True, "capability review")
        req(receipt.get("duration_within_reviewed_bounds") is True, "duration review")
        req(receipt.get("separate_grant_step_required") is True, "grant step required")
    else:
        req(receipt.get("separate_grant_step_required") is False, "grant required before complete review")

def revocation_handle_for(receipt):
    return sha({"kind": "KONTUR_SYNTHETIC_REVOCATION_HANDLE_V0.1", "source_authority_review_receipt_digest": receipt["authority_review_receipt_digest"]})

def default_grant_context(receipt):
    validate_review_receipt(receipt)
    return {
        "schema_version": "kontur-game-companion-authority-grant-context-v0.1",
        "source_authority_review_receipt_digest": receipt["authority_review_receipt_digest"],
        "grantor_claim": "SYNTHETIC_GRANT_AUTHORITY",
        "grant_authority_basis_ref": "3" * 64,
        "grant_issuance_requested": False,
        "granted_scope": GRANTED_SCOPE,
        "granted_capability": GRANTED_CAPABILITY,
        "granted_duration": GRANTED_DURATION,
        "expiry_boundary": EXPIRY_BOUNDARY,
        "revocation_mode": REVOCATION_MODE,
        "revocation_handle": revocation_handle_for(receipt),
        "revocation_requested": False,
        "expiry_boundary_reached": False,
        "bearer_token_requested": False,
        "persistent_authority_requested": False,
        "automatic_renewal_requested": False,
        "scope_expansion_requested": False,
        "capability_expansion_requested": False,
        "transport_binding_requested": False,
        "network_enablement_requested": False,
        "user_surface_enablement_requested": False,
        "send_permit_requested": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }

def validate_grant_context(receipt, ctx):
    validate_review_receipt(receipt)
    req(ctx.get("schema_version") == "kontur-game-companion-authority-grant-context-v0.1", "grant context schema")
    req(ctx.get("source_authority_review_receipt_digest") == receipt.get("authority_review_receipt_digest"), "review binding")
    req(ctx.get("grantor_claim") == "SYNTHETIC_GRANT_AUTHORITY", "grantor claim")
    req(isinstance(ctx.get("grant_authority_basis_ref"), str) and len(ctx["grant_authority_basis_ref"]) == 64, "grant basis ref")
    for field in ("grant_issuance_requested", "revocation_requested", "expiry_boundary_reached"):
        req(type(ctx.get(field)) is bool, f"grant lifecycle bool: {field}")
    req(ctx.get("granted_scope") == GRANTED_SCOPE, "grant scope")
    req(ctx.get("granted_capability") == GRANTED_CAPABILITY, "grant capability")
    req(ctx.get("granted_duration") == GRANTED_DURATION, "grant duration")
    req(ctx.get("expiry_boundary") == EXPIRY_BOUNDARY, "grant expiry")
    req(ctx.get("revocation_mode") == REVOCATION_MODE, "revocation mode")
    req(ctx.get("revocation_handle") == revocation_handle_for(receipt), "revocation handle")
    for field in (
        "bearer_token_requested", "persistent_authority_requested", "automatic_renewal_requested",
        "scope_expansion_requested", "capability_expansion_requested", "transport_binding_requested",
        "network_enablement_requested", "user_surface_enablement_requested", "send_permit_requested",
    ):
        req(ctx.get(field) is False, f"forbidden grant request: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "grant context effects")
    if ctx["revocation_requested"] or ctx["expiry_boundary_reached"]:
        req(ctx["grant_issuance_requested"] is True, "lifecycle transition without grant issuance")
    req(not (ctx["revocation_requested"] and ctx["expiry_boundary_reached"]), "revoked and expired simultaneously")
    if receipt["decision"] != "REVIEW_COMPLETE_GRANT_REQUIRED":
        req(ctx["grant_issuance_requested"] is False, "grant requested without complete review")
        req(ctx["revocation_requested"] is False and ctx["expiry_boundary_reached"] is False, "lifecycle on non-grantable review")

def grant(receipt, grant_context=None):
    validate_review_receipt(receipt)
    ctx = default_grant_context(receipt) if grant_context is None else copy.deepcopy(grant_context)
    validate_grant_context(receipt, ctx)
    if receipt["decision"] != "REVIEW_COMPLETE_GRANT_REQUIRED":
        decision, reason = "NOT_APPLICABLE", "REVIEW_NOT_COMPLETE_FOR_GRANT"
    elif not ctx["grant_issuance_requested"]:
        decision, reason = "GRANT_NOT_ISSUED", "SEPARATE_GRANT_DECISION_ABSENT"
    elif ctx["revocation_requested"]:
        decision, reason = "GRANT_REVOKED", "EXPLICIT_REVOCATION_APPLIED"
    elif ctx["expiry_boundary_reached"]:
        decision, reason = "GRANT_EXPIRED", "SESSION_EXPIRY_BOUNDARY_REACHED"
    else:
        decision, reason = "BOUNDED_GRANT_ISSUED", "SYNTHETIC_BOUNDED_EXTERNALIZATION_AUTHORITY_ISSUED"
    historical = decision in {"BOUNDED_GRANT_ISSUED", "GRANT_REVOKED", "GRANT_EXPIRED"}
    active = decision == "BOUNDED_GRANT_ISSUED"
    authority_effect = {
        "BOUNDED_GRANT_ISSUED": "CREATE_BOUNDED_EXTERNALIZATION_AUTHORITY",
        "GRANT_REVOKED": "REVOKE_BOUNDED_EXTERNALIZATION_AUTHORITY",
        "GRANT_EXPIRED": "EXPIRE_BOUNDED_EXTERNALIZATION_AUTHORITY",
    }.get(decision, "NONE")
    out = {
        "schema_version": "kontur-game-companion-authority-grant-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": receipt.get("scope_id"),
        "source_turn": receipt.get("source_turn"),
        "source_authority_review_receipt_digest": receipt["authority_review_receipt_digest"],
        "grant_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "grant_receipt_scope": "THIS_GRANT_ONLY",
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
        "grant_historically_issued": historical,
        "grant_currently_active": active,
        "grant_revoked": decision == "GRANT_REVOKED",
        "grant_expired": decision == "GRANT_EXPIRED",
        "scope_authorized_now": active,
        "capability_authorized_now": active,
        "externalization_authority_granted": active,
        "grant_receipt_created": historical,
        "grant_token_created": False,
        "bearer_credential_created": False,
        "real_world_authority_created": False,
        "transport_binding_required": active,
        "runtime_activation_required": active,
        "send_permit_required": active,
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
        "persistent_authority_created": False,
        "stable_core_promotion": False,
        "authority_effect": authority_effect,
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "SHADOW_ONLY_NOT_LIVE",
    }
    validate_grant_receipt(receipt, ctx, out)
    out["authority_grant_receipt_digest"] = sha(out)
    return out

def validate_grant_receipt(receipt, ctx, out):
    validate_grant_context(receipt, ctx)
    req(out.get("schema_version") == "kontur-game-companion-authority-grant-receipt-v0.1", "grant receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "grant receipt status")
    req(out.get("scope_id") == receipt.get("scope_id") and out.get("source_turn") == receipt.get("source_turn"), "grant source")
    req(out.get("source_authority_review_receipt_digest") == receipt.get("authority_review_receipt_digest"), "grant review binding")
    req(out.get("grant_context_digest") == sha(ctx), "grant context binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "GRANT_NOT_ISSUED", "BOUNDED_GRANT_ISSUED", "GRANT_REVOKED", "GRANT_EXPIRED"}, "grant decision")
    req(out.get("grant_receipt_scope") == "THIS_GRANT_ONLY", "grant receipt scope")
    req(out.get("grantor_claim") == ctx["grantor_claim"], "grantor binding")
    req(out.get("grantor_identity_proven") is False and out.get("grantor_real_world_authority_proven") is False, "grantor proof overclaim")
    req(out.get("grant_authority_basis_ref") == ctx["grant_authority_basis_ref"], "grant basis binding")
    req(out.get("granted_scope") == GRANTED_SCOPE and out.get("granted_capability") == GRANTED_CAPABILITY and out.get("granted_duration") == GRANTED_DURATION, "granted bounds")
    req(out.get("expiry_boundary") == EXPIRY_BOUNDARY and out.get("revocation_mode") == REVOCATION_MODE, "grant lifecycle bounds")
    req(out.get("revocation_handle") == revocation_handle_for(receipt), "revocation handle binding")
    if receipt["decision"] != "REVIEW_COMPLETE_GRANT_REQUIRED": expected = "NOT_APPLICABLE"
    elif not ctx["grant_issuance_requested"]: expected = "GRANT_NOT_ISSUED"
    elif ctx["revocation_requested"]: expected = "GRANT_REVOKED"
    elif ctx["expiry_boundary_reached"]: expected = "GRANT_EXPIRED"
    else: expected = "BOUNDED_GRANT_ISSUED"
    req(out["decision"] == expected, "grant lifecycle decision")
    historical = expected in {"BOUNDED_GRANT_ISSUED", "GRANT_REVOKED", "GRANT_EXPIRED"}
    active = expected == "BOUNDED_GRANT_ISSUED"
    req(out.get("grant_historically_issued") is historical, "historical grant marker")
    req(out.get("grant_currently_active") is active, "active grant marker")
    req(out.get("grant_revoked") is (expected == "GRANT_REVOKED") and out.get("grant_expired") is (expected == "GRANT_EXPIRED"), "terminal lifecycle marker")
    req(out.get("scope_authorized_now") is active and out.get("capability_authorized_now") is active, "current scope/capability")
    req(out.get("externalization_authority_granted") is active, "externalization authority marker")
    req(out.get("grant_receipt_created") is historical and out.get("grant_authority_basis_validated_for_synthetic_scope") is historical, "grant issuance marker")
    req(out.get("transport_binding_required") is active and out.get("runtime_activation_required") is active and out.get("send_permit_required") is active, "downstream requirements")
    expected_effect = {"BOUNDED_GRANT_ISSUED": "CREATE_BOUNDED_EXTERNALIZATION_AUTHORITY", "GRANT_REVOKED": "REVOKE_BOUNDED_EXTERNALIZATION_AUTHORITY", "GRANT_EXPIRED": "EXPIRE_BOUNDED_EXTERNALIZATION_AUTHORITY"}.get(expected, "NONE")
    req(out.get("authority_effect") == expected_effect, "authority effect")
    req(out.get("action_effect") == out.get("successor_effect") == "NONE", "action/successor effects")
    for field in RUNTIME_FALSE_EFFECTS:
        req(out.get(field) is False, f"grant runtime effect: {field}")
    req(out.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "grant runtime connectedness")

if __name__ == "__main__":
    print("authority grant boundary is library-first; run validate.py")
