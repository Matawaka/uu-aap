#!/usr/bin/env python3
import copy
import hashlib
import json
import pathlib
import sys

sys.dont_write_bytecode = True

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]
FIXTURE = ROOT / "fixture.json"
ORIGIN = "bb199c6272b36d871c62a25517ecb7f32b768106"
ADMISSION_PATH = "pilots/kontur-game-companion/useful-interaction-evidence-admission-v0.1/admission.json"
ADMISSION_BLOB = "bb8576453c1695c9b703aa61e5d56c61e9f68e1e"
CLASSES = [
    "PLAYER_REQUEST_OR_HELP_DEPTH_REQUEST",
    "PLAYER_CORRECTION_OR_CHALLENGE_AND_LOCAL_REPAIR_OUTCOME",
    "PLAYER_DECLINE_IGNORE_OR_PAUSE_AND_RESPECT_OUTCOME",
    "ASSISTANCE_OR_CUE_CLASS_ACTUALLY_OFFERED",
    "DIRECT_ANSWER_BOUND_TO_EXPLICIT_ANSWER_REQUEST_WHEN_APPLICABLE",
    "PLAYER_SELECTED_FOCUS_PRESERVATION_WHEN_APPLICABLE",
    "SOURCE_EVENT_COMMITMENT_OR_PROVENANCE",
]
FORBIDDEN_KEYS = {
    "raw_text", "transcript", "message_text", "player_name", "player_id",
    "mood", "personality", "psychological_profile", "behavioral_profile",
    "interest_score", "engagement_score", "retention_score", "dependency_score",
    "session_duration_reward", "message_count_reward", "return_frequency_reward",
}


def fail(message):
    raise AssertionError(message)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def git_blob_sha1(path):
    raw = path.read_bytes()
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def event_hash(event):
    committed = {k: event[k] for k in ["event_id", "ordinal", "event_class", "categorical_value", "evidence_refs"]}
    return "sha256:" + hashlib.sha256(canonical(committed).encode("utf-8")).hexdigest()


def walk_keys(value):
    out = set()
    if isinstance(value, dict):
        for key, item in value.items():
            out.add(key)
            out.update(walk_keys(item))
    elif isinstance(value, list):
        for item in value:
            out.update(walk_keys(item))
    return out


def validate_source_admission(data):
    source = data.get("source_admission", {})
    if source != {
        "path": ADMISSION_PATH,
        "git_blob_sha1": ADMISSION_BLOB,
        "decision_state": "DEFER_FIELD_USEFULNESS_CLAIM",
    }:
        fail("source_admission")
    path = REPO / ADMISSION_PATH
    if not path.is_file() or git_blob_sha1(path) != ADMISSION_BLOB:
        fail("source admission byte binding")
    admission = load_json(path)
    if admission.get("decision", {}).get("state") != "DEFER_FIELD_USEFULNESS_CLAIM":
        fail("source admission decision drift")
    if admission.get("decision", {}).get("field_usefulness_claim_admitted") is not False:
        fail("source admission field claim overreach")


def validate_categorical_value(event):
    cls = event["event_class"]
    value = event["categorical_value"]
    if not isinstance(value, dict) or not value:
        fail(f"categorical value {cls}")
    if cls == "PLAYER_REQUEST_OR_HELP_DEPTH_REQUEST":
        if set(value) != {"request_class", "requested_help_depth"}:
            fail("request keys")
        if value["request_class"] not in {"CONVERSATION", "HINT_REQUEST", "SOLUTION_REQUEST"}:
            fail("request class")
        if value["requested_help_depth"] not in {"NONE", "COMMENT", "NOTICE", "QUESTION", "THEORY", "NUDGE", "HINT", "PARTIAL_SOLUTION", "SOLUTION"}:
            fail("help depth")
    elif cls == "PLAYER_CORRECTION_OR_CHALLENGE_AND_LOCAL_REPAIR_OUTCOME":
        if set(value) != {"input_class", "repair_outcome", "global_truth_promoted"}:
            fail("repair keys")
        if value["input_class"] not in {"CORRECTION", "CHALLENGE"}:
            fail("repair input")
        if value["repair_outcome"] not in {"REVISED", "CONTESTED", "UNRESOLVED"}:
            fail("repair outcome")
        if value["global_truth_promoted"] is not False:
            fail("correction promoted to global truth")
    elif cls == "PLAYER_DECLINE_IGNORE_OR_PAUSE_AND_RESPECT_OUTCOME":
        if set(value) != {"player_action", "respect_outcome", "old_intent_carried"}:
            fail("respect keys")
        if value["player_action"] not in {"DECLINE", "IGNORE", "PAUSE"}:
            fail("player action")
        if value["respect_outcome"] not in {"RESPECTED", "NOT_RESPECTED", "UNKNOWN"}:
            fail("respect outcome")
        if value["old_intent_carried"] is not False:
            fail("old intent carried")
    elif cls == "ASSISTANCE_OR_CUE_CLASS_ACTUALLY_OFFERED":
        if set(value) != {"offer_class", "solution_disclosed"}:
            fail("offer keys")
        if value["offer_class"] not in {"NONE", "PERIPHERAL", "NOTICE", "QUESTION", "THEORY", "FOCUSED_NUDGE", "HINT", "PARTIAL_SOLUTION", "SOLUTION"}:
            fail("offer class")
        if not isinstance(value["solution_disclosed"], bool):
            fail("solution disclosure flag")
    elif cls == "DIRECT_ANSWER_BOUND_TO_EXPLICIT_ANSWER_REQUEST_WHEN_APPLICABLE":
        if set(value) != {"direct_answer_offered", "explicit_answer_request_bound", "future_solution_authority"}:
            fail("answer binding keys")
        if value["direct_answer_offered"] is True and value["explicit_answer_request_bound"] is not True:
            fail("direct answer without explicit request binding")
        if value["future_solution_authority"] is not False:
            fail("future solution authority")
    elif cls == "PLAYER_SELECTED_FOCUS_PRESERVATION_WHEN_APPLICABLE":
        if set(value) != {"player_selected_focus_present", "focus_preserved", "predicted_interest_override"}:
            fail("focus keys")
        if value["player_selected_focus_present"] is True and value["focus_preserved"] is not True:
            fail("player focus not preserved")
        if value["predicted_interest_override"] is not False:
            fail("predicted interest override")
    elif cls == "SOURCE_EVENT_COMMITMENT_OR_PROVENANCE":
        if set(value) != {"provenance_class", "source_commitment_present"}:
            fail("provenance keys")
        if value["provenance_class"] not in {"SYNTHETIC_TRACE_REFERENCE", "EVENT_COMMITMENT", "WITNESS_RECEIPT", "OTHER_BOUNDED_PROVENANCE"}:
            fail("provenance class")
        if value["source_commitment_present"] is not True:
            fail("source commitment absent")


def validate(data):
    if data.get("schema_version") != "kontur-bounded-interaction-evidence-envelope-v0.1":
        fail("schema version")
    if data.get("issue") != 759 or data.get("origin_main") != ORIGIN:
        fail("issue/origin")
    if data.get("mode") != "SYNTHETIC_CONFORMANCE_ONLY":
        fail("v0.1 admits synthetic conformance only")
    validate_source_admission(data)

    scope = data.get("scope", {})
    expected_scope = {
        "package_is_partial_permitted": True,
        "raw_transcript_present": False,
        "total_history_required": False,
        "player_identifier_present": False,
        "durable_profile_present": False,
    }
    if not isinstance(scope.get("scope_id"), str) or not scope["scope_id"].startswith("game:synthetic:"):
        fail("synthetic scope")
    for key, expected in expected_scope.items():
        if scope.get(key) is not expected:
            fail(f"scope boundary {key}")

    commitment = data.get("commitment_profile", {})
    if commitment != {
        "canonicalization": "json-sort-keys-compact-v0.1",
        "hash_algorithm": "sha256",
        "event_hash_minimalism_reused": True,
        "event_hash_proves_semantic_truth": False,
        "payload_required_for_commitment": False,
    }:
        fail("commitment profile")

    events = data.get("events")
    if not isinstance(events, list) or len(events) != len(CLASSES):
        fail("synthetic full-vocabulary event coverage")
    if [e.get("ordinal") for e in events] != list(range(1, len(CLASSES) + 1)):
        fail("event ordinals")
    if [e.get("event_class") for e in events] != CLASSES:
        fail("event class coverage/order")
    ids = [e.get("event_id") for e in events]
    if any(not isinstance(x, str) or not x for x in ids) or len(set(ids)) != len(ids):
        fail("event ids")
    for event in events:
        if set(event) != {"event_id", "ordinal", "event_class", "categorical_value", "evidence_refs", "event_hash", "raw_text_present", "total_history_required"}:
            fail("event exact keys")
        if event["raw_text_present"] is not False or event["total_history_required"] is not False:
            fail("event minimization boundary")
        if not isinstance(event["evidence_refs"], list) or not event["evidence_refs"] or any(not isinstance(x, str) or not x for x in event["evidence_refs"]):
            fail("event evidence refs")
        if event["event_hash"] != event_hash(event):
            fail(f"event commitment mismatch {event['event_id']}")
        validate_categorical_value(event)

    forbidden = walk_keys(data) & FORBIDDEN_KEYS
    if forbidden:
        fail("forbidden data/score/profile keys: " + ",".join(sorted(forbidden)))

    claims = data.get("claims", {})
    if claims.get("interaction_semantics_interface_valid") is not True:
        fail("interface validity claim")
    for key in [
        "field_evidence_established", "field_usefulness_established",
        "real_player_satisfaction_established", "real_player_effectiveness_established",
        "semantic_truth_proven_by_hash", "identity_proven", "dependency_diagnosed",
    ]:
        if claims.get(key) is not False:
            fail(f"strong claim {key}")

    measurement = data.get("measurement_boundary", {})
    if measurement.get("aggregation_mode") != "CATEGORICAL_EVIDENCE_VECTOR":
        fail("aggregation mode")
    for key in [
        "scalar_usefulness_score", "engagement_objective", "retention_objective", "dependency_objective",
        "session_duration_as_reward", "message_count_as_reward", "return_frequency_as_reward",
        "correction_as_negative_reward", "pause_decline_ignore_as_negative_reward",
    ]:
        if measurement.get(key) is not False:
            fail(f"measurement shortcut {key}")

    non_effects = data.get("non_effects", {})
    expected_non_effects = {
        "new_observation_authorized", "response_authority_created", "runtime_activation_authorized",
        "action_permit_created", "game_control_authorized", "player_profile_created",
        "stable_core_promotion", "external_effect_authority_created",
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

    add("field_relabel", lambda d: d.__setitem__("mode", "FIELD_BOUNDED_INTERACTION"))
    add("raw_transcript", lambda d: d["scope"].__setitem__("raw_transcript_present", True))
    add("total_history", lambda d: d["scope"].__setitem__("total_history_required", True))
    add("player_identifier", lambda d: d["scope"].__setitem__("player_identifier_present", True))
    add("semantic_truth", lambda d: d["commitment_profile"].__setitem__("event_hash_proves_semantic_truth", True))
    add("event_hash_tamper", lambda d: d["events"][0].__setitem__("event_hash", "sha256:" + "0" * 64))
    add("raw_event", lambda d: d["events"][0].__setitem__("raw_text_present", True))
    add("correction_truth", lambda d: d["events"][1]["categorical_value"].__setitem__("global_truth_promoted", True))
    add("pause_intent_carry", lambda d: d["events"][2]["categorical_value"].__setitem__("old_intent_carried", True))
    add("direct_answer_unbound", lambda d: d["events"][4]["categorical_value"].__setitem__("explicit_answer_request_bound", False))
    add("future_solution_authority", lambda d: d["events"][4]["categorical_value"].__setitem__("future_solution_authority", True))
    add("focus_override", lambda d: d["events"][5]["categorical_value"].__setitem__("predicted_interest_override", True))
    add("field_claim", lambda d: d["claims"].__setitem__("field_evidence_established", True))
    add("usefulness_claim", lambda d: d["claims"].__setitem__("field_usefulness_established", True))
    add("scalar_score", lambda d: d["measurement_boundary"].__setitem__("scalar_usefulness_score", True))
    add("engagement", lambda d: d["measurement_boundary"].__setitem__("engagement_objective", True))
    add("retention", lambda d: d["measurement_boundary"].__setitem__("retention_objective", True))
    add("correction_penalty", lambda d: d["measurement_boundary"].__setitem__("correction_as_negative_reward", True))
    add("observation_authority", lambda d: d["non_effects"].__setitem__("new_observation_authorized", True))
    add("action_permit", lambda d: d["non_effects"].__setitem__("action_permit_created", True))
    add("stable_core", lambda d: d["non_effects"].__setitem__("stable_core_promotion", True))
    add("source_blob", lambda d: d["source_admission"].__setitem__("git_blob_sha1", "0" * 40))
    return mutations


def main():
    data = load_json(FIXTURE)
    validate(data)
    accepted = []
    mutations = mutation_cases(data)
    for name, mutated in mutations:
        try:
            validate(mutated)
        except AssertionError:
            continue
        accepted.append(name)
    if accepted:
        print("Unsafe envelope mutations accepted: " + ", ".join(accepted), file=sys.stderr)
        return 1
    print(f"KONTUR bounded interaction evidence envelope v0.1 valid: synthetic-only; {len(mutations)} fail-closed mutations rejected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
