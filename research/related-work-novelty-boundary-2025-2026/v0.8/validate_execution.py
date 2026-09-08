#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
EXPECTED_PREDECESSOR = "c2ea9dc329b1d3060770c028554f37aa1cb93611"
EXPECTED_V07_TREE = "9771bd009efc930df5b42e1c9fb5a870a68dc3a5"
EXPECTED_COMMIT = "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
EXPECTED_OBJECTS = {
    "src_tree": "93d4843a4a444f8ea583c19a4d5961ed9042a586",
    "tests_tree": "b9c5cd768f7e117b9a7871eb4b91a8ecb3e2c6df",
    "pyproject_toml_blob": "54a9ba6b6cb711074d771bf3da45a4f0cb17d166",
    "uv_lock_blob": "58b24498b3ffb56247482613c5c01dec3e46bc0d",
}


def load(name: str) -> Any:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def validate_static() -> None:
    protocol = load("protocol.json")
    manifest = load("source-manifest.json")

    assert protocol["schema"] == "matawaka.statebench-upstream-code-execution-protocol/v0.8"
    assert protocol["issue"] == 972
    assert protocol["predecessor"] == EXPECTED_PREDECESSOR
    assert protocol["predecessor_v07_tree"] == EXPECTED_V07_TREE
    assert protocol["target_status"] == "PINNED_UPSTREAM_TEST_SUITE_EXECUTED"
    assert protocol["harness_provenance"] == "MATAWAKA_EXECUTION_HARNESS_USING_UPSTREAM_UV_LOCK"
    assert protocol["upstream_github_workflow_present_at_pinned_commit"] is False
    assert protocol["requirements"]["execute_entire_tests_tree"] is True
    assert protocol["requirements"]["no_post_result_test_selection_change"] is True
    assert all(value is None for value in protocol["performance_fields"].values())
    assert protocol["non_effects"]
    assert not any(protocol["non_effects"].values())

    assert manifest["schema"] == "matawaka.statebench-upstream-code-source-manifest/v0.8"
    source = manifest["source"]
    assert source["repository"] == "Parslee-ai/statebench"
    assert source["commit"] == EXPECTED_COMMIT
    assert source["license"] == "MIT"
    assert source["package_name"] == "statebench"
    assert source["package_version"] == "2.0.0"
    assert source["requires_python"] == ">=3.11"
    assert source["git_objects"] == EXPECTED_OBJECTS
    assert source["dependency_lock"] == {
        "path": "uv.lock",
        "lock_format_version": 1,
        "revision": 3,
        "frozen_required": True,
    }
    assert source["test_scope"]["path"] == "tests"
    assert source["test_scope"]["selection"] == "ENTIRE_PINNED_TEST_TREE"
    assert source["test_scope"]["tree_sha"] == EXPECTED_OBJECTS["tests_tree"]
    assert source["test_scope"]["post_result_exclusions_permitted"] is False
    assert source["upstream_ci"]["github_workflows_directory_present"] is False
    assert source["upstream_ci"]["execution_procedure_claimed_as_upstream_ci"] is False
    assert manifest["execution_harness"]["kind"] == "INDEPENDENT_REPRODUCTION_HARNESS"
    assert manifest["execution_harness"]["dependency_source"] == "PINNED_UPSTREAM_UV_LOCK"
    assert manifest["execution_harness"]["model_credentials_required_present"] is False
    assert set(manifest["execution_harness"]["model_credential_names_required_unset"]) == {
        "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"
    }
    assert manifest["frozen_predecessor"] == {
        "commit": EXPECTED_PREDECESSOR,
        "v07_tree": EXPECTED_V07_TREE,
    }


def validate_result(result: dict[str, Any]) -> None:
    assert set(result) == {"schema", "predecessor", "upstream", "execution", "environment", "performance", "non_effects"}
    assert result["schema"] == "matawaka.statebench-upstream-code-execution-results/v0.8"
    assert result["predecessor"] == EXPECTED_PREDECESSOR

    upstream = result["upstream"]
    assert set(upstream) == {"repository", "commit", "package_name", "package_version", "license", "git_objects"}
    assert upstream["repository"] == "Parslee-ai/statebench"
    assert upstream["commit"] == EXPECTED_COMMIT
    assert upstream["package_name"] == "statebench"
    assert upstream["package_version"] == "2.0.0"
    assert upstream["license"] == "MIT"
    assert upstream["git_objects"] == EXPECTED_OBJECTS

    execution = result["execution"]
    assert set(execution) == {
        "status", "harness_provenance", "dependency_source", "pytest_exit_code",
        "tests", "passed", "failures", "errors", "skipped",
        "entire_pinned_tests_tree_selected", "model_credentials_present"
    }
    assert execution["harness_provenance"] == "INDEPENDENT_REPRODUCTION_HARNESS"
    assert execution["dependency_source"] == "PINNED_UPSTREAM_UV_LOCK"
    assert execution["pytest_exit_code"] in {0, 1}
    for key in ("tests", "passed", "failures", "errors", "skipped"):
        assert isinstance(execution[key], int) and execution[key] >= 0
    assert execution["tests"] > 0
    assert execution["passed"] + execution["failures"] + execution["errors"] + execution["skipped"] == execution["tests"]
    assert execution["entire_pinned_tests_tree_selected"] is True
    assert execution["model_credentials_present"] == {
        "OPENAI_API_KEY": False,
        "ANTHROPIC_API_KEY": False,
        "GOOGLE_API_KEY": False,
    }
    passed = execution["pytest_exit_code"] == 0 and execution["failures"] == 0 and execution["errors"] == 0
    expected_status = "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_PASS" if passed else "PINNED_UPSTREAM_TEST_SUITE_EXECUTED_NONPASS"
    assert execution["status"] == expected_status

    environment = result["environment"]
    assert set(environment) == {"python", "implementation", "platform", "uv"}
    assert isinstance(environment["python"], str) and environment["python"]
    assert environment["implementation"] == "CPython"
    assert isinstance(environment["platform"], str) and environment["platform"]
    assert isinstance(environment["uv"], str) and environment["uv"].startswith("uv ")

    assert result["performance"] == {
        "held_out_detection_recall": None,
        "benign_false_positive_rate": None,
        "statebench_model_score": None,
        "matawaka_model_score": None,
    }
    assert result["non_effects"] == {
        "statebench_model_harness_executed": False,
        "statebench_baseline_executed": False,
        "external_model_executed": False,
        "matawaka_model_executed": False,
        "detection_advantage_established": False,
        "detection_non_advantage_established": False,
        "novelty_established": False,
        "world_first": False,
        "merge_authorized": False,
    }


def main() -> int:
    validate_static()
    result_path = HERE / "results.json"
    if result_path.exists():
        validate_result(load("results.json"))
        print("PASS: v0.8 static execution boundary and checked-in result are valid")
    else:
        print("PASS: v0.8 static execution boundary valid; independent upstream execution not yet frozen")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
