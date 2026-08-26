#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTROL = HERE / "control.py"
OBSERVER = HERE / "observer.js"
CONFIG_PATH = HERE / "runtime-config.json"
POLICY_PATH = HERE / "runtime-collection-policy.json"
INGEST_PATH = HERE.parent / "external-sandbox-sidecar-ingest" / "ingest.py"
RECOVERY_VALIDATE = HERE.parent / "external-observation-session-finalizing-recovery" / "validate.py"
DECISION = "ALLOW_THIS_BOUNDED_SANITIZED_LOG_OBSERVATION_SESSION"

FALSE_FIELDS = (
    "raw_log_persistence",
    "identifier_value_persistence",
    "game_launch",
    "game_process_attach",
    "game_process_memory_read",
    "network_access",
    "screen_capture",
    "audio_capture",
    "microphone_capture",
    "input_emulation",
    "game_file_modification",
    "recommendation_generation",
    "message_send",
    "game_action_execution",
    "automatic_retry",
)


def req(condition, message):
    if not condition:
        raise ValueError(message)


def validate_config(config):
    req(isinstance(config, dict), "runtime config object")
    req(
        config.get("schema_version")
        == "kontur-game-companion-external-observation-session-runtime-v0.1",
        "runtime schema",
    )
    expected = {
        "runtime_mode": "BOUNDED_EXTERNAL_SANITIZED_LOG_OBSERVATION",
        "source_scope": "NEWLY_APPENDED_LOG_BYTES_AFTER_SESSION_BASELINE_ONLY",
        "output_scope": "CREATE_ONLY_SANITIZED_JSON_RECEIPTS",
        "sidecar_directory_name": "KONTUR_PILOT_INFO",
        "polling_fallback_seconds": 30,
        "control_signal_seconds": 2,
        "resource_sample_seconds": 5,
        "max_duration_seconds": 14400,
        "max_read_chunk_bytes": 262144,
        "max_session_bytes": 67108864,
        "max_final_catchup_bytes": 16777216,
        "max_partial_line_chars": 65536,
        "max_log_files": 128,
        "max_checkpoints": 4096,
        "idle_cpu_percent_limit": 0.3,
        "idle_cpu_consecutive_limit": 3,
        "working_set_mib_limit": 100,
    }
    for field, value in expected.items():
        req(config.get(field) == value, f"runtime boundary: {field}")
    for field in FALSE_FIELDS:
        req(config.get(field) is False, f"runtime non-effect: {field}")
    req(set(config) == {"schema_version", *expected, *FALSE_FIELDS}, "runtime config exact keys")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def wait_state(path, statuses, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            state = read_json(path)
        except (FileNotFoundError, json.JSONDecodeError):
            time.sleep(0.1)
            continue
        if state.get("status") in statuses:
            return state
        time.sleep(0.1)
    raise AssertionError(f"state did not reach {statuses}")


def run_control(arguments, check=True):
    completed = subprocess.run(
        [sys.executable, str(CONTROL), *arguments],
        check=False,
        capture_output=True,
        text=True,
        timeout=45,
    )
    if check and completed.returncode != 0:
        raise AssertionError(
            f"control failed ({completed.returncode}): {completed.stdout} {completed.stderr}"
        )
    return completed


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    control = loadmod("kontur_external_observation_control_validate", CONTROL)
    assert control.ACTIVE_SESSION_STATUSES == frozenset(
        {"ready_for_game_start", "collecting", "finalizing"}
    )
    assert control.TERMINAL_SESSION_STATUSES == frozenset(
        {"stopped", "faulted", "stopped_recovered"}
    )
    assert control.ACTIVE_SESSION_STATUSES.isdisjoint(control.TERMINAL_SESSION_STATUSES)

    config = read_json(CONFIG_PATH)
    validate_config(config)
    policy = read_json(POLICY_PATH)
    assert policy["policy_id"] == "kontur-scrap-mechanic-bounded-log-session-v0.1"
    assert policy["session"]["game_launch_by_observer"] is False
    assert policy["observation"]["new_log_bytes_only"] is True
    assert policy["observation"]["raw_lines_retained_after_classification"] is False
    assert policy["resource_targets"]["budget_violation_effect"] == "stop_session_and_record_unverified_resource_result"

    source = OBSERVER.read_text(encoding="utf-8")
    for forbidden in (
        'require("net")', 'require("http")', 'require("https")', 'require("dgram")',
        'require("child_process")', "process.stdin", "WebSocket", "fetch(",
    ):
        assert forbidden not in source, f"forbidden observer surface: {forbidden}"
    assert "Buffer.alloc(length)" in source
    assert "config.max_read_chunk_bytes" in source
    assert "config.max_session_bytes" in source
    assert "config.max_final_catchup_bytes" in source
    assert "config.working_set_mib_limit" in source
    finalize_start = source.index("function finalize(reason")
    final_scan = source.index("scanLogs();", finalize_start)
    finalized_true = source.index("finalized = true;", finalize_start)
    assert final_scan < finalized_true, "tail scan must precede finalized marker"

    rejected_mutations = 0
    config_mutations = [
        lambda value: value.__setitem__("runtime_mode", "LIVE_GAME_CONTROL"),
        lambda value: value.__setitem__("source_scope", "TOTAL_HISTORY"),
        lambda value: value.__setitem__("output_scope", "RAW_LOGS"),
        lambda value: value.__setitem__("polling_fallback_seconds", 0),
        lambda value: value.__setitem__("control_signal_seconds", 60),
        lambda value: value.__setitem__("resource_sample_seconds", 300),
        lambda value: value.__setitem__("max_duration_seconds", 999999),
        lambda value: value.__setitem__("max_read_chunk_bytes", 99999999),
        lambda value: value.__setitem__("max_session_bytes", 999999999),
        lambda value: value.__setitem__("max_final_catchup_bytes", 999999999),
        lambda value: value.__setitem__("max_partial_line_chars", 99999999),
        lambda value: value.__setitem__("max_log_files", 999999),
        lambda value: value.__setitem__("max_checkpoints", 999999),
        lambda value: value.__setitem__("idle_cpu_percent_limit", 100),
        lambda value: value.__setitem__("working_set_mib_limit", 10000),
        lambda value: value.__setitem__("unexpected_capability", True),
    ]
    for field in FALSE_FIELDS:
        config_mutations.append(lambda value, key=field: value.__setitem__(key, True))
    for mutation in config_mutations:
        candidate = copy.deepcopy(config)
        try:
            mutation(candidate)
            validate_config(candidate)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
        else:
            raise AssertionError("unsafe runtime config mutation accepted")

    node = shutil.which("node")
    assert node, "Node.js required for observer validation"
    raw_identifier = "12345678901234567"
    control_root = None
    with tempfile.TemporaryDirectory(prefix="kontur-observation-runtime-") as temp:
        temp_root = Path(temp)
        game_root = temp_root / "game"
        release = game_root / "Release"
        logs = game_root / "Logs"
        sidecar = release / "KONTUR_PILOT_INFO"
        control_root = temp_root / "control"
        for directory in (release, logs, sidecar, control_root):
            directory.mkdir(parents=True, exist_ok=True)
        (release / "ScrapMechanic.exe").write_bytes(b"synthetic executable fixture")
        shutil.copyfile(POLICY_PATH, sidecar / "runtime-collection-policy.json")
        historical = logs / "game-synthetic.log"
        historical.write_text("[Error] historical player line must be skipped\n", encoding="utf-8")

        start = run_control([
            "start",
            "--game-root", str(game_root),
            "--sidecar-root", str(sidecar),
            "--control-root", str(control_root),
            "--node-path", node,
            "--max-seconds", "120",
            "--human-decision", DECISION,
            "--confirm-game-stopped",
            "--confirm-new-bytes-only",
            "--confirm-no-process-network-input-or-raw-retention",
        ])
        ready = json.loads(start.stdout)
        assert ready["status"] == "ready_for_game_start"
        current = read_json(control_root / "current.json")
        session_id = current["session_id"]
        state_path = Path(current["state_path"])
        session_dir = sidecar / "sessions" / session_id
        start_receipt = read_json(session_dir / "session-start.json")
        assert start_receipt["baseline"]["historical_bytes_processed"] == 0
        assert start_receipt["baseline"]["existing_log_file_count"] == 1

        with historical.open("a", encoding="utf-8") as target:
            target.write("[Default] Initializing PlayerManager\n")
            target.write(f"[Default] Loaded player for user {raw_identifier}\n")
            target.write("[World] Added world 1 to RequestManager\n")
        new_log = logs / "game-synthetic-new.log"
        new_log.write_text("[Default] Join request accepted\n", encoding="utf-8")
        collected = wait_state(state_path, {"collecting"})
        assert collected["aggregate"]["lines_processed"] >= 4
        assert collected["aggregate"]["severity_counts"]["error"] == 0

        # Append a no-newline tail and stop immediately. Finalization must catch and classify it.
        with new_log.open("a", encoding="utf-8") as target:
            target.write("[Default] Cleaning up PlayerManager")
        stopped_result = run_control(["stop", "--control-root", str(control_root)])
        stopped = json.loads(stopped_result.stdout)
        assert stopped["status"] == "stopped"
        assert stopped["stop_reason"] == "stop_requested"
        assert stopped["tail_catchup_complete"] is True
        assert stopped["aggregate"]["lifecycle_counts"]["player_manager_cleanup"] == 1
        assert stopped["aggregate"]["sensitive_identifier_line_count"] == 1
        assert stopped["aggregate"]["severity_counts"]["error"] == 0
        assert stopped["aggregate"]["lines_processed"] == 5
        assert stopped["observer_pid"] == current["observer_pid"]

        final_path = session_dir / "session-final.json"
        final_text = final_path.read_text(encoding="utf-8")
        final = json.loads(final_text)
        assert final["stop_reason"] == "stop_requested"
        assert final["aggregate"]["lines_processed"] == 5
        assert final["aggregate"]["raw_lines_stored"] is False
        assert final["aggregate"]["identifier_values_stored"] is False
        assert final["raw_lines_stored"] is False
        assert final["identifier_values_stored"] is False
        assert final["game_action_executed"] is False
        assert final["recommendation_generated"] is False
        assert raw_identifier not in final_text
        assert "historical player line" not in final_text
        assert final["non_effects"]["game_process_attached"] is False
        assert final["non_effects"]["network_traffic_observed"] is False
        assert final["non_effects"]["input_emulated"] is False
        assert final["aggregate"]["log_files_observed"] == ["log-001.log", "log-002.log"]
        assert "game-synthetic" not in final_text

        ingest = loadmod("kontur_observation_roundtrip_ingest", INGEST_PATH)
        pilot_receipt = ingest.local_run.execute("synthetic-ready")
        ingest_context = ingest.default_ingest_context(pilot_receipt)
        ingest_context["external_sandbox_ingest_requested"] = True
        ingest_context["human_external_sandbox_decision"] = ingest.HUMAN_DECISION
        ingest_context["session_id"] = session_id
        ingest_context["expected_policy_sha256"] = hashlib.sha256(
            (sidecar / "runtime-collection-policy.json").read_bytes()
        ).hexdigest()
        ingest_context["sidecar_root_reference_digest"] = ingest.sidecar_root_reference_digest(sidecar)
        for field in ingest.PRECHECK_FIELDS:
            ingest_context[field] = True
        roundtrip = ingest.ingest_completed_session(
            pilot_receipt, ingest_context, sidecar
        )
        assert roundtrip["decision"] == "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED"
        assert roundtrip["sanitized_summary"]["lines_processed"] == 5
        assert roundtrip["game_process_accessed"] is False
        assert roundtrip["network_io_performed"] is False

        status = json.loads(run_control(["status", "--control-root", str(control_root)]).stdout)
        assert status["status"] == "stopped"
        assert status["game_start_allowed"] is False

    recovery_validation = subprocess.run(
        [sys.executable, str(RECOVERY_VALIDATE)],
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )
    if recovery_validation.returncode != 0:
        raise AssertionError(
            "finalizing recovery lifecycle validation failed: "
            f"{recovery_validation.stdout} {recovery_validation.stderr}"
        )
    assert "control_terminal_roundtrips=2" in recovery_validation.stdout
    assert "terminal_control_writes=0" in recovery_validation.stdout

    print(
        "KONTUR external observation session validation: PASS; "
        "synthetic_sessions=1; tail_race_cases=1; ingest_roundtrips=1; cli_controls=3; "
        "active_statuses=3; terminal_statuses=3; status_sets_disjoint=true; "
        "recovery_lifecycle_validators=1; recovered_terminal_roundtrips=2; "
        f"fail_closed_mutations={rejected_mutations}"
    )


if __name__ == "__main__":
    main()
