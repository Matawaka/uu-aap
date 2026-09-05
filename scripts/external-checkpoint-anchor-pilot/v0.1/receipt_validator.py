#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from pilot import SCHEMA, fail

ALLOWED_VERDICTS = {
    "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_VERIFIED",
    "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_NOT_ESTABLISHED",
    "LEAF_INCLUSION_FAILED",
    "ANCHOR_BINDING_FAILED",
    "EXTERNAL_EVIDENCE_UNAVAILABLE",
}

TOP_KEYS = {
    "schema", "tracking_issue", "external_source_commit", "verdict", "opaque_leaf", "inclusion",
    "checkpoint_anchor", "evidence_layers", "claims", "automatic_action", "external_mutation_performed",
    "receipt_fingerprint_sha256",
}

FORBIDDEN_SURFACE_TOKENS = {
    "trust_score", "security_score", "non_equivocation_score", "compatibility_score", "confidence_score",
    "canonical_verdict", "fraud_score", "authority_score",
}


def exact_keys(obj: dict[str, Any], allowed: set[str], label: str) -> None:
    unknown = set(obj) - allowed
    if unknown:
        fail(f"{label}: unknown fields {sorted(unknown)}")


def validate_receipt(receipt: dict[str, Any], profile: dict[str, Any]) -> bool:
    if not isinstance(receipt, dict):
        fail("receipt object required")
    exact_keys(receipt, TOP_KEYS, "receipt")
    if receipt.get("schema") != SCHEMA or receipt.get("tracking_issue") != 929:
        fail("receipt identity mismatch")
    if receipt.get("external_source_commit") != profile["external_source"]["commit"]:
        fail("external source commit drift")
    if receipt.get("verdict") not in ALLOWED_VERDICTS:
        fail("unknown verdict")

    opaque = receipt.get("opaque_leaf")
    if not isinstance(opaque, dict):
        fail("opaque_leaf required")
    exact_keys(opaque, {"index", "raw_sha256", "raw_bytes", "semantic_claim_profile"}, "opaque_leaf")
    if opaque.get("index") != 0 or opaque.get("semantic_claim_profile") is not None:
        fail("opaque leaf scope escalation")
    if not isinstance(opaque.get("raw_bytes"), int) or opaque["raw_bytes"] < 1:
        fail("raw leaf bytes invalid")
    if not isinstance(opaque.get("raw_sha256"), str) or len(opaque["raw_sha256"]) != 64:
        fail("raw leaf digest invalid")

    inclusion = receipt.get("inclusion")
    if not isinstance(inclusion, dict):
        fail("inclusion required")
    exact_keys(inclusion, {"tree_size", "proof_node_count", "proof_text_sha256", "computed_root_b64", "expected_root_b64", "verified"}, "inclusion")
    if inclusion.get("tree_size") != 1387 or inclusion.get("expected_root_b64") != profile["checkpoint"]["root_b64"]:
        fail("checkpoint inclusion binding drift")
    if not isinstance(inclusion.get("verified"), bool):
        fail("inclusion verified boolean required")

    anchor = receipt.get("checkpoint_anchor")
    if not isinstance(anchor, dict):
        fail("checkpoint_anchor required")
    exact_keys(anchor, {
        "origin", "root_b64", "wallet", "rootcommit_identifier", "preimage_sha256", "commitment_matches_profile",
        "ots_proof_sha256", "ots_committed_digest_sha256", "ots_binding_verified", "bitcoin_attestation_tag_present",
        "bitcoin_chain_confirmation",
    }, "checkpoint_anchor")
    if anchor.get("origin") != profile["checkpoint"]["origin"] or anchor.get("root_b64") != profile["checkpoint"]["root_b64"]:
        fail("checkpoint anchor identity drift")
    if anchor.get("wallet") != profile["rootcommit"]["wallet"] or anchor.get("rootcommit_identifier") != profile["rootcommit"]["identifier"]:
        fail("rootcommit identity drift")
    if anchor.get("preimage_sha256") != profile["rootcommit"]["commitment_sha256"]:
        fail("preimage commitment mismatch")
    if anchor.get("bitcoin_chain_confirmation") not in {"VERIFIED_BY_PINNED_REFERENCE_VERIFIER", "NOT_ESTABLISHED"}:
        fail("bitcoin confirmation vocabulary drift")
    for k in ["commitment_matches_profile", "ots_binding_verified", "bitcoin_attestation_tag_present"]:
        if not isinstance(anchor.get(k), bool):
            fail(f"{k} boolean required")

    layers = receipt.get("evidence_layers")
    if not isinstance(layers, dict):
        fail("evidence_layers required")
    exact_keys(layers, {"signed_claim", "claim_commitment", "log_inclusion", "log_append_only_consistency", "checkpoint_non_equivocation", "existence_time_evidence"}, "evidence_layers")
    if layers.get("signed_claim") != "NOT_IN_SCOPE_OPAQUE_LEAF":
        fail("signed claim scope promotion")
    if layers.get("claim_commitment") != "OPAQUE_LEAF_BYTES_HASHED_ONLY":
        fail("claim commitment scope promotion")
    if layers.get("log_append_only_consistency") != "NOT_VERIFIED_SINGLE_CHECKPOINT_ONLY":
        fail("append-only consistency overclaim")

    claims = receipt.get("claims")
    if not isinstance(claims, dict) or set(claims) != set(profile["always_false_claims"]):
        fail("exact non-claim set required")
    if any(v is not False for v in claims.values()):
        fail("semantic promotion detected")
    if receipt.get("automatic_action") is not False or receipt.get("external_mutation_performed") is not False:
        fail("automatic/external effect promotion")

    text = json.dumps(receipt, sort_keys=True).lower()
    for token in FORBIDDEN_SURFACE_TOKENS:
        if token in text:
            fail(f"forbidden scalar/ranking surface {token}")

    strong = receipt["verdict"] == "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_VERIFIED"
    if strong and anchor["bitcoin_chain_confirmation"] != "VERIFIED_BY_PINNED_REFERENCE_VERIFIER":
        fail("strong verdict requires reference-verifier confirmation")
    if anchor["bitcoin_chain_confirmation"] == "VERIFIED_BY_PINNED_REFERENCE_VERIFIER" and not anchor["bitcoin_attestation_tag_present"]:
        fail("bitcoin confirmation cannot exist without attestation structure")

    return True


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(f"usage: {argv[0]} profile.json receipt.json", file=sys.stderr)
        return 2
    try:
        profile = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        receipt = json.loads(Path(argv[2]).read_text(encoding="utf-8"))
        validate_receipt(receipt, profile)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"EXTERNAL_CHECKPOINT_ANCHOR_RECEIPT_FAIL_CLOSED: {exc}", file=sys.stderr)
        return 1
    print("EXTERNAL_CHECKPOINT_ANCHOR_RECEIPT_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
