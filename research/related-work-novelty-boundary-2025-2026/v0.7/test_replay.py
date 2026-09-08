#!/usr/bin/env python3
from __future__ import annotations

import copy
import json

from replay_statebench import canonical_json_bytes, git_blob_sha1, replay_payload
from validate_replay import validate_result, validate_static


def encode_records(records):
    return b"".join((json.dumps(record, separators=(",", ":")) + "\n").encode("utf-8") for record in records)


def manifest_for(data: bytes, count: int) -> dict:
    return {
        "frozen_predecessor": {"commit": "6823b9765894f410960c15ad797c4f6949c6225e"},
        "source": {
            "repository": "Parslee-ai/statebench",
            "commit": "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7",
            "path": "data/releases/v1.0/test.jsonl",
            "git_blob_sha1": git_blob_sha1(data),
            "expected_bytes": len(data),
            "expected_fixture_count": count,
        },
    }


def mapping() -> dict:
    return {
        "mappings": [
            {"track": "authority_hierarchy", "classification": "DIRECT"},
            {"track": "scope_permission", "classification": "PARTIAL"},
            {"track": "causality", "classification": "AMBIGUOUS"},
            {"track": "supersession", "classification": "UNMAPPED"},
        ]
    }


def expect_failure(fn) -> None:
    try:
        fn()
    except (AssertionError, ValueError):
        return
    raise AssertionError("expected failure did not occur")


def baseline_records():
    return [
        {
            "id": "A",
            "track": "authority_hierarchy",
            "domain": "enterprise",
            "events": [{"type": "query", "ground_truth": {"decision": "deny"}}],
        },
        {
            "id": "B",
            "track": "new_future_track",
            "domain": "support",
            "events": [{"type": "query", "ground_truth": None}],
        },
    ]


def main() -> int:
    checks = 0

    validate_static()
    checks += 1

    records = baseline_records()
    data = encode_records(records)
    manifest = manifest_for(data, 2)
    result = replay_payload(data, manifest, mapping())
    assert result["fixture_counts"] == {"total": 2, "unique_ids": 2, "missing_ids": 0}
    assert result["mapping_counts"] == {"DIRECT": 1, "PARTIAL": 0, "AMBIGUOUS": 0, "UNMAPPED": 1}
    assert result["unexpected_tracks"] == ["new_future_track"]
    assert result["query_counts"] == {"events": 2, "with_ground_truth": 1, "without_ground_truth": 1}
    checks += 1

    expect_failure(lambda: replay_payload(data, {**manifest, "source": {**manifest["source"], "expected_bytes": len(data) + 1}}, mapping()))
    checks += 1

    expect_failure(lambda: replay_payload(data, {**manifest, "source": {**manifest["source"], "git_blob_sha1": "0" * 40}}, mapping()))
    checks += 1

    expect_failure(lambda: replay_payload(data, {**manifest, "source": {**manifest["source"], "expected_fixture_count": 3}}, mapping()))
    checks += 1

    duplicate = encode_records([records[0], {**records[1], "id": "A"}])
    expect_failure(lambda: replay_payload(duplicate, manifest_for(duplicate, 2), mapping()))
    checks += 1

    missing = encode_records([{k: v for k, v in records[0].items() if k != "id"}])
    expect_failure(lambda: replay_payload(missing, manifest_for(missing, 1), mapping()))
    checks += 1

    invalid_json = b"{not-json}\n"
    expect_failure(lambda: replay_payload(invalid_json, manifest_for(invalid_json, 1), mapping()))
    checks += 1

    scalar_json = b"42\n"
    expect_failure(lambda: replay_payload(scalar_json, manifest_for(scalar_json, 1), mapping()))
    checks += 1

    bad_events = encode_records([{**records[0], "events": "not-a-list"}])
    expect_failure(lambda: replay_payload(bad_events, manifest_for(bad_events, 1), mapping()))
    checks += 1

    bad_event_item = encode_records([{**records[0], "events": ["not-an-object"]}])
    expect_failure(lambda: replay_payload(bad_event_item, manifest_for(bad_event_item, 1), mapping()))
    checks += 1

    bad_mapping = {"mappings": [{"track": "authority_hierarchy", "classification": "MAGIC"}]}
    one = encode_records([records[0]])
    expect_failure(lambda: replay_payload(one, manifest_for(one, 1), bad_mapping))
    checks += 1

    result2 = replay_payload(data, manifest, mapping())
    assert canonical_json_bytes(result) == canonical_json_bytes(result2)
    checks += 1

    valid_shape = copy.deepcopy(result)
    valid_shape["predecessor"] = "6823b9765894f410960c15ad797c4f6949c6225e"
    valid_shape["source"] = {
        "repository": "Parslee-ai/statebench",
        "commit": "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7",
        "path": "data/releases/v1.0/test.jsonl",
        "git_blob_sha1": "3d0bcce1a7725384cf7c25eb4695a784e6a275cd",
    }
    valid_shape["payload"] = {
        "bytes": 638933,
        "git_blob_sha1": "3d0bcce1a7725384cf7c25eb4695a784e6a275cd",
        "sha256": "a" * 64,
        "utf8_valid": True,
        "jsonl_records": 209,
    }
    valid_shape["fixture_counts"] = {"total": 209, "unique_ids": 209, "missing_ids": 0}
    valid_shape["mapping_counts"] = {"DIRECT": 1, "PARTIAL": 1, "AMBIGUOUS": 1, "UNMAPPED": 206}
    valid_shape["track_counts"] = {"synthetic": 209}
    valid_shape["query_counts"] = {"events": 0, "with_ground_truth": 0, "without_ground_truth": 0}
    validate_result(valid_shape)
    checks += 1

    inflated = copy.deepcopy(valid_shape)
    inflated["execution_evidence_level"] = "UPSTREAM_IMPLEMENTATION_EXECUTED"
    expect_failure(lambda: validate_result(inflated))
    checks += 1

    scored = copy.deepcopy(valid_shape)
    scored["performance"]["held_out_detection_recall"] = 1.0
    expect_failure(lambda: validate_result(scored))
    checks += 1

    false_negative_claim = copy.deepcopy(valid_shape)
    false_negative_claim["non_effects"]["detection_non_advantage_established"] = True
    expect_failure(lambda: validate_result(false_negative_claim))
    checks += 1

    implementation_claim = copy.deepcopy(valid_shape)
    implementation_claim["non_effects"]["upstream_implementation_executed"] = True
    expect_failure(lambda: validate_result(implementation_claim))
    checks += 1

    print(f"PASS: {checks}/{checks} baseline+hostile v0.7 replay checks")
    assert checks == 18
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
