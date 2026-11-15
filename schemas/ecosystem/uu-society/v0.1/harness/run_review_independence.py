#!/usr/bin/env python3
"""UU Society v0.8: deterministic institutional review dependency experiments.

A reviewer is effective only if its *reachable control origins* are
independent of the beneficiary and of other members of the review quorum.
Formal institution IDs do not establish independent control.

This is an experimental structural proxy, not a legal independence verdict.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "review_independence"
CONTROL_KINDS = {"appoints", "funds", "controls_evidence", "delegates"}
REVIEW_KINDS = {"reviews"}
ALLOWED = CONTROL_KINDS | REVIEW_KINDS


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate(case):
    nodes = case["nodes"]
    assert len(nodes) == len(set(nodes)), "duplicate nodes"
    assert set(case["reviewers"]) <= set(nodes), "unknown reviewer"
    assert case["beneficiary"] in nodes, "unknown beneficiary"
    assert 1 <= case["quorum"] <= len(case["reviewers"]), "invalid quorum"
    assert len(case["reviewers"]) == len(set(case["reviewers"])), "duplicate reviewers"
    for edge in case["edges"]:
        assert edge["from"] in nodes and edge["to"] in nodes, "unknown edge endpoint"
        assert edge["kind"] in ALLOWED, "unknown edge kind"
    for key in ("expect_independent", "expect_formal_quorum"):
        assert isinstance(case[key], bool)


def ancestors(node, edges):
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


def analyze(case):
    validate(case)
    reviewers = case["reviewers"]
    beneficiary = case["beneficiary"]
    edges = case["edges"]
    origins = {r: ancestors(r, edges) for r in reviewers}
    beneficiary_origins = ancestors(beneficiary, edges)
    conflicted = sorted(r for r in reviewers if origins[r] & beneficiary_origins)
    eligible = [r for r in reviewers if r not in conflicted]
    # Conflict is structural; a common origin creates correlated control
    # even when no direct reviewer->reviewer relationship exists.
    clusters = []
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

    # Connected components are a conservative independence lower bound:
    # multiple reviewers in one cluster count as a single effective voice.
    effective_votes = len(clusters)
    formal_votes = len(reviewers)
    patterns = []
    if formal_votes >= case["quorum"] and effective_votes < case["quorum"]:
        patterns.append("FORMAL_QUORUM_WITHOUT_INDEPENDENT_QUORUM")
    if conflicted:
        patterns.append("BENEFICIARY_CONTROL_PATH")
    if any(len(cluster) > 1 for cluster in clusters):
        patterns.append("CORRELATED_REVIEWERS")
    if effective_votes >= case["quorum"]:
        patterns.append("INDEPENDENT_REVIEW_QUORUM")
    result = {
        "case_id": case["case_id"],
        "formal_votes": formal_votes,
        "effective_votes": effective_votes,
        "quorum": case["quorum"],
        "independent": effective_votes >= case["quorum"],
        "conflicted_reviewers": conflicted,
        "independent_clusters": clusters,
        "patterns": patterns,
        "graph_digest": digest({"nodes": case["nodes"], "edges": edges}),
        "config_digest": digest(case),
    }
    result["trace_digest"] = digest(result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", action="append")
    args = parser.parse_args()
    paths = sorted(CASES.glob("R*/config.json"))
    if args.case:
        paths = [p for p in paths if p.parent.name in args.case]
    if not paths:
        raise SystemExit("No review-independence cases selected")
    failures = 0
    for path in paths:
        case = json.loads(path.read_text())
        result = analyze(case)
        expected = case["expect_independent"]
        expected_formal = case["expect_formal_quorum"]
        passed = (
            result["independent"] == expected
            and (result["formal_votes"] >= result["quorum"]) == expected_formal
        )
        failures += not passed
        print(json.dumps({"status": "PASS" if passed else "FAIL", **result}, sort_keys=True))
    print(f"UU Society review independence v0.8: {len(paths)-failures}/{len(paths)} conform")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
