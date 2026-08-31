#!/usr/bin/env python3
import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator, ValidationError

HERE = Path(__file__).resolve().parent
ROOT = Path(__file__).resolve().parents[5]


def load(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def validate_schema(instance, schema):
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(instance)


def expect_invalid(instance, schema):
    try:
        validate_schema(instance, schema)
    except ValidationError:
        return
    raise AssertionError("expected schema rejection")


def main():
    manifest_schema = load(ROOT / "schema/uu-aap-manifest.schema.json")
    fixture = load(HERE / "counterexample.manifest.json")
    review_schema = load(ROOT / "pilots/core-pilot-002/review-case.schema.json")
    review_case = load(HERE / "review-case.json")
    result_schema = load(HERE / "result.schema.json")
    result = load(HERE / "result.json")
    admission = load(ROOT / "pilots/core-pilot-002/run-001/admission/v0.1/admission.json")

    # Exact current-schema reproduction: Alice may carry status=accepted without a
    # responsibility-local declarant / attributable acceptance event / evidence ref.
    validate_schema(fixture, manifest_schema)
    validate_schema(review_case, review_schema)
    validate_schema(result, result_schema)

    responsibility_items = manifest_schema["properties"]["responsibility"]["items"]
    assert responsibility_items["additionalProperties"] is False
    assert set(responsibility_items["required"]) == {"actor_id", "scope", "status"}
    assert set(responsibility_items["properties"]) == {
        "actor_id", "scope", "status", "limitations"
    }

    alice = fixture["responsibility"][0]
    assert alice == {
        "actor_id": "actor:alice",
        "scope": "factual_verification",
        "status": "accepted",
        "limitations": None,
    }

    # The current closed responsibility entry has no slot for these provenance
    # representations; trying to add one makes the same fixture schema-invalid.
    for field, value in (
        ("declared_by", "actor:bob"),
        ("acceptance_event", "event:alice-acceptance"),
        ("acceptance_evidence_refs", ["evidence:alice-acceptance"]),
    ):
        mutated = copy.deepcopy(fixture)
        mutated["responsibility"][0][field] = value
        expect_invalid(mutated, manifest_schema)

    responsibility_text = (ROOT / "RESPONSIBILITY.md").read_text(encoding="utf-8")
    spec_text = (ROOT / "SPEC.md").read_text(encoding="utf-8")
    assert "responsibility requires explicit attributable action" in responsibility_text
    assert "Responsibility: scoped declarations present" in spec_text
    assert "Claims: self-declared unless individually attested" in spec_text

    # Bind the accepted admission/source without promoting source account metadata.
    assert admission["admission"]["status"] == "ADMITTED_AS_EXTERNAL_SOURCE_ACCOUNT_SUBMISSION"
    assert admission["accepted_observation"]["source_comment_id"] == 5471862585
    assert admission["accepted_observation"]["source_body_sha256"] == result["source_binding"]["body_sha256"]
    assert admission["qualification_boundaries"]["human_identity_status"] == "NOT_ESTABLISHED"
    assert admission["qualification_boundaries"]["independence_from_project_or_user"] == "NOT_ESTABLISHED"
    assert admission["qualification_boundaries"]["reviewer_authority"] == "UNKNOWN"

    # The machine result intentionally accepts the concern only for follow-up.
    assert result["current_contract_observation"]["representation_gap_confirmed"] is True
    assert result["existing_mitigation"]["mitigation_eliminates_machine_provenance_gap"] is False
    assert result["interpretation"]["accepted_as_truth"] is False
    assert result["disposition"]["state"] == "accept_for_followup"
    assert result["disposition"]["normative_change_authorized"] is False
    assert result["next_gate"]["status"] == "HUMAN_NORMATIVE_DESIGN_DECISION_REQUIRED"
    assert result["next_gate"]["human_normative_decision_required"] is True
    assert all(value is False for value in result["non_effects"].values())

    # Fail closed on overclaiming the Run 001 result.
    mutations = [
        lambda x: x["interpretation"].__setitem__("accepted_as_truth", True),
        lambda x: x["interpretation"].__setitem__("reviewer_identity_verified", True),
        lambda x: x["interpretation"].__setitem__("reviewer_independence_verified", True),
        lambda x: x["interpretation"].__setitem__("reviewer_authority_verified", True),
        lambda x: x["interpretation"].__setitem__("reviewer_expertise_verified", True),
        lambda x: x["disposition"].__setitem__("normative_change_authorized", True),
        lambda x: x["disposition"].__setitem__("state", "decline_with_rationale"),
        lambda x: x["current_contract_observation"].__setitem__("representation_gap_confirmed", False),
        lambda x: x["existing_mitigation"].__setitem__("mitigation_eliminates_machine_provenance_gap", True),
        lambda x: x["next_gate"].__setitem__("human_normative_decision_required", False),
        lambda x: x["non_effects"].__setitem__("source_comment_mutated", True),
        lambda x: x["non_effects"].__setitem__("reviewer_contacted", True),
        lambda x: x["non_effects"].__setitem__("identity_profile_built", True),
        lambda x: x["non_effects"].__setitem__("reputation_score_created", True),
        lambda x: x["non_effects"].__setitem__("core_changed", True),
        lambda x: x["non_effects"].__setitem__("spec_changed", True),
        lambda x: x["non_effects"].__setitem__("manifest_schema_changed", True),
        lambda x: x["non_effects"].__setitem__("liability_assigned", True),
        lambda x: x.update({"extra": "silent extension"}),
    ]
    for mutate in mutations:
        candidate = copy.deepcopy(result)
        mutate(candidate)
        expect_invalid(candidate, result_schema)

    print(
        "CORE_PILOT_002_RUN_001_RESULT_PASS "
        f"schema_valid_counterexample=true fail_closed_mutations={len(mutations)} "
        "disposition=accept_for_followup next_gate=HUMAN_NORMATIVE_DESIGN_DECISION_REQUIRED"
    )


if __name__ == "__main__":
    main()
