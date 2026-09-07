#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import validate_operational as vo

BASE = Path(__file__).resolve().parent
PROTOCOL = json.loads((BASE / "protocol.json").read_text(encoding="utf-8"))
LEDGER = json.loads((BASE / "upstream-ledger.json").read_text(encoding="utf-8"))
MAPPING = json.loads((BASE / "track-mapping.json").read_text(encoding="utf-8"))
BENIGN = json.loads((BASE / "ambiguous-benign.json").read_text(encoding="utf-8"))
RESULTS = json.loads((BASE / "results.json").read_text(encoding="utf-8"))


def row(mapping, track):
    return next(x for x in mapping["mappings"] if x["track"] == track)


def expect_fail(label, mutate):
    p = copy.deepcopy(PROTOCOL)
    l = copy.deepcopy(LEDGER)
    m = copy.deepcopy(MAPPING)
    b = copy.deepcopy(BENIGN)
    r = copy.deepcopy(RESULTS)
    mutate(p, l, m, b, r)
    try:
        vo.validate_data(p, l, m, b, r, check_tree=False)
    except ValueError:
        return
    raise AssertionError(f"hostile mutation unexpectedly passed: {label}")


def main():
    vo.validate_data(copy.deepcopy(PROTOCOL), copy.deepcopy(LEDGER), copy.deepcopy(MAPPING), copy.deepcopy(BENIGN), copy.deepcopy(RESULTS), check_tree=False)
    tests = [
        ("rewrite predecessor", lambda p,l,m,b,r: p.__setitem__("predecessor", "0"*40)),
        ("rewrite v05 tree", lambda p,l,m,b,r: p.__setitem__("predecessor_v05_tree", "f"*40)),
        ("rewrite negative v05 result", lambda p,l,m,b,r: p.__setitem__("frozen_v05_result", "SYNTHETIC_CROSS_LAYER_ADVANTAGE_OBSERVED")),
        ("pretend payload replayed", lambda p,l,m,b,r: p["selection_recipe"].__setitem__("payload_replayed", True)),
        ("pretend fixture performance scored", lambda p,l,m,b,r: p["selection_recipe"].__setitem__("fixture_performance_scored", True)),
        ("protocol novelty inflation", lambda p,l,m,b,r: p["non_effects"].__setitem__("novelty_established", True)),
        ("upstream repository drift", lambda p,l,m,b,r: l["sources"][0].__setitem__("repository", "example/fake")),
        ("upstream commit drift", lambda p,l,m,b,r: l["sources"][0].__setitem__("commit", "0"*40)),
        ("upstream blob drift", lambda p,l,m,b,r: l["sources"][0].__setitem__("git_blob_sha", "0"*40)),
        ("promote evidence level", lambda p,l,m,b,r: l["sources"][0].__setitem__("evidence_level", "UPSTREAM_IMPLEMENTATION_EXECUTED")),
        ("pretend upstream implementation ran", lambda p,l,m,b,r: l["sources"][0].__setitem__("upstream_implementation_executed", True)),
        ("pretend external model ran", lambda p,l,m,b,r: l["sources"][0].__setitem__("external_model_executed", True)),
        ("pretend full payload replayed", lambda p,l,m,b,r: l["sources"][0].__setitem__("full_payload_replayed_in_v06", True)),
        ("weaken forbidden claims", lambda p,l,m,b,r: l["sources"][0].__setitem__("forbidden_claims", l["sources"][0]["forbidden_claims"][:3])),
        ("inflate mapping basis", lambda p,l,m,b,r: m.__setitem__("mapping_basis", "FULL_UPSTREAM_EXECUTION")),
        ("pretend full track replay", lambda p,l,m,b,r: m.__setitem__("actual_test_track_set_fully_replayed", True)),
        ("drop held-out track", lambda p,l,m,b,r: m["mappings"].pop()),
        ("duplicate held-out track", lambda p,l,m,b,r: m["mappings"][1].__setitem__("track", m["mappings"][0]["track"])),
        ("inflate partial to direct", lambda p,l,m,b,r: row(m,"scope_permission").__setitem__("classification", "DIRECT")),
        ("silently map unmapped supersession", lambda p,l,m,b,r: row(m,"supersession")["candidate_promotions"].append("STALE_MEMORY_TO_CURRENT_AUTHORITY")),
        ("direct maps to two meanings", lambda p,l,m,b,r: row(m,"authority_hierarchy")["candidate_promotions"].append("IDENTITY_TO_AUTHORITY")),
        ("erase mapping rationale", lambda p,l,m,b,r: row(m,"causality").__setitem__("reason", "weak")),
        ("rewrite mapping counts", lambda p,l,m,b,r: m["counts"].__setitem__("direct", 13)),
        ("claim fixture mapping established", lambda p,l,m,b,r: m["non_effects"].__setitem__("fixture_level_mapping_established", True)),
        ("claim portability advantage in mapping", lambda p,l,m,b,r: m["non_effects"].__setitem__("portability_advantage_established", True)),
        ("pretend benign cases executed", lambda p,l,m,b,r: b.__setitem__("measurement_status", "EXECUTED")),
        ("pretend benign FPR measured", lambda p,l,m,b,r: b["non_effects"].__setitem__("benign_false_positive_rate_measured", True)),
        ("promote top result to detection advantage", lambda p,l,m,b,r: r.__setitem__("top_result", "DETECTION_ADVANTAGE")),
        ("fabricate held-out recall", lambda p,l,m,b,r: r["performance"].__setitem__("held_out_detection_recall", 1.0)),
        ("fabricate admitted fixture count", lambda p,l,m,b,r: r["performance"].__setitem__("admitted_fixture_count", 52)),
        ("fabricate fixture-level mapping", lambda p,l,m,b,r: r["performance"].__setitem__("fixture_level_mapping_count", 52)),
        ("claim negative operational conclusion", lambda p,l,m,b,r: r["advantages"].__setitem__("no_measured_operational_advantage", True)),
        ("claim detection advantage", lambda p,l,m,b,r: r["advantages"].__setitem__("detection_advantage", True)),
        ("claim upstream performance", lambda p,l,m,b,r: r["non_effects"].__setitem__("upstream_performance_claimed", True)),
        ("claim world first", lambda p,l,m,b,r: r["non_effects"].__setitem__("world_first", True)),
        ("leak merge authority", lambda p,l,m,b,r: r["non_effects"].__setitem__("merge_authorized", True)),
    ]
    for label, mutate in tests:
        expect_fail(label, mutate)
    print(f"PASS: {1 + len(tests)}/{1 + len(tests)} baseline+hostile v0.6 operational checks")


if __name__ == "__main__":
    main()
