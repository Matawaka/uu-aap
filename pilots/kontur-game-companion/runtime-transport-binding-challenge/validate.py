#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BINDING = HERE / "binding.py"
GRANT_VALIDATE = ROOT / "authority-grant-boundary" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


binding = loadmod("runtime_transport_binding_challenge", BINDING)
grantval = loadmod("runtime_transport_binding_grant_validate", GRANT_VALIDATE)
grant = grantval.grant


def active_grant(shadow_result):
    receipt = grantval.complete_receipt(shadow_result)
    ctx = grantval.issued_context(receipt)
    item = grant.grant(copy.deepcopy(receipt), ctx)
    assert item["decision"] == "BOUNDED_GRANT_ISSUED"
    return receipt, item


def ready_context(item):
    ctx = binding.default_binding_context(item)
    ctx["binding_requested"] = True
    ctx["runtime_descriptor_ref"] = "4" * 64
    ctx["transport_descriptor_ref"] = "5" * 64
    ctx["endpoint_descriptor_ref"] = "6" * 64
    ctx["runtime_attestation_present"] = True
    ctx["runtime_attestation_ref"] = "7" * 64
    ctx["transport_attestation_present"] = True
    ctx["transport_attestation_ref"] = "8" * 64
    ctx["scope_match_asserted"] = True
    ctx["capability_match_asserted"] = True
    ctx["grant_lifecycle_checked"] = True
    ctx["grant_not_revoked_confirmed"] = True
    ctx["grant_not_expired_confirmed"] = True
    return ctx


def main():
    trace = json.loads(TRACE.read_text())
    records, _ = grantval.reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = grantval.reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    pairs = [active_grant(result) for result in records]
    receipts = [p[0] for p in pairs]
    grants = [p[1] for p in pairs]

    defaults = [binding.evaluate(copy.deepcopy(item)) for item in grants]
    for result in defaults:
        assert result["decision"] == "BINDING_NOT_REQUESTED"
        assert result["binding_review_ready"] is False
        assert result["binding_authorized"] is False
        assert result["external_transport_bound"] is False
        assert result["send_permit"] is False
        assert result["runtime_connectedness"] == "AUTHORITY_PLANE_ONLY_NOT_BOUND"

    ready = []
    for item in grants:
        result = binding.evaluate(copy.deepcopy(item), ready_context(item))
        ready.append(result)
        assert result["decision"] == "READY_FOR_BINDING_REVIEW"
        assert result["binding_review_ready"] is True
        assert result["grant_active_confirmed"] is True
        assert result["descriptor_sufficiency_evaluated"] is False
        assert result["attestation_sufficiency_evaluated"] is False
        assert result["runtime_identity_proven"] is False
        assert result["transport_identity_proven"] is False
        assert result["endpoint_validated"] is False
        assert result["binding_authorized"] is False
        assert result["runtime_binding_created"] is False
        assert result["transport_binding_created"] is False
        assert result["external_transport_bound"] is False
        assert result["live_runtime_bound"] is False
        assert result["network_enabled"] is False
        assert result["send_permit"] is False
        assert len(result["binding_challenge_digest"]) == 64

    source = grants[-1]

    ctx = binding.default_binding_context(source)
    ctx["binding_requested"] = True
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "RUNTIME_DESCRIPTOR_REQUIRED"
    ctx["runtime_descriptor_ref"] = "4" * 64
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "TRANSPORT_DESCRIPTOR_REQUIRED"
    ctx["transport_descriptor_ref"] = "5" * 64
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "ENDPOINT_DESCRIPTOR_REQUIRED"
    ctx["endpoint_descriptor_ref"] = "6" * 64
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "RUNTIME_ATTESTATION_REQUIRED"
    ctx["runtime_attestation_present"] = True
    ctx["runtime_attestation_ref"] = "7" * 64
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "TRANSPORT_ATTESTATION_REQUIRED"
    ctx["transport_attestation_present"] = True
    ctx["transport_attestation_ref"] = "8" * 64
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "SCOPE_MATCH_REVIEW_REQUIRED"
    ctx["scope_match_asserted"] = True
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "CAPABILITY_MATCH_REVIEW_REQUIRED"
    ctx["capability_match_asserted"] = True
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "LIFECYCLE_CHECK_REQUIRED"
    ctx["grant_lifecycle_checked"] = True
    ctx["grant_not_revoked_confirmed"] = True
    ctx["grant_not_expired_confirmed"] = True
    assert binding.evaluate(copy.deepcopy(source), ctx)["decision"] == "READY_FOR_BINDING_REVIEW"

    source_receipt = receipts[-1]
    revoked_ctx = grantval.issued_context(source_receipt)
    revoked_ctx["revocation_requested"] = True
    revoked = grant.grant(copy.deepcopy(source_receipt), revoked_ctx)
    expired_ctx = grantval.issued_context(source_receipt)
    expired_ctx["expiry_boundary_reached"] = True
    expired = grant.grant(copy.deepcopy(source_receipt), expired_ctx)
    not_issued = grant.grant(copy.deepcopy(source_receipt))
    for terminal in (revoked, expired, not_issued):
        result = binding.evaluate(copy.deepcopy(terminal))
        assert result["decision"] == "NOT_APPLICABLE"
        assert result["binding_review_ready"] is False
        assert result["binding_authorized"] is False
        assert result["send_permit"] is False

    mutations = 0

    def reject(mutate_output=None, mutate_context=None, mutate_grant=None):
        nonlocal mutations
        item = copy.deepcopy(source)
        try:
            if mutate_grant:
                mutate_grant(item)
            ctx2 = ready_context(item)
            if mutate_context:
                mutate_context(ctx2)
            out = binding.evaluate(copy.deepcopy(item), copy.deepcopy(ctx2))
            if mutate_output:
                mutate_output(out)
                binding.validate_challenge(item, ctx2, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe runtime/transport binding mutation accepted")

    for item in grants:
        source = item
        for field in binding.FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = grants[-1]

    output_mutations = [
        lambda r: r.__setitem__("decision", "BOUND"),
        lambda r: r.__setitem__("decision", "SEND_ALLOWED"),
        lambda r: r.__setitem__("binding_challenge_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("binding_review_ready", False),
        lambda r: r.__setitem__("grant_active_confirmed", False),
        lambda r: r.__setitem__("granted_scope", "ALL_FUTURE_SESSIONS"),
        lambda r: r.__setitem__("granted_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("runtime_class", "REAL_RUNTIME"),
        lambda r: r.__setitem__("transport_class", "REAL_NETWORK_TRANSPORT"),
        lambda r: r.__setitem__("endpoint_class", "RAW_URL"),
        lambda r: r.__setitem__("runtime_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("transport_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("endpoint_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("descriptor_sufficiency_evaluated", True),
        lambda r: r.__setitem__("attestation_sufficiency_evaluated", True),
        lambda r: r.__setitem__("runtime_identity_proven", True),
        lambda r: r.__setitem__("transport_identity_proven", True),
        lambda r: r.__setitem__("endpoint_validated", True),
        lambda r: r.__setitem__("scope_binding_validated", True),
        lambda r: r.__setitem__("capability_binding_validated", True),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE_BOUND"),
        lambda r: r.__setitem__("source_authority_grant_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("binding_context_digest", "0" * 64),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_authority_grant_receipt_digest", "0" * 64),
        lambda c: c.__setitem__("binding_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("requested_scope", "ALL_FUTURE_SESSIONS"),
        lambda c: c.__setitem__("requested_capability", "GAME_ACCOUNT_CONTROL"),
        lambda c: c.__setitem__("runtime_class", "REAL_RUNTIME"),
        lambda c: c.__setitem__("transport_class", "REAL_TRANSPORT"),
        lambda c: c.__setitem__("endpoint_class", "RAW_ENDPOINT"),
        lambda c: c.__setitem__("runtime_descriptor_ref", "short"),
        lambda c: c.__setitem__("transport_descriptor_ref", "short"),
        lambda c: c.__setitem__("endpoint_descriptor_ref", "short"),
        lambda c: c.__setitem__("runtime_attestation_present", "yes"),
        lambda c: c.__setitem__("transport_attestation_present", "yes"),
        lambda c: c.__setitem__("runtime_attestation_ref", "short"),
        lambda c: c.__setitem__("transport_attestation_ref", "short"),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
    ]
    for field in binding.FORBIDDEN_REQUESTS:
        context_mutations.append(lambda c, f=field: c.__setitem__(f, True))
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    grant_mutations = [
        lambda g: g.__setitem__("decision", "GRANT_REVOKED"),
        lambda g: g.__setitem__("grant_currently_active", False),
        lambda g: g.__setitem__("externalization_authority_granted", False),
        lambda g: g.__setitem__("scope_authorized_now", False),
        lambda g: g.__setitem__("capability_authorized_now", False),
        lambda g: g.__setitem__("transport_binding_required", False),
        lambda g: g.__setitem__("send_permit", True),
        lambda g: g.__setitem__("external_transport_bound", True),
        lambda g: g.__setitem__("runtime_connectedness", "LIVE"),
        lambda g: g.__setitem__("authority_grant_receipt_digest", "0" * 64),
    ]
    for mutation in grant_mutations:
        reject(mutate_grant=mutation)

    for terminal in (revoked, expired):
        try:
            bad = binding.default_binding_context(terminal)
            bad["binding_requested"] = True
            binding.evaluate(copy.deepcopy(terminal), bad)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
        else:
            raise AssertionError("inactive grant accepted binding request")

    final = ready[-1]
    print(
        "runtime transport binding challenge validation: PASS; "
        f"challenges={len(ready)}; fail_closed_mutations={mutations}; "
        f"final_binding_challenge_digest={final['binding_challenge_digest']}"
    )


if __name__ == "__main__":
    main()
