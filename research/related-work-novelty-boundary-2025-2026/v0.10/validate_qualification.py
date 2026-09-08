#!/usr/bin/env python3
from __future__ import annotations

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
from validate_implementation import main as validate_implementation_main

HERE = Path(__file__).resolve().parent
RECEIPT = HERE / "qualification-receipt.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    validate_envelope(DEFAULT_PROTOCOL, DEFAULT_PROJECT, DEFAULT_LOCK)
    require(validate_implementation_main() == 0, "implementation receipt validation failed")
    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))

    require(receipt["schema"] == "matawaka.statebench-lm-eval-envelope-qualification-receipt/v0.10", "qualification schema drift")
    require(receipt["issue"] == 976, "qualification issue drift")
    require(receipt["predecessor"] == PREDECESSOR, "qualification predecessor drift")
    require(receipt["predecessor_v09_tree"] == PREDECESSOR_TREE, "qualification predecessor tree drift")
    require(receipt["qualified_status"] == "JOINT_INTEGRATION_DEPENDENCY_LOCK_FROZEN_AND_FROZEN_ONLY_VALIDATED", "qualified status drift")
    require(receipt["implementation_receipt"].endswith("/v0.10/implementation-receipt.json"), "implementation receipt binding drift")

    frozen = receipt["frozen_lock"]
    require(frozen == {
        "sha256": LOCK_SHA256,
        "git_blob_sha1": LOCK_GIT_BLOB,
        "bytes": LOCK_BYTES,
        "package_count": LOCK_PACKAGES,
    }, "qualification lock identity drift")

    successor = receipt["successor_validation"]
    require(successor["pr_head"] == "b72365b3f06f2f8cfb6d56274e22f11add5e9f7d", "successor PR head drift")
    require(successor["workflow_event_sha"] == "170aee67a7ff378130fbf1a6c3579dc395ff62e7", "successor workflow event SHA drift")
    require(successor["run"] == 34189262783, "successor run drift")
    require(successor["job"] == 101943768396, "successor job drift")
    require(successor["conclusion"] == "success", "successor conclusion drift")
    require(successor["artifact_id"] == 10041606064, "successor artifact id drift")
    require(successor["artifact_zip_sha256"] == "d5e1c6e99bb2e33883b3c2f2ce5aae1a18190cd5a4cf5d681be24bd3bb107a1", "successor artifact digest drift")
    require(successor["lock_source"] == "FROZEN_FIRST_GREEN", "successor lock source drift")
    require(successor["lock_reresolved_as_source_of_truth"] is False, "successor promoted re-resolution")
    for key in (
        "uv_lock_check_passed", "byte_identity_revalidated", "predecessor_gate_passed",
        "additive_only_gate_passed", "protected_surfaces_unchanged",
    ):
        require(successor[key] is True, f"successor evidence missing: {key}")

    boundary = receipt["boundary"]
    for key in ("dependency_resolution_evidence", "lock_freeze_evidence", "frozen_lock_consistency_evidence"):
        require(boundary[key] is True, f"qualified evidence removed: {key}")
    for key in (
        "environment_sync_evidence", "runtime_import_compatibility_evidence",
        "local_hf_model_execution_evidence", "dataset_execution_evidence",
        "official_statebench_benchmark_evidence", "detection_advantage_established",
        "detection_non_advantage_established", "novelty_established", "production_ready",
        "release_authorized", "standards_authorized", "merge_authorized",
    ):
        require(boundary[key] is False, f"forbidden qualification promoted: {key}")
    for key in ("decision_accuracy", "sfrr", "held_out_detection_recall", "benign_false_positive_rate"):
        require(boundary[key] is None, f"performance field populated: {key}")

    require(receipt["next_gate"] == "FROZEN_SYNC_AND_IMPORT_SMOKE_ONLY", "next gate drift")
    print("STATEBENCH_LM_EVAL_ENVELOPE_V0.10_QUALIFICATION_RECEIPT_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
