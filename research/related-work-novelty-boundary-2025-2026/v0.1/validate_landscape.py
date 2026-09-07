#!/usr/bin/env python3
"""Fail-closed validator for Related Work & Novelty Boundary 2025–2026 v0.1.

Stdlib-only by design. The JSON Schemas remain the interchange contract; this
validator adds cross-document and semantic guards that JSON Schema alone cannot
express cleanly.
"""

from __future__ import annotations

import copy
import datetime as dt
import json
import pathlib
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent

LEDGER_SCHEMA = "matawaka.related-work-source-ledger/2025-2026/v0.1"
MATRIX_SCHEMA = "matawaka.related-work-claim-matrix/2025-2026/v0.1"
AUDIT_AS_OF = "2026-09-07"

STATUS_CLASSES = {
    "IETF_CONSENSUS_RFC",
    "INDIVIDUAL_INTERNET_DRAFT",
    "STANDARDS_BODY_DRAFT",
    "STANDARDS_BODY_RATIFIED",
    "PEER_REVIEWED_ARTICLE",
    "PREPRINT",
    "INDUSTRY_ANNOUNCEMENT",
    "PUBLIC_GITHUB_PROPOSAL",
    "PROJECT_PUBLICATION",
}
TEMPORAL_CLASSES = {
    "PUBLIC_PREDECESSOR",
    "PARALLEL_WINDOW",
    "POST_PUBLICATION_CONVERGENCE",
}
NOVELTY_EFFECTS = {
    "DEFEATS_BROAD_CLAIM",
    "MATERIALLY_NARROWS_CLAIM",
    "ADJACENT_ONLY",
    "POST_PUBLICATION_CONVERGENCE_ONLY",
}
POSTURES = {
    "CROWDED_BROAD_CLAIM",
    "PARTIALLY_OVERLAPPED",
    "NOVELTY_CANDIDATE",
    "POST_PUBLICATION_CONVERGENCE_ONLY",
    "UNRESOLVED",
}

# The audit intentionally treats 17–24 Aug as a narrow parallel-publication
# window. This is conservative: chronology alone is not used to infer influence.
PARALLEL_START = dt.date(2026, 8, 17)
PARALLEL_END = dt.date(2026, 8, 24)

FORBIDDEN_POSITIVE_NOVELTY_PHRASES = {
    "world-first",
    "world first",
    "first in the world",
    "proven novel",
    "novelty established",
    "patentable",
    "patent novelty established",
    "no prior art exists",
    "no predecessor exists",
}


def fail(message: str) -> None:
    raise ValueError(message)


def read_json(path: pathlib.Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        value = json.load(fh)
    if not isinstance(value, dict):
        fail(f"{path.name}: top level must be object")
    return value


def parse_source_date(value: str, precision: str) -> tuple[dt.date, dt.date]:
    """Return inclusive first/last possible day represented by source date."""
    if precision == "DAY":
        try:
            day = dt.date.fromisoformat(value)
        except ValueError as exc:
            fail(f"invalid DAY date {value!r}: {exc}")
        return day, day
    if precision == "MONTH":
        try:
            year_s, month_s = value.split("-")
            year, month = int(year_s), int(month_s)
            first = dt.date(year, month, 1)
            if month == 12:
                next_month = dt.date(year + 1, 1, 1)
            else:
                next_month = dt.date(year, month + 1, 1)
            return first, next_month - dt.timedelta(days=1)
        except Exception as exc:
            fail(f"invalid MONTH date {value!r}: {exc}")
    fail(f"unknown date_precision {precision!r}")


def require_exact_keys(obj: dict[str, Any], required: set[str], label: str) -> None:
    keys = set(obj)
    if keys != required:
        missing = sorted(required - keys)
        extra = sorted(keys - required)
        fail(f"{label}: key mismatch missing={missing} extra={extra}")


def require_nonempty_strings(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not value:
        fail(f"{label}: must be non-empty array")
    for i, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            fail(f"{label}[{i}]: must be non-empty string")
    return value


def validate_ledger(ledger: dict[str, Any]) -> dict[str, dict[str, Any]]:
    require_exact_keys(
        ledger,
        {
            "schema",
            "audit_as_of",
            "matawaka_public_anchor",
            "status_classes",
            "temporal_classes",
            "sources",
        },
        "ledger",
    )
    if ledger["schema"] != LEDGER_SCHEMA:
        fail("ledger schema mismatch")
    if ledger["audit_as_of"] != AUDIT_AS_OF:
        fail("ledger audit_as_of mismatch")
    anchors = ledger["matawaka_public_anchor"]
    if anchors != {
        "repository_created": "2026-08-22",
        "poai_compositional_anchor": "2026-08-22",
        "stable_core_anchor": "2026-08-24",
        "gateway_anchor": "2026-08-24",
    }:
        fail("Matawaka public anchors changed without successor audit")
    if set(ledger["status_classes"]) != STATUS_CLASSES:
        fail("status class vocabulary drift")
    if set(ledger["temporal_classes"]) != TEMPORAL_CLASSES:
        fail("temporal class vocabulary drift")

    sources = ledger["sources"]
    if not isinstance(sources, list) or not sources:
        fail("sources must be a non-empty array")

    required_source_keys = {
        "id",
        "title",
        "first_public_date",
        "date_precision",
        "source_status",
        "temporal_class",
        "url",
        "cluster",
        "overlap",
        "non_overlap",
        "novelty_effect",
        "status_limitations",
    }
    by_id: dict[str, dict[str, Any]] = {}
    for i, source in enumerate(sources):
        if not isinstance(source, dict):
            fail(f"source[{i}] must be object")
        require_exact_keys(source, required_source_keys, f"source[{i}]")
        source_id = source["id"]
        if not isinstance(source_id, str) or not source_id:
            fail(f"source[{i}].id invalid")
        if source_id in by_id:
            fail(f"duplicate source id {source_id}")
        if source["source_status"] not in STATUS_CLASSES:
            fail(f"{source_id}: unsupported source_status")
        if source["temporal_class"] not in TEMPORAL_CLASSES:
            fail(f"{source_id}: unsupported temporal_class")
        if source["novelty_effect"] not in NOVELTY_EFFECTS:
            fail(f"{source_id}: unsupported novelty_effect")
        if not isinstance(source["title"], str) or not source["title"].strip():
            fail(f"{source_id}: title required")
        if not isinstance(source["url"], str) or not source["url"].startswith("https://"):
            fail(f"{source_id}: HTTPS URL required")
        require_nonempty_strings(source["overlap"], f"{source_id}.overlap")
        require_nonempty_strings(source["non_overlap"], f"{source_id}.non_overlap")
        require_nonempty_strings(source["status_limitations"], f"{source_id}.status_limitations")

        first, last = parse_source_date(source["first_public_date"], source["date_precision"])
        temporal = source["temporal_class"]
        if temporal == "PUBLIC_PREDECESSOR" and last >= PARALLEL_START:
            fail(f"{source_id}: predecessor date enters conservative parallel window")
        if temporal == "PARALLEL_WINDOW" and (last < PARALLEL_START or first > PARALLEL_END):
            fail(f"{source_id}: parallel-window date outside 2026-08-17..2026-08-24")
        if temporal == "POST_PUBLICATION_CONVERGENCE" and first <= PARALLEL_END:
            fail(f"{source_id}: post-publication source not later than parallel window")
        if temporal == "POST_PUBLICATION_CONVERGENCE" and source["novelty_effect"] != "POST_PUBLICATION_CONVERGENCE_ONLY":
            fail(f"{source_id}: post-publication source cannot defeat or narrow pre-existing novelty")
        if temporal != "POST_PUBLICATION_CONVERGENCE" and source["novelty_effect"] == "POST_PUBLICATION_CONVERGENCE_ONLY":
            fail(f"{source_id}: convergence-only effect requires post-publication temporal class")

        by_id[source_id] = source

    return by_id


def validate_matrix(matrix: dict[str, Any], sources: dict[str, dict[str, Any]]) -> None:
    require_exact_keys(matrix, {"schema", "audit_as_of", "claims"}, "matrix")
    if matrix["schema"] != MATRIX_SCHEMA:
        fail("matrix schema mismatch")
    if matrix["audit_as_of"] != AUDIT_AS_OF:
        fail("matrix audit_as_of mismatch")
    claims = matrix["claims"]
    if not isinstance(claims, list) or not claims:
        fail("claims must be a non-empty array")

    required_claim_keys = {
        "id",
        "statement",
        "posture",
        "public_anchor",
        "basis_sources",
        "overlap_summary",
        "surviving_narrow_claim",
        "forbidden_claims",
        "required_next_evidence",
    }
    seen: set[str] = set()
    for i, claim in enumerate(claims):
        if not isinstance(claim, dict):
            fail(f"claim[{i}] must be object")
        require_exact_keys(claim, required_claim_keys, f"claim[{i}]")
        claim_id = claim["id"]
        if not isinstance(claim_id, str) or not claim_id:
            fail(f"claim[{i}].id invalid")
        if claim_id in seen:
            fail(f"duplicate claim id {claim_id}")
        seen.add(claim_id)
        if claim["posture"] not in POSTURES:
            fail(f"{claim_id}: unsupported posture")
        if claim["public_anchor"] not in {"2026-08-22", "2026-08-24"}:
            fail(f"{claim_id}: unsupported public anchor")
        if not isinstance(claim["statement"], str) or not claim["statement"].strip():
            fail(f"{claim_id}: statement required")
        basis_ids = require_nonempty_strings(claim["basis_sources"], f"{claim_id}.basis_sources")
        if len(basis_ids) != len(set(basis_ids)):
            fail(f"{claim_id}: duplicate basis source")
        unknown = sorted(set(basis_ids) - set(sources))
        if unknown:
            fail(f"{claim_id}: unknown basis sources {unknown}")
        require_nonempty_strings(claim["overlap_summary"], f"{claim_id}.overlap_summary")
        require_nonempty_strings(claim["forbidden_claims"], f"{claim_id}.forbidden_claims")
        require_nonempty_strings(claim["required_next_evidence"], f"{claim_id}.required_next_evidence")
        if claim["surviving_narrow_claim"] is not None and (
            not isinstance(claim["surviving_narrow_claim"], str) or not claim["surviving_narrow_claim"].strip()
        ):
            fail(f"{claim_id}: surviving_narrow_claim must be non-empty string or null")

        basis = [sources[sid] for sid in basis_ids]
        predecessor_basis = [s for s in basis if s["temporal_class"] == "PUBLIC_PREDECESSOR"]
        post_basis = [s for s in basis if s["temporal_class"] == "POST_PUBLICATION_CONVERGENCE"]

        if claim["posture"] == "CROWDED_BROAD_CLAIM":
            if not any(s["novelty_effect"] == "DEFEATS_BROAD_CLAIM" for s in predecessor_basis):
                fail(f"{claim_id}: crowded claim needs a public predecessor that defeats the broad claim")
        if claim["posture"] in {"NOVELTY_CANDIDATE", "PARTIALLY_OVERLAPPED", "UNRESOLVED"}:
            if not predecessor_basis:
                fail(f"{claim_id}: bounded comparison needs at least one pre-parallel public predecessor")
        if claim["posture"] != "POST_PUBLICATION_CONVERGENCE_ONLY" and basis and len(post_basis) == len(basis):
            fail(f"{claim_id}: post-publication convergence cannot be sole novelty basis")

        if claim["posture"] == "NOVELTY_CANDIDATE":
            positive_text = " ".join(
                x for x in [claim["statement"], claim["surviving_narrow_claim"] or ""] if x
            ).lower()
            for phrase in FORBIDDEN_POSITIVE_NOVELTY_PHRASES:
                if phrase in positive_text:
                    fail(f"{claim_id}: novelty candidate contains prohibited positive claim phrase {phrase!r}")
            if claim["surviving_narrow_claim"] is None:
                fail(f"{claim_id}: novelty candidate needs a bounded surviving_narrow_claim")


def validate_documents(ledger: dict[str, Any], matrix: dict[str, Any]) -> None:
    sources = validate_ledger(ledger)
    validate_matrix(matrix, sources)


def main() -> int:
    try:
        ledger = read_json(ROOT / "source-ledger.json")
        matrix = read_json(ROOT / "claim-matrix.json")
        validate_documents(ledger, matrix)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("PASS: related-work source ledger and novelty claim matrix are internally consistent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
