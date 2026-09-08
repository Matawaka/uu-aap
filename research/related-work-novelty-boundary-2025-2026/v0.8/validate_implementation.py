#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from validate_execution import validate_result, validate_static

HERE = Path(__file__).resolve().parent
RESULT_SHA256 = "6af16515eeb26d8dcd99574122f682db4f1f9460679656af2776292516b5e114"
FIRST_GREEN_HEAD = "86634201d0d2e1626e32979d1a6f43934c0240dc"
WORKFLOW_RUN_ID = 34184550397
WORKFLOW_JOB_ID = 101930148141


def load(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def main() -> int:
    validate_static()
    results = load("results.json")
    validate_result(results)

    raw_result = (HERE / "results.json").read_bytes()
    assert hashlib.sha256(raw_result).hexdigest() == RESULT_SHA256
    assert (HERE / "results.sha256").read_text(encoding="ascii").strip() == RESULT_SHA256

    receipt = load("implementation-receipt.json")
    assert receipt["schema"] == "matawaka.statebench-upstream-code-execution-implementation-receipt/v0.8"
    assert receipt["issue"] == 972
    assert receipt["pull_request"] == 973
    assert receipt["predecessor"] == "c2ea9dc329b1d3060770c028554f37aa1cb93611"
    assert receipt["first_independent_green_head"] == FIRST_GREEN_HEAD
    assert receipt["workflow_run_id"] == WORKFLOW_RUN_ID
    assert receipt["workflow_job_id"] == WORKFLOW_JOB_ID
    assert receipt["workflow_name"] == "StateBench Upstream Code Execution v0.8"

    upstream = receipt["upstream"]
    result_upstream = results["upstream"]
    assert upstream["repository"] == result_upstream["repository"] == "Parslee-ai/statebench"
    assert upstream["commit"] == result_upstream["commit"] == "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
    assert upstream["package_name"] == result_upstream["package_name"] == "statebench"
    assert upstream["package_version"] == result_upstream["package_version"] == "2.0.0"
    assert upstream["src_tree"] == result_upstream["git_objects"]["src_tree"] == "93d4843a4a444f8ea583c19a4d5961ed9042a586"
    assert upstream["tests_tree"] == result_upstream["git_objects"]["tests_tree"] == "b9c5cd768f7e117b9a7871eb4b91a8ecb3e2c6df"
    assert upstream["pyproject_toml_blob"] == result_upstream["git_objects"]["pyproject_toml_blob"] == "54a9ba6b6cb711074d771bf3da45a4f0cb17d166"
    assert upstream["uv_lock_blob"] == result_upstream["git_objects"]["uv_lock_blob"] == "58b24498b3ffb56247482613c5c01dec3e46bc0d"

    execution = receipt["execution"]
    result_execution = results["execution"]
    assert execution["status"] == result_execution["status"] == "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_PASS"
    assert execution["entire_pinned_tests_tree_selected"] is True
    for key in ("tests", "passed", "failures", "errors", "skipped", "pytest_exit_code"):
        assert execution[key] == result_execution[key]
    assert (execution["tests"], execution["passed"], execution["failures"], execution["errors"], execution["skipped"], execution["pytest_exit_code"]) == (245, 245, 0, 0, 0, 0)
    assert execution["model_credentials_present"] == result_execution["model_credentials_present"] == {
        "OPENAI_API_KEY": False,
        "ANTHROPIC_API_KEY": False,
        "GOOGLE_API_KEY": False,
    }
    assert execution["environment"]["python"] == results["environment"]["python"] == "3.12.14"
    assert execution["environment"]["pytest"] == "9.0.2"
    assert execution["environment"]["uv"] == "0.12.10"
    assert results["environment"]["uv"] == "uv 0.12.10 (x86_64-unknown-linux-gnu)"
    assert execution["deterministic_result_sha256"] == RESULT_SHA256

    q = receipt["qualification_evidence"]
    assert q == {
        "job_conclusion": "success",
        "frozen_v01_v07_revalidated": True,
        "execution_boundary_hostile_checks": "18/18",
        "exact_upstream_checkout": True,
        "exact_upstream_git_objects_verified": True,
        "frozen_upstream_lock_used": True,
        "full_tests_tree_executed": True,
        "model_keys_absent": True,
        "exact_v07_predecessor_bound": True,
        "exact_v07_tree_bound": True,
        "additive_only_boundary_proven": True,
        "predecessor_and_runtime_product_surfaces_unchanged": True,
    }

    assert receipt["performance"] == results["performance"]
    assert all(value is None for value in receipt["performance"].values())
    assert receipt["non_effects"]
    assert not any(receipt["non_effects"].values())
    assert receipt["non_effects"]["merge_authorized"] is False

    print("PASS: v0.8 implementation receipt matches exact first independent upstream-code execution and preserves all non-effects")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
