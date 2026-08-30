#!/usr/bin/env python3
"""P1.9 candidate-source federation adversarial and cross-runtime tests."""
from __future__ import annotations

import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation import (  # noqa:E402
    DIMENSION_ORDER,
    SOURCE_FAMILIES,
    adapt_evidence,
    bridge_attestations,
    build_federation_input,
    federate_candidate_sources,
    validate_federation_input,
    validate_federation_result,
)

ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
ATTESTATION_FIXTURE = REPO_ROOT / "scripts" / "verifier-scoped-attestations" / "fixture.json"
APP = HERE / "app.js"
BROWSER = HERE / "test-browser.js"
ADAPTER_APP = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "app.js"
ATTESTATION_APP = REPO_ROOT / "scripts" / "verifier-scoped-attestations" / "app.js"
BINDINGS = HERE / "source-bindings.json"
COMMON_ARTIFACT = {
    "id": "urn:uu-aap:artifact:p1.9:reference",
    "description": "Synthetic P1.9 candidate-source federation reference",
}


def source_results() -> tuple[dict, dict]:
    adapter_input = json.loads(ADAPTER_FIXTURE.read_text(encoding="utf-8"))
    attestation_input = json.loads(ATTESTATION_FIXTURE.read_text(encoding="utf-8"))
    adapter_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    attestation_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    return adapt_evidence(adapter_input), bridge_attestations(attestation_input)


def expect_reject(callable_obj, label: str) -> None:
    try:
        callable_obj()
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def browser_result(record: dict) -> dict:
    completed = subprocess.run(
        ["node", str(BROWSER), str(APP), str(ADAPTER_APP), str(ATTESTATION_APP)],
        cwd=REPO_ROOT,
        input=json.dumps(record, ensure_ascii=False),
        text=True,
        check=True,
        capture_output=True,
    )
    return json.loads(completed.stdout)


def main() -> None:
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "c878ee13f0feaeab523260b4510adda30b61595f"
    assert bindings["p1_4"]["implementation_blob"] == "6ed7d20df30c4848425df61ae5f0d0f194453f5e"
    assert bindings["p1_8"]["implementation_blob"] == "9228b595521ffa711103857973f12fb09969ac01"

    adapter_result, attestation_result = source_results()
    record = build_federation_input(adapter_result, attestation_result)
    validate_federation_input(record)
    result = federate_candidate_sources(record)
    validate_federation_result(result)
    assert browser_result(record) == result, "Python/browser federation diverged"

    assert result["dimension_order"] == list(DIMENSION_ORDER)
    assert set(result["candidate_buckets"]) == set(DIMENSION_ORDER)
    assert result["candidate_buckets"]["integrity"] == []
    assert result["candidate_buckets"]["truth"] == []
    assert len(result["candidate_buckets"]["identity"]) == 3
    assert all(item["source_family"] == "P1.8_ATTESTATION" for item in result["candidate_buckets"]["identity"])
    for dimension in ("provenance", "availability", "authority", "responsibility"):
        assert len(result["candidate_buckets"][dimension]) == 1
        assert result["candidate_buckets"][dimension][0]["source_family"] == "P1.4_ADAPTER"
    assert adapter_result["candidate_claims"]["identity"] == []
    assert adapter_result["candidate_claims"]["truth"] == []

    assert result["auxiliary_attestations"]["role_attestations"] == attestation_result["role_attestations"]
    assert result["auxiliary_attestations"]["review_attestations"] == attestation_result["review_attestations"]
    auxiliary_observation_ids = {
        item["observation_id"]
        for family in result["auxiliary_attestations"].values()
        for item in family
    }
    federated_observation_ids = {
        item["source_observation_id"]
        for bucket in result["candidate_buckets"].values()
        for item in bucket
    }
    assert "vc-valid" in auxiliary_observation_ids
    assert "vc-valid" not in federated_observation_ids, "review attestation leaked into candidate buckets"

    # Federation copies every source claim byte-for-byte at the data-model level.
    source_claims = {}
    for dimension in DIMENSION_ORDER:
        for candidate in adapter_result["candidate_claims"][dimension]:
            source_claims[("P1.4_ADAPTER", candidate["candidate_id"])] = candidate["claim"]
    for candidate in attestation_result["identity_candidates"]:
        source_claims[("P1.8_ATTESTATION", candidate["candidate_id"])] = candidate["claim"]
    for dimension, bucket in result["candidate_buckets"].items():
        for candidate in bucket:
            assert candidate["dimension"] == dimension
            assert candidate["claim"] == source_claims[(candidate["source_family"], candidate["source_candidate_id"])]

    # Source order is history/presentation metadata only; baseline semantics do not change.
    reversed_record = build_federation_input(
        adapter_result,
        attestation_result,
        source_order=["P1.8_ATTESTATION", "P1.4_ADAPTER"],
    )
    reversed_result = federate_candidate_sources(reversed_record)
    assert reversed_result["candidate_buckets"] == result["candidate_buckets"]
    assert reversed_result["auxiliary_attestations"] == result["auxiliary_attestations"]
    assert reversed_result["federation_policy"] == result["federation_policy"]
    assert reversed_result["source_order"] != result["source_order"]
    assert reversed_result["federation_policy"]["source_order_establishes_priority"] is False

    expect_reject(
        lambda: build_federation_input(adapter_result, attestation_result, source_order=[]),
        "explicit empty source_order",
    )

    mismatch = deepcopy(record)
    mismatch["attestation_result"]["artifact"]["id"] = "urn:uu-aap:artifact:other"
    expect_reject(lambda: federate_candidate_sources(mismatch), "artifact mismatch")

    duplicate_source = deepcopy(record)
    duplicate_source["adapter_result"]["candidate_claims"]["provenance"].append(
        deepcopy(duplicate_source["adapter_result"]["candidate_claims"]["provenance"][0])
    )
    expect_reject(lambda: federate_candidate_sources(duplicate_source), "duplicate source candidate id")

    # A same-dimension collision remains plural; P1.9 selects or merges nothing.
    adapter_input = json.loads(ADAPTER_FIXTURE.read_text(encoding="utf-8"))
    adapter_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    second = deepcopy(adapter_input["observations"][0])
    second["id"] = "obs-c2pa-2"
    second["summary"] = "Second valid C2PA provenance observation for collision preservation."
    adapter_input["observations"].insert(1, second)
    collision_adapter = adapt_evidence(adapter_input)
    collision_record = build_federation_input(collision_adapter, attestation_result)
    collision_result = federate_candidate_sources(collision_record)
    provenance = collision_result["candidate_buckets"]["provenance"]
    assert len(provenance) == 2
    assert [item["source_candidate_id"] for item in provenance] == [
        "candidate:obs-c2pa-1:provenance",
        "candidate:obs-c2pa-2:provenance",
    ]
    assert collision_result["federation_policy"]["same_dimension_candidates_imply_consensus"] is False
    assert collision_result["federation_policy"]["source_count_establishes_confidence"] is False

    semantic_mutation = deepcopy(result)
    semantic_mutation["candidate_buckets"]["identity"][0]["claim"]["value"] = "SCOPED_AUTHORITY_ACCEPTED"
    expect_reject(lambda: validate_federation_result(semantic_mutation), "federation strengthened source claim")

    injected = deepcopy(record)
    injected["trust_score"] = 1.0
    expect_reject(lambda: federate_candidate_sources(injected), "top-level trust score injection")

    # Opaque source evidence is preserved, not interpreted as federation policy.
    assert result["source_results"]["P1.4_ADAPTER"]["evidence_items"][0]["payload"]["trust_score"] == 0.99
    assert result["source_results"]["P1.8_ATTESTATION"]["evidence_items"][0]["payload"]["authority"] is True
    assert all(value is False for value in result["federation_policy"].values())
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert tuple(result["source_order"]) == SOURCE_FAMILIES

    print("P1.9 Python == browser federation: PASS")
    print("P1.4 + P1.8 validators reused: PASS")
    print("identity source isolation: PASS")
    print("role/review auxiliary isolation: PASS")
    print("same-dimension plural candidates preserved: PASS")
    print("source order != priority: PASS")
    print("candidate federation != acceptance/consensus/score: PASS")


if __name__ == "__main__":
    main()
