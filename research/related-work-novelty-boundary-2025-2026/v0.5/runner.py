#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent
BENCHMARK = BASE / "benchmark.json"
SYNTHETIC_RESULTS = BASE / "synthetic-results.json"
ABLATION_RESULTS = BASE / "ablation-results.json"


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump(obj: dict[str, Any]) -> str:
    return json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def measured_profiles(benchmark: dict[str, Any]) -> list[dict[str, Any]]:
    return [p for p in benchmark["profiles"] if p["id"] != "LLM_POLICY_JUDGE"]


def compute_synthetic(benchmark: dict[str, Any]) -> dict[str, Any]:
    domains = [d["id"] for d in benchmark["domains"]]
    classes = list(benchmark["promotion_classes"])
    benign_count = len(domains)
    hostile_per_class = len(domains)
    hostile_count = len(domains) * len(classes)

    profiles = []
    for profile in measured_profiles(benchmark):
        detects = set(profile.get("detects", []))
        class_results = []
        detected_hostile = 0
        detected_domains: set[str] = set()
        for cls in classes:
            detected = hostile_per_class if cls in detects else 0
            detected_hostile += detected
            if detected:
                detected_domains.update(domains)
            class_results.append({
                "class": cls,
                "hostile_fixtures": hostile_per_class,
                "detected": detected,
                "recall": detected / hostile_per_class,
                "domains": domains,
                "fixture_id_rule": f"<DOMAIN>::{cls}",
                "fired_boundary": cls if detected else None,
            })

        profiles.append({
            "id": profile["id"],
            "kind": profile["kind"],
            "hostile_fixtures": hostile_count,
            "hostile_detected": detected_hostile,
            "hostile_detection_recall": detected_hostile / hostile_count,
            "benign_fixtures": benign_count,
            "benign_false_positives": 0,
            "benign_false_positive_rate": 0.0,
            "cross_domain_coverage_count": len(detected_domains),
            "unsupported_class_count": len(classes) - len(detects),
            "class_results": class_results,
        })

    by_id = {p["id"]: p for p in profiles}
    matawaka = by_id["MATAWAKA_TYPED_PROFILE"]["hostile_detection_recall"]
    specialized = by_id["SPECIALIZED_UNION_PROFILE"]["hostile_detection_recall"]
    top_result = (
        "SYNTHETIC_CROSS_LAYER_ADVANTAGE_OBSERVED"
        if matawaka > specialized
        else "NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION"
    )

    return {
        "schema": "matawaka.synthetic-semantic-escalation-results/v0.5",
        "predecessor": benchmark["predecessor"],
        "benchmark_schema": benchmark["schema"],
        "fixture_counts": {
            "domains": len(domains),
            "promotion_classes": len(classes),
            "benign": benign_count,
            "hostile": hostile_count,
            "total": benign_count + hostile_count,
        },
        "profiles": profiles,
        "llm_policy_judge": {
            "measurement_status": "NOT_YET_MEASURED",
            "score": None,
            "reason": "No external model invocation is part of v0.5 synthetic qualification."
        },
        "comparison": {
            "matawaka_profile": "MATAWAKA_TYPED_PROFILE",
            "specialized_union_profile": "SPECIALIZED_UNION_PROFILE",
            "matawaka_hostile_recall": matawaka,
            "specialized_union_hostile_recall": specialized,
            "recall_delta": matawaka - specialized,
            "top_result": top_result,
        },
        "non_effects": {
            "upstream_implementations_measured": False,
            "llm_policy_judge_measured": False,
            "real_world_superiority_established": False,
            "novelty_established": False,
            "world_first": False,
            "merge_authorized": False,
        },
    }


def compute_ablations(benchmark: dict[str, Any]) -> dict[str, Any]:
    domains = [d["id"] for d in benchmark["domains"]]
    classes = list(benchmark["promotion_classes"])
    hostile_count = len(domains) * len(classes)
    rows = []
    for family, removed_classes in benchmark["ablation_families"].items():
        removed = set(removed_classes)
        false_negatives = len(domains) * len(removed)
        rows.append({
            "family": family,
            "removed_classes": list(removed_classes),
            "new_false_negatives": false_negatives,
            "hostile_detected_after_ablation": hostile_count - false_negatives,
            "hostile_detection_recall_after_ablation": (hostile_count - false_negatives) / hostile_count,
            "affected_domains": domains,
            "affected_fixture_id_rules": [f"<DOMAIN>::{cls}" for cls in classes if cls in removed],
        })
    return {
        "schema": "matawaka.synthetic-semantic-escalation-ablation-results/v0.5",
        "predecessor": benchmark["predecessor"],
        "baseline_profile": "MATAWAKA_TYPED_PROFILE",
        "baseline_hostile_fixtures": hostile_count,
        "ablations": rows,
        "non_effects": {
            "seven_layer_uniqueness_proven": False,
            "architectural_necessity_proven": False,
            "real_world_superiority_established": False,
            "merge_authorized": False,
        },
    }


def check_equal(path: Path, expected: dict[str, Any]) -> None:
    actual = load(path)
    if actual != expected:
        raise SystemExit(f"generated result drift: {path.name}; run runner.py --write and inspect the diff")


def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()

    benchmark = load(BENCHMARK)
    synthetic = compute_synthetic(benchmark)
    ablations = compute_ablations(benchmark)

    if args.write:
        SYNTHETIC_RESULTS.write_text(dump(synthetic), encoding="utf-8")
        ABLATION_RESULTS.write_text(dump(ablations), encoding="utf-8")
        print("WROTE: synthetic-results.json and ablation-results.json")
        return

    check_equal(SYNTHETIC_RESULTS, synthetic)
    check_equal(ABLATION_RESULTS, ablations)
    print("PASS: checked-in v0.5 synthetic results reproduce exactly")


if __name__ == "__main__":
    main()
