#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"
ACTIVATION = HERE / "activation.py"
SHADOW = ROOT / "shadow-runtime" / "harness.py"

def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

act = loadmod("runtime_activation_boundary", ACTIVATION)
shadow = loadmod("runtime_activation_shadow", SHADOW)
mat = shadow.dispatcher.mat

def derive(trace):
    state = mat.runner.initial(trace["scope_id"])
    records = []
    saved = {}
    for n, event in enumerate(trace["turns"], 1):
        if event["speaker"] == "PLAYER":
            st = copy.deepcopy(state)
            ev = copy.deepcopy(event)
            env = mat.gen.generate(copy.deepcopy(st), copy.deepcopy(ev))
            pre = mat.evl.evaluate(copy.deepcopy(st), copy.deepcopy(ev), copy.deepcopy(env))
            bundle = mat.materialize(copy.deepcopy(st), copy.deepcopy(ev), copy.deepcopy(env), copy.deepcopy(pre))
            if bundle is not None:
                candidate = bundle["candidate"]
                receipt = bundle["interaction_receipt"]
                dctx = shadow.dispatcher.default_context(candidate)
                decision = shadow.dispatcher.decide(
                    copy.deepcopy(st), copy.deepcopy(ev), copy.deepcopy(env), copy.deepcopy(pre),
                    copy.deepcopy(candidate), copy.deepcopy(receipt), copy.deepcopy(dctx),
                )
                sctx = shadow.default_shadow_context(candidate)
                result = shadow.run_shadow(
                    copy.deepcopy(st), copy.deepcopy(ev), copy.deepcopy(env), copy.deepcopy(pre),
                    copy.deepcopy(candidate), copy.deepcopy(receipt), copy.deepcopy(dctx),
                    copy.deepcopy(decision), copy.deepcopy(sctx),
                )
                records.append(result)
                saved[n] = {
                    "state": st, "event": ev, "envelope": env, "pre": pre,
                    "candidate": candidate, "receipt": receipt,
                    "dispatch_context": dctx, "dispatch_decision": decision,
                    "shadow_context": sctx, "shadow_result": result,
                }
        mat.runner.reduce_turn(state, copy.deepcopy(event), n)
    return records, saved

def shadow_probe(source, mutate_dispatch_context):
    dctx = shadow.dispatcher.default_context(source["candidate"])
    mutate_dispatch_context(dctx)
    decision = shadow.dispatcher.decide(
        copy.deepcopy(source["state"]), copy.deepcopy(source["event"]), copy.deepcopy(source["envelope"]),
        copy.deepcopy(source["pre"]), copy.deepcopy(source["candidate"]), copy.deepcopy(source["receipt"]), copy.deepcopy(dctx),
    )
    sctx = shadow.default_shadow_context(source["candidate"])
    return shadow.run_shadow(
        copy.deepcopy(source["state"]), copy.deepcopy(source["event"]), copy.deepcopy(source["envelope"]),
        copy.deepcopy(source["pre"]), copy.deepcopy(source["candidate"]), copy.deepcopy(source["receipt"]),
        copy.deepcopy(dctx), copy.deepcopy(decision), copy.deepcopy(sctx),
    )

def main():
    trace = json.loads(TRACE.read_text())
    records, saved = derive(copy.deepcopy(trace))
    records2, _ = derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7
    assert [r["source_turn"] for r in records] == [1, 3, 5, 8, 10, 12, 14]

    assessments = []
    for result in records:
        a = act.assess(copy.deepcopy(result))
        assessments.append(a)
        assert a["decision"] == "SHADOW_ONLY_CONFIRMED"
        assert a["technical_preconditions_complete"] is False
        assert a["externalization_authority_required"] is False
        assert a["externalization_authority_present"] is False
        assert a["live_runtime_enabled"] is False
        assert a["send_permit"] is False
        assert a["external_effect_authorized"] is False
        assert len(a["activation_assessment_digest"]) == 64

    source = saved[14]
    partial_ctx = act.default_context(source["shadow_result"])
    partial_ctx["transport_contract_verified"] = True
    partial = act.assess(copy.deepcopy(source["shadow_result"]), partial_ctx)
    assert partial["decision"] == "PRECONDITIONS_REVIEW"
    assert partial["technical_preconditions_complete"] is False
    assert "transport_contract_verified" not in partial["missing_technical_preconditions"]

    complete_ctx = act.default_context(source["shadow_result"])
    for field in act.TECHNICAL_PROOFS:
        complete_ctx[field] = True
    complete = act.assess(copy.deepcopy(source["shadow_result"]), complete_ctx)
    assert complete["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED"
    assert complete["technical_preconditions_complete"] is True
    assert complete["externalization_authority_required"] is True
    assert complete["externalization_authority_present"] is False
    assert complete["send_permit"] is False
    assert complete["live_runtime_enabled"] is False

    held = shadow_probe(saved[10], lambda c: c.__setitem__("safety_recheck_required", True))
    dropped = shadow_probe(saved[14], lambda c: c.__setitem__("current_turn", 15))
    assert held["outcome"] == "HELD_NO_CAPTURE" and act.assess(held)["decision"] == "NOT_APPLICABLE"
    assert dropped["outcome"] == "DROPPED_NO_CAPTURE" and act.assess(dropped)["decision"] == "NOT_APPLICABLE"

    mutations = 0

    def reject(turn, mutate_assessment=None, mutate_context=None, mutate_shadow=None, use_complete=False):
        nonlocal mutations
        result = copy.deepcopy(saved[turn]["shadow_result"])
        try:
            if mutate_shadow:
                mutate_shadow(result)
            ctx = act.default_context(result)
            if use_complete:
                for field in act.TECHNICAL_PROOFS:
                    ctx[field] = True
            if mutate_context:
                mutate_context(ctx)
            assessment = act.assess(copy.deepcopy(result), copy.deepcopy(ctx))
            if mutate_assessment:
                mutate_assessment(assessment)
                act.validate_assessment(result, ctx, assessment)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError(f"unsafe mutation accepted at turn {turn}")

    false_effects = [
        "externalization_authority_present", "live_runtime_enabled", "live_runtime_bound",
        "external_transport_bound", "user_surface_enabled", "network_enabled", "send_permit",
        "send_authority", "response_authority_created", "external_effect_authorized",
        "delivery_attempted", "transport_invoked", "delivery_receipt_created",
        "action_permit_created", "successor_permit_created", "payload_persisted",
        "stable_core_promotion",
    ]
    for turn in saved:
        for field in false_effects:
            reject(turn, mutate_assessment=lambda a, f=field: a.__setitem__(f, True))
        reject(turn, mutate_assessment=lambda a: a.__setitem__("assessment_scope", "SESSION"))
        reject(turn, mutate_assessment=lambda a: a.__setitem__("runtime_connectedness", "LIVE"))
        reject(turn, mutate_assessment=lambda a: a.__setitem__("source_shadow_run_digest", "0" * 64))
        reject(turn, mutate_assessment=lambda a: a.__setitem__("activation_context_digest", "0" * 64))
        reject(turn, mutate_assessment=lambda a: a.__setitem__("decision", "LIVE_READY"))
        reject(turn, mutate_assessment=lambda a: a["technical_proofs"].__setitem__("transport_contract_verified", True))

    context_mutations = [
        lambda c: c.__setitem__("externalization_authority_present", True),
        lambda c: c.__setitem__("live_runtime_bound", True),
        lambda c: c.__setitem__("external_transport_bound", True),
        lambda c: c.__setitem__("user_surface_enabled", True),
        lambda c: c.__setitem__("network_enabled", True),
        lambda c: c.__setitem__("send_permit_available", True),
        lambda c: c.__setitem__("scope", "SESSION"),
        lambda c: c.__setitem__("source_shadow_run_digest", "0" * 64),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
    ]
    for mutation in context_mutations:
        reject(14, mutate_context=mutation)

    for field in act.TECHNICAL_PROOFS:
        reject(14, mutate_context=lambda c, f=field: c.__setitem__(f, "yes"))

    shadow_mutations = [
        lambda r: r.__setitem__("send_permit", True),
        lambda r: r.__setitem__("external_effect_authorized", True),
        lambda r: r.__setitem__("transport_invoked", True),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE"),
        lambda r: r.__setitem__("shadow_run_digest", "0" * 64),
        lambda r: r["shadow_payload"].__setitem__("target", "LIVE_CHANNEL"),
        lambda r: r["shadow_payload"].__setitem__("user_visible", True),
    ]
    for mutation in shadow_mutations:
        reject(14, mutate_shadow=mutation)

    reject(14, mutate_assessment=lambda a: a.__setitem__("externalization_authority_required", False), use_complete=True)
    reject(14, mutate_assessment=lambda a: a.__setitem__("technical_preconditions_complete", False), use_complete=True)
    reject(14, mutate_assessment=lambda a: a.__setitem__("decision", "SHADOW_ONLY_CONFIRMED"), use_complete=True)

    final = complete
    print(
        "runtime activation boundary validation: PASS; "
        f"shadow_assessments={len(assessments)}; fail_closed_mutations={mutations}; "
        f"final_activation_assessment_digest={final['activation_assessment_digest']}"
    )

if __name__ == "__main__":
    main()
