#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SURFACES = [f"https://github.com/Matawaka/uu-aap/issues/{i}" for i in range(1, 8)]


def load(name):
    with (ROOT / name).open(encoding="utf-8") as f:
        return json.load(f)


def validate(x):
    assert set(x) == {"schema_version","pilot_id","status","review_surfaces_checked","eligible_external_input_present","source","identity_inference","authority_status","standing_status","effects"}
    assert x["schema_version"] == "0.1"
    assert x["pilot_id"] == "core-pilot-002"
    assert x["review_surfaces_checked"] == SURFACES
    assert x["identity_inference"] == "none"
    assert x["authority_status"] == "unknown"
    assert x["standing_status"] == "unknown"
    assert set(x["effects"]) == {"issue_mutation","normative_change","kontur_mutation","release_or_tag","sanction","liability_assignment"}
    assert all(v is False for v in x["effects"].values())
    if x["eligible_external_input_present"] is False:
        assert x["status"] == "waiting_for_external_input"
        assert x["source"] is None
    else:
        assert x["eligible_external_input_present"] is True
        assert x["status"] == "admissible"
        assert isinstance(x["source"], dict)
        assert set(x["source"]) == {"url","source_id","author_account_identifier","text_sha256","observed_at"}
        assert x["source"]["author_account_identifier"] != "Matawaka"
        assert len(x["source"]["text_sha256"]) == 64


def must_fail(base, mutate):
    x = copy.deepcopy(base)
    mutate(x)
    try:
        validate(x)
    except (AssertionError, KeyError, TypeError):
        return
    raise AssertionError("negative mutation unexpectedly passed")


def main():
    x = load("waiting.fixture.json")
    validate(x)
    mutations = [
        lambda y: y.update(status="admissible"),
        lambda y: y.update(eligible_external_input_present=True),
        lambda y: y.update(source={}),
        lambda y: y.update(identity_inference="verified_human"),
        lambda y: y.update(authority_status="verified"),
        lambda y: y.update(standing_status="verified"),
        lambda y: y["effects"].update(issue_mutation=True),
        lambda y: y["effects"].update(normative_change=True),
        lambda y: y["effects"].update(kontur_mutation=True),
        lambda y: y["effects"].update(release_or_tag=True),
        lambda y: y["effects"].update(sanction=True),
        lambda y: y["effects"].update(liability_assignment=True),
        lambda y: y["review_surfaces_checked"].pop(),
        lambda y: y.update(extra="silent_extension")
    ]
    for m in mutations:
        must_fail(x, m)
    print(f"Core Pilot 002 run admission validation: PASS ({len(mutations)} fail-closed mutations)")


if __name__ == "__main__":
    main()
