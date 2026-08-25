#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"
HARNESS = HERE / "harness.py"

spec = importlib.util.spec_from_file_location("shadow_runtime_harness", HARNESS)
shadow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shadow)
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
                result = shadow.run_shadow(
                    copy.deepcopy(st), copy.deepcopy(ev), copy.deepcopy(env), copy.deepcopy(pre),
                    copy.deepcopy(candidate), copy.deepcopy(receipt), copy.deepcopy(dctx), copy.deepcopy(decision),
                )
                records.append(result)
                saved[n] = {
                    "state": st, "event": ev, "envelope": env, "pre": pre,
                    "candidate": candidate, "receipt": receipt,
                }
        mat.runner.reduce_turn(state, copy.deepcopy(event), n)
    return records, saved


def main():
    trace = json.loads(TRACE.read_text())
    records, saved = derive(copy.deepcopy(trace))
    records2, _ = derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7
    assert [r["source_turn"] for r in records] == [1, 3, 5, 8, 10, 12, 14]

    by = {r["source_turn"]: r for r in records}
    for turn, result in by.items():
        source = saved[turn]
        candidate = source["candidate"]
        assert result["outcome"] == "NULL_SINK_CAPTURED"
        assert result["would_dispatch"] is True
        assert result["null_sink_consumed"] is True
        assert result["shadow_payload"]["response_text"] == candidate["response_text"]
        assert result["shadow_payload"]["text_digest"] == candidate["text_digest"]
        assert result["shadow_payload"]["candidate_digest"] == candidate["candidate_digest"]
        assert result["user_visible"] is False
        assert result["network_request"] is False
        assert result["transport_invoked"] is False
        assert result["external_effect_authorized"] is False
        assert result["send_permit"] is False
        assert len(result["shadow_payload_digest"]) == 64
        assert len(result["shadow_run_digest"]) == 64

    def probe(turn, mutate_dispatch_ctx, expected):
        s = saved[turn]
        dctx = shadow.dispatcher.default_context(s["candidate"])
        mutate_dispatch_ctx(dctx)
        decision = shadow.dispatcher.decide(
            copy.deepcopy(s["state"]), copy.deepcopy(s["event"]), copy.deepcopy(s["envelope"]),
            copy.deepcopy(s["pre"]), copy.deepcopy(s["candidate"]), copy.deepcopy(s["receipt"]), copy.deepcopy(dctx),
        )
        result = shadow.run_shadow(
            copy.deepcopy(s["state"]), copy.deepcopy(s["event"]), copy.deepcopy(s["envelope"]),
            copy.deepcopy(s["pre"]), copy.deepcopy(s["candidate"]), copy.deepcopy(s["receipt"]),
            copy.deepcopy(dctx), copy.deepcopy(decision),
        )
        assert result["outcome"] == expected
        assert result["would_dispatch"] is False
        assert result["null_sink_consumed"] is False
        assert result["shadow_payload"] is None
        assert result["shadow_payload_digest"] is None

    probe(10, lambda c: c.__setitem__("safety_recheck_required", True), "HELD_NO_CAPTURE")
    probe(14, lambda c: c.__setitem__("current_turn", 15), "DROPPED_NO_CAPTURE")
    probe(10, lambda c: c.__setitem__("player_cancelled", True), "DROPPED_NO_CAPTURE")
    probe(12, lambda c: c.__setitem__("candidate_superseded", True), "DROPPED_NO_CAPTURE")
    probe(8, lambda c: c.__setitem__("session_active", False), "DROPPED_NO_CAPTURE")

    mutations = 0

    def reject(turn, mutate_result=None, mutate_shadow_ctx=None, mutate_dispatch_ctx=None, mutate_dispatch_decision=None):
        nonlocal mutations
        s = saved[turn]
        dctx = shadow.dispatcher.default_context(s["candidate"])
        try:
            if mutate_dispatch_ctx:
                mutate_dispatch_ctx(dctx)
            decision = shadow.dispatcher.decide(
                copy.deepcopy(s["state"]), copy.deepcopy(s["event"]), copy.deepcopy(s["envelope"]),
                copy.deepcopy(s["pre"]), copy.deepcopy(s["candidate"]), copy.deepcopy(s["receipt"]), copy.deepcopy(dctx),
            )
            if mutate_dispatch_decision:
                mutate_dispatch_decision(decision)
            sctx = shadow.default_shadow_context(s["candidate"])
            if mutate_shadow_ctx:
                mutate_shadow_ctx(sctx)
            result = shadow.run_shadow(
                copy.deepcopy(s["state"]), copy.deepcopy(s["event"]), copy.deepcopy(s["envelope"]),
                copy.deepcopy(s["pre"]), copy.deepcopy(s["candidate"]), copy.deepcopy(s["receipt"]),
                copy.deepcopy(dctx), copy.deepcopy(decision), copy.deepcopy(sctx),
            )
            if mutate_result:
                mutate_result(result)
                shadow.validate_shadow_result(s["candidate"], s["receipt"], decision, sctx, result)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError(f"unsafe mutation accepted at turn {turn}")

    result_false_fields = [
        "network_request", "external_transport_bound", "user_visible", "user_delivery_enabled",
        "send_permit", "send_authority", "response_authority_created", "external_effect_authorized",
        "delivery_attempted", "transport_invoked", "delivery_receipt_created", "action_permit_created",
        "successor_permit_created", "payload_persisted", "future_send_authority", "future_solution_authority",
        "persistent_solver_mode",
    ]
    for turn in saved:
        for field in result_false_fields:
            reject(turn, mutate_result=lambda r, f=field: r.__setitem__(f, True))
        reject(turn, mutate_result=lambda r: r.__setitem__("decision_scope", "SESSION"))
        reject(turn, mutate_result=lambda r: r.__setitem__("runtime_connectedness", "LIVE"))
        reject(turn, mutate_result=lambda r: r.__setitem__("would_dispatch", False))
        reject(turn, mutate_result=lambda r: r.__setitem__("null_sink_consumed", False))
        reject(turn, mutate_result=lambda r: r["shadow_payload"].__setitem__("response_text", "tampered"))
        reject(turn, mutate_result=lambda r: r["shadow_payload"].__setitem__("text_digest", "0" * 64))
        reject(turn, mutate_result=lambda r: r["shadow_payload"].__setitem__("target", "LIVE_CHANNEL"))
        reject(turn, mutate_result=lambda r: r["shadow_payload"].__setitem__("user_visible", True))
        reject(turn, mutate_result=lambda r: r.__setitem__("shadow_payload_digest", "0" * 64))
        reject(turn, mutate_result=lambda r: r.__setitem__("source_candidate_digest", "0" * 64))
        reject(turn, mutate_result=lambda r: r.__setitem__("source_interaction_receipt_digest", "0" * 64))
        reject(turn, mutate_result=lambda r: r.__setitem__("source_dispatch_decision_digest", "0" * 64))

    shadow_context_mutations = [
        lambda c: c.__setitem__("network_enabled", True),
        lambda c: c.__setitem__("external_transport_bound", True),
        lambda c: c.__setitem__("user_delivery_enabled", True),
        lambda c: c.__setitem__("send_permit_available", True),
        lambda c: c.__setitem__("live_runtime", True),
        lambda c: c.__setitem__("payload_persisted", True),
        lambda c: c.__setitem__("sink", "LIVE_CHANNEL"),
        lambda c: c.__setitem__("mode", "LIVE"),
        lambda c: c.__setitem__("scope", "SESSION"),
        lambda c: c.__setitem__("candidate_digest", "0" * 64),
    ]
    for mutation in shadow_context_mutations:
        reject(14, mutate_shadow_ctx=mutation)

    reject(14, mutate_dispatch_ctx=lambda c: c.__setitem__("external_transport_bound", True))
    reject(14, mutate_dispatch_ctx=lambda c: c.__setitem__("live_runtime", True))
    reject(14, mutate_dispatch_ctx=lambda c: c.__setitem__("send_permit_available", True))
    reject(14, mutate_dispatch_ctx=lambda c: c.__setitem__("delivery_channel", "LIVE_CHANNEL"))
    reject(14, mutate_dispatch_decision=lambda d: d.__setitem__("send_permit", True))
    reject(14, mutate_dispatch_decision=lambda d: d.__setitem__("external_effect_authorized", True))
    reject(14, mutate_dispatch_decision=lambda d: d.__setitem__("transport_invoked", True))

    final = by[14]
    print(
        "shadow runtime null transport validation: PASS; "
        f"captures={len(records)}; fail_closed_mutations={mutations}; "
        f"final_shadow_payload_digest={final['shadow_payload_digest']}; "
        f"final_shadow_run_digest={final['shadow_run_digest']}"
    )

if __name__ == "__main__":
    main()
