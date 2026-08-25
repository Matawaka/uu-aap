#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MATERIALIZER = ROOT / "candidate-materializer" / "materializer.py"

spec = importlib.util.spec_from_file_location("dispatch_materializer", MATERIALIZER)
mat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mat)

class DispatchError(ValueError):
    pass

def req(condition, message):
    if not condition:
        raise DispatchError(message)

def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()

def default_context(candidate):
    return {
        "schema_version": "kontur-game-companion-dispatch-context-v0.1",
        "scope": "THIS_CANDIDATE_ONLY",
        "current_turn": candidate["source_turn"],
        "candidate_superseded": False,
        "player_cancelled": False,
        "session_active": True,
        "safety_recheck_required": False,
        "delivery_channel": "SYNTHETIC_NULL_SINK",
        "external_transport_bound": False,
        "live_runtime": False,
        "send_permit_available": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }

def validate_context(candidate, ctx):
    req(ctx.get("schema_version") == "kontur-game-companion-dispatch-context-v0.1", "context schema")
    req(ctx.get("scope") == "THIS_CANDIDATE_ONLY", "context scope")
    req(type(ctx.get("current_turn")) is int and ctx["current_turn"] >= candidate["source_turn"], "current turn")
    for field in ("candidate_superseded", "player_cancelled", "session_active", "safety_recheck_required", "external_transport_bound", "live_runtime", "send_permit_available"):
        req(type(ctx.get(field)) is bool, f"context bool: {field}")
    req(ctx.get("delivery_channel") == "SYNTHETIC_NULL_SINK", "delivery channel")
    req(ctx.get("external_transport_bound") is False, "external transport bound")
    req(ctx.get("live_runtime") is False, "live runtime")
    req(ctx.get("send_permit_available") is False, "preinstalled send permit")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "context effects")

def validate_upstream(state, event, envelope, pre, candidate, receipt):
    mat.gen.validate_envelope(state, event, envelope)
    ctx = mat.evl.default_policy_context(event)
    mat.evl.validate_policy_context(event, ctx)
    mat.evl.validate_receipt(state, event, envelope, ctx, pre)
    req(pre.get("policy_receipt_digest") == mat.evl.sha({k: v for k, v in pre.items() if k != "policy_receipt_digest"}), "pretext digest")
    mat.validate_candidate(state, event, pre, candidate)
    req(candidate.get("candidate_digest") == mat.sha({k: v for k, v in candidate.items() if k != "candidate_digest"}), "candidate digest")
    mat.validate_receipt(state, event, pre, candidate, receipt)
    req(receipt.get("interaction_receipt_digest") == mat.sha({k: v for k, v in receipt.items() if k != "interaction_receipt_digest"}), "interaction receipt digest")
    req(receipt.get("response_admissible") is True, "inadmissible upstream candidate")
    req(receipt.get("scope") == "THIS_CANDIDATE_ONLY", "interaction receipt scope")
    req(receipt.get("source_candidate_digest") == candidate.get("candidate_digest"), "receipt/candidate mismatch")

def decide(state, event, envelope, pre, candidate, receipt, dispatch_context=None):
    validate_upstream(state, event, envelope, pre, candidate, receipt)
    ctx = default_context(candidate) if dispatch_context is None else copy.deepcopy(dispatch_context)
    validate_context(candidate, ctx)

    stale = ctx["current_turn"] != candidate["source_turn"]
    cancelled = ctx["player_cancelled"]
    superseded = ctx["candidate_superseded"]
    inactive = not ctx["session_active"]
    recheck = ctx["safety_recheck_required"]

    if stale or cancelled or superseded or inactive:
        decision = "DROP"
        eligible = False
        reason = "STALE_OR_SUPERSEDED"
    elif recheck:
        decision = "HOLD"
        eligible = False
        reason = "SAFETY_RECHECK_REQUIRED"
    else:
        decision = "DISPATCH_ELIGIBLE"
        eligible = True
        reason = "FRESH_ADMISSIBLE_CANDIDATE"

    out = {
        "schema_version": "kontur-game-companion-synthetic-dispatch-decision-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": state["scope_id"],
        "source_turn": candidate["source_turn"],
        "source_event": candidate["source_event"],
        "source_candidate_digest": candidate["candidate_digest"],
        "source_interaction_receipt_digest": receipt["interaction_receipt_digest"],
        "dispatch_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "dispatch_eligible": eligible,
        "decision_scope": "THIS_CANDIDATE_ONLY",
        "delivery_channel": "SYNTHETIC_NULL_SINK",
        "send_permit": False,
        "send_authority": False,
        "response_authority_created": False,
        "external_effect_authorized": False,
        "dispatch_executed": False,
        "delivery_attempted": False,
        "transport_invoked": False,
        "action_permit_created": False,
        "successor_permit_created": False,
        "future_send_authority": False,
        "future_solution_authority": False,
        "persistent_solver_mode": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "NOT_PROVEN",
    }
    validate_decision(state, candidate, receipt, ctx, out)
    out["dispatch_decision_digest"] = sha(out)
    return out

def validate_decision(state, candidate, receipt, ctx, out):
    req(out.get("schema_version") == "kontur-game-companion-synthetic-dispatch-decision-v0.1", "decision schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "decision status")
    req(out.get("scope_id") == state.get("scope_id"), "scope id")
    req(out.get("source_turn") == candidate.get("source_turn") and out.get("source_event") == candidate.get("source_event"), "source")
    req(out.get("source_candidate_digest") == candidate.get("candidate_digest"), "candidate binding")
    req(out.get("source_interaction_receipt_digest") == receipt.get("interaction_receipt_digest"), "receipt binding")
    req(out.get("dispatch_context_digest") == sha(ctx), "context binding")
    req(out.get("decision") in {"DISPATCH_ELIGIBLE", "HOLD", "DROP"}, "decision")
    req(type(out.get("dispatch_eligible")) is bool, "eligibility")
    req(out.get("decision_scope") == "THIS_CANDIDATE_ONLY", "decision scope")
    req(out.get("delivery_channel") == "SYNTHETIC_NULL_SINK", "decision channel")
    for field in ("send_permit", "send_authority", "response_authority_created", "external_effect_authorized", "dispatch_executed", "delivery_attempted", "transport_invoked", "action_permit_created", "successor_permit_created", "future_send_authority", "future_solution_authority", "persistent_solver_mode"):
        req(out.get(field) is False, f"dispatch effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "decision effects")
    req(out.get("runtime_connectedness") == "NOT_PROVEN", "runtime")

    stale = ctx["current_turn"] != candidate["source_turn"]
    terminal = stale or ctx["candidate_superseded"] or ctx["player_cancelled"] or not ctx["session_active"]
    if terminal:
        req(out["decision"] == "DROP" and out["dispatch_eligible"] is False, "terminal context not dropped")
    elif ctx["safety_recheck_required"]:
        req(out["decision"] == "HOLD" and out["dispatch_eligible"] is False, "recheck not held")
    else:
        req(out["decision"] == "DISPATCH_ELIGIBLE" and out["dispatch_eligible"] is True, "fresh candidate not eligible")
        req(receipt.get("response_admissible") is True, "eligible despite inadmissible receipt")

if __name__ == "__main__":
    print("response dispatch gate is library-first; run validate.py")
