#!/usr/bin/env python3
"""Adversarial presentation tests for P1.1 semantic separation."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from build import DIMENSION_ORDER, build_presentation, validate_fixture
from render import render

HERE = Path(__file__).resolve().parent


def load_fixture():
    return json.loads((HERE / "fixture.json").read_text(encoding="utf-8"))


def mutate_dimension(fixture, name, *, value=None, evaluation=None, evidence_refs=None):
    mutated = deepcopy(fixture)
    dimension = mutated["dimensions"][name]
    if value is not None:
        dimension["value"] = value
    if evaluation is not None:
        dimension["evaluation"] = evaluation
    if evidence_refs is not None:
        dimension["evidence_refs"] = evidence_refs
    return mutated


def assert_unchanged_except(before, after, changed_dimension):
    for name in DIMENSION_ORDER:
        if name != changed_dimension:
            assert before["dimensions"][name] == after["dimensions"][name], (
                changed_dimension,
                name,
            )


def expect_failure(fixture, needle):
    try:
        build_presentation(fixture)
    except AssertionError as exc:
        assert needle.lower() in str(exc).lower(), (needle, str(exc))
    else:
        raise AssertionError(f"expected failure containing {needle!r}")


def main():
    baseline_fixture = load_fixture()
    validate_fixture(baseline_fixture)
    baseline = build_presentation(baseline_fixture)

    assert baseline["dimensions"]["integrity"]["value"] == "VALID"
    assert baseline["dimensions"]["truth"]["value"] == "NOT_ESTABLISHED"
    assert baseline["dimensions"]["identity"]["value"] == "NOT_EVALUATED"
    assert baseline["dimensions"]["provenance"]["value"] == "CREDENTIALS_PRESENT"
    assert baseline["dimensions"]["availability"]["value"] == "UNAVAILABLE_BEFORE_CUTOFF"
    assert baseline["dimensions"]["authority"]["value"] == "HUMAN_PUBLICATION_AUTHORITY"
    assert baseline["dimensions"]["responsibility"]["value"] == "SCOPED_RESPONSIBILITY_PRESENT"
    assert baseline["related_observations"]["consideration"]["value"] == "NOT_USED"

    # 1. Integrity can change without strengthening truth.
    integrity_mutation = mutate_dimension(
        baseline_fixture,
        "integrity",
        value="INVALID",
        evaluation="SUPPORTED",
        evidence_refs=["test:integrity-invalid"],
    )
    integrity_view = build_presentation(integrity_mutation)
    assert integrity_view["dimensions"]["truth"] == baseline["dimensions"]["truth"]
    assert_unchanged_except(baseline, integrity_view, "integrity")

    # 2. Identity attestation does not grant authority.
    identity_mutation = mutate_dimension(
        baseline_fixture,
        "identity",
        value="ATTESTED",
        evaluation="SUPPORTED",
        evidence_refs=["test:identity-attestation"],
    )
    identity_view = build_presentation(identity_mutation)
    assert identity_view["dimensions"]["authority"] == baseline["dimensions"]["authority"]
    assert identity_view["dimensions"]["responsibility"] == baseline["dimensions"]["responsibility"]
    assert_unchanged_except(baseline, identity_view, "identity")

    # 3. Provenance can remain present while historical availability is unavailable.
    provenance_mutation = mutate_dimension(
        baseline_fixture,
        "provenance",
        value="CREDENTIALS_PRESENT",
        evaluation="OBSERVED",
        evidence_refs=["test:credentials-present"],
    )
    provenance_view = build_presentation(provenance_mutation)
    assert provenance_view["dimensions"]["availability"]["value"] == "UNAVAILABLE_BEFORE_CUTOFF"
    assert_unchanged_except(baseline, provenance_view, "provenance")

    # 4. Availability can become pre-cutoff available without consideration or authority changing.
    availability_mutation = mutate_dimension(
        baseline_fixture,
        "availability",
        value="AVAILABLE_BEFORE_CUTOFF",
        evaluation="SUPPORTED",
        evidence_refs=["test:pre-cutoff-resolution", "test:pre-cutoff-delivery"],
    )
    availability_view = build_presentation(availability_mutation)
    assert availability_view["related_observations"]["consideration"]["value"] == "NOT_USED"
    assert availability_view["dimensions"]["authority"] == baseline["dimensions"]["authority"]
    assert_unchanged_except(baseline, availability_view, "availability")

    # 5. Warning/dispute state does not rewrite integrity.
    disputed_fixture = deepcopy(baseline_fixture)
    disputed_fixture["warnings"].append(
        {"code": "CLAIM_DISPUTED", "message": "A claim is disputed without altering artifact integrity."}
    )
    disputed_fixture["disputes"].append(
        {"id": "dispute-1", "target": "claim-1", "status": "open"}
    )
    disputed_view = build_presentation(disputed_fixture)
    assert disputed_view["dimensions"]["integrity"] == baseline["dimensions"]["integrity"]
    assert disputed_view["dimensions"]["truth"] == baseline["dimensions"]["truth"]

    # 6. Missing identity evidence must stay NOT_EVALUATED.
    missing_identity = deepcopy(baseline_fixture)
    missing_identity["dimensions"]["identity"]["value"] = "anonymous"
    expect_failure(missing_identity, "NOT_EVALUATED")
    missing_identity = deepcopy(baseline_fixture)
    missing_identity["dimensions"]["identity"]["evidence_refs"] = ["fabricated:identity"]
    expect_failure(missing_identity, "must not fabricate evidence")

    # 7. Aggregate fields and verdicts fail closed.
    aggregate = deepcopy(baseline_fixture)
    aggregate["trust_score"] = 0.99
    expect_failure(aggregate, "forbidden aggregate")
    aggregate = deepcopy(baseline_fixture)
    aggregate["aggregate_score_present"] = True
    expect_failure(aggregate, "false")

    # Reference HTML is deterministic, seven-dimensional, and semantically non-scalar.
    rendered = render(baseline)
    snapshot = (HERE / "reference.html").read_text(encoding="utf-8")
    assert rendered == snapshot, "reference HTML snapshot drift"
    assert rendered.count('data-dimension="') == 7
    for name in DIMENSION_ORDER:
        assert f'data-dimension="{name}"' in rendered
    for forbidden in (
        "Verified True",
        "trust score",
        "truth score",
        "overall verdict",
    ):
        assert forbidden.lower() not in rendered.lower(), forbidden

    print("P1.1 seven-dimension semantic separation: PASS")
    print("integrity != truth")
    print("identity != authority")
    print("provenance != historical availability")
    print("availability != consideration != authority")
    print("warning/dispute != artifact invalidity")
    print("aggregate trust/truth verdict -> FORBIDDEN")


if __name__ == "__main__":
    main()
