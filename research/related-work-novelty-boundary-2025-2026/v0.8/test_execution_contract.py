#!/usr/bin/env python3
from __future__ import annotations

import copy
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from summarize_execution import junit_counts
from validate_execution import EXPECTED_COMMIT, EXPECTED_OBJECTS, EXPECTED_PREDECESSOR, validate_result, validate_static


def expect_failure(fn) -> None:
    try:
        fn()
    except (AssertionError, ValueError):
        return
    raise AssertionError("expected failure did not occur")


def write_xml(root: ET.Element) -> Path:
    tmp = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)
    tmp.close()
    path = Path(tmp.name)
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
    return path


def valid_result() -> dict:
    return {
        "schema": "matawaka.statebench-upstream-code-execution-results/v0.8",
        "predecessor": EXPECTED_PREDECESSOR,
        "upstream": {
            "repository": "Parslee-ai/statebench",
            "commit": EXPECTED_COMMIT,
            "package_name": "statebench",
            "package_version": "2.0.0",
            "license": "MIT",
            "git_objects": copy.deepcopy(EXPECTED_OBJECTS),
        },
        "execution": {
            "status": "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_PASS",
            "harness_provenance": "INDEPENDENT_REPRODUCTION_HARNESS",
            "dependency_source": "PINNED_UPSTREAM_UV_LOCK",
            "pytest_exit_code": 0,
            "tests": 10,
            "passed": 9,
            "failures": 0,
            "errors": 0,
            "skipped": 1,
            "entire_pinned_tests_tree_selected": True,
            "model_credentials_present": {
                "OPENAI_API_KEY": False,
                "ANTHROPIC_API_KEY": False,
                "GOOGLE_API_KEY": False,
            },
        },
        "environment": {
            "python": "3.12.0",
            "implementation": "CPython",
            "platform": "Linux-test",
            "uv": "uv 0.0.0-test",
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


def main() -> int:
    checks = 0
    validate_static()
    checks += 1

    single = ET.Element("testsuite", tests="5", failures="1", errors="0", skipped="1")
    path = write_xml(single)
    assert junit_counts(path) == {"tests": 5, "failures": 1, "errors": 0, "skipped": 1, "passed": 3}
    path.unlink()
    checks += 1

    root = ET.Element("testsuites")
    ET.SubElement(root, "testsuite", tests="3", failures="0", errors="0", skipped="1")
    ET.SubElement(root, "testsuite", tests="2", failures="1", errors="0", skipped="0")
    path = write_xml(root)
    assert junit_counts(path) == {"tests": 5, "failures": 1, "errors": 0, "skipped": 1, "passed": 3}
    path.unlink()
    checks += 1

    bad = ET.Element("unexpected")
    path = write_xml(bad)
    expect_failure(lambda: junit_counts(path))
    path.unlink()
    checks += 1

    impossible = ET.Element("testsuite", tests="1", failures="2", errors="0", skipped="0")
    path = write_xml(impossible)
    expect_failure(lambda: junit_counts(path))
    path.unlink()
    checks += 1

    baseline = valid_result()
    validate_result(baseline)
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["upstream"]["commit"] = "0" * 40
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["upstream"]["git_objects"]["tests_tree"] = "0" * 40
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["upstream"]["package_version"] = "2.0.1"
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["execution"]["tests"] = 11
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["execution"]["pytest_exit_code"] = 1
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    nonpass = copy.deepcopy(baseline)
    nonpass["execution"].update({"status": "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_NONPASS", "pytest_exit_code": 1, "passed": 8, "failures": 1})
    validate_result(nonpass)
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["execution"]["entire_pinned_tests_tree_selected"] = False
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["execution"]["model_credentials_present"]["OPENAI_API_KEY"] = True
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["performance"]["statebench_model_score"] = 0.99
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["non_effects"]["statebench_model_harness_executed"] = True
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["non_effects"]["detection_non_advantage_established"] = True
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    mutated = copy.deepcopy(baseline)
    mutated["non_effects"]["merge_authorized"] = True
    expect_failure(lambda: validate_result(mutated))
    checks += 1

    print(f"PASS: {checks}/{checks} baseline+hostile v0.8 execution-boundary checks")
    assert checks == 18
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
