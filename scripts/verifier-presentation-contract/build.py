#!/usr/bin/env python3
"""Build and validate the P1.1 seven-dimension verifier presentation contract."""

from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

DIMENSION_ORDER = (
    "integrity",
    "identity",
    "provenance",
    "availability",
    "authority",
    "responsibility",
    "truth",
)

EVALUATION_STATES = {
    "OBSERVED",
    "SUPPORTED",
    "NOT_SUPPORTED",
    "UNKNOWN",
    "NOT_EVALUATED",
    "NOT_APPLICABLE",
}

FORBIDDEN_KEYS = {
    "overall_trust",
    "trust_score",
    "truth_score",
    "reputation_score",
    "reliability_score",
    "confidence_score",
    "compatibility_score",
    "overall_verdict",
    "verified",
    "verified_true",
}

ALLOWED_AGGREGATE_FLAGS = {
    "aggregate_score_present",
    "aggregate_verdict_present",
}


def load_json(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def walk(value: Any, path: str = ""):
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            yield child_path, key, child
            yield from walk(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f"{path}[{index}]")


def assert_no_aggregate_semantic_collapse(value: Any) -> None:
    for path, key, child in walk(value):
        normalized = key.lower().replace("-", "_").replace(" ", "_")
        if normalized in ALLOWED_AGGREGATE_FLAGS:
            assert child is False, f"{path} must remain false"
            continue
        assert normalized not in FORBIDDEN_KEYS, f"forbidden aggregate/verdict field: {path}"


def validate_dimension(name: str, dimension: dict[str, Any]) -> None:
    required = {
        "value",
        "evaluation",
        "source_layer",
        "evidence_refs",
        "explanation",
        "does_not_establish",
    }
    assert set(dimension) == required, f"{name}: dimension fields changed: {set(dimension)}"
    assert isinstance(dimension["value"], str) and dimension["value"], f"{name}: empty value"
    assert dimension["evaluation"] in EVALUATION_STATES, f"{name}: invalid evaluation"
    assert isinstance(dimension["source_layer"], str) and dimension["source_layer"], f"{name}: source_layer"
    assert isinstance(dimension["evidence_refs"], list), f"{name}: evidence_refs"
    assert isinstance(dimension["explanation"], str) and dimension["explanation"], f"{name}: explanation"
    assert isinstance(dimension["does_not_establish"], list) and dimension["does_not_establish"], f"{name}: non-effects required"
    assert all(isinstance(item, str) and item for item in dimension["does_not_establish"]), f"{name}: non-effect item"

    if dimension["evaluation"] == "NOT_EVALUATED":
        assert dimension["value"] == "NOT_EVALUATED", f"{name}: missing evidence must render NOT_EVALUATED"
        assert dimension["evidence_refs"] == [], f"{name}: NOT_EVALUATED must not fabricate evidence"
    else:
        assert dimension["evidence_refs"], f"{name}: evaluated dimension needs evidence refs"


def validate_fixture(fixture: dict[str, Any]) -> None:
    assert fixture["schema"] == "urn:uu-aap:layered-verifier-presentation-fixture:0.1"
    assert fixture["issue"] == 796
    assert fixture["repository_predecessor_main"] == "b09f8047140f7966bcb38ce9339b7cc6bc7404a7"
    assert fixture["scenario"]["kind"] == "synthetic_cross_surface_reference"
    assert set(fixture["dimensions"]) == set(DIMENSION_ORDER), "exactly seven semantic dimensions are required"
    for name in DIMENSION_ORDER:
        validate_dimension(name, fixture["dimensions"][name])

    assert fixture["aggregate_score_present"] is False, "aggregate_score_present must remain false"
    assert fixture["aggregate_verdict_present"] is False, "aggregate_verdict_present must remain false"
    assert all(value is False for value in fixture["non_effects"].values())
    assert_no_aggregate_semantic_collapse(fixture)


def build_presentation(fixture: dict[str, Any]) -> dict[str, Any]:
    validate_fixture(fixture)
    dimensions = {name: deepcopy(fixture["dimensions"][name]) for name in DIMENSION_ORDER}

    presentation = {
        "schema": "urn:uu-aap:layered-verifier-presentation:0.1",
        "issue": fixture["issue"],
        "artifact": {
            "id": fixture["scenario"]["artifact_id"],
            "scenario_kind": fixture["scenario"]["kind"],
            "description": fixture["scenario"]["description"],
        },
        "dimension_order": list(DIMENSION_ORDER),
        "dimensions": dimensions,
        "related_observations": deepcopy(fixture["related_observations"]),
        "warnings": deepcopy(fixture["warnings"]),
        "disputes": deepcopy(fixture["disputes"]),
        "source_bindings": deepcopy(fixture["source_bindings"]),
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
    validate_presentation(presentation)
    return presentation


def validate_presentation(presentation: dict[str, Any]) -> None:
    assert presentation["schema"] == "urn:uu-aap:layered-verifier-presentation:0.1"
    assert presentation["dimension_order"] == list(DIMENSION_ORDER)
    assert set(presentation["dimensions"]) == set(DIMENSION_ORDER)
    for name in DIMENSION_ORDER:
        validate_dimension(name, presentation["dimensions"][name])
    assert presentation["aggregate_score_present"] is False, "aggregate_score_present must remain false"
    assert presentation["aggregate_verdict_present"] is False, "aggregate_verdict_present must remain false"
    assert all(value is False for value in presentation["presentation_policy"].values())
    assert_no_aggregate_semantic_collapse(presentation)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture")
    parser.add_argument("--output")
    args = parser.parse_args()

    presentation = build_presentation(load_json(args.fixture))
    rendered = json.dumps(presentation, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
