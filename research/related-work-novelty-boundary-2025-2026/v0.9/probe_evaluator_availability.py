#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import importlib.util
import inspect
import json
import os
import socket
import subprocess
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
MANIFEST = json.loads((HERE / "source-manifest.json").read_text(encoding="utf-8"))


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def git(source: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(source), *args], text=True).strip()


def verify_source(source: Path) -> None:
    expected = MANIFEST["source"]["git_objects"]
    observed = {
        "commit": git(source, "rev-parse", "HEAD"),
        "evaluation_tree": git(source, "rev-parse", "HEAD:src/statebench/evaluation"),
        "judge_blob": git(source, "rev-parse", "HEAD:src/statebench/evaluation/judge.py"),
        "harness_blob": git(source, "rev-parse", "HEAD:src/statebench/runner/harness.py"),
        "car_provider_blob": git(source, "rev-parse", "HEAD:src/statebench/runner/car_provider.py"),
        "completion_blob": git(source, "rev-parse", "HEAD:src/statebench/runner/completion.py"),
        "cli_blob": git(source, "rev-parse", "HEAD:src/statebench/cli.py"),
        "evaluation_spec_blob": git(source, "rev-parse", "HEAD:docs/EVALUATION.md"),
        "test_payload_blob": git(source, "rev-parse", "HEAD:data/releases/v1.0/test.jsonl"),
        "uv_lock_blob": git(source, "rev-parse", "HEAD:uv.lock"),
        "lm_eval_tree": git(source, "rev-parse", "HEAD:statebench-lm-eval/lm_eval"),
        "lm_eval_task_tree": git(source, "rev-parse", "HEAD:statebench-lm-eval/lm_eval/tasks/statebench"),
        "lm_eval_readme_blob": git(source, "rev-parse", "HEAD:statebench-lm-eval/README.md"),
        "lm_eval_pyproject_blob": git(source, "rev-parse", "HEAD:statebench-lm-eval/pyproject.toml"),
        "lm_eval_template_blob": git(source, "rev-parse", "HEAD:statebench-lm-eval/lm_eval/tasks/statebench/_default_template.yaml"),
    }
    assert observed.pop("commit") == MANIFEST["source"]["commit"]
    assert observed == expected, (observed, expected)


def activate_network_guard() -> None:
    def forbidden(*_args: Any, **_kwargs: Any) -> Any:
        raise RuntimeError("network access forbidden inside v0.9 evaluator availability probe")

    socket.create_connection = forbidden  # type: ignore[assignment]
    socket.socket.connect = forbidden  # type: ignore[assignment]
    socket.socket.connect_ex = forbidden  # type: ignore[assignment]


def constructor_probe(provider: str) -> bool:
    from statebench.runner.harness import EvaluationHarness

    harness = EvaluationHarness(provider=provider, use_llm_judge=False)
    try:
        harness._get_client()
        return True
    except Exception:
        return False


def deterministic_control(source: Path) -> dict[str, Any]:
    from statebench.evaluation.judge import ResponseJudge
    from statebench.runner.harness import load_timelines
    from statebench.schema.timeline import Query

    judge = ResponseJudge(use_llm_judge=False)

    def forbidden_llm(*_args: Any, **_kwargs: Any) -> Any:
        raise AssertionError("LLM judge completion attempted in deterministic-only control")

    judge._complete = forbidden_llm  # type: ignore[method-assign]

    signatures: list[dict[str, Any]] = []
    totals = {
        "decision_correct": 0,
        "must_mention_hits": 0,
        "must_mention_misses": 0,
        "must_not_mention_violations": 0,
        "skipped_phrases": 0,
        "resurrected_superseded": 0,
    }
    timeline_count = 0
    query_count = 0

    for timeline in load_timelines(source / "data/releases/v1.0/test.jsonl"):
        timeline_count += 1
        qidx = 0
        for event in timeline.events:
            if not isinstance(event, Query):
                continue
            result = judge.judge(
                response="",
                ground_truth=event.ground_truth,
                timeline_id=timeline.id,
                query_idx=qidx,
                track=timeline.track,
                domain=timeline.domain,
            )
            signature = {
                "timeline_id": result.timeline_id,
                "query_idx": result.query_idx,
                "track": result.track,
                "domain": result.domain,
                "expected_decision": result.expected_decision,
                "actual_decision": result.actual_decision,
                "decision_correct": result.decision_correct,
                "must_mention_hits": len(result.must_mention_hits),
                "must_mention_misses": len(result.must_mention_misses),
                "must_not_mention_violations": len(result.must_not_mention_violations),
                "skipped_phrases": len(result.skipped_phrases),
                "resurrected_superseded": result.resurrected_superseded,
            }
            signatures.append(signature)
            totals["decision_correct"] += int(bool(result.decision_correct))
            totals["must_mention_hits"] += len(result.must_mention_hits)
            totals["must_mention_misses"] += len(result.must_mention_misses)
            totals["must_not_mention_violations"] += len(result.must_not_mention_violations)
            totals["skipped_phrases"] += len(result.skipped_phrases)
            totals["resurrected_superseded"] += int(bool(result.resurrected_superseded))
            query_count += 1
            qidx += 1

    assert timeline_count == 209
    assert query_count == 251
    digest = hashlib.sha256(canonical_bytes(signatures)).hexdigest()
    return {
        "status": "DETERMINISTIC_SCORER_CORE_EXECUTED_ON_NON_MODEL_CONTROL",
        "judge_descriptor": judge.descriptor,
        "control_response": "EMPTY_STRING_FOR_EVERY_QUERY",
        "non_model_control": True,
        "timeline_count": timeline_count,
        "query_count": query_count,
        "query_result_count": len(signatures),
        "aggregate_mechanical_counts": totals,
        "control_signature_sha256": digest,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--hash-output", type=Path)
    args = parser.parse_args()

    verify_source(args.source_dir)

    credentials = {name: bool(os.environ.get(name)) for name in MANIFEST["credential_names_required_absent"]}
    if any(credentials.values()):
        raise RuntimeError(f"credential evidence unexpectedly present: {credentials}")

    # All dependency/source fetching is complete before this point. Any subsequent
    # socket connection is a probe violation, including an accidental model request.
    activate_network_guard()

    from statebench.runner.harness import EvaluationHarness

    run_timeline_source = inspect.getsource(EvaluationHarness.run_timeline)
    generate_source = inspect.getsource(EvaluationHarness._generate_response)
    generate_index = run_timeline_source.find("self._generate_response")
    judge_index = run_timeline_source.find("self.judge.judge")
    if not (generate_index >= 0 and judge_index > generate_index):
        raise AssertionError("pinned native harness no longer proves generation-before-judging ordering")

    cli_text = (args.source_dir / "src/statebench/cli.py").read_text(encoding="utf-8")
    spec_text = (args.source_dir / "docs/EVALUATION.md").read_text(encoding="utf-8")
    lm_readme = (args.source_dir / "statebench-lm-eval/README.md").read_text(encoding="utf-8")
    lm_template = (args.source_dir / "statebench-lm-eval/lm_eval/tasks/statebench/_default_template.yaml").read_text(encoding="utf-8")
    lm_pyproject = (args.source_dir / "statebench-lm-eval/pyproject.toml").read_text(encoding="utf-8")

    assert "Set `temperature=0`" in spec_text
    assert "seeds affect dataset generation, not model sampling" in cli_text
    assert "temperature" not in generate_source
    assert "--model hf" in lm_readme
    assert "simplified mode" in lm_readme
    assert "Only decision accuracy is measured" in lm_readme
    assert "temperature: 0" in lm_template
    assert "do_sample: false" in lm_template
    assert '"lm-eval>=0.4.0"' in lm_pyproject
    assert not (args.source_dir / "statebench-lm-eval/uv.lock").exists()

    native_provider_results: dict[str, Any] = {}
    for provider in ("openai", "anthropic", "google"):
        native_provider_results[provider] = {
            "credential_evidence_present": False,
            "client_constructible_without_observed_credentials": constructor_probe(provider),
            "model_request_attempted": False,
            "status": "NOT_READY_NO_CREDENTIAL_EVIDENCE",
        }

    car_runtime_present = importlib.util.find_spec("car_runtime") is not None
    if car_runtime_present:
        raise RuntimeError("unexpected car_runtime module present in frozen upstream environment; qualification requires a new bounded audit")
    native_provider_results["car"] = {
        "credential_evidence_present": False,
        "car_runtime_module_present": False,
        "car_server_daemon_probed": False,
        "model_request_attempted": False,
        "status": "NOT_READY_CAR_RUNTIME_MODULE_ABSENT",
    }

    control = deterministic_control(args.source_dir)
    package_version = importlib.metadata.version("statebench")
    assert package_version == "2.0.0"
    assert sys.version.split()[0] == "3.12.14"

    result = {
        "schema": "matawaka.statebench-evaluator-availability-results/v0.9",
        "predecessor": MANIFEST["frozen_predecessor"]["commit"],
        "upstream": {
            "repository": MANIFEST["source"]["repository"],
            "commit": MANIFEST["source"]["commit"],
            "package_version": package_version,
        },
        "credential_evidence": credentials,
        "network_guard_active_during_provider_and_scorer_probe": True,
        "native_full_metrics_harness": {
            "status": "PINNED_MODEL_PATH_AVAILABILITY_AUDITED",
            "generation_precedes_judging": True,
            "deterministic_only_judge_bypasses_generation": False,
            "providers": native_provider_results,
            "overall_no_key_status": "NOT_READY_WITHOUT_REMOTE_CREDENTIAL_OR_CAR_RUNTIME",
            "model_generation_executed": False,
        },
        "protocol_implementation_seams": {
            "official_spec_requires_temperature_zero": True,
            "native_generation_explicitly_sets_temperature": False,
            "native_variance_report_seed_controls_model_sampling": False,
            "lm_eval_template_explicit_temperature_zero": True,
        },
        "simplified_lm_eval_surface": {
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
        },
        "deterministic_scorer_control": control,
        "environment": {
            "python": sys.version.split()[0],
            "uv": "0.12.10",
        },
        "performance": {
            "statebench_model_score": None,
            "matawaka_model_score": None,
            "held_out_detection_recall": None,
            "benign_false_positive_rate": None,
            "decision_accuracy": None,
            "sfrr": None,
        },
        "non_effects": {
            "native_statebench_model_harness_executed": False,
            "statebench_lm_eval_model_executed": False,
            "paid_external_model_called": False,
            "user_credentials_used": False,
            "official_statebench_benchmark_executed": False,
            "detection_advantage_established": False,
            "detection_non_advantage_established": False,
            "novelty_established": False,
            "world_first": False,
            "production_ready": False,
            "release_authorized": False,
            "standards_authorized": False,
            "merge_authorized": False,
        },
    }

    encoded = canonical_bytes(result)
    digest = hashlib.sha256(encoded).hexdigest()
    if args.output:
        args.output.write_bytes(encoded)
    else:
        sys.stdout.buffer.write(encoded)
    if args.hash_output:
        args.hash_output.write_text(digest + "\n", encoding="ascii")
    print(f"RESULT_SHA256={digest}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
