#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GRANT = ROOT / "network-user-surface-activation-grant" / "grant.py"

spec = importlib.util.spec_from_file_location("network_surface_activation_materialization_grant", GRANT)
grant = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grant)


class NetworkUserSurfaceActivationMaterializationError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceActivationMaterializationError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


MATERIALIZATION_SCOPE = "THIS_ACTIVATION_GRANT_ONLY"
MATERIALIZATION_MODE = "LOCAL_SYNTHETIC_ACTIVATION_STATE"
ACTIVATION_STATE_CLASS = "SYNTHETIC_NETWORK_USER_SURFACE_ACTIVATION_STATE_V0.1"
NETWORK_STATE_CLASS = "DECLARED_NETWORK_ACTIVATION_STATE_ONLY"
USER_SURFACE_STATE_CLASS = "DECLARED_USER_SURFACE_ACTIVATION_STATE_ONLY"

REFERENCE_FIELDS = grant.REFERENCE_FIELDS

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
    "scope_expansion_requested",
    "capability_expansion_requested",
    "real_endpoint_resolution_requested",
    "real_user_surface_attachment_requested",
)

EXTERNAL_FALSE_EFFECTS = (
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


def validate_activation_grant(item):
    req(item.get("schema_version") == "kontur-game-companion-network-user-surface-activation-grant-receipt-v0.1", "activation grant schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "activation grant status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "ACTIVATION_GRANT_NOT_ISSUED",
        "BOUNDED_ACTIVATION_GRANT_ISSUED",
        "ACTIVATION_GRANT_REVOKED",
        "ACTIVATION_GRANT_EXPIRED",
    }, "activation grant decision")
    digest = item.get("activation_grant_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "activation grant digest")
    req(digest == grant.sha({k: v for k, v in item.items() if k != "activation_grant_receipt_digest"}), "activation grant digest binding")
    req(item.get("activation_grant_receipt_scope") == grant.GRANT_RECEIPT_SCOPE, "activation grant receipt scope")
    req(item.get("granted_scope") == grant.GRANTED_SCOPE, "activation grant scope")
    req(item.get("granted_capability") == grant.GRANTED_CAPABILITY, "activation grant capability")
    req(item.get("granted_duration") == grant.GRANTED_DURATION, "activation grant duration")
    req(item.get("expiry_boundary") == grant.EXPIRY_BOUNDARY, "activation grant expiry")
    req(item.get("revocation_mode") == grant.REVOCATION_MODE, "activation grant revocation mode")
    req(isinstance(item.get("revocation_handle"), str) and len(item["revocation_handle"]) == 64, "activation grant revocation handle")
    req(isinstance(item.get("grant_authority_basis_ref"), str) and len(item["grant_authority_basis_ref"]) == 64, "activation grant authority basis")
    for field in REFERENCE_FIELDS:
        req(isinstance(item.get(field), str) and len(item[field]) == 64, f"activation grant reviewed reference: {field}")
    active = item["decision"] == "BOUNDED_ACTIVATION_GRANT_ISSUED"
    historical = item["decision"] in {"BOUNDED_ACTIVATION_GRANT_ISSUED", "ACTIVATION_GRANT_REVOKED", "ACTIVATION_GRANT_EXPIRED"}
    req(item.get("activation_grant_historically_issued") is historical, "activation grant historical marker")
    req(item.get("activation_grant_currently_active") is active, "activation grant active marker")
    req(item.get("activation_authority_granted") is active, "activation authority marker")
    req(item.get("network_activation_authority_granted") is active, "network activation authority marker")
    req(item.get("user_surface_activation_authority_granted") is active, "user-surface activation authority marker")
    req(item.get("activation_scope_authorized_now") is active, "activation scope marker")
    req(item.get("activation_capability_authorized_now") is active, "activation capability marker")
    req(item.get("activation_materialization_required") is active, "activation materialization requirement")
    req(item.get("network_enablement_step_required") is active, "network enablement requirement")
    req(item.get("user_surface_enablement_step_required") is active, "user-surface enablement requirement")
    req(item.get("send_permit_required_after_surface_activation") is active, "send permit downstream requirement")
    for field in grant.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream activation grant external effect: {field}")
    req(item.get("runtime_connectedness") == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL", "activation grant connectedness")


def default_materialization_context(item):
    validate_activation_grant(item)
    ctx = {
        "schema_version": "kontur-game-companion-network-user-surface-activation-materialization-context-v0.1",
        "source_activation_grant_receipt_digest": item["activation_grant_receipt_digest"],
        "materialization_requested": False,
        "materialization_scope": MATERIALIZATION_SCOPE,
        "materialization_mode": MATERIALIZATION_MODE,
        "activation_state_class": ACTIVATION_STATE_CLASS,
        "network_state_class": NETWORK_STATE_CLASS,
        "user_surface_state_class": USER_SURFACE_STATE_CLASS,
        "grant_lifecycle_rechecked": False,
        "grant_not_revoked_confirmed": False,
        "grant_not_expired_confirmed": False,
        "reviewed_binding_current_confirmed": False,
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
    validate_activation_grant(item)
    req(ctx.get("schema_version") == "kontur-game-companion-network-user-surface-activation-materialization-context-v0.1", "materialization context schema")
    req(ctx.get("source_activation_grant_receipt_digest") == item.get("activation_grant_receipt_digest"), "activation grant provenance")
    req(type(ctx.get("materialization_requested")) is bool, "materialization requested bool")
    req(ctx.get("materialization_scope") == MATERIALIZATION_SCOPE, "materialization scope")
    req(ctx.get("materialization_mode") == MATERIALIZATION_MODE, "materialization mode")
    req(ctx.get("activation_state_class") == ACTIVATION_STATE_CLASS, "activation state class")
    req(ctx.get("network_state_class") == NETWORK_STATE_CLASS, "network state class")
    req(ctx.get("user_surface_state_class") == USER_SURFACE_STATE_CLASS, "user surface state class")
    for field in REFERENCE_FIELDS:
        req(ctx.get(field) == item.get(field), f"activation materialization provenance: {field}")
    for field in ("grant_lifecycle_rechecked", "grant_not_revoked_confirmed", "grant_not_expired_confirmed", "reviewed_binding_current_confirmed"):
        req(type(ctx.get(field)) is bool, f"materialization lifecycle marker: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(ctx.get(field) is False, f"forbidden activation materialization request: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "materialization context effects")

    active = item["decision"] == "BOUNDED_ACTIVATION_GRANT_ISSUED"
    if not active:
        req(ctx["materialization_requested"] is False, "activation materialization requested on inactive grant")
    if not ctx["materialization_requested"]:
        for field in ("grant_lifecycle_rechecked", "grant_not_revoked_confirmed", "grant_not_expired_confirmed", "reviewed_binding_current_confirmed"):
            req(ctx[field] is False, f"materialization proof before request: {field}")
    if ctx["grant_not_revoked_confirmed"] or ctx["grant_not_expired_confirmed"] or ctx["reviewed_binding_current_confirmed"]:
        req(ctx["grant_lifecycle_rechecked"] is True, "materialization conclusion without lifecycle recheck")


def activation_state_ref_for(item):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_SURFACE_ACTIVATION_STATE_REF_V0.1",
        "source_activation_grant_receipt_digest": item["activation_grant_receipt_digest"],
        "binding_object_digest": item["binding_object_digest"],
        "network_contract_ref": item["network_contract_ref"],
        "user_surface_contract_ref": item["user_surface_contract_ref"],
        "scope": MATERIALIZATION_SCOPE,
    })


def network_state_ref_for(item):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_NETWORK_ACTIVATION_STATE_REF_V0.1",
        "source_activation_grant_receipt_digest": item["activation_grant_receipt_digest"],
        "network_contract_ref": item["network_contract_ref"],
        "network_state_class": NETWORK_STATE_CLASS,
    })


def user_surface_state_ref_for(item):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_USER_SURFACE_ACTIVATION_STATE_REF_V0.1",
        "source_activation_grant_receipt_digest": item["activation_grant_receipt_digest"],
        "user_surface_contract_ref": item["user_surface_contract_ref"],
        "user_surface_state_class": USER_SURFACE_STATE_CLASS,
    })


def activation_state_digest_for(item):
    return sha({
        "kind": ACTIVATION_STATE_CLASS,
        "source_activation_grant_receipt_digest": item["activation_grant_receipt_digest"],
        "activation_state_ref": activation_state_ref_for(item),
        "network_state_ref": network_state_ref_for(item),
        "user_surface_state_ref": user_surface_state_ref_for(item),
        "binding_object_digest": item["binding_object_digest"],
        "rollback_contract_ref": item["rollback_contract_ref"],
        "delivery_audit_sink_ref": item["delivery_audit_sink_ref"],
        "scope": MATERIALIZATION_SCOPE,
        "mode": MATERIALIZATION_MODE,
    })


def materialize(item, materialization_context=None):
    validate_activation_grant(item)
    ctx = default_materialization_context(item) if materialization_context is None else copy.deepcopy(materialization_context)
    validate_materialization_context(item, ctx)

    active = item["decision"] == "BOUNDED_ACTIVATION_GRANT_ISSUED"
    lifecycle_current = (
        ctx["grant_lifecycle_rechecked"]
        and ctx["grant_not_revoked_confirmed"]
        and ctx["grant_not_expired_confirmed"]
        and ctx["reviewed_binding_current_confirmed"]
    )

    if not active:
        decision, reason = "NOT_APPLICABLE", "ACTIVE_BOUNDED_ACTIVATION_GRANT_REQUIRED"
    elif not ctx["materialization_requested"]:
        decision, reason = "ACTIVATION_NOT_MATERIALIZED", "SEPARATE_ACTIVATION_MATERIALIZATION_REQUEST_ABSENT"
    elif not lifecycle_current:
        decision, reason = "LIFECYCLE_RECHECK_REQUIRED", "CURRENT_ACTIVATION_GRANT_AND_REVIEWED_BINDING_NOT_CONFIRMED"
    else:
        decision, reason = "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED", "LOCAL_NON_EXTERNAL_ACTIVATION_STATE_ARTIFACT_CREATED"

    materialized = decision == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
    activation_state_ref = activation_state_ref_for(item) if materialized else None
    network_state_ref = network_state_ref_for(item) if materialized else None
    user_surface_state_ref = user_surface_state_ref_for(item) if materialized else None
    activation_state_digest = activation_state_digest_for(item) if materialized else None

    out = {
        "schema_version": "kontur-game-companion-network-user-surface-activation-materialization-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_activation_grant_receipt_digest": item["activation_grant_receipt_digest"],
        "materialization_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "activation_materialization_scope": MATERIALIZATION_SCOPE,
        "materialization_mode": MATERIALIZATION_MODE,
        "activation_state_class": ACTIVATION_STATE_CLASS,
        "network_state_class": NETWORK_STATE_CLASS,
        "user_surface_state_class": USER_SURFACE_STATE_CLASS,
        "activation_authority_granted": active,
        "activation_authority_used_for_materialization": materialized,
        "activation_grant_consumed": False,
        "grant_lifecycle_rechecked": ctx["grant_lifecycle_rechecked"],
        "grant_not_revoked_confirmed": ctx["grant_not_revoked_confirmed"],
        "grant_not_expired_confirmed": ctx["grant_not_expired_confirmed"],
        "reviewed_binding_current_confirmed": ctx["reviewed_binding_current_confirmed"],
        "activation_state_ref": activation_state_ref,
        "network_activation_state_ref": network_state_ref,
        "user_surface_activation_state_ref": user_surface_state_ref,
        "activation_state_digest": activation_state_digest,
        "activation_state_artifact_created": materialized,
        "network_activation_state_materialized": materialized,
        "user_surface_activation_state_materialized": materialized,
        "activation_state_local_only": materialized,
        "activation_state_reversible": materialized,
        "activation_state_is_enablement": False,
        "network_enablement_required_after_materialization": materialized,
        "user_surface_enablement_required_after_materialization": materialized,
        "send_permit_required_after_surface_enablement": materialized,
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
        "activation_effect": "CREATE_LOCAL_SYNTHETIC_ACTIVATION_STATE_ARTIFACT" if materialized else "NONE",
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL" if materialized else "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL",
    }
    for field in REFERENCE_FIELDS:
        out[field] = item[field]
    for field in (
        "grant_authority_basis_ref",
        "granted_scope",
        "granted_capability",
        "granted_duration",
        "expiry_boundary",
        "revocation_mode",
        "revocation_handle",
        "activation_challenge_scope",
        "requested_capability",
    ):
        out[field] = item[field]

    validate_materialization_receipt(item, ctx, out)
    out["activation_materialization_receipt_digest"] = sha(out)
    return out


def validate_materialization_receipt(item, ctx, out):
    validate_materialization_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-network-user-surface-activation-materialization-receipt-v0.1", "materialization receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "materialization receipt status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "materialization receipt source")
    req(out.get("source_activation_grant_receipt_digest") == item.get("activation_grant_receipt_digest"), "activation grant digest binding")
    req(out.get("materialization_context_digest") == sha(ctx), "materialization context digest binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "ACTIVATION_NOT_MATERIALIZED", "LIFECYCLE_RECHECK_REQUIRED", "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"}, "materialization decision")
    req(out.get("activation_materialization_scope") == MATERIALIZATION_SCOPE, "materialization receipt scope")
    req(out.get("materialization_mode") == MATERIALIZATION_MODE, "materialization receipt mode")
    req(out.get("activation_state_class") == ACTIVATION_STATE_CLASS, "activation state receipt class")
    req(out.get("network_state_class") == NETWORK_STATE_CLASS, "network state receipt class")
    req(out.get("user_surface_state_class") == USER_SURFACE_STATE_CLASS, "user surface state receipt class")
    for field in REFERENCE_FIELDS:
        req(out.get(field) == item.get(field), f"materialized activation provenance: {field}")
    for field in (
        "grant_authority_basis_ref",
        "granted_scope",
        "granted_capability",
        "granted_duration",
        "expiry_boundary",
        "revocation_mode",
        "revocation_handle",
        "activation_challenge_scope",
        "requested_capability",
    ):
        req(out.get(field) == item.get(field), f"activation grant boundary provenance: {field}")
    active = item["decision"] == "BOUNDED_ACTIVATION_GRANT_ISSUED"
    materialized = out["decision"] == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
    req(out.get("activation_authority_granted") is active, "activation authority receipt marker")
    req(out.get("activation_authority_used_for_materialization") is materialized, "activation authority usage marker")
    req(out.get("activation_grant_consumed") is False, "activation grant must not become consumable credential")
    for field in ("grant_lifecycle_rechecked", "grant_not_revoked_confirmed", "grant_not_expired_confirmed", "reviewed_binding_current_confirmed"):
        req(out.get(field) is ctx.get(field), f"materialization lifecycle binding: {field}")

    expected_refs = {
        "activation_state_ref": activation_state_ref_for(item) if materialized else None,
        "network_activation_state_ref": network_state_ref_for(item) if materialized else None,
        "user_surface_activation_state_ref": user_surface_state_ref_for(item) if materialized else None,
        "activation_state_digest": activation_state_digest_for(item) if materialized else None,
    }
    for field, expected in expected_refs.items():
        req(out.get(field) == expected, f"activation state reference binding: {field}")
    for field in (
        "activation_state_artifact_created",
        "network_activation_state_materialized",
        "user_surface_activation_state_materialized",
        "activation_state_local_only",
        "activation_state_reversible",
        "network_enablement_required_after_materialization",
        "user_surface_enablement_required_after_materialization",
        "send_permit_required_after_surface_enablement",
    ):
        req(out.get(field) is materialized, f"materialization marker: {field}")
    req(out.get("activation_state_is_enablement") is False, "activation state must not equal enablement")
    for field in EXTERNAL_FALSE_EFFECTS:
        req(out.get(field) is False, f"activation materialization external effect: {field}")
    req(out.get("activation_effect") == ("CREATE_LOCAL_SYNTHETIC_ACTIVATION_STATE_ARTIFACT" if materialized else "NONE"), "activation materialization effect")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "activation materialization causal effects")
    req(out.get("runtime_connectedness") == ("LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL" if materialized else "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"), "activation materialization connectedness")

    lifecycle_current = (
        ctx["grant_lifecycle_rechecked"]
        and ctx["grant_not_revoked_confirmed"]
        and ctx["grant_not_expired_confirmed"]
        and ctx["reviewed_binding_current_confirmed"]
    )
    if not active:
        expected = "NOT_APPLICABLE"
    elif not ctx["materialization_requested"]:
        expected = "ACTIVATION_NOT_MATERIALIZED"
    elif not lifecycle_current:
        expected = "LIFECYCLE_RECHECK_REQUIRED"
    else:
        expected = "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
    req(out.get("decision") == expected, "activation materialization decision derivation")
