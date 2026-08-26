#!/usr/bin/env python3
import ast
import copy
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FIXTURE = HERE / "player-cued-observation-event-cases.json"
UPSTREAM_FIXTURE = (
    ROOT
    / "pilots/kontur-game-companion/external-sandbox-sidecar-ingest/fixtures/synthetic-sidecar"
)
UPSTREAM_FINAL = "sessions/synthetic-complete/session-final.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bridge = loadmod("kontur_player_cued_observation_bridge", HERE / "bridge.py")
ingest = loadmod(
    "kontur_player_cued_observation_ingest",
    ROOT / "pilots/kontur-game-companion/external-sandbox-sidecar-ingest/ingest.py",
)
candidate_generator = loadmod(
    "kontur_player_cued_observation_candidate_generator",
    ROOT / "pilots/kontur-game-companion/candidate-envelope/generator.py",
)


EXPECTED_PREDECESSORS = {
    "pilots/kontur-game-companion/external-observation-session/runtime-collection-policy.json":
        "3de8b6e4451bd5c876dfa7898612af4fc87848d337a686987118bc54ff661b6d",
    "pilots/kontur-game-companion/external-sandbox-sidecar-ingest/adapter-config.json":
        "9073f9a3d6617f8c0a11691f4a5b789ee68d6641dfa49cab4c7a10d6a50d834b",
    "pilots/kontur-game-companion/external-sandbox-sidecar-ingest/ingest.py":
        "d9562fcee7487fae7fd1cdc7d45ba3baddd99a8cf18dab3073b4b0c769e14732",
    "pilots/kontur-game-companion/bounded-initiative/initiative-cases.json":
        "2afc0b0c692871dc19c4f16fb2bb3916378b08e687d3ce83703d7bb67cba8a84",
    "pilots/kontur-game-companion/focus-diversity/focus-cases.json":
        "18ba7488d26cad6edd85a049300568c67f51ef019ad04b2b267c17a7b44fed63",
    "pilots/kontur-game-companion/interaction-receipt/interaction-receipt-cases.json":
        "fd7c8ed5fcfabc57ffe009ed8787d2b60b5ad5dd3b9f41ab5bf1f4c6b11b45d8",
    "pilots/kontur-game-companion/pause-resume/pause-resume-cases.json":
        "404118ee0ba0e6d725f943ae00d1e4b2555edc4c329d8b23e41828b0884da660",
    "pilots/kontur-game-companion/candidate-envelope/generator.py":
        "af05ffd5d32abb1105c5d4552b72739c48475f058a5c4665259cb74214baf273",
}

EXPECTED_INVARIANTS = [
    "Completed Session != Current Game State",
    "Sanitized Count != Semantic Game Fact",
    "Count Magnitude != Player Interest",
    "Structured Cue != Authenticated Human Cue",
    "Digest Binding != Provenance Authentication",
    "Supplied State Frontier != Runtime State Authentication",
    "Deterministic Replay != Consume-Once Protection",
    "Structured Selected Focus > System-Predicted Interest",
    "Structured NONE Cue -> No Event Candidate",
    "Pause != Resume",
    "Session Resume != Topic Resume",
    "Structured Decline -> No Further Initiative In This Evaluation",
    "Suppression Receipt != Durable Suppression State",
    "Event Candidate != Admitted Player Event",
    "Candidate-Envelope Compatibility != Downstream Admission",
    "Conversation Context != Help Request",
    "Attention to Gameplay != Attention Tracking",
    "Receipt != Authority",
    "Bridge Output != Response",
    "Bridge Output != Send Permit",
    "Bridge Output != Action Permit",
    "Bridge Output != Successor Permit",
]

EXPECTED_CASE_IDS = {
    "no-structured-cue-waits",
    "post-session-overview-fixed-order",
    "player-selects-lifecycle-counts",
    "player-selects-severity-counts",
    "player-selects-term-counts",
    "empty-selected-category-has-no-fallback",
    "redirect-suppresses-this-evaluation",
    "decline-suppresses-this-evaluation",
    "lower-count-player-choice-beats-larger-counts",
    "stale-turn-waits",
    "future-turn-gap-waits",
    "substring-error-is-not-severity-or-mood",
    "question-is-context-not-help",
    "pause-from-active-is-candidate-only",
    "pause-from-paused-is-blocked",
    "resume-from-paused-is-candidate-only",
    "resume-from-active-is-blocked",
    "content-while-paused-is-blocked",
    "same-cue-replay-remains-runtime-ineligible",
    "resumed-neutral-allows-selected-context",
}
EXPECTED_REASON_BY_CASE = {
    "no-structured-cue-waits": "NO_STRUCTURED_CUE",
    "post-session-overview-fixed-order": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "player-selects-lifecycle-counts": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "player-selects-severity-counts": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "player-selects-term-counts": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "empty-selected-category-has-no-fallback": "SELECTED_CATEGORY_HAS_NO_SANITIZED_SIGNAL",
    "redirect-suppresses-this-evaluation": "PLAYER_CUE_SUPPRESSES_THIS_EVALUATION_AGENDA",
    "decline-suppresses-this-evaluation": "PLAYER_CUE_SUPPRESSES_THIS_EVALUATION_AGENDA",
    "lower-count-player-choice-beats-larger-counts": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "stale-turn-waits": "CUE_NOT_AT_SUPPLIED_STATE_FRONTIER",
    "future-turn-gap-waits": "CUE_NOT_AT_SUPPLIED_STATE_FRONTIER",
    "substring-error-is-not-severity-or-mood": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "question-is-context-not-help": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "pause-from-active-is-candidate-only": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "pause-from-paused-is-blocked": "PAUSE_REQUIRES_UNPAUSED_STATE",
    "resume-from-paused-is-candidate-only": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "resume-from-active-is-blocked": "RESUME_REQUIRES_PAUSED_STATE",
    "content-while-paused-is-blocked": "CONTENT_CUE_REQUIRES_UNPAUSED_STATE",
    "same-cue-replay-remains-runtime-ineligible": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
    "resumed-neutral-allows-selected-context": "STRUCTURED_CUE_BOUND_TO_SUPPLIED_STATE_AND_COMPLETED_EVIDENCE",
}
SOURCE_PROFILES = {"BASELINE", "EMPTY_SEVERITY", "ERROR_AMBIGUITY"}


def repository_blob_sha(path):
    relative = Path(path).relative_to(ROOT).as_posix()
    completed = subprocess.run(
        ["git", "cat-file", "blob", f"HEAD:{relative}"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return hashlib.sha256(completed.stdout).hexdigest()


def load_fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def validate_fixture(doc):
    if set(doc) != {
        "schema_version",
        "pilot_id",
        "origin_frontier",
        "scope",
        "predecessor_bindings",
        "invariants",
        "non_effects",
        "cases",
    }:
        raise ValueError("fixture exact keys")
    if doc["schema_version"] != "0.1":
        raise ValueError("fixture schema")
    if doc["pilot_id"] != "kontur-game-companion-player-cued-observation-event-bridge":
        raise ValueError("fixture pilot id")
    if doc["origin_frontier"] != "44e7eb4a68189ed096f4642973d5f57b138ca142":
        raise ValueError("fixture origin frontier")
    if doc["scope"] != "SYNTHETIC_NON_EXECUTING_COMPLETED_SESSION_CONTEXT_BRIDGE":
        raise ValueError("fixture scope")
    if doc["invariants"] != EXPECTED_INVARIANTS:
        raise ValueError("fixture invariants")
    if set(doc["non_effects"]) != set(bridge.NON_EFFECT_FIELDS):
        raise ValueError("fixture non-effect field set")
    if any(doc["non_effects"][field] is not False for field in bridge.NON_EFFECT_FIELDS):
        raise ValueError("fixture non-effect enabled")

    bindings = doc["predecessor_bindings"]
    if not isinstance(bindings, list):
        raise ValueError("predecessor bindings")
    actual_bindings = {}
    for binding in bindings:
        if set(binding) != {"path", "sha256"}:
            raise ValueError("predecessor binding shape")
        if binding["path"] in actual_bindings:
            raise ValueError("duplicate predecessor binding")
        actual_bindings[binding["path"]] = binding["sha256"]
    if actual_bindings != EXPECTED_PREDECESSORS:
        raise ValueError("exact predecessor manifest")
    for path, expected_sha in EXPECTED_PREDECESSORS.items():
        target = ROOT / path
        if not target.is_file():
            raise ValueError(f"missing predecessor: {path}")
        if repository_blob_sha(target) != expected_sha:
            raise ValueError(f"predecessor digest drift: {path}")

    cases = doc["cases"]
    if not isinstance(cases, list) or len(cases) != len(EXPECTED_CASE_IDS):
        raise ValueError("fixture case count")
    if {case.get("case_id") for case in cases} != EXPECTED_CASE_IDS:
        raise ValueError("fixture case ids")
    if set(EXPECTED_REASON_BY_CASE) != EXPECTED_CASE_IDS:
        raise ValueError("reason coverage")
    for case in cases:
        if set(case) != {"case_id", "source_profile", "state", "cue", "expected"}:
            raise ValueError(f"{case.get('case_id')}: exact case keys")
        if case["source_profile"] not in SOURCE_PROFILES:
            raise ValueError(f"{case['case_id']}: source profile")
        if set(case["state"]) != {"last_turn", "session_phase"}:
            raise ValueError(f"{case['case_id']}: state field set")
        if set(case["cue"]) != {
            "cue_class",
            "turn",
            "selected_category",
            "raw_text_stored",
            "audio_stored",
            "speaker_identifier_stored",
        }:
            raise ValueError(f"{case['case_id']}: cue field set")
        if set(case["expected"]) != {
            "decision",
            "candidate_categories",
            "event",
            "intent",
            "focus",
            "requested_assistance_depth",
            "next_boundary",
            "next_human_decision",
        }:
            raise ValueError(f"{case['case_id']}: expected field set")


def write_json(path, value):
    Path(path).write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def make_source_receipt(profile):
    if profile not in SOURCE_PROFILES:
        raise ValueError("unknown source profile")
    with tempfile.TemporaryDirectory(prefix="kontur-player-cued-context-") as temp_name:
        sidecar_root = Path(temp_name) / "KONTUR_PILOT_INFO"
        shutil.copytree(UPSTREAM_FIXTURE, sidecar_root)
        policy_path = sidecar_root / "runtime-collection-policy.json"
        canonical_policy_path = (
            ROOT
            / "pilots/kontur-game-companion/external-observation-session/runtime-collection-policy.json"
        )
        policy_path.write_bytes(
            canonical_policy_path.read_bytes().replace(b"\r\n", b"\n")
        )
        policy_sha = hashlib.sha256(policy_path.read_bytes()).hexdigest()
        if policy_sha != bridge.EXPECTED_POLICY_SHA256:
            raise AssertionError("canonical observation policy digest")

        start_path = sidecar_root / "sessions/synthetic-complete/session-start.json"
        start = json.loads(start_path.read_text(encoding="utf-8"))
        start["policy_sha256"] = policy_sha
        write_json(start_path, start)

        final_path = sidecar_root / UPSTREAM_FINAL
        final = json.loads(final_path.read_text(encoding="utf-8"))
        final["policy_sha256"] = policy_sha
        if profile == "EMPTY_SEVERITY":
            final["aggregate"]["severity_counts"] = {}
        elif profile == "ERROR_AMBIGUITY":
            lines = final["aggregate"]["lines_processed"]
            final["aggregate"]["severity_counts"] = {"error": 0, "warning": 0}
            final["aggregate"]["term_counts"]["error"] = min(24, lines)
            final["aggregate"]["term_counts"]["warning"] = min(12, lines)
        write_json(final_path, final)

        pilot_receipt = ingest.local_run.execute("synthetic-ready")
        context = ingest.default_ingest_context(pilot_receipt)
        context["external_sandbox_ingest_requested"] = True
        context["human_external_sandbox_decision"] = ingest.HUMAN_DECISION
        context["session_id"] = "synthetic-complete"
        context["expected_policy_sha256"] = policy_sha
        context["sidecar_root_reference_digest"] = ingest.sidecar_root_reference_digest(
            sidecar_root
        )
        for field in ingest.PRECHECK_FIELDS:
            context[field] = True
        receipt = ingest.ingest_completed_session(pilot_receipt, context, sidecar_root)
        bridge.validate_source_ingest_receipt(receipt)
        return receipt


def make_state(case, source):
    fields = {
        "schema_version": bridge.STATE_SCHEMA_VERSION,
        "scope_id": bridge.expected_scope_id(source),
        "last_turn": case["state"]["last_turn"],
        "session_phase": case["state"]["session_phase"],
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
    }
    return bridge.seal_state(fields, source)


def make_cue(case, source, state):
    fields = {
        "schema_version": bridge.CUE_SCHEMA_VERSION,
        **case["cue"],
        "scope": "THIS_INTERACTION_ONLY",
        "target_scope_id": state["scope_id"],
        "source_state_anchor_digest": state["state_digest"],
        "source_external_session_evidence_ref": source[
            "external_session_evidence_ref"
        ],
        "provenance_mode": bridge.CUE_PROVENANCE_MODE,
        "human_identity_authenticated": False,
        "input_adapter_verified": False,
        "replay_protection_present": False,
    }
    return bridge.seal_cue(fields, source, state)


def envelope_state(state):
    return {
        "scope_id": state["scope_id"],
        "last_turn": state["last_turn"],
        "session_phase": state["session_phase"],
        "stored_help_authority": state["stored_help_authority"],
        "stored_solution_authority": state["stored_solution_authority"],
        "stored_response_authority": state["stored_response_authority"],
        "solver_mode": state["solver_mode"],
        "player_profile_created": state["player_profile_created"],
    }


def validate_case(case, source):
    state = make_state(case, source)
    cue = make_cue(case, source, state)
    first = bridge.evaluate(source, state, cue)
    second = bridge.evaluate(source, state, cue)
    if bridge.canon(first) != bridge.canon(second):
        raise AssertionError(f"{case['case_id']}: nondeterministic bridge")
    bridge.validate_output(source, state, cue, first)

    expected = case["expected"]
    for actual_field, expected_field in (
        ("decision", "decision"),
        ("focus_candidate_categories", "candidate_categories"),
        ("next_boundary", "next_boundary"),
        ("next_human_decision", "next_human_decision"),
    ):
        if first[actual_field] != expected[expected_field]:
            raise AssertionError(f"{case['case_id']}: {actual_field}")
    if first["reason"] != EXPECTED_REASON_BY_CASE[case["case_id"]]:
        raise AssertionError(f"{case['case_id']}: exact reason")
    if source["session_id"] in bridge.canon(first):
        raise AssertionError(f"{case['case_id']}: source session id disclosed")

    if any(first["non_effects"].values()):
        raise AssertionError(f"{case['case_id']}: non-effect enabled")
    if first["source_receipt_integrity_validated"] is not True:
        raise AssertionError(f"{case['case_id']}: source integrity marker")
    expected_summary_digest = bridge.sha(source["sanitized_summary"])
    if (
        first["source_ingest_receipt_digest"]
        != source["external_sandbox_sidecar_ingest_receipt_digest"]
        or first["source_external_session_evidence_ref"]
        != source["external_session_evidence_ref"]
        or first["source_summary_digest"] != expected_summary_digest
        or first["source_state_anchor_digest"] != state["state_digest"]
        or first["state_scope_id"] != state["scope_id"]
        or first["state_phase"] != state["session_phase"]
        or first["structured_cue_digest"] != cue["cue_digest"]
        or first["structured_cue_class"] != cue["cue_class"]
        or first["cue_frontier_current"]
        is not (cue["turn"] == state["last_turn"] + 1)
    ):
        raise AssertionError(f"{case['case_id']}: output provenance binding")
    event_expected = expected["event"] is not None
    suppression_expected = expected["decision"] == "SUPPRESSED_BY_PLAYER_CUE"
    if (
        first["schema_version"] != bridge.SCHEMA_VERSION
        or first["status"] != bridge.STATUS
        or first["source_signal_class"] != "CLOSED_SESSION_OBSERVATION_SIGNAL"
        or first["evidence_mode"] != bridge.EVIDENCE_MODE
        or first["state_frontier_binding_proven"] is not True
        or first["cue_provenance_mode"] != bridge.CUE_PROVENANCE_MODE
        or first["player_event_candidate_created"] is not event_expected
        or first["candidate_envelope_compatibility_only"] is not event_expected
        or first["suppression_receipt_created"] is not suppression_expected
        or first["suppression_scope"]
        != ("THIS_EVALUATION_ONLY" if suppression_expected else "NONE")
    ):
        raise AssertionError(f"{case['case_id']}: output classification/marker")
    for field in (
        "source_authenticity_proven",
        "source_is_current_game_event",
        "runtime_state_authentication_proven",
        "cue_authentication_proven",
        "input_adapter_verified",
        "cue_replay_protection_proven",
        "durable_suppression_state_created",
        "state_transition_applied",
        "candidate_envelope_admission_proven",
        "downstream_policy_evaluation_performed",
        "event_runtime_eligible",
        "current_game_state_claimed",
        "semantic_game_fact_claimed",
        "message_send_eligible",
        "response_authority_created",
        "send_authority",
        "action_permit_created",
        "successor_permit_created",
        "future_help_authority",
        "future_solution_authority",
        "persistent_solver_mode",
    ):
        if first[field] is not False:
            raise AssertionError(f"{case['case_id']}: unsafe output marker {field}")
    if first["response_text"] is not None or first["response_admissible"] is not None:
        raise AssertionError(f"{case['case_id']}: response surface created")
    if first["help_request"] != "NONE":
        raise AssertionError(f"{case['case_id']}: help request created")
    if not (
        first["authority_effect"]
        == first["action_effect"]
        == first["successor_effect"]
        == "NONE"
    ):
        raise AssertionError(f"{case['case_id']}: causal effect")
    if expected["event"] is None:
        expected_interaction = ("NONE", "NONE", "NONE", None)
    elif cue["cue_class"] == "ASK_POST_SESSION_OVERVIEW":
        expected_interaction = (
            "CURRENT_EVENT_CANDIDATE_ONLY",
            "PLAYER_ASSERTED_NOT_AUTHENTICATED",
            "PLAYER_REQUESTED_OVERVIEW",
            None,
        )
    elif cue["cue_class"] in {"PAUSE", "RESUME"}:
        expected_interaction = (
            "CURRENT_EVENT_CANDIDATE_ONLY",
            "PLAYER_ASSERTED_NOT_AUTHENTICATED",
            "NONE",
            None,
        )
    else:
        expected_interaction = (
            "CURRENT_EVENT_CANDIDATE_ONLY",
            "PLAYER_ASSERTED_NOT_AUTHENTICATED",
            "PLAYER_SELECTED",
            cue["selected_category"],
        )
    if (
        first["request_scope"],
        first["interaction_owner"],
        first["focus_source"],
        first["selected_category"],
    ) != expected_interaction:
        raise AssertionError(f"{case['case_id']}: interaction ownership/scope")
    if [
        item["category"] for item in first["observation_focus_candidates"]
    ] != first["focus_candidate_categories"]:
        raise AssertionError(f"{case['case_id']}: focus candidate/category alignment")
    for focus_candidate in first["observation_focus_candidates"]:
        if (
            focus_candidate["category"] not in first["focus_candidate_categories"]
            or focus_candidate["source_ingest_receipt_digest"]
            != source["external_sandbox_sidecar_ingest_receipt_digest"]
            or focus_candidate["source_external_session_evidence_ref"]
            != source["external_session_evidence_ref"]
            or focus_candidate["source_summary_digest"] != expected_summary_digest
            or focus_candidate["source_structured_cue_digest"] != cue["cue_digest"]
            or focus_candidate["source_state_anchor_digest"] != state["state_digest"]
            or focus_candidate["target_scope_id"] != state["scope_id"]
            or focus_candidate["source_turn"] != cue["turn"]
        ):
            raise AssertionError(f"{case['case_id']}: focus provenance binding")
        if focus_candidate["candidate_digest"] != bridge.sha(
            {
                key: value
                for key, value in focus_candidate.items()
                if key != "candidate_digest"
            }
        ):
            raise AssertionError(f"{case['case_id']}: focus digest")
        candidate_binding = {
            "category": focus_candidate["category"],
            "source_ingest_receipt_digest": focus_candidate[
                "source_ingest_receipt_digest"
            ],
            "source_external_session_evidence_ref": focus_candidate[
                "source_external_session_evidence_ref"
            ],
            "source_summary_digest": focus_candidate["source_summary_digest"],
            "source_structured_cue_digest": focus_candidate[
                "source_structured_cue_digest"
            ],
            "source_state_anchor_digest": focus_candidate[
                "source_state_anchor_digest"
            ],
            "target_scope_id": focus_candidate["target_scope_id"],
            "source_turn": focus_candidate["source_turn"],
        }
        expected_candidate_id = (
            "completed-observation-"
            + focus_candidate["category"].lower().replace("_", "-")
            + "-"
            + bridge.sha(candidate_binding)[:16]
        )
        if (
            focus_candidate["candidate_id"] != expected_candidate_id
            or focus_candidate["count_semantics"]
            != bridge.CATEGORY_SEMANTICS[focus_candidate["category"]]
        ):
            raise AssertionError(f"{case['case_id']}: focus identity/semantics")
        expected_overview = cue["cue_class"] == "ASK_POST_SESSION_OVERVIEW"
        if (
            focus_candidate["origin"]
            != "SYNTHETIC_PLAYER_CUED_COMPLETED_OBSERVATION_CONTEXT"
            or focus_candidate["claim_scope"]
            != "SANITIZED_AGGREGATE_CATEGORY_ONLY"
            or focus_candidate["interpretation"] != "NONE"
            or focus_candidate["selection_objective"]
            != "PLAYER_ASSERTED_REVIEW_CONTEXT"
            or focus_candidate["player_selected_category"]
            is not (not expected_overview)
            or focus_candidate["current_focus_source"]
            != (
                "PLAYER_REQUESTED_OVERVIEW"
                if expected_overview
                else "PLAYER_SELECTED"
            )
        ):
            raise AssertionError(f"{case['case_id']}: focus ownership/semantics")
        if not focus_candidate["optional"] or not focus_candidate["unranked"]:
            raise AssertionError(f"{case['case_id']}: mandatory/ranked focus")
        if focus_candidate["count_ranking_used"] or focus_candidate["values_disclosed"]:
            raise AssertionError(f"{case['case_id']}: count promotion/disclosure")
        for field in (
            "durable_preference_created",
            "player_interest_inferred",
            "player_attention_inferred",
            "mood_inferred",
            "psychological_profile_created",
            "semantic_game_fact_claimed",
        ):
            if focus_candidate[field] is not False:
                raise AssertionError(
                    f"{case['case_id']}: unsafe focus marker {field}"
                )
        if focus_candidate["spoiler_depth"] != "NONE" or focus_candidate["help_depth"] != "NONE":
            raise AssertionError(f"{case['case_id']}: focus help/spoiler escalation")

    event = first["player_event_candidate"]
    if event is None:
        if any(
            expected[field] is not None
            for field in ("event", "intent", "focus", "requested_assistance_depth")
        ):
            raise AssertionError(f"{case['case_id']}: expected event absent")
        return state, cue, first, None

    if event["event"] != expected["event"]:
        raise AssertionError(f"{case['case_id']}: event")
    if event["player_intent"] != expected["intent"]:
        raise AssertionError(f"{case['case_id']}: intent")
    if event["focus"] != expected["focus"]:
        raise AssertionError(f"{case['case_id']}: focus")
    if (
        event["schema_version"] != bridge.EVENT_CANDIDATE_SCHEMA_VERSION
        or event["speaker"] != "PLAYER"
        or event["observation_scope"] != bridge.EVIDENCE_MODE
    ):
        raise AssertionError(f"{case['case_id']}: event classification")
    if (
        event["scope_id"] != state["scope_id"]
        or event["turn"] != cue["turn"]
        or event["source_state_anchor_digest"] != state["state_digest"]
        or event["source_structured_cue_digest"] != cue["cue_digest"]
        or event["source_ingest_receipt_digest"]
        != source["external_sandbox_sidecar_ingest_receipt_digest"]
        or event["source_external_session_evidence_ref"]
        != source["external_session_evidence_ref"]
        or event["source_summary_digest"] != expected_summary_digest
    ):
        raise AssertionError(f"{case['case_id']}: event provenance binding")
    if event["event_candidate_digest"] != bridge.sha(
        {
            key: value
            for key, value in event.items()
            if key != "event_candidate_digest"
        }
    ):
        raise AssertionError(f"{case['case_id']}: event candidate digest")
    projected_state = envelope_state(state)
    envelope = candidate_generator.generate(projected_state, event)
    candidate_generator.validate_envelope(projected_state, event, envelope)
    if envelope["source_event_digest"] != candidate_generator.sha(event):
        raise AssertionError(f"{case['case_id']}: event compatibility digest")
    if envelope["requested_assistance_depth"] != expected["requested_assistance_depth"]:
        raise AssertionError(f"{case['case_id']}: assistance depth")
    if envelope["response_text"] is not None or envelope["response_admissible"] is not None:
        raise AssertionError(f"{case['case_id']}: response created")
    if envelope["runtime_connectedness"] != "NOT_PROVEN":
        raise AssertionError(f"{case['case_id']}: runtime connectedness")
    if not (
        envelope["authority_effect"]
        == envelope["action_effect"]
        == envelope["successor_effect"]
        == "NONE"
    ):
        raise AssertionError(f"{case['case_id']}: envelope authority")
    if any(
        (
            event["cue_authentication_proven"],
            event["input_adapter_verified"],
            event["cue_replay_protection_proven"],
            event["runtime_state_authentication_proven"],
            event["current_game_state_claimed"],
            event["semantic_game_fact_claimed"],
            event["downstream_admission_proven"],
            event["runtime_eligible"],
        )
    ):
        raise AssertionError(f"{case['case_id']}: event candidate authority promotion")
    return state, cue, first, envelope


def expect_reject(callable_value):
    try:
        callable_value()
    except (
        bridge.PlayerCuedObservationBridgeError,
        AssertionError,
        KeyError,
        TypeError,
        ValueError,
    ):
        return
    raise AssertionError("unsafe mutation unexpectedly passed")


def resign_source(source):
    source["external_sandbox_sidecar_ingest_receipt_digest"] = bridge.sha(
        {
            key: value
            for key, value in source.items()
            if key != "external_sandbox_sidecar_ingest_receipt_digest"
        }
    )


def resign_state(state):
    state["state_digest"] = bridge.sha(
        {key: value for key, value in state.items() if key != "state_digest"}
    )


def resign_cue(cue):
    cue["cue_digest"] = bridge.sha(
        {key: value for key, value in cue.items() if key != "cue_digest"}
    )


def resign_output(out):
    for candidate in out.get("observation_focus_candidates", []):
        candidate["candidate_digest"] = bridge.sha(
            {
                key: value
                for key, value in candidate.items()
                if key != "candidate_digest"
            }
        )
    event = out.get("player_event_candidate")
    if isinstance(event, dict):
        event["event_candidate_digest"] = bridge.sha(
            {
                key: value
                for key, value in event.items()
                if key != "event_candidate_digest"
            }
        )
    out["bridge_receipt_digest"] = bridge.sha(
        {key: value for key, value in out.items() if key != "bridge_receipt_digest"}
    )


def source_mutation_rejected(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    resign_source(candidate)
    expect_reject(lambda: bridge.validate_source_ingest_receipt(candidate))


def state_mutation_rejected(base, source, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    resign_state(candidate)
    expect_reject(lambda: bridge.validate_state(candidate, source))


def cue_mutation_rejected(base, source, state, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    resign_cue(candidate)
    expect_reject(lambda: bridge.validate_cue(candidate, source, state))


def output_mutation_rejected(source, state, cue, base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    resign_output(candidate)
    expect_reject(lambda: bridge.validate_output(source, state, cue, candidate))


def mutate_unsafe_session_id(source):
    source["session_id"] = "../forged"
    source["files_read"] = [
        "runtime-collection-policy.json",
        "sessions/../forged/session-start.json",
        "sessions/../forged/session-final.json",
    ]
    source["external_session_evidence_ref"] = bridge.sha(
        {
            "kind": "KONTUR_EXTERNAL_SANDBOX_COMPLETED_SESSION_EVIDENCE_V0.1",
            "policy_sha256": source["policy_sha256"],
            "session_start_sha256": source["session_start_sha256"],
            "session_final_sha256": source["session_final_sha256"],
            "session_id": source["session_id"],
        }
    )


def validate_pure_bridge_surface():
    source = (HERE / "bridge.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            imported.add(node.module)
    if imported != {"hashlib", "json", "re"}:
        raise AssertionError(f"bridge import surface: {sorted(imported)}")
    forbidden_names = {
        "open",
        "exec",
        "eval",
        "compile",
        "__import__",
        "Path",
        "Popen",
        "run",
        "system",
    }
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in forbidden_names:
                raise AssertionError(f"forbidden bridge call: {node.func.id}")


def main():
    doc = load_fixture()
    validate_fixture(doc)
    validate_pure_bridge_surface()

    manifest_mutation = copy.deepcopy(doc)
    manifest_mutation["predecessor_bindings"][0] = {
        "path": "README.md",
        "sha256": repository_blob_sha(ROOT / "README.md"),
    }
    expect_reject(lambda: validate_fixture(manifest_mutation))

    sources = {profile: make_source_receipt(profile) for profile in SOURCE_PROFILES}
    results = {}
    envelope_count = 0
    for case in doc["cases"]:
        state, cue, receipt, envelope = validate_case(
            case, sources[case["source_profile"]]
        )
        results[case["case_id"]] = (state, cue, receipt, envelope)
        envelope_count += int(envelope is not None)

    overview = results["post-session-overview-fixed-order"][2]
    if overview["focus_candidate_categories"] != list(bridge.CATEGORIES):
        raise AssertionError("overview fixed taxonomy order")
    if any(
        candidate["count_ranking_used"]
        for candidate in overview["observation_focus_candidates"]
    ):
        raise AssertionError("overview count ranking")

    lower_source = sources["BASELINE"]["sanitized_summary"]
    if not (
        sum(lower_source["lifecycle_counts"].values())
        < sum(lower_source["term_counts"].values())
    ):
        raise AssertionError("lower-count fixture premise")
    lower = results["lower-count-player-choice-beats-larger-counts"][2]
    if lower["focus_candidate_categories"] != ["LIFECYCLE_COUNTS"]:
        raise AssertionError("player choice did not override larger counts")

    ambiguous_source = sources["ERROR_AMBIGUITY"]["sanitized_summary"]
    if not (0 < ambiguous_source["term_counts"]["error"] <= ambiguous_source["lines_processed"]):
        raise AssertionError("term error fixture line bound")
    if ambiguous_source["severity_counts"]["error"] != 0:
        raise AssertionError("severity error fixture")
    ambiguous = results["substring-error-is-not-severity-or-mood"][2]
    candidate = ambiguous["observation_focus_candidates"][0]
    if candidate["count_semantics"] != "CASE_INSENSITIVE_SUBSTRING_LINE_COUNT_ONLY":
        raise AssertionError("term semantics")
    if candidate["mood_inferred"] or candidate["semantic_game_fact_claimed"]:
        raise AssertionError("semantic promotion")

    replay_first = results["same-cue-replay-remains-runtime-ineligible"][2]
    replay_state, replay_cue = results[
        "same-cue-replay-remains-runtime-ineligible"
    ][:2]
    replay_second = bridge.evaluate(sources["BASELINE"], replay_state, replay_cue)
    if replay_first != replay_second:
        raise AssertionError("deterministic replay premise")
    if (
        replay_second["cue_replay_protection_proven"]
        or replay_second["event_runtime_eligible"]
        or replay_second["candidate_envelope_admission_proven"]
    ):
        raise AssertionError("replay promoted to runtime")

    baseline = sources["BASELINE"]
    source_mutations = [
        lambda value: value["sanitized_summary"].__setitem__("raw_lines_stored", True),
        lambda value: value["sanitized_summary"].__setitem__("identifier_values_stored", True),
        lambda value: value.__setitem__("completed_session_ingested", False),
        lambda value: value.__setitem__("decision", "EXTERNAL_SANDBOX_INGEST_NOT_STARTED"),
        lambda value: value.__setitem__("reason", "FORGED_SUCCESS"),
        lambda value: value.__setitem__("session_scope", "BACKGROUND_SESSION"),
        lambda value: value.__setitem__("cpu_profile", "POLLING"),
        lambda value: value.__setitem__("sidecar_directory_name", "PRIVATE_PATH"),
        lambda value: value.__setitem__("policy_id", "forged-policy"),
        lambda value: value.__setitem__("policy_sha256", "0" * 64),
        lambda value: value.__setitem__("runtime_connectedness", "LIVE_RUNTIME"),
        lambda value: value.__setitem__("next_decision_boundary", "AUTO_CONTINUE"),
        mutate_unsafe_session_id,
        lambda value: value.__setitem__("source_local_trial_pilot_receipt_digest", "x"),
        lambda value: value.__setitem__("source_pilot_run_ref", "x"),
        lambda value: value.__setitem__("connection_request_digest", "x"),
        lambda value: value.__setitem__("authority_effect", "CREATE_AUTHORITY"),
        lambda value: value.__setitem__("message_sent", True),
        lambda value: value.__setitem__("external_session_evidence_ref", "0" * 64),
        lambda value: value["sanitized_summary"]["term_counts"].__setitem__("player", -1),
        lambda value: value["sanitized_summary"]["term_counts"].__setitem__(
            "player", value["sanitized_summary"]["lines_processed"] + 1
        ),
        lambda value: value["sanitized_summary"].__setitem__(
            "sensitive_identifier_line_count",
            value["sanitized_summary"]["lines_processed"] + 1,
        ),
        lambda value: value["sanitized_summary"].__setitem__("unexpected", 1),
        lambda value: value.__setitem__("raw_log_read", True),
    ]
    for mutation in source_mutations:
        source_mutation_rejected(baseline, mutation)

    overview_state, overview_cue, overview_out, _ = results[
        "post-session-overview-fixed-order"
    ]
    state_mutations = [
        lambda value: value.__setitem__("scope_id", "game:other:scope"),
        lambda value: value.__setitem__("scope_id", r"C:\Users\private\utterance"),
        lambda value: value.__setitem__("source_ingest_receipt_digest", "0" * 64),
        lambda value: value.__setitem__("source_external_session_evidence_ref", "0" * 64),
        lambda value: value.__setitem__("provenance_mode", "RUNTIME_AUTHENTICATED"),
        lambda value: value.__setitem__("runtime_state_authenticated", True),
        lambda value: value.__setitem__("stored_help_authority", True),
        lambda value: value.__setitem__("stored_solution_authority", True),
        lambda value: value.__setitem__("stored_response_authority", True),
        lambda value: value.__setitem__("solver_mode", True),
        lambda value: value.__setitem__("player_profile_created", True),
        lambda value: value.__setitem__("last_turn", -1),
        lambda value: value.__setitem__("session_phase", "AUTO_RESUME"),
    ]
    for mutation in state_mutations:
        state_mutation_rejected(overview_state, baseline, mutation)

    selected_state, selected_cue = results["player-selects-term-counts"][:2]
    cue_mutations = [
        lambda value: value.__setitem__("target_scope_id", "game:other:scope"),
        lambda value: value.__setitem__("target_scope_id", r"C:\Users\private\utterance"),
        lambda value: value.__setitem__("target_scope_id", "12345678901234567"),
        lambda value: value.__setitem__("source_state_anchor_digest", "0" * 64),
        lambda value: value.__setitem__("source_external_session_evidence_ref", "0" * 64),
        lambda value: value.__setitem__("provenance_mode", "AUTHENTICATED_HUMAN"),
        lambda value: value.__setitem__("human_identity_authenticated", True),
        lambda value: value.__setitem__("input_adapter_verified", True),
        lambda value: value.__setitem__("replay_protection_present", True),
        lambda value: value.__setitem__("raw_text_stored", True),
        lambda value: value.__setitem__("audio_stored", True),
        lambda value: value.__setitem__("speaker_identifier_stored", True),
        lambda value: value.__setitem__("selected_category", "LIFECYCLE_COUNTS"),
        lambda value: value.__setitem__("scope", "FUTURE_INTERACTIONS"),
        lambda value: value.__setitem__("cue_class", "SOLUTION_REQUEST"),
    ]
    for mutation in cue_mutations:
        cue_mutation_rejected(selected_cue, baseline, selected_state, mutation)

    overview_mutations = [
        lambda value: value.__setitem__("source_authenticity_proven", True),
        lambda value: value.__setitem__("reason", "LEAKED_SANITIZED_SUMMARY"),
        lambda value: value.__setitem__("request_scope", "FUTURE_INTERACTIONS"),
        lambda value: value.__setitem__("interaction_owner", "PLAYER_LED"),
        lambda value: value.__setitem__("focus_source", "SYSTEM_PREDICTED"),
        lambda value: value.__setitem__("source_is_current_game_event", True),
        lambda value: value.__setitem__("runtime_state_authentication_proven", True),
        lambda value: value.__setitem__("cue_authentication_proven", True),
        lambda value: value.__setitem__("input_adapter_verified", True),
        lambda value: value.__setitem__("cue_replay_protection_proven", True),
        lambda value: value.__setitem__("event_runtime_eligible", True),
        lambda value: value.__setitem__("candidate_envelope_admission_proven", True),
        lambda value: value.__setitem__("downstream_policy_evaluation_performed", True),
        lambda value: value.__setitem__("state_transition_applied", True),
        lambda value: value.__setitem__("durable_suppression_state_created", True),
        lambda value: value.__setitem__("current_game_state_claimed", True),
        lambda value: value.__setitem__("semantic_game_fact_claimed", True),
        lambda value: value.__setitem__("response_text", "invented response"),
        lambda value: value.__setitem__("response_admissible", True),
        lambda value: value.__setitem__("message_send_eligible", True),
        lambda value: value.__setitem__("response_authority_created", True),
        lambda value: value.__setitem__("send_authority", True),
        lambda value: value.__setitem__("action_permit_created", True),
        lambda value: value.__setitem__("successor_permit_created", True),
        lambda value: value.__setitem__("future_help_authority", True),
        lambda value: value.__setitem__("future_solution_authority", True),
        lambda value: value.__setitem__("persistent_solver_mode", True),
        lambda value: value.__setitem__("help_request", "HINT_REQUEST"),
        lambda value: value.__setitem__("authority_effect", "CREATE_AUTHORITY"),
        lambda value: value.__setitem__("action_effect", "GAME_ACTION"),
        lambda value: value.__setitem__("successor_effect", "CREATE_SUCCESSOR"),
        lambda value: value["non_effects"].__setitem__("network_io", True),
        lambda value: value["non_effects"].__setitem__("microphone_capture", True),
        lambda value: value["non_effects"].__setitem__("attention_tracking", True),
        lambda value: value["non_effects"].__setitem__("engagement_optimization", True),
        lambda value: value["non_effects"].__setitem__("behavioral_profile", True),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "source_ingest_receipt_digest", "0" * 64
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "source_structured_cue_digest", "0" * 64
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "source_state_anchor_digest", "0" * 64
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "target_scope_id", "game:other:scope"
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "origin", "SYSTEM_PREDICTED_INTEREST"
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "claim_scope", "CURRENT_GAME_STATE"
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "interpretation", "PLAYER_INTEREST"
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "player_selected_category", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "current_focus_source", "SYSTEM_PREDICTED"
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "optional", False
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "unranked", False
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "count_ranking_used", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "selection_objective", "MAXIMIZE_ENGAGEMENT"
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "values_disclosed", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "durable_preference_created", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "player_interest_inferred", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "player_attention_inferred", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "mood_inferred", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "psychological_profile_created", True
        ),
        lambda value: value["observation_focus_candidates"][0].__setitem__(
            "semantic_game_fact_claimed", True
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "source_ingest_receipt_digest", "0" * 64
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "source_structured_cue_digest", "0" * 64
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "source_state_anchor_digest", "0" * 64
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "scope_id", "game:other:scope"
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "cue_authentication_proven", True
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "current_game_state_claimed", True
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "semantic_game_fact_claimed", True
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "downstream_admission_proven", True
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "runtime_eligible", True
        ),
        lambda value: value["player_event_candidate"].__setitem__(
            "focus", "system-predicted-focus"
        ),
        lambda value: value.__setitem__("unexpected", True),
        lambda value: value["focus_candidate_categories"].reverse(),
    ]
    for mutation in overview_mutations:
        output_mutation_rejected(
            baseline, overview_state, overview_cue, overview_out, mutation
        )

    no_state, no_cue, no_out = results["no-structured-cue-waits"][:3]

    def add_event_to_wait(value):
        value["player_event_candidate_created"] = True
        value["player_event_candidate"] = copy.deepcopy(
            overview_out["player_event_candidate"]
        )
        value["candidate_envelope_compatibility_only"] = True

    def add_focus_to_wait(value):
        value["focus_candidate_categories"] = copy.deepcopy(
            overview_out["focus_candidate_categories"]
        )
        value["observation_focus_candidates"] = copy.deepcopy(
            overview_out["observation_focus_candidates"]
        )

    output_mutation_rejected(baseline, no_state, no_cue, no_out, add_event_to_wait)
    output_mutation_rejected(baseline, no_state, no_cue, no_out, add_focus_to_wait)

    decline_state, decline_cue, decline_out = results[
        "decline-suppresses-this-evaluation"
    ][:3]
    output_mutation_rejected(
        baseline,
        decline_state,
        decline_cue,
        decline_out,
        lambda value: value.__setitem__(
            "next_human_decision", bridge.FUTURE_HUMAN_DECISION
        ),
    )
    output_mutation_rejected(
        baseline, decline_state, decline_cue, decline_out, add_focus_to_wait
    )

    # The existing candidate-envelope is a shape-compatibility probe, not an
    # admission boundary. Demonstrate that a detached event can reach that pure
    # synthetic generator, while this bridge never marks such admission as proven.
    detached = copy.deepcopy(overview_out["player_event_candidate"])
    detached["source_structured_cue_digest"] = "0" * 64
    detached["event_candidate_digest"] = bridge.sha(
        {
            key: value
            for key, value in detached.items()
            if key != "event_candidate_digest"
        }
    )
    detached_envelope = candidate_generator.generate(
        envelope_state(overview_state), detached
    )
    if detached_envelope["runtime_connectedness"] != "NOT_PROVEN":
        raise AssertionError("detached event runtime promotion")
    transplanted = copy.deepcopy(overview_out)
    transplanted["player_event_candidate"] = detached
    resign_output(transplanted)
    expect_reject(
        lambda: bridge.validate_output(
            baseline, overview_state, overview_cue, transplanted
        )
    )

    mutation_count = (
        1
        + len(source_mutations)
        + len(state_mutations)
        + len(cue_mutations)
        + len(overview_mutations)
        + 5
    )
    print(
        "KONTUR player-cued completed-observation context bridge: PASS; "
        f"cases={len(doc['cases'])}; upstream_receipts={len(sources)}; "
        f"candidate_envelope_compatibility_probes={envelope_count}; "
        "downstream_admission_proven=false; "
        f"fail_closed_mutations={mutation_count}"
    )


if __name__ == "__main__":
    main()
