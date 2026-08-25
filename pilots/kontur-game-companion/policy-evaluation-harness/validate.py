#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
TRACE = HERE.parent / "integrated-conversation-trace" / "integrated-conversation-trace.json"
RUNNER = HERE.parent / "session-runner" / "runner.py"
GENERATOR = HERE.parent / "candidate-envelope" / "generator.py"
EVALUATOR = HERE / "evaluator.py"

def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

runner = loadmod("runner", RUNNER)
gen = loadmod("generator", GENERATOR)
evl = loadmod("evaluator", EVALUATOR)

def derive(trace):
    state = runner.initial(trace["scope_id"])
    out = []
    states = {}
    events = {}
    envelopes = {}
    for n, event in enumerate(trace["turns"], 1):
        if event["speaker"] == "PLAYER":
            st = copy.deepcopy(state)
            env = gen.generate(copy.deepcopy(st), copy.deepcopy(event))
            receipt = evl.evaluate(copy.deepcopy(st), copy.deepcopy(event), copy.deepcopy(env))
            out.append(receipt)
            states[n] = st
            events[n] = copy.deepcopy(event)
            envelopes[n] = env
        runner.reduce_turn(state, copy.deepcopy(event), n)
    return out, states, events, envelopes

def main():
    trace = json.loads(TRACE.read_text())
    a, states, events, envelopes = derive(copy.deepcopy(trace))
    b, _, _, _ = derive(copy.deepcopy(trace))
    assert a == b
    assert [r["source_turn"] for r in a] == [1, 3, 5, 7, 8, 10, 12, 14]
    by = {r["source_turn"]: r for r in a}

    expected = {
        1: ("SHAPE_ADMISSIBLE", "THEORY", "NONE"),
        3: ("SHAPE_ADMISSIBLE", "QUESTION", "NONE"),
        5: ("SHAPE_ADMISSIBLE", "NOTICE", "NONE"),
        7: ("NO_RESPONSE_CANDIDATE", "NONE", "NONE"),
        8: ("SHAPE_ADMISSIBLE", "COMMENT", "QUESTION"),
        10: ("SHAPE_ADMISSIBLE", "HINT", "NONE"),
        12: ("SHAPE_ADMISSIBLE", "QUESTION", "NONE"),
        14: ("SHAPE_ADMISSIBLE", "SOLUTION", "NONE"),
    }
    for turn, exp in expected.items():
        r = by[turn]
        assert (r["decision"], r["selected_assistance_depth"], r["selected_initiative_depth"]) == exp
        assert r["response_text"] is None and r["response_admissible"] is None
        assert r["interaction_receipt_ready"] is False
        assert r["content_safety_evaluated"] is False and r["factual_correctness_evaluated"] is False
        assert r["authority_effect"] == r["action_effect"] == r["successor_effect"] == "NONE"
        assert r["persistent_solver_mode"] is False and r["future_solution_authority"] is False
        assert len(r["policy_receipt_digest"]) == 64

    ctx = evl.default_policy_context(events[10])
    ctx["assistance_ceiling"] = "QUESTION"
    reduced = evl.evaluate(states[10], events[10], envelopes[10], ctx)
    assert reduced["decision"] == "SHAPE_REDUCED"
    assert reduced["selected_assistance_depth"] == "QUESTION"
    assert reduced["response_admissible"] is None

    ctx2 = evl.default_policy_context(events[14])
    ctx2["blocked"] = True
    ctx2["block_reason"] = "SYNTHETIC_DOWNSTREAM_BLOCK"
    blocked = evl.evaluate(states[14], events[14], envelopes[14], ctx2)
    assert blocked["decision"] == "SHAPE_BLOCKED"
    assert blocked["shape_admissible"] is False
    assert blocked["selected_assistance_depth"] == "NONE"
    assert blocked["interaction_receipt_ready"] is False

    mutations = 0
    def reject(turn, mutate_receipt=None, mutate_context=None, mutate_envelope=None):
        nonlocal mutations
        st = copy.deepcopy(states[turn])
        event = copy.deepcopy(events[turn])
        env = copy.deepcopy(envelopes[turn])
        ctx = evl.default_policy_context(event)
        try:
            if mutate_context:
                mutate_context(ctx)
            if mutate_envelope:
                mutate_envelope(env)
            r = evl.evaluate(st, event, env, ctx)
            if mutate_receipt:
                mutate_receipt(r)
                evl.validate_receipt(st, event, env, ctx, r)
        except (
            evl.PolicyEvaluationError,
            evl.gen.EnvelopeError,
            gen.EnvelopeError,
            runner.ReductionError,
            AssertionError,
            KeyError,
            TypeError,
        ):
            mutations += 1
            return
        raise AssertionError(f"unsafe mutation accepted at turn {turn}")

    for turn in states:
        reject(turn, mutate_receipt=lambda r: r.__setitem__("response_text", "generated"))
        reject(turn, mutate_receipt=lambda r: r.__setitem__("response_admissible", True))
        reject(turn, mutate_receipt=lambda r: r.__setitem__("interaction_receipt_ready", True))
        reject(turn, mutate_receipt=lambda r: r.__setitem__("authority_effect", "CREATE"))
        reject(turn, mutate_receipt=lambda r: r.__setitem__("persistent_solver_mode", True))

    reject(14, mutate_receipt=lambda r: r.__setitem__("future_solution_authority", True))
    reject(14, mutate_receipt=lambda r: r.__setitem__("selected_assistance_depth", "HINT"))
    reject(8, mutate_receipt=lambda r: r.__setitem__("selected_focus", "gate-mechanism"))
    reject(7, mutate_receipt=lambda r: r.__setitem__("decision", "SHAPE_ADMISSIBLE"))
    reject(7, mutate_receipt=lambda r: r.__setitem__("downstream_interaction_receipt_required", True))
    reject(10, mutate_context=lambda c: c.__setitem__("assistance_ceiling", "SOLUTION"))
    reject(8, mutate_context=lambda c: c.__setitem__("initiative_ceiling", "THEORY"))
    reject(14, mutate_context=lambda c: c.__setitem__("authority_effect", "CREATE"))
    reject(14, mutate_context=lambda c: c.__setitem__("blocked", True))
    reject(1, mutate_envelope=lambda e: e.__setitem__("response_admissible", True))
    reject(10, mutate_envelope=lambda e: e.__setitem__("requested_assistance_depth", "SOLUTION"))

    print(
        "policy evaluation harness validation: PASS; "
        f"receipts={len(a)}; fail_closed_mutations={mutations}; "
        f"final_policy_receipt_digest={a[-1]['policy_receipt_digest']}"
    )

if __name__ == "__main__":
    main()
