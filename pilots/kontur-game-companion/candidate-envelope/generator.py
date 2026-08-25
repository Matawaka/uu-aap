#!/usr/bin/env python3
import hashlib, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TRACE = HERE.parent / "integrated-conversation-trace" / "integrated-conversation-trace.json"

class EnvelopeError(ValueError):
    pass

def req(c,m):
    if not c:
        raise EnvelopeError(m)

def canon(v):
    return json.dumps(v, sort_keys=True, separators=(",",":"), ensure_ascii=False)

def sha(v):
    return hashlib.sha256(canon(v).encode()).hexdigest()

ASSISTANCE = {"NONE","COMMENT","NOTICE","QUESTION","THEORY","NUDGE","HINT","PARTIAL_SOLUTION","SOLUTION"}
INITIATIVE = {"NONE","QUESTION"}
DISCOVERY = {"NONE","WAIT","NEUTRAL_CHECKIN","EVIDENCE_CHECK","OBSERVE","BYPASS_CANDIDATE"}
SURFACE = {"WAIT","COMMENT","OBSERVATION","QUESTION","THEORY"}

def generate(state, event):
    req(isinstance(state,dict) and isinstance(event,dict),"inputs")
    req(event.get("speaker")=="PLAYER","player event required")
    req(state.get("scope_id"),"state scope")
    req(event.get("turn") == state.get("last_turn") + 1,"event/state frontier mismatch")
    req(not any(state.get(k) for k in (
        "stored_help_authority","stored_solution_authority","stored_response_authority",
        "solver_mode","player_profile_created"
    )),"forbidden persistent authority state")
    intent=event.get("player_intent")
    ev=event.get("event")
    focus=event.get("focus","NONE")
    req(intent in {"NONE","CONVERSATION","HINT_REQUEST","PARTIAL_SOLUTION_REQUEST","SOLUTION_REQUEST"},"intent")
    req(state.get("session_phase") in {"ACTIVE","PAUSED","RESUMED_NEUTRAL"},"phase")

    assistance="COMMENT"
    initiative="NONE"
    discovery="WAIT"
    surface="COMMENT"
    focus_request = focus if focus != "NONE" else "NONE"
    reason="CURRENT_EVENT_CONVERSATION"

    if ev=="PAUSE":
        assistance="NONE"; discovery="WAIT"; surface="WAIT"; focus_request="NONE"; reason="PLAYER_PAUSE"
    elif ev=="RESUME":
        req(state["session_phase"]=="PAUSED","resume outside pause")
        assistance="COMMENT"; initiative="QUESTION"; discovery="NEUTRAL_CHECKIN"; surface="QUESTION"
        focus_request="NONE"; reason="NEUTRAL_RESUME"
    elif intent=="HINT_REQUEST":
        assistance="HINT"; discovery="WAIT"; surface="COMMENT"; reason="EXPLICIT_HINT_REQUEST"
    elif intent=="PARTIAL_SOLUTION_REQUEST":
        assistance="PARTIAL_SOLUTION"; discovery="WAIT"; surface="COMMENT"; reason="EXPLICIT_PARTIAL_SOLUTION_REQUEST"
    elif intent=="SOLUTION_REQUEST":
        assistance="SOLUTION"; discovery="BYPASS_CANDIDATE"; surface="COMMENT"; reason="EXPLICIT_SOLUTION_REQUEST"
    elif ev in {"PLAYER_CORRECTION","PLAYER_REJECTS_HINT_HYPOTHESIS"}:
        assistance="QUESTION"; discovery="EVIDENCE_CHECK"; surface="QUESTION"; reason="LOCAL_CORRECTION"
    elif ev=="PLAYER_OBSERVATION":
        assistance="NOTICE"; discovery="OBSERVE"; surface="OBSERVATION"; reason="LOCAL_OBSERVATION"
    elif ev=="PLAYER_HYPOTHESIS":
        assistance="THEORY"; discovery="WAIT"; surface="THEORY"; reason="PLAYER_HYPOTHESIS"
    else:
        assistance="COMMENT"; discovery="WAIT"; surface="COMMENT"

    env={
        "schema_version":"kontur-game-companion-candidate-envelope-v0.1",
        "status":"SYNTHETIC_NON_EXECUTING",
        "scope_id":state["scope_id"],
        "source_turn":event["turn"],
        "source_event":ev,
        "source_state_digest":sha(state),
        "source_event_digest":sha(event),
        "request_scope":"CURRENT_EVENT_ONLY",
        "requested_assistance_depth":assistance,
        "requested_initiative_depth":initiative,
        "requested_discovery_posture":discovery,
        "requested_surface_move":surface,
        "requested_focus":focus_request,
        "reason":reason,
        "response_text":None,
        "response_admissible":None,
        "authority_effect":"NONE",
        "action_effect":"NONE",
        "successor_effect":"NONE",
        "persistent_solver_mode":False,
        "future_help_authority":False,
        "future_solution_authority":False,
        "runtime_connectedness":"NOT_PROVEN",
    }
    validate_envelope(state,event,env)
    env["envelope_digest"]=sha(env)
    return env

def validate_envelope(state,event,e):
    req(e.get("schema_version")=="kontur-game-companion-candidate-envelope-v0.1","schema")
    req(e.get("status")=="SYNTHETIC_NON_EXECUTING","status")
    req(e.get("scope_id")==state.get("scope_id"),"scope")
    req(e.get("source_turn")==event.get("turn") and e.get("source_event")==event.get("event"),"source")
    req(e.get("source_state_digest")==sha(state) and e.get("source_event_digest")==sha(event),"source digest")
    req(e.get("request_scope")=="CURRENT_EVENT_ONLY","request scope")
    req(e.get("requested_assistance_depth") in ASSISTANCE,"assistance")
    req(e.get("requested_initiative_depth") in INITIATIVE,"initiative")
    req(e.get("requested_discovery_posture") in DISCOVERY,"discovery")
    req(e.get("requested_surface_move") in SURFACE,"surface")
    req(e.get("response_text") is None,"text generation")
    req(e.get("response_admissible") is None,"synthetic approval")
    req(e.get("authority_effect")=="NONE" and e.get("action_effect")=="NONE" and e.get("successor_effect")=="NONE","authority effects")
    req(e.get("persistent_solver_mode") is False,"solver mode")
    req(e.get("future_help_authority") is False and e.get("future_solution_authority") is False,"future authority")
    req(e.get("runtime_connectedness")=="NOT_PROVEN","runtime")

    intent=event.get("player_intent")
    ev=event.get("event")
    a=e["requested_assistance_depth"]
    if intent=="HINT_REQUEST": req(a=="HINT","hint escalation/downgrade")
    if intent=="PARTIAL_SOLUTION_REQUEST": req(a=="PARTIAL_SOLUTION","partial solution mismatch")
    if intent=="SOLUTION_REQUEST":
        req(a=="SOLUTION","solution mismatch")
        req(e["requested_discovery_posture"]=="BYPASS_CANDIDATE","solution discovery")
    if intent=="CONVERSATION":
        req(a not in {"NUDGE","HINT","PARTIAL_SOLUTION","SOLUTION"},"conversation escalated to help")
    if ev=="PAUSE":
        req(a=="NONE" and e["requested_surface_move"]=="WAIT" and e["requested_focus"]=="NONE","pause request")
    if ev=="RESUME":
        req(state.get("session_phase")=="PAUSED","resume state")
        req(e["requested_focus"]=="NONE" and e["requested_discovery_posture"]=="NEUTRAL_CHECKIN","stale resume")
        req(a=="COMMENT" and e["requested_initiative_depth"]=="QUESTION","resume envelope")
    if ev in {"PLAYER_CORRECTION","PLAYER_REJECTS_HINT_HYPOTHESIS"}:
        req(a=="QUESTION" and e["requested_discovery_posture"]=="EVIDENCE_CHECK","correction envelope")
    if ev=="PLAYER_OBSERVATION":
        req(a=="NOTICE" and e["requested_discovery_posture"]=="OBSERVE","observation envelope")
    if ev=="PLAYER_HYPOTHESIS":
        req(a=="THEORY","hypothesis envelope")
    if event.get("focus")=="NONE" and ev!="RESUME":
        req(e["requested_focus"]=="NONE","invented focus")

def load_trace(path=TRACE):
    return json.loads(Path(path).read_text())

if __name__=="__main__":
    print("candidate-envelope generator is library-first; run validate.py")
