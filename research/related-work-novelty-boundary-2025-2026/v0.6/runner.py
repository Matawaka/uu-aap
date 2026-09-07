#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent
MAPPING = BASE / "track-mapping.json"
LEDGER = BASE / "upstream-ledger.json"
RESULTS = BASE / "results.json"


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump(data: dict[str, Any]) -> str:
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def compute() -> dict[str, Any]:
    mapping = load(MAPPING)
    ledger = load(LEDGER)
    source = ledger["sources"][0]
    rows = mapping["mappings"]
    counts = {name: 0 for name in ("DIRECT", "PARTIAL", "AMBIGUOUS", "UNMAPPED")}
    candidate_refs = 0
    for row in rows:
        counts[row["classification"]] += 1
        candidate_refs += len(row["candidate_promotions"])

    total = len(rows)
    unambiguous_candidate = counts["DIRECT"] + counts["PARTIAL"]
    required_provenance = [
        "repository", "commit", "path", "git_blob_sha", "license", "release", "evidence_level", "adapter_basis"
    ]
    present = sum(1 for key in required_provenance if source.get(key))

    return {
        "schema": "matawaka.operational-generalization-results/v0.6",
        "predecessor": "186b4a68267f911840ba3a78001dd587fad9af67",
        "upstream_source": source["id"],
        "evidence_level": source["evidence_level"],
        "top_result": "INSUFFICIENT_EVIDENCE",
        "mapping": {
            "documented_tracks": total,
            "direct": counts["DIRECT"],
            "partial": counts["PARTIAL"],
            "ambiguous": counts["AMBIGUOUS"],
            "unmapped": counts["UNMAPPED"],
            "direct_fraction": counts["DIRECT"] / total,
            "unambiguous_candidate_fraction": unambiguous_candidate / total,
        },
        "performance": {
            "admitted_fixture_count": None,
            "held_out_detection_recall": None,
            "benign_false_positive_rate": None,
            "fixture_level_mapping_count": 0,
        },
        "complexity": {
            "mapping_entry_count": total,
            "mapping_classification_kind_count": len(counts),
            "candidate_promotion_reference_count": candidate_refs,
        },
        "replay": {
            "adapter_deterministic": True,
            "full_upstream_payload_replayed": source["full_payload_replayed_in_v06"],
            "upstream_implementation_executed": source["upstream_implementation_executed"],
            "external_model_executed": source["external_model_executed"],
        },
        "verdict_provenance": {
            "required_fields": len(required_provenance),
            "present_fields": present,
            "completeness": present / len(required_provenance),
        },
        "advantages": {
            "detection_advantage": False,
            "integration_complexity_advantage": False,
            "verdict_provenance_advantage": False,
            "portability_advantage": False,
            "no_measured_operational_advantage": False,
        },
        "non_effects": {
            "statebench_score_produced": False,
            "upstream_performance_claimed": False,
            "real_world_superiority_established": False,
            "novelty_established": False,
            "world_first": False,
            "patentability_established": False,
            "merge_authorized": False,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = compute()
    if args.write:
        RESULTS.write_text(dump(result), encoding="utf-8")
        print("WROTE: results.json")
        return
    actual = load(RESULTS)
    if actual != result:
        raise SystemExit("generated v0.6 result drift; run runner.py --write and inspect the diff")
    print("PASS: checked-in v0.6 mapping results reproduce exactly")


if __name__ == "__main__":
    main()
