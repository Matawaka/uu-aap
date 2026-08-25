#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FIXTURE = HERE / "conversation-variety-cases.json"

EXPECTED_MOVES = [
    "COMMENT", "OBSERVATION", "QUESTION", "THEORY",
    "CALLBACK", "PLAYFUL_HYPOTHESIS", "REFLECTION", "WAIT",
]
EXPECTED_INVARIANTS = [
    "Variation != Manipulation",
    "Novelty != Engagement Optimization",
    "Repeated Phrase != Stable Player Preference",
    "Local Turn Pattern != Durable Conversational Profile",
    "Style Adaptation != Personality Inference",
    "Interestingness != Attention Capture",
    "Different Wording != Different Authority",
    "Variety != Forced Topic Switching",
    "Avoid Repetition != Avoid Necessary Safety Boundary",
    "Freshness != Spoiler Escalation",
    "Playful Voice != False Certainty",
    "Question Diversity != Interrogation",
    "Player Correction > Style Consistency",
    "Player Focus > Variety Objective",
    "Conversation Variety != Action Permit",
]
EXPECTED_NON_EFFECTS = [
    "live_response_generation",
    "proactive_messaging",
    "background_activity",
    "runtime_activation",
    "external_effect",
    "action_permit",
    "successor_permit",
    "response_authority_created",
    "personality_inference",
    "psychological_profile",
    "behavioral_profile",
    "mood_inference",
    "attention_tracking",
    "engagement_optimization",
    "retention_optimization",
    "cross_game_style_profile",
    "transcript_retention",
    "stable_core_promotion",
]
EXPECTED_PREDECESSORS = [
    "pilots/kontur-game-companion/interaction-receipt/interaction-receipt-cases.json",
    "pilots/kontur-game-companion/safety-boundary/safety-boundary-cases.json",
]
ALLOWED_PERSONALIZATION = {"NONE", "LOCAL_MOVE_HISTORY"}
FORBIDDEN_OBJECTIVES = {"ENGAGEMENT_MAXIMIZATION", "RETENTION_MAXIMIZATION"}
ASSISTANCE_DEPTHS = {
    "COMMENT", "NOTICE", "QUESTION", "THEORY",
    "NUDGE", "HINT", "PARTIAL_SOLUTION", "SOLUTION",
}
INITIATIVE_DEPTHS = {"NONE", "NOTICE", "QUESTION", "THEORY", "NUDGE"}
REPETITION_REASONS = {"NONE", "EXPLICIT_REQUEST", "SAFETY_BOUNDARY", "CORRECTION_REPAIR"}


def load():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def expected_case_admissibility(case):
    c = case["context"]
    d = case["decision"]
    ok = True
    ok &= c["response_admissible"] is True
    ok &= d["selected_move_class"] in EXPECTED_MOVES
    ok &= d["assistance_depth_after"] == c["authorized_assistance_depth"]
    ok &= d["initiative_depth_after"] == c["initiative_depth"]
    ok &= d["spoiler_depth_after"] == c["spoiler_depth"]
    ok &= d["focus_after"] == c["player_focus"]
    ok &= c["personalization_basis"] in ALLOWED_PERSONALIZATION
    ok &= c["selection_objective"] not in FORBIDDEN_OBJECTIVES
    recent = c["recent_move_classes"]
    third_question = (
        len(recent) >= 2
        and recent[-2:] == ["QUESTION", "QUESTION"]
        and d["selected_move_class"] == "QUESTION"
    )
    if third_question and not c["explicit_repeat_requested"]:
        ok = False
    if c["player_correction_present"] and not d["content_revision_required"]:
        ok = False
    return bool(ok)


def validate_document(doc):
    if doc.get("schema_version") != "0.1":
        raise ValueError("schema_version")
    if doc.get("contract") != "KONTUR_GAME_COMPANION_CONVERSATIONAL_VARIETY":
        raise ValueError("contract")
    frontier = doc.get("origin_frontier", "")
    if len(frontier) != 40 or any(ch not in "0123456789abcdef" for ch in frontier):
        raise ValueError("origin_frontier")

    placement = doc.get("placement", {})
    if placement.get("kind") != "POST_ADMISSIBILITY_SURFACE_SELECTOR":
        raise ValueError("placement kind")
    if placement.get("predecessor_evidence") != EXPECTED_PREDECESSORS:
        raise ValueError("predecessor evidence")
    if placement.get("authority_effect") != "NONE":
        raise ValueError("authority effect")
    for rel in EXPECTED_PREDECESSORS:
        if not (ROOT / rel).is_file():
            raise ValueError(f"missing predecessor evidence {rel}")

    if doc.get("move_classes") != EXPECTED_MOVES:
        raise ValueError("move classes")
    if "NUDGE" in doc["move_classes"] or "HINT" in doc["move_classes"] or "SOLUTION" in doc["move_classes"]:
        raise ValueError("assistance semantics leaked into surface classes")

    rolling = doc.get("rolling_window", {})
    if rolling != {
        "max_recent_move_classes": 5,
        "scope": "EPHEMERAL_LOCAL",
        "durable_style_profile": False,
        "full_transcript_required": False,
    }:
        raise ValueError("rolling window")

    if doc.get("invariants") != EXPECTED_INVARIANTS:
        raise ValueError("invariants")

    non_effects = doc.get("non_effects", {})
    if set(non_effects) != set(EXPECTED_NON_EFFECTS):
        raise ValueError("non-effect field set")
    if any(non_effects[key] is not False for key in EXPECTED_NON_EFFECTS):
        raise ValueError("non-effect enabled")

    cases = doc.get("cases")
    if not isinstance(cases, list) or len(cases) != 13:
        raise ValueError("case count")

    ids = set()
    for case in cases:
        cid = case.get("id")
        if not isinstance(cid, str) or not cid or cid in ids:
            raise ValueError("case id")
        ids.add(cid)

        context = case.get("context")
        decision = case.get("decision")
        if not isinstance(context, dict) or not isinstance(decision, dict):
            raise ValueError(f"{cid}: context/decision")

        required_context = {
            "response_admissible",
            "authorized_assistance_depth",
            "initiative_depth",
            "spoiler_depth",
            "player_focus",
            "recent_move_classes",
            "explicit_repeat_requested",
            "safety_boundary_requires_repetition",
            "player_correction_present",
            "personalization_basis",
            "selection_objective",
        }
        required_decision = {
            "selected_move_class",
            "assistance_depth_after",
            "initiative_depth_after",
            "spoiler_depth_after",
            "focus_after",
            "variety_applied",
            "repetition_reason",
            "interrogation_guard_applied",
            "content_revision_required",
            "admissible",
        }
        if set(context) != required_context or set(decision) != required_decision:
            raise ValueError(f"{cid}: exact fields")

        if context["authorized_assistance_depth"] not in ASSISTANCE_DEPTHS:
            raise ValueError(f"{cid}: assistance depth")
        if context["initiative_depth"] not in INITIATIVE_DEPTHS:
            raise ValueError(f"{cid}: initiative depth")
        if not isinstance(context["spoiler_depth"], int) or context["spoiler_depth"] < 0:
            raise ValueError(f"{cid}: spoiler depth")
        if not isinstance(context["player_focus"], str) or not context["player_focus"]:
            raise ValueError(f"{cid}: player focus")

        recent = context["recent_move_classes"]
        if not isinstance(recent, list) or len(recent) > 5 or any(move not in EXPECTED_MOVES for move in recent):
            raise ValueError(f"{cid}: recent moves")

        for key in [
            "response_admissible",
            "explicit_repeat_requested",
            "safety_boundary_requires_repetition",
            "player_correction_present",
        ]:
            if not isinstance(context[key], bool):
                raise ValueError(f"{cid}: {key}")

        for key in [
            "variety_applied",
            "interrogation_guard_applied",
            "content_revision_required",
            "admissible",
        ]:
            if not isinstance(decision[key], bool):
                raise ValueError(f"{cid}: {key}")

        if decision["selected_move_class"] not in EXPECTED_MOVES:
            raise ValueError(f"{cid}: move")
        if decision["assistance_depth_after"] not in ASSISTANCE_DEPTHS:
            raise ValueError(f"{cid}: assistance after")
        if decision["initiative_depth_after"] not in INITIATIVE_DEPTHS:
            raise ValueError(f"{cid}: initiative after")
        if not isinstance(decision["spoiler_depth_after"], int) or decision["spoiler_depth_after"] < 0:
            raise ValueError(f"{cid}: spoiler after")
        if decision["repetition_reason"] not in REPETITION_REASONS:
            raise ValueError(f"{cid}: repetition reason")

        expected_reason = "NONE"
        if context["explicit_repeat_requested"]:
            expected_reason = "EXPLICIT_REQUEST"
        elif context["safety_boundary_requires_repetition"]:
            expected_reason = "SAFETY_BOUNDARY"
        elif context["player_correction_present"]:
            expected_reason = "CORRECTION_REPAIR"
        if decision["repetition_reason"] != expected_reason:
            raise ValueError(f"{cid}: repetition reason mismatch")

        last_two_questions = len(recent) >= 2 and recent[-2:] == ["QUESTION", "QUESTION"]
        expected_guard = bool(
            last_two_questions
            and decision["selected_move_class"] != "QUESTION"
            and not context["explicit_repeat_requested"]
            and not context["safety_boundary_requires_repetition"]
        )
        if decision["interrogation_guard_applied"] != expected_guard:
            raise ValueError(f"{cid}: interrogation guard")

        if context["player_correction_present"] and decision["content_revision_required"] is not True:
            raise ValueError(f"{cid}: correction repair")
        if not context["player_correction_present"] and decision["content_revision_required"] is not False:
            raise ValueError(f"{cid}: spurious correction repair")

        if decision["variety_applied"] and context["selection_objective"] not in {
            "LOCAL_VARIETY", "ENGAGEMENT_MAXIMIZATION", "RETENTION_MAXIMIZATION"
        }:
            raise ValueError(f"{cid}: variety objective")

        if decision["admissible"] != expected_case_admissibility(case):
            raise ValueError(f"{cid}: admissibility mismatch")

    required_ids = {
        "repeated-question-switches-to-comment",
        "repeated-comment-uses-playful-hypothesis",
        "explicit-repeat-allows-same-shape",
        "safety-boundary-may-repeat",
        "novelty-cannot-switch-player-focus",
        "variety-cannot-escalate-assistance",
        "personality-based-style-adaptation-blocked",
        "local-history-expires-without-profile",
        "player-correction-overrides-style-consistency",
        "anti-interrogation-blocks-third-question",
        "engagement-objective-cannot-drive-variety",
        "freshness-cannot-increase-spoiler-depth",
        "blocked-receipt-cannot-be-revived-by-variety",
    }
    if ids != required_ids:
        raise ValueError("canonical case ids")
    return True


def must_reject(base, mutator, label):
    candidate = copy.deepcopy(base)
    mutator(candidate)
    try:
        validate_document(candidate)
    except Exception:
        return
    raise AssertionError(f"unsafe mutation accepted: {label}")


def main():
    doc = load()
    validate_document(doc)
    mutations = [
        ("authority-effect", lambda x: x["placement"].__setitem__("authority_effect", "CREATE")),
        ("placement-kind", lambda x: x["placement"].__setitem__("kind", "AUTHORITY_SELECTOR")),
        ("predecessor-drop", lambda x: x["placement"].__setitem__("predecessor_evidence", x["placement"]["predecessor_evidence"][:1])),
        ("move-nudge", lambda x: x["move_classes"].__setitem__(0, "NUDGE")),
        ("move-drop", lambda x: x["move_classes"].pop()),
        ("window-expand", lambda x: x["rolling_window"].__setitem__("max_recent_move_classes", 50)),
        ("window-durable", lambda x: x["rolling_window"].__setitem__("durable_style_profile", True)),
        ("transcript-required", lambda x: x["rolling_window"].__setitem__("full_transcript_required", True)),
        ("invariant-drop", lambda x: x["invariants"].pop()),
        ("non-effect-enable", lambda x: x["non_effects"].__setitem__("engagement_optimization", True)),
        ("non-effect-drop", lambda x: x["non_effects"].pop("attention_tracking")),
        ("case-drop", lambda x: x["cases"].pop()),
        ("duplicate-id", lambda x: x["cases"][1].__setitem__("id", x["cases"][0]["id"])),
        ("focus-switch-allowed", lambda x: x["cases"][4]["decision"].__setitem__("admissible", True)),
        ("assistance-escalation-allowed", lambda x: x["cases"][5]["decision"].__setitem__("admissible", True)),
        ("personality-allowed", lambda x: x["cases"][6]["decision"].__setitem__("admissible", True)),
        ("third-question-allowed", lambda x: x["cases"][9]["decision"].__setitem__("admissible", True)),
        ("engagement-allowed", lambda x: x["cases"][10]["decision"].__setitem__("admissible", True)),
        ("spoiler-increase-allowed", lambda x: x["cases"][11]["decision"].__setitem__("admissible", True)),
        ("revive-blocked-receipt", lambda x: x["cases"][12]["decision"].__setitem__("admissible", True)),
        ("erase-correction-revision", lambda x: x["cases"][8]["decision"].__setitem__("content_revision_required", False)),
        ("wrong-correction-reason", lambda x: x["cases"][8]["decision"].__setitem__("repetition_reason", "NONE")),
        ("wrong-explicit-reason", lambda x: x["cases"][2]["decision"].__setitem__("repetition_reason", "NONE")),
        ("wrong-safety-reason", lambda x: x["cases"][3]["decision"].__setitem__("repetition_reason", "NONE")),
        ("guard-disabled", lambda x: x["cases"][0]["decision"].__setitem__("interrogation_guard_applied", False)),
        ("guard-spurious", lambda x: x["cases"][1]["decision"].__setitem__("interrogation_guard_applied", True)),
        ("history-overflow", lambda x: x["cases"][0]["context"].__setitem__("recent_move_classes", ["COMMENT"] * 6)),
        ("unknown-move", lambda x: x["cases"][0]["decision"].__setitem__("selected_move_class", "PROMPT_LOOP")),
        ("initiative-escalation-allowed", lambda x: (x["cases"][0]["decision"].__setitem__("initiative_depth_after", "NUDGE"), x["cases"][0]["decision"].__setitem__("admissible", True))),
        ("assistance-change-on-good-case", lambda x: x["cases"][0]["decision"].__setitem__("assistance_depth_after", "HINT")),
        ("spoiler-change-on-good-case", lambda x: x["cases"][0]["decision"].__setitem__("spoiler_depth_after", 1)),
        ("focus-change-on-good-case", lambda x: x["cases"][0]["decision"].__setitem__("focus_after", "different-focus")),
        ("profile-cross-game", lambda x: x["cases"][1]["context"].__setitem__("personalization_basis", "CROSS_GAME_PROFILE")),
        ("retain-objective", lambda x: x["cases"][1]["context"].__setitem__("selection_objective", "RETENTION_MAXIMIZATION")),
        ("origin-frontier", lambda x: x.__setitem__("origin_frontier", "bad")),
    ]
    for label, mutation in mutations:
        must_reject(doc, mutation, label)
    print(
        f"KONTUR Game Companion Conversational Variety v0.1: "
        f"{len(doc['cases'])} canonical cases valid; {len(mutations)} unsafe mutations rejected."
    )


if __name__ == "__main__":
    main()
