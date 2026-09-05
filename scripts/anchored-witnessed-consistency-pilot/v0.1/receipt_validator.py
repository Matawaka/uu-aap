#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from pilot import SCHEMA, canonical_bytes, fail, sha256_hex

ALLOWED_VERDICTS = {
    "OBSERVED_APPEND_ONLY_EXTENSION_VERIFIED_LATER_CHECKPOINT_KEY_PROVENANCE_NOT_INDEPENDENTLY_ESTABLISHED",
    "CONSISTENCY_PROOF_FAILED",
    "LATER_CHECKPOINT_AUTHENTICATION_FAILED",
    "EXTERNAL_EVIDENCE_UNAVAILABLE",
}

TOP_KEYS = {
    "schema", "tracking_issue", "verdict", "old_checkpoint", "later_checkpoint", "consistency",
    "evidence_layers", "claims", "automatic_action", "external_mutation_performed",
    "receipt_fingerprint_sha256",
}

FORBIDDEN_SURFACE_TOKENS = {
    "trust_score", "security_score", "non_equivocation_score", "confidence_score", "authority_score",
    "fraud_score", "canonical_verdict", "global_trust", "risk_score",
}


def exact_keys(obj: dict[str, Any], allowed: set[str], label: str) -> None:
    unknown = set(obj) - allowed
    missing = allowed - set(obj)
    if unknown or missing:
        fail(f"{label}: key mismatch unknown={sorted(unknown)} missing={sorted(missing)}")


def validate_receipt(receipt: dict[str, Any], profile: dict[str, Any]) -> bool:
    if not isinstance(receipt, dict):
        fail("receipt object required")
    exact_keys(receipt, TOP_KEYS, "receipt")
    if receipt.get("schema") != SCHEMA or receipt.get("tracking_issue") != 933:
        fail("receipt identity mismatch")
    if receipt.get("verdict") not in ALLOWED_VERDICTS:
        fail("unknown verdict")

    old = receipt.get("old_checkpoint")
    if not isinstance(old, dict):
        fail("old_checkpoint required")
    exact_keys(old, {
        "origin", "tree_size", "root_b64", "accepted_receipt_fingerprint_sha256",
        "external_anchor_binding", "bitcoin_chain_confirmation",
    }, "old_checkpoint")
    pold = profile["old_checkpoint"]
    if old != pold:
        fail("old checkpoint must exactly bind accepted #932 profile")

    later = receipt.get("later_checkpoint")
    if not isinstance(later, dict):
        fail("later_checkpoint required")
    exact_keys(later, {
        "origin", "tree_size", "root_b64", "checkpoint_sha256", "signed_body_sha256",
        "log_signature_verified", "verified_witnesses", "verified_witness_count",
        "invalid_pinned_witness_signatures", "unknown_cosigner_names",
        "skipped_non_ed25519_cosignature_blobs", "newest_verified_cosignature_timestamp",
        "quorum_min", "authentication_verified", "key_provenance_assurance",
    }, "later_checkpoint")
    if later.get("origin") != pold["origin"]:
        fail("later origin mismatch")
    if not isinstance(later.get("tree_size"), int) or later["tree_size"] <= pold["tree_size"]:
        fail("later checkpoint must advance beyond anchored predecessor")
    if not isinstance(later.get("root_b64"), str) or not later["root_b64"]:
        fail("later root required")
    for digest_name in ["checkpoint_sha256", "signed_body_sha256"]:
        if not isinstance(later.get(digest_name), str) or len(later[digest_name]) != 64:
            fail(f"{digest_name} must be sha256 hex")
    if not isinstance(later.get("log_signature_verified"), bool) or not isinstance(later.get("authentication_verified"), bool):
        fail("authentication booleans required")
    if later.get("quorum_min") != profile["quorum_min"]:
        fail("quorum drift")
    verified = later.get("verified_witnesses")
    if not isinstance(verified, list) or len(verified) != len(set(verified)):
        fail("verified witness list must be unique")
    if later.get("verified_witness_count") != len(verified):
        fail("verified witness count mismatch")
    pinned_names = {v.split("+", 1)[0] for v in profile["witness_vkeys"]}
    if not set(verified).issubset(pinned_names):
        fail("un-pinned witness counted as verified")
    invalid = later.get("invalid_pinned_witness_signatures")
    if not isinstance(invalid, list):
        fail("invalid witness signature list required")
    if later.get("authentication_verified"):
        if later.get("log_signature_verified") is not True:
            fail("authenticated checkpoint requires log signature")
        if len(verified) < profile["quorum_min"]:
            fail("authenticated checkpoint requires witness quorum")
        if invalid:
            fail("authenticated checkpoint cannot carry invalid pinned Ed25519 cosignatures")
    if later.get("key_provenance_assurance") != "OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN":
        fail("key provenance silently promoted")

    consistency = receipt.get("consistency")
    if not isinstance(consistency, dict):
        fail("consistency required")
    exact_keys(consistency, {"old_size", "new_size", "proof_node_count", "proof_text_sha256", "verified"}, "consistency")
    if consistency.get("old_size") != pold["tree_size"] or consistency.get("new_size") != later["tree_size"]:
        fail("consistency size binding mismatch")
    if not isinstance(consistency.get("proof_node_count"), int) or consistency["proof_node_count"] < 1:
        fail("non-empty consistency proof required for advancing tree")
    if not isinstance(consistency.get("proof_text_sha256"), str) or len(consistency["proof_text_sha256"]) != 64:
        fail("consistency proof digest invalid")
    if not isinstance(consistency.get("verified"), bool):
        fail("consistency verified boolean required")

    layers = receipt.get("evidence_layers")
    if not isinstance(layers, dict):
        fail("evidence_layers required")
    exact_keys(layers, {
        "old_checkpoint_external_anchor", "later_checkpoint_authentication", "witness_key_provenance",
        "log_append_only_consistency", "checkpoint_non_equivocation", "global_view_consistency",
        "semantic_claim_binding",
    }, "evidence_layers")
    if layers.get("old_checkpoint_external_anchor") != "BINDING_VERIFIED_BITCOIN_CHAIN_CONFIRMATION_NOT_ESTABLISHED":
        fail("old anchor classification drift")
    if layers.get("witness_key_provenance") != "OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN":
        fail("witness key provenance overclaim")
    if layers.get("global_view_consistency") != "NOT_PROVEN" or layers.get("semantic_claim_binding") != "NOT_IN_SCOPE":
        fail("global/semantic promotion")

    claims = receipt.get("claims")
    if not isinstance(claims, dict) or set(claims) != set(profile["always_false_claims"]):
        fail("exact non-claim set required")
    if any(value is not False for value in claims.values()):
        fail("semantic promotion detected")
    if receipt.get("automatic_action") is not False or receipt.get("external_mutation_performed") is not False:
        fail("automatic/external effect promotion")

    strong = receipt["verdict"] == "OBSERVED_APPEND_ONLY_EXTENSION_VERIFIED_LATER_CHECKPOINT_KEY_PROVENANCE_NOT_INDEPENDENTLY_ESTABLISHED"
    if strong:
        if later["authentication_verified"] is not True or consistency["verified"] is not True:
            fail("success verdict requires authenticated checkpoint plus verified consistency proof")
        if layers.get("later_checkpoint_authentication") != "LOG_SIGNATURE_AND_WITNESS_QUORUM_CRYPTOGRAPHICALLY_VERIFIED":
            fail("success authentication layer mismatch")
        if layers.get("log_append_only_consistency") != "VERIFIED_OBSERVED_PAIR":
            fail("success consistency layer mismatch")
        if layers.get("checkpoint_non_equivocation") != "COSIGNATURES_VERIFIED_WITH_OPERATOR_CURATED_KEY_PINS":
            fail("success checkpoint boundary mismatch")

    text = json.dumps(receipt, sort_keys=True).lower()
    for token in FORBIDDEN_SURFACE_TOKENS:
        if token in text:
            fail(f"forbidden scalar/ranking surface {token}")

    frozen_fingerprint = receipt["receipt_fingerprint_sha256"]
    if not isinstance(frozen_fingerprint, str) or len(frozen_fingerprint) != 64:
        fail("receipt fingerprint shape invalid")
    material = dict(receipt)
    material.pop("receipt_fingerprint_sha256")
    recomputed = sha256_hex(canonical_bytes(material))
    if frozen_fingerprint != recomputed:
        fail("receipt fingerprint mismatch")
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
        print(f"ANCHORED_WITNESSED_CONSISTENCY_RECEIPT_FAIL_CLOSED: {exc}", file=sys.stderr)
        return 1
    print("ANCHORED_WITNESSED_CONSISTENCY_RECEIPT_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
