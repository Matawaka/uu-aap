#!/usr/bin/env python3
"""Deterministic Institutional Epistemics / Proof of Institutional Independence v1.0.

The experiment contains oracle-only synthetic ground truth, but the epistemic
assessment never reads it. Assessment uses only scoped, time-bounded evidence
and the structural independence of evidence sources.

This is a bounded evidence model, not a legal verdict or proof of absence of
all undiscovered dependencies.
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
CONFIG_SCHEMA_PATH = ROOT / "institutional-epistemics.config.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "institutional-epistemics.receipt.schema.json"
EXPERIMENT_DIR = ROOT / "institutional_epistemics"

CONTROL_KINDS = {"appoints", "funds", "controls_evidence", "delegates"}
NO_DEP = "NO_RELEVANT_DEPENDENCY"
DEP = "DEPENDENCY_PRESENT"


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


def connected_source_clusters(
    sources: set[str],
    source_edges: list[dict[str, Any]],
) -> list[list[str]]:
    if not sources:
        return []
    origins = {source: ancestors(source, source_edges) for source in sources}
    remaining = set(sources)
    clusters = []
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
    return clusters


def actual_independence(
    reviewers: list[str],
    beneficiary: str,
    quorum: int,
    edges: list[dict[str, Any]],
) -> bool:
    origins = {r: ancestors(r, edges) for r in reviewers}
    beneficiary_origins = ancestors(beneficiary, edges)
    eligible = [r for r in reviewers if not (origins[r] & beneficiary_origins)]
    remaining = set(eligible)
    clusters = []
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
    return len(clusters) >= quorum


def active_evidence(
    cycle: int,
    evidence: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    return sorted(
        [
            item
            for item in evidence.values()
            if item["issued_cycle"] <= cycle
            and cycle < item["issued_cycle"] + item["ttl_cycles"]
        ],
        key=lambda item: item["evidence_id"],
    )


def assess(
    config: dict[str, Any],
    cycle: int,
    evidence: dict[str, dict[str, Any]],
    source_edges: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Epistemic assessment. Deliberately has no access to ground truth."""
    active = active_evidence(cycle, evidence)
    edge_values = list(source_edges.values())
    quorum = config["source_quorum"]
    slots = []
    contradiction = False
    capture_signal = False
    all_verified = True
    any_evidence = False
    raw_quorum_but_correlated = False

    for reviewer in config["reviewers"]:
        for dimension in config["control_dimensions"]:
            slot_evidence = [
                e for e in active
                if e["reviewer"] == reviewer and e["dimension"] == dimension
            ]
            any_evidence |= bool(slot_evidence)
            neg_sources = {e["source"] for e in slot_evidence if e["assertion"] == NO_DEP}
            pos_sources = {e["source"] for e in slot_evidence if e["assertion"] == DEP}
            neg_clusters = connected_source_clusters(neg_sources, edge_values)
            pos_clusters = connected_source_clusters(pos_sources, edge_values)
            neg_n = len(neg_clusters)
            pos_n = len(pos_clusters)

            if len(neg_sources) >= quorum and neg_n < quorum:
                raw_quorum_but_correlated = True
            if len(pos_sources) >= quorum and pos_n < quorum:
                raw_quorum_but_correlated = True

            neg_ok = neg_n >= quorum
            pos_ok = pos_n >= quorum
            if neg_ok and pos_ok:
                slot_status = "CONTRADICTED"
                contradiction = True
                all_verified = False
            elif pos_ok:
                slot_status = "DEPENDENCY_SUPPORTED"
                capture_signal = True
                all_verified = False
            elif neg_ok:
                slot_status = "NO_DEPENDENCY_SUPPORTED"
            else:
                slot_status = "INSUFFICIENT"
                all_verified = False

            slots.append({
                "reviewer": reviewer,
                "dimension": dimension,
                "status": slot_status,
                "negative_raw_sources": len(neg_sources),
                "negative_independent_clusters": neg_n,
                "positive_raw_sources": len(pos_sources),
                "positive_independent_clusters": pos_n,
            })

    if contradiction:
        status = "INDETERMINATE_CONTRADICTION"
    elif capture_signal:
        status = "CAPTURE_SIGNAL"
    elif all_verified and slots:
        status = "PROVISIONAL_INDEPENDENCE"
    else:
        status = "INDETERMINATE"

    covered = sum(1 for slot in slots if slot["status"] != "INSUFFICIENT")
    verified = sum(1 for slot in slots if slot["status"] == "NO_DEPENDENCY_SUPPORTED")
    return {
        "status": status,
        "active_evidence_count": len(active),
        "slot_count": len(slots),
        "covered_slot_fraction": covered / max(1, len(slots)),
        "verified_slot_fraction": verified / max(1, len(slots)),
        "any_evidence": any_evidence,
        "raw_quorum_but_correlated": raw_quorum_but_correlated,
        "slots": slots,
    }


def validate_semantics(config: dict[str, Any]) -> None:
    nodes = set(config["nodes"])
    sources = set(config["source_nodes"])
    reviewers = set(config["reviewers"])
    if config["beneficiary"] not in nodes:
        raise ValueError("beneficiary not in nodes")
    if not reviewers <= nodes:
        raise ValueError("unknown reviewer")
    if config["source_quorum"] > len(sources):
        raise ValueError("source quorum exceeds source count")
    for edge in config["initial_ground_truth_edges"]:
        if edge["from"] not in nodes or edge["to"] not in nodes:
            raise ValueError("unknown ground-truth endpoint")
    all_source_nodes = nodes | sources
    for edge in config["initial_source_control_edges"]:
        if edge["from"] not in all_source_nodes or edge["to"] not in all_source_nodes:
            raise ValueError("unknown source-control endpoint")
    for item in config["initial_evidence"]:
        if item["source"] not in sources:
            raise ValueError("unknown evidence source")
        if item["reviewer"] not in reviewers:
            raise ValueError("unknown evidence reviewer")
        if item["dimension"] not in config["control_dimensions"]:
            raise ValueError("evidence dimension outside scope")
    for event in config["events"]:
        if event["cycle"] >= config["cycle_count"]:
            raise ValueError("event outside horizon")


def apply_event(
    event: dict[str, Any],
    truth_edges: dict[str, dict[str, Any]],
    source_edges: dict[str, dict[str, Any]],
    evidence: dict[str, dict[str, Any]],
) -> None:
    et = event["type"]
    if et == "add_evidence":
        item = copy.deepcopy(event["evidence"])
        if item["evidence_id"] in evidence:
            raise ValueError(f"duplicate evidence_id {item['evidence_id']}")
        evidence[item["evidence_id"]] = item
    elif et == "add_source_edge":
        edge = copy.deepcopy(event["source_edge"])
        if edge["edge_id"] in source_edges:
            raise ValueError(f"duplicate source edge {edge['edge_id']}")
        source_edges[edge["edge_id"]] = edge
    elif et == "remove_source_edge":
        if event["edge_id"] not in source_edges:
            raise ValueError(f"missing source edge {event['edge_id']}")
        del source_edges[event["edge_id"]]
    elif et == "add_truth_edge":
        edge = copy.deepcopy(event["truth_edge"])
        if edge["edge_id"] in truth_edges:
            raise ValueError(f"duplicate truth edge {edge['edge_id']}")
        truth_edges[edge["edge_id"]] = edge
    elif et == "remove_truth_edge":
        if event["edge_id"] not in truth_edges:
            raise ValueError(f"missing truth edge {event['edge_id']}")
        del truth_edges[event["edge_id"]]
    else:
        raise ValueError(f"unknown event type {et}")


def simulate(config: dict[str, Any], enforce_expected: bool = True):
    validate_semantics(config)
    truth_edges = {e["edge_id"]: copy.deepcopy(e) for e in config["initial_ground_truth_edges"]}
    source_edges = {e["edge_id"]: copy.deepcopy(e) for e in config["initial_source_control_edges"]}
    evidence = {e["evidence_id"]: copy.deepcopy(e) for e in config["initial_evidence"]}
    events_by_cycle: dict[int, list[dict[str, Any]]] = {}
    for event in config["events"]:
        events_by_cycle.setdefault(event["cycle"], []).append(event)

    patterns = set()
    summaries = []
    trace = hashlib.sha256()
    previous_status = None
    previous_actual = None
    ever_false_assurance = False
    ever_capture_confirmed = False
    verification_cycles = 0
    indeterminate_cycles = 0
    false_assurance_cycles = 0
    capture_signal_cycles = 0

    for cycle in range(config["cycle_count"]):
        cycle_events = events_by_cycle.get(cycle, [])
        had_add_evidence = any(e["type"] == "add_evidence" for e in cycle_events)
        had_source_change = any(e["type"] in ("add_source_edge", "remove_source_edge") for e in cycle_events)
        had_truth_change = any(e["type"] in ("add_truth_edge", "remove_truth_edge") for e in cycle_events)

        for event in cycle_events:
            apply_event(event, truth_edges, source_edges, evidence)

        epistemic = assess(config, cycle, evidence, source_edges)
        actual = actual_independence(
            config["reviewers"],
            config["beneficiary"],
            min(len(config["reviewers"]), config["source_quorum"]),
            list(truth_edges.values()),
        )

        status = epistemic["status"]
        if status == "PROVISIONAL_INDEPENDENCE":
            verification_cycles += 1
            if actual:
                patterns.add("BOUNDED_INDEPENDENCE_VERIFIED")
            else:
                patterns.add("FALSE_ASSURANCE")
                false_assurance_cycles += 1
                ever_false_assurance = True
        elif status == "CAPTURE_SIGNAL":
            capture_signal_cycles += 1
            if actual:
                patterns.add("CAPTURE_EVIDENCE_CONFIRMED")
                ever_capture_confirmed = True
            else:
                patterns.add("CAPTURE_SIGNAL_FALSE_POSITIVE")
        else:
            indeterminate_cycles += 1

        if status == "INDETERMINATE" and epistemic["covered_slot_fraction"] < 1.0:
            patterns.add("INDETERMINATE_DUE_TO_COVERAGE_GAP")
            # No supported dependency is not enough to verify independence.
            dep_supported = any(
                slot["status"] == "DEPENDENCY_SUPPORTED"
                for slot in epistemic["slots"]
            )
            if not dep_supported:
                patterns.add("ABSENCE_OF_CAPTURE_NOT_PROOF")

        if status == "INDETERMINATE_CONTRADICTION":
            patterns.add("CONTRADICTION_WITHHOLDS_VERDICT")
        if epistemic["raw_quorum_but_correlated"]:
            patterns.add("SOURCE_COUNT_NOT_INDEPENDENCE")

        if previous_status == "PROVISIONAL_INDEPENDENCE" and status == "INDETERMINATE":
            active = active_evidence(cycle, evidence)
            if not had_source_change and not had_add_evidence:
                patterns.add("EVIDENCE_EXPIRY_REVOKES_VERIFICATION")
            if had_source_change:
                patterns.add("SOURCE_CORRELATION_REVOKES_VERIFICATION")

        if (
            previous_status in ("INDETERMINATE", "INDETERMINATE_CONTRADICTION")
            and status == "PROVISIONAL_INDEPENDENCE"
            and had_add_evidence
        ):
            patterns.add("INDEPENDENT_CORROBORATION_RESTORES_VERIFICATION")

        if (
            previous_actual is True
            and actual is False
            and previous_status == "PROVISIONAL_INDEPENDENCE"
            and status == "PROVISIONAL_INDEPENDENCE"
            and had_truth_change
        ):
            patterns.add("ACTUAL_CHANGE_OUTRUNS_EVIDENCE")

        if ever_false_assurance and status == "CAPTURE_SIGNAL" and actual:
            patterns.add("EPISTEMIC_LAG_RESOLVED")

        summary = {
            "cycle": cycle,
            "event_types": [e["type"] for e in cycle_events],
            "actual_independent_oracle_only": actual,
            "epistemic_status": status,
            "active_evidence_count": epistemic["active_evidence_count"],
            "covered_slot_fraction": epistemic["covered_slot_fraction"],
            "verified_slot_fraction": epistemic["verified_slot_fraction"],
            "raw_quorum_but_correlated": epistemic["raw_quorum_but_correlated"],
        }
        summaries.append(summary)
        trace.update((json.dumps(summary, sort_keys=True, separators=(",", ":")) + "\n").encode())
        previous_status = status
        previous_actual = actual

    result = "EXPECTED_DETECTION" if patterns else "PASS"
    expected = set(config["expected"]["expected_pattern_ids"])
    errors = []
    if enforce_expected:
        if result != config["expected"]["result"]:
            errors.append(f"result expected={config['expected']['result']} actual={result}")
        if patterns != expected:
            errors.append(f"patterns expected={sorted(expected)} actual={sorted(patterns)}")

    receipt = {
        "receipt_version":"1.0",
        "experiment_id":config["experiment_id"],
        "experiment_version":"1.0",
        "result":result if not errors else "FAIL",
        "pattern_ids":sorted(patterns),
        "cycle_summaries":summaries,
        "metrics":{
            "verification_cycles":verification_cycles,
            "indeterminate_cycles":indeterminate_cycles,
            "false_assurance_cycles":false_assurance_cycles,
            "capture_signal_cycles":capture_signal_cycles,
            "final_epistemic_status":previous_status,
            "final_actual_independent_oracle_only":previous_actual,
        },
        "trace_digest":trace.hexdigest(),
        "config_digest":digest(config),
    }
    return receipt, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--experiment", action="append")
    args = parser.parse_args()
    config_schema = load_json(CONFIG_SCHEMA_PATH)
    receipt_schema = load_json(RECEIPT_SCHEMA_PATH)
    paths = sorted(EXPERIMENT_DIR.glob("K*/config.json"))
    if args.experiment:
        wanted = set(args.experiment)
        paths = [p for p in paths if load_json(p)["experiment_id"] in wanted]
    if not paths:
        print("no institutional epistemics experiments found", file=sys.stderr)
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
        errors.extend(
            f"receipt schema: {e}"
            for e in format_errors(validator(receipt_schema).iter_errors(receipt))
        )
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

    print(f"\nUU Society institutional epistemics v1.0: {conforms}/{len(paths)} experiments conform")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
