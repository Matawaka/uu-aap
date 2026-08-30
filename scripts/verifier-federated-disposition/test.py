#!/usr/bin/env python3
"""P1.10 explicit federated disposition adversarial and browser-parity tests."""
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
    FEDERATED_DISPOSITION_SCOPE,
    adapt_evidence,
    bridge_attestations,
    build_acceptance_input,
    build_federated_disposition_input,
    build_federation_input,
    federate_candidate_sources,
    materialize_federated_disposition,
    validate_federated_disposition_input,
    validate_federated_disposition_result,
    validate_interactive_input,
)

ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
ATTESTATION_FIXTURE = REPO_ROOT / "scripts" / "verifier-scoped-attestations" / "fixture.json"
APP = HERE / "app.js"
BROWSER = HERE / "test-browser.js"
CANDIDATE_APP = REPO_ROOT / "scripts" / "verifier-candidate-federation" / "app.js"
ADAPTER_APP = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "app.js"
ATTESTATION_APP = REPO_ROOT / "scripts" / "verifier-scoped-attestations" / "app.js"
INTERACTIVE_APP = REPO_ROOT / "scripts" / "verifier-interactive-surface" / "app.js"
BINDINGS = HERE / "source-bindings.json"
COMMON_ARTIFACT = {
    "id": "urn:uu-aap:artifact:p1.10:reference",
    "description": "Synthetic P1.10 federated disposition reference",
}


def source_federation(*, second_provenance: bool = False, reverse_order: bool = False) -> dict:
    adapter_input = json.loads(ADAPTER_FIXTURE.read_text(encoding="utf-8"))
    attestation_input = json.loads(ATTESTATION_FIXTURE.read_text(encoding="utf-8"))
    adapter_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    attestation_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    if second_provenance:
        second = deepcopy(adapter_input["observations"][0])
        second["id"] = "obs-c2pa-2"
        second["summary"] = "Second valid C2PA provenance observation for P1.10 collision testing."
        adapter_input["observations"].insert(1, second)
    adapter_result = adapt_evidence(adapter_input)
    attestation_result = bridge_attestations(attestation_input)
    source_order = ["P1.8_ATTESTATION", "P1.4_ADAPTER"] if reverse_order else None
    return federate_candidate_sources(build_federation_input(adapter_result, attestation_result, source_order))


def candidates(fset: dict):
    for dimension in DIMENSION_ORDER:
        for candidate in fset["candidate_buckets"][dimension]:
            yield dimension, candidate


def baseline_event(fset: dict, *, event_id: str = "p1-10-disposition-reference") -> dict:
    dispositions = []
    for dimension, candidate in candidates(fset):
        value = candidate["claim"]["value"]
        if dimension in {"provenance", "availability", "authority", "responsibility"}:
            decision = "ACCEPT"
        elif dimension == "identity" and value == "CAWG_IDENTITY_TRUSTED":
            decision = "ACCEPT"
        elif dimension == "identity" and value == "CAWG_IDENTITY_WELL_FORMED":
            decision = "DEFER"
        else:
            decision = "REJECT"
        dispositions.append({
            "federated_candidate_id": candidate["federated_candidate_id"],
            "decision": decision,
            "rationale": f"Explicit synthetic P1.10 disposition for {dimension}/{value}; source family and evaluation do not decide automatically.",
        })
    return {
        "id": event_id,
        "actor_ref": "urn:uu-aap:actor:declared-local-reviewer:p1.10",
        "scope": FEDERATED_DISPOSITION_SCOPE,
        "dispositions": dispositions,
    }


def event_with_only(fset: dict, selected_id: str, *, event_id: str) -> dict:
    event = baseline_event(fset, event_id=event_id)
    for item in event["dispositions"]:
        item["decision"] = "ACCEPT" if item["federated_candidate_id"] == selected_id else "DEFER"
        item["rationale"] = "Explicit isolation disposition for semantic-boundary testing."
    return event


def expect_reject(callable_obj, label: str) -> None:
    try:
        callable_obj()
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def browser_result(record: dict) -> dict:
    completed = subprocess.run(
        [
            "node", str(BROWSER), str(APP), str(CANDIDATE_APP), str(ADAPTER_APP),
            str(ATTESTATION_APP), str(INTERACTIVE_APP),
        ],
        cwd=REPO_ROOT,
        input=json.dumps(record, ensure_ascii=False),
        text=True,
        check=True,
        capture_output=True,
    )
    return json.loads(completed.stdout)


def main() -> None:
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "e5902e3d59877376f046ea3f1ea87b86675dc511"
    assert bindings["p1_5_acceptance"]["blob"] == "cfa17d11a01888422dd4f5c4a606142792dee5b9"
    assert bindings["p1_9_federation"]["blob"] == "1398d303ca3f5786af21754cbe8c39ceaa9a844c"
    assert set(bindings["p1_5_acceptance"]["dispositions"]) == {"ACCEPT", "REJECT", "DEFER"}

    fset = source_federation()
    event = baseline_event(fset)
    record = build_federated_disposition_input(fset, event)
    validate_federated_disposition_input(record)
    result = materialize_federated_disposition(record)
    validate_federated_disposition_result(result)
    validate_interactive_input(result["materialized_interactive_input"])
    assert browser_result(record) == result, "Python/browser P1.10 materialization diverged"

    claims = result["materialized_interactive_input"]["dimension_claims"]
    assert claims["integrity"]["value"] == "NOT_EVALUATED"
    assert claims["truth"]["value"] == "NOT_EVALUATED"
    assert claims["identity"]["value"] == "CAWG_IDENTITY_TRUSTED"
    assert claims["provenance"]["value"] == "CREDENTIALS_PRESENT"
    assert claims["availability"]["value"] == "UNAVAILABLE_BEFORE_CUTOFF"
    assert claims["authority"]["value"] == "SCOPED_AUTHORITY_ACCEPTED"
    assert claims["responsibility"]["value"] == "SCOPED_RESPONSIBILITY_PRESENT"

    receipt_id = f"evidence:{event['id']}"
    indexed = {candidate["federated_candidate_id"]: candidate for _dimension, candidate in candidates(fset)}
    for disposition in result["disposition_receipts"]:
        candidate = indexed[disposition["federated_candidate_id"]]
        if disposition["decision"] == "ACCEPT":
            materialized = claims[disposition["dimension"]]
            original = candidate["claim"]
            assert materialized["value"] == original["value"]
            assert materialized["evaluation"] == original["evaluation"]
            assert materialized["source_layer"] == original["source_layer"]
            assert materialized["explanation"] == original["explanation"]
            assert materialized["does_not_establish"] == original["does_not_establish"]
            assert materialized["evidence_refs"] == [*original["evidence_refs"], receipt_id]

    omitted = deepcopy(record)
    omitted["disposition_event"]["dispositions"].pop()
    expect_reject(lambda: materialize_federated_disposition(omitted), "omitted disposition")
    duplicate = deepcopy(record)
    duplicate["disposition_event"]["dispositions"].append(deepcopy(duplicate["disposition_event"]["dispositions"][0]))
    expect_reject(lambda: materialize_federated_disposition(duplicate), "duplicate disposition")
    unknown = deepcopy(record)
    unknown["disposition_event"]["dispositions"][0]["federated_candidate_id"] = "federated:UNKNOWN:candidate"
    expect_reject(lambda: materialize_federated_disposition(unknown), "unknown federated candidate")

    collision = source_federation(second_provenance=True)
    collision_event = baseline_event(collision, event_id="p1-10-collision")
    provenance_ids = [c["federated_candidate_id"] for d, c in candidates(collision) if d == "provenance"]
    assert len(provenance_ids) == 2
    for disposition in collision_event["dispositions"]:
        if disposition["federated_candidate_id"] in provenance_ids:
            disposition["decision"] = "ACCEPT"
    expect_reject(
        lambda: build_federated_disposition_input(collision, collision_event),
        "multiple ACCEPT in provenance",
    )
    for disposition in collision_event["dispositions"]:
        if disposition["federated_candidate_id"] == provenance_ids[1]:
            disposition["decision"] = "DEFER"
    collision_result = materialize_federated_disposition(build_federated_disposition_input(collision, collision_event))
    assert collision_result["materialized_interactive_input"]["dimension_claims"]["provenance"]["value"] == "CREDENTIALS_PRESENT"
    assert provenance_ids[1] in collision_result["deferred_candidate_ids"]

    well_formed = next(
        c for d, c in candidates(fset)
        if d == "identity" and c["claim"]["value"] == "CAWG_IDENTITY_WELL_FORMED"
    )
    unknown_event = event_with_only(fset, well_formed["federated_candidate_id"], event_id="p1-10-unknown-explicit")
    unknown_result = materialize_federated_disposition(build_federated_disposition_input(fset, unknown_event))
    assert unknown_result["materialized_interactive_input"]["dimension_claims"]["identity"]["evaluation"] == "UNKNOWN"
    assert unknown_result["disposition_policy"]["evaluation_ranking_permitted"] is False

    trusted = next(
        c for d, c in candidates(fset)
        if d == "identity" and c["claim"]["value"] == "CAWG_IDENTITY_TRUSTED"
    )
    identity_only = materialize_federated_disposition(
        build_federated_disposition_input(
            fset,
            event_with_only(fset, trusted["federated_candidate_id"], event_id="p1-10-identity-only"),
        )
    )
    identity_claims = identity_only["materialized_interactive_input"]["dimension_claims"]
    assert identity_claims["identity"]["value"] == "CAWG_IDENTITY_TRUSTED"
    assert identity_claims["authority"]["value"] == "NOT_EVALUATED"
    assert identity_claims["responsibility"]["value"] == "NOT_EVALUATED"

    authority = next(c for d, c in candidates(fset) if d == "authority")
    authority_only = materialize_federated_disposition(
        build_federated_disposition_input(
            fset,
            event_with_only(fset, authority["federated_candidate_id"], event_id="p1-10-authority-only"),
        )
    )
    authority_claims = authority_only["materialized_interactive_input"]["dimension_claims"]
    assert authority_claims["authority"]["value"] == "SCOPED_AUTHORITY_ACCEPTED"
    assert authority_claims["responsibility"]["value"] == "NOT_EVALUATED"

    reversed_fset = source_federation(reverse_order=True)
    reversed_event = baseline_event(reversed_fset)
    reversed_result = materialize_federated_disposition(build_federated_disposition_input(reversed_fset, reversed_event))
    assert reversed_result["materialized_interactive_input"]["dimension_claims"] == result["materialized_interactive_input"]["dimension_claims"]
    assert reversed_result["disposition_policy"]["source_order_priority_permitted"] is False
    assert reversed_result["disposition_policy"]["source_family_priority_permitted"] is False

    fake_p1_5_event = {
        "id": "historical-p1-5-must-reject-federation",
        "actor_ref": "urn:uu-aap:actor:test",
        "scope": "verifier_candidate_materialization",
        "dispositions": [],
    }
    expect_reject(lambda: build_acceptance_input(fset, fake_p1_5_event), "P1.5 fed-set substitution")

    auxiliary_ids = {
        item["observation_id"]
        for values in fset["auxiliary_attestations"].values()
        for item in values
    }
    disposition_ids = {item["federated_candidate_id"] for item in event["dispositions"]}
    assert "vc-valid" in auxiliary_ids
    assert all(aux_id not in disposition_ids for aux_id in auxiliary_ids)
    assert result["materialized_interactive_input"]["related_observations"]["auxiliary_attestations"] == fset["auxiliary_attestations"]

    policy = result["disposition_policy"]
    assert policy["reject_is_negative_evidence"] is False
    assert policy["defer_is_negative_evidence"] is False
    assert policy["actor_ref_establishes_identity"] is False
    assert policy["actor_ref_establishes_authority"] is False
    assert policy["acceptance_strengthens_claim_semantics"] is False
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False

    print("P1.10 Python == browser materialization: PASS")
    print("every federated candidate explicitly dispositioned: PASS")
    print("single ACCEPT per dimension: PASS")
    print("source family/order/evaluation != automatic priority: PASS")
    print("identity != authority/responsibility: PASS")
    print("authority != responsibility: PASS")
    print("REJECT/DEFER != negative evidence: PASS")
    print("historical P1.5 remains adapter-only: PASS")


if __name__ == "__main__":
    main()
