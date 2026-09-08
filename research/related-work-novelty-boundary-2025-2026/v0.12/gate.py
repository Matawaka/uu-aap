"""Bounded StateBench data-processing gate. No model, judge, task loader or Hub access.

Acquisition is a separate subcommand; process runs in a fresh network namespace.
Only the unchanged upstream data transformation is measured, not lm-eval Task API.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata as metadata
import importlib.util
import json
import os
from pathlib import Path
import platform
import socket
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from datetime import datetime
from typing import Any

BASE = "5e7485cb44624b63756806414d0c5d5b85d60b93"
PREVIOUS_TREE = "debdd1d7544cda852ea16214d4685cfb79d881b3"
UPSTREAM = "1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7"
ROOT = "research/related-work-novelty-boundary-2025-2026"
WORKFLOW = ".github/workflows/statebench-exact-data-processing-v0.12.yml"
LOCK_SHA = "324ab96f208bfbe1e6a2d03bc6ceb4bf5aa4867a57eeac5217e81571b7925532"
LOCK_BLOB = "975210dd6ee71d3504e9ff2b8f482d7e4d6f5123"
DATA_SHA = "7df54da79653488bcc2253c9431dc35fd5c2411ec12afe1f22958ed09395a7c9"
DATA_BLOB = "3d0bcce1a7725384cf7c25eb4695a784e6a275cd"
DATA_PATH = "data/releases/v1.0/test.jsonl"
PLUGIN_PATH = "statebench-lm-eval/lm_eval/tasks/statebench/utils.py"
PLUGIN_BLOB = "d868c2138084cf08a842bdddfc204d556d46ed92"
BPE_URL = "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken"
BPE_SHA = "223921b76ee99bde995b7ff738513eef100fb51d18c93597a113bcffe865b2a7"
BPE_KEY = hashlib.sha1(BPE_URL.encode()).hexdigest()
BPE_CEILING = 2 * 1024 * 1024
VERSIONS = {"statebench": "2.0.0", "lm-eval": "0.4.13", "datasets": "5.0.1", "torch": "2.14.0", "transformers": "5.16.1", "accelerate": "1.14.0", "peft": "0.20.0", "tiktoken": "0.14.0"}
SOURCE_BLOBS = {
    "huggingface.py": "514f8a8a25729c12b8efc21b569224717bacba45",
    "schema/timeline.py": "6dd5849aa4ad22c37cf68a73606eab8155c7f1c1",
    "schema/state.py": "61c65eb0ef345765b9bb933d4f5976da4fcffa17",
    "baselines/transcript.py": "31a400426961219ae06a080fc837df42084ddd46",
    "baselines/base.py": "200dbf04a0feae3a0cb0d9954754494f1eb4e76b",
    "baselines/__init__.py": "7aa4194e0675231f559233285ca095e6fa76ea79",
    "runner/harness.py": "7bbf24843ccbddf931dd1a0ff022330d73fa924d",
}
OFFLINE = {"HF_HUB_OFFLINE": "1", "HF_DATASETS_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "HF_HUB_DISABLE_TELEMETRY": "1"}
CREDENTIALS = ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY", "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "AZURE_OPENAI_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "GOOGLE_APPLICATION_CREDENTIALS")
NON_EFFECTS = {k: False for k in ("language_model_executed", "model_downloaded", "model_instantiated", "provider_api_called", "user_credentials_used", "judge_or_scoring_called", "statebench_task_yaml_loaded", "hub_dataset_loaded", "official_statebench_benchmark_executed", "full_lm_eval_task_compatibility_established", "model_performance_established", "detection_advantage_established", "detection_non_advantage_established", "novelty_established", "production_ready", "release_authorized", "standards_authorized", "merge_authorized")}


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def encoded(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-C", str(repo), *args], text=True).strip()


def verify_bytes(data: bytes, sha: str, git_blob: str | None = None, size: int | None = None) -> None:
    require(size is None or len(data) == size, "BYTE_LENGTH_MISMATCH")
    require(digest(data) == sha, "SHA256_MISMATCH")
    require(git_blob is None or blob(data) == git_blob, "GIT_BLOB_MISMATCH")


def validate_lock(repo: Path) -> None:
    verify_bytes((repo / ROOT / "v0.10/lock-project/uv.lock").read_bytes(), LOCK_SHA, LOCK_BLOB, 224954)


def boundary(repo: Path) -> None:
    require(git(repo, "rev-parse", f"{BASE}:{ROOT}/v0.11") == PREVIOUS_TREE, "PREDECESSOR_TREE_MISMATCH")
    require(git(repo, "rev-parse", f"HEAD:{ROOT}/v0.11") == PREVIOUS_TREE, "FROZEN_V011_MUTATED")
    git(repo, "merge-base", "--is-ancestor", BASE, "HEAD")
    for line in git(repo, "diff", "--name-status", BASE, "HEAD").splitlines():
        status, path = line.split("\t", 1)
        require(status == "A" and (path.startswith(ROOT + "/v0.12/") or path == WORKFLOW), "NON_ADDITIVE_OR_PROTECTED_DIFF:" + path)
    validate_lock(repo)


def ordered_ids(rows: list[dict[str, Any]], expected: list[str]) -> None:
    ids = [row["id"] for row in rows]
    require(ids == expected and len(set(ids)) == len(ids), "TIMELINE_ORDER_OR_ID_MISMATCH")


def equal_docs(actual: Any, expected: list[dict[str, Any]]) -> None:
    require(type(actual) is list, "PROCESS_DOCS_NOT_LIST")
    require(len(actual) == len(expected), "QUERY_DOCUMENT_COUNT_MISMATCH")
    for index, (got, want) in enumerate(zip(actual, expected)):
        require(type(got) is dict, "DOCUMENT_NOT_DICT")
        require(type(got.get("query_idx")) is int, "QUERY_INDEX_NOT_INT")
        require(encoded(got) == encoded(want), f"QUERY_DOCUMENT_FIDELITY_MISMATCH:{index}")


def normalization(raw: Any, normalized: Any, path: str = "") -> list[dict[str, str]]:
    """Report schema defaulting/canonicalization without calling it raw-byte fidelity."""
    out: list[dict[str, str]] = []
    if type(raw) is dict and type(normalized) is dict:
        for key in sorted(raw.keys() - normalized.keys()):
            out.append({"kind": "REMOVED_RAW_FIELD", "path": path + "/" + key})
        for key in sorted(normalized.keys() - raw.keys()):
            out.append({"kind": "SCHEMA_ADDED_FIELD", "path": path + "/" + key})
        for key in sorted(raw.keys() & normalized.keys()):
            out.extend(normalization(raw[key], normalized[key], path + "/" + key))
    elif type(raw) is list and type(normalized) is list:
        if len(raw) != len(normalized):
            out.append({"kind": "CHANGED_LIST_LENGTH", "path": path})
        for index, (a, b) in enumerate(zip(raw, normalized)):
            out.extend(normalization(a, b, path + "/" + str(index)))
    elif encoded(raw) != encoded(normalized):
        kind = "CHANGED_RAW_VALUE"
        if isinstance(raw, str) and isinstance(normalized, str):
            try:
                a, b = datetime.fromisoformat(raw), datetime.fromisoformat(normalized)
                if a.tzinfo is not None and b.tzinfo is not None and a == b:
                    kind = "EQUIVALENT_TIMESTAMP_SPELLING"
            except ValueError:
                pass
        out.append({"kind": kind, "path": path})
    return out


def context_reference(turns: list[str], encoder: Any) -> str:
    """Independent transcription of the pinned user-only 8000-500 budget rule."""
    kept: list[str] = []
    used = 0
    truncated = False
    for text in reversed(turns):
        line = "User: " + text
        length = len(encoder.encode(line))
        if used + length > 7500:
            truncated = True
        else:
            used += length
            kept.insert(0, line)
    if truncated:
        kept.insert(0, "[Earlier conversation truncated...]")
    return "Conversation history:\n\n" + "\n\n".join(kept) if kept else ""


def check_bpe(cache: Path) -> bytes:
    require(cache.is_dir() and not cache.is_symlink(), "TOKENIZER_CACHE_NOT_LOCAL_DIRECTORY")
    require(sorted(p.name for p in cache.iterdir()) == [BPE_KEY], "TOKENIZER_CACHE_NOT_EXACT_SINGLE_INPUT")
    target = cache / BPE_KEY
    require(target.is_file() and not target.is_symlink(), "TOKENIZER_INPUT_NOT_REGULAR_FILE")
    data = target.read_bytes()
    require(len(data) <= BPE_CEILING, "TOKENIZER_BYTE_CEILING")
    verify_bytes(data, BPE_SHA)
    return data


def acquire(cache: Path) -> None:
    """One fixed public BPE object; no redirects, models, credentials or fallback."""
    import urllib.request
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise ValueError("TOKENIZER_REDIRECT_DENIED")
    require(not cache.exists(), "TOKENIZER_DESTINATION_ALREADY_EXISTS")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(BPE_URL, timeout=45) as response:
        require(response.status == 200 and response.url == BPE_URL, "TOKENIZER_SOURCE_MISMATCH")
        data = response.read(BPE_CEILING + 1)
    require(len(data) <= BPE_CEILING, "TOKENIZER_BYTE_CEILING")
    verify_bytes(data, BPE_SHA)
    cache.mkdir(mode=0o700, parents=False)
    with (cache / BPE_KEY).open("xb") as output:
        output.write(data)
    check_bpe(cache)
    print(json.dumps({"side_input": "cl100k_base.tiktoken", "bytes": len(data), "sha256": digest(data), "model_downloaded": False}, sort_keys=True))


def deny_network() -> None:
    def denied(*args, **kwargs):
        raise RuntimeError("NETWORK_DENIED_DURING_EXACT_DATA_PROCESSING")
    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.socket.sendto = denied
    socket.create_connection = denied
    socket.getaddrinfo = denied


def process(repo: Path, upstream: Path, cache: Path, output: Path) -> None:
    result: dict[str, Any] = {"schema": "matawaka.statebench-exact-data-processing-results/v0.12", "predecessor": BASE, "status": "PREFLIGHT_NOT_COMPLETED", "non_effects": NON_EFFECTS.copy()}
    stage = "environment"
    error = None
    output.mkdir(parents=True, exist_ok=False)
    try:
        require(platform.python_version() == "3.12.14", "EXACT_PYTHON_REQUIRED")
        require(not any(os.environ.get(key) for key in CREDENTIALS), "MODEL_OR_PROVIDER_CREDENTIAL_PRESENT")
        require(all(os.environ.get(key) == value for key, value in OFFLINE.items()), "OFFLINE_CONTROLS_REQUIRED")
        observed = {name: metadata.version(name) for name in VERSIONS}
        require(observed == VERSIONS, "FROZEN_DISTRIBUTION_VERSION_MISMATCH")
        validate_lock(repo)
        require(git(upstream, "rev-parse", "HEAD") == UPSTREAM, "UPSTREAM_HEAD_MISMATCH")
        for path, tree in {"src": "93d4843a4a444f8ea583c19a4d5961ed9042a586", "statebench-lm-eval": "974c3ca0b1ae5ddadcda1a5c4856ae6a74d6abe6"}.items():
            require(git(upstream, "rev-parse", "HEAD:" + path) == tree, "UPSTREAM_TREE_MISMATCH")
        require(not git(upstream, "status", "--porcelain", "--untracked-files=no"), "UPSTREAM_WORKTREE_MUTATED")
        payload = (upstream / DATA_PATH).read_bytes()
        verify_bytes(payload, DATA_SHA, DATA_BLOB, 638933)
        bpe = check_bpe(cache)
        os.environ["TIKTOKEN_CACHE_DIR"] = str(cache.resolve())
        spec = importlib.util.find_spec("statebench")
        require(spec is not None and spec.origin is not None, "STATEBENCH_SOURCE_NOT_FOUND")
        package_root = Path(spec.origin).parent
        for path, expected_blob in SOURCE_BLOBS.items():
            require(blob((package_root / path).read_bytes()) == expected_blob, "INSTALLED_UPSTREAM_SOURCE_MISMATCH:" + path)
        require(blob((upstream / PLUGIN_PATH).read_bytes()) == PLUGIN_BLOB, "PLUGIN_SOURCE_MISMATCH")
        result["inputs"] = {"statebench_commit": UPSTREAM, "data_sha256": DATA_SHA, "data_bytes": len(payload), "lock_sha256": LOCK_SHA, "plugin_blob": PLUGIN_BLOB, "tokenizer_sha256": digest(bpe), "tokenizer_bytes": len(bpe)}
        result["environment"] = {"python": platform.python_version(), "distributions": observed}
        stage = "offline_imports"
        deny_network()
        from datasets import Dataset
        from statebench.runner.harness import load_timelines
        from statebench.huggingface import load_split_as_rows, hf_row_to_timeline
        import tiktoken
        import tiktoken_ext.openai_public as tokenizer_definition
        require(blob(Path(tokenizer_definition.__file__).read_bytes()) == "02c9ee20fa186223145da1de759bdf001f1f1e1c", "TOKENIZER_DEFINITION_SOURCE_MISMATCH")
        plugin_spec = importlib.util.spec_from_file_location("matawaka_pinned_statebench_utils", upstream / PLUGIN_PATH)
        require(plugin_spec is not None and plugin_spec.loader is not None, "PLUGIN_SPEC_MISSING")
        plugin = importlib.util.module_from_spec(plugin_spec)
        plugin_spec.loader.exec_module(plugin)
        encoder = tiktoken.get_encoding("cl100k_base")
        stage = "timeline_roundtrip"
        raw = [json.loads(line) for line in payload.decode("utf-8", errors="strict").splitlines() if line.strip()]
        require(len(raw) == 209, "RAW_TIMELINE_COUNT_MISMATCH")
        ids = [row["id"] for row in raw]
        ordered_ids(raw, ids)
        timelines = list(load_timelines(upstream / DATA_PATH))
        normalized = [t.model_dump(mode="json") for t in timelines]
        ordered_ids(normalized, ids)
        require(sum(e["type"] == "query" for t in raw for e in t["events"]) == 251, "RAW_QUERY_COUNT_MISMATCH")
        rows = load_split_as_rows(upstream / DATA_PATH)
        ordered_ids(rows, ids)
        dataset = Dataset.from_list(rows)
        hf_rows = [dict(row) for row in dataset]
        require(encoded(rows) == encoded(hf_rows), "HF_STORAGE_ROW_FIDELITY_MISMATCH")
        roundtrip = [hf_row_to_timeline(row).model_dump(mode="json") for row in hf_rows]
        require(encoded(normalized) == encoded(roundtrip), "NORMALIZED_TIMELINE_ROUNDTRIP_MISMATCH")
        changes = []
        for before, after in zip(raw, normalized):
            changes.extend({"timeline_id": before["id"], **change} for change in normalization(before, after))
        (output / "normalization.json").write_bytes(encoded(changes))
        kinds = Counter(change["kind"] for change in changes)
        result["roundtrip"] = {"timelines": len(rows), "unique_ids": len(set(ids)), "normalized_roundtrip_equal": True, "raw_json_roundtrip_equal": not changes, "raw_schema_change_counts": dict(sorted(kinds.items())), "normalization_sha256": digest(encoded(changes)), "normalized_timelines_sha256": digest(encoded(normalized)), "hf_rows_sha256": digest(encoded(rows))}
        stage = "query_processing"
        expected = []
        for timeline in normalized:
            turns: list[str] = []
            query_idx = 0
            for event in timeline["events"]:
                if event["type"] == "conversation_turn" and event["speaker"] == "user":
                    turns.append(event["text"])
                if event["type"] != "query":
                    continue
                gt = event["ground_truth"]
                # Match the upstream canonical GroundTruth JSON, not an alternate schema.
                expected.append({"timeline_id": timeline["id"], "query_idx": query_idx, "track": timeline["track"], "domain": timeline["domain"], "difficulty": timeline["difficulty"], "context": context_reference(turns, encoder), "query": event["prompt"], "expected_decision": gt["decision"], "decision_type": gt["decision_type"], "must_mention": [m if isinstance(m, str) else m["phrase"] for m in gt["must_mention"]], "must_not_mention": [m if isinstance(m, str) else m["phrase"] for m in gt["must_not_mention"]], "ground_truth_json": None})
                query_idx += 1
        gt_json = [event.ground_truth.model_dump_json() for timeline in timelines for event in timeline.get_queries()]
        require(len(expected) == len(gt_json) == 251, "EXPECTED_QUERY_COUNT_MISMATCH")
        for doc, ground_truth_json in zip(expected, gt_json):
            doc["ground_truth_json"] = ground_truth_json
        actual = plugin.process_docs(dataset)
        equal_docs(actual, expected)
        second = plugin.process_docs(dataset)
        equal_docs(second, expected)
        reversed_docs = plugin.process_docs(Dataset.from_list(list(reversed(rows))))
        lookup = {timeline_id: [] for timeline_id in ids}
        for doc in expected:
            lookup[doc["timeline_id"]].append(doc)
        reversed_expected = [doc for timeline_id in reversed(ids) for doc in lookup[timeline_id]]
        equal_docs(reversed_docs, reversed_expected)
        require(plugin._judge is None, "JUDGE_WAS_INITIALIZED")
        check_bpe(cache)
        verify_bytes((upstream / DATA_PATH).read_bytes(), DATA_SHA, DATA_BLOB, 638933)
        validate_lock(repo)
        result["processing"] = {"return_type": "list", "query_documents": len(actual), "ordered_query_and_ground_truth_equal": True, "independent_transcript_context_equal": True, "repeat_equal": True, "reversed_timeline_reset_isolation_equal": True, "documents_sha256": digest(encoded(actual)), "query_counts_by_track": dict(sorted(Counter(d["track"] for d in actual).items())), "query_counts_by_domain": dict(sorted(Counter(d["domain"] for d in actual).items())), "baseline": "transcript_replay", "token_budget": 8000, "initial_state_injected_into_context": False, "baseline_uses_user_conversation_turns_only": True}
        (output / "documents.json").write_bytes(encoded(actual))
        stage = "raw_schema_loss_boundary"
        require(not any(kinds[k] for k in ("REMOVED_RAW_FIELD", "CHANGED_LIST_LENGTH", "CHANGED_RAW_VALUE")), "RAW_SCHEMA_LOSS_OR_VALUE_CHANGE")
        result["status"] = "EXACT_DATA_PLUGIN_PROCESSING_EXECUTED_PASS"
    except Exception as exc:
        error = exc
        result.update(status="EXACT_DATA_PLUGIN_PROCESSING_NONPASS", failure_stage=stage, failure_type=type(exc).__name__, failure_detail=str(exc)[:1500])
    data = encoded(result)
    (output / "results.json").write_bytes(data)
    (output / "results.sha256").write_text(digest(data) + "  results.json\n", encoding="utf-8")
    print(data.decode(), end="")
    print("RESULT_SHA256=" + digest(data))
    if error is not None:
        raise SystemExit(1)


class Hostile(unittest.TestCase):
    def test_asset_byte_mutation(self):
        with self.assertRaises(ValueError): verify_bytes(b"b", digest(b"a"))
    def test_asset_length(self):
        with self.assertRaises(ValueError): verify_bytes(b"a", digest(b"a"), size=2)
    def test_asset_git_blob(self):
        with self.assertRaises(ValueError): verify_bytes(b"a", digest(b"a"), git_blob=blob(b"b"))
    def test_timeline_drop(self):
        with self.assertRaises(ValueError): ordered_ids([{"id": "a"}], ["a", "b"])
    def test_timeline_duplicate(self):
        with self.assertRaises(ValueError): ordered_ids([{"id": "a"}, {"id": "a"}], ["a", "a"])
    def test_timeline_order(self):
        with self.assertRaises(ValueError): ordered_ids([{"id": "b"}, {"id": "a"}], ["a", "b"])
    def test_query_mutations(self):
        fixture = [{"timeline_id": "a", "query_idx": 0, "query": "q", "context": "c", "ground_truth_json": "{}"}, {"timeline_id": "b", "query_idx": 0, "query": "r", "context": "d", "ground_truth_json": "{}"}]
        equal_docs(copy.deepcopy(fixture), fixture)
        mutants = [fixture[:1], fixture + [fixture[0]], list(reversed(fixture)), [fixture[0], fixture[0]], tuple(fixture)]
        for key, value in [("query", "x"), ("context", "x"), ("ground_truth_json", "null"), ("timeline_id", "x"), ("query_idx", True), ("extra", True)]:
            mutant = copy.deepcopy(fixture); mutant[0][key] = value; mutants.append(mutant)
        for index, mutant in enumerate(mutants):
            with self.subTest(mutation=index), self.assertRaises(ValueError): equal_docs(mutant, fixture)
    def test_normalization_loss(self):
        self.assertEqual(normalization({"x": 1}, {})[0]["kind"], "REMOVED_RAW_FIELD")
    def test_normalization_value(self):
        self.assertEqual(normalization({"x": 1}, {"x": 2})[0]["kind"], "CHANGED_RAW_VALUE")
    def test_normalization_boolean_not_integer(self):
        self.assertEqual(normalization(True, 1)[0]["kind"], "CHANGED_RAW_VALUE")
    def test_normalization_added(self):
        self.assertEqual(normalization({}, {"x": None})[0]["kind"], "SCHEMA_ADDED_FIELD")
    def test_normalization_timestamp(self):
        self.assertEqual(normalization("2026-01-01T00:00:00+00:00", "2026-01-01T00:00:00Z")[0]["kind"], "EQUIVALENT_TIMESTAMP_SPELLING")
    def test_normalization_list(self):
        self.assertEqual(normalization([1], [1, 2])[0]["kind"], "CHANGED_LIST_LENGTH")
    def test_cache_missing(self):
        with tempfile.TemporaryDirectory() as td, self.assertRaises(ValueError): check_bpe(Path(td))
    def test_cache_extra(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "extra").write_bytes(b"a")
            with self.assertRaises(ValueError): check_bpe(Path(td))
    def test_cache_corrupt(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / BPE_KEY).write_bytes(b"a")
            with self.assertRaises(ValueError): check_bpe(Path(td))
    def test_cache_symlink(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td); (root / "file").write_bytes(b"a"); (root / "cache").mkdir()
            (root / "cache" / BPE_KEY).symlink_to(root / "file")
            with self.assertRaises(ValueError): check_bpe(root / "cache")
    def test_non_effects_all_false(self):
        self.assertTrue(all(value is False for value in NON_EFFECTS.values()))
    def test_context_empty_and_order(self):
        class FakeEncoder:
            def encode(self, text): return list(text)
        self.assertEqual(context_reference([], FakeEncoder()), "")
        self.assertEqual(context_reference(["a", "b"], FakeEncoder()), "Conversation history:\n\nUser: a\n\nUser: b")
    def test_context_budget(self):
        class FakeEncoder:
            def encode(self, text): return range(7501)
        self.assertEqual(context_reference(["x"], FakeEncoder()), "Conversation history:\n\n[Earlier conversation truncated...]")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["hostile", "boundary", "acquire-tokenizer", "process"])
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--upstream", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.command == "hostile":
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(Hostile)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        raise SystemExit(0 if result.wasSuccessful() else 1)
    elif args.command == "boundary":
        boundary(args.repo)
        print("EXACT_PREDECESSOR_LOCK_AND_ADDITIVE_BOUNDARY_PASS")
    elif args.command == "acquire-tokenizer":
        require(args.cache is not None, "--cache required")
        acquire(args.cache)
    else:
        require(all(v is not None for v in (args.upstream, args.cache, args.output)), "--upstream --cache --output required")
        process(args.repo.resolve(), args.upstream.resolve(), args.cache.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
