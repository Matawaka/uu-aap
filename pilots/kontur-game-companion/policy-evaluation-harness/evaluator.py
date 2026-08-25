#!/usr/bin/env python3
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
GENERATOR = HERE.parent / "candidate-envelope" / "generator.py"

spec = importlib.util.spec_from_file_location("candidate_generator", GENERATOR)
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

class PolicyEvaluationError(ValueError):
    pass

def req(c, m):
    if not c:
        raise PolicyEvaluationError(m)

def canon(v):
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(v):
    return hashlib.sha256(canon(v).encode()).hexdigest()

DEPTH = {
    "NONE": -1, "COMMENT": 0, "NOTICE": 1, "QUESTION": 2, "THEORY": 3,
    "NUDGE": 4, "HINT": 5, "PARTIAL_SOLUTION": 6, "SOLUTION": 7,
}

BASE_POLICY = {
    "PLAYER_HYPOTHESIS": ("THEORY", "NONE"),
    "PLAYER_CORRECTION": ("QUESTION", "NONE"),
    "PLAYER_OBSERVATION": ("NOTICE", "NONE"),
    "PAUSE": ("NONE", "NONE"),
    "RESUME": ("COMMENT", "QUESTION"),
    "EXPLICIT_HINT_REQUEST": ("HINT", "NONE"),
    "PLAYER_REJECTS_HINT_HYPOTHESIS": ("QUESTION", "NONE"),
    "EXPLICIT_SOLUTION_REQUEST": ("SOLUTION", "NONE"),
}

SURFACE_FOR_DEPTH = {
    "NONE": "WAIT",
    "COMMENT": "COMMENT",
    "NOTICE": "OBSERVATION",
    "QUESTION": "QUESTION",
    "THEORY": "THEORY",
    "NUDGE": "COMMENT",
    "HINT": "COMMENT",
    "PARTIAL_SOLUTION": "COMMENT",
    "SOLUTION": "COMMENT",
}

def default_policy_context(event):
    ev = event.get("event")
    req(ev in BASE_POLICY, "unsupported player event")
    assistance, initiative = BASE_POLICY[ev]
    return {
        "schema_version": "kontur-game-companion-policy-context-v0.1",
        "scope": "CURRENT_EVENT_ONLY",
        "assistance_ceiling": assistance,
        "initiative_ceiling": initiative,
        "blocked": False,
        "block_reason": None,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }

def validate_policy_context(event, ctx):
    ev = event.get("event")
    req(ev in BASE_POLICY, "unsupported player event")
    base_a, base_i = BASE_POLICY[ev]
    req(ctx.get("schema_version") == "kontur-game-companion-policy-context-v0.1", "context schema")
    req(ctx.get("scope") == "CURRENT_EVENT_ONLY", "context scope")
    a = ctx.get("assistance_ceiling")
    i = ctx.get("initiative_ceiling")
    req(a in DEPTH and i in DEPTH, "context ceiling")
    req(DEPTH[a] <= DEPTH[base_a], "context assistance escalation")
    req(DEPTH[i] <= DEPTH[base_i], "context initiative escalation")
    req(isinstance(ctx.get("blocked"), bool), "context blocked")
    if ctx["blocked"]:
        req(isinstance(ctx.get("block_reason"), str) and ctx["block_reason"], "blocked without reason")
    else:
        req(ctx.get("block_reason") is None, "unblocked with reason")
    req(
        ctx.get("authority_effect") == "NONE"
        and ctx.get("action_effect") == "NONE"
        and ctx.get("successor_effect") == "NONE",
        "context authority effect",
    )

def evaluate(state, event, envelope, policy_context=None):
    gen.validate_envelope(state, event, envelope)
    ctx = default_policy_context(event) if policy_context is None else dict(policy_context)
    validate_policy_context(event, ctx)

    req(
        envelope.get("envelope_digest")
        == gen.sha({k: v for k, v in envelope.items() if k != "envelope_digest"}),
        "envelope digest",
    )
    req(envelope.get("response_text") is None, "pre-text evaluator received text")
    req(envelope.get("response_admissible") is None, "envelope already decided admissibility")

    ev = event["event"]
    requested = envelope["requested_assistance_depth"]
    requested_i = envelope["requested_initiative_depth"]
    cap = ctx["assistance_ceiling"]
    cap_i = ctx["initiative_ceiling"]

    selected = requested if DEPTH[requested] <= DEPTH[cap] else cap
    selected_i = requested_i if DEPTH[requested_i] <= DEPTH[cap_i] else cap_i

    if ev == "PAUSE":
        decision = "NO_RESPONSE_CANDIDATE"
        shape_admissible = None
        selected = "NONE"
        selected_i = "NONE"
        discovery = "WAIT"
        surface = "WAIT"
        focus = "NONE"
    elif ctx["blocked"]:
        decision = "SHAPE_BLOCKED"
        shape_admissible = False
        selected = "NONE"
        selected_i = "NONE"
        discovery = "WAIT"
        surface = "WAIT"
        focus = envelope["requested_focus"]
    else:
        reduced = selected != requested or selected_i != requested_i
        decision = "SHAPE_REDUCED" if reduced else "SHAPE_ADMISSIBLE"
        shape_admissible = True
        discovery = envelope["requested_discovery_posture"]
        if selected != "SOLUTION" and discovery == "BYPASS_CANDIDATE":
            discovery = "WAIT"
        surface = envelope["requested_surface_move"] if not reduced else SURFACE_FOR_DEPTH[selected]
        focus = envelope["requested_focus"]

    receipt = {
        "schema_version": "kontur-game-companion-pretext-policy-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": state["scope_id"],
        "source_turn": event["turn"],
        "source_event": ev,
        "source_state_digest": gen.sha(state),
        "source_event_digest": gen.sha(event),
        "source_envelope_digest": envelope["envelope_digest"],
        "policy_context_digest": sha(ctx),
        "decision": decision,
        "shape_admissible": shape_admissible,
        "selected_assistance_depth": selected,
        "selected_initiative_depth": selected_i,
        "selected_discovery_posture": discovery,
        "selected_surface_move": surface,
        "selected_focus": focus,
        "response_text": None,
        "content_candidate_present": False,
        "content_safety_evaluated": False,
        "factual_correctness_evaluated": False,
        "player_judgment_evaluated": False,
        "response_admissible": None,
        "interaction_receipt_ready": False,
        "downstream_interaction_receipt_required": shape_admissible is True,
        "receipt_scope": "THIS_CANDIDATE_SHAPE_ONLY",
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "persistent_solver_mode": False,
        "future_help_authority": False,
        "future_solution_authority": False,
        "runtime_connectedness": "NOT_PROVEN",
    }
    validate_receipt(state, event, envelope, ctx, receipt)
    receipt["policy_receipt_digest"] = sha(receipt)
    return receipt

def validate_receipt(state, event, envelope, ctx, r):
    req(r.get("schema_version") == "kontur-game-companion-pretext-policy-receipt-v0.1", "receipt schema")
    req(r.get("status") == "SYNTHETIC_NON_EXECUTING", "receipt status")
    req(r.get("scope_id") == state.get("scope_id"), "receipt scope id")
    req(r.get("source_turn") == event.get("turn") and r.get("source_event") == event.get("event"), "receipt source")
    req(r.get("source_state_digest") == gen.sha(state), "receipt state digest")
    req(r.get("source_event_digest") == gen.sha(event), "receipt event digest")
    req(r.get("source_envelope_digest") == envelope.get("envelope_digest"), "receipt envelope digest")
    req(r.get("policy_context_digest") == sha(ctx), "receipt policy context digest")
    req(r.get("decision") in {"NO_RESPONSE_CANDIDATE", "SHAPE_ADMISSIBLE", "SHAPE_REDUCED", "SHAPE_BLOCKED"}, "decision")
    req(r.get("selected_assistance_depth") in DEPTH and r.get("selected_initiative_depth") in DEPTH, "selected depth")
    req(DEPTH[r["selected_assistance_depth"]] <= DEPTH[envelope["requested_assistance_depth"]], "assistance escalated over envelope")
    req(DEPTH[r["selected_initiative_depth"]] <= DEPTH[envelope["requested_initiative_depth"]], "initiative escalated over envelope")
    req(DEPTH[r["selected_assistance_depth"]] <= DEPTH[ctx["assistance_ceiling"]], "assistance exceeds policy context")
    req(DEPTH[r["selected_initiative_depth"]] <= DEPTH[ctx["initiative_ceiling"]], "initiative exceeds policy context")
    req(r.get("response_text") is None and r.get("content_candidate_present") is False, "content invented")
    req(r.get("content_safety_evaluated") is False, "content safety claimed without content")
    req(r.get("factual_correctness_evaluated") is False, "factual correctness claimed without content")
    req(r.get("player_judgment_evaluated") is False, "player judgment claimed without content")
    req(r.get("response_admissible") is None, "pre-text receipt became interaction receipt")
    req(r.get("interaction_receipt_ready") is False, "interaction receipt claimed ready without content")
    req(r.get("receipt_scope") == "THIS_CANDIDATE_SHAPE_ONLY", "receipt scope")
    req(
        r.get("authority_effect") == "NONE"
        and r.get("action_effect") == "NONE"
        and r.get("successor_effect") == "NONE",
        "receipt authority effect",
    )
    req(r.get("persistent_solver_mode") is False, "solver mode")
    req(r.get("future_help_authority") is False and r.get("future_solution_authority") is False, "future authority")
    req(r.get("runtime_connectedness") == "NOT_PROVEN", "runtime")
    req(r.get("selected_discovery_posture") in gen.DISCOVERY, "selected discovery")
    req(r.get("selected_surface_move") in gen.SURFACE, "selected surface")

    if r["decision"] == "SHAPE_ADMISSIBLE":
        req(r["selected_assistance_depth"] == envelope["requested_assistance_depth"], "admissible assistance changed")
        req(r["selected_initiative_depth"] == envelope["requested_initiative_depth"], "admissible initiative changed")
        req(r["selected_discovery_posture"] == envelope["requested_discovery_posture"], "admissible discovery changed")
        req(r["selected_surface_move"] == envelope["requested_surface_move"], "admissible surface changed")
        req(r["selected_focus"] == envelope["requested_focus"], "admissible focus changed")
    if r["decision"] == "SHAPE_REDUCED":
        req(
            r["selected_assistance_depth"] != envelope["requested_assistance_depth"]
            or r["selected_initiative_depth"] != envelope["requested_initiative_depth"],
            "reduced decision without reduction",
        )

    if r["decision"] == "NO_RESPONSE_CANDIDATE":
        req(event.get("event") == "PAUSE", "no-response outside pause")
        req(r.get("shape_admissible") is None, "pause shape decision")
        req(r["selected_assistance_depth"] == "NONE" and r["selected_surface_move"] == "WAIT", "pause output")
        req(r.get("downstream_interaction_receipt_required") is False, "pause downstream receipt")
    elif r["decision"] == "SHAPE_BLOCKED":
        req(ctx.get("blocked") is True, "blocked without policy block")
        req(r.get("shape_admissible") is False, "blocked shape")
        req(r["selected_assistance_depth"] == "NONE", "blocked assistance")
        req(r.get("downstream_interaction_receipt_required") is False, "blocked downstream receipt")
    else:
        req(ctx.get("blocked") is False, "admissible despite policy block")
        req(r.get("shape_admissible") is True, "shape not admissible")
        req(r.get("downstream_interaction_receipt_required") is True, "missing downstream interaction receipt")

    if event.get("event") == "RESUME":
        req(r.get("selected_focus") == "NONE", "stale resume focus")
    if r["selected_assistance_depth"] == "SOLUTION":
        req(event.get("player_intent") == "SOLUTION_REQUEST", "solution without current request")
        req(r.get("selected_discovery_posture") == "BYPASS_CANDIDATE", "solution bypass missing")
        req(r.get("future_solution_authority") is False and r.get("persistent_solver_mode") is False, "solution persisted")

if __name__ == "__main__":
    print("policy evaluation harness is library-first; run validate.py")
