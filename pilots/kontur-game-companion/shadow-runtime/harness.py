#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DISPATCHER = ROOT / "response-dispatch-gate" / "dispatcher.py"

spec = importlib.util.spec_from_file_location("shadow_dispatcher", DISPATCHER)
dispatcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dispatcher)

class ShadowRuntimeError(ValueError):
    pass

def req(condition, message):
    if not condition:
        raise ShadowRuntimeError(message)

def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()

def default_shadow_context(candidate):
    return {
        "schema_version": "kontur-game-companion-shadow-runtime-context-v0.1",
        "mode": "SHADOW_ONLY",
        "scope": "THIS_CANDIDATE_ONLY",
        "sink": "IN_MEMORY_NULL_SINK",
        "capture_enabled": True,
        "network_enabled": False,
        "external_transport_bound": False,
        "user_delivery_enabled": False,
        "send_permit_available": False,
        "live_runtime": False,
        "payload_persisted": False,
        "candidate_digest": candidate["candidate_digest"],
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }

def validate_shadow_context(candidate, ctx):
    req(ctx.get("schema_version") == "kontur-game-companion-shadow-runtime-context-v0.1", "context schema")
    req(ctx.get("mode") == "SHADOW_ONLY", "context mode")
    req(ctx.get("scope") == "THIS_CANDIDATE_ONLY", "context scope")
    req(ctx.get("sink") == "IN_MEMORY_NULL_SINK", "sink")
    req(ctx.get("capture_enabled") is True, "capture disabled")
    for field in ("network_enabled", "external_transport_bound", "user_delivery_enabled", "send_permit_available", "live_runtime", "payload_persisted"):
        req(ctx.get(field) is False, f"forbidden shadow context effect: {field}")
    req(ctx.get("candidate_digest") == candidate.get("candidate_digest"), "context candidate binding")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "context effects")

def validate_dispatch(state, candidate, receipt, dispatch_ctx, dispatch_decision):
    dispatcher.validate_context(candidate, dispatch_ctx)
    dispatcher.validate_decision(state, candidate, receipt, dispatch_ctx, dispatch_decision)
    req(
        dispatch_decision.get("dispatch_decision_digest")
        == dispatcher.sha({k: v for k, v in dispatch_decision.items() if k != "dispatch_decision_digest"}),
        "dispatch decision digest",
    )

def validate_shadow_result(candidate, receipt, dispatch_decision, shadow_ctx, result):
    req(result.get("schema_version") == "kontur-game-companion-shadow-runtime-result-v0.1", "result schema")
    req(result.get("status") == "SYNTHETIC_SHADOW_ONLY", "result status")
    req(result.get("scope_id") == candidate.get("scope_id"), "scope id")
    req(result.get("source_turn") == candidate.get("source_turn"), "source turn")
    req(result.get("source_candidate_digest") == candidate.get("candidate_digest"), "candidate binding")
    req(result.get("source_interaction_receipt_digest") == receipt.get("interaction_receipt_digest"), "receipt binding")
    req(result.get("source_dispatch_decision_digest") == dispatch_decision.get("dispatch_decision_digest"), "dispatch binding")
    req(result.get("shadow_context_digest") == sha(shadow_ctx), "shadow context binding")
    req(result.get("outcome") in {"NULL_SINK_CAPTURED", "HELD_NO_CAPTURE", "DROPPED_NO_CAPTURE"}, "outcome")
    req(result.get("sink") == "IN_MEMORY_NULL_SINK", "result sink")
    req(result.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "runtime connectedness")
    req(result.get("decision_scope") == "THIS_CANDIDATE_ONLY", "result scope")

    for field in (
        "network_request", "external_transport_bound", "user_visible", "user_delivery_enabled",
        "send_permit", "send_authority", "response_authority_created", "external_effect_authorized",
        "delivery_attempted", "transport_invoked", "delivery_receipt_created", "action_permit_created",
        "successor_permit_created", "payload_persisted", "future_send_authority", "future_solution_authority",
        "persistent_solver_mode",
    ):
        req(result.get(field) is False, f"shadow external effect: {field}")
    req(result.get("authority_effect") == result.get("action_effect") == result.get("successor_effect") == "NONE", "result effects")

    decision = dispatch_decision["decision"]
    payload = result.get("shadow_payload")
    if decision == "DISPATCH_ELIGIBLE":
        req(result["outcome"] == "NULL_SINK_CAPTURED", "eligible not captured")
        req(result.get("would_dispatch") is True, "eligible would-dispatch")
        req(result.get("null_sink_consumed") is True, "eligible null sink")
        req(isinstance(payload, dict), "eligible payload missing")
        req(payload.get("schema_version") == "kontur-game-companion-shadow-payload-v0.1", "payload schema")
        req(payload.get("scope_id") == candidate.get("scope_id") and payload.get("source_turn") == candidate.get("source_turn"), "payload source")
        req(payload.get("candidate_digest") == candidate.get("candidate_digest"), "payload candidate")
        req(payload.get("interaction_receipt_digest") == receipt.get("interaction_receipt_digest"), "payload receipt")
        req(payload.get("dispatch_decision_digest") == dispatch_decision.get("dispatch_decision_digest"), "payload dispatch")
        req(payload.get("response_text") == candidate.get("response_text"), "payload text drift")
        req(payload.get("text_digest") == candidate.get("text_digest"), "payload text digest")
        req(payload.get("payload_scope") == "THIS_CANDIDATE_ONLY", "payload scope")
        req(payload.get("target") == "IN_MEMORY_NULL_SINK", "payload target")
        req(payload.get("user_visible") is False and payload.get("external_effect") is False, "payload visibility")
        req(result.get("shadow_payload_digest") == sha(payload), "payload digest")
    else:
        expected = "HELD_NO_CAPTURE" if decision == "HOLD" else "DROPPED_NO_CAPTURE"
        req(result["outcome"] == expected, "non-eligible outcome")
        req(result.get("would_dispatch") is False, "non-eligible would-dispatch")
        req(result.get("null_sink_consumed") is False, "non-eligible sink consumption")
        req(payload is None and result.get("shadow_payload_digest") is None, "non-eligible payload")

def run_shadow(state, event, envelope, pre, candidate, receipt, dispatch_ctx, dispatch_decision, shadow_context=None):
    dispatcher.validate_upstream(state, event, envelope, pre, candidate, receipt)
    validate_dispatch(state, candidate, receipt, dispatch_ctx, dispatch_decision)
    ctx = default_shadow_context(candidate) if shadow_context is None else copy.deepcopy(shadow_context)
    validate_shadow_context(candidate, ctx)

    decision = dispatch_decision["decision"]
    if decision == "DISPATCH_ELIGIBLE":
        payload = {
            "schema_version": "kontur-game-companion-shadow-payload-v0.1",
            "scope_id": candidate["scope_id"],
            "source_turn": candidate["source_turn"],
            "source_event": candidate["source_event"],
            "candidate_digest": candidate["candidate_digest"],
            "interaction_receipt_digest": receipt["interaction_receipt_digest"],
            "dispatch_decision_digest": dispatch_decision["dispatch_decision_digest"],
            "response_text": candidate["response_text"],
            "text_digest": candidate["text_digest"],
            "payload_scope": "THIS_CANDIDATE_ONLY",
            "target": "IN_MEMORY_NULL_SINK",
            "user_visible": False,
            "external_effect": False,
        }
        outcome = "NULL_SINK_CAPTURED"
        would_dispatch = True
        consumed = True
        payload_digest = sha(payload)
    elif decision == "HOLD":
        payload = None
        outcome = "HELD_NO_CAPTURE"
        would_dispatch = False
        consumed = False
        payload_digest = None
    else:
        payload = None
        outcome = "DROPPED_NO_CAPTURE"
        would_dispatch = False
        consumed = False
        payload_digest = None

    result = {
        "schema_version": "kontur-game-companion-shadow-runtime-result-v0.1",
        "status": "SYNTHETIC_SHADOW_ONLY",
        "scope_id": candidate["scope_id"],
        "source_turn": candidate["source_turn"],
        "source_candidate_digest": candidate["candidate_digest"],
        "source_interaction_receipt_digest": receipt["interaction_receipt_digest"],
        "source_dispatch_decision_digest": dispatch_decision["dispatch_decision_digest"],
        "shadow_context_digest": sha(ctx),
        "outcome": outcome,
        "would_dispatch": would_dispatch,
        "sink": "IN_MEMORY_NULL_SINK",
        "shadow_payload": payload,
        "shadow_payload_digest": payload_digest,
        "null_sink_consumed": consumed,
        "decision_scope": "THIS_CANDIDATE_ONLY",
        "network_request": False,
        "external_transport_bound": False,
        "user_visible": False,
        "user_delivery_enabled": False,
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
        "future_send_authority": False,
        "future_solution_authority": False,
        "persistent_solver_mode": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "SHADOW_ONLY_NOT_LIVE",
    }
    validate_shadow_result(candidate, receipt, dispatch_decision, ctx, result)
    result["shadow_run_digest"] = sha(result)
    return result

if __name__ == "__main__":
    print("shadow runtime harness is library-first; run validate.py")
