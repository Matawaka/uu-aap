#!/usr/bin/env python3
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROTOCOL = ROOT / "protocol.json"
SMOKE = ROOT / "run_import_smoke.py"

EXPECTED_PREDECESSOR = "0b82089449e5a1401ad5f9310e2ce8ff43fa1bf1"
EXPECTED_TREE = "65999dd76af39c79872131231355b3655c52573d"
EXPECTED_LOCK = "324ab96f208bfbe1e6a2d03bc6ceb4bf5aa4867a57eeac5217e81571b7925532"
EXPECTED_IMPORTS = ["statebench", "lm_eval", "datasets", "torch", "transformers", "accelerate", "peft"]


def validate(protocol: dict, smoke_text: str) -> None:
    assert protocol["schema"] == "matawaka.statebench-frozen-sync-import-protocol/v0.11"
    assert protocol["issue"] == 978
    assert protocol["predecessor"] == EXPECTED_PREDECESSOR
    assert protocol["predecessor_v010_tree"] == EXPECTED_TREE
    assert protocol["target_status"] == "FROZEN_SYNC_AND_IMPORT_SMOKE_EXECUTED"
    env = protocol["environment"]
    assert env["python"] == "3.12.14"
    assert env["uv"] == "0.12.10"
    assert env["lock_sha256"] == EXPECTED_LOCK
    assert env["lock_git_blob_sha1"] == "975210dd6ee71d3504e9ff2b8f482d7e4d6f5123"
    assert env["lock_bytes"] == 224954
    assert env["lock_package_count"] == 133
    assert protocol["imports"] == EXPECTED_IMPORTS

    req = protocol["requirements"]
    for key in (
        "sync_from_frozen_lock_only",
        "lock_identity_before_sync",
        "lock_identity_after_sync",
        "no_reresolution_as_source_of_truth",
        "network_blocked_during_import_smoke",
        "provider_credentials_absent",
        "hub_datasets_transformers_offline_during_smoke",
        "record_imported_versions",
        "no_task_loading",
        "no_dataset_loading",
        "no_model_instantiation",
        "no_scoring",
    ):
        assert req[key] is True, key

    for value in protocol["performance"].values():
        assert value is None
    for key, value in protocol["non_effects"].items():
        assert value is False, key

    forbidden = (
        "load_dataset(",
        "AutoModel",
        "AutoTokenizer",
        "pipeline(",
        "simple_evaluate(",
        "EvaluationHarness(",
        ".generate(",
        "openai.",
        "anthropic.",
        "google.genai",
        "requests.",
        "httpx.",
    )
    for token in forbidden:
        assert token not in smoke_text, token


def expect_failure(protocol: dict, smoke_text: str) -> None:
    try:
        validate(protocol, smoke_text)
    except (AssertionError, KeyError):
        return
    raise AssertionError("hostile mutation unexpectedly validated")


def main() -> int:
    protocol = json.loads(PROTOCOL.read_text(encoding="utf-8"))
    smoke_text = SMOKE.read_text(encoding="utf-8")
    validate(protocol, smoke_text)

    mutations = []
    p = deepcopy(protocol); p["predecessor"] = "0" * 40; mutations.append(p)
    p = deepcopy(protocol); p["predecessor_v010_tree"] = "0" * 40; mutations.append(p)
    p = deepcopy(protocol); p["environment"]["lock_sha256"] = "0" * 64; mutations.append(p)
    p = deepcopy(protocol); p["environment"]["lock_package_count"] = 132; mutations.append(p)
    p = deepcopy(protocol); p["requirements"]["sync_from_frozen_lock_only"] = False; mutations.append(p)
    p = deepcopy(protocol); p["requirements"]["network_blocked_during_import_smoke"] = False; mutations.append(p)
    p = deepcopy(protocol); p["requirements"]["no_dataset_loading"] = False; mutations.append(p)
    p = deepcopy(protocol); p["requirements"]["no_model_instantiation"] = False; mutations.append(p)
    p = deepcopy(protocol); p["performance"]["decision_accuracy"] = 0.5; mutations.append(p)
    p = deepcopy(protocol); p["non_effects"]["dataset_loaded"] = True; mutations.append(p)
    p = deepcopy(protocol); p["non_effects"]["language_model_executed"] = True; mutations.append(p)
    p = deepcopy(protocol); p["non_effects"]["merge_authorized"] = True; mutations.append(p)
    p = deepcopy(protocol); p["imports"] = p["imports"][:-1]; mutations.append(p)
    p = deepcopy(protocol); p["target_status"] = "BENCHMARK_EXECUTED"; mutations.append(p)

    for mutation in mutations:
        expect_failure(mutation, smoke_text)

    expect_failure(protocol, smoke_text + "\nload_dataset('x')\n")
    expect_failure(protocol, smoke_text + "\nAutoModel.from_pretrained('x')\n")

    print(f"STATEBENCH_FROZEN_SYNC_IMPORT_V0.11_HOSTILE_GREEN {len(mutations)+2}/{len(mutations)+2}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
