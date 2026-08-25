#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = HERE / "review.py"
CHALLENGE = ROOT / "externalization-authority-challenge" / "challenge.py"
ACTIVATION_VALIDATE = ROOT / "runtime-activation-boundary" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"

def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

review = loadmod("authority_review_receipt", REVIEW)
challenge = loadmod("authority_review_challenge_source", CHALLENGE)
actval = loadmod("authority_review_activation_validate", ACTIVATION_VALIDATE)
act = actval.act

def ready_challenge(shadow_result):
    ctx = act.default_context(shadow_result)
    for field in act.TECHNICAL_PROOFS:
        ctx[field] = True
    assessment = act.assess(copy.deepcopy(shadow_result), ctx)
    assert assessment["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED"
    request = challenge.default_request(assessment)
    request["requester_identity_evidence_present"] = True
    request["requester_identity_evidence_ref"] = "1" * 64
    request["requester_authority_evidence_present"] = True
    request["requester_authority_evidence_ref"] = "2" * 64
    request["request_digest"] = challenge.sha({k: v for k, v in request.items() if k != "request_digest"})
    item = challenge.evaluate(copy.deepcopy(assessment), request)
    assert item["decision"] == "READY_FOR_AUTHORITY_REVIEW"
    return item

def complete_context(item):
    ctx = review.default_review_context(item)
    for field in review.REVIEW_DIMENSIONS:
        ctx[field] = True
    ctx["identity_evidence_sufficient"] = True
    ctx["authority_evidence_sufficient"] = True
    ctx["scope_within_bounds"] = True
    ctx["capability_within_bounds"] = True
    ctx["duration_within_bounds"] = True
    return ctx

def main():
    trace = json.loads(TRACE.read_text())
    records, _ = actval.derive(copy.deepcopy(trace))
    records2, _ = actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    challenges = [ready_challenge(result) for result in records]
    defaults = [review.review(copy.deepcopy(item)) for item in challenges]
    assert len(defaults) == 7
    for receipt in defaults:
        assert receipt["decision"] == "REVIEW_INCOMPLETE"
        assert receipt["review_completed"] is False
        assert receipt["externalization_authority_granted"] is False
        assert receipt["send_permit"] is False
        assert receipt["runtime_connectedness"] == "SHADOW_ONLY_NOT_LIVE"
        assert len(receipt["authority_review_receipt_digest"]) == 64

    source = challenges[-1]
    full_ctx = complete_context(source)
    complete = review.review(copy.deepcopy(source), full_ctx)
    assert complete["decision"] == "REVIEW_COMPLETE_GRANT_REQUIRED"
    assert complete["review_completed"] is True
    assert complete["evidence_sufficiency_evaluated"] is True
    assert complete["identity_evidence_sufficient_for_request"] is True
    assert complete["authority_basis_sufficient_for_request"] is True
    assert complete["separate_grant_step_required"] is True
    assert complete["externalization_authority_granted"] is False
    assert complete["grant_decision_present"] is False
    assert complete["grant_token_created"] is False
    assert complete["send_permit"] is False
    assert complete["live_runtime_enabled"] is False

    def rejected(field, expected):
        ctx = complete_context(source)
        ctx[field] = False
        receipt = review.review(copy.deepcopy(source), ctx)
        assert receipt["decision"] == expected
        assert receipt["review_completed"] is True
        assert receipt["externalization_authority_granted"] is False

    rejected("identity_evidence_sufficient", "REVIEW_REJECTED_IDENTITY")
    rejected("authority_evidence_sufficient", "REVIEW_REJECTED_AUTHORITY")
    rejected("scope_within_bounds", "REVIEW_REJECTED_SCOPE")
    rejected("capability_within_bounds", "REVIEW_REJECTED_CAPABILITY")
    rejected("duration_within_bounds", "REVIEW_REJECTED_DURATION")

    incomplete_ctx = complete_context(source)
    incomplete_ctx["duration_reviewed"] = False
    incomplete_ctx["duration_within_bounds"] = False
    incomplete = review.review(copy.deepcopy(source), incomplete_ctx)
    assert incomplete["decision"] == "REVIEW_INCOMPLETE"
    assert incomplete["review_completed"] is False

    non_ready = copy.deepcopy(source)
    non_ready["decision"] = "AUTHORITY_CHALLENGE_REQUIRED"
    non_ready["reason"] = "REQUESTER_AUTHORITY_EVIDENCE_ABSENT"
    non_ready["review_ready"] = False
    non_ready["authority_evidence_present"] = False
    non_ready["authority_evidence_ref"] = None
    non_ready["challenge_digest"] = challenge.sha({k: v for k, v in non_ready.items() if k != "challenge_digest"})
    not_applicable = review.review(non_ready)
    assert not_applicable["decision"] == "NOT_APPLICABLE"

    mutations = 0
    def reject(mutate_receipt=None, mutate_context=None, mutate_challenge=None):
        nonlocal mutations
        item = copy.deepcopy(source)
        try:
            if mutate_challenge:
                mutate_challenge(item)
            ctx = complete_context(item)
            if mutate_context:
                mutate_context(ctx)
            receipt = review.review(copy.deepcopy(item), copy.deepcopy(ctx))
            if mutate_receipt:
                mutate_receipt(receipt)
                review.validate_receipt(item, ctx, receipt)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe authority review mutation accepted")

    for _item in challenges:
        source = _item
        for field in review.FALSE_EFFECTS:
            reject(mutate_receipt=lambda r, f=field: r.__setitem__(f, True))
    source = challenges[-1]

    result_mutations = [
        lambda r: r.__setitem__("decision", "AUTHORIZED"),
        lambda r: r.__setitem__("decision", "LIVE_READY"),
        lambda r: r.__setitem__("review_receipt_scope", "SESSION"),
        lambda r: r.__setitem__("reviewer_identity_proven", True),
        lambda r: r.__setitem__("independent_review_proven", True),
        lambda r: r.__setitem__("requester_identity_proven", True),
        lambda r: r.__setitem__("requester_authority_granted", True),
        lambda r: r.__setitem__("separate_grant_step_required", False),
        lambda r: r.__setitem__("source_challenge_digest", "0" * 64),
        lambda r: r.__setitem__("review_context_digest", "0" * 64),
        lambda r: r.__setitem__("identity_evidence_ref", "0" * 64),
        lambda r: r.__setitem__("authority_evidence_ref", "0" * 64),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE"),
        lambda r: r.__setitem__("review_completed", False),
        lambda r: r.__setitem__("evidence_sufficiency_evaluated", False),
    ]
    for mutation in result_mutations:
        reject(mutate_receipt=mutation)

    context_mutations = [
        lambda c: c.__setitem__("review_scope", "SESSION"),
        lambda c: c.__setitem__("reviewer_claim", "REAL_REVIEWER"),
        lambda c: c.__setitem__("independent_review_asserted", False),
        lambda c: c.__setitem__("source_challenge_digest", "0" * 64),
        lambda c: c.__setitem__("identity_evidence_ref", "0" * 64),
        lambda c: c.__setitem__("authority_evidence_ref", "0" * 64),
        lambda c: c.__setitem__("grant_decision_present", True),
        lambda c: c.__setitem__("grant_token_present", True),
        lambda c: c.__setitem__("externalization_authority_granted", True),
        lambda c: c.__setitem__("send_permit_available", True),
        lambda c: c.__setitem__("live_runtime_bound", True),
        lambda c: c.__setitem__("external_transport_bound", True),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
        lambda c: c.__setitem__("identity_evidence_reviewed", "yes"),
        lambda c: c.__setitem__("authority_evidence_reviewed", "yes"),
    ]
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    def sufficiency_without_review(reviewed, result):
        def mutation(c):
            c[reviewed] = False
            c[result] = True
        return mutation
    for reviewed, result in review.SUFFICIENCY_BINDINGS:
        reject(mutate_context=sufficiency_without_review(reviewed, result))

    challenge_mutations = [
        lambda c: c.__setitem__("externalization_authority_granted", True),
        lambda c: c.__setitem__("send_permit", True),
        lambda c: c.__setitem__("runtime_connectedness", "LIVE"),
        lambda c: c.__setitem__("challenge_digest", "0" * 64),
        lambda c: c.__setitem__("decision", "AUTHORIZED"),
        lambda c: c.__setitem__("identity_evidence_ref", "short"),
        lambda c: c.__setitem__("authority_evidence_ref", "short"),
    ]
    for mutation in challenge_mutations:
        reject(mutate_challenge=mutation)

    print(
        "authority review receipt validation: PASS; "
        f"receipts={len(defaults)}; fail_closed_mutations={mutations}; "
        f"final_authority_review_receipt_digest={complete['authority_review_receipt_digest']}"
    )

if __name__ == "__main__":
    main()
