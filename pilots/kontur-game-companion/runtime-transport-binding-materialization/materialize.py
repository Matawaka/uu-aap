#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GRANT = ROOT / "runtime-transport-binding-grant" / "grant.py"

spec = importlib.util.spec_from_file_location("binding_materialization_grant_source", GRANT)
grant = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grant)


class RuntimeTransportBindingMaterializationError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise RuntimeTransportBindingMaterializationError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


MATERIALIZATION_SCOPE = "THIS_BINDING_GRANT_ONLY"
MATERIALIZATION_MODE = "LOCAL_SYNTHETIC_DESCRIPTOR_BINDING"
RUNTIME_SLOT = "SYNTHETIC_RUNTIME_SLOT_V0.1"
TRANSPORT_SLOT = "IN_MEMORY_TRANSPORT_SLOT_V0.1"
ENDPOINT_SLOT = "DESCRIPTOR_REFERENCE_ONLY"

REFERENCE_FIELDS = grant.REFERENCE_FIELDS

FORBIDDEN_REQUESTS = (
    "credential_material_requested",
    "secret_material_requested",
    "network_enablement_requested",
    "user_surface_enablement_requested",
    "send_permit_requested",
    "transport_invocation_requested",
    "delivery_attempt_requested",
    "payload_persistence_requested",
    "proactive_messaging_requested",
    "background_messaging_requested",
    "autonomous_gameplay_requested",
    "account_control_requested",
    "profiling_requested",
    "persistent_binding_requested",
    "cross_session_binding_requested",
    "cross_game_scope_requested",
    "scope_expansion_requested",
    "capability_expansion_requested",
    "external_endpoint_locator_requested",
    "live_runtime_activation_requested",
)

EXTERNAL_FALSE_EFFECTS = (
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
    "endpoint_credential_created",
    "bearer_credential_created",
    "binding_token_created",
    "proactive_messaging_enabled",
    "background_messaging_enabled",
    "autonomous_gameplay_enabled",
    "account_control_enabled",
    "profiling_enabled",
    "cross_game_scope_enabled",
    "cross_session_binding_enabled",
    "persistent_binding_created",
    "stable_core_promotion",
)


def validate_binding_grant(item):
    req(item.get("schema_version") == "kontur-game-companion-runtime-transport-binding-grant-receipt-v0.1", "binding grant schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "binding grant status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "BINDING_GRANT_NOT_ISSUED",
        "BOUNDED_BINDING_GRANT_ISSUED",
        "BINDING_GRANT_REVOKED",
        "BINDING_GRANT_EXPIRED",
    }, "binding grant decision")
    req(item.get("binding_grant_receipt_scope") == "THIS_BINDING_GRANT_ONLY", "binding grant receipt scope")
    req(item.get("granted_scope") == grant.GRANTED_SCOPE, "binding grant scope")
    req(item.get("granted_capability") == grant.GRANTED_CAPABILITY, "binding grant capability")
    req(item.get("granted_duration") == grant.GRANTED_DURATION, "binding grant duration")
    req(item.get("binding_grant_receipt_digest") == grant.sha({k: v for k, v in item.items() if k != "binding_grant_receipt_digest"}), "binding grant digest")
    for field in REFERENCE_FIELDS:
        req(isinstance(item.get(field), str) and len(item[field]) == 64, f"binding grant reviewed reference: {field}")
    active = item["decision"] == "BOUNDED_BINDING_GRANT_ISSUED"
    req(item.get("binding_grant_currently_active") is active, "binding grant active marker")
    req(item.get("binding_authority_granted") is active, "binding authority marker")
    req(item.get("binding_scope_authorized_now") is active, "binding scope marker")
    req(item.get("binding_capability_authorized_now") is active, "binding capability marker")
    req(item.get("runtime_binding_materialization_required") is active, "runtime materialization requirement")
    req(item.get("transport_binding_materialization_required") is active, "transport materialization requirement")
    req(item.get("send_permit_required_after_binding") is active, "downstream send permit requirement")
    for field in grant.RUNTIME_FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream binding grant runtime effect: {field}")
    req(item.get("runtime_connectedness") == "AUTHORITY_PLANE_ONLY_NOT_BOUND", "upstream binding grant connectedness")


def default_materialization_context(item):
    validate_binding_grant(item)
    ctx = {
        "schema_version": "kontur-game-companion-runtime-transport-binding-materialization-context-v0.1",
        "source_binding_grant_receipt_digest": item["binding_grant_receipt_digest"],
        "materialization_requested": False,
        "materialization_scope": MATERIALIZATION_SCOPE,
        "materialization_mode": MATERIALIZATION_MODE,
        "runtime_slot": RUNTIME_SLOT,
        "transport_slot": TRANSPORT_SLOT,
        "endpoint_slot": ENDPOINT_SLOT,
        "grant_lifecycle_rechecked": False,
        "grant_not_revoked_confirmed": False,
        "grant_not_expired_confirmed": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in REFERENCE_FIELDS:
        ctx[field] = item[field]
    for field in FORBIDDEN_REQUESTS:
        ctx[field] = False
    return ctx


def validate_materialization_context(item, ctx):
    validate_binding_grant(item)
    req(ctx.get("schema_version") == "kontur-game-companion-runtime-transport-binding-materialization-context-v0.1", "materialization context schema")
    req(ctx.get("source_binding_grant_receipt_digest") == item.get("binding_grant_receipt_digest"), "binding grant provenance")
    req(type(ctx.get("materialization_requested")) is bool, "materialization requested bool")
    req(ctx.get("materialization_scope") == MATERIALIZATION_SCOPE, "materialization scope")
    req(ctx.get("materialization_mode") == MATERIALIZATION_MODE, "materialization mode")
    req(ctx.get("runtime_slot") == RUNTIME_SLOT, "runtime slot")
    req(ctx.get("transport_slot") == TRANSPORT_SLOT, "transport slot")
    req(ctx.get("endpoint_slot") == ENDPOINT_SLOT, "endpoint slot")
    for field in REFERENCE_FIELDS:
        req(ctx.get(field) == item.get(field), f"binding material provenance: {field}")
    for field in ("grant_lifecycle_rechecked", "grant_not_revoked_confirmed", "grant_not_expired_confirmed"):
        req(type(ctx.get(field)) is bool, f"lifecycle marker: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(ctx.get(field) is False, f"forbidden materialization request: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "materialization context effects")

    active = item["decision"] == "BOUNDED_BINDING_GRANT_ISSUED"
    if not active:
        req(ctx["materialization_requested"] is False, "materialization requested on inactive binding grant")
    if not ctx["materialization_requested"]:
        req(ctx["grant_lifecycle_rechecked"] is False, "lifecycle recheck before materialization request")
        req(ctx["grant_not_revoked_confirmed"] is False, "revocation check before materialization request")
        req(ctx["grant_not_expired_confirmed"] is False, "expiry check before materialization request")
    if ctx["grant_not_revoked_confirmed"] or ctx["grant_not_expired_confirmed"]:
        req(ctx["grant_lifecycle_rechecked"] is True, "lifecycle conclusion without lifecycle recheck")


def _runtime_binding_ref(item):
    return sha({
        "kind": "KONTUR_SYNTHETIC_RUNTIME_BINDING_REF_V0.1",
        "source_binding_grant_receipt_digest": item["binding_grant_receipt_digest"],
        "runtime_descriptor_ref": item["runtime_descriptor_ref"],
        "runtime_attestation_ref": item["runtime_attestation_ref"],
        "runtime_slot": RUNTIME_SLOT,
    })


def _transport_binding_ref(item):
    return sha({
        "kind": "KONTUR_SYNTHETIC_TRANSPORT_BINDING_REF_V0.1",
        "source_binding_grant_receipt_digest": item["binding_grant_receipt_digest"],
        "transport_descriptor_ref": item["transport_descriptor_ref"],
        "transport_attestation_ref": item["transport_attestation_ref"],
        "transport_slot": TRANSPORT_SLOT,
    })


def _endpoint_binding_ref(item):
    return sha({
        "kind": "KONTUR_SYNTHETIC_ENDPOINT_BINDING_REF_V0.1",
        "source_binding_grant_receipt_digest": item["binding_grant_receipt_digest"],
        "endpoint_descriptor_ref": item["endpoint_descriptor_ref"],
        "endpoint_slot": ENDPOINT_SLOT,
    })


def _binding_object_digest(item):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_BINDING_OBJECT_V0.1",
        "source_binding_grant_receipt_digest": item["binding_grant_receipt_digest"],
        "runtime_binding_ref": _runtime_binding_ref(item),
        "transport_binding_ref": _transport_binding_ref(item),
        "endpoint_binding_ref": _endpoint_binding_ref(item),
        "scope": MATERIALIZATION_SCOPE,
        "mode": MATERIALIZATION_MODE,
    })


def materialize(item, materialization_context=None):
    validate_binding_grant(item)
    ctx = default_materialization_context(item) if materialization_context is None else copy.deepcopy(materialization_context)
    validate_materialization_context(item, ctx)

    active = item["decision"] == "BOUNDED_BINDING_GRANT_ISSUED"
    lifecycle_current = (
        ctx["grant_lifecycle_rechecked"]
        and ctx["grant_not_revoked_confirmed"]
        and ctx["grant_not_expired_confirmed"]
    )

    if not active:
        decision, reason = "NOT_APPLICABLE", "ACTIVE_BOUNDED_BINDING_GRANT_REQUIRED"
    elif not ctx["materialization_requested"]:
        decision, reason = "BINDING_NOT_MATERIALIZED", "SEPARATE_BINDING_MATERIALIZATION_REQUEST_ABSENT"
    elif not lifecycle_current:
        decision, reason = "LIFECYCLE_RECHECK_REQUIRED", "CURRENT_BINDING_GRANT_LIFECYCLE_NOT_CONFIRMED"
    else:
        decision, reason = "SYNTHETIC_BINDING_MATERIALIZED", "LOCAL_DESCRIPTOR_BOUND_BINDING_ARTIFACT_CREATED"

    materialized = decision == "SYNTHETIC_BINDING_MATERIALIZED"
    runtime_ref = _runtime_binding_ref(item) if materialized else None
    transport_ref = _transport_binding_ref(item) if materialized else None
    endpoint_ref = _endpoint_binding_ref(item) if materialized else None
    object_digest = _binding_object_digest(item) if materialized else None

    out = {
        "schema_version": "kontur-game-companion-runtime-transport-binding-materialization-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_binding_grant_receipt_digest": item["binding_grant_receipt_digest"],
        "materialization_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "binding_materialization_scope": MATERIALIZATION_SCOPE,
        "materialization_mode": MATERIALIZATION_MODE,
        "binding_authority_granted": active,
        "binding_authority_used_for_materialization": materialized,
        "grant_lifecycle_rechecked": ctx["grant_lifecycle_rechecked"],
        "grant_not_revoked_confirmed": ctx["grant_not_revoked_confirmed"],
        "grant_not_expired_confirmed": ctx["grant_not_expired_confirmed"],
        "runtime_slot": RUNTIME_SLOT,
        "transport_slot": TRANSPORT_SLOT,
        "endpoint_slot": ENDPOINT_SLOT,
        "runtime_binding_ref": runtime_ref,
        "transport_binding_ref": transport_ref,
        "endpoint_binding_ref": endpoint_ref,
        "binding_object_digest": object_digest,
        "binding_object_created": materialized,
        "runtime_binding_materialized": materialized,
        "transport_binding_materialized": materialized,
        "endpoint_descriptor_bound_locally": materialized,
        "materialization_local_only": materialized,
        "materialization_reversible": materialized,
        "network_enablement_required_after_binding": materialized,
        "user_surface_enablement_required_after_binding": materialized,
        "send_permit_required_after_binding": materialized,
        "transport_invocation_required_for_external_effect": materialized,
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
        "endpoint_credential_created": False,
        "bearer_credential_created": False,
        "binding_token_created": False,
        "proactive_messaging_enabled": False,
        "background_messaging_enabled": False,
        "autonomous_gameplay_enabled": False,
        "account_control_enabled": False,
        "profiling_enabled": False,
        "cross_game_scope_enabled": False,
        "cross_session_binding_enabled": False,
        "persistent_binding_created": False,
        "stable_core_promotion": False,
        "binding_effect": "CREATE_LOCAL_SYNTHETIC_BINDING_ARTIFACT" if materialized else "NONE",
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL" if materialized else "AUTHORITY_PLANE_ONLY_NOT_BOUND",
    }
    for field in REFERENCE_FIELDS:
        out[field] = item[field]

    validate_materialization_receipt(item, ctx, out)
    out["binding_materialization_receipt_digest"] = sha(out)
    return out


def validate_materialization_receipt(item, ctx, out):
    validate_materialization_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-runtime-transport-binding-materialization-receipt-v0.1", "materialization receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "materialization receipt status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "materialization source")
    req(out.get("source_binding_grant_receipt_digest") == item.get("binding_grant_receipt_digest"), "materialization grant binding")
    req(out.get("materialization_context_digest") == sha(ctx), "materialization context binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "BINDING_NOT_MATERIALIZED", "LIFECYCLE_RECHECK_REQUIRED", "SYNTHETIC_BINDING_MATERIALIZED"}, "materialization decision")
    req(out.get("binding_materialization_scope") == MATERIALIZATION_SCOPE, "materialization receipt scope")
    req(out.get("materialization_mode") == MATERIALIZATION_MODE, "materialization receipt mode")
    for field in REFERENCE_FIELDS:
        req(out.get(field) == item.get(field), f"materialized provenance binding: {field}")
    req(out.get("runtime_slot") == RUNTIME_SLOT and out.get("transport_slot") == TRANSPORT_SLOT and out.get("endpoint_slot") == ENDPOINT_SLOT, "binding slots")

    active = item["decision"] == "BOUNDED_BINDING_GRANT_ISSUED"
    lifecycle_current = (
        ctx["grant_lifecycle_rechecked"]
        and ctx["grant_not_revoked_confirmed"]
        and ctx["grant_not_expired_confirmed"]
    )
    if not active:
        expected = "NOT_APPLICABLE"
    elif not ctx["materialization_requested"]:
        expected = "BINDING_NOT_MATERIALIZED"
    elif not lifecycle_current:
        expected = "LIFECYCLE_RECHECK_REQUIRED"
    else:
        expected = "SYNTHETIC_BINDING_MATERIALIZED"
    req(out.get("decision") == expected, "materialization lifecycle decision")

    materialized = expected == "SYNTHETIC_BINDING_MATERIALIZED"
    req(out.get("binding_authority_granted") is active, "binding authority provenance")
    req(out.get("binding_authority_used_for_materialization") is materialized, "binding authority use marker")
    req(out.get("grant_lifecycle_rechecked") is ctx["grant_lifecycle_rechecked"], "lifecycle recheck binding")
    req(out.get("grant_not_revoked_confirmed") is ctx["grant_not_revoked_confirmed"], "revocation check binding")
    req(out.get("grant_not_expired_confirmed") is ctx["grant_not_expired_confirmed"], "expiry check binding")

    expected_runtime_ref = _runtime_binding_ref(item) if materialized else None
    expected_transport_ref = _transport_binding_ref(item) if materialized else None
    expected_endpoint_ref = _endpoint_binding_ref(item) if materialized else None
    expected_object_digest = _binding_object_digest(item) if materialized else None
    req(out.get("runtime_binding_ref") == expected_runtime_ref, "runtime binding ref")
    req(out.get("transport_binding_ref") == expected_transport_ref, "transport binding ref")
    req(out.get("endpoint_binding_ref") == expected_endpoint_ref, "endpoint binding ref")
    req(out.get("binding_object_digest") == expected_object_digest, "binding object digest")

    for field in (
        "binding_object_created",
        "runtime_binding_materialized",
        "transport_binding_materialized",
        "endpoint_descriptor_bound_locally",
        "materialization_local_only",
        "materialization_reversible",
        "network_enablement_required_after_binding",
        "user_surface_enablement_required_after_binding",
        "send_permit_required_after_binding",
        "transport_invocation_required_for_external_effect",
    ):
        req(out.get(field) is materialized, f"materialization marker: {field}")

    req(out.get("binding_effect") == ("CREATE_LOCAL_SYNTHETIC_BINDING_ARTIFACT" if materialized else "NONE"), "binding effect")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "authority/action/successor effects")
    for field in EXTERNAL_FALSE_EFFECTS:
        req(out.get(field) is False, f"external effect after materialization: {field}")
    req(out.get("runtime_connectedness") == ("LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL" if materialized else "AUTHORITY_PLANE_ONLY_NOT_BOUND"), "materialization connectedness")
