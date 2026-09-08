#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
MANIFEST = json.loads((HERE / "source-manifest.json").read_text(encoding="utf-8"))
MODEL_KEYS = ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY")


def run_git(source: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(source), *args], text=True).strip()


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def junit_counts(path: Path) -> dict[str, int]:
    root = ET.parse(path).getroot()
    if root.tag == "testsuite":
        suites = [root]
    elif root.tag == "testsuites":
        suites = list(root.findall("testsuite"))
        if not suites and all(k in root.attrib for k in ("tests", "failures", "errors", "skipped")):
            suites = [root]
    else:
        raise ValueError(f"unexpected JUnit root: {root.tag}")

    totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    for suite in suites:
        for key in totals:
            totals[key] += int(suite.attrib.get(key, "0"))
    totals["passed"] = totals["tests"] - totals["failures"] - totals["errors"] - totals["skipped"]
    if totals["passed"] < 0:
        raise ValueError("invalid JUnit aggregate counts")
    return totals


def verify_source(source_dir: Path) -> dict[str, str]:
    source = MANIFEST["source"]
    objects = source["git_objects"]
    observed = {
        "commit": run_git(source_dir, "rev-parse", "HEAD"),
        "src_tree": run_git(source_dir, "rev-parse", "HEAD:src"),
        "tests_tree": run_git(source_dir, "rev-parse", "HEAD:tests"),
        "pyproject_toml_blob": run_git(source_dir, "rev-parse", "HEAD:pyproject.toml"),
        "uv_lock_blob": run_git(source_dir, "rev-parse", "HEAD:uv.lock"),
    }
    expected = {
        "commit": source["commit"],
        "src_tree": objects["src_tree"],
        "tests_tree": objects["tests_tree"],
        "pyproject_toml_blob": objects["pyproject_toml_blob"],
        "uv_lock_blob": objects["uv_lock_blob"],
    }
    if observed != expected:
        raise ValueError(f"pinned upstream identity mismatch: expected={expected}, observed={observed}")
    return observed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--junit", type=Path, required=True)
    parser.add_argument("--pytest-exit-code", type=int, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--hash-output", type=Path)
    args = parser.parse_args()

    if args.pytest_exit_code not in {0, 1}:
        raise ValueError(
            f"pytest exit {args.pytest_exit_code} is an execution blocker, not a completed suite PASS/NONPASS result"
        )

    observed = verify_source(args.source_dir)
    credential_presence = {key: bool(os.environ.get(key)) for key in MODEL_KEYS}
    if any(credential_presence.values()):
        raise ValueError(f"model credential unexpectedly present: {credential_presence}")

    counts = junit_counts(args.junit)
    if counts["tests"] <= 0:
        raise ValueError("pytest executed zero tests")

    uv_version = subprocess.check_output(["uv", "--version"], text=True).strip()
    package_version = importlib.metadata.version("statebench")
    expected_package_version = MANIFEST["source"]["package_version"]
    if package_version != expected_package_version:
        raise ValueError(f"installed package mismatch: expected {expected_package_version}, observed {package_version}")

    test_pass = args.pytest_exit_code == 0 and counts["failures"] == 0 and counts["errors"] == 0
    status = "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_PASS" if test_pass else "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_NONPASS"

    result = {
        "schema": "matawaka.statebench-upstream-code-execution-results/v0.8",
        "predecessor": MANIFEST["frozen_predecessor"]["commit"],
        "upstream": {
            "repository": MANIFEST["source"]["repository"],
            "commit": observed["commit"],
            "package_name": MANIFEST["source"]["package_name"],
            "package_version": package_version,
            "license": MANIFEST["source"]["license"],
            "git_objects": {
                "src_tree": observed["src_tree"],
                "tests_tree": observed["tests_tree"],
                "pyproject_toml_blob": observed["pyproject_toml_blob"],
                "uv_lock_blob": observed["uv_lock_blob"],
            },
        },
        "execution": {
            "status": status,
            "harness_provenance": MANIFEST["execution_harness"]["kind"],
            "dependency_source": MANIFEST["execution_harness"]["dependency_source"],
            "pytest_exit_code": args.pytest_exit_code,
            "tests": counts["tests"],
            "passed": counts["passed"],
            "failures": counts["failures"],
            "errors": counts["errors"],
            "skipped": counts["skipped"],
            "entire_pinned_tests_tree_selected": True,
            "model_credentials_present": credential_presence,
        },
        "environment": {
            "python": platform.python_version(),
            "implementation": platform.python_implementation(),
            "platform": platform.platform(),
            "uv": uv_version,
        },
        "performance": {
            "held_out_detection_recall": None,
            "benign_false_positive_rate": None,
            "statebench_model_score": None,
            "matawaka_model_score": None,
        },
        "non_effects": {
            "statebench_model_harness_executed": False,
            "statebench_baseline_executed": False,
            "external_model_executed": False,
            "matawaka_model_executed": False,
            "detection_advantage_established": False,
            "detection_non_advantage_established": False,
            "novelty_established": False,
            "world_first": False,
            "merge_authorized": False,
        },
    }

    encoded = canonical_bytes(result)
    digest = hashlib.sha256(encoded).hexdigest()
    if args.output:
        args.output.write_bytes(encoded)
    else:
        sys.stdout.buffer.write(encoded)
    if args.hash_output:
        args.hash_output.write_text(digest + "\n", encoding="ascii")
    print(f"RESULT_SHA256={digest}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
