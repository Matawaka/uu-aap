#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MATERIALIZE = HERE / "materialize.py"
GRANT_VALIDATE = ROOT / "network-user-surface-activation-grant" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


materialize = loadmod("network_user_surface_activation_materialization", MATERIALIZE)
grantval = loadmod("network_user_surface_activation_materialization_grant_validate", GRANT_VALIDATE)
grant = grantval.grant


def active_grant(shadow_result):
    review_receipt = grantval.complete_receipt(shadow_result)
    item = grant.grant(copy.deepcopy(review_receipt), grantval.issued_context(review_receipt))
    assert item["decision"] == "BOUNDED_ACTIVATION_GRANT_ISSUED"
    return review_receipt, item


def ready_context(item):
    ctx = materialize.default_materialization_context(item)
    ctx["materialization_requested"] = True
    ctx["grant_lifecycle_rechecked"] = True
    ctx["grant_not_revoked_confirmed"] = True
    ctx["grant_not_expired_confirmed"] = True
    ctx["reviewed_binding_current_confirmed"] = True
    return ctx


def main():
    trace = json.loads(TRACE.read_text())
    records, _ = grantval.reviewval.challengeval.matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = grantval.reviewval.challengeval.matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    pairs = [active_grant(result) for result in records]
    review_receipts = [pair[0] for pair in pairs]
    grants = [pair[1] for pair in pairs]

    defaults = [materialize.materialize(copy.deepcopy(item)) for item in grants]
    for receipt in defaults:
        assert receipt["decision"] == "ACTIVATION_NOT_MATERIALIZED"
        assert receipt["activation_authority_granted"] is True
        assert receipt["activation_authority_used_for_materialization"] is False
        assert receipt["activation_state_artifact_created"] is False
        assert receipt["activation_state_ref"] is None
        assert receipt["network_activation_state_ref"] is None
        assert receipt["user_surface_activation_state_ref"] is None
        assert receipt["activation_state_digest"] is None
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["send_permit"] is False
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"

    materialized = []
    for item in grants:
        receipt = materialize.materialize(copy.deepcopy(item), ready_context(item))
        materialized.append(receipt)
        assert receipt["decision"] == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
        assert receipt["activation_authority_granted"] is True
        assert receipt["activation_authority_used_for_materialization"] is True
        assert receipt["activation_grant_consumed"] is False
        assert receipt["activation_state_artifact_created"] is True
        assert receipt["network_activation_state_materialized"] is True
        assert receipt["user_surface_activation_state_materialized"] is True
        assert receipt["activation_state_local_only"] is True
        assert receipt["activation_state_reversible"] is True
        assert receipt["activation_state_is_enablement"] is False
        assert len(receipt["activation_state_ref"]) == 64
        assert len(receipt["network_activation_state_ref"]) == 64
        assert len(receipt["user_surface_activation_state_ref"]) == 64
        assert len(receipt["activation_state_digest"]) == 64
        assert receipt["network_enablement_required_after_materialization"] is True
        assert receipt["user_surface_enablement_required_after_materialization"] is True
        assert receipt["send_permit_required_after_surface_enablement"] is True
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["external_transport_bound"] is False
        assert receipt["live_runtime_enabled"] is False
        assert receipt["send_permit"] is False
        assert receipt["transport_invoked"] is False
        assert receipt["activation_effect"] == "CREATE_LOCAL_SYNTHETIC_ACTIVATION_STATE_ARTIFACT"
        assert receipt["authority_effect"] == "NONE"
        assert receipt["action_effect"] == "NONE"
        assert receipt["successor_effect"] == "NONE"
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
        assert len(receipt["activation_materialization_receipt_digest"]) == 64

    source = grants[-1]
    ctx = materialize.default_materialization_context(source)
    ctx["materialization_requested"] = True
    lifecycle = materialize.materialize(copy.deepcopy(source), ctx)
    assert lifecycle["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert lifecycle["activation_state_artifact_created"] is False

    partial = materialize.default_materialization_context(source)
    partial["materialization_requested"] = True
    partial["grant_lifecycle_rechecked"] = True
    partial["grant_not_revoked_confirmed"] = True
    partial["grant_not_expired_confirmed"] = True
    result = materialize.materialize(copy.deepcopy(source), partial)
    assert result["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert result["reviewed_binding_current_confirmed"] is False

    # Revoked and expired grants preserve historical issuance but cannot materialize activation state.
    source_review = review_receipts[-1]
    revoked_ctx = grantval.issued_context(source_review)
    revoked_ctx["revocation_requested"] = True
    revoked = grant.grant(copy.deepcopy(source_review), revoked_ctx)
    assert revoked["decision"] == "ACTIVATION_GRANT_REVOKED"
    revoked_default = materialize.materialize(copy.deepcopy(revoked))
    assert revoked_default["decision"] == "NOT_APPLICABLE"
    assert revoked_default["activation_state_artifact_created"] is False

    expired_ctx = grantval.issued_context(source_review)
    expired_ctx["expiry_boundary_reached"] = True
    expired = grant.grant(copy.deepcopy(source_review), expired_ctx)
    assert expired["decision"] == "ACTIVATION_GRANT_EXPIRED"
    expired_default = materialize.materialize(copy.deepcopy(expired))
    assert expired_default["decision"] == "NOT_APPLICABLE"
    assert expired_default["activation_state_artifact_created"] is False

    for inactive in (revoked, expired):
        try:
            bad = materialize.default_materialization_context(inactive)
            bad["materialization_requested"] = True
            materialize.materialize(copy.deepcopy(inactive), bad)
        except (ValueError, AssertionError, KeyError, TypeError):
            pass
        else:
            raise AssertionError("inactive activation grant accepted materialization request")

    mutations = 2
    source = grants[-1]

    def reject(mutate_output=None, mutate_context=None, mutate_source=None):
        nonlocal mutations
        item = copy.deepcopy(source)
        try:
            if mutate_source:
                mutate_source(item)
            ctx2 = ready_context(item)
            if mutate_context:
                mutate_context(ctx2)
            out = materialize.materialize(copy.deepcopy(item), copy.deepcopy(ctx2))
            if mutate_output:
                mutate_output(out)
                materialize.validate_materialization_receipt(item, ctx2, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe network/user-surface activation materialization mutation accepted")

    for item in grants:
        source = item
        for field in materialize.EXTERNAL_FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = grants[-1]

    output_mutations = [
        lambda r: r.__setitem__("decision", "NETWORK_ENABLED"),
        lambda r: r.__setitem__("decision", "SEND_ALLOWED"),
        lambda r: r.__setitem__("activation_materialization_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("materialization_mode", "LIVE_NETWORK_ACTIVATION"),
        lambda r: r.__setitem__("activation_state_class", "REAL_NETWORK_STATE"),
        lambda r: r.__setitem__("network_state_class", "LIVE_SOCKET"),
        lambda r: r.__setitem__("user_surface_state_class", "REAL_USER_SURFACE"),
        lambda r: r.__setitem__("activation_authority_granted", False),
        lambda r: r.__setitem__("activation_authority_used_for_materialization", False),
        lambda r: r.__setitem__("activation_grant_consumed", True),
        lambda r: r.__setitem__("activation_state_ref", "0" * 64),
        lambda r: r.__setitem__("network_activation_state_ref", "0" * 64),
        lambda r: r.__setitem__("user_surface_activation_state_ref", "0" * 64),
        lambda r: r.__setitem__("activation_state_digest", "0" * 64),
        lambda r: r.__setitem__("activation_state_artifact_created", False),
        lambda r: r.__setitem__("network_activation_state_materialized", False),
        lambda r: r.__setitem__("user_surface_activation_state_materialized", False),
        lambda r: r.__setitem__("activation_state_local_only", False),
        lambda r: r.__setitem__("activation_state_reversible", False),
        lambda r: r.__setitem__("activation_state_is_enablement", True),
        lambda r: r.__setitem__("network_enablement_required_after_materialization", False),
        lambda r: r.__setitem__("user_surface_enablement_required_after_materialization", False),
        lambda r: r.__setitem__("send_permit_required_after_surface_enablement", False),
        lambda r: r.__setitem__("binding_object_digest", "0" * 64),
        lambda r: r.__setitem__("network_contract_ref", "0" * 64),
        lambda r: r.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda r: r.__setitem__("rollback_contract_ref", "0" * 64),
        lambda r: r.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda r: r.__setitem__("grant_authority_basis_ref", "0" * 64),
        lambda r: r.__setitem__("granted_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("granted_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("granted_duration", "FOREVER"),
        lambda r: r.__setitem__("revocation_handle", "0" * 64),
        lambda r: r.__setitem__("source_activation_grant_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("materialization_context_digest", "0" * 64),
        lambda r: r.__setitem__("activation_effect", "ENABLE_NETWORK"),
        lambda r: r.__setitem__("authority_effect", "CREATE"),
        lambda r: r.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda r: r.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_activation_grant_receipt_digest", "0" * 64),
        lambda c: c.__setitem__("materialization_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("materialization_mode", "LIVE_NETWORK_ACTIVATION"),
        lambda c: c.__setitem__("activation_state_class", "REAL_NETWORK_STATE"),
        lambda c: c.__setitem__("network_state_class", "LIVE_SOCKET"),
        lambda c: c.__setitem__("user_surface_state_class", "REAL_USER_SURFACE"),
        lambda c: c.__setitem__("binding_object_digest", "0" * 64),
        lambda c: c.__setitem__("runtime_binding_ref", "0" * 64),
        lambda c: c.__setitem__("transport_binding_ref", "0" * 64),
        lambda c: c.__setitem__("endpoint_binding_ref", "0" * 64),
        lambda c: c.__setitem__("network_contract_ref", "0" * 64),
        lambda c: c.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda c: c.__setitem__("rollback_contract_ref", "0" * 64),
        lambda c: c.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda c: c.__setitem__("grant_lifecycle_rechecked", "yes"),
        lambda c: c.__setitem__("grant_not_revoked_confirmed", "yes"),
        lambda c: c.__setitem__("grant_not_expired_confirmed", "yes"),
        lambda c: c.__setitem__("reviewed_binding_current_confirmed", "yes"),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
        lambda c: c.__setitem__("action_effect", "CREATE"),
    ]
    for field in materialize.FORBIDDEN_REQUESTS:
        context_mutations.append(lambda c, f=field: c.__setitem__(f, True))
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    source_mutations = [
        lambda s: s.__setitem__("decision", "ACTIVATION_GRANT_REVOKED"),
        lambda s: s.__setitem__("activation_grant_currently_active", False),
        lambda s: s.__setitem__("activation_authority_granted", False),
        lambda s: s.__setitem__("network_activation_authority_granted", False),
        lambda s: s.__setitem__("user_surface_activation_authority_granted", False),
        lambda s: s.__setitem__("activation_materialization_required", False),
        lambda s: s.__setitem__("network_enabled", True),
        lambda s: s.__setitem__("user_surface_enabled", True),
        lambda s: s.__setitem__("send_permit", True),
        lambda s: s.__setitem__("binding_object_digest", "0" * 64),
        lambda s: s.__setitem__("network_contract_ref", "0" * 64),
        lambda s: s.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda s: s.__setitem__("activation_grant_receipt_digest", "0" * 64),
        lambda s: s.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in source_mutations:
        reject(mutate_source=mutation)

    final = materialized[-1]
    print(
        "network user-surface activation materialization validation: PASS; "
        f"materializations={len(materialized)}; fail_closed_mutations={mutations}; "
        f"final_activation_materialization_receipt_digest={final['activation_materialization_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
