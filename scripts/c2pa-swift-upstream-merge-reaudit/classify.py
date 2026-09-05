#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any

EXPECTED_SWIFT_MAIN = "6fa8a78c16abac3b3f7eb4832c2cc943c9c19f0f"
EXPECTED_ANDROID_MAIN = "077035cda5bf6849abf270829b98af789cc31e4f"
ALLOWED_STATES = {
    "ROUNDTRIP_PASS",
    "BLOCKED_SOURCE_BINARY_SKEW",
    "BUILD_FAILED_OTHER",
    "ROUNDTRIP_FAILED",
}


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def fail(message: str) -> None:
    raise ValueError(message)


def classify(observation: dict[str, Any]) -> dict[str, Any]:
    if observation.get("schema") != "urn:uu-aap:c2pa-swift-current-main-execution-observation:0.3":
        fail("unexpected observation schema")
    if observation.get("upstream_main_sha") != EXPECTED_SWIFT_MAIN:
        fail("Swift main SHA drift")
    if observation.get("upstream_pr_161_merged") is not True:
        fail("upstream PR #161 must be observed merged at this successor frontier")
    if observation.get("android_main_sha") != EXPECTED_ANDROID_MAIN:
        fail("Android frontier changed; targeted Swift-only audit no longer sufficient")

    source = observation.get("source_contract")
    if not isinstance(source, dict):
        fail("source_contract missing")
    if source.get("claim_generator_additional_fields_present") is not True:
        fail("current-main unknown-field preservation source contract absent")
    if source.get("reader_crjson_present") is not True:
        fail("current-main Reader.crJSON source contract absent")

    build = observation.get("build")
    if not isinstance(build, dict):
        fail("build observation missing")
    rc = build.get("exit_code")
    if not isinstance(rc, int):
        fail("build exit_code must be integer")
    skew = build.get("source_binary_skew_marker")
    if not isinstance(skew, bool):
        fail("source_binary_skew_marker must be boolean")

    if rc != 0:
        state = "BLOCKED_SOURCE_BINARY_SKEW" if skew else "BUILD_FAILED_OTHER"
        if build.get("roundtrip_executed") is not False:
            fail("roundtrip cannot execute after failed build")
    else:
        if skew:
            fail("successful build cannot carry source-binary-skew failure marker")
        if build.get("roundtrip_executed") is not True:
            state = "ROUNDTRIP_FAILED"
        else:
            roundtrip_rc = build.get("roundtrip_exit_code")
            receipt_valid = build.get("roundtrip_receipt_valid")
            if roundtrip_rc == 0 and receipt_valid is True:
                state = "ROUNDTRIP_PASS"
            else:
                state = "ROUNDTRIP_FAILED"

    if state not in ALLOWED_STATES:
        fail("invalid state")

    receipt = {
        "schema": "urn:uu-aap:c2pa-swift-targeted-reaudit-receipt:0.3",
        "tracking_issue": 916,
        "upstream": {
            "repository": "contentauth/c2pa-swift",
            "pr_161_merged": True,
            "main_sha": EXPECTED_SWIFT_MAIN,
            "public_binary_release": observation.get("public_binary_release"),
        },
        "source_contract": {
            "classification": "CURRENT_MAIN_SOURCE_PASS",
            "claim_generator_additional_fields_present": True,
            "reader_crjson_present": True,
        },
        "external_swiftpm_consumer": {
            "classification": state,
            "build_exit_code": rc,
            "source_binary_skew_marker": skew,
            "roundtrip_executed": build.get("roundtrip_executed"),
            "roundtrip_exit_code": build.get("roundtrip_exit_code"),
            "roundtrip_receipt_valid": build.get("roundtrip_receipt_valid"),
        },
        "android": {
            "classification": "UNCHANGED_NO_RETEST_REQUIRED",
            "main_sha": EXPECTED_ANDROID_MAIN,
            "retest_performed": False,
        },
        "current_swift_lossless_preservation_established": state == "ROUNDTRIP_PASS",
        "current_cross_sdk_compatibility_established": False,
        "cross_sdk_p0_3_complete": False,
        "historical_evidence": {
            "pr_781_historical_blocked_result_rewritten": False,
            "pr_782_historical_results_rewritten": False,
            "pr_783_contract_rewritten": False,
        },
        "non_effects": {
            "core_modified": False,
            "c2pa_namespace_registered": False,
            "c2pa_conformance_established": False,
            "authorship_established": False,
            "authority_established": False,
            "responsibility_established": False,
            "truth_certified": False,
            "trust_score_created": False,
            "upstream_modified": False,
        },
        "invariants": [
            "source preservation != consumer round-trip",
            "upstream merge != packaging compatibility",
            "packaging compatibility != semantic preservation",
            "semantic preservation != trust or authority",
            "successor result != historical rewrite",
        ],
    }
    receipt["observation_sha256"] = digest(observation)
    receipt["receipt_fingerprint_sha256"] = digest(receipt)
    return receipt


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {argv[0]} observation.json", file=sys.stderr)
        return 2
    try:
        observation = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        receipt = classify(observation)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"C2PA Swift targeted re-audit: FAIL_CLOSED: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
