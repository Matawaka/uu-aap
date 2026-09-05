#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
from typing import Any

SCHEMA = "urn:uu-aap:anchored-witnessed-consistency-pilot-receipt:0.1"


def fail(message: str) -> None:
    raise ValueError(message)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _b64decode_nopad(text: str) -> bytes:
    return base64.b64decode(text + "=" * (-len(text) % 4), validate=True)


def parse_log_vkey(vkey: str) -> tuple[str, bytes, bytes]:
    try:
        name, _declared_hash, b64 = vkey.split("+", 2)
        raw = _b64decode_nopad(b64)
    except Exception as exc:
        fail(f"invalid log vkey: {exc}")
    if len(raw) != 33 or raw[0] != 0x01:
        fail("log vkey must encode 0x01 + 32-byte Ed25519 key")
    pub = raw[1:]
    keyid = hashlib.sha256(name.encode() + b"\n" + b"\x01" + pub).digest()[:4]
    return name, keyid, pub


def parse_witness_vkey(vkey: str) -> tuple[str, bytes, bytes]:
    try:
        name, _declared_hash, b64 = vkey.split("+", 2)
        raw = _b64decode_nopad(b64)
    except Exception as exc:
        fail(f"invalid witness vkey: {exc}")
    if len(raw) != 33 or raw[0] != 0x04:
        fail("witness vkey must encode 0x04 + 32-byte Ed25519 key")
    pub = raw[1:]
    keyid = hashlib.sha256(name.encode() + b"\n\x04" + pub).digest()[:4]
    return name, keyid, pub


def parse_checkpoint(note_bytes: bytes) -> tuple[bytes, str, int, bytes, list[tuple[str, bytes]]]:
    if b"\n\n" not in note_bytes:
        fail("checkpoint missing signed-note signature section")
    body0, sigblock = note_bytes.split(b"\n\n", 1)
    body = body0 + b"\n"
    try:
        body_lines = body.decode("utf-8").splitlines()
    except UnicodeDecodeError as exc:
        fail(f"checkpoint body is not UTF-8: {exc}")
    if len(body_lines) < 3:
        fail("checkpoint body requires origin, size, root")
    origin = body_lines[0]
    try:
        size = int(body_lines[1])
        root = _b64decode_nopad(body_lines[2])
    except Exception as exc:
        fail(f"invalid checkpoint size/root: {exc}")
    if size < 0 or len(root) != 32:
        fail("checkpoint size/root shape invalid")

    sigs: list[tuple[str, bytes]] = []
    try:
        sig_text = sigblock.decode("utf-8")
    except UnicodeDecodeError as exc:
        fail(f"checkpoint signature block is not UTF-8: {exc}")
    for line in sig_text.splitlines():
        if not line.startswith("— "):
            continue
        try:
            _dash, name, s64 = line.split(" ", 2)
            raw = _b64decode_nopad(s64)
        except Exception as exc:
            fail(f"malformed signed-note signature line: {exc}")
        sigs.append((name, raw))
    return body, origin, size, root, sigs


def verify_log_signature(body: bytes, sigs: list[tuple[str, bytes]], vkey: str) -> bool:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

    name, keyid, pub = parse_log_vkey(vkey)
    for signame, raw in sigs:
        if signame != name or len(raw) != 68 or raw[:4] != keyid:
            continue
        try:
            Ed25519PublicKey.from_public_bytes(pub).verify(raw[4:], body)
            return True
        except InvalidSignature:
            continue
    return False


def verify_witness_cosignatures(
    body: bytes,
    sigs: list[tuple[str, bytes]],
    witness_vkeys: list[str],
    log_name: str,
) -> dict[str, Any]:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

    pinned: dict[str, tuple[bytes, bytes]] = {}
    for vkey in witness_vkeys:
        name, keyid, pub = parse_witness_vkey(vkey)
        if name in pinned:
            fail(f"duplicate witness key pin: {name}")
        pinned[name] = (keyid, pub)

    verified: set[str] = set()
    invalid: set[tuple[str, str]] = set()
    unknown: set[str] = set()
    skipped_non_ed25519 = 0
    newest_verified_timestamp = 0

    for name, raw in sigs:
        if name == log_name:
            continue
        if name not in pinned:
            unknown.add(name)
            continue
        if len(raw) != 76:
            skipped_non_ed25519 += 1
            continue
        keyid, pub = pinned[name]
        if raw[:4] != keyid:
            invalid.add((name, "keyhash mismatch"))
            continue
        ts = int.from_bytes(raw[4:12], "big")
        msg = b"cosignature/v1\ntime " + str(ts).encode("ascii") + b"\n" + body
        try:
            Ed25519PublicKey.from_public_bytes(pub).verify(raw[12:], msg)
            verified.add(name)
            newest_verified_timestamp = max(newest_verified_timestamp, ts)
        except InvalidSignature:
            invalid.add((name, "signature did not verify"))

    return {
        "verified": sorted(verified),
        "invalid": [{"name": n, "reason": r} for n, r in sorted(invalid)],
        "unknown": sorted(unknown),
        "skipped_non_ed25519": skipped_non_ed25519,
        "newest_verified_timestamp": newest_verified_timestamp,
    }


def node_hash(left: bytes, right: bytes) -> bytes:
    return hashlib.sha256(b"\x01" + left + right).digest()


def parse_consistency_proof(text: str) -> list[bytes]:
    proof: list[bytes] = []
    for token in text.split():
        try:
            item = _b64decode_nopad(token)
        except Exception as exc:
            fail(f"invalid consistency proof base64: {exc}")
        if len(item) != 32:
            fail("consistency proof nodes must be exactly 32 bytes")
        proof.append(item)
    return proof


def verify_consistency(size1: int, size2: int, root1: bytes, root2: bytes, proof: list[bytes]) -> bool:
    if size1 < 0 or size2 < 0 or size1 > size2:
        return False
    if size1 == 0:
        return True
    if size1 == size2:
        return root1 == root2 and len(proof) == 0

    node, last = size1 - 1, size2 - 1
    while node & 1:
        node >>= 1
        last >>= 1
    p = iter(proof)
    try:
        fr = sr = next(p) if node else root1
        while node:
            if node & 1:
                sibling = next(p)
                fr, sr = node_hash(sibling, fr), node_hash(sibling, sr)
            elif node < last:
                sr = node_hash(sr, next(p))
            node >>= 1
            last >>= 1
        while last:
            sr = node_hash(sr, next(p))
            last >>= 1
    except StopIteration:
        return False
    return fr == root1 and sr == root2 and sum(1 for _ in p) == 0


def validate_profile(profile: dict[str, Any]) -> None:
    if profile.get("schema") != "urn:uu-aap:anchored-witnessed-consistency-pilot-profile:0.1":
        fail("profile schema mismatch")
    if profile.get("tracking_issue") != 933:
        fail("tracking issue mismatch")
    if profile.get("repository_predecessor_main") != "ea67703f99617d82e8cc1ca214273f83521d8b12":
        fail("repository predecessor drift")
    old = profile.get("old_checkpoint", {})
    if old.get("origin") != "markovianprotocol.com/log" or old.get("tree_size") != 1387:
        fail("old checkpoint identity drift")
    if old.get("root_b64") != "GmLAFnmcIf8WgSfpWt7xBleQE+zgSZx8x9zuSOYw+vA=":
        fail("old checkpoint root drift")
    if old.get("accepted_receipt_fingerprint_sha256") != "60c91b97b7c5308cf6832803b1f399682b579ecb18680a4829a09920d64c71ef":
        fail("accepted #932 receipt fingerprint drift")
    if old.get("external_anchor_binding") != "VERIFIED" or old.get("bitcoin_chain_confirmation") != "NOT_ESTABLISHED":
        fail("old checkpoint evidence classification drift")
    ref = profile.get("external_reference", {})
    if ref.get("repository") != "MarkovianProtocol/log-monitor" or ref.get("commit") != "6cbde9d44da084770c2bb09c6b66bf0e3245e5f6":
        fail("external monitor reference drift")
    if ref.get("config_blob") != "9880c48c5ac46b0d4a56be3720d9897cf9f2ef29" or ref.get("monitor_blob") != "a16f4db90e4e7f50fae8522c8c3289f784add4f3":
        fail("external monitor blob binding drift")
    if profile.get("quorum_min") != 4 or len(profile.get("witness_vkeys", [])) != 7:
        fail("witness policy drift")
    if profile.get("key_provenance_assurance") != "OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN":
        fail("key provenance assurance promotion")
    required_false = {
        "second_bitcoin_anchor_proven", "complete_history_proven", "all_views_non_equivocating_proven",
        "producer_non_equivocation_proven", "global_non_equivocation_proven", "all_manifests_submitted_proven",
        "selective_submission_absent_proven", "c2pa_manifest_inclusion_proven", "collision_semantics_established",
        "trusted_time_proven", "truth_certified", "authority_created", "canonical_branch_selected",
        "malicious_behavior_proven", "automatic_remediation_triggered",
    }
    if set(profile.get("always_false_claims", [])) != required_false:
        fail("exact always-false claim set required")


def evaluate(profile: dict[str, Any], checkpoint_bytes: bytes, consistency_text: str) -> dict[str, Any]:
    validate_profile(profile)
    body, origin, size, root, sigs = parse_checkpoint(checkpoint_bytes)
    old = profile["old_checkpoint"]
    old_root = _b64decode_nopad(old["root_b64"])
    if origin != old["origin"]:
        fail("later checkpoint origin mismatch")
    if size < old["tree_size"]:
        fail("later checkpoint tree size is smaller than anchored predecessor")
    if size == old["tree_size"]:
        if root != old_root:
            fail("same-size checkpoint has a different root")
        fail("no later checkpoint observed; tree size did not advance")

    log_name, _kid, _pub = parse_log_vkey(profile["log_vkey"])
    log_signature_verified = verify_log_signature(body, sigs, profile["log_vkey"])
    witnesses = verify_witness_cosignatures(body, sigs, profile["witness_vkeys"], log_name)
    verified_witness_count = len(witnesses["verified"])
    authentication_verified = (
        log_signature_verified
        and verified_witness_count >= profile["quorum_min"]
        and not witnesses["invalid"]
    )

    proof = parse_consistency_proof(consistency_text)
    consistency_verified = verify_consistency(old["tree_size"], size, old_root, root, proof)

    if not authentication_verified:
        verdict = "LATER_CHECKPOINT_AUTHENTICATION_FAILED"
    elif not consistency_verified:
        verdict = "CONSISTENCY_PROOF_FAILED"
    else:
        verdict = "OBSERVED_APPEND_ONLY_EXTENSION_VERIFIED_LATER_CHECKPOINT_KEY_PROVENANCE_NOT_INDEPENDENTLY_ESTABLISHED"

    claims = {name: False for name in profile["always_false_claims"]}
    receipt: dict[str, Any] = {
        "schema": SCHEMA,
        "tracking_issue": 933,
        "verdict": verdict,
        "old_checkpoint": {
            "origin": old["origin"],
            "tree_size": old["tree_size"],
            "root_b64": old["root_b64"],
            "accepted_receipt_fingerprint_sha256": old["accepted_receipt_fingerprint_sha256"],
            "external_anchor_binding": old["external_anchor_binding"],
            "bitcoin_chain_confirmation": old["bitcoin_chain_confirmation"],
        },
        "later_checkpoint": {
            "origin": origin,
            "tree_size": size,
            "root_b64": base64.b64encode(root).decode("ascii"),
            "checkpoint_sha256": sha256_hex(checkpoint_bytes),
            "signed_body_sha256": sha256_hex(body),
            "log_signature_verified": log_signature_verified,
            "verified_witnesses": witnesses["verified"],
            "verified_witness_count": verified_witness_count,
            "invalid_pinned_witness_signatures": witnesses["invalid"],
            "unknown_cosigner_names": witnesses["unknown"],
            "skipped_non_ed25519_cosignature_blobs": witnesses["skipped_non_ed25519"],
            "newest_verified_cosignature_timestamp": witnesses["newest_verified_timestamp"],
            "quorum_min": profile["quorum_min"],
            "authentication_verified": authentication_verified,
            "key_provenance_assurance": profile["key_provenance_assurance"],
        },
        "consistency": {
            "old_size": old["tree_size"],
            "new_size": size,
            "proof_node_count": len(proof),
            "proof_text_sha256": sha256_hex(consistency_text.encode("utf-8")),
            "verified": consistency_verified,
        },
        "evidence_layers": {
            "old_checkpoint_external_anchor": "BINDING_VERIFIED_BITCOIN_CHAIN_CONFIRMATION_NOT_ESTABLISHED",
            "later_checkpoint_authentication": (
                "LOG_SIGNATURE_AND_WITNESS_QUORUM_CRYPTOGRAPHICALLY_VERIFIED"
                if authentication_verified else "FAILED"
            ),
            "witness_key_provenance": profile["key_provenance_assurance"],
            "log_append_only_consistency": "VERIFIED_OBSERVED_PAIR" if consistency_verified else "FAILED",
            "checkpoint_non_equivocation": (
                "COSIGNATURES_VERIFIED_WITH_OPERATOR_CURATED_KEY_PINS"
                if authentication_verified else "NOT_ESTABLISHED"
            ),
            "global_view_consistency": "NOT_PROVEN",
            "semantic_claim_binding": "NOT_IN_SCOPE",
        },
        "claims": claims,
        "automatic_action": False,
        "external_mutation_performed": False,
    }
    receipt["receipt_fingerprint_sha256"] = sha256_hex(canonical_bytes(receipt))
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--consistency", required=True)
    args = parser.parse_args()
    try:
        profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
        checkpoint = Path(args.checkpoint).read_bytes()
        consistency = Path(args.consistency).read_text(encoding="utf-8")
        receipt = evaluate(profile, checkpoint, consistency)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"ANCHORED_WITNESSED_CONSISTENCY_FAIL_CLOSED: {exc}")
        return 1
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
