#!/usr/bin/env python3
"""P0.8: keep current soft-binding resolution separate from historical PoAI availability."""

from __future__ import annotations

import argparse
import hashlib
import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

RECEIPT_SCHEMA = "urn:uu-aap:c2pa-soft-binding-poai-availability-receipt:0.1"
FIXTURE_SCHEMA = "urn:uu-aap:c2pa-soft-binding-poai-availability-fixture:0.1"


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def canonical_sha256(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


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
    assert doc["schema"] == FIXTURE_SCHEMA
    assert doc["issue"] == 794
    assert doc["repository_predecessor_main"] == "7353084b9a78b6c3d478cfc81732773d5d0f2441"

    p04 = doc["predecessor_p0_4"]
    assert p04["path"] == "scripts/c2pa-agent-composition/composition.fixture.json"
    assert p04["git_blob_sha"] == "143609c6d58a978e2eb3570aa9d093dccada092a"
    boundary = p04["decision_boundary"]
    opened = parse_time(boundary["opened_at"])
    cutoff = parse_time(boundary["knowledge_cutoff"])
    closed = parse_time(boundary["closed_at"])
    assert opened < cutoff < closed

    refs = doc["reference_contracts"]
    assert refs["trustmark"]["sha"] == "0ed40cbe8188f664fd9cbbeacd969807de27440a"
    assert refs["trustmark"]["readme_blob"] == "6f02bc07483429190e78df50cd398b8be189373d"
    assert refs["trustmark"]["example_blob"] == "a40b39d5bfda0dd1ed63ddb33db791681a20d591"
    registry = refs["softbinding_registry"]
    assert registry["sha"] == "a9d9699097785b6ffa8e46cefba21f366308fa06"
    assert registry["algorithm"] == "com.adobe.trustmark.Q"
    assert registry["identifier"] == 4
    assert registry["type"] == "watermark"
    assert registry["decoded_media_types"] == ["image"]
    assert refs["c2pa_specifications"]["sha"] == "9c58c8c27044e44e8601f6ab13f1bcac1376eb1f"

    assertion = doc["soft_binding_assertion"]
    assert assertion["label"] == "c2pa.soft-binding"
    data = assertion["data"]
    assert data["alg"] == registry["algorithm"]
    assert isinstance(data["blocks"], list) and len(data["blocks"]) == 1
    block = data["blocks"][0]
    assert isinstance(block["scope"], dict)
    assert isinstance(block["value"], str) and block["value"]

    events = doc["resolver_history"]
    ids = [event["event_id"] for event in events]
    assert len(ids) == len(set(ids)), "resolver event ids must be unique"
    for event in events:
        parse_time(event["observed_at"])
        assert event["event_type"] in {"resolution", "repository_ingestion", "consideration"}
        if event["event_type"] == "resolution":
            assert event["status"] in {"RESOLVED", "NOT_FOUND", "UNAVAILABLE"}
            if event["status"] == "RESOLVED":
                assert event.get("manifest_ref"), f"resolved event missing manifest_ref: {event['event_id']}"
            assert isinstance(event.get("delivered_to_decision"), bool)
        if event["event_type"] == "consideration":
            assert event["status"] in {"USED", "NOT_USED"}

    for path, key, child in walk_keys(doc):
        lower = key.lower()
        if "score" in lower:
            assert path == "non_effects.aggregate_score_created" and child is False, f"score field forbidden: {path}"
        assert lower not in {"trust_rating", "reputation_rating", "compatibility_rating"}, path

    assert all(value is False for value in doc["non_effects"].values())


def evaluate(doc: dict[str, Any]) -> dict[str, Any]:
    validate_static(doc)
    boundary = doc["predecessor_p0_4"]["decision_boundary"]
    cutoff = parse_time(boundary["knowledge_cutoff"])
    closed = parse_time(boundary["closed_at"])
    events = deepcopy(doc["resolver_history"])
    events.sort(key=lambda event: parse_time(event["observed_at"]))

    resolutions = [event for event in events if event["event_type"] == "resolution"]
    assert resolutions, "at least one resolver observation required"
    latest_resolution = resolutions[-1]
    current_resolves = latest_resolution["status"] == "RESOLVED" and bool(latest_resolution.get("manifest_ref"))
    current_resolution = {
        "status": "SOFT_BINDING_RESOLVES_NOW" if current_resolves else "SOFT_BINDING_NOT_RESOLVED_NOW",
        "observed_at": latest_resolution["observed_at"],
        "manifest_ref": latest_resolution.get("manifest_ref") if current_resolves else None,
        "evidence_event_id": latest_resolution["event_id"],
    }

    pre_cutoff_resolutions = [
        event for event in resolutions if parse_time(event["observed_at"]) <= cutoff
    ]
    successful_pre_cutoff = [
        event for event in pre_cutoff_resolutions
        if event["status"] == "RESOLVED" and bool(event.get("manifest_ref"))
    ]
    delivered_pre_cutoff = [
        event for event in successful_pre_cutoff if event["delivered_to_decision"] is True
    ]

    temporal_fit = "available" if successful_pre_cutoff else "unavailable"
    delivery = "available" if delivered_pre_cutoff else "unavailable"
    overall_available = bool(successful_pre_cutoff and delivered_pre_cutoff)
    historical_availability = {
        "status": "AVAILABLE_BEFORE_CUTOFF" if overall_available else "UNAVAILABLE_BEFORE_CUTOFF",
        "dimensions": {
            "temporal_fit": temporal_fit,
            "delivery": delivery,
        },
        "successful_pre_cutoff_resolution_event_ids": [event["event_id"] for event in successful_pre_cutoff],
        "delivered_pre_cutoff_event_ids": [event["event_id"] for event in delivered_pre_cutoff],
        "knowledge_cutoff": boundary["knowledge_cutoff"],
    }

    consideration_events = [
        event for event in events
        if event["event_type"] == "consideration" and parse_time(event["observed_at"]) <= closed
    ]
    if consideration_events:
        latest_consideration = consideration_events[-1]
        consideration = {
            "status": latest_consideration["status"],
            "observed_at": latest_consideration["observed_at"],
            "evidence_event_id": latest_consideration["event_id"],
        }
    else:
        consideration = {"status": "NOT_ESTABLISHED", "observed_at": None, "evidence_event_id": None}

    ingestions = [event for event in events if event["event_type"] == "repository_ingestion"]
    first_ingestion = ingestions[0] if ingestions else None
    repository = {
        "ingestion_observed": first_ingestion is not None,
        "first_ingestion_at": first_ingestion["observed_at"] if first_ingestion else None,
        "ingestion_before_cutoff": bool(first_ingestion and parse_time(first_ingestion["observed_at"]) <= cutoff),
        "manifest_ref": first_ingestion.get("manifest_ref") if first_ingestion else None,
        "proves_delivery": False,
        "proves_consideration": False,
    }

    assertion = doc["soft_binding_assertion"]
    receipt = {
        "schema": RECEIPT_SCHEMA,
        "issue": 794,
        "fixture_sha256": canonical_sha256(doc),
        "repository_predecessor_main": doc["repository_predecessor_main"],
        "soft_binding": {
            "label": assertion["label"],
            "algorithm": assertion["data"]["alg"],
            "value": assertion["data"]["blocks"][0]["value"],
            "identifier_present": True,
        },
        "current_resolution": current_resolution,
        "decision_boundary": deepcopy(boundary),
        "historical_availability": historical_availability,
        "consideration": consideration,
        "repository": repository,
        "semantic_state": {
            "truth": "NOT_ESTABLISHED",
            "authorship": "NOT_ESTABLISHED",
            "authority": "UNCHANGED",
            "responsibility": "UNCHANGED",
        },
        "non_effects": deepcopy(doc["non_effects"]),
        "aggregate_score_present": False,
    }
    return receipt


def assert_expected(doc: dict[str, Any], receipt: dict[str, Any]) -> None:
    expected = doc["expected"]
    assert receipt["current_resolution"]["status"] == expected["current_resolution"]
    assert receipt["historical_availability"]["status"] == expected["poai_historical_availability"]
    assert receipt["consideration"]["status"] == expected["consideration"]
    assert receipt["semantic_state"]["truth"] == expected["truth"]
    assert receipt["semantic_state"]["authority"] == expected["authority"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture")
    parser.add_argument("--assert-expected", action="store_true")
    args = parser.parse_args()
    doc = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    receipt = evaluate(doc)
    if args.assert_expected:
        assert_expected(doc, receipt)
    print(json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
