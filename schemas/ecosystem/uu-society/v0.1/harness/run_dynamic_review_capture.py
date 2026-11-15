#!/usr/bin/env python3
"""Deterministic dynamic institutional capture/recovery experiments for UU Society v0.9.

The simulator maintains two graphs:
- actual control graph: all active control dependencies;
- observed control graph: only disclosed active dependencies.

Formal reviewer identity is not treated as evidence of effective independence.
The model is an experimental structural diagnostic, not a legal verdict.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from run_scenarios import digest, format_errors, load_json, validator

ROOT = Path(__file__).resolve().parents[1]
CONFIG_SCHEMA_PATH = ROOT / "dynamic-review-capture.config.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "dynamic-review-capture.receipt.schema.json"
EXPERIMENT_DIR = ROOT / "dynamic_review_capture"

CONTROL_KINDS = {"appoints", "funds", "controls_evidence", "delegates"}


def ancestors(node: str, edges: list[dict[str, Any]]) -> set[str]:
    seen = {node}
    frontier = [node]
    while frontier:
        current = frontier.pop()
        for edge in edges:
            if edge["kind"] not in CONTROL_KINDS or edge["to"] != current:
                continue
            origin = edge["from"]
            if origin not in seen:
                seen.add(origin)
                frontier.append(origin)
    return seen


def graph_state(
    reviewers: set[str],
    beneficiary: str,
    quorum: int,
    edges: list[dict[str, Any]],
) -> dict[str, Any]:
    ordered = sorted(reviewers)
    origins = {r: ancestors(r, edges) for r in ordered}
    beneficiary_origins = ancestors(beneficiary, edges)
    conflicted = sorted(r for r in ordered if origins[r] & beneficiary_origins)

    eligible = [r for r in ordered if r not in conflicted]
    clusters: list[list[str]] = []
    remaining = set(eligible)
    while remaining:
        seed = min(remaining)
        cluster = {seed}
        pending = [seed]
        while pending:
            x = pending.pop()
            for y in sorted(remaining - cluster):
                if origins[x] & origins[y]:
                    cluster.add(y)
                    pending.append(y)
        clusters.append(sorted(cluster))
        remaining -= cluster

    effective_votes = len(clusters)
    return {
        "formal_votes": len(ordered),
        "effective_votes": effective_votes,
        "quorum": quorum,
        "independent": effective_votes >= quorum,
        "conflicted_reviewers": conflicted,
        "independent_clusters": clusters,
    }


def validate_semantics(config: dict[str, Any]) -> None:
    nodes = set(config["nodes"])
    if config["beneficiary"] not in nodes:
        raise ValueError("beneficiary is not in nodes")
    if not set(config["initial_reviewers"]) <= nodes:
        raise ValueError("unknown initial reviewer")
    if config["quorum"] > len(config["initial_reviewers"]):
        raise ValueError("quorum exceeds initial reviewer count")

    edge_ids: set[str] = set()
    for edge in config["initial_edges"]:
        if edge["edge_id"] in edge_ids:
            raise ValueError("duplicate initial edge_id")
        edge_ids.add(edge["edge_id"])
        if edge["from"] not in nodes or edge["to"] not in nodes:
            raise ValueError("unknown initial edge endpoint")

    for event in config["events"]:
        if event["cycle"] >= config["cycle_count"]:
            raise ValueError("event cycle outside horizon")
        et = event["type"]
        if et == "add_edge":
            edge = event.get("edge")
            if not edge:
                raise ValueError("add_edge requires edge")
            if edge["from"] not in nodes or edge["to"] not in nodes:
                raise ValueError("unknown event edge endpoint")
        elif et in ("remove_edge", "disclose_edge"):
            if not event.get("edge_id"):
                raise ValueError(f"{et} requires edge_id")
        elif et in ("add_reviewer", "remove_reviewer"):
            if event.get("reviewer") not in nodes:
                raise ValueError(f"{et} requires known reviewer")


def apply_event(
    event: dict[str, Any],
    reviewers: set[str],
    edges: dict[str, dict[str, Any]],
) -> None:
    et = event["type"]
    if et == "add_edge":
        edge = copy.deepcopy(event["edge"])
        if edge["edge_id"] in edges:
            raise ValueError(f"edge already active: {edge['edge_id']}")
        edges[edge["edge_id"]] = edge
    elif et == "remove_edge":
        if event["edge_id"] not in edges:
            raise ValueError(f"cannot remove inactive edge: {event['edge_id']}")
        del edges[event["edge_id"]]
    elif et == "disclose_edge":
        if event["edge_id"] not in edges:
            raise ValueError(f"cannot disclose inactive edge: {event['edge_id']}")
        edges[event["edge_id"]]["disclosed"] = True
    elif et == "add_reviewer":
        reviewers.add(event["reviewer"])
    elif et == "remove_reviewer":
        reviewers.discard(event["reviewer"])
    else:
        raise ValueError(f"unknown event type: {et}")


def simulate(config: dict[str, Any], enforce_expected: bool = True) -> tuple[dict[str, Any], list[str]]:
    validate_semantics(config)
    reviewers = set(config["initial_reviewers"])
    edges = {e["edge_id"]: copy.deepcopy(e) for e in config["initial_edges"]}
    events_by_cycle: dict[int, list[dict[str, Any]]] = {}
    for event in config["events"]:
        events_by_cycle.setdefault(event["cycle"], []).append(event)

    initial_actual = graph_state(
        reviewers, config["beneficiary"], config["quorum"], list(edges.values())
    )
    initial_observed = graph_state(
        reviewers,
        config["beneficiary"],
        config["quorum"],
        [e for e in edges.values() if e["disclosed"]],
    )

    previous_actual = initial_actual["independent"]
    previous_observed = initial_observed["independent"]
    ever_actual_capture = not previous_actual
    capture_entries = int(not previous_actual)
    recoveries = 0
    hidden_capture_cycles = 0
    formal_quorum_capture_cycles = 0
    false_recovery_cycles = 0
    first_capture_cycle = None
    first_observed_capture_cycle = None
    saw_disclosure_correction = False
    saw_partial_repair = False
    saw_backstop_recovery = False
    saw_rotation_during_capture = False
    trace = hashlib.sha256()
    summaries = []

    for cycle in range(config["cycle_count"]):
        cycle_events = events_by_cycle.get(cycle, [])
        before_actual = previous_actual
        before_observed = previous_observed
        had_remove = any(e["type"] == "remove_edge" for e in cycle_events)
        had_add_reviewer = any(e["type"] == "add_reviewer" for e in cycle_events)
        had_reviewer_change = any(
            e["type"] in ("add_reviewer", "remove_reviewer") for e in cycle_events
        )
        had_disclosure = any(e["type"] == "disclose_edge" for e in cycle_events)

        for event in cycle_events:
            apply_event(event, reviewers, edges)

        actual = graph_state(
            reviewers, config["beneficiary"], config["quorum"], list(edges.values())
        )
        observed = graph_state(
            reviewers,
            config["beneficiary"],
            config["quorum"],
            [e for e in edges.values() if e["disclosed"]],
        )

        if before_actual and not actual["independent"]:
            capture_entries += 1
            ever_actual_capture = True
            if first_capture_cycle is None:
                first_capture_cycle = cycle
        if not before_actual and actual["independent"]:
            recoveries += 1
            if had_add_reviewer:
                saw_backstop_recovery = True
        if had_remove and not before_actual and not actual["independent"]:
            saw_partial_repair = True
        if had_reviewer_change and not before_actual and not actual["independent"]:
            saw_rotation_during_capture = True

        if actual["independent"] is False and observed["independent"] is True:
            hidden_capture_cycles += 1
            false_recovery_cycles += int(before_observed is False)
        if observed["independent"] is False and first_observed_capture_cycle is None:
            first_observed_capture_cycle = cycle
        if had_disclosure and before_observed and not observed["independent"] and not actual["independent"]:
            saw_disclosure_correction = True
        if not actual["independent"] and actual["formal_votes"] >= config["quorum"]:
            formal_quorum_capture_cycles += 1

        summary = {
            "cycle": cycle,
            "events": [e["type"] for e in cycle_events],
            "active_edge_ids": sorted(edges),
            "disclosed_edge_ids": sorted(k for k, e in edges.items() if e["disclosed"]),
            "reviewers": sorted(reviewers),
            "actual": actual,
            "observed": observed,
        }
        summaries.append(summary)
        trace.update((json.dumps(summary, sort_keys=True, separators=(",", ":")) + "\n").encode())
        previous_actual = actual["independent"]
        previous_observed = observed["independent"]

    patterns = set()
    if all(s["actual"]["independent"] for s in summaries):
        patterns.add("STABLE_INDEPENDENCE")
    if capture_entries > int(not initial_actual["independent"]):
        patterns.add("CAPTURE_EMERGED")
    if initial_actual["independent"] is False:
        patterns.add("INITIAL_CAPTURE")
    if hidden_capture_cycles:
        patterns.add("HIDDEN_CAPTURE")
    if (
        first_capture_cycle is not None
        and first_observed_capture_cycle is not None
        and first_observed_capture_cycle > first_capture_cycle
    ):
        patterns.add("DELAYED_CAPTURE_DETECTION")
    if saw_disclosure_correction:
        patterns.add("DISCLOSURE_CORRECTS_OBSERVATION")
    if recoveries:
        patterns.add("RECOVERY_RESTORED")
    if capture_entries >= 2 and recoveries >= 1:
        patterns.add("CAPTURE_OSCILLATION")
    if formal_quorum_capture_cycles:
        patterns.add("FORMAL_QUORUM_PERSISTS_DURING_CAPTURE")
    if saw_partial_repair:
        patterns.add("PARTIAL_REPAIR_WITHOUT_RECOVERY")
    if saw_backstop_recovery:
        patterns.add("INDEPENDENT_BACKSTOP_RESTORES_QUORUM")
    if saw_rotation_during_capture:
        patterns.add("REVIEWER_ROTATION_WITHOUT_CONTROL_RECOVERY")
    if false_recovery_cycles:
        patterns.add("OBSERVED_RECOVERY_WITHOUT_ACTUAL_RECOVERY")

    result = "EXPECTED_DETECTION" if patterns else "PASS"
    expected = set(config["expected"]["expected_pattern_ids"])
    errors = []
    if enforce_expected:
        if result != config["expected"]["result"]:
            errors.append(f"result expected={config['expected']['result']} actual={result}")
        if patterns != expected:
            errors.append(f"patterns expected={sorted(expected)} actual={sorted(patterns)}")

    detection_lag = None
    if first_capture_cycle is not None and first_observed_capture_cycle is not None:
        detection_lag = first_observed_capture_cycle - first_capture_cycle

    receipt = {
        "receipt_version": "0.9",
        "experiment_id": config["experiment_id"],
        "experiment_version": "0.9",
        "result": result if not errors else "FAIL",
        "pattern_ids": sorted(patterns),
        "cycle_summaries": summaries,
        "metrics": {
            "initial_actual_independent": initial_actual["independent"],
            "initial_observed_independent": initial_observed["independent"],
            "final_actual_independent": previous_actual,
            "final_observed_independent": previous_observed,
            "capture_entry_count": capture_entries,
            "recovery_count": recoveries,
            "hidden_capture_cycles": hidden_capture_cycles,
            "formal_quorum_capture_cycles": formal_quorum_capture_cycles,
            "false_recovery_cycles": false_recovery_cycles,
            "first_capture_cycle": first_capture_cycle,
            "first_observed_capture_cycle": first_observed_capture_cycle,
            "capture_detection_lag": detection_lag,
        },
        "trace_digest": trace.hexdigest(),
        "config_digest": digest(config),
    }
    return receipt, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--experiment", action="append")
    args = parser.parse_args()

    config_schema = load_json(CONFIG_SCHEMA_PATH)
    receipt_schema = load_json(RECEIPT_SCHEMA_PATH)
    paths = sorted(EXPERIMENT_DIR.glob("D*/config.json"))
    if args.experiment:
        wanted = set(args.experiment)
        paths = [p for p in paths if load_json(p)["experiment_id"] in wanted]
    if not paths:
        print("no dynamic review capture experiments found", file=sys.stderr)
        return 2

    failures = 0
    conforms = 0
    for path in paths:
        config = load_json(path)
        config_errors = format_errors(validator(config_schema).iter_errors(config))
        if config_errors:
            print(f"{path.parent.name}: FAIL config schema")
            for error in config_errors:
                print("  -", error)
            failures += 1
            continue
        try:
            receipt, errors = simulate(config)
        except Exception as exc:
            print(f"{config['experiment_id']}: FAIL {exc}")
            failures += 1
            continue

        receipt_errors = format_errors(validator(receipt_schema).iter_errors(receipt))
        errors.extend(f"receipt schema: {e}" for e in receipt_errors)
        print(f"{config['experiment_id']}: {'FAIL' if errors else receipt['result']}")
        print("  patterns:", ",".join(receipt["pattern_ids"]) or "<none>")
        print("  metrics:", json.dumps(receipt["metrics"], sort_keys=True))
        print("  trace_digest:", receipt["trace_digest"])
        for error in errors:
            print("  -", error)
        if errors:
            failures += 1
        else:
            conforms += 1

    print(f"\nUU Society dynamic review capture v0.9: {conforms}/{len(paths)} experiments conform")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
