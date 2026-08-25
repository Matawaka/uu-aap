#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED_COMMIT = "9ed03f99d4ccab7896b62664ecd273f2919c5bb8"
EXPECTED_TREE = "3719b1a3a4d785b1f9a58586e8b1fa7cefa954fb"
RUN_COMMIT = "e134e612d1913aa9c26ea88ebe6ab3b3ae6c6741"
RUN_TREE = "6bb35b96eab93251e61060c464d1bf4787fdc2cd"
BUNDLE_SHA256 = "babe9fac8cf2c04a26dd788296e63abae6ac66cac7c45c190394b2f921b93e93"
CORE = ["state_evidence_anchor","possibility_availability","intent","authority_responsibility","coordination_ccrp","action_gate","outcome_provenance_successor_state"]
HEX40 = "^[0-9a-f]{40}$"


def load(name):
    with (ROOT / name).open(encoding="utf-8") as f:
        return json.load(f)


def validate_run_receipt(name, receipt_type):
    r = load(name)
    assert r["schema_version"] == "0.1"
    assert r["pilot_id"] == "core-pilot-001"
    assert r["run_id"] == "core-pilot-001-run-001"
    assert r["receipt_type"] == receipt_type
    assert r["pilot_origin"] == {"commit": EXPECTED_COMMIT, "tree": EXPECTED_TREE}
    assert r["execution_target"]["repository"] == "Matawaka/uu-aap"
    assert r["execution_target"]["branch"] == "main"
    assert r["execution_target"]["commit"] == RUN_COMMIT
    assert r["execution_target"]["tree"] == RUN_TREE
    assert r["status"] == "success"
    assert r["evidence"]["bundle_sha256"] == BUNDLE_SHA256
    assert r["evidence"]["bundle_verify"] == "pass"
    assert r["evidence"]["git_fsck_full"] == "pass"
    assert r["evidence"]["main_matches"] is True
    assert r["evidence"]["tree_matches"] is True
    for key in ("git_push","remote_ref_mutation","github_authority_mutation","kontur_mutation","release_or_tag_creation","canonicality_transfer","permit_reuse"):
        assert r["non_effects"][key] is False
    return r


def main():
    manifest = load("pilot-manifest.json")
    assert manifest["schema_version"] == "0.1"
    assert manifest["pilot_id"] == "core-pilot-001"
    assert manifest["status"] == "pre-execution"
    assert manifest["origin"]["main_commit"] == EXPECTED_COMMIT
    assert manifest["origin"]["main_tree"] == EXPECTED_TREE
    assert manifest["core_path"] == CORE
    assert manifest["execution_requires_separate_action_permit"] is True
    assert manifest["specification_merge_is_not_execution_authority"] is True
    assert manifest["real_capture_executed"] is False
    assert manifest["real_recovery_executed"] is False

    permit = load("action-permit.schema.json")
    assert permit["properties"]["single_use"]["const"] is True
    assert permit["properties"]["human_authorized"]["const"] is True
    assert permit["properties"]["origin"]["properties"]["main_commit"]["const"] == EXPECTED_COMMIT
    assert permit["properties"]["origin"]["properties"]["main_tree"]["const"] == EXPECTED_TREE
    assert permit["properties"]["forbidden_effects"]["minItems"] == 9

    run_permit = load("run-permit.schema.json")
    assert run_permit["properties"]["pilot_origin"]["properties"]["commit"]["const"] == EXPECTED_COMMIT
    assert run_permit["properties"]["pilot_origin"]["properties"]["tree"]["const"] == EXPECTED_TREE
    assert run_permit["properties"]["execution_target"]["properties"]["commit"]["pattern"] == HEX40
    assert run_permit["properties"]["execution_target"]["properties"]["tree"]["pattern"] == HEX40
    assert run_permit["properties"]["single_use"]["const"] is True
    assert run_permit["properties"]["human_authorized"]["const"] is True
    assert run_permit["properties"]["forbidden_effects"]["minItems"] == 9

    receipt = load("receipt.schema.json")
    assert receipt["properties"]["origin"]["properties"]["main_commit"]["const"] == EXPECTED_COMMIT
    assert receipt["properties"]["origin"]["properties"]["main_tree"]["const"] == EXPECTED_TREE
    for key in ("git_push","github_authority_mutation","kontur_mutation","canonicality_transfer"):
        assert receipt["properties"]["non_effects"]["properties"][key]["const"] is False

    run_schema = load("run-receipt.schema.json")
    assert run_schema["properties"]["pilot_origin"]["properties"]["commit"]["const"] == EXPECTED_COMMIT
    assert run_schema["properties"]["execution_target"]["properties"]["commit"]["const"] == RUN_COMMIT
    assert run_schema["properties"]["execution_target"]["properties"]["tree"]["const"] == RUN_TREE
    assert run_schema["properties"]["evidence"]["properties"]["bundle_sha256"]["const"] == BUNDLE_SHA256

    capture = validate_run_receipt("run-001-capture.receipt.json", "capture_outcome")
    recovery = validate_run_receipt("run-001-recovery.receipt.json", "recovery_outcome")
    assert capture["evidence"]["bundle_records_complete_history"] is True
    assert recovery["evidence"]["recovery_clone_completed"] is True
    assert set(recovery["evidence"]["dangling_commits_observed"]) == {
        "4592c24ff8914b8faa2b035458eb7e373dcd470a",
        "58e901d7aabc48511510347e83cea5690c57f4f0",
    }

    print("Core Pilot 001 static validation: PASS")
    print("Core Pilot 001 Run 001 receipt validation: PASS")


if __name__ == "__main__":
    main()
