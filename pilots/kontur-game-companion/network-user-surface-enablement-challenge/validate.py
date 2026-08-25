#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHALLENGE = HERE / "challenge.py"
UPSTREAM_VALIDATE = ROOT / "network-user-surface-activation-materialization" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


challenge = loadmod("network_user_surface_enablement_challenge", CHALLENGE)
matval = loadmod("network_user_surface_enablement_challenge_upstream_validate", UPSTREAM_VALIDATE)


def active_activation_states():
    trace = json.loads(TRACE.read_text())
    records, _ = (
        matval.grantval.reviewval.challengeval.matval.grantval.reviewval.bindval
        .grantval.reviewval.actval.derive(copy.deepcopy(trace))
    )
    records2, _ = (
        matval.grantval.reviewval.challengeval.matval.grantval.reviewval.bindval
        .grantval.reviewval.actval.derive(copy.deepcopy(trace))
    )
    assert records == records2
    assert len(records) == 7
    grants = [matval.active_grant(result)[1] for result in records]
    states = [
        matval.materialize.materialize(copy.deepcopy(item), matval.ready_context(item))
        for item in grants
    ]
    for state in states:
        assert state["decision"] == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
        challenge.validate_activation_state(state)
    return grants, states


def ready_context(item):
    context = challenge.default_challenge_context(item)
    context["challenge_requested"] = True
    for field in challenge.LIFECYCLE_FIELDS:
        context[field] = True
    return context


def main():
    grants, states = active_activation_states()

    defaults = [challenge.enablement_challenge(copy.deepcopy(item)) for item in states]
    defaults2 = [challenge.enablement_challenge(copy.deepcopy(item)) for item in states]
    assert defaults == defaults2
    for receipt in defaults:
        assert receipt["decision"] == "ENABLEMENT_CHALLENGE_NOT_CREATED"
        assert receipt["enablement_challenge_created"] is False
        assert receipt["enablement_challenge_ref"] is None
        assert receipt["enablement_authority_granted"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["send_permit"] is False
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"

    created = []
    for item in states:
        receipt = challenge.enablement_challenge(copy.deepcopy(item), ready_context(item))
        created.append(receipt)
        assert receipt["decision"] == "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
        assert receipt["enablement_challenge_created"] is True
        assert len(receipt["enablement_challenge_ref"]) == 64
        assert receipt["separate_externalization_review_required"] is True
        assert receipt["separate_enablement_grant_required"] is True
        assert receipt["separate_enablement_materialization_required"] is True
        assert receipt["separate_send_permit_required"] is True
        assert receipt["challenge_is_enablement_authority"] is False
        assert receipt["challenge_is_enablement"] is False
        assert receipt["challenge_is_send_permit"] is False
        assert receipt["challenge_is_bearer_credential"] is False
        assert receipt["enablement_review_completed"] is False
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
        assert receipt["challenge_effect"] == "CREATE_LOCAL_SYNTHETIC_ENABLEMENT_CHALLENGE_ARTIFACT"
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
        assert len(receipt["enablement_challenge_receipt_digest"]) == 64

    source = states[-1]
    partial_context = challenge.default_challenge_context(source)
    partial_context["challenge_requested"] = True
    result = challenge.enablement_challenge(copy.deepcopy(source), partial_context)
    assert result["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert result["enablement_challenge_created"] is False

    partial_context["activation_state_lifecycle_rechecked"] = True
    partial_context["activation_state_still_local_confirmed"] = True
    partial_context["activation_state_not_rolled_back_confirmed"] = True
    result = challenge.enablement_challenge(copy.deepcopy(source), partial_context)
    assert result["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert result["reviewed_binding_current_confirmed"] is False

    inactive = matval.materialize.materialize(copy.deepcopy(grants[-1]))
    challenge.validate_activation_state(inactive)
    not_applicable = challenge.enablement_challenge(copy.deepcopy(inactive))
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["enablement_challenge_created"] is False

    rejected = 0

    def reject(mutate_output=None, mutate_context=None, mutate_source=None):
        nonlocal rejected
        item = copy.deepcopy(source)
        try:
            if mutate_source:
                mutate_source(item)
            context = ready_context(item)
            if mutate_context:
                mutate_context(context)
            output = challenge.enablement_challenge(copy.deepcopy(item), copy.deepcopy(context))
            if mutate_output:
                mutate_output(output)
                challenge.validate_enablement_challenge_receipt(item, context, output)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected += 1
            return
        raise AssertionError("unsafe enablement challenge mutation accepted")

    for item in states:
        source = item
        for field in challenge.FALSE_EFFECTS:
            reject(mutate_output=lambda receipt, key=field: receipt.__setitem__(key, True))
    source = states[-1]

    output_mutations = [
        lambda receipt: receipt.__setitem__("decision", "NETWORK_ENABLED"),
        lambda receipt: receipt.__setitem__("challenge_scope", "ALL_SESSIONS"),
        lambda receipt: receipt.__setitem__("requested_capability", "ENABLE_NETWORK"),
        lambda receipt: receipt.__setitem__("requested_duration", "FOREVER"),
        lambda receipt: receipt.__setitem__("review_boundary", "REVIEW_COMPLETE"),
        lambda receipt: receipt.__setitem__("grant_boundary", "GRANT_ISSUED"),
        lambda receipt: receipt.__setitem__("materialization_boundary", "ENABLEMENT_MATERIALIZED"),
        lambda receipt: receipt.__setitem__("send_boundary", "SEND_ALLOWED"),
        lambda receipt: receipt.__setitem__("enablement_challenge_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("enablement_challenge_created", False),
        lambda receipt: receipt.__setitem__("separate_externalization_review_required", False),
        lambda receipt: receipt.__setitem__("separate_enablement_grant_required", False),
        lambda receipt: receipt.__setitem__("separate_enablement_materialization_required", False),
        lambda receipt: receipt.__setitem__("separate_send_permit_required", False),
        lambda receipt: receipt.__setitem__("challenge_is_enablement_authority", True),
        lambda receipt: receipt.__setitem__("challenge_is_enablement", True),
        lambda receipt: receipt.__setitem__("challenge_is_send_permit", True),
        lambda receipt: receipt.__setitem__("challenge_is_bearer_credential", True),
        lambda receipt: receipt.__setitem__("source_activation_materialization_receipt_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("activation_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("network_activation_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("user_surface_activation_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("activation_state_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("challenge_context_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("challenge_effect", "ENABLE_NETWORK"),
        lambda receipt: receipt.__setitem__("authority_effect", "CREATE"),
        lambda receipt: receipt.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda receipt: receipt.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
        lambda receipt: receipt.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda context: context.__setitem__("source_activation_materialization_receipt_digest", "0" * 64),
        lambda context: context.__setitem__("challenge_scope", "ALL_SESSIONS"),
        lambda context: context.__setitem__("requested_capability", "ENABLE_NETWORK"),
        lambda context: context.__setitem__("requested_duration", "FOREVER"),
        lambda context: context.__setitem__("activation_state_ref", "0" * 64),
        lambda context: context.__setitem__("network_activation_state_ref", "0" * 64),
        lambda context: context.__setitem__("user_surface_activation_state_ref", "0" * 64),
        lambda context: context.__setitem__("activation_state_digest", "0" * 64),
        lambda context: context.__setitem__("activation_state_lifecycle_rechecked", "yes"),
        lambda context: context.__setitem__("activation_state_still_local_confirmed", "yes"),
        lambda context: context.__setitem__("activation_state_not_rolled_back_confirmed", "yes"),
        lambda context: context.__setitem__("reviewed_binding_current_confirmed", "yes"),
        lambda context: context.__setitem__("authority_effect", "CREATE"),
        lambda context: context.__setitem__("action_effect", "CREATE"),
        lambda context: context.__setitem__("successor_effect", "CREATE"),
    ]
    for field in challenge.FORBIDDEN_REQUESTS:
        context_mutations.append(
            lambda context, key=field: context.__setitem__(key, True)
        )
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    source_mutations = [
        lambda item: item.__setitem__("decision", "ACTIVATION_NOT_MATERIALIZED"),
        lambda item: item.__setitem__("activation_materialization_receipt_digest", "0" * 64),
        lambda item: item.__setitem__("activation_state_ref", "0" * 64),
        lambda item: item.__setitem__("network_activation_state_ref", "0" * 64),
        lambda item: item.__setitem__("user_surface_activation_state_ref", "0" * 64),
        lambda item: item.__setitem__("activation_state_digest", "0" * 64),
        lambda item: item.__setitem__("activation_state_is_enablement", True),
        lambda item: item.__setitem__("activation_state_local_only", False),
        lambda item: item.__setitem__("activation_state_reversible", False),
        lambda item: item.__setitem__("network_enabled", True),
        lambda item: item.__setitem__("user_surface_enabled", True),
        lambda item: item.__setitem__("send_permit", True),
        lambda item: item.__setitem__("external_effect_authorized", True),
        lambda item: item.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in source_mutations:
        reject(mutate_source=mutation)

    final = created[-1]
    print(
        "network user-surface enablement challenge validation: PASS; "
        f"challenges={len(created)}; fail_closed_mutations={rejected}; "
        f"final_enablement_challenge_receipt_digest={final['enablement_challenge_receipt_digest']}"
    )


if __name__ == "__main__":
    main()


