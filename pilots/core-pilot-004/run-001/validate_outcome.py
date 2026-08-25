#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    receipt = json.loads((ROOT / "execution-receipt.json").read_text(encoding="utf-8"))

    assert receipt["pilot_id"] == "core-pilot-004"
    assert receipt["run_id"] == "core-pilot-004-run-001"
    assert receipt["permit_id"] == "core-pilot-004-run-001-comment-001-r1"
    assert receipt["authorized_frontier"] == "365c846d6c5bb0082a46350059392ecddfa1f854"
    assert receipt["repository"] == "Matawaka/uu-aap"
    assert receipt["effect_type"] == "issue_comment_create"
    assert receipt["target"]["issue_number"] == 435
    assert receipt["target"]["expected_state_before_execution"] == "open"
    assert receipt["payload_sha256"] == "f3fa252bd30068853d15c730eb0d805cef53816fcfba04b89d30bb82c3eed2d0"

    assert receipt["human_authorization"]["explicit"] is True
    assert receipt["human_authorization"]["authorization_text"] == "Approve refreshed permit core-pilot-004-run-001-comment-001-r1"

    pre = receipt["precondition_revalidation"]
    assert pre["frontier_match"] is True
    assert pre["target_state_match"] is True
    assert pre["prior_effect_absent"] is True

    obs = receipt["observed_effect"]
    assert obs["effect_count"] == 1
    assert obs["comment_id"] == 5406621775
    assert obs["body_match"] is True
    assert obs["target_match"] is True

    assert receipt["permit_consumed"] is True
    assert receipt["external_action_authorized_after_execution"] is False
    assert receipt["successor_permit_created"] is False
    assert receipt["additional_effects_observed"] == 0
    assert receipt["result"] == "pass"

    print("Core Pilot 004 Run 001 outcome validation: PASS")


if __name__ == "__main__":
    main()
