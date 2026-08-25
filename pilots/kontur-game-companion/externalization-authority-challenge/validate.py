#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REQUEST = HERE / "request.py"
ACTIVATION_VALIDATE = ROOT / "runtime-activation-boundary" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"

def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

challenge = loadmod("externalization_challenge", REQUEST)
actval = loadmod("externalization_activation_validate", ACTIVATION_VALIDATE)
act = actval.act

def complete_assessment(shadow_result):
    ctx = act.default_context(shadow_result)
    for field in act.TECHNICAL_PROOFS:
        ctx[field] = True
    return act.assess(copy.deepcopy(shadow_result), ctx)

def main():
    trace = json.loads(TRACE.read_text())
    records, saved = actval.derive(copy.deepcopy(trace))
    records2, _ = actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    assessments = [complete_assessment(result) for result in records]
    for assessment in assessments:
        assert assessment["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED"
        assert assessment["externalization_authority_present"] is False
        assert assessment["send_permit"] is False

    default_challenges = [challenge.challenge(copy.deepcopy(a)) for a in assessments]
    assert len(default_challenges) == 7
    for item in default_challenges:
        assert item["decision"] == "IDENTITY_CHALLENGE_REQUIRED"
        assert item["requester_identity_evidence_present"] is False
        assert item["requester_authority_evidence_present"] is False
        assert item["externalization_authority_granted"] is False
        assert item["send_permit"] is False
        assert item["runtime_connectedness"] == "SHADOW_ONLY_NOT_LIVE"
        assert len(item["authority_challenge_digest"]) == 64

    source = assessments[-1]
    identity_ctx = challenge.default_request_context(source)
    identity_ctx["requester_identity_evidence_present"] = True
    identity = challenge.challenge(copy.deepcopy(source), identity_ctx)
    assert identity["decision"] == "AUTHORITY_CHALLENGE_REQUIRED"
    assert identity["requester_identity_validated"] is False
    assert identity["requester_authority_validated"] is False

    review_ctx = challenge.default_request_context(source)
    review_ctx["requester_identity_evidence_present"] = True
    review_ctx["requester_authority_evidence_present"] = True
    review = challenge.challenge(copy.deepcopy(source), review_ctx)
    assert review["decision"] == "READY_FOR_AUTHORITY_REVIEW"
    assert review["authority_review_required"] is True
    assert review["externalization_authority_granted"] is False
    assert review["live_runtime_enabled"] is False
    assert review["send_permit"] is False

    non_applicable_assessment = act.assess(copy.deepcopy(records[-1]))
    assert non_applicable_assessment["decision"] == "SHADOW_ONLY_CONFIRMED"
    not_applicable = challenge.challenge(non_applicable_assessment)
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["authority_review_required"] is False

    mutations = 0

    def reject(mutate_result=None, mutate_context=None, mutate_assessment=None, mode="review"):
        nonlocal mutations
        assessment = copy.deepcopy(source)
        try:
            if mutate_assessment:
                mutate_assessment(assessment)
            ctx = challenge.default_request_context(assessment)
            if mode in {"authority", "review"}:
                ctx["requester_identity_evidence_present"] = True
            if mode == "review":
                ctx["requester_authority_evidence_present"] = True
            if mutate_context:
                mutate_context(ctx)
            result = challenge.challenge(copy.deepcopy(assessment), copy.deepcopy(ctx))
            if mutate_result:
                mutate_result(result)
                challenge.validate_challenge(assessment, ctx, result)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe externalization challenge mutation accepted")

    for field in challenge.FALSE_EFFECTS:
        reject(mutate_result=lambda r, f=field: r.__setitem__(f, True))

    result_mutations = [
        lambda r: r.__setitem__("decision", "AUTHORIZED"),
        lambda r: r.__setitem__("decision", "LIVE_READY"),
        lambda r: r.__setitem__("request_scope", "SESSION"),
        lambda r: r.__setitem__("requested_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("requested_capabilities", ["LIVE_RESPONSE_DELIVERY", "BACKGROUND_MESSAGING"]),
        lambda r: r.__setitem__("requested_duration", "FOREVER"),
        lambda r: r.__setitem__("requester_identity_validated", True),
        lambda r: r.__setitem__("requester_authority_validated", True),
        lambda r: r.__setitem__("authority_review_required", False),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE"),
        lambda r: r.__setitem__("source_activation_assessment_digest", "0" * 64),
        lambda r: r.__setitem__("request_context_digest", "0" * 64),
        lambda r: r.__setitem__("purpose", "MAXIMIZE_ENGAGEMENT"),
        lambda r: r.__setitem__("rollback_required", False),
        lambda r: r.__setitem__("audit_receipt_required", False),
        lambda r: r.__setitem__("player_can_stop", False),
    ]
    for mutation in result_mutations:
        reject(mutate_result=mutation)

    context_mutations = [
        lambda c: c.__setitem__("requester_claim", "REAL_USER"),
        lambda c: c.__setitem__("purpose", "UNBOUNDED_AUTONOMY"),
        lambda c: c.__setitem__("requested_scope", "ALL_FUTURE_SESSIONS"),
        lambda c: c.__setitem__("requested_capabilities", ["LIVE_RESPONSE_DELIVERY", "GAME_ACCOUNT_CONTROL"]),
        lambda c: c.__setitem__("requested_duration", "FOREVER"),
        lambda c: c.__setitem__("rollback_required", False),
        lambda c: c.__setitem__("audit_receipt_required", False),
        lambda c: c.__setitem__("player_can_stop", False),
        lambda c: c.__setitem__("proactive_messaging_requested", True),
        lambda c: c.__setitem__("background_activity_requested", True),
        lambda c: c.__setitem__("game_account_control_requested", True),
        lambda c: c.__setitem__("cross_game_scope_requested", True),
        lambda c: c.__setitem__("externalization_authority_granted", True),
        lambda c: c.__setitem__("send_permit_available", True),
        lambda c: c.__setitem__("live_runtime_bound", True),
        lambda c: c.__setitem__("external_transport_bound", True),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
        lambda c: c.__setitem__("source_activation_assessment_digest", "0" * 64),
        lambda c: c.__setitem__("requester_identity_evidence_present", "yes"),
        lambda c: c.__setitem__("requester_authority_evidence_present", "yes"),
    ]
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    assessment_mutations = [
        lambda a: a.__setitem__("externalization_authority_present", True),
        lambda a: a.__setitem__("live_runtime_enabled", True),
        lambda a: a.__setitem__("send_permit", True),
        lambda a: a.__setitem__("runtime_connectedness", "LIVE"),
        lambda a: a.__setitem__("activation_assessment_digest", "0" * 64),
        lambda a: a.__setitem__("decision", "LIVE_READY"),
    ]
    for mutation in assessment_mutations:
        reject(mutate_assessment=mutation)

    # Evidence presence must never be interpreted as proof or grant.
    reject(mutate_result=lambda r: r.__setitem__("requester_identity_validated", True), mode="authority")
    reject(mutate_result=lambda r: r.__setitem__("requester_authority_validated", True), mode="review")
    reject(mutate_result=lambda r: r.__setitem__("externalization_authority_granted", True), mode="review")
    reject(mutate_result=lambda r: r.__setitem__("send_permit", True), mode="review")

    final = review
    print(
        "externalization authority challenge validation: PASS; "
        f"requests={len(default_challenges)}; fail_closed_mutations={mutations}; "
        f"final_authority_challenge_digest={final['authority_challenge_digest']}"
    )

if __name__ == "__main__":
    main()
