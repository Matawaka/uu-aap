#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
import os
import re
import stat
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
LOCAL_RUN = ROOT / "local-trial-pilot" / "run.py"
CONFIG_PATH = HERE / "adapter-config.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


local_run = loadmod("kontur_external_sidecar_local_trial", LOCAL_RUN)


class KonturExternalSandboxIngestError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise KonturExternalSandboxIngestError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode("utf-8")).hexdigest()


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


ADAPTER_MODE = "EXTERNAL_SANDBOX_READ_ONLY_COMPLETED_SIDECAR_INGEST"
INPUT_SCOPE = "COMPLETED_SANITIZED_SESSION_RECEIPTS_ONLY"
SESSION_SCOPE = "ONE_PROCESS_INVOCATION"
OUTPUT_MODE = "STDOUT_JSON_RECEIPT_ONLY"
CPU_PROFILE = "BOUNDED_SINGLE_SHOT_NO_POLLING"
HUMAN_DECISION = "ALLOW_THIS_READ_ONLY_COMPLETED_SIDECAR_INGEST"
NEXT_DECISION_BOUNDARY = "HUMAN_NEW_OBSERVATION_SESSION_START_DECISION_REQUIRED"
PREVIOUS_DECISION_BOUNDARY = "HUMAN_EXTERNAL_SANDBOX_PILOT_DECISION_REQUIRED"
SESSION_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,95}$")
HEX64_PATTERN = re.compile(r"^[0-9a-f]{64}$")

CONFIG_KEYS = {
    "schema_version",
    "adapter_mode",
    "input_scope",
    "session_scope",
    "output_mode",
    "cpu_profile",
    "sidecar_directory_name",
    "allowed_policy_id",
    "allowed_read_templates",
    "allowed_term_keys",
    "allowed_lifecycle_keys",
    "allowed_stop_reasons",
    "max_read_bytes_per_file",
    "recursive_scan",
    "raw_log_read",
    "game_process_access",
    "process_memory_read",
    "network_access",
    "game_file_modification",
    "sidecar_file_modification",
    "audio_capture",
    "microphone_capture",
    "screen_capture",
    "input_emulation",
    "background_loop",
    "polling",
    "persistent_output",
    "recommendation_generation",
    "message_send",
    "game_action_execution",
}

FALSE_CONFIG_FIELDS = (
    "recursive_scan",
    "raw_log_read",
    "game_process_access",
    "process_memory_read",
    "network_access",
    "game_file_modification",
    "sidecar_file_modification",
    "audio_capture",
    "microphone_capture",
    "screen_capture",
    "input_emulation",
    "background_loop",
    "polling",
    "persistent_output",
    "recommendation_generation",
    "message_send",
    "game_action_execution",
)

PRECHECK_FIELDS = (
    "game_stopped_confirmed",
    "completed_session_only_confirmed",
    "sidecar_read_only_confirmed",
    "no_raw_log_read_confirmed",
    "no_game_process_access_confirmed",
    "no_process_memory_read_confirmed",
    "no_network_access_confirmed",
    "no_game_or_sidecar_write_confirmed",
    "private_path_not_emitted_confirmed",
    "single_shot_no_background_confirmed",
)

FORBIDDEN_REQUESTS = (
    "live_log_observation_requested",
    "raw_log_read_requested",
    "game_launch_requested",
    "game_process_attach_requested",
    "process_memory_read_requested",
    "network_observation_requested",
    "network_write_requested",
    "screen_capture_requested",
    "audio_capture_requested",
    "microphone_capture_requested",
    "input_emulation_requested",
    "game_file_write_requested",
    "sidecar_file_write_requested",
    "recommendation_generation_requested",
    "message_send_requested",
    "game_action_requested",
    "background_activity_requested",
    "polling_requested",
    "persistent_output_requested",
    "action_permit_requested",
    "successor_permit_requested",
    "scope_expansion_requested",
    "copyright_process_change_requested",
    "license_or_notice_change_requested",
    "legal_author_identity_change_requested",
    "pseudonym_publication_change_requested",
)

FALSE_EFFECTS = (
    "raw_log_read",
    "game_process_accessed",
    "process_memory_read",
    "network_io_performed",
    "game_files_modified",
    "sidecar_files_modified",
    "input_emulated",
    "screen_captured",
    "audio_capture_started",
    "microphone_capture_started",
    "recommendation_generated",
    "message_sent",
    "game_action_executed",
    "kontur_activated",
    "background_activity_started",
    "polling_started",
    "persistent_output_written",
    "behavioral_profile_built",
    "cross_game_profile_built",
    "copyright_process_modified",
    "license_or_notice_modified",
    "legal_author_identity_modified",
    "pseudonym_publication_process_modified",
)

NON_EFFECT_KEYS = {
    "game_launched",
    "game_process_attached",
    "process_memory_read",
    "network_traffic_observed",
    "input_emulated",
    "raw_log_persisted",
    "recommendation_generated",
    "game_action_executed",
    "kontur_activated",
    "pilot_approved",
}

DENIED_CAPABILITIES = {
    "game.launch",
    "game.execute",
    "game.input_control",
    "game.process_attach",
    "game.process_memory_read",
    "game.network_observe",
    "game.network_write",
    "game.screen_capture",
    "game.save_content_read",
    "game.credential_content_read",
    "game.raw_log_persist",
    "game.user_identifier_persist",
    "game.auto_confirm",
    "kontur.activate",
}

CONTEXT_KEYS = {
    "schema_version",
    "source_local_trial_pilot_receipt_digest",
    "external_sandbox_ingest_requested",
    "human_external_sandbox_decision",
    "session_id",
    "expected_policy_sha256",
    "sidecar_root_reference_digest",
    "authority_effect",
    "action_effect",
    "successor_effect",
    *PRECHECK_FIELDS,
    *FORBIDDEN_REQUESTS,
}

SUMMARY_KEYS = {
    "bytes_processed",
    "lines_processed",
    "log_file_count",
    "sensitive_identifier_line_count",
    "identifier_values_stored",
    "raw_lines_stored",
    "severity_counts",
    "term_counts",
    "lifecycle_counts",
    "stop_reason",
    "performance_claim_verified",
}

RECEIPT_KEYS = {
    "schema_version",
    "status",
    "source_local_trial_pilot_receipt_digest",
    "source_pilot_run_ref",
    "connection_request_digest",
    "decision",
    "reason",
    "adapter_mode",
    "input_scope",
    "session_scope",
    "output_mode",
    "cpu_profile",
    "sidecar_directory_name",
    "session_id",
    "policy_id",
    "policy_sha256",
    "session_start_sha256",
    "session_final_sha256",
    "external_session_evidence_ref",
    "sanitized_summary",
    "files_read",
    "external_environment_connected",
    "external_file_read_authorized",
    "external_file_io_performed",
    "completed_session_ingested",
    "human_decision_present",
    "next_decision_boundary",
    "private_absolute_path_stored",
    "authority_effect",
    "action_effect",
    "successor_effect",
    "runtime_connectedness",
    *FALSE_EFFECTS,
    "external_sandbox_sidecar_ingest_receipt_digest",
}


def load_config(path=CONFIG_PATH):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_config(config):
    req(isinstance(config, dict), "adapter config object")
    req(set(config) == CONFIG_KEYS, "adapter config exact keys")
    expected = {
        "schema_version": "kontur-game-companion-external-sandbox-sidecar-ingest-config-v0.1",
        "adapter_mode": ADAPTER_MODE,
        "input_scope": INPUT_SCOPE,
        "session_scope": SESSION_SCOPE,
        "output_mode": OUTPUT_MODE,
        "cpu_profile": CPU_PROFILE,
        "sidecar_directory_name": "KONTUR_PILOT_INFO",
        "allowed_policy_id": "kontur-scrap-mechanic-bounded-log-session-v0.1",
        "allowed_read_templates": [
            "runtime-collection-policy.json",
            "sessions/{session_id}/session-start.json",
            "sessions/{session_id}/session-final.json",
        ],
        "allowed_term_keys": [
            "character", "error", "inventory", "player", "quest", "save",
            "survival", "warning", "world",
        ],
        "allowed_lifecycle_keys": [
            "join_accepted", "player_loaded", "player_manager_cleanup",
            "player_manager_initialized", "world_added", "world_removed",
        ],
        "allowed_stop_reasons": [
            "budget_violation", "game_stopped", "manual_stop",
            "maximum_duration_reached", "observer_error", "stop_requested",
        ],
    }
    for field, value in expected.items():
        req(config.get(field) == value, f"adapter config boundary: {field}")
    req(config.get("max_read_bytes_per_file") == 262144, "bounded file size")
    for field in FALSE_CONFIG_FIELDS:
        req(config.get(field) is False, f"adapter config non-effect: {field}")


def validate_upstream_pilot(receipt):
    req(isinstance(receipt, dict), "local trial pilot receipt object")
    req(
        receipt.get("schema_version")
        == "kontur-game-companion-local-trial-pilot-receipt-v0.1",
        "local trial pilot schema",
    )
    digest = receipt.get("local_trial_pilot_receipt_digest")
    req(isinstance(digest, str) and HEX64_PATTERN.fullmatch(digest), "local pilot digest")
    req(
        digest
        == sha({key: value for key, value in receipt.items() if key != "local_trial_pilot_receipt_digest"}),
        "local pilot digest binding",
    )
    ready = receipt.get("decision") == "LOCAL_SYNTHETIC_TRIAL_PILOT_READY"
    req(receipt.get("trial_pilot_ready") is ready, "local trial readiness binding")
    if ready:
        req(receipt.get("human_external_sandbox_pilot_decision_required") is True, "human decision required")
        req(receipt.get("human_external_sandbox_pilot_decision_present") is False, "upstream cannot contain decision")
        req(receipt.get("runtime_connectedness") == "LOCAL_SYNTHETIC_TRIAL_ONLY_NOT_EXTERNAL", "upstream local only")
        for field in (
            "network_io_performed",
            "game_process_accessed",
            "game_files_modified",
            "audio_capture_started",
            "microphone_capture_started",
            "background_activity_started",
            "polling_started",
            "persistent_output_written",
        ):
            req(receipt.get(field) is False, f"upstream pilot non-effect: {field}")
    req(
        receipt.get("authority_effect")
        == receipt.get("action_effect")
        == receipt.get("successor_effect")
        == "NONE",
        "upstream pilot causal effects",
    )


def sidecar_root_reference_digest(sidecar_root):
    normalized = os.path.normcase(str(Path(sidecar_root).resolve(strict=False)))
    return sha({"kind": "KONTUR_EXTERNAL_SANDBOX_SIDECAR_ROOT_REF_V0.1", "normalized_path": normalized})


def default_ingest_context(pilot_receipt):
    validate_upstream_pilot(pilot_receipt)
    context = {
        "schema_version": "kontur-game-companion-external-sandbox-sidecar-ingest-context-v0.1",
        "source_local_trial_pilot_receipt_digest": pilot_receipt["local_trial_pilot_receipt_digest"],
        "external_sandbox_ingest_requested": False,
        "human_external_sandbox_decision": None,
        "session_id": None,
        "expected_policy_sha256": None,
        "sidecar_root_reference_digest": None,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in PRECHECK_FIELDS:
        context[field] = False
    for field in FORBIDDEN_REQUESTS:
        context[field] = False
    return context


def validate_ingest_context(pilot_receipt, context):
    validate_upstream_pilot(pilot_receipt)
    req(isinstance(context, dict), "ingest context object")
    req(set(context) == CONTEXT_KEYS, "ingest context exact keys")
    req(
        context.get("schema_version")
        == "kontur-game-companion-external-sandbox-sidecar-ingest-context-v0.1",
        "ingest context schema",
    )
    req(
        context.get("source_local_trial_pilot_receipt_digest")
        == pilot_receipt.get("local_trial_pilot_receipt_digest"),
        "ingest source pilot receipt",
    )
    req(type(context.get("external_sandbox_ingest_requested")) is bool, "ingest request bool")
    decision = context.get("human_external_sandbox_decision")
    req(decision is None or isinstance(decision, str), "human decision type")
    session_id = context.get("session_id")
    req(session_id is None or SESSION_ID_PATTERN.fullmatch(session_id), "bounded session id")
    expected_policy = context.get("expected_policy_sha256")
    req(expected_policy is None or HEX64_PATTERN.fullmatch(expected_policy), "expected policy digest")
    root_ref = context.get("sidecar_root_reference_digest")
    req(root_ref is None or HEX64_PATTERN.fullmatch(root_ref), "sidecar root reference")
    for field in PRECHECK_FIELDS:
        req(type(context.get(field)) is bool, f"ingest precheck: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(context.get(field) is False, f"forbidden ingest request: {field}")
    req(
        context.get("authority_effect")
        == context.get("action_effect")
        == context.get("successor_effect")
        == "NONE",
        "ingest context causal effects",
    )
    if not context["external_sandbox_ingest_requested"]:
        req(decision is None, "human decision without request")
        req(session_id is None and expected_policy is None and root_ref is None, "target data without request")
        for field in PRECHECK_FIELDS:
            req(context[field] is False, f"precheck without request: {field}")


def _is_reparse(path):
    attrs = getattr(path.lstat(), "st_file_attributes", 0)
    return bool(attrs & 0x400)


def _safe_component(path, kind):
    req(not path.is_symlink(), f"{kind} symlink denied")
    req(not _is_reparse(path), f"{kind} reparse point denied")


def _resolve_sidecar_root(sidecar_root, config):
    req(sidecar_root is not None, "sidecar root required")
    supplied = Path(sidecar_root)
    req(supplied.exists() and supplied.is_dir(), "sidecar root directory required")
    _safe_component(supplied, "sidecar root")
    resolved = supplied.resolve(strict=True)
    req(resolved.name == config["sidecar_directory_name"], "sidecar directory identity")
    return resolved


def _safe_file(root, relative_path):
    candidate = root.joinpath(*relative_path.split("/"))
    req(candidate.exists() and candidate.is_file(), f"required sidecar file: {relative_path}")
    current = root
    for part in relative_path.split("/"):
        current = current / part
        _safe_component(current, f"sidecar component {part}")
    resolved = candidate.resolve(strict=True)
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise KonturExternalSandboxIngestError("sidecar path escaped root") from exc
    req(resolved.suffix == ".json", "JSON sidecar files only")
    req(stat.S_ISREG(resolved.stat().st_mode), "regular sidecar file required")
    return resolved


def _read_json(root, relative_path, config, reads):
    path = _safe_file(root, relative_path)
    req(path.stat().st_size <= config["max_read_bytes_per_file"], "sidecar file size limit")
    raw = path.read_bytes()
    req(len(raw) <= config["max_read_bytes_per_file"], "sidecar file read size limit")
    try:
        decoded = raw.decode("utf-8")
        value = json.loads(decoded)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise KonturExternalSandboxIngestError("valid UTF-8 JSON sidecar file required") from exc
    req(isinstance(value, dict), "sidecar JSON object required")
    reads.append(relative_path)
    return raw, value


def _non_negative_int(value, field):
    req(type(value) is int and value >= 0, f"non-negative integer: {field}")


def _validate_non_effects(value, field):
    req(isinstance(value, dict) and set(value) == NON_EFFECT_KEYS, f"{field} exact non-effects")
    for key in NON_EFFECT_KEYS:
        req(value.get(key) is False, f"{field} non-effect: {key}")


def _validate_runtime_policy(policy, config):
    req(set(policy) == {
        "schema_version", "policy_id", "pilot_candidate_id", "target", "session",
        "observation", "checkpoint", "resource_targets", "denied_capabilities",
        "unlisted_capability_policy", "safe_effect",
    }, "runtime policy exact keys")
    req(policy.get("schema_version") == "0.1", "runtime policy schema")
    req(policy.get("policy_id") == config["allowed_policy_id"], "runtime policy id")
    target = policy.get("target")
    req(isinstance(target, dict) and set(target) == {
        "product", "source_relative_path", "output_relative_path", "private_absolute_path_publication"
    }, "runtime policy target")
    req(target.get("product") == "Scrap Mechanic", "runtime product")
    req(target.get("source_relative_path") == "Logs", "runtime source identity")
    req(target.get("output_relative_path") == "Release/KONTUR_PILOT_INFO/sessions", "runtime output identity")
    req(target.get("private_absolute_path_publication") is False, "private path publication")
    session = policy.get("session")
    req(isinstance(session, dict) and set(session) == {
        "manual_start", "manual_game_launch", "game_launch_by_observer",
        "maximum_duration_seconds", "single_active_session", "automatic_retry",
    }, "runtime session policy")
    req(session.get("manual_start") is True and session.get("manual_game_launch") is True, "manual session")
    req(session.get("game_launch_by_observer") is False, "observer cannot launch game")
    req(session.get("single_active_session") is True and session.get("automatic_retry") is False, "bounded session")
    req(
        type(session.get("maximum_duration_seconds")) is int
        and 0 < session["maximum_duration_seconds"] <= 14400,
        "bounded maximum session duration",
    )
    observation = policy.get("observation")
    req(isinstance(observation, dict) and set(observation) == {
        "event_driven_file_watcher", "reconciliation_interval_seconds",
        "control_signal_interval_seconds", "existing_log_bytes_at_start_skipped",
        "new_log_bytes_only", "raw_lines_retained_after_classification",
        "numeric_user_identifier_values_retained", "aggregate_term_counts_allowed",
        "lifecycle_category_counts_allowed",
    }, "runtime observation policy")
    req(type(observation.get("event_driven_file_watcher")) is bool, "watcher marker")
    req(
        type(observation.get("reconciliation_interval_seconds")) is int
        and 1 <= observation["reconciliation_interval_seconds"] <= 300,
        "bounded reconciliation interval",
    )
    req(
        type(observation.get("control_signal_interval_seconds")) is int
        and 1 <= observation["control_signal_interval_seconds"] <= 60,
        "bounded control interval",
    )
    req(observation.get("existing_log_bytes_at_start_skipped") is True, "historical bytes skipped")
    req(observation.get("new_log_bytes_only") is True, "new bytes only")
    req(observation.get("raw_lines_retained_after_classification") is False, "raw lines denied")
    req(observation.get("numeric_user_identifier_values_retained") is False, "identifiers denied")
    req(observation.get("aggregate_term_counts_allowed") is True, "aggregate terms only")
    req(observation.get("lifecycle_category_counts_allowed") is True, "lifecycle counts only")
    checkpoint = policy.get("checkpoint")
    req(isinstance(checkpoint, dict) and set(checkpoint) == {
        "create_only", "overwrite_allowed", "line_interval",
        "maximum_seconds_between_active_checkpoints", "allowed_extensions",
    }, "runtime checkpoint policy")
    req(checkpoint.get("create_only") is True and checkpoint.get("overwrite_allowed") is False, "create-only checkpoints")
    req(type(checkpoint.get("line_interval")) is int and 1 <= checkpoint["line_interval"] <= 10000, "bounded checkpoint line interval")
    req(
        type(checkpoint.get("maximum_seconds_between_active_checkpoints")) is int
        and 1 <= checkpoint["maximum_seconds_between_active_checkpoints"] <= 600,
        "bounded checkpoint time interval",
    )
    req(checkpoint.get("allowed_extensions") == [".json", ".txt"], "checkpoint file types")
    resources = policy.get("resource_targets")
    req(isinstance(resources, dict) and set(resources) == {
        "idle_total_cpu_percent", "working_set_mib", "budget_violation_effect",
        "performance_verified",
    }, "runtime resource policy")
    req(type(resources.get("idle_total_cpu_percent")) in (int, float) and 0 <= resources["idle_total_cpu_percent"] <= 1.0, "bounded idle CPU target")
    req(type(resources.get("working_set_mib")) is int and 1 <= resources["working_set_mib"] <= 256, "bounded working set")
    req(resources.get("budget_violation_effect") == "stop_session_and_record_unverified_resource_result", "budget violation effect")
    req(type(resources.get("performance_verified")) is bool, "performance verification marker")
    req(set(policy.get("denied_capabilities", [])) == DENIED_CAPABILITIES, "denied capability boundary")
    req(policy.get("unlisted_capability_policy") == "denied", "unlisted capability policy")
    req(policy.get("safe_effect") == "sanitized_observation_receipts_only", "runtime safe effect")


def _validate_session_start(value, session_id, policy_id, policy_sha256):
    req(set(value) == {
        "schema_version", "receipt_type", "session_id", "started_at", "policy_id",
        "policy_sha256", "executable", "baseline", "capability", "non_effects",
    }, "session start exact keys")
    req(value.get("schema_version") == "0.1", "session start schema")
    req(value.get("receipt_type") == "bounded_log_observation_session_start", "session start type")
    req(value.get("session_id") == session_id, "session start id")
    req(value.get("policy_id") == policy_id and value.get("policy_sha256") == policy_sha256, "session start policy provenance")
    req(isinstance(value.get("started_at"), str), "session start timestamp")
    executable = value.get("executable")
    req(isinstance(executable, dict) and set(executable) == {"relative_path", "size", "sha256"}, "executable evidence")
    req(executable.get("relative_path") == "Release/ScrapMechanic.exe", "relative executable path")
    _non_negative_int(executable.get("size"), "executable size")
    req(isinstance(executable.get("sha256"), str) and HEX64_PATTERN.fullmatch(executable["sha256"]), "executable digest")
    baseline = value.get("baseline")
    req(isinstance(baseline, dict) and set(baseline) == {
        "existing_log_file_count", "existing_log_total_bytes_skipped", "historical_bytes_processed"
    }, "session baseline")
    for field in baseline:
        _non_negative_int(baseline[field], f"baseline {field}")
    req(baseline.get("historical_bytes_processed") == 0, "historical bytes not processed")
    capability = value.get("capability")
    req(isinstance(capability, dict) and set(capability) == {
        "allowed", "unlisted_policy", "safe_effect"
    } and capability.get("allowed") == [
        "game.log.observe_new_bytes", "game.log.aggregate_sanitized_counts"
    ], "session allowed capability")
    req(capability.get("unlisted_policy") == "denied", "session unlisted policy")
    req(capability.get("safe_effect") == "sanitized_observation_receipts_only", "session safe effect")
    _validate_non_effects(value.get("non_effects"), "session start")


def _bounded_count_map(value, allowed_keys, field):
    req(isinstance(value, dict), f"{field} object")
    req(set(value).issubset(set(allowed_keys)), f"{field} bounded vocabulary")
    for key, count in value.items():
        _non_negative_int(count, f"{field} {key}")
    return {key: value[key] for key in sorted(value)}


def _validate_session_final(value, session_id, policy_id, policy_sha256, config):
    req(set(value) == {
        "schema_version", "receipt_type", "session_id", "started_at", "ended_at",
        "stop_reason", "policy_id", "policy_sha256", "aggregate", "raw_lines_stored",
        "identifier_values_stored", "game_action_executed", "recommendation_generated",
        "performance_claim_verified", "content_hash", "non_effects",
    }, "session final exact keys")
    req(value.get("schema_version") == "0.1", "session final schema")
    req(value.get("receipt_type") == "bounded_log_observation_session_final", "session final type")
    req(value.get("session_id") == session_id, "session final id")
    req(value.get("policy_id") == policy_id and value.get("policy_sha256") == policy_sha256, "session final policy provenance")
    req(isinstance(value.get("started_at"), str) and isinstance(value.get("ended_at"), str), "session final timestamps")
    req(value.get("stop_reason") in config["allowed_stop_reasons"], "bounded session stop reason")
    req(value.get("raw_lines_stored") is False, "final raw lines denied")
    req(value.get("identifier_values_stored") is False, "final identifiers denied")
    req(value.get("game_action_executed") is False, "final game action denied")
    req(value.get("recommendation_generated") is False, "final recommendation denied")
    req(type(value.get("performance_claim_verified")) is bool, "performance claim marker")
    content_hash = value.get("content_hash")
    req(isinstance(content_hash, str) and content_hash.startswith("sha256:") and HEX64_PATTERN.fullmatch(content_hash[7:]), "final content hash")
    _validate_non_effects(value.get("non_effects"), "session final")
    aggregate = value.get("aggregate")
    req(isinstance(aggregate, dict) and set(aggregate) == {
        "bytes_processed", "lines_processed", "log_files_observed",
        "sensitive_identifier_line_count", "identifier_values_stored", "raw_lines_stored",
        "severity_counts", "term_counts", "lifecycle_counts",
    }, "session aggregate exact keys")
    for field in ("bytes_processed", "lines_processed", "sensitive_identifier_line_count"):
        _non_negative_int(aggregate.get(field), f"aggregate {field}")
    req(aggregate.get("identifier_values_stored") is False, "aggregate identifiers denied")
    req(aggregate.get("raw_lines_stored") is False, "aggregate raw lines denied")
    log_files = aggregate.get("log_files_observed")
    req(isinstance(log_files, list) and len(log_files) <= 256, "bounded log file list")
    for name in log_files:
        req(isinstance(name, str) and name.endswith(".log"), "log basename")
        req(Path(name).name == name and "/" not in name and "\\" not in name, "no log path")
    severity = _bounded_count_map(aggregate.get("severity_counts"), ("error", "warning"), "severity counts")
    terms = _bounded_count_map(aggregate.get("term_counts"), config["allowed_term_keys"], "term counts")
    lifecycle = _bounded_count_map(aggregate.get("lifecycle_counts"), config["allowed_lifecycle_keys"], "lifecycle counts")
    return {
        "bytes_processed": aggregate["bytes_processed"],
        "lines_processed": aggregate["lines_processed"],
        "log_file_count": len(log_files),
        "sensitive_identifier_line_count": aggregate["sensitive_identifier_line_count"],
        "identifier_values_stored": False,
        "raw_lines_stored": False,
        "severity_counts": severity,
        "term_counts": terms,
        "lifecycle_counts": lifecycle,
        "stop_reason": value["stop_reason"],
        "performance_claim_verified": value["performance_claim_verified"],
    }


def _empty_evidence():
    return {
        "session_id": None,
        "policy_id": None,
        "policy_sha256": None,
        "session_start_sha256": None,
        "session_final_sha256": None,
        "external_session_evidence_ref": None,
        "sanitized_summary": None,
        "files_read": [],
    }


def _read_completed_session(sidecar_root, session_id, expected_policy_sha256, config):
    req(SESSION_ID_PATTERN.fullmatch(session_id), "bounded session id")
    root = _resolve_sidecar_root(sidecar_root, config)
    reads = []
    policy_raw, policy = _read_json(root, "runtime-collection-policy.json", config, reads)
    policy_sha256 = sha_bytes(policy_raw)
    req(policy_sha256 == expected_policy_sha256, "runtime policy digest mismatch")
    _validate_runtime_policy(policy, config)
    start_rel = f"sessions/{session_id}/session-start.json"
    final_rel = f"sessions/{session_id}/session-final.json"
    start_raw, start = _read_json(root, start_rel, config, reads)
    final_raw, final = _read_json(root, final_rel, config, reads)
    _validate_session_start(start, session_id, policy["policy_id"], policy_sha256)
    summary = _validate_session_final(final, session_id, policy["policy_id"], policy_sha256, config)
    req(final.get("started_at") == start.get("started_at"), "session start/final timestamp continuity")
    start_sha256 = sha_bytes(start_raw)
    final_sha256 = sha_bytes(final_raw)
    return {
        "session_id": session_id,
        "policy_id": policy["policy_id"],
        "policy_sha256": policy_sha256,
        "session_start_sha256": start_sha256,
        "session_final_sha256": final_sha256,
        "external_session_evidence_ref": sha({
            "kind": "KONTUR_EXTERNAL_SANDBOX_COMPLETED_SESSION_EVIDENCE_V0.1",
            "policy_sha256": policy_sha256,
            "session_start_sha256": start_sha256,
            "session_final_sha256": final_sha256,
            "session_id": session_id,
        }),
        "sanitized_summary": summary,
        "files_read": reads,
    }


def _derive_pre_io_decision(pilot_receipt, context):
    if pilot_receipt.get("decision") != "LOCAL_SYNTHETIC_TRIAL_PILOT_READY":
        return "NOT_APPLICABLE", "LOCAL_SYNTHETIC_TRIAL_PILOT_READY_REQUIRED"
    if not context["external_sandbox_ingest_requested"]:
        return "EXTERNAL_SANDBOX_INGEST_NOT_STARTED", "EXPLICIT_EXTERNAL_SANDBOX_INGEST_REQUEST_ABSENT"
    complete = (
        context["human_external_sandbox_decision"] == HUMAN_DECISION
        and context["session_id"] is not None
        and context["expected_policy_sha256"] is not None
        and context["sidecar_root_reference_digest"] is not None
        and all(context[field] for field in PRECHECK_FIELDS)
    )
    if not complete:
        return "EXTERNAL_SANDBOX_PRECHECK_REQUIRED", "HUMAN_DECISION_OR_READ_ONLY_PRECHECK_INCOMPLETE"
    return None, None


def ingest_completed_session(pilot_receipt, context=None, sidecar_root=None, config=None):
    cfg = load_config() if config is None else copy.deepcopy(config)
    validate_config(cfg)
    validate_upstream_pilot(pilot_receipt)
    ctx = default_ingest_context(pilot_receipt) if context is None else copy.deepcopy(context)
    validate_ingest_context(pilot_receipt, ctx)
    decision, reason = _derive_pre_io_decision(pilot_receipt, ctx)
    evidence = _empty_evidence()
    success = False
    if decision is None:
        req(
            ctx["sidecar_root_reference_digest"] == sidecar_root_reference_digest(sidecar_root),
            "sidecar root request binding",
        )
        evidence = _read_completed_session(
            sidecar_root,
            ctx["session_id"],
            ctx["expected_policy_sha256"],
            cfg,
        )
        decision = "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED"
        reason = "THREE_BOUNDED_SANITIZED_SIDECAR_RECEIPTS_VALIDATED"
        success = True

    out = {
        "schema_version": "kontur-game-companion-external-sandbox-sidecar-ingest-receipt-v0.1",
        "status": "BOUNDED_EXTERNAL_SANDBOX_READ_ONLY_OBSERVATION",
        "source_local_trial_pilot_receipt_digest": pilot_receipt["local_trial_pilot_receipt_digest"],
        "source_pilot_run_ref": pilot_receipt.get("pilot_run_ref"),
        "connection_request_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "adapter_mode": ADAPTER_MODE,
        "input_scope": INPUT_SCOPE,
        "session_scope": SESSION_SCOPE,
        "output_mode": OUTPUT_MODE,
        "cpu_profile": CPU_PROFILE,
        "sidecar_directory_name": cfg["sidecar_directory_name"],
        **evidence,
        "external_environment_connected": success,
        "external_file_read_authorized": success,
        "external_file_io_performed": success,
        "completed_session_ingested": success,
        "human_decision_present": success,
        "next_decision_boundary": NEXT_DECISION_BOUNDARY if success else PREVIOUS_DECISION_BOUNDARY,
        "private_absolute_path_stored": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": (
            "EXTERNAL_SANDBOX_SIDECAR_READ_ONLY_COMPLETED_SESSION"
            if success
            else "LOCAL_PRECHECK_ONLY_NOT_EXTERNAL"
        ),
    }
    for field in FALSE_EFFECTS:
        out[field] = False
    validate_ingest_receipt(pilot_receipt, ctx, out)
    out["external_sandbox_sidecar_ingest_receipt_digest"] = sha(out)
    return out


def validate_ingest_receipt(pilot_receipt, context, out):
    validate_ingest_context(pilot_receipt, context)
    req(isinstance(out, dict), "ingest receipt object")
    req(set(out).issubset(RECEIPT_KEYS), "ingest receipt known keys")
    missing = RECEIPT_KEYS - {"external_sandbox_sidecar_ingest_receipt_digest"} - set(out)
    req(not missing, "ingest receipt required keys")
    req(
        out.get("schema_version")
        == "kontur-game-companion-external-sandbox-sidecar-ingest-receipt-v0.1",
        "ingest receipt schema",
    )
    req(out.get("status") == "BOUNDED_EXTERNAL_SANDBOX_READ_ONLY_OBSERVATION", "ingest receipt status")
    req(out.get("source_local_trial_pilot_receipt_digest") == pilot_receipt["local_trial_pilot_receipt_digest"], "ingest source digest")
    req(out.get("source_pilot_run_ref") == pilot_receipt.get("pilot_run_ref"), "ingest pilot run ref")
    req(out.get("connection_request_digest") == sha(context), "ingest request digest")
    expected_boundaries = {
        "adapter_mode": ADAPTER_MODE,
        "input_scope": INPUT_SCOPE,
        "session_scope": SESSION_SCOPE,
        "output_mode": OUTPUT_MODE,
        "cpu_profile": CPU_PROFILE,
        "sidecar_directory_name": "KONTUR_PILOT_INFO",
    }
    for field, value in expected_boundaries.items():
        req(out.get(field) == value, f"ingest receipt boundary: {field}")
    pre_decision, _ = _derive_pre_io_decision(pilot_receipt, context)
    success = pre_decision is None
    expected_decision = "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED" if success else pre_decision
    req(out.get("decision") == expected_decision, "ingest decision derivation")
    for field in (
        "external_environment_connected",
        "external_file_read_authorized",
        "external_file_io_performed",
        "completed_session_ingested",
        "human_decision_present",
    ):
        req(out.get(field) is success, f"ingest success marker: {field}")
    if success:
        req(out.get("session_id") == context["session_id"], "ingested session id")
        req(out.get("policy_id") == "kontur-scrap-mechanic-bounded-log-session-v0.1", "ingested policy id")
        req(out.get("policy_sha256") == context["expected_policy_sha256"], "ingested policy digest")
        for field in ("session_start_sha256", "session_final_sha256", "external_session_evidence_ref"):
            req(isinstance(out.get(field), str) and HEX64_PATTERN.fullmatch(out[field]), f"ingest evidence: {field}")
        req(
            out.get("external_session_evidence_ref") == sha({
                "kind": "KONTUR_EXTERNAL_SANDBOX_COMPLETED_SESSION_EVIDENCE_V0.1",
                "policy_sha256": out["policy_sha256"],
                "session_start_sha256": out["session_start_sha256"],
                "session_final_sha256": out["session_final_sha256"],
                "session_id": out["session_id"],
            }),
            "external session evidence binding",
        )
        req(isinstance(out.get("sanitized_summary"), dict) and set(out["sanitized_summary"]) == SUMMARY_KEYS, "sanitized summary shape")
        summary = out["sanitized_summary"]
        for field in (
            "bytes_processed", "lines_processed", "log_file_count",
            "sensitive_identifier_line_count",
        ):
            _non_negative_int(summary.get(field), f"receipt summary {field}")
        req(summary.get("identifier_values_stored") is False, "receipt summary identifiers denied")
        req(summary.get("raw_lines_stored") is False, "receipt summary raw lines denied")
        _bounded_count_map(summary.get("severity_counts"), ("error", "warning"), "receipt severity counts")
        _bounded_count_map(summary.get("term_counts"), load_config()["allowed_term_keys"], "receipt term counts")
        _bounded_count_map(summary.get("lifecycle_counts"), load_config()["allowed_lifecycle_keys"], "receipt lifecycle counts")
        req(summary.get("stop_reason") in load_config()["allowed_stop_reasons"], "receipt stop reason")
        req(type(summary.get("performance_claim_verified")) is bool, "receipt performance marker")
        req(out.get("files_read") == [
            "runtime-collection-policy.json",
            f"sessions/{context['session_id']}/session-start.json",
            f"sessions/{context['session_id']}/session-final.json",
        ], "exact files read")
        req(out.get("next_decision_boundary") == NEXT_DECISION_BOUNDARY, "next human boundary")
        req(out.get("runtime_connectedness") == "EXTERNAL_SANDBOX_SIDECAR_READ_ONLY_COMPLETED_SESSION", "external read-only connectedness")
    else:
        for field in (
            "session_id", "policy_id", "policy_sha256", "session_start_sha256",
            "session_final_sha256", "external_session_evidence_ref", "sanitized_summary",
        ):
            req(out.get(field) is None, f"no evidence before ingest: {field}")
        req(out.get("files_read") == [], "no files read before ingest")
        req(out.get("next_decision_boundary") == PREVIOUS_DECISION_BOUNDARY, "previous human boundary retained")
        req(out.get("runtime_connectedness") == "LOCAL_PRECHECK_ONLY_NOT_EXTERNAL", "precheck connectedness")
    req(out.get("private_absolute_path_stored") is False, "private path non-effect")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"external ingest non-effect: {field}")
    req(
        out.get("authority_effect")
        == out.get("action_effect")
        == out.get("successor_effect")
        == "NONE",
        "ingest receipt causal effects",
    )
    digest = out.get("external_sandbox_sidecar_ingest_receipt_digest")
    if digest is not None:
        req(isinstance(digest, str) and HEX64_PATTERN.fullmatch(digest), "ingest receipt digest")
        req(
            digest == sha({
                key: value
                for key, value in out.items()
                if key != "external_sandbox_sidecar_ingest_receipt_digest"
            }),
            "ingest receipt digest binding",
        )
