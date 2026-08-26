#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import secrets
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OBSERVER = HERE / "observer.js"
RUNTIME_CONFIG = HERE / "runtime-config.json"
SOURCE_POLICY = HERE / "runtime-collection-policy.json"
HUMAN_DECISION = "ALLOW_THIS_BOUNDED_SANITIZED_LOG_OBSERVATION_SESSION"
ACTIVE_SESSION_STATUSES = frozenset({"ready_for_game_start", "collecting", "finalizing"})
TERMINAL_SESSION_STATUSES = frozenset({"stopped", "faulted", "stopped_recovered"})


class ControlError(RuntimeError):
    pass


def req(condition, message):
    if not condition:
        raise ControlError(message)


def read_json(path):
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    req(isinstance(value, dict), f"JSON object required: {path}")
    return value


def sha_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        while chunk := source.read(65536):
            digest.update(chunk)
    return digest.hexdigest()


def ordinary_directory(path, expected_name=None):
    value = Path(path)
    req(value.exists() and value.is_dir(), f"directory required: {value}")
    req(not value.is_symlink(), f"symlink directory denied: {value}")
    if hasattr(value, "is_junction"):
        req(not value.is_junction(), f"junction directory denied: {value}")
    resolved = value.resolve(strict=True)
    if expected_name is not None:
        req(resolved.name == expected_name, f"directory identity must be {expected_name}")
    return resolved


def require_fixed_local_drive(path):
    if os.name != "nt":
        return
    import ctypes

    root = Path(path).anchor
    req(root and not str(path).startswith(("\\\\", "//")), "UNC path denied")
    drive_type = ctypes.windll.kernel32.GetDriveTypeW(str(root))
    req(drive_type == 3, "external observation paths must be on a fixed local drive")


def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def process_alive(pid):
    if type(pid) is not int or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def game_running():
    if os.name != "nt":
        return False
    import ctypes
    from ctypes import wintypes

    class ProcessEntry32W(ctypes.Structure):
        _fields_ = [
            ("dwSize", wintypes.DWORD),
            ("cntUsage", wintypes.DWORD),
            ("th32ProcessID", wintypes.DWORD),
            ("th32DefaultHeapID", ctypes.c_size_t),
            ("th32ModuleID", wintypes.DWORD),
            ("cntThreads", wintypes.DWORD),
            ("th32ParentProcessID", wintypes.DWORD),
            ("pcPriClassBase", ctypes.c_long),
            ("dwFlags", wintypes.DWORD),
            ("szExeFile", wintypes.WCHAR * 260),
        ]

    kernel32 = ctypes.windll.kernel32
    snapshot = kernel32.CreateToolhelp32Snapshot(0x00000002, 0)
    req(snapshot not in (0, -1), "process snapshot unavailable; cannot verify stopped game")
    try:
        entry = ProcessEntry32W()
        entry.dwSize = ctypes.sizeof(entry)
        present = kernel32.Process32FirstW(snapshot, ctypes.byref(entry))
        while present:
            if entry.szExeFile.casefold() == "scrapmechanic.exe":
                return True
            present = kernel32.Process32NextW(snapshot, ctypes.byref(entry))
        return False
    finally:
        kernel32.CloseHandle(snapshot)


def load_current(control_root):
    current_path = Path(control_root) / "current.json"
    return read_json(current_path) if current_path.exists() else None


def load_state(current):
    path = Path(current["state_path"])
    return read_json(path) if path.exists() else None


def terminate_observer(process, stop_path, token):
    try:
        with Path(stop_path).open("x", encoding="utf-8") as target:
            target.write(token + "\n")
    except FileExistsError:
        pass
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline and process.poll() is None:
        time.sleep(0.1)
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def start(args):
    req(args.human_decision == HUMAN_DECISION, "exact bounded human decision required")
    req(args.confirm_game_stopped, "game-stopped confirmation required")
    req(args.confirm_new_bytes_only, "new-bytes-only confirmation required")
    req(
        args.confirm_no_process_network_input_or_raw_retention,
        "process/network/input/raw-retention boundary confirmation required",
    )
    req(not game_running(), "Scrap Mechanic is already running; observer must baseline first")

    config = read_json(RUNTIME_CONFIG)
    policy = read_json(SOURCE_POLICY)
    req(config.get("schema_version") == "kontur-game-companion-external-observation-session-runtime-v0.1", "runtime config schema")
    req(policy.get("policy_id") == "kontur-scrap-mechanic-bounded-log-session-v0.1", "policy id")
    req(0 < args.max_seconds <= min(config["max_duration_seconds"], policy["session"]["maximum_duration_seconds"]), "bounded duration")

    game_root = ordinary_directory(args.game_root)
    require_fixed_local_drive(game_root)
    ordinary_directory(game_root / "Release")
    ordinary_directory(game_root / "Logs")
    sidecar_root = ordinary_directory(args.sidecar_root, config["sidecar_directory_name"])
    require_fixed_local_drive(sidecar_root)
    expected_sidecar = (game_root / "Release" / config["sidecar_directory_name"]).resolve(strict=True)
    req(os.path.normcase(str(sidecar_root)) == os.path.normcase(str(expected_sidecar)), "sidecar placement mismatch")
    sidecar_policy = sidecar_root / "runtime-collection-policy.json"
    req(sidecar_policy.exists() and sidecar_policy.is_file(), "sidecar runtime policy required")
    req(read_json(sidecar_policy) == policy, "sidecar policy semantic mismatch")

    control_root = Path(args.control_root).resolve(strict=False)
    control_root.mkdir(parents=True, exist_ok=True)
    control_root = ordinary_directory(control_root)
    require_fixed_local_drive(control_root)
    lock_path = control_root / "start.lock"
    try:
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise ControlError("start lock already exists; concurrent or interrupted start requires review") from exc
    try:
        os.close(lock_fd)
        current = load_current(control_root)
        if current is not None:
            state = load_state(current)
            if state and state.get("status") in ACTIVE_SESSION_STATUSES:
                req(not process_alive(current.get("observer_pid")), "an observation session is already active")
                raise ControlError("stale active session state requires review; no automatic replacement")

        session_id = (
            "scrap-" + time.strftime("%Y%m%d-%H%M%SZ", time.gmtime()) + "-" + secrets.token_hex(4)
        ).lower()
        token = secrets.token_hex(32)
        session_control = control_root / session_id
        session_control.mkdir()
        state_path = session_control / "state.json"
        stop_path = session_control / "stop.request"
        node_path = Path(args.node_path).resolve(strict=True)
        command = [
            str(node_path), str(OBSERVER),
            "--game-root", str(game_root),
            "--sidecar", str(sidecar_root),
            "--state-dir", str(session_control),
            "--session-id", session_id,
            "--policy", str(sidecar_policy),
            "--runtime-config", str(RUNTIME_CONFIG),
            "--max-seconds", str(args.max_seconds),
            "--control-token", token,
        ]
        creationflags = 0
        if os.name == "nt":
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
            creationflags=creationflags,
        )
        deadline = time.monotonic() + args.ready_timeout_seconds
        state = None
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise ControlError(f"observer exited before readiness with code {process.returncode}")
            if state_path.exists():
                state = read_json(state_path)
                if state.get("status") == "ready_for_game_start":
                    current = {
                        "schema_version": "kontur-external-observation-control-v0.1",
                        "session_id": session_id,
                        "observer_pid": process.pid,
                        "state_path": str(state_path),
                        "control_directory": str(session_control),
                        "sidecar_session_relative_path": f"sessions/{session_id}",
                        "control_token": token,
                        "runtime_source": "external-observation-session-v0.1",
                    }
                    atomic_json(control_root / "current.json", current)
                    return state
                if state.get("status") == "faulted":
                    raise ControlError(f"observer faulted during readiness: {state.get('fault_class')}")
            time.sleep(0.1)
        raise ControlError("observer readiness timeout")
    except Exception:
        if "process" in locals() and process.poll() is None:
            terminate_observer(process, stop_path, token)
        raise
    finally:
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass


def status(args):
    control_root = Path(args.control_root).resolve(strict=False)
    current = load_current(control_root)
    if current is None:
        return {"status": "not_started", "game_start_allowed": False}
    state = load_state(current)
    if state is None:
        return {
            "status": "state_missing",
            "session_id": current.get("session_id"),
            "observer_running": process_alive(current.get("observer_pid")),
            "game_start_allowed": False,
        }
    result = dict(state)
    result["observer_running"] = process_alive(current.get("observer_pid"))
    return result


def stop(args):
    control_root = Path(args.control_root).resolve(strict=False)
    current = load_current(control_root)
    if current is None:
        return {"status": "not_started", "stop_requested": False}
    state = load_state(current)
    if state and state.get("status") in TERMINAL_SESSION_STATUSES:
        return state
    stop_path = Path(current["control_directory"]) / "stop.request"
    try:
        with stop_path.open("x", encoding="utf-8") as target:
            target.write(current["control_token"] + "\n")
    except FileExistsError:
        pass
    deadline = time.monotonic() + args.stop_timeout_seconds
    while time.monotonic() < deadline:
        state = load_state(current)
        if state and state.get("status") in TERMINAL_SESSION_STATUSES:
            return state
        time.sleep(0.1)
    raise ControlError("observer did not stop cooperatively; no game process was terminated")


def main():
    parser = argparse.ArgumentParser(description="Control one bounded KONTUR observation session.")
    sub = parser.add_subparsers(dest="command", required=True)
    start_parser = sub.add_parser("start")
    start_parser.add_argument("--game-root", required=True)
    start_parser.add_argument("--sidecar-root", required=True)
    start_parser.add_argument("--control-root", required=True)
    start_parser.add_argument("--node-path", required=True)
    start_parser.add_argument("--max-seconds", type=int, default=14400)
    start_parser.add_argument("--ready-timeout-seconds", type=int, default=30)
    start_parser.add_argument("--human-decision", choices=(HUMAN_DECISION,), required=True)
    start_parser.add_argument("--confirm-game-stopped", action="store_true")
    start_parser.add_argument("--confirm-new-bytes-only", action="store_true")
    start_parser.add_argument("--confirm-no-process-network-input-or-raw-retention", action="store_true")
    start_parser.set_defaults(func=start)
    status_parser = sub.add_parser("status")
    status_parser.add_argument("--control-root", required=True)
    status_parser.set_defaults(func=status)
    stop_parser = sub.add_parser("stop")
    stop_parser.add_argument("--control-root", required=True)
    stop_parser.add_argument("--stop-timeout-seconds", type=int, default=20)
    stop_parser.set_defaults(func=stop)
    args = parser.parse_args()
    try:
        result = args.func(args)
    except (ControlError, OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({"status": "control_error", "error_class": type(exc).__name__, "error": str(exc)}, sort_keys=True))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
