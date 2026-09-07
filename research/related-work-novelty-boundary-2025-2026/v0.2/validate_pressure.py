#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import subprocess
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
PREDECESSOR = "80850c1fb3da81b5af40049b35473e4c50123218"
PUBLIC_ANCHOR = date(2026, 8, 22)
CANDIDATE_IDS = {
    "SNE_HEC",
    "COMMON_NON_EFFECTS",
    "AVAILABLE_CONSIDERED_AUTHORITY",
    "TYPED_CONTINUITY",
    "CROSS_DOMAIN_REUSE",
}
RESULTS = {
    "SURVIVES_BOUNDED_PRESSURE",
    "MATERIALLY_NARROWED",
    "DEFEATED_AS_NOVELTY_CANDIDATE",
    "INSUFFICIENT_EVIDENCE",
}
EXPECTED_RESULTS = {
    "SNE_HEC": "MATERIALLY_NARROWED",
    "COMMON_NON_EFFECTS": "MATERIALLY_NARROWED",
    "AVAILABLE_CONSIDERED_AUTHORITY": "MATERIALLY_NARROWED",
    "TYPED_CONTINUITY": "MATERIALLY_NARROWED",
    "CROSS_DOMAIN_REUSE": "SURVIVES_BOUNDED_PRESSURE",
}
V01_BLOBS = {
    "research/related-work-novelty-boundary-2025-2026/v0.1/NOVELTY-BOUNDARY.md": "e34249ea02fdfc13b87fd4d91a1deac134522077",
    "research/related-work-novelty-boundary-2025-2026/v0.1/README.md": "7390ea7e74535bc71d860df12d1f5ef226b5b5b2",
    "research/related-work-novelty-boundary-2025-2026/v0.1/claim-matrix.json": "aec9e1e7a1f6d2a82fbe6e04d05f909ea761d40b",
    "research/related-work-novelty-boundary-2025-2026/v0.1/claim-matrix.schema.json": "066faf2091715951dd9f01a1afa18da80ccc0c46",
    "research/related-work-novelty-boundary-2025-2026/v0.1/source-ledger.json": "9397a8a3addd4265ecaf5dc6e60b5001d7b171a4",
    "research/related-work-novelty-boundary-2025-2026/v0.1/source-ledger.schema.json": "bfbdc4595d318164a18d908f1f63be75252f0881",
    "research/related-work-novelty-boundary-2025-2026/v0.1/test_landscape.py": "0e86000120f8bf066b8a325d6b447346ad229a7a",
    "research/related-work-novelty-boundary-2025-2026/v0.1/validate_landscape.py": "2077b5caff4989205981c4e5b6a3faa69c663d75",
    "research/related-work-novelty-boundary-2025-2026/v0.1/qualification-receipt.json": "f1ff3e93a4ae200837d91f471df71d691f45b9ea",
    "research/related-work-novelty-boundary-2025-2026/v0.1/qualification-receipt.schema.json": "0cdcc710cbeb5cc6c15e04a204270064156c0154",
}
FORBIDDEN_PROMOTIONS = (
    "world-first",
    "world first",
    "novelty established",
    "patentable",
    "no prior art",
    "first in the world",
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def fail(msg: str) -> None:
    raise ValueError(msg)


def _require_keys(obj: dict[str, Any], required: set[str], allowed: set[str], where: str) -> None:
    missing = required - obj.keys()
    extra = obj.keys() - allowed
    if missing:
        fail(f"{where}: missing keys {sorted(missing)}")
    if extra:
        fail(f"{where}: unexpected keys {sorted(extra)}")


def validate_data(ledger: dict[str, Any], matrix: dict[str, Any]) -> None:
    _require_keys(ledger, {"schema", "audit_as_of", "predecessor", "sources"}, {"schema", "audit_as_of", "predecessor", "sources"}, "ledger")
    if ledger["schema"] != "matawaka.novelty-pressure-ledger/2025-2026/v0.2":
        fail("ledger schema mismatch")
    if ledger["predecessor"] != PREDECESSOR:
        fail("ledger predecessor mismatch")
    if ledger["audit_as_of"] != "2026-09-07":
        fail("ledger audit date mismatch")
    if not isinstance(ledger["sources"], list) or len(ledger["sources"]) < 8:
        fail("insufficient pressure sources")

    source_ids: set[str] = set()
    for idx, src in enumerate(ledger["sources"]):
        required = {"id", "title", "first_public_date", "status", "url", "date_basis", "pressure_targets", "overlap", "non_overlap"}
        _require_keys(src, required, required, f"source[{idx}]")
        if src["id"] in source_ids:
            fail(f"duplicate source id: {src['id']}")
        source_ids.add(src["id"])
        try:
            d = date.fromisoformat(src["first_public_date"])
        except Exception as exc:
            raise ValueError(f"invalid date for {src['id']}") from exc
        if d >= PUBLIC_ANCHOR:
            fail(f"pressure predecessor is not pre-anchor: {src['id']}")
        if not src["pressure_targets"] or not set(src["pressure_targets"]).issubset(CANDIDATE_IDS):
            fail(f"invalid pressure target for {src['id']}")
        if not src["overlap"] or not src["non_overlap"]:
            fail(f"source must preserve overlap and non-overlap: {src['id']}")

    _require_keys(matrix, {"schema", "predecessor", "candidates"}, {"schema", "predecessor", "candidates"}, "matrix")
    if matrix["schema"] != "matawaka.novelty-pressure-matrix/2025-2026/v0.2":
        fail("matrix schema mismatch")
    if matrix["predecessor"] != PREDECESSOR:
        fail("matrix predecessor mismatch")
    if not isinstance(matrix["candidates"], list) or len(matrix["candidates"]) != 5:
        fail("matrix must contain exactly five candidates")

    seen: set[str] = set()
    for idx, c in enumerate(matrix["candidates"]):
        required = {"id", "v01_claim", "result", "pressure_sources", "pressure_reason", "surviving_claim", "forbidden_claims", "required_next_evidence", "novelty_established"}
        _require_keys(c, required, required, f"candidate[{idx}]")
        cid = c["id"]
        if cid not in CANDIDATE_IDS or cid in seen:
            fail(f"invalid or duplicate candidate id: {cid}")
        seen.add(cid)
        if c["result"] not in RESULTS:
            fail(f"invalid result for {cid}")
        if c["result"] != EXPECTED_RESULTS[cid]:
            fail(f"qualified v0.2 result drift for {cid}")
        if c["novelty_established"] is not False:
            fail(f"novelty promotion forbidden for {cid}")
        refs = c["pressure_sources"]
        if not refs or len(refs) != len(set(refs)) or not set(refs).issubset(source_ids):
            fail(f"invalid pressure-source references for {cid}")
        if not c["pressure_reason"] or not c["forbidden_claims"] or not c["required_next_evidence"]:
            fail(f"missing bounded reasoning for {cid}")
        if c["result"] in {"MATERIALLY_NARROWED", "SURVIVES_BOUNDED_PRESSURE"} and not c["surviving_claim"]:
            fail(f"surviving claim required for {cid}")
        if c["result"] == "DEFEATED_AS_NOVELTY_CANDIDATE" and c["surviving_claim"] is not None:
            fail(f"defeated candidate cannot retain a surviving claim: {cid}")
        text = " ".join([str(c["v01_claim"]), str(c["surviving_claim"]), *c["forbidden_claims"]]).lower()
        for phrase in FORBIDDEN_PROMOTIONS:
            if phrase in str(c["surviving_claim"] or "").lower():
                fail(f"positive novelty promotion in surviving claim {cid}: {phrase}")

    if seen != CANDIDATE_IDS:
        fail("candidate set mismatch")

    required_pressure = {
        "COMMON_NON_EFFECTS": "oplogica-verification-discipline-2026-06-06",
        "AVAILABLE_CONSIDERED_AUTHORITY": "observation-missingness-2026-05-12",
        "TYPED_CONTINUITY": "soos-idp-2026-05-10",
        "SNE_HEC": "ep-aec-2026-06-22",
    }
    by_id = {c["id"]: c for c in matrix["candidates"]}
    for cid, sid in required_pressure.items():
        if sid not in by_id[cid]["pressure_sources"]:
            fail(f"required predecessor pressure missing: {cid} -> {sid}")


def validate_v01_blobs(repo_root: Path = ROOT) -> None:
    for path, expected in V01_BLOBS.items():
        proc = subprocess.run(["git", "rev-parse", f"HEAD:{path}"], cwd=repo_root, text=True, capture_output=True)
        if proc.returncode != 0:
            fail(f"v0.1 predecessor path missing: {path}")
        observed = proc.stdout.strip()
        if observed != expected:
            fail(f"v0.1 predecessor blob drift: {path}: {observed} != {expected}")


def validate_repository() -> None:
    ledger = load_json(BASE / "pressure-ledger.json")
    matrix = load_json(BASE / "candidate-pressure-matrix.json")
    validate_data(ledger, matrix)
    validate_v01_blobs()


if __name__ == "__main__":
    validate_repository()
    print("PASS: v0.2 novelty pressure ledger, candidate matrix, and frozen v0.1 bindings are consistent")
