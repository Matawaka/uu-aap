#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
P = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
M = json.loads((HERE / "source-manifest.json").read_text(encoding="utf-8"))


def accepted(protocol: dict, manifest: dict) -> bool:
    try:
        assert protocol["predecessor"] == "46a70e83f56c33f07a1c5d43fbe1ec49fb2465b3"
        assert protocol["predecessor_v08_tree"] == "8bd96e94cdc71be82a97bd550686478e9a4b2d5b"
        r = protocol["requirements"]
        assert r["no_external_model_request"] is True
        assert r["all_model_and_cloud_credentials_absent"] is True
        assert r["audit_all_native_generation_providers"] is True
        assert r["prove_generation_precedes_native_judging"] is True
        assert r["execute_deterministic_judge_on_exact_test_split_non_model_control"] is True
        assert r["control_response"] == "EMPTY_STRING_FOR_EVERY_QUERY"
        assert r["control_query_count"] == 251 and r["control_timeline_count"] == 209
        assert r["no_official_benchmark_claim"] is True
        assert all(v is None for v in protocol["performance_fields"].values())
        assert not any(protocol["non_effects"].values())

        assert manifest["frozen_predecessor"] == {
            "commit": protocol["predecessor"], "v08_tree": protocol["predecessor_v08_tree"]
        }
        source = manifest["source"]
        assert source["commit"] == "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
        assert source["native_harness"]["generation_providers"] == ["openai", "anthropic", "google", "car"]
        assert source["native_harness"]["generation_is_mandatory_before_judging"] is True
        assert source["native_harness"]["deterministic_only_judge_bypasses_generation"] is False
        assert source["official_evaluation_spec"]["temperature_zero"] is True
        assert source["official_evaluation_spec"]["multi_seed_count"] == 3
        assert source["native_cli_observation"]["variance_report_seeds_control_model_sampling"] is False
        assert source["native_cli_observation"]["native_generation_method_explicitly_sets_temperature"] is False
        lm = source["lm_eval_surface"]
        assert lm["huggingface_model_supported"] is True
        assert lm["temperature_zero_explicit"] is True and lm["do_sample"] is False
        assert lm["mode"] == "SIMPLIFIED_TRANSCRIPT_REPLAY_FLATTENED_QUERY_DECISION_ACCURACY_ONLY"
        assert lm["full_sfrr_metrics"] is False and lm["full_provenance_metrics"] is False
        assert lm["dependency_requirement"] == "lm-eval>=0.4.0"
        assert lm["dependency_lock_present_in_surface_root"] is False
        return True
    except (AssertionError, KeyError, TypeError):
        return False


def mutate(root: dict, path: list[str], value: object) -> dict:
    out = copy.deepcopy(root)
    cur = out
    for key in path[:-1]:
        cur = cur[key]
    cur[path[-1]] = value
    return out


def main() -> int:
    checks = 0
    assert accepted(P, M); checks += 1

    protocol_cases = [
        (["predecessor"], "0" * 40),
        (["predecessor_v08_tree"], "0" * 40),
        (["requirements", "no_external_model_request"], False),
        (["requirements", "all_model_and_cloud_credentials_absent"], False),
        (["requirements", "audit_all_native_generation_providers"], False),
        (["requirements", "prove_generation_precedes_native_judging"], False),
        (["requirements", "control_response"], "ORACLE_ANSWERS"),
        (["requirements", "control_query_count"], 250),
        (["requirements", "control_timeline_count"], 208),
        (["requirements", "no_official_benchmark_claim"], False),
        (["performance_fields", "statebench_model_score"], 1.0),
        (["performance_fields", "decision_accuracy"], 0.5),
        (["non_effects", "paid_external_model_called"], True),
        (["non_effects", "official_statebench_benchmark_executed"], True),
        (["non_effects", "detection_advantage_established"], True),
        (["non_effects", "merge_authorized"], True),
    ]
    for path, value in protocol_cases:
        assert not accepted(mutate(P, path, value), M); checks += 1

    manifest_cases = [
        (["source", "commit"], "0" * 40),
        (["source", "native_harness", "generation_providers"], ["openai", "anthropic", "google"]),
        (["source", "native_harness", "deterministic_only_judge_bypasses_generation"], True),
        (["source", "official_evaluation_spec", "multi_seed_count"], 1),
        (["source", "native_cli_observation", "variance_report_seeds_control_model_sampling"], True),
        (["source", "lm_eval_surface", "mode"], "FULL_NATIVE_BENCHMARK"),
        (["source", "lm_eval_surface", "full_sfrr_metrics"], True),
        (["source", "lm_eval_surface", "dependency_lock_present_in_surface_root"], True),
    ]
    for path, value in manifest_cases:
        assert not accepted(P, mutate(M, path, value)); checks += 1

    assert checks == 25
    print("PASS: 25/25 baseline+hostile v0.9 evaluator-availability checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
