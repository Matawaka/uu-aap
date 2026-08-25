#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

DEPTHS = [
    "COMMENT",
    "NOTICE",
    "QUESTION",
    "THEORY",
    "NUDGE",
    "HINT",
    "PARTIAL_SOLUTION",
    "SOLUTION",
]
DEPTH_INDEX = {name: idx for idx, name in enumerate(DEPTHS)}
INTENTS = {
    "CONVERSATION",
    "HINT_REQUEST",
    "PARTIAL_SOLUTION_REQUEST",
    "SOLUTION_REQUEST",
}
EPISTEMIC = {"KNOWN", "LIKELY", "GUESS", "PLAYFUL_THEORY"}
REVERSIBILITY = {"REVERSIBLE", "COSTLY_BUT_RECOVERABLE", "IRREVERSIBLE"}


def validate(data):
    assert data["schema_version"] == "0.1"
    assert data["pilot_id"] == "kontur-game-companion-assistance-gate"
    assert data["origin_frontier"] == "6465e6bc680346a1b49b4e71a079e79ff09ad5ab"

    shared = data["shared"]
    assert shared["repository"] == "Matawaka/uu-aap"
    assert shared["source_issue"] == 445
    assert shared["predecessor_pr"] == 446
    assert shared["mode"] == "SYNTHETIC_ASSISTANCE_ESCALATION_GATE"
    assert shared["external_game_control_authorized"] is False
    assert shared["behavioral_profile_authorized"] is False
    assert shared["psychological_inference_authorized"] is False
    assert shared["engagement_maximization_authorized"] is False
    assert shared["stable_core_change_implied"] is False
    assert shared["action_permit_created"] is False

    cases = {case["case_id"]: case for case in data["cases"]}
    assert set(cases) == {
        "conversation-stays-exploratory",
        "explicit-hint-request",
        "known-reversible-solution-request",
        "unsolicited-solution-blocked",
        "irreversible-uncertain-solution-blocked",
        "already-revealed-reference",
        "routine-help-deep-request-shallower-choice",
    }

    for case in cases.values():
        assert case["intent_class"] in INTENTS
        assert case["epistemic_mode"] in EPISTEMIC
        assert case["reversibility_class"] in REVERSIBILITY
        assert case["requested_response_depth"] in DEPTH_INDEX
        assert case["max_permitted_depth"] in DEPTH_INDEX
        assert case["chosen_response_depth"] in DEPTH_INDEX
        assert isinstance(case["spoiler_budget"], int)
        assert isinstance(case["already_revealed_spoiler_level"], int)
        assert isinstance(case["new_spoiler_level"], int)
        assert 0 <= case["spoiler_budget"] <= 3
        assert 0 <= case["already_revealed_spoiler_level"] <= 3
        assert 0 <= case["new_spoiler_level"] <= 3
        assert isinstance(case["dependency_risk_signal"], bool)
        assert isinstance(case["player_agency_preserved"], bool)
        assert isinstance(case["allowed"], bool)

        chosen_too_deep = DEPTH_INDEX[case["chosen_response_depth"]] > DEPTH_INDEX[case["max_permitted_depth"]]
        if chosen_too_deep:
            assert case["allowed"] is False

        references_old = case.get("references_only_already_revealed_information") is True
        new_disclosure_increase = case["new_spoiler_level"] > case["already_revealed_spoiler_level"]
        if new_disclosure_increase and case["new_spoiler_level"] > case["spoiler_budget"]:
            assert case["allowed"] is False
        if references_old:
            assert case["new_spoiler_level"] <= case["already_revealed_spoiler_level"]

        if case["intent_class"] == "CONVERSATION" and case["chosen_response_depth"] in {"PARTIAL_SOLUTION", "SOLUTION"}:
            assert case["allowed"] is False

        if (
            case["reversibility_class"] == "IRREVERSIBLE"
            and case.get("irreversible_loss_risk") is True
            and case["epistemic_mode"] in {"GUESS", "PLAYFUL_THEORY"}
            and case["chosen_response_depth"] in {"HINT", "PARTIAL_SOLUTION", "SOLUTION"}
        ):
            assert case["allowed"] is False
            assert DEPTH_INDEX[case["max_permitted_depth"]] <= DEPTH_INDEX["NUDGE"]

        if case["dependency_risk_signal"] is True and case["allowed"] is True:
            assert case.get("help_refused") is False
            assert case.get("durable_player_profile_created") is False
            assert case["player_agency_preserved"] is True

    conversation = cases["conversation-stays-exploratory"]
    assert conversation["intent_class"] == "CONVERSATION"
    assert conversation["chosen_response_depth"] == "THEORY"
    assert conversation["max_permitted_depth"] == "THEORY"
    assert conversation["allowed"] is True

    hint = cases["explicit-hint-request"]
    assert hint["intent_class"] == "HINT_REQUEST"
    assert hint["chosen_response_depth"] == "HINT"
    assert hint["new_spoiler_level"] == 1
    assert hint["allowed"] is True

    direct = cases["known-reversible-solution-request"]
    assert direct["intent_class"] == "SOLUTION_REQUEST"
    assert direct["epistemic_mode"] == "KNOWN"
    assert direct["reversibility_class"] == "REVERSIBLE"
    assert direct["chosen_response_depth"] == "SOLUTION"
    assert direct["allowed"] is True

    unsolicited = cases["unsolicited-solution-blocked"]
    assert unsolicited["intent_class"] == "CONVERSATION"
    assert unsolicited["chosen_response_depth"] == "SOLUTION"
    assert unsolicited["allowed"] is False

    irreversible = cases["irreversible-uncertain-solution-blocked"]
    assert irreversible["intent_class"] == "SOLUTION_REQUEST"
    assert irreversible["epistemic_mode"] == "GUESS"
    assert irreversible["reversibility_class"] == "IRREVERSIBLE"
    assert irreversible["irreversible_loss_risk"] is True
    assert irreversible["chosen_response_depth"] == "SOLUTION"
    assert irreversible["allowed"] is False

    revealed = cases["already-revealed-reference"]
    assert revealed["spoiler_budget"] == 0
    assert revealed["already_revealed_spoiler_level"] == 2
    assert revealed["new_spoiler_level"] == 2
    assert revealed["references_only_already_revealed_information"] is True
    assert revealed["allowed"] is True

    dependency = cases["routine-help-deep-request-shallower-choice"]
    assert dependency["dependency_risk_signal"] is True
    assert dependency["intent_class"] == "SOLUTION_REQUEST"
    assert dependency["max_permitted_depth"] == "SOLUTION"
    assert DEPTH_INDEX[dependency["chosen_response_depth"]] < DEPTH_INDEX[dependency["max_permitted_depth"]]
    assert dependency["help_refused"] is False
    assert dependency["durable_player_profile_created"] is False
    assert dependency["allowed"] is True


def expect_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def by_id(data, case_id):
    return next(case for case in data["cases"] if case["case_id"] == case_id)


def main():
    base = json.loads((ROOT / "assistance-gate-cases.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["shared"].__setitem__("external_game_control_authorized", True),
        lambda d: d["shared"].__setitem__("behavioral_profile_authorized", True),
        lambda d: d["shared"].__setitem__("psychological_inference_authorized", True),
        lambda d: d["shared"].__setitem__("engagement_maximization_authorized", True),
        lambda d: d["shared"].__setitem__("stable_core_change_implied", True),
        lambda d: d["shared"].__setitem__("action_permit_created", True),
        lambda d: by_id(d, "conversation-stays-exploratory").__setitem__("chosen_response_depth", "SOLUTION"),
        lambda d: by_id(d, "explicit-hint-request").__setitem__("chosen_response_depth", "SOLUTION"),
        lambda d: by_id(d, "explicit-hint-request").__setitem__("new_spoiler_level", 3),
        lambda d: by_id(d, "known-reversible-solution-request").__setitem__("epistemic_mode", "GUESS"),
        lambda d: by_id(d, "known-reversible-solution-request").__setitem__("reversibility_class", "IRREVERSIBLE"),
        lambda d: by_id(d, "unsolicited-solution-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "irreversible-uncertain-solution-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "irreversible-uncertain-solution-blocked").__setitem__("max_permitted_depth", "SOLUTION"),
        lambda d: by_id(d, "already-revealed-reference").__setitem__("new_spoiler_level", 3),
        lambda d: by_id(d, "routine-help-deep-request-shallower-choice").__setitem__("help_refused", True),
        lambda d: by_id(d, "routine-help-deep-request-shallower-choice").__setitem__("durable_player_profile_created", True),
        lambda d: by_id(d, "routine-help-deep-request-shallower-choice").__setitem__("player_agency_preserved", False),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(
        "KONTUR Game Companion assistance gate: "
        f"PASS ({len(mutations)} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
