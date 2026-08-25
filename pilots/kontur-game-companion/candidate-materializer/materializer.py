#!/usr/bin/env python3
import copy, hashlib, importlib.util, json
from pathlib import Path

HERE=Path(__file__).resolve().parent; ROOT=HERE.parent
TRACE=ROOT/"integrated-conversation-trace"/"integrated-conversation-trace.json"
RUNNER=ROOT/"session-runner"/"runner.py"; GENERATOR=ROOT/"candidate-envelope"/"generator.py"
EVALUATOR=ROOT/"policy-evaluation-harness"/"evaluator.py"; IR_VALIDATE=ROOT/"interaction-receipt"/"validate.py"
IR_FIXTURE=ROOT/"interaction-receipt"/"interaction-receipt-cases.json"

def loadmod(name,path):
    s=importlib.util.spec_from_file_location(name,path); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
runner=loadmod("mat_runner",RUNNER); gen=loadmod("mat_generator",GENERATOR); evl=loadmod("mat_evaluator",EVALUATOR); ir=loadmod("mat_ir",IR_VALIDATE)
class MaterializationError(ValueError): pass
def req(c,m):
    if not c: raise MaterializationError(m)
def canon(v): return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False)
def sha(v): return hashlib.sha256(canon(v).encode()).hexdigest()
def file_sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

INTENT_MAX={"NONE":"COMMENT","CONVERSATION":"THEORY","HINT_REQUEST":"HINT","PARTIAL_SOLUTION_REQUEST":"PARTIAL_SOLUTION","SOLUTION_REQUEST":"SOLUTION"}
EXACT={
("PLAYER_HYPOTHESIS","THEORY"):("player-hypothesis-theory","Maybe the gate cares about how the lamps coordinate — only a theory for now.","PLAYFUL_THEORY",False),
("PLAYER_CORRECTION","QUESTION"):("correction-evidence-question","Then my lamp theory does not hold. What else changes when you step off the plate?","LIKELY",False),
("PLAYER_OBSERVATION","NOTICE"):("local-observation-notice","The wall symbol flashes at the same moment; that synchronization seems worth watching.","KNOWN",False),
("RESUME","COMMENT"):("neutral-resume-comment","Want to go back to the gate, or do something else?","KNOWN",False),
("EXPLICIT_HINT_REQUEST","HINT"):("bounded-symbol-timing-hint","One hint: compare the symbol change with the exact moment you leave the plate.","LIKELY",False),
("PLAYER_REJECTS_HINT_HYPOTHESIS","QUESTION"):("challenged-hint-evidence-question","Fair — that hint is challenged. What do the symbols themselves do that points you there?","LIKELY",False),
("EXPLICIT_SOLUTION_REQUEST","SOLUTION"):("fixture-local-direct-solution","Synthetic fixture solution: activate the symbols in the order SUN → LEAF → MOON.","KNOWN",True),
}
GENERIC={
"COMMENT":("generic-comment","I can stay with what you are noticing without pushing the puzzle further.","KNOWN",False),
"NOTICE":("generic-notice","That change looks relevant; I would keep an eye on it.","LIKELY",False),
"QUESTION":("generic-evidence-question","What part of what just happened feels most informative to you?","KNOWN",False),
"THEORY":("generic-theory","One possible theory is that those changes are connected, but I would not treat that as fact yet.","GUESS",False),
"NUDGE":("generic-nudge","Try changing just one thing and watch what reacts.","LIKELY",False),
"HINT":("generic-hint","One hint: compare what changes before and after the action you just tested.","LIKELY",False),
"PARTIAL_SOLUTION":("generic-partial-solution","Partial solution: the changing symbols are part of the mechanism; their ordering is the next piece to test.","LIKELY",False),
"SOLUTION":("generic-fixture-solution","Synthetic fixture solution: activate the symbols in the order SUN → LEAF → MOON.","KNOWN",True),
}

def official_ir_sha():
    ir.validate(json.loads(IR_FIXTURE.read_text())); return file_sha(IR_VALIDATE)
def template(event,depth):
    req(depth!="NONE","no text for NONE"); x=EXACT.get((event["event"],depth),GENERIC.get(depth)); req(x is not None,"missing template")
    return {"template_id":x[0],"text":x[1],"epistemic_mode":x[2],"contains_solution":x[3],"hidden_hint":False}

def validate_candidate(state,event,pre,c):
    req(pre.get("shape_admissible") is True and pre.get("downstream_interaction_receipt_required") is True,"shape not materializable")
    req(c.get("schema_version")=="kontur-game-companion-synthetic-candidate-v0.1" and c.get("status")=="SYNTHETIC_NON_EXECUTING","candidate identity")
    req(c.get("scope_id")==state.get("scope_id") and c.get("source_turn")==event.get("turn") and c.get("source_event")==event.get("event"),"candidate source")
    req(c.get("source_policy_receipt_digest")==pre.get("policy_receipt_digest"),"policy binding")
    req(c.get("assistance_depth")==pre.get("selected_assistance_depth") and c.get("surface_move")==pre.get("selected_surface_move") and c.get("focus")==pre.get("selected_focus"),"shape drift")
    req(isinstance(c.get("response_text"),str) and c["response_text"].strip(),"missing text"); req(c.get("text_digest")==hashlib.sha256(c["response_text"].encode()).hexdigest(),"text digest")
    req(c.get("template_source")=="FIXED_SYNTHETIC_CATALOG" and c.get("language_model_invoked") is False,"non-deterministic generation")
    for k in ("player_judgment","pressure_to_continue","hidden_hint","response_authority_created","send_authority","external_effect","future_help_authority","future_solution_authority","persistent_solver_mode"):
        req(c.get(k) is False,f"candidate effect: {k}")
    req(c.get("player_can_ignore") is True and c.get("runtime_connectedness")=="NOT_PROVEN" and c.get("candidate_scope")=="THIS_CANDIDATE_ONLY","candidate boundary")
    req(c.get("epistemic_mode") in ir.EPISTEMIC and c.get("assistance_depth") in ir.ASSISTANCE,"candidate modes")
    intent=event.get("player_intent"); req(intent in INTENT_MAX,"intent")
    if event.get("event")!="RESUME": req(ir.ASSISTANCE[c["assistance_depth"]]<=ir.ASSISTANCE[INTENT_MAX[intent]],"exceeds current intent")
    if c.get("contains_solution"):
        req(c["assistance_depth"]=="SOLUTION" and intent=="SOLUTION_REQUEST","solution without current request"); req(c.get("solution_scope")=="SYNTHETIC_FIXTURE_LOCAL_THIS_REQUEST_ONLY","solution scope")
    else: req(c["assistance_depth"]!="SOLUTION","solution depth unmarked")
    t=template(event,c["assistance_depth"]); req(c["template_id"]==t["template_id"] and c["response_text"]==t["text"] and c["epistemic_mode"]==t["epistemic_mode"] and c["contains_solution"]==t["contains_solution"],"template drift")

def validate_receipt(state,event,pre,c,r):
    req(r.get("schema_version")=="kontur-game-companion-materialized-interaction-receipt-v0.1" and r.get("status")=="SYNTHETIC_NON_EXECUTING","receipt identity")
    req(r.get("semantics_source")=="KONTUR_INTERACTION_RECEIPT_V0.2" and r.get("semantics_validator_sha256")==file_sha(IR_VALIDATE),"receipt semantic binding")
    req(r.get("decision_semantics")==ir.DECISION_SEMANTICS and r.get("scope")=="THIS_CANDIDATE_ONLY","decision semantics")
    req(r.get("scope_id")==state.get("scope_id") and r.get("source_turn")==event.get("turn") and r.get("source_candidate_digest")==c.get("candidate_digest") and r.get("source_policy_receipt_digest")==pre.get("policy_receipt_digest"),"receipt binding")
    companion=event.get("event")=="RESUME"; req(r.get("interaction_owner")==("COMPANION_LED" if companion else "PLAYER_LED"),"owner")
    req(r.get("assistance_depth")==c.get("assistance_depth") and r.get("initiative_depth")==pre.get("selected_initiative_depth"),"receipt shape")
    if companion:
        req(r.get("initiative_authorized") is True and r["initiative_depth"] in ir.INITIATIVE and r["initiative_depth"]!="NONE","initiative"); req(ir.ASSISTANCE[r["assistance_depth"]]<=ir.INITIATIVE[r["initiative_depth"]],"initiative ceiling")
    else:
        req(r.get("initiative_authorized") is False and r["initiative_depth"]=="NONE","player-led initiative"); req(r.get("recorded_intent_class") in INTENT_MAX and ir.ASSISTANCE[r["assistance_depth"]]<=ir.ASSISTANCE[INTENT_MAX[r["recorded_intent_class"]]],"intent ceiling")
    for k in ("content_candidate_present","content_safety_evaluated","player_judgment_evaluated","focus_preserved","player_can_ignore","receipt_complete","response_admissible"):
        req(r.get(k) is True,f"receipt required true: {k}")
    for k in ("hidden_hint","player_judgment","pressure_to_continue","factual_correctness_evaluated","response_authority_created","send_authority","action_permit_created","successor_permit_created","future_help_authority","future_solution_authority","persistent_solver_mode"):
        req(r.get(k) is False,f"receipt effect: {k}")
    req(r.get("authority_effect")==r.get("action_effect")==r.get("successor_effect")=="NONE" and r.get("runtime_connectedness")=="NOT_PROVEN","receipt effects")
    req(set(r.get("boundary",{}))==ir.BOUNDARY_FALSE and all(r["boundary"][k] is False for k in ir.BOUNDARY_FALSE),"boundary")
    if c["contains_solution"]: req(event.get("player_intent")=="SOLUTION_REQUEST" and r.get("synthetic_fixture_truth_only") is True,"solution receipt")
    else: req(r.get("synthetic_fixture_truth_only") is False,"fixture truth marker")

def build_receipt(state,event,pre,c):
    vsha=official_ir_sha(); companion=event.get("event")=="RESUME"
    r={"schema_version":"kontur-game-companion-materialized-interaction-receipt-v0.1","status":"SYNTHETIC_NON_EXECUTING","semantics_source":"KONTUR_INTERACTION_RECEIPT_V0.2","semantics_validator_path":"pilots/kontur-game-companion/interaction-receipt/validate.py","semantics_validator_sha256":vsha,"decision_semantics":copy.deepcopy(ir.DECISION_SEMANTICS),"scope_id":state["scope_id"],"source_turn":event["turn"],"source_event":event["event"],"source_policy_receipt_digest":pre["policy_receipt_digest"],"source_candidate_digest":c["candidate_digest"],"scope":"THIS_CANDIDATE_ONLY","interaction_owner":"COMPANION_LED" if companion else "PLAYER_LED","recorded_intent_class":event.get("player_intent"),"assistance_depth":c["assistance_depth"],"initiative_depth":pre["selected_initiative_depth"],"initiative_authorized":companion and pre["selected_initiative_depth"]!="NONE","focus_preserved":event.get("focus","NONE") in {"NONE",c["focus"]},"content_candidate_present":True,"content_safety_evaluated":True,"factual_correctness_evaluated":False,"synthetic_fixture_truth_only":c["contains_solution"],"player_judgment_evaluated":True,"hidden_hint":c["hidden_hint"],"player_judgment":c["player_judgment"],"pressure_to_continue":c["pressure_to_continue"],"player_can_ignore":c["player_can_ignore"],"receipt_complete":True,"response_admissible":True,"response_authority_created":False,"send_authority":False,"authority_effect":"NONE","action_effect":"NONE","successor_effect":"NONE","action_permit_created":False,"successor_permit_created":False,"future_help_authority":False,"future_solution_authority":False,"persistent_solver_mode":False,"runtime_connectedness":"NOT_PROVEN","boundary":{k:False for k in sorted(ir.BOUNDARY_FALSE)}}
    validate_receipt(state,event,pre,c,r); r["interaction_receipt_digest"]=sha(r); return r

def materialize(state,event,envelope,pre,policy_context=None):
    gen.validate_envelope(state,event,envelope); ctx=evl.default_policy_context(event) if policy_context is None else copy.deepcopy(policy_context); evl.validate_policy_context(event,ctx); evl.validate_receipt(state,event,envelope,ctx,pre)
    req(pre.get("policy_receipt_digest")==evl.sha({k:v for k,v in pre.items() if k!="policy_receipt_digest"}),"pretext digest"); req(pre.get("source_envelope_digest")==envelope.get("envelope_digest"),"pretext/envelope binding")
    if pre.get("decision") in {"NO_RESPONSE_CANDIDATE","SHAPE_BLOCKED"}: req(pre.get("downstream_interaction_receipt_required") is False,"unexpected downstream receipt"); return None
    req(pre.get("shape_admissible") is True,"shape not admissible"); t=template(event,pre["selected_assistance_depth"])
    c={"schema_version":"kontur-game-companion-synthetic-candidate-v0.1","status":"SYNTHETIC_NON_EXECUTING","scope_id":state["scope_id"],"source_turn":event["turn"],"source_event":event["event"],"source_policy_receipt_digest":pre["policy_receipt_digest"],"candidate_scope":"THIS_CANDIDATE_ONLY","assistance_depth":pre["selected_assistance_depth"],"surface_move":pre["selected_surface_move"],"focus":pre["selected_focus"],"template_id":t["template_id"],"template_source":"FIXED_SYNTHETIC_CATALOG","response_text":t["text"],"text_digest":hashlib.sha256(t["text"].encode()).hexdigest(),"epistemic_mode":t["epistemic_mode"],"hidden_hint":False,"contains_solution":t["contains_solution"],"solution_scope":"SYNTHETIC_FIXTURE_LOCAL_THIS_REQUEST_ONLY" if t["contains_solution"] else "NONE","player_judgment":False,"pressure_to_continue":False,"player_can_ignore":True,"language_model_invoked":False,"response_authority_created":False,"send_authority":False,"external_effect":False,"future_help_authority":False,"future_solution_authority":False,"persistent_solver_mode":False,"runtime_connectedness":"NOT_PROVEN"}
    validate_candidate(state,event,pre,c); c["candidate_digest"]=sha(c); return {"candidate":c,"interaction_receipt":build_receipt(state,event,pre,c)}

if __name__=="__main__": print("synthetic candidate materializer is library-first; run validate.py")
