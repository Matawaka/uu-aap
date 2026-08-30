"""Fail-closed interactive input validation for the UU-AAP seven-dimension verifier."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .core import (
    DIMENSION_ORDER,
    assert_no_aggregate_semantic_collapse,
    validate_dimension,
)

INTERACTIVE_INPUT_SCHEMA = "urn:uu-aap:interactive-verifier-input:0.1"
INTERACTIVE_RESULT_SCHEMA = "urn:uu-aap:interactive-verifier-result:0.1"

_INPUT_FIELDS = {
    "schema",
    "artifact",
    "evidence_items",
    "dimension_claims",
    "related_observations",
    "warnings",
    "disputes",
}
_ARTIFACT_FIELDS = {"id", "description"}
_EVIDENCE_FIELDS = {"id", "kind", "source_layer", "summary", "payload"}
_WARNING_FIELDS = {"code", "message"}
_RESULT_FIELDS = {
    "schema",
    "artifact",
    "dimension_order",
    "dimensions",
    "evidence_items",
    "related_observations",
    "warnings",
    "disputes",
    "presentation_policy",
    "aggregate_score_present",
    "aggregate_verdict_present",
}


def _semantic_projection(value: dict[str, Any]) -> dict[str, Any]:
    """Exclude opaque evidence payloads from semantic-key scanning without interpreting them."""
    projected = deepcopy(value)
    for item in projected.get("evidence_items", []):
        if isinstance(item, dict) and "payload" in item:
            item["payload"] = {}
    return projected


def _validate_artifact(artifact: Any) -> None:
    assert isinstance(artifact, dict), "artifact must be an object"
    assert set(artifact) == _ARTIFACT_FIELDS, f"artifact fields changed: {set(artifact)}"
    assert isinstance(artifact["id"], str) and artifact["id"], "artifact.id must be non-empty"
    assert isinstance(artifact["description"], str) and artifact["description"], "artifact.description must be non-empty"


def _validate_warnings(warnings: Any) -> None:
    assert isinstance(warnings, list), "warnings must be an array"
    for index, warning in enumerate(warnings):
        assert isinstance(warning, dict), f"warnings[{index}] must be an object"
        assert set(warning) == _WARNING_FIELDS, f"warnings[{index}] fields changed"
        assert isinstance(warning["code"], str) and warning["code"], f"warnings[{index}].code"
        assert isinstance(warning["message"], str) and warning["message"], f"warnings[{index}].message"


def _validate_disputes(disputes: Any) -> None:
    assert isinstance(disputes, list), "disputes must be an array"
    assert all(isinstance(item, dict) for item in disputes), "each dispute must be an object"


def _validate_evidence_items(items: Any) -> set[str]:
    assert isinstance(items, list), "evidence_items must be an array"
    evidence_ids: set[str] = set()
    for index, item in enumerate(items):
        assert isinstance(item, dict), f"evidence_items[{index}] must be an object"
        assert set(item) == _EVIDENCE_FIELDS, f"evidence_items[{index}] fields changed: {set(item)}"
        for field in ("id", "kind", "source_layer", "summary"):
            assert isinstance(item[field], str) and item[field], f"evidence_items[{index}].{field}"
        assert isinstance(item["payload"], dict), f"evidence_items[{index}].payload must be an object"
        assert item["id"] not in evidence_ids, f"duplicate evidence id: {item['id']}"
        evidence_ids.add(item["id"])
    return evidence_ids


def validate_interactive_input(record: dict[str, Any]) -> None:
    """Validate explicit claims without deriving any claim from evidence payload content."""
    assert isinstance(record, dict), "interactive input must be an object"
    assert set(record) == _INPUT_FIELDS, f"interactive input fields changed: {set(record)}"
    assert record["schema"] == INTERACTIVE_INPUT_SCHEMA, "unsupported interactive input schema"

    _validate_artifact(record["artifact"])
    evidence_ids = _validate_evidence_items(record["evidence_items"])

    dimensions = record["dimension_claims"]
    assert isinstance(dimensions, dict), "dimension_claims must be an object"
    assert set(dimensions) == set(DIMENSION_ORDER), "exactly seven semantic dimensions are required"
    for name in DIMENSION_ORDER:
        validate_dimension(name, dimensions[name])
        for evidence_ref in dimensions[name]["evidence_refs"]:
            assert evidence_ref in evidence_ids, f"{name}: undeclared evidence ref: {evidence_ref}"

    assert isinstance(record["related_observations"], dict), "related_observations must be an object"
    _validate_warnings(record["warnings"])
    _validate_disputes(record["disputes"])

    # Evidence payloads are intentionally opaque. Semantic keys outside payloads remain fail-closed.
    assert_no_aggregate_semantic_collapse(_semantic_projection(record))


def normalize_interactive_input(record: dict[str, Any]) -> dict[str, Any]:
    """Create a deterministic interactive result by copying explicit claims only."""
    validate_interactive_input(record)
    result = {
        "schema": INTERACTIVE_RESULT_SCHEMA,
        "artifact": deepcopy(record["artifact"]),
        "dimension_order": list(DIMENSION_ORDER),
        "dimensions": {name: deepcopy(record["dimension_claims"][name]) for name in DIMENSION_ORDER},
        "evidence_items": deepcopy(record["evidence_items"]),
        "related_observations": deepcopy(record["related_observations"]),
        "warnings": deepcopy(record["warnings"]),
        "disputes": deepcopy(record["disputes"]),
        "presentation_policy": {
            "color_only_semantics_permitted": False,
            "umbrella_verified_badge_permitted": False,
            "cross_dimension_promotion_permitted": False,
            "aggregate_score_permitted": False,
            "aggregate_verdict_permitted": False,
        },
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_interactive_result(result)
    return result


def validate_interactive_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict), "interactive result must be an object"
    assert set(result) == _RESULT_FIELDS, f"interactive result fields changed: {set(result)}"
    assert result["schema"] == INTERACTIVE_RESULT_SCHEMA, "unsupported interactive result schema"
    _validate_artifact(result["artifact"])
    assert result["dimension_order"] == list(DIMENSION_ORDER), "dimension order changed"
    evidence_ids = _validate_evidence_items(result["evidence_items"])
    assert set(result["dimensions"]) == set(DIMENSION_ORDER), "exactly seven semantic dimensions are required"
    for name in DIMENSION_ORDER:
        validate_dimension(name, result["dimensions"][name])
        for evidence_ref in result["dimensions"][name]["evidence_refs"]:
            assert evidence_ref in evidence_ids, f"{name}: undeclared evidence ref: {evidence_ref}"
    assert isinstance(result["related_observations"], dict), "related_observations must be an object"
    _validate_warnings(result["warnings"])
    _validate_disputes(result["disputes"])
    assert set(result["presentation_policy"]) == {
        "color_only_semantics_permitted",
        "umbrella_verified_badge_permitted",
        "cross_dimension_promotion_permitted",
        "aggregate_score_permitted",
        "aggregate_verdict_permitted",
    }
    assert all(value is False for value in result["presentation_policy"].values())
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert_no_aggregate_semantic_collapse(_semantic_projection(result))
