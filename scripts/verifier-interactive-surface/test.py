#!/usr/bin/env python3
"""P1.3 fail-closed interactive verifier contract and browser equivalence tests."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from copy import deepcopy
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation import (  # noqa: E402
    DIMENSION_ORDER,
    normalize_interactive_input,
    validate_interactive_input,
)

FIXTURE = HERE / "fixture.json"
APP = HERE / "app.js"
BROWSER_TEST = HERE / "test-browser.js"


def load_fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def expect_failure(record, label):
    try:
        normalize_interactive_input(record)
    except (AssertionError, KeyError, TypeError):
        return
    raise AssertionError(f"expected failure: {label}")


def main() -> None:
    fixture = load_fixture()
    validate_interactive_input(fixture)
    baseline = normalize_interactive_input(fixture)

    assert tuple(baseline["dimension_order"]) == DIMENSION_ORDER
    assert set(baseline["dimensions"]) == set(DIMENSION_ORDER)
    assert baseline["dimensions"]["identity"]["value"] == "NOT_EVALUATED"
    assert baseline["aggregate_score_present"] is False
    assert baseline["aggregate_verdict_present"] is False

    # Opaque evidence metadata is data, not verifier semantics.
    opaque_mutation = deepcopy(fixture)
    opaque_mutation["evidence_items"][0]["payload"] = {
        "verified": False,
        "verified_true": False,
        "trust_score": 0.01,
        "arbitrary_external_field": "still opaque",
    }
    opaque_view = normalize_interactive_input(opaque_mutation)
    assert opaque_view["dimensions"] == baseline["dimensions"]

    duplicate = deepcopy(fixture)
    duplicate["evidence_items"].append(deepcopy(duplicate["evidence_items"][0]))
    expect_failure(duplicate, "duplicate evidence id")

    undeclared = deepcopy(fixture)
    undeclared["dimension_claims"]["integrity"]["evidence_refs"] = ["evidence:not-declared"]
    expect_failure(undeclared, "undeclared evidence ref")

    missing_dimension = deepcopy(fixture)
    del missing_dimension["dimension_claims"]["truth"]
    expect_failure(missing_dimension, "missing dimension")

    extra_dimension = deepcopy(fixture)
    extra_dimension["dimension_claims"]["reputation"] = deepcopy(extra_dimension["dimension_claims"]["truth"])
    expect_failure(extra_dimension, "extra dimension")

    not_evaluated_with_evidence = deepcopy(fixture)
    not_evaluated_with_evidence["dimension_claims"]["identity"]["evidence_refs"] = ["evidence:identity-attestation"]
    expect_failure(not_evaluated_with_evidence, "NOT_EVALUATED with evidence")

    aggregate = deepcopy(fixture)
    aggregate["trust_score"] = 0.99
    expect_failure(aggregate, "aggregate field")

    dimension_aggregate = deepcopy(fixture)
    dimension_aggregate["dimension_claims"]["integrity"]["overall_verdict"] = "pass"
    expect_failure(dimension_aggregate, "dimension aggregate field")

    identity_mutation = deepcopy(fixture)
    identity_mutation["dimension_claims"]["identity"] = {
        "value": "ATTESTED",
        "evaluation": "SUPPORTED",
        "source_layer": "declared-input/example",
        "evidence_refs": ["evidence:identity-attestation"],
        "explanation": "Synthetic explicit identity attestation for isolation testing.",
        "does_not_establish": ["authorship", "authority", "responsibility", "factual truth"],
    }
    identity_view = normalize_interactive_input(identity_mutation)
    assert identity_view["dimensions"]["authority"] == baseline["dimensions"]["authority"]
    assert identity_view["dimensions"]["responsibility"] == baseline["dimensions"]["responsibility"]

    provenance_mutation = deepcopy(fixture)
    provenance_mutation["dimension_claims"]["provenance"] = {
        "value": "NOT_SUPPORTED",
        "evaluation": "NOT_SUPPORTED",
        "source_layer": "declared-input/example",
        "evidence_refs": ["evidence:provenance-origin"],
        "explanation": "Synthetic provenance mutation for isolation testing.",
        "does_not_establish": ["availability", "authority", "responsibility", "factual truth"],
    }
    provenance_view = normalize_interactive_input(provenance_mutation)
    assert provenance_view["dimensions"]["availability"] == baseline["dimensions"]["availability"]
    assert provenance_view["dimensions"]["truth"] == baseline["dimensions"]["truth"]

    xss_shape = deepcopy(fixture)
    xss_shape["artifact"]["description"] = '<img src=x onerror="alert(1)">'
    xss_view = normalize_interactive_input(xss_shape)
    assert xss_view["artifact"]["description"] == xss_shape["artifact"]["description"]

    app_source = APP.read_text(encoding="utf-8")
    for forbidden in (
        "fetch(",
        "XMLHttpRequest",
        "WebSocket",
        "EventSource",
        "sendBeacon",
        "innerHTML",
        "outerHTML",
        "insertAdjacentHTML",
        "eval(",
        "Function(",
        "http://",
        "https://",
    ):
        assert forbidden not in app_source, f"browser-local boundary violated by {forbidden}"
    assert "textContent" in app_source
    assert "FileReader" in app_source

    with tempfile.TemporaryDirectory() as temp_dir:
        browser_output = Path(temp_dir) / "browser-result.json"
        subprocess.run(
            ["node", str(BROWSER_TEST), str(FIXTURE), str(browser_output)],
            cwd=REPO_ROOT,
            check=True,
        )
        browser_result = json.loads(browser_output.read_text(encoding="utf-8"))
        assert browser_result == baseline, "browser normalizer drifted from canonical Python result"

    print("P1.3 canonical Python == browser normalizer: PASS")
    print("opaque evidence != semantic promotion")
    print("identity != authority != responsibility")
    print("provenance != availability != truth")
    print("local input -> no network/model dependency")


if __name__ == "__main__":
    main()
