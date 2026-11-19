#!/usr/bin/env python3
"""Hostile tests for the Related Work & Novelty Boundary validator."""

from __future__ import annotations

import copy
import json
import pathlib

from validate_landscape import validate_documents

ROOT = pathlib.Path(__file__).resolve().parent


def load(name: str):
    with (ROOT / name).open("r", encoding="utf-8") as fh:
        return json.load(fh)


def expect_fail(label, ledger, matrix, contains=None):
    try:
        validate_documents(ledger, matrix)
    except ValueError as exc:
        if contains is not None and contains not in str(exc):
            raise AssertionError(f"{label}: wrong failure: {exc}") from exc
        return
    raise AssertionError(f"{label}: mutation unexpectedly passed")


def main():
    ledger = load("source-ledger.json")
    matrix = load("claim-matrix.json")

    validate_documents(ledger, matrix)
    passed = 1

    # 1. Duplicate source inflation.
    bad = copy.deepcopy(ledger)
    bad["sources"].append(copy.deepcopy(bad["sources"][0]))
    expect_fail("duplicate source", bad, matrix, "duplicate source id")
    passed += 1

    # 2. Unknown source referenced by a claim.
    bad_matrix = copy.deepcopy(matrix)
    bad_matrix["claims"][0]["basis_sources"].append("invented-source")
    expect_fail("unknown source", ledger, bad_matrix, "unknown basis sources")
    passed += 1

    # 3. Post-publication convergence cannot be relabeled as predecessor.
    bad = copy.deepcopy(ledger)
    source = next(s for s in bad["sources"] if s["id"] == "agentminder-2026")
    source["temporal_class"] = "PUBLIC_PREDECESSOR"
    source["novelty_effect"] = "DEFEATS_BROAD_CLAIM"
    expect_fail("post to predecessor", bad, matrix, "predecessor date enters conservative parallel window")
    passed += 1

    # 4. Pre-publication source cannot be relabeled as convergence-only.
    bad = copy.deepcopy(ledger)
    source = next(s for s in bad["sources"] if s["id"] == "intent-token-2026")
    source["novelty_effect"] = "POST_PUBLICATION_CONVERGENCE_ONLY"
    expect_fail("false convergence", bad, matrix, "convergence-only effect requires post-publication temporal class")
    passed += 1

    # 5. A crowded broad claim needs an actual defeating predecessor.
    bad_matrix = copy.deepcopy(matrix)
    claim = next(c for c in bad_matrix["claims"] if c["id"] == "pre-action-agent-authorization")
    claim["basis_sources"] = ["ethical-llm-assisted-research-2026"]
    expect_fail("crowded without defeating predecessor", ledger, bad_matrix, "crowded claim needs")
    passed += 1

    # 6. Post-publication convergence cannot be the sole basis for a novelty candidate.
    bad_matrix = copy.deepcopy(matrix)
    claim = next(c for c in bad_matrix["claims"] if c["id"] == "semantic-non-escalation")
    claim["basis_sources"] = ["stored-is-not-supported-2026"]
    expect_fail("post-only novelty", ledger, bad_matrix, "needs at least one pre-parallel public predecessor")
    passed += 1

    # 7. Novelty candidates cannot silently become world-first claims.
    bad_matrix = copy.deepcopy(matrix)
    claim = next(c for c in bad_matrix["claims"] if c["id"] == "explicit-machine-readable-non-effects")
    claim["surviving_narrow_claim"] = "This is a world-first machine-readable receipt system."
    expect_fail("world first", ledger, bad_matrix, "prohibited positive claim phrase")
    passed += 1

    # 8. Patentability cannot be inferred by wording drift.
    bad_matrix = copy.deepcopy(matrix)
    claim = next(c for c in bad_matrix["claims"] if c["id"] == "available-versus-considered-intelligence")
    claim["statement"] = "A patentable protocol separates available and considered intelligence."
    expect_fail("patentability", ledger, bad_matrix, "prohibited positive claim phrase")
    passed += 1

    # 9. Matawaka public anchors are immutable inside this audit version.
    bad = copy.deepcopy(ledger)
    bad["matawaka_public_anchor"]["repository_created"] = "2026-08-21"
    expect_fail("anchor rewrite", bad, matrix, "public anchors changed")
    passed += 1

    # 10. Conservative parallel window cannot be silently moved into post-publication.
    bad = copy.deepcopy(ledger)
    source = next(s for s in bad["sources"] if s["id"] == "cawg-identity-1.3-2026")
    source["temporal_class"] = "POST_PUBLICATION_CONVERGENCE"
    source["novelty_effect"] = "POST_PUBLICATION_CONVERGENCE_ONLY"
    expect_fail("parallel to post", bad, matrix, "post-publication source not later than parallel window")
    passed += 1

    # 11. Month-precision sources are calendar-validated.
    bad = copy.deepcopy(ledger)
    source = next(s for s in bad["sources"] if s["id"] == "scitt-rfc9943-2026")
    source["first_public_date"] = "2026-19"
    expect_fail("invalid month", bad, matrix, "invalid MONTH date")
    passed += 1

    # 12. Unknown fields fail closed.
    bad_matrix = copy.deepcopy(matrix)
    bad_matrix["claims"][0]["confidence_score"] = 0.99
    expect_fail("unknown claim field", ledger, bad_matrix, "key mismatch")
    passed += 1

    # 13. A novelty candidate must retain a bounded surviving claim.
    bad_matrix = copy.deepcopy(matrix)
    claim = next(c for c in bad_matrix["claims"] if c["id"] == "seven-layer-typed-continuity")
    claim["surviving_narrow_claim"] = None
    expect_fail("missing surviving claim", ledger, bad_matrix, "needs a bounded surviving_narrow_claim")
    passed += 1

    # 14. Duplicate basis references cannot inflate support.
    bad_matrix = copy.deepcopy(matrix)
    claim = next(c for c in bad_matrix["claims"] if c["id"] == "provenance-not-permission")
    claim["basis_sources"].append(claim["basis_sources"][0])
    expect_fail("duplicate basis", ledger, bad_matrix, "duplicate basis source")
    passed += 1

    # 15. A post-publication source cannot carry a novelty-defeating effect.
    bad = copy.deepcopy(ledger)
    source = next(s for s in bad["sources"] if s["id"] == "stored-is-not-supported-2026")
    source["novelty_effect"] = "MATERIALLY_NARROWS_CLAIM"
    expect_fail("post publication narrowing", bad, matrix, "cannot defeat or narrow")
    passed += 1

    print(f"PASS: {passed}/16 baseline+hostile landscape checks")


if __name__ == "__main__":
    main()
