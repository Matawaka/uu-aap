#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
PREDECESSOR = "8aabf16b791ac3564c8178c4bf1e325bba5df59e"
CANDIDATES = {"SNE_HEC", "COMMON_NON_EFFECTS", "AVAILABLE_CONSIDERED_AUTHORITY", "TYPED_CONTINUITY", "CROSS_DOMAIN_REUSE"}
RESULTS = {"SURVIVES_FOUNDATIONAL_PRESSURE", "MATERIALLY_NARROWED", "DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE", "INSUFFICIENT_EVIDENCE"}
EXPECTED = {
    "SNE_HEC": "DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE",
    "COMMON_NON_EFFECTS": "DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE",
    "AVAILABLE_CONSIDERED_AUTHORITY": "MATERIALLY_NARROWED",
    "TYPED_CONTINUITY": "DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE",
    "CROSS_DOMAIN_REUSE": "MATERIALLY_NARROWED",
}
V02_BLOBS = {
    "research/related-work-novelty-boundary-2025-2026/v0.2/PRESSURE-RESULT.md": "6041147cd81335d4574e9619cbd1401af88a2a09",
    "research/related-work-novelty-boundary-2025-2026/v0.2/README.md": "2f451696bb08a077d1653e33c07817170f4a3173",
    "research/related-work-novelty-boundary-2025-2026/v0.2/SOURCES.md": "5262ed35f42363bcfc233b9a6c05eeb4226d739d",
    "research/related-work-novelty-boundary-2025-2026/v0.2/STACKED-BASE.md": "e9bf79de9fb09a2276939e29ebe811ea96650c30",
    "research/related-work-novelty-boundary-2025-2026/v0.2/candidate-pressure-matrix.json": "1aaeb9452f105372a724852e90437b3873d59b33",
    "research/related-work-novelty-boundary-2025-2026/v0.2/candidate-pressure-matrix.schema.json": "c4fbc07f64a743f52780cc2c5c84958a7193b430",
    "research/related-work-novelty-boundary-2025-2026/v0.2/implementation-receipt.json": "10c0126005d3178647fed63015f63cd3984200f7",
    "research/related-work-novelty-boundary-2025-2026/v0.2/implementation-receipt.schema.json": "431571deea31443fcc51f186743eb3dfdb9edf30",
    "research/related-work-novelty-boundary-2025-2026/v0.2/pressure-ledger.json": "4a1ede17dbb32d694226e4fffdf670c054b8463d",
    "research/related-work-novelty-boundary-2025-2026/v0.2/pressure-ledger.schema.json": "cefa42d7f7620c626ac495a7ec2418aaeb7672a2",
    "research/related-work-novelty-boundary-2025-2026/v0.2/qualification-receipt.json": "745ddb08a249bd90067729a3181ea1ce7adb974f",
    "research/related-work-novelty-boundary-2025-2026/v0.2/qualification-receipt.schema.json": "a4c2208d1a12abbf1ad24aadacff729ebf92f3ec",
    "research/related-work-novelty-boundary-2025-2026/v0.2/test_pressure.py": "ffb0ba3c97cbc7b718d58892a06f8f88725e2354",
    "research/related-work-novelty-boundary-2025-2026/v0.2/validate_implementation.py": "e039ca27070b1d9e5bcf440ebe21fc3f653847fc",
    "research/related-work-novelty-boundary-2025-2026/v0.2/validate_pressure.py": "f673837b194fdde1dc9e35934ac2454d08354726",
    "research/related-work-novelty-boundary-2025-2026/v0.2/validate_qualification.py": "4fc9d775dc818e4a9e204d370b76dec4c7a5ba4c",
}


def fail(message: str) -> None:
    raise ValueError(message)


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def exact_keys(obj: dict[str, Any], keys: set[str], where: str) -> None:
    if set(obj) != keys:
        fail(f"{where}: key mismatch missing={sorted(keys-set(obj))} extra={sorted(set(obj)-keys)}")


def validate_data(ledger: dict[str, Any], matrix: dict[str, Any]) -> None:
    exact_keys(ledger, {"schema", "audit_as_of", "predecessor", "sources"}, "ledger")
    if ledger["schema"] != "matawaka.foundational-pressure-ledger/v0.3" or ledger["predecessor"] != PREDECESSOR or ledger["audit_as_of"] != "2026-09-07":
        fail("ledger identity/predecessor/date mismatch")
    if not isinstance(ledger["sources"], list) or len(ledger["sources"]) < 12:
        fail("foundational source coverage too small")

    ids: set[str] = set()
    families: set[str] = set()
    source_keys = {"id", "title", "public_date", "date_precision", "status", "family", "url", "date_basis", "pressure_targets", "overlap", "non_overlap"}
    for i, source in enumerate(ledger["sources"]):
        exact_keys(source, source_keys, f"source[{i}]")
        sid = source["id"]
        if sid in ids:
            fail(f"duplicate foundational source: {sid}")
        ids.add(sid)
        families.add(source["family"])
        try:
            observed_date = date.fromisoformat(source["public_date"])
        except Exception as exc:
            raise ValueError(f"invalid date: {sid}") from exc
        if observed_date.year >= 2025:
            fail(f"non-foundational source admitted to v0.3: {sid}")
        if source["date_precision"] == "MONTH" and observed_date.day != 1:
            fail(f"month-precision date must normalize to day 01: {sid}")
        if not source["pressure_targets"] or not set(source["pressure_targets"]).issubset(CANDIDATES):
            fail(f"invalid targets: {sid}")
        if not source["overlap"] or not source["non_overlap"]:
            fail(f"source must preserve overlap/non-overlap: {sid}")

    required_families = {"INFORMATION_FLOW", "EFFECTS_FRAMES", "AUTHORIZATION_LOGIC", "AGENT_EPISTEMICS_INTENT", "CHOICE_AWARENESS", "PROVENANCE_ALGEBRA", "DOMAIN_NEUTRAL_PROVENANCE", "ACTION_ARTIFACT_PROVENANCE"}
    if not required_families.issubset(families):
        fail(f"foundational family coverage incomplete: {sorted(required_families-families)}")

    exact_keys(matrix, {"schema", "predecessor", "claims"}, "matrix")
    if matrix["schema"] != "matawaka.foundational-pressure-matrix/v0.3" or matrix["predecessor"] != PREDECESSOR:
        fail("matrix identity/predecessor mismatch")
    if not isinstance(matrix["claims"], list) or len(matrix["claims"]) != 5:
        fail("matrix must contain exactly five claims")

    claim_keys = {"id", "v02_claim", "result", "foundational_sources", "pressure_reason", "surviving_claim", "engineering_value", "forbidden_claims", "required_next_evidence", "novelty_established"}
    seen: set[str] = set()
    for i, claim in enumerate(matrix["claims"]):
        exact_keys(claim, claim_keys, f"claim[{i}]")
        cid = claim["id"]
        if cid not in CANDIDATES or cid in seen:
            fail(f"invalid/duplicate claim: {cid}")
        seen.add(cid)
        if claim["result"] not in RESULTS or claim["result"] != EXPECTED[cid]:
            fail(f"qualified foundational result drift: {cid}")
        if claim["novelty_established"] is not False:
            fail(f"novelty promotion: {cid}")
        refs = claim["foundational_sources"]
        if not refs or len(refs) != len(set(refs)) or not set(refs).issubset(ids):
            fail(f"invalid foundational refs: {cid}")
        if not claim["pressure_reason"] or not claim["engineering_value"] or not claim["forbidden_claims"] or not claim["required_next_evidence"]:
            fail(f"bounded reasoning incomplete: {cid}")
        if claim["result"] == "DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE" and claim["surviving_claim"] is not None:
            fail(f"defeated foundational claim retained as novelty: {cid}")
        if claim["result"] == "MATERIALLY_NARROWED" and not claim["surviving_claim"]:
            fail(f"narrowed claim missing surviving integration hypothesis: {cid}")
        positive = str(claim["surviving_claim"] or "").lower()
        for phrase in ("world-first", "world first", "novelty established", "patentable", "first in the world", "no prior art"):
            if phrase in positive:
                fail(f"forbidden positive novelty language: {cid}: {phrase}")

    if seen != CANDIDATES:
        fail("foundational claim set mismatch")

    by_id = {c["id"]: c for c in matrix["claims"]}
    required_pressure = {
        "SNE_HEC": {"denning-lattice-1976", "pca-2001", "policy-composition-2002"},
        "COMMON_NON_EFFECTS": {"lucassen-gifford-effects-1988", "local-reasoning-2001"},
        "AVAILABLE_CONSIDERED_AUTHORITY": {"fagin-halpern-awareness-1987", "gensch-soofi-consideration-1995", "w3c-prov-2013"},
        "TYPED_CONTINUITY": {"cohen-levesque-intention-1990", "boid-2001", "pca-2001", "w3c-prov-2013"},
        "CROSS_DOMAIN_REUSE": {"opm-2011", "w3c-prov-2013"},
    }
    for cid, required in required_pressure.items():
        missing = required - set(by_id[cid]["foundational_sources"])
        if missing:
            fail(f"required foundational pressure missing: {cid}: {sorted(missing)}")

    counts = {r: 0 for r in RESULTS}
    for claim in matrix["claims"]:
        counts[claim["result"]] += 1
    if counts["DEFEATED_AS_FOUNDATIONAL_NOVELTY_CANDIDATE"] != 3 or counts["MATERIALLY_NARROWED"] != 2 or counts["SURVIVES_FOUNDATIONAL_PRESSURE"] != 0:
        fail(f"foundational result-count drift: {counts}")


def validate_v02_blobs(repo_root: Path = ROOT) -> None:
    for path, expected in V02_BLOBS.items():
        p = subprocess.run(["git", "rev-parse", f"HEAD:{path}"], cwd=repo_root, text=True, capture_output=True)
        if p.returncode != 0:
            fail(f"frozen v0.2 path missing: {path}")
        if p.stdout.strip() != expected:
            fail(f"frozen v0.2 blob drift: {path}")


def validate_repository() -> None:
    validate_data(load(BASE / "foundational-ledger.json"), load(BASE / "foundational-matrix.json"))
    validate_v02_blobs()


if __name__ == "__main__":
    validate_repository()
    print("PASS: v0.3 foundational pressure result is internally consistent and v0.2 remains frozen")
