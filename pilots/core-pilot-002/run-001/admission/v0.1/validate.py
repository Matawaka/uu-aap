#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
ADMISSION = HERE / "admission.json"
OBSERVATION = ROOT / "pilots/core-pilot-002/external-input-observation/v0.1/observation.json"

EXPECTED_TOP = {
    "schema", "origin_frontier", "pilot_id", "run_id",
    "historical_admission_v0_1", "accepted_observation", "selection_decision",
    "admission", "qualification_boundaries", "next_gate", "non_effects"
}


def load(path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def validate(x, observation):
    assert set(x) == EXPECTED_TOP
    assert x["schema"] == "urn:uu-aap:core-pilot-002:run-001-admission:0.1"
    assert x["origin_frontier"] == "1c134694cc4fcbe852afa68353932c13b6104ee3"
    assert x["pilot_id"] == "core-pilot-002" and x["run_id"] == "001"

    hist = x["historical_admission_v0_1"]
    assert hist == {
        "state": "PRESERVED_HISTORICAL_WAITING_OBSERVATION",
        "readme_blob": "44ab9ac8789380423df26139fcf7314d77ddc9ce",
        "schema_blob": "cb88902b785a884134ad774546c8902ca5e5698d",
        "validator_blob": "87834ff3946296b215bbbec894f5d992935455bb",
        "waiting_fixture_blob": "4509e2b39fbdd48d73b47238f8d4ab1ff3d17349",
    }

    obs = x["accepted_observation"]
    source = observation["source"]
    assert obs["blob"] == "3efeaeffbc39a98d2471973f0af483960dd63739"
    assert obs["merge_frontier"] == "1c134694cc4fcbe852afa68353932c13b6104ee3"
    assert obs["source_comment_id"] == source["comment_id"] == 5471862585
    assert obs["source_url"] == source["url"]
    assert obs["source_author_account_identifier"] == source["author_account_identifier"]
    assert obs["source_body_sha256"] == source["body_sha256"]
    assert observation["observation"]["public_submission_observed"] is True
    assert observation["observation"]["source_app_mediated"] is True
    assert all(v is False for v in observation["inference_boundaries"].values())

    decision = x["selection_decision"]
    assert decision["decision_kind"] == "EXPLICIT_REPOSITORY_OWNER_SOURCE_SELECTION_OPTION_A"
    assert decision["record_comment_id"] == 5474174497
    assert decision["record_author_account_identifier"] == "Matawaka"
    assert decision["record_author_association"] == "OWNER"
    assert decision["record_body_sha256"] == "422315f0694a435cbb17ea1f8d3ac9554bbf859580478546606771290ea4b9dd"
    assert decision["record_performed_via_github_app"] == "chatgpt-codex-connector"
    assert decision["decision_actor_identity_status"] == "NOT_ESTABLISHED_BY_REPOSITORY_RECORD"
    assert decision["scope"] == "core_pilot_002_run_001_input_selection"
    assert decision["selected_exact_observed_source"] is True

    admission = x["admission"]
    assert admission == {
        "status": "ADMITTED_AS_EXTERNAL_SOURCE_ACCOUNT_SUBMISSION",
        "eligible_external_input_present": True,
        "exact_source_bound": True,
        "repository_selection_gate_satisfied": True,
        "run_001_intake_materialization_available": True,
        "analysis_scope": "analyze_and_recommend_only",
    }

    q = x["qualification_boundaries"]
    assert q["source_account_label_differs_from_repository_owner"] is True
    assert q["source_app_mediated"] is True
    assert q["human_identity_status"] == "NOT_ESTABLISHED"
    assert q["independence_from_project_or_user"] == "NOT_ESTABLISHED"
    assert q["reviewer_standing"] == "UNKNOWN"
    assert q["reviewer_expertise"] == "UNKNOWN"
    assert q["reviewer_authority"] == "UNKNOWN"
    assert q["claim_truth"] == "NOT_ESTABLISHED"

    assert all(x["next_gate"].values())
    assert all(v is False for v in x["non_effects"].values())


def must_fail(base, observation, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate, observation)
    except (AssertionError, KeyError, TypeError):
        return
    raise AssertionError("hostile mutation unexpectedly passed")


def main():
    x = load(ADMISSION)
    observation = load(OBSERVATION)
    validate(x, observation)

    mutations = [
        lambda y: y.update(extra="silent-extension"),
        lambda y: y["accepted_observation"].update(source_comment_id=1),
        lambda y: y["accepted_observation"].update(source_body_sha256="0" * 64),
        lambda y: y["selection_decision"].update(selected_exact_observed_source=False),
        lambda y: y["selection_decision"].update(decision_actor_identity_status="VERIFIED_HUMAN"),
        lambda y: y["admission"].update(exact_source_bound=False),
        lambda y: y["admission"].update(analysis_scope="change_protocol"),
        lambda y: y["qualification_boundaries"].update(human_identity_status="VERIFIED"),
        lambda y: y["qualification_boundaries"].update(independence_from_project_or_user="PROVED"),
        lambda y: y["qualification_boundaries"].update(reviewer_authority="VERIFIED"),
        lambda y: y["qualification_boundaries"].update(reviewer_standing="VERIFIED"),
        lambda y: y["qualification_boundaries"].update(claim_truth="TRUE"),
        lambda y: y["next_gate"].update(disposition_must_preserve_objection=False),
        lambda y: y["next_gate"].update(normative_core_or_schema_change_requires_separate_human_decision=False),
        lambda y: y["non_effects"].update(disposition_created=True),
        lambda y: y["non_effects"].update(normative_change_authorized=True),
        lambda y: y["non_effects"].update(core_or_spec_change_authorized=True),
        lambda y: y["non_effects"].update(action_permit_created=True),
    ]
    for mutation in mutations:
        must_fail(x, observation, mutation)

    print(f"Core Pilot 002 Run 001 admission: PASS ({len(mutations)} fail-closed mutations)")


if __name__ == "__main__":
    main()
