#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESULT = ROOT / "results.json"
DIGEST = ROOT / "results.sha256"
RECEIPT = ROOT / "implementation-receipt.json"
EXPECTED_SHA = "08068dd3ebaf9546b5c1592cf77908487fc09cc8944f19f08c55ec9e298a8ce1"
EXPECTED_IMPORTS = {
    "statebench": "2.0.0",
    "lm_eval": "0.4.13",
    "datasets": "5.0.1",
    "torch": "2.14.0",
    "transformers": "5.16.1",
    "accelerate": "1.14.0",
    "peft": "0.20.0",
}


def main() -> int:
    raw = RESULT.read_bytes()
    assert len(raw) == 1620
    actual = hashlib.sha256(raw).hexdigest()
    assert actual == EXPECTED_SHA
    assert DIGEST.read_text(encoding="utf-8") == f"{EXPECTED_SHA}  results.json\n"

    result = json.loads(raw)
    assert result["schema"] == "matawaka.statebench-frozen-sync-import-result/v0.11"
    assert result["status"] == "FROZEN_SYNC_AND_IMPORT_SMOKE_EXECUTED"
    assert result["python"] == "3.12.14"
    assert result["network_guard_active"] is True
    assert result["credentials_present"] == []
    assert result["offline_controls"] == {
        "HF_DATASETS_OFFLINE": "1",
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
    }
    observed = {entry["module"]: entry["version"] for entry in result["imports"]}
    assert observed == EXPECTED_IMPORTS
    assert all(entry["imported"] is True for entry in result["imports"])
    assert all(value is False for value in result["non_effects"].values())

    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    assert receipt["schema"] == "matawaka.statebench-frozen-sync-import-implementation-receipt/v0.11"
    assert receipt["issue"] == 978
    assert receipt["predecessor"] == "0b82089449e5a1401ad5f9310e2ce8ff43fa1bf1"
    assert receipt["predecessor_v010_tree"] == "65999dd76af39c79872131231355b3655c52573d"
    assert receipt["status"] == result["status"]
    assert receipt["result"] == {"path": "research/related-work-novelty-boundary-2025-2026/v0.11/results.json", "sha256": EXPECTED_SHA, "bytes": 1620}
    assert receipt["observed_imports"] == EXPECTED_IMPORTS
    assert receipt["frozen_lock"]["sha256"] == "324ab96f208bfbe1e6a2d03bc6ceb4bf5aa4867a57eeac5217e81571b7925532"
    assert receipt["frozen_lock"]["lock_unchanged_before_after"] is True
    assert receipt["runtime"]["python"] == "3.12.14"
    assert receipt["runtime"]["uv_distribution"] == "0.12.10"
    assert all(value is False for value in receipt["non_effects"].values())
    print("STATEBENCH_FROZEN_SYNC_IMPORT_V0.11_IMPLEMENTATION_RECEIPT_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
