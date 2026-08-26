#!/usr/bin/env python3
"""Fail-closed recovery for a dead observer left at ``finalizing``.

The adapter validates completed sidecar evidence, creates new control metadata,
and atomically repoints ``current.json``. It never edits the original runtime
state or any file below the sidecar root.
"""

import argparse
import ctypes
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys


sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
PILOT_ROOT = HERE.parent
INGEST_PATH = PILOT_ROOT / "external-sandbox-sidecar-ingest" / "ingest.py"
MAX_JSON_BYTES = 256 * 1024
SESSION_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,95}$")
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
CHECKPOINT_RE = re.compile(r"^checkpoint-([0-9]{6})\.json$")

HUMAN_DECISION = "ALLOW_THIS_FINALIZING_RECOVERY_WITH_VALID_SESSION_FINAL"
RECOVERY_RECEIPT_SCHEMA = (
    "kontur-game-companion-external-observation-finalizing-recovery-receipt-v0.1"
)
RECOVERED_STATE_SCHEMA = (
    "kontur-game-companion-external-observation-recovered-state-v0.1"
)
RESULT_SCHEMA = (
    "kontur-game-companion-external-observation-finalizing-recovery-result-v0.1"
)


class FinalizingRecoveryError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise FinalizingRecoveryError(message)


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    req(spec is not None and spec.loader is not None, "required module unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ingest = loadmod("kontur_finalizing_recovery_ingest", INGEST_PATH)


def canon(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha(value):
    return hashlib.sha256(canon(value).encode("utf-8")).hexdigest()


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def _unique_object(pairs):
    value = {}
    for key, item in pairs:
        req(key not in value, "duplicate JSON key")
        value[key] = item
    return value


def _reject_constant(value):
    raise FinalizingRecoveryError(f"non-finite JSON constant: {value}")


def _is_reparse(file_stat):
    return bool(getattr(file_stat, "st_file_attributes", 0) & 0x400)


def ordinary_directory(path):
    candidate = Path(path)
    try:
        before = candidate.lstat()
        resolved = candidate.resolve(strict=True)
        after = resolved.lstat()
    except OSError as exc:
        raise FinalizingRecoveryError("ordinary directory unavailable") from exc
    req(stat.S_ISDIR(before.st_mode) and stat.S_ISDIR(after.st_mode), "ordinary directory required")
    req(not candidate.is_symlink() and not _is_reparse(before), "linked directory denied")
    return resolved


def read_bounded_json(path, expected_parent=None):
    candidate = Path(path)
    try:
        before = candidate.lstat()
        resolved = candidate.resolve(strict=True)
    except OSError as exc:
        raise FinalizingRecoveryError("bounded JSON file unavailable") from exc
    req(stat.S_ISREG(before.st_mode), "ordinary JSON file required")
    req(not candidate.is_symlink() and not _is_reparse(before), "linked JSON file denied")
    if expected_parent is not None:
        req(resolved.parent == Path(expected_parent), "JSON path escaped expected parent")
    req(before.st_size <= MAX_JSON_BYTES, "JSON file exceeds 256 KiB")
    try:
        with resolved.open("rb", buffering=0) as stream:
            opened = os.fstat(stream.fileno())
            req(stat.S_ISREG(opened.st_mode) and not _is_reparse(opened), "ordinary open JSON required")
            req((before.st_dev, before.st_ino) == (opened.st_dev, opened.st_ino), "JSON changed before read")
            raw = stream.read(MAX_JSON_BYTES + 1)
    except FinalizingRecoveryError:
        raise
    except OSError as exc:
        raise FinalizingRecoveryError("bounded JSON read failed") from exc
    req(len(raw) <= MAX_JSON_BYTES, "JSON file exceeds 256 KiB")
    try:
        value = json.loads(
            raw.decode("utf-8-sig"),
            object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FinalizingRecoveryError("strict JSON required") from exc
    req(isinstance(value, dict), "JSON object required")
    return value, raw, resolved


def process_liveness(pid):
    req(type(pid) is int and pid > 0, "bounded observer pid required")
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return "RUNNING"
        except ProcessLookupError:
            return "NOT_RUNNING"
        except PermissionError:
            return "UNKNOWN"
        except OSError:
            return "UNKNOWN"

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    open_process = kernel32.OpenProcess
    open_process.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
    open_process.restype = ctypes.c_void_p
    get_exit_code = kernel32.GetExitCodeProcess
    get_exit_code.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
    get_exit_code.restype = ctypes.c_int
    close_handle = kernel32.CloseHandle
    close_handle.argtypes = [ctypes.c_void_p]
    close_handle.restype = ctypes.c_int
    handle = open_process(0x1000, 0, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        error = ctypes.get_last_error()
        return "NOT_RUNNING" if error == 87 else "UNKNOWN"
    try:
        exit_code = ctypes.c_uint32()
        if not get_exit_code(handle, ctypes.byref(exit_code)):
            return "UNKNOWN"
        return "RUNNING" if exit_code.value == 259 else "NOT_RUNNING"
    finally:
        close_handle(handle)


def validate_current(current, control_root, session_id):
    expected = {
        "schema_version",
        "session_id",
        "observer_pid",
        "state_path",
        "control_directory",
        "sidecar_session_relative_path",
        "control_token",
        "runtime_source",
    }
    req(set(current) == expected, "current control exact keys")
    req(current["schema_version"] == "kontur-external-observation-control-v0.1", "current schema")
    req(current["session_id"] == session_id, "current session")
    req(current["runtime_source"] == "external-observation-session-v0.1", "current runtime source")
    req(HEX64_RE.fullmatch(current["control_token"] or ""), "current control token")
    session_control = ordinary_directory(control_root / session_id)
    req(Path(current["control_directory"]).resolve(strict=True) == session_control, "current control directory")
    state_path = Path(current["state_path"]).resolve(strict=True)
    req(state_path.parent == session_control and state_path.name == "state.json", "current state path")
    req(
        current["sidecar_session_relative_path"] == f"sessions/{session_id}",
        "current sidecar session reference",
    )
    return session_control, state_path


def validate_source_state(state, current, session_id):
    req(state.get("schema_version") == "kontur-external-observation-runtime-state-v0.1", "state schema")
    req(state.get("session_id") == session_id, "state session")
    req(state.get("observer_pid") == current["observer_pid"], "state observer pid")
    req(state.get("status") == "finalizing", "only finalizing state is recoverable")
    req(state.get("game_start_allowed") is False, "finalizing cannot allow game start")
    expected_token_digest = sha(
        {"kind": "KONTUR_OBSERVER_CONTROL_TOKEN_V0.1", "token": current["control_token"]}
    )
    req(state.get("control_token_digest") == expected_token_digest, "control token continuity")
    aggregate = state.get("aggregate")
    req(isinstance(aggregate, dict), "state aggregate")
    req(aggregate.get("raw_lines_stored") is False, "state raw lines denied")
    req(aggregate.get("identifier_values_stored") is False, "state identifier values denied")
    effects = state.get("non_effects")
    req(isinstance(effects, dict) and effects and all(value is False for value in effects.values()), "state non-effects")


def build_ingest_receipt(sidecar_root, session_id, expected_policy_sha256):
    pilot_receipt = ingest.local_run.execute("synthetic-ready")
    context = ingest.default_ingest_context(pilot_receipt)
    context["external_sandbox_ingest_requested"] = True
    context["human_external_sandbox_decision"] = ingest.HUMAN_DECISION
    context["session_id"] = session_id
    context["expected_policy_sha256"] = expected_policy_sha256
    context["sidecar_root_reference_digest"] = ingest.sidecar_root_reference_digest(sidecar_root)
    for field in ingest.PRECHECK_FIELDS:
        context[field] = True
    receipt = ingest.ingest_completed_session(pilot_receipt, context, sidecar_root)
    req(receipt["decision"] == "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED", "completed ingest required")
    ingest.validate_ingest_receipt(pilot_receipt, context, receipt)
    return receipt


def validate_final_checkpoint(session_dir, session_id, final):
    candidates = []
    for item in session_dir.iterdir():
        match = CHECKPOINT_RE.fullmatch(item.name)
        if match:
            sequence = int(match.group(1))
            req(1 <= sequence <= 4096, "checkpoint sequence bound")
            candidates.append((sequence, item))
    req(candidates, "final checkpoint required")
    sequence, checkpoint_path = max(candidates, key=lambda item: item[0])
    checkpoint, raw, _ = read_bounded_json(checkpoint_path, session_dir)
    req(
        set(checkpoint)
        == {
            "schema_version",
            "receipt_type",
            "session_id",
            "sequence",
            "kind",
            "observed_at",
            "aggregate",
            "source_scope",
            "content_hash",
            "non_effects",
        },
        "checkpoint exact keys",
    )
    req(checkpoint["schema_version"] == "0.1", "checkpoint schema")
    req(checkpoint["receipt_type"] == "sanitized_log_aggregate_checkpoint", "checkpoint type")
    req(checkpoint["session_id"] == session_id and checkpoint["sequence"] == sequence, "checkpoint identity")
    req(checkpoint["kind"] == "final_checkpoint", "latest checkpoint must be final")
    req(
        checkpoint["source_scope"] == "newly_appended_log_bytes_after_session_baseline",
        "checkpoint source scope",
    )
    expected_hash = "sha256:" + sha({**checkpoint, "content_hash": None})
    req(checkpoint["content_hash"] == expected_hash, "checkpoint content hash")
    req(checkpoint["aggregate"] == final["aggregate"], "checkpoint/final aggregate continuity")
    req(checkpoint["non_effects"] == final["non_effects"], "checkpoint/final non-effects continuity")
    req(all(value is False for value in checkpoint["non_effects"].values()), "checkpoint effects denied")
    return checkpoint, raw


def create_json(path, value):
    try:
        with Path(path).open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, sort_keys=True, indent=2)
            stream.write("\n")
    except FileExistsError as exc:
        raise FinalizingRecoveryError("recovery metadata already exists") from exc


def atomic_current(path, value):
    target = Path(path)
    temporary = target.with_name("current.recovery.tmp")
    req(not temporary.exists(), "stale recovery temporary file requires review")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, sort_keys=True, indent=2)
            stream.write("\n")
        os.replace(temporary, target)
    except Exception:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass
        raise


def validate_recovery_receipt(receipt):
    req(receipt.get("schema_version") == RECOVERY_RECEIPT_SCHEMA, "recovery receipt schema")
    req(receipt.get("status") == "CONTROL_METADATA_RECOVERY_AUTHORIZED", "recovery receipt status")
    req(receipt.get("decision") == "RECOVER_FINALIZING_FROM_COMPLETED_EVIDENCE", "recovery decision")
    for field in (
        "source_current_digest",
        "source_state_digest",
        "source_ingest_receipt_digest",
        "session_final_sha256",
        "final_checkpoint_sha256",
        "sanitized_summary_digest",
    ):
        req(HEX64_RE.fullmatch(receipt.get(field, "")), f"recovery digest: {field}")
    req(receipt.get("observer_liveness") == "NOT_RUNNING", "observer must be stopped")
    req(receipt.get("tail_catchup_continuity_proven") is True, "tail continuity")
    req(receipt.get("session_data_modified") is False, "session data mutation denied")
    req(receipt.get("sidecar_files_modified") is False, "sidecar mutation denied")
    req(receipt.get("current_pointer_update_intended") is True, "current pointer intent")
    req(receipt.get("new_observation_authorized") is False, "new observation overclaim")
    req(
        receipt.get("authority_effect")
        == receipt.get("action_effect")
        == receipt.get("successor_effect")
        == "NONE",
        "recovery causal effects",
    )
    digest = receipt.get("recovery_receipt_digest")
    req(HEX64_RE.fullmatch(digest or ""), "recovery receipt digest")
    req(digest == sha({key: value for key, value in receipt.items() if key != "recovery_receipt_digest"}), "recovery receipt binding")


def validate_recovered_state(state, receipt):
    req(state.get("schema_version") == RECOVERED_STATE_SCHEMA, "recovered state schema")
    req(state.get("status") == "stopped_recovered", "recovered state status")
    req(state.get("game_start_allowed") is False, "recovered state game start")
    req(state.get("tail_catchup_complete") is True, "recovered tail continuity")
    req(state.get("recovery_receipt_digest") == receipt["recovery_receipt_digest"], "state/receipt binding")
    req(state.get("source_state_digest") == receipt["source_state_digest"], "state source binding")
    req(
        state.get("authority_effect")
        == state.get("action_effect")
        == state.get("successor_effect")
        == "NONE",
        "recovered state effects",
    )
    digest = state.get("recovered_state_digest")
    req(HEX64_RE.fullmatch(digest or ""), "recovered state digest")
    req(digest == sha({key: value for key, value in state.items() if key != "recovered_state_digest"}), "recovered state binding")


def apply_recovery(
    *,
    control_root,
    sidecar_root,
    session_id,
    expected_policy_sha256,
    human_decision,
    confirm_observer_stopped,
    confirm_session_data_read_only,
    confirm_control_recovery_only,
    recovered_at=None,
):
    req(human_decision == HUMAN_DECISION, "exact recovery human decision required")
    req(confirm_observer_stopped is True, "observer-stopped confirmation required")
    req(confirm_session_data_read_only is True, "session-data read-only confirmation required")
    req(confirm_control_recovery_only is True, "control-recovery-only confirmation required")
    req(isinstance(session_id, str) and SESSION_ID_RE.fullmatch(session_id), "bounded session id")
    req(isinstance(expected_policy_sha256, str) and HEX64_RE.fullmatch(expected_policy_sha256), "policy digest")

    control = ordinary_directory(control_root)
    current_path = control / "current.json"
    current, current_raw, _ = read_bounded_json(current_path, control)
    session_control, state_path = validate_current(current, control, session_id)
    state, state_raw, _ = read_bounded_json(state_path, session_control)
    validate_source_state(state, current, session_id)
    req(process_liveness(current["observer_pid"]) == "NOT_RUNNING", "observer is running or liveness is unknown")

    sidecar = ordinary_directory(sidecar_root)
    req(sidecar.name == "KONTUR_PILOT_INFO", "sidecar directory identity")
    session_dir = ordinary_directory(sidecar / "sessions" / session_id)
    ingest_receipt = build_ingest_receipt(sidecar, session_id, expected_policy_sha256)
    final, final_raw, _ = read_bounded_json(session_dir / "session-final.json", session_dir)
    checkpoint, checkpoint_raw = validate_final_checkpoint(session_dir, session_id, final)
    req(state["aggregate"]["bytes_processed"] <= final["aggregate"]["bytes_processed"], "state/final byte monotonicity")
    req(state["aggregate"]["lines_processed"] <= final["aggregate"]["lines_processed"], "state/final line monotonicity")

    timestamp = recovered_at or datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    req(isinstance(timestamp, str) and timestamp.endswith("Z"), "recovery timestamp")
    receipt = {
        "schema_version": RECOVERY_RECEIPT_SCHEMA,
        "status": "CONTROL_METADATA_RECOVERY_AUTHORIZED",
        "decision": "RECOVER_FINALIZING_FROM_COMPLETED_EVIDENCE",
        "reason": "DEAD_OBSERVER_WITH_VALID_FINAL_RECEIPT_AND_MATCHING_FINAL_CHECKPOINT",
        "session_id": session_id,
        "recovered_at": timestamp,
        "source_current_digest": sha(current),
        "source_state_digest": sha(state),
        "source_ingest_receipt_digest": ingest_receipt["external_sandbox_sidecar_ingest_receipt_digest"],
        "session_final_sha256": sha_bytes(final_raw),
        "final_checkpoint_sha256": sha_bytes(checkpoint_raw),
        "final_checkpoint_content_hash": checkpoint["content_hash"],
        "sanitized_summary_digest": sha(ingest_receipt["sanitized_summary"]),
        "observer_liveness": "NOT_RUNNING",
        "tail_catchup_continuity_proven": True,
        "session_data_modified": False,
        "sidecar_files_modified": False,
        "recovery_metadata_create_only": True,
        "current_pointer_update_intended": True,
        "new_observation_authorized": False,
        "recovery_effect": "CREATE_CONTROL_RECOVERY_METADATA_AND_REPOINT_CURRENT_ONLY",
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    receipt["recovery_receipt_digest"] = sha(receipt)
    validate_recovery_receipt(receipt)

    recovered_state = {
        "schema_version": RECOVERED_STATE_SCHEMA,
        "session_id": session_id,
        "observer_pid": current["observer_pid"],
        "status": "stopped_recovered",
        "game_start_allowed": False,
        "recovered_at": timestamp,
        "source_state_digest": receipt["source_state_digest"],
        "source_ingest_receipt_digest": receipt["source_ingest_receipt_digest"],
        "session_final_sha256": receipt["session_final_sha256"],
        "final_checkpoint_sha256": receipt["final_checkpoint_sha256"],
        "recovery_receipt_digest": receipt["recovery_receipt_digest"],
        "tail_catchup_complete": True,
        "session_data_modified": False,
        "new_observation_authorized": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    recovered_state["recovered_state_digest"] = sha(recovered_state)
    validate_recovered_state(recovered_state, receipt)

    receipt_path = session_control / "finalizing-recovery-receipt.json"
    recovered_state_path = session_control / "recovered-state.json"
    create_json(receipt_path, receipt)
    create_json(recovered_state_path, recovered_state)
    recovered_current = dict(current)
    recovered_current["state_path"] = str(recovered_state_path)
    recovered_current["runtime_source"] = "external-observation-session-finalizing-recovery-v0.1"
    recovered_current["recovery_receipt_path"] = str(receipt_path)
    atomic_current(current_path, recovered_current)

    # Original evidence was read only. These byte digests also catch accidental
    # in-process mutation before the result is emitted.
    req(sha_bytes(state_path.read_bytes()) == sha_bytes(state_raw), "source state changed during recovery")
    req(sha_bytes((session_dir / "session-final.json").read_bytes()) == sha_bytes(final_raw), "session final changed during recovery")
    req(sha_bytes((session_dir / f"checkpoint-{checkpoint['sequence']:06d}.json").read_bytes()) == sha_bytes(checkpoint_raw), "final checkpoint changed during recovery")

    result = {
        "schema_version": RESULT_SCHEMA,
        "status": "FINALIZING_CONTROL_STATE_RECOVERED",
        "session_id": session_id,
        "recovery_receipt_digest": receipt["recovery_receipt_digest"],
        "recovered_state_digest": recovered_state["recovered_state_digest"],
        "current_pointer_updated": True,
        "source_state_modified": False,
        "session_data_modified": False,
        "sidecar_files_modified": False,
        "observer_liveness": "NOT_RUNNING",
        "tail_catchup_complete": True,
        "new_observation_authorized": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    result["recovery_result_digest"] = sha(result)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Recover dead finalizing observation control metadata.")
    parser.add_argument("--control-root", required=True)
    parser.add_argument("--sidecar-root", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--expected-policy-sha256", required=True)
    parser.add_argument("--human-decision", required=True)
    parser.add_argument("--confirm-observer-stopped", action="store_true")
    parser.add_argument("--confirm-session-data-read-only", action="store_true")
    parser.add_argument("--confirm-control-recovery-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        result = apply_recovery(
            control_root=args.control_root,
            sidecar_root=args.sidecar_root,
            session_id=args.session_id,
            expected_policy_sha256=args.expected_policy_sha256,
            human_decision=args.human_decision,
            confirm_observer_stopped=args.confirm_observer_stopped,
            confirm_session_data_read_only=args.confirm_session_data_read_only,
            confirm_control_recovery_only=args.confirm_control_recovery_only,
        )
    except (FinalizingRecoveryError, OSError, ingest.KonturExternalSandboxIngestError) as exc:
        print(
            json.dumps(
                {"status": "recovery_error", "error_class": type(exc).__name__, "error": str(exc)},
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 2
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
