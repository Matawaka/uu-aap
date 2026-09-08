#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_PROTOCOL = HERE / "protocol.json"
DEFAULT_PROJECT = HERE / "lock-project" / "pyproject.toml"
DEFAULT_LOCK = HERE / "lock-project" / "uv.lock"

STATEBENCH_COMMIT = "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
LM_EVAL_COMMIT = "ddd67220430a2470529f25fd5c05a576ca1057a0"
LM_EVAL_TAG_OBJECT = "eb4678c395c2c1f157d462b8f3a09831160c861a"
PREDECESSOR = "1b2c5e622501dd07f4560d5356e0708fa9633833"
PREDECESSOR_TREE = "d409b43debc532a1423092200661b8a823990eda"
LOCK_SHA256 = "324ab96f208bfbe1e6a2d03bc6ceb4bf5aa4867a57eeac5217e81571b7925532"
LOCK_GIT_BLOB = "975210dd6ee71d3504e9ff2b8f482d7e4d6f5123"
LOCK_BYTES = 224954
LOCK_PACKAGES = 133

EXPECTED_DEPS = [
    "lm-eval[hf]==0.4.13",
    f"statebench @ git+https://github.com/Parslee-ai/statebench.git@{STATEBENCH_COMMIT}",
    f"statebench-lm-eval @ git+https://github.com/Parslee-ai/statebench.git@{STATEBENCH_COMMIT}#subdirectory=statebench-lm-eval",
]
EXPECTED_VERSIONS = {
    "lm-eval": "0.4.13",
    "statebench": "2.0.0",
    "statebench-lm-eval": "0.1.0",
    "datasets": "5.0.1",
    "torch": "2.14.0",
    "transformers": "5.16.1",
    "accelerate": "1.14.0",
    "peft": "0.20.0",
}


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _git_blob_sha1(raw: bytes) -> str:
    return hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()


def validate(
    protocol_path: Path = DEFAULT_PROTOCOL,
    project_path: Path = DEFAULT_PROJECT,
    lock_path: Path = DEFAULT_LOCK,
) -> None:
    protocol = json.loads(protocol_path.read_text(encoding="utf-8"))
    project = tomllib.loads(project_path.read_text(encoding="utf-8"))

    _require(protocol["schema"] == "matawaka.statebench-lm-eval-envelope-protocol/v0.10", "schema drift")
    _require(protocol["issue"] == 976, "issue drift")
    _require(protocol["predecessor"] == PREDECESSOR, "predecessor drift")
    _require(protocol["predecessor_v09_tree"] == PREDECESSOR_TREE, "predecessor tree drift")
    _require(protocol["target_status"] == "JOINT_INTEGRATION_DEPENDENCY_LOCK_FROZEN", "target status drift")

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

    frozen = protocol["frozen_lock"]
    _require(frozen["path"].endswith("/v0.10/lock-project/uv.lock"), "frozen lock path drift")
    _require(frozen["sha256"] == LOCK_SHA256, "frozen lock SHA-256 drift")
    _require(frozen["git_blob_sha1"] == LOCK_GIT_BLOB, "frozen lock git blob drift")
    _require(frozen["bytes"] == LOCK_BYTES, "frozen lock byte count drift")
    _require(frozen["package_count"] == LOCK_PACKAGES, "frozen package count drift")
    _require(frozen["first_resolver_run"] == 34188348738, "first resolver run drift")
    _require(frozen["first_resolver_job"] == 101941119988, "first resolver job drift")
    _require(frozen["first_resolver_pr_head"] == "c5b0f90e561bae00f192fd427c1c6addf034907f", "first PR head drift")
    _require(frozen["first_resolver_workflow_event_sha"] == "c549b916157b755bc24bfd1eee392448dbb5af15", "first workflow event SHA drift")
    _require(frozen["first_resolver_common_tree"] == "49d6251bbbac489038fd3f3dac080a2522d0b123", "first common tree drift")
    _require(frozen["artifact_id"] == 10041299424, "artifact id drift")
    _require(frozen["artifact_zip_sha256"] == "a36a86e4541d108caa47cc21d87ceafdee8c9053b703f9e5dcbb0b7e9005cd40", "artifact digest drift")
    _require(frozen["freeze_run"] == 34188905760, "freeze run drift")
    _require(frozen["freeze_commit"] == "19ced1d6854b1bc4459ce36c94169f2a4fb2efd8", "freeze commit drift")
    _require(frozen["freeze_commit_added_only_lock"] is True, "freeze scope proof removed")
    _require(frozen["one_shot_write_surface_retired"] is True, "one-shot write authority not retired")

    requirements = protocol["requirements"]
    for key in (
        "resolve_complete_uv_lock",
        "statebench_source_exact_git_commit",
        "lm_eval_exact_release_version",
        "freeze_lock_before_model_execution",
        "frozen_lock_byte_identity_required",
        "successor_must_not_reresolve_as_source_of_truth",
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
    _require(seams["lock_resolution_is_runtime_compatibility_evidence"] is False, "lock resolution promoted to runtime compatibility")
    _require(seams["workflow_event_sha_is_pr_head_sha"] is False, "PR event SHA topology collapsed")

    _require(protocol["resolved_observations"] == EXPECTED_VERSIONS, "resolved observation drift")

    for key, value in protocol["performance"].items():
        _require(value is None, f"performance claim populated before model gate: {key}")
    for key, value in protocol["non_effects"].items():
        _require(value is False, f"forbidden effect promoted before runtime/model gate: {key}")

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

    raw = lock_path.read_bytes()
    _require(len(raw) == LOCK_BYTES, "frozen lock bytes changed")
    _require(hashlib.sha256(raw).hexdigest() == LOCK_SHA256, "frozen lock content SHA-256 mismatch")
    _require(_git_blob_sha1(raw) == LOCK_GIT_BLOB, "frozen lock Git blob identity mismatch")
    lock = tomllib.loads(raw.decode("utf-8"))
    packages = lock.get("package", [])
    _require(len(packages) == LOCK_PACKAGES, "frozen lock package count mismatch")
    by_name = {item["name"]: item for item in packages}
    for name, version in EXPECTED_VERSIONS.items():
        _require(by_name[name].get("version") == version, f"frozen version drift: {name}")
    _require(STATEBENCH_COMMIT in by_name["statebench"]["source"]["git"], "StateBench git source drift in lock")
    _require(STATEBENCH_COMMIT in by_name["statebench-lm-eval"]["source"]["git"], "StateBench plugin git source drift in lock")
    _require("subdirectory=statebench-lm-eval" in by_name["statebench-lm-eval"]["source"]["git"], "plugin subdirectory source drift in lock")


def main() -> int:
    protocol = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PROTOCOL
    project = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PROJECT
    lock = Path(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_LOCK
    validate(protocol, project, lock)
    print("STATEBENCH_LM_EVAL_ENVELOPE_V0.10_FROZEN_LOCK_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
