#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from validate_availability import validate_result, validate_static

HERE = Path(__file__).resolve().parent
RESULT_SHA256 = "73f1acb0861dea212416cf757d2de92e867a362c7d10f3eeb0e49562a430e737"
CONTROL_SHA256 = "b090bfc426a02de6330789cd41c36dc51d2601414346077016e50e1bea62b58b"
FIRST_GREEN_HEAD = "5477c8e92d11826952cad4b62b74b2d317058051"
RUN_ID = 34186691734
JOB_ID = 101936364032


def load(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def main() -> int:
    validate_static()
    result = load("results.json")
    validate_result(result)
    assert hashlib.sha256((HERE / "results.json").read_bytes()).hexdigest() == RESULT_SHA256
    assert (HERE / "results.sha256").read_text(encoding="ascii").strip() == RESULT_SHA256

    receipt = load("implementation-receipt.json")
    assert receipt["schema"] == "matawaka.statebench-evaluator-availability-implementation-receipt/v0.9"
    assert receipt["issue"] == 974 and receipt["pull_request"] == 975
    assert receipt["predecessor"] == "46a70e83f56c33f07a1c5d43fbe1ec49fb2465b3"
    assert receipt["predecessor_v08_tree"] == "8bd96e94cdc71be82a97bd550686478e9a4b2d5b"
    assert receipt["first_independent_green_head"] == FIRST_GREEN_HEAD
    assert receipt["workflow_run_id"] == RUN_ID and receipt["workflow_job_id"] == JOB_ID
    assert receipt["workflow_name"] == "StateBench Evaluator Availability v0.9"
    assert receipt["upstream"] == result["upstream"]

    execution = receipt["execution"]
    native = result["native_full_metrics_harness"]
    control = result["deterministic_scorer_control"]
    assert execution["status"] == native["status"] == "PINNED_MODEL_PATH_AVAILABILITY_AUDITED"
    assert execution["native_overall_no_key_status"] == native["overall_no_key_status"] == "NOT_READY_WITHOUT_REMOTE_CREDENTIAL_OR_CAR_RUNTIME"
    assert execution["native_model_generation_executed"] is native["model_generation_executed"] is False
    assert execution["provider_statuses"] == {
        key: value["status"] for key, value in native["providers"].items()
    }
    assert execution["provider_client_constructibility_without_observed_credentials"] == {
        "openai": False, "anthropic": True, "google": False
    }
    assert native["providers"]["openai"]["client_constructible_without_observed_credentials"] is False
    assert native["providers"]["anthropic"]["client_constructible_without_observed_credentials"] is True
    assert native["providers"]["google"]["client_constructible_without_observed_credentials"] is False
    assert execution["car_runtime_module_present"] is native["providers"]["car"]["car_runtime_module_present"] is False
    assert execution["network_guard_active"] is result["network_guard_active_during_provider_and_scorer_probe"] is True
    assert execution["deterministic_scorer_status"] == control["status"]
    assert execution["control_response"] == control["control_response"] == "EMPTY_STRING_FOR_EVERY_QUERY"
    assert execution["timeline_count"] == control["timeline_count"] == 209
    assert execution["query_count"] == control["query_count"] == 251
    assert execution["control_signature_sha256"] == control["control_signature_sha256"] == CONTROL_SHA256
    assert execution["deterministic_result_sha256"] == RESULT_SHA256
    assert execution["environment"] == result["environment"] == {"python": "3.12.14", "uv": "0.12.10"}

    lm = receipt["lm_eval_surface"]
    result_lm = result["simplified_lm_eval_surface"]
    assert lm["status"] == result_lm["status"] == "LOCAL_HF_PATH_SOURCE_PRESENT_SIMPLIFIED_UNEXECUTED_UNPINNED_DEPENDENCIES"
    assert lm["huggingface_local_model_supported"] is result_lm["huggingface_local_model_supported"] is True
    assert lm["model_executed"] is result_lm["model_executed"] is False
    assert lm["dependency_lock_present"] is result_lm["dependency_lock_present"] is False
    assert lm["full_sfrr_metrics"] is result_lm["full_sfrr_metrics"] is False
    assert lm["full_provenance_metrics"] is result_lm["full_provenance_metrics"] is False

    q = receipt["qualification_evidence"]
    assert q["job_conclusion"] == "success"
    assert q["baseline_hostile_checks"] == "25/25"
    for key, value in q.items():
        if key not in {"job_conclusion", "baseline_hostile_checks"}:
            assert value is True, key

    assert receipt["performance"] == result["performance"]
    assert all(v is None for v in receipt["performance"].values())
    assert receipt["non_effects"] == result["non_effects"]
    assert receipt["non_effects"] and not any(receipt["non_effects"].values())
    assert receipt["non_effects"]["merge_authorized"] is False

    print("PASS: v0.9 implementation receipt matches exact first no-key evaluator availability run and preserves all non-effects")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
