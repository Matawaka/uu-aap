#!/usr/bin/env python3
import copy, importlib.util, json
from pathlib import Path

HERE=Path(__file__).resolve().parent; ROOT=HERE.parent
TRACE=ROOT/"integrated-conversation-trace"/"integrated-conversation-trace.json"; RUNNER=ROOT/"session-runner"/"runner.py"; GENERATOR=ROOT/"candidate-envelope"/"generator.py"; EVALUATOR=ROOT/"policy-evaluation-harness"/"evaluator.py"; MATERIALIZER=HERE/"materializer.py"
def loadmod(name,path):
    s=importlib.util.spec_from_file_location(name,path); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
runner=loadmod("cmv_runner",RUNNER); gen=loadmod("cmv_generator",GENERATOR); evl=loadmod("cmv_evaluator",EVALUATOR); mat=loadmod("cmv_materializer",MATERIALIZER)

def derive(trace):
    state=runner.initial(trace["scope_id"]); out=[]; states={}; events={}; envs={}; pres={}
    for n,event in enumerate(trace["turns"],1):
        if event["speaker"]=="PLAYER":
            st=copy.deepcopy(state); env=gen.generate(copy.deepcopy(st),copy.deepcopy(event)); pre=evl.evaluate(copy.deepcopy(st),copy.deepcopy(event),copy.deepcopy(env)); result=mat.materialize(copy.deepcopy(st),copy.deepcopy(event),copy.deepcopy(env),copy.deepcopy(pre))
            states[n]=st; events[n]=copy.deepcopy(event); envs[n]=env; pres[n]=pre
            if result is not None: out.append(result)
        runner.reduce_turn(state,copy.deepcopy(event),n)
    return out,states,events,envs,pres

def main():
    trace=json.loads(TRACE.read_text()); a,states,events,envs,pres=derive(copy.deepcopy(trace)); b,_,_,_,_=derive(copy.deepcopy(trace)); assert a==b
    assert len(a)==7 and [x["candidate"]["source_turn"] for x in a]==[1,3,5,8,10,12,14]
    by={x["candidate"]["source_turn"]:x for x in a}
    expected={1:("THEORY","player-hypothesis-theory",False),3:("QUESTION","correction-evidence-question",False),5:("NOTICE","local-observation-notice",False),8:("COMMENT","neutral-resume-comment",False),10:("HINT","bounded-symbol-timing-hint",False),12:("QUESTION","challenged-hint-evidence-question",False),14:("SOLUTION","fixture-local-direct-solution",True)}
    for turn,(depth,template,solution) in expected.items():
        c=by[turn]["candidate"]; r=by[turn]["interaction_receipt"]
        assert c["assistance_depth"]==depth and c["template_id"]==template and c["contains_solution"] is solution
        assert c["language_model_invoked"] is False and c["send_authority"] is False and len(c["candidate_digest"])==64
        assert r["response_admissible"] is True and r["scope"]=="THIS_CANDIDATE_ONLY" and r["decision_semantics"]==mat.ir.DECISION_SEMANTICS
        assert r["response_authority_created"] is False and r["send_authority"] is False and r["action_permit_created"] is False and r["successor_permit_created"] is False
        assert len(r["interaction_receipt_digest"])==64 and r["source_candidate_digest"]==c["candidate_digest"]
    assert mat.materialize(states[7],events[7],envs[7],pres[7]) is None

    reduced_ctx=evl.default_policy_context(events[10]); reduced_ctx["assistance_ceiling"]="QUESTION"; reduced_pre=evl.evaluate(states[10],events[10],envs[10],reduced_ctx); reduced=mat.materialize(states[10],events[10],envs[10],reduced_pre,reduced_ctx)
    assert reduced["candidate"]["assistance_depth"]=="QUESTION" and reduced["candidate"]["template_id"]=="generic-evidence-question" and reduced["interaction_receipt"]["response_admissible"] is True
    blocked_ctx=evl.default_policy_context(events[14]); blocked_ctx["blocked"]=True; blocked_ctx["block_reason"]="SYNTHETIC_BLOCK"; blocked_pre=evl.evaluate(states[14],events[14],envs[14],blocked_ctx); assert mat.materialize(states[14],events[14],envs[14],blocked_pre,blocked_ctx) is None

    mutations=0
    def reject(turn,mc=None,mr=None,mp=None,me=None):
        nonlocal mutations
        st=copy.deepcopy(states[turn]); event=copy.deepcopy(events[turn]); env=copy.deepcopy(envs[turn]); pre=copy.deepcopy(pres[turn])
        try:
            if me:
                me(event); env=gen.generate(copy.deepcopy(st),copy.deepcopy(event)); pre=evl.evaluate(copy.deepcopy(st),copy.deepcopy(event),copy.deepcopy(env))
            if mp: mp(pre)
            result=mat.materialize(copy.deepcopy(st),copy.deepcopy(event),copy.deepcopy(env),copy.deepcopy(pre))
            if result is None: raise AssertionError("unexpected no candidate")
            c=result["candidate"]; r=result["interaction_receipt"]
            if mc: mc(c); mat.validate_candidate(st,event,pre,c)
            if mr: mr(r); mat.validate_receipt(st,event,pre,c,r)
        except (mat.MaterializationError,mat.gen.EnvelopeError,mat.evl.PolicyEvaluationError,mat.runner.ReductionError,gen.EnvelopeError,evl.PolicyEvaluationError,runner.ReductionError,AssertionError,KeyError,TypeError):
            mutations+=1; return
        raise AssertionError(f"unsafe mutation accepted at turn {turn}")

    for turn in [1,3,5,8,10,12,14]:
        reject(turn,mc=lambda c:c.__setitem__("response_authority_created",True)); reject(turn,mc=lambda c:c.__setitem__("send_authority",True)); reject(turn,mc=lambda c:c.__setitem__("player_judgment",True)); reject(turn,mc=lambda c:c.__setitem__("pressure_to_continue",True)); reject(turn,mc=lambda c:c.__setitem__("hidden_hint",True)); reject(turn,mr=lambda r:r.__setitem__("response_authority_created",True)); reject(turn,mr=lambda r:r.__setitem__("send_authority",True)); reject(turn,mr=lambda r:r.__setitem__("action_permit_created",True)); reject(turn,mr=lambda r:r.__setitem__("successor_permit_created",True)); reject(turn,mr=lambda r:r.__setitem__("scope","SESSION")); reject(turn,mr=lambda r:r.__setitem__("response_admissible",False))
    reject(1,mc=lambda c:c.__setitem__("response_text","The answer is SUN LEAF MOON.")); reject(1,mc=lambda c:c.__setitem__("assistance_depth","SOLUTION")); reject(10,mc=lambda c:c.__setitem__("contains_solution",True)); reject(14,mc=lambda c:c.__setitem__("future_solution_authority",True)); reject(14,mc=lambda c:c.__setitem__("persistent_solver_mode",True)); reject(14,mr=lambda r:r.__setitem__("future_solution_authority",True)); reject(14,mr=lambda r:r.__setitem__("persistent_solver_mode",True)); reject(8,mc=lambda c:c.__setitem__("focus","gate-mechanism")); reject(8,mr=lambda r:r.__setitem__("initiative_authorized",False)); reject(14,mr=lambda r:r.__setitem__("factual_correctness_evaluated",True)); reject(3,mr=lambda r:r["boundary"].__setitem__("behavioral_profile",True)); reject(10,mr=lambda r:r.__setitem__("semantics_validator_sha256","0"*64)); reject(14,me=lambda e:e.__setitem__("player_intent","CONVERSATION")); reject(10,mp=lambda p:p.__setitem__("response_admissible",True)); reject(10,mp=lambda p:p.__setitem__("interaction_receipt_ready",True))
    final=by[14]
    print(f"synthetic candidate materializer validation: PASS; candidates={len(a)}; interaction_receipts={len(a)}; fail_closed_mutations={mutations}; final_candidate_digest={final['candidate']['candidate_digest']}; final_interaction_receipt_digest={final['interaction_receipt']['interaction_receipt_digest']}")

if __name__=="__main__": main()
