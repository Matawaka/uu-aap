#!/usr/bin/env python3
import copy
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GRANT = HERE / "grant.py"
UPSTREAM_VALIDATE = (
    ROOT / "network-user-surface-enablement-externalization-review" / "validate.py"
)


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


grant = loadmod("network_user_surface_enablement_grant", GRANT)
upstream = loadmod(
    "network_user_surface_enablement_grant_upstream_validate",
    UPSTREAM_VALIDATE,
)


def complete_reviews():
    _, challenges = upstream.active_challenges()
    _, challenges2 = upstream.active_challenges()
    assert challenges == challenges2
    assert len(challenges) == 7
    receipts = []
    receipts2 = []
    for item in challenges:
        context = grant.review.default_review_context(item)
        context2 = grant.review.default_review_context(item)
        for reviewed, result in grant.review.RESULT_BINDINGS:
            context[reviewed] = True
            context[result] = True
            context2[reviewed] = True
            context2[result] = True
        receipts.append(grant.review.review(copy.deepcopy(item), context))
        receipts2.append(grant.review.review(copy.deepcopy(item), context2))
    assert receipts == receipts2
    for receipt in receipts:
        assert receipt["decision"] == "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
        grant.validate_review_receipt(receipt)
    return challenges, receipts


def human_decision_context(item, decision):
    context = grant.default_grant_context(item)
    context["human_decision_asserted"] = True
    context["human_decision"] = decision
    context["human_decision_evidence_ref"] = grant.sha({
        "kind": "SYNTHETIC_HUMAN_ENABLEMENT_DECISION_EVIDENCE_FIXTURE_V0.1",
        "source_enablement_externalization_review_receipt_digest": item[
            "enablement_externalization_review_receipt_digest"
        ],
        "human_decision": decision,
    })
    context["grantor_claim"] = grant.GRANTOR_CLAIM
    return context


def main():
    challenges, reviews = complete_reviews()

    defaults = [grant.grant(copy.deepcopy(item)) for item in reviews]
    defaults2 = [grant.grant(copy.deepcopy(item)) for item in reviews]
    assert defaults == defaults2
    for receipt in defaults:
        assert receipt["decision"] == "ENABLEMENT_GRANT_DECISION_REQUIRED"
        assert receipt["human_decision_asserted"] is False
        assert receipt["human_decision"] == grant.NO_HUMAN_DECISION
        assert receipt["enablement_grant_decision_present"] is False
        assert receipt["enablement_grant_created"] is False
        assert receipt["enablement_authority_granted"] is False
        assert receipt["enablement_materialization_required"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["send_permit"] is False

    denied_context = human_decision_context(reviews[-1], grant.DENY_DECISION)
    denied = grant.grant(copy.deepcopy(reviews[-1]), denied_context)
    assert denied["decision"] == "ENABLEMENT_GRANT_DENIED"
    assert denied["enablement_grant_denied"] is True
    assert denied["grant_decision_receipt_created"] is True
    assert denied["enablement_grant_created"] is False
    assert denied["enablement_authority_granted"] is False

    evidence_context = human_decision_context(reviews[-1], grant.MORE_EVIDENCE_DECISION)
    more_evidence = grant.grant(copy.deepcopy(reviews[-1]), evidence_context)
    assert more_evidence["decision"] == "ENABLEMENT_GRANT_MORE_EVIDENCE_REQUIRED"
    assert more_evidence["enablement_more_evidence_required"] is True
    assert more_evidence["enablement_grant_created"] is False
    assert more_evidence["enablement_authority_granted"] is False

    active_grants = []
    for item in reviews:
        context = human_decision_context(item, grant.GRANT_DECISION)
        receipt = grant.grant(copy.deepcopy(item), context)
        active_grants.append(receipt)
        assert receipt["decision"] == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
        assert receipt["human_decision_asserted"] is True
        assert receipt["human_decision"] == grant.GRANT_DECISION
        assert receipt["human_decision_authenticated"] is False
        assert receipt["grantor_identity_proven"] is False
        assert receipt["grantor_real_world_authority_proven"] is False
        assert receipt["grant_authority_basis_validated_for_synthetic_scope"] is True
        assert receipt["enablement_grant_historically_issued"] is True
        assert receipt["enablement_grant_currently_active"] is True
        assert receipt["enablement_grant_created"] is True
        assert receipt["enablement_authority_granted"] is True
        assert receipt["network_enablement_authority_granted"] is True
        assert receipt["user_surface_enablement_authority_granted"] is True
        assert receipt["enablement_materialization_required"] is True
        assert receipt["synthetic_enablement_authority_only"] is True
        assert receipt["real_world_enablement_authority_created"] is False
        assert receipt["enablement_materialized"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["external_transport_bound"] is False
        assert receipt["send_permit"] is False
        assert receipt["transport_invoked"] is False
        assert receipt["copyright_process_modified"] is False
        assert receipt["license_or_notice_modified"] is False
        assert receipt["legal_author_identity_modified"] is False
        assert receipt["pseudonym_publication_process_modified"] is False
        assert (
            receipt["authority_effect"]
            == "CREATE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        )
        assert receipt["action_effect"] == "NONE"
        assert receipt["successor_effect"] == "NONE"
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
        assert len(receipt["enablement_grant_receipt_digest"]) == 64
        grant.validate_grant_receipt(item, context, receipt)

    revoked_context = human_decision_context(reviews[-1], grant.GRANT_DECISION)
    revoked_context["revocation_requested"] = True
    revoked = grant.grant(copy.deepcopy(reviews[-1]), revoked_context)
    assert revoked["decision"] == "ENABLEMENT_GRANT_REVOKED"
    assert revoked["enablement_grant_historically_issued"] is True
    assert revoked["enablement_grant_currently_active"] is False
    assert revoked["enablement_grant_revoked"] is True
    assert revoked["enablement_authority_granted"] is False
    assert revoked["enablement_materialization_required"] is False
    assert (
        revoked["authority_effect"]
        == "REVOKE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
    )

    expired_context = human_decision_context(reviews[-1], grant.GRANT_DECISION)
    expired_context["expiry_boundary_reached"] = True
    expired = grant.grant(copy.deepcopy(reviews[-1]), expired_context)
    assert expired["decision"] == "ENABLEMENT_GRANT_EXPIRED"
    assert expired["enablement_grant_historically_issued"] is True
    assert expired["enablement_grant_currently_active"] is False
    assert expired["enablement_grant_expired"] is True
    assert expired["enablement_authority_granted"] is False
    assert expired["enablement_materialization_required"] is False
    assert (
        expired["authority_effect"]
        == "EXPIRE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
    )

    incomplete_review = grant.review.review(copy.deepcopy(challenges[-1]))
    assert incomplete_review["decision"] == "ENABLEMENT_REVIEW_INCOMPLETE"
    not_applicable = grant.grant(copy.deepcopy(incomplete_review))
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["enablement_grant_created"] is False
    assert not_applicable["enablement_authority_granted"] is False

    rejected_mutations = 0

    def reject_output(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(reviews[-1])
        context = human_decision_context(item, grant.GRANT_DECISION)
        output = grant.grant(copy.deepcopy(item), copy.deepcopy(context))
        try:
            mutate(output)
            grant.validate_grant_receipt(item, context, output)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement grant output mutation accepted")

    def reject_context(mutate, base_decision=grant.GRANT_DECISION):
        nonlocal rejected_mutations
        item = copy.deepcopy(reviews[-1])
        context = human_decision_context(item, base_decision)
        try:
            mutate(context)
            grant.grant(copy.deepcopy(item), context)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement grant context mutation accepted")

    def reject_source(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(reviews[-1])
        try:
            mutate(item)
            grant.grant(item)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement grant source mutation accepted")

    output_mutations = [
        lambda receipt: receipt.__setitem__("decision", "NETWORK_ENABLED"),
        lambda receipt: receipt.__setitem__("enablement_grant_receipt_scope", "ALL_REVIEWS"),
        lambda receipt: receipt.__setitem__("human_decision", grant.NO_HUMAN_DECISION),
        lambda receipt: receipt.__setitem__("human_decision_asserted", False),
        lambda receipt: receipt.__setitem__("human_decision_evidence_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("human_decision_authenticated", True),
        lambda receipt: receipt.__setitem__("grantor_claim", "SYSTEM_GRANTOR"),
        lambda receipt: receipt.__setitem__("grantor_identity_proven", True),
        lambda receipt: receipt.__setitem__("grantor_real_world_authority_proven", True),
        lambda receipt: receipt.__setitem__("granted_scope", "ALL_SESSIONS"),
        lambda receipt: receipt.__setitem__("granted_capability", "ENABLE_REAL_NETWORK"),
        lambda receipt: receipt.__setitem__("granted_duration", "FOREVER"),
        lambda receipt: receipt.__setitem__("expiry_boundary", "NONE"),
        lambda receipt: receipt.__setitem__("revocation_mode", "IRREVOCABLE"),
        lambda receipt: receipt.__setitem__("revocation_handle", "0" * 64),
        lambda receipt: receipt.__setitem__("enablement_grant_created", False),
        lambda receipt: receipt.__setitem__("enablement_authority_granted", False),
        lambda receipt: receipt.__setitem__("enablement_materialization_required", False),
        lambda receipt: receipt.__setitem__("grant_is_action_permit", True),
        lambda receipt: receipt.__setitem__("grant_is_successor_permit", True),
        lambda receipt: receipt.__setitem__("grant_is_send_permit", True),
        lambda receipt: receipt.__setitem__("grant_is_bearer_credential", True),
        lambda receipt: receipt.__setitem__("source_enablement_externalization_review_receipt_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("enablement_challenge_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("activation_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("network_contract_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("grant_context_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("authority_effect", "CREATE_REAL_WORLD_AUTHORITY"),
        lambda receipt: receipt.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda receipt: receipt.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
        lambda receipt: receipt.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for field in grant.FALSE_EFFECTS:
        output_mutations.append(
            lambda receipt, key=field: receipt.__setitem__(key, True)
        )
    for mutation in output_mutations:
        reject_output(mutation)

    context_mutations = [
        lambda context: context.__setitem__("source_enablement_externalization_review_receipt_digest", "0" * 64),
        lambda context: context.__setitem__("human_decision_asserted", False),
        lambda context: context.__setitem__("human_decision", grant.NO_HUMAN_DECISION),
        lambda context: context.__setitem__("human_decision_evidence_ref", None),
        lambda context: context.__setitem__("grantor_claim", "SYSTEM_GRANTOR"),
        lambda context: context.__setitem__("granted_scope", "ALL_SESSIONS"),
        lambda context: context.__setitem__("granted_capability", "ENABLE_REAL_NETWORK"),
        lambda context: context.__setitem__("granted_duration", "FOREVER"),
        lambda context: context.__setitem__("expiry_boundary", "NONE"),
        lambda context: context.__setitem__("revocation_mode", "IRREVOCABLE"),
        lambda context: context.__setitem__("revocation_handle", "0" * 64),
        lambda context: context.__setitem__("challenge_scope", "ALL_SESSIONS"),
        lambda context: context.__setitem__("requested_capability", "ENABLE_REAL_NETWORK"),
        lambda context: context.__setitem__("activation_state_ref", "0" * 64),
        lambda context: context.__setitem__("revocation_requested", "yes"),
        lambda context: context.__setitem__("expiry_boundary_reached", "yes"),
        lambda context: (
            context.__setitem__("revocation_requested", True),
            context.__setitem__("expiry_boundary_reached", True),
        ),
        lambda context: context.__setitem__("authority_effect", "CREATE_REAL_WORLD_AUTHORITY"),
        lambda context: context.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda context: context.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
    ]
    for field in grant.FORBIDDEN_REQUESTS:
        context_mutations.append(
            lambda context, key=field: context.__setitem__(key, True)
        )
    for mutation in context_mutations:
        reject_context(mutation)

    def no_assertion_with_grant(context):
        context["human_decision_asserted"] = False

    reject_context(no_assertion_with_grant)

    def decision_without_assertion(context):
        context["human_decision_asserted"] = False
        context["human_decision"] = grant.GRANT_DECISION

    reject_context(decision_without_assertion)

    def lifecycle_on_denial(context):
        context["revocation_requested"] = True

    reject_context(lifecycle_on_denial, grant.DENY_DECISION)

    source_mutations = [
        lambda item: item.__setitem__("decision", "ENABLEMENT_REVIEW_INCOMPLETE"),
        lambda item: item.__setitem__("enablement_externalization_review_receipt_digest", "0" * 64),
        lambda item: item.__setitem__("human_enablement_grant_decision_required", False),
        lambda item: item.__setitem__("human_enablement_grant_decision_present", True),
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

    final = active_grants[-1]
    print(
        "network user-surface bounded enablement grant validation: PASS; "
        f"grants={len(active_grants)}; fail_closed_mutations={rejected_mutations}; "
        f"default_decision={defaults[-1]['decision']}; "
        "final_enablement_grant_receipt_digest="
        f"{final['enablement_grant_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
