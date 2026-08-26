#!/usr/bin/env python3
"""Validate the privacy-minimized terminal-state field confirmation."""

import hashlib
import json
from pathlib import Path
import re
import sys


sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
RECEIPT_PATH = HERE / "receipt.json"
EXPECTED_FILES = {"README.md", "receipt.json", "validate.py"}
HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^(?:sha256:)?[0-9a-f]{64}$")
FORBIDDEN_VALUE_PATTERNS = (
    re.compile(r"scrap-[0-9]{8}-[0-9]{6}z-[0-9a-f]{8}", re.IGNORECASE),
    re.compile(r"[a-z]:[\\/]", re.IGNORECASE),
    re.compile(r"\\\\[^\\]+\\"),
    re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"),
    re.compile(r"\b[0-9]{17}\b"),
    re.compile(r"(?:^|[\\/\s])[^\\/\s]+\.log(?:$|\s)", re.IGNORECASE),
)


def fail(message):
    raise AssertionError(message)


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            fail("duplicate JSON key")
        value[key] = item
    return value


def reject_constant(value):
    fail(f"non-finite JSON constant: {value}")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def exact_keys(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        fail(f"{label} exact keys")


def scan_strings(value, path=()):
    if isinstance(value, dict):
        for key, item in value.items():
            scan_strings(item, (*path, key))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            scan_strings(item, (*path, str(index)))
    elif isinstance(value, str):
        for pattern in FORBIDDEN_VALUE_PATTERNS:
            if pattern.search(value):
                fail(f"forbidden identifying value at {'.'.join(path)}")
        if HEX64.fullmatch(value) and path != ("receipt_digest",):
            fail(f"unapproved 64-hex value at {'.'.join(path)}")


def main():
    entries = list(HERE.iterdir())
    if {item.name for item in entries} != EXPECTED_FILES:
        fail("evidence-only directory must contain exactly three files")
    if any(not item.is_file() or item.is_symlink() for item in entries):
        fail("evidence-only entries must be ordinary files")
    raw = RECEIPT_PATH.read_bytes()
    if len(raw) > 16 * 1024:
        fail("receipt size bound")
    receipt = json.loads(
        raw.decode("utf-8"),
        object_pairs_hook=unique_object,
        parse_constant=reject_constant,
    )
    exact_keys(
        receipt,
        {
            "authority_boundary", "evidence_class", "evidence_continuity",
            "evidence_id", "observed_main_sha", "privacy_boundary", "publication",
            "receipt_digest", "runtime_non_effects", "sanitized_metrics",
            "schema_version", "scope", "terminal_result",
        },
        "receipt",
    )
    if receipt["schema_version"] != "kontur-game-companion-terminal-state-field-confirmation-v0.1":
        fail("schema version")
    if receipt["evidence_id"] != "terminal-state-commit-field-confirmation-001":
        fail("evidence id")
    if receipt["evidence_class"] != "SANITIZED_FIELD_CONFIRMATION":
        fail("evidence class")
    if not HEX40.fullmatch(receipt["observed_main_sha"]):
        fail("observed main SHA")
    if receipt["observed_main_sha"] != "2bad1681b6d13a9e7cf8bf150d24478edfcee931":
        fail("observed main provenance")

    exact_keys(
        receipt["scope"],
        {"observation_count", "observation_kind", "source_scope"},
        "scope",
    )
    if receipt["scope"] != {
        "observation_count": 1,
        "observation_kind": "EXPLICITLY_AUTHORIZED_BOUNDED_SANITIZED_LOG_OBSERVATION",
        "source_scope": "NEWLY_APPENDED_LOG_BYTES_AFTER_BASELINE_ONLY",
    }:
        fail("bounded scope")

    exact_keys(
        receipt["terminal_result"],
        {
            "final_control_status", "finalizing_recovery_used", "game_exit_confirmed",
            "observer_exit_confirmed", "stop_reason", "tail_catchup_complete",
            "terminal_commit_completed", "terminal_temporary_files_remaining",
        },
        "terminal result",
    )
    if receipt["terminal_result"] != {
        "final_control_status": "stopped",
        "finalizing_recovery_used": False,
        "game_exit_confirmed": True,
        "observer_exit_confirmed": True,
        "stop_reason": "stop_requested",
        "tail_catchup_complete": True,
        "terminal_commit_completed": True,
        "terminal_temporary_files_remaining": 0,
    }:
        fail("terminal result claims")

    exact_keys(
        receipt["evidence_continuity"],
        {
            "checkpoint_aggregate_matches_final", "checkpoint_non_effects_match_final",
            "completed_read_only_ingest_decision", "final_checkpoint_present",
            "session_final_valid", "sidecar_unchanged_by_ingest",
        },
        "evidence continuity",
    )
    if receipt["evidence_continuity"] != {
        "checkpoint_aggregate_matches_final": True,
        "checkpoint_non_effects_match_final": True,
        "completed_read_only_ingest_decision": "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED",
        "final_checkpoint_present": True,
        "session_final_valid": True,
        "sidecar_unchanged_by_ingest": True,
    }:
        fail("evidence continuity claims")

    exact_keys(
        receipt["sanitized_metrics"],
        {
            "bytes_processed", "identifier_values_stored", "lines_processed",
            "log_file_count", "raw_lines_stored", "sensitive_identifier_line_count",
        },
        "sanitized metrics",
    )
    if receipt["sanitized_metrics"] != {
        "bytes_processed": 64063,
        "identifier_values_stored": False,
        "lines_processed": 557,
        "log_file_count": 1,
        "raw_lines_stored": False,
        "sensitive_identifier_line_count": 1,
    }:
        fail("sanitized metric claims")

    exact_keys(
        receipt["privacy_boundary"],
        {
            "control_tokens_or_digests_published", "game_account_data_published",
            "identifier_values_published", "local_paths_published",
            "log_file_names_published", "original_session_id_published",
            "original_timestamps_published", "player_profile_published",
            "process_identifiers_published", "raw_log_lines_published",
            "source_file_hashes_published",
        },
        "privacy boundary",
    )
    if not receipt["privacy_boundary"] or any(receipt["privacy_boundary"].values()):
        fail("privacy publication overclaim")

    exact_keys(
        receipt["runtime_non_effects"],
        {
            "game_action_executed", "game_process_accessed", "identifier_values_stored",
            "input_emulated", "kontur_activated", "message_sent",
            "network_io_performed", "pilot_approved", "raw_log_content_stored",
            "recommendation_generated",
        },
        "runtime non-effects",
    )
    if not receipt["runtime_non_effects"] or any(receipt["runtime_non_effects"].values()):
        fail("runtime effect overclaim")

    exact_keys(
        receipt["authority_boundary"],
        {
            "action_permit_created", "new_observation_authorized",
            "remediation_authorized", "runtime_activation_authorized",
            "successor_permit_created",
        },
        "authority boundary",
    )
    if not receipt["authority_boundary"] or any(receipt["authority_boundary"].values()):
        fail("authority overclaim")

    if receipt["publication"] != {
        "repository_publication_effect": True,
        "source_evidence_retention": "LOCAL_NOT_PUBLISHED",
        "verification_limit": "SANITIZED_AGGREGATE_AND_CONTROL_CONTINUITY_ONLY",
    }:
        fail("publication boundary")

    scan_strings(receipt)
    digest = receipt["receipt_digest"]
    if not isinstance(digest, str) or not digest.startswith("sha256:") or not HEX64.fullmatch(digest):
        fail("receipt digest syntax")
    expected_digest = "sha256:" + sha({**receipt, "receipt_digest": None})
    if digest != expected_digest:
        fail("receipt digest binding")

    readme = (HERE / "README.md").read_text(encoding="utf-8")
    for pattern in FORBIDDEN_VALUE_PATTERNS:
        if pattern.search(readme):
            fail("README identifying value")

    privacy_probes = (
        "scrap-" + "1" * 8 + "-" + "2" * 6 + "z-" + "a" * 8,
        "X:" + "\\" + "private",
        "2026-01-01" + "T00:00:00Z",
        "synthetic" + ".log",
        "1" * 17,
        "a" * 64,
    )
    rejected_probes = 0
    for probe in privacy_probes:
        try:
            scan_strings({"probe": probe})
        except AssertionError:
            rejected_probes += 1
    if rejected_probes != len(privacy_probes):
        fail("privacy probe accepted")

    print(
        "KONTUR sanitized terminal-state field confirmation: PASS; "
        "published_files=3; raw_log_lines=0; identifier_values=0; session_ids=0; "
        "timestamps=0; local_paths=0; process_identifiers=0; source_hashes=0; "
        f"privacy_probes_rejected={rejected_probes}; "
        "new_observation_authorized=false; action_or_successor_permits=0"
    )


if __name__ == "__main__":
    main()
