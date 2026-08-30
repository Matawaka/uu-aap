#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("openai_provenance_adapter", HERE / "adapter.py")
mod = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(mod)


def load(name: str):
    path = HERE / "fixtures" / name
    raw = path.read_bytes()
    return json.loads(raw), raw


def expect_rejected(name: str, candidate):
    try:
        mod.validate_receipt(candidate)
    except mod.AdapterError:
        print(f"expected rejection: {name}")
    else:
        raise AssertionError(f"unsafe mutation accepted: {name}")


def main():
    both, both_raw = load("both-detected.json")
    r = mod.build_receipt(both, both_raw)
    assert r["classification"] == "MULTIPLE_OPENAI_SIGNAL_CHANNELS_DETECTED"
    assert r["assertions"]["plural_signal_channels"] is True
    assert r["assertions"]["plural_detected_signal_channels"] is True
    assert r["assertions"]["independent_corroboration_established"] is False
    assert r["non_effects"]["human_authorship_established"] is False
    assert r["non_effects"]["intent_established"] is False
    assert r["non_effects"]["authority_established"] is False
    assert r["non_effects"]["responsibility_established"] is False
    assert r["non_effects"]["truth_certified"] is False
    assert r["non_effects"]["decision_time_availability_established"] is False

    c2pa_only, c2pa_only_raw = load("c2pa-only.json")
    r2 = mod.build_receipt(c2pa_only, c2pa_only_raw)
    assert r2["classification"] == "OPENAI_C2PA_SIGNAL_DETECTED"
    assert r2["assertions"]["c2pa_openai_generation_signal_detected"] is True
    assert r2["assertions"]["synthid_supported_watermark_detected"] is False
    assert r2["assertions"]["mixed_signal_state"] is True
    assert r2["assertions"]["no_supported_signal_detected"] is False

    none, none_raw = load("no-signals.json")
    r3 = mod.build_receipt(none, none_raw)
    assert r3["classification"] == "NO_SUPPORTED_OPENAI_SIGNAL_DETECTED"
    assert r3["assertions"]["no_supported_signal_detected"] is True
    assert r3["assertions"]["openai_supported_signal_detected"] is False
    assert "human_created" not in json.dumps(r3)

    invalid, invalid_raw = load("invalid-c2pa.json")
    r4 = mod.build_receipt(invalid, invalid_raw)
    assert r4["classification"] == "NO_SUPPORTED_OPENAI_SIGNAL_DETECTED"
    c2pa = next(x for x in r4["signals"] if x["type"] == "c2pa")
    assert c2pa["validation_state"] == "invalid"
    assert c2pa["admissible_provenance_evidence"] is False
    assert r4["assertions"]["c2pa_openai_generation_signal_detected"] is False

    hostile = copy.deepcopy(r)
    hostile["non_effects"]["human_authorship_established"] = True
    expect_rejected("provenance -> human authorship", hostile)

    hostile = copy.deepcopy(r)
    hostile["non_effects"]["intent_established"] = True
    expect_rejected("provenance -> intent", hostile)

    hostile = copy.deepcopy(r)
    hostile["non_effects"]["authority_established"] = True
    expect_rejected("provenance -> authority", hostile)

    hostile = copy.deepcopy(r)
    hostile["non_effects"]["responsibility_established"] = True
    expect_rejected("provenance -> responsibility", hostile)

    hostile = copy.deepcopy(r)
    hostile["non_effects"]["truth_certified"] = True
    expect_rejected("provenance -> truth", hostile)

    hostile = copy.deepcopy(r)
    hostile["non_effects"]["decision_time_availability_established"] = True
    expect_rejected("present provenance -> historical availability", hostile)

    hostile = copy.deepcopy(r)
    hostile["assertions"]["independent_corroboration_established"] = True
    expect_rejected("two provider signals -> independent corroboration", hostile)

    hostile = copy.deepcopy(r)
    hostile["trust_score"] = 0.99
    expect_rejected("aggregate trust score", hostile)

    inconsistent = copy.deepcopy(both)
    inconsistent["results"][0]["validation_state"] = "invalid"
    try:
        mod.build_receipt(inconsistent, json.dumps(inconsistent).encode())
    except mod.AdapterError:
        print("expected rejection: detected C2PA with invalid manifest")
    else:
        raise AssertionError("invalid C2PA was accepted as detected")

    print("PASS: OpenAI Content Provenance reference adapter v0.1")


if __name__ == "__main__":
    main()
