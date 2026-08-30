"""Bounded evidence adapters that emit candidate verifier claims without accepting them."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .core import DIMENSION_ORDER, assert_no_aggregate_semantic_collapse, validate_dimension

ADAPTER_INPUT_SCHEMA = "urn:uu-aap:evidence-adapter-input:0.1"
ADAPTER_RESULT_SCHEMA = "urn:uu-aap:evidence-adapter-result:0.1"

_INPUT_FIELDS = {"schema", "artifact", "observations"}
_ARTIFACT_FIELDS = {"id", "description"}
_OBSERVATION_FIELDS = {"id", "adapter_id", "source_layer", "summary", "loss_notes", "payload"}
_RESULT_FIELDS = {
    "schema",
    "artifact",
    "dimension_order",
    "evidence_items",
    "candidate_claims",
    "adapter_receipts",
    "unmapped_observations",
    "warnings",
    "adapter_policy",
    "aggregate_score_present",
    "aggregate_verdict_present",
}
_CANDIDATE_FIELDS = {"candidate_id", "adapter_id", "observation_id", "claim"}
_RECEIPT_FIELDS = {"adapter_id", "observation_id", "allowed_dimension", "status", "loss_notes"}
_WARNING_FIELDS = {"code", "message"}

ADAPTER_REGISTRY = {
    "c2pa.provenance.v0.1": {"dimension": "provenance", "source_layer": "C2PA"},
    "poai.availability.v0.1": {"dimension": "availability", "source_layer": "PoAI"},
    "uuaap.authority.v0.1": {"dimension": "authority", "source_layer": "UU-AAP"},
    "uuaap.responsibility.v0.1": {"dimension": "responsibility", "source_layer": "UU-AAP"},
}


def _semantic_projection(value: dict[str, Any]) -> dict[str, Any]:
    """Exclude opaque observation/evidence payloads from semantic-key scanning."""
    projected = deepcopy(value)
    for key in ("observations", "evidence_items"):
        for item in projected.get(key, []):
            if isinstance(item, dict) and "payload" in item:
                item["payload"] = {}
    return projected


def _validate_artifact(artifact: Any) -> None:
    assert isinstance(artifact, dict), "artifact must be an object"
    assert set(artifact) == _ARTIFACT_FIELDS, f"artifact fields changed: {set(artifact)}"
    assert isinstance(artifact["id"], str) and artifact["id"], "artifact.id must be non-empty"
    assert isinstance(artifact["description"], str) and artifact["description"], "artifact.description must be non-empty"


def _validate_loss_notes(loss_notes: Any, label: str) -> None:
    assert isinstance(loss_notes, list), f"{label}.loss_notes must be an array"
    assert all(isinstance(item, str) and item for item in loss_notes), f"{label}.loss_notes item"


def _validate_observation(observation: Any, index: int) -> None:
    label = f"observations[{index}]"
    assert isinstance(observation, dict), f"{label} must be an object"
    assert set(observation) == _OBSERVATION_FIELDS, f"{label} fields changed: {set(observation)}"
    for field in ("id", "adapter_id", "source_layer", "summary"):
        assert isinstance(observation[field], str) and observation[field], f"{label}.{field}"
    _validate_loss_notes(observation["loss_notes"], label)
    assert isinstance(observation["payload"], dict), f"{label}.payload must be an object"


def validate_adapter_input(record: dict[str, Any]) -> None:
    assert isinstance(record, dict), "adapter input must be an object"
    assert set(record) == _INPUT_FIELDS, f"adapter input fields changed: {set(record)}"
    assert record["schema"] == ADAPTER_INPUT_SCHEMA, "unsupported adapter input schema"
    _validate_artifact(record["artifact"])
    assert isinstance(record["observations"], list), "observations must be an array"
    seen: set[str] = set()
    for index, observation in enumerate(record["observations"]):
        _validate_observation(observation, index)
        assert observation["id"] not in seen, f"duplicate observation id: {observation['id']}"
        seen.add(observation["id"])
    assert_no_aggregate_semantic_collapse(_semantic_projection(record))


def _evidence_item(observation: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"evidence:{observation['id']}",
        "kind": observation["adapter_id"],
        "source_layer": observation["source_layer"],
        "summary": observation["summary"],
        "payload": deepcopy(observation["payload"]),
    }


def _claim(
    *,
    value: str,
    evaluation: str,
    source_layer: str,
    evidence_ref: str,
    explanation: str,
    does_not_establish: list[str],
) -> dict[str, Any]:
    claim = {
        "value": value,
        "evaluation": evaluation,
        "source_layer": source_layer,
        "evidence_refs": [evidence_ref],
        "explanation": explanation,
        "does_not_establish": does_not_establish,
    }
    validate_dimension("candidate", claim)
    return claim


def _adapt_c2pa(observation: dict[str, Any]) -> tuple[dict[str, Any] | None, list[dict[str, str]]]:
    payload = observation["payload"]
    for field in ("success", "hasCredentials", "manifestData_present"):
        assert field in payload, f"{observation['id']}: missing C2PA payload field {field}"
        assert isinstance(payload[field], bool), f"{observation['id']}: {field} must be boolean"

    if not payload["success"]:
        return None, [{
            "code": "C2PA_ADAPTER_NO_SUCCESS_RESULT",
            "message": f"{observation['id']}: C2PA observation did not report successful inspection; no provenance candidate emitted.",
        }]

    if payload["hasCredentials"] and payload["manifestData_present"]:
        claim = _claim(
            value="CREDENTIALS_PRESENT",
            evaluation="OBSERVED",
            source_layer="C2PA",
            evidence_ref=f"evidence:{observation['id']}",
            explanation="The bounded C2PA observation explicitly reports readable credentials and manifest data.",
            does_not_establish=[
                "identity",
                "authorship",
                "decision-time availability",
                "authority",
                "responsibility",
                "factual truth",
            ],
        )
        return claim, []

    claim = _claim(
        value="NO_SUPPORTED_CREDENTIALS_OBSERVED",
        evaluation="OBSERVED",
        source_layer="C2PA",
        evidence_ref=f"evidence:{observation['id']}",
        explanation="The bounded C2PA observation completed without reporting both supported credentials and manifest data.",
        does_not_establish=[
            "that the artifact was not generated by an AI system",
            "that provenance never existed",
            "identity",
            "authority",
            "responsibility",
            "factual truth",
        ],
    )
    return claim, [{
        "code": "C2PA_ABSENCE_INCONCLUSIVE",
        "message": f"{observation['id']}: absence of a supported credential signal is inconclusive about origin.",
    }]


def _adapt_poai(observation: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    payload = observation["payload"]
    assert payload.get("overall_status") in {"available", "unavailable", "unknown"}, (
        f"{observation['id']}: invalid PoAI overall_status"
    )
    assert isinstance(payload.get("reason"), str) and payload["reason"], f"{observation['id']}: PoAI reason required"
    value = {
        "available": "AVAILABLE_BEFORE_CUTOFF",
        "unavailable": "UNAVAILABLE_BEFORE_CUTOFF",
        "unknown": "AVAILABILITY_UNKNOWN",
    }[payload["overall_status"]]
    claim = _claim(
        value=value,
        evaluation="OBSERVED",
        source_layer="PoAI",
        evidence_ref=f"evidence:{observation['id']}",
        explanation=payload["reason"],
        does_not_establish=[
            "consideration",
            "reliance",
            "authority",
            "responsibility",
            "factual truth",
        ],
    )
    return claim, []


def _adapt_authority(observation: dict[str, Any]) -> tuple[dict[str, Any] | None, list[dict[str, str]]]:
    payload = observation["payload"]
    assert isinstance(payload.get("actor_id"), str) and payload["actor_id"], f"{observation['id']}: actor_id required"
    assert payload.get("actor_type") in {"human", "ai_system", "organization", "other"}, (
        f"{observation['id']}: invalid actor_type"
    )
    assert isinstance(payload.get("scopes"), list) and payload["scopes"], f"{observation['id']}: scopes required"
    assert all(isinstance(item, str) and item for item in payload["scopes"]), f"{observation['id']}: invalid scope"
    assert payload.get("status") in {"accepted", "limited", "rejected", "unknown"}, f"{observation['id']}: invalid status"

    if payload["status"] not in {"accepted", "limited"}:
        return None, [{
            "code": "AUTHORITY_NOT_ACCEPTED",
            "message": f"{observation['id']}: authority status is {payload['status']}; no authority candidate emitted.",
        }]

    value = "SCOPED_AUTHORITY_ACCEPTED" if payload["status"] == "accepted" else "SCOPED_AUTHORITY_LIMITED"
    claim = _claim(
        value=value,
        evaluation="OBSERVED",
        source_layer="UU-AAP",
        evidence_ref=f"evidence:{observation['id']}",
        explanation=f"Declared {payload['actor_type']} actor {payload['actor_id']} has {payload['status']} authority scopes: {', '.join(payload['scopes'])}.",
        does_not_establish=[
            "identity beyond declared actor metadata",
            "authorship",
            "responsibility",
            "artifact integrity",
            "factual truth",
        ],
    )
    return claim, []


def _adapt_responsibility(observation: dict[str, Any]) -> tuple[dict[str, Any] | None, list[dict[str, str]]]:
    payload = observation["payload"]
    assert isinstance(payload.get("actor_id"), str) and payload["actor_id"], f"{observation['id']}: actor_id required"
    assert isinstance(payload.get("scope"), str) and payload["scope"], f"{observation['id']}: responsibility scope required"
    assert payload.get("status") in {"accepted", "rejected", "unknown"}, f"{observation['id']}: invalid status"

    if payload["status"] != "accepted":
        return None, [{
            "code": "RESPONSIBILITY_NOT_ACCEPTED",
            "message": f"{observation['id']}: responsibility status is {payload['status']}; no responsibility candidate emitted.",
        }]

    claim = _claim(
        value="SCOPED_RESPONSIBILITY_PRESENT",
        evaluation="OBSERVED",
        source_layer="UU-AAP",
        evidence_ref=f"evidence:{observation['id']}",
        explanation=f"Declared actor {payload['actor_id']} accepts scoped responsibility: {payload['scope']}.",
        does_not_establish=[
            "identity beyond declared actor metadata",
            "authorship",
            "authority outside the declared scope",
            "artifact integrity",
            "factual truth",
        ],
    )
    return claim, []


def adapt_evidence(record: dict[str, Any]) -> dict[str, Any]:
    """Adapt documented external observations into non-accepted candidate claims."""
    validate_adapter_input(record)

    candidate_claims = {name: [] for name in DIMENSION_ORDER}
    evidence_items: list[dict[str, Any]] = []
    receipts: list[dict[str, Any]] = []
    warnings: list[dict[str, str]] = []
    unmapped: list[str] = []
    seen_candidate_ids: set[str] = set()

    for observation in record["observations"]:
        evidence_items.append(_evidence_item(observation))
        spec = ADAPTER_REGISTRY.get(observation["adapter_id"])
        if spec is None:
            unmapped.append(observation["id"])
            receipts.append({
                "adapter_id": observation["adapter_id"],
                "observation_id": observation["id"],
                "allowed_dimension": None,
                "status": "UNMAPPED",
                "loss_notes": deepcopy(observation["loss_notes"]),
            })
            warnings.append({
                "code": "UNKNOWN_ADAPTER",
                "message": f"{observation['id']}: adapter {observation['adapter_id']} is not registered; observation preserved without a candidate claim.",
            })
            continue

        assert observation["source_layer"] == spec["source_layer"], (
            f"{observation['id']}: source_layer {observation['source_layer']} does not match adapter {observation['adapter_id']}"
        )
        if observation["adapter_id"] == "c2pa.provenance.v0.1":
            claim, emitted_warnings = _adapt_c2pa(observation)
        elif observation["adapter_id"] == "poai.availability.v0.1":
            claim, emitted_warnings = _adapt_poai(observation)
        elif observation["adapter_id"] == "uuaap.authority.v0.1":
            claim, emitted_warnings = _adapt_authority(observation)
        elif observation["adapter_id"] == "uuaap.responsibility.v0.1":
            claim, emitted_warnings = _adapt_responsibility(observation)
        else:
            raise AssertionError(f"registered adapter has no implementation: {observation['adapter_id']}")
        warnings.extend(emitted_warnings)

        status = "NO_CANDIDATE"
        if claim is not None:
            dimension = spec["dimension"]
            candidate_id = f"candidate:{observation['id']}:{dimension}"
            assert candidate_id not in seen_candidate_ids, f"duplicate candidate id: {candidate_id}"
            seen_candidate_ids.add(candidate_id)
            candidate_claims[dimension].append({
                "candidate_id": candidate_id,
                "adapter_id": observation["adapter_id"],
                "observation_id": observation["id"],
                "claim": claim,
            })
            status = "CANDIDATE_EMITTED"

        receipts.append({
            "adapter_id": observation["adapter_id"],
            "observation_id": observation["id"],
            "allowed_dimension": spec["dimension"],
            "status": status,
            "loss_notes": deepcopy(observation["loss_notes"]),
        })

    result = {
        "schema": ADAPTER_RESULT_SCHEMA,
        "artifact": deepcopy(record["artifact"]),
        "dimension_order": list(DIMENSION_ORDER),
        "evidence_items": evidence_items,
        "candidate_claims": candidate_claims,
        "adapter_receipts": receipts,
        "unmapped_observations": unmapped,
        "warnings": warnings,
        "adapter_policy": {
            "candidate_claims_require_explicit_acceptance": True,
            "auto_acceptance_permitted": False,
            "cross_dimension_promotion_permitted": False,
            "truth_promotion_permitted": False,
            "aggregate_score_permitted": False,
            "aggregate_verdict_permitted": False,
        },
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_adapter_result(result)
    return result


def validate_adapter_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict), "adapter result must be an object"
    assert set(result) == _RESULT_FIELDS, f"adapter result fields changed: {set(result)}"
    assert result["schema"] == ADAPTER_RESULT_SCHEMA, "unsupported adapter result schema"
    _validate_artifact(result["artifact"])
    assert result["dimension_order"] == list(DIMENSION_ORDER), "dimension order changed"

    evidence_ids: set[str] = set()
    assert isinstance(result["evidence_items"], list), "evidence_items must be an array"
    for index, item in enumerate(result["evidence_items"]):
        assert isinstance(item, dict), f"evidence_items[{index}] must be an object"
        assert set(item) == {"id", "kind", "source_layer", "summary", "payload"}, f"evidence_items[{index}] fields"
        assert item["id"] not in evidence_ids, f"duplicate evidence id: {item['id']}"
        evidence_ids.add(item["id"])
        assert isinstance(item["payload"], dict), f"evidence_items[{index}].payload"

    assert set(result["candidate_claims"]) == set(DIMENSION_ORDER), "exactly seven candidate buckets required"
    candidate_ids: set[str] = set()
    for dimension in DIMENSION_ORDER:
        bucket = result["candidate_claims"][dimension]
        assert isinstance(bucket, list), f"{dimension}: candidate bucket must be an array"
        for candidate in bucket:
            assert isinstance(candidate, dict), f"{dimension}: candidate must be an object"
            assert set(candidate) == _CANDIDATE_FIELDS, f"{dimension}: candidate fields changed"
            assert candidate["candidate_id"] not in candidate_ids, f"duplicate candidate id: {candidate['candidate_id']}"
            candidate_ids.add(candidate["candidate_id"])
            adapter_id = candidate["adapter_id"]
            assert adapter_id in ADAPTER_REGISTRY, f"{dimension}: unknown adapter in candidate"
            assert ADAPTER_REGISTRY[adapter_id]["dimension"] == dimension, (
                f"{dimension}: adapter {adapter_id} promoted outside allowlist"
            )
            assert isinstance(candidate["observation_id"], str) and candidate["observation_id"], f"{dimension}: observation_id"
            validate_dimension(dimension, candidate["claim"])
            for evidence_ref in candidate["claim"]["evidence_refs"]:
                assert evidence_ref in evidence_ids, f"{dimension}: undeclared evidence ref {evidence_ref}"

    assert result["candidate_claims"]["integrity"] == []
    assert result["candidate_claims"]["identity"] == []
    assert result["candidate_claims"]["truth"] == []

    assert isinstance(result["adapter_receipts"], list), "adapter_receipts must be an array"
    receipt_observations: set[str] = set()
    for receipt in result["adapter_receipts"]:
        assert isinstance(receipt, dict), "adapter receipt must be an object"
        assert set(receipt) == _RECEIPT_FIELDS, "adapter receipt fields changed"
        assert receipt["observation_id"] not in receipt_observations, f"duplicate receipt observation: {receipt['observation_id']}"
        receipt_observations.add(receipt["observation_id"])
        assert receipt["status"] in {"CANDIDATE_EMITTED", "NO_CANDIDATE", "UNMAPPED"}
        assert receipt["allowed_dimension"] is None or receipt["allowed_dimension"] in DIMENSION_ORDER
        _validate_loss_notes(receipt["loss_notes"], "adapter receipt")

    assert isinstance(result["unmapped_observations"], list), "unmapped_observations must be an array"
    assert len(result["unmapped_observations"]) == len(set(result["unmapped_observations"]))
    assert all(isinstance(item, str) and item for item in result["unmapped_observations"])

    assert isinstance(result["warnings"], list), "warnings must be an array"
    for warning in result["warnings"]:
        assert isinstance(warning, dict), "warning must be an object"
        assert set(warning) == _WARNING_FIELDS, "warning fields changed"
        assert isinstance(warning["code"], str) and warning["code"]
        assert isinstance(warning["message"], str) and warning["message"]

    policy = result["adapter_policy"]
    assert set(policy) == {
        "candidate_claims_require_explicit_acceptance",
        "auto_acceptance_permitted",
        "cross_dimension_promotion_permitted",
        "truth_promotion_permitted",
        "aggregate_score_permitted",
        "aggregate_verdict_permitted",
    }
    assert policy["candidate_claims_require_explicit_acceptance"] is True
    assert all(
        policy[key] is False
        for key in (
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
