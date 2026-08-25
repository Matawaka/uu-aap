#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

DEPTHS = ["NONE", "NOTICE", "QUESTION", "THEORY", "NUDGE"]
DEPTH_INDEX = {name: idx for idx, name in enumerate(DEPTHS)}
TRIGGERS = {
    "PLAYER_CUE",
    "CURRENT_GAME_EVENT",
    "OPEN_MYSTERY_MATCH",
    "SHARED_LABEL_MATCH",
    "NONE",
}
EPISTEMIC = {"KNOWN", "LIKELY", "GUESS", "PLAYFUL_THEORY"}
REVERSIBILITY = {"REVERSIBLE", "COSTLY_BUT_RECOVERABLE", "IRREVERSIBLE"}
MEMORY_CLASSES = {
    "HYPOTHESIS",
    "CORRECTION",
    "CONFIRMED_LOCAL_FACT",
    "OPEN_MYSTERY",
    "SHARED_LABEL",
    "SPOILER_EXPOSURE",
    "LOCAL_EXPERTISE_SIGNAL",
}


def validate(data):
    assert data["schema_version"] == "0.1"
    assert data["pilot_id"] == "kontur-game-companion-bounded-initiative"
    assert data["origin_frontier"] == "b3df9ac63171e6596421a5e7e1dd20cb6a5df615"

    shared = data["shared"]
    assert shared["repository"] == "Matawaka/uu-aap"
    assert shared["source_issue"] == 445
    assert shared["predecessor_prs"] == [446, 452, 453]
    assert shared["mode"] == "SYNTHETIC_BOUNDED_CONVERSATIONAL_INITIATIVE"
    assert shared["live_proactive_messaging_authorized"] is False
    assert shared["background_notifications_authorized"] is False
    assert shared["autonomous_gameplay_authorized"] is False
    assert shared["psychological_inference_authorized"] is False
    assert shared["attention_inference_authorized"] is False
    assert shared["engagement_maximization_authorized"] is False
    assert shared["retention_optimization_authorized"] is False
    assert shared["cross_game_profile_authorized"] is False
    assert shared["action_permit_created"] is False

    cases = {case["case_id"]: case for case in data["cases"]}
    assert set(cases) == {
        "player-cue-question-allowed",
        "open-mystery-new-match-allowed",
        "shared-label-light-callback-allowed",
        "silence-no-trigger-blocked",
        "declined-topic-retry-blocked",
        "ignored-initiative-budget-exhausted",
        "cross-scope-memory-callback-blocked",
        "irreversible-uncertain-proactive-nudge-blocked",
        "player-focus-overrides-system-agenda",
    }

    for case in cases.values():
        assert case["trigger_class"] in TRIGGERS
        assert case["initiative_depth"] in DEPTH_INDEX
        assert case["max_permitted_depth"] in DEPTH_INDEX
        assert case["epistemic_mode"] in EPISTEMIC
        assert case["reversibility_class"] in REVERSIBILITY
        assert isinstance(case["same_local_scope"], bool)
        assert isinstance(case["current_focus_matches"], bool)
        assert isinstance(case["player_recently_declined"], bool)
        assert isinstance(case["ignored_initiative_count"], int)
        assert case["ignored_initiative_count"] >= 0
        assert isinstance(case["initiative_budget_remaining"], int)
        assert case["initiative_budget_remaining"] >= 0
        assert isinstance(case["memory_used"], bool)
        assert isinstance(case["player_agency_preserved"], bool)
        assert isinstance(case["allowed"], bool)

        if case["memory_used"]:
            assert case.get("memory_class") in MEMORY_CLASSES

        too_deep = DEPTH_INDEX[case["initiative_depth"]] > DEPTH_INDEX[case["max_permitted_depth"]]
        if too_deep:
            assert case["allowed"] is False

        if case["allowed"]:
            assert case["player_agency_preserved"] is True
            if case["initiative_depth"] != "NONE":
                assert case["trigger_class"] != "NONE"
                assert case["current_focus_matches"] is True
                assert case["player_recently_declined"] is False
                assert case["initiative_budget_remaining"] > 0
                assert case["ignored_initiative_count"] < 2
            if case["memory_used"]:
                assert case.get("memory_active") is True
                assert case["same_local_scope"] is True
                assert case.get("cross_game_memory", False) is False

        if case["trigger_class"] == "NONE" and case["initiative_depth"] != "NONE":
            assert case["allowed"] is False

        if case.get("silence_only_basis") is True and case["initiative_depth"] != "NONE":
            assert case["allowed"] is False

        if case["player_recently_declined"] and case["initiative_depth"] != "NONE":
            assert case["allowed"] is False
            assert case["max_permitted_depth"] == "NONE"

        if case["ignored_initiative_count"] >= 2 and case["initiative_depth"] != "NONE":
            assert case["allowed"] is False
            assert case["initiative_budget_remaining"] == 0
            assert case["max_permitted_depth"] == "NONE"

        if case["initiative_budget_remaining"] == 0 and case["initiative_depth"] != "NONE":
            assert case["allowed"] is False

        if not case["current_focus_matches"] and case["initiative_depth"] != "NONE":
            assert case["allowed"] is False

        if case.get("cross_game_memory") is True and case["initiative_depth"] != "NONE":
            assert case["allowed"] is False
            assert case["same_local_scope"] is False

        if case.get("manipulative_familiarity") is True:
            assert case["allowed"] is False

        if (
            case["reversibility_class"] == "IRREVERSIBLE"
            and case.get("irreversible_loss_risk") is True
            and case["epistemic_mode"] in {"GUESS", "PLAYFUL_THEORY"}
        ):
            assert DEPTH_INDEX[case["max_permitted_depth"]] <= DEPTH_INDEX["NOTICE"]
            if DEPTH_INDEX[case["initiative_depth"]] > DEPTH_INDEX["NOTICE"]:
                assert case["allowed"] is False

        if case.get("player_changed_focus") is True:
            assert case["initiative_depth"] == "NONE"
            assert case["max_permitted_depth"] == "NONE"
            assert case.get("system_agenda_suppressed") is True
            assert case["player_agency_preserved"] is True

    cue = cases["player-cue-question-allowed"]
    assert cue["trigger_class"] == "PLAYER_CUE"
    assert cue["initiative_depth"] == "QUESTION"
    assert cue["allowed"] is True

    mystery = cases["open-mystery-new-match-allowed"]
    assert mystery["trigger_class"] == "OPEN_MYSTERY_MATCH"
    assert mystery["memory_class"] == "OPEN_MYSTERY"
    assert mystery["memory_active"] is True
    assert mystery["current_focus_matches"] is True
    assert mystery["allowed"] is True

    label = cases["shared-label-light-callback-allowed"]
    assert label["trigger_class"] == "SHARED_LABEL_MATCH"
    assert label["memory_class"] == "SHARED_LABEL"
    assert label["manipulative_familiarity"] is False
    assert label["allowed"] is True

    silence = cases["silence-no-trigger-blocked"]
    assert silence["trigger_class"] == "NONE"
    assert silence["silence_only_basis"] is True
    assert silence["initiative_depth"] == "QUESTION"
    assert silence["allowed"] is False

    declined = cases["declined-topic-retry-blocked"]
    assert declined["player_recently_declined"] is True
    assert declined["max_permitted_depth"] == "NONE"
    assert declined["allowed"] is False

    ignored = cases["ignored-initiative-budget-exhausted"]
    assert ignored["ignored_initiative_count"] == 2
    assert ignored["initiative_budget_remaining"] == 0
    assert ignored["max_permitted_depth"] == "NONE"
    assert ignored["allowed"] is False

    cross_scope = cases["cross-scope-memory-callback-blocked"]
    assert cross_scope["cross_game_memory"] is True
    assert cross_scope["same_local_scope"] is False
    assert cross_scope["memory_active"] is False
    assert cross_scope["allowed"] is False

    risky = cases["irreversible-uncertain-proactive-nudge-blocked"]
    assert risky["epistemic_mode"] == "GUESS"
    assert risky["reversibility_class"] == "IRREVERSIBLE"
    assert risky["irreversible_loss_risk"] is True
    assert risky["initiative_depth"] == "NUDGE"
    assert risky["max_permitted_depth"] == "NOTICE"
    assert risky["allowed"] is False

    focus = cases["player-focus-overrides-system-agenda"]
    assert focus["player_changed_focus"] is True
    assert focus["current_focus_matches"] is False
    assert focus["initiative_depth"] == "NONE"
    assert focus["system_agenda_suppressed"] is True
    assert focus["allowed"] is True


def by_id(data, case_id):
    return next(case for case in data["cases"] if case["case_id"] == case_id)


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    base = json.loads((ROOT / "initiative-cases.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["shared"].__setitem__("live_proactive_messaging_authorized", True),
        lambda d: d["shared"].__setitem__("background_notifications_authorized", True),
        lambda d: d["shared"].__setitem__("autonomous_gameplay_authorized", True),
        lambda d: d["shared"].__setitem__("psychological_inference_authorized", True),
        lambda d: d["shared"].__setitem__("attention_inference_authorized", True),
        lambda d: d["shared"].__setitem__("engagement_maximization_authorized", True),
        lambda d: d["shared"].__setitem__("retention_optimization_authorized", True),
        lambda d: d["shared"].__setitem__("cross_game_profile_authorized", True),
        lambda d: d["shared"].__setitem__("action_permit_created", True),
        lambda d: by_id(d, "player-cue-question-allowed").__setitem__("trigger_class", "NONE"),
        lambda d: by_id(d, "player-cue-question-allowed").__setitem__("initiative_depth", "SOLUTION"),
        lambda d: by_id(d, "open-mystery-new-match-allowed").__setitem__("memory_active", False),
        lambda d: by_id(d, "open-mystery-new-match-allowed").__setitem__("same_local_scope", False),
        lambda d: by_id(d, "shared-label-light-callback-allowed").__setitem__("manipulative_familiarity", True),
        lambda d: by_id(d, "silence-no-trigger-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "silence-no-trigger-blocked").__setitem__("trigger_class", "PLAYER_CUE"),
        lambda d: by_id(d, "declined-topic-retry-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "declined-topic-retry-blocked").__setitem__("max_permitted_depth", "QUESTION"),
        lambda d: by_id(d, "ignored-initiative-budget-exhausted").__setitem__("allowed", True),
        lambda d: by_id(d, "ignored-initiative-budget-exhausted").__setitem__("initiative_budget_remaining", 1),
        lambda d: by_id(d, "cross-scope-memory-callback-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "cross-scope-memory-callback-blocked").__setitem__("cross_game_memory", False),
        lambda d: by_id(d, "irreversible-uncertain-proactive-nudge-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "irreversible-uncertain-proactive-nudge-blocked").__setitem__("max_permitted_depth", "NUDGE"),
        lambda d: by_id(d, "player-focus-overrides-system-agenda").__setitem__("initiative_depth", "NOTICE"),
        lambda d: by_id(d, "player-focus-overrides-system-agenda").__setitem__("system_agenda_suppressed", False),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(
        "KONTUR Game Companion bounded initiative: "
        f"PASS ({len(mutations)} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
