#!/usr/bin/env python3
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RECEIPT = ROOT / "execution-reconciliation-receipt.json"
EXPECTED_BODY = (
    "Core Pilot 005 Run 001 execution marker.\n\n"
    "This comment is the single attempted external effect for run `core-pilot-005-run-001`.\n\n"
    "The execution adapter must deliberately treat acknowledgement as `UNKNOWN` and must not use the write response itself as proof of success.\n\n"
    "A separate read-only observation step must reconcile the target as `CONFIRMED`, `ABSENT`, or `CONFLICT`.\n\n"
    "No retry is authorized by this comment or by any reconciliation result.\n\n"
    "`unknown outcome != permission to retry`\n"
    "`observation != mutation authority`\n"
    "`reconciliation != successor permit`"
)
EXPECTED_SHA = hashlib.sha256(EXPECTED_BODY.encode("utf-8")).hexdigest()


def validate(d):
    assert d["schema_version"] == "0.1"
    assert d["pilot_id"] == "core-pilot-005"
    assert d["run_id"] == "core-pilot-005-run-001"
    assert d["permit_id"] == "core-pilot-005-run-001-comment-001-r1"
    assert d["execution_frontier"] == "54a47ffc2c08a8ddf5c7ec6814d7411960634b4a"
    assert d["repository"] == "Matawaka/uu-aap"
    assert d["target_issue"] == 440
    assert d["effect_type"] == "issue_comment_create"
    assert EXPECTED_SHA == "2ab6bb1a99b7839062a02a27b41a0dc472581b8bf9218d5e356ab23719688226"
    assert d["payload_sha256"] == EXPECTED_SHA
    assert d["attempted_effect_count"] == 1
    assert d["immediate_ack_state"] == "UNKNOWN"
    assert d["write_response_used_as_final_evidence"] is False
    assert d["observation_mode"] == "read_only"
    assert d["observed_comment_count"] == 1
    assert d["observed_comment_id"] == 5406855558
    assert d["observed_payload_exact_match"] is True
    assert d["reconciliation_class"] == "CONFIRMED"
    assert d["retry_authorized"] is False
    assert d["original_permit_reusable"] is False
    assert d["successor_permit_created"] is False
    assert d["external_action_authorized_after_reconciliation"] is False


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, ValueError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    base = json.loads(RECEIPT.read_text(encoding="utf-8"))
    validate(base)
    mutations = [
        lambda d: d.__setitem__("target_issue", 441),
        lambda d: d.__setitem__("effect_type", "issue_update"),
        lambda d: d.__setitem__("payload_sha256", "0" * 64),
        lambda d: d.__setitem__("attempted_effect_count", 2),
        lambda d: d.__setitem__("immediate_ack_state", "CONFIRMED"),
        lambda d: d.__setitem__("write_response_used_as_final_evidence", True),
        lambda d: d.__setitem__("observation_mode", "read_write"),
        lambda d: d.__setitem__("observed_comment_count", 0),
        lambda d: d.__setitem__("observed_comment_id", 1),
        lambda d: d.__setitem__("observed_payload_exact_match", False),
        lambda d: d.__setitem__("reconciliation_class", "ABSENT"),
        lambda d: d.__setitem__("retry_authorized", True),
        lambda d: d.__setitem__("original_permit_reusable", True),
        lambda d: d.__setitem__("successor_permit_created", True),
        lambda d: d.__setitem__("external_action_authorized_after_reconciliation", True),
        lambda d: d.__setitem__("execution_frontier", "different-frontier")
    ]
    for mutation in mutations:
        expect_fail(base, mutation)
    print(f"Core Pilot 005 Run 001 outcome validation: PASS ({len(mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
