#!/usr/bin/env python3
import copy
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MATERIALIZE = HERE / "materialize.py"
UPSTREAM_VALIDATE = ROOT / "network-user-surface-enablement-grant" / "validate.py"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


materialize = loadmod("network_user_surface_enablement_materialization", MATERIALIZE)
upstream = loadmod(
    "network_user_surface_enablement_materialization_upstream_validate",
    UPSTREAM_VALIDATE,
)


def active_grants():
    _, reviews = upstream.complete_reviews()
    _, reviews2 = upstream.complete_reviews()
    assert reviews == reviews2
    assert len(reviews) == 7
    receipts = [
        materialize.grant.grant(
            copy.deepcopy(item),
            upstream.human_decision_context(item, materialize.grant.GRANT_DECISION),
        )
        for item in reviews
    ]
    receipts2 = [
        materialize.grant.grant(
            copy.deepcopy(item),
            upstream.human_decision_context(item, materialize.grant.GRANT_DECISION),
        )
        for item in reviews
    ]
    assert receipts == receipts2
    for receipt in receipts:
        assert receipt["decision"] == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
        materialize.validate_enablement_grant(receipt)
    return reviews, receipts


def ready_context(item):
    context = materialize.default_materialization_context(item)
    context["materialization_requested"] = True
    for field in materialize.LIFECYCLE_FIELDS:
        context[field] = True
    return context


def main():
    reviews, grants = active_grants()

    defaults = [materialize.materialize(copy.deepcopy(item)) for item in grants]
    defaults2 = [materialize.materialize(copy.deepcopy(item)) for item in grants]
    assert defaults == defaults2
    for receipt in defaults:
        assert receipt["decision"] == "ENABLEMENT_NOT_MATERIALIZED"
        assert receipt["enablement_state_artifact_created"] is False
        assert receipt["enablement_state_ref"] is None
        assert receipt["enablement_materialized"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["send_permit"] is False

    states = []
    for item in grants:
        context = ready_context(item)
        receipt = materialize.materialize(copy.deepcopy(item), context)
        states.append(receipt)
        assert receipt["decision"] == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
        assert receipt["enablement_state_artifact_created"] is True
        assert receipt["network_enablement_state_materialized"] is True
        assert receipt["user_surface_enablement_state_materialized"] is True
        assert receipt["enablement_state_local_only"] is True
        assert receipt["enablement_state_reversible"] is True
        assert receipt["enablement_state_is_external_enablement"] is False
        assert receipt["local_trial_pilot_available"] is True
        assert receipt["external_enablement_boundary_required"] is True
        assert receipt["send_permit_required_after_external_enablement"] is True
        assert receipt["enablement_grant_consumed"] is False
        assert len(receipt["enablement_state_ref"]) == 64
        assert len(receipt["network_enablement_state_ref"]) == 64
        assert len(receipt["user_surface_enablement_state_ref"]) == 64
        assert len(receipt["enablement_state_digest"]) == 64
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["network_connection_created"] is False
        assert receipt["user_surface_exposure_created"] is False
        assert receipt["external_transport_bound"] is False
        assert receipt["send_permit"] is False
        assert receipt["transport_invoked"] is False
        assert receipt["delivery_attempted"] is False
        assert receipt["copyright_process_modified"] is False
        assert receipt["license_or_notice_modified"] is False
        assert receipt["legal_author_identity_modified"] is False
        assert receipt["pseudonym_publication_process_modified"] is False
        assert receipt["authority_effect"] == "NONE"
        assert receipt["action_effect"] == "NONE"
        assert receipt["successor_effect"] == "NONE"
        assert receipt["materialization_effect"] == "CREATE_LOCAL_SYNTHETIC_ENABLEMENT_STATE_ARTIFACT"
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_ONLY_NOT_EXTERNAL"
        assert len(receipt["enablement_materialization_receipt_digest"]) == 64
        materialize.validate_materialization_receipt(item, context, receipt)

    partial_context = materialize.default_materialization_context(grants[-1])
    partial_context["materialization_requested"] = True
    partial = materialize.materialize(copy.deepcopy(grants[-1]), partial_context)
    assert partial["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert partial["enablement_state_artifact_created"] is False
    partial_context["grant_lifecycle_rechecked"] = True
    partial_context["grant_still_active_confirmed"] = True
    partial_context["grant_not_revoked_confirmed"] = True
    partial_context["grant_not_expired_confirmed"] = True
    partial_context["reviewed_evidence_current_confirmed"] = True
    partial = materialize.materialize(copy.deepcopy(grants[-1]), partial_context)
    assert partial["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert partial["human_decision_evidence_current_confirmed"] is False

    revoked_context = upstream.human_decision_context(reviews[-1], materialize.grant.GRANT_DECISION)
    revoked_context["revocation_requested"] = True
    revoked_grant = materialize.grant.grant(copy.deepcopy(reviews[-1]), revoked_context)
    assert revoked_grant["decision"] == "ENABLEMENT_GRANT_REVOKED"
    revoked_result = materialize.materialize(copy.deepcopy(revoked_grant))
    assert revoked_result["decision"] == "NOT_APPLICABLE"

    expired_context = upstream.human_decision_context(reviews[-1], materialize.grant.GRANT_DECISION)
    expired_context["expiry_boundary_reached"] = True
    expired_grant = materialize.grant.grant(copy.deepcopy(reviews[-1]), expired_context)
    assert expired_grant["decision"] == "ENABLEMENT_GRANT_EXPIRED"
    expired_result = materialize.materialize(copy.deepcopy(expired_grant))
    assert expired_result["decision"] == "NOT_APPLICABLE"

    rejected_mutations = 0

    def reject_output(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(grants[-1])
        context = ready_context(item)
        output = materialize.materialize(copy.deepcopy(item), copy.deepcopy(context))
        try:
            mutate(output)
            materialize.validate_materialization_receipt(item, context, output)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement materialization output mutation accepted")

    def reject_context(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(grants[-1])
        context = ready_context(item)
        try:
            mutate(context)
            materialize.materialize(copy.deepcopy(item), context)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement materialization context mutation accepted")

    def reject_source(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(grants[-1])
        try:
            mutate(item)
            materialize.materialize(item)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe enablement materialization source mutation accepted")

    output_mutations = [
        lambda receipt: receipt.__setitem__("decision", "NETWORK_ENABLED"),
        lambda receipt: receipt.__setitem__("enablement_materialization_scope", "ALL_GRANTS"),
        lambda receipt: receipt.__setitem__("materialization_mode", "LIVE_EXTERNAL_ENABLEMENT"),
        lambda receipt: receipt.__setitem__("enablement_state_class", "REAL_ENABLEMENT_STATE"),
        lambda receipt: receipt.__setitem__("enablement_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("network_enablement_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("user_surface_enablement_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("enablement_state_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("enablement_state_artifact_created", False),
        lambda receipt: receipt.__setitem__("enablement_state_local_only", False),
        lambda receipt: receipt.__setitem__("enablement_state_reversible", False),
        lambda receipt: receipt.__setitem__("enablement_state_is_external_enablement", True),
        lambda receipt: receipt.__setitem__("enablement_grant_consumed", True),
        lambda receipt: receipt.__setitem__("source_enablement_grant_receipt_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("human_decision_evidence_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("activation_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("network_contract_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("materialization_context_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("materialization_effect", "ENABLE_NETWORK"),
        lambda receipt: receipt.__setitem__("authority_effect", "CREATE_REAL_WORLD_AUTHORITY"),
        lambda receipt: receipt.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda receipt: receipt.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
        lambda receipt: receipt.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for field in materialize.EXTERNAL_FALSE_EFFECTS:
        output_mutations.append(
            lambda receipt, key=field: receipt.__setitem__(key, True)
        )
    for mutation in output_mutations:
        reject_output(mutation)

    context_mutations = [
        lambda context: context.__setitem__("source_enablement_grant_receipt_digest", "0" * 64),
        lambda context: context.__setitem__("materialization_scope", "ALL_GRANTS"),
        lambda context: context.__setitem__("materialization_mode", "LIVE_EXTERNAL_ENABLEMENT"),
        lambda context: context.__setitem__("enablement_state_class", "REAL_ENABLEMENT_STATE"),
        lambda context: context.__setitem__("human_decision_evidence_ref", "0" * 64),
        lambda context: context.__setitem__("activation_state_ref", "0" * 64),
        lambda context: context.__setitem__("granted_scope", "ALL_SESSIONS"),
        lambda context: context.__setitem__("granted_capability", "ENABLE_REAL_NETWORK"),
        lambda context: context.__setitem__("grant_lifecycle_rechecked", "yes"),
        lambda context: context.__setitem__("grant_still_active_confirmed", "yes"),
        lambda context: context.__setitem__("authority_effect", "CREATE_REAL_WORLD_AUTHORITY"),
        lambda context: context.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda context: context.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
    ]
    for field in materialize.FORBIDDEN_REQUESTS:
        context_mutations.append(
            lambda context, key=field: context.__setitem__(key, True)
        )
    for mutation in context_mutations:
        reject_context(mutation)

    source_mutations = [
        lambda item: item.__setitem__("decision", "ENABLEMENT_GRANT_REVOKED"),
        lambda item: item.__setitem__("enablement_grant_receipt_digest", "0" * 64),
        lambda item: item.__setitem__("enablement_grant_currently_active", False),
        lambda item: item.__setitem__("enablement_authority_granted", False),
        lambda item: item.__setitem__("human_decision_evidence_ref", "0" * 64),
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

    final = states[-1]
    print(
        "network user-surface local synthetic enablement materialization validation: PASS; "
        f"states={len(states)}; fail_closed_mutations={rejected_mutations}; "
        "final_enablement_materialization_receipt_digest="
        f"{final['enablement_materialization_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
