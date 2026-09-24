#!/usr/bin/env python3

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent

EXPECTED = {
    "schema": "matawaka.related-work-novelty-boundary-qualification/2025-2026/v0.1",
    "exact_predecessor": "0e74f89695bbcb02c759000752696c322d908f7a",
    "first_failed_run": {
        "head": "686a5083f4c2f1860cc60588561fdbbf68c85b79",
        "run_id": 34120022581,
        "job_id": 101735701547,
        "result": "FAIL_CLOSED",
        "failure_stage": "AUDIT_ONLY_DIFF_GUARD_BASE_OBJECT_NOT_FETCHED",
        "content_validator_passed": True,
        "hostile_tests_passed": True,
    },
    "first_green_qualification": {
        "head": "0c2c17ae81a82c19c16f4655d351b69a1ab9681a",
        "run_id": 34120116526,
        "job_id": 101735999036,
        "result": "SUCCESS",
        "hostile_checks": "16/16",
        "gates": {
            "ledger_and_matrix": "SUCCESS",
            "hostile_suite": "SUCCESS",
            "exact_predecessor": "SUCCESS",
            "audit_only_diff": "SUCCESS",
            "normative_runtime_guard": "SUCCESS",
        },
    },
    "claims": {
        "research_package_qualified_bounded": True,
        "novelty_established": False,
        "patentability_established": False,
        "freedom_to_operate_established": False,
        "world_first_established": False,
        "semantic_influence_established": False,
        "merge_authority_created": False,
    },
    "verdict": "BOUNDED_RESEARCH_LANDSCAPE_PACKAGE_FIRST_INDEPENDENT_QUALIFICATION_PASS_NOVELTY_NOT_ESTABLISHED",
}


def main() -> int:
    try:
        with (ROOT / "qualification-receipt.json").open("r", encoding="utf-8") as fh:
            actual = json.load(fh)
        if actual != EXPECTED:
            raise ValueError("qualification receipt differs from exact frozen first-qualification evidence")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("PASS: frozen first independent landscape qualification is exact")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
