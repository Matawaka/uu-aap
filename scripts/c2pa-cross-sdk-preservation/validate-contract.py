#!/usr/bin/env python3

import json
import sys
from pathlib import Path

ALLOWED_SURFACE_STATES = {"PASS", "LOSSY", "BLOCKED", "INCOMPATIBLE"}
CONTRACT_STATUS = "INCOMPLETE"
EXTERNAL_FIXTURE_BLOB = "b324c12d86ee82f02ef0fe0b71c9c7d215d40613"


def fail(message: str) -> None:
    raise SystemExit(f"cross-SDK preservation contract invalid: {message}")


def surface(consumer: dict, surface_id: str) -> dict:
    for item in consumer.get("surfaces", []):
        if item.get("id") == surface_id:
            return item
    fail(f"missing surface {surface_id!r} for {consumer.get('sdk')}")


def scan_for_forbidden_scores(value, path="$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if "score" in key.lower() and key != "aggregate_score_permitted":
                fail(f"aggregate/ordinal score-like key is forbidden at {child_path}")
            scan_for_forbidden_scores(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            scan_for_forbidden_scores(child, f"{path}[{index}]")


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: validate-contract.py <contract.json>")

    path = Path(sys.argv[1])
    data = json.loads(path.read_text(encoding="utf-8"))

    if data.get("schema") != "urn:uu-aap:c2pa-cross-sdk-preservation-contract:0.1":
        fail("unexpected schema")
    if data.get("roadmap_issue") != 778:
        fail("roadmap_issue must remain #778")
    if data.get("status") != CONTRACT_STATUS:
        fail("P0.3 synthesis must remain INCOMPLETE at this frontier")
    if data.get("p0_3_complete") is not False:
        fail("p0_3_complete must remain false")
    if data.get("aggregate_score_permitted") is not False:
        fail("aggregate compatibility/trust scores are forbidden")

    scan_for_forbidden_scores(data)

    state_model = data.get("state_model", {})
    if set(state_model) != ALLOWED_SURFACE_STATES:
        fail(f"state_model must contain exactly {sorted(ALLOWED_SURFACE_STATES)}")

    eq = data.get("equivalence_rules", {})
    required_equivalence = {
        "json_byte_identity_required": False,
        "json_object_key_order_semantic": False,
        "json_whitespace_semantic": False,
        "json_values_semantic": True,
        "json_types_semantic": True,
        "json_nesting_semantic": True,
        "json_array_order_semantic": True,
        "json_field_presence_semantic": True,
        "c2pa_binary_or_jumbf_canonicalization_redefined": False,
    }
    for key, expected in required_equivalence.items():
        if eq.get(key) is not expected:
            fail(f"equivalence rule {key} must be {expected}")

    invariants = data.get("invariants", [])
    joined = "\n".join(invariants).lower()
    for phrase in [
        "does not grant trust",
        "must not be silently promoted",
        "decision-time availability",
        "must remain explicit",
        "require explicit reclassification",
    ]:
        if phrase not in joined:
            fail(f"missing semantic boundary invariant containing {phrase!r}")

    fixtures = data.get("shared_fixtures", {})
    ext = fixtures.get("external_reference", {})
    if ext.get("label") != "c2pa.external-reference":
        fail("shared external fixture must use the standard c2pa.external-reference label")
    if ext.get("byte_identical_across_tested_consumers") is not True:
        fail("external fixture must be byte-identical across tested consumers")
    if ext.get("git_blob_sha") != EXTERNAL_FIXTURE_BLOB:
        fail("unexpected shared external-reference Git blob SHA")

    claim = fixtures.get("claim_generator_extension", {})
    if claim.get("extension_key") != "org.example.uu_aap_reference":
        fail("unexpected fixture-only extension key")
    if claim.get("extension_payload_semantically_equal_across_tested_consumers") is not True:
        fail("claim-generator extension payload must be semantically equal across consumers")
    if claim.get("known_platform_field_allowed_to_differ") != "operating_system":
        fail("only the known operating_system fixture field may differ")

    consumers = {entry.get("sdk"): entry for entry in data.get("consumers", [])}
    if set(consumers) != {"contentauth/c2pa-swift", "contentauth/c2pa-android"}:
        fail("contract must contain exactly the two tested official SDK consumers")

    for consumer in consumers.values():
        for item in consumer.get("surfaces", []):
            if item.get("state") not in ALLOWED_SURFACE_STATES:
                fail(f"unsupported state {item.get('state')!r} on {item.get('id')}")

    swift = consumers["contentauth/c2pa-swift"]
    if swift.get("evidence_pr") != 781:
        fail("Swift evidence must remain bound to PR #781")
    if swift.get("evidence_head_sha") != "7258f0896429fe0d0ebe8d9aca4b9a509bfda815":
        fail("unexpected Swift evidence head")
    swift_source = surface(swift, "unknown-field-preservation-source-contract")
    if swift_source.get("state") != "PASS" or swift_source.get("roundtrip_executed") is not False:
        fail("Swift source-contract PASS must not be misrepresented as executable round-trip")
    swift_roundtrip = surface(swift, "external-swiftpm-consumer-roundtrip")
    if swift_roundtrip.get("state") != "BLOCKED":
        fail("Swift external consumer must remain BLOCKED at the pinned frontier")
    if swift_roundtrip.get("roundtrip_executed") is not False:
        fail("Swift round-trip was not executed")
    if swift_roundtrip.get("failure_stage") != "consumer_build":
        fail("Swift blocked failure stage must be consumer_build")
    if swift.get("authority_or_trust_promotion_executably_assessed") is not False:
        fail("do not overclaim an executable Swift governance-promotion guard")

    android = consumers["contentauth/c2pa-android"]
    if android.get("evidence_pr") != 782:
        fail("Android evidence must remain bound to PR #782")
    if android.get("evidence_head_sha") != "adb64fc5a3f31753e68833f4182cd56c9ba3ee94":
        fail("unexpected Android evidence head")
    android_ext = surface(android, "external-reference-generic-roundtrip")
    if android_ext.get("state") != "INCOMPATIBLE":
        fail("Android external-reference generic path must be INCOMPATIBLE")
    if android_ext.get("roundtrip_executed") is not True or android_ext.get("decode_accepted") is not True:
        fail("Android external-reference probe must record executed decode/encode path")
    if android_ext.get("failure_stage") != "encode_rejected":
        fail("Android external-reference failure stage must be encode_rejected")
    if android_ext.get("exception") != "kotlinx.serialization.SerializationException":
        fail("Android external-reference exception class changed")

    android_claim = surface(android, "claim-generator-unknown-nested-extension")
    if android_claim.get("state") != "LOSSY":
        fail("Android unknown nested ClaimGeneratorInfo extension must be LOSSY")
    if android_claim.get("roundtrip_executed") is not True:
        fail("Android lossy finding must remain executable evidence")
    if android_claim.get("decode_accepted") is not True:
        fail("Android unknown claim field must remain tolerated on decode")
    if android_claim.get("unknown_field_preserved") is not False:
        fail("Android unknown claim field is not preserved at this frontier")

    android_guard = surface(android, "governance-promotion-guard-on-tested-claim-path")
    if android_guard.get("state") != "PASS" or android_guard.get("roundtrip_executed") is not True:
        fail("Android governance-promotion guard must remain a narrow executable PASS")
    if android.get("authority_or_trust_promotion_executably_assessed") is not True:
        fail("Android tested claim path did execute the governance-promotion guard")

    print(
        json.dumps(
            {
                "contract": "PASS",
                "p0_3_complete": False,
                "surface_states": {
                    "swift_source_contract": "PASS",
                    "swift_external_roundtrip": "BLOCKED",
                    "android_external_roundtrip": "INCOMPATIBLE",
                    "android_unknown_claim_extension": "LOSSY",
                    "android_governance_promotion_guard": "PASS",
                },
                "aggregate_score": "FORBIDDEN",
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
