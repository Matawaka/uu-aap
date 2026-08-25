#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = HERE / "review.py"
BINDING_VALIDATE = ROOT / "runtime-transport-binding-challenge" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


review = loadmod("runtime_transport_binding_review", REVIEW)
bindval = loadmod("runtime_transport_binding_review_source_validate", BINDING_VALIDATE)
binding = bindval.binding


def ready_challenge(shadow_result):
    _, grant_item = bindval.active_grant(shadow_result)
    item = binding.evaluate(copy.deepcopy(grant_item), bindval.ready_context(grant_item))
    assert item["decision"] == "READY_FOR_BINDING_REVIEW"
    return item


def complete_context(item):
    ctx = review.default_review_context(item)
    for field in review.REVIEW_DIMENSIONS:
        ctx[field] = True
    for _, result in review.SUFFICIENCY_BINDINGS:
        ctx[result] = True
    return ctx


def main():
    trace = json.loads(TRACE.read_text())
    records, _ = bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    challenges = [ready_challenge(result) for result in records]
    defaults = [review.review(copy.deepcopy(item)) for item in challenges]
    assert len(defaults) == 7
    for receipt in defaults:
        assert receipt["decision"] == "REVIEW_INCOMPLETE"
        assert receipt["review_completed"] is False
        assert receipt["binding_sufficiency_confirmed"] is False
        assert receipt["binding_authorized"] is False
        assert receipt["runtime_binding_created"] is False
        assert receipt["transport_binding_created"] is False
        assert receipt["send_permit"] is False
        assert receipt["runtime_connectedness"] == "AUTHORITY_PLANE_ONLY_NOT_BOUND"
        assert len(receipt["binding_review_receipt_digest"]) == 64

    source = challenges[-1]
    full_ctx = complete_context(source)
    complete = review.review(copy.deepcopy(source), full_ctx)
    assert complete["decision"] == "REVIEW_COMPLETE_BINDING_REQUIRED"
    assert complete["review_completed"] is True
    assert complete["descriptor_sufficiency_evaluated"] is True
    assert complete["attestation_sufficiency_evaluated"] is True
    assert complete["binding_sufficiency_confirmed"] is True
    assert complete["separate_binding_step_required"] is True
    assert complete["binding_authorized"] is False
    assert complete["binding_decision_present"] is False
    assert complete["binding_token_created"] is False
    assert complete["runtime_binding_created"] is False
    assert complete["transport_binding_created"] is False
    assert complete["external_transport_bound"] is False
    assert complete["live_runtime_bound"] is False
    assert complete["network_enabled"] is False
    assert complete["send_permit"] is False

    def rejected(field, expected):
        ctx = complete_context(source)
        ctx[field] = False
        receipt = review.review(copy.deepcopy(source), ctx)
        assert receipt["decision"] == expected
        assert receipt["review_completed"] is True
        assert receipt["binding_sufficiency_confirmed"] is False
        assert receipt["binding_authorized"] is False

    rejected("runtime_descriptor_sufficient", "REVIEW_REJECTED_RUNTIME_DESCRIPTOR")
    rejected("transport_descriptor_sufficient", "REVIEW_REJECTED_TRANSPORT_DESCRIPTOR")
    rejected("endpoint_descriptor_sufficient", "REVIEW_REJECTED_ENDPOINT_DESCRIPTOR")
    rejected("runtime_attestation_sufficient", "REVIEW_REJECTED_RUNTIME_ATTESTATION")
    rejected("transport_attestation_sufficient", "REVIEW_REJECTED_TRANSPORT_ATTESTATION")
    rejected("scope_match_valid", "REVIEW_REJECTED_SCOPE")
    rejected("capability_match_valid", "REVIEW_REJECTED_CAPABILITY")
    rejected("lifecycle_current_and_valid", "REVIEW_REJECTED_LIFECYCLE")

    incomplete_ctx = complete_context(source)
    incomplete_ctx["lifecycle_reviewed"] = False
    incomplete_ctx["lifecycle_current_and_valid"] = False
    incomplete = review.review(copy.deepcopy(source), incomplete_ctx)
    assert incomplete["decision"] == "REVIEW_INCOMPLETE"
    assert incomplete["review_completed"] is False

    _, grant_item = bindval.active_grant(records[-1])
    not_ready_challenge = binding.evaluate(copy.deepcopy(grant_item))
    assert not_ready_challenge["decision"] == "BINDING_NOT_REQUESTED"
    not_applicable = review.review(copy.deepcopy(not_ready_challenge))
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["binding_authorized"] is False

    mutations = 0

    def reject(mutate_output=None, mutate_context=None, mutate_challenge=None):
        nonlocal mutations
        item = copy.deepcopy(source)
        try:
            if mutate_challenge:
                mutate_challenge(item)
            ctx = complete_context(item)
            if mutate_context:
                mutate_context(ctx)
            receipt = review.review(copy.deepcopy(item), copy.deepcopy(ctx))
            if mutate_output:
                mutate_output(receipt)
                review.validate_receipt(item, ctx, receipt)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe runtime/transport binding review mutation accepted")

    for item in challenges:
        source = item
        for field in review.FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = challenges[-1]

    output_mutations = [
        lambda r: r.__setitem__("decision", "BOUND"),
        lambda r: r.__setitem__("decision", "SEND_ALLOWED"),
        lambda r: r.__setitem__("binding_review_receipt_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("reviewer_claim", "REAL_BINDING_AUTHORITY"),
        lambda r: r.__setitem__("independent_review_asserted", False),
        lambda r: r.__setitem__("reviewer_identity_proven", True),
        lambda r: r.__setitem__("independent_review_proven", True),
        lambda r: r.__setitem__("runtime_identity_proven", True),
        lambda r: r.__setitem__("transport_identity_proven", True),
        lambda r: r.__setitem__("endpoint_credential_created", True),
        lambda r: r.__setitem__("granted_scope", "ALL_FUTURE_SESSIONS"),
        lambda r: r.__setitem__("granted_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("runtime_class", "REAL_RUNTIME"),
        lambda r: r.__setitem__("transport_class", "REAL_TRANSPORT"),
        lambda r: r.__setitem__("endpoint_class", "RAW_ENDPOINT"),
        lambda r: r.__setitem__("runtime_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("transport_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("endpoint_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("runtime_attestation_ref", "0" * 64),
        lambda r: r.__setitem__("transport_attestation_ref", "0" * 64),
        lambda r: r.__setitem__("review_completed", False),
        lambda r: r.__setitem__("descriptor_sufficiency_evaluated", False),
        lambda r: r.__setitem__("attestation_sufficiency_evaluated", False),
        lambda r: r.__setitem__("binding_sufficiency_confirmed", False),
        lambda r: r.__setitem__("separate_binding_step_required", False),
        lambda r: r.__setitem__("source_binding_challenge_digest", "0" * 64),
        lambda r: r.__setitem__("review_context_digest", "0" * 64),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE_BOUND"),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_binding_challenge_digest", "0" * 64),
        lambda c: c.__setitem__("review_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("reviewer_claim", "REAL_REVIEWER"),
        lambda c: c.__setitem__("independent_review_asserted", False),
        lambda c: c.__setitem__("runtime_descriptor_ref", "0" * 64),
        lambda c: c.__setitem__("transport_descriptor_ref", "0" * 64),
        lambda c: c.__setitem__("endpoint_descriptor_ref", "0" * 64),
        lambda c: c.__setitem__("runtime_attestation_ref", "0" * 64),
        lambda c: c.__setitem__("transport_attestation_ref", "0" * 64),
        lambda c: c.__setitem__("binding_decision_present", True),
        lambda c: c.__setitem__("binding_token_present", True),
        lambda c: c.__setitem__("runtime_binding_present", True),
        lambda c: c.__setitem__("transport_binding_present", True),
        lambda c: c.__setitem__("send_permit_available", True),
        lambda c: c.__setitem__("network_enabled", True),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
        lambda c: c.__setitem__("runtime_descriptor_reviewed", "yes"),
        lambda c: c.__setitem__("transport_descriptor_reviewed", "yes"),
        lambda c: c.__setitem__("endpoint_descriptor_reviewed", "yes"),
        lambda c: c.__setitem__("runtime_attestation_reviewed", "yes"),
        lambda c: c.__setitem__("transport_attestation_reviewed", "yes"),
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
        lambda c: c.__setitem__("decision", "BOUND"),
        lambda c: c.__setitem__("binding_review_ready", False),
        lambda c: c.__setitem__("grant_active_confirmed", False),
        lambda c: c.__setitem__("binding_authorized", True),
        lambda c: c.__setitem__("runtime_binding_created", True),
        lambda c: c.__setitem__("transport_binding_created", True),
        lambda c: c.__setitem__("external_transport_bound", True),
        lambda c: c.__setitem__("send_permit", True),
        lambda c: c.__setitem__("runtime_connectedness", "LIVE_BOUND"),
        lambda c: c.__setitem__("binding_challenge_digest", "0" * 64),
        lambda c: c.__setitem__("runtime_descriptor_ref", "short"),
        lambda c: c.__setitem__("transport_descriptor_ref", "short"),
        lambda c: c.__setitem__("endpoint_descriptor_ref", "short"),
        lambda c: c.__setitem__("runtime_attestation_ref", "short"),
        lambda c: c.__setitem__("transport_attestation_ref", "short"),
    ]
    for mutation in challenge_mutations:
        reject(mutate_challenge=mutation)

    source = challenges[-1]
    try:
        ctx = review.default_review_context(not_ready_challenge)
        ctx["runtime_descriptor_reviewed"] = True
        review.review(copy.deepcopy(not_ready_challenge), ctx)
    except (ValueError, AssertionError, KeyError, TypeError):
        mutations += 1
    else:
        raise AssertionError("non-ready binding challenge accepted review work")

    print(
        "runtime transport binding review validation: PASS; "
        f"receipts={len(defaults)}; fail_closed_mutations={mutations}; "
        f"final_binding_review_receipt_digest={complete['binding_review_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
