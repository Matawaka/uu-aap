"""Explicit candidate acceptance and P1.3 materialization gate."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .adapters import validate_adapter_result
from .core import DIMENSION_ORDER, assert_no_aggregate_semantic_collapse
from .interactive import INTERACTIVE_INPUT_SCHEMA, validate_interactive_input

ACCEPTANCE_INPUT_SCHEMA = "urn:uu-aap:candidate-acceptance-input:0.1"
ACCEPTANCE_RESULT_SCHEMA = "urn:uu-aap:candidate-acceptance-result:0.1"
ACCEPTANCE_SCOPE = "verifier_candidate_materialization"
DISPOSITIONS = {"ACCEPT", "REJECT", "DEFER"}

_INPUT_FIELDS = {"schema", "adapter_result", "acceptance_event"}
_EVENT_FIELDS = {"id", "actor_ref", "scope", "dispositions"}
_DISPOSITION_FIELDS = {"candidate_id", "decision", "rationale"}
_RESULT_FIELDS = {
    "schema",
    "artifact",
    "adapter_result",
    "acceptance_event",
    "accepted_candidate_ids",
    "rejected_candidate_ids",
    "deferred_candidate_ids",
    "materialized_interactive_input",
    "acceptance_policy",
    "aggregate_score_present",
    "aggregate_verdict_present",
}


def _candidate_index(adapter_result: dict[str, Any]) -> tuple[dict[str, tuple[str, dict[str, Any]]], list[str]]:
    index: dict[str, tuple[str, dict[str, Any]]] = {}
    order: list[str] = []
    for dimension in DIMENSION_ORDER:
        for candidate in adapter_result["candidate_claims"][dimension]:
            candidate_id = candidate["candidate_id"]
            assert candidate_id not in index, f"duplicate candidate id: {candidate_id}"
            index[candidate_id] = (dimension, candidate)
            order.append(candidate_id)
    return index, order


def _semantic_projection(value: dict[str, Any]) -> dict[str, Any]:
    """Keep external and materialized evidence payloads opaque during semantic-key scans."""
    projected = deepcopy(value)

    adapter_result = projected.get("adapter_result")
    if isinstance(adapter_result, dict):
        for item in adapter_result.get("evidence_items", []):
            if isinstance(item, dict) and "payload" in item:
                item["payload"] = {}

    materialized = projected.get("materialized_interactive_input")
    if isinstance(materialized, dict):
        for item in materialized.get("evidence_items", []):
            if isinstance(item, dict) and "payload" in item:
                item["payload"] = {}

    return projected


def _validate_acceptance_event(event: Any, adapter_result: dict[str, Any]) -> None:
    assert isinstance(event, dict), "acceptance_event must be an object"
    assert set(event) == _EVENT_FIELDS, f"acceptance_event fields changed: {set(event)}"
    assert isinstance(event["id"], str) and event["id"], "acceptance_event.id must be non-empty"
    assert isinstance(event["actor_ref"], str) and event["actor_ref"], "acceptance_event.actor_ref must be non-empty"
    assert event["scope"] == ACCEPTANCE_SCOPE, "acceptance scope must remain verifier_candidate_materialization"
    assert isinstance(event["dispositions"], list), "acceptance_event.dispositions must be an array"

    candidate_index, candidate_order = _candidate_index(adapter_result)
    expected = set(candidate_order)
    seen: set[str] = set()
    accepted_by_dimension: dict[str, str] = {}

    for index, disposition in enumerate(event["dispositions"]):
        label = f"acceptance_event.dispositions[{index}]"
        assert isinstance(disposition, dict), f"{label} must be an object"
        assert set(disposition) == _DISPOSITION_FIELDS, f"{label} fields changed: {set(disposition)}"
        candidate_id = disposition["candidate_id"]
        assert isinstance(candidate_id, str) and candidate_id, f"{label}.candidate_id"
        assert candidate_id in candidate_index, f"unknown candidate id: {candidate_id}"
        assert candidate_id not in seen, f"duplicate candidate disposition: {candidate_id}"
        seen.add(candidate_id)
        assert disposition["decision"] in DISPOSITIONS, f"{label}.decision"
        assert isinstance(disposition["rationale"], str) and disposition["rationale"], f"{label}.rationale"

        if disposition["decision"] == "ACCEPT":
            dimension, _candidate = candidate_index[candidate_id]
            assert dimension not in accepted_by_dimension, (
                f"multiple accepted candidates for {dimension}: {accepted_by_dimension[dimension]}, {candidate_id}"
            )
            accepted_by_dimension[dimension] = candidate_id

    assert seen == expected, (
        f"every candidate must receive exactly one disposition; missing={sorted(expected - seen)} extra={sorted(seen - expected)}"
    )


def validate_acceptance_input(record: dict[str, Any]) -> None:
    assert isinstance(record, dict), "acceptance input must be an object"
    assert set(record) == _INPUT_FIELDS, f"acceptance input fields changed: {set(record)}"
    assert record["schema"] == ACCEPTANCE_INPUT_SCHEMA, "unsupported acceptance input schema"
    validate_adapter_result(record["adapter_result"])
    _validate_acceptance_event(record["acceptance_event"], record["adapter_result"])
    assert_no_aggregate_semantic_collapse(_semantic_projection(record))


def build_acceptance_input(adapter_result: dict[str, Any], acceptance_event: dict[str, Any]) -> dict[str, Any]:
    record = {
        "schema": ACCEPTANCE_INPUT_SCHEMA,
        "adapter_result": deepcopy(adapter_result),
        "acceptance_event": deepcopy(acceptance_event),
    }
    validate_acceptance_input(record)
    return record


def _not_evaluated_dimension(dimension: str) -> dict[str, Any]:
    return {
        "value": "NOT_EVALUATED",
        "evaluation": "NOT_EVALUATED",
        "source_layer": "UU-AAP/P1.5",
        "evidence_refs": [],
        "explanation": f"No candidate was explicitly accepted for the {dimension} dimension in this materialization event.",
        "does_not_establish": [
            "absence of evidence",
            "falsehood",
            "lack of provenance",
            "lack of authority",
            "lack of responsibility",
            "factual truth",
        ],
    }


def materialize_candidate_acceptance(record: dict[str, Any]) -> dict[str, Any]:
    """Materialize only explicitly accepted candidates into a valid P1.3 input record."""
    validate_acceptance_input(record)
    adapter_result = record["adapter_result"]
    event = record["acceptance_event"]
    candidate_index, candidate_order = _candidate_index(adapter_result)
    decisions = {item["candidate_id"]: item for item in event["dispositions"]}

    accepted: list[str] = []
    rejected: list[str] = []
    deferred: list[str] = []
    accepted_by_dimension: dict[str, dict[str, Any]] = {}

    for candidate_id in candidate_order:
        decision = decisions[candidate_id]["decision"]
        dimension, candidate = candidate_index[candidate_id]
        if decision == "ACCEPT":
            accepted.append(candidate_id)
            accepted_by_dimension[dimension] = candidate
        elif decision == "REJECT":
            rejected.append(candidate_id)
        else:
            deferred.append(candidate_id)

    receipt_id = f"evidence:{event['id']}"
    existing_evidence_ids = {item["id"] for item in adapter_result["evidence_items"]}
    assert receipt_id not in existing_evidence_ids, f"acceptance evidence id collides with adapter evidence: {receipt_id}"

    acceptance_receipt = {
        "id": receipt_id,
        "kind": "candidate_acceptance_receipt",
        "source_layer": "UU-AAP/P1.5",
        "summary": "Explicit candidate dispositions used to materialize the P1.3 verifier input.",
        "payload": {
            "event_id": event["id"],
            "actor_ref": event["actor_ref"],
            "scope": event["scope"],
            "dispositions": deepcopy(event["dispositions"]),
        },
    }

    dimension_claims: dict[str, Any] = {}
    for dimension in DIMENSION_ORDER:
        candidate = accepted_by_dimension.get(dimension)
        if candidate is None:
            dimension_claims[dimension] = _not_evaluated_dimension(dimension)
            continue

        claim = deepcopy(candidate["claim"])
        original = candidate["claim"]
        claim["evidence_refs"] = [*claim["evidence_refs"], receipt_id]
        assert claim["value"] == original["value"]
        assert claim["evaluation"] == original["evaluation"]
        assert claim["source_layer"] == original["source_layer"]
        assert claim["explanation"] == original["explanation"]
        assert claim["does_not_establish"] == original["does_not_establish"]
        dimension_claims[dimension] = claim

    warnings = deepcopy(adapter_result["warnings"])
    warnings.append({
        "code": "ACCEPTANCE_ACTOR_REF_NOT_IDENTITY_OR_AUTHORITY_PROOF",
        "message": "The acceptance actor reference records who was named in this local selection event; it does not establish identity, authority, authorship, responsibility or legal validity.",
    })
    if rejected or deferred:
        warnings.append({
            "code": "UNMATERIALIZED_CANDIDATES_PRESERVED",
            "message": "Rejected or deferred candidates remain recorded in the acceptance result and were not promoted into P1.3 dimension claims.",
        })

    materialized = {
        "schema": INTERACTIVE_INPUT_SCHEMA,
        "artifact": deepcopy(adapter_result["artifact"]),
        "evidence_items": [*deepcopy(adapter_result["evidence_items"]), acceptance_receipt],
        "dimension_claims": dimension_claims,
        "related_observations": {
            "candidate_acceptance": {
                "event_id": event["id"],
                "actor_ref": event["actor_ref"],
                "scope": event["scope"],
                "accepted_candidate_ids": deepcopy(accepted),
                "rejected_candidate_ids": deepcopy(rejected),
                "deferred_candidate_ids": deepcopy(deferred),
            }
        },
        "warnings": warnings,
        "disputes": [],
    }
    validate_interactive_input(materialized)

    result = {
        "schema": ACCEPTANCE_RESULT_SCHEMA,
        "artifact": deepcopy(adapter_result["artifact"]),
        "adapter_result": deepcopy(adapter_result),
        "acceptance_event": deepcopy(event),
        "accepted_candidate_ids": accepted,
        "rejected_candidate_ids": rejected,
        "deferred_candidate_ids": deferred,
        "materialized_interactive_input": materialized,
        "acceptance_policy": {
            "all_candidates_require_explicit_disposition": True,
            "single_accept_per_dimension_required": True,
            "actor_ref_establishes_identity": False,
            "actor_ref_establishes_authority": False,
            "acceptance_strengthens_claim_semantics": False,
            "auto_acceptance_permitted": False,
            "cross_dimension_promotion_permitted": False,
            "truth_promotion_permitted": False,
            "aggregate_score_permitted": False,
            "aggregate_verdict_permitted": False,
        },
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_acceptance_result(result)
    return result


def validate_acceptance_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict), "acceptance result must be an object"
    assert set(result) == _RESULT_FIELDS, f"acceptance result fields changed: {set(result)}"
    assert result["schema"] == ACCEPTANCE_RESULT_SCHEMA, "unsupported acceptance result schema"
    validate_adapter_result(result["adapter_result"])
    _validate_acceptance_event(result["acceptance_event"], result["adapter_result"])
    assert result["artifact"] == result["adapter_result"]["artifact"], "acceptance result artifact changed"

    candidate_index, candidate_order = _candidate_index(result["adapter_result"])
    expected = set(candidate_order)
    accepted = result["accepted_candidate_ids"]
    rejected = result["rejected_candidate_ids"]
    deferred = result["deferred_candidate_ids"]
    for name, values in (("accepted", accepted), ("rejected", rejected), ("deferred", deferred)):
        assert isinstance(values, list), f"{name}_candidate_ids must be an array"
        assert all(isinstance(item, str) and item for item in values), f"{name}_candidate_ids item"
        assert len(values) == len(set(values)), f"duplicate {name} candidate id"
    assert set(accepted).isdisjoint(rejected)
    assert set(accepted).isdisjoint(deferred)
    assert set(rejected).isdisjoint(deferred)
    assert set(accepted) | set(rejected) | set(deferred) == expected, "candidate disposition result set changed"
    assert all(item in candidate_index for item in accepted + rejected + deferred)

    decisions = {item["candidate_id"]: item["decision"] for item in result["acceptance_event"]["dispositions"]}
    assert accepted == [item for item in candidate_order if decisions[item] == "ACCEPT"]
    assert rejected == [item for item in candidate_order if decisions[item] == "REJECT"]
    assert deferred == [item for item in candidate_order if decisions[item] == "DEFER"]

    validate_interactive_input(result["materialized_interactive_input"])
    materialized = result["materialized_interactive_input"]
    receipt_id = f"evidence:{result['acceptance_event']['id']}"
    assert any(item["id"] == receipt_id for item in materialized["evidence_items"]), "acceptance receipt missing"

    accepted_by_dimension = {
        candidate_index[candidate_id][0]: candidate_index[candidate_id][1]
        for candidate_id in accepted
    }
    for dimension in DIMENSION_ORDER:
        claim = materialized["dimension_claims"][dimension]
        candidate = accepted_by_dimension.get(dimension)
        if candidate is None:
            assert claim["value"] == "NOT_EVALUATED", f"{dimension}: unaccepted candidate was materialized"
            assert claim["evaluation"] == "NOT_EVALUATED", f"{dimension}: unaccepted evaluation"
            assert claim["evidence_refs"] == [], f"{dimension}: unaccepted evidence refs"
            continue
        original = candidate["claim"]
        assert claim["value"] == original["value"], f"{dimension}: acceptance strengthened value"
        assert claim["evaluation"] == original["evaluation"], f"{dimension}: acceptance strengthened evaluation"
        assert claim["source_layer"] == original["source_layer"], f"{dimension}: source layer changed"
        assert claim["explanation"] == original["explanation"], f"{dimension}: explanation changed"
        assert claim["does_not_establish"] == original["does_not_establish"], f"{dimension}: non-effects changed"
        assert claim["evidence_refs"] == [*original["evidence_refs"], receipt_id], f"{dimension}: acceptance evidence binding changed"

    policy = result["acceptance_policy"]
    assert set(policy) == {
        "all_candidates_require_explicit_disposition",
        "single_accept_per_dimension_required",
        "actor_ref_establishes_identity",
        "actor_ref_establishes_authority",
        "acceptance_strengthens_claim_semantics",
        "auto_acceptance_permitted",
        "cross_dimension_promotion_permitted",
        "truth_promotion_permitted",
        "aggregate_score_permitted",
        "aggregate_verdict_permitted",
    }
    assert policy["all_candidates_require_explicit_disposition"] is True
    assert policy["single_accept_per_dimension_required"] is True
    assert all(
        policy[key] is False
        for key in (
            "actor_ref_establishes_identity",
            "actor_ref_establishes_authority",
            "acceptance_strengthens_claim_semantics",
            "auto_acceptance_permitted",
            "cross_dimension_promotion_permitted",
            "truth_promotion_permitted",
            "aggregate_score_permitted",
            "aggregate_verdict_permitted",
        )
    )
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert_no_aggregate_semantic_collapse(_semantic_projection(result))
