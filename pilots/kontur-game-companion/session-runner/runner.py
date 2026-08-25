#!/usr/bin/env python3
import copy, hashlib, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TRACE = HERE.parent / "integrated-conversation-trace" / "integrated-conversation-trace.json"
DEPTH = {"NONE":-1,"COMMENT":0,"NOTICE":1,"QUESTION":2,"THEORY":3,"NUDGE":4,"HINT":5,"PARTIAL_SOLUTION":6,"SOLUTION":7}
INTENT_MAX = {"NONE":"COMMENT","CONVERSATION":"THEORY","HINT_REQUEST":"HINT","PARTIAL_SOLUTION_REQUEST":"PARTIAL_SOLUTION","SOLUTION_REQUEST":"SOLUTION"}
FORBIDDEN_TARGETS={"PLAYER_ABILITY","PLAYER_INTELLIGENCE","PLAYER_PERSONALITY","PLAYER_IDENTITY","PLAYER_WORTH","PLAYER_REFUSAL","PLAYER_FRUSTRATION","PLAYER_MISTAKE_AS_TRAIT"}
NON_EFFECTS={"live_response_generation","proactive_messaging","background_activity","autonomous_gameplay","game_account_control","external_effect","response_authority_created","action_permit_created","successor_permit_created","behavioral_profile","psychological_inference","mood_inference","attention_tracking","engagement_maximization","retention_optimization","total_history_capture","cross_game_preference_profile","stable_core_promotion"}

class ReductionError(ValueError): pass
def req(c,m):
    if not c: raise ReductionError(m)
def canon(v): return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False)
def sha(v): return hashlib.sha256(canon(v).encode()).hexdigest()

def initial(scope):
    return {"scope_id":scope,"session_phase":"ACTIVE","focus":"NONE","pending_player_event":None,"local_memory":[],"claims":{},"spoiler_exposure_level":0,"last_turn":0,"stored_help_authority":False,"stored_solution_authority":False,"stored_response_authority":False,"solver_mode":False,"player_profile_created":False}

def validate_top(t):
    req(t.get("schema_version")=="kontur-game-companion-integrated-conversation-trace-v0.1","source schema")
    req(t.get("status")=="SYNTHETIC_NON_EXECUTING","source status")
    req(t.get("runtime_connectedness")=="NOT_PROVEN","runtime connectedness")
    req(t.get("composition_semantics")=={"decision":"TRACE_CONSISTENT","authority_effect":"NONE","action_effect":"NONE","successor_effect":"NONE","stable_core_effect":"NONE"},"composition semantics")
    ne=t.get("non_effects",{})
    req(NON_EFFECTS.issubset(ne) and all(ne[k] is False for k in NON_EFFECTS),"non-effects")
    req(t.get("turns"),"turns missing")

def add_memory(s,n,m):
    req(m.get("scope_match") is True,"memory scope")
    s["local_memory"].append({"source_turn":n,"class":m["class"],"state":m["state"],"scope_id":s["scope_id"]})

def has_memory(s,n,c):
    return any(x["source_turn"]==n and x["class"]==c for x in s["local_memory"])

def player(s,t):
    ev,intent,focus=t["event"],t.get("player_intent"),t.get("focus")
    req(intent in INTENT_MAX,"unknown intent")
    if ev=="PAUSE":
        p=t.get("pause_resume",{})
        req(p.get("transition")=="SESSION_BREAK","pause transition")
        req(all(p.get(k) is False for k in ("help_authority_carried","intent_carried","focus_carried")),"pause carryover")
        s.update(session_phase="PAUSED",focus="NONE",pending_player_event=None); return
    if ev=="RESUME":
        req(s["session_phase"]=="PAUSED","resume while not paused")
        p=t.get("pause_resume",{})
        req(p.get("transition")=="LIGHT_RECALL","resume transition")
        req(all(p.get(k) is False for k in ("help_authority_carried","intent_carried","focus_carried")),"resume carryover")
        s.update(session_phase="RESUMED_NEUTRAL",focus="NONE",pending_player_event={"turn":t["turn"],"event":ev,"intent":"NONE","focus":"NONE"}); return
    req(s["session_phase"]!="PAUSED","event while paused")
    if s["session_phase"]=="RESUMED_NEUTRAL": s["session_phase"]="ACTIVE"
    if focus and focus!="NONE": s["focus"]=focus
    if "correction" in t:
        c=t["correction"]; target=str(c.get("target_turn"))
        req(target in s["claims"],"unknown correction target")
        req(c.get("global_truth") is False,"correction globalized")
        s["claims"][target].update(pending_correction_from_turn=t["turn"],pending_evidence_strength=c.get("evidence_strength"))
    if "memory_write" in t: add_memory(s,t["turn"],t["memory_write"])
    s["pending_player_event"]={"turn":t["turn"],"event":ev,"intent":intent,"focus":focus}

def companion(s,t):
    p=s.get("pending_player_event"); req(p is not None,"companion without pending player event")
    r=t.get("interaction_receipt",{})
    req(r.get("response_admissible") is True and r.get("scope")=="THIS_CANDIDATE_ONLY" and r.get("authority_effect")=="NONE" and r.get("response_authority_created") is False,"receipt boundary")

    a=t.get("assistance",{}); ceil,sel=a.get("ceiling"),a.get("selected")
    req(ceil in DEPTH and sel in DEPTH and DEPTH[sel]<=DEPTH[ceil],"assistance ceiling")
    req(DEPTH[sel]<=DEPTH[INTENT_MAX[p["intent"]]],"intent assistance boundary")
    budget,new=a.get("spoiler_budget"),a.get("new_spoiler_level")
    req(isinstance(budget,int) and isinstance(new,int) and 0<=new<=budget,"spoiler budget")
    if sel=="HINT": req(p["intent"] in {"HINT_REQUEST","PARTIAL_SOLUTION_REQUEST","SOLUTION_REQUEST"},"unsolicited hint")
    if sel=="PARTIAL_SOLUTION": req(p["intent"] in {"PARTIAL_SOLUTION_REQUEST","SOLUTION_REQUEST"},"unsolicited partial solution")
    if sel=="SOLUTION": req(p["intent"]=="SOLUTION_REQUEST","unsolicited solution")

    i=t.get("initiative",{}); auth,chosen=i.get("authorized_depth"),i.get("selected_depth")
    req(auth in DEPTH and chosen in DEPTH and DEPTH[chosen]<=DEPTH[auth],"initiative boundary")
    if i.get("companion_led") is False: req(chosen in {"NONE","COMMENT"},"invented initiative")

    d=t.get("discovery",{}); req(d.get("hidden_answer") is False,"hidden discovery answer")
    if d.get("outcome")=="ALLOW_PROMPT":
        req(d.get("focus_preserved") is True and d.get("reversible") is True and d.get("low_cost") is True,"unsafe discovery prompt")
    if d.get("outcome")=="BYPASS_DISCOVERY":
        req(p["intent"]=="SOLUTION_REQUEST" and sel=="SOLUTION","invalid discovery bypass")

    v=t.get("variety",{}); req(v.get("objective")=="CONVERSATIONAL_QUALITY" and v.get("focus_preserved") is True,"variety boundary")
    play=t.get("playfulness",{})
    req(play.get("hidden_hint") is False and play.get("pressure_to_continue") is False,"playfulness pressure/hint")
    req(play.get("target") not in FORBIDDEN_TARGETS,"player-targeted humor")
    if play.get("mode")=="PLAYFUL_HYPOTHESIS": req(play.get("epistemic_mode")=="PLAYFUL_THEORY","false playful certainty")

    if "pause_resume" in t:
        pr=t["pause_resume"]; req(p["event"]=="RESUME" and pr.get("transition")=="NEUTRAL_CHECKIN","resume checkin")
        req(pr.get("old_help_reused") is False and pr.get("old_focus_forced") is False,"resume restored stale state")

    if "memory_reuse" in t:
        m=t["memory_reuse"]
        req(m.get("active") is True and m.get("scope_match") is True and has_memory(s,m.get("source_turn"),m.get("class")),"invalid memory reuse")

    if "uncertainty_repair" in t:
        u=t["uncertainty_repair"]; target=str(u.get("target_turn"))
        req(target in s["claims"] and "pending_correction_from_turn" in s["claims"][target],"repair without pending correction")
        req(u.get("history_rewritten") is False and u.get("player_claim_promoted_global") is False,"repair provenance")
        req(u.get("new_state") in {"CHALLENGED","DISPROVED","CONTESTED","SUPERSEDED"},"repair state")
        s["claims"][target].update(state=u["new_state"],repair_turn=t["turn"],repair_mode=u.get("mode"))
        s["claims"][target].pop("pending_correction_from_turn",None); s["claims"][target].pop("pending_evidence_strength",None)

    if "memory_write" in t: add_memory(s,t["turn"],t["memory_write"])
    if t["event"] in {"PLAYFUL_THEORY_RESPONSE","BOUNDED_HINT"}:
        s["claims"][str(t["turn"])]={"origin_turn":t["turn"],"event":t["event"],"state":"ACTIVE","scope_id":s["scope_id"]}
    if sel=="SOLUTION":
        req(d.get("outcome")=="BYPASS_DISCOVERY","solution without discovery bypass")
        q=t.get("solution_scope",{})
        req(q.get("this_request_only") is True and q.get("future_solution_authority") is False,"solution scope")

    s["spoiler_exposure_level"]=max(s["spoiler_exposure_level"],new)
    s["pending_player_event"]=None

def reduce_turn(s,t,n):
    req(t.get("turn")==n,"turn sequence")
    req(t.get("speaker") in {"PLAYER","COMPANION"},"speaker")
    if t["speaker"]=="PLAYER":
        req(t.get("companion_response") is None,"player turn contains response"); player(s,t)
    else: companion(s,t)
    s["last_turn"]=n
    req(not any(s[k] for k in ("stored_help_authority","stored_solution_authority","stored_response_authority","solver_mode","player_profile_created")),"forbidden persistent effect")

def run_trace(t):
    validate_top(t); s=initial(t["scope_id"]); out=[]
    for n,event in enumerate(t["turns"],1):
        before=copy.deepcopy(s); reduce_turn(s,event,n); after=copy.deepcopy(s)
        pre,ev,post=sha(before),sha(event),sha(after)
        out.append({"turn":n,"speaker":event["speaker"],"event":event["event"],"pre_state_digest":pre,"event_digest":ev,"post_state_digest":post,"transition_digest":hashlib.sha256(f"{pre}:{ev}:{post}".encode()).hexdigest(),"session_phase":after["session_phase"],"focus":after["focus"],"pending_intent":None if after["pending_player_event"] is None else after["pending_player_event"]["intent"],"spoiler_exposure_level":after["spoiler_exposure_level"],"claim_states":{k:v["state"] for k,v in sorted(after["claims"].items())}})
    return {"schema_version":"kontur-game-companion-session-runner-v0.1","status":"SYNTHETIC_NON_EXECUTING","source_trace_schema":t["schema_version"],"source_origin_frontier":t["origin_frontier"],"scenario_id":t["scenario_id"],"scope_id":t["scope_id"],"runtime_connectedness":"NOT_PROVEN","reducer_semantics":{"decision":"STATE_REDUCED","policy_oracle":False,"text_generated":False,"authority_effect":"NONE","action_effect":"NONE","successor_effect":"NONE","stable_core_effect":"NONE"},"transitions":out,"final_state":s,"final_state_digest":sha(s)}

def load(path=TRACE): return json.loads(Path(path).read_text())

def _bad(t,mut):
    x=copy.deepcopy(t); mut(x)
    try: run_trace(x)
    except ReductionError: return
    raise AssertionError("unsafe mutation accepted")

def self_validate():
    t=load(); a=run_trace(copy.deepcopy(t)); b=run_trace(copy.deepcopy(t))
    assert a==b and len(a["transitions"])==15
    tr=a["transitions"]
    assert tr[6]["session_phase"]=="PAUSED" and tr[6]["focus"]=="NONE" and tr[6]["pending_intent"] is None
    assert tr[7]["session_phase"]=="RESUMED_NEUTRAL" and tr[7]["focus"]=="NONE" and tr[7]["pending_intent"]=="NONE"
    assert tr[8]["pending_intent"] is None and tr[9]["session_phase"]=="ACTIVE" and tr[9]["pending_intent"]=="HINT_REQUEST"
    assert tr[10]["pending_intent"] is None and tr[13]["pending_intent"]=="SOLUTION_REQUEST" and tr[14]["pending_intent"] is None
    assert tr[3]["claim_states"]["2"]=="DISPROVED" and tr[12]["claim_states"]["11"]=="CHALLENGED"
    f=a["final_state"]
    assert f["claims"]["2"]["state"]=="DISPROVED" and f["claims"]["11"]["state"]=="CHALLENGED"
    assert f["spoiler_exposure_level"]==4 and f["pending_player_event"] is None
    assert not any(f[k] for k in ("stored_help_authority","stored_solution_authority","stored_response_authority","solver_mode","player_profile_created"))
    for n,x in enumerate(tr):
        assert all(len(x[k])==64 for k in ("pre_state_digest","event_digest","post_state_digest","transition_digest"))
        if n: assert tr[n-1]["post_state_digest"]==x["pre_state_digest"]

    muts=[]
    def m(fn): muts.append(fn)
    m(lambda x:x.__setitem__("runtime_connectedness","PROVEN"))
    for k in ("authority_effect","action_effect","successor_effect","stable_core_effect"): m(lambda x,k=k:x["composition_semantics"].__setitem__(k,"CREATE"))
    for k in ("live_response_generation","response_authority_created","stable_core_promotion"): m(lambda x,k=k:x["non_effects"].__setitem__(k,True))
    m(lambda x:x["turns"][4].__setitem__("turn",99)); m(lambda x:x["turns"][0].__setitem__("speaker","SYSTEM"))
    m(lambda x:x["turns"][2]["correction"].__setitem__("global_truth",True)); m(lambda x:x["turns"][2]["correction"].__setitem__("target_turn",999))
    m(lambda x:x["turns"][3]["uncertainty_repair"].__setitem__("history_rewritten",True)); m(lambda x:x["turns"][3]["uncertainty_repair"].__setitem__("player_claim_promoted_global",True)); m(lambda x:x["turns"][3]["uncertainty_repair"].__setitem__("target_turn",999))
    for k in ("help_authority_carried","intent_carried","focus_carried"):
        m(lambda x,k=k:x["turns"][6]["pause_resume"].__setitem__(k,True)); m(lambda x,k=k:x["turns"][7]["pause_resume"].__setitem__(k,True))
    m(lambda x:x["turns"][8]["pause_resume"].__setitem__("old_help_reused",True)); m(lambda x:x["turns"][8]["pause_resume"].__setitem__("old_focus_forced",True))
    m(lambda x:x["turns"][1]["interaction_receipt"].__setitem__("scope","SESSION")); m(lambda x:x["turns"][1]["interaction_receipt"].__setitem__("authority_effect","CREATE")); m(lambda x:x["turns"][1]["interaction_receipt"].__setitem__("response_authority_created",True)); m(lambda x:x["turns"][1]["interaction_receipt"].__setitem__("response_admissible",False))
    m(lambda x:x["turns"][1]["assistance"].update({"ceiling":"SOLUTION","selected":"SOLUTION"})); m(lambda x:x["turns"][10]["assistance"].update({"ceiling":"SOLUTION","selected":"SOLUTION"})); m(lambda x:x["turns"][3]["assistance"].update({"ceiling":"NOTICE","selected":"QUESTION"})); m(lambda x:x["turns"][10]["assistance"].__setitem__("new_spoiler_level",99))
    m(lambda x:x["turns"][8]["initiative"].__setitem__("selected_depth","SOLUTION")); m(lambda x:x["turns"][10]["initiative"].__setitem__("selected_depth","QUESTION"))
    m(lambda x:x["turns"][3]["discovery"].__setitem__("hidden_answer",True)); m(lambda x:x["turns"][3]["discovery"].__setitem__("reversible",False)); m(lambda x:x["turns"][3]["discovery"].__setitem__("low_cost",False)); m(lambda x:x["turns"][3]["discovery"].__setitem__("focus_preserved",False)); m(lambda x:x["turns"][10]["discovery"].__setitem__("outcome","BYPASS_DISCOVERY")); m(lambda x:x["turns"][14]["discovery"].__setitem__("outcome","ALLOW_WAIT"))
    m(lambda x:x["turns"][14]["solution_scope"].__setitem__("this_request_only",False)); m(lambda x:x["turns"][14]["solution_scope"].__setitem__("future_solution_authority",True))
    m(lambda x:x["turns"][1]["playfulness"].__setitem__("hidden_hint",True)); m(lambda x:x["turns"][1]["playfulness"].__setitem__("pressure_to_continue",True)); m(lambda x:x["turns"][1]["playfulness"].__setitem__("target","PLAYER_ABILITY")); m(lambda x:x["turns"][1]["playfulness"].__setitem__("epistemic_mode","KNOWN"))
    m(lambda x:x["turns"][1]["variety"].__setitem__("objective","ENGAGEMENT_MAXIMIZATION")); m(lambda x:x["turns"][1]["variety"].__setitem__("focus_preserved",False))
    m(lambda x:x["turns"][5]["memory_reuse"].__setitem__("scope_match",False)); m(lambda x:x["turns"][5]["memory_reuse"].__setitem__("active",False)); m(lambda x:x["turns"][5]["memory_reuse"].__setitem__("source_turn",999))
    for fn in muts: _bad(t,fn)

    probe=copy.deepcopy(t)
    probe["turns"] += [
      {"turn":16,"speaker":"PLAYER","event":"POST_SOLUTION_CONVERSATION","player_intent":"CONVERSATION","focus":"gate-mechanism","text_shape":"Why did that happen?","companion_response":None},
      {"turn":17,"speaker":"COMPANION","event":"UNSOLICITED_POST_SOLUTION","player_intent":"CONVERSATION","focus":"gate-mechanism","assistance":{"ceiling":"SOLUTION","selected":"SOLUTION","spoiler_budget":4,"new_spoiler_level":4},"initiative":{"companion_led":False,"authorized_depth":"NONE","selected_depth":"NONE"},"interaction_receipt":{"response_admissible":True,"scope":"THIS_CANDIDATE_ONLY","authority_effect":"NONE","response_authority_created":False},"discovery":{"outcome":"BYPASS_DISCOVERY","move":"WAIT","hidden_answer":False},"variety":{"move":"COMMENT","objective":"CONVERSATIONAL_QUALITY","focus_preserved":True},"playfulness":{"decision":"REDUCE_PLAYFULNESS","mode":"WAIT","target":"NEUTRAL_EVENT","epistemic_mode":"KNOWN","hidden_hint":False,"pressure_to_continue":False},"solution_scope":{"this_request_only":True,"future_solution_authority":False},"text_shape":"Attempts persistent solver mode."}
    ]
    try: run_trace(probe)
    except ReductionError: pass
    else: raise AssertionError("post-solution solver carryover accepted")
    return a,len(muts)+1

def main():
    if "--validate" in sys.argv:
        out,n=self_validate(); print(f"session runner validation: PASS; turns={len(out['transitions'])}; fail_closed_mutations={n}; final_state_digest={out['final_state_digest']}")
    else:
        print(json.dumps(run_trace(load(sys.argv[1] if len(sys.argv)>1 else TRACE)),indent=2,sort_keys=True,ensure_ascii=False))
if __name__=="__main__": main()
