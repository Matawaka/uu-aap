#!/usr/bin/env python3
"""Fail-closed validator for the P0.4 C2PA MCP -> PoAI -> UU-AAP composition example."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


def load_json(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def walk_keys(value: Any, prefix: str = ""):
    if isinstance(value, dict):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else key
            yield path, key, child
            yield from walk_keys(child, path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_keys(child, f"{prefix}[{index}]")


def validate_static(doc: dict[str, Any]) -> None:
    assert doc["schema"] == "urn:uu-aap:c2pa-mcp-poai-uuaap-composition:0.1"
    assert doc["roadmap_issue"] == 778
    assert doc["status"] == "COMPLETE"
    assert doc["p0_4_complete"] is True

    c2pa = doc["c2pa_layer"]
    poai = doc["poai_layer"]
    uuaap = doc["uuaap_layer"]
    view = doc["expected_agent_view"]

    # C2PA is an artifact-evidence oracle only.
    assert c2pa["provider"] == "contentauth/c2pa-mcp"
    assert c2pa["pinned_sha"] == "ef521f06dc3900fcc5afdc8ad9fe846011c44f0d"
    assert c2pa["expected_runtime_contract"] == {
        "success": True,
        "hasCredentials": True,
        "manifestData_required": True,
    }
    forbidden_c2pa_promotions = " ".join(c2pa["does_not_establish"]).lower()
    for token in ("available before", "factual truth", "publication authority", "responsibility", "considered"):
        assert token in forbidden_c2pa_promotions, f"missing C2PA non-effect: {token}"

    # The PoAI record must represent the historical decision boundary explicitly.
    assert poai["protocol"] == "PoAI"
    assert poai["protocol_version"] == "0.0.1"
    cutoff = parse_time(poai["decision_boundary"]["knowledge_cutoff"])
    delivered = parse_time(c2pa["evidence_delivered_at"])
    assert delivered > cutoff, "fixture must model post-cutoff credential delivery"

    availability = poai["availability"]
    assert len(availability) == 1
    a = availability[0]
    assert a["dimensions"]["temporal_fit"] == "unavailable"
    assert a["dimensions"]["delivery"] == "unavailable"
    assert a["overall_status"] == "unavailable"
    assert poai["consideration"][0]["status"] == "not_used"

    # Authority must stay independent from provenance and availability.
    authority = {entry["actor_id"]: entry for entry in poai["authority"]}
    assert set(authority["editor-1"]["scopes"]) >= {"decide", "approve"}
    assert "decide" not in authority["agent-1"]["scopes"]
    assert "approve" not in authority["agent-1"]["scopes"]
    assert authority["agent-1"]["status"] == "limited"

    assert uuaap["source_contract"] == "protocols/core/v0.1"
    assert uuaap["representation"] == "composition projection; not a standalone Core receipt"
    assert uuaap["publication_authority"]["actor_id"] == "editor-1"
    assert uuaap["scoped_responsibility"]["actor_id"] == "editor-1"
    assert "decide" not in uuaap["agent_authority"]["scopes"]
    assert "approve" not in uuaap["agent_authority"]["scopes"]
    assert all(value is False for value in uuaap["non_effects"].values())

    # The three layers must deliberately return different answers.
    assert view["c2pa"] == "CREDENTIALS_PRESENT"
    assert view["poai"] == "UNAVAILABLE_BEFORE_CUTOFF"
    assert view["uuaap"] == "HUMAN_PUBLICATION_AUTHORITY"
    assert len({view["c2pa"], view["poai"], view["uuaap"]}) == 3
    assert view["single_trust_score_permitted"] is False
    assert view["semantic_collapse_permitted"] is False

    # No aggregate/reputation score may sneak into the composition.
    allowed_score_flag = "expected_agent_view.single_trust_score_permitted"
    for path, key, child in walk_keys(doc):
        key_lower = key.lower()
        if "score" in key_lower:
            assert path == allowed_score_flag and child is False, f"score-like field forbidden: {path}"
        assert key_lower not in {"overall_trust", "trust_rating", "reputation_rating"}, path


def validate_runtime(doc: dict[str, Any], runtime: dict[str, Any]) -> None:
    expected = doc["c2pa_layer"]["expected_runtime_contract"]
    assert runtime.get("success") is expected["success"], runtime
    assert runtime.get("hasCredentials") is expected["hasCredentials"], runtime
    assert runtime.get("error") in (None, ""), runtime.get("error")

    manifest = runtime.get("manifestData")
    if expected["manifestData_required"]:
        assert manifest is not None, "C2PA MCP returned no manifestData"
        if isinstance(manifest, (dict, list)):
            assert len(manifest) > 0, "manifestData is empty"
        elif isinstance(manifest, str):
            assert manifest.strip(), "manifestData string is empty"
        else:
            raise AssertionError(f"unexpected manifestData type: {type(manifest).__name__}")

    # Runtime C2PA success must not alter the static PoAI/UU-AAP conclusions.
    assert doc["poai_layer"]["availability"][0]["overall_status"] == "unavailable"
    assert doc["uuaap_layer"]["publication_authority"]["actor_id"] == "editor-1"
    assert doc["expected_agent_view"] == {
        "c2pa": "CREDENTIALS_PRESENT",
        "poai": "UNAVAILABLE_BEFORE_CUTOFF",
        "uuaap": "HUMAN_PUBLICATION_AUTHORITY",
        "single_trust_score_permitted": False,
        "semantic_collapse_permitted": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture")
    parser.add_argument("--c2pa-result")
    args = parser.parse_args()

    doc = load_json(args.fixture)
    validate_static(doc)
    print("static layered composition: PASS")

    if args.c2pa_result:
        runtime = load_json(args.c2pa_result)
        validate_runtime(doc, runtime)
        print("official C2PA MCP runtime contract: PASS")
        print("layer separation: CREDENTIALS_PRESENT != UNAVAILABLE_BEFORE_CUTOFF != HUMAN_PUBLICATION_AUTHORITY")
    else:
        print("runtime C2PA result not supplied; static contract only")


if __name__ == "__main__":
    main()
