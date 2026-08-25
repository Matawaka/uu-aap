#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = HERE / "review.py"
CHALLENGE_VALIDATE = ROOT / "network-user-surface-activation-challenge" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


review = loadmod("network_user_surface_externalization_review", REVIEW)
challengeval = loadmod("network_user_surface_externalization_review_challenge_validate", CHALLENGE_VALIDATE)


def ready_challenge(shadow_result):
    binding = challengeval.materialized_binding(shadow_result)
    item = challengeval.challenge.challenge(copy.deepcopy(binding), challengeval.ready_context(binding))
    assert item["decision"] == "READY_FOR_EXTERNALIZATION_REVIEW"
    return item


def complete_context(item):
    ctx = review.default_review_context(item)
    for field in review.REVIEW_DIMENSIONS:
        ctx[field] = True
    for _, result in review.RESULT_BINDINGS:
        ctx[result] = True
    return ctx


def main():
    trace = json.loads(TRACE.read_text())
    records, _ = challengeval.matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = challengeval.matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    challenges = [ready_challenge(result) for result in records]

    defaults = [review.review(copy.deepcopy(item)) for item in challenges]
    for receipt in defaults:
        assert receipt["decision"] == "REVIEW_INCOMPLETE"
        assert receipt["review_completed"] is False
        assert receipt["externalization_sufficiency_confirmed"] is False
        assert receipt["separate_activation_step_required"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["send_permit"] is False
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"

    complete = []
    for item in challenges:
        receipt = review.review(copy.deepcopy(item), complete_context(item))
        complete.append(receipt)
        assert receipt["decision"] == "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED"
        assert receipt["review_completed"] is True
        assert receipt["externalization_sufficiency_confirmed"] is True
        assert receipt["separate_activation_step_required"] is True
        assert receipt["network_contract_sufficient_for_activation"] is True
        assert receipt["user_surface_contract_sufficient_for_activation"] is True
        assert receipt["rollback_contract_sufficient_for_activation"] is True
        assert receipt["delivery_audit_sink_sufficient_for_activation"] is True
        assert receipt["binding_freshness_valid_for_activation"] is True
        assert receipt["activation_scope_valid_for_activation"] is True
        assert receipt["requested_capability_valid_for_activation"] is True
        assert receipt["network_activation_authorized"] is False
        assert receipt["user_surface_activation_authorized"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["external_transport_bound"] is False
        assert receipt["send_permit"] is False
        assert receipt["transport_invoked"] is False
        assert receipt["authority_effect"] == "NONE"
        assert receipt["action_effect"] == "NONE"
        assert receipt["successor_effect"] == "NONE"
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"
        assert len(receipt["externalization_review_receipt_digest"]) == 64

    source = challenges[-1]
    rejection_fields = [
        ("network_contract_sufficient", "REVIEW_REJECTED_NETWORK_CONTRACT"),
        ("user_surface_contract_sufficient", "REVIEW_REJECTED_USER_SURFACE_CONTRACT"),
        ("rollback_contract_sufficient", "REVIEW_REJECTED_ROLLBACK"),
        ("delivery_audit_sink_sufficient", "REVIEW_REJECTED_AUDIT_SINK"),
        ("binding_freshness_valid", "REVIEW_REJECTED_FRESHNESS"),
        ("activation_scope_valid", "REVIEW_REJECTED_SCOPE"),
        ("requested_capability_valid", "REVIEW_REJECTED_CAPABILITY"),
    ]
    for field, expected in rejection_fields:
        ctx = complete_context(source)
        ctx[field] = False
        result = review.review(copy.deepcopy(source), ctx)
        assert result["decision"] == expected
        assert result["externalization_sufficiency_confirmed"] is False
        assert result["network_enabled"] is False
        assert result["user_surface_enabled"] is False

    # A non-ready challenge cannot be reviewed into activation sufficiency.
    binding = challengeval.materialized_binding(records[-1])
    not_ready = challengeval.challenge.challenge(copy.deepcopy(binding))
    assert not_ready["decision"] == "ACTIVATION_NOT_REQUESTED"
    assert review.review(copy.deepcopy(not_ready))["decision"] == "NOT_APPLICABLE"
    try:
        bad_ctx = complete_context(not_ready)
        review.review(copy.deepcopy(not_ready), bad_ctx)
    except (ValueError, AssertionError, KeyError, TypeError):
        non_ready_rejected = 1
    else:
        raise AssertionError("non-ready activation challenge accepted review results")

    mutations = non_ready_rejected
    source = challenges[-1]

    def reject(mutate_output=None, mutate_context=None, mutate_source=None):
        nonlocal mutations
        item = copy.deepcopy(source)
        try:
            if mutate_source:
                mutate_source(item)
            ctx = complete_context(item)
            if mutate_context:
                mutate_context(ctx)
            out = review.review(copy.deepcopy(item), copy.deepcopy(ctx))
            if mutate_output:
                mutate_output(out)
                review.validate_review_receipt(item, ctx, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe network/user-surface externalization review mutation accepted")

    for item in challenges:
        source = item
        for field in review.FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = challenges[-1]

    output_mutations = [
        lambda r: r.__setitem__("decision", "ACTIVATED"),
        lambda r: r.__setitem__("decision", "SEND_ALLOWED"),
        lambda r: r.__setitem__("externalization_review_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("reviewer_claim", "REAL_NETWORK_OPERATOR"),
        lambda r: r.__setitem__("reviewer_identity_proven", True),
        lambda r: r.__setitem__("independent_review_proven", True),
        lambda r: r.__setitem__("activation_challenge_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("requested_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("binding_object_digest", "0" * 64),
        lambda r: r.__setitem__("runtime_binding_ref", "0" * 64),
        lambda r: r.__setitem__("transport_binding_ref", "0" * 64),
        lambda r: r.__setitem__("endpoint_binding_ref", "0" * 64),
        lambda r: r.__setitem__("network_contract_ref", "0" * 64),
        lambda r: r.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda r: r.__setitem__("rollback_contract_ref", "0" * 64),
        lambda r: r.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda r: r.__setitem__("network_contract_reviewed", False),
        lambda r: r.__setitem__("network_contract_sufficient_for_activation", False),
        lambda r: r.__setitem__("binding_freshness_valid_for_activation", False),
        lambda r: r.__setitem__("review_completed", False),
        lambda r: r.__setitem__("externalization_sufficiency_confirmed", False),
        lambda r: r.__setitem__("separate_activation_step_required", False),
        lambda r: r.__setitem__("source_activation_challenge_digest", "0" * 64),
        lambda r: r.__setitem__("review_context_digest", "0" * 64),
        lambda r: r.__setitem__("authority_effect", "CREATE_NETWORK_AUTHORITY"),
        lambda r: r.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_activation_challenge_digest", "0" * 64),
        lambda c: c.__setitem__("review_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("reviewer_claim", "REAL_REVIEWER"),
        lambda c: c.__setitem__("independent_review_asserted", False),
        lambda c: c.__setitem__("activation_challenge_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("requested_capability", "LIVE_UNBOUNDED_DELIVERY"),
        lambda c: c.__setitem__("binding_object_digest", "0" * 64),
        lambda c: c.__setitem__("network_contract_ref", "0" * 64),
        lambda c: c.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda c: c.__setitem__("rollback_contract_ref", "0" * 64),
        lambda c: c.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda c: c.__setitem__("activation_decision_present", True),
        lambda c: c.__setitem__("activation_token_present", True),
        lambda c: c.__setitem__("network_enablement_present", True),
        lambda c: c.__setitem__("user_surface_enablement_present", True),
        lambda c: c.__setitem__("send_permit_available", True),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
    ]
    for reviewed, result in review.RESULT_BINDINGS:
        context_mutations.append(lambda c, r=reviewed: c.__setitem__(r, "yes"))
        context_mutations.append(lambda c, f=result: c.__setitem__(f, "yes"))
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    source_mutations = [
        lambda s: s.__setitem__("decision", "ACTIVATION_NOT_REQUESTED"),
        lambda s: s.__setitem__("activation_review_ready", False),
        lambda s: s.__setitem__("activation_challenge_scope", "ALL_SESSIONS"),
        lambda s: s.__setitem__("requested_capability", "BACKGROUND_MESSAGING"),
        lambda s: s.__setitem__("binding_object_digest", "0" * 64),
        lambda s: s.__setitem__("runtime_binding_ref", "0" * 64),
        lambda s: s.__setitem__("transport_binding_ref", "0" * 64),
        lambda s: s.__setitem__("endpoint_binding_ref", "0" * 64),
        lambda s: s.__setitem__("network_contract_ref", "0" * 64),
        lambda s: s.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda s: s.__setitem__("rollback_contract_ref", "0" * 64),
        lambda s: s.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda s: s.__setitem__("binding_freshness_rechecked", False),
        lambda s: s.__setitem__("binding_object_current_confirmed", False),
        lambda s: s.__setitem__("binding_grant_current_confirmed", False),
        lambda s: s.__setitem__("network_enabled", True),
        lambda s: s.__setitem__("user_surface_enabled", True),
        lambda s: s.__setitem__("send_permit", True),
        lambda s: s.__setitem__("activation_challenge_digest", "0" * 64),
        lambda s: s.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in source_mutations:
        reject(mutate_source=mutation)

    final = complete[-1]
    print(
        "network user-surface externalization review validation: PASS; "
        f"receipts={len(complete)}; fail_closed_mutations={mutations}; "
        f"final_externalization_review_receipt_digest={final['externalization_review_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
