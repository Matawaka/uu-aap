#!/usr/bin/env python3
"""P1.7 contestability overlay acceptance and adversarial tests."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from copy import deepcopy
from pathlib import Path

from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation import (  # noqa: E402
    DIMENSION_ORDER,
    adapt_evidence,
    build_acceptance_input,
    build_contestability_input,
    materialize_candidate_acceptance,
    materialize_contestability_overlay,
    validate_contestability_input,
    validate_contestability_result,
)

HERE = Path(__file__).resolve().parent
ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
DECISION_FIXTURE = REPO_ROOT / "scripts" / "verifier-candidate-acceptance" / "decision.fixture.json"
RECORDS_FIXTURE = HERE / "records.fixture.json"
INPUT_SCHEMA = HERE / "input.schema.json"
RESULT_SCHEMA = HERE / "result.schema.json"
SOURCE_BINDINGS = HERE / "source-bindings.json"
INTERACTIVE_APP = REPO_ROOT / "scripts" / "verifier-interactive-surface" / "app.js"
CONTEST_APP = HERE / "app.js"
BROWSER_RUNNER = HERE / "test-browser.js"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_base() -> dict:
    adapter_result = adapt_evidence(load(ADAPTER_FIXTURE))
    acceptance_input = build_acceptance_input(adapter_result, load(DECISION_FIXTURE))
    return materialize_candidate_acceptance(acceptance_input)["materialized_interactive_input"]


def build_input() -> dict:
    fixture = load(RECORDS_FIXTURE)
    return build_contestability_input(build_base(), fixture["contestability_evidence_items"], fixture["records"])


def expect_fail(label: str, mutated: dict) -> None:
    try:
        validate_contestability_input(mutated)
    except AssertionError:
        print(f"PASS reject: {label}")
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def main() -> None:
    bindings = load(SOURCE_BINDINGS)
    predecessor = bindings["repository_predecessor_main"]
    assert isinstance(predecessor, str) and len(predecessor) == 40 and all(ch in "0123456789abcdef" for ch in predecessor)
    for path, metadata in bindings["sources"].items():
        actual = subprocess.check_output(["git", "hash-object", path], cwd=REPO_ROOT, text=True).strip()
        assert actual == metadata["git_blob_sha"], f"contestability source changed: {path}"

    input_schema = load(INPUT_SCHEMA)
    result_schema = load(RESULT_SCHEMA)
    Draft202012Validator.check_schema(input_schema)
    Draft202012Validator.check_schema(result_schema)

    contest_input = build_input()
    base_before = deepcopy(contest_input["base_interactive_input"])
    validate_contestability_input(contest_input)
    Draft202012Validator(input_schema).validate(contest_input)
    result = materialize_contestability_overlay(contest_input)
    validate_contestability_result(result)
    Draft202012Validator(result_schema).validate(result)

    assert result["base_interactive_input"] == base_before, "contestability must preserve base interactive input"
    assert result["dimension_order"] == list(DIMENSION_ORDER)
    assert set(result["current_dimension_claims"]) == set(DIMENSION_ORDER)
    assert set(result["contestability_overlay"]) == set(DIMENSION_ORDER)
    assert "contestability" not in result["current_dimension_claims"], "contestability must not become an eighth dimension"

    assert result["current_dimension_claims"]["provenance"] == base_before["dimension_claims"]["provenance"], "dispute/appeal mutated provenance claim"
    provenance = result["contestability_overlay"]["provenance"]
    assert provenance["dispute_status"] == "UNRESOLVED"
    assert provenance["appeal_status"] == "OPEN"
    assert provenance["unresolved_dispute_record_ids"] == ["dispute-provenance-1"]
    assert provenance["active_appeal_record_ids"] == ["appeal-provenance-1"]

    availability = result["contestability_overlay"]["availability"]
    assert availability["correction_status"] == "APPLIED_SUCCESSOR"
    assert availability["historical_claims"] == [base_before["dimension_claims"]["availability"]]
    assert availability["successor_claim"] == result["current_dimension_claims"]["availability"]
    assert result["current_dimension_claims"]["availability"]["value"] == "AVAILABLE_BEFORE_CUTOFF"
    assert result["history"] == contest_input["records"], "contestability history order changed"

    policy = result["contestability_policy"]
    assert policy["overlay_is_verifier_dimension"] is False
    assert policy["dispute_mutates_claim"] is False
    assert policy["appeal_mutates_claim"] is False
    assert policy["correction_preserves_history"] is True
    assert policy["actor_ref_establishes_identity"] is False
    assert policy["actor_ref_establishes_authority"] is False
    assert policy["correction_establishes_truth"] is False
    assert policy["unresolved_disagreement_permitted"] is True
    assert policy["forced_consensus_permitted"] is False
    assert policy["reputation_penalty_inference_permitted"] is False
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False

    # Opaque contestability payload may contain externally named semantic-looking fields without promotion.
    assert contest_input["contestability_evidence_items"][0]["payload"]["trust_score"] == 0.99
    assert result["current_dimension_claims"]["truth"] == base_before["dimension_claims"]["truth"]
    assert result["current_dimension_claims"]["identity"] == base_before["dimension_claims"]["identity"]

    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.json"
        input_path.write_text(json.dumps(contest_input, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        browser_raw = subprocess.check_output(
            ["node", str(BROWSER_RUNNER), str(INTERACTIVE_APP), str(CONTEST_APP), str(input_path)],
            cwd=REPO_ROOT,
            text=True,
        )
        browser_result = json.loads(browser_raw)
        assert browser_result == result, "Python/browser contestability result mismatch"

    actor_mutation = deepcopy(contest_input)
    for index, item in enumerate(actor_mutation["records"]):
        item["actor_ref"] = f"different-actor:{index}"
    actor_result = materialize_contestability_overlay(actor_mutation)
    assert actor_result["current_dimension_claims"] == result["current_dimension_claims"], "actor_ref changed claim semantics"

    sequential = deepcopy(contest_input)
    sequential["contestability_evidence_items"].append({
        "id": "evidence:contest-availability-correction-2",
        "kind": "correction_supporting_evidence",
        "source_layer": "UU-AAP/P1.7",
        "summary": "Second explicit successor evidence for chain-preservation testing.",
        "payload": {"synthetic": True},
    })
    sequential["records"].append({
        "id": "correction-availability-2",
        "kind": "CORRECTION",
        "dimension": "availability",
        "actor_ref": "corrector:editor-2",
        "recorded_at": "2026-08-30T12:15:00Z",
        "statement": "Apply a second successor while preserving both earlier availability states.",
        "evidence_refs": ["evidence:contest-availability-correction-2"],
        "status": "APPLIED_SUCCESSOR",
        "response_status": "NONE",
        "disposition": "ACCEPTED",
        "related_record_id": None,
        "successor_claim": {
            "value": "AVAILABLE_BEFORE_CUTOFF_RECONFIRMED",
            "evaluation": "SUPPORTED",
            "source_layer": "UU-AAP/P1.7-correction",
            "evidence_refs": ["evidence:contest-availability-correction-2"],
            "explanation": "A second explicit successor claim exercises correction-chain history preservation.",
            "does_not_establish": ["factual truth", "consideration", "authority", "identity"],
        },
    })
    sequential_result = materialize_contestability_overlay(sequential)
    assert len(sequential_result["contestability_overlay"]["availability"]["historical_claims"]) == 2
    assert sequential_result["current_dimension_claims"]["availability"]["value"] == "AVAILABLE_BEFORE_CUTOFF_RECONFIRMED"

    mutated = deepcopy(contest_input)
    mutated["records"][0]["successor_claim"] = deepcopy(base_before["dimension_claims"]["provenance"])
    expect_fail("dispute cannot provide successor claim", mutated)

    mutated = deepcopy(contest_input)
    mutated["records"][2]["related_record_id"] = "missing-record"
    expect_fail("appeal target must already exist", mutated)

    mutated = deepcopy(contest_input)
    mutated["records"][2]["dimension"] = "availability"
    expect_fail("appeal cannot cross dimension", mutated)

    mutated = deepcopy(contest_input)
    mutated["records"][0]["evidence_refs"] = ["evidence:not-declared"]
    expect_fail("contestability evidence refs must resolve", mutated)

    mutated = deepcopy(contest_input)
    mutated["records"][1]["id"] = mutated["records"][0]["id"]
    expect_fail("duplicate record ids", mutated)

    mutated = deepcopy(contest_input)
    mutated["records"][1]["disposition"] = "PENDING"
    expect_fail("applied correction requires ACCEPTED", mutated)

    mutated = deepcopy(contest_input)
    mutated["base_interactive_input"]["dimension_claims"]["contestability"] = deepcopy(base_before["dimension_claims"]["provenance"])
    expect_fail("no eighth verifier dimension", mutated)

    mutated = deepcopy(contest_input)
    mutated["records"][0]["trust_score"] = 1.0
    expect_fail("semantic-looking field outside opaque payload", mutated)

    app_source = CONTEST_APP.read_text(encoding="utf-8")
    for forbidden in ("fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "eval(", "innerHTML"):
        assert forbidden not in app_source, f"browser contestability surface introduced forbidden runtime: {forbidden}"

    print("P1.7 input/result JSON Schema: PASS")
    print("P1.7 Python == browser materialization: PASS")
    print("dispute/appeal -> no claim mutation")
    print("correction -> successor + preserved history")
    print("unresolved disagreement -> visible")
    print("contestability overlay != eighth dimension")


if __name__ == "__main__":
    main()
