#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MATERIALIZE = HERE / "materialize.py"
GRANT_VALIDATE = ROOT / "runtime-transport-binding-grant" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


materialize = loadmod("runtime_transport_binding_materialization", MATERIALIZE)
grantval = loadmod("runtime_transport_binding_materialization_grant_validate", GRANT_VALIDATE)
grant = grantval.grant


def active_binding_grant(shadow_result):
    review_receipt = grantval.complete_receipt(shadow_result)
    item = grant.grant(copy.deepcopy(review_receipt), grantval.issued_context(review_receipt))
    assert item["decision"] == "BOUNDED_BINDING_GRANT_ISSUED"
    return review_receipt, item


def ready_context(item):
    ctx = materialize.default_materialization_context(item)
    ctx["materialization_requested"] = True
    ctx["grant_lifecycle_rechecked"] = True
    ctx["grant_not_revoked_confirmed"] = True
    ctx["grant_not_expired_confirmed"] = True
    return ctx


def main():
    trace = json.loads(TRACE.read_text())
    records, _ = grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    pairs = [active_binding_grant(result) for result in records]
    review_receipts = [pair[0] for pair in pairs]
    grants = [pair[1] for pair in pairs]

    defaults = [materialize.materialize(copy.deepcopy(item)) for item in grants]
    for result in defaults:
        assert result["decision"] == "BINDING_NOT_MATERIALIZED"
        assert result["binding_authority_granted"] is True
        assert result["binding_authority_used_for_materialization"] is False
        assert result["binding_object_created"] is False
        assert result["runtime_binding_materialized"] is False
        assert result["transport_binding_materialized"] is False
        assert result["runtime_binding_ref"] is None
        assert result["transport_binding_ref"] is None
        assert result["external_transport_bound"] is False
        assert result["network_enabled"] is False
        assert result["send_permit"] is False
        assert result["runtime_connectedness"] == "AUTHORITY_PLANE_ONLY_NOT_BOUND"

    materialized = []
    for item in grants:
        result = materialize.materialize(copy.deepcopy(item), ready_context(item))
        materialized.append(result)
        assert result["decision"] == "SYNTHETIC_BINDING_MATERIALIZED"
        assert result["binding_authority_granted"] is True
        assert result["binding_authority_used_for_materialization"] is True
        assert result["binding_object_created"] is True
        assert result["runtime_binding_materialized"] is True
        assert result["transport_binding_materialized"] is True
        assert result["endpoint_descriptor_bound_locally"] is True
        assert result["materialization_local_only"] is True
        assert result["materialization_reversible"] is True
        assert len(result["runtime_binding_ref"]) == 64
        assert len(result["transport_binding_ref"]) == 64
        assert len(result["endpoint_binding_ref"]) == 64
        assert len(result["binding_object_digest"]) == 64
        assert result["binding_effect"] == "CREATE_LOCAL_SYNTHETIC_BINDING_ARTIFACT"
        assert result["authority_effect"] == "NONE"
        assert result["action_effect"] == "NONE"
        assert result["successor_effect"] == "NONE"
        assert result["live_runtime_bound"] is False
        assert result["external_transport_bound"] is False
        assert result["network_enabled"] is False
        assert result["user_surface_enabled"] is False
        assert result["send_permit"] is False
        assert result["transport_invoked"] is False
        assert result["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"
        assert len(result["binding_materialization_receipt_digest"]) == 64

    source = grants[-1]
    lifecycle_ctx = materialize.default_materialization_context(source)
    lifecycle_ctx["materialization_requested"] = True
    lifecycle = materialize.materialize(copy.deepcopy(source), lifecycle_ctx)
    assert lifecycle["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert lifecycle["binding_object_created"] is False
    assert lifecycle["runtime_connectedness"] == "AUTHORITY_PLANE_ONLY_NOT_BOUND"

    partial_ctx = materialize.default_materialization_context(source)
    partial_ctx["materialization_requested"] = True
    partial_ctx["grant_lifecycle_rechecked"] = True
    partial_ctx["grant_not_revoked_confirmed"] = True
    partial = materialize.materialize(copy.deepcopy(source), partial_ctx)
    assert partial["decision"] == "LIFECYCLE_RECHECK_REQUIRED"
    assert partial["binding_object_created"] is False

    source_review = review_receipts[-1]
    revoked_ctx = grantval.issued_context(source_review)
    revoked_ctx["revocation_requested"] = True
    revoked = grant.grant(copy.deepcopy(source_review), revoked_ctx)
    expired_ctx = grantval.issued_context(source_review)
    expired_ctx["expiry_boundary_reached"] = True
    expired = grant.grant(copy.deepcopy(source_review), expired_ctx)
    not_issued = grant.grant(copy.deepcopy(source_review))

    for terminal in (revoked, expired, not_issued):
        result = materialize.materialize(copy.deepcopy(terminal))
        assert result["decision"] == "NOT_APPLICABLE"
        assert result["binding_object_created"] is False
        assert result["binding_authority_granted"] is False
        assert result["external_transport_bound"] is False
        assert result["send_permit"] is False

    mutations = 0

    def reject(mutate_output=None, mutate_context=None, mutate_grant=None):
        nonlocal mutations
        item = copy.deepcopy(source)
        try:
            if mutate_grant:
                mutate_grant(item)
            ctx = ready_context(item)
            if mutate_context:
                mutate_context(ctx)
            out = materialize.materialize(copy.deepcopy(item), copy.deepcopy(ctx))
            if mutate_output:
                mutate_output(out)
                materialize.validate_materialization_receipt(item, ctx, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe runtime/transport binding materialization mutation accepted")

    for item in grants:
        source = item
        for field in materialize.EXTERNAL_FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = grants[-1]

    output_mutations = [
        lambda r: r.__setitem__("decision", "LIVE_BOUND"),
        lambda r: r.__setitem__("decision", "SEND_ALLOWED"),
        lambda r: r.__setitem__("binding_materialization_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("materialization_mode", "LIVE_NETWORK_BINDING"),
        lambda r: r.__setitem__("binding_authority_granted", False),
        lambda r: r.__setitem__("binding_authority_used_for_materialization", False),
        lambda r: r.__setitem__("binding_object_created", False),
        lambda r: r.__setitem__("runtime_binding_materialized", False),
        lambda r: r.__setitem__("transport_binding_materialized", False),
        lambda r: r.__setitem__("endpoint_descriptor_bound_locally", False),
        lambda r: r.__setitem__("materialization_local_only", False),
        lambda r: r.__setitem__("materialization_reversible", False),
        lambda r: r.__setitem__("runtime_binding_ref", "0" * 64),
        lambda r: r.__setitem__("transport_binding_ref", "0" * 64),
        lambda r: r.__setitem__("endpoint_binding_ref", "0" * 64),
        lambda r: r.__setitem__("binding_object_digest", "0" * 64),
        lambda r: r.__setitem__("runtime_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("transport_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("endpoint_descriptor_ref", "0" * 64),
        lambda r: r.__setitem__("runtime_attestation_ref", "0" * 64),
        lambda r: r.__setitem__("transport_attestation_ref", "0" * 64),
        lambda r: r.__setitem__("network_enablement_required_after_binding", False),
        lambda r: r.__setitem__("send_permit_required_after_binding", False),
        lambda r: r.__setitem__("transport_invocation_required_for_external_effect", False),
        lambda r: r.__setitem__("binding_effect", "CREATE_EXTERNAL_CONNECTION"),
        lambda r: r.__setitem__("authority_effect", "CREATE"),
        lambda r: r.__setitem__("action_effect", "SEND"),
        lambda r: r.__setitem__("source_binding_grant_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("materialization_context_digest", "0" * 64),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE_BOUND"),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_binding_grant_receipt_digest", "0" * 64),
        lambda c: c.__setitem__("materialization_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("materialization_mode", "LIVE_NETWORK_BINDING"),
        lambda c: c.__setitem__("runtime_slot", "REAL_RUNTIME"),
        lambda c: c.__setitem__("transport_slot", "REAL_NETWORK_TRANSPORT"),
        lambda c: c.__setitem__("endpoint_slot", "RAW_ENDPOINT"),
        lambda c: c.__setitem__("runtime_descriptor_ref", "0" * 64),
        lambda c: c.__setitem__("transport_descriptor_ref", "0" * 64),
        lambda c: c.__setitem__("endpoint_descriptor_ref", "0" * 64),
        lambda c: c.__setitem__("runtime_attestation_ref", "0" * 64),
        lambda c: c.__setitem__("transport_attestation_ref", "0" * 64),
        lambda c: c.__setitem__("materialization_requested", "yes"),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
        lambda c: c.__setitem__("action_effect", "BIND"),
    ]
    for field in materialize.FORBIDDEN_REQUESTS:
        context_mutations.append(lambda c, f=field: c.__setitem__(f, True))
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    grant_mutations = [
        lambda g: g.__setitem__("decision", "BINDING_GRANT_REVOKED"),
        lambda g: g.__setitem__("binding_grant_currently_active", False),
        lambda g: g.__setitem__("binding_authority_granted", False),
        lambda g: g.__setitem__("binding_scope_authorized_now", False),
        lambda g: g.__setitem__("binding_capability_authorized_now", False),
        lambda g: g.__setitem__("runtime_binding_materialization_required", False),
        lambda g: g.__setitem__("send_permit", True),
        lambda g: g.__setitem__("external_transport_bound", True),
        lambda g: g.__setitem__("runtime_descriptor_ref", "0" * 64),
        lambda g: g.__setitem__("transport_descriptor_ref", "0" * 64),
        lambda g: g.__setitem__("endpoint_descriptor_ref", "0" * 64),
        lambda g: g.__setitem__("binding_grant_receipt_digest", "0" * 64),
        lambda g: g.__setitem__("runtime_connectedness", "LIVE_BOUND"),
    ]
    for mutation in grant_mutations:
        reject(mutate_grant=mutation)

    for terminal in (revoked, expired, not_issued):
        try:
            bad = materialize.default_materialization_context(terminal)
            bad["materialization_requested"] = True
            bad["grant_lifecycle_rechecked"] = True
            bad["grant_not_revoked_confirmed"] = True
            bad["grant_not_expired_confirmed"] = True
            materialize.materialize(copy.deepcopy(terminal), bad)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
        else:
            raise AssertionError("inactive binding grant accepted materialization request")

    final = materialized[-1]
    print(
        "runtime transport binding materialization validation: PASS; "
        f"bindings={len(materialized)}; fail_closed_mutations={mutations}; "
        f"final_binding_materialization_receipt_digest={final['binding_materialization_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
