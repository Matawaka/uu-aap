#!/usr/bin/env python3
import copy
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def parse_time(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def within_prefix(child, parent):
    return any(child.startswith(p) for p in parent)


def validate(data):
    ds = data["delegations"]
    by_id = {d["id"]: d for d in ds}
    assert len(by_id) == len(ds)
    assert data["coordination_receipt"]["authority_source"] is False
    assert data["previous_success_receipt"]["authority_source"] is False
    assert data["outcome_creates_successor_permit"] is False

    root = ds[0]
    assert root["parent_id"] is None
    assert root["authority_source"] == "explicit_human_authorization"
    assert root["single_use"] is True

    for child in ds[1:]:
        assert child["parent_id"] in by_id
        parent = by_id[child["parent_id"]]
        assert child["authority_source"] == "parent_delegation"
        assert parent["may_redelegate"] is True
        assert parent["remaining_depth"] > 0
        assert child["remaining_depth"] == parent["remaining_depth"] - 1
        assert child["repository"] == parent["repository"]
        assert child["target_frontier"] == parent["target_frontier"]
        assert set(child["allowed_effects"]) <= set(parent["allowed_effects"])
        assert set(child["forbidden_effects"]) >= set(parent["forbidden_effects"])
        assert child["single_use"] is True
        assert parse_time(child["expires_at"]) <= parse_time(parent["expires_at"])
        assert all(within_prefix(p, parent["path_prefixes"]) for p in child["path_prefixes"])
        if not child["may_redelegate"]:
            assert child["remaining_depth"] == 0


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, ValueError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    base = json.loads((ROOT / "delegation-chain.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["delegations"][1]["allowed_effects"].append("push"),
        lambda d: d["delegations"][1]["path_prefixes"].__setitem__(0, "pilots/"),
        lambda d: d["delegations"][1].__setitem__("expires_at", "2026-09-02T00:00:00Z"),
        lambda d: d["delegations"][1].__setitem__("single_use", False),
        lambda d: d["delegations"][1]["forbidden_effects"].remove("merge"),
        lambda d: d["delegations"][1].__setitem__("parent_id", "missing"),
        lambda d: d["delegations"][0].__setitem__("may_redelegate", False),
        lambda d: d["delegations"][1].__setitem__("remaining_depth", 2),
        lambda d: d["coordination_receipt"].__setitem__("authority_source", True),
        lambda d: d["previous_success_receipt"].__setitem__("authority_source", True),
        lambda d: d["delegations"][2].__setitem__("target_frontier", "different-frontier"),
        lambda d: d.__setitem__("outcome_creates_successor_permit", True),
        lambda d: d["delegations"][2].__setitem__("may_redelegate", True),
        lambda d: d["delegations"][2].__setitem__("repository", "other/repo")
    ]
    for mutation in mutations:
        expect_fail(base, mutation)

    print(f"Core Pilot 003 validation: PASS ({len(mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
