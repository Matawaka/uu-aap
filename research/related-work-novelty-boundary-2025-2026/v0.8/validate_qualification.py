#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from validate_implementation import main as validate_implementation

HERE = Path(__file__).resolve().parent


def load(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def main() -> int:
    validate_implementation()
    receipt = load("qualification-receipt.json")
    implementation = load("implementation-receipt.json")
    results = load("results.json")

    assert receipt["schema"] == "matawaka.statebench-upstream-code-execution-qualification-receipt/v0.8"
    assert receipt["issue"] == 972
    assert receipt["pull_request"] == 973
    assert receipt["predecessor"] == "c2ea9dc329b1d3060770c028554f37aa1cb93611"
    assert receipt["qualified_head"] == implementation["first_independent_green_head"] == "86634201d0d2e1626e32979d1a6f43934c0240dc"
    assert receipt["workflow_run_id"] == implementation["workflow_run_id"] == 34184550397
    assert receipt["workflow_job_id"] == implementation["workflow_job_id"] == 101930148141
    assert receipt["workflow_name"] == implementation["workflow_name"] == "StateBench Upstream Code Execution v0.8"

    q = receipt["qualification"]
    assert q["job_conclusion"] == "success"
    assert q["baseline_hostile_checks"] == "18/18"
    for key, value in q.items():
        if key not in {"job_conclusion", "baseline_hostile_checks"}:
            assert value is True, key

    result = receipt["result"]
    assert result["status"] == results["execution"]["status"] == "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_PASS"
    assert (result["tests"], result["passed"], result["failures"], result["errors"], result["skipped"], result["pytest_exit_code"]) == (245, 245, 0, 0, 0, 0)
    assert result["tests"] == results["execution"]["tests"]
    assert result["passed"] == results["execution"]["passed"]
    assert result["python"] == implementation["execution"]["environment"]["python"] == results["environment"]["python"] == "3.12.14"
    assert result["pytest"] == implementation["execution"]["environment"]["pytest"] == "9.0.2"
    assert result["uv"] == implementation["execution"]["environment"]["uv"] == "0.12.10"
    assert result["deterministic_result_sha256"] == implementation["execution"]["deterministic_result_sha256"] == "6af16515eeb26d8dcd99574122f682db4f1f9460679656af2776292516b5e114"
    assert result["held_out_detection_recall"] is None
    assert result["benign_false_positive_rate"] is None
    assert result["statebench_model_score"] is None
    assert result["matawaka_model_score"] is None

    assert receipt["non_effects"]
    assert not any(receipt["non_effects"].values())
    assert receipt["non_effects"]["merge_authorized"] is False

    print("PASS: first independent v0.8 qualification remains frozen, upstream-code-executed, and non-promoting")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
