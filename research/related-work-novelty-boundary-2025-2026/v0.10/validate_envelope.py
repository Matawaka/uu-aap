#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_PROTOCOL = HERE / "protocol.json"
DEFAULT_PROJECT = HERE / "lock-project" / "pyproject.toml"

STATEBENCH_COMMIT = "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
LM_EVAL_COMMIT = "ddd67220430a2470529f25fd5c05a576ca1057a0"
LM_EVAL_TAG_OBJECT = "eb4678c395c2c1f157d462b8f3a09831160c861a"
PREDECESSOR = "1b2c5e622501dd07f4560d5356e0708fa9633833"
PREDECESSOR_TREE = "d409b43debc532a1423092200661b8a823990eda"

EXPECTED_DEPS = [
    "lm-eval[hf]==0.4.13",
    f"statebench @ git+https://github.com/Parslee-ai/statebench.git@{STATEBENCH_COMMIT}",
    f"statebench-lm-eval @ git+https://github.com/Parslee-ai/statebench.git@{STATEBENCH_COMMIT}#subdirectory=statebench-lm-eval",
]


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate(protocol_path: Path = DEFAULT_PROTOCOL, project_path: Path = DEFAULT_PROJECT) -> None:
    protocol = json.loads(protocol_path.read_text(encoding="utf-8"))
    project = tomllib.loads(project_path.read_text(encoding="utf-8"))

    _require(protocol["schema"] == "matawaka.statebench-lm-eval-envelope-protocol/v0.10", "schema drift")
    _require(protocol["issue"] == 976, "issue drift")
    _require(protocol["predecessor"] == PREDECESSOR, "predecessor drift")
    _require(protocol["predecessor_v09_tree"] == PREDECESSOR_TREE, "predecessor tree drift")
    _require(protocol["target_status"] == "JOINT_INTEGRATION_DEPENDENCY_LOCK_MATERIALIZED", "target status drift")

    sources = protocol["selected_sources"]
    _require(sources["statebench_repository"] == "Parslee-ai/statebench", "StateBench repository drift")
    _require(sources["statebench_commit"] == STATEBENCH_COMMIT, "StateBench commit drift")
    _require(sources["statebench_package_version"] == "2.0.0", "StateBench package version drift")
    _require(sources["statebench_lm_eval_version"] == "0.1.0", "StateBench lm-eval package version drift")
    _require(sources["lm_eval_requirement"] == "lm-eval[hf]==0.4.13", "lm-eval requirement drift")
    _require(sources["lm_eval_version"] == "0.4.13", "lm-eval version drift")
    _require(sources["lm_eval_signed_tag"] == "v0.4.13", "lm-eval tag drift")
    _require(sources["lm_eval_annotated_tag_object"] == LM_EVAL_TAG_OBJECT, "lm-eval tag object drift")
    _require(sources["lm_eval_commit"] == LM_EVAL_COMMIT, "lm-eval commit drift")

    env = protocol["environment"]
    _require(env == {
        "python": "3.12.14",
        "uv": "0.12.10",
        "kind": "MATAWAKA_JOINT_INTEGRATION_ENVIRONMENT",
        "is_native_statebench_uv_lock": False,
    }, "runtime envelope drift")

    requirements = protocol["requirements"]
    for key in (
        "resolve_complete_uv_lock",
        "statebench_source_exact_git_commit",
        "lm_eval_exact_release_version",
        "freeze_lock_before_model_execution",
        "emit_lock_sha256",
        "emit_resolved_package_inventory",
        "no_model_execution",
        "no_dataset_download",
        "no_huggingface_model_download",
        "no_user_credentials",
        "no_official_benchmark_claim",
    ):
        _require(requirements.get(key) is True, f"required boundary disabled: {key}")

    seams = protocol["known_seams"]
    _require(seams["statebench_native_v08_lock_datasets_version"] == "4.6.0", "native datasets observation drift")
    _require(seams["lm_eval_v0413_datasets_requirement"] == ">=2.16.0", "lm-eval datasets requirement drift")
    _require(seams["datasets_version_conflict_established"] is False, "unproven datasets conflict promoted")
    _require(seams["joint_environment_may_resolve_different_transitives_than_native_statebench_lock"] is True, "joint/native distinction removed")
    _require(seams["ordinary_statebench_lm_eval_task_dataset_path_is_hub"] == "parslee/statebench", "ordinary Hub dataset seam drift")

    for key, value in protocol["performance"].items():
        _require(value is None, f"performance claim populated before model gate: {key}")

    for key, value in protocol["non_effects"].items():
        _require(value is False, f"forbidden effect promoted before model gate: {key}")

    p = project["project"]
    _require(p["name"] == "matawaka-statebench-lm-eval-envelope", "resolver project name drift")
    _require(p["version"] == "0.0.0", "resolver project version drift")
    _require(p["requires-python"] == ">=3.12.14,<3.13", "Python constraint drift")
    deps = p["dependencies"]
    _require(deps == EXPECTED_DEPS, "resolver dependency set/order drift")
    _require(project.get("tool", {}).get("uv", {}).get("package") is False, "resolver project unexpectedly made installable")

    joined = "\n".join(deps)
    _require("lm-eval>=0.4.0" not in joined, "floating upstream lm-eval range leaked into Matawaka envelope")
    _require(joined.count(STATEBENCH_COMMIT) == 2, "exact StateBench commit must bind root and plugin distributions")
    _require("#subdirectory=statebench-lm-eval" in deps[2], "plugin subdirectory binding missing")


def main() -> int:
    protocol = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PROTOCOL
    project = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PROJECT
    validate(protocol, project)
    print("STATEBENCH_LM_EVAL_ENVELOPE_V0.10_STATIC_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
