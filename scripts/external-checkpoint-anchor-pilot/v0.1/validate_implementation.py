#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RECEIPT = HERE / "implementation-receipt.json"


def fail(message: str) -> None:
    raise SystemExit(f"EXTERNAL_CHECKPOINT_ANCHOR_IMPLEMENTATION_FAIL: {message}")


def blob(path: str) -> str:
    p = subprocess.run(["git", "rev-parse", f"HEAD:{path}"], cwd=ROOT, text=True, capture_output=True)
    if p.returncode != 0:
        fail(f"cannot resolve {path}: {p.stderr.strip()}")
    return p.stdout.strip()


def main() -> None:
    data = json.loads(RECEIPT.read_text(encoding="utf-8"))
    if data.get("artifact_type") != "ExternalCheckpointAnchorPilotImplementationReceipt" or data.get("version") != "0.1":
        fail("implementation receipt identity mismatch")
    if data.get("tracking_issue") != 929:
        fail("tracking issue mismatch")
    if data.get("repository_predecessor_main") != "f7d5149254892803b84bb31bdc127751c418b544":
        fail("predecessor main mismatch")

    files = data.get("implementation_files")
    if not isinstance(files, dict) or len(files) < 9:
        fail("implementation file bindings missing")
    for path, expected in files.items():
        if blob(path) != expected:
            fail(f"implementation blob drift: {path}")

    workflow = data.get("workflow")
    if not isinstance(workflow, dict) or workflow.get("path") != ".github/workflows/external-checkpoint-anchor-pilot-v0.1.yml":
        fail("workflow binding missing")
    if blob(workflow["path"]) != workflow.get("blob"):
        fail("workflow blob drift")

    runtime = data.get("qualified_runtime")
    expected_runtime = {
        "workflow_run_id": 33957485515,
        "job_id": 101283330453,
        "artifact_id": 9966830130,
        "artifact_zip_sha256": "15fb51bc5585530a7eb8fa12a1f1af262df955a531ce91b4ce0b3cf8aac69bdd",
        "verdict": "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_NOT_ESTABLISHED",
        "receipt_fingerprint_sha256": "60c91b97b7c5308cf6832803b1f399682b579ecb18680a4829a09920d64c71ef",
        "bitcoin_chain_confirmation": "NOT_ESTABLISHED"
    }
    if runtime != expected_runtime:
        fail("qualified runtime binding drift")

    proof = data.get("proof")
    required_true = {
        "real_public_opaque_leaf_fetched",
        "rfc9162_inclusion_verified",
        "same_checkpoint_root_matched",
        "rootcommit_preimage_reproduced",
        "ots_committed_digest_binding_verified",
        "bitcoin_attestation_structure_observed",
        "runtime_receipt_frozen",
        "runtime_frozen_parity_required"
    }
    if not isinstance(proof, dict) or any(proof.get(k) is not True for k in required_true):
        fail("positive proof flags incomplete")
    if proof.get("bitcoin_chain_confirmation_established") is not False:
        fail("Bitcoin chain confirmation must remain not established")
    if proof.get("log_append_only_consistency_verified") is not False:
        fail("single checkpoint cannot prove append-only consistency")

    non_effects = data.get("non_effects")
    if not isinstance(non_effects, dict) or any(v is not False for v in non_effects.values()):
        fail("non-effects must remain false")

    print("EXTERNAL_CHECKPOINT_ANCHOR_IMPLEMENTATION_RECEIPT_PASS")


if __name__ == "__main__":
    main()
