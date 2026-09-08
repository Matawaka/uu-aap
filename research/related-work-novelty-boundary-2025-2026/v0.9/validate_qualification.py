#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from validate_implementation import main as validate_implementation

HERE = Path(__file__).resolve().parent


def load(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def main() -> int:
    validate_implementation()
    q = load("qualification-receipt.json")
    implementation = load("implementation-receipt.json")
    result = load("results.json")

    assert q["schema"] == "matawaka.statebench-evaluator-availability-qualification-receipt/v0.9"
    assert q["issue"] == 974 and q["pull_request"] == 975
    assert q["predecessor"] == "46a70e83f56c33f07a1c5d43fbe1ec49fb2465b3"
    assert q["qualified_head"] == implementation["first_independent_green_head"] == "5477c8e92d11826952cad4b62b74b2d317058051"
    assert q["workflow_run_id"] == implementation["workflow_run_id"] == 34186691734
    assert q["workflow_job_id"] == implementation["workflow_job_id"] == 101936364032
    assert q["workflow_name"] == implementation["workflow_name"] == "StateBench Evaluator Availability v0.9"

    qualification = q["qualification"]
    assert qualification["job_conclusion"] == "success"
    assert qualification["baseline_hostile_checks"] == "25/25"
    for key, value in qualification.items():
        if key not in {"job_conclusion", "baseline_hostile_checks"}:
            assert value is True, key

    r = q["result"]
    assert r["native_status"] == result["native_full_metrics_harness"]["status"] == "PINNED_MODEL_PATH_AVAILABILITY_AUDITED"
    assert r["native_no_key_status"] == result["native_full_metrics_harness"]["overall_no_key_status"] == "NOT_READY_WITHOUT_REMOTE_CREDENTIAL_OR_CAR_RUNTIME"
    assert r["native_model_generation_executed"] is False
    assert r["deterministic_scorer_status"] == result["deterministic_scorer_control"]["status"]
    assert r["timeline_count"] == result["deterministic_scorer_control"]["timeline_count"] == 209
    assert r["query_count"] == result["deterministic_scorer_control"]["query_count"] == 251
    assert r["control_signature_sha256"] == result["deterministic_scorer_control"]["control_signature_sha256"] == "b090bfc426a02de6330789cd41c36dc51d2601414346077016e50e1bea62b58b"
    assert r["deterministic_result_sha256"] == implementation["execution"]["deterministic_result_sha256"] == "73f1acb0861dea212416cf757d2de92e867a362c7d10f3eeb0e49562a430e737"
    assert r["lm_eval_status"] == result["simplified_lm_eval_surface"]["status"]
    assert r["python"] == result["environment"]["python"] == "3.12.14"
    assert r["uv"] == result["environment"]["uv"] == "0.12.10"
    for key in ("statebench_model_score", "matawaka_model_score", "held_out_detection_recall", "benign_false_positive_rate", "decision_accuracy", "sfrr"):
        assert r[key] is None

    assert q["non_effects"] == result["non_effects"]
    assert q["non_effects"] and not any(q["non_effects"].values())
    assert q["non_effects"]["merge_authorized"] is False

    print("PASS: first independent v0.9 qualification remains frozen, no-key-audited, scorer-control-executed, and non-promoting")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
