#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OBSERVATION_PATH = HERE / "observation.json"
ROADMAP_PATH = ROOT / "docs" / "ROADMAP-CURRENT.md"

ORIGIN = "d83297e526abfb5a0d9148cc0906223fe49f870b"
EXPECTED_SOURCE = {
    "system": "github",
    "repository": "Matawaka/uu-aap",
    "issue_number": 422,
    "comment_id": 5471862585,
    "url": "https://github.com/Matawaka/uu-aap/issues/422#issuecomment-5471862585",
    "api_url": "https://api.github.com/repos/Matawaka/uu-aap/issues/comments/5471862585",
    "author_account_identifier": "84dnnvbdvp-debug",
    "author_account_numeric_id": 319250061,
    "author_association": "NONE",
    "created_at": "2026-08-30T23:14:24Z",
    "updated_at": "2026-08-30T23:14:24Z",
    "body_sha256": "23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8",
    "performed_via_github_app": {"slug": "chatgpt-codex-connector", "id": 1144995},
}
EXPECTED_INPUTS = {
    "core_pilot_002_readme_blob": "3112d41334a898aaab1af9db24556d6e746c3499",
    "run_admission_readme_blob": "44ab9ac8789380423df26139fcf7314d77ddc9ce",
    "current_frontier_reconciliation_blob": "37a5daed7f57e58177e92679310fa26b3d2ddc24",
    "release_candidate_checkpoint_v0_5_blob": "172f9c886f26ccdcc9e30a84ccb86df37c41db4e",
    "predecessor_roadmap_blob": "3e5f371764c8f9557fd1ce57615a2739253d8140",
}
INFERENCE_FALSE = {
    "verified_human_identity",
    "independence_from_project_or_user",
    "reviewer_standing",
    "reviewer_expertise",
    "reviewer_authority",
    "claim_truth",
    "responsibility_or_liability",
    "core_change_required",
}
EFFECT_FALSE = {
    "pilot_run_materialized",
    "admission_created",
    "disposition_created",
    "issue_or_comment_mutation_authorized",
    "normative_change_authorized",
    "core_or_spec_change_authorized",
    "release_or_tag_authorized",
    "publication_authorized",
    "action_permit_created",
    "workbench_reactivated",
}


def validate(doc, check_roadmap=True):
    if doc.get("schema") != "urn:uu-aap:core-pilot-002:external-input-observation:0.1":
        raise ValueError("schema")
    if doc.get("origin_frontier") != ORIGIN:
        raise ValueError("origin frontier")
    if doc.get("historical_inputs") != EXPECTED_INPUTS:
        raise ValueError("historical input bindings")
    if doc.get("source") != EXPECTED_SOURCE:
        raise ValueError("source binding")
    if doc["source"]["author_account_identifier"] == doc["observation"].get("repository_owner_account_identifier"):
        raise ValueError("source account label is repository owner")

    observation = doc.get("observation", {})
    expected_observation = {
        "public_submission_observed": True,
        "source_account_label_differs_from_repository_owner": True,
        "repository_owner_account_identifier": "Matawaka",
        "source_app_mediated": True,
        "full_submission_text_duplicated_in_receipt": False,
        "status": "EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED_AWAITING_HUMAN_ADMISSION_DECISION",
    }
    if observation != expected_observation:
        raise ValueError("observation classification")

    inferences = doc.get("inference_boundaries", {})
    if set(inferences) != INFERENCE_FALSE or any(inferences[key] is not False for key in INFERENCE_FALSE):
        raise ValueError("inference boundary")

    human = doc.get("human_gate", {})
    if human.get("required") is not True:
        raise ValueError("human gate required")
    if not human.get("reason"):
        raise ValueError("human gate reason")
    if human.get("run_001_source_selected") is not False:
        raise ValueError("Run 001 selection not allowed")
    if human.get("admission_decision") != "NOT_MADE":
        raise ValueError("admission decision not allowed")
    if human.get("disposition_decision") != "NOT_MADE":
        raise ValueError("disposition decision not allowed")

    effects = doc.get("effects", {})
    if set(effects) != EFFECT_FALSE or any(effects[key] is not False for key in EFFECT_FALSE):
        raise ValueError("effect boundary")

    if check_roadmap:
        roadmap = ROADMAP_PATH.read_text(encoding="utf-8")
        required = [
            "Core Pilot 002 #718/#422 — `EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED_AWAITING_HUMAN_ADMISSION_DECISION`",
            "Different Account Label != Verified Human Identity",
            "Observed External Submission != Admitted Pilot Input",
            "release candidate = EXTERNAL_EVIDENCE_PENDING",
        ]
        for marker in required:
            if marker not in roadmap:
                raise ValueError(f"roadmap marker missing: {marker}")

    return True


def must_fail(base, mutate, label):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate, check_roadmap=False)
    except Exception:
        return
    raise AssertionError(f"unsafe mutation accepted: {label}")


def main():
    doc = json.loads(OBSERVATION_PATH.read_text(encoding="utf-8"))
    validate(doc)

    must_fail(doc, lambda x: x["inference_boundaries"].__setitem__("verified_human_identity", True), "identity inference")
    must_fail(doc, lambda x: x["inference_boundaries"].__setitem__("independence_from_project_or_user", True), "independence inference")
    must_fail(doc, lambda x: x["inference_boundaries"].__setitem__("reviewer_authority", True), "authority inference")
    must_fail(doc, lambda x: x["inference_boundaries"].__setitem__("reviewer_standing", True), "standing inference")
    must_fail(doc, lambda x: x["inference_boundaries"].__setitem__("claim_truth", True), "truth inference")
    must_fail(doc, lambda x: x["human_gate"].__setitem__("run_001_source_selected", True), "Run 001 selection")
    must_fail(doc, lambda x: x["human_gate"].__setitem__("admission_decision", "ADMIT"), "admission decision")
    must_fail(doc, lambda x: x["human_gate"].__setitem__("disposition_decision", "accept_for_followup"), "disposition")
    must_fail(doc, lambda x: x["effects"].__setitem__("pilot_run_materialized", True), "pilot materialization")
    must_fail(doc, lambda x: x["effects"].__setitem__("normative_change_authorized", True), "normative authority")
    must_fail(doc, lambda x: x["effects"].__setitem__("issue_or_comment_mutation_authorized", True), "source mutation authority")
    must_fail(doc, lambda x: x["effects"].__setitem__("release_or_tag_authorized", True), "release authority")
    must_fail(doc, lambda x: x["source"].__setitem__("performed_via_github_app", None), "hide app mediation")

    print("CORE_PILOT_002_EXTERNAL_INPUT_OBSERVATION_V0_1_PASS")


if __name__ == "__main__":
    main()
