#!/usr/bin/env python3
"""P1.4 bounded evidence adapter and cross-runtime semantic-isolation tests."""

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
    adapt_evidence,
    normalize_interactive_input,
    validate_adapter_input,
    validate_adapter_result,
)

FIXTURE = HERE / "fixture.json"
APP = HERE / "app.js"
BROWSER_TEST = HERE / "test-browser.js"


def load_fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def expect_failure(callable_, label):
    try:
        callable_()
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError(f"expected failure: {label}")


def candidate_counts(result):
    return {name: len(result["candidate_claims"][name]) for name in DIMENSION_ORDER}


def main() -> None:
    fixture = load_fixture()
    validate_adapter_input(fixture)
    baseline = adapt_evidence(fixture)
    validate_adapter_result(baseline)

    assert tuple(baseline["dimension_order"]) == DIMENSION_ORDER
    assert candidate_counts(baseline) == {
        "integrity": 0,
        "identity": 0,
        "provenance": 1,
        "availability": 1,
        "authority": 1,
        "responsibility": 1,
        "truth": 0,
    }
    assert baseline["candidate_claims"]["provenance"][0]["claim"]["value"] == "CREDENTIALS_PRESENT"
    assert baseline["candidate_claims"]["availability"][0]["claim"]["value"] == "UNAVAILABLE_BEFORE_CUTOFF"
    assert baseline["candidate_claims"]["authority"][0]["claim"]["value"] == "SCOPED_AUTHORITY_ACCEPTED"
    assert baseline["candidate_claims"]["responsibility"][0]["claim"]["value"] == "SCOPED_RESPONSIBILITY_PRESENT"
    assert baseline["unmapped_observations"] == ["obs-unknown-1"]
    assert baseline["adapter_policy"]["candidate_claims_require_explicit_acceptance"] is True
    assert baseline["adapter_policy"]["auto_acceptance_permitted"] is False
    assert baseline["aggregate_score_present"] is False
    assert baseline["aggregate_verdict_present"] is False

    opaque_mutation = deepcopy(fixture)
    opaque_mutation["observations"][0]["payload"]["verified"] = False
    opaque_mutation["observations"][0]["payload"]["trust_score"] = 0.01
    opaque_mutation["observations"][0]["payload"]["signer_label"] = "Different signer label"
    opaque_mutation["observations"][1]["payload"]["verified_true"] = False
    opaque_view = adapt_evidence(opaque_mutation)
    assert opaque_view["candidate_claims"] == baseline["candidate_claims"]

    unknown_only = deepcopy(fixture)
    unknown_only["observations"] = [deepcopy(fixture["observations"][-1])]
    unknown_view = adapt_evidence(unknown_only)
    assert all(not unknown_view["candidate_claims"][name] for name in DIMENSION_ORDER)
    assert unknown_view["unmapped_observations"] == ["obs-unknown-1"]

    invalid_c2pa = deepcopy(fixture)
    del invalid_c2pa["observations"][0]["payload"]["hasCredentials"]
    expect_failure(lambda: adapt_evidence(invalid_c2pa), "malformed C2PA payload")

    wrong_layer = deepcopy(fixture)
    wrong_layer["observations"][0]["source_layer"] = "UU-AAP"
    expect_failure(lambda: adapt_evidence(wrong_layer), "adapter source-layer mismatch")

    duplicate = deepcopy(fixture)
    duplicate["observations"].append(deepcopy(duplicate["observations"][0]))
    expect_failure(lambda: adapt_evidence(duplicate), "duplicate observation id")

    promoted = deepcopy(baseline)
    c2pa_candidate = promoted["candidate_claims"]["provenance"].pop()
    promoted["candidate_claims"]["truth"].append(c2pa_candidate)
    expect_failure(lambda: validate_adapter_result(promoted), "C2PA provenance promoted into truth")

    promoted = deepcopy(baseline)
    poai_candidate = promoted["candidate_claims"]["availability"].pop()
    promoted["candidate_claims"]["authority"].append(poai_candidate)
    expect_failure(lambda: validate_adapter_result(promoted), "PoAI availability promoted into authority")

    promoted = deepcopy(baseline)
    authority_candidate = promoted["candidate_claims"]["authority"].pop()
    promoted["candidate_claims"]["responsibility"].append(authority_candidate)
    expect_failure(lambda: validate_adapter_result(promoted), "authority promoted into responsibility")

    plural = deepcopy(fixture)
    second_c2pa = deepcopy(plural["observations"][0])
    second_c2pa["id"] = "obs-c2pa-2"
    second_c2pa["summary"] = "Second bounded C2PA observation."
    second_c2pa["payload"]["hasCredentials"] = False
    second_c2pa["payload"]["manifestData_present"] = False
    plural["observations"].append(second_c2pa)
    plural_view = adapt_evidence(plural)
    assert len(plural_view["candidate_claims"]["provenance"]) == 2
    assert {item["claim"]["value"] for item in plural_view["candidate_claims"]["provenance"]} == {
        "CREDENTIALS_PRESENT",
        "NO_SUPPORTED_CREDENTIALS_OBSERVED",
    }
    assert plural_view["aggregate_score_present"] is False
    assert plural_view["aggregate_verdict_present"] is False

    expect_failure(lambda: normalize_interactive_input(baseline), "candidate result auto-accepted as interactive input")

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
        assert browser_result == baseline, "browser adapter drifted from canonical Python result"

    print("P1.4 canonical Python == browser adapter: PASS")
    print("external observation -> bounded adapter -> candidate claim != accepted claim")
    print("C2PA -> provenance only; PoAI -> availability only")
    print("UU-AAP authority != responsibility; truth remains unpopulated")
    print("unknown adapter -> UNMAPPED; conflicting candidates remain plural")


if __name__ == "__main__":
    main()
