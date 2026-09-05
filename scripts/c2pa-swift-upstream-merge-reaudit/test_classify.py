#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("swift_targeted_reaudit", HERE / "classify.py")
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def base_observation():
    return {
        "schema": "urn:uu-aap:c2pa-swift-current-main-execution-observation:0.3",
        "upstream_main_sha": mod.EXPECTED_SWIFT_MAIN,
        "upstream_pr_161_merged": True,
        "public_binary_release": "v0.0.12",
        "android_main_sha": mod.EXPECTED_ANDROID_MAIN,
        "source_contract": {
            "claim_generator_additional_fields_present": True,
            "reader_crjson_present": True,
        },
        "build": {
            "exit_code": 1,
            "source_binary_skew_marker": True,
            "roundtrip_executed": False,
            "roundtrip_exit_code": None,
            "roundtrip_receipt_valid": False,
        },
    }


def must_fail(mutator):
    item = copy.deepcopy(base_observation())
    mutator(item)
    try:
        mod.classify(item)
    except ValueError:
        return
    raise AssertionError("hostile mutation unexpectedly accepted")


def run():
    blocked = mod.classify(base_observation())
    assert blocked["source_contract"]["classification"] == "CURRENT_MAIN_SOURCE_PASS"
    assert blocked["external_swiftpm_consumer"]["classification"] == "BLOCKED_SOURCE_BINARY_SKEW"
    assert blocked["current_swift_lossless_preservation_established"] is False
    assert blocked["android"]["classification"] == "UNCHANGED_NO_RETEST_REQUIRED"
    assert blocked["cross_sdk_p0_3_complete"] is False

    passing = base_observation()
    passing["build"] = {
        "exit_code": 0,
        "source_binary_skew_marker": False,
        "roundtrip_executed": True,
        "roundtrip_exit_code": 0,
        "roundtrip_receipt_valid": True,
    }
    passed = mod.classify(passing)
    assert passed["external_swiftpm_consumer"]["classification"] == "ROUNDTRIP_PASS"
    assert passed["current_swift_lossless_preservation_established"] is True
    assert passed["current_cross_sdk_compatibility_established"] is False

    other = base_observation()
    other["build"]["source_binary_skew_marker"] = False
    assert mod.classify(other)["external_swiftpm_consumer"]["classification"] == "BUILD_FAILED_OTHER"

    roundtrip_failed = copy.deepcopy(passing)
    roundtrip_failed["build"]["roundtrip_exit_code"] = 1
    assert mod.classify(roundtrip_failed)["external_swiftpm_consumer"]["classification"] == "ROUNDTRIP_FAILED"

    must_fail(lambda x: x.__setitem__("schema", "wrong"))
    must_fail(lambda x: x.__setitem__("upstream_main_sha", "0" * 40))
    must_fail(lambda x: x.__setitem__("upstream_pr_161_merged", False))
    must_fail(lambda x: x.__setitem__("android_main_sha", "1" * 40))
    must_fail(lambda x: x["source_contract"].__setitem__("claim_generator_additional_fields_present", False))
    must_fail(lambda x: x["source_contract"].__setitem__("reader_crjson_present", False))
    must_fail(lambda x: x["build"].__setitem__("roundtrip_executed", True))

    bad_success = copy.deepcopy(passing)
    bad_success["build"]["source_binary_skew_marker"] = True
    try:
        mod.classify(bad_success)
    except ValueError:
        pass
    else:
        raise AssertionError("successful build with skew marker accepted")

    for state in (blocked, passed):
        assert all(value is False for value in state["non_effects"].values())
        assert all(value is False for value in state["historical_evidence"].values())
        forbidden = {"score", "trust_score", "compatibility_score", "probability", "rating"}
        assert not forbidden.intersection(state.keys())

    print("C2PA Swift targeted re-audit classifier tests: SUCCESS")


if __name__ == "__main__":
    run()
