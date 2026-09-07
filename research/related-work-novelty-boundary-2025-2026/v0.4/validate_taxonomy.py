#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent
REPO = BASE.parents[2]
PRED = "e4c5c88d3703968334069026873a5fa880bad226"
ANCHOR = date.fromisoformat("2026-08-22")

CLASS_IDS = {
    "OBSERVATION_TO_BROAD_TRUTH",
    "CONTEXT_TO_AUTHORITY",
    "DECLARED_TO_VERIFIED_CONTEXT",
    "STALE_MEMORY_TO_CURRENT_AUTHORITY",
    "APPROVAL_TO_PERFORMED_ACTION",
    "INVOCATION_TO_COMPLETED_EFFECT",
    "PROVENANCE_TO_CAUSALITY",
    "IDENTITY_TO_AUTHORITY",
    "REVIEW_TO_EXECUTION_PERMISSION",
    "AVAILABILITY_TO_INTENT",
}
EXPECTED_CLASSIFICATION = {
    "OBSERVATION_TO_BROAD_TRUTH": "PREDECESSOR_NAMED_NOT_UNIFIED",
    "CONTEXT_TO_AUTHORITY": "PREDECESSOR_NAMED_AND_TESTED",
    "DECLARED_TO_VERIFIED_CONTEXT": "PREDECESSOR_NAMED_AND_TESTED",
    "STALE_MEMORY_TO_CURRENT_AUTHORITY": "POST_PUBLICATION_CONVERGENCE",
    "APPROVAL_TO_PERFORMED_ACTION": "PREDECESSOR_NAMED_NOT_UNIFIED",
    "INVOCATION_TO_COMPLETED_EFFECT": "PREDECESSOR_NAMED_NOT_UNIFIED",
    "PROVENANCE_TO_CAUSALITY": "PREDECESSOR_NAMED_AND_TESTED",
    "IDENTITY_TO_AUTHORITY": "PREDECESSOR_NAMED_NOT_UNIFIED",
    "REVIEW_TO_EXECUTION_PERMISSION": "PREDECESSOR_NAMED_NOT_UNIFIED",
    "AVAILABILITY_TO_INTENT": "EXACT_MATERIALIZATION_NOT_FOUND_IN_BOUNDED_AUDIT",
}

V03_BLOBS = {
    "FOUNDATIONAL-RESULT.md": "5c2f0a3f57d9a809d2941f7c2459eff68855e926",
    "foundational-ledger.json": "a4c1fcb36a1283a15f5a021af568576359f91f00",
    "foundational-ledger.schema.json": "6a93f805dc157b2a2df66e47e034f857a716b200",
    "foundational-matrix.json": "d2cda8dd1c475706f2e9bfa0bd34ed547656b700",
    "foundational-matrix.schema.json": "bd88ee0b05383ac518af1d35fb1e2864598dc7d7",
    "test_foundational.py": "ef5bc7e3b7fe883bf8ed2abb0832d9bc96cbe703",
    "validate_foundational.py": "06ed0ffd0ad28d7bd2f40d0562c919d8c5508cf0",
    "implementation-receipt.json": "7c33b19ad27310232d2d05c0e6a6706c29fe4fc9",
    "implementation-receipt.schema.json": "e5ed4dfe442d64344a2d768c30f42501bb0b26ac",
    "validate_implementation.py": "de7941ca00cc65a3dfc3e353c2827cda3ce3015d",
    "qualification-receipt.json": "192852efd1035f37eb363f4e9afbe1938dc60e04",
    "qualification-receipt.schema.json": "95155f28bb4c69457a68b42cb3f500a89d2cf264",
    "validate_qualification.py": "1cc336ca25117852748a8a3e581eec8e74c442b1",
}


def fail(msg: str) -> None:
    raise ValueError(msg)


def exact_keys(obj, expected, where):
    if set(obj) != set(expected):
        fail(f"{where}: key mismatch: {set(obj) ^ set(expected)}")


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def validate_frozen_v03() -> None:
    v03 = REPO / "research/related-work-novelty-boundary-2025-2026/v0.3"
    for name, expected in V03_BLOBS.items():
        path = v03 / name
        if not path.is_file():
            fail(f"missing frozen v0.3 file: {name}")
        observed = git_blob_sha(path)
        if observed != expected:
            fail(f"frozen v0.3 blob drift: {name}: {observed} != {expected}")


def validate_data(ledger, matrix, *, check_frozen=False):
    exact_keys(ledger, ["schema", "audit_as_of", "predecessor", "public_anchor", "sources"], "ledger")
    if ledger["schema"] != "matawaka.semantic-escalation-taxonomy-ledger/v0.4" or ledger["audit_as_of"] != "2026-09-07" or ledger["predecessor"] != PRED or ledger["public_anchor"] != "2026-08-22":
        fail("ledger identity/anchor mismatch")
    if len(ledger["sources"]) < 12:
        fail("source corpus too small")

    source_ids = []
    sources = {}
    source_keys = ["id", "title", "first_public_date", "temporal_class", "status", "url", "date_basis", "promotion_targets", "named_failures", "tested", "overlap", "non_overlap"]
    for s in ledger["sources"]:
        exact_keys(s, source_keys, f"source:{s.get('id')}")
        sid = s["id"]
        if sid in sources:
            fail(f"duplicate source id: {sid}")
        source_ids.append(sid)
        sources[sid] = s
        if not s["promotion_targets"] or not set(s["promotion_targets"]).issubset(CLASS_IDS):
            fail(f"source {sid}: invalid promotion targets")
        if not s["overlap"] or not s["non_overlap"]:
            fail(f"source {sid}: overlap/non-overlap required")
        d = date.fromisoformat(s["first_public_date"])
        tc = s["temporal_class"]
        if tc == "PUBLIC_PREDECESSOR" and not d < ANCHOR:
            fail(f"source {sid}: predecessor date not before anchor")
        if tc == "PARALLEL_WINDOW" and d != ANCHOR:
            fail(f"source {sid}: parallel date must equal public anchor")
        if tc == "POST_PUBLICATION_CONVERGENCE" and not d > ANCHOR:
            fail(f"source {sid}: post-publication date not after anchor")

    required_sources = {
        "statebench-2025-12-21", "causality-laundering-2026-04-05", "apl-semantic-overclaim-2026-05-14",
        "airguard-authority-confusion-2026-05-27", "cap-pcl-context-attestation-2026-06-04",
        "wexp-core-2026-07-05", "eal-bench-2026-09-01", "cheney-provenance-causality-2010-04-19",
    }
    if not required_sources.issubset(sources):
        fail("mandatory taxonomy pressure source missing")

    exact_keys(matrix, ["schema", "predecessor", "top_result", "broad_taxonomy_claim_defeated", "narrow_candidate", "classes", "non_effects"], "matrix")
    if matrix["schema"] != "matawaka.semantic-escalation-promotion-matrix/v0.4" or matrix["predecessor"] != PRED:
        fail("matrix identity/predecessor mismatch")
    if matrix["top_result"] != "UNIFIED_CROSS_LAYER_BENCHMARK_CANDIDATE" or matrix["broad_taxonomy_claim_defeated"] is not True:
        fail("bounded top-level result was inflated or changed")
    nc = matrix["narrow_candidate"]
    if not isinstance(nc, str) or len(nc) < 80:
        fail("narrow candidate missing")
    lowered = nc.lower()
    if any(term in lowered for term in ["world-first", "world first", "novelty established", "first ever", "patentable"]):
        fail("narrow candidate contains promotion language")

    if len(matrix["classes"]) != 10:
        fail("promotion matrix must contain exactly ten classes")
    seen = set()
    class_keys = ["id", "promotion", "classification", "source_refs", "why", "residual_gap"]
    for c in matrix["classes"]:
        exact_keys(c, class_keys, f"class:{c.get('id')}")
        cid = c["id"]
        if cid not in CLASS_IDS or cid in seen:
            fail(f"invalid/duplicate class: {cid}")
        seen.add(cid)
        if c["classification"] != EXPECTED_CLASSIFICATION[cid]:
            fail(f"classification drift: {cid}")
        if not c["source_refs"] or not c["why"] or not c["residual_gap"]:
            fail(f"class {cid}: evidence/rationale required")
        refs = []
        for ref in c["source_refs"]:
            if ref not in sources:
                fail(f"class {cid}: unknown source ref {ref}")
            if cid not in sources[ref]["promotion_targets"]:
                fail(f"class {cid}: source {ref} not targeted to this promotion")
            refs.append(sources[ref])

        classification = c["classification"]
        predecessors = [s for s in refs if s["temporal_class"] == "PUBLIC_PREDECESSOR"]
        if classification == "PREDECESSOR_NAMED_AND_TESTED":
            if not any(s["tested"] and s["named_failures"] for s in predecessors):
                fail(f"class {cid}: no tested named predecessor")
        elif classification == "PREDECESSOR_NAMED_NOT_UNIFIED":
            if not predecessors:
                fail(f"class {cid}: no public predecessor")
        elif classification == "POST_PUBLICATION_CONVERGENCE":
            if not any(s["temporal_class"] == "POST_PUBLICATION_CONVERGENCE" and s["tested"] and s["named_failures"] for s in refs):
                fail(f"class {cid}: no qualifying post-publication convergence source")
        elif classification == "EXACT_MATERIALIZATION_NOT_FOUND_IN_BOUNDED_AUDIT":
            if any(s["temporal_class"] == "PUBLIC_PREDECESSOR" and s["tested"] and s["named_failures"] for s in refs):
                fail(f"class {cid}: exact-match absence contradicted by named tested predecessor")

    if seen != CLASS_IDS:
        fail("promotion classes incomplete")

    predecessor_class_count = sum(1 for c in matrix["classes"] if c["classification"].startswith("PREDECESSOR_"))
    if predecessor_class_count < 7:
        fail("broad taxonomy defeat not supported by enough predecessor classes")

    exact_keys(matrix["non_effects"], ["novelty_established", "world_first", "complete_prior_art_search", "foundational_novelty_revived", "v01_v02_v03_rewritten", "stable_core_changed", "poai_changed", "c2pa_changed", "runtime_changed", "merge_authorized"], "non_effects")
    if any(matrix["non_effects"].values()):
        fail("matrix contains promoted non-effect")

    if check_frozen:
        validate_frozen_v03()


def main():
    ledger = json.loads((BASE / "taxonomy-ledger.json").read_text(encoding="utf-8"))
    matrix = json.loads((BASE / "promotion-matrix.json").read_text(encoding="utf-8"))
    validate_data(ledger, matrix, check_frozen=True)
    print("PASS: v0.4 taxonomy audit is bounded, temporally disciplined, and v0.3-bound")


if __name__ == "__main__":
    main()
