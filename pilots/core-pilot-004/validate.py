#!/usr/bin/env python3
import copy
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED_REPO = "Matawaka/uu-aap"
EXPECTED_EFFECT = "issue_comment_create"
EXPECTED_ISSUE = 433
EXPECTED_FRONTIER = "5c39351a9c10d82befd30018c9c5915c70e88ae4"
REQUIRED_FORBIDDEN = {
    "issue_create",
    "issue_edit",
    "issue_close",
    "pr_create",
    "pr_edit",
    "push",
    "merge",
    "release_or_tag",
    "permission_change",
    "secret_change",
    "protection_change",
    "kontur_effect",
    "successor_permit_creation",
}


def parse_time(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def sha256_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate(data):
    assert data["schema_version"] == "0.1"
    assert data["pilot_id"] == "core-pilot-004"
    assert data["repository"] == EXPECTED_REPO
    assert data["effect_type"] == EXPECTED_EFFECT
    assert data["target"]["issue_number"] == EXPECTED_ISSUE
    assert data["target"]["expected_state"] == "open"
    assert data["payload"]["sha256"] == sha256_text(data["payload"]["body"])
    assert data["canonical_frontier"] == EXPECTED_FRONTIER

    snapshot = data["precondition_snapshot"]
    assert snapshot["observed_frontier"] == data["canonical_frontier"]
    assert snapshot["observed_issue_state"] == data["target"]["expected_state"]
    issued = parse_time(data["issued_at"])
    observed = parse_time(snapshot["observed_at"])
    expires = parse_time(data["expires_at"])
    assert issued <= observed < expires

    # Synthetic fixture MUST remain non-executable.
    assert data["human_authorized"] is False
    assert data["execution_authorized"] is False

    assert data["single_use"] is True
    assert data["max_effect_count"] == 1
    assert data["consumed"] is False
    assert data["allowed_external_effects"] == [EXPECTED_EFFECT]
    assert set(data["forbidden_effects"]) >= REQUIRED_FORBIDDEN

    receipt = data["expected_execution_receipt"]
    assert receipt["effect_count"] == 1
    assert receipt["effect_type"] == data["effect_type"]
    assert receipt["repository"] == data["repository"]
    assert receipt["issue_number"] == data["target"]["issue_number"]
    assert receipt["payload_sha256"] == data["payload"]["sha256"]
    assert receipt["successor_permit_created"] is False
    assert receipt["permit_consumed_after_success"] is True


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, ValueError, TypeError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    base = json.loads((ROOT / "permit-fixture.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d.__setitem__("repository", "other/repo"),
        lambda d: d["target"].__setitem__("issue_number", 999),
        lambda d: d.__setitem__("effect_type", "issue_edit"),
        lambda d: d["payload"].__setitem__("body", d["payload"]["body"] + " changed"),
        lambda d: d.__setitem__("single_use", False),
        lambda d: d.__setitem__("max_effect_count", 2),
        lambda d: d.__setitem__("expires_at", "2026-08-25T06:39:00Z"),
        lambda d: d.__setitem__("canonical_frontier", "different-frontier"),
        lambda d: d["precondition_snapshot"].__setitem__("observed_frontier", "different-frontier"),
        lambda d: d["precondition_snapshot"].__setitem__("observed_issue_state", "closed"),
        lambda d: d.__setitem__("human_authorized", True),
        lambda d: d.__setitem__("execution_authorized", True),
        lambda d: d["allowed_external_effects"].append("issue_edit"),
        lambda d: d["forbidden_effects"].remove("merge"),
        lambda d: d["expected_execution_receipt"].__setitem__("effect_count", 2),
        lambda d: d["expected_execution_receipt"].__setitem__("issue_number", 999),
        lambda d: d["expected_execution_receipt"].__setitem__("payload_sha256", "0" * 64),
        lambda d: d["expected_execution_receipt"].__setitem__("successor_permit_created", True),
        lambda d: d["expected_execution_receipt"].__setitem__("permit_consumed_after_success", False),
        lambda d: d.__setitem__("consumed", True),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(f"Core Pilot 004 validation: PASS ({len(mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
