#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def validate(data):
    assert data["schema_version"] == "0.1"
    assert data["pilot_id"] == "core-pilot-005"
    assert data["origin_frontier"] == "098baf9ec9ed8a2db5aec52281c880505182415b"

    shared = data["shared"]
    assert shared["repository"] == "Matawaka/uu-aap"
    assert shared["target_issue"] == 440
    assert shared["observation_read_only"] is True
    assert shared["mutation_authorized"] is False
    assert shared["retry_authorized"] is False
    assert shared["original_permit_reusable"] is False
    assert shared["successor_permit_created"] is False
    assert shared["fresh_authority_required"] is True

    runs = {r["run_id"]: r for r in data["runs"]}
    assert set(runs) == {"core-pilot-005-run-002", "core-pilot-005-run-003"}

    absent = runs["core-pilot-005-run-002"]
    ao = absent["observation"]
    assert absent["input_state"] == "UNKNOWN"
    assert ao["scope_sufficient"] is True
    assert ao["target_matches"] is True
    assert ao["frontier_matches"] is True
    assert ao["matching_effect_count"] == 0
    assert ao["conflicting_evidence_count"] == 0
    assert absent["reconciliation"] == "ABSENT"
    assert absent["human_decision_required"] is True
    assert absent["human_disposition_required"] is False
    assert absent["automatic_winner_selected"] is False
    assert absent["stop"] is True

    conflict = runs["core-pilot-005-run-003"]
    co = conflict["observation"]
    assert conflict["input_state"] == "UNKNOWN"
    assert co["scope_sufficient"] is True
    assert co["target_matches"] is True
    assert co["frontier_matches"] is True
    assert co["conflicting_evidence_count"] > 0
    assert conflict["reconciliation"] == "CONFLICT"
    assert conflict["human_decision_required"] is False
    assert conflict["human_disposition_required"] is True
    assert conflict["automatic_winner_selected"] is False
    assert conflict["stop"] is True


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def run_by_id(data, run_id):
    return next(r for r in data["runs"] if r["run_id"] == run_id)


def main():
    base = json.loads((ROOT / "reconciliation-cases.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["shared"].__setitem__("observation_read_only", False),
        lambda d: d["shared"].__setitem__("mutation_authorized", True),
        lambda d: d["shared"].__setitem__("retry_authorized", True),
        lambda d: d["shared"].__setitem__("original_permit_reusable", True),
        lambda d: d["shared"].__setitem__("successor_permit_created", True),
        lambda d: d["shared"].__setitem__("fresh_authority_required", False),
        lambda d: run_by_id(d, "core-pilot-005-run-002")["observation"].__setitem__("scope_sufficient", False),
        lambda d: run_by_id(d, "core-pilot-005-run-002")["observation"].__setitem__("target_matches", False),
        lambda d: run_by_id(d, "core-pilot-005-run-002")["observation"].__setitem__("frontier_matches", False),
        lambda d: run_by_id(d, "core-pilot-005-run-002")["observation"].__setitem__("matching_effect_count", 1),
        lambda d: run_by_id(d, "core-pilot-005-run-002").__setitem__("human_decision_required", False),
        lambda d: run_by_id(d, "core-pilot-005-run-002").__setitem__("stop", False),
        lambda d: run_by_id(d, "core-pilot-005-run-003")["observation"].__setitem__("conflicting_evidence_count", 0),
        lambda d: run_by_id(d, "core-pilot-005-run-003")["observation"].__setitem__("target_matches", False),
        lambda d: run_by_id(d, "core-pilot-005-run-003")["observation"].__setitem__("frontier_matches", False),
        lambda d: run_by_id(d, "core-pilot-005-run-003").__setitem__("reconciliation", "CONFIRMED"),
        lambda d: run_by_id(d, "core-pilot-005-run-003").__setitem__("reconciliation", "ABSENT"),
        lambda d: run_by_id(d, "core-pilot-005-run-003").__setitem__("automatic_winner_selected", True),
        lambda d: run_by_id(d, "core-pilot-005-run-003").__setitem__("human_disposition_required", False),
        lambda d: run_by_id(d, "core-pilot-005-run-003").__setitem__("stop", False),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(f"Core Pilot 005 reconciliation closure: PASS ({len(mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
