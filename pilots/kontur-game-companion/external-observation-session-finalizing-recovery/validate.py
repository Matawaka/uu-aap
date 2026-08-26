#!/usr/bin/env python3
"""Deterministic validation for finalizing control-metadata recovery."""

import ast
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RECOVER_PATH = HERE / "recover.py"
CONTROL_PATH = ROOT / "pilots/kontur-game-companion/external-observation-session/control.py"
FIXTURE = (
    ROOT
    / "pilots/kontur-game-companion/external-sandbox-sidecar-ingest/fixtures/synthetic-sidecar"
)
POLICY_SOURCE = (
    ROOT
    / "pilots/kontur-game-companion/external-observation-session/runtime-collection-policy.json"
)
FIXED_TIME = "2026-08-26T08:00:00.000Z"
DEAD_PID = 2_147_483_000


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise AssertionError("module unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


recover = loadmod("kontur_finalizing_recovery_validate", RECOVER_PATH)


def write_json(path, value):
    Path(path).write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def tree_digest(root):
    digest = hashlib.sha256()
    for item in sorted(path for path in Path(root).rglob("*") if path.is_file()):
        digest.update(item.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(item.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def prepare_case(root, *, pid=DEAD_PID, status="finalizing", mutate=None):
    root = Path(root)
    control_root = root / "control"
    sidecar_root = root / "KONTUR_PILOT_INFO"
    shutil.copytree(FIXTURE, sidecar_root)
    control_root.mkdir()
    session_id = "synthetic-complete"
    session_control = control_root / session_id
    session_control.mkdir()

    policy_path = sidecar_root / "runtime-collection-policy.json"
    policy_path.write_bytes(POLICY_SOURCE.read_bytes().replace(b"\r\n", b"\n"))
    policy_sha = hashlib.sha256(policy_path.read_bytes()).hexdigest()
    if policy_sha != recover.ingest.sha_bytes(policy_path.read_bytes()):
        raise AssertionError("policy digest helper")

    start_path = sidecar_root / "sessions/synthetic-complete/session-start.json"
    start = json.loads(start_path.read_text(encoding="utf-8"))
    start["policy_sha256"] = policy_sha
    write_json(start_path, start)

    final_path = sidecar_root / "sessions/synthetic-complete/session-final.json"
    final = json.loads(final_path.read_text(encoding="utf-8"))
    final["policy_sha256"] = policy_sha
    final["content_hash"] = "sha256:" + recover.sha({**final, "content_hash": None})
    write_json(final_path, final)

    checkpoint = {
        "schema_version": "0.1",
        "receipt_type": "sanitized_log_aggregate_checkpoint",
        "session_id": session_id,
        "sequence": 1,
        "kind": "final_checkpoint",
        "observed_at": final["ended_at"],
        "aggregate": copy.deepcopy(final["aggregate"]),
        "source_scope": "newly_appended_log_bytes_after_session_baseline",
        "content_hash": None,
        "non_effects": copy.deepcopy(final["non_effects"]),
    }
    checkpoint["content_hash"] = "sha256:" + recover.sha(checkpoint)
    write_json(
        sidecar_root / "sessions/synthetic-complete/checkpoint-000001.json",
        checkpoint,
    )

    token = "a" * 64
    state_path = session_control / "state.json"
    state = {
        "schema_version": "kontur-external-observation-runtime-state-v0.1",
        "session_id": session_id,
        "observer_pid": pid,
        "control_token_digest": recover.sha(
            {"kind": "KONTUR_OBSERVER_CONTROL_TOKEN_V0.1", "token": token}
        ),
        "status": status,
        "game_start_allowed": False,
        "aggregate": copy.deepcopy(final["aggregate"]),
        "non_effects": copy.deepcopy(final["non_effects"]),
    }
    write_json(state_path, state)
    current = {
        "schema_version": "kontur-external-observation-control-v0.1",
        "session_id": session_id,
        "observer_pid": pid,
        "state_path": str(state_path),
        "control_directory": str(session_control),
        "sidecar_session_relative_path": f"sessions/{session_id}",
        "control_token": token,
        "runtime_source": "external-observation-session-v0.1",
    }
    write_json(control_root / "current.json", current)
    if mutate is not None:
        mutate(
            {
                "control_root": control_root,
                "sidecar_root": sidecar_root,
                "session_control": session_control,
                "state_path": state_path,
                "final_path": final_path,
                "checkpoint_path": sidecar_root
                / "sessions/synthetic-complete/checkpoint-000001.json",
                "current_path": control_root / "current.json",
                "policy_sha": policy_sha,
                "session_id": session_id,
            }
        )
    return {
        "control_root": control_root,
        "sidecar_root": sidecar_root,
        "session_control": session_control,
        "state_path": state_path,
        "current_path": control_root / "current.json",
        "policy_sha": policy_sha,
        "session_id": session_id,
        "token": token,
    }


def apply(case, **overrides):
    arguments = {
        "control_root": case["control_root"],
        "sidecar_root": case["sidecar_root"],
        "session_id": case["session_id"],
        "expected_policy_sha256": case["policy_sha"],
        "human_decision": recover.HUMAN_DECISION,
        "confirm_observer_stopped": True,
        "confirm_session_data_read_only": True,
        "confirm_control_recovery_only": True,
        "recovered_at": FIXED_TIME,
    }
    arguments.update(overrides)
    return recover.apply_recovery(**arguments)


def assert_error(action):
    try:
        action()
    except (recover.FinalizingRecoveryError, recover.ingest.KonturExternalSandboxIngestError):
        return
    raise AssertionError("unsafe recovery input accepted")


def run_control(arguments):
    completed = subprocess.run(
        [sys.executable, str(CONTROL_PATH), *arguments],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=10,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )
    if completed.returncode != 0:
        raise AssertionError(f"control lifecycle failed: {completed.stdout!r} {completed.stderr!r}")
    return json.loads(completed.stdout.decode("utf-8"))


def validate_positive():
    with tempfile.TemporaryDirectory(prefix="kontur-finalizing-recovery-") as name:
        case = prepare_case(name)
        source_state_before = case["state_path"].read_bytes()
        sidecar_before = tree_digest(case["sidecar_root"])
        result = apply(case)
        if result["status"] != "FINALIZING_CONTROL_STATE_RECOVERED":
            raise AssertionError("positive recovery status")
        if result["current_pointer_updated"] is not True:
            raise AssertionError("current pointer marker")
        if any(
            result[field] is not False
            for field in (
                "source_state_modified",
                "session_data_modified",
                "sidecar_files_modified",
                "new_observation_authorized",
            )
        ):
            raise AssertionError("recovery overclaim")
        if any(
            result[field] != "NONE"
            for field in ("authority_effect", "action_effect", "successor_effect")
        ):
            raise AssertionError("recovery causal effect")
        if case["state_path"].read_bytes() != source_state_before:
            raise AssertionError("source state changed")
        if tree_digest(case["sidecar_root"]) != sidecar_before:
            raise AssertionError("sidecar changed")

        receipt_path = case["session_control"] / "finalizing-recovery-receipt.json"
        recovered_state_path = case["session_control"] / "recovered-state.json"
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        recovered_state = json.loads(recovered_state_path.read_text(encoding="utf-8"))
        recover.validate_recovery_receipt(receipt)
        recover.validate_recovered_state(recovered_state, receipt)
        current = json.loads(case["current_path"].read_text(encoding="utf-8"))
        if Path(current["state_path"]) != recovered_state_path:
            raise AssertionError("current state not repointed")
        if current["control_token"] != case["token"]:
            raise AssertionError("existing control token changed")
        if current["runtime_source"] != "external-observation-session-finalizing-recovery-v0.1":
            raise AssertionError("recovery runtime source")
        if recovered_state["tail_catchup_complete"] is not True:
            raise AssertionError("tail continuity not materialized")

        current_before_control = case["current_path"].read_bytes()
        recovered_state_before_control = recovered_state_path.read_bytes()
        receipt_before_control = receipt_path.read_bytes()
        stop_path = case["session_control"] / "stop.request"
        if stop_path.exists():
            raise AssertionError("synthetic recovery unexpectedly has a stop request")
        status = run_control(["status", "--control-root", str(case["control_root"])])
        if status["status"] != "stopped_recovered" or status["observer_running"] is not False:
            raise AssertionError("recovered status control compatibility")
        stopped = run_control(
            [
                "stop",
                "--control-root",
                str(case["control_root"]),
                "--stop-timeout-seconds",
                "1",
            ]
        )
        if stopped != recovered_state:
            raise AssertionError("recovered stop must return the terminal state unchanged")
        if stop_path.exists():
            raise AssertionError("terminal recovered stop created a new stop request")
        if case["current_path"].read_bytes() != current_before_control:
            raise AssertionError("terminal status/stop changed current control")
        if recovered_state_path.read_bytes() != recovered_state_before_control:
            raise AssertionError("terminal status/stop changed recovered state")
        if receipt_path.read_bytes() != receipt_before_control:
            raise AssertionError("terminal status/stop changed recovery receipt")
        if case["state_path"].read_bytes() != source_state_before:
            raise AssertionError("terminal status/stop changed source state")
        if tree_digest(case["sidecar_root"]) != sidecar_before:
            raise AssertionError("terminal status/stop changed sidecar")
        assert_error(lambda: apply(case))
        return result


def validate_mutations():
    rejected = 0

    def reject(*, prepare_kwargs=None, mutate=None, apply_kwargs=None):
        nonlocal rejected
        with tempfile.TemporaryDirectory(prefix="kontur-finalizing-reject-") as name:
            case = prepare_case(name, mutate=mutate, **(prepare_kwargs or {}))
            before = tree_digest(case["sidecar_root"])
            assert_error(lambda: apply(case, **(apply_kwargs or {})))
            if tree_digest(case["sidecar_root"]) != before:
                raise AssertionError("rejected recovery changed sidecar")
            if (case["session_control"] / "recovered-state.json").exists():
                raise AssertionError("rejected recovery created recovered state")
            rejected += 1

    reject(apply_kwargs={"human_decision": "NONE"})
    reject(apply_kwargs={"confirm_observer_stopped": False})
    reject(apply_kwargs={"confirm_session_data_read_only": False})
    reject(apply_kwargs={"confirm_control_recovery_only": False})
    reject(prepare_kwargs={"status": "collecting"})
    reject(prepare_kwargs={"status": "stopped"})
    reject(prepare_kwargs={"pid": os.getpid()})
    reject(apply_kwargs={"session_id": "wrong-session"})
    reject(apply_kwargs={"expected_policy_sha256": "0" * 64})

    def remove_final(values):
        values["final_path"].unlink()

    reject(mutate=remove_final)

    def remove_checkpoint(values):
        values["checkpoint_path"].unlink()

    reject(mutate=remove_checkpoint)

    def mismatch_checkpoint(values):
        value = json.loads(values["checkpoint_path"].read_text(encoding="utf-8"))
        value["aggregate"]["lines_processed"] += 1
        value["content_hash"] = "sha256:" + recover.sha({**value, "content_hash": None})
        write_json(values["checkpoint_path"], value)

    reject(mutate=mismatch_checkpoint)

    def unsafe_final(values):
        value = json.loads(values["final_path"].read_text(encoding="utf-8"))
        value["raw_lines_stored"] = True
        value["content_hash"] = "sha256:" + recover.sha({**value, "content_hash": None})
        write_json(values["final_path"], value)

    reject(mutate=unsafe_final)

    def bad_token(values):
        value = json.loads(values["current_path"].read_text(encoding="utf-8"))
        value["control_token"] = "b" * 64
        write_json(values["current_path"], value)

    reject(mutate=bad_token)

    def preexisting_receipt(values):
        write_json(values["session_control"] / "finalizing-recovery-receipt.json", {})

    reject(mutate=preexisting_receipt)
    return rejected


def validate_cli():
    with tempfile.TemporaryDirectory(prefix="kontur-finalizing-cli-") as name:
        case = prepare_case(name)
        command = [
            sys.executable,
            str(RECOVER_PATH),
            "--control-root",
            str(case["control_root"]),
            "--sidecar-root",
            str(case["sidecar_root"]),
            "--session-id",
            case["session_id"],
            "--expected-policy-sha256",
            case["policy_sha"],
            "--human-decision",
            recover.HUMAN_DECISION,
            "--confirm-observer-stopped",
            "--confirm-session-data-read-only",
            "--confirm-control-recovery-only",
        ]
        completed = subprocess.run(
            command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=20,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )
        if completed.returncode != 0:
            raise AssertionError(f"recovery CLI failed: {completed.stderr!r}")
        output = json.loads(completed.stdout.decode("utf-8"))
        if output["status"] != "FINALIZING_CONTROL_STATE_RECOVERED":
            raise AssertionError("recovery CLI status")


def validate_source_surface():
    source = RECOVER_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])
    forbidden = {"socket", "subprocess", "requests", "urllib", "http", "openai", "psutil"}
    if imports.intersection(forbidden):
        raise AssertionError("recovery runtime external capability import")
    for forbidden_text in (
        "ScrapMechanic.exe",
        "Get-Process",
        "game.launch",
        "message_send",
        "recommendation_generation",
    ):
        if forbidden_text in source:
            raise AssertionError(f"forbidden recovery surface: {forbidden_text}")


def main():
    if recover.process_liveness(os.getpid()) != "RUNNING":
        raise AssertionError("live process liveness probe")
    positive = validate_positive()
    rejected = validate_mutations()
    validate_cli()
    validate_source_surface()
    print(
        "KONTUR finalizing control recovery: PASS; "
        f"recovered=1; rejected_mutations={rejected}; "
        "source_state_modified=0; sidecar_files_modified=0; "
        "control_terminal_roundtrips=2; terminal_control_writes=0; "
        "tail_catchup_continuity_proven=true; new_observation_authorized=false; "
        f"result_digest={positive['recovery_result_digest']}"
    )


if __name__ == "__main__":
    main()
