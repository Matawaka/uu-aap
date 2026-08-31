#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORIGIN_FRONTIER = "8100a4c59590afe503c438b659e20326e11ef8ee"

EXPECTED_BLOBS = {
    "public_review_blob": ("PUBLIC_REVIEW.md", "83cf9f1dacffcde3f030764f5fb0e6afe0fdb190"),
    "current_roadmap_blob": ("docs/ROADMAP-CURRENT.md", "6063ce07c479c6a59c78091e4212fc5d09c27a04"),
    "run_001_result_blob": ("pilots/core-pilot-002/run-001/result/v0.1/result.json", "edc9a7e4f26492d16875727e17188c5e2a486ced"),
    "stage_b_implementation_receipt_blob": ("protocols/responsibility-status-provenance/v0.1/implementation-receipt.json", "3ecba920eb366c15c1c7555cb54dc8574e05a73b"),
    "stage_c_implementation_receipt_blob": ("protocols/responsibility-assurance/v0.1/implementation-receipt.json", "d5316c2281f5927c76783235b1fa33c7a94d86f1"),
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def git_blob_sha1_bytes(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def historical_bytes(relative: str) -> bytes:
    try:
        return subprocess.check_output(["git", "show", f"{ORIGIN_FRONTIER}:{relative}"])
    except subprocess.CalledProcessError as exc:
        raise ValueError(f"origin frontier file unavailable: {relative}") from exc


def main():
    receipt = load(HERE / "implementation-receipt.json")
    surfaces = load(HERE / "surfaces.json")

    if receipt["schema"] != "urn:uu-aap:public-review-intake-observation-implementation:0.1":
        raise ValueError("implementation receipt schema drift")
    if receipt["origin_frontier"] != ORIGIN_FRONTIER:
        raise ValueError("origin frontier drift")

    for key, (relative, expected) in EXPECTED_BLOBS.items():
        observed = git_blob_sha1_bytes(historical_bytes(relative))
        if observed != expected:
            raise ValueError(f"historical/source blob mismatch at origin: {relative}: {observed}")
        if receipt["source_bindings"].get(key) != expected:
            raise ValueError(f"receipt source binding drift: {key}")

    if surfaces != {
        "schema": "urn:uu-aap:public-review-intake-surfaces:0.1",
        "repository": "Matawaka/uu-aap",
        "project_account_identifier": "Matawaka",
        "target_issue_numbers": [1, 2, 3, 4, 5, 6, 7],
        "excluded_channels": [
            "issue:422",
            "arbitrary_new_issues",
            "discussions",
            "pull_requests",
            "email",
            "social_media",
        ],
        "classification": {
            "project_account_comment": "PROJECT_ACCOUNT_COMMENT",
            "bot_comment": "AUTOMATION_COMMENT",
            "other_account_comment": "EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED",
        },
        "invariants": {
            "observation_is_admission": False,
            "observation_is_disposition": False,
            "account_identifier_is_verified_identity": False,
            "author_association_is_independence_proof": False,
            "app_mediation_is_human_identity_proof": False,
            "submission_is_truth": False,
            "submission_is_authority": False,
        },
    }:
        raise ValueError("surface set drift")

    expected_scope = {
        "target_issue_numbers": [1, 2, 3, 4, 5, 6, 7],
        "issue_422_included": False,
        "arbitrary_new_issues_included": False,
        "discussions_included": False,
        "pull_requests_included": False,
        "read_only": True,
        "automatic_admission": False,
        "automatic_disposition": False,
        "scheduled_polling": False,
        "manual_live_observation_available": True,
        "accepted_push_live_observation": True,
    }
    if receipt["scope"] != expected_scope:
        raise ValueError("implementation scope drift")

    expected_boundaries = {
        "project_account_comment_is_external_submission": False,
        "bot_comment_is_external_submission": False,
        "different_account_comment_is_external_account_submission_candidate": True,
        "different_account_proves_human_identity": False,
        "author_association_proves_independence": False,
        "app_mediation_proves_human_identity": False,
        "observation_proves_truth": False,
        "observation_proves_authority": False,
    }
    if receipt["classification_boundaries"] != expected_boundaries:
        raise ValueError("classification boundary drift")
    if any(receipt["non_effects"].values()):
        raise ValueError("implementation receipt external effect escalated")

    print("PUBLIC_REVIEW_INTAKE_OBSERVATION_V0_1_IMPLEMENTATION_BINDINGS_PASS")


if __name__ == "__main__":
    main()
