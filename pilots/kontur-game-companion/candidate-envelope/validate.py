#!/usr/bin/env python3
import copy, importlib.util, json
from pathlib import Path

HERE=Path(__file__).resolve().parent
TRACE=HERE.parent/"integrated-conversation-trace"/"integrated-conversation-trace.json"
RUNNER=HERE.parent/"session-runner"/"runner.py"

spec=importlib.util.spec_from_file_location("runner",RUNNER)
runner=importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)
spec2=importlib.util.spec_from_file_location("generator",HERE/"generator.py")
gen=importlib.util.module_from_spec(spec2); spec2.loader.exec_module(gen)

def derive(trace):
    s=runner.initial(trace["scope_id"]); out=[]
    for n,t in enumerate(trace["turns"],1):
        if t["speaker"]=="PLAYER":
            env=gen.generate(copy.deepcopy(s),copy.deepcopy(t))
            out.append(env)
        runner.reduce_turn(s,copy.deepcopy(t),n)
    return out

def main():
    t=json.loads(TRACE.read_text())
    a=derive(copy.deepcopy(t)); b=derive(copy.deepcopy(t))
    assert a==b
    assert [e["source_turn"] for e in a]==[1,3,5,7,8,10,12,14]
    by={e["source_turn"]:e for e in a}
    expected={
        1:("THEORY","NONE","WAIT","THEORY","gate-mechanism"),
        3:("QUESTION","NONE","EVIDENCE_CHECK","QUESTION","gate-mechanism"),
        5:("NOTICE","NONE","OBSERVE","OBSERVATION","gate-mechanism"),
        7:("NONE","NONE","WAIT","WAIT","NONE"),
        8:("COMMENT","QUESTION","NEUTRAL_CHECKIN","QUESTION","NONE"),
        10:("HINT","NONE","WAIT","COMMENT","gate-mechanism"),
        12:("QUESTION","NONE","EVIDENCE_CHECK","QUESTION","gate-mechanism"),
        14:("SOLUTION","NONE","BYPASS_CANDIDATE","COMMENT","gate-mechanism"),
    }
    for turn,x in expected.items():
        e=by[turn]
        assert (e["requested_assistance_depth"],e["requested_initiative_depth"],e["requested_discovery_posture"],e["requested_surface_move"],e["requested_focus"])==x
        assert e["response_text"] is None and e["response_admissible"] is None
        assert e["authority_effect"]==e["action_effect"]==e["successor_effect"]=="NONE"
        assert e["persistent_solver_mode"] is False and e["future_help_authority"] is False and e["future_solution_authority"] is False
        assert len(e["source_state_digest"])==len(e["source_event_digest"])==len(e["envelope_digest"])==64

    states={}; s=runner.initial(t["scope_id"])
    for n,event in enumerate(t["turns"],1):
        if event["speaker"]=="PLAYER": states[n]=copy.deepcopy(s)
        runner.reduce_turn(s,copy.deepcopy(event),n)

    mutations=0
    def reject(turn, mutate_event=None, mutate_env=None, mutate_state=None):
        nonlocal mutations
        st=copy.deepcopy(states[turn]); ev=copy.deepcopy(t["turns"][turn-1])
        if mutate_state: mutate_state(st)
        try:
            e=gen.generate(copy.deepcopy(st),copy.deepcopy(ev))
            if mutate_event:
                ev2=copy.deepcopy(ev); mutate_event(ev2)
                e=gen.generate(copy.deepcopy(st),ev2)
            if mutate_env:
                mutate_env(e); gen.validate_envelope(st,ev,e)
        except (gen.EnvelopeError, runner.ReductionError, KeyError, AssertionError, TypeError):
            mutations+=1; return
        raise AssertionError(f"unsafe mutation accepted at turn {turn}")

    for turn in states:
        reject(turn, mutate_env=lambda e:e.__setitem__("response_text","generated"))
        reject(turn, mutate_env=lambda e:e.__setitem__("response_admissible",True))
        reject(turn, mutate_env=lambda e:e.__setitem__("authority_effect","CREATE"))
        reject(turn, mutate_env=lambda e:e.__setitem__("persistent_solver_mode",True))
    reject(1, mutate_env=lambda e:e.__setitem__("requested_assistance_depth","HINT"))
    reject(3, mutate_env=lambda e:e.__setitem__("requested_assistance_depth","SOLUTION"))
    reject(5, mutate_env=lambda e:e.__setitem__("requested_assistance_depth","HINT"))
    reject(7, mutate_env=lambda e:e.__setitem__("requested_surface_move","QUESTION"))
    reject(8, mutate_env=lambda e:e.__setitem__("requested_focus","gate-mechanism"))
    reject(10, mutate_env=lambda e:e.__setitem__("requested_assistance_depth","SOLUTION"))
    reject(12, mutate_env=lambda e:e.__setitem__("requested_assistance_depth","HINT"))
    reject(14, mutate_env=lambda e:e.__setitem__("future_solution_authority",True))
    reject(14, mutate_env=lambda e:e.__setitem__("request_scope","SESSION"))
    reject(14, mutate_env=lambda e:e.__setitem__("requested_discovery_posture","WAIT"))
    reject(8, mutate_state=lambda s:s.__setitem__("session_phase","ACTIVE"))
    reject(10, mutate_state=lambda s:s.__setitem__("stored_help_authority",True))
    reject(14, mutate_state=lambda s:s.__setitem__("solver_mode",True))
    reject(1, mutate_event=lambda e:e.__setitem__("speaker","COMPANION"))

    print(f"candidate envelope validation: PASS; envelopes={len(a)}; fail_closed_mutations={mutations}; final_envelope_digest={a[-1]['envelope_digest']}")

if __name__=="__main__":
    main()
