#!/usr/bin/env python3
"""P1.5 explicit candidate acceptance and cross-runtime materialization tests."""

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
    build_acceptance_input,
    materialize_candidate_acceptance,
    normalize_interactive_input,
    validate_acceptance_input,
    validate_acceptance_result,
    validate_interactive_input,
)

ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
DECISION_FIXTURE = HERE / "decision.fixture.json"
APP = HERE / "app.js"
BROWSER_TEST = HERE / "test-browser.js"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def expect_failure(callable_, label):
    try:
        callable_()
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError(f"expected failure: {label}")


def make_input(adapter_input=None, event=None):
    adapter_input = deepcopy(adapter_input if adapter_input is not None else load_json(ADAPTER_FIXTURE))
    event = deepcopy(event if event is not None else load_json(DECISION_FIXTURE))
    adapter_result = adapt_evidence(adapter_input)
    return build_acceptance_input(adapter_result, event)


def decision_map(event):
    return {item["candidate_id"]: item for item in event["dispositions"]}


def main() -> None:
    adapter_fixture = load_json(ADAPTER_FIXTURE)
    decision_fixture = load_json(DECISION_FIXTURE)
    acceptance_input = make_input(adapter_fixture, decision_fixture)
    validate_acceptance_input(acceptance_input)
    baseline = materialize_candidate_acceptance(acceptance_input)
    validate_acceptance_result(baseline)

    assert baseline["accepted_candidate_ids"] == [
        "candidate:obs-c2pa-1:provenance",
        "candidate:obs-poai-1:availability",
        "candidate:obs-authority-1:authority",
        "candidate:obs-responsibility-1:responsibility",
    ]
    assert baseline["rejected_candidate_ids"] == []
    assert baseline["deferred_candidate_ids"] == []
    materialized = baseline["materialized_interactive_input"]
    validate_interactive_input(materialized)
    assert materialized["dimension_claims"]["integrity"]["value"] == "NOT_EVALUATED"
    assert materialized["dimension_claims"]["identity"]["value"] == "NOT_EVALUATED"
    assert materialized["dimension_claims"]["provenance"]["value"] == "CREDENTIALS_PRESENT"
    assert materialized["dimension_claims"]["availability"]["value"] == "UNAVAILABLE_BEFORE_CUTOFF"
    assert materialized["dimension_claims"]["authority"]["value"] == "SCOPED_AUTHORITY_ACCEPTED"
    assert materialized["dimension_claims"]["responsibility"]["value"] == "SCOPED_RESPONSIBILITY_PRESENT"
    assert materialized["dimension_claims"]["truth"]["value"] == "NOT_EVALUATED"
    assert baseline["acceptance_policy"]["actor_ref_establishes_identity"] is False
    assert baseline["acceptance_policy"]["actor_ref_establishes_authority"] is False
    assert baseline["acceptance_policy"]["acceptance_strengthens_claim_semantics"] is False
    assert baseline["aggregate_score_present"] is False
    assert baseline["aggregate_verdict_present"] is False

    receipt_id = "evidence:acceptance:p15:001"
    assert any(item["id"] == receipt_id for item in materialized["evidence_items"])
    adapter_result = acceptance_input["adapter_result"]
    for dimension in ("provenance", "availability", "authority", "responsibility"):
        original = adapter_result["candidate_claims"][dimension][0]["claim"]
        accepted = materialized["dimension_claims"][dimension]
        assert accepted["value"] == original["value"]
        assert accepted["evaluation"] == original["evaluation"]
        assert accepted["source_layer"] == original["source_layer"]
        assert accepted["explanation"] == original["explanation"]
        assert accepted["does_not_establish"] == original["does_not_establish"]
        assert accepted["evidence_refs"] == [*original["evidence_refs"], receipt_id]

    omitted = deepcopy(acceptance_input)
    omitted["acceptance_event"]["dispositions"].pop()
    expect_failure(lambda: materialize_candidate_acceptance(omitted), "omitted candidate disposition")

    duplicate = deepcopy(acceptance_input)
    duplicate["acceptance_event"]["dispositions"].append(
        deepcopy(duplicate["acceptance_event"]["dispositions"][0])
    )
    expect_failure(lambda: materialize_candidate_acceptance(duplicate), "duplicate candidate disposition")

    unknown = deepcopy(acceptance_input)
    unknown["acceptance_event"]["dispositions"][0]["candidate_id"] = "candidate:not-present"
    expect_failure(lambda: materialize_candidate_acceptance(unknown), "unknown candidate disposition")

    bad_scope = deepcopy(acceptance_input)
    bad_scope["acceptance_event"]["scope"] = "publication_authority"
    expect_failure(lambda: materialize_candidate_acceptance(bad_scope), "acceptance scope expansion")

    selective_event = deepcopy(decision_fixture)
    selective = decision_map(selective_event)
    selective["candidate:obs-poai-1:availability"]["decision"] = "REJECT"
    selective["candidate:obs-poai-1:availability"]["rationale"] = "Do not materialize this candidate in this local verifier record."
    selective["candidate:obs-authority-1:authority"]["decision"] = "DEFER"
    selective["candidate:obs-authority-1:authority"]["rationale"] = "Authority candidate requires separate review."
    selective["candidate:obs-responsibility-1:responsibility"]["decision"] = "REJECT"
    selective["candidate:obs-responsibility-1:responsibility"]["rationale"] = "Responsibility candidate is not selected for this materialization."
    selective_result = materialize_candidate_acceptance(make_input(adapter_fixture, selective_event))
    selective_claims = selective_result["materialized_interactive_input"]["dimension_claims"]
    assert selective_claims["provenance"]["value"] == "CREDENTIALS_PRESENT"
    assert selective_claims["availability"]["value"] == "NOT_EVALUATED"
    assert selective_claims["authority"]["value"] == "NOT_EVALUATED"
    assert selective_claims["responsibility"]["value"] == "NOT_EVALUATED"
    assert selective_claims["truth"]["value"] == "NOT_EVALUATED"
    assert selective_result["rejected_candidate_ids"] == [
        "candidate:obs-poai-1:availability",
        "candidate:obs-responsibility-1:responsibility",
    ]
    assert selective_result["deferred_candidate_ids"] == ["candidate:obs-authority-1:authority"]

    authority_only_event = deepcopy(decision_fixture)
    for item in authority_only_event["dispositions"]:
        if item["candidate_id"] == "candidate:obs-authority-1:authority":
            item["decision"] = "ACCEPT"
            item["rationale"] = "Materialize only the authority candidate."
        else:
            item["decision"] = "REJECT"
            item["rationale"] = "Do not materialize this candidate in the authority-isolation test."
    authority_only = materialize_candidate_acceptance(make_input(adapter_fixture, authority_only_event))
    authority_claims = authority_only["materialized_interactive_input"]["dimension_claims"]
    assert authority_claims["authority"]["value"] == "SCOPED_AUTHORITY_ACCEPTED"
    assert authority_claims["responsibility"]["value"] == "NOT_EVALUATED"
    assert authority_claims["identity"]["value"] == "NOT_EVALUATED"
    assert authority_claims["truth"]["value"] == "NOT_EVALUATED"

    actor_mutation = deepcopy(acceptance_input)
    actor_mutation["acceptance_event"]["actor_ref"] = '<img src=x onerror="alert(1)">'
    actor_result = materialize_candidate_acceptance(actor_mutation)
    assert actor_result["materialized_interactive_input"]["dimension_claims"] == materialized["dimension_claims"]
    assert actor_result["acceptance_event"]["actor_ref"] == '<img src=x onerror="alert(1)">'

    plural_adapter = deepcopy(adapter_fixture)
    second_c2pa = deepcopy(plural_adapter["observations"][0])
    second_c2pa["id"] = "obs-c2pa-2"
    second_c2pa["summary"] = "Conflicting bounded C2PA observation for acceptance conflict testing."
    second_c2pa["payload"]["hasCredentials"] = False
    second_c2pa["payload"]["manifestData_present"] = False
    plural_adapter["observations"].append(second_c2pa)
    plural_result = adapt_evidence(plural_adapter)
    plural_event = deepcopy(decision_fixture)
    plural_event["dispositions"].append({
        "candidate_id": "candidate:obs-c2pa-2:provenance",
        "decision": "ACCEPT",
        "rationale": "Second provenance candidate deliberately conflicts with the first for fail-closed testing.",
    })
    expect_failure(
        lambda: build_acceptance_input(plural_result, plural_event),
        "multiple accepted candidates in one dimension",
    )

    plural_event["dispositions"][-1]["decision"] = "DEFER"
    plural_event["dispositions"][-1]["rationale"] = "Preserve the conflicting second candidate without selecting it."
    plural_acceptance = build_acceptance_input(plural_result, plural_event)
    plural_materialized = materialize_candidate_acceptance(plural_acceptance)
    assert plural_materialized["materialized_interactive_input"]["dimension_claims"]["provenance"]["value"] == "CREDENTIALS_PRESENT"
    assert "candidate:obs-c2pa-2:provenance" in plural_materialized["deferred_candidate_ids"]

    expect_failure(lambda: normalize_interactive_input(adapter_result), "P1.4 adapter result auto-accepted as P1.3 input")

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
            ["node", str(BROWSER_TEST), str(ADAPTER_FIXTURE), str(DECISION_FIXTURE), str(browser_output)],
            cwd=REPO_ROOT,
            check=True,
        )
        browser_result = json.loads(browser_output.read_text(encoding="utf-8"))
        assert browser_result == baseline, "browser acceptance materializer drifted from canonical Python result"

    print("P1.5 canonical Python == browser materializer: PASS")
    print("candidate claim != accepted claim; every candidate gets explicit disposition")
    print("ACCEPT copies semantics + acceptance receipt; REJECT/DEFER do not promote")
    print("actor_ref != identity != authority; provenance != availability != truth")
    print("conflicting candidates require explicit single selection or deferral/rejection")


if __name__ == "__main__":
    main()
