#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

MEMORY_CLASSES = {
    "HYPOTHESIS",
    "CORRECTION",
    "CONFIRMED_LOCAL_FACT",
    "OPEN_MYSTERY",
    "SHARED_LABEL",
    "SPOILER_EXPOSURE",
    "LOCAL_EXPERTISE_SIGNAL",
}
RETENTION_CLASSES = {"TURN", "SESSION", "LOCAL_THREAD", "UNTIL_RESOLVED"}
SOURCE_ACTORS = {"COMPANION", "PLAYER", "MIXED"}


def validate(data):
    assert data["schema_version"] == "0.1"
    assert data["pilot_id"] == "kontur-game-companion-shared-discovery-memory"
    assert data["origin_frontier"] == "3fc4b66d6eebe90321baea3c92dbad80f3b0afc0"

    shared = data["shared"]
    assert shared["repository"] == "Matawaka/uu-aap"
    assert shared["source_issue"] == 445
    assert shared["predecessor_prs"] == [446, 452]
    assert shared["mode"] == "SYNTHETIC_BOUNDED_CONVERSATIONAL_MEMORY"
    assert shared["live_memory_ingestion_authorized"] is False
    assert shared["cross_game_profile_authorized"] is False
    assert shared["psychological_inference_authorized"] is False
    assert shared["engagement_maximization_authorized"] is False
    assert shared["total_history_required"] is False
    assert shared["stable_core_change_implied"] is False
    assert shared["action_permit_created"] is False

    cases = {case["case_id"]: case for case in data["cases"]}
    assert set(cases) == {
        "disproved-companion-hypothesis",
        "player-correction-local-only",
        "local-expertise-bounded",
        "conflict-remains-contested",
        "shared-label-local-only",
        "spoiler-exposure-no-deeper-authority",
        "open-mystery-persists",
        "cross-game-reuse-blocked",
        "expired-memory-not-erased",
    }

    for case in cases.values():
        assert case["memory_class"] in MEMORY_CLASSES
        assert case["retention_class"] in RETENTION_CLASSES
        assert case["source_actor"] in SOURCE_ACTORS
        assert isinstance(case["scope_id"], str) and case["scope_id"]
        assert isinstance(case["allowed"], bool)

        if case.get("cross_scope_reuse_allowed") is True:
            raise AssertionError("cross-scope reuse is not authorized in v0.1")

        if case.get("psychological_trait_inferred") is True:
            raise AssertionError("psychological inference is forbidden")

        if case.get("global_truth_created") is True:
            raise AssertionError("local memory cannot create global truth")

        if case.get("expired") is True:
            assert case.get("active_reuse_allowed") is False
            assert case.get("historical_record_preserved") is True
            assert case.get("historical_event_denied") is False

        if case["memory_class"] == "SPOILER_EXPOSURE":
            assert 0 <= case["already_revealed_spoiler_level"] <= 3
            assert 0 <= case["new_spoiler_authority_level"] <= 3
            assert case["new_spoiler_authority_level"] <= case["already_revealed_spoiler_level"]
            assert case["deeper_spoiler_authorized"] is False

    disproved = cases["disproved-companion-hypothesis"]
    assert disproved["memory_class"] == "HYPOTHESIS"
    assert disproved["source_actor"] == "COMPANION"
    assert disproved["claim_state_before"] == "ACTIVE_HYPOTHESIS"
    assert disproved["claim_state_after"] == "DISPROVED"
    assert disproved["correction_observed"] is True
    assert disproved["model_revision_required"] is True
    assert disproved["historical_record_preserved"] is True
    assert disproved["active_reuse_allowed"] is False
    assert disproved["global_truth_created"] is False
    assert disproved["allowed"] is True

    correction = cases["player-correction-local-only"]
    assert correction["memory_class"] == "CORRECTION"
    assert correction["source_actor"] == "PLAYER"
    assert correction["target_hypothesis_id"]
    assert correction["correction_state"] == "SUPPORTED_LOCALLY"
    assert correction["model_revision_required"] is True
    assert correction["global_truth_created"] is False
    assert correction["cross_scope_reuse_allowed"] is False
    assert correction["allowed"] is True

    expertise = cases["local-expertise-bounded"]
    assert expertise["memory_class"] == "LOCAL_EXPERTISE_SIGNAL"
    assert expertise["expertise_scope"] == expertise["scope_id"]
    assert expertise["universal_expertise_inferred"] is False
    assert expertise["psychological_trait_inferred"] is False
    assert expertise["cross_scope_reuse_allowed"] is False
    assert expertise["allowed"] is True

    conflict = cases["conflict-remains-contested"]
    assert conflict["memory_class"] == "OPEN_MYSTERY"
    assert conflict["conflicting_evidence"] is True
    assert conflict["resolution_state"] == "CONTESTED"
    assert conflict["winner_selected"] is False
    assert conflict["global_truth_created"] is False
    assert conflict["allowed"] is True

    label = cases["shared-label-local-only"]
    assert label["memory_class"] == "SHARED_LABEL"
    assert label["label"]
    assert label["manipulative_familiarity_authorized"] is False
    assert label["psychological_trait_inferred"] is False
    assert label["engagement_pressure_authorized"] is False
    assert label["cross_scope_reuse_allowed"] is False
    assert label["allowed"] is True

    spoiler = cases["spoiler-exposure-no-deeper-authority"]
    assert spoiler["memory_class"] == "SPOILER_EXPOSURE"
    assert spoiler["already_revealed_spoiler_level"] == 2
    assert spoiler["new_spoiler_authority_level"] == 2
    assert spoiler["deeper_spoiler_authorized"] is False
    assert spoiler["cross_scope_reuse_allowed"] is False
    assert spoiler["allowed"] is True

    mystery = cases["open-mystery-persists"]
    assert mystery["memory_class"] == "OPEN_MYSTERY"
    assert mystery["retention_class"] == "UNTIL_RESOLVED"
    assert mystery["resolution_state"] == "OPEN"
    assert mystery["resolved"] is False
    assert mystery["active_reuse_allowed"] is True
    assert mystery["allowed"] is True

    blocked = cases["cross-game-reuse-blocked"]
    assert blocked["scope_id"] != blocked["requested_reuse_scope_id"]
    assert blocked["cross_scope_reuse_allowed"] is False
    assert blocked["active_reuse_allowed"] is False
    assert blocked["allowed"] is False

    expired = cases["expired-memory-not-erased"]
    assert expired["expired"] is True
    assert expired["active_reuse_allowed"] is False
    assert expired["historical_record_preserved"] is True
    assert expired["historical_event_denied"] is False
    assert expired["allowed"] is True


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
    base = json.loads((ROOT / "shared-memory-cases.json").read_text(encoding="utf-8"))
    validate(base)

    mutations = [
        lambda d: d["shared"].__setitem__("live_memory_ingestion_authorized", True),
        lambda d: d["shared"].__setitem__("cross_game_profile_authorized", True),
        lambda d: d["shared"].__setitem__("psychological_inference_authorized", True),
        lambda d: d["shared"].__setitem__("engagement_maximization_authorized", True),
        lambda d: d["shared"].__setitem__("total_history_required", True),
        lambda d: d["shared"].__setitem__("stable_core_change_implied", True),
        lambda d: d["shared"].__setitem__("action_permit_created", True),
        lambda d: by_id(d, "disproved-companion-hypothesis").__setitem__("active_reuse_allowed", True),
        lambda d: by_id(d, "disproved-companion-hypothesis").__setitem__("historical_record_preserved", False),
        lambda d: by_id(d, "player-correction-local-only").__setitem__("global_truth_created", True),
        lambda d: by_id(d, "player-correction-local-only").__setitem__("cross_scope_reuse_allowed", True),
        lambda d: by_id(d, "local-expertise-bounded").__setitem__("universal_expertise_inferred", True),
        lambda d: by_id(d, "local-expertise-bounded").__setitem__("psychological_trait_inferred", True),
        lambda d: by_id(d, "conflict-remains-contested").__setitem__("winner_selected", True),
        lambda d: by_id(d, "conflict-remains-contested").__setitem__("global_truth_created", True),
        lambda d: by_id(d, "shared-label-local-only").__setitem__("manipulative_familiarity_authorized", True),
        lambda d: by_id(d, "shared-label-local-only").__setitem__("engagement_pressure_authorized", True),
        lambda d: by_id(d, "spoiler-exposure-no-deeper-authority").__setitem__("deeper_spoiler_authorized", True),
        lambda d: by_id(d, "spoiler-exposure-no-deeper-authority").__setitem__("new_spoiler_authority_level", 3),
        lambda d: by_id(d, "open-mystery-persists").__setitem__("resolved", True),
        lambda d: by_id(d, "cross-game-reuse-blocked").__setitem__("allowed", True),
        lambda d: by_id(d, "cross-game-reuse-blocked").__setitem__("cross_scope_reuse_allowed", True),
        lambda d: by_id(d, "expired-memory-not-erased").__setitem__("active_reuse_allowed", True),
        lambda d: by_id(d, "expired-memory-not-erased").__setitem__("historical_event_denied", True),
    ]

    for mutation in mutations:
        expect_fail(base, mutation)

    print(
        "KONTUR Game Companion shared discovery memory: "
        f"PASS ({len(mutations)} fail-closed mutations rejected)"
    )


if __name__ == "__main__":
    main()
