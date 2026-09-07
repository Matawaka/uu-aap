#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import validate_benchmark as vb

BASE = Path(__file__).resolve().parent
BENCHMARK = json.loads((BASE / "benchmark.json").read_text(encoding="utf-8"))


def prof(b, pid):
    return next(x for x in b["profiles"] if x["id"] == pid)


def expect_fail(label, mutate):
    b = copy.deepcopy(BENCHMARK)
    mutate(b)
    try:
        vb.validate_data(b)
    except ValueError:
        return
    raise AssertionError(f"hostile mutation unexpectedly passed: {label}")


def main():
    vb.validate_data(copy.deepcopy(BENCHMARK))
    tests = [
        ("predecessor rewrite", lambda b: b.__setitem__("predecessor", "0" * 40)),
        ("unknown benchmark field", lambda b: b.__setitem__("confidence", 0.99)),
        ("drop domain", lambda b: b["domains"].pop()),
        ("duplicate domain id", lambda b: b["domains"][1].__setitem__("id", b["domains"][0]["id"])),
        ("weak domain description", lambda b: b["domains"][0].__setitem__("description", "short")),
        ("drop promotion class", lambda b: b["promotion_classes"].pop()),
        ("reorder promotion classes", lambda b: b["promotion_classes"].reverse()),
        ("base claim unsupported in benign", lambda b: b["base_state"]["claims"].__setitem__(vb.CLASSES[0], False)),
        ("base support missing", lambda b: b["base_state"]["support"].pop(vb.CLASSES[0])),
        ("drop mutation", lambda b: b["mutations"].pop()),
        ("duplicate mutation class", lambda b: b["mutations"][1].__setitem__("class", b["mutations"][0]["class"])),
        ("weak mutation description", lambda b: b["mutations"][0].__setitem__("description", "short")),
        ("drop profile", lambda b: b["profiles"].pop(0)),
        ("duplicate profile id", lambda b: b["profiles"][1].__setitem__("id", b["profiles"][0]["id"])),
        ("unknown profile field", lambda b: prof(b, "MATAWAKA_TYPED_PROFILE").__setitem__("score", 1.0)),
        ("weaken Matawaka coverage", lambda b: prof(b, "MATAWAKA_TYPED_PROFILE")["detects"].pop()),
        ("inflate WEXP-like coverage", lambda b: prof(b, "WEXP_LIKE_EXECUTION_PROFILE")["detects"].append("AVAILABILITY_TO_INTENT")),
        ("inflate StateBench-like coverage", lambda b: prof(b, "STATEBENCH_LIKE_STATE_PROFILE")["detects"].append("INVOCATION_TO_COMPLETED_EFFECT")),
        ("weaken specialized union to manufacture Matawaka advantage", lambda b: prof(b, "SPECIALIZED_UNION_PROFILE")["detects"].pop()),
        ("naive schema gets semantic detector", lambda b: prof(b, "NAIVE_SCHEMA_PROFILE")["detects"].append("IDENTITY_TO_AUTHORITY")),
        ("mislabel WEXP-like as upstream", lambda b: prof(b, "WEXP_LIKE_EXECUTION_PROFILE").__setitem__("kind", "UPSTREAM_WEXP")),
        ("mislabel StateBench-like as upstream", lambda b: prof(b, "STATEBENCH_LIKE_STATE_PROFILE").__setitem__("kind", "UPSTREAM_STATEBENCH")),
        ("LLM judge silently measured", lambda b: prof(b, "LLM_POLICY_JUDGE").__setitem__("measurement_status", "MEASURED")),
        ("drop ablation family", lambda b: b["ablation_families"].pop("REVIEW_PERMISSION")),
        ("alter ablation partition", lambda b: b["ablation_families"]["REVIEW_PERMISSION"].append("IDENTITY_TO_AUTHORITY")),
        ("acceptance vocabulary inflated", lambda b: b["acceptance_results"].__setitem__(0, "REAL_WORLD_SUPERIORITY_ESTABLISHED")),
        ("upstream WEXP falsely measured", lambda b: b["non_effects"].__setitem__("upstream_wexp_measured", True)),
        ("upstream StateBench falsely measured", lambda b: b["non_effects"].__setitem__("upstream_statebench_measured", True)),
        ("LLM judge falsely measured flag", lambda b: b["non_effects"].__setitem__("llm_policy_judge_measured", True)),
        ("real-world superiority promotion", lambda b: b["non_effects"].__setitem__("real_world_superiority_established", True)),
        ("novelty promotion", lambda b: b["non_effects"].__setitem__("novelty_established", True)),
        ("world-first promotion", lambda b: b["non_effects"].__setitem__("world_first", True)),
        ("merge authority leak", lambda b: b["non_effects"].__setitem__("merge_authorized", True)),
    ]

    for label, mutate in tests:
        expect_fail(label, mutate)

    print(f"PASS: {1 + len(tests)}/{1 + len(tests)} baseline+hostile v0.5 benchmark checks")


if __name__ == "__main__":
    main()
