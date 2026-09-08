"""Model-free Task compatibility audit; qualified NONPASS is not Task PASS."""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import fields
import hashlib
import importlib.metadata as metadata
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import socket
import subprocess
import sys
import traceback
import unittest
from typing import Any

BASE = "98f13086f8e2d75fc6692ff68e21700bdffa37a5"
TREE = "82548649f877fb6ba1d405aec239f2a88c3a5997"
ROOT = "research/related-work-novelty-boundary-2025-2026"
WF = ".github/workflows/statebench-task-compatibility-v0.13.yml"
LM_COMMIT = "ddd67220430a2470529f25fd5c05a576ca1057a0"
RESULT12 = "677c354a5edf1052e1a616da65f84ca04d0df6e1eba60821e4080236250ceac3"
DOCS12 = "30b756a7eb85db5ceeae843f178c34bff3fa1690c73635160d25ed73cabd78f0"
GATE12 = "f6ac50eec00710fe955fe5ce168e31522c30006c"
LM_BLOBS = {
    "api/task.py": "9255170de444bae6edd53797e3477031cd5d5da5",
    "config/task.py": "c3a3b712be912789370d18f2abc89d7439dcf1a7",
    "tasks/manager.py": "1e4d5b631f46a83367e7a834c1530d93ef923fe6",
    "tasks/_factory.py": "a43b2d48d6f5c656b7cd4c0e16caec67db17c63c",
    "tasks/_yaml_loader.py": "9e608eb4cdf07927825b66aea5df884c9a742247",
}
TASK_DIR = "statebench-lm-eval/lm_eval/tasks/statebench"
TASK_BLOBS = {
    "utils.py": "d868c2138084cf08a842bdddfc204d556d46ed92",
    "statebench.yaml": "361bb6187e9d2a3dab708a4040a29024f0ccfa33",
    "_default_template.yaml": "63316e2a338534b2758fec290c79b2f6d5993a17",
}
NON_EFFECTS = {key: False for key in (
    "model_downloaded", "model_instantiated", "language_model_executed",
    "provider_api_called", "user_credentials_used", "hub_dataset_loaded",
    "scoring_or_judge_called", "evaluation_or_generation_dispatched",
    "full_upstream_task_compatibility_established", "model_performance_established",
    "detection_advantage_established", "detection_non_advantage_established",
    "novelty_established", "production_ready", "release_authorized",
    "standards_authorized", "merge_authorized",
)}


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise ValueError(reason)


def encode(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


def bound(path: Path, expected: str) -> bytes:
    require(path.is_file() and not path.is_symlink(), "REGULAR_FILE_REQUIRED:" + path.name)
    data = path.read_bytes()
    require(sha(data) == expected, "SHA256_MISMATCH:" + path.name)
    return data


def module_from_file(path: Path, name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, "MODULE_SPEC_MISSING")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def boundary(repo: Path) -> None:
    require(git(repo, "rev-parse", f"{BASE}:{ROOT}/v0.12") == TREE, "PREDECESSOR_TREE_MISMATCH")
    require(git(repo, "rev-parse", f"HEAD:{ROOT}/v0.12") == TREE, "FROZEN_V012_CHANGED")
    git(repo, "merge-base", "--is-ancestor", BASE, "HEAD")
    for line in git(repo, "diff", "--name-status", BASE, "HEAD").splitlines():
        status, path = line.split("\t", 1)
        require(status == "A" and (path.startswith(ROOT + "/v0.13/") or path == WF), "PROTECTED_OR_NON_ADDITIVE_DIFF:" + path)


def qualified_observation(result: dict) -> None:
    require(result["audit_execution"] == "COMPLETED", "AUDIT_NOT_COMPLETED")
    require(result["compatibility"] == "NONPASS", "NONPASS_HISTORY_PROMOTION")
    require(result["non_effects"] == NON_EFFECTS and all(x is False for x in result["non_effects"].values()), "NON_EFFECT_PROMOTION")
    require(result["raw_yaml"]["admission"] == "REJECTED_TASK_CONFIG", "RAW_YAML_RESULT_CHANGED")
    require(result["container_probe"]["admission"] == "REJECTED_LIST_WITHOUT_FEATURES", "CONTAINER_RESULT_CHANGED")
    require(result["container_probe"]["processed_documents_sha256"] == DOCS12, "PROCESSED_DOCUMENTS_CHANGED")
    control = result["diagnostic_control"]
    require(control["upstream_unmodified_task"] is False, "CONTROL_PROMOTED_TO_UPSTREAM")
    require(control["task_constructed"] is True and type(control["documents"]) is int and control["documents"] == 251, "CONTROL_COUNT_OR_STATUS_CHANGED")
    require(control["all_prompt_target_pairs_equal"] is True, "CONTROL_FORMATTING_FAILED")
    require(result["forbidden_effect_attempts"] == [], "FORBIDDEN_EFFECT_ATTEMPT")


def error_record(exc: Exception, lm_root: Path, upstream: Path) -> dict:
    frames = []
    for frame in traceback.extract_tb(exc.__traceback__):
        path = Path(frame.filename)
        if path.is_relative_to(lm_root):
            name = "lm_eval/" + path.relative_to(lm_root).as_posix()
        elif path.is_relative_to(upstream):
            name = "statebench/" + path.relative_to(upstream).as_posix()
        else:
            continue
        frames.append({"file": name, "function": frame.name, "line": frame.lineno, "source": frame.line})
    message = str(exc).replace(str(lm_root), "<lm_eval>").replace(str(upstream), "<statebench>")
    return {"type": type(exc).__name__, "message": message, "upstream_frames": frames}


def reference_prompt(doc: dict) -> str:
    return ("Here is the conversation history and relevant context:\n\n" + doc["context"]
            + "\n\n---\n\nBased on the above context, please answer the following question:\n\n"
            + doc["query"] + "\n\nAnswer:")


class ForbiddenEffect(RuntimeError):
    pass


def run(repo: Path, predecessor: Path, upstream: Path, evidence12: Path, cache: Path, output: Path) -> None:
    result = {"schema": "matawaka.statebench-task-compatibility-results/v0.13", "predecessor": BASE,
              "audit_execution": "INCONCLUSIVE", "compatibility": "NOT_ESTABLISHED", "non_effects": NON_EFFECTS.copy()}
    output.mkdir(parents=True, exist_ok=False)
    attempts: list[str] = []
    trace: list[dict] = []
    stage = "preflight"
    error = None
    try:
        boundary(repo)
        require(git(predecessor, "rev-parse", "HEAD") == BASE, "FROZEN_WORKTREE_REQUIRED")
        gate12_path = predecessor / ROOT / "v0.12/gate.py"
        require(blob(gate12_path.read_bytes()) == GATE12, "PREDECESSOR_PROCESSING_CODE_CHANGED")
        g12 = module_from_file(gate12_path, "frozen_statebench_v012")
        require(platform.python_version() == "3.12.14", "EXACT_PYTHON_REQUIRED")
        require(not any(os.environ.get(k) for k in g12.CREDENTIALS), "CREDENTIAL_PRESENT")
        require(all(os.environ.get(k) == v for k, v in g12.OFFLINE.items()), "OFFLINE_FLAGS_REQUIRED")
        require(os.geteuid() != 0, "NON_ROOT_RUNTIME_REQUIRED")
        parent_ns = os.environ.get("MATAWAKA_PARENT_NETNS")
        require(parent_ns is not None and parent_ns != os.readlink("/proc/self/ns/net"), "FRESH_NETWORK_NAMESPACE_REQUIRED")
        interfaces = sorted(line.split(":", 1)[0].strip() for line in Path("/proc/net/dev").read_text().splitlines() if ":" in line)
        require(interfaces == ["lo"], "UNEXPECTED_NETWORK_INTERFACE")
        versions = {name: metadata.version(name) for name in g12.VERSIONS}
        require(versions == g12.VERSIONS, "FROZEN_DISTRIBUTION_VERSION_MISMATCH")
        g12.validate_lock(predecessor)
        bound(evidence12 / "results.json", RESULT12)
        docs = json.loads(bound(evidence12 / "documents.json", DOCS12))
        require(len(docs) == 251, "EXACT_DOCUMENT_COUNT_REQUIRED")
        bpe = g12.check_bpe(cache)
        os.environ["TIKTOKEN_CACHE_DIR"] = str(cache)
        require(git(upstream, "rev-parse", "HEAD") == g12.UPSTREAM, "UPSTREAM_COMMIT_CHANGED")
        g12.verify_bytes((upstream / g12.DATA_PATH).read_bytes(), g12.DATA_SHA, g12.DATA_BLOB, 638933)
        task_dir = upstream / TASK_DIR
        for name, expected in TASK_BLOBS.items():
            require(blob((task_dir / name).read_bytes()) == expected, "UPSTREAM_TASK_SOURCE_CHANGED:" + name)
        lm_spec = importlib.util.find_spec("lm_eval")
        require(lm_spec is not None and lm_spec.origin is not None, "LM_EVAL_SOURCE_NOT_FOUND")
        lm_root = Path(lm_spec.origin).parent
        for name, expected in LM_BLOBS.items():
            require(blob((lm_root / name).read_bytes()) == expected, "INSTALLED_LM_EVAL_SOURCE_DIFFERS_FROM_PIN:" + name)
        result["environment"] = {"python": platform.python_version(), "versions": versions}
        result["inputs"] = {"lm_eval_commit": LM_COMMIT, "lm_eval_source_blobs": LM_BLOBS,
                            "statebench_commit": g12.UPSTREAM, "task_source_blobs": TASK_BLOBS,
                            "v012_result_sha256": RESULT12, "documents_sha256": DOCS12,
                            "dataset_sha256": g12.DATA_SHA, "lock_sha256": g12.LOCK_SHA,
                            "tokenizer_sha256": sha(bpe)}
        g12.deny_network()
        stage = "imports"
        from datasets import Dataset, DatasetDict
        from lm_eval.tasks import TaskManager
        from lm_eval.config.task import TaskConfig
        from lm_eval.tasks._yaml_loader import load_yaml
        from statebench.huggingface import load_split_as_rows
        plugin = module_from_file(task_dir / "utils.py", "exact_statebench_v013_plugin")
        probe = "preflight"
        returns: list[dict] = []
        calls: Counter = Counter()
        plugin_file = str((task_dir / "utils.py").resolve())

        def profile(frame, event, arg):
            mod = frame.f_globals.get("__name__", "")
            name = frame.f_code.co_name
            if event == "call":
                forbidden = (
                    (mod == "datasets.load" and name == "load_dataset")
                    or (mod.startswith("lm_eval.evaluator") and name in {"evaluate", "simple_evaluate"})
                    or (mod.startswith("statebench.evaluation") and name in {"create_judge", "judge", "extract_decision", "decisions_match"})
                    or (frame.f_code.co_filename == plugin_file and name in {"get_judge", "decision_accuracy"})
                    or (mod.startswith("lm_eval.models") and name in {"__init__", "generate_until", "loglikelihood"})
                    or (mod.startswith("transformers") and name == "from_pretrained")
                    or (mod.startswith("statebench.runner") and name in {"run_evaluation", "evaluate", "_generate_response", "_get_client"})
                )
                if forbidden:
                    attempts.append(mod + "." + name)
                    raise ForbiddenEffect("FORBIDDEN_EFFECT:" + mod + "." + name)
            if frame.f_code.co_filename == plugin_file and name == "process_docs":
                if event == "call":
                    calls[probe] += 1
                elif event == "return" and type(arg) is list:
                    returns.append({"probe": probe, "type": "list", "documents": len(arg), "sha256": sha(encode(arg))})

        sys.setprofile(profile)
        stage = "raw_yaml"
        probe = "raw_yaml"
        raw_cfg = load_yaml(task_dir / "statebench.yaml")
        structural = {"group", "tag", "task_list"}
        unsupported = sorted(set(raw_cfg) - structural - {f.name for f in fields(TaskConfig)})
        require(unsupported == ["filter_docs", "until"], "UNEXPECTED_TASK_CONFIG_FIELD_SET")
        try:
            TaskManager(include_defaults=False).load(str(task_dir / "statebench.yaml"))
        except Exception as exc:
            raw_error = error_record(exc, lm_root, upstream)
        else:
            raise ValueError("SOURCE_PREDICTED_YAML_REJECTION_NOT_OBSERVED")
        require(raw_error["type"] == "TypeError" and "unexpected keyword argument 'until'" in raw_error["message"], "RAW_YAML_FAILURE_NOT_CLASSIFIED")
        individual = {}
        for key in unsupported:
            try:
                TaskConfig(task="v013_field_probe", metric_list=[], **{key: raw_cfg[key]})
            except TypeError as exc:
                require("unexpected keyword argument '" + key + "'" in str(exc), "FIELD_REJECTION_NOT_CLASSIFIED")
                individual[key] = {"type": "TypeError", "message": str(exc)}
            else:
                raise ValueError("UNSUPPORTED_FIELD_WAS_ACCEPTED:" + key)
        require(calls[probe] == 0, "PROCESSING_OCCURRED_BEFORE_CONFIG_ADMISSION")
        result["raw_yaml"] = {"yaml_loaded": True, "admission": "REJECTED_TASK_CONFIG", "exception": raw_error,
                              "unsupported_after_factory_structural_keys": unsupported, "individual_field_probes": individual,
                              "plugin_processing_calls": 0, "ordinary_hub_path_not_executed": True}

        stage = "container_probe"
        probe = "container_probe"
        rows = load_split_as_rows(upstream / g12.DATA_PATH)
        require(len(rows) == 209, "EXACT_ROW_COUNT_REQUIRED")
        row_dataset = Dataset.from_list(rows)
        dataset_calls = Counter()

        def exact_rows(**kwargs):
            require(not kwargs, "UNDECLARED_DATASET_KWARGS")
            dataset_calls["rows"] += 1
            return DatasetDict({"test": row_dataset})

        def minimal_config(name, custom_dataset, process_docs):
            return {"task": name, "dataset_path": None, "custom_dataset": custom_dataset,
                    "test_split": "test", "validation_split": None, "training_split": None,
                    "fewshot_config": {"samples": []}, "num_fewshot": 0, "metric_list": [],
                    "output_type": "generate_until", "process_docs": process_docs,
                    "doc_to_text": plugin.doc_to_text, "doc_to_target": plugin.doc_to_target,
                    "generation_kwargs": {"max_gen_toks": 256, "temperature": 0, "do_sample": False, "until": ["\n", "\n\n"]}}

        try:
            TaskManager(include_defaults=False).load(minimal_config("v013_exact_rows_unmodified_processor", exact_rows, plugin.process_docs))
        except Exception as exc:
            container_error = error_record(exc, lm_root, upstream)
        else:
            raise ValueError("SOURCE_PREDICTED_CONTAINER_REJECTION_NOT_OBSERVED")
        require(container_error["type"] == "AttributeError" and "'list' object has no attribute 'features'" in container_error["message"], "CONTAINER_FAILURE_NOT_CLASSIFIED")
        require(any(f["file"] == "lm_eval/api/task.py" and "self.task_docs.features" in (f["source"] or "") for f in container_error["upstream_frames"]), "PINNED_CONTAINER_FAILURE_SITE_MISSING")
        observed_returns = [v for v in returns if v["probe"] == probe]
        require(observed_returns and all(v["documents"] == 251 and v["sha256"] == DOCS12 for v in observed_returns), "TASK_PROCESSING_DRIFTED_FROM_V012")
        require(dataset_calls["rows"] == 1, "UNEXPECTED_CUSTOM_DATASET_CALLS")
        result["container_probe"] = {"admission": "REJECTED_LIST_WITHOUT_FEATURES", "exception": container_error,
                                     "minimal_config_not_original_yaml": True, "custom_dataset_calls": dataset_calls["rows"],
                                     "upstream_processor_unchanged": True, "plugin_processing_calls": calls[probe],
                                     "processed_documents": 251, "processed_documents_sha256": DOCS12}

        stage = "diagnostic_control"
        probe = "diagnostic_control"
        doc_dataset = Dataset.from_list(docs)
        require(sha(encode([dict(d) for d in doc_dataset])) == DOCS12, "CONTROL_CONTAINER_CHANGED_DOCUMENTS")

        def exact_documents(**kwargs):
            require(not kwargs, "UNDECLARED_CONTROL_DATASET_KWARGS")
            dataset_calls["documents"] += 1
            return DatasetDict({"test": doc_dataset})

        task_name = "v013_preprocessed_dataset_diagnostic_control"
        task = TaskManager(include_defaults=False).load(minimal_config(task_name, exact_documents, None))["tasks"][task_name]
        task_docs = task.eval_docs
        require(isinstance(task_docs, Dataset) and len(task_docs) == 251, "CONTROL_TASK_DOCUMENTS_INVALID")
        require(sha(encode([dict(d) for d in task_docs])) == DOCS12, "CONTROL_TASK_CHANGED_DOCUMENTS")
        require(sorted(task.features) == sorted(docs[0]), "CONTROL_FEATURES_DIFFER")
        for index, (doc, expected) in enumerate(zip(task_docs, docs)):
            prompt = task.doc_to_text(doc)
            target = task.doc_to_target(doc)
            require(prompt == plugin.doc_to_text(expected) == reference_prompt(expected), "PROMPT_FIDELITY_FAILURE")
            require(target == plugin.doc_to_target(expected) == expected["expected_decision"], "TARGET_FIDELITY_FAILURE")
            trace.append({"index": index, "timeline_id": doc["timeline_id"], "query_idx": doc["query_idx"],
                          "prompt_sha256": sha(prompt.encode()), "target_sha256": sha(target.encode())})
        require(dataset_calls["documents"] == 1 and calls[probe] == 0, "CONTROL_ROUTE_NOT_PREDECLARED_ROUTE")
        require(plugin._judge is None and not attempts, "SCORING_OR_FORBIDDEN_EFFECT")
        result["diagnostic_control"] = {"kind": "MATAWAKA_PREPROCESSED_DATASET_CONTROL", "upstream_unmodified_task": False,
                                        "task_constructed": True, "documents": 251, "document_sha256": DOCS12,
                                        "feature_names": sorted(task.features), "all_prompt_target_pairs_equal": True,
                                        "format_trace_sha256": sha(encode(trace)), "custom_dataset_calls": dataset_calls["documents"],
                                        "plugin_processing_calls": 0, "scoring_disabled_explicitly": True}
        sys.setprofile(None)
        for name, expected in LM_BLOBS.items():
            require(blob((lm_root / name).read_bytes()) == expected, "LM_EVAL_SOURCE_MUTATED")
        for name, expected in TASK_BLOBS.items():
            require(blob((task_dir / name).read_bytes()) == expected, "UPSTREAM_TASK_MUTATED")
        g12.validate_lock(predecessor)
        g12.check_bpe(cache)
        boundary(repo)
        result["effects"] = {"exact_upstream_yaml_read": True, "exact_local_data_processed": True,
                             "task_construction_attempted": True, "diagnostic_control_constructed": True,
                             "isolated_network_namespace_verified": True, "non_root_verified": True,
                             "socket_guard_active": True, "forbidden_call_guard_used": True}
        result["forbidden_effect_attempts"] = attempts
        result["audit_execution"] = "COMPLETED"
        result["compatibility"] = "NONPASS"
        result["status"] = "LM_EVAL_TASK_COMPATIBILITY_EXECUTED_NONPASS"
        qualified_observation(result)
    except Exception as exc:
        error = exc
        result.update(audit_execution="INCONCLUSIVE", compatibility="NOT_ESTABLISHED", status="AUDIT_INCONCLUSIVE",
                      failure_stage=stage, failure_type=type(exc).__name__, failure_detail=str(exc)[:1000], forbidden_effect_attempts=attempts)
    finally:
        sys.setprofile(None)
    (output / "format-trace.json").write_bytes(encode(trace))
    data = encode(result)
    (output / "results.json").write_bytes(data)
    (output / "results.sha256").write_text(sha(data) + "  results.json\n", encoding="utf-8")
    print(data.decode(), end="")
    print("RESULT_SHA256=" + sha(data))
    if error is not None:
        raise SystemExit(1)


class GuardTests(unittest.TestCase):
    def fixture(self):
        return {"audit_execution": "COMPLETED", "compatibility": "NONPASS", "non_effects": NON_EFFECTS.copy(),
                "raw_yaml": {"admission": "REJECTED_TASK_CONFIG"},
                "container_probe": {"admission": "REJECTED_LIST_WITHOUT_FEATURES", "processed_documents_sha256": DOCS12},
                "diagnostic_control": {"upstream_unmodified_task": False, "task_constructed": True, "documents": 251, "all_prompt_target_pairs_equal": True},
                "forbidden_effect_attempts": []}

    def test_valid_negative_observation(self):
        qualified_observation(self.fixture())

    def test_nonpass_promotion(self):
        r = self.fixture(); r["compatibility"] = "PASS"
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_inconclusive_not_nonpass(self):
        r = self.fixture(); r["audit_execution"] = "INCONCLUSIVE"
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_control_not_upstream(self):
        r = self.fixture(); r["diagnostic_control"]["upstream_unmodified_task"] = True
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_missing_documents(self):
        r = self.fixture(); r["diagnostic_control"]["documents"] = 250
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_document_digest_change(self):
        r = self.fixture(); r["container_probe"]["processed_documents_sha256"] = "0" * 64
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_formatting_failure(self):
        r = self.fixture(); r["diagnostic_control"]["all_prompt_target_pairs_equal"] = False
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_effect_attempt(self):
        r = self.fixture(); r["forbidden_effect_attempts"] = ["datasets.load.load_dataset"]
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_each_non_effect_promotion(self):
        for key in NON_EFFECTS:
            with self.subTest(key=key):
                r = self.fixture(); r["non_effects"][key] = True
                with self.assertRaises(ValueError): qualified_observation(r)

    def test_unknown_non_effect(self):
        r = self.fixture(); r["non_effects"]["bonus_authority"] = False
        with self.assertRaises(ValueError): qualified_observation(r)

    def test_expected_truth_not_in_prompt_template(self):
        a = {"context": "c", "query": "q", "expected_decision": "first"}
        b = {**a, "expected_decision": "second"}
        self.assertEqual(reference_prompt(a), reference_prompt(b))

    def test_digest_changes_with_whitespace(self):
        self.assertNotEqual(sha(b'{"a":1}'), sha(b'{"a": 1}'))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["boundary", "self-test", "run"])
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    for key in ("predecessor", "upstream", "evidence12", "cache", "output"):
        parser.add_argument("--" + key, type=Path)
    args = parser.parse_args()
    if args.command == "self-test":
        tests = unittest.defaultTestLoader.loadTestsFromTestCase(GuardTests)
        raise SystemExit(0 if unittest.TextTestRunner(verbosity=2).run(tests).wasSuccessful() else 1)
    elif args.command == "boundary":
        boundary(args.repo.resolve())
        print("V013_ADDITIVE_PREDECESSOR_BOUNDARY_VALID")
    else:
        values = [args.predecessor, args.upstream, args.evidence12, args.cache, args.output]
        require(all(v is not None for v in values), "ALL_RUNTIME_PATHS_REQUIRED")
        run(args.repo.resolve(), *(v.resolve() for v in values))


if __name__ == "__main__":
    main()
