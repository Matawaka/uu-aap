"""P1.10 explicit disposition and P1.3 materialization over P1.9 federated candidates."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .acceptance import DISPOSITIONS as P1_5_DISPOSITIONS
from .core import DIMENSION_ORDER, assert_no_aggregate_semantic_collapse
from .federation import validate_federation_result
from .interactive import INTERACTIVE_INPUT_SCHEMA, validate_interactive_input

FEDERATED_DISPOSITION_INPUT_SCHEMA = "urn:uu-aap:federated-candidate-disposition-input:0.1"
FEDERATED_DISPOSITION_RESULT_SCHEMA = "urn:uu-aap:federated-candidate-disposition-result:0.1"
FEDERATED_DISPOSITION_SCOPE = "verifier_federated_candidate_materialization"

_INPUT_FIELDS = {"schema", "federated_candidate_set", "disposition_event"}
_EVENT_FIELDS = {"id", "actor_ref", "scope", "dispositions"}
_DISPOSITION_FIELDS = {"federated_candidate_id", "decision", "rationale"}
_RESULT_FIELDS = {
    "schema",
    "artifact",
    "federated_candidate_set",
    "disposition_event",
    "accepted_candidate_ids",
    "rejected_candidate_ids",
    "deferred_candidate_ids",
    "disposition_receipts",
    "materialized_interactive_input",
    "disposition_policy",
    "aggregate_score_present",
    "aggregate_verdict_present",
}
_RECEIPT_FIELDS = {
    "federated_candidate_id",
    "source_family",
    "source_candidate_id",
    "source_observation_id",
    "dimension",
    "decision",
    "rationale",
}


def _semantic_projection(value: dict[str, Any]) -> dict[str, Any]:
    projected = deepcopy(value)
    fset = projected.get("federated_candidate_set")
    if isinstance(fset, dict):
        for source in fset.get("source_results", {}).values():
            if isinstance(source, dict):
                for item in source.get("evidence_items", []):
                    if isinstance(item, dict) and "payload" in item:
                        item["payload"] = {}
    materialized = projected.get("materialized_interactive_input")
    if isinstance(materialized, dict):
        for item in materialized.get("evidence_items", []):
            if isinstance(item, dict) and "payload" in item:
                item["payload"] = {}
    return projected


def _candidate_index(fset: dict[str, Any]) -> tuple[dict[str, tuple[str, dict[str, Any]]], list[str]]:
    index: dict[str, tuple[str, dict[str, Any]]] = {}
    order: list[str] = []
    for dimension in DIMENSION_ORDER:
        for candidate in fset["candidate_buckets"][dimension]:
            candidate_id = candidate["federated_candidate_id"]
            assert candidate_id not in index, f"duplicate federated candidate id: {candidate_id}"
            index[candidate_id] = (dimension, candidate)
            order.append(candidate_id)
    return index, order


def _validate_event(event: Any, fset: dict[str, Any]) -> None:
    assert isinstance(event, dict), "disposition_event must be an object"
    assert set(event) == _EVENT_FIELDS, f"disposition_event fields changed: {set(event)}"
    assert isinstance(event["id"], str) and event["id"], "disposition_event.id must be non-empty"
    assert isinstance(event["actor_ref"], str) and event["actor_ref"], "disposition_event.actor_ref must be non-empty"
    assert event["scope"] == FEDERATED_DISPOSITION_SCOPE, "federated disposition scope changed"
    assert isinstance(event["dispositions"], list), "disposition_event.dispositions must be an array"

    candidate_index, candidate_order = _candidate_index(fset)
    expected = set(candidate_order)
    seen: set[str] = set()
    accepted_by_dimension: dict[str, str] = {}
    for index, disposition in enumerate(event["dispositions"]):
        label = f"disposition_event.dispositions[{index}]"
        assert isinstance(disposition, dict), f"{label} must be an object"
        assert set(disposition) == _DISPOSITION_FIELDS, f"{label} fields changed: {set(disposition)}"
        candidate_id = disposition["federated_candidate_id"]
        assert isinstance(candidate_id, str) and candidate_id, f"{label}.federated_candidate_id"
        assert candidate_id in candidate_index, f"unknown federated candidate id: {candidate_id}"
        assert candidate_id not in seen, f"duplicate federated candidate disposition: {candidate_id}"
        seen.add(candidate_id)
        assert disposition["decision"] in P1_5_DISPOSITIONS, f"{label}.decision"
        assert isinstance(disposition["rationale"], str) and disposition["rationale"], f"{label}.rationale"
        if disposition["decision"] == "ACCEPT":
            dimension, _candidate = candidate_index[candidate_id]
            assert dimension not in accepted_by_dimension, (
                f"multiple accepted federated candidates for {dimension}: "
                f"{accepted_by_dimension[dimension]}, {candidate_id}"
            )
            accepted_by_dimension[dimension] = candidate_id
    assert seen == expected, (
        f"every federated candidate must receive exactly one disposition; "
        f"missing={sorted(expected - seen)} extra={sorted(seen - expected)}"
    )


def validate_federated_disposition_input(record: dict[str, Any]) -> None:
    assert isinstance(record, dict), "federated disposition input must be an object"
    assert set(record) == _INPUT_FIELDS, f"federated disposition input fields changed: {set(record)}"
    assert record["schema"] == FEDERATED_DISPOSITION_INPUT_SCHEMA, "unsupported federated disposition input schema"
    validate_federation_result(record["federated_candidate_set"])
    _validate_event(record["disposition_event"], record["federated_candidate_set"])
    assert_no_aggregate_semantic_collapse(_semantic_projection(record))


def build_federated_disposition_input(
    federated_candidate_set: dict[str, Any], disposition_event: dict[str, Any]
) -> dict[str, Any]:
    record = {
        "schema": FEDERATED_DISPOSITION_INPUT_SCHEMA,
        "federated_candidate_set": deepcopy(federated_candidate_set),
        "disposition_event": deepcopy(disposition_event),
    }
    validate_federated_disposition_input(record)
    return record


def _not_evaluated_dimension(dimension: str) -> dict[str, Any]:
    return {
        "value": "NOT_EVALUATED",
        "evaluation": "NOT_EVALUATED",
        "source_layer": "UU-AAP/P1.10",
        "evidence_refs": [],
        "explanation": f"No federated candidate was explicitly accepted for the {dimension} dimension in this disposition event.",
        "does_not_establish": [
            "absence of evidence",
            "falsehood",
            "lack of identity",
            "lack of provenance",
            "lack of authority",
            "lack of responsibility",
            "factual truth",
        ],
    }


def _source_evidence_inventory(fset: dict[str, Any]) -> list[dict[str, Any]]:
    """Preserve source evidence in family order; collisions fail closed rather than deduplicate."""
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for family in fset["source_order"]:
        for item in fset["source_results"][family]["evidence_items"]:
            evidence_id = item["id"]
            assert evidence_id not in seen, (
                f"cross-source evidence id collision: {evidence_id}; v0.1 will not silently deduplicate"
            )
            seen.add(evidence_id)
            items.append(deepcopy(item))
    return items


def _source_warnings(fset: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "code": f"FEDERATED_SOURCE_{item['source_family'].replace('.', '_').replace('-', '_')}_{item['code']}",
            "message": f"{item['source_family']}: {item['message']}",
        }
        for item in fset["source_warnings"]
    ]


def materialize_federated_disposition(record: dict[str, Any]) -> dict[str, Any]:
    validate_federated_disposition_input(record)
    fset = record["federated_candidate_set"]
    event = record["disposition_event"]
    candidate_index, candidate_order = _candidate_index(fset)
    decisions = {item["federated_candidate_id"]: item for item in event["dispositions"]}

    accepted: list[str] = []
    rejected: list[str] = []
    deferred: list[str] = []
    accepted_by_dimension: dict[str, dict[str, Any]] = {}
    disposition_receipts: list[dict[str, Any]] = []

    for candidate_id in candidate_order:
        dimension, candidate = candidate_index[candidate_id]
        disposition = decisions[candidate_id]
        decision = disposition["decision"]
        if decision == "ACCEPT":
            accepted.append(candidate_id)
            accepted_by_dimension[dimension] = candidate
        elif decision == "REJECT":
            rejected.append(candidate_id)
        else:
            deferred.append(candidate_id)
        disposition_receipts.append({
            "federated_candidate_id": candidate_id,
            "source_family": candidate["source_family"],
            "source_candidate_id": candidate["source_candidate_id"],
            "source_observation_id": candidate["source_observation_id"],
            "dimension": dimension,
            "decision": decision,
            "rationale": disposition["rationale"],
        })

    evidence_items = _source_evidence_inventory(fset)
    receipt_id = f"evidence:{event['id']}"
    existing_ids = {item["id"] for item in evidence_items}
    assert receipt_id not in existing_ids, f"disposition evidence id collides with source evidence: {receipt_id}"
    disposition_evidence = {
        "id": receipt_id,
        "kind": "federated_candidate_disposition_receipt",
        "source_layer": "UU-AAP/P1.10",
        "summary": "Explicit federated candidate dispositions used to materialize the P1.3 verifier input.",
        "payload": {
            "event_id": event["id"],
            "actor_ref": event["actor_ref"],
            "scope": event["scope"],
            "disposition_receipts": deepcopy(disposition_receipts),
        },
    }

    dimension_claims: dict[str, Any] = {}
    for dimension in DIMENSION_ORDER:
        candidate = accepted_by_dimension.get(dimension)
        if candidate is None:
            dimension_claims[dimension] = _not_evaluated_dimension(dimension)
            continue
        original = candidate["claim"]
        claim = deepcopy(original)
        claim["evidence_refs"] = [*claim["evidence_refs"], receipt_id]
        assert claim["value"] == original["value"]
        assert claim["evaluation"] == original["evaluation"]
        assert claim["source_layer"] == original["source_layer"]
        assert claim["explanation"] == original["explanation"]
        assert claim["does_not_establish"] == original["does_not_establish"]
        dimension_claims[dimension] = claim

    warnings = _source_warnings(fset)
    warnings.append({
        "code": "FEDERATED_DISPOSITION_ACTOR_REF_NOT_IDENTITY_OR_AUTHORITY_PROOF",
        "message": "The disposition actor reference records the declared local selector only; it does not establish identity, authority, authorship, responsibility, standing or legal validity.",
    })
    if rejected:
        warnings.append({
            "code": "REJECTED_CANDIDATES_NOT_NEGATIVE_EVIDENCE",
            "message": "Rejected federated candidates remain preserved as candidate history; rejection is a local disposition and is not negative evidence, sanction or reputation signal.",
        })
    if deferred:
        warnings.append({
            "code": "DEFERRED_CANDIDATES_NOT_NEGATIVE_EVIDENCE",
            "message": "Deferred federated candidates remain preserved as unresolved selection history; defer is not negative evidence or a ranking signal.",
        })

    materialized = {
        "schema": INTERACTIVE_INPUT_SCHEMA,
        "artifact": deepcopy(fset["artifact"]),
        "evidence_items": [*evidence_items, disposition_evidence],
        "dimension_claims": dimension_claims,
        "related_observations": {
            "federated_candidate_disposition": {
                "event_id": event["id"],
                "actor_ref": event["actor_ref"],
                "scope": event["scope"],
                "accepted_candidate_ids": deepcopy(accepted),
                "rejected_candidate_ids": deepcopy(rejected),
                "deferred_candidate_ids": deepcopy(deferred),
                "disposition_receipts": deepcopy(disposition_receipts),
            },
            "auxiliary_attestations": deepcopy(fset["auxiliary_attestations"]),
        },
        "warnings": warnings,
        "disputes": [],
    }
    validate_interactive_input(materialized)

    result = {
        "schema": FEDERATED_DISPOSITION_RESULT_SCHEMA,
        "artifact": deepcopy(fset["artifact"]),
        "federated_candidate_set": deepcopy(fset),
        "disposition_event": deepcopy(event),
        "accepted_candidate_ids": accepted,
        "rejected_candidate_ids": rejected,
        "deferred_candidate_ids": deferred,
        "disposition_receipts": disposition_receipts,
        "materialized_interactive_input": materialized,
        "disposition_policy": {
            "all_candidates_require_explicit_disposition": True,
            "single_accept_per_dimension_required": True,
            "source_provenance_preserved": True,
            "actor_ref_establishes_identity": False,
            "actor_ref_establishes_authority": False,
            "acceptance_strengthens_claim_semantics": False,
            "auto_selection_permitted": False,
            "source_family_priority_permitted": False,
            "source_order_priority_permitted": False,
            "evaluation_ranking_permitted": False,
            "reject_is_negative_evidence": False,
            "defer_is_negative_evidence": False,
            "auxiliary_attestations_dispositionable": False,
            "cross_dimension_promotion_permitted": False,
            "identity_to_authority_promotion_permitted": False,
            "truth_promotion_permitted": False,
            "aggregate_score_permitted": False,
            "aggregate_verdict_permitted": False,
        },
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_federated_disposition_result(result)
    return result


def validate_federated_disposition_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict), "federated disposition result must be an object"
    assert set(result) == _RESULT_FIELDS, f"federated disposition result fields changed: {set(result)}"
    assert result["schema"] == FEDERATED_DISPOSITION_RESULT_SCHEMA, "unsupported federated disposition result schema"
    fset = result["federated_candidate_set"]
    validate_federation_result(fset)
    _validate_event(result["disposition_event"], fset)
    assert result["artifact"] == fset["artifact"], "federated disposition artifact changed"

    candidate_index, candidate_order = _candidate_index(fset)
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
    assert set(accepted) | set(rejected) | set(deferred) == expected, "federated disposition result set changed"

    decisions = {
        item["federated_candidate_id"]: item
        for item in result["disposition_event"]["dispositions"]
    }
    assert accepted == [item for item in candidate_order if decisions[item]["decision"] == "ACCEPT"]
    assert rejected == [item for item in candidate_order if decisions[item]["decision"] == "REJECT"]
    assert deferred == [item for item in candidate_order if decisions[item]["decision"] == "DEFER"]

    receipts = result["disposition_receipts"]
    assert isinstance(receipts, list), "disposition_receipts must be an array"
    assert len(receipts) == len(candidate_order), "one disposition receipt per candidate required"
    for candidate_id, receipt in zip(candidate_order, receipts, strict=True):
        assert set(receipt) == _RECEIPT_FIELDS, "disposition receipt fields changed"
        dimension, candidate = candidate_index[candidate_id]
        decision = decisions[candidate_id]
        assert receipt == {
            "federated_candidate_id": candidate_id,
            "source_family": candidate["source_family"],
            "source_candidate_id": candidate["source_candidate_id"],
            "source_observation_id": candidate["source_observation_id"],
            "dimension": dimension,
            "decision": decision["decision"],
            "rationale": decision["rationale"],
        }, "disposition receipt/source provenance changed"

    materialized = result["materialized_interactive_input"]
    validate_interactive_input(materialized)
    receipt_id = f"evidence:{result['disposition_event']['id']}"
    source_evidence = _source_evidence_inventory(fset)
    assert materialized["evidence_items"][:-1] == source_evidence, "source evidence inventory changed or deduplicated"
    assert materialized["evidence_items"][-1]["id"] == receipt_id, "P1.10 disposition evidence missing"
    assert materialized["related_observations"]["auxiliary_attestations"] == fset["auxiliary_attestations"], (
        "auxiliary attestations changed during disposition"
    )

    accepted_by_dimension = {
        candidate_index[candidate_id][0]: candidate_index[candidate_id][1]
        for candidate_id in accepted
    }
    for dimension in DIMENSION_ORDER:
        claim = materialized["dimension_claims"][dimension]
        candidate = accepted_by_dimension.get(dimension)
        if candidate is None:
            assert claim["value"] == "NOT_EVALUATED", f"{dimension}: unaccepted candidate materialized"
            assert claim["evaluation"] == "NOT_EVALUATED", f"{dimension}: unaccepted evaluation materialized"
            assert claim["evidence_refs"] == [], f"{dimension}: unaccepted evidence refs"
            continue
        original = candidate["claim"]
        assert claim["value"] == original["value"], f"{dimension}: disposition strengthened value"
        assert claim["evaluation"] == original["evaluation"], f"{dimension}: disposition strengthened evaluation"
        assert claim["source_layer"] == original["source_layer"], f"{dimension}: source layer changed"
        assert claim["explanation"] == original["explanation"], f"{dimension}: explanation changed"
        assert claim["does_not_establish"] == original["does_not_establish"], f"{dimension}: non-effects changed"
        assert claim["evidence_refs"] == [*original["evidence_refs"], receipt_id], (
            f"{dimension}: only disposition evidence ref may be appended"
        )

    policy = result["disposition_policy"]
    assert set(policy) == {
        "all_candidates_require_explicit_disposition",
        "single_accept_per_dimension_required",
        "source_provenance_preserved",
        "actor_ref_establishes_identity",
        "actor_ref_establishes_authority",
        "acceptance_strengthens_claim_semantics",
        "auto_selection_permitted",
        "source_family_priority_permitted",
        "source_order_priority_permitted",
        "evaluation_ranking_permitted",
        "reject_is_negative_evidence",
        "defer_is_negative_evidence",
        "auxiliary_attestations_dispositionable",
        "cross_dimension_promotion_permitted",
        "identity_to_authority_promotion_permitted",
        "truth_promotion_permitted",
        "aggregate_score_permitted",
        "aggregate_verdict_permitted",
    }
    assert policy["all_candidates_require_explicit_disposition"] is True
    assert policy["single_accept_per_dimension_required"] is True
    assert policy["source_provenance_preserved"] is True
    for key, value in policy.items():
        if key not in {
            "all_candidates_require_explicit_disposition",
            "single_accept_per_dimension_required",
            "source_provenance_preserved",
        }:
            assert value is False, f"{key} must remain false"
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert_no_aggregate_semantic_collapse(_semantic_projection(result))
