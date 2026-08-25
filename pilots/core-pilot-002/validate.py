#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ALLOWED_TOP = {"schema_version","pilot_id","case_id","source","intake","interpretation","authority","disposition","non_effects"}


def load(name):
    with (ROOT / name).open(encoding="utf-8") as f:
        return json.load(f)


def validate(case):
    assert set(case) == ALLOWED_TOP
    assert case["schema_version"] == "0.1"
    assert case["pilot_id"] == "core-pilot-002"
    assert len(case["source"]["text_sha256"]) == 64
    assert case["intake"]["purpose"] == "public_review_contestability"
    assert case["intake"]["identity_resolution_performed"] is False
    assert case["intake"]["cross_context_correlation_performed"] is False
    assert case["interpretation"]["accepted_as_truth"] is False
    assert case["interpretation"]["motive_inferred"] is False
    assert case["interpretation"]["liability_inferred"] is False
    assert case["authority"]["project_disposition_scope"] == "analyze_and_recommend_only"
    assert case["authority"]["normative_change_authorized"] is False
    assert case["disposition"]["rationale_present"] is True
    assert case["disposition"]["human_gate_required_for_external_mutation"] is True
    assert case["disposition"]["objection_preserved"] is True
    for value in case["non_effects"].values():
        assert value is False


def must_fail(base, mutate):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (AssertionError, KeyError, TypeError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    case = load("review-case.fixture.json")
    validate(case)

    mutations = [
        lambda x: x.update({"extra": True}),
        lambda x: x["intake"].__setitem__("identity_resolution_performed", True),
        lambda x: x["intake"].__setitem__("cross_context_correlation_performed", True),
        lambda x: x["interpretation"].__setitem__("accepted_as_truth", True),
        lambda x: x["interpretation"].__setitem__("motive_inferred", True),
        lambda x: x["interpretation"].__setitem__("liability_inferred", True),
        lambda x: x["authority"].__setitem__("normative_change_authorized", True),
        lambda x: x["authority"].__setitem__("project_disposition_scope", "edit_protocol"),
        lambda x: x["disposition"].__setitem__("human_gate_required_for_external_mutation", False),
        lambda x: x["disposition"].__setitem__("objection_preserved", False),
        lambda x: x["disposition"].__setitem__("rationale_present", False),
        lambda x: x["non_effects"].__setitem__("issue_mutated", True),
        lambda x: x["non_effects"].__setitem__("normative_text_changed", True),
        lambda x: x["non_effects"].__setitem__("reviewer_contacted", True),
        lambda x: x["non_effects"].__setitem__("identity_profile_built", True),
        lambda x: x["non_effects"].__setitem__("kontur_mutated", True),
        lambda x: x["non_effects"].__setitem__("release_or_tag_created", True),
        lambda x: x["non_effects"].__setitem__("liability_assigned", True),
    ]
    for mutation in mutations:
        must_fail(case, mutation)

    print(f"Core Pilot 002 validation: PASS ({len(mutations)} negative mutations)")


if __name__ == "__main__":
    main()
