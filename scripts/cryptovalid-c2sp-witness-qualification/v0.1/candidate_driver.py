#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path

SCHEMA = "urn:uu-aap:cryptovalid-candidate-observation:0.1"
WITNESS_NAME = "uu-aap-witness"
WITNESS_SEED = hashlib.sha256(b"uu-aap-c2sp-witness-ed25519-v0.1").digest()
PQ_SEED = hashlib.sha256(b"uu-aap-c2sp-witness-mldsa44-v0.1").digest()


def load_fixture(root: Path, name: str) -> bytes:
    return (root / name).read_bytes()


def classify_refusal(result: dict) -> str:
    ev = result.get("evidenza")
    if isinstance(ev, dict):
        tipo = ev.get("tipo")
        if tipo == "split-view":
            return "REJECT_CONFLICT_SAME_SIZE"
        if tipo == "rollback":
            return "REJECT_ROLLBACK"
        if tipo == "unproven-extension":
            return "REJECT_INCONSISTENT_EXTENSION"
    motivo = str(result.get("motivo") or "")
    if "signature" in motivo.lower():
        return "REJECT_INVALID_SIGNATURE"
    return "REJECT_OTHER"


def compact(result: dict) -> dict:
    return {
        "stato": result.get("stato"),
        "motivo": result.get("motivo"),
        "http_status": result.get("http_status"),
        "stored_size": result.get("stored_size"),
        "origin": result.get("origin"),
        "size": result.get("size"),
        "evidence": result.get("evidenza"),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate-root", required=True)
    ap.add_argument("--fixtures", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    candidate_root = Path(args.candidate_root).resolve()
    fixtures = Path(args.fixtures).resolve()
    sys.path.insert(0, str(candidate_root))
    import cryptovalid_checkpoint as C
    import cryptovalid_witness as W

    metadata = json.loads((fixtures / "metadata.json").read_text(encoding="utf-8"))
    log_vkey = metadata["log_vkey"]
    proof = metadata["consistency_proof_b64"]
    first = load_fixture(fixtures, "first.note")
    successor = load_fixture(fixtures, "successor.note")
    fork = load_fixture(fixtures, "fork.note")
    tampered = load_fixture(fixtures, "tampered.note")

    state = fixtures / "candidate-state.json"
    for suffix in ("", ".lock", ".evidence.jsonl", ".cosigned.jsonl"):
        p = Path(str(state) + suffix)
        if p.exists():
            p.unlink()

    ed_vkey = C.vkey(WITNESS_NAME, C.TYPE_COSIG_V1, C.pubkey_from_seed(WITNESS_SEED))
    pq_vkey = C.vkey(WITNESS_NAME, C.TYPE_MLDSA44, C.mldsa44_pubkey_from_seed(PQ_SEED))

    first_r = W.witness_cosign(
        str(state), first, log_vkey, WITNESS_NAME, WITNESS_SEED,
        consistency_proof_b64=[], timestamp=1700000001,
        expected_origin=metadata["origin"], pq_seed=PQ_SEED,
    )
    first_sem = "ACCEPT_FIRST" if first_r.get("stato") == W.STATO_OK else classify_refusal(first_r)

    threshold_1 = W.verify_witnessed(
        first_r["note"], log_vkey, [ed_vkey, pq_vkey],
        min_witnesses=1, expected_origin=metadata["origin"],
    ) if first_r.get("note") else {"stato": "NOT_RUN"}
    threshold_2 = W.verify_witnessed(
        first_r["note"], log_vkey, [ed_vkey, pq_vkey],
        min_witnesses=2, expected_origin=metadata["origin"],
    ) if first_r.get("note") else {"stato": "NOT_RUN"}

    successor_r = W.witness_cosign(
        str(state), successor, log_vkey, WITNESS_NAME, WITNESS_SEED,
        consistency_proof_b64=proof, timestamp=1700000002,
        expected_origin=metadata["origin"], pq_seed=PQ_SEED,
    )
    successor_sem = "ACCEPT_SUCCESSOR" if successor_r.get("stato") == W.STATO_OK else classify_refusal(successor_r)

    rollback_r = W.witness_cosign(
        str(state), first, log_vkey, WITNESS_NAME, WITNESS_SEED,
        consistency_proof_b64=[], timestamp=1700000003,
        expected_origin=metadata["origin"], pq_seed=PQ_SEED,
    )
    rollback_sem = classify_refusal(rollback_r)

    fork_r = W.witness_cosign(
        str(state), fork, log_vkey, WITNESS_NAME, WITNESS_SEED,
        consistency_proof_b64=[], timestamp=1700000004,
        expected_origin=metadata["origin"], pq_seed=PQ_SEED,
    )
    fork_sem = classify_refusal(fork_r)

    invalid_r = W.witness_cosign(
        str(state), tampered, log_vkey, WITNESS_NAME, WITNESS_SEED,
        consistency_proof_b64=[], timestamp=1700000005,
        expected_origin=metadata["origin"], pq_seed=PQ_SEED,
    )
    invalid_sem = classify_refusal(invalid_r)

    evidence_path = Path(str(state) + ".evidence.jsonl")
    evidence_bytes = evidence_path.read_bytes() if evidence_path.exists() else b""
    evidence_records = [
        json.loads(line) for line in evidence_bytes.decode("utf-8").splitlines() if line.strip()
    ] if evidence_bytes else []

    out = {
        "schema": SCHEMA,
        "candidate_root": str(candidate_root),
        "candidate_policy_surface": {
            "classification": "NAKED_SCALAR_WITNESS_THRESHOLD_ONLY",
            "authenticated_policy_object": False,
            "threshold_one_result": threshold_1,
            "threshold_two_same_name_two_algorithms_result": threshold_2,
            "same_name_multi_algorithm_counts_as_one_witness": (
                threshold_1.get("stato") == "OK"
                and threshold_2.get("stato") != "OK"
                and threshold_1.get("witnesses") == [WITNESS_NAME]
            ),
        },
        "witness_vkeys": {
            "ed25519_cosignature_v1": ed_vkey,
            "mldsa44": pq_vkey,
        },
        "cases": {
            "first_sight": {"semantic": first_sem, "raw": compact(first_r)},
            "append_only_successor": {"semantic": successor_sem, "raw": compact(successor_r)},
            "rollback_replay": {"semantic": rollback_sem, "raw": compact(rollback_r)},
            "same_size_conflict": {"semantic": fork_sem, "raw": compact(fork_r)},
            "invalid_signature": {"semantic": invalid_sem, "raw": compact(invalid_r)},
        },
        "portable_conflict_evidence": {
            "path_present": evidence_path.exists(),
            "sha256": hashlib.sha256(evidence_bytes).hexdigest() if evidence_bytes else None,
            "record_count": len(evidence_records),
            "records": evidence_records,
        },
    }
    Path(args.output).write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
