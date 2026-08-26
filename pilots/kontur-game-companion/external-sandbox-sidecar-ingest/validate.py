#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
INGEST = HERE / "ingest.py"
RUN = HERE / "run.py"
FIXTURE = HERE / "fixtures" / "synthetic-sidecar"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ingest = loadmod("kontur_external_sandbox_sidecar_ingest_validate", INGEST)


def tree_digest(root):
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def fixture_policy_sha(root):
    return hashlib.sha256((root / "runtime-collection-policy.json").read_bytes()).hexdigest()


def ready_context(pilot_receipt, root):
    context = ingest.default_ingest_context(pilot_receipt)
    context["external_sandbox_ingest_requested"] = True
    context["human_external_sandbox_decision"] = ingest.HUMAN_DECISION
    context["session_id"] = "synthetic-complete"
    context["expected_policy_sha256"] = fixture_policy_sha(root)
    context["sidecar_root_reference_digest"] = ingest.sidecar_root_reference_digest(root)
    for field in ingest.PRECHECK_FIELDS:
        context[field] = True
    return context


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def mutate_json(path, mutate):
    value = json.loads(path.read_text(encoding="utf-8"))
    mutate(value)
    write_json(path, value)


def main():
    config = ingest.load_config()
    ingest.validate_config(config)
    source = INGEST.read_text(encoding="utf-8")
    for forbidden in (
        "import socket", "import subprocess", "import urllib", "import requests",
        "import psutil", "import ctypes", "write_text(", "write_bytes(", "open(\"w",
        "open('w", "Popen(", "run(",
    ):
        assert forbidden not in source, f"forbidden runtime surface in ingest.py: {forbidden}"
    assert ".read_bytes()" in source
    assert "resolve(strict=True)" in source
    assert "is_symlink()" in source

    pilot_receipt = ingest.local_run.execute("synthetic-ready")
    ingest.validate_upstream_pilot(pilot_receipt)
    default = ingest.ingest_completed_session(copy.deepcopy(pilot_receipt), config=config)
    default2 = ingest.ingest_completed_session(copy.deepcopy(pilot_receipt), config=config)
    assert default == default2
    assert default["decision"] == "EXTERNAL_SANDBOX_INGEST_NOT_STARTED"
    assert default["files_read"] == []
    assert default["external_file_io_performed"] is False
    assert default["external_environment_connected"] is False

    partial_context = ingest.default_ingest_context(pilot_receipt)
    partial_context["external_sandbox_ingest_requested"] = True
    partial = ingest.ingest_completed_session(pilot_receipt, partial_context, config=config)
    assert partial["decision"] == "EXTERNAL_SANDBOX_PRECHECK_REQUIRED"
    assert partial["files_read"] == []

    cli_runs = 0
    rejected_mutations = 0
    external_reads = 0
    with tempfile.TemporaryDirectory(prefix="kontur-sidecar-ingest-") as temp:
        root = Path(temp) / "KONTUR_PILOT_INFO"
        shutil.copytree(FIXTURE, root)
        before = tree_digest(root)
        context = ready_context(pilot_receipt, root)
        receipt = ingest.ingest_completed_session(
            copy.deepcopy(pilot_receipt), copy.deepcopy(context), root, config
        )
        receipt2 = ingest.ingest_completed_session(
            copy.deepcopy(pilot_receipt), copy.deepcopy(context), root, config
        )
        external_reads += 2
        assert receipt == receipt2
        assert tree_digest(root) == before
        assert receipt["decision"] == "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED"
        assert receipt["external_environment_connected"] is True
        assert receipt["external_file_read_authorized"] is True
        assert receipt["external_file_io_performed"] is True
        assert receipt["completed_session_ingested"] is True
        assert receipt["files_read"] == [
            "runtime-collection-policy.json",
            "sessions/synthetic-complete/session-start.json",
            "sessions/synthetic-complete/session-final.json",
        ]
        assert receipt["private_absolute_path_stored"] is False
        assert str(root) not in json.dumps(receipt)
        assert receipt["sanitized_summary"] == {
            "bytes_processed": 2048,
            "lines_processed": 32,
            "log_file_count": 1,
            "sensitive_identifier_line_count": 1,
            "identifier_values_stored": False,
            "raw_lines_stored": False,
            "severity_counts": {"error": 2, "warning": 3},
            "term_counts": {"inventory": 4, "player": 5, "world": 6},
            "lifecycle_counts": {"player_loaded": 1, "world_added": 1, "world_removed": 1},
            "stop_reason": "manual_stop",
            "performance_claim_verified": False,
        }
        for field in ingest.FALSE_EFFECTS:
            assert receipt[field] is False
        assert receipt["authority_effect"] == "NONE"
        assert receipt["action_effect"] == "NONE"
        assert receipt["successor_effect"] == "NONE"
        assert receipt["next_decision_boundary"] == ingest.NEXT_DECISION_BOUNDARY
        ingest.validate_ingest_receipt(pilot_receipt, context, receipt)

        safe_cli = subprocess.run(
            [sys.executable, str(RUN), "--scenario", "safe-default"],
            check=True,
            capture_output=True,
            text=True,
        )
        assert json.loads(safe_cli.stdout)["decision"] == "EXTERNAL_SANDBOX_INGEST_NOT_STARTED"
        cli_runs += 1
        external_cli = subprocess.run(
            [
                sys.executable,
                str(RUN),
                "--scenario", "external-read-only",
                "--sidecar-root", str(root),
                "--session-id", "synthetic-complete",
                "--expected-policy-sha256", fixture_policy_sha(root),
                "--human-decision", ingest.HUMAN_DECISION,
                "--confirm-game-stopped",
                "--confirm-read-only-completed-session",
                "--confirm-no-raw-log-process-network-or-write",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        cli_receipt = json.loads(external_cli.stdout)
        assert cli_receipt == receipt
        assert tree_digest(root) == before
        cli_runs += 1
        external_reads += 1

        def reject_output(mutate):
            nonlocal rejected_mutations
            output = copy.deepcopy(receipt)
            try:
                mutate(output)
                ingest.validate_ingest_receipt(pilot_receipt, context, output)
            except (ValueError, AssertionError, KeyError, TypeError):
                rejected_mutations += 1
                return
            raise AssertionError("unsafe external ingest output mutation accepted")

        output_mutations = [
            lambda value: value.__setitem__("decision", "LIVE_GAME_CONNECTED"),
            lambda value: value.__setitem__("adapter_mode", "PROCESS_MEMORY_ADAPTER"),
            lambda value: value.__setitem__("input_scope", "RAW_TOTAL_HISTORY"),
            lambda value: value.__setitem__("session_scope", "PERSISTENT"),
            lambda value: value.__setitem__("output_mode", "NETWORK_SEND"),
            lambda value: value.__setitem__("cpu_profile", "CONTINUOUS_POLLING"),
            lambda value: value.__setitem__("sidecar_directory_name", ".."),
            lambda value: value.__setitem__("session_id", "../escape"),
            lambda value: value.__setitem__("policy_sha256", "0" * 64),
            lambda value: value.__setitem__("session_start_sha256", "0" * 64),
            lambda value: value.__setitem__("session_final_sha256", "0" * 64),
            lambda value: value.__setitem__("external_session_evidence_ref", "0" * 64),
            lambda value: value.__setitem__("files_read", ["../raw.log"]),
            lambda value: value.__setitem__("private_absolute_path_stored", True),
            lambda value: value.__setitem__("authority_effect", "CREATE_AUTHORITY"),
            lambda value: value.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
            lambda value: value.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
            lambda value: value.__setitem__("runtime_connectedness", "LIVE_PROCESS_CONNECTED"),
            lambda value: value["sanitized_summary"].__setitem__("raw_lines_stored", True),
            lambda value: value["sanitized_summary"]["term_counts"].__setitem__("mood", 1),
            lambda value: value["sanitized_summary"].__setitem__("lines_processed", -1),
        ]
        for field in ingest.FALSE_EFFECTS:
            output_mutations.append(lambda value, key=field: value.__setitem__(key, True))
        for mutation in output_mutations:
            reject_output(mutation)

        def reject_context(mutate):
            nonlocal rejected_mutations
            candidate = copy.deepcopy(context)
            try:
                mutate(candidate)
                ingest.ingest_completed_session(pilot_receipt, candidate, root, config)
            except (ValueError, AssertionError, KeyError, TypeError):
                rejected_mutations += 1
                return
            raise AssertionError("unsafe external ingest context mutation accepted")

        context_mutations = [
            lambda value: value.__setitem__("source_local_trial_pilot_receipt_digest", "0" * 64),
            lambda value: value.__setitem__("session_id", "../escape"),
            lambda value: value.__setitem__("expected_policy_sha256", "0" * 64),
            lambda value: value.__setitem__("sidecar_root_reference_digest", "0" * 64),
            lambda value: value.__setitem__("game_stopped_confirmed", "yes"),
            lambda value: value.__setitem__("authority_effect", "CREATE_AUTHORITY"),
            lambda value: value.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
            lambda value: value.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
        ]
        for field in ingest.FORBIDDEN_REQUESTS:
            context_mutations.append(lambda value, key=field: value.__setitem__(key, True))
        for mutation in context_mutations:
            reject_context(mutation)

        def reject_config(mutate):
            nonlocal rejected_mutations
            candidate = copy.deepcopy(config)
            try:
                mutate(candidate)
                ingest.ingest_completed_session(pilot_receipt, context, root, candidate)
            except (ValueError, AssertionError, KeyError, TypeError):
                rejected_mutations += 1
                return
            raise AssertionError("unsafe external ingest config mutation accepted")

        config_mutations = [
            lambda value: value.__setitem__("adapter_mode", "LIVE_PROCESS"),
            lambda value: value.__setitem__("input_scope", "RAW_LOGS"),
            lambda value: value.__setitem__("session_scope", "PERSISTENT"),
            lambda value: value.__setitem__("output_mode", "FILE_OR_NETWORK"),
            lambda value: value.__setitem__("cpu_profile", "POLLING"),
            lambda value: value.__setitem__("sidecar_directory_name", "Release"),
            lambda value: value.__setitem__("allowed_read_templates", ["**/*"]),
            lambda value: value.__setitem__("max_read_bytes_per_file", 10_000_000),
            lambda value: value["allowed_term_keys"].append("mood"),
            lambda value: value.__setitem__("unexpected_capability", True),
        ]
        for field in ingest.FALSE_CONFIG_FIELDS:
            config_mutations.append(lambda value, key=field: value.__setitem__(key, True))
        for mutation in config_mutations:
            reject_config(mutation)

        def reject_fixture(relative_path, mutate, bind_mutated_policy=False):
            nonlocal rejected_mutations
            bad_root = Path(temp) / "bad" / "KONTUR_PILOT_INFO"
            if bad_root.exists():
                shutil.rmtree(bad_root)
            shutil.copytree(FIXTURE, bad_root)
            mutate_json(bad_root / relative_path, mutate)
            bad_context = ready_context(pilot_receipt, bad_root)
            if relative_path == "runtime-collection-policy.json" and not bind_mutated_policy:
                # Retain the original expected policy digest to prove provenance mismatch closes the read.
                bad_context["expected_policy_sha256"] = fixture_policy_sha(FIXTURE)
            try:
                ingest.ingest_completed_session(pilot_receipt, bad_context, bad_root, config)
            except (ValueError, AssertionError, KeyError, TypeError):
                rejected_mutations += 1
                return
            raise AssertionError("unsafe external sidecar mutation accepted")

        final_rel = "sessions/synthetic-complete/session-final.json"
        start_rel = "sessions/synthetic-complete/session-start.json"
        reject_fixture(final_rel, lambda value: value.__setitem__("raw_lines_stored", True))
        reject_fixture(final_rel, lambda value: value["aggregate"].__setitem__("identifier_values_stored", True))
        reject_fixture(final_rel, lambda value: value["aggregate"]["term_counts"].__setitem__("mood", 1))
        reject_fixture(final_rel, lambda value: value.__setitem__("recommendation_generated", True))
        reject_fixture(final_rel, lambda value: value["non_effects"].__setitem__("game_action_executed", True))
        reject_fixture(start_rel, lambda value: value.__setitem__("session_id", "other-session"))
        reject_fixture(start_rel, lambda value: value["baseline"].__setitem__("historical_bytes_processed", 1))
        reject_fixture("runtime-collection-policy.json", lambda value: value.__setitem__("safe_effect", "LIVE_ACTION"))
        reject_fixture(
            "runtime-collection-policy.json",
            lambda value: value.__setitem__("safe_effect", "LIVE_ACTION"),
            bind_mutated_policy=True,
        )
        reject_fixture(
            "runtime-collection-policy.json",
            lambda value: value["denied_capabilities"].remove("game.process_memory_read"),
            bind_mutated_policy=True,
        )
        reject_fixture(
            "runtime-collection-policy.json",
            lambda value: value["checkpoint"].__setitem__("overwrite_allowed", True),
            bind_mutated_policy=True,
        )
        reject_fixture(
            "runtime-collection-policy.json",
            lambda value: value["resource_targets"].__setitem__("idle_total_cpu_percent", 25),
            bind_mutated_policy=True,
        )

        wrong_name = Path(temp) / "NOT_THE_SIDECAR"
        shutil.copytree(FIXTURE, wrong_name)
        wrong_context = ready_context(pilot_receipt, wrong_name)
        try:
            ingest.ingest_completed_session(pilot_receipt, wrong_context, wrong_name, config)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
        else:
            raise AssertionError("wrong sidecar identity accepted")

    print(
        "KONTUR external sandbox sidecar ingest validation: PASS; "
        f"external_reads={external_reads}; cli_runs={cli_runs}; "
        f"fail_closed_mutations={rejected_mutations}; "
        f"fixture_tree_digest={tree_digest(FIXTURE)}"
    )


if __name__ == "__main__":
    main()
