"""P1.9 provenance-preserving federation of P1.4 and P1.8 candidate sources."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .adapters import ADAPTER_RESULT_SCHEMA, validate_adapter_result
from .attestations import ATTESTATION_RESULT_SCHEMA, validate_attestation_result
from .core import DIMENSION_ORDER, assert_no_aggregate_semantic_collapse, validate_dimension

FEDERATION_INPUT_SCHEMA = "urn:uu-aap:candidate-source-federation-input:0.1"
FEDERATION_RESULT_SCHEMA = "urn:uu-aap:federated-candidate-set:0.1"
SOURCE_FAMILIES = ("P1.4_ADAPTER", "P1.8_ATTESTATION")

_INPUT_FIELDS = {"schema", "source_order", "adapter_result", "attestation_result"}
_RESULT_FIELDS = {
    "schema",
    "artifact",
    "dimension_order",
    "source_order",
    "source_results",
    "candidate_buckets",
    "auxiliary_attestations",
    "source_warnings",
    "federation_policy",
    "aggregate_score_present",
    "aggregate_verdict_present",
}
_FEDERATED_FIELDS = {
    "federated_candidate_id",
    "source_family",
    "source_candidate_id",
    "source_observation_id",
    "source_record_schema",
    "dimension",
    "claim",
}
_SOURCE_WARNING_FIELDS = {"source_family", "code", "message"}


def _semantic_projection(value: dict[str, Any]) -> dict[str, Any]:
    """Keep opaque source evidence bytes out of semantic-key scanning."""
    projected = deepcopy(value)
    for result in projected.get("source_results", {}).values():
        if not isinstance(result, dict):
            continue
        for item in result.get("evidence_items", []):
            if isinstance(item, dict) and "payload" in item:
                item["payload"] = {}
    return projected


def _validate_source_order(value: Any) -> None:
    assert isinstance(value, list), "source_order must be an array"
    assert len(value) == 2, "source_order must contain exactly two source families"
    assert set(value) == set(SOURCE_FAMILIES), (
        "source_order must contain P1.4_ADAPTER and P1.8_ATTESTATION exactly once"
    )


def validate_federation_input(record: dict[str, Any]) -> None:
    assert isinstance(record, dict), "federation input must be an object"
    assert set(record) == _INPUT_FIELDS, f"federation input fields changed: {set(record)}"
    assert record["schema"] == FEDERATION_INPUT_SCHEMA, "unsupported federation input schema"
    _validate_source_order(record["source_order"])
    validate_adapter_result(record["adapter_result"])
    validate_attestation_result(record["attestation_result"])
    assert record["adapter_result"]["artifact"] == record["attestation_result"]["artifact"], (
        "P1.4 and P1.8 sources must describe the same artifact"
    )
    assert_no_aggregate_semantic_collapse(
        _semantic_projection(
            {
                "source_results": {
                    "P1.4_ADAPTER": record["adapter_result"],
                    "P1.8_ATTESTATION": record["attestation_result"],
                }
            }
        )
    )


def build_federation_input(
    adapter_result: dict[str, Any],
    attestation_result: dict[str, Any],
    source_order: list[str] | None = None,
) -> dict[str, Any]:
    order = SOURCE_FAMILIES if source_order is None else source_order
    record = {
        "schema": FEDERATION_INPUT_SCHEMA,
        "source_order": list(order),
        "adapter_result": deepcopy(adapter_result),
        "attestation_result": deepcopy(attestation_result),
    }
    validate_federation_input(record)
    return record


def _adapter_candidates(result: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    buckets = {name: [] for name in DIMENSION_ORDER}
    for dimension in DIMENSION_ORDER:
        for candidate in result["candidate_claims"][dimension]:
            buckets[dimension].append(
                {
                    "federated_candidate_id": f"federated:P1.4_ADAPTER:{candidate['candidate_id']}",
                    "source_family": "P1.4_ADAPTER",
                    "source_candidate_id": candidate["candidate_id"],
                    "source_observation_id": candidate["observation_id"],
                    "source_record_schema": ADAPTER_RESULT_SCHEMA,
                    "dimension": dimension,
                    "claim": deepcopy(candidate["claim"]),
                }
            )
    return buckets


def _attestation_candidates(result: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    buckets = {name: [] for name in DIMENSION_ORDER}
    for candidate in result["identity_candidates"]:
        buckets["identity"].append(
            {
                "federated_candidate_id": f"federated:P1.8_ATTESTATION:{candidate['candidate_id']}",
                "source_family": "P1.8_ATTESTATION",
                "source_candidate_id": candidate["candidate_id"],
                "source_observation_id": candidate["observation_id"],
                "source_record_schema": ATTESTATION_RESULT_SCHEMA,
                "dimension": "identity",
                "claim": deepcopy(candidate["claim"]),
            }
        )
    return buckets


def federate_candidate_sources(record: dict[str, Any]) -> dict[str, Any]:
    """Federate source candidates without selecting, accepting, scoring or strengthening them."""
    validate_federation_input(record)
    adapter = record["adapter_result"]
    attestation = record["attestation_result"]
    per_source = {
        "P1.4_ADAPTER": _adapter_candidates(adapter),
        "P1.8_ATTESTATION": _attestation_candidates(attestation),
    }
    buckets = {name: [] for name in DIMENSION_ORDER}
    for family in record["source_order"]:
        for dimension in DIMENSION_ORDER:
            buckets[dimension].extend(deepcopy(per_source[family][dimension]))

    result = {
        "schema": FEDERATION_RESULT_SCHEMA,
        "artifact": deepcopy(adapter["artifact"]),
        "dimension_order": list(DIMENSION_ORDER),
        "source_order": deepcopy(record["source_order"]),
        "source_results": {
            "P1.4_ADAPTER": deepcopy(adapter),
            "P1.8_ATTESTATION": deepcopy(attestation),
        },
        "candidate_buckets": buckets,
        "auxiliary_attestations": {
            "role_attestations": deepcopy(attestation["role_attestations"]),
            "review_attestations": deepcopy(attestation["review_attestations"]),
        },
        "source_warnings": [
            *[
                {
                    "source_family": "P1.4_ADAPTER",
                    "code": item["code"],
                    "message": item["message"],
                }
                for item in adapter["warnings"]
            ],
            *[
                {
                    "source_family": "P1.8_ATTESTATION",
                    "code": item["code"],
                    "message": item["message"],
                }
                for item in attestation["warnings"]
            ],
        ],
        "federation_policy": {
            "federation_performs_acceptance": False,
            "source_count_establishes_confidence": False,
            "source_order_establishes_priority": False,
            "same_dimension_candidates_imply_consensus": False,
            "multiple_sources_imply_independent_witnesses": False,
            "cross_dimension_promotion_permitted": False,
            "auxiliary_attestations_are_candidates": False,
            "identity_to_authority_promotion_permitted": False,
            "truth_promotion_permitted": False,
            "aggregate_score_permitted": False,
            "aggregate_verdict_permitted": False,
        },
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_federation_result(result)
    return result


def _source_candidate_index(
    result: dict[str, Any],
) -> dict[tuple[str, str], tuple[str, dict[str, Any], str]]:
    index: dict[tuple[str, str], tuple[str, dict[str, Any], str]] = {}
    adapter = result["source_results"]["P1.4_ADAPTER"]
    for dimension in DIMENSION_ORDER:
        for candidate in adapter["candidate_claims"][dimension]:
            index[("P1.4_ADAPTER", candidate["candidate_id"])] = (
                dimension,
                candidate["claim"],
                candidate["observation_id"],
            )
    attestation = result["source_results"]["P1.8_ATTESTATION"]
    for candidate in attestation["identity_candidates"]:
        index[("P1.8_ATTESTATION", candidate["candidate_id"])] = (
            "identity",
            candidate["claim"],
            candidate["observation_id"],
        )
    return index


def validate_federation_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict), "federation result must be an object"
    assert set(result) == _RESULT_FIELDS, f"federation result fields changed: {set(result)}"
    assert result["schema"] == FEDERATION_RESULT_SCHEMA, "unsupported federation result schema"
    assert result["dimension_order"] == list(DIMENSION_ORDER), "dimension order changed"
    _validate_source_order(result["source_order"])
    assert set(result["source_results"]) == set(SOURCE_FAMILIES), "source_results families changed"
    validate_adapter_result(result["source_results"]["P1.4_ADAPTER"])
    validate_attestation_result(result["source_results"]["P1.8_ATTESTATION"])
    assert result["artifact"] == result["source_results"]["P1.4_ADAPTER"]["artifact"]
    assert result["artifact"] == result["source_results"]["P1.8_ATTESTATION"]["artifact"]
    assert set(result["candidate_buckets"]) == set(DIMENSION_ORDER), (
        "exactly seven candidate buckets required"
    )

    source_index = _source_candidate_index(result)
    seen_federated: set[str] = set()
    seen_source: set[tuple[str, str]] = set()
    for dimension in DIMENSION_ORDER:
        bucket = result["candidate_buckets"][dimension]
        assert isinstance(bucket, list), f"{dimension} candidate bucket must be an array"
        for item in bucket:
            assert set(item) == _FEDERATED_FIELDS, f"{dimension}: federated candidate fields changed"
            assert item["dimension"] == dimension, f"{dimension}: candidate crossed dimension"
            assert item["source_family"] in SOURCE_FAMILIES, f"{dimension}: unknown source family"
            source_key = (item["source_family"], item["source_candidate_id"])
            assert source_key in source_index, f"{dimension}: unknown source candidate {source_key}"
            expected_dimension, expected_claim, expected_observation = source_index[source_key]
            assert expected_dimension == dimension, f"{dimension}: source candidate dimension changed"
            assert item["source_observation_id"] == expected_observation, (
                f"{dimension}: source observation changed"
            )
            expected_schema = (
                ADAPTER_RESULT_SCHEMA
                if item["source_family"] == "P1.4_ADAPTER"
                else ATTESTATION_RESULT_SCHEMA
            )
            assert item["source_record_schema"] == expected_schema, f"{dimension}: source schema changed"
            assert item["claim"] == expected_claim, f"{dimension}: federation changed candidate semantics"
            validate_dimension(dimension, item["claim"])
            assert item["federated_candidate_id"] == (
                f"federated:{item['source_family']}:{item['source_candidate_id']}"
            ), f"{dimension}: unstable federated candidate id"
            assert item["federated_candidate_id"] not in seen_federated, (
                "duplicate federated candidate id"
            )
            assert source_key not in seen_source, "source candidate duplicated during federation"
            seen_federated.add(item["federated_candidate_id"])
            seen_source.add(source_key)

    assert seen_source == set(source_index), "federation omitted one or more source candidates"

    auxiliary = result["auxiliary_attestations"]
    assert set(auxiliary) == {"role_attestations", "review_attestations"}, (
        "auxiliary attestation fields changed"
    )
    assert auxiliary["role_attestations"] == result["source_results"]["P1.8_ATTESTATION"][
        "role_attestations"
    ]
    assert auxiliary["review_attestations"] == result["source_results"]["P1.8_ATTESTATION"][
        "review_attestations"
    ]

    expected_warnings = [
        *[
            {
                "source_family": "P1.4_ADAPTER",
                "code": item["code"],
                "message": item["message"],
            }
            for item in result["source_results"]["P1.4_ADAPTER"]["warnings"]
        ],
        *[
            {
                "source_family": "P1.8_ATTESTATION",
                "code": item["code"],
                "message": item["message"],
            }
            for item in result["source_results"]["P1.8_ATTESTATION"]["warnings"]
        ],
    ]
    assert isinstance(result["source_warnings"], list), "source_warnings must be an array"
    for warning in result["source_warnings"]:
        assert set(warning) == _SOURCE_WARNING_FIELDS, "source warning fields changed"
        assert warning["source_family"] in SOURCE_FAMILIES, "source warning family"
        assert isinstance(warning["code"], str) and warning["code"], "source warning code"
        assert isinstance(warning["message"], str) and warning["message"], "source warning message"
    assert result["source_warnings"] == expected_warnings, "source warnings changed or lost"

    policy = result["federation_policy"]
    assert set(policy) == {
        "federation_performs_acceptance",
        "source_count_establishes_confidence",
        "source_order_establishes_priority",
        "same_dimension_candidates_imply_consensus",
        "multiple_sources_imply_independent_witnesses",
        "cross_dimension_promotion_permitted",
        "auxiliary_attestations_are_candidates",
        "identity_to_authority_promotion_permitted",
        "truth_promotion_permitted",
        "aggregate_score_permitted",
        "aggregate_verdict_permitted",
    }
    assert all(value is False for value in policy.values())
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert_no_aggregate_semantic_collapse(_semantic_projection(result))
