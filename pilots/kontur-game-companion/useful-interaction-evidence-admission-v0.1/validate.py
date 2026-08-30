#!/usr/bin/env python3
import copy
import hashlib
import json
import pathlib
import sys

sys.dont_write_bytecode = True

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]
ADMISSION_PATH = ROOT / "admission.json"

EXPECTED_ORIGIN = "9a7321bd127e2ed01522d4ce98ee5defe29096be"
EXPECTED_SOURCES = [
    {
        "source_id": "interaction-receipt-cases-v0.2",
        "path": "pilots/kontur-game-companion/interaction-receipt/interaction-receipt-cases.json",
        "git_blob_sha1": "6b39625d302f2ddc76f9a4fda3c4fcf730d984f9",
        "evidence_class": "SYNTHETIC_CANDIDATE_POLICY_EVIDENCE",
    },
    {
        "source_id": "integrated-conversation-trace-v0.1",
        "path": "pilots/kontur-game-companion/integrated-conversation-trace/integrated-conversation-trace.json",
        "git_blob_sha1": "33fd0ae2d87097216649c1d7762feb8aaccc9397",
        "evidence_class": "SYNTHETIC_MULTI_TURN_COMPOSITION_EVIDENCE",
    },
    {
        "source_id": "terminal-state-field-confirmation-001",
        "path": "pilots/kontur-game-companion/external-observation-session/field-evidence/terminal-state-commit-001/receipt.json",
        "git_blob_sha1": "f65b988d8baaecf3faa386cec3981ba63874d71c",
        "evidence_class": "FIELD_OPERATIONAL_EVIDENCE_NO_INTERACTION_SEMANTICS",
    },
]
REQUIRED_CATEGORIES = [
    "PLAYER_REQUEST_OR_HELP_DEPTH_REQUEST",
    "PLAYER_CORRECTION_OR_CHALLENGE_AND_LOCAL_REPAIR_OUTCOME",
    "PLAYER_DECLINE_IGNORE_OR_PAUSE_AND_RESPECT_OUTCOME",
    "ASSISTANCE_OR_CUE_CLASS_ACTUALLY_OFFERED",
    "DIRECT_ANSWER_BOUND_TO_EXPLICIT_ANSWER_REQUEST_WHEN_APPLICABLE",
    "PLAYER_SELECTED_FOCUS_PRESERVATION_WHEN_APPLICABLE",
    "SOURCE_EVENT_COMMITMENT_OR_PROVENANCE",
]
FORBIDDEN_FIELD_SEMANTIC_KEYS = {
    "player_intent", "player_request", "help_request", "help_depth_request",
    "player_correction", "player_challenge", "correction_outcome",
    "player_decline", "player_ignore", "pause_respected", "decline_respected",
    "interaction_receipt", "assistance_class", "cue_class", "focus_preserved",
}


def fail(message):
    raise AssertionError(message)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def git_blob_sha1(path):
    raw = path.read_bytes()
    header = f"blob {len(raw)}\0".encode("ascii")
    return hashlib.sha1(header + raw).hexdigest()


def walk_keys(value):
    keys = set()
    if isinstance(value, dict):
        for key, item in value.items():
            keys.add(key)
            keys.update(walk_keys(item))
    elif isinstance(value, list):
        for item in value:
            keys.update(walk_keys(item))
    return keys


def validate_source_bytes(admission):
    sources = admission.get("sources")
    if not isinstance(sources, list) or len(sources) != len(EXPECTED_SOURCES):
        fail("source set")
    for actual, expected in zip(sources, EXPECTED_SOURCES):
        for key, value in expected.items():
            if actual.get(key) != value:
                fail(f"source {expected['source_id']} {key}")
        if actual.get("field_interaction_semantics_present") is not False:
            fail("current source may not claim field interaction semantics")
        if actual.get("supports_field_usefulness_claim") is not False:
            fail("current source may not support field usefulness claim")
        path = REPO / expected["path"]
        if not path.is_file():
            fail(f"missing source: {expected['path']}")
        if git_blob_sha1(path) != expected["git_blob_sha1"]:
            fail(f"source byte drift: {expected['source_id']}")


def validate_interaction_receipt_source():
    path = REPO / EXPECTED_SOURCES[0]["path"]
    data = load_json(path)
    if data.get("schema_version") != "0.2":
        fail("interaction receipt schema")
    boundary = data.get("boundary", {})
    for key in [
        "behavioral_profile", "psychological_inference", "attention_tracking",
        "engagement_optimization", "retention_optimization", "stable_core_promotion",
        "external_effect_authorized", "response_authority_created", "action_permit_created",
    ]:
        if boundary.get(key) is not False:
            fail(f"interaction boundary {key}")
    cases = data.get("cases", [])
    if not any(c.get("player_correction_received") is True and c.get("correction_outcome") in {"REVISED", "CONTESTED"} for c in cases):
        fail("synthetic correction/repair evidence missing")
    if not any(c.get("dependency_risk_signal") is True for c in cases):
        fail("synthetic dependency-risk boundary example missing")
    if not any(c.get("agency_preserved") is True and c.get("player_can_ignore") is True for c in cases):
        fail("synthetic agency evidence missing")


def validate_integrated_trace_source():
    path = REPO / EXPECTED_SOURCES[1]["path"]
    data = load_json(path)
    if data.get("schema_version") != "kontur-game-companion-integrated-conversation-trace-v0.1":
        fail("trace schema")
    if data.get("status") != "SYNTHETIC_NON_EXECUTING" or data.get("runtime_connectedness") != "NOT_PROVEN":
        fail("trace field/runtime overclaim")
    non_effects = data.get("non_effects", {})
    for key in [
        "engagement_maximization", "retention_optimization", "behavioral_profile",
        "psychological_inference", "attention_tracking", "external_effect",
        "response_authority_created", "action_permit_created", "stable_core_promotion",
    ]:
        if non_effects.get(key) is not False:
            fail(f"trace non-effect {key}")
    events = [turn.get("event") for turn in data.get("turns", [])]
    required_events = {
        "PLAYER_CORRECTION", "CORRECTION_REPAIR_AND_DISCOVERY_PROMPT", "PAUSE", "RESUME",
        "EXPLICIT_HINT_REQUEST", "BOUNDED_HINT", "PLAYER_REJECTS_HINT_HYPOTHESIS",
        "CONTESTED_REPAIR", "EXPLICIT_SOLUTION_REQUEST", "EXPLICIT_SOLUTION_AFTER_BYPASS",
    }
    if not required_events.issubset(set(events)):
        fail("trace categorical agency/help evidence incomplete")


def validate_field_source_is_operational_only():
    path = REPO / EXPECTED_SOURCES[2]["path"]
    data = load_json(path)
    if data.get("schema_version") != "kontur-game-companion-terminal-state-field-confirmation-v0.1":
        fail("field receipt schema")
    if data.get("evidence_class") != "SANITIZED_FIELD_CONFIRMATION":
        fail("field receipt class")
    runtime = data.get("runtime_non_effects", {})
    for key in [
        "game_action_executed", "game_process_accessed", "input_emulated", "kontur_activated",
        "message_sent", "network_io_performed", "recommendation_generated",
    ]:
        if runtime.get(key) is not False:
            fail(f"field runtime non-effect {key}")
    observed_keys = walk_keys(data)
    overlap = sorted(observed_keys & FORBIDDEN_FIELD_SEMANTIC_KEYS)
    if overlap:
        fail("operational field receipt unexpectedly contains interaction semantics: " + ",".join(overlap))


def validate(admission):
    if admission.get("schema_version") != "kontur-useful-interaction-evidence-admission-v0.1":
        fail("schema_version")
    if admission.get("issue") != 757:
        fail("issue")
    if admission.get("origin_main") != EXPECTED_ORIGIN:
        fail("origin_main")
    validate_source_bytes(admission)
    validate_interaction_receipt_source()
    validate_integrated_trace_source()
    validate_field_source_is_operational_only()

    capabilities = admission.get("current_evidence_capabilities", {})
    required_true = [
        "candidate_policy_boundaries", "synthetic_multi_turn_agency_baseline",
        "player_correction_as_revision_opportunity_in_synthetic_trace",
        "pause_resume_respect_in_synthetic_trace", "explicit_help_depth_scope_in_synthetic_trace",
        "privacy_minimized_operational_field_confirmation",
    ]
    required_false = [
        "bounded_field_interaction_semantics", "real_player_satisfaction_established",
        "real_player_effectiveness_established", "field_usefulness_established",
    ]
    if any(capabilities.get(k) is not True for k in required_true):
        fail("capability baseline underclaim")
    if any(capabilities.get(k) is not False for k in required_false):
        fail("capability field overclaim")

    future = admission.get("future_field_admission_requirements", {})
    if future.get("evidence_mode") != "CATEGORICAL_PROVENANCE_BEARING_EVENTS":
        fail("future evidence mode")
    if future.get("required_categories") != REQUIRED_CATEGORIES:
        fail("future evidence categories")
    for key in [
        "raw_transcript_required", "total_game_history_required", "durable_player_profile_required",
        "behavioral_profile_required", "psychological_profile_required", "mood_profile_required",
    ]:
        if future.get(key) is not False:
            fail(f"future minimization boundary {key}")

    policy = admission.get("measurement_policy", {})
    if policy.get("aggregation_mode") != "CATEGORICAL_EVIDENCE_VECTOR":
        fail("aggregation mode")
    for key in [
        "scalar_usefulness_score", "engagement_objective", "retention_objective",
        "dependency_objective", "session_duration_as_reward", "message_count_as_reward",
        "return_frequency_as_reward", "correction_as_negative_reward", "decline_as_negative_reward",
        "pause_as_negative_reward", "ignore_as_negative_reward",
    ]:
        if policy.get(key) is not False:
            fail(f"forbidden measurement shortcut {key}")

    decision = admission.get("decision", {})
    if decision.get("state") != "DEFER_FIELD_USEFULNESS_CLAIM":
        fail("current evidence must defer field usefulness claim")
    if decision.get("usefulness_disproved") is not False:
        fail("insufficient evidence is not disproof")
    for key in ["new_runtime_component_admitted", "new_observation_authorized", "field_usefulness_claim_admitted"]:
        if decision.get(key) is not False:
            fail(f"decision authority overclaim {key}")

    non_effects = admission.get("non_effects", {})
    expected_non_effects = {
        "engagement_score_created", "retention_score_created", "dependency_score_created",
        "player_profile_created", "response_authority_created", "runtime_activation_authorized",
        "action_permit_created", "game_control_authorized", "stable_core_promotion",
        "external_effect_authority_created",
    }
    if set(non_effects) != expected_non_effects or any(non_effects[k] is not False for k in expected_non_effects):
        fail("non-effects")
    return True


def mutation_cases(base):
    mutations = []
    def add(name, fn):
        value = copy.deepcopy(base)
        fn(value)
        mutations.append((name, value))

    add("claim_admitted", lambda d: d["decision"].__setitem__("field_usefulness_claim_admitted", True))
    add("claim_state", lambda d: d["decision"].__setitem__("state", "FIELD_USEFULNESS_ESTABLISHED"))
    add("field_semantics_invented", lambda d: d["sources"][2].__setitem__("field_interaction_semantics_present", True))
    add("field_source_promoted", lambda d: d["sources"][2].__setitem__("supports_field_usefulness_claim", True))
    add("synthetic_promoted", lambda d: d["sources"][1].__setitem__("supports_field_usefulness_claim", True))
    add("blob_substitution", lambda d: d["sources"][0].__setitem__("git_blob_sha1", "0" * 40))
    add("scalar_score", lambda d: d["measurement_policy"].__setitem__("scalar_usefulness_score", True))
    add("engagement", lambda d: d["measurement_policy"].__setitem__("engagement_objective", True))
    add("retention", lambda d: d["measurement_policy"].__setitem__("retention_objective", True))
    add("duration_reward", lambda d: d["measurement_policy"].__setitem__("session_duration_as_reward", True))
    add("correction_penalty", lambda d: d["measurement_policy"].__setitem__("correction_as_negative_reward", True))
    add("pause_penalty", lambda d: d["measurement_policy"].__setitem__("pause_as_negative_reward", True))
    add("raw_transcript_required", lambda d: d["future_field_admission_requirements"].__setitem__("raw_transcript_required", True))
    add("profile_required", lambda d: d["future_field_admission_requirements"].__setitem__("psychological_profile_required", True))
    add("category_removed", lambda d: d["future_field_admission_requirements"].__setitem__("required_categories", d["future_field_admission_requirements"]["required_categories"][:-1]))
    add("stable_core", lambda d: d["non_effects"].__setitem__("stable_core_promotion", True))
    add("action_permit", lambda d: d["non_effects"].__setitem__("action_permit_created", True))
    return mutations


def main():
    admission = load_json(ADMISSION_PATH)
    validate(admission)
    accepted = []
    mutations = mutation_cases(admission)
    for name, mutated in mutations:
        try:
            validate(mutated)
        except AssertionError:
            continue
        accepted.append(name)
    if accepted:
        print("Unsafe admission mutations accepted: " + ", ".join(accepted), file=sys.stderr)
        return 1
    print(f"KONTUR useful-interaction evidence admission valid: DEFER; {len(mutations)} fail-closed mutations rejected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
