#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
from typing import Any

SCHEMA = "urn:uu-aap:witness-current-checkpoint-activity-receipt:0.1"
PROFILE_SCHEMA = "urn:uu-aap:witness-current-checkpoint-activity-profile:0.1"
PREDECESSOR_SCHEMA = "urn:uu-aap:witness-operator-origin-corroboration-receipt:0.1"
EXPECTED_MAIN = "9611a245fe517c9c3e32e7c4d88c8f7cfb7d0c2d"
EXPECTED_TREE = "2fc632d527599362c532450e3068189a10d838c0"
EXPECTED_PREDECESSOR_FP = "8e07ae4f682d580867f8c93525f0cd20796aa05067f12107602f1bebadcda10a"
EXPECTED_PREDECESSOR_VERDICT = "FIVE_OF_SIX_PUBLIC_OPERATOR_LABELS_CORROBORATED_BY_OPERATOR_ORIGIN_ATTRIBUTION_EVIDENCE_ONE_OPERATOR_ORIGIN_RELATION_NOT_ESTABLISHED"
EXPECTED_ORIGIN = "markovianprotocol.com/log"
EXPECTED_MIN_SIZE = 7837
EXPECTED_QUORUM = 4
EXPECTED_LOG_VKEY = "markovianprotocol.com/log+0302c6c8+ATkpOWo95UuEiW2EhNZAol4f0CS8hMluJfPcTSzrr03v"
EXPECTED_WITNESS_VKEYS = [
    "witness.stagemole.eu+67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv",
    "transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM",
    "staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL",
    "rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG",
    "witness1.smartit.nu/witness1+a48c820f+BPSFWg9G6KPiO7QPryYO5Xq4oYJJ+kAvLKLSimDhoxMO",
    "remora.n621.de+da77ade7+BOvN63jn/bLvkieywe8R6UYAtVtNbZpXh34x7onlmtw2",
    "witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G",
]
ALL_SEVEN = "ALL_SEVEN_PINNED_WITNESS_KEYS_CRYPTOGRAPHICALLY_OBSERVED_SIGNING_ONE_FRESH_CURRENT_CHECKPOINT_CONTINUOUS_LIVENESS_NOT_ESTABLISHED"
QUORUM = "QUORUM_MANY_PINNED_WITNESS_KEYS_CRYPTOGRAPHICALLY_OBSERVED_SIGNING_ONE_FRESH_CURRENT_CHECKPOINT_CONTINUOUS_LIVENESS_NOT_ESTABLISHED"
INSUFFICIENT = "INSUFFICIENT_FRESH_CURRENT_CHECKPOINT_PINNED_WITNESS_ACTIVITY"
AUTH_FAILED = "CURRENT_CHECKPOINT_AUTHENTICATION_FAILED"
FALSE_CLAIMS = {
    "continuous_witness_liveness_proven", "all_seven_currently_active_proven", "witness_identity_proven",
    "legal_operator_identity_proven", "cryptographic_operator_identity_binding_proven", "operator_control_proven",
    "operator_independence_proven", "all_witnesses_independent_proven", "all_views_non_equivocating_proven",
    "producer_non_equivocation_proven", "global_non_equivocation_proven", "complete_history_proven",
    "all_manifests_submitted_proven", "selective_submission_absent_proven", "c2pa_manifest_inclusion_proven",
    "trusted_time_proven", "truth_certified", "authority_created", "canonical_branch_selected",
    "malicious_behavior_proven", "automatic_remediation_triggered",
}


def fail(msg: str) -> None:
    raise ValueError(msg)


def canonical_bytes(v: Any) -> bytes:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def b64nopad(s: str) -> bytes:
    return base64.b64decode(s + "=" * (-len(s) % 4), validate=True)


def parse_vkey(vkey: str, prefix: int) -> tuple[str, bytes, bytes]:
    try:
        name, _declared, b64 = vkey.split("+", 2)
        raw = b64nopad(b64)
    except Exception as exc:
        fail(f"invalid vkey: {exc}")
    if len(raw) != 33 or raw[0] != prefix:
        fail("vkey type/length mismatch")
    pub = raw[1:]
    keyid = hashlib.sha256(name.encode() + b"\n" + bytes([prefix]) + pub).digest()[:4]
    return name, keyid, pub


def parse_checkpoint(note: bytes) -> tuple[bytes, str, int, bytes, list[tuple[str, bytes]]]:
    if b"\n\n" not in note:
        fail("checkpoint missing signature section")
    body0, sigblock = note.split(b"\n\n", 1)
    body = body0 + b"\n"
    try:
        lines = body.decode().splitlines()
    except UnicodeDecodeError as exc:
        fail(f"checkpoint body is not UTF-8: {exc}")
    if len(lines) < 3:
        fail("checkpoint body too short")
    origin = lines[0]
    try:
        size = int(lines[1]); root = b64nopad(lines[2])
    except Exception as exc:
        fail(f"bad checkpoint size/root: {exc}")
    if size < 0 or len(root) != 32:
        fail("checkpoint size/root shape invalid")
    try:
        st = sigblock.decode()
    except UnicodeDecodeError as exc:
        fail(f"signature block not UTF-8: {exc}")
    sigs: list[tuple[str, bytes]] = []
    for line in st.splitlines():
        if not line.startswith("— "):
            continue
        try:
            _dash, name, s64 = line.split(" ", 2); raw = b64nopad(s64)
        except Exception as exc:
            fail(f"malformed signature line: {exc}")
        sigs.append((name, raw))
    return body, origin, size, root, sigs


def verify_log(body: bytes, sigs: list[tuple[str, bytes]], vkey: str) -> bool:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    name, kid, pub = parse_vkey(vkey, 0x01)
    for n, raw in sigs:
        if n != name or len(raw) != 68 or raw[:4] != kid:
            continue
        try:
            Ed25519PublicKey.from_public_bytes(pub).verify(raw[4:], body); return True
        except InvalidSignature:
            pass
    return False


def verify_witnesses(body: bytes, sigs: list[tuple[str, bytes]], vkeys: list[str], log_name: str) -> dict[str, Any]:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    pins: dict[str, tuple[str, bytes, bytes]] = {}
    for v in vkeys:
        name, kid, pub = parse_vkey(v, 0x04)
        if name in pins:
            fail("duplicate witness name in pins")
        pins[name] = (v, kid, pub)
    verified: set[str] = set(); invalid: set[tuple[str, str]] = set(); unknown: set[str] = set(); skipped = 0; newest = 0
    for name, raw in sigs:
        if name == log_name:
            continue
        if name not in pins:
            unknown.add(name); continue
        if len(raw) != 76:
            skipped += 1; continue
        vkey, kid, pub = pins[name]
        if raw[:4] != kid:
            invalid.add((name, "keyhash mismatch")); continue
        ts = int.from_bytes(raw[4:12], "big")
        msg = b"cosignature/v1\ntime " + str(ts).encode() + b"\n" + body
        try:
            Ed25519PublicKey.from_public_bytes(pub).verify(raw[12:], msg)
            verified.add(name); newest = max(newest, ts)
        except InvalidSignature:
            invalid.add((name, "signature did not verify"))
    return {
        "verified_names": sorted(verified),
        "verified_vkeys": [pins[n][0] for n in sorted(verified)],
        "invalid": [{"name": n, "reason": r} for n, r in sorted(invalid)],
        "unknown": sorted(unknown),
        "skipped_non_ed25519": skipped,
        "newest_verified_cosignature_timestamp": newest,
    }


def validate_profile(p: dict[str, Any]) -> None:
    if p.get("schema") != PROFILE_SCHEMA or p.get("tracking_issue") != 946: fail("profile identity drift")
    if p.get("repository_predecessor_main") != EXPECTED_MAIN or p.get("repository_predecessor_tree") != EXPECTED_TREE: fail("repository predecessor drift")
    if p.get("predecessor_profile_git_blob") != "4e61035e4c1adf62c5927bd2b3de7db8715d028f": fail("#945 profile blob drift")
    if p.get("predecessor_receipt_git_blob") != "b7fd97188f2a033de306ecd51b9f3f0cbcb9b62e": fail("#945 receipt blob drift")
    if p.get("required_predecessor_receipt_fingerprint_sha256") != EXPECTED_PREDECESSOR_FP or p.get("required_predecessor_verdict") != EXPECTED_PREDECESSOR_VERDICT: fail("#945 receipt binding drift")
    if p.get("pin_profile_git_blob") != "4f1c10b9551661b6236febe3d744e4255065ce52" or p.get("crypto_reference_git_blob") != "518bc61f4db936031b911e392eb6fe053dc03437": fail("crypto predecessor blob drift")
    if p.get("checkpoint_url") != "https://log.markovianprotocol.com/checkpoint": fail("checkpoint URL drift")
    if p.get("required_origin") != EXPECTED_ORIGIN or p.get("minimum_tree_size") != EXPECTED_MIN_SIZE or p.get("quorum_min") != EXPECTED_QUORUM: fail("checkpoint policy drift")
    if p.get("log_vkey") != EXPECTED_LOG_VKEY or p.get("witness_vkeys") != EXPECTED_WITNESS_VKEYS: fail("exact pin set drift")
    if len(set(p["witness_vkeys"])) != 7: fail("seven unique witness pins required")
    if p.get("all_seven_verdict") != ALL_SEVEN or p.get("quorum_verdict") != QUORUM or p.get("insufficient_verdict") != INSUFFICIENT or p.get("authentication_failed_verdict") != AUTH_FAILED: fail("verdict vocabulary drift")
    if set(p.get("always_false_claims", [])) != FALSE_CLAIMS: fail("always-false claim set drift")


def validate_predecessor(r: dict[str, Any]) -> None:
    if r.get("schema") != PREDECESSOR_SCHEMA or r.get("tracking_issue") != 944: fail("#945 predecessor identity drift")
    if r.get("receipt_fingerprint_sha256") != EXPECTED_PREDECESSOR_FP or r.get("verdict") != EXPECTED_PREDECESSOR_VERDICT: fail("#945 predecessor receipt drift")
    if r.get("corroborated_operator_label_count") != 5 or r.get("public_operator_label_count") != 6 or r.get("missing_operator_labels") != ["rgdd"]: fail("#945 predecessor semantic drift")
    if r.get("network_curated_table_counted_as_operator_origin_evidence") is not False: fail("curated table promotion")
    if any(r.get("claims", {}).values()) or r.get("automatic_action") is not False or r.get("external_mutation_performed") is not False: fail("#945 predecessor non-claim drift")


def evaluate_validated(p: dict[str, Any], checkpoint: bytes) -> dict[str, Any]:
    body, origin, size, root, sigs = parse_checkpoint(checkpoint)
    log_name, _kid, _pub = parse_vkey(p["log_vkey"], 0x01)
    log_ok = verify_log(body, sigs, p["log_vkey"])
    w = verify_witnesses(body, sigs, p["witness_vkeys"], log_name)
    if origin != p["required_origin"]: fail("checkpoint origin mismatch")
    if size < p["minimum_tree_size"]: fail("checkpoint tree size below accepted minimum")
    count = len(w["verified_names"])
    auth_ok = log_ok and not w["invalid"]
    if not auth_ok:
        verdict = p["authentication_failed_verdict"]
    elif count == 7:
        verdict = p["all_seven_verdict"]
    elif count >= p["quorum_min"]:
        verdict = p["quorum_verdict"]
    else:
        verdict = p["insufficient_verdict"]
    claims = {k: False for k in p["always_false_claims"]}
    receipt: dict[str, Any] = {
        "schema": SCHEMA,
        "tracking_issue": 946,
        "repository_predecessor_main": p["repository_predecessor_main"],
        "repository_predecessor_tree": p["repository_predecessor_tree"],
        "predecessor_receipt_fingerprint_sha256": p["required_predecessor_receipt_fingerprint_sha256"],
        "checkpoint": {
            "source_url": p["checkpoint_url"],
            "origin": origin,
            "tree_size": size,
            "root_b64": base64.b64encode(root).decode(),
            "checkpoint_body_sha256": sha256_hex(checkpoint),
            "signed_body_sha256": sha256_hex(body),
            "log_signature_verified": log_ok,
        },
        "activity": {
            "verified_pinned_witness_names": w["verified_names"],
            "verified_pinned_witness_vkeys": w["verified_vkeys"],
            "verified_pinned_witness_count": count,
            "all_seven_signed_fetched_current_checkpoint": count == 7,
            "quorum_many_signed_fetched_current_checkpoint": count >= p["quorum_min"],
            "invalid_pinned_witness_signatures": w["invalid"],
            "unknown_cosigner_names": w["unknown"],
            "skipped_non_ed25519_cosignature_blobs": w["skipped_non_ed25519"],
            "newest_verified_cosignature_timestamp": w["newest_verified_cosignature_timestamp"],
            "freshness_scope": "ONE_BOUNDED_HTTPS_FETCH_DURING_THIS_WORKFLOW_RUN_NO_TRUSTED_TIME_CLAIM",
        },
        "claims": claims,
        "automatic_action": False,
        "external_mutation_performed": False,
        "verdict": verdict,
    }
    receipt["receipt_fingerprint_sha256"] = sha256_hex(canonical_bytes(receipt))
    return receipt


def evaluate(p: dict[str, Any], pred: dict[str, Any], checkpoint: bytes) -> dict[str, Any]:
    validate_profile(p); validate_predecessor(pred); return evaluate_validated(p, checkpoint)


def validate_receipt(r: dict[str, Any]) -> None:
    if r.get("schema") != SCHEMA or r.get("tracking_issue") != 946: fail("receipt identity mismatch")
    if r.get("repository_predecessor_main") != EXPECTED_MAIN or r.get("repository_predecessor_tree") != EXPECTED_TREE: fail("receipt predecessor drift")
    if r.get("predecessor_receipt_fingerprint_sha256") != EXPECTED_PREDECESSOR_FP: fail("receipt predecessor fingerprint drift")
    c=r.get("checkpoint",{}); a=r.get("activity",{})
    if c.get("source_url") != "https://log.markovianprotocol.com/checkpoint" or c.get("origin") != EXPECTED_ORIGIN or int(c.get("tree_size",-1)) < EXPECTED_MIN_SIZE: fail("receipt checkpoint drift")
    if c.get("log_signature_verified") is not True: fail("log signature must verify")
    names=a.get("verified_pinned_witness_names",[]); vkeys=a.get("verified_pinned_witness_vkeys",[]); count=a.get("verified_pinned_witness_count")
    if count != len(names) or count != len(vkeys) or len(set(names)) != len(names) or len(set(vkeys)) != len(vkeys): fail("verified witness count inflation")
    if not set(vkeys).issubset(set(EXPECTED_WITNESS_VKEYS)): fail("unpinned verified witness")
    if a.get("invalid_pinned_witness_signatures") != []: fail("invalid pinned signature present")
    if a.get("all_seven_signed_fetched_current_checkpoint") is not (count == 7): fail("all-seven flag mismatch")
    if a.get("quorum_many_signed_fetched_current_checkpoint") is not (count >= EXPECTED_QUORUM): fail("quorum flag mismatch")
    if a.get("freshness_scope") != "ONE_BOUNDED_HTTPS_FETCH_DURING_THIS_WORKFLOW_RUN_NO_TRUSTED_TIME_CLAIM": fail("freshness scope drift")
    expected = ALL_SEVEN if count == 7 else QUORUM if count >= EXPECTED_QUORUM else INSUFFICIENT
    if r.get("verdict") != expected: fail("receipt verdict/count mismatch")
    if set(r.get("claims",{})) != FALSE_CLAIMS or any(r["claims"].values()): fail("receipt false claims drift")
    if r.get("automatic_action") is not False or r.get("external_mutation_performed") is not False: fail("side-effect boundary drift")
    tmp=dict(r); fp=tmp.pop("receipt_fingerprint_sha256",None)
    if fp != sha256_hex(canonical_bytes(tmp)): fail("receipt fingerprint mismatch")


def main() -> int:
    ap=argparse.ArgumentParser(); ap.add_argument("--profile"); ap.add_argument("--predecessor"); ap.add_argument("--checkpoint"); ap.add_argument("--validate")
    ns=ap.parse_args()
    if ns.validate:
        r=json.load(open(ns.validate,encoding="utf-8")); validate_receipt(r); print(r["verdict"]); print(r["receipt_fingerprint_sha256"]); return 0
    if not (ns.profile and ns.predecessor and ns.checkpoint): ap.error("--profile --predecessor --checkpoint required")
    p=json.load(open(ns.profile,encoding="utf-8")); pred=json.load(open(ns.predecessor,encoding="utf-8")); cp=Path(ns.checkpoint).read_bytes()
    print(json.dumps(evaluate(p,pred,cp),indent=2,sort_keys=True)); return 0

if __name__ == "__main__": raise SystemExit(main())
