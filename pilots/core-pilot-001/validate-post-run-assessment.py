#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSESSMENT = ROOT / "post-run-assessment.json"
EXPECTED_MAIN = "f1172065a444594cfee3ec51868cab92340c4819"
EXPECTED_RUN_COMMIT = "e134e612d1913aa9c26ea88ebe6ab3b3ae6c6741"
EXPECTED_RUN_TREE = "6bb35b96eab93251e61060c464d1bf4787fdc2cd"
EXPECTED_PRIMITIVES = [
    "state_evidence_anchor",
    "possibility_availability",
    "intent",
    "authority_responsibility",
    "coordination_ccrp",
    "action_gate",
    "outcome_provenance_successor_state",
]
ALLOWED = {"directly_exercised", "partially_exercised", "not_exercised"}


def main():
    data = json.loads(ASSESSMENT.read_text(encoding="utf-8"))
    assert data["schema_version"] == "0.1"
    assert data["canonical_main"] == EXPECTED_MAIN
    assert data["run_001_execution_target"]["commit"] == EXPECTED_RUN_COMMIT
    assert data["run_001_execution_target"]["tree"] == EXPECTED_RUN_TREE

    evidence = data["core_evidence"]
    assert [x["primitive"] for x in evidence] == EXPECTED_PRIMITIVES
    assert len({x["primitive"] for x in evidence}) == 7
    for item in evidence:
        assert item["status"] in ALLOWED
        assert item["rationale"].strip()

    pilot = data["pilot_002"]
    assert pilot["selected"] == "public-review-intake-and-contestable-resolution"
    assert pilot["source_issues"] == [1, 2, 3, 4, 5, 6, 7]
    assert pilot["automatic_disposition"] is False
    assert pilot["automatic_authority_inference"] is False
    assert pilot["automatic_external_contact"] is False

    required_nonclaims = {
        "pilot_001_success_does_not_prove_universal_core_correctness",
        "local_recovery_success_does_not_prove_external_multi_party_coordination",
        "human_permit_does_not_prove_contested_authority_resolution",
        "verified_recovery_does_not_prove_identity_or_disclosure_boundaries",
    }
    assert set(data["non_claims"]) == required_nonclaims
    print("Core Pilot 001 post-run assessment validation: PASS")


if __name__ == "__main__":
    main()
