"""P1.7 contestability overlay over a validated P1.3 verifier input."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .core import DIMENSION_ORDER, assert_no_aggregate_semantic_collapse, validate_dimension
from .interactive import validate_interactive_input

CONTESTABILITY_INPUT_SCHEMA = "urn:uu-aap:verifier-contestability-input:0.1"
CONTESTABILITY_RESULT_SCHEMA = "urn:uu-aap:verifier-contestability-result:0.1"

CORRECTION_STATES = {"PROPOSED", "APPLIED_SUCCESSOR"}
DISPUTE_STATES = {"OPEN", "RESPONDED", "RESOLVED", "UNRESOLVED"}
APPEAL_STATES = {"OPEN", "RESOLVED", "UNRESOLVED"}
RESPONSE_STATES = {"NONE", "RESPONSE_PRESENT"}
CORRECTION_DISPOSITIONS = {"PENDING", "ACCEPTED", "REJECTED"}
DISPUTE_DISPOSITIONS = {"PENDING", "UPHELD", "REJECTED", "UNRESOLVED"}
APPEAL_DISPOSITIONS = {"PENDING", "UPHELD", "REJECTED", "UNRESOLVED"}

_INPUT_FIELDS = {"schema", "base_interactive_input", "contestability_evidence_items", "records"}
_EVIDENCE_FIELDS = {"id", "kind", "source_layer", "summary", "payload"}
_RECORD_FIELDS = {
    "id",
    "kind",
    "dimension",
    "actor_ref",
    "recorded_at",
    "statement",
    "evidence_refs",
    "status",
    "response_status",
    "disposition",
    "related_record_id",
    "successor_claim",
}
_OVERLAY_FIELDS = {
    "correction_status",
    "dispute_status",
    "appeal_status",
    "record_ids",
    "historical_claims",
    "successor_claim",
    "unresolved_dispute_record_ids",
    "active_appeal_record_ids",
}
_RESULT_FIELDS = {
    "schema",
    "artifact",
    "base_interactive_input",
    "dimension_order",
    "current_dimension_claims",
    "contestability_evidence_items",
    "contestability_overlay",
    "history",
    "contestability_policy",
    "aggregate_score_present",
    "aggregate_verdict_present",
}


def _semantic_projection(value: dict[str, Any]) -> dict[str, Any]:
    projected = deepcopy(value)
    base = projected.get("base_interactive_input")
    if isinstance(base, dict):
        for item in base.get("evidence_items", []):
            if isinstance(item, dict) and "payload" in item:
                item["payload"] = {}
    for item in projected.get("contestability_evidence_items", []):
        if isinstance(item, dict) and "payload" in item:
            item["payload"] = {}
    return projected


def _validate_evidence_items(items: Any, base_evidence_ids: set[str]) -> set[str]:
    assert isinstance(items, list), "contestability_evidence_items must be an array"
    ids: set[str] = set()
    for index, item in enumerate(items):
        label = f"contestability_evidence_items[{index}]"
        assert isinstance(item, dict), f"{label} must be an object"
        assert set(item) == _EVIDENCE_FIELDS, f"{label} fields changed: {set(item)}"
        for field in ("id", "kind", "source_layer", "summary"):
            assert isinstance(item[field], str) and item[field], f"{label}.{field}"
        assert isinstance(item["payload"], dict), f"{label}.payload must be an object"
        assert item["id"] not in base_evidence_ids, f"contestability evidence id collides with base evidence: {item['id']}"
        assert item["id"] not in ids, f"duplicate contestability evidence id: {item['id']}"
        ids.add(item["id"])
    return ids


def _validate_record(
    record: Any,
    index: int,
    evidence_ids: set[str],
    prior_records: dict[str, dict[str, Any]],
) -> None:
    label = f"records[{index}]"
    assert isinstance(record, dict), f"{label} must be an object"
    assert set(record) == _RECORD_FIELDS, f"{label} fields changed: {set(record)}"
    assert isinstance(record["id"], str) and record["id"], f"{label}.id"
    assert record["id"] not in prior_records, f"duplicate contestability record id: {record['id']}"
    assert record["kind"] in {"CORRECTION", "DISPUTE", "APPEAL"}, f"{label}.kind"
    assert record["dimension"] in DIMENSION_ORDER, f"{label}.dimension"
    assert isinstance(record["actor_ref"], str) and record["actor_ref"], f"{label}.actor_ref"
    assert isinstance(record["recorded_at"], str) and record["recorded_at"], f"{label}.recorded_at"
    assert isinstance(record["statement"], str) and record["statement"], f"{label}.statement"
    assert isinstance(record["evidence_refs"], list), f"{label}.evidence_refs"
    assert all(isinstance(ref, str) and ref for ref in record["evidence_refs"]), f"{label}.evidence_refs item"
    assert len(record["evidence_refs"]) == len(set(record["evidence_refs"])), f"{label}.evidence_refs duplicate"
    for ref in record["evidence_refs"]:
        assert ref in evidence_ids, f"{label}: undeclared evidence ref: {ref}"

    kind = record["kind"]
    status = record["status"]
    response_status = record["response_status"]
    disposition = record["disposition"]
    related = record["related_record_id"]
    successor = record["successor_claim"]

    if kind == "CORRECTION":
        assert status in CORRECTION_STATES, f"{label}.status"
        assert response_status == "NONE", f"{label}: correction response_status must be NONE"
        assert disposition in CORRECTION_DISPOSITIONS, f"{label}.disposition"
        assert related is None, f"{label}: correction related_record_id must be null"
        assert isinstance(successor, dict), f"{label}: correction successor_claim required"
        validate_dimension(record["dimension"], successor)
        for ref in successor["evidence_refs"]:
            assert ref in evidence_ids, f"{label}: successor claim undeclared evidence ref: {ref}"
        if status == "APPLIED_SUCCESSOR":
            assert disposition == "ACCEPTED", f"{label}: applied correction must be ACCEPTED"
        else:
            assert disposition in {"PENDING", "REJECTED"}, f"{label}: proposed correction cannot be applied"
    elif kind == "DISPUTE":
        assert status in DISPUTE_STATES, f"{label}.status"
        assert response_status in RESPONSE_STATES, f"{label}.response_status"
        assert disposition in DISPUTE_DISPOSITIONS, f"{label}.disposition"
        assert related is None, f"{label}: dispute related_record_id must be null"
        assert successor is None, f"{label}: dispute must not provide successor_claim"
        if status in {"OPEN", "RESPONDED"}:
            assert disposition == "PENDING", f"{label}: open/responded dispute must remain PENDING"
        elif status == "RESOLVED":
            assert disposition in {"UPHELD", "REJECTED"}, f"{label}: resolved dispute needs explicit disposition"
        else:
            assert disposition == "UNRESOLVED", f"{label}: unresolved dispute must remain UNRESOLVED"
    else:
        assert status in APPEAL_STATES, f"{label}.status"
        assert response_status in RESPONSE_STATES, f"{label}.response_status"
        assert disposition in APPEAL_DISPOSITIONS, f"{label}.disposition"
        assert isinstance(related, str) and related, f"{label}: appeal related_record_id required"
        assert related in prior_records, f"{label}: appeal must target a prior record"
        target = prior_records[related]
        assert target["kind"] in {"CORRECTION", "DISPUTE"}, f"{label}: appeal target kind"
        assert target["dimension"] == record["dimension"], f"{label}: appeal target dimension mismatch"
        assert successor is None, f"{label}: appeal must not provide successor_claim"
        if status == "OPEN":
            assert disposition == "PENDING", f"{label}: open appeal must remain PENDING"
        elif status == "RESOLVED":
            assert disposition in {"UPHELD", "REJECTED"}, f"{label}: resolved appeal needs explicit disposition"
        else:
            assert disposition == "UNRESOLVED", f"{label}: unresolved appeal must remain UNRESOLVED"


def validate_contestability_input(record: dict[str, Any]) -> None:
    assert isinstance(record, dict), "contestability input must be an object"
    assert set(record) == _INPUT_FIELDS, f"contestability input fields changed: {set(record)}"
    assert record["schema"] == CONTESTABILITY_INPUT_SCHEMA, "unsupported contestability input schema"
    validate_interactive_input(record["base_interactive_input"])

    base_evidence_ids = {item["id"] for item in record["base_interactive_input"]["evidence_items"]}
    contest_ids = _validate_evidence_items(record["contestability_evidence_items"], base_evidence_ids)
    evidence_ids = base_evidence_ids | contest_ids

    assert isinstance(record["records"], list), "records must be an array"
    prior: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(record["records"]):
        _validate_record(item, index, evidence_ids, prior)
        prior[item["id"]] = item

    assert_no_aggregate_semantic_collapse(_semantic_projection(record))


def build_contestability_input(
    base_interactive_input: dict[str, Any],
    contestability_evidence_items: list[dict[str, Any]],
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    result = {
        "schema": CONTESTABILITY_INPUT_SCHEMA,
        "base_interactive_input": deepcopy(base_interactive_input),
        "contestability_evidence_items": deepcopy(contestability_evidence_items),
        "records": deepcopy(records),
    }
    validate_contestability_input(result)
    return result


def _initial_overlay() -> dict[str, Any]:
    return {
        "correction_status": "NONE",
        "dispute_status": "NONE",
        "appeal_status": "NONE",
        "record_ids": [],
        "historical_claims": [],
        "successor_claim": None,
        "unresolved_dispute_record_ids": [],
        "active_appeal_record_ids": [],
    }


def _derive_dispute_status(records: list[dict[str, Any]]) -> str:
    statuses = [item["status"] for item in records if item["kind"] == "DISPUTE"]
    if not statuses:
        return "NONE"
    if "UNRESOLVED" in statuses:
        return "UNRESOLVED"
    if "OPEN" in statuses:
        return "OPEN"
    if "RESPONDED" in statuses:
        return "RESPONDED"
    return "RESOLVED"


def _derive_appeal_status(records: list[dict[str, Any]]) -> str:
    statuses = [item["status"] for item in records if item["kind"] == "APPEAL"]
    if not statuses:
        return "NONE"
    if "UNRESOLVED" in statuses:
        return "UNRESOLVED"
    if "OPEN" in statuses:
        return "OPEN"
    return "RESOLVED"


def _derive_correction_status(records: list[dict[str, Any]]) -> str:
    statuses = [item["status"] for item in records if item["kind"] == "CORRECTION"]
    if not statuses:
        return "NONE"
    if "APPLIED_SUCCESSOR" in statuses:
        return "APPLIED_SUCCESSOR"
    return "PROPOSED"


def materialize_contestability_overlay(record: dict[str, Any]) -> dict[str, Any]:
    validate_contestability_input(record)
    base = record["base_interactive_input"]
    current_claims = {name: deepcopy(base["dimension_claims"][name]) for name in DIMENSION_ORDER}
    overlay = {name: _initial_overlay() for name in DIMENSION_ORDER}
    history: list[dict[str, Any]] = []
    records_by_dimension: dict[str, list[dict[str, Any]]] = {name: [] for name in DIMENSION_ORDER}

    for item in record["records"]:
        copied = deepcopy(item)
        history.append(copied)
        dimension = item["dimension"]
        dimension_records = records_by_dimension[dimension]
        dimension_records.append(copied)
        state = overlay[dimension]
        state["record_ids"].append(item["id"])

        if item["kind"] == "CORRECTION" and item["status"] == "APPLIED_SUCCESSOR":
            state["historical_claims"].append(deepcopy(current_claims[dimension]))
            current_claims[dimension] = deepcopy(item["successor_claim"])
            state["successor_claim"] = deepcopy(item["successor_claim"])

        if item["kind"] == "DISPUTE" and item["status"] in {"OPEN", "UNRESOLVED"}:
            state["unresolved_dispute_record_ids"].append(item["id"])
        if item["kind"] == "APPEAL" and item["status"] in {"OPEN", "UNRESOLVED"}:
            state["active_appeal_record_ids"].append(item["id"])

        state["correction_status"] = _derive_correction_status(dimension_records)
        state["dispute_status"] = _derive_dispute_status(dimension_records)
        state["appeal_status"] = _derive_appeal_status(dimension_records)

    result = {
        "schema": CONTESTABILITY_RESULT_SCHEMA,
        "artifact": deepcopy(base["artifact"]),
        "base_interactive_input": deepcopy(base),
        "dimension_order": list(DIMENSION_ORDER),
        "current_dimension_claims": current_claims,
        "contestability_evidence_items": deepcopy(record["contestability_evidence_items"]),
        "contestability_overlay": overlay,
        "history": history,
        "contestability_policy": {
            "overlay_is_verifier_dimension": False,
            "dispute_mutates_claim": False,
            "appeal_mutates_claim": False,
            "correction_preserves_history": True,
            "actor_ref_establishes_identity": False,
            "actor_ref_establishes_authority": False,
            "correction_establishes_truth": False,
            "unresolved_disagreement_permitted": True,
            "forced_consensus_permitted": False,
            "reputation_penalty_inference_permitted": False,
            "aggregate_score_permitted": False,
            "aggregate_verdict_permitted": False,
        },
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_contestability_result(result)
    return result


def validate_contestability_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict), "contestability result must be an object"
    assert set(result) == _RESULT_FIELDS, f"contestability result fields changed: {set(result)}"
    assert result["schema"] == CONTESTABILITY_RESULT_SCHEMA, "unsupported contestability result schema"
    validate_interactive_input(result["base_interactive_input"])
    assert result["artifact"] == result["base_interactive_input"]["artifact"], "artifact changed"
    assert result["dimension_order"] == list(DIMENSION_ORDER), "dimension order changed"
    assert set(result["current_dimension_claims"]) == set(DIMENSION_ORDER), "current claims must retain seven dimensions"
    assert set(result["contestability_overlay"]) == set(DIMENSION_ORDER), "contestability overlay must key the seven dimensions"

    base_evidence_ids = {item["id"] for item in result["base_interactive_input"]["evidence_items"]}
    contest_ids = _validate_evidence_items(result["contestability_evidence_items"], base_evidence_ids)
    evidence_ids = base_evidence_ids | contest_ids

    assert isinstance(result["history"], list), "history must be an array"
    prior: dict[str, dict[str, Any]] = {}
    applied_corrections: dict[str, list[dict[str, Any]]] = {name: [] for name in DIMENSION_ORDER}
    dimension_records: dict[str, list[dict[str, Any]]] = {name: [] for name in DIMENSION_ORDER}
    for index, item in enumerate(result["history"]):
        _validate_record(item, index, evidence_ids, prior)
        prior[item["id"]] = item
        dimension_records[item["dimension"]].append(item)
        if item["kind"] == "CORRECTION" and item["status"] == "APPLIED_SUCCESSOR":
            applied_corrections[item["dimension"]].append(item)

    for dimension in DIMENSION_ORDER:
        state = result["contestability_overlay"][dimension]
        assert isinstance(state, dict), f"{dimension}: overlay must be an object"
        assert set(state) == _OVERLAY_FIELDS, f"{dimension}: overlay fields changed: {set(state)}"
        records = dimension_records[dimension]
        assert state["record_ids"] == [item["id"] for item in records], f"{dimension}: record order changed"
        assert state["correction_status"] == _derive_correction_status(records), f"{dimension}: correction status"
        assert state["dispute_status"] == _derive_dispute_status(records), f"{dimension}: dispute status"
        assert state["appeal_status"] == _derive_appeal_status(records), f"{dimension}: appeal status"
        assert state["unresolved_dispute_record_ids"] == [
            item["id"] for item in records if item["kind"] == "DISPUTE" and item["status"] in {"OPEN", "UNRESOLVED"}
        ], f"{dimension}: unresolved disputes changed"
        assert state["active_appeal_record_ids"] == [
            item["id"] for item in records if item["kind"] == "APPEAL" and item["status"] in {"OPEN", "UNRESOLVED"}
        ], f"{dimension}: active appeals changed"

        expected_current = deepcopy(result["base_interactive_input"]["dimension_claims"][dimension])
        expected_history: list[dict[str, Any]] = []
        for correction in applied_corrections[dimension]:
            expected_history.append(deepcopy(expected_current))
            expected_current = deepcopy(correction["successor_claim"])
        validate_dimension(dimension, result["current_dimension_claims"][dimension])
        assert result["current_dimension_claims"][dimension] == expected_current, f"{dimension}: current claim changed outside correction"
        assert state["historical_claims"] == expected_history, f"{dimension}: historical claim preservation changed"
        if applied_corrections[dimension]:
            assert state["successor_claim"] == expected_current, f"{dimension}: successor claim changed"
        else:
            assert state["successor_claim"] is None, f"{dimension}: successor claim fabricated"

    policy = result["contestability_policy"]
    assert set(policy) == {
        "overlay_is_verifier_dimension",
        "dispute_mutates_claim",
        "appeal_mutates_claim",
        "correction_preserves_history",
        "actor_ref_establishes_identity",
        "actor_ref_establishes_authority",
        "correction_establishes_truth",
        "unresolved_disagreement_permitted",
        "forced_consensus_permitted",
        "reputation_penalty_inference_permitted",
        "aggregate_score_permitted",
        "aggregate_verdict_permitted",
    }
    assert policy["correction_preserves_history"] is True
    assert policy["unresolved_disagreement_permitted"] is True
    for key in (
        "overlay_is_verifier_dimension",
        "dispute_mutates_claim",
        "appeal_mutates_claim",
        "actor_ref_establishes_identity",
        "actor_ref_establishes_authority",
        "correction_establishes_truth",
        "forced_consensus_permitted",
        "reputation_penalty_inference_permitted",
        "aggregate_score_permitted",
        "aggregate_verdict_permitted",
    ):
        assert policy[key] is False, f"contestability policy strengthened: {key}"
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert_no_aggregate_semantic_collapse(_semantic_projection(result))
