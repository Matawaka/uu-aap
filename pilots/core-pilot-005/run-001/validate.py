#!/usr/bin/env python3
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def validate(data):
    assert data["pilot_id"] == "core-pilot-005"
    assert data["run_id"] == "core-pilot-005-run-001"
    assert data["repository"] == "Matawaka/uu-aap"
    assert data["target"]["issue_number"] == 440
    assert data["target"]["expected_state"] == "open"

    effect = data["effect"]
    assert effect["type"] == "issue_comment_create"
    assert effect["max_effect_count"] == 1
    digest = hashlib.sha256(effect["payload_body"].encode("utf-8")).hexdigest()
    assert digest == effect["payload_sha256"]

    auth = data["authorization"]
    assert auth["human_authorized"] is False
    assert auth["execution_authorized"] is False
    assert auth["retry_authorized"] is False
    assert auth["successor_permit_created"] is False

    ack = data["acknowledgement_policy"]
    assert ack["immediate_state_after_attempt"] == "UNKNOWN"
    assert ack["write_response_is_final_evidence"] is False
    assert ack["timeout_means_absent"] is False

    obs = data["observation_policy"]
    assert obs["read_only"] is True
    assert obs["allowed_classes"] == ["CONFIRMED", "ABSENT", "CONFLICT"]
    assert obs["mutation_authorized"] is False
    assert obs["successor_permit_created"] is False

    retry = data["retry_policy"]
    assert retry["unknown_authorizes_retry"] is False
    assert retry["absent_authorizes_retry"] is False
    assert retry["confirmed_authorizes_retry"] is False
    assert retry["conflict_authorizes_retry"] is False
    assert retry["fresh_authority_required"] is True
    assert retry["original_permit_reusable_after_attempt"] is False

    assert data["status"] == "awaiting_separate_exact_execution_permit"


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, ValueError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    path = ROOT / "run-contract.json"
    base = json.loads(path.read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["target"].__setitem__("issue_number", 441),
        lambda d: d["target"].__setitem__("expected_state", "closed"),
        lambda d: d["effect"].__setitem__("type", "issue_edit"),
        lambda d: d["effect"].__setitem__("max_effect_count", 2),
        lambda d: d["effect"].__setitem__("payload_body", d["effect"]["payload_body"] + " changed"),
        lambda d: d["authorization"].__setitem__("human_authorized", True),
        lambda d: d["authorization"].__setitem__("execution_authorized", True),
        lambda d: d["authorization"].__setitem__("retry_authorized", True),
        lambda d: d["acknowledgement_policy"].__setitem__("immediate_state_after_attempt", "ABSENT"),
        lambda d: d["acknowledgement_policy"].__setitem__("write_response_is_final_evidence", True),
        lambda d: d["acknowledgement_policy"].__setitem__("timeout_means_absent", True),
        lambda d: d["observation_policy"].__setitem__("read_only", False),
        lambda d: d["observation_policy"].__setitem__("mutation_authorized", True),
        lambda d: d["retry_policy"].__setitem__("unknown_authorizes_retry", True),
        lambda d: d["retry_policy"].__setitem__("absent_authorizes_retry", True),
        lambda d: d["retry_policy"].__setitem__("confirmed_authorizes_retry", True),
        lambda d: d["retry_policy"].__setitem__("conflict_authorizes_retry", True),
        lambda d: d["retry_policy"].__setitem__("fresh_authority_required", False),
        lambda d: d["retry_policy"].__setitem__("original_permit_reusable_after_attempt", True),
        lambda d: d.__setitem__("status", "execution_authorized")
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(f"Core Pilot 005 Run 001 contract validation: PASS ({len(mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
