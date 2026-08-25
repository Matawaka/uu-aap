#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHALLENGE = HERE / "challenge.py"
MATERIALIZE_VALIDATE = ROOT / "runtime-transport-binding-materialization" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


challenge = loadmod("network_user_surface_activation_challenge", CHALLENGE)
matval = loadmod("network_user_surface_materialization_validate", MATERIALIZE_VALIDATE)


def materialized_binding(shadow_result):
    _, grant = matval.active_binding_grant(shadow_result)
    item = matval.materialize.materialize(copy.deepcopy(grant), matval.ready_context(grant))
    assert item["decision"] == "SYNTHETIC_BINDING_MATERIALIZED"
    return item


def ready_context(item):
    ctx = challenge.default_activation_context(item)
    ctx["activation_requested"] = True
    ctx["network_contract_ref"] = "a" * 64
    ctx["user_surface_contract_ref"] = "b" * 64
    ctx["rollback_contract_ref"] = "c" * 64
    ctx["delivery_audit_sink_ref"] = "d" * 64
    ctx["binding_freshness_rechecked"] = True
    ctx["binding_object_current_confirmed"] = True
    ctx["binding_grant_current_confirmed"] = True
    return ctx


def main():
    trace = json.loads(TRACE.read_text())
    records, _ = matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    records2, _ = matval.grantval.reviewval.bindval.grantval.reviewval.actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    bindings = [materialized_binding(result) for result in records]

    defaults = [challenge.challenge(copy.deepcopy(item)) for item in bindings]
    for result in defaults:
        assert result["decision"] == "ACTIVATION_NOT_REQUESTED"
        assert result["activation_review_ready"] is False
        assert result["network_enabled"] is False
        assert result["user_surface_enabled"] is False
        assert result["send_permit"] is False
        assert result["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"

    ready = []
    for item in bindings:
        result = challenge.challenge(copy.deepcopy(item), ready_context(item))
        ready.append(result)
        assert result["decision"] == "READY_FOR_EXTERNALIZATION_REVIEW"
        assert result["activation_review_ready"] is True
        assert result["network_contract_sufficiency_evaluated"] is False
        assert result["user_surface_contract_sufficiency_evaluated"] is False
        assert result["network_activation_authorized"] is False
        assert result["user_surface_activation_authorized"] is False
        assert result["network_enabled"] is False
        assert result["user_surface_enabled"] is False
        assert result["external_transport_bound"] is False
        assert result["send_permit"] is False
        assert result["transport_invoked"] is False
        assert result["runtime_connectedness"] == "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"
        assert len(result["activation_challenge_digest"]) == 64

    source = bindings[-1]
    ctx = challenge.default_activation_context(source)
    ctx["activation_requested"] = True
    assert challenge.challenge(copy.deepcopy(source), ctx)["decision"] == "NETWORK_CONTRACT_REQUIRED"
    ctx["network_contract_ref"] = "a" * 64
    assert challenge.challenge(copy.deepcopy(source), ctx)["decision"] == "USER_SURFACE_CONTRACT_REQUIRED"
    ctx["user_surface_contract_ref"] = "b" * 64
    assert challenge.challenge(copy.deepcopy(source), ctx)["decision"] == "ROLLBACK_CONTRACT_REQUIRED"
    ctx["rollback_contract_ref"] = "c" * 64
    assert challenge.challenge(copy.deepcopy(source), ctx)["decision"] == "DELIVERY_AUDIT_SINK_REQUIRED"
    ctx["delivery_audit_sink_ref"] = "d" * 64
    assert challenge.challenge(copy.deepcopy(source), ctx)["decision"] == "BINDING_FRESHNESS_RECHECK_REQUIRED"
    ctx["binding_freshness_rechecked"] = True
    ctx["binding_object_current_confirmed"] = True
    ctx["binding_grant_current_confirmed"] = True
    assert challenge.challenge(copy.deepcopy(source), ctx)["decision"] == "READY_FOR_EXTERNALIZATION_REVIEW"

    # A non-materialized predecessor can never request externalization.
    _, source_grant = matval.active_binding_grant(records[-1])
    not_materialized = matval.materialize.materialize(copy.deepcopy(source_grant))
    assert not_materialized["decision"] == "BINDING_NOT_MATERIALIZED"
    assert challenge.challenge(copy.deepcopy(not_materialized))["decision"] == "NOT_APPLICABLE"
    try:
        bad = challenge.default_activation_context(not_materialized)
        bad["activation_requested"] = True
        challenge.challenge(copy.deepcopy(not_materialized), bad)
    except (ValueError, AssertionError, KeyError, TypeError):
        non_materialized_rejected = 1
    else:
        raise AssertionError("non-materialized binding accepted activation request")

    mutations = non_materialized_rejected
    source = bindings[-1]

    def reject(mutate_output=None, mutate_context=None, mutate_source=None):
        nonlocal mutations
        item = copy.deepcopy(source)
        try:
            if mutate_source:
                mutate_source(item)
            ctx2 = ready_context(item)
            if mutate_context:
                mutate_context(ctx2)
            out = challenge.challenge(copy.deepcopy(item), copy.deepcopy(ctx2))
            if mutate_output:
                mutate_output(out)
                challenge.validate_challenge(item, ctx2, out)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe network/user-surface activation mutation accepted")

    for item in bindings:
        source = item
        for field in challenge.FALSE_EFFECTS:
            reject(mutate_output=lambda r, f=field: r.__setitem__(f, True))
    source = bindings[-1]

    output_mutations = [
        lambda r: r.__setitem__("decision", "ACTIVATED"),
        lambda r: r.__setitem__("decision", "SEND_ALLOWED"),
        lambda r: r.__setitem__("activation_challenge_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("requested_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("activation_review_ready", False),
        lambda r: r.__setitem__("binding_object_digest", "0" * 64),
        lambda r: r.__setitem__("runtime_binding_ref", "0" * 64),
        lambda r: r.__setitem__("transport_binding_ref", "0" * 64),
        lambda r: r.__setitem__("endpoint_binding_ref", "0" * 64),
        lambda r: r.__setitem__("network_contract_ref", "0" * 64),
        lambda r: r.__setitem__("user_surface_contract_ref", "0" * 64),
        lambda r: r.__setitem__("rollback_contract_ref", "0" * 64),
        lambda r: r.__setitem__("delivery_audit_sink_ref", "0" * 64),
        lambda r: r.__setitem__("binding_freshness_rechecked", False),
        lambda r: r.__setitem__("binding_object_current_confirmed", False),
        lambda r: r.__setitem__("binding_grant_current_confirmed", False),
        lambda r: r.__setitem__("network_contract_sufficiency_evaluated", True),
        lambda r: r.__setitem__("network_activation_authorized", True),
        lambda r: r.__setitem__("user_surface_activation_authorized", True),
        lambda r: r.__setitem__("source_binding_materialization_receipt_digest", "0" * 64),
        lambda r: r.__setitem__("activation_context_digest", "0" * 64),
        lambda r: r.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
        lambda r: r.__setitem__("authority_effect", "CREATE"),
    ]
    for mutation in output_mutations:
        reject(mutate_output=mutation)

    context_mutations = [
        lambda c: c.__setitem__("source_binding_materialization_receipt_digest", "0" * 64),
        lambda c: c.__setitem__("activation_scope", "ALL_SESSIONS"),
        lambda c: c.__setitem__("requested_capability", "LIVE_UNBOUNDED_DELIVERY"),
        lambda c: c.__setitem__("network_mode", "RAW_SOCKET"),
        lambda c: c.__setitem__("user_surface_mode", "DIRECT_USER_CONTROL"),
        lambda c: c.__setitem__("network_contract_ref", "short"),
        lambda c: c.__setitem__("user_surface_contract_ref", "short"),
        lambda c: c.__setitem__("rollback_contract_ref", "short"),
        lambda c: c.__setitem__("delivery_audit_sink_ref", "short"),
        lambda c: c.__setitem__("binding_freshness_rechecked", "yes"),
        lambda c: c.__setitem__("binding_object_current_confirmed", "yes"),
        lambda c: c.__setitem__("binding_grant_current_confirmed", "yes"),
        lambda c: c.__setitem__("authority_effect", "CREATE"),
    ]
    for field in challenge.FORBIDDEN_REQUESTS:
        context_mutations.append(lambda c, f=field: c.__setitem__(f, True))
    for mutation in context_mutations:
        reject(mutate_context=mutation)

    source_mutations = [
        lambda s: s.__setitem__("decision", "BINDING_NOT_MATERIALIZED"),
        lambda s: s.__setitem__("binding_object_created", False),
        lambda s: s.__setitem__("runtime_binding_materialized", False),
        lambda s: s.__setitem__("transport_binding_materialized", False),
        lambda s: s.__setitem__("binding_object_digest", "0" * 64),
        lambda s: s.__setitem__("runtime_binding_ref", "0" * 64),
        lambda s: s.__setitem__("external_transport_bound", True),
        lambda s: s.__setitem__("network_enabled", True),
        lambda s: s.__setitem__("send_permit", True),
        lambda s: s.__setitem__("binding_materialization_receipt_digest", "0" * 64),
        lambda s: s.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in source_mutations:
        reject(mutate_source=mutation)

    final = ready[-1]
    print(
        "network user-surface activation challenge validation: PASS; "
        f"challenges={len(ready)}; fail_closed_mutations={mutations}; "
        f"final_activation_challenge_digest={final['activation_challenge_digest']}"
    )


if __name__ == "__main__":
    main()
