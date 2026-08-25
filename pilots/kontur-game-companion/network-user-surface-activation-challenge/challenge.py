#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MATERIALIZE = ROOT / "runtime-transport-binding-materialization" / "materialize.py"

spec = importlib.util.spec_from_file_location("network_surface_materialization_source", MATERIALIZE)
materialize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(materialize)


class NetworkUserSurfaceActivationError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceActivationError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


ACTIVATION_SCOPE = "THIS_MATERIALIZED_BINDING_ONLY"
REQUESTED_CAPABILITY = "REVIEW_EXTERNAL_DELIVERY_SURFACE_ACTIVATION"
NETWORK_MODE = "DECLARED_CONTRACT_ONLY"
USER_SURFACE_MODE = "DECLARED_CONTRACT_ONLY"

FORBIDDEN_REQUESTS = (
    "raw_network_endpoint_requested",
    "credential_material_requested",
    "secret_material_requested",
    "send_permit_requested",
    "send_authority_requested",
    "transport_invocation_requested",
    "delivery_attempt_requested",
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
)

FALSE_EFFECTS = (
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


def validate_materialization(item):
    req(item.get("schema_version") == "kontur-game-companion-runtime-transport-binding-materialization-receipt-v0.1", "materialization schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "materialization status")
    req(item.get("decision") in {"NOT_APPLICABLE", "BINDING_NOT_MATERIALIZED", "LIFECYCLE_RECHECK_REQUIRED", "SYNTHETIC_BINDING_MATERIALIZED"}, "materialization decision")
    digest = item.get("binding_materialization_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "materialization digest")
    req(digest == materialize.sha({k: v for k, v in item.items() if k != "binding_materialization_receipt_digest"}), "materialization digest binding")
    materialized = item["decision"] == "SYNTHETIC_BINDING_MATERIALIZED"
    req(item.get("binding_object_created") is materialized, "binding object marker")
    req(item.get("runtime_binding_materialized") is materialized, "runtime binding marker")
    req(item.get("transport_binding_materialized") is materialized, "transport binding marker")
    if materialized:
        for field in ("runtime_binding_ref", "transport_binding_ref", "endpoint_binding_ref", "binding_object_digest"):
            req(isinstance(item.get(field), str) and len(item[field]) == 64, f"materialized ref: {field}")
        req(item.get("materialization_local_only") is True, "local materialization")
        req(item.get("runtime_connectedness") == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL", "materialization connectedness")
    for field in materialize.EXTERNAL_FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream external effect: {field}")


def default_activation_context(item):
    validate_materialization(item)
    return {
        "schema_version": "kontur-game-companion-network-user-surface-activation-context-v0.1",
        "source_binding_materialization_receipt_digest": item["binding_materialization_receipt_digest"],
        "activation_requested": False,
        "activation_scope": ACTIVATION_SCOPE,
        "requested_capability": REQUESTED_CAPABILITY,
        "network_mode": NETWORK_MODE,
        "user_surface_mode": USER_SURFACE_MODE,
        "network_contract_ref": None,
        "user_surface_contract_ref": None,
        "rollback_contract_ref": None,
        "delivery_audit_sink_ref": None,
        "binding_freshness_rechecked": False,
        "binding_object_current_confirmed": False,
        "binding_grant_current_confirmed": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        **{field: False for field in FORBIDDEN_REQUESTS},
    }


def _ref_or_none(value, field):
    req(value is None or (isinstance(value, str) and len(value) == 64), field)


def validate_activation_context(item, ctx):
    validate_materialization(item)
    req(ctx.get("schema_version") == "kontur-game-companion-network-user-surface-activation-context-v0.1", "activation context schema")
    req(ctx.get("source_binding_materialization_receipt_digest") == item.get("binding_materialization_receipt_digest"), "materialization provenance")
    req(type(ctx.get("activation_requested")) is bool, "activation request bool")
    req(ctx.get("activation_scope") == ACTIVATION_SCOPE, "activation scope")
    req(ctx.get("requested_capability") == REQUESTED_CAPABILITY, "activation capability")
    req(ctx.get("network_mode") == NETWORK_MODE, "network mode")
    req(ctx.get("user_surface_mode") == USER_SURFACE_MODE, "user surface mode")
    for field in ("network_contract_ref", "user_surface_contract_ref", "rollback_contract_ref", "delivery_audit_sink_ref"):
        _ref_or_none(ctx.get(field), field)
    for field in ("binding_freshness_rechecked", "binding_object_current_confirmed", "binding_grant_current_confirmed"):
        req(type(ctx.get(field)) is bool, field)
    for field in FORBIDDEN_REQUESTS:
        req(ctx.get(field) is False, f"forbidden activation request: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "activation context effects")

    materialized = item["decision"] == "SYNTHETIC_BINDING_MATERIALIZED"
    if not materialized:
        req(ctx["activation_requested"] is False, "activation requested without materialized binding")
    if not ctx["activation_requested"]:
        for field in ("network_contract_ref", "user_surface_contract_ref", "rollback_contract_ref", "delivery_audit_sink_ref"):
            req(ctx[field] is None, f"activation evidence before request: {field}")
        for field in ("binding_freshness_rechecked", "binding_object_current_confirmed", "binding_grant_current_confirmed"):
            req(ctx[field] is False, f"activation assertion before request: {field}")
    if ctx["binding_object_current_confirmed"] or ctx["binding_grant_current_confirmed"]:
        req(ctx["binding_freshness_rechecked"] is True, "freshness conclusion without recheck")


def challenge(item, activation_context=None):
    validate_materialization(item)
    ctx = default_activation_context(item) if activation_context is None else copy.deepcopy(activation_context)
    validate_activation_context(item, ctx)
    applicable = item["decision"] == "SYNTHETIC_BINDING_MATERIALIZED"

    if not applicable:
        decision, reason = "NOT_APPLICABLE", "MATERIALIZED_BINDING_REQUIRED"
    elif not ctx["activation_requested"]:
        decision, reason = "ACTIVATION_NOT_REQUESTED", "SEPARATE_EXTERNAL_SURFACE_REQUEST_ABSENT"
    elif ctx["network_contract_ref"] is None:
        decision, reason = "NETWORK_CONTRACT_REQUIRED", "NETWORK_CONTRACT_REFERENCE_ABSENT"
    elif ctx["user_surface_contract_ref"] is None:
        decision, reason = "USER_SURFACE_CONTRACT_REQUIRED", "USER_SURFACE_CONTRACT_REFERENCE_ABSENT"
    elif ctx["rollback_contract_ref"] is None:
        decision, reason = "ROLLBACK_CONTRACT_REQUIRED", "ROLLBACK_CONTRACT_REFERENCE_ABSENT"
    elif ctx["delivery_audit_sink_ref"] is None:
        decision, reason = "DELIVERY_AUDIT_SINK_REQUIRED", "DELIVERY_AUDIT_SINK_REFERENCE_ABSENT"
    elif not (ctx["binding_freshness_rechecked"] and ctx["binding_object_current_confirmed"] and ctx["binding_grant_current_confirmed"]):
        decision, reason = "BINDING_FRESHNESS_RECHECK_REQUIRED", "CURRENT_BINDING_AND_GRANT_NOT_CONFIRMED"
    else:
        decision, reason = "READY_FOR_EXTERNALIZATION_REVIEW", "BOUND_SURFACE_CONTRACTS_PRESENT_FOR_SEPARATE_REVIEW"

    ready = decision == "READY_FOR_EXTERNALIZATION_REVIEW"
    out = {
        "schema_version": "kontur-game-companion-network-user-surface-activation-challenge-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_binding_materialization_receipt_digest": item["binding_materialization_receipt_digest"],
        "activation_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "activation_challenge_scope": ACTIVATION_SCOPE,
        "requested_capability": REQUESTED_CAPABILITY,
        "activation_review_ready": ready,
        "binding_object_digest": item.get("binding_object_digest"),
        "runtime_binding_ref": item.get("runtime_binding_ref"),
        "transport_binding_ref": item.get("transport_binding_ref"),
        "endpoint_binding_ref": item.get("endpoint_binding_ref"),
        "network_contract_ref": ctx["network_contract_ref"],
        "user_surface_contract_ref": ctx["user_surface_contract_ref"],
        "rollback_contract_ref": ctx["rollback_contract_ref"],
        "delivery_audit_sink_ref": ctx["delivery_audit_sink_ref"],
        "binding_freshness_rechecked": ctx["binding_freshness_rechecked"],
        "binding_object_current_confirmed": ctx["binding_object_current_confirmed"],
        "binding_grant_current_confirmed": ctx["binding_grant_current_confirmed"],
        "network_contract_sufficiency_evaluated": False,
        "user_surface_contract_sufficiency_evaluated": False,
        "rollback_sufficiency_evaluated": False,
        "audit_sink_sufficiency_evaluated": False,
        "network_activation_authorized": False,
        "user_surface_activation_authorized": False,
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
    validate_challenge(item, ctx, out)
    out["activation_challenge_digest"] = sha(out)
    return out


def validate_challenge(item, ctx, out):
    validate_activation_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-network-user-surface-activation-challenge-v0.1", "challenge schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "challenge status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "challenge source")
    req(out.get("source_binding_materialization_receipt_digest") == item.get("binding_materialization_receipt_digest"), "challenge materialization binding")
    req(out.get("activation_context_digest") == sha(ctx), "challenge context binding")
    decisions = {"NOT_APPLICABLE", "ACTIVATION_NOT_REQUESTED", "NETWORK_CONTRACT_REQUIRED", "USER_SURFACE_CONTRACT_REQUIRED", "ROLLBACK_CONTRACT_REQUIRED", "DELIVERY_AUDIT_SINK_REQUIRED", "BINDING_FRESHNESS_RECHECK_REQUIRED", "READY_FOR_EXTERNALIZATION_REVIEW"}
    req(out.get("decision") in decisions, "challenge decision")
    req(out.get("activation_challenge_scope") == ACTIVATION_SCOPE, "challenge scope")
    req(out.get("requested_capability") == REQUESTED_CAPABILITY, "challenge capability")
    req(out.get("activation_review_ready") is (out["decision"] == "READY_FOR_EXTERNALIZATION_REVIEW"), "review readiness")
    for field in ("binding_object_digest", "runtime_binding_ref", "transport_binding_ref", "endpoint_binding_ref"):
        req(out.get(field) == item.get(field), f"binding provenance: {field}")
    for field in ("network_contract_ref", "user_surface_contract_ref", "rollback_contract_ref", "delivery_audit_sink_ref"):
        req(out.get(field) == ctx.get(field), f"activation evidence binding: {field}")
    for field in ("binding_freshness_rechecked", "binding_object_current_confirmed", "binding_grant_current_confirmed"):
        req(out.get(field) is ctx.get(field), f"freshness binding: {field}")
    for field in ("network_contract_sufficiency_evaluated", "user_surface_contract_sufficiency_evaluated", "rollback_sufficiency_evaluated", "audit_sink_sufficiency_evaluated", "network_activation_authorized", "user_surface_activation_authorized"):
        req(out.get(field) is False, f"review/authorization overclaim: {field}")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"activation challenge external effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "challenge effects")
    req(out.get("runtime_connectedness") == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL", "challenge connectedness")

    applicable = item["decision"] == "SYNTHETIC_BINDING_MATERIALIZED"
    if not applicable:
        expected = "NOT_APPLICABLE"
    elif not ctx["activation_requested"]:
        expected = "ACTIVATION_NOT_REQUESTED"
    elif ctx["network_contract_ref"] is None:
        expected = "NETWORK_CONTRACT_REQUIRED"
    elif ctx["user_surface_contract_ref"] is None:
        expected = "USER_SURFACE_CONTRACT_REQUIRED"
    elif ctx["rollback_contract_ref"] is None:
        expected = "ROLLBACK_CONTRACT_REQUIRED"
    elif ctx["delivery_audit_sink_ref"] is None:
        expected = "DELIVERY_AUDIT_SINK_REQUIRED"
    elif not (ctx["binding_freshness_rechecked"] and ctx["binding_object_current_confirmed"] and ctx["binding_grant_current_confirmed"]):
        expected = "BINDING_FRESHNESS_RECHECK_REQUIRED"
    else:
        expected = "READY_FOR_EXTERNALIZATION_REVIEW"
    req(out.get("decision") == expected, "activation challenge decision derivation")
