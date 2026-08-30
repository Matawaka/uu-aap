#!/usr/bin/env python3
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ALLOWED_SCORE_KEYS = {"single_trust_score_permitted"}


def parse_time(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def by_id(items, key):
    return {item[key]: item for item in items}


def reject_score_fields(value, path="$"):
    if isinstance(value, dict):
        for key, child in value.items():
            if "score" in key.lower() and key not in ALLOWED_SCORE_KEYS:
                raise AssertionError(f"aggregate/score-like field prohibited at {path}.{key}")
            reject_score_fields(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_score_fields(child, f"{path}[{index}]")


def validate_static(doc):
    assert doc["schema"] == "urn:uu-aap:c2pa-field-evidence-public-interest-pilot:0.1"
    assert doc["roadmap_issue"] == 778
    assert doc["roadmap_surface"] == "P0.5"
    assert doc["status"] == "COMPLETE"
    assert doc["p0_5_complete"] is True

    scenario = doc["scenario"]
    assert scenario["kind"] == "synthetic_public_interest_timeline"
    assert scenario["real_incident_claimed"] is False
    cutoff = parse_time(scenario["knowledge_cutoff"])

    capture = doc["capture_workflow"]
    assert capture["provider"] == "guardianproject/proofmode-android"
    assert capture["pinned_sha"] == "b7588b9d6b5e0df892cc929bf7d76ca03d9f5c07"
    assert capture["readme_git_blob"] == "ab0309c2084e3daf00ec62b729d7e49e9fd2ad3d"
    assert capture["observed_c2pa_baseline"] == "2.3"
    assert capture["c2pa_2_4_conformance_claimed"] is False
    assert "factual truth of the depicted event" in capture["does_not_establish"]
    assert "decision-time availability to a later decision-maker" in capture["does_not_establish"]
    assert "publication authority or scoped responsibility" in capture["does_not_establish"]

    timeline = by_id(doc["resource_timeline"], "resource_id")
    late_t = timeline["proofmode-capture-late"]
    unused_t = timeline["proofmode-capture-unused"]
    agent_t = timeline["agent-analysis-used"]

    assert parse_time(late_t["captured_at"]) <= cutoff < parse_time(late_t["delivered_at"])
    assert parse_time(unused_t["captured_at"]) <= parse_time(unused_t["delivered_at"]) <= cutoff
    assert parse_time(agent_t["captured_at"]) <= parse_time(agent_t["delivered_at"]) <= cutoff

    poai = doc["poai_record"]
    assert parse_time(poai["decision_boundary"]["knowledge_cutoff"]) == cutoff

    availability = by_id(poai["availability"], "resource_id")
    consideration = by_id(poai["consideration"], "resource_id")

    late_a = availability["proofmode-capture-late"]
    assert late_a["overall_status"] == "unavailable"
    assert late_a["dimensions"]["temporal_fit"] == "unavailable"
    assert late_a["dimensions"]["delivery"] == "unavailable"
    assert consideration["proofmode-capture-late"]["status"] == "not_used"

    unused_a = availability["proofmode-capture-unused"]
    assert unused_a["overall_status"] == "available"
    assert unused_a["dimensions"]["temporal_fit"] == "available"
    assert unused_a["dimensions"]["delivery"] == "available"
    assert consideration["proofmode-capture-unused"]["status"] == "not_used"

    agent_a = availability["agent-analysis-used"]
    assert agent_a["overall_status"] == "available"
    assert agent_a["dimensions"]["delivery"] == "available"
    assert consideration["agent-analysis-used"]["status"] in {"considered", "relied_upon"}

    authority = by_id(poai["authority"], "actor_id")
    editor_scopes = set(authority["editor-1"]["scopes"])
    agent_scopes = set(authority["agent-1"]["scopes"])
    reporter_scopes = set(authority["field-reporter-1"]["scopes"])
    assert {"decide", "approve"}.issubset(editor_scopes)
    assert agent_scopes <= {"request_analysis", "recommend"}
    assert not ({"decide", "approve", "execute"} & agent_scopes)
    assert reporter_scopes <= {"observe"}
    assert not ({"decide", "approve"} & reporter_scopes)

    uuaap = doc["uuaap_layer"]
    assert uuaap["publication_authority"]["actor_id"] == "editor-1"
    assert uuaap["scoped_responsibility"]["actor_id"] == "editor-1"
    assert set(uuaap["agent_authority"]["scopes"]) <= {"request_analysis", "recommend"}
    assert set(uuaap["capture_actor_authority"]["scopes"]) <= {"observe"}
    assert all(value is False for value in uuaap["non_effects"].values())

    expected = doc["expected_result"]
    assert expected["late_capture"] == "PROVENANCE_EXISTS_NOT_AVAILABLE"
    assert expected["available_unused_capture"] == "AVAILABLE_NOT_USED"
    assert expected["agent_analysis"] == "USED_WITHOUT_DECISION_AUTHORITY"
    assert expected["publication_authority"] == "HUMAN_EDITOR"
    assert expected["scoped_responsibility"] == "HUMAN_EDITOR"
    assert expected["factual_truth"] == "NOT_ESTABLISHED"
    assert expected["single_trust_score_permitted"] is False
    assert expected["semantic_collapse_permitted"] is False

    reject_score_fields(doc)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate-pilot.py PILOT.json")
    path = Path(sys.argv[1])
    doc = json.loads(path.read_text(encoding="utf-8"))
    validate_static(doc)
    print("P0.5 field-evidence public-interest pilot: PASS")


if __name__ == "__main__":
    main()
