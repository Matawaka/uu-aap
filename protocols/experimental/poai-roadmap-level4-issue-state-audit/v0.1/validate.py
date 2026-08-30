#!/usr/bin/env python3
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
DECISIONS_PATH = HERE / "decisions.json"

EXPECTED_ISSUES = {"#22", "#26", "#28", "#31", "#73", "#80"}
EXPECTED_CLOSE = {"#26", "#31", "#73", "#80"}
EXPECTED_OPEN = {"#22", "#28"}
EXPECTED_DECISIONS = {
    "#22": "PRESERVE_OPEN",
    "#26": "CLOSE_COMPLETED",
    "#28": "PRESERVE_OPEN",
    "#31": "CLOSE_COMPLETED",
    "#73": "CLOSE_COMPLETED",
    "#80": "CLOSE_COMPLETED",
}


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def validate(doc):
    require(doc.get("type") == "LegacyPoAIRoadmapLevel4IssueStateAudit", "wrong type")
    require(doc.get("version") == "0.1", "wrong version")
    require(doc.get("origin_frontier") == "0d149b1ce7ede7d3a3b389bc6199f68d20f096e2", "origin frontier drift")
    require(doc.get("audit_issue") == "#769", "wrong audit issue")

    decisions = doc.get("decisions") or []
    by_issue = {entry.get("issue"): entry for entry in decisions}
    require(set(by_issue) == EXPECTED_ISSUES, "candidate issue set drift")
    require(len(decisions) == len(EXPECTED_ISSUES), "duplicate candidate issue")
    for issue, expected in EXPECTED_DECISIONS.items():
        require(by_issue[issue].get("decision") == expected, f"decision drift for {issue}")
        require(bool(by_issue[issue].get("basis")), f"missing basis for {issue}")

    close = set(doc.get("authorized_post_merge_closures") or [])
    preserved = set(doc.get("preserved_open") or [])
    require(close == EXPECTED_CLOSE, "authorized closure set drift")
    require(preserved == EXPECTED_OPEN, "preserved-open set drift")
    require(not close & preserved, "closure/open overlap")

    non_effects = doc.get("non_effects") or {}
    require(non_effects, "missing non-effects")
    require(all(value is False for value in non_effects.values()), "non-effect upgraded to effect")

    sources = doc.get("evidence_sources") or []
    require(len(sources) == 4, "evidence source count drift")
    source_by_path = {entry.get("path"): entry for entry in sources}
    require(len(source_by_path) == 4, "duplicate evidence path")
    for rel_path, entry in source_by_path.items():
        path = ROOT / rel_path
        require(path.is_file(), f"missing evidence source: {rel_path}")
        require(git_blob_sha(path.read_bytes()) == entry.get("blob_sha"), f"byte drift: {rel_path}")

    comp_path = "proposals/poai/extensions/COMPOSITIONAL_INTELLIGENCE.md"
    review_path = "docs/poai/review-cues.js"
    signature_path = "proposals/poai/extensions/SIGNATURE_BINDING.md"
    map_path = "protocols/experimental/poai-successor-reconciliation/v0.1/legacy-successor-map.json"
    require({comp_path, review_path, signature_path, map_path} == set(source_by_path), "evidence path set drift")

    comp = (ROOT / comp_path).read_text(encoding="utf-8")
    require("The frozen Genesis enum `human_judgment` remains unchanged." in comp, "human_judgment freeze missing")
    require("resource provenance != availability != consideration != authority != responsibility" in comp, "compositional boundary missing")
    require("This is a presentation hypothesis, not a machine-level rename." in comp, "presentation/machine boundary missing")
    require("Epistemic advantage is not authority." in comp, "epistemic/authority boundary missing")

    review = (ROOT / review_path).read_text(encoding="utf-8")
    for token in ["const PURPOSES", "evaluateReviewCues", "Does not affect PASS", "does not modify the PoAI JSON", "not errors, a score, or truth certification"]:
        require(token in review, f"review-cue invariant missing: {token}")
    require("score:" not in review, "scalar score field introduced")

    signature = (ROOT / signature_path).read_text(encoding="utf-8")
    require("matching digest != valid signature != signer identity != signer authority != materialization authority != canonical successor" in signature, "signature claim separation missing")
    require("cryptographic signature verification != truth certification" in signature, "signature/truth boundary missing")
    require("PoAI/V conformance" in signature, "PoAI/V non-claim missing")

    successor_map = json.loads((ROOT / map_path).read_text(encoding="utf-8"))
    matches = [entry for entry in successor_map.get("entries", []) if entry.get("family") == "DETERMINISTIC_BINDING_AND_SIGNATURE"]
    require(len(matches) == 1, "signature successor family missing/duplicated")
    family = matches[0]
    require(set(family.get("legacy_issues") or []) == {"#73", "#80"}, "legacy Level 4 issue binding drift")
    require(family.get("relation") == "SUPERSEDED_BY", "Level 4 family no longer superseded")
    require(family.get("legacy_invariant") == "digest != signature != identity != authority != truth", "legacy invariant drift")
    current_refs = family.get("current_refs") or []
    require(set(current_refs) == {"tooling/receipt-runtime/v0.1/", "protocols/attestation/"}, "current reusable refs drift")
    for rel_path in current_refs:
        require((ROOT / rel_path).exists(), f"missing current reusable ref: {rel_path}")

    # Field evidence is a separate boundary: this audit must keep both field-bearing issues open.
    require(by_issue["#22"]["decision"] == "PRESERVE_OPEN", "roadmap cannot close over unfinished field stage")
    require(by_issue["#28"]["decision"] == "PRESERVE_OPEN", "field usability cannot be synthetically closed")
    return True


def mutation_suite(base):
    mutations = []

    m = copy.deepcopy(base); next(x for x in m["decisions"] if x["issue"] == "#22")["decision"] = "CLOSE_COMPLETED"; mutations.append(m)
    m = copy.deepcopy(base); next(x for x in m["decisions"] if x["issue"] == "#28")["decision"] = "CLOSE_COMPLETED"; mutations.append(m)
    m = copy.deepcopy(base); m["authorized_post_merge_closures"].append("#28"); mutations.append(m)
    m = copy.deepcopy(base); m["preserved_open"] = ["#22"]; mutations.append(m)
    m = copy.deepcopy(base); m["decisions"].append({"issue": "#999", "decision": "CLOSE_COMPLETED", "basis": "unauthorized"}); mutations.append(m)
    m = copy.deepcopy(base); m["evidence_sources"][0]["blob_sha"] = "0" * 40; mutations.append(m)
    m = copy.deepcopy(base); m["non_effects"]["field_evidence_fabricated"] = True; mutations.append(m)
    m = copy.deepcopy(base); next(x for x in m["decisions"] if x["issue"] == "#73")["decision"] = "PRESERVE_OPEN"; mutations.append(m)

    for index, mutated in enumerate(mutations, start=1):
        try:
            validate(mutated)
        except AssertionError:
            continue
        raise AssertionError(f"mutation {index} was not rejected")


if __name__ == "__main__":
    base = json.loads(DECISIONS_PATH.read_text(encoding="utf-8"))
    validate(base)
    mutation_suite(base)
    print("PASS: Legacy PoAI roadmap/Level 4 issue-state audit v0.1")
