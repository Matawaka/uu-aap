#!/usr/bin/env python3
import copy
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = HERE / "review.py"
UPSTREAM_VALIDATE = ROOT / "network-user-surface-enablement-challenge" / "validate.py"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


review = loadmod("network_user_surface_enablement_externalization_review", REVIEW)
upstream = loadmod(
    "network_user_surface_enablement_externalization_review_upstream_validate",
    UPSTREAM_VALIDATE,
)


def active_challenges():
    _, states = upstream.active_activation_states()
    _, states2 = upstream.active_activation_states()
    assert states == states2
    assert len(states) == 7
    receipts = [
        review.challenge.enablement_challenge(
            copy.deepcopy(item),
            upstream.ready_context(item),
        )
        for item in states
    ]
    receipts2 = [
        review.challenge.enablement_challenge(
            copy.deepcopy(item),
            upstream.ready_context(item),
        )
        for item in states
    ]
    assert receipts == receipts2
    for receipt in receipts:
        assert receipt["decision"] == "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
        review.validate_enablement_challenge(receipt)
    return states, receipts


def complete_review_context(item):
    context = review.default_review_context(item)
    for reviewed, result in review.RESULT_BINDINGS:
        context[reviewed] = True
        context[result] = True
    return context


def main():
    states, challenges = active_challenges()

    defaults = [review.review(copy.deepcopy(item)) for item in challenges]
    defaults2 = [review.review(copy.deepcopy(item)) for item in challenges]
    assert defaults == defaults2
    for receipt in defaults:
        assert receipt["decision"] == "ENABLEMENT_REVIEW_INCOMPLETE"
        assert receipt["enablement_review_completed"] is False
        assert receipt["enablement_externalization_sufficiency_confirmed"] is False
        assert receipt["human_enablement_grant_decision_required"] is False
        assert receipt["human_enablement_grant_decision_present"] is False
        assert receipt["enablement_grant_created"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["send_permit"] is False

    completed = []
    for item in challenges:
        context = complete_review_context(item)
        receipt = review.review(copy.deepcopy(item), context)
        completed.append(receipt)
        assert receipt["decision"] == "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
        assert receipt["enablement_review_completed"] is True
        assert receipt["enablement_externalization_sufficiency_confirmed"] is True
        assert receipt["separate_enablement_grant_required"] is True
        assert receipt["human_enablement_grant_decision_required"] is True
        assert receipt["human_enablement_grant_decision_present"] is False
        assert receipt["human_decision_boundary"] == review.HUMAN_DECISION_BOUNDARY
        assert receipt["review_is_enablement_grant"] is False
        assert receipt["enablement_grant_created"] is False
        assert receipt["enablement_authority_granted"] is False
        assert receipt["network_enablement_authority_granted"] is False
        assert receipt["user_surface_enablement_authority_granted"] is False
        assert receipt["enablement_materialized"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["send_permit"] is False
        assert receipt["copyright_process_modified"] is False
        assert receipt["license_or_notice_modified"] is False
        assert receipt["legal_author_identity_modified"] is False
        assert receipt["pseudonym_publication_process_modified"] is False
        assert receipt["authority_effect"] == "NONE"
        assert receipt["action_effect"] == "NONE"
        assert receipt["successor_effect"] == "NONE"
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
        assert len(receipt["enablement_externalization_review_receipt_digest"]) == 64
        review.validate_review_receipt(item, context, receipt)

    inactive_challenge = review.challenge.enablement_challenge(copy.deepcopy(states[-1]))
    assert inactive_challenge["decision"] == "ENABLEMENT_CHALLENGE_NOT_CREATED"
    not_applicable = review.review(copy.deepcopy(inactive_challenge))
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["enablement_review_completed"] is False
    assert not_applicable["human_enablement_grant_decision_required"] is False

    partial_context = review.default_review_context(challenges[-1])
    partial_context["activation_provenance_reviewed"] = True
    partial_context["activation_provenance_valid"] = True
    partial = review.review(copy.deepcopy(challenges[-1]), partial_context)
    assert partial["decision"] == "ENABLEMENT_REVIEW_INCOMPLETE"
    assert partial["enablement_review_completed"] is False

    rejection_expectations = (
        ("activation_provenance_valid", "ENABLEMENT_REVIEW_REJECTED_PROVENANCE"),
        ("network_contract_sufficient", "ENABLEMENT_REVIEW_REJECTED_NETWORK_CONTRACT"),
        ("user_surface_contract_sufficient", "ENABLEMENT_REVIEW_REJECTED_USER_SURFACE_CONTRACT"),
        ("rollback_contract_sufficient", "ENABLEMENT_REVIEW_REJECTED_ROLLBACK"),
        ("delivery_audit_sink_sufficient", "ENABLEMENT_REVIEW_REJECTED_AUDIT_SINK"),
        ("lifecycle_freshness_valid", "ENABLEMENT_REVIEW_REJECTED_FRESHNESS"),
        ("enablement_scope_valid", "ENABLEMENT_REVIEW_REJECTED_SCOPE"),
        ("requested_capability_valid", "ENABLEMENT_REVIEW_REJECTED_CAPABILITY"),
    )
    for result_field, expected_decision in rejection_expectations:
        context = complete_review_context(challenges[-1])
        context[result_field] = False
        rejected_receipt = review.review(copy.deepcopy(challenges[-1]), context)
        assert rejected_receipt["decision"] == expected_decision
        assert rejected_receipt["enablement_review_completed"] is True
        assert rejected_receipt["enablement_externalization_sufficiency_confirmed"] is False
        assert rejected_receipt["human_enablement_grant_decision_required"] is False

    rejected_mutations = 0

    def reject_output(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(challenges[-1])
        context = complete_review_context(item)
        output = review.review(copy.deepcopy(item), copy.deepcopy(context))
        try:
            mutate(output)
            review.validate_review_receipt(item, context, output)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement review output mutation accepted")

    def reject_context(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(challenges[-1])
        context = complete_review_context(item)
        try:
            mutate(context)
            review.review(copy.deepcopy(item), context)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement review context mutation accepted")

    def reject_source(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(challenges[-1])
        try:
            mutate(item)
            review.review(item)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement review source mutation accepted")

    output_mutations = [
        lambda receipt: receipt.__setitem__("decision", "ENABLEMENT_GRANTED"),
        lambda receipt: receipt.__setitem__("enablement_externalization_review_scope", "ALL_SESSIONS"),
        lambda receipt: receipt.__setitem__("requested_capability", "ENABLE_NETWORK"),
        lambda receipt: receipt.__setitem__("requested_duration", "FOREVER"),
        lambda receipt: receipt.__setitem__("human_decision_boundary", "DECISION_NOT_REQUIRED"),
        lambda receipt: receipt.__setitem__("human_enablement_grant_decision_required", False),
        lambda receipt: receipt.__setitem__("human_enablement_grant_decision_present", True),
        lambda receipt: receipt.__setitem__("review_is_enablement_grant", True),
        lambda receipt: receipt.__setitem__("review_is_enablement", True),
        lambda receipt: receipt.__setitem__("review_is_send_permit", True),
        lambda receipt: receipt.__setitem__("review_is_bearer_credential", True),
        lambda receipt: receipt.__setitem__("source_enablement_challenge_receipt_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("enablement_challenge_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("activation_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("network_contract_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("review_context_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("authority_effect", "CREATE_AUTHORITY"),
        lambda receipt: receipt.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda receipt: receipt.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
        lambda receipt: receipt.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for field in review.FALSE_EFFECTS:
        output_mutations.append(
            lambda receipt, key=field: receipt.__setitem__(key, True)
        )
    for mutation in output_mutations:
        reject_output(mutation)

    context_mutations = [
        lambda context: context.__setitem__("source_enablement_challenge_receipt_digest", "0" * 64),
        lambda context: context.__setitem__("review_scope", "ALL_CHALLENGES"),
        lambda context: context.__setitem__("reviewer_claim", "HUMAN_REVIEWER"),
        lambda context: context.__setitem__("independent_review_asserted", False),
        lambda context: context.__setitem__("challenge_scope", "ALL_SESSIONS"),
        lambda context: context.__setitem__("requested_capability", "ENABLE_NETWORK"),
        lambda context: context.__setitem__("requested_duration", "FOREVER"),
        lambda context: context.__setitem__("human_decision_boundary", "DECISION_NOT_REQUIRED"),
        lambda context: context.__setitem__("activation_state_ref", "0" * 64),
        lambda context: context.__setitem__("activation_provenance_reviewed", "yes"),
        lambda context: context.__setitem__("network_contract_sufficient", "yes"),
        lambda context: context.__setitem__("authority_effect", "CREATE_AUTHORITY"),
        lambda context: context.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda context: context.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
    ]
    for field in review.FORBIDDEN_CONTEXT_EFFECTS:
        context_mutations.append(
            lambda context, key=field: context.__setitem__(key, True)
        )
    for mutation in context_mutations:
        reject_context(mutation)

    source_mutations = [
        lambda item: item.__setitem__("decision", "ENABLEMENT_CHALLENGE_NOT_CREATED"),
        lambda item: item.__setitem__("enablement_challenge_receipt_digest", "0" * 64),
        lambda item: item.__setitem__("enablement_challenge_ref", "0" * 64),
        lambda item: item.__setitem__("activation_state_ref", "0" * 64),
        lambda item: item.__setitem__("network_enabled", True),
        lambda item: item.__setitem__("user_surface_enabled", True),
        lambda item: item.__setitem__("send_permit", True),
        lambda item: item.__setitem__("external_effect_authorized", True),
        lambda item: item.__setitem__("copyright_process_modified", True),
        lambda item: item.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in source_mutations:
        reject_source(mutation)

    final = completed[-1]
    print(
        "network user-surface enablement externalization review validation: PASS; "
        f"reviews={len(completed)}; fail_closed_mutations={rejected_mutations}; "
        "human_decision_boundary="
        f"{final['human_decision_boundary']}; "
        "final_enablement_externalization_review_receipt_digest="
        f"{final['enablement_externalization_review_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
