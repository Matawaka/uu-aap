#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def validate(data):
    attempt = data["attempt"]
    obs = data["observation"]
    rec = data["reconciliation"]

    assert attempt["acknowledgement"] in {"timeout", "transport_error", "unknown"}
    assert attempt["outcome_state"] == "UNKNOWN"
    assert attempt["permit_consumed"] is True

    assert obs["mode"] == "read_only"
    assert obs["external_mutation_performed"] is False
    assert obs["repository"] == attempt["repository"]
    assert obs["issue_number"] == attempt["issue_number"]
    assert obs["frontier_context"] == data["origin_frontier"]

    assert rec["status"] in {"CONFIRMED", "ABSENT", "CONFLICT"}
    assert rec["successor_permit_created"] is False

    if rec["status"] == "CONFIRMED":
        assert obs["scope_complete"] is True
        assert obs["matching_effect_count"] == 1
        assert obs["conflicting_effect_count"] == 0
        assert obs["observed_payload_sha256"] == attempt["payload_sha256"]
        assert rec["retry_authorized"] is False

    elif rec["status"] == "ABSENT":
        assert obs["scope_complete"] is True
        assert obs["matching_effect_count"] == 0
        assert obs["conflicting_effect_count"] == 0
        if rec["retry_authorized"]:
            assert rec["fresh_human_authorization_present"] is True
            assert rec["fresh_permit_present"] is True

    elif rec["status"] == "CONFLICT":
        assert obs["conflicting_effect_count"] > 0 or obs["matching_effect_count"] > 1
        if rec["retry_authorized"]:
            assert rec["fresh_human_authorization_present"] is True
            assert rec["fresh_permit_present"] is True

    # Original consumed permit is never reusable.
    assert not (rec["retry_authorized"] and not rec["fresh_permit_present"])


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, ValueError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    base = json.loads((ROOT / "reconciliation-fixture.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["attempt"].__setitem__("outcome_state", "ABSENT"),
        lambda d: d["reconciliation"].__setitem__("retry_authorized", True),
        lambda d: d["attempt"].__setitem__("permit_consumed", False),
        lambda d: d["observation"].__setitem__("observed_payload_sha256", "mismatch"),
        lambda d: d["observation"].__setitem__("scope_complete", False),
        lambda d: d["observation"].__setitem__("matching_effect_count", 2),
        lambda d: d["observation"].__setitem__("conflicting_effect_count", 1),
        lambda d: d["reconciliation"].__setitem__("successor_permit_created", True),
        lambda d: d["observation"].__setitem__("external_mutation_performed", True),
        lambda d: d["observation"].__setitem__("repository", "other/repo"),
        lambda d: d["observation"].__setitem__("issue_number", 999),
        lambda d: d["observation"].__setitem__("frontier_context", "stale-frontier"),
        lambda d: d["reconciliation"].update({"status": "ABSENT", "retry_authorized": True, "fresh_human_authorization_present": False, "fresh_permit_present": True}),
        lambda d: d["reconciliation"].update({"status": "ABSENT", "retry_authorized": True, "fresh_human_authorization_present": True, "fresh_permit_present": False}),
        lambda d: d["reconciliation"].update({"status": "CONFLICT", "retry_authorized": True, "fresh_human_authorization_present": False, "fresh_permit_present": False}),
        lambda d: d["reconciliation"].__setitem__("status", "UNKNOWN"),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(f"Core Pilot 005 validation: PASS ({len(mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
