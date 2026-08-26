#!/usr/bin/env python3
"""Foreground, one-shot post-session attention trial.

This adapter evaluates one fixed structured cue against one completed ingest
receipt.  It has no live-game, process, network, audio, model, send, persistence,
background, or polling capability.
"""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys


# Keep a trial invocation write-free, including Python bytecode caches.
sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
BRIDGE_PATH = HERE.parent / "player-cued-observation-event-bridge" / "bridge.py"
MAX_RECEIPT_BYTES = 256 * 1024


class TrialInputError(ValueError):
    pass


def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise TrialInputError("required module is unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bridge = _load_module("kontur_foreground_attention_bridge", BRIDGE_PATH)
renderer = _load_module("kontur_foreground_attention_renderer", HERE / "render.py")


CUE_BINDINGS = {
    "overview": ("ASK_POST_SESSION_OVERVIEW", None),
    "lifecycle": ("SELECT_LIFECYCLE_COUNTS", "LIFECYCLE_COUNTS"),
    "severity": ("SELECT_SEVERITY_COUNTS", "SEVERITY_COUNTS"),
    "terms": ("SELECT_TERM_COUNTS", "TERM_COUNTS"),
    "pause": ("PAUSE", None),
    "resume": ("RESUME", None),
    "decline": ("DECLINE", None),
    "redirect": ("REDIRECT", None),
    "none": ("NONE", None),
}


def _reject_constant(value):
    raise TrialInputError(f"non-finite JSON constant rejected: {value}")


def _unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise TrialInputError("duplicate JSON key rejected")
        value[key] = item
    return value


def decode_strict_json(raw):
    if not isinstance(raw, bytes):
        raise TrialInputError("receipt input must be bytes")
    if len(raw) > MAX_RECEIPT_BYTES:
        raise TrialInputError("receipt exceeds 256 KiB")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise TrialInputError("receipt is not strict UTF-8 JSON") from exc
    try:
        value = json.loads(
            text,
            object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
    except TrialInputError:
        raise
    except (RecursionError, ValueError) as exc:
        raise TrialInputError("receipt is not valid JSON") from exc
    if not isinstance(value, dict):
        raise TrialInputError("receipt root must be an object")
    return value


def _is_reparse_point(file_stat):
    attributes = getattr(file_stat, "st_file_attributes", 0)
    return bool(attributes & 0x400)


def read_receipt_file(reference):
    """Read one explicit ordinary file without following a known link."""

    path = Path(reference)
    try:
        before = path.lstat()
    except OSError as exc:
        raise TrialInputError("receipt file is unavailable") from exc
    if (
        not stat.S_ISREG(before.st_mode)
        or path.is_symlink()
        or _is_reparse_point(before)
    ):
        raise TrialInputError("receipt must be an ordinary non-link file")
    if before.st_size > MAX_RECEIPT_BYTES:
        raise TrialInputError("receipt exceeds 256 KiB")
    try:
        with path.open("rb", buffering=0) as stream:
            opened = os.fstat(stream.fileno())
            if not stat.S_ISREG(opened.st_mode) or _is_reparse_point(opened):
                raise TrialInputError("receipt must remain an ordinary file")
            if (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
                raise TrialInputError("receipt file changed before read")
            raw = stream.read(MAX_RECEIPT_BYTES + 1)
    except TrialInputError:
        raise
    except OSError as exc:
        raise TrialInputError("receipt file could not be read") from exc
    return decode_strict_json(raw)


def read_receipt_stdin():
    try:
        raw = sys.stdin.buffer.read(MAX_RECEIPT_BYTES + 1)
    except OSError as exc:
        raise TrialInputError("stdin receipt could not be read") from exc
    return decode_strict_json(raw)


def synthetic_receipt():
    """Build the repository-owned completed-session scenario in memory."""

    session_id = "synthetic-complete"
    policy_sha256 = bridge.EXPECTED_POLICY_SHA256
    session_start_sha256 = bridge.sha(
        {"scenario": "foreground-post-session-attention", "receipt": "start"}
    )
    session_final_sha256 = bridge.sha(
        {"scenario": "foreground-post-session-attention", "receipt": "final"}
    )
    evidence_ref = bridge.sha(
        {
            "kind": "KONTUR_EXTERNAL_SANDBOX_COMPLETED_SESSION_EVIDENCE_V0.1",
            "policy_sha256": policy_sha256,
            "session_start_sha256": session_start_sha256,
            "session_final_sha256": session_final_sha256,
            "session_id": session_id,
        }
    )
    receipt = {
        "schema_version": (
            "kontur-game-companion-external-sandbox-sidecar-ingest-receipt-v0.1"
        ),
        "status": "BOUNDED_EXTERNAL_SANDBOX_READ_ONLY_OBSERVATION",
        "source_local_trial_pilot_receipt_digest": bridge.sha(
            {"scenario": "foreground-post-session-attention", "source": "pilot"}
        ),
        "source_pilot_run_ref": bridge.sha(
            {"scenario": "foreground-post-session-attention", "source": "run"}
        ),
        "connection_request_digest": bridge.sha(
            {"scenario": "foreground-post-session-attention", "source": "request"}
        ),
        "decision": "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED",
        "reason": "THREE_BOUNDED_SANITIZED_SIDECAR_RECEIPTS_VALIDATED",
        "adapter_mode": "EXTERNAL_SANDBOX_READ_ONLY_COMPLETED_SIDECAR_INGEST",
        "input_scope": "COMPLETED_SANITIZED_SESSION_RECEIPTS_ONLY",
        "session_scope": "ONE_PROCESS_INVOCATION",
        "output_mode": "STDOUT_JSON_RECEIPT_ONLY",
        "cpu_profile": "BOUNDED_SINGLE_SHOT_NO_POLLING",
        "sidecar_directory_name": "KONTUR_PILOT_INFO",
        "session_id": session_id,
        "policy_id": "kontur-scrap-mechanic-bounded-log-session-v0.1",
        "policy_sha256": policy_sha256,
        "session_start_sha256": session_start_sha256,
        "session_final_sha256": session_final_sha256,
        "external_session_evidence_ref": evidence_ref,
        "sanitized_summary": {
            "bytes_processed": 3,
            "lines_processed": 3,
            "log_file_count": 1,
            "sensitive_identifier_line_count": 0,
            "identifier_values_stored": False,
            "raw_lines_stored": False,
            "severity_counts": {"warning": 1},
            "term_counts": {"world": 1},
            "lifecycle_counts": {"world_added": 1},
            "stop_reason": "manual_stop",
            "performance_claim_verified": False,
        },
        "files_read": [
            "runtime-collection-policy.json",
            f"sessions/{session_id}/session-start.json",
            f"sessions/{session_id}/session-final.json",
        ],
        "external_environment_connected": True,
        "external_file_read_authorized": True,
        "external_file_io_performed": True,
        "completed_session_ingested": True,
        "human_decision_present": True,
        "next_decision_boundary": (
            "HUMAN_NEW_OBSERVATION_SESSION_START_DECISION_REQUIRED"
        ),
        "private_absolute_path_stored": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": (
            "EXTERNAL_SANDBOX_SIDECAR_READ_ONLY_COMPLETED_SESSION"
        ),
    }
    for field in bridge.SOURCE_FALSE_EFFECTS:
        receipt[field] = False
    receipt["external_sandbox_sidecar_ingest_receipt_digest"] = bridge.sha(receipt)
    bridge.validate_source_ingest_receipt(receipt)
    return receipt


def make_state(source):
    return bridge.seal_state(
        {
            "schema_version": bridge.STATE_SCHEMA_VERSION,
            "scope_id": bridge.expected_scope_id(source),
            "last_turn": 0,
            "session_phase": "ACTIVE",
            "source_ingest_receipt_digest": source[
                "external_sandbox_sidecar_ingest_receipt_digest"
            ],
            "source_external_session_evidence_ref": source[
                "external_session_evidence_ref"
            ],
            "provenance_mode": bridge.STATE_PROVENANCE_MODE,
            "runtime_state_authenticated": False,
            "stored_help_authority": False,
            "stored_solution_authority": False,
            "stored_response_authority": False,
            "solver_mode": False,
            "player_profile_created": False,
        },
        source,
    )


def make_cue(cue_identity, source, state):
    cue_class, selected_category = CUE_BINDINGS[cue_identity]
    return bridge.seal_cue(
        {
            "schema_version": bridge.CUE_SCHEMA_VERSION,
            "cue_class": cue_class,
            "scope": "THIS_INTERACTION_ONLY",
            "turn": 1,
            "target_scope_id": state["scope_id"],
            "source_state_anchor_digest": state["state_digest"],
            "source_external_session_evidence_ref": source[
                "external_session_evidence_ref"
            ],
            "selected_category": selected_category,
            "provenance_mode": bridge.CUE_PROVENANCE_MODE,
            "human_identity_authenticated": False,
            "input_adapter_verified": False,
            "replay_protection_present": False,
            "raw_text_stored": False,
            "audio_stored": False,
            "speaker_identifier_stored": False,
        },
        source,
        state,
    )


def available_categories(source):
    available = []
    for category in bridge.CATEGORIES:
        summary_key = bridge.CATEGORY_TO_SUMMARY[category]
        if any(value > 0 for value in source["sanitized_summary"][summary_key].values()):
            available.append(category)
    return available


def visible_categories(source, cue_identity):
    """Limit identity disclosure to the scope asserted by the fixed cue."""

    available = available_categories(source)
    if cue_identity == "overview":
        return available
    selected = CUE_BINDINGS[cue_identity][1]
    if selected is not None and selected in available:
        return [selected]
    return []


def execute(source, cue_identity, input_status):
    bridge.validate_source_ingest_receipt(source)
    state = make_state(source)
    cue = make_cue(cue_identity, source, state)
    bridge_receipt = bridge.evaluate(source, state, cue)
    return renderer.build_context_card(
        input_status=input_status,
        cue_identity=cue_identity,
        selected_category_identity=CUE_BINDINGS[cue_identity][1],
        available_category_identities=visible_categories(source, cue_identity),
        bridge_receipt=bridge_receipt,
    )


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Render one bounded post-session KONTUR context card."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--scenario",
        choices=("synthetic",),
        help="use the repository-owned completed-session scenario",
    )
    source.add_argument(
        "--receipt",
        metavar="FILE_OR_DASH",
        help="read one completed ingest receipt from an ordinary file or '-'",
    )
    parser.add_argument(
        "--cue",
        choices=tuple(CUE_BINDINGS),
        default="overview",
        help="fixed structured cue (default: overview)",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    try:
        if args.scenario == "synthetic":
            source = synthetic_receipt()
            input_status = "REPOSITORY_OWNED_SYNTHETIC_SCENARIO"
        elif args.receipt == "-":
            source = read_receipt_stdin()
            input_status = "STDIN_COMPLETED_INGEST_RECEIPT"
        else:
            source = read_receipt_file(args.receipt)
            input_status = "SUPPLIED_COMPLETED_INGEST_RECEIPT"
        card = execute(source, args.cue, input_status)
    except (
        TrialInputError,
        bridge.PlayerCuedObservationBridgeError,
        renderer.ContextCardError,
    ) as exc:
        print(f"foreground_attention_trial_error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(card, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
