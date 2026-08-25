#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MATERIALIZE = ROOT / "network-user-surface-enablement-materialization" / "materialize.py"
CONFIG_PATH = HERE / "pilot-config.json"

spec = importlib.util.spec_from_file_location(
    "kontur_local_trial_pilot_enablement_materialization",
    MATERIALIZE,
)
materialize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(materialize)


class KonturLocalTrialPilotError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise KonturLocalTrialPilotError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


PILOT_SCOPE = "THIS_LOCAL_SYNTHETIC_ENABLEMENT_STATE_ONLY"
PILOT_MODE = "LOCAL_SYNTHETIC_NULL_TRANSPORT"
INPUT_SOURCE = "DETERMINISTIC_SYNTHETIC_FIXTURE_ONLY"
SESSION_SCOPE = "ONE_PROCESS_INVOCATION"
OUTPUT_MODE = "STDOUT_JSON_RECEIPT_ONLY"
CPU_PROFILE = "BOUNDED_SINGLE_SHOT_NO_POLLING"
TRANSPORT_MODE = "NULL_TRANSPORT"
GAME_INTEGRATION_MODE = "NONE"
AUDIO_MODE = "NONE"
NEXT_DECISION_BOUNDARY = "HUMAN_EXTERNAL_SANDBOX_PILOT_DECISION_REQUIRED"

CONFIG_KEYS = {
    "schema_version",
    "pilot_mode",
    "input_source",
    "session_scope",
    "output_mode",
    "cpu_profile",
    "transport_mode",
    "game_integration_mode",
    "audio_mode",
    "network_access",
    "game_process_access",
    "game_file_modification",
    "audio_capture",
    "microphone_capture",
    "background_loop",
    "polling",
    "persistent_output",
    "external_effect_authorized",
}

FALSE_CONFIG_FIELDS = (
    "network_access",
    "game_process_access",
    "game_file_modification",
    "audio_capture",
    "microphone_capture",
    "background_loop",
    "polling",
    "persistent_output",
    "external_effect_authorized",
)

STATE_REFERENCE_FIELDS = (
    "enablement_state_ref",
    "network_enablement_state_ref",
    "user_surface_enablement_state_ref",
    "enablement_state_digest",
)

HASH_PROVENANCE_FIELDS = tuple(dict.fromkeys(
    materialize.PROVENANCE_FIELDS
    + STATE_REFERENCE_FIELDS
    + (
        "source_enablement_grant_receipt_digest",
        "materialization_context_digest",
        "enablement_materialization_receipt_digest",
    )
))

PROVENANCE_FIELDS = tuple(dict.fromkeys(
    HASH_PROVENANCE_FIELDS + materialize.BOUNDARY_FIELDS
))

PRECHECK_FIELDS = (
    "materialized_state_current_confirmed",
    "local_only_confirmed",
    "reversibility_confirmed",
    "null_transport_confirmed",
    "stdout_only_confirmed",
    "no_game_access_confirmed",
    "no_audio_capture_confirmed",
    "no_background_loop_confirmed",
)

FORBIDDEN_REQUESTS = (
    "network_access_requested",
    "network_enablement_requested",
    "network_connection_requested",
    "user_surface_exposure_requested",
    "live_runtime_requested",
    "external_transport_requested",
    "endpoint_resolution_requested",
    "transport_invocation_requested",
    "delivery_attempt_requested",
    "send_permit_requested",
    "send_authority_requested",
    "game_process_access_requested",
    "game_file_modification_requested",
    "audio_capture_requested",
    "microphone_capture_requested",
    "background_activity_requested",
    "polling_requested",
    "persistent_output_requested",
    "credential_material_requested",
    "secret_material_requested",
    "action_permit_requested",
    "successor_permit_requested",
    "scope_expansion_requested",
    "capability_expansion_requested",
    "copyright_process_change_requested",
    "license_or_notice_change_requested",
    "legal_author_identity_change_requested",
    "pseudonym_publication_change_requested",
)

FALSE_EFFECTS = tuple(dict.fromkeys(
    materialize.EXTERNAL_FALSE_EFFECTS
    + (
        "network_io_performed",
        "game_process_accessed",
        "game_files_modified",
        "audio_capture_started",
        "microphone_capture_started",
        "background_activity_started",
        "polling_started",
        "persistent_output_written",
        "external_sandbox_pilot_authorized",
        "external_sandbox_pilot_started",
    )
))


def load_config(path=CONFIG_PATH):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_config(config):
    req(isinstance(config, dict), "pilot config object")
    req(set(config) == CONFIG_KEYS, "pilot config exact keys")
    req(
        config.get("schema_version") == "kontur-game-companion-local-trial-pilot-config-v0.1",
        "pilot config schema",
    )
    expected = {
        "pilot_mode": PILOT_MODE,
        "input_source": INPUT_SOURCE,
        "session_scope": SESSION_SCOPE,
        "output_mode": OUTPUT_MODE,
        "cpu_profile": CPU_PROFILE,
        "transport_mode": TRANSPORT_MODE,
        "game_integration_mode": GAME_INTEGRATION_MODE,
        "audio_mode": AUDIO_MODE,
    }
    for field, value in expected.items():
        req(config.get(field) == value, f"pilot config boundary: {field}")
    for field in FALSE_CONFIG_FIELDS:
        req(config.get(field) is False, f"pilot config non-effect: {field}")


def validate_enablement_state(item):
    req(isinstance(item, dict), "enablement materialization receipt object")
    req(
        item.get("schema_version")
        == (
            "kontur-game-companion-network-user-surface-"
            "enablement-materialization-receipt-v0.1"
        ),
        "enablement materialization schema",
    )
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "enablement materialization status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "ENABLEMENT_NOT_MATERIALIZED",
        "LIFECYCLE_RECHECK_REQUIRED",
        "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED",
    }, "enablement materialization decision")
    digest = item.get("enablement_materialization_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "enablement materialization digest")
    req(
        digest == materialize.sha({
            key: value
            for key, value in item.items()
            if key != "enablement_materialization_receipt_digest"
        }),
        "enablement materialization digest binding",
    )
    req(item.get("enablement_materialization_scope") == materialize.MATERIALIZATION_SCOPE, "state scope")
    req(item.get("materialization_mode") == materialize.MATERIALIZATION_MODE, "state mode")
    req(item.get("enablement_state_is_external_enablement") is False, "external enablement overclaim")
    for field in materialize.EXTERNAL_FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream materialization effect: {field}")
    req(
        item.get("authority_effect")
        == item.get("action_effect")
        == item.get("successor_effect")
        == "NONE",
        "upstream materialization causal effects",
    )

    active = item["decision"] == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
    for field in STATE_REFERENCE_FIELDS:
        value = item.get(field)
        if active:
            req(isinstance(value, str) and len(value) == 64, f"active state ref: {field}")
        else:
            req(value is None, f"inactive state ref: {field}")
    for field in (
        "enablement_state_artifact_created",
        "network_enablement_state_materialized",
        "user_surface_enablement_state_materialized",
        "enablement_state_local_only",
        "enablement_state_reversible",
        "local_trial_pilot_available",
        "external_enablement_boundary_required",
        "send_permit_required_after_external_enablement",
    ):
        req(item.get(field) is active, f"enablement state marker: {field}")
    req(
        item.get("runtime_connectedness")
        == (
            "LOCAL_SYNTHETIC_ENABLEMENT_STATE_ONLY_NOT_EXTERNAL"
            if active
            else "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
        ),
        "enablement state connectedness",
    )
    if active:
        for field in HASH_PROVENANCE_FIELDS:
            value = item.get(field)
            req(isinstance(value, str) and len(value) == 64, f"enablement state provenance: {field}")


def default_pilot_context(item, config=None):
    validate_enablement_state(item)
    cfg = load_config() if config is None else copy.deepcopy(config)
    validate_config(cfg)
    context = {
        "schema_version": "kontur-game-companion-local-trial-pilot-context-v0.1",
        "source_enablement_materialization_receipt_digest": item[
            "enablement_materialization_receipt_digest"
        ],
        "pilot_config_digest": sha(cfg),
        "pilot_run_requested": False,
        "pilot_scope": PILOT_SCOPE,
        "next_decision_boundary": NEXT_DECISION_BOUNDARY,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in PROVENANCE_FIELDS:
        context[field] = item.get(field)
    for field in PRECHECK_FIELDS:
        context[field] = False
    for field in FORBIDDEN_REQUESTS:
        context[field] = False
    return context


def validate_pilot_context(item, config, context):
    validate_enablement_state(item)
    validate_config(config)
    req(
        context.get("schema_version") == "kontur-game-companion-local-trial-pilot-context-v0.1",
        "pilot context schema",
    )
    req(
        context.get("source_enablement_materialization_receipt_digest")
        == item.get("enablement_materialization_receipt_digest"),
        "pilot source receipt",
    )
    req(context.get("pilot_config_digest") == sha(config), "pilot config digest")
    req(type(context.get("pilot_run_requested")) is bool, "pilot run request bool")
    req(context.get("pilot_scope") == PILOT_SCOPE, "pilot scope")
    req(context.get("next_decision_boundary") == NEXT_DECISION_BOUNDARY, "next decision boundary")
    for field in PROVENANCE_FIELDS:
        req(context.get(field) == item.get(field), f"pilot provenance: {field}")
    for field in PRECHECK_FIELDS:
        req(type(context.get(field)) is bool, f"pilot precheck: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(context.get(field) is False, f"forbidden pilot request: {field}")
    req(
        context.get("authority_effect")
        == context.get("action_effect")
        == context.get("successor_effect")
        == "NONE",
        "pilot context causal effects",
    )
    active = item["decision"] == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
    if not active:
        req(context["pilot_run_requested"] is False, "pilot requested without materialized state")
    if not context["pilot_run_requested"]:
        for field in PRECHECK_FIELDS:
            req(context[field] is False, f"precheck before pilot request: {field}")
    if any(context[field] for field in PRECHECK_FIELDS):
        req(context["pilot_run_requested"] is True, "pilot precheck without request")


def pilot_run_ref_for(item, config):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_TRIAL_PILOT_RUN_REF_V0.1",
        "source_enablement_materialization_receipt_digest": item[
            "enablement_materialization_receipt_digest"
        ],
        "enablement_state_digest": item["enablement_state_digest"],
        "pilot_config_digest": sha(config),
        "pilot_scope": PILOT_SCOPE,
        "session_scope": SESSION_SCOPE,
    })


def run_pilot(item, pilot_context=None, config=None):
    cfg = load_config() if config is None else copy.deepcopy(config)
    validate_config(cfg)
    validate_enablement_state(item)
    context = (
        default_pilot_context(item, cfg)
        if pilot_context is None
        else copy.deepcopy(pilot_context)
    )
    validate_pilot_context(item, cfg, context)

    active = item["decision"] == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
    prechecks_complete = all(context[field] for field in PRECHECK_FIELDS)
    if not active:
        decision, reason = "NOT_APPLICABLE", "LOCAL_SYNTHETIC_ENABLEMENT_STATE_REQUIRED"
    elif not context["pilot_run_requested"]:
        decision, reason = "TRIAL_PILOT_NOT_STARTED", "EXPLICIT_LOCAL_TRIAL_PILOT_REQUEST_ABSENT"
    elif not prechecks_complete:
        decision, reason = "PILOT_PRECHECK_REQUIRED", "ONE_OR_MORE_LOCAL_ONLY_PRECHECKS_INCOMPLETE"
    else:
        decision, reason = "LOCAL_SYNTHETIC_TRIAL_PILOT_READY", "LOCAL_SINGLE_SHOT_NULL_TRANSPORT_RECEIPT_READY"

    ready = decision == "LOCAL_SYNTHETIC_TRIAL_PILOT_READY"
    out = {
        "schema_version": "kontur-game-companion-local-trial-pilot-receipt-v0.1",
        "status": "LOCAL_SYNTHETIC_NON_EXECUTING_EXTERNAL_EFFECTS",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_enablement_materialization_receipt_digest": item[
            "enablement_materialization_receipt_digest"
        ],
        "pilot_context_digest": sha(context),
        "pilot_config_digest": sha(cfg),
        "decision": decision,
        "reason": reason,
        "pilot_scope": PILOT_SCOPE,
        "pilot_mode": PILOT_MODE,
        "input_source": INPUT_SOURCE,
        "session_scope": SESSION_SCOPE,
        "output_mode": OUTPUT_MODE,
        "cpu_profile": CPU_PROFILE,
        "transport_mode": TRANSPORT_MODE,
        "game_integration_mode": GAME_INTEGRATION_MODE,
        "audio_mode": AUDIO_MODE,
        "pilot_run_ref": pilot_run_ref_for(item, cfg) if ready else None,
        "trial_pilot_ready": ready,
        "stdout_receipt_ready": ready,
        "human_external_sandbox_pilot_decision_required": ready,
        "human_external_sandbox_pilot_decision_present": False,
        "next_decision_boundary": NEXT_DECISION_BOUNDARY,
        "pilot_effect": "EMIT_LOCAL_SYNTHETIC_TRIAL_PILOT_RECEIPT" if ready else "NONE",
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_TRIAL_ONLY_NOT_EXTERNAL",
    }
    for field in PROVENANCE_FIELDS:
        out[field] = item.get(field)
    for field in PRECHECK_FIELDS:
        out[field] = context[field]
    for field in FALSE_CONFIG_FIELDS:
        out[field] = False
    for field in FALSE_EFFECTS:
        out[field] = False

    validate_pilot_receipt(item, cfg, context, out)
    out["local_trial_pilot_receipt_digest"] = sha(out)
    return out


def validate_pilot_receipt(item, config, context, out):
    validate_pilot_context(item, config, context)
    req(
        out.get("schema_version") == "kontur-game-companion-local-trial-pilot-receipt-v0.1",
        "pilot receipt schema",
    )
    req(
        out.get("status") == "LOCAL_SYNTHETIC_NON_EXECUTING_EXTERNAL_EFFECTS",
        "pilot receipt status",
    )
    req(
        out.get("scope_id") == item.get("scope_id")
        and out.get("source_turn") == item.get("source_turn"),
        "pilot receipt source",
    )
    req(
        out.get("source_enablement_materialization_receipt_digest")
        == item.get("enablement_materialization_receipt_digest"),
        "pilot source materialization receipt",
    )
    req(out.get("pilot_context_digest") == sha(context), "pilot context digest")
    req(out.get("pilot_config_digest") == sha(config), "pilot config receipt digest")
    expected_boundaries = {
        "pilot_scope": PILOT_SCOPE,
        "pilot_mode": PILOT_MODE,
        "input_source": INPUT_SOURCE,
        "session_scope": SESSION_SCOPE,
        "output_mode": OUTPUT_MODE,
        "cpu_profile": CPU_PROFILE,
        "transport_mode": TRANSPORT_MODE,
        "game_integration_mode": GAME_INTEGRATION_MODE,
        "audio_mode": AUDIO_MODE,
        "next_decision_boundary": NEXT_DECISION_BOUNDARY,
    }
    for field, value in expected_boundaries.items():
        req(out.get(field) == value, f"pilot receipt boundary: {field}")
    for field in PROVENANCE_FIELDS:
        req(out.get(field) == item.get(field), f"pilot receipt provenance: {field}")
    for field in PRECHECK_FIELDS:
        req(out.get(field) is context.get(field), f"pilot precheck binding: {field}")

    active = item["decision"] == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
    prechecks_complete = all(context[field] for field in PRECHECK_FIELDS)
    if not active:
        expected = "NOT_APPLICABLE"
    elif not context["pilot_run_requested"]:
        expected = "TRIAL_PILOT_NOT_STARTED"
    elif not prechecks_complete:
        expected = "PILOT_PRECHECK_REQUIRED"
    else:
        expected = "LOCAL_SYNTHETIC_TRIAL_PILOT_READY"
    req(out.get("decision") == expected, "pilot decision derivation")
    ready = expected == "LOCAL_SYNTHETIC_TRIAL_PILOT_READY"
    req(
        out.get("pilot_run_ref") == (pilot_run_ref_for(item, config) if ready else None),
        "pilot run ref binding",
    )
    for field in (
        "trial_pilot_ready",
        "stdout_receipt_ready",
        "human_external_sandbox_pilot_decision_required",
    ):
        req(out.get(field) is ready, f"pilot ready marker: {field}")
    req(out.get("human_external_sandbox_pilot_decision_present") is False, "external decision overclaim")
    for field in FALSE_CONFIG_FIELDS:
        req(out.get(field) is False, f"pilot config effect: {field}")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"pilot external effect: {field}")
    req(
        out.get("pilot_effect")
        == ("EMIT_LOCAL_SYNTHETIC_TRIAL_PILOT_RECEIPT" if ready else "NONE"),
        "pilot effect",
    )
    req(
        out.get("authority_effect")
        == out.get("action_effect")
        == out.get("successor_effect")
        == "NONE",
        "pilot causal effects",
    )
    req(
        out.get("runtime_connectedness") == "LOCAL_SYNTHETIC_TRIAL_ONLY_NOT_EXTERNAL",
        "pilot connectedness",
    )
    receipt_digest = out.get("local_trial_pilot_receipt_digest")
    if receipt_digest is not None:
        req(isinstance(receipt_digest, str) and len(receipt_digest) == 64, "pilot receipt digest")
        req(
            receipt_digest == sha({
                key: value
                for key, value in out.items()
                if key != "local_trial_pilot_receipt_digest"
            }),
            "pilot receipt digest binding",
        )
