"""Canonical reusable implementation of the UU-AAP seven-dimension verifier presentation contract."""

from __future__ import annotations

import html
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


def esc(value: Any) -> str:
    return html.escape(str(value), quote=True)


def list_items(values: list[str]) -> str:
    return "".join(f"<li>{esc(value)}</li>" for value in values)


def render(presentation: dict[str, Any]) -> str:
    validate_presentation(presentation)
    dimension_sections = []
    for name in DIMENSION_ORDER:
        dimension = presentation["dimensions"][name]
        evidence = dimension["evidence_refs"]
        evidence_html = list_items(evidence) if evidence else "<li>None supplied</li>"
        non_effects_html = list_items(dimension["does_not_establish"])
        dimension_sections.append(
            "\n".join([
                f'<section data-dimension="{esc(name)}" aria-labelledby="dimension-{esc(name)}">',
                f'  <h2 id="dimension-{esc(name)}">{esc(name.title())}</h2>',
                "  <dl>",
                f'    <dt>Value</dt><dd>{esc(dimension["value"])}</dd>',
                f'    <dt>Evaluation</dt><dd>{esc(dimension["evaluation"])}</dd>',
                f'    <dt>Source layer</dt><dd>{esc(dimension["source_layer"])}</dd>',
                "  </dl>",
                f'  <p>{esc(dimension["explanation"])}</p>',
                "  <h3>Evidence references</h3>",
                f"  <ul>{evidence_html}</ul>",
                "  <h3>Does not establish</h3>",
                f"  <ul>{non_effects_html}</ul>",
                "</section>",
            ])
        )

    warnings = presentation["warnings"]
    warning_html = (
        "".join(f'<li><strong>{esc(item["code"])}</strong>: {esc(item["message"])}</li>' for item in warnings)
        if warnings else "<li>None recorded</li>"
    )
    disputes = presentation["disputes"]
    dispute_html = (
        "".join(f"<li>{esc(json.dumps(item, sort_keys=True, ensure_ascii=False))}</li>" for item in disputes)
        if disputes else "<li>None recorded</li>"
    )
    consideration = presentation["related_observations"].get("consideration", {})
    consideration_value = consideration.get("value", "NOT_EVALUATED")
    lines = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Layered Verifier Reference</title>",
        "</head>",
        "<body>",
        "  <header>",
        "    <h1>Layered Verifier Reference</h1>",
        "    <p>Seven independent evidence dimensions. No aggregate trust or truth verdict is produced.</p>",
        f'    <p>Artifact: <code>{esc(presentation["artifact"]["id"])}</code></p>',
        "  </header>",
        "  <main>",
        *["    " + line for section in dimension_sections for line in section.splitlines()],
        '    <section aria-labelledby="related-observations">',
        '      <h2 id="related-observations">Related observations</h2>',
        f'      <p>Consideration: <strong>{esc(consideration_value)}</strong></p>',
        "    </section>",
        '    <section aria-labelledby="warnings">',
        '      <h2 id="warnings">Warnings</h2>',
        f"      <ul>{warning_html}</ul>",
        "    </section>",
        '    <section aria-labelledby="disputes">',
        '      <h2 id="disputes">Disputes</h2>',
        f"      <ul>{dispute_html}</ul>",
        "    </section>",
        "  </main>",
        "  <footer>",
        "    <p>Reference presentation only; each dimension retains its own evidence and non-effects.</p>",
        "  </footer>",
        "</body>",
        "</html>",
        "",
    ]
    output = "\n".join(lines)
    lowered = output.lower()
    for phrase in (
        "verified true",
        "trust score",
        "truth score",
        "overall trust",
        "overall verdict",
        "umbrella verified",
    ):
        assert phrase not in lowered, f"forbidden aggregate phrase rendered: {phrase}"
    assert output.count('data-dimension="') == 7
    return output
