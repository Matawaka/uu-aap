#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED_FRONTIER = "757953acdd9f936862e913812aa7d4c3c6c8528d"


def main():
    data = json.loads((ROOT / "delegation.json").read_text(encoding="utf-8"))
    assert data["run_id"] == "core-pilot-003-run-001"
    assert data["execution_frontier"] == EXPECTED_FRONTIER
    assert data["human_confirmation_required_before_external_action"] is True
    assert data["successful_run_creates_successor_permit"] is False

    root = data["human_root"]
    a = data["agent_a"]
    b = data["agent_b"]

    assert a["parent_id"] == root["id"]
    assert b["parent_id"] == a["id"]
    assert set(a["allowed_effects"]) <= set(root["allowed_effects"])
    assert set(b["allowed_effects"]) <= set(a["allowed_effects"])
    assert set(a["exercised_effects"]) <= set(a["allowed_effects"])
    assert set(b["exercised_effects"]) <= set(b["allowed_effects"])
    assert set(a["forbidden_effects"]) >= set(root["forbidden_effects"])
    assert set(b["forbidden_effects"]) >= set(a["forbidden_effects"])
    assert root["single_use"] is a["single_use"] is b["single_use"] is True
    assert root["may_redelegate"] is True
    assert a["may_redelegate"] is True
    assert b["may_redelegate"] is False
    assert (root["remaining_depth"], a["remaining_depth"], b["remaining_depth"]) == (2, 1, 0)
    assert "prepare_candidate" not in b["allowed_effects"]
    assert "prepare_candidate" in b["forbidden_effects"]
    for forbidden in ("repo_write", "issue_mutation", "pr_mutation", "push", "merge", "kontur_effect", "external_publish", "successor_permit_creation"):
        assert forbidden in root["forbidden_effects"]
        assert forbidden in a["forbidden_effects"]
        assert forbidden in b["forbidden_effects"]

    print("Core Pilot 003 Run 001 materialization: PASS")


if __name__ == "__main__":
    main()
