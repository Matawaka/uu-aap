#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GRANT = ROOT / "authority-grant-boundary" / "grant.py"

spec = importlib.util.spec_from_file_location("runtime_transport_binding_grant_source", GRANT)
grant = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grant)


class RuntimeTransportBindingError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise RuntimeTransportBindingError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


RUNTIME_CLASS = "SYNTHETIC_KONTUR_COMPANION_RUNTIME_V0.1"
TRANSPORT_CLASS = "SYNTHETIC_ONE_WAY_RESPONSE_TRANSPORT_V0.1"
ENDPOINT_CLASS = "SYNTHETIC_ENDPOINT_DESCRIPTOR_ONLY"
BINDING_SCOPE = "THIS_ACTIVE_GRANT_ONLY"

FALSE_EFFECTS = (
    "binding_authorized",
    "runtime_binding_created",
    "transport_binding_created",
    "live_runtime_enabled",
    "live_runtime_bound",
    "external_transport_bound",
    "network_enabled",
    "user_surface_enabled",
    "send_permit",
    "send_authority",
    "response_authority_created",
    "external_effect_authorized",
    "delivery_attempted",
    "transport_invoked",
    "delivery_receipt_created",
    "action_permit_created",
    "successor_permit_created",
    "payload_persisted",
    "credential_material_created",
    "secret_material_created",
    "proactive_messaging_enabled",
    "background_messaging_enabled",
    "autonomous_gameplay_enabled",
    "account_control_enabled",
    "profiling_enabled",
    "cross_game_scope_enabled",
    "persistent_binding_created",
    "stable_core_promotion",
)

FORBIDDEN_REQUESTS = (
    "credential_material_requested",
    "secret_material_requested",
    "network_enablement_requested",
    "user_surface_enablement_requested",
    "send_permit_requested",
    "proactive_messaging_requested",
    "background_messaging_requested",
    "persistent_binding_requested",
    "cross_session_binding_requested",
    "scope_expansion_requested",
    "capability_expansion_requested",
    "raw_endpoint_locator_requested",
)


def validate_grant_receipt(item):
    req(item.get("schema_version") == "kontur-game-companion-authority-grant-receipt-v0.1", "grant schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "grant status")
    req(item.get("decision") in {"NOT_APPLICABLE", "GRANT_NOT_ISSUED", "BOUNDED_GRANT_ISSUED", "GRANT_REVOKED", "GRANT_EXPIRED"}, "grant decision")
    req(item.get("grant_receipt_scope") == "THIS_GRANT_ONLY", "grant receipt scope")
    req(item.get("granted_scope") == grant.GRANTED_SCOPE, "grant scope")
    req(item.get("granted_capability") == grant.GRANTED_CAPABILITY, "grant capability")
    req(item.get("granted_duration") == grant.GRANTED_DURATION, "grant duration")
    req(item.get("authority_grant_receipt_digest") == grant.sha({k: v for k, v in item.items() if k != "authority_grant_receipt_digest"}), "grant digest")
    active = item["decision"] == "BOUNDED_GRANT_ISSUED"
    req(item.get("grant_currently_active") is active, "grant active marker")
    req(item.get("externalization_authority_granted") is active, "grant authority marker")
    req(item.get("scope_authorized_now") is active and item.get("capability_authorized_now") is active, "grant current bounds")
    req(item.get("transport_binding_required") is active, "transport binding requirement")
    req(item.get("runtime_activation_required") is active, "runtime activation requirement")
    req(item.get("send_permit_required") is active, "send permit requirement")
    for field in grant.RUNTIME_FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream grant runtime effect: {field}")
    req(item.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "upstream grant connectedness")


def default_binding_context(item):
    validate_grant_receipt(item)
    return {
        "schema_version": "kontur-game-companion-runtime-transport-binding-context-v0.1",
        "source_authority_grant_receipt_digest": item["authority_grant_receipt_digest"],
        "binding_requested": False,
        "binding_scope": BINDING_SCOPE,
        "requested_scope": item["granted_scope"],
        "requested_capability": item["granted_capability"],
        "runtime_class": RUNTIME_CLASS,
        "transport_class": TRANSPORT_CLASS,
        "endpoint_class": ENDPOINT_CLASS,
        "runtime_descriptor_ref": None,
        "transport_descriptor_ref": None,
        "endpoint_descriptor_ref": None,
        "runtime_attestation_present": False,
        "runtime_attestation_ref": None,
        "transport_attestation_present": False,
        "transport_attestation_ref": None,
        "scope_match_asserted": False,
        "capability_match_asserted": False,
        "grant_lifecycle_checked": False,
        "grant_not_revoked_confirmed": False,
        "grant_not_expired_confirmed": False,
        "credential_material_requested": False,
        "secret_material_requested": False,
        "network_enablement_requested": False,
        "user_surface_enablement_requested": False,
        "send_permit_requested": False,
        "proactive_messaging_requested": False,
        "background_messaging_requested": False,
        "persistent_binding_requested": False,
        "cross_session_binding_requested": False,
        "scope_expansion_requested": False,
        "capability_expansion_requested": False,
        "raw_endpoint_locator_requested": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }


def _ref_or_none(value, name):
    req(value is None or (isinstance(value, str) and len(value) == 64), name)


def validate_binding_context(item, ctx):
    validate_grant_receipt(item)
    req(ctx.get("schema_version") == "kontur-game-companion-runtime-transport-binding-context-v0.1", "binding context schema")
    req(ctx.get("source_authority_grant_receipt_digest") == item.get("authority_grant_receipt_digest"), "grant binding")
    req(type(ctx.get("binding_requested")) is bool, "binding requested bool")
    req(ctx.get("binding_scope") == BINDING_SCOPE, "binding scope")
    req(ctx.get("requested_scope") == item.get("granted_scope"), "requested scope")
    req(ctx.get("requested_capability") == item.get("granted_capability"), "requested capability")
    req(ctx.get("runtime_class") == RUNTIME_CLASS, "runtime class")
    req(ctx.get("transport_class") == TRANSPORT_CLASS, "transport class")
    req(ctx.get("endpoint_class") == ENDPOINT_CLASS, "endpoint class")
    for field in ("runtime_descriptor_ref", "transport_descriptor_ref", "endpoint_descriptor_ref"):
        _ref_or_none(ctx.get(field), field)
    for marker, ref in (("runtime_attestation_present", "runtime_attestation_ref"), ("transport_attestation_present", "transport_attestation_ref")):
        req(type(ctx.get(marker)) is bool, marker)
        _ref_or_none(ctx.get(ref), ref)
        if ctx[marker]:
            req(isinstance(ctx.get(ref), str) and len(ctx[ref]) == 64, f"{ref} required")
        else:
            req(ctx.get(ref) is None, f"{ref} without attestation marker")
    for field in ("scope_match_asserted", "capability_match_asserted", "grant_lifecycle_checked", "grant_not_revoked_confirmed", "grant_not_expired_confirmed"):
        req(type(ctx.get(field)) is bool, field)
    for field in FORBIDDEN_REQUESTS:
        req(ctx.get(field) is False, f"forbidden binding request: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "binding context effects")

    active = item["decision"] == "BOUNDED_GRANT_ISSUED"
    if not active:
        req(ctx["binding_requested"] is False, "binding requested on inactive grant")
    if not ctx["binding_requested"]:
        for field in ("runtime_descriptor_ref", "transport_descriptor_ref", "endpoint_descriptor_ref", "runtime_attestation_ref", "transport_attestation_ref"):
            req(ctx[field] is None, f"binding material before request: {field}")
        for field in ("runtime_attestation_present", "transport_attestation_present", "scope_match_asserted", "capability_match_asserted", "grant_lifecycle_checked", "grant_not_revoked_confirmed", "grant_not_expired_confirmed"):
            req(ctx[field] is False, f"binding assertion before request: {field}")


def evaluate(item, binding_context=None):
    validate_grant_receipt(item)
    ctx = default_binding_context(item) if binding_context is None else copy.deepcopy(binding_context)
    validate_binding_context(item, ctx)
    active = item["decision"] == "BOUNDED_GRANT_ISSUED"

    if not active:
        decision, reason = "NOT_APPLICABLE", "ACTIVE_BOUNDED_GRANT_REQUIRED"
    elif not ctx["binding_requested"]:
        decision, reason = "BINDING_NOT_REQUESTED", "SEPARATE_BINDING_REQUEST_ABSENT"
    elif ctx["runtime_descriptor_ref"] is None:
        decision, reason = "RUNTIME_DESCRIPTOR_REQUIRED", "RUNTIME_DESCRIPTOR_ABSENT"
    elif ctx["transport_descriptor_ref"] is None:
        decision, reason = "TRANSPORT_DESCRIPTOR_REQUIRED", "TRANSPORT_DESCRIPTOR_ABSENT"
    elif ctx["endpoint_descriptor_ref"] is None:
        decision, reason = "ENDPOINT_DESCRIPTOR_REQUIRED", "ENDPOINT_DESCRIPTOR_ABSENT"
    elif not ctx["runtime_attestation_present"]:
        decision, reason = "RUNTIME_ATTESTATION_REQUIRED", "RUNTIME_ATTESTATION_ABSENT"
    elif not ctx["transport_attestation_present"]:
        decision, reason = "TRANSPORT_ATTESTATION_REQUIRED", "TRANSPORT_ATTESTATION_ABSENT"
    elif not ctx["scope_match_asserted"]:
        decision, reason = "SCOPE_MATCH_REVIEW_REQUIRED", "GRANT_SCOPE_MATCH_NOT_ASSERTED"
    elif not ctx["capability_match_asserted"]:
        decision, reason = "CAPABILITY_MATCH_REVIEW_REQUIRED", "GRANT_CAPABILITY_MATCH_NOT_ASSERTED"
    elif not (ctx["grant_lifecycle_checked"] and ctx["grant_not_revoked_confirmed"] and ctx["grant_not_expired_confirmed"]):
        decision, reason = "LIFECYCLE_CHECK_REQUIRED", "CURRENT_GRANT_LIFECYCLE_NOT_CONFIRMED"
    else:
        decision, reason = "READY_FOR_BINDING_REVIEW", "DESCRIPTORS_ATTESTATIONS_AND_GRANT_BOUNDS_PRESENT_FOR_REVIEW"

    out = {
        "schema_version": "kontur-game-companion-runtime-transport-binding-challenge-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_authority_grant_receipt_digest": item["authority_grant_receipt_digest"],
        "binding_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "binding_challenge_scope": BINDING_SCOPE,
        "binding_review_ready": decision == "READY_FOR_BINDING_REVIEW",
        "grant_active_confirmed": active,
        "granted_scope": item["granted_scope"],
        "granted_capability": item["granted_capability"],
        "granted_duration": item["granted_duration"],
        "grant_revocation_handle": item["revocation_handle"],
        "runtime_class": ctx["runtime_class"],
        "transport_class": ctx["transport_class"],
        "endpoint_class": ctx["endpoint_class"],
        "runtime_descriptor_ref": ctx["runtime_descriptor_ref"],
        "transport_descriptor_ref": ctx["transport_descriptor_ref"],
        "endpoint_descriptor_ref": ctx["endpoint_descriptor_ref"],
        "runtime_attestation_present": ctx["runtime_attestation_present"],
        "runtime_attestation_ref": ctx["runtime_attestation_ref"],
        "transport_attestation_present": ctx["transport_attestation_present"],
        "transport_attestation_ref": ctx["transport_attestation_ref"],
        "scope_match_asserted": ctx["scope_match_asserted"],
        "capability_match_asserted": ctx["capability_match_asserted"],
        "grant_lifecycle_checked": ctx["grant_lifecycle_checked"],
        "grant_not_revoked_confirmed": ctx["grant_not_revoked_confirmed"],
        "grant_not_expired_confirmed": ctx["grant_not_expired_confirmed"],
        "descriptor_sufficiency_evaluated": False,
        "attestation_sufficiency_evaluated": False,
        "runtime_identity_proven": False,
        "transport_identity_proven": False,
        "endpoint_validated": False,
        "scope_binding_validated": False,
        "capability_binding_validated": False,
        "binding_authorized": False,
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
        "credential_material_created": False,
        "secret_material_created": False,
        "proactive_messaging_enabled": False,
        "background_messaging_enabled": False,
        "autonomous_gameplay_enabled": False,
        "account_control_enabled": False,
        "profiling_enabled": False,
        "cross_game_scope_enabled": False,
        "persistent_binding_created": False,
        "stable_core_promotion": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "AUTHORITY_PLANE_ONLY_NOT_BOUND",
    }
    validate_challenge(item, ctx, out)
    out["binding_challenge_digest"] = sha(out)
    return out


def validate_challenge(item, ctx, out):
    validate_binding_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-runtime-transport-binding-challenge-v0.1", "challenge schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "challenge status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "challenge source")
    req(out.get("source_authority_grant_receipt_digest") == item.get("authority_grant_receipt_digest"), "challenge grant binding")
    req(out.get("binding_context_digest") == sha(ctx), "challenge context binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "BINDING_NOT_REQUESTED", "RUNTIME_DESCRIPTOR_REQUIRED", "TRANSPORT_DESCRIPTOR_REQUIRED", "ENDPOINT_DESCRIPTOR_REQUIRED", "RUNTIME_ATTESTATION_REQUIRED", "TRANSPORT_ATTESTATION_REQUIRED", "SCOPE_MATCH_REVIEW_REQUIRED", "CAPABILITY_MATCH_REVIEW_REQUIRED", "LIFECYCLE_CHECK_REQUIRED", "READY_FOR_BINDING_REVIEW"}, "challenge decision")
    req(out.get("binding_challenge_scope") == BINDING_SCOPE, "challenge scope")
    req(out.get("binding_review_ready") is (out["decision"] == "READY_FOR_BINDING_REVIEW"), "binding review readiness")
    req(out.get("grant_active_confirmed") is (item["decision"] == "BOUNDED_GRANT_ISSUED"), "grant active binding")
    req(out.get("granted_scope") == item.get("granted_scope") and out.get("granted_capability") == item.get("granted_capability") and out.get("granted_duration") == item.get("granted_duration"), "grant bounds binding")
    req(out.get("grant_revocation_handle") == item.get("revocation_handle"), "revocation binding")
    for field in ("runtime_class", "transport_class", "endpoint_class", "runtime_descriptor_ref", "transport_descriptor_ref", "endpoint_descriptor_ref", "runtime_attestation_present", "runtime_attestation_ref", "transport_attestation_present", "transport_attestation_ref", "scope_match_asserted", "capability_match_asserted", "grant_lifecycle_checked", "grant_not_revoked_confirmed", "grant_not_expired_confirmed"):
        req(out.get(field) == ctx.get(field), f"context projection: {field}")
    for field in ("descriptor_sufficiency_evaluated", "attestation_sufficiency_evaluated", "runtime_identity_proven", "transport_identity_proven", "endpoint_validated", "scope_binding_validated", "capability_binding_validated"):
        req(out.get(field) is False, f"unperformed binding proof: {field}")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"binding challenge effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "challenge effects")
    req(out.get("runtime_connectedness") == "AUTHORITY_PLANE_ONLY_NOT_BOUND", "challenge connectedness")

    active = item["decision"] == "BOUNDED_GRANT_ISSUED"
    if not active:
        expected = "NOT_APPLICABLE"
    elif not ctx["binding_requested"]:
        expected = "BINDING_NOT_REQUESTED"
    elif ctx["runtime_descriptor_ref"] is None:
        expected = "RUNTIME_DESCRIPTOR_REQUIRED"
    elif ctx["transport_descriptor_ref"] is None:
        expected = "TRANSPORT_DESCRIPTOR_REQUIRED"
    elif ctx["endpoint_descriptor_ref"] is None:
        expected = "ENDPOINT_DESCRIPTOR_REQUIRED"
    elif not ctx["runtime_attestation_present"]:
        expected = "RUNTIME_ATTESTATION_REQUIRED"
    elif not ctx["transport_attestation_present"]:
        expected = "TRANSPORT_ATTESTATION_REQUIRED"
    elif not ctx["scope_match_asserted"]:
        expected = "SCOPE_MATCH_REVIEW_REQUIRED"
    elif not ctx["capability_match_asserted"]:
        expected = "CAPABILITY_MATCH_REVIEW_REQUIRED"
    elif not (ctx["grant_lifecycle_checked"] and ctx["grant_not_revoked_confirmed"] and ctx["grant_not_expired_confirmed"]):
        expected = "LIFECYCLE_CHECK_REQUIRED"
    else:
        expected = "READY_FOR_BINDING_REVIEW"
    req(out["decision"] == expected, "challenge progression")


if __name__ == "__main__":
    print("runtime transport binding challenge is library-first; run validate.py")
