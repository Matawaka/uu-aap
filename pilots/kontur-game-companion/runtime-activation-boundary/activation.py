#!/usr/bin/env python3
import copy
import hashlib
import json

class ActivationBoundaryError(ValueError):
    pass

def req(condition, message):
    if not condition:
        raise ActivationBoundaryError(message)

def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()

TECHNICAL_PROOFS = (
    "transport_contract_verified",
    "user_surface_contract_verified",
    "rollback_path_verified",
    "live_policy_parity_verified",
    "audit_sink_contract_verified",
)

FALSE_EFFECTS = (
    "externalization_authority_present",
    "live_runtime_enabled",
    "live_runtime_bound",
    "external_transport_bound",
    "user_surface_enabled",
    "network_enabled",
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
    "stable_core_promotion",
)

def validate_shadow_summary(result):
    req(result.get("schema_version") == "kontur-game-companion-shadow-runtime-result-v0.1", "shadow schema")
    req(result.get("status") == "SYNTHETIC_SHADOW_ONLY", "shadow status")
    req(result.get("outcome") in {"NULL_SINK_CAPTURED", "HELD_NO_CAPTURE", "DROPPED_NO_CAPTURE"}, "shadow outcome")
    req(result.get("decision_scope") == "THIS_CANDIDATE_ONLY", "shadow scope")
    req(result.get("sink") == "IN_MEMORY_NULL_SINK", "shadow sink")
    req(result.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "shadow runtime")
    for field in (
        "network_request", "external_transport_bound", "user_visible", "user_delivery_enabled",
        "send_permit", "send_authority", "response_authority_created", "external_effect_authorized",
        "delivery_attempted", "transport_invoked", "delivery_receipt_created", "action_permit_created",
        "successor_permit_created", "payload_persisted", "future_send_authority", "future_solution_authority",
        "persistent_solver_mode",
    ):
        req(result.get(field) is False, f"shadow effect: {field}")
    req(result.get("shadow_run_digest") == sha({k: v for k, v in result.items() if k != "shadow_run_digest"}), "shadow run digest")
    if result["outcome"] == "NULL_SINK_CAPTURED":
        req(result.get("would_dispatch") is True and result.get("null_sink_consumed") is True, "captured shadow semantics")
        payload = result.get("shadow_payload")
        req(isinstance(payload, dict), "captured payload")
        req(payload.get("target") == "IN_MEMORY_NULL_SINK", "payload target")
        req(payload.get("user_visible") is False and payload.get("external_effect") is False, "payload effect")
        req(result.get("shadow_payload_digest") == sha(payload), "shadow payload digest")
    else:
        req(result.get("would_dispatch") is False and result.get("null_sink_consumed") is False, "non-capture shadow semantics")
        req(result.get("shadow_payload") is None and result.get("shadow_payload_digest") is None, "non-capture payload")

def default_context(shadow_result):
    return {
        "schema_version": "kontur-game-companion-runtime-activation-context-v0.1",
        "scope": "THIS_SHADOW_RESULT_ONLY",
        "source_shadow_run_digest": shadow_result["shadow_run_digest"],
        "transport_contract_verified": False,
        "user_surface_contract_verified": False,
        "rollback_path_verified": False,
        "live_policy_parity_verified": False,
        "audit_sink_contract_verified": False,
        "externalization_authority_present": False,
        "live_runtime_bound": False,
        "external_transport_bound": False,
        "user_surface_enabled": False,
        "network_enabled": False,
        "send_permit_available": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }

def validate_context(shadow_result, ctx):
    req(ctx.get("schema_version") == "kontur-game-companion-runtime-activation-context-v0.1", "activation context schema")
    req(ctx.get("scope") == "THIS_SHADOW_RESULT_ONLY", "activation context scope")
    req(ctx.get("source_shadow_run_digest") == shadow_result.get("shadow_run_digest"), "shadow binding")
    for field in TECHNICAL_PROOFS:
        req(type(ctx.get(field)) is bool, f"technical proof bool: {field}")
    for field in (
        "externalization_authority_present", "live_runtime_bound", "external_transport_bound",
        "user_surface_enabled", "network_enabled", "send_permit_available",
    ):
        req(ctx.get(field) is False, f"forbidden activation context effect: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "activation context effects")

def assess(shadow_result, activation_context=None):
    validate_shadow_summary(shadow_result)
    ctx = default_context(shadow_result) if activation_context is None else copy.deepcopy(activation_context)
    validate_context(shadow_result, ctx)

    proof_values = {field: ctx[field] for field in TECHNICAL_PROOFS}
    complete = all(proof_values.values())
    present_count = sum(1 for value in proof_values.values() if value)
    missing = [field for field, value in proof_values.items() if not value]

    if shadow_result["outcome"] != "NULL_SINK_CAPTURED":
        decision = "NOT_APPLICABLE"
        reason = "NO_CAPTURABLE_SHADOW_PAYLOAD"
        complete = False
    elif present_count == 0:
        decision = "SHADOW_ONLY_CONFIRMED"
        reason = "SHADOW_VALID_LIVE_PROOFS_ABSENT"
    elif complete:
        decision = "EXTERNAL_AUTHORIZATION_REQUIRED"
        reason = "TECHNICAL_PROOFS_COMPLETE_AUTHORITY_ABSENT"
    else:
        decision = "PRECONDITIONS_REVIEW"
        reason = "TECHNICAL_PROOFS_INCOMPLETE"

    out = {
        "schema_version": "kontur-game-companion-runtime-activation-assessment-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": shadow_result.get("scope_id"),
        "source_turn": shadow_result.get("source_turn"),
        "source_shadow_run_digest": shadow_result.get("shadow_run_digest"),
        "source_shadow_payload_digest": shadow_result.get("shadow_payload_digest"),
        "activation_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "assessment_scope": "THIS_SHADOW_RESULT_ONLY",
        "technical_proofs": proof_values,
        "technical_preconditions_complete": complete,
        "missing_technical_preconditions": missing,
        "externalization_authority_required": decision == "EXTERNAL_AUTHORIZATION_REQUIRED",
        "externalization_authority_present": False,
        "live_runtime_enabled": False,
        "live_runtime_bound": False,
        "external_transport_bound": False,
        "user_surface_enabled": False,
        "network_enabled": False,
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
        "stable_core_promotion": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "SHADOW_ONLY_NOT_LIVE",
    }
    validate_assessment(shadow_result, ctx, out)
    out["activation_assessment_digest"] = sha(out)
    return out

def validate_assessment(shadow_result, ctx, out):
    req(out.get("schema_version") == "kontur-game-companion-runtime-activation-assessment-v0.1", "assessment schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "assessment status")
    req(out.get("scope_id") == shadow_result.get("scope_id") and out.get("source_turn") == shadow_result.get("source_turn"), "assessment source")
    req(out.get("source_shadow_run_digest") == shadow_result.get("shadow_run_digest"), "assessment shadow binding")
    req(out.get("source_shadow_payload_digest") == shadow_result.get("shadow_payload_digest"), "assessment payload binding")
    req(out.get("activation_context_digest") == sha(ctx), "assessment context binding")
    req(out.get("decision") in {"SHADOW_ONLY_CONFIRMED", "PRECONDITIONS_REVIEW", "EXTERNAL_AUTHORIZATION_REQUIRED", "NOT_APPLICABLE"}, "assessment decision")
    req(out.get("assessment_scope") == "THIS_SHADOW_RESULT_ONLY", "assessment scope")
    req(out.get("technical_proofs") == {field: ctx[field] for field in TECHNICAL_PROOFS}, "technical proof binding")
    expected_complete = shadow_result["outcome"] == "NULL_SINK_CAPTURED" and all(ctx[field] for field in TECHNICAL_PROOFS)
    req(out.get("technical_preconditions_complete") is expected_complete, "technical completeness")
    expected_missing = [field for field in TECHNICAL_PROOFS if not ctx[field]]
    req(out.get("missing_technical_preconditions") == expected_missing, "missing technical proofs")
    req(out.get("externalization_authority_required") is (out["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED"), "authority requirement marker")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"activation effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "assessment effects")
    req(out.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "assessment runtime")

    if shadow_result["outcome"] != "NULL_SINK_CAPTURED":
        req(out["decision"] == "NOT_APPLICABLE", "non-capture activation decision")
    else:
        present = sum(1 for field in TECHNICAL_PROOFS if ctx[field])
        if present == 0:
            req(out["decision"] == "SHADOW_ONLY_CONFIRMED", "shadow-only decision")
        elif present == len(TECHNICAL_PROOFS):
            req(out["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED", "complete proofs decision")
        else:
            req(out["decision"] == "PRECONDITIONS_REVIEW", "partial proofs decision")

if __name__ == "__main__":
    print("runtime activation boundary is library-first; run validate.py")
