#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ALLOWED_ORIGINS = {
    "PLAYER_CUE",
    "CURRENT_SCENE",
    "OPEN_MYSTERY",
    "SHARED_DISCOVERY",
    "SYSTEM_OBSERVATION",
}


def validate(data):
    assert data["schema_version"] == "0.1"
    assert data["pilot_id"] == "kontur-game-companion-focus-diversity"
    assert data["origin_frontier"] == "282f1320b8fffbb1f4beb388082ec8d59924f67a"

    shared = data["shared"]
    assert shared["repository"] == "Matawaka/uu-aap"
    assert shared["source_issue"] == 445
    assert shared["mode"] == "SYNTHETIC_FOCUS_DIVERSITY_POLICY"
    assert shared["live_attention_tracking_authorized"] is False
    assert shared["behavioral_profile_authorized"] is False
    assert shared["psychological_inference_authorized"] is False
    assert shared["engagement_maximization_authorized"] is False
    assert shared["retention_optimization_authorized"] is False
    assert shared["cross_game_preference_profile_authorized"] is False
    assert shared["external_effect_authorized"] is False

    cases = {case["case_id"]: case for case in data["cases"]}
    assert set(cases) == {
        "optional-current-scene-hook",
        "multiple-plausible-foci",
        "player-choice-overrides-prediction",
        "repeated-focus-not-profile",
        "ignored-focus-suppressed",
        "salient-spoiler-withheld",
        "engagement-optimized-selection-blocked",
        "forced-diversity-switch-blocked",
        "stale-cross-game-focus-blocked",
        "ambiguous-relevance-stays-tentative",
    }

    for case in cases.values():
        assert isinstance(case["candidate_origins"], list)
        assert all(origin in ALLOWED_ORIGINS for origin in case["candidate_origins"])
        assert isinstance(case["candidate_count"], int)
        assert 0 <= case["candidate_count"] <= 3
        assert isinstance(case["player_selected_focus"], bool)
        assert isinstance(case["predicted_interest_used"], bool)
        assert isinstance(case["durable_preference_created"], bool)
        assert isinstance(case["forced_topic_switch"], bool)
        assert isinstance(case["spoiler_increase"], bool)
        assert isinstance(case["suggestion_optional"], bool)
        assert isinstance(case["allowed"], bool)

        if case["allowed"] is True:
            assert case["durable_preference_created"] is False
            assert case["forced_topic_switch"] is False
            assert case["spoiler_increase"] is False

        if case.get("selection_objective") == "MAXIMIZE_ENGAGEMENT":
            assert case["allowed"] is False

        if case.get("cross_scope_reuse") is True:
            assert case["allowed"] is False

        if case.get("prior_suggestion_ignored") is True:
            assert case.get("same_focus_repeated") is False

        if case["player_selected_focus"] is True and case.get("system_prediction_overrode_player") is True:
            assert case["allowed"] is False

        if case.get("high_salience") is True and case.get("spoiler_authorized") is False:
            assert case["spoiler_increase"] is False

        if case.get("relevance_confidence") == "AMBIGUOUS" and case["allowed"] is True:
            assert case.get("presented_as_preference") is False
            assert case.get("objective_best_claimed") is False

    hook = cases["optional-current-scene-hook"]
    assert hook["candidate_origins"] == ["CURRENT_SCENE"]
    assert hook["candidate_count"] == 1
    assert hook["suggestion_optional"] is True
    assert hook["allowed"] is True

    plural = cases["multiple-plausible-foci"]
    assert plural["candidate_count"] == 3
    assert plural["objective_best_claimed"] is False
    assert plural["forced_ranking"] is False
    assert plural["allowed"] is True

    override = cases["player-choice-overrides-prediction"]
    assert override["player_selected_focus"] is True
    assert override["predicted_interest_used"] is True
    assert override["system_prediction_overrode_player"] is False
    assert override["allowed"] is True

    repeated = cases["repeated-focus-not-profile"]
    assert repeated["repeated_local_focus_count"] == 4
    assert repeated["durable_preference_created"] is False
    assert repeated["cross_scope_reuse"] is False
    assert repeated["allowed"] is True

    ignored = cases["ignored-focus-suppressed"]
    assert ignored["prior_suggestion_ignored"] is True
    assert ignored["same_focus_repeated"] is False
    assert ignored["candidate_count"] == 0
    assert ignored["allowed"] is True

    spoiler = cases["salient-spoiler-withheld"]
    assert spoiler["high_salience"] is True
    assert spoiler["spoiler_authorized"] is False
    assert spoiler["spoiler_increase"] is False
    assert spoiler["candidate_count"] == 0
    assert spoiler["allowed"] is True

    engagement = cases["engagement-optimized-selection-blocked"]
    assert engagement["selection_objective"] == "MAXIMIZE_ENGAGEMENT"
    assert engagement["allowed"] is False

    forced = cases["forced-diversity-switch-blocked"]
    assert forced["player_selected_focus"] is True
    assert forced["player_current_thread_active"] is True
    assert forced["forced_topic_switch"] is True
    assert forced["allowed"] is False

    stale = cases["stale-cross-game-focus-blocked"]
    assert stale["memory_scope_current"] is False
    assert stale["cross_scope_reuse"] is True
    assert stale["allowed"] is False

    ambiguous = cases["ambiguous-relevance-stays-tentative"]
    assert ambiguous["relevance_confidence"] == "AMBIGUOUS"
    assert ambiguous["presented_as_preference"] is False
    assert ambiguous["objective_best_claimed"] is False
    assert ambiguous["allowed"] is True


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
    base = json.loads((ROOT / "focus-cases.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["shared"].__setitem__("live_attention_tracking_authorized", True),
        lambda d: d["shared"].__setitem__("behavioral_profile_authorized", True),
        lambda d: d["shared"].__setitem__("psychological_inference_authorized", True),
        lambda d: d["shared"].__setitem__("engagement_maximization_authorized", True),
        lambda d: d["shared"].__setitem__("retention_optimization_authorized", True),
        lambda d: d["shared"].__setitem__("cross_game_preference_profile_authorized", True),
        lambda d: d["shared"].__setitem__("external_effect_authorized", True),
        lambda d: by_id(d, "optional-current-scene-hook").__setitem__("suggestion_optional", False),
        lambda d: by_id(d, "optional-current-scene-hook").__setitem__("durable_preference_created", True),
        lambda d: by_id(d, "multiple-plausible-foci").__setitem__("objective_best_claimed", True),
        lambda d: by_id(d, "multiple-plausible-foci").__setitem__("forced_ranking", True),
        lambda d: by_id(d, "player-choice-overrides-prediction").__setitem__("system_prediction_overrode_player", True),
        lambda d: by_id(d, "player-choice-overrides-prediction").__setitem__("forced_topic_switch", True),
        lambda d: by_id(d, "repeated-focus-not-profile").__setitem__("durable_preference_created", True),
        lambda d: by_id(d, "repeated-focus-not-profile").__setitem__("cross_scope_reuse", True),
        lambda d: by_id(d, "ignored-focus-suppressed").__setitem__("same_focus_repeated", True),
        lambda d: by_id(d, "ignored-focus-suppressed").__setitem__("candidate_count", 1),
        lambda d: by_id(d, "salient-spoiler-withheld").__setitem__("spoiler_increase", True),
        lambda d: by_id(d, "salient-spoiler-withheld").__setitem__("candidate_count", 1),
        lambda d: by_id(d, "engagement-optimized-selection-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "engagement-optimized-selection-blocked").__setitem__("selection_objective", "EXPAND_OPTIONS"),
        lambda d: by_id(d, "forced-diversity-switch-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "forced-diversity-switch-blocked").__setitem__("forced_topic_switch", False),
        lambda d: by_id(d, "stale-cross-game-focus-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "stale-cross-game-focus-blocked").__setitem__("cross_scope_reuse", False),
        lambda d: by_id(d, "ambiguous-relevance-stays-tentative").__setitem__("presented_as_preference", True),
        lambda d: by_id(d, "ambiguous-relevance-stays-tentative").__setitem__("objective_best_claimed", True),
        lambda d: by_id(d, "ambiguous-relevance-stays-tentative").__setitem__("candidate_count", 4),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(
        "KONTUR Game Companion focus diversity: "
        f"PASS ({len(mutations)} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
