#!/usr/bin/env python3
import copy
import json
from pathlib import Path

FIXTURE = Path(__file__).with_name("pause-resume-cases.json")
ORIGIN = "7c97e26aa3b7504d48b9ded6f0dfdccab444f8bd"

GAPS = {"MICRO_PAUSE", "SESSION_BREAK", "LONG_BREAK", "GAME_SWITCH"}
MEMORY = {"ACTIVE", "EXPIRED", "REVOKED"}
CUES = {"EXPLICIT_RESUME", "SAME_TOPIC_CUE", "NEW_TOPIC", "NONE", "AMBIGUOUS"}
MODES = {"NONE", "LIGHT_RECALL", "NEUTRAL_CHECKIN", "RESUME_THREAD"}
INTENTS = {"CONVERSATION", "HINT_REQUEST", "PARTIAL_SOLUTION_REQUEST", "SOLUTION_REQUEST"}

EXPECTED = {
    "micro-pause-light-recall": ("LIGHT_RECALL", True),
    "explicit-player-resume": ("RESUME_THREAD", True),
    "stale-solution-request-not-carried": ("NONE", True),
    "prior-interest-not-durable-preference": ("NEUTRAL_CHECKIN", True),
    "new-focus-overrides-old-thread": ("NONE", True),
    "cross-game-memory-blocked": ("NONE", True),
    "expired-memory-not-reused": ("NEUTRAL_CHECKIN", True),
    "declined-topic-stays-suppressed": ("NONE", True),
    "ambiguous-return-neutral-checkin": ("NEUTRAL_CHECKIN", True),
    "spoiler-exposure-no-deeper-authority": ("LIGHT_RECALL", True),
}

FALSE_BOUNDARY_FLAGS = {
    "live_response_generation",
    "proactive_messaging",
    "background_notification",
    "mood_inference",
    "psychological_profile",
    "behavioral_profile",
    "cross_game_preference_profile",
    "engagement_optimization",
    "retention_optimization",
    "total_history_required",
    "stable_core_promotion",
    "external_effect_authorized",
    "action_permit_created",
    "successor_permit_created",
}


def validate(data):
    errors = []

    if data.get("schema_version") != "0.1":
        errors.append("schema_version")
    if data.get("pilot_id") != "kontur-game-companion-pause-resume":
        errors.append("pilot_id")
    if data.get("origin_frontier") != ORIGIN:
        errors.append("origin_frontier")
    if data.get("source_issue") != 445:
        errors.append("source_issue")
    if data.get("predecessor_pr") != 456:
        errors.append("predecessor_pr")
    if data.get("mode") != "SYNTHETIC_PAUSE_RESUME_SESSION_BOUNDARY":
        errors.append("mode")

    flags = data.get("boundary_flags")
    if not isinstance(flags, dict):
        errors.append("boundary_flags")
        flags = {}
    for flag in FALSE_BOUNDARY_FLAGS:
        if flags.get(flag) is not False:
            errors.append(f"boundary:{flag}")

    cases = data.get("cases")
    if not isinstance(cases, list):
        return errors + ["cases:not-list"]
    ids = [c.get("id") for c in cases if isinstance(c, dict)]
    if set(ids) != set(EXPECTED) or len(ids) != len(EXPECTED):
        errors.append("canonical-case-set")

    for c in cases:
        if not isinstance(c, dict):
            errors.append("case:not-object")
            continue
        cid = c.get("id", "<missing>")
        if c.get("gap_class") not in GAPS:
            errors.append(f"{cid}:gap")
        if c.get("prior_memory_status") not in MEMORY:
            errors.append(f"{cid}:memory")
        if c.get("current_cue") not in CUES:
            errors.append(f"{cid}:cue")
        if c.get("prior_intent") not in INTENTS:
            errors.append(f"{cid}:intent")

        d = c.get("decision")
        if not isinstance(d, dict):
            errors.append(f"{cid}:decision")
            continue
        if d.get("resume_mode") not in MODES:
            errors.append(f"{cid}:resume-mode")
        if not isinstance(d.get("new_spoiler_level"), int) or d.get("new_spoiler_level") < 0:
            errors.append(f"{cid}:spoiler")
        for key in (
            "recall_allowed", "active_memory_reuse", "carry_prior_intent",
            "carry_prior_focus", "requires_current_confirmation",
            "topic_reopened", "allowed"
        ):
            if not isinstance(d.get(key), bool):
                errors.append(f"{cid}:{key}:bool")

        if c.get("player_can_ignore") is not True:
            errors.append(f"{cid}:ignorable")
        if c.get("player_can_redirect") is not True:
            errors.append(f"{cid}:redirectable")
        if c.get("mood_or_goal_inferred") is not False:
            errors.append(f"{cid}:inference")

        if d.get("carry_prior_intent") is not False:
            errors.append(f"{cid}:prior-intent-carried")
        if d.get("carry_prior_focus") is not False:
            errors.append(f"{cid}:prior-focus-carried")

        if d.get("resume_mode") == "RESUME_THREAD":
            if c.get("current_cue") != "EXPLICIT_RESUME":
                errors.append(f"{cid}:resume-without-explicit-cue")
            if d.get("topic_reopened") is not True:
                errors.append(f"{cid}:resume-without-reopen")
        if d.get("topic_reopened") and c.get("current_cue") != "EXPLICIT_RESUME":
            errors.append(f"{cid}:reopened-without-explicit-cue")

        if c.get("current_cue") == "NONE":
            if d.get("recall_allowed") or d.get("active_memory_reuse"):
                errors.append(f"{cid}:reuse-without-cue")
            if d.get("resume_mode") in {"LIGHT_RECALL", "RESUME_THREAD"}:
                errors.append(f"{cid}:active-resume-without-cue")

        if c.get("current_cue") == "NEW_TOPIC":
            if d.get("active_memory_reuse") or d.get("recall_allowed"):
                errors.append(f"{cid}:old-thread-overrides-new-topic")
            if d.get("resume_mode") != "NONE":
                errors.append(f"{cid}:resume-despite-new-topic")

        if c.get("gap_class") == "GAME_SWITCH" or c.get("same_game") is False:
            if d.get("active_memory_reuse") or d.get("recall_allowed"):
                errors.append(f"{cid}:cross-game-reuse")
            if d.get("resume_mode") in {"LIGHT_RECALL", "RESUME_THREAD"}:
                errors.append(f"{cid}:cross-game-resume")

        if c.get("prior_memory_status") != "ACTIVE":
            if d.get("active_memory_reuse") or d.get("recall_allowed"):
                errors.append(f"{cid}:inactive-memory-reuse")
            if d.get("resume_mode") in {"LIGHT_RECALL", "RESUME_THREAD"}:
                errors.append(f"{cid}:inactive-memory-resume")

        if c.get("prior_topic_declined") is True and c.get("current_cue") != "EXPLICIT_RESUME":
            if d.get("active_memory_reuse") or d.get("recall_allowed") or d.get("topic_reopened"):
                errors.append(f"{cid}:decline-ignored")
            if d.get("resume_mode") in {"LIGHT_RECALL", "RESUME_THREAD"}:
                errors.append(f"{cid}:declined-topic-retried")

        if c.get("current_cue") == "AMBIGUOUS":
            if d.get("resume_mode") not in {"NONE", "NEUTRAL_CHECKIN"}:
                errors.append(f"{cid}:ambiguity-overread")
            if d.get("active_memory_reuse"):
                errors.append(f"{cid}:ambiguous-active-reuse")
            if d.get("requires_current_confirmation") is not True:
                errors.append(f"{cid}:ambiguity-no-confirmation")

        if c.get("same_game") is True:
            if d.get("new_spoiler_level", -1) > c.get("prior_spoiler_level", -1):
                errors.append(f"{cid}:deeper-spoiler")
        else:
            if d.get("new_spoiler_level") != 0:
                errors.append(f"{cid}:cross-game-spoiler-carry")

        if cid in EXPECTED:
            expected_mode, expected_allowed = EXPECTED[cid]
            if d.get("resume_mode") != expected_mode:
                errors.append(f"{cid}:canonical-mode")
            if d.get("allowed") is not expected_allowed:
                errors.append(f"{cid}:canonical-allowed")

    return errors


def load():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def mutate(data, mutator):
    candidate = copy.deepcopy(data)
    mutator(candidate)
    return candidate


def by_id(data, cid):
    return next(c for c in data["cases"] if c["id"] == cid)


def main():
    data = load()
    errors = validate(data)
    if errors:
        raise SystemExit("canonical fixture failed: " + ", ".join(errors))

    mutations = [
        ("live response generation", lambda d: d["boundary_flags"].__setitem__("live_response_generation", True)),
        ("proactive messaging", lambda d: d["boundary_flags"].__setitem__("proactive_messaging", True)),
        ("background notification", lambda d: d["boundary_flags"].__setitem__("background_notification", True)),
        ("mood inference boundary", lambda d: d["boundary_flags"].__setitem__("mood_inference", True)),
        ("psychological profile", lambda d: d["boundary_flags"].__setitem__("psychological_profile", True)),
        ("behavioral profile", lambda d: d["boundary_flags"].__setitem__("behavioral_profile", True)),
        ("cross-game preference profile", lambda d: d["boundary_flags"].__setitem__("cross_game_preference_profile", True)),
        ("engagement optimization", lambda d: d["boundary_flags"].__setitem__("engagement_optimization", True)),
        ("retention optimization", lambda d: d["boundary_flags"].__setitem__("retention_optimization", True)),
        ("total history", lambda d: d["boundary_flags"].__setitem__("total_history_required", True)),
        ("stable core", lambda d: d["boundary_flags"].__setitem__("stable_core_promotion", True)),
        ("external effect", lambda d: d["boundary_flags"].__setitem__("external_effect_authorized", True)),
        ("action permit", lambda d: d["boundary_flags"].__setitem__("action_permit_created", True)),
        ("successor permit", lambda d: d["boundary_flags"].__setitem__("successor_permit_created", True)),
        ("carry stale intent", lambda d: by_id(d, "stale-solution-request-not-carried")["decision"].__setitem__("carry_prior_intent", True)),
        ("carry prior focus", lambda d: by_id(d, "new-focus-overrides-old-thread")["decision"].__setitem__("carry_prior_focus", True)),
        ("resume without explicit cue", lambda d: by_id(d, "micro-pause-light-recall")["decision"].__setitem__("resume_mode", "RESUME_THREAD")),
        ("topic reopened without explicit cue", lambda d: by_id(d, "micro-pause-light-recall")["decision"].__setitem__("topic_reopened", True)),
        ("reuse with no cue", lambda d: by_id(d, "stale-solution-request-not-carried")["decision"].__setitem__("active_memory_reuse", True)),
        ("recall with no cue", lambda d: by_id(d, "declined-topic-stays-suppressed")["decision"].__setitem__("recall_allowed", True)),
        ("old thread overrides new topic", lambda d: by_id(d, "new-focus-overrides-old-thread")["decision"].__setitem__("resume_mode", "LIGHT_RECALL")),
        ("cross-game reuse", lambda d: by_id(d, "cross-game-memory-blocked")["decision"].__setitem__("active_memory_reuse", True)),
        ("cross-game recall", lambda d: by_id(d, "cross-game-memory-blocked")["decision"].__setitem__("recall_allowed", True)),
        ("cross-game spoiler carry", lambda d: by_id(d, "cross-game-memory-blocked")["decision"].__setitem__("new_spoiler_level", 2)),
        ("expired memory reuse", lambda d: by_id(d, "expired-memory-not-reused")["decision"].__setitem__("active_memory_reuse", True)),
        ("expired memory recall", lambda d: by_id(d, "expired-memory-not-reused")["decision"].__setitem__("recall_allowed", True)),
        ("declined topic retry", lambda d: by_id(d, "declined-topic-stays-suppressed")["decision"].__setitem__("resume_mode", "LIGHT_RECALL")),
        ("ambiguous return active reuse", lambda d: by_id(d, "ambiguous-return-neutral-checkin")["decision"].__setitem__("active_memory_reuse", True)),
        ("ambiguous return no confirmation", lambda d: by_id(d, "ambiguous-return-neutral-checkin")["decision"].__setitem__("requires_current_confirmation", False)),
        ("infer mood or goal", lambda d: by_id(d, "ambiguous-return-neutral-checkin").__setitem__("mood_or_goal_inferred", True)),
        ("deeper spoiler after resume", lambda d: by_id(d, "spoiler-exposure-no-deeper-authority")["decision"].__setitem__("new_spoiler_level", 3)),
        ("non-ignorable resume", lambda d: by_id(d, "explicit-player-resume").__setitem__("player_can_ignore", False)),
        ("non-redirectable resume", lambda d: by_id(d, "explicit-player-resume").__setitem__("player_can_redirect", False)),
    ]

    rejected = 0
    survivors = []
    for name, mutator in mutations:
        candidate = mutate(data, mutator)
        if validate(candidate):
            rejected += 1
        else:
            survivors.append(name)

    if survivors:
        raise SystemExit("fail-closed mutation(s) survived: " + ", ".join(survivors))

    print(f"KONTUR Game Companion pause/resume boundary: PASS ({rejected} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
