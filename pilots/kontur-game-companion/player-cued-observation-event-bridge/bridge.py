#!/usr/bin/env python3
"""Pure synthetic bridge from completed observation evidence to an event candidate.

The module intentionally has no repository, game, process, network, clock, or storage
access. Digests establish deterministic byte binding only; they do not authenticate a
human, a runtime state, or freshness outside the supplied synthetic state frontier.
"""

import hashlib
import json
import re


class PlayerCuedObservationBridgeError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise PlayerCuedObservationBridgeError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode("utf-8")).hexdigest()


SCHEMA_VERSION = "kontur-game-companion-player-cued-observation-event-bridge-receipt-v0.1"
STATE_SCHEMA_VERSION = "kontur-game-companion-synthetic-conversation-state-anchor-v0.1"
CUE_SCHEMA_VERSION = "kontur-game-companion-synthetic-structured-cue-v0.1"
EVENT_CANDIDATE_SCHEMA_VERSION = "kontur-game-companion-player-event-candidate-v0.1"
STATUS = "SYNTHETIC_NON_EXECUTING_COMPLETED_OBSERVATION_CONTEXT_BRIDGE"
EVIDENCE_MODE = "COMPLETED_SANITIZED_AGGREGATE_ONLY"
STATE_PROVENANCE_MODE = "SYNTHETIC_CALLER_SUPPLIED_NOT_RUNTIME_AUTHENTICATED"
CUE_PROVENANCE_MODE = "SYNTHETIC_STRUCTURED_CUE_NOT_HUMAN_AUTHENTICATED"
EXPECTED_POLICY_SHA256 = "3de8b6e4451bd5c876dfa7898612af4fc87848d337a686987118bc54ff661b6d"
FUTURE_HUMAN_DECISION = "HUMAN_BOUNDED_REACTIVE_DIALOGUE_SANDBOX_DECISION_REQUIRED"

HEX64 = re.compile(r"^[0-9a-f]{64}$")
SESSION_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,95}$")

SOURCE_FALSE_EFFECTS = (
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

SOURCE_SUMMARY_KEYS = {
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

SOURCE_RECEIPT_KEYS = {
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
    *SOURCE_FALSE_EFFECTS,
    "external_sandbox_sidecar_ingest_receipt_digest",
}

ALLOWED_TERM_KEYS = {
    "character",
    "error",
    "inventory",
    "player",
    "quest",
    "save",
    "survival",
    "warning",
    "world",
}
ALLOWED_LIFECYCLE_KEYS = {
    "join_accepted",
    "player_loaded",
    "player_manager_cleanup",
    "player_manager_initialized",
    "world_added",
    "world_removed",
}
ALLOWED_STOP_REASONS = {
    "budget_violation",
    "game_stopped",
    "manual_stop",
    "maximum_duration_reached",
    "observer_error",
    "stop_requested",
}

CATEGORIES = (
    "LIFECYCLE_COUNTS",
    "SEVERITY_COUNTS",
    "TERM_COUNTS",
)
CATEGORY_TO_SUMMARY = {
    "LIFECYCLE_COUNTS": "lifecycle_counts",
    "SEVERITY_COUNTS": "severity_counts",
    "TERM_COUNTS": "term_counts",
}
CATEGORY_SEMANTICS = {
    "LIFECYCLE_COUNTS": "MATCH_COUNT_ONLY_NO_ORDER_CAUSALITY_OR_SUCCESS",
    "SEVERITY_COUNTS": "BRACKETED_SEVERITY_PATTERN_LINE_COUNT_ONLY",
    "TERM_COUNTS": "CASE_INSENSITIVE_SUBSTRING_LINE_COUNT_ONLY",
}
CATEGORY_FOCUS = {
    "LIFECYCLE_COUNTS": "completed-observation-lifecycle-counts",
    "SEVERITY_COUNTS": "completed-observation-severity-counts",
    "TERM_COUNTS": "completed-observation-term-counts",
}

CUE_CLASSES = {
    "NONE",
    "ASK_POST_SESSION_OVERVIEW",
    "SELECT_LIFECYCLE_COUNTS",
    "SELECT_SEVERITY_COUNTS",
    "SELECT_TERM_COUNTS",
    "ASK_ABOUT_SELECTED_CATEGORY",
    "PAUSE",
    "RESUME",
    "DECLINE",
    "REDIRECT",
}
SELECT_CUE_TO_CATEGORY = {
    "SELECT_LIFECYCLE_COUNTS": "LIFECYCLE_COUNTS",
    "SELECT_SEVERITY_COUNTS": "SEVERITY_COUNTS",
    "SELECT_TERM_COUNTS": "TERM_COUNTS",
}
NO_CATEGORY_CUES = {
    "NONE",
    "ASK_POST_SESSION_OVERVIEW",
    "PAUSE",
    "RESUME",
    "DECLINE",
    "REDIRECT",
}
EVENT_FOR_CUE = {
    "ASK_POST_SESSION_OVERVIEW": (
        "PLAYER_REQUESTS_COMPLETED_OBSERVATION_REVIEW",
        "CONVERSATION",
    ),
    "SELECT_LIFECYCLE_COUNTS": (
        "PLAYER_SELECTS_COMPLETED_OBSERVATION_CONTEXT",
        "CONVERSATION",
    ),
    "SELECT_SEVERITY_COUNTS": (
        "PLAYER_SELECTS_COMPLETED_OBSERVATION_CONTEXT",
        "CONVERSATION",
    ),
    "SELECT_TERM_COUNTS": (
        "PLAYER_SELECTS_COMPLETED_OBSERVATION_CONTEXT",
        "CONVERSATION",
    ),
    "ASK_ABOUT_SELECTED_CATEGORY": (
        "PLAYER_REQUESTS_COMPLETED_OBSERVATION_CONTEXT",
        "CONVERSATION",
    ),
    "PAUSE": ("PAUSE", "NONE"),
    "RESUME": ("RESUME", "NONE"),
}

STATE_FIELD_KEYS = {
    "schema_version",
    "scope_id",
    "last_turn",
    "session_phase",
    "source_ingest_receipt_digest",
    "source_external_session_evidence_ref",
    "provenance_mode",
    "runtime_state_authenticated",
    "stored_help_authority",
    "stored_solution_authority",
    "stored_response_authority",
    "solver_mode",
    "player_profile_created",
}
STATE_KEYS = STATE_FIELD_KEYS | {"state_digest"}

CUE_FIELD_KEYS = {
    "schema_version",
    "cue_class",
    "scope",
    "turn",
    "target_scope_id",
    "source_state_anchor_digest",
    "source_external_session_evidence_ref",
    "selected_category",
    "provenance_mode",
    "human_identity_authenticated",
    "input_adapter_verified",
    "replay_protection_present",
    "raw_text_stored",
    "audio_stored",
    "speaker_identifier_stored",
}
CUE_KEYS = CUE_FIELD_KEYS | {"cue_digest"}

FOCUS_CANDIDATE_KEYS = {
    "candidate_id",
    "category",
    "origin",
    "source_ingest_receipt_digest",
    "source_external_session_evidence_ref",
    "source_summary_digest",
    "source_structured_cue_digest",
    "source_state_anchor_digest",
    "target_scope_id",
    "source_turn",
    "claim_scope",
    "count_semantics",
    "interpretation",
    "optional",
    "unranked",
    "count_ranking_used",
    "selection_objective",
    "values_disclosed",
    "player_selected_category",
    "current_focus_source",
    "durable_preference_created",
    "player_interest_inferred",
    "player_attention_inferred",
    "mood_inferred",
    "psychological_profile_created",
    "semantic_game_fact_claimed",
    "spoiler_depth",
    "help_depth",
    "candidate_digest",
}

EVENT_CANDIDATE_KEYS = {
    "schema_version",
    "turn",
    "speaker",
    "event",
    "player_intent",
    "focus",
    "scope_id",
    "source_state_anchor_digest",
    "source_structured_cue_digest",
    "source_ingest_receipt_digest",
    "source_external_session_evidence_ref",
    "source_summary_digest",
    "observation_scope",
    "cue_authentication_proven",
    "input_adapter_verified",
    "cue_replay_protection_proven",
    "runtime_state_authentication_proven",
    "current_game_state_claimed",
    "semantic_game_fact_claimed",
    "downstream_admission_proven",
    "runtime_eligible",
    "event_candidate_digest",
}

NON_EFFECT_FIELDS = (
    "live_response_generation",
    "language_model_invocation",
    "proactive_messaging",
    "background_activity",
    "game_process_access",
    "game_action_execution",
    "game_account_control",
    "network_io",
    "message_send",
    "audio_capture",
    "microphone_capture",
    "screen_capture",
    "input_emulation",
    "raw_log_read",
    "raw_human_text_persisted",
    "identifier_value_persisted",
    "behavioral_profile",
    "psychological_inference",
    "mood_inference",
    "attention_tracking",
    "engagement_optimization",
    "retention_optimization",
    "durable_preference",
    "cross_game_profile",
    "total_history_capture",
    "stable_core_promotion",
    "human_identity_authentication",
    "input_adapter_authentication",
    "replay_registry",
    "runtime_state_read",
    "downstream_policy_evaluation",
    "state_transition",
    "suppression_state_persistence",
)

OUTPUT_KEYS = {
    "schema_version",
    "status",
    "decision",
    "reason",
    "source_ingest_receipt_digest",
    "source_external_session_evidence_ref",
    "source_summary_digest",
    "source_receipt_integrity_validated",
    "source_authenticity_proven",
    "source_signal_class",
    "source_is_current_game_event",
    "evidence_mode",
    "source_state_anchor_digest",
    "state_scope_id",
    "state_phase",
    "state_frontier_binding_proven",
    "runtime_state_authentication_proven",
    "structured_cue_digest",
    "structured_cue_class",
    "cue_frontier_current",
    "cue_provenance_mode",
    "cue_authentication_proven",
    "input_adapter_verified",
    "cue_replay_protection_proven",
    "request_scope",
    "interaction_owner",
    "focus_source",
    "selected_category",
    "focus_candidate_categories",
    "observation_focus_candidates",
    "player_event_candidate_created",
    "player_event_candidate",
    "suppression_receipt_created",
    "suppression_scope",
    "durable_suppression_state_created",
    "state_transition_applied",
    "help_request",
    "candidate_envelope_compatibility_only",
    "candidate_envelope_admission_proven",
    "downstream_policy_evaluation_performed",
    "event_runtime_eligible",
    "current_game_state_claimed",
    "semantic_game_fact_claimed",
    "response_text",
    "response_admissible",
    "message_send_eligible",
    "response_authority_created",
    "send_authority",
    "action_permit_created",
    "successor_permit_created",
    "future_help_authority",
    "future_solution_authority",
    "persistent_solver_mode",
    "authority_effect",
    "action_effect",
    "successor_effect",
    "next_boundary",
    "next_human_decision",
    "non_effects",
    "bridge_receipt_digest",
}


def _hex64(value, label):
    req(isinstance(value, str) and HEX64.fullmatch(value), label)


def validate_source_ingest_receipt(source):
    """Validate exact successful upstream semantics without executing upstream code."""

    req(isinstance(source, dict) and set(source) == SOURCE_RECEIPT_KEYS, "source exact keys")
    fixed = {
        "schema_version": "kontur-game-companion-external-sandbox-sidecar-ingest-receipt-v0.1",
        "status": "BOUNDED_EXTERNAL_SANDBOX_READ_ONLY_OBSERVATION",
        "decision": "READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED",
        "reason": "THREE_BOUNDED_SANITIZED_SIDECAR_RECEIPTS_VALIDATED",
        "adapter_mode": "EXTERNAL_SANDBOX_READ_ONLY_COMPLETED_SIDECAR_INGEST",
        "input_scope": "COMPLETED_SANITIZED_SESSION_RECEIPTS_ONLY",
        "session_scope": "ONE_PROCESS_INVOCATION",
        "output_mode": "STDOUT_JSON_RECEIPT_ONLY",
        "cpu_profile": "BOUNDED_SINGLE_SHOT_NO_POLLING",
        "sidecar_directory_name": "KONTUR_PILOT_INFO",
        "policy_id": "kontur-scrap-mechanic-bounded-log-session-v0.1",
        "policy_sha256": EXPECTED_POLICY_SHA256,
        "next_decision_boundary": "HUMAN_NEW_OBSERVATION_SESSION_START_DECISION_REQUIRED",
        "runtime_connectedness": "EXTERNAL_SANDBOX_SIDECAR_READ_ONLY_COMPLETED_SESSION",
    }
    for field, expected in fixed.items():
        req(source.get(field) == expected, f"source fixed boundary: {field}")

    session_id = source.get("session_id")
    req(isinstance(session_id, str) and SESSION_ID.fullmatch(session_id), "source session id")
    for field in (
        "source_local_trial_pilot_receipt_digest",
        "source_pilot_run_ref",
        "connection_request_digest",
        "policy_sha256",
        "session_start_sha256",
        "session_final_sha256",
        "external_session_evidence_ref",
        "external_sandbox_sidecar_ingest_receipt_digest",
    ):
        _hex64(source.get(field), f"source digest: {field}")

    for field in (
        "external_environment_connected",
        "external_file_read_authorized",
        "external_file_io_performed",
        "completed_session_ingested",
        "human_decision_present",
    ):
        req(source.get(field) is True, f"source success marker: {field}")
    req(source.get("private_absolute_path_stored") is False, "source private path denied")
    req(
        source.get("authority_effect")
        == source.get("action_effect")
        == source.get("successor_effect")
        == "NONE",
        "source effects",
    )
    for field in SOURCE_FALSE_EFFECTS:
        req(source.get(field) is False, f"source non-effect: {field}")

    req(
        source.get("files_read")
        == [
            "runtime-collection-policy.json",
            f"sessions/{session_id}/session-start.json",
            f"sessions/{session_id}/session-final.json",
        ],
        "source exact read set",
    )
    req(
        source["external_session_evidence_ref"]
        == sha(
            {
                "kind": "KONTUR_EXTERNAL_SANDBOX_COMPLETED_SESSION_EVIDENCE_V0.1",
                "policy_sha256": source["policy_sha256"],
                "session_start_sha256": source["session_start_sha256"],
                "session_final_sha256": source["session_final_sha256"],
                "session_id": session_id,
            }
        ),
        "source evidence binding",
    )

    summary = source.get("sanitized_summary")
    req(isinstance(summary, dict) and set(summary) == SOURCE_SUMMARY_KEYS, "source summary shape")
    for field in (
        "bytes_processed",
        "lines_processed",
        "log_file_count",
        "sensitive_identifier_line_count",
    ):
        req(type(summary.get(field)) is int and summary[field] >= 0, f"source count: {field}")
    lines = summary["lines_processed"]
    req(summary["sensitive_identifier_line_count"] <= lines, "source sensitive lines bound")
    req(summary.get("identifier_values_stored") is False, "source identifiers denied")
    req(summary.get("raw_lines_stored") is False, "source raw lines denied")
    for field, allowed in (
        ("severity_counts", {"error", "warning"}),
        ("term_counts", ALLOWED_TERM_KEYS),
        ("lifecycle_counts", ALLOWED_LIFECYCLE_KEYS),
    ):
        counts = summary.get(field)
        req(isinstance(counts, dict) and set(counts).issubset(allowed), f"source {field} vocabulary")
        for key, value in counts.items():
            req(type(value) is int and 0 <= value <= lines, f"source {field}.{key} line bound")
    req(summary.get("stop_reason") in ALLOWED_STOP_REASONS, "source stop reason")
    req(type(summary.get("performance_claim_verified")) is bool, "source performance marker")
    req(
        source["external_sandbox_sidecar_ingest_receipt_digest"]
        == sha(
            {
                key: value
                for key, value in source.items()
                if key != "external_sandbox_sidecar_ingest_receipt_digest"
            }
        ),
        "source receipt digest binding",
    )
    return source


def expected_scope_id(source):
    validate_source_ingest_receipt(source)
    return f"game:kontur:completed-observation:{source['external_session_evidence_ref'][:16]}"


def seal_state(fields, source):
    req(isinstance(fields, dict) and set(fields) == STATE_FIELD_KEYS, "state field set")
    state = dict(fields)
    state["state_digest"] = sha(state)
    validate_state(state, source)
    return state


def validate_state(state, source):
    validate_source_ingest_receipt(source)
    req(isinstance(state, dict) and set(state) == STATE_KEYS, "state exact keys")
    req(state.get("schema_version") == STATE_SCHEMA_VERSION, "state schema")
    req(state.get("scope_id") == expected_scope_id(source), "state/source scope binding")
    req(type(state.get("last_turn")) is int and 0 <= state["last_turn"] <= 1_000_000, "state turn")
    req(state.get("session_phase") in {"ACTIVE", "PAUSED", "RESUMED_NEUTRAL"}, "state phase")
    req(
        state.get("source_ingest_receipt_digest")
        == source["external_sandbox_sidecar_ingest_receipt_digest"],
        "state/source receipt binding",
    )
    req(
        state.get("source_external_session_evidence_ref")
        == source["external_session_evidence_ref"],
        "state/source evidence binding",
    )
    req(state.get("provenance_mode") == STATE_PROVENANCE_MODE, "state provenance honesty")
    req(state.get("runtime_state_authenticated") is False, "runtime state authentication denied")
    for field in (
        "stored_help_authority",
        "stored_solution_authority",
        "stored_response_authority",
        "solver_mode",
        "player_profile_created",
    ):
        req(state.get(field) is False, f"state authority denied: {field}")
    _hex64(state.get("state_digest"), "state digest")
    req(
        state["state_digest"]
        == sha({key: value for key, value in state.items() if key != "state_digest"}),
        "state digest binding",
    )
    return state


def seal_cue(fields, source, state):
    req(isinstance(fields, dict) and set(fields) == CUE_FIELD_KEYS, "cue field set")
    cue = dict(fields)
    cue["cue_digest"] = sha(cue)
    validate_cue(cue, source, state)
    return cue


def validate_cue(cue, source, state):
    validate_state(state, source)
    req(isinstance(cue, dict) and set(cue) == CUE_KEYS, "cue exact keys")
    req(cue.get("schema_version") == CUE_SCHEMA_VERSION, "cue schema")
    cue_class = cue.get("cue_class")
    req(cue_class in CUE_CLASSES, "cue class")
    req(cue.get("scope") == "THIS_INTERACTION_ONLY", "cue scope")
    req(type(cue.get("turn")) is int and 1 <= cue["turn"] <= 1_000_001, "cue turn")
    req(cue.get("target_scope_id") == state["scope_id"], "cue/state scope binding")
    req(
        cue.get("source_state_anchor_digest") == state["state_digest"],
        "cue/state frontier binding",
    )
    req(
        cue.get("source_external_session_evidence_ref")
        == source["external_session_evidence_ref"],
        "cue/source evidence binding",
    )
    req(cue.get("provenance_mode") == CUE_PROVENANCE_MODE, "cue provenance honesty")
    for field in (
        "human_identity_authenticated",
        "input_adapter_verified",
        "replay_protection_present",
        "raw_text_stored",
        "audio_stored",
        "speaker_identifier_stored",
    ):
        req(cue.get(field) is False, f"cue boundary denied: {field}")
    selected = cue.get("selected_category")
    if cue_class in SELECT_CUE_TO_CATEGORY:
        req(selected == SELECT_CUE_TO_CATEGORY[cue_class], "selected cue/category binding")
    elif cue_class == "ASK_ABOUT_SELECTED_CATEGORY":
        req(selected in CATEGORIES, "question context category")
    elif cue_class in NO_CATEGORY_CUES:
        req(selected is None, "cue category must be absent")
    else:
        raise PlayerCuedObservationBridgeError("unhandled cue class")
    _hex64(cue.get("cue_digest"), "cue digest")
    req(
        cue["cue_digest"]
        == sha({key: value for key, value in cue.items() if key != "cue_digest"}),
        "cue digest binding",
    )
    return cue


def category_has_signal(summary, category):
    return any(value > 0 for value in summary[CATEGORY_TO_SUMMARY[category]].values())


def requested_categories(summary, cue):
    if cue["cue_class"] == "ASK_POST_SESSION_OVERVIEW":
        return [category for category in CATEGORIES if category_has_signal(summary, category)]
    selected = cue.get("selected_category")
    if selected in CATEGORIES and category_has_signal(summary, selected):
        return [selected]
    return []


def make_focus_candidate(source, state, cue, category):
    source_summary_digest = sha(source["sanitized_summary"])
    binding = {
        "category": category,
        "source_ingest_receipt_digest": source["external_sandbox_sidecar_ingest_receipt_digest"],
        "source_external_session_evidence_ref": source["external_session_evidence_ref"],
        "source_summary_digest": source_summary_digest,
        "source_structured_cue_digest": cue["cue_digest"],
        "source_state_anchor_digest": state["state_digest"],
        "target_scope_id": state["scope_id"],
        "source_turn": cue["turn"],
    }
    overview = cue["cue_class"] == "ASK_POST_SESSION_OVERVIEW"
    candidate = {
        "candidate_id": f"completed-observation-{category.lower().replace('_', '-')}-{sha(binding)[:16]}",
        **binding,
        "origin": "SYNTHETIC_PLAYER_CUED_COMPLETED_OBSERVATION_CONTEXT",
        "claim_scope": "SANITIZED_AGGREGATE_CATEGORY_ONLY",
        "count_semantics": CATEGORY_SEMANTICS[category],
        "interpretation": "NONE",
        "optional": True,
        "unranked": True,
        "count_ranking_used": False,
        "selection_objective": "PLAYER_ASSERTED_REVIEW_CONTEXT",
        "values_disclosed": False,
        "player_selected_category": not overview,
        "current_focus_source": "PLAYER_REQUESTED_OVERVIEW" if overview else "PLAYER_SELECTED",
        "durable_preference_created": False,
        "player_interest_inferred": False,
        "player_attention_inferred": False,
        "mood_inferred": False,
        "psychological_profile_created": False,
        "semantic_game_fact_claimed": False,
        "spoiler_depth": "NONE",
        "help_depth": "NONE",
    }
    candidate["candidate_digest"] = sha(candidate)
    req(set(candidate) == FOCUS_CANDIDATE_KEYS, "focus candidate exact keys")
    return candidate


def make_event_candidate(source, state, cue, categories):
    cue_class = cue["cue_class"]
    if cue_class not in EVENT_FOR_CUE:
        return None
    if cue_class not in {"PAUSE", "RESUME"} and not categories:
        return None
    event_name, intent = EVENT_FOR_CUE[cue_class]
    if cue_class in {"PAUSE", "RESUME"}:
        focus = "NONE"
    elif cue_class == "ASK_POST_SESSION_OVERVIEW":
        focus = "completed-observation-overview"
    else:
        focus = CATEGORY_FOCUS[cue["selected_category"]]
    event = {
        "schema_version": EVENT_CANDIDATE_SCHEMA_VERSION,
        "turn": cue["turn"],
        "speaker": "PLAYER",
        "event": event_name,
        "player_intent": intent,
        "focus": focus,
        "scope_id": state["scope_id"],
        "source_state_anchor_digest": state["state_digest"],
        "source_structured_cue_digest": cue["cue_digest"],
        "source_ingest_receipt_digest": source["external_sandbox_sidecar_ingest_receipt_digest"],
        "source_external_session_evidence_ref": source["external_session_evidence_ref"],
        "source_summary_digest": sha(source["sanitized_summary"]),
        "observation_scope": EVIDENCE_MODE,
        "cue_authentication_proven": False,
        "input_adapter_verified": False,
        "cue_replay_protection_proven": False,
        "runtime_state_authentication_proven": False,
        "current_game_state_claimed": False,
        "semantic_game_fact_claimed": False,
        "downstream_admission_proven": False,
        "runtime_eligible": False,
    }
    event["event_candidate_digest"] = sha(event)
    req(set(event) == EVENT_CANDIDATE_KEYS, "event candidate exact keys")
    return event


def derive_decision(source, state, cue):
    current = cue["turn"] == state["last_turn"] + 1
    if not current or cue["cue_class"] == "NONE":
        reason = "NO_STRUCTURED_CUE" if cue["cue_class"] == "NONE" else "CUE_NOT_AT_SUPPLIED_STATE_FRONTIER"
        return "WAIT_FOR_CURRENT_PLAYER_CUE", reason, [], None, "CURRENT_HUMAN_CUE_OR_END", "NONE"
    if cue["cue_class"] in {"DECLINE", "REDIRECT"}:
        return (
            "SUPPRESSED_BY_PLAYER_CUE",
            "PLAYER_CUE_SUPPRESSES_THIS_EVALUATION_AGENDA",
            [],
            None,
            "NO_FURTHER_SYSTEM_INITIATIVE",
            "NONE",
        )
    phase = state["session_phase"]
    if cue["cue_class"] == "RESUME" and phase != "PAUSED":
        return "STATE_PHASE_BLOCKED", "RESUME_REQUIRES_PAUSED_STATE", [], None, "HUMAN_STATE_OR_CUE_CORRECTION_REQUIRED", "NONE"
    if cue["cue_class"] == "PAUSE" and phase not in {"ACTIVE", "RESUMED_NEUTRAL"}:
        return "STATE_PHASE_BLOCKED", "PAUSE_REQUIRES_UNPAUSED_STATE", [], None, "HUMAN_STATE_OR_CUE_CORRECTION_REQUIRED", "NONE"
    if cue["cue_class"] not in {"PAUSE", "RESUME"} and phase == "PAUSED":
        return "STATE_PHASE_BLOCKED", "CONTENT_CUE_REQUIRES_UNPAUSED_STATE", [], None, "HUMAN_STATE_OR_CUE_CORRECTION_REQUIRED", "NONE"
    categories = requested_categories(source["sanitized_summary"], cue)
    event = make_event_candidate(source, state, cue, categories)
    if cue["cue_class"] not in {"PAUSE", "RESUME"} and not categories:
        return "NO_SUPPORTED_AGGREGATE", "SELECTED_CATEGORY_HAS_NO_SANITIZED_SIGNAL", [], None, "HUMAN_REDIRECT_OR_END", "NONE"
    return (
        "SYNTHETIC_PLAYER_EVENT_CANDIDATE_CREATED",
        "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
        categories,
        event,
        "AUTHENTICATED_INPUT_AND_STATE_ADMISSION_REQUIRED",
        FUTURE_HUMAN_DECISION,
    )


def _build_output(source, state, cue):
    decision, reason, categories, event, next_boundary, next_human_decision = derive_decision(
        source, state, cue
    )
    focus_candidates = [make_focus_candidate(source, state, cue, category) for category in categories]
    suppression = decision == "SUPPRESSED_BY_PLAYER_CUE"
    if event is None:
        request_scope = "NONE"
        interaction_owner = "NONE"
        focus_source = "NONE"
        selected_category = None
    else:
        request_scope = "CURRENT_EVENT_CANDIDATE_ONLY"
        interaction_owner = "PLAYER_ASSERTED_NOT_AUTHENTICATED"
        if cue["cue_class"] == "ASK_POST_SESSION_OVERVIEW":
            focus_source = "PLAYER_REQUESTED_OVERVIEW"
            selected_category = None
        elif cue["cue_class"] in {"PAUSE", "RESUME"}:
            focus_source = "NONE"
            selected_category = None
        else:
            focus_source = "PLAYER_SELECTED"
            selected_category = cue["selected_category"]
    out = {
        "schema_version": SCHEMA_VERSION,
        "status": STATUS,
        "decision": decision,
        "reason": reason,
        "source_ingest_receipt_digest": source["external_sandbox_sidecar_ingest_receipt_digest"],
        "source_external_session_evidence_ref": source["external_session_evidence_ref"],
        "source_summary_digest": sha(source["sanitized_summary"]),
        "source_receipt_integrity_validated": True,
        "source_authenticity_proven": False,
        "source_signal_class": "CLOSED_SESSION_OBSERVATION_SIGNAL",
        "source_is_current_game_event": False,
        "evidence_mode": EVIDENCE_MODE,
        "source_state_anchor_digest": state["state_digest"],
        "state_scope_id": state["scope_id"],
        "state_phase": state["session_phase"],
        "state_frontier_binding_proven": True,
        "runtime_state_authentication_proven": False,
        "structured_cue_digest": cue["cue_digest"],
        "structured_cue_class": cue["cue_class"],
        "cue_frontier_current": cue["turn"] == state["last_turn"] + 1,
        "cue_provenance_mode": CUE_PROVENANCE_MODE,
        "cue_authentication_proven": False,
        "input_adapter_verified": False,
        "cue_replay_protection_proven": False,
        "request_scope": request_scope,
        "interaction_owner": interaction_owner,
        "focus_source": focus_source,
        "selected_category": selected_category,
        "focus_candidate_categories": categories,
        "observation_focus_candidates": focus_candidates,
        "player_event_candidate_created": event is not None,
        "player_event_candidate": event,
        "suppression_receipt_created": suppression,
        "suppression_scope": "THIS_EVALUATION_ONLY" if suppression else "NONE",
        "durable_suppression_state_created": False,
        "state_transition_applied": False,
        "help_request": "NONE",
        "candidate_envelope_compatibility_only": event is not None,
        "candidate_envelope_admission_proven": False,
        "downstream_policy_evaluation_performed": False,
        "event_runtime_eligible": False,
        "current_game_state_claimed": False,
        "semantic_game_fact_claimed": False,
        "response_text": None,
        "response_admissible": None,
        "message_send_eligible": False,
        "response_authority_created": False,
        "send_authority": False,
        "action_permit_created": False,
        "successor_permit_created": False,
        "future_help_authority": False,
        "future_solution_authority": False,
        "persistent_solver_mode": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "next_boundary": next_boundary,
        "next_human_decision": next_human_decision,
        "non_effects": {field: False for field in NON_EFFECT_FIELDS},
    }
    out["bridge_receipt_digest"] = sha(out)
    req(set(out) == OUTPUT_KEYS, "output exact keys")
    return out


def evaluate(source, state, cue):
    validate_source_ingest_receipt(source)
    validate_state(state, source)
    validate_cue(cue, source, state)
    out = _build_output(source, state, cue)
    validate_output(source, state, cue, out)
    return out


def validate_output(source, state, cue, out):
    validate_source_ingest_receipt(source)
    validate_state(state, source)
    validate_cue(cue, source, state)
    req(isinstance(out, dict) and set(out) == OUTPUT_KEYS, "output exact keys")
    _hex64(out.get("bridge_receipt_digest"), "bridge receipt digest")
    req(
        out["bridge_receipt_digest"]
        == sha({key: value for key, value in out.items() if key != "bridge_receipt_digest"}),
        "bridge receipt digest binding",
    )
    req(out == _build_output(source, state, cue), "output exact deterministic derivation")
    return out
