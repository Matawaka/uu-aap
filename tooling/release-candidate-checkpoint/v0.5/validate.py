#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CHECKPOINT_PATH = HERE / "checkpoint.json"
RECONCILIATION_PATH = ROOT / "tooling" / "current-frontier-reconciliation" / "v0.2" / "reconciliation.json"

ORIGIN = "9bce100a63ca981f28f24ce73d0f81f67f4289d3"
RECONCILIATION_BLOB = "37a5daed7f57e58177e92679310fa26b3d2ddc24"
ROADMAP_BLOB = "3e5f371764c8f9557fd1ce57615a2739253d8140"
RC_V04_BLOB = "ddb7905b84a552321b0d7b0e3125b44e0960b8ab"

EXPECTED_NON_EFFECTS = {
    "historical_rewrite",
    "release_authorized",
    "publication_authorized",
    "tag_authorized",
    "certification_created",
    "legal_status_created",
    "runtime_activation_authorized",
    "action_permit_created",
    "external_validation_claimed",
    "external_evidence_fabricated",
    "c2pa_p0_3_promoted_to_pass",
    "workbench_reactivated",
    "stable_core_changed",
}

VERIFIER_FALSE_CLAIMS = {
    "producer_authentication_proven",
    "truth_proven",
    "authority_proven",
    "trusted_timestamp_proven",
    "future_availability_proven",
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def derive_decision(public_review, pilot_002):
    if public_review == "WAITING_EXTERNAL" or pilot_002 == "WAITING_EXTERNAL":
        return "RELEASE_CANDIDATE_EXTERNAL_EVIDENCE_PENDING"
    raise ValueError("v0.5 does not authorize a successor decision for satisfied external gates")


def validate(checkpoint, reconciliation):
    if checkpoint.get("schema_version") != "0.5":
        raise ValueError("schema version")
    if checkpoint.get("checkpoint_type") != "ReleaseCandidateCheckpoint":
        raise ValueError("checkpoint type")
    if checkpoint.get("origin_frontier") != ORIGIN:
        raise ValueError("origin frontier")

    predecessor = checkpoint.get("predecessor", {})
    if predecessor != {
        "path": "tooling/release-candidate-checkpoint/v0.4/checkpoint.json",
        "state": "PRESERVED_HISTORICAL",
        "blob": RC_V04_BLOB,
    }:
        raise ValueError("historical RC v0.4 binding")

    rec_binding = checkpoint.get("current_frontier_reconciliation", {})
    if rec_binding != {
        "path": "tooling/current-frontier-reconciliation/v0.2/reconciliation.json",
        "blob": RECONCILIATION_BLOB,
        "state": "ACCEPTED_INPUT",
    }:
        raise ValueError("reconciliation binding")

    roadmap = checkpoint.get("current_roadmap", {})
    if roadmap != {
        "path": "docs/ROADMAP-CURRENT.md",
        "blob": ROADMAP_BLOB,
        "state": "ACCEPTED_INPUT",
    }:
        raise ValueError("roadmap binding")

    if reconciliation.get("schema") != "urn:uu-aap:current-frontier-reconciliation:0.2":
        raise ValueError("reconciliation schema")
    posture = reconciliation.get("current_posture", {})

    if checkpoint.get("engineering_convergence") != posture.get("engineering") or checkpoint.get("engineering_convergence") != "PASS_BOUNDED":
        raise ValueError("engineering derivation")
    if checkpoint.get("security_evidence") != posture.get("security") or checkpoint.get("security_evidence") != "EVIDENCE_CLOSED_BOUNDED":
        raise ValueError("security derivation")
    if checkpoint.get("internal_governance") != posture.get("internal_governance") or checkpoint.get("internal_governance") != "PASS_BOUNDED":
        raise ValueError("governance derivation")

    interop = checkpoint.get("interop", {})
    if interop.get("c2pa_p0_3") != posture.get("c2pa_p0_3") or interop.get("c2pa_p0_3") != "INCOMPLETE":
        raise ValueError("C2PA P0.3 derivation")
    rec_evidence = {row["id"]: row for row in reconciliation.get("evidence", [])}
    if interop.get("evidence_anchor_prs") != rec_evidence.get("c2pa-evidence-anchor-prs", {}).get("state"):
        raise ValueError("C2PA evidence-anchor derivation")
    if interop.get("evidence_anchor_prs") != "INTENTIONALLY_UNMERGED_EVIDENCE_ANCHORS":
        raise ValueError("C2PA evidence anchors cannot be merge-promoted")

    verifier = checkpoint.get("verifier", {})
    if verifier.get("p1_1_to_p1_20") != posture.get("verifier_p1_1_to_p1_20") or verifier.get("p1_1_to_p1_20") != "ACCEPTED_BOUNDED":
        raise ValueError("verifier derivation")
    if verifier.get("deployed_byte_observability") != rec_evidence.get("pages-live-byte-observability", {}).get("state"):
        raise ValueError("deployed-byte derivation")
    if verifier.get("deployed_byte_observability") != "OBSERVED_MATCH_BOUNDED":
        raise ValueError("deployed-byte scope")
    for key in VERIFIER_FALSE_CLAIMS:
        if verifier.get(key) is not False:
            raise ValueError(f"forbidden verifier inference: {key}")

    external = checkpoint.get("external_gates", {})
    if external.get("public_review") != posture.get("public_review") or external.get("public_review") != "WAITING_EXTERNAL":
        raise ValueError("public-review derivation")
    if external.get("pilot_002") != posture.get("core_pilot_002") or external.get("pilot_002") != "WAITING_EXTERNAL":
        raise ValueError("pilot-002 derivation")

    lanes = checkpoint.get("parallel_lanes", {})
    if lanes.get("kontur_successor") != "PARALLEL_NON_CORE":
        raise ValueError("KONTUR scope")
    if lanes.get("workbench") != posture.get("workbench") or lanes.get("workbench") != "PAUSED_EXTERNAL_PRODUCT":
        raise ValueError("Workbench pause")
    if lanes.get("ip_legal_private") != "HUMAN_OR_EXTERNAL_DECISION":
        raise ValueError("IP/legal boundary")

    expected_decision = derive_decision(external.get("public_review"), external.get("pilot_002"))
    if checkpoint.get("decision") != expected_decision:
        raise ValueError("decision derivation")
    if posture.get("release_candidate") != "EXTERNAL_EVIDENCE_PENDING":
        raise ValueError("reconciliation release posture")
    if checkpoint.get("next_priority") != "GENUINE_EXTERNAL_PARTICIPATION":
        raise ValueError("next priority")

    limitations = checkpoint.get("limitations")
    if not isinstance(limitations, list) or len(limitations) < 6:
        raise ValueError("limitations")

    non_effects = checkpoint.get("non_effects", {})
    if set(non_effects) != EXPECTED_NON_EFFECTS:
        raise ValueError("non-effects inventory")
    for key in EXPECTED_NON_EFFECTS:
        if non_effects[key] is not False:
            raise ValueError(f"forbidden effect enabled: {key}")

    return True


def must_fail(base_checkpoint, base_reconciliation, mutate, label):
    c = copy.deepcopy(base_checkpoint)
    r = copy.deepcopy(base_reconciliation)
    mutate(c, r)
    try:
        validate(c, r)
    except Exception:
        return
    raise AssertionError(f"unsafe mutation accepted: {label}")


def main():
    checkpoint = load(CHECKPOINT_PATH)
    reconciliation = load(RECONCILIATION_PATH)
    validate(checkpoint, reconciliation)

    must_fail(checkpoint, reconciliation, lambda c, r: c.__setitem__("decision", "READY"), "premature READY")
    must_fail(checkpoint, reconciliation, lambda c, r: c["non_effects"].__setitem__("release_authorized", True), "release authority")
    must_fail(checkpoint, reconciliation, lambda c, r: c["non_effects"].__setitem__("publication_authorized", True), "publication authority")
    must_fail(checkpoint, reconciliation, lambda c, r: c["non_effects"].__setitem__("tag_authorized", True), "tag authority")
    must_fail(checkpoint, reconciliation, lambda c, r: c["external_gates"].__setitem__("public_review", "PASS"), "invented public review")
    must_fail(checkpoint, reconciliation, lambda c, r: c["external_gates"].__setitem__("pilot_002", "PASS"), "invented pilot evidence")
    must_fail(checkpoint, reconciliation, lambda c, r: c["interop"].__setitem__("c2pa_p0_3", "PASS"), "C2PA P0.3 overclaim")
    must_fail(checkpoint, reconciliation, lambda c, r: c["interop"].__setitem__("evidence_anchor_prs", "MERGE_READY"), "C2PA evidence PR promotion")
    must_fail(checkpoint, reconciliation, lambda c, r: c["parallel_lanes"].__setitem__("workbench", "ACTIVE"), "Workbench reactivation")
    must_fail(checkpoint, reconciliation, lambda c, r: c["verifier"].__setitem__("producer_authentication_proven", True), "producer authentication overclaim")
    must_fail(checkpoint, reconciliation, lambda c, r: c["verifier"].__setitem__("truth_proven", True), "truth overclaim")
    must_fail(checkpoint, reconciliation, lambda c, r: c["verifier"].__setitem__("authority_proven", True), "authority overclaim")
    must_fail(checkpoint, reconciliation, lambda c, r: c["verifier"].__setitem__("trusted_timestamp_proven", True), "trusted time overclaim")
    must_fail(checkpoint, reconciliation, lambda c, r: c["verifier"].__setitem__("future_availability_proven", True), "future availability overclaim")
    must_fail(checkpoint, reconciliation, lambda c, r: c["non_effects"].__setitem__("stable_core_changed", True), "Stable Core change")

    print("RELEASE_CANDIDATE_CHECKPOINT_V0_5_PASS")


if __name__ == "__main__":
    main()
