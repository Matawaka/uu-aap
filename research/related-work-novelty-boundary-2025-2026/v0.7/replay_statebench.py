#!/usr/bin/env python3
"""Replay the exact pinned StateBench v1.0 public test payload.

This script evaluates payload identity and taxonomy portability only. It does not
execute StateBench baselines/models and it does not score Matawaka predictions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO_ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = HERE / "source-manifest.json"


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def git_blob_sha1(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Matawaka-StateBench-Replay-v0.7"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"unexpected HTTP status: {response.status}")
        return response.read()


def parse_jsonl(data: bytes) -> list[dict[str, Any]]:
    text = data.decode("utf-8", errors="strict")
    records: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        if not raw_line.strip():
            continue
        try:
            value = json.loads(raw_line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSONL at line {line_number}: {exc}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"record at line {line_number} is not an object")
        records.append(value)
    return records


def validate_mapping_identity(manifest: dict[str, Any]) -> dict[str, Any]:
    predecessor = manifest["frozen_predecessor"]
    mapping_path = REPO_ROOT / predecessor["track_mapping_path"]
    mapping_bytes = mapping_path.read_bytes()
    observed_blob = git_blob_sha1(mapping_bytes)
    expected_blob = predecessor["track_mapping_git_blob_sha1"]
    if observed_blob != expected_blob:
        raise ValueError(
            f"frozen v0.6 mapping blob mismatch: expected {expected_blob}, observed {observed_blob}"
        )
    mapping = json.loads(mapping_bytes.decode("utf-8"))
    if mapping.get("schema") != "matawaka.statebench-track-mapping/v0.6":
        raise ValueError("unexpected v0.6 track mapping schema")
    return mapping


def replay_payload(data: bytes, manifest: dict[str, Any], mapping: dict[str, Any]) -> dict[str, Any]:
    source = manifest["source"]

    expected_bytes = source["expected_bytes"]
    if len(data) != expected_bytes:
        raise ValueError(f"payload byte mismatch: expected {expected_bytes}, observed {len(data)}")

    observed_blob = git_blob_sha1(data)
    if observed_blob != source["git_blob_sha1"]:
        raise ValueError(
            f"payload Git blob mismatch: expected {source['git_blob_sha1']}, observed {observed_blob}"
        )

    records = parse_jsonl(data)
    expected_count = source["expected_fixture_count"]
    if len(records) != expected_count:
        raise ValueError(f"fixture count mismatch: expected {expected_count}, observed {len(records)}")

    ids: list[str] = []
    missing_ids = 0
    for index, record in enumerate(records):
        fixture_id = record.get("id")
        if not isinstance(fixture_id, str) or not fixture_id:
            missing_ids += 1
            continue
        ids.append(fixture_id)
    if missing_ids:
        raise ValueError(f"fixtures with missing/invalid id: {missing_ids}")
    unique_ids = set(ids)
    if len(unique_ids) != len(ids):
        duplicates = sorted(fixture_id for fixture_id, count in Counter(ids).items() if count > 1)
        raise ValueError(f"duplicate fixture ids: {duplicates}")

    mapping_by_track = {entry["track"]: entry for entry in mapping["mappings"]}
    track_counts: Counter[str] = Counter()
    domain_counts: Counter[str] = Counter()
    mapping_counts: Counter[str] = Counter()
    unexpected_tracks: set[str] = set()
    query_events = 0
    queries_with_ground_truth = 0
    queries_without_ground_truth = 0

    for record in records:
        raw_track = record.get("track")
        track = raw_track if isinstance(raw_track, str) and raw_track else "__MISSING_TRACK__"
        raw_domain = record.get("domain")
        domain = raw_domain if isinstance(raw_domain, str) and raw_domain else "__MISSING_DOMAIN__"
        track_counts[track] += 1
        domain_counts[domain] += 1

        mapping_entry = mapping_by_track.get(track)
        if mapping_entry is None:
            classification = "UNMAPPED"
            unexpected_tracks.add(track)
        else:
            classification = mapping_entry["classification"]
        if classification not in {"DIRECT", "PARTIAL", "AMBIGUOUS", "UNMAPPED"}:
            raise ValueError(f"invalid mapping classification for {track}: {classification}")
        mapping_counts[classification] += 1

        events = record.get("events", [])
        if events is None:
            events = []
        if not isinstance(events, list):
            raise ValueError(f"fixture {record['id']} has non-list events")
        for event in events:
            if not isinstance(event, dict):
                raise ValueError(f"fixture {record['id']} has non-object event")
            if event.get("type") == "query":
                query_events += 1
                if event.get("ground_truth") is None:
                    queries_without_ground_truth += 1
                else:
                    queries_with_ground_truth += 1

    for classification in ("DIRECT", "PARTIAL", "AMBIGUOUS", "UNMAPPED"):
        mapping_counts.setdefault(classification, 0)

    if sum(mapping_counts.values()) != expected_count:
        raise AssertionError("mapping counts do not sum to fixture count")

    result = {
        "schema": "matawaka.statebench-full-payload-replay-results/v0.7",
        "predecessor": manifest["frozen_predecessor"]["commit"],
        "source": {
            "repository": source["repository"],
            "commit": source["commit"],
            "path": source["path"],
            "git_blob_sha1": source["git_blob_sha1"],
        },
        "dataset_replay_status": "FULL_PINNED_TEST_PAYLOAD_REPLAYED",
        "execution_evidence_level": "UPSTREAM_DATASET_ADAPTED",
        "payload": {
            "bytes": len(data),
            "git_blob_sha1": observed_blob,
            "sha256": hashlib.sha256(data).hexdigest(),
            "utf8_valid": True,
            "jsonl_records": len(records),
        },
        "fixture_counts": {
            "total": len(records),
            "unique_ids": len(unique_ids),
            "missing_ids": 0,
        },
        "mapping_counts": {key: mapping_counts[key] for key in ("DIRECT", "PARTIAL", "AMBIGUOUS", "UNMAPPED")},
        "track_counts": dict(sorted(track_counts.items())),
        "domain_counts": dict(sorted(domain_counts.items())),
        "query_counts": {
            "events": query_events,
            "with_ground_truth": queries_with_ground_truth,
            "without_ground_truth": queries_without_ground_truth,
        },
        "unexpected_tracks": sorted(unexpected_tracks),
        "performance": {
            "held_out_detection_recall": None,
            "benign_false_positive_rate": None,
            "statebench_model_score": None,
            "matawaka_model_score": None,
        },
        "non_effects": {
            "upstream_implementation_executed": False,
            "external_model_executed": False,
            "statebench_baseline_executed": False,
            "detection_advantage_established": False,
            "detection_non_advantage_established": False,
            "novelty_established": False,
            "world_first": False,
            "merge_authorized": False,
        },
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    parser.add_argument("--hash-output", type=Path)
    parser.add_argument("--payload-file", type=Path, help="Use local bytes instead of network fetch")
    args = parser.parse_args()

    manifest = load_json(MANIFEST_PATH)
    if manifest.get("schema") != "matawaka.statebench-pinned-source-manifest/v0.7":
        raise ValueError("unexpected source manifest schema")
    mapping = validate_mapping_identity(manifest)

    if args.payload_file:
        data = args.payload_file.read_bytes()
    else:
        data = fetch_bytes(manifest["source"]["raw_url"])

    result = replay_payload(data, manifest, mapping)
    encoded = canonical_json_bytes(result)
    result_sha256 = hashlib.sha256(encoded).hexdigest()

    if args.output:
        args.output.write_bytes(encoded)
    else:
        sys.stdout.buffer.write(encoded)
    if args.hash_output:
        args.hash_output.write_text(result_sha256 + "\n", encoding="ascii")

    print(f"RESULT_SHA256={result_sha256}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
