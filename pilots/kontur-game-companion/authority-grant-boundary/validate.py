#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GRANT = HERE / "grant.py"
REVIEW_VALIDATE = ROOT / "authority-review-receipt" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"

def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

grant = loadmod("authority_grant_boundary", GRANT)
reviewval = loadmod("authority_grant_review_validate", REVIEW_VALIDATE)
review = reviewval.review

def complete_receipt(shadow_result):
    item = reviewval.ready_challenge(shadow_result)
    ctx = reviewval.complete_context(item)
    receipt = review.review(copy.deepcopy(item), ctx)
    assert receipt["decision"] == "REVIEW_COMPLETE_GRANT_REQUIRED"
    return receipt

def issued_context(receipt):
    ctx = grant.default_grant_context(receipt)
    ctx["grant_issuance_requested"] = True
    return ctx

def main():
    trace = json.loads(TRACE.read_text())
    records, _ = reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    receipts = [complete_receipt(result) for result in records]
    defaults = [grant.grant(copy.deepcopy(receipt)) for receipt in receipts]
    for item in defaults:
        assert item["decision"] == "GRANT_NOT_ISSUED"
        assert item["grant_historically_issued"] is False
        assert item["externalization_authority_granted"] is False
        assert item["send_permit"] is False
        assert item["live_runtime_enabled"] is False

    issued = []
    for receipt in receipts:
        ctx = issued_context(receipt)
        item = grant.grant(copy.deepcopy(receipt), ctx)
        issued.append(item)
        assert item["decision"] == "BOUNDED_GRANT_ISSUED"
        assert item["grant_historically_issued"] is True
        assert item["grant_currently_active"] is True
        assert item["scope_authorized_now"] is True
        assert item["capability_authorized_now"] is True
        assert item["externalization_authority_granted"] is True
        assert item["grant_receipt_created"] is True
        assert item["grant_token_created"] is False
        assert item["bearer_credential_created"] is False
        assert item["transport_binding_required"] is True
        assert item["runtime_activation_required"] is True
        assert item["send_permit_required"] is True
        assert item["send_permit"] is False
        assert item["external_transport_bound"] is False
        assert item["live_runtime_enabled"] is False
        assert item["runtime_connectedness"] == "SHADOW_ONLY_NOT_LIVE"
        assert len(item["authority_grant_receipt_digest"]) == 64

    source = receipts[-1]
    revoked_ctx = issued_context(source)
    revoked_ctx["revocation_requested"] = True
    revoked = grant.grant(copy.deepcopy(source), revoked_ctx)
    assert revoked["decision"] == "GRANT_REVOKED"
    assert revoked["grant_historically_issued"] is True
    assert revoked["grant_currently_active"] is False
    assert revoked["grant_revoked"] is True
    assert revoked["externalization_authority_granted"] is False
    assert revoked["scope_authorized_now"] is False
    assert revoked["send_permit"] is False
    assert revoked["authority_effect"] == "REVOKE_BOUNDED_EXTERNALIZATION_AUTHORITY"

    expired_ctx = issued_context(source)
    expired_ctx["expiry_boundary_reached"] = True
    expired = grant.grant(copy.deepcopy(source), expired_ctx)
    assert expired["decision"] == "GRANT_EXPIRED"
    assert expired["grant_historically_issued"] is True
    assert expired["grant_currently_active"] is False
    assert expired["grant_expired"] is True
    assert expired["externalization_authority_granted"] is False
    assert expired["authority_effect"] == "EXPIRE_BOUNDED_EXTERNALIZATION_AUTHORITY"

    challenge_item = reviewval.ready_challenge(records[-1])
    incomplete_review = review.review(copy.deepcopy(challenge_item))
    assert incomplete_review["decision"] == "REVIEW_INCOMPLETE"
    not_applicable = grant.grant(copy.deepcopy(incomplete_review))
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["externalization_authority_granted"] is False

    mutations = 0
    def reject(mutate_output=None, mutate_context=None, mutate_receipt=None, mode="issued"):
        nonlocal mutations
        receipt = copy.deepcopy(source)
        try:
            if mutate_receipt:
                mutate_receipt(receipt)
            ctx = grant.default_grant_context(receipt)
            if mode in {"issued", "revoked", "expired"}:
                ctx["grant_issuance_requested"] = True
            if mode == "revoked":
                ctx["revocation_requested"] = True
            if mode == "expired":
                ctx["expiry_boundary_reached"] = True
            if mutate_context:
                mutate_context(ctx)
            out = grant.grant(copy.deepcopy(receipt), copy.deepcopy(ctx))
            if mutate_output:
                mutate_output(out)
                grant.validate_grant_receipt(receipt, ctx, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe authority grant mutation accepted")

    for receipt in receipts:
        source = receipt
        for field in grant.RUNTIME_FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = receipts[-1]

    output_mutations = [
        lambda r: r.__setitem__("decision", "AUTHORIZED"),
        lambda r: r.__setitem__("decision", "LIVE_READY"),
        lambda r: r.__setitem__("grant_receipt_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("grantor_identity_proven", True),
        lambda r: r.__setitem__("grantor_real_world_authority_proven", True),
        lambda r: r.__setitem__("grant_authority_basis_validated_for_synthetic_scope", False),
        lambda r: r.__setitem__("granted_scope", "ALL_FUTURE_SESSIONS"),
        lambda r: r.__setitem__("granted_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("granted_duration", "FOREVER"),
        lambda r: r.__setitem__("expiry_boundary", "NEVER"),
        lambda r: r.__setitem__("revocation_mode", "NONE"),
        lambda r: r.__setitem__("revocation_handle", "0" * 64),
        lambda r: r.__setitem__("grant_historically_issued", False),
        lambda r: r.__setitem__("grant_currently_active", False),
        lambda r: r.__setitem__("scope_authorized_now", False),
        lambda r: r.__setitem__("capability_authorized_now", False),
        lambda r: r.__setitem__("externalization_authority_granted", False),
        lambda r: r.__setitem__("grant_receipt_created", False),
        lambda r: r.__setitem__("transport_binding_required", False),
        lambda r: r.__setitem__("runtime_activation_required", False),
        lambda r: r.__setitem__("send_permit_required", False),
        lambda r: r.__setitem__("authority_effect", "NONE"),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE"),
        lambda r: r.__setitem__("source_authority_review_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("grant_context_digest", "0" * 64),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_authority_review_receipt_digest", "0" * 64),
        lambda c: c.__setitem__("grantor_claim", "REAL_GRANTOR"),
        lambda c: c.__setitem__("grant_authority_basis_ref", "short"),
        lambda c: c.__setitem__("granted_scope", "ALL_FUTURE_SESSIONS"),
        lambda c: c.__setitem__("granted_capability", "GAME_ACCOUNT_CONTROL"),
        lambda c: c.__setitem__("granted_duration", "FOREVER"),
        lambda c: c.__setitem__("expiry_boundary", "NEVER"),
        lambda c: c.__setitem__("revocation_mode", "NONE"),
        lambda c: c.__setitem__("revocation_handle", "0" * 64),
        lambda c: c.__setitem__("bearer_token_requested", True),
        lambda c: c.__setitem__("persistent_authority_requested", True),
        lambda c: c.__setitem__("automatic_renewal_requested", True),
        lambda c: c.__setitem__("scope_expansion_requested", True),
        lambda c: c.__setitem__("capability_expansion_requested", True),
        lambda c: c.__setitem__("transport_binding_requested", True),
        lambda c: c.__setitem__("network_enablement_requested", True),
        lambda c: c.__setitem__("user_surface_enablement_requested", True),
        lambda c: c.__setitem__("send_permit_requested", True),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
        lambda c: c.__setitem__("grant_issuance_requested", "yes"),
        lambda c: c.__setitem__("revocation_requested", "yes"),
        lambda c: c.__setitem__("expiry_boundary_reached", "yes"),
    ]
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    receipt_mutations = [
        lambda r: r.__setitem__("externalization_authority_granted", True),
        lambda r: r.__setitem__("grant_decision_present", True),
        lambda r: r.__setitem__("grant_token_created", True),
        lambda r: r.__setitem__("send_permit", True),
        lambda r: r.__setitem__("live_runtime_enabled", True),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE"),
        lambda r: r.__setitem__("authority_review_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("decision", "AUTHORIZED"),
        lambda r: r.__setitem__("separate_grant_step_required", False),
        lambda r: r.__setitem__("scope_within_reviewed_bounds", False),
        lambda r: r.__setitem__("capability_within_reviewed_bounds", False),
        lambda r: r.__setitem__("duration_within_reviewed_bounds", False),
    ]
    for mutation in receipt_mutations:
        reject(mutate_receipt=mutation)

    reject(mutate_context=lambda c: (c.__setitem__("grant_issuance_requested", False), c.__setitem__("revocation_requested", True)), mode="none")
    reject(mutate_context=lambda c: (c.__setitem__("grant_issuance_requested", False), c.__setitem__("expiry_boundary_reached", True)), mode="none")
    reject(mutate_context=lambda c: (c.__setitem__("revocation_requested", True), c.__setitem__("expiry_boundary_reached", True)), mode="issued")

    source_complete = source
    source = incomplete_review
    try:
        ctx = grant.default_grant_context(source)
        ctx["grant_issuance_requested"] = True
        grant.grant(copy.deepcopy(source), ctx)
    except (ValueError, AssertionError, KeyError, TypeError):
        mutations += 1
    else:
        raise AssertionError("incomplete review issued a grant")
    source = source_complete

    final = issued[-1]
    print(
        "authority grant boundary validation: PASS; "
        f"grants={len(issued)}; fail_closed_mutations={mutations}; "
        f"final_authority_grant_receipt_digest={final['authority_grant_receipt_digest']}"
    )

if __name__ == "__main__":
    main()
