#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from validate_envelope import (
    DEFAULT_LOCK,
    DEFAULT_PROJECT,
    DEFAULT_PROTOCOL,
    LOCK_BYTES,
    LOCK_GIT_BLOB,
    LOCK_PACKAGES,
    LOCK_SHA256,
    PREDECESSOR,
    PREDECESSOR_TREE,
    validate as validate_envelope,
)

HERE = Path(__file__).resolve().parent
RECEIPT = HERE / "implementation-receipt.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def git_blob_sha1(raw: bytes) -> str:
    return hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()


def main() -> int:
    validate_envelope(DEFAULT_PROTOCOL, DEFAULT_PROJECT, DEFAULT_LOCK)
    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))

    require(receipt["schema"] == "matawaka.statebench-lm-eval-envelope-implementation-receipt/v0.10", "receipt schema drift")
    require(receipt["issue"] == 976, "issue drift")
    require(receipt["predecessor"] == PREDECESSOR, "predecessor drift")
    require(receipt["predecessor_v09_tree"] == PREDECESSOR_TREE, "predecessor tree drift")

    first = receipt["first_resolver"]
    require(first == {
        "pr_head": "c5b0f90e561bae00f192fd427c1c6addf034907f",
        "workflow_event_sha": "c549b916157b755bc24bfd1eee392448dbb5af15",
        "common_tree": "49d6251bbbac489038fd3f3dac080a2522d0b123",
        "run": 34188348738,
        "job": 101941119988,
        "conclusion": "success",
        "artifact_id": 10041299424,
        "artifact_zip_sha256": "a36a86e4541d108caa47cc21d87ceafdee8c9053b703f9e5dcbb0b7e9005cd40",
    }, "first resolver evidence drift")

    frozen = receipt["frozen_lock"]
    require(frozen["sha256"] == LOCK_SHA256, "receipt lock SHA drift")
    require(frozen["git_blob_sha1"] == LOCK_GIT_BLOB, "receipt git blob drift")
    require(frozen["bytes"] == LOCK_BYTES, "receipt byte count drift")
    require(frozen["package_count"] == LOCK_PACKAGES, "receipt package count drift")

    freeze = receipt["freeze"]
    require(freeze["run"] == 34188905760, "freeze run drift")
    require(freeze["job"] == 101942732978, "freeze job drift")
    require(freeze["conclusion"] == "success", "freeze conclusion drift")
    require(freeze["commit"] == "19ced1d6854b1bc4459ce36c94169f2a4fb2efd8", "freeze commit drift")
    require(freeze["changed_paths"] == ["research/related-work-novelty-boundary-2025-2026/v0.10/lock-project/uv.lock"], "freeze scope drift")
    for key in ("source_was_exact_first_green_artifact", "lock_sha_verified_before_write", "unchanged_head_verified_before_write", "fast_forward_only"):
        require(freeze[key] is True, f"freeze proof disabled: {key}")
    require(freeze["one_shot_write_workflow_retired_commit"] == "f811cc212daffffa77f578b3424c5682d9e21a6f", "write-surface retirement drift")

    correction = receipt["source_correction"]
    require(correction["exact_observed_requirement"] == "datasets>=2.16.0", "corrected datasets requirement drift")
    require(correction["datasets_version_conflict_established"] is False, "unproven datasets conflict promoted")
    require(correction["correction_commit"] == "9989d95d4257330a1f58f339130a56b96d2ab1a3", "correction commit drift")

    raw = DEFAULT_LOCK.read_bytes()
    require(len(raw) == LOCK_BYTES, "lock byte count changed")
    require(hashlib.sha256(raw).hexdigest() == LOCK_SHA256, "lock SHA-256 changed")
    require(git_blob_sha1(raw) == LOCK_GIT_BLOB, "lock Git blob changed")

    effects = receipt["effects"]
    require(effects["dependency_graph_resolved"] is True, "resolution evidence removed")
    require(effects["lock_frozen"] is True, "lock freeze evidence removed")
    for key in (
        "environment_synced", "runtime_imports_executed", "model_executed", "dataset_executed",
        "huggingface_model_downloaded", "external_model_api_called", "user_credentials_used",
        "official_statebench_benchmark_executed", "runtime_compatibility_established", "merge_authorized",
    ):
        require(effects[key] is False, f"forbidden implementation effect promoted: {key}")

    print("STATEBENCH_LM_EVAL_ENVELOPE_V0.10_IMPLEMENTATION_RECEIPT_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
