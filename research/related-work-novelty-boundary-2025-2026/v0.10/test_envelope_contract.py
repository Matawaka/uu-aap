#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import tempfile
from pathlib import Path

from validate_envelope import DEFAULT_PROJECT, DEFAULT_PROTOCOL, validate


def expect_failure(protocol: dict, project_text: str, label: str) -> None:
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        protocol_path = root / "protocol.json"
        project_path = root / "pyproject.toml"
        protocol_path.write_text(json.dumps(protocol, indent=2) + "\n", encoding="utf-8")
        project_path.write_text(project_text, encoding="utf-8")
        try:
            validate(protocol_path, project_path)
        except (AssertionError, KeyError, ValueError):
            return
        raise AssertionError(f"hostile mutation was accepted: {label}")


def main() -> int:
    base_protocol = json.loads(DEFAULT_PROTOCOL.read_text(encoding="utf-8"))
    base_project = DEFAULT_PROJECT.read_text(encoding="utf-8")
    validate(DEFAULT_PROTOCOL, DEFAULT_PROJECT)

    mutations: list[tuple[dict, str, str]] = []

    p = copy.deepcopy(base_protocol); p["predecessor"] = "0" * 40
    mutations.append((p, base_project, "predecessor rewrite"))
    p = copy.deepcopy(base_protocol); p["selected_sources"]["statebench_commit"] = "main"
    mutations.append((p, base_project, "floating StateBench ref"))
    p = copy.deepcopy(base_protocol); p["selected_sources"]["lm_eval_version"] = "latest"
    mutations.append((p, base_project, "floating lm-eval version"))
    p = copy.deepcopy(base_protocol); p["selected_sources"]["lm_eval_requirement"] = "lm-eval[hf]>=0.4.0"
    mutations.append((p, base_project, "loose lm-eval protocol requirement"))
    p = copy.deepcopy(base_protocol); p["known_seams"]["datasets_version_conflict_established"] = True
    mutations.append((p, base_project, "unproven datasets conflict promotion"))
    p = copy.deepcopy(base_protocol); p["known_seams"]["ordinary_statebench_lm_eval_task_dataset_path_is_hub"] = "local/test.jsonl"
    mutations.append((p, base_project, "silent exact-data substitution"))
    p = copy.deepcopy(base_protocol); p["requirements"]["freeze_lock_before_model_execution"] = False
    mutations.append((p, base_project, "model-before-lock permission"))
    p = copy.deepcopy(base_protocol); p["requirements"]["no_dataset_download"] = False
    mutations.append((p, base_project, "dataset download permission"))
    p = copy.deepcopy(base_protocol); p["requirements"]["no_huggingface_model_download"] = False
    mutations.append((p, base_project, "model download permission"))
    p = copy.deepcopy(base_protocol); p["performance"]["decision_accuracy"] = 0.5
    mutations.append((p, base_project, "performance population"))
    p = copy.deepcopy(base_protocol); p["non_effects"]["model_executed"] = True
    mutations.append((p, base_project, "model execution claim"))
    p = copy.deepcopy(base_protocol); p["non_effects"]["official_statebench_benchmark_executed"] = True
    mutations.append((p, base_project, "official benchmark claim"))
    p = copy.deepcopy(base_protocol); p["non_effects"]["merge_authorized"] = True
    mutations.append((p, base_project, "merge authority escalation"))
    p = copy.deepcopy(base_protocol); p["non_effects"]["world_first"] = True
    mutations.append((p, base_project, "world-first promotion"))

    project = base_project.replace("lm-eval[hf]==0.4.13", "lm-eval[hf]>=0.4.0")
    mutations.append((copy.deepcopy(base_protocol), project, "unbounded lm-eval dependency"))
    project = base_project.replace("1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7", "main", 1)
    mutations.append((copy.deepcopy(base_protocol), project, "floating StateBench root dependency"))
    project = base_project.replace("#subdirectory=statebench-lm-eval", "")
    mutations.append((copy.deepcopy(base_protocol), project, "plugin subdirectory removal"))
    project = base_project.replace("package = false", "package = true")
    mutations.append((copy.deepcopy(base_protocol), project, "resolver project made installable"))

    for protocol, project_text, label in mutations:
        expect_failure(protocol, project_text, label)

    print(f"STATEBENCH_LM_EVAL_ENVELOPE_V0.10_HOSTILE_GREEN {len(mutations)}/{len(mutations)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
