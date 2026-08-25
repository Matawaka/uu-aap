#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED_COMMIT = "9ed03f99d4ccab7896b62664ecd273f2919c5bb8"
EXPECTED_TREE = "3719b1a3a4d785b1f9a58586e8b1fa7cefa954fb"
CORE = ["state_evidence_anchor","possibility_availability","intent","authority_responsibility","coordination_ccrp","action_gate","outcome_provenance_successor_state"]


def load(name):
    with (ROOT / name).open(encoding="utf-8") as f:
        return json.load(f)


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

    receipt = load("receipt.schema.json")
    assert receipt["properties"]["origin"]["properties"]["main_commit"]["const"] == EXPECTED_COMMIT
    assert receipt["properties"]["origin"]["properties"]["main_tree"]["const"] == EXPECTED_TREE
    for key in ("git_push","github_authority_mutation","kontur_mutation","canonicality_transfer"):
        assert receipt["properties"]["non_effects"]["properties"][key]["const"] is False

    print("Core Pilot 001 static validation: PASS")


if __name__ == "__main__":
    main()
