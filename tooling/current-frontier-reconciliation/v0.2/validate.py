#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RECEIPT = Path(__file__).with_name("reconciliation.json")
ROADMAP = ROOT / "docs" / "ROADMAP-CURRENT.md"

ORIGIN = "53beba76a82916dcd90239e59b1c0e49db55beae"
PREDECESSOR_ROADMAP_BLOB = "8ac748575c6c9f2e1da180d849106b9bab6faead"
PREDECESSOR_ROADMAP_ORIGIN = "b3e1fb858ffc30366293c490baed7cbecfcfa26a"

REQUIRED_STATES = {
    "stable-core-and-internal-engineering": "PASS_BOUNDED",
    "c2pa-priority-roadmap": "COMPLETED_WITH_EXPLICIT_GAP",
    "c2pa-p0-3-preservation": "INCOMPLETE",
    "c2pa-evidence-anchor-prs": "INTENTIONALLY_UNMERGED_EVIDENCE_ANCHORS",
    "verifier-p1-chain": "ACCEPTED_BOUNDED",
    "pages-live-byte-observability": "OBSERVED_MATCH_BOUNDED",
    "external-public-review": "WAITING_EXTERNAL",
    "core-pilot-002": "WAITING_EXTERNAL",
    "kontur-successor": "PARALLEL_NON_CORE",
    "workbench": "PAUSED_EXTERNAL_PRODUCT",
    "ip-legal-private": "HUMAN_OR_EXTERNAL_DECISION",
    "legacy-poai-level-3-4": "SUCCESSOR_NEEDED_WHEN_CONCRETE",
}

REQUIRED_POSTURE = {
    "engineering": "PASS_BOUNDED",
    "internal_governance": "PASS_BOUNDED",
    "security": "EVIDENCE_CLOSED_BOUNDED",
    "c2pa_p0_3": "INCOMPLETE",
    "verifier_p1_1_to_p1_20": "ACCEPTED_BOUNDED",
    "public_review": "WAITING_EXTERNAL",
    "core_pilot_002": "WAITING_EXTERNAL",
    "workbench": "PAUSED_EXTERNAL_PRODUCT",
    "release_candidate": "EXTERNAL_EVIDENCE_PENDING",
}

REQUIRED_NON_EFFECTS = {
    "historical_rewrite",
    "release_authorized",
    "tag_authorized",
    "publication_authorized",
    "runtime_activation_authorized",
    "action_permit_created",
    "external_review_fabricated",
    "c2pa_p0_3_promoted_to_pass",
    "workbench_reactivated",
    "stable_core_changed",
    "certification_created",
    "legal_status_created",
}


def evidence_map(doc):
    rows = doc.get("evidence")
    if not isinstance(rows, list):
        raise ValueError("evidence must be a list")
    ids = [row.get("id") for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate evidence id")
    return {row["id"]: row for row in rows}


def validate(doc, check_roadmap=True):
    if doc.get("schema") != "urn:uu-aap:current-frontier-reconciliation:0.2":
        raise ValueError("schema")
    if doc.get("reconciliation_version") != "0.2":
        raise ValueError("version")
    if doc.get("origin_frontier") != ORIGIN:
        raise ValueError("origin frontier")

    predecessor = doc.get("predecessor_roadmap", {})
    if predecessor.get("path") != "docs/ROADMAP-CURRENT.md":
        raise ValueError("predecessor roadmap path")
    if predecessor.get("blob") != PREDECESSOR_ROADMAP_BLOB:
        raise ValueError("predecessor roadmap blob")
    if predecessor.get("declared_origin_frontier") != PREDECESSOR_ROADMAP_ORIGIN:
        raise ValueError("predecessor roadmap origin")

    checkpoint = doc.get("historical_checkpoint", {})
    if checkpoint.get("path") != "tooling/release-candidate-checkpoint/v0.4/checkpoint.json":
        raise ValueError("historical checkpoint path")
    if checkpoint.get("state") != "PRESERVED_HISTORICAL":
        raise ValueError("historical checkpoint state")
    if checkpoint.get("decision") != "RELEASE_CANDIDATE_EXTERNAL_EVIDENCE_PENDING":
        raise ValueError("historical checkpoint decision")

    emap = evidence_map(doc)
    if set(emap) != set(REQUIRED_STATES):
        raise ValueError("evidence inventory")
    for evidence_id, state in REQUIRED_STATES.items():
        if emap[evidence_id].get("state") != state:
            raise ValueError(f"unsafe state for {evidence_id}")
        if not emap[evidence_id].get("refs"):
            raise ValueError(f"missing refs for {evidence_id}")
        if not emap[evidence_id].get("claim"):
            raise ValueError(f"missing claim for {evidence_id}")

    anchors = emap["c2pa-evidence-anchor-prs"].get("refs")
    if anchors != ["#781", "#782"]:
        raise ValueError("C2PA evidence anchors")
    if emap["c2pa-p0-3-preservation"].get("state") == "PASS":
        raise ValueError("P0.3 cannot be promoted")

    if doc.get("current_posture") != REQUIRED_POSTURE:
        raise ValueError("current posture")

    priority = doc.get("next_priority")
    if priority != [
        "GENUINE_EXTERNAL_PARTICIPATION",
        "ELIGIBLE_PUBLIC_REVIEW_EVIDENCE",
        "CORE_PILOT_002_AFTER_ADMISSION",
        "C2PA_P0_3_TARGETED_REAUDIT_ONLY_WHEN_UPSTREAM_CHANGES",
    ]:
        raise ValueError("next priority")

    not_default = set(doc.get("not_default_next", []))
    required_not_default = {
        "NEW_STABLE_CORE_LAYER_WITHOUT_NEW_NEED",
        "P1_21_FOR_NUMBERING_ONLY",
        "WORKBENCH_DEVELOPMENT_WHILE_PAUSED",
        "MERGE_OR_CLOSE_781_782_AS_IF_ORDINARY_FEATURE_PRS",
    }
    if not_default != required_not_default:
        raise ValueError("not-default-next boundary")

    non_effects = doc.get("non_effects", {})
    if set(non_effects) != REQUIRED_NON_EFFECTS:
        raise ValueError("non-effects inventory")
    for key in REQUIRED_NON_EFFECTS:
        if non_effects[key] is not False:
            raise ValueError(f"forbidden effect enabled: {key}")

    if check_roadmap:
        text = ROADMAP.read_text(encoding="utf-8")
        required_text = [
            f"Canonical reconciliation frontier: `{ORIGIN}`",
            "C2PA P0.3 cross-SDK preservation — `INCOMPLETE`",
            "Verifier presentation/distribution P1.1–P1.20 — `ACCEPTED_BOUNDED`",
            "Public Review #1–#7 — `WAITING_EXTERNAL`",
            "Core Pilot 002 #718/#422 — `WAITING_EXTERNAL`",
            "Workbench — `PAUSED_EXTERNAL_PRODUCT`",
            "release candidate = EXTERNAL_EVIDENCE_PENDING",
            "No P1.21 or new Stable Core layer is the default next step.",
        ]
        for marker in required_text:
            if marker not in text:
                raise ValueError(f"roadmap marker missing: {marker}")

    return True


def must_fail(base, mutate, label):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate, check_roadmap=False)
    except Exception:
        return
    raise AssertionError(f"unsafe mutation accepted: {label}")


def main():
    doc = json.loads(RECEIPT.read_text(encoding="utf-8"))
    validate(doc)

    must_fail(doc, lambda x: x["current_posture"].__setitem__("release_candidate", "READY"), "premature READY")
    must_fail(doc, lambda x: x["non_effects"].__setitem__("release_authorized", True), "release authority")
    must_fail(doc, lambda x: x["non_effects"].__setitem__("publication_authorized", True), "publication authority")
    must_fail(doc, lambda x: x["non_effects"].__setitem__("external_review_fabricated", True), "fabricated external evidence")
    must_fail(doc, lambda x: x["current_posture"].__setitem__("public_review", "PASS"), "invented public review")
    must_fail(doc, lambda x: x["current_posture"].__setitem__("core_pilot_002", "PASS"), "invented pilot run")
    must_fail(doc, lambda x: x["current_posture"].__setitem__("c2pa_p0_3", "PASS"), "P0.3 compatibility promotion")
    must_fail(doc, lambda x: evidence_map(x)["c2pa-p0-3-preservation"].__setitem__("state", "PASS"), "historical P0.3 rewrite")
    must_fail(doc, lambda x: evidence_map(x)["c2pa-evidence-anchor-prs"].__setitem__("state", "MERGE_READY"), "evidence PR promotion")
    must_fail(doc, lambda x: x["current_posture"].__setitem__("workbench", "ACTIVE"), "Workbench reactivation")
    must_fail(doc, lambda x: x["non_effects"].__setitem__("stable_core_changed", True), "Stable Core change")

    print("CURRENT_FRONTIER_RECONCILIATION_V0_2_PASS")


if __name__ == "__main__":
    main()
