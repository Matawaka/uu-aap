#!/usr/bin/env python3
"""P1.8 scoped-attestation bridge adversarial and cross-runtime tests."""
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

from uuaap_verifier_presentation import bridge_attestations, validate_attestation_input  # noqa:E402

FIXTURE = HERE / "fixture.json"
APP = HERE / "app.js"
BROWSER = HERE / "test-browser.js"
BINDINGS = HERE / "source-bindings.json"


def expect_reject(record: dict, label: str) -> None:
    try:
        bridge_attestations(record)
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def main() -> None:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["cawg_identity"]["version"] == "1.3"
    assert bindings["cawg_identity"]["commit"] == "8851770a46221729b4e0d92cbfcad484b245cc71"
    assert bindings["w3c_vc"]["stable_basis"] == "2.0"
    assert bindings["w3c_vc"]["next_version_not_consumed"] is True

    result = bridge_attestations(fixture)
    browser = json.loads(subprocess.check_output(["node", str(BROWSER), str(FIXTURE), str(APP)], cwd=REPO_ROOT, text=True))
    assert browser == result, "Python/browser attestation bridge diverged"

    assert [(c["claim"]["value"], c["claim"]["evaluation"]) for c in result["identity_candidates"]] == [
        ("CAWG_IDENTITY_TRUSTED", "SUPPORTED"),
        ("CAWG_IDENTITY_WELL_FORMED", "UNKNOWN"),
        ("CAWG_IDENTITY_REVOKED", "NOT_SUPPORTED"),
    ]
    assert len(result["identity_candidates"]) == 3
    assert len(result["role_attestations"]) == 6
    assert len(result["review_attestations"]) == 3
    assert [r["verification_status"] for r in result["review_attestations"]] == ["VALID", "INVALID", "UNKNOWN"]
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False

    trusted = result["identity_candidates"][0]
    assert trusted["named_actor_ref"] == "did:example:alice"
    for forbidden_effect in ("authorship", "UU-AAP decision authority", "UU-AAP responsibility acceptance", "factual truth"):
        assert forbidden_effect in trusted["claim"]["does_not_establish"]

    publisher = next(r for r in result["role_attestations"] if r["role"] == "cawg.publisher")
    assert "UU-AAP decision authority" in publisher["does_not_establish"]
    assert "UU-AAP responsibility acceptance" in publisher["does_not_establish"]

    # Changing role vocabulary cannot change CAWG identity candidate semantics.
    role_mutation = deepcopy(fixture)
    role_mutation["observations"][0]["payload"]["roles"] = ["example.custom-role"]
    role_result = bridge_attestations(role_mutation)
    assert role_result["identity_candidates"][0]["claim"] == trusted["claim"]

    # All five CAWG statuses remain explicit and INVALID/NETWORK_REQUIRED emit no candidate.
    receipts = {r["observation_id"]: r for r in result["bridge_receipts"]}
    assert receipts["cawg-invalid"]["identity_candidate_emitted"] is False
    assert receipts["cawg-network"]["identity_candidate_emitted"] is False
    assert {w["code"] for w in result["warnings"]} >= {
        "CAWG_IDENTITY_INVALID", "CAWG_IDENTITY_NETWORK_REQUIRED", "VC_REVIEW_ATTESTATION_NOT_VALIDATED"
    }

    # Generic review VC is auxiliary only; valid signature/credential status does not emit a verifier candidate.
    assert all(r["identity_candidate_emitted"] is False for r in result["bridge_receipts"] if r["kind"] == "W3C_VC_REVIEW_ATTESTATION")
    valid_review = result["review_attestations"][0]
    assert "factual truth" in valid_review["does_not_establish"]
    assert "UU-AAP responsibility acceptance" in valid_review["does_not_establish"]

    # Opaque semantic-looking external fields survive as data and do not become bridge semantics.
    assert result["evidence_items"][0]["payload"]["authority"] is True
    assert result["evidence_items"][0]["payload"]["trust_score"] == 0.99

    bad_vcdm = deepcopy(fixture)
    bad_vcdm["observations"][5]["payload"]["vcdm_version"] = "2.1"
    expect_reject(bad_vcdm, "VCDM 2.1 draft consumed")

    bad_cawg = deepcopy(fixture)
    bad_cawg["observations"][0]["payload"]["assertion_version"] = "1.2"
    expect_reject(bad_cawg, "CAWG version drift")

    bad_evidence = deepcopy(fixture)
    bad_evidence["observations"][0]["evidence_refs"] = ["evidence:missing"]
    expect_reject(bad_evidence, "undeclared evidence")

    duplicate = deepcopy(fixture)
    duplicate["observations"][1]["id"] = duplicate["observations"][0]["id"]
    expect_reject(duplicate, "duplicate observation")

    semantic_injection = deepcopy(fixture)
    semantic_injection["observations"][0]["payload"]["trust_score"] = 1.0
    expect_reject(semantic_injection, "semantic field outside opaque validator details")

    validate_attestation_input(fixture)
    print("P1.8 Python == browser: PASS")
    print("CAWG TRUSTED/WELL_FORMED/REVOKED mapping: PASS")
    print("CAWG INVALID/NETWORK_REQUIRED no-candidate: PASS")
    print("role != authority/responsibility: PASS")
    print("W3C review VC != truth/responsibility candidate: PASS")
    print("VCDM 2.1 draft consumption: REJECTED")

if __name__ == "__main__":
    main()
