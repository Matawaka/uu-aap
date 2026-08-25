#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GRANT = HERE / "grant.py"
REVIEW_VALIDATE = ROOT / "network-user-surface-externalization-review" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


grant = loadmod("network_user_surface_activation_grant", GRANT)
reviewval = loadmod("network_user_surface_activation_grant_review_validate", REVIEW_VALIDATE)


def complete_receipt(shadow_result):
    challenge = reviewval.ready_challenge(shadow_result)
    receipt = reviewval.review.review(copy.deepcopy(challenge), reviewval.complete_context(challenge))
    assert receipt["decision"] == "EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED"
    return receipt


def issued_context(receipt):
    ctx = grant.default_grant_context(receipt)
    ctx["grant_issuance_requested"] = True
    return ctx


def main():
    trace = json.loads(TRACE.read_text())
    records, _ = reviewval.challengeval.matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = reviewval.challengeval.matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    receipts = [complete_receipt(result) for result in records]

    defaults = [grant.grant(copy.deepcopy(receipt)) for receipt in receipts]
    for item in defaults:
        assert item["decision"] == "ACTIVATION_GRANT_NOT_ISSUED"
        assert item["activation_grant_historically_issued"] is False
        assert item["activation_grant_currently_active"] is False
        assert item["activation_authority_granted"] is False
        assert item["network_activation_authority_granted"] is False
        assert item["user_surface_activation_authority_granted"] is False
        assert item["network_enabled"] is False
        assert item["user_surface_enabled"] is False
        assert item["send_permit"] is False
        assert item["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"
        assert len(item["activation_grant_receipt_digest"]) == 64

    issued = []
    for receipt in receipts:
        item = grant.grant(copy.deepcopy(receipt), issued_context(receipt))
        issued.append(item)
        assert item["decision"] == "BOUNDED_ACTIVATION_GRANT_ISSUED"
        assert item["activation_grant_historically_issued"] is True
        assert item["activation_grant_currently_active"] is True
        assert item["activation_authority_granted"] is True
        assert item["network_activation_authority_granted"] is True
        assert item["user_surface_activation_authority_granted"] is True
        assert item["activation_scope_authorized_now"] is True
        assert item["activation_capability_authorized_now"] is True
        assert item["activation_materialization_required"] is True
        assert item["network_enablement_step_required"] is True
        assert item["user_surface_enablement_step_required"] is True
        assert item["send_permit_required_after_surface_activation"] is True
        assert item["synthetic_authority_only"] is True
        assert item["network_enabled"] is False
        assert item["user_surface_enabled"] is False
        assert item["live_runtime_enabled"] is False
        assert item["external_transport_bound"] is False
        assert item["send_permit"] is False
        assert item["transport_invoked"] is False
        assert item["authority_effect"] == "CREATE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY"
        assert item["action_effect"] == "NONE"
        assert item["successor_effect"] == "NONE"
        assert item["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"
        assert len(item["activation_grant_receipt_digest"]) == 64

    source_receipt = receipts[-1]
    revoked_ctx = issued_context(source_receipt)
    revoked_ctx["revocation_requested"] = True
    revoked = grant.grant(copy.deepcopy(source_receipt), revoked_ctx)
    assert revoked["decision"] == "ACTIVATION_GRANT_REVOKED"
    assert revoked["activation_grant_historically_issued"] is True
    assert revoked["activation_grant_currently_active"] is False
    assert revoked["activation_authority_granted"] is False
    assert revoked["activation_grant_revoked"] is True
    assert revoked["authority_effect"] == "REVOKE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY"
    assert revoked["network_enabled"] is False
    assert revoked["user_surface_enabled"] is False

    expired_ctx = issued_context(source_receipt)
    expired_ctx["expiry_boundary_reached"] = True
    expired = grant.grant(copy.deepcopy(source_receipt), expired_ctx)
    assert expired["decision"] == "ACTIVATION_GRANT_EXPIRED"
    assert expired["activation_grant_historically_issued"] is True
    assert expired["activation_grant_currently_active"] is False
    assert expired["activation_authority_granted"] is False
    assert expired["activation_grant_expired"] is True
    assert expired["authority_effect"] == "EXPIRE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY"

    challenge = reviewval.ready_challenge(records[-1])
    incomplete_receipt = reviewval.review.review(copy.deepcopy(challenge))
    assert incomplete_receipt["decision"] == "REVIEW_INCOMPLETE"
    not_applicable = grant.grant(copy.deepcopy(incomplete_receipt))
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["activation_authority_granted"] is False

    mutations = 0
    source = source_receipt

    def reject(mutate_output=None, mutate_context=None, mutate_receipt=None):
        nonlocal mutations
        receipt = copy.deepcopy(source)
        try:
            if mutate_receipt:
                mutate_receipt(receipt)
            ctx = issued_context(receipt)
            if mutate_context:
                mutate_context(ctx)
            out = grant.grant(copy.deepcopy(receipt), copy.deepcopy(ctx))
            if mutate_output:
                mutate_output(out)
                grant.validate_grant_receipt(receipt, ctx, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe network/user-surface activation grant mutation accepted")

    for item_receipt in receipts:
        source = item_receipt
        for field in grant.FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = source_receipt

    output_mutations = [
        lambda r: r.__setitem__("decision", "ACTIVATED"),
        lambda r: r.__setitem__("decision", "SEND_ALLOWED"),
        lambda r: r.__setitem__("activation_grant_receipt_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("grantor_claim", "REAL_NETWORK_OPERATOR"),
        lambda r: r.__setitem__("grantor_identity_proven", True),
        lambda r: r.__setitem__("grantor_real_world_authority_proven", True),
        lambda r: r.__setitem__("grant_authority_basis_ref", "short"),
        lambda r: r.__setitem__("granted_scope", "ALL_FUTURE_SESSIONS"),
        lambda r: r.__setitem__("granted_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("granted_duration", "FOREVER"),
        lambda r: r.__setitem__("expiry_boundary", "NONE"),
        lambda r: r.__setitem__("revocation_mode", "IRREVOCABLE"),
        lambda r: r.__setitem__("revocation_handle", "0" * 64),
        lambda r: r.__setitem__("activation_challenge_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("requested_capability", "LIVE_UNBOUNDED_DELIVERY"),
        lambda r: r.__setitem__("activation_grant_historically_issued", False),
        lambda r: r.__setitem__("activation_grant_currently_active", False),
        lambda r: r.__setitem__("activation_scope_authorized_now", False),
        lambda r: r.__setitem__("activation_capability_authorized_now", False),
        lambda r: r.__setitem__("activation_authority_granted", False),
        lambda r: r.__setitem__("network_activation_authority_granted", False),
        lambda r: r.__setitem__("user_surface_activation_authority_granted", False),
        lambda r: r.__setitem__("activation_materialization_required", False),
        lambda r: r.__setitem__("network_enablement_step_required", False),
        lambda r: r.__setitem__("user_surface_enablement_step_required", False),
        lambda r: r.__setitem__("send_permit_required_after_surface_activation", False),
        lambda r: r.__setitem__("synthetic_authority_only", False),
        lambda r: r.__setitem__("binding_object_digest", "0" * 64),
        lambda r: r.__setitem__("runtime_binding_ref", "0" * 64),
        lambda r: r.__setitem__("transport_binding_ref", "0" * 64),
        lambda r: r.__setitem__("endpoint_binding_ref", "0" * 64),
        lambda r: r.__setitem__("network_contract_ref", "0" * 64),
        lambda r: r.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda r: r.__setitem__("rollback_contract_ref", "0" * 64),
        lambda r: r.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda r: r.__setitem__("source_externalization_review_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("grant_context_digest", "0" * 64),
        lambda r: r.__setitem__("authority_effect", "CREATE_LIVE_NETWORK"),
        lambda r: r.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda r: r.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_externalization_review_receipt_digest", "0" * 64),
        lambda c: c.__setitem__("grantor_claim", "REAL_GRANTOR"),
        lambda c: c.__setitem__("grant_authority_basis_ref", "short"),
        lambda c: c.__setitem__("granted_scope", "ALL_FUTURE_SESSIONS"),
        lambda c: c.__setitem__("granted_capability", "BACKGROUND_MESSAGING"),
        lambda c: c.__setitem__("granted_duration", "FOREVER"),
        lambda c: c.__setitem__("expiry_boundary", "NONE"),
        lambda c: c.__setitem__("revocation_mode", "IRREVOCABLE"),
        lambda c: c.__setitem__("revocation_handle", "0" * 64),
        lambda c: c.__setitem__("activation_challenge_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("requested_capability", "LIVE_UNBOUNDED_DELIVERY"),
        lambda c: c.__setitem__("binding_object_digest", "0" * 64),
        lambda c: c.__setitem__("runtime_binding_ref", "0" * 64),
        lambda c: c.__setitem__("transport_binding_ref", "0" * 64),
        lambda c: c.__setitem__("endpoint_binding_ref", "0" * 64),
        lambda c: c.__setitem__("network_contract_ref", "0" * 64),
        lambda c: c.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda c: c.__setitem__("rollback_contract_ref", "0" * 64),
        lambda c: c.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
        lambda c: c.__setitem__("action_effect", "CREATE"),
    ]
    for field in grant.FORBIDDEN_REQUESTS:
        context_mutations.append(lambda c, f=field: c.__setitem__(f, True))
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    receipt_mutations = [
        lambda r: r.__setitem__("decision", "AUTHORIZED"),
        lambda r: r.__setitem__("externalization_sufficiency_confirmed", False),
        lambda r: r.__setitem__("separate_activation_step_required", False),
        lambda r: r.__setitem__("network_contract_sufficient_for_activation", False),
        lambda r: r.__setitem__("user_surface_contract_sufficient_for_activation", False),
        lambda r: r.__setitem__("binding_freshness_valid_for_activation", False),
        lambda r: r.__setitem__("network_activation_authorized", True),
        lambda r: r.__setitem__("user_surface_activation_authorized", True),
        lambda r: r.__setitem__("network_enabled", True),
        lambda r: r.__setitem__("user_surface_enabled", True),
        lambda r: r.__setitem__("send_permit", True),
        lambda r: r.__setitem__("externalization_review_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("network_contract_ref", "short"),
        lambda r: r.__setitem__("user_surface_contract_ref", "short"),
        lambda r: r.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in receipt_mutations:
        reject(mutate_receipt=mutation)

    for field in ("revocation_requested", "expiry_boundary_reached"):
        try:
            ctx = grant.default_grant_context(source_receipt)
            ctx[field] = True
            grant.grant(copy.deepcopy(source_receipt), ctx)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
        else:
            raise AssertionError(f"activation grant lifecycle accepted before issuance: {field}")

    final = issued[-1]
    print(
        "network user-surface activation grant validation: PASS; "
        f"grants={len(issued)}; fail_closed_mutations={mutations}; "
        f"final_activation_grant_receipt_digest={final['activation_grant_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
