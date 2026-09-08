#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
EXPECTED_PREDECESSOR = "46a70e83f56c33f07a1c5d43fbe1ec49fb2465b3"
EXPECTED_V08_TREE = "8bd96e94cdc71be82a97bd550686478e9a4b2d5b"
EXPECTED_UPSTREAM = "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
EXPECTED_CREDENTIAL_KEYS = {
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION",
    "GOOGLE_GENAI_USE_VERTEXAI", "CAR_AUTH_TOKEN",
}


def load(name: str) -> Any:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def validate_static() -> None:
    protocol = load("protocol.json")
    manifest = load("source-manifest.json")

    assert protocol["schema"] == "matawaka.statebench-evaluator-availability-protocol/v0.9"
    assert protocol["issue"] == 974
    assert protocol["predecessor"] == EXPECTED_PREDECESSOR
    assert protocol["predecessor_v08_tree"] == EXPECTED_V08_TREE
    assert protocol["requirements"]["no_external_model_request"] is True
    assert protocol["requirements"]["control_query_count"] == 251
    assert protocol["requirements"]["control_timeline_count"] == 209
    assert all(value is None for value in protocol["performance_fields"].values())
    assert protocol["non_effects"] and not any(protocol["non_effects"].values())

    assert manifest["schema"] == "matawaka.statebench-evaluator-availability-source-manifest/v0.9"
    assert manifest["issue"] == 974
    assert manifest["frozen_predecessor"] == {"commit": EXPECTED_PREDECESSOR, "v08_tree": EXPECTED_V08_TREE}
    source = manifest["source"]
    assert source["repository"] == "Parslee-ai/statebench"
    assert source["commit"] == EXPECTED_UPSTREAM
    assert source["package_version"] == "2.0.0"
    assert source["native_harness"]["generation_providers"] == ["openai", "anthropic", "google", "car"]
    assert source["native_harness"]["generation_is_mandatory_before_judging"] is True
    assert source["native_harness"]["deterministic_only_judge_bypasses_generation"] is False
    assert source["native_cli_observation"]["variance_report_seeds_control_model_sampling"] is False
    assert source["native_cli_observation"]["native_generation_method_explicitly_sets_temperature"] is False
    assert source["lm_eval_surface"]["huggingface_model_supported"] is True
    assert source["lm_eval_surface"]["temperature_zero_explicit"] is True
    assert source["lm_eval_surface"]["mode"] == "SIMPLIFIED_TRANSCRIPT_REPLAY_FLATTENED_QUERY_DECISION_ACCURACY_ONLY"
    assert source["lm_eval_surface"]["dependency_lock_present_in_surface_root"] is False
    assert set(manifest["credential_names_required_absent"]) == EXPECTED_CREDENTIAL_KEYS


def validate_result(result: dict[str, Any]) -> None:
    assert set(result) == {
        "schema", "predecessor", "upstream", "credential_evidence",
        "network_guard_active_during_provider_and_scorer_probe", "native_full_metrics_harness",
        "protocol_implementation_seams", "simplified_lm_eval_surface",
        "deterministic_scorer_control", "environment", "performance", "non_effects",
    }
    assert result["schema"] == "matawaka.statebench-evaluator-availability-results/v0.9"
    assert result["predecessor"] == EXPECTED_PREDECESSOR
    assert result["upstream"] == {
        "repository": "Parslee-ai/statebench",
        "commit": EXPECTED_UPSTREAM,
        "package_version": "2.0.0",
    }

    credentials = result["credential_evidence"]
    assert set(credentials) == EXPECTED_CREDENTIAL_KEYS
    assert not any(credentials.values())
    assert result["network_guard_active_during_provider_and_scorer_probe"] is True

    native = result["native_full_metrics_harness"]
    assert native["status"] == "PINNED_MODEL_PATH_AVAILABILITY_AUDITED"
    assert native["generation_precedes_judging"] is True
    assert native["deterministic_only_judge_bypasses_generation"] is False
    assert native["overall_no_key_status"] == "NOT_READY_WITHOUT_REMOTE_CREDENTIAL_OR_CAR_RUNTIME"
    assert native["model_generation_executed"] is False
    assert set(native["providers"]) == {"openai", "anthropic", "google", "car"}
    for provider in ("openai", "anthropic", "google"):
        item = native["providers"][provider]
        assert item["credential_evidence_present"] is False
        assert isinstance(item["client_constructible_without_observed_credentials"], bool)
        assert item["model_request_attempted"] is False
        assert item["status"] == "NOT_READY_NO_CREDENTIAL_EVIDENCE"
    car = native["providers"]["car"]
    assert car == {
        "credential_evidence_present": False,
        "car_runtime_module_present": False,
        "car_server_daemon_probed": False,
        "model_request_attempted": False,
        "status": "NOT_READY_CAR_RUNTIME_MODULE_ABSENT",
    }

    assert result["protocol_implementation_seams"] == {
        "official_spec_requires_temperature_zero": True,
        "native_generation_explicitly_sets_temperature": False,
        "native_variance_report_seed_controls_model_sampling": False,
        "lm_eval_template_explicit_temperature_zero": True,
    }

    lm = result["simplified_lm_eval_surface"]
    assert lm == {
        "status": "LOCAL_HF_PATH_SOURCE_PRESENT_SIMPLIFIED_UNEXECUTED_UNPINNED_DEPENDENCIES",
        "huggingface_local_model_supported": True,
        "mode": "SIMPLIFIED_TRANSCRIPT_REPLAY_FLATTENED_QUERY_DECISION_ACCURACY_ONLY",
        "temperature_zero": True,
        "do_sample": False,
        "full_sfrr_metrics": False,
        "full_provenance_metrics": False,
        "dependency_requirement": "lm-eval>=0.4.0",
        "dependency_lock_present": False,
        "model_executed": False,
    }

    control = result["deterministic_scorer_control"]
    assert control["status"] == "DETERMINISTIC_SCORER_CORE_EXECUTED_ON_NON_MODEL_CONTROL"
    assert control["judge_descriptor"] == "deterministic-only"
    assert control["control_response"] == "EMPTY_STRING_FOR_EVERY_QUERY"
    assert control["non_model_control"] is True
    assert control["timeline_count"] == 209
    assert control["query_count"] == 251
    assert control["query_result_count"] == 251
    assert set(control["aggregate_mechanical_counts"]) == {
        "decision_correct", "must_mention_hits", "must_mention_misses",
        "must_not_mention_violations", "skipped_phrases", "resurrected_superseded",
    }
    assert all(isinstance(v, int) and v >= 0 for v in control["aggregate_mechanical_counts"].values())
    assert len(control["control_signature_sha256"]) == 64
    int(control["control_signature_sha256"], 16)

    assert result["environment"] == {"python": "3.12.14", "uv": "0.12.10"}
    assert all(value is None for value in result["performance"].values())
    assert result["non_effects"] and not any(result["non_effects"].values())
    assert result["non_effects"]["merge_authorized"] is False


def main() -> int:
    validate_static()
    result_path = HERE / "results.json"
    if result_path.exists():
        result = load("results.json")
        validate_result(result)
        digest = hashlib.sha256(result_path.read_bytes()).hexdigest()
        hash_path = HERE / "results.sha256"
        if hash_path.exists():
            assert hash_path.read_text(encoding="ascii").strip() == digest
        print("PASS: v0.9 static boundary and checked-in availability result are valid")
    else:
        print("PASS: v0.9 static evaluator availability boundary valid; execution result not yet frozen")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
