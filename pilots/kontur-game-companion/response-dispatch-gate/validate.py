#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"
DISPATCHER = HERE / "dispatcher.py"

def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

dsp = loadmod("dispatch_validator", DISPATCHER)
mat = dsp.mat
runner = mat.runner
gen = mat.gen
evl = mat.evl

def derive(trace):
    state = runner.initial(trace["scope_id"])
    outputs = []
    saved = {}
    for n, event in enumerate(trace["turns"], 1):
        if event["speaker"] == "PLAYER":
            st = copy.deepcopy(state)
            env = gen.generate(copy.deepcopy(st), copy.deepcopy(event))
            pre = evl.evaluate(copy.deepcopy(st), copy.deepcopy(event), copy.deepcopy(env))
            materialized = mat.materialize(copy.deepcopy(st), copy.deepcopy(event), copy.deepcopy(env), copy.deepcopy(pre))
            saved[n] = (st, copy.deepcopy(event), env, pre, materialized)
            if materialized is not None:
                out = dsp.decide(st, event, env, pre, materialized["candidate"], materialized["interaction_receipt"])
                outputs.append(out)
        runner.reduce_turn(state, copy.deepcopy(event), n)
    return outputs, saved

def main():
    trace = json.loads(TRACE.read_text())
    a, saved = derive(copy.deepcopy(trace))
    b, _ = derive(copy.deepcopy(trace))
    assert a == b
    assert [x["source_turn"] for x in a] == [1, 3, 5, 8, 10, 12, 14]
    assert len(a) == 7
    by = {x["source_turn"]: x for x in a}
    for turn in [1, 3, 5, 8, 10, 12, 14]:
        out = by[turn]
        assert out["decision"] == "DISPATCH_ELIGIBLE"
        assert out["dispatch_eligible"] is True
        assert out["send_permit"] is False and out["send_authority"] is False
        assert out["external_effect_authorized"] is False and out["dispatch_executed"] is False
        assert out["delivery_attempted"] is False and out["transport_invoked"] is False
        assert len(out["dispatch_decision_digest"]) == 64
    assert saved[7][4] is None

    st, event, env, pre, materialized = saved[10]
    candidate = materialized["candidate"]
    receipt = materialized["interaction_receipt"]
    hold_ctx = dsp.default_context(candidate)
    hold_ctx["safety_recheck_required"] = True
    hold = dsp.decide(st, event, env, pre, candidate, receipt, hold_ctx)
    assert hold["decision"] == "HOLD" and hold["dispatch_eligible"] is False

    for field in ("candidate_superseded", "player_cancelled"):
        ctx = dsp.default_context(candidate)
        ctx[field] = True
        dropped = dsp.decide(st, event, env, pre, candidate, receipt, ctx)
        assert dropped["decision"] == "DROP" and dropped["dispatch_eligible"] is False
    inactive = dsp.default_context(candidate)
    inactive["session_active"] = False
    assert dsp.decide(st, event, env, pre, candidate, receipt, inactive)["decision"] == "DROP"
    stale = dsp.default_context(candidate)
    stale["current_turn"] += 1
    assert dsp.decide(st, event, env, pre, candidate, receipt, stale)["decision"] == "DROP"

    mutations = 0
    def reject(turn, mutate_out=None, mutate_ctx=None, mutate_candidate=None, mutate_receipt=None):
        nonlocal mutations
        st, event, env, pre, materialized = saved[turn]
        st = copy.deepcopy(st); event = copy.deepcopy(event); env = copy.deepcopy(env); pre = copy.deepcopy(pre)
        candidate = copy.deepcopy(materialized["candidate"]); receipt = copy.deepcopy(materialized["interaction_receipt"])
        ctx = dsp.default_context(candidate)
        try:
            if mutate_ctx:
                mutate_ctx(ctx)
            if mutate_candidate:
                mutate_candidate(candidate)
            if mutate_receipt:
                mutate_receipt(receipt)
            out = dsp.decide(st, event, env, pre, candidate, receipt, ctx)
            if mutate_out:
                mutate_out(out)
                dsp.validate_decision(st, candidate, receipt, ctx, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError(f"unsafe mutation accepted at turn {turn}")

    forbidden_false = [
        "send_permit", "send_authority", "response_authority_created", "external_effect_authorized",
        "dispatch_executed", "delivery_attempted", "transport_invoked", "action_permit_created",
        "successor_permit_created", "future_send_authority", "future_solution_authority", "persistent_solver_mode",
    ]
    for turn in [1, 3, 5, 8, 10, 12, 14]:
        for field in forbidden_false:
            reject(turn, mutate_out=lambda out, f=field: out.__setitem__(f, True))
        reject(turn, mutate_out=lambda out: out.__setitem__("decision_scope", "SESSION"))
        reject(turn, mutate_out=lambda out: out.__setitem__("delivery_channel", "LIVE_CHAT"))
        reject(turn, mutate_out=lambda out: out.__setitem__("runtime_connectedness", "PROVEN"))

    reject(10, mutate_ctx=lambda ctx: ctx.__setitem__("external_transport_bound", True))
    reject(10, mutate_ctx=lambda ctx: ctx.__setitem__("live_runtime", True))
    reject(10, mutate_ctx=lambda ctx: ctx.__setitem__("send_permit_available", True))
    reject(10, mutate_ctx=lambda ctx: ctx.__setitem__("delivery_channel", "LIVE_CHAT"))
    reject(10, mutate_ctx=lambda ctx: ctx.__setitem__("scope", "SESSION"))
    reject(10, mutate_candidate=lambda c: c.__setitem__("candidate_digest", "0" * 64))
    reject(10, mutate_receipt=lambda r: r.__setitem__("response_admissible", False))
    reject(10, mutate_receipt=lambda r: r.__setitem__("send_authority", True))

    # Directly verify that HOLD/DROP cannot be forged back into eligibility.
    for ctx_mutator in (
        lambda ctx: ctx.__setitem__("safety_recheck_required", True),
        lambda ctx: ctx.__setitem__("candidate_superseded", True),
        lambda ctx: ctx.__setitem__("player_cancelled", True),
        lambda ctx: ctx.__setitem__("session_active", False),
        lambda ctx: ctx.__setitem__("current_turn", ctx["current_turn"] + 1),
    ):
        st, event, env, pre, materialized = saved[10]
        candidate = copy.deepcopy(materialized["candidate"]); receipt = copy.deepcopy(materialized["interaction_receipt"])
        ctx = dsp.default_context(candidate); ctx_mutator(ctx)
        out = dsp.decide(st, event, env, pre, candidate, receipt, ctx)
        try:
            out["decision"] = "DISPATCH_ELIGIBLE"
            out["dispatch_eligible"] = True
            dsp.validate_decision(st, candidate, receipt, ctx, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
        else:
            raise AssertionError("HOLD/DROP forged into dispatch eligibility")

    final = by[14]
    print(
        "response dispatch gate validation: PASS; "
        f"decisions={len(a)}; fail_closed_mutations={mutations}; "
        f"final_dispatch_decision_digest={final['dispatch_decision_digest']}"
    )

if __name__ == "__main__":
    main()
