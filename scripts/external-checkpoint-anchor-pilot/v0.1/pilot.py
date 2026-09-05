#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
from typing import Any

SCHEMA = "urn:uu-aap:external-checkpoint-anchor-pilot-receipt:0.1"
CONFIRMATIONS = {"VERIFIED_BY_PINNED_REFERENCE_VERIFIER", "NOT_ESTABLISHED"}


def fail(message: str) -> None:
    raise ValueError(message)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def leaf_hash(data: bytes) -> bytes:
    return hashlib.sha256(b"\x00" + data).digest()


def node_hash(left: bytes, right: bytes) -> bytes:
    return hashlib.sha256(b"\x01" + left + right).digest()


def parse_inclusion_proof(text: str) -> list[bytes]:
    proof: list[bytes] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            item = base64.b64decode(line, validate=True)
        except Exception as exc:
            fail(f"invalid inclusion proof base64: {exc}")
        if len(item) != 32:
            fail("inclusion proof nodes must be 32 bytes")
        proof.append(item)
    return proof


def root_from_inclusion(index: int, size: int, leaf_digest: bytes, proof: list[bytes]) -> bytes:
    if not isinstance(index, int) or not isinstance(size, int) or size < 1 or index < 0 or index >= size:
        fail("invalid leaf index/tree size")
    fn, sn, root = index, size - 1, leaf_digest
    for sibling in proof:
        if sn == 0:
            fail("inclusion proof too long")
        if (fn & 1) == 1 or fn == sn:
            root = node_hash(sibling, root)
            if (fn & 1) == 0:
                while (fn & 1) == 0 and fn != 0:
                    fn >>= 1
                    sn >>= 1
        else:
            root = node_hash(root, sibling)
        fn >>= 1
        sn >>= 1
    if sn != 0:
        fail("inclusion proof too short")
    return root


def rootcommit_preimage(origin: str, size: int, root_b64: str, wallet: str, identifier: str) -> bytes:
    values = [identifier, f"origin={origin}", f"size={size}", f"root={root_b64}", f"wallet={wallet}"]
    return ("\n".join(values) + "\n").encode("ascii")


def parse_ots_commitment(proof: bytes, magic: bytes) -> bytes:
    if not proof.startswith(magic):
        fail("OpenTimestamps magic mismatch")
    offset = len(magic)
    if len(proof) < offset + 34:
        fail("OpenTimestamps proof truncated before committed digest")
    version = proof[offset]
    hash_op = proof[offset + 1]
    if version != 0x01:
        fail("unexpected OpenTimestamps detached-proof version")
    if hash_op != 0x08:
        fail("OpenTimestamps committed hash op is not SHA-256")
    return proof[offset + 2 : offset + 34]


def validate_profile(profile: dict[str, Any]) -> None:
    if profile.get("schema") != "urn:uu-aap:external-checkpoint-anchor-pilot-profile:0.1":
        fail("profile schema mismatch")
    if profile.get("tracking_issue") != 929:
        fail("tracking issue mismatch")
    opaque = profile.get("opaque_leaf", {})
    if opaque.get("index") != 0 or opaque.get("semantic_claim_profile") is not None:
        fail("pilot must remain fixed to opaque leaf index 0")
    if opaque.get("collision_semantics_established") is not False:
        fail("collision semantics must remain unestablished")
    cp = profile.get("checkpoint", {})
    if cp.get("origin") != "markovianprotocol.com/log" or cp.get("tree_size") != 1387:
        fail("checkpoint identity drift")
    if cp.get("root_b64") != "GmLAFnmcIf8WgSfpWt7xBleQE+zgSZx8x9zuSOYw+vA=":
        fail("checkpoint root drift")
    rc = profile.get("rootcommit", {})
    if rc.get("identifier") != "markovianprotocol.com/bitcoin-anchor/rootcommit/v1":
        fail("rootcommit identifier drift")
    if rc.get("commitment_sha256") != "4d1cc236c3872701bb27f9e27fad315e153eeb43a767a2cae958a3bb4014e771":
        fail("rootcommit commitment drift")
    required_false = {
        "c2pa_manifest_inclusion_proven", "producer_non_equivocation_proven", "global_non_equivocation_proven",
        "complete_history_proven", "all_manifests_submitted_proven", "selective_submission_absent_proven",
        "collision_semantics_established", "trusted_time_proven", "truth_certified", "authority_created",
        "canonical_branch_selected", "malicious_behavior_proven", "remediation_triggered"
    }
    if set(profile.get("always_false_claims", [])) != required_false:
        fail("exact always-false claim set required")


def validate_external_rootcommit(profile: dict[str, Any], rootcommit: dict[str, Any]) -> None:
    cp = profile["checkpoint"]
    rc = profile["rootcommit"]
    observed_cp = rootcommit.get("checkpoint", {})
    if observed_cp.get("origin") != cp["origin"] or observed_cp.get("tree_size") != cp["tree_size"]:
        fail("external rootcommit checkpoint identity mismatch")
    if observed_cp.get("root_line_verbatim") != cp["root_b64"]:
        fail("external rootcommit checkpoint root mismatch")
    pre = rootcommit.get("preimage", {})
    if pre.get("wallet") != rc["wallet"] or pre.get("sha256") != rc["commitment_sha256"]:
        fail("external rootcommit preimage metadata mismatch")
    anchor = rootcommit.get("anchor", {})
    if anchor.get("type") != "opentimestamps" or anchor.get("identifier") != rc["identifier"]:
        fail("external rootcommit anchor identity mismatch")
    # Deliberately do not trust anchor.status / anchoredAt as verification results.


def evaluate(
    profile: dict[str, Any],
    leaf_bytes: bytes,
    inclusion_text: str,
    rootcommit: dict[str, Any],
    ots_bytes: bytes,
    bitcoin_confirmation: str,
) -> dict[str, Any]:
    validate_profile(profile)
    if bitcoin_confirmation not in CONFIRMATIONS:
        fail("invalid bitcoin confirmation classification")
    validate_external_rootcommit(profile, rootcommit)

    cp = profile["checkpoint"]
    rc = profile["rootcommit"]
    proof = parse_inclusion_proof(inclusion_text)
    computed_root = root_from_inclusion(profile["opaque_leaf"]["index"], cp["tree_size"], leaf_hash(leaf_bytes), proof)
    expected_root = base64.b64decode(cp["root_b64"], validate=True)
    inclusion_ok = computed_root == expected_root

    preimage = rootcommit_preimage(cp["origin"], cp["tree_size"], cp["root_b64"], rc["wallet"], rc["identifier"])
    preimage_digest = hashlib.sha256(preimage).digest()
    commitment_ok = preimage_digest.hex() == rc["commitment_sha256"]

    magic = bytes.fromhex(rc["ots_magic_hex"])
    committed_digest = parse_ots_commitment(ots_bytes, magic)
    ots_binding_ok = committed_digest == preimage_digest
    bitcoin_tag_present = bytes.fromhex(rc["bitcoin_attestation_tag_hex"]) in ots_bytes

    if not inclusion_ok:
        verdict = "LEAF_INCLUSION_FAILED"
    elif not commitment_ok or not ots_binding_ok:
        verdict = "ANCHOR_BINDING_FAILED"
    elif bitcoin_confirmation == "VERIFIED_BY_PINNED_REFERENCE_VERIFIER":
        verdict = "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_VERIFIED"
    else:
        verdict = "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_NOT_ESTABLISHED"

    claims = {name: False for name in profile["always_false_claims"]}
    receipt: dict[str, Any] = {
        "schema": SCHEMA,
        "tracking_issue": 929,
        "external_source_commit": profile["external_source"]["commit"],
        "verdict": verdict,
        "opaque_leaf": {
            "index": profile["opaque_leaf"]["index"],
            "raw_sha256": sha256_hex(leaf_bytes),
            "raw_bytes": len(leaf_bytes),
            "semantic_claim_profile": None,
        },
        "inclusion": {
            "tree_size": cp["tree_size"],
            "proof_node_count": len(proof),
            "proof_text_sha256": sha256_hex(inclusion_text.encode("utf-8")),
            "computed_root_b64": base64.b64encode(computed_root).decode("ascii"),
            "expected_root_b64": cp["root_b64"],
            "verified": inclusion_ok,
        },
        "checkpoint_anchor": {
            "origin": cp["origin"],
            "root_b64": cp["root_b64"],
            "wallet": rc["wallet"],
            "rootcommit_identifier": rc["identifier"],
            "preimage_sha256": preimage_digest.hex(),
            "commitment_matches_profile": commitment_ok,
            "ots_proof_sha256": sha256_hex(ots_bytes),
            "ots_committed_digest_sha256": committed_digest.hex(),
            "ots_binding_verified": ots_binding_ok,
            "bitcoin_attestation_tag_present": bitcoin_tag_present,
            "bitcoin_chain_confirmation": bitcoin_confirmation,
        },
        "evidence_layers": {
            "signed_claim": "NOT_IN_SCOPE_OPAQUE_LEAF",
            "claim_commitment": "OPAQUE_LEAF_BYTES_HASHED_ONLY",
            "log_inclusion": "VERIFIED" if inclusion_ok else "FAILED",
            "log_append_only_consistency": "NOT_VERIFIED_SINGLE_CHECKPOINT_ONLY",
            "checkpoint_non_equivocation": "EXTERNAL_ANCHOR_BINDING_VERIFIED" if ots_binding_ok else "NOT_VERIFIED",
            "existence_time_evidence": (
                "BITCOIN_CHAIN_CONFIRMATION_VERIFIED_BY_REFERENCE_VERIFIER"
                if bitcoin_confirmation == "VERIFIED_BY_PINNED_REFERENCE_VERIFIER"
                else "OTS_BITCOIN_ATTESTATION_PRESENT_CHAIN_CONFIRMATION_NOT_ESTABLISHED"
            ),
        },
        "claims": claims,
        "automatic_action": False,
        "external_mutation_performed": False,
    }
    receipt["receipt_fingerprint_sha256"] = sha256_hex(canonical_bytes(receipt))
    return receipt


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--profile", required=True)
    p.add_argument("--leaf", required=True)
    p.add_argument("--inclusion", required=True)
    p.add_argument("--rootcommit-json", required=True)
    p.add_argument("--ots", required=True)
    p.add_argument("--bitcoin-confirmation", choices=sorted(CONFIRMATIONS), required=True)
    args = p.parse_args()
    try:
        profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
        leaf = Path(args.leaf).read_bytes()
        inclusion = Path(args.inclusion).read_text(encoding="utf-8")
        rootcommit = json.loads(Path(args.rootcommit_json).read_text(encoding="utf-8"))
        ots = Path(args.ots).read_bytes()
        receipt = evaluate(profile, leaf, inclusion, rootcommit, ots, args.bitcoin_confirmation)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"EXTERNAL_CHECKPOINT_ANCHOR_PILOT_FAIL_CLOSED: {exc}")
        return 1
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
