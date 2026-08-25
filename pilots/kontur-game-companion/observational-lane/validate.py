#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

ALLOWED_DEPTHS = {
    "COMMENT",
    "NOTICE",
    "QUESTION",
    "THEORY",
    "NUDGE",
    "HINT",
    "PARTIAL_SOLUTION",
    "SOLUTION",
}
ALLOWED_EPISTEMIC = {"KNOWN", "LIKELY", "GUESS", "PLAYFUL_THEORY"}
ALLOWED_REVERSIBILITY = {"REVERSIBLE", "COSTLY_BUT_RECOVERABLE", "IRREVERSIBLE"}


def validate(data):
    assert data["schema_version"] == "0.1"
    assert data["pilot_id"] == "kontur-game-companion-observational-lane"
    assert data["origin_frontier"] == "06cd94208f43f3fe44956eee532d39f4a378f953"

    shared = data["shared"]
    assert shared["repository"] == "Matawaka/uu-aap"
    assert shared["source_issue"] == 445
    assert shared["mode"] == "CAUTIOUS_PARALLEL_OBSERVATION"
    assert shared["mainline_authority_created"] is False
    assert shared["external_game_control_authorized"] is False
    assert shared["behavioral_profile_authorized"] is False
    assert shared["total_history_required"] is False
    assert shared["engagement_maximization_authorized"] is False
    assert shared["stable_core_change_implied"] is False

    cases = {case["case_id"]: case for case in data["cases"]}
    assert set(cases) == {
        "reversible-playful-guess",
        "player-corrects-guess",
        "known-answer-withheld-without-request",
        "irreversible-guess-blocked",
    }

    for case in cases.values():
        assert case["assistance_depth"] in ALLOWED_DEPTHS
        assert case["epistemic_mode"] in ALLOWED_EPISTEMIC
        assert case["reversibility_class"] in ALLOWED_REVERSIBILITY
        assert isinstance(case["spoiler_level"], int)
        assert 0 <= case["spoiler_level"] <= 3
        assert isinstance(case["player_solution_request"], bool)
        assert isinstance(case["player_agency_preserved"], bool)
        assert isinstance(case["allowed"], bool)

    playful = cases["reversible-playful-guess"]
    assert playful["assistance_depth"] == "THEORY"
    assert playful["epistemic_mode"] == "PLAYFUL_THEORY"
    assert playful["reversibility_class"] == "REVERSIBLE"
    assert playful["player_solution_request"] is False
    assert playful["direct_solution_revealed"] is False
    assert playful["irreversible_loss_risk"] is False
    assert playful["allowed"] is True

    corrected = cases["player-corrects-guess"]
    assert corrected["epistemic_mode"] == "GUESS"
    assert corrected["correction_observed"] is True
    assert corrected["model_revision_required"] is True
    assert corrected["old_claim_retained_as_fact"] is False
    assert corrected["allowed"] is True

    withheld = cases["known-answer-withheld-without-request"]
    assert withheld["epistemic_mode"] == "KNOWN"
    assert withheld["player_solution_request"] is False
    assert withheld["assistance_depth"] == "HINT"
    assert withheld["direct_solution_revealed"] is False
    assert withheld["spoiler_level"] <= 1
    assert withheld["allowed"] is True

    blocked = cases["irreversible-guess-blocked"]
    assert blocked["epistemic_mode"] == "GUESS"
    assert blocked["reversibility_class"] == "IRREVERSIBLE"
    assert blocked["irreversible_loss_risk"] is True
    assert blocked["assistance_depth"] == "SOLUTION"
    assert blocked["direct_solution_revealed"] is True
    assert blocked["allowed"] is False

    for case in cases.values():
        if (
            case["reversibility_class"] == "IRREVERSIBLE"
            and case.get("irreversible_loss_risk") is True
            and case["epistemic_mode"] in {"GUESS", "PLAYFUL_THEORY"}
            and case["assistance_depth"] in {"HINT", "PARTIAL_SOLUTION", "SOLUTION"}
        ):
            assert case["allowed"] is False

        if case.get("correction_observed") is True:
            assert case.get("model_revision_required") is True
            assert case.get("old_claim_retained_as_fact") is False

        if case["player_solution_request"] is False and case.get("direct_solution_revealed") is True:
            assert case["allowed"] is False


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
    base = json.loads((ROOT / "observation-cases.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["shared"].__setitem__("mainline_authority_created", True),
        lambda d: d["shared"].__setitem__("external_game_control_authorized", True),
        lambda d: d["shared"].__setitem__("behavioral_profile_authorized", True),
        lambda d: d["shared"].__setitem__("total_history_required", True),
        lambda d: d["shared"].__setitem__("engagement_maximization_authorized", True),
        lambda d: d["shared"].__setitem__("stable_core_change_implied", True),
        lambda d: by_id(d, "reversible-playful-guess").__setitem__("epistemic_mode", "KNOWN"),
        lambda d: by_id(d, "reversible-playful-guess").__setitem__("direct_solution_revealed", True),
        lambda d: by_id(d, "player-corrects-guess").__setitem__("model_revision_required", False),
        lambda d: by_id(d, "player-corrects-guess").__setitem__("old_claim_retained_as_fact", True),
        lambda d: by_id(d, "known-answer-withheld-without-request").__setitem__("assistance_depth", "SOLUTION"),
        lambda d: by_id(d, "known-answer-withheld-without-request").__setitem__("direct_solution_revealed", True),
        lambda d: by_id(d, "known-answer-withheld-without-request").__setitem__("spoiler_level", 3),
        lambda d: by_id(d, "irreversible-guess-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "irreversible-guess-blocked").__setitem__("epistemic_mode", "KNOWN"),
        lambda d: by_id(d, "irreversible-guess-blocked").__setitem__("reversibility_class", "REVERSIBLE"),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(
        "KONTUR Game Companion observational lane: "
        f"PASS ({len(mutations)} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
