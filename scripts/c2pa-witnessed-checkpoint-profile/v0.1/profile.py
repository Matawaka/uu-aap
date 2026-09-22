#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import itertools
import json
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

PROFILE_SCHEMA = "urn:uu-aap:c2pa-witnessed-checkpoint-profile:0.1"
BUNDLE_SCHEMA = "urn:uu-aap:c2pa-witnessed-checkpoint-evidence-bundle:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:c2pa-witnessed-checkpoint-profile-qualification:0.1"

TYPE_LOG_ED25519 = 0x01
TYPE_COSIG_V1 = 0x04

TOLERATED_FAILURES = {"signingCredential.untrusted"}


def fail(message: str) -> None:
    raise ValueError(message)


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def load_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: str | Path, value: Any) -> bytes:
    data = (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")
    Path(path).write_bytes(data)
    return data


def normalize_key(name: str) -> str:
    return "".join(ch for ch in name if ch.isalnum()).lower()


def find_key(obj: dict[str, Any], *names: str) -> Any:
    wanted = {normalize_key(n) for n in names}
    for key, value in obj.items():
        if normalize_key(str(key)) in wanted:
            return value
    return None


def decode_hash(value: Any) -> bytes:
    if isinstance(value, list) and all(isinstance(x, int) and 0 <= x <= 255 for x in value):
        return bytes(value)
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("b64'") and text.endswith("'"):
            text = text[4:-1]
        if text.startswith('b64"') and text.endswith('"'):
            text = text[4:-1]
        try:
            raw = base64.b64decode(text, validate=True)
            if raw:
                return raw
        except Exception:
            pass
        try:
            raw = bytes.fromhex(text)
            if raw:
                return raw
        except ValueError:
            pass
    fail(f"unsupported hashed-uri hash representation: {type(value).__name__}")


def normalize_hashed_uri(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail(f"{field} is not a hashed-uri object")
    url = find_key(value, "url")
    hv = find_key(value, "hash")
    alg = find_key(value, "alg")
    if not isinstance(url, str) or not url:
        fail(f"{field}.url missing")
    raw = decode_hash(hv)
    if len(raw) not in (32, 48, 64):
        fail(f"{field}.hash has unsupported length {len(raw)}")
    return {
        "url": url,
        "alg": str(alg) if alg is not None else "inherited",
        "hash_b64": base64.b64encode(raw).decode("ascii"),
        "hash_hex": raw.hex(),
    }


def walk_objects(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_objects(child)


def extract_parent_link(*documents: Any) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    for document in documents:
        for obj in walk_objects(document):
            rel = find_key(obj, "relationship")
            if str(rel).lower() != "parentof":
                continue
            active = find_key(obj, "activeManifest", "active_manifest")
            claim_sig = find_key(obj, "claimSignature", "claim_signature")
            if active is None or claim_sig is None:
                continue
            try:
                candidates.append({
                    "relationship": "parentOf",
                    "active_manifest": normalize_hashed_uri(active, "activeManifest"),
                    "claim_signature": normalize_hashed_uri(claim_sig, "claimSignature"),
                })
            except ValueError:
                continue
    unique: dict[bytes, dict[str, Any]] = {canonical(c): c for c in candidates}
    if len(unique) != 1:
        fail(f"expected exactly one parentOf ingredient with activeManifest+claimSignature hashed URIs, found {len(unique)}")
    return next(iter(unique.values()))


def validate_profile(profile: dict[str, Any]) -> None:
    if profile.get("schema") != PROFILE_SCHEMA or profile.get("tracking_issue") != 1007:
        fail("profile identity drift")
    if profile.get("repository_predecessor_main") != "f9a051b28b54088b202051f135fd77d084fb7326":
        fail("repository predecessor drift")
    if profile.get("repository_predecessor_tree") != "649138588814ce5c95540002b08bdf03adacb87f":
        fail("repository predecessor tree drift")
    if profile.get("commitment", {}).get("domain") != "urn:uu-aap:c2pa-witnessed-checkpoint-subject:v0.1":
        fail("commitment domain drift")
    if profile.get("commitment", {}).get("tree_size") != 2 or profile.get("commitment", {}).get("subject_leaf_index") != 1:
        fail("fixture Merkle shape drift")
    p = profile.get("experimental_witness_policy", {})
    if p.get("threshold") != 2 or len(p.get("witness_names", [])) != 3:
        fail("experimental witness-policy shape drift")
    if profile.get("external_reference", {}).get("assertion_label") != "c2pa.external-reference":
        fail("external-reference label drift")
    if profile.get("strong_verdict") != "PREDECESSOR_C2PA_EVIDENCE_WITNESSED_AND_BOUND_BY_SUCCESSOR_UPDATE_MANIFEST":
        fail("strong verdict drift")
    if len(set(profile.get("always_false_claims", []))) != len(profile.get("always_false_claims", [])):
        fail("duplicate always-false claim")
    frozen = profile.get("frozen_qualification", {})
    expected_frozen = {
        "run_id": 35693812515,
        "run_head_sha": "65f03ef873590b6a356df2923b81ab9e64f13d83",
        "artifact_id": 10679103065,
        "artifact_digest": "sha256:6243023c03172354a05ccc081200bb8798a214df22f5db437016a79d6cc76331",
        "receipt_path": "scripts/c2pa-witnessed-checkpoint-profile/v0.1/qualification-receipt.json",
        "receipt_git_blob": "8094b98b29dfb0997a89ebdeb5ed60225239d508",
        "receipt_sha256": "e9c1ecbfefc9fdd7c1e53768b62ecc0f57197a6ac3e6d13e3ade1d662eda01f4",
        "receipt_bytes": 3227,
        "receipt_fingerprint_sha256": "85242eaafc3418134e5ed7850a6ccc0727ee7fc04919f8555f65a433699c0527",
        "evidence_bundle_sha256": "56fb5783904e8b75c1ddd7ed5d13acba111aaf671b8ec2612cec85d3d86e672e",
        "evidence_bundle_bytes": 4789,
        "stable_semantic_fingerprint_sha256": "39ad8a08ac1637d5afebdccf444aee39eb65ccfea18139a903b03375f9234480",
    }
    if frozen != expected_frozen:
        fail("frozen qualification binding drift")


def validate_predecessor_bindings(profile: dict[str, Any], repo_root: Path) -> None:
    validate_profile(profile)
    bindings = [
        (profile["accepted_witness_qualification"]["receipt_path"], profile["accepted_witness_qualification"]["receipt_git_blob"]),
        (profile["accepted_witness_qualification"]["profile_path"], profile["accepted_witness_qualification"]["profile_git_blob"]),
        (profile["accepted_c2pa_binding"]["profile_path"], profile["accepted_c2pa_binding"]["profile_git_blob"]),
        (profile["accepted_c2pa_binding"]["receipt_path"], profile["accepted_c2pa_binding"]["receipt_git_blob"]),
    ]
    extra = [
        ("scripts/c2pa-witness-receipt-binding/v0.1/build-config.js", profile["accepted_c2pa_binding"]["build_config_git_blob"]),
        ("scripts/c2pa-witness-receipt-binding/v0.1/verify-binding.js", profile["accepted_c2pa_binding"]["verify_binding_git_blob"]),
        ("scripts/c2pa-witness-receipt-binding/v0.1/test-binding.js", profile["accepted_c2pa_binding"]["test_binding_git_blob"]),
    ]
    for rel, expected in bindings + extra:
        data = (repo_root / rel).read_bytes()
        if git_blob_sha1(data) != expected:
            fail(f"accepted predecessor blob drift: {rel}")
    receipt = load_json(repo_root / profile["accepted_witness_qualification"]["receipt_path"])
    if receipt.get("receipt_fingerprint_sha256") != profile["accepted_witness_qualification"]["receipt_fingerprint_sha256"]:
        fail("accepted #1006 receipt fingerprint drift")
    if receipt.get("verdict") != "CROSS_IMPLEMENTATION_MATCH_ON_BOUNDED_VECTOR_SET_PORTABLE_CONFLICT_EVIDENCE_REVERIFIED_AUTHENTICATED_POLICY_OBJECT_ABSENT":
        fail("accepted #1006 verdict drift")
    if any(receipt.get("claims", {}).values()):
        fail("accepted #1006 non-claims drift")


def seed(label: str) -> bytes:
    return sha256(("uu-aap:" + label).encode("utf-8"))


def public_raw(private_seed: bytes) -> bytes:
    return Ed25519PrivateKey.from_private_bytes(private_seed).public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )


def key_id(name: str, key_type: int, pub: bytes) -> bytes:
    return sha256(name.encode("utf-8") + b"\n" + bytes([key_type]) + pub)[:4]


def vkey(name: str, key_type: int, pub: bytes) -> str:
    kid = key_id(name, key_type, pub)
    return f"{name}+{kid.hex()}+{base64.b64encode(bytes([key_type]) + pub).decode('ascii')}"


def parse_vkey(text: str, expected_type: int) -> tuple[str, bytes, bytes]:
    try:
        name, _declared, material = text.split("+", 2)
        raw = base64.b64decode(material, validate=True)
    except Exception as exc:
        fail(f"invalid vkey: {exc}")
    if len(raw) != 33 or raw[0] != expected_type:
        fail("vkey type/length mismatch")
    pub = raw[1:]
    return name, key_id(name, expected_type, pub), pub


def make_policy(profile: dict[str, Any]) -> tuple[dict[str, Any], dict[str, bytes]]:
    cfg = profile["experimental_witness_policy"]
    private: dict[str, bytes] = {}
    witnesses = []
    for index, name in enumerate(cfg["witness_names"], start=1):
        sk = seed(f"c2pa-witnessed-checkpoint/witness-{index}")
        private[name] = sk
        pub = public_raw(sk)
        witnesses.append({"name": name, "vkey": vkey(name, TYPE_COSIG_V1, pub)})
    policy = {
        "schema": cfg["schema"],
        "version": cfg["version"],
        "origin": cfg["origin"],
        "algorithm": cfg["algorithm"],
        "threshold": cfg["threshold"],
        "witnesses": witnesses,
        "trust_semantics": cfg["trust_semantics"],
    }
    return policy, private


def analyze_threshold_policy(count: int, threshold: int) -> dict[str, Any]:
    if threshold < 1 or threshold > count:
        fail("invalid threshold policy")
    subsets = list(itertools.combinations(range(count), threshold))
    minimum_intersection = threshold
    disjoint = False
    for a, b in itertools.combinations(subsets, 2):
        inter = len(set(a) & set(b))
        minimum_intersection = min(minimum_intersection, inter)
        if inter == 0:
            disjoint = True
    if len(subsets) < 2:
        minimum_intersection = threshold
    return {
        "witness_count": count,
        "threshold": threshold,
        "minimum_pairwise_quorum_intersection": minimum_intersection,
        "disjoint_quorum_possible": disjoint,
        "honest_witness_assumption_required": True,
        "witness_independence_proven": False,
    }


def signed_note_line(name: str, raw: bytes) -> str:
    return f"— {name} {base64.b64encode(raw).decode('ascii')}\n"


def build_bundle(profile: dict[str, Any], parent: dict[str, Any]) -> dict[str, Any]:
    validate_profile(profile)
    policy, private = make_policy(profile)
    policy_digest = sha256_hex(canonical(policy))
    domain = profile["commitment"]["domain"]
    subject_core = {
        "active_manifest": parent["active_manifest"],
        "claim_signature": parent["claim_signature"],
        "witness_policy_sha256": policy_digest,
        "hash_algorithm": "sha256",
    }
    commitment_preimage = domain.encode("utf-8") + b"\x00" + canonical(subject_core)
    leaf_commitment = sha256(commitment_preimage)

    decoy_value = sha256(b"uu-aap:c2pa-witnessed-checkpoint:decoy:v0.1")
    decoy_leaf_hash = sha256(b"\x00" + decoy_value)
    subject_leaf_hash = sha256(b"\x00" + leaf_commitment)
    root = sha256(b"\x01" + decoy_leaf_hash + subject_leaf_hash)

    origin = policy["origin"]
    body = f"{origin}\n2\n{base64.b64encode(root).decode('ascii')}\n".encode("utf-8")

    log_seed = seed("c2pa-witnessed-checkpoint/log")
    log_pub = public_raw(log_seed)
    log_name = origin
    log_vkey = vkey(log_name, TYPE_LOG_ED25519, log_pub)
    log_kid = key_id(log_name, TYPE_LOG_ED25519, log_pub)
    log_sig = Ed25519PrivateKey.from_private_bytes(log_seed).sign(body)
    note = body + b"\n" + signed_note_line(log_name, log_kid + log_sig).encode("utf-8")

    timestamps = [1700000101, 1700000102]
    observed = []
    for witness, ts in zip(policy["witnesses"][:2], timestamps):
        name = witness["name"]
        sk = private[name]
        pub = public_raw(sk)
        kid = key_id(name, TYPE_COSIG_V1, pub)
        msg = b"cosignature/v1\ntime " + str(ts).encode("ascii") + b"\n" + body
        sig = Ed25519PrivateKey.from_private_bytes(sk).sign(msg)
        note += signed_note_line(name, kid + ts.to_bytes(8, "big") + sig).encode("utf-8")
        observed.append({"name": name, "timestamp": ts})

    boundaries = {name: False for name in profile["always_false_claims"]}
    return {
        "schema": BUNDLE_SCHEMA,
        "profile_version": "0.1",
        "subject_scope": "PREDECESSOR_C2PA_MANIFEST_REFERENCED_BY_SUCCESSOR_UPDATE",
        "subject": {
            **subject_core,
            "commitment_domain": domain,
            "commitment_preimage_sha256": sha256_hex(commitment_preimage),
            "leaf_commitment_b64": base64.b64encode(leaf_commitment).decode("ascii"),
        },
        "log": {
            "origin": origin,
            "leaf_index": 1,
            "tree_size": 2,
            "leaf_hash_b64": base64.b64encode(subject_leaf_hash).decode("ascii"),
            "inclusion_proof_b64": [base64.b64encode(decoy_leaf_hash).decode("ascii")],
            "root_b64": base64.b64encode(root).decode("ascii"),
        },
        "checkpoint": {
            "signed_note": note.decode("utf-8"),
            "sha256": sha256_hex(note),
            "signed_body_sha256": sha256_hex(body),
            "log_vkey": log_vkey,
        },
        "witness_policy": {
            "policy": policy,
            "policy_sha256": policy_digest,
            "analysis": analyze_threshold_policy(len(policy["witnesses"]), policy["threshold"]),
        },
        "witness_observation": {
            "cosigned_witnesses": observed,
            "verified_witness_count": 2,
            "quorum_satisfied": True,
            "timestamps_are_observation_claims_only": True,
        },
        "semantic_boundaries": boundaries,
    }


def parse_note(note_text: str) -> tuple[bytes, list[tuple[str, bytes]]]:
    data = note_text.encode("utf-8")
    if b"\n\n" not in data:
        fail("signed checkpoint note missing separator")
    body0, sigblock = data.split(b"\n\n", 1)
    body = body0 + b"\n"
    sigs = []
    for line in sigblock.decode("utf-8").splitlines():
        if not line.startswith("— "):
            fail("malformed signed-note signature line")
        parts = line.split(" ", 2)
        if len(parts) != 3:
            fail("malformed signed-note signature line")
        try:
            raw = base64.b64decode(parts[2], validate=True)
        except Exception as exc:
            fail(f"invalid signed-note signature base64: {exc}")
        sigs.append((parts[1], raw))
    return body, sigs


def verify_bundle(profile: dict[str, Any], parent: dict[str, Any], bundle: dict[str, Any]) -> dict[str, Any]:
    validate_profile(profile)
    if bundle.get("schema") != BUNDLE_SCHEMA:
        fail("bundle schema mismatch")
    if bundle.get("subject_scope") != "PREDECESSOR_C2PA_MANIFEST_REFERENCED_BY_SUCCESSOR_UPDATE":
        fail("bundle subject scope drift")
    policy, _private = make_policy(profile)
    policy_digest = sha256_hex(canonical(policy))
    wb = bundle.get("witness_policy", {})
    if wb.get("policy") != policy or wb.get("policy_sha256") != policy_digest:
        fail("witness policy binding mismatch")
    expected_analysis = analyze_threshold_policy(len(policy["witnesses"]), policy["threshold"])
    if wb.get("analysis") != expected_analysis:
        fail("witness policy analysis mismatch")
    if expected_analysis["disjoint_quorum_possible"]:
        fail("accepted 2-of-3 policy unexpectedly permits disjoint quorums")

    subject = bundle.get("subject", {})
    if subject.get("active_manifest") != parent["active_manifest"]:
        fail("bundle predecessor activeManifest mismatch")
    if subject.get("claim_signature") != parent["claim_signature"]:
        fail("bundle predecessor claimSignature mismatch")
    if subject.get("witness_policy_sha256") != policy_digest:
        fail("bundle subject policy digest mismatch")
    domain = profile["commitment"]["domain"]
    core = {
        "active_manifest": parent["active_manifest"],
        "claim_signature": parent["claim_signature"],
        "witness_policy_sha256": policy_digest,
        "hash_algorithm": "sha256",
    }
    preimage = domain.encode("utf-8") + b"\x00" + canonical(core)
    commitment = sha256(preimage)
    if subject.get("commitment_domain") != domain:
        fail("commitment domain mismatch")
    if subject.get("commitment_preimage_sha256") != sha256_hex(preimage):
        fail("commitment preimage digest mismatch")
    if subject.get("leaf_commitment_b64") != base64.b64encode(commitment).decode("ascii"):
        fail("leaf commitment mismatch")

    log = bundle.get("log", {})
    if log.get("leaf_index") != 1 or log.get("tree_size") != 2:
        fail("log inclusion shape mismatch")
    try:
        proof = [base64.b64decode(x, validate=True) for x in log.get("inclusion_proof_b64", [])]
        root = base64.b64decode(log["root_b64"], validate=True)
    except Exception as exc:
        fail(f"log proof encoding invalid: {exc}")
    if len(proof) != 1 or len(proof[0]) != 32 or len(root) != 32:
        fail("log inclusion proof shape mismatch")
    leaf_hash = sha256(b"\x00" + commitment)
    computed_root = sha256(b"\x01" + proof[0] + leaf_hash)
    if computed_root != root:
        fail("transparency inclusion proof failed")
    if log.get("leaf_hash_b64") != base64.b64encode(leaf_hash).decode("ascii"):
        fail("leaf hash mismatch")

    checkpoint = bundle.get("checkpoint", {})
    body, sigs = parse_note(checkpoint.get("signed_note", ""))
    lines = body.decode("utf-8").splitlines()
    if len(lines) != 3 or lines[0] != policy["origin"] or lines[1] != "2":
        fail("checkpoint identity mismatch")
    if lines[2] != base64.b64encode(root).decode("ascii"):
        fail("checkpoint root mismatch")
    note_bytes = checkpoint["signed_note"].encode("utf-8")
    if checkpoint.get("sha256") != sha256_hex(note_bytes) or checkpoint.get("signed_body_sha256") != sha256_hex(body):
        fail("checkpoint digest mismatch")

    log_name, log_kid, log_pub = parse_vkey(checkpoint.get("log_vkey", ""), TYPE_LOG_ED25519)
    if log_name != policy["origin"]:
        fail("log vkey origin mismatch")
    log_verified = False
    verified_witnesses: dict[str, int] = {}
    allowed: dict[str, tuple[bytes, bytes]] = {}
    for w in policy["witnesses"]:
        name, kid, pub = parse_vkey(w["vkey"], TYPE_COSIG_V1)
        if name != w["name"]:
            fail("witness vkey name mismatch")
        allowed[name] = (kid, pub)

    for name, raw in sigs:
        if name == log_name:
            if len(raw) != 68 or raw[:4] != log_kid:
                fail("malformed log signature")
            try:
                Ed25519PublicKey.from_public_bytes(log_pub).verify(raw[4:], body)
                log_verified = True
            except InvalidSignature:
                fail("checkpoint log signature invalid")
            continue
        if name not in allowed:
            fail(f"unknown witness signature line: {name}")
        kid, pub = allowed[name]
        if len(raw) != 76 or raw[:4] != kid:
            fail(f"malformed witness cosignature: {name}")
        ts = int.from_bytes(raw[4:12], "big")
        if ts <= 0:
            fail("witness timestamp must be positive")
        msg = b"cosignature/v1\ntime " + str(ts).encode("ascii") + b"\n" + body
        try:
            Ed25519PublicKey.from_public_bytes(pub).verify(raw[12:], msg)
        except InvalidSignature:
            fail(f"witness cosignature invalid: {name}")
        verified_witnesses[name] = max(ts, verified_witnesses.get(name, 0))

    if not log_verified:
        fail("checkpoint log signature missing")
    if len(verified_witnesses) < policy["threshold"]:
        fail("witness quorum not satisfied")
    observation = bundle.get("witness_observation", {})
    if observation.get("verified_witness_count") != len(verified_witnesses) or observation.get("quorum_satisfied") is not True:
        fail("witness observation summary mismatch")
    if observation.get("timestamps_are_observation_claims_only") is not True:
        fail("witness timestamp semantic boundary missing")
    boundaries = bundle.get("semantic_boundaries", {})
    if set(boundaries) != set(profile["always_false_claims"]) or any(boundaries.values()):
        fail("bundle semantic-boundary promotion")

    stable = {
        "subject": subject,
        "log": log,
        "checkpoint_body_sha256": checkpoint["signed_body_sha256"],
        "policy_sha256": policy_digest,
        "verified_witnesses": sorted(verified_witnesses),
        "quorum_threshold": policy["threshold"],
    }
    return {
        "transparency_inclusion_verified": True,
        "checkpoint_log_signature_verified": True,
        "verified_witnesses": sorted(verified_witnesses),
        "verified_witness_count": len(verified_witnesses),
        "quorum_threshold": policy["threshold"],
        "quorum_satisfied": True,
        "stable_semantic_fingerprint_sha256": sha256_hex(canonical(stable)),
    }


def normalize_external_hash(value: Any) -> bytes:
    return decode_hash(value)


def active_manifest(report: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    label = report.get("active_manifest") or report.get("activeManifest")
    if not isinstance(label, str) or not label:
        fail("C2PA report missing active manifest")
    manifest = (report.get("manifests") or {}).get(label)
    if not isinstance(manifest, dict):
        fail("C2PA active manifest not found")
    return label, manifest


def assert_c2pa_valid(report: dict[str, Any]) -> str:
    label, _manifest = active_manifest(report)
    results = report.get("validation_results") or report.get("validationResults") or {}
    active = results.get("activeManifest") or results.get("active_manifest") or {}
    successes = {str(x.get("code", "")) for x in active.get("success", []) if isinstance(x, dict)}
    failures = [
        str(x.get("code", "")) for x in active.get("failure", [])
        if isinstance(x, dict) and str(x.get("code", "")) not in TOLERATED_FAILURES
    ]
    if failures:
        fail(f"C2PA active manifest has failure(s): {failures}")
    state = report.get("validation_state") or report.get("validationState")
    if state is not None and str(state).lower() == "invalid":
        fail("C2PA validation state invalid")
    if "claimSignature.validated" not in successes or "claimSignature.insideValidity" not in successes:
        fail("C2PA claim signature validation success missing")
    return label


def find_external_reference(manifest: dict[str, Any], label: str) -> dict[str, Any]:
    matches = [a for a in manifest.get("assertions", []) if isinstance(a, dict) and a.get("label") == label]
    if len(matches) != 1:
        fail(f"expected exactly one {label} assertion, found {len(matches)}")
    return matches[0]


def verify_successor(
    profile: dict[str, Any],
    parent: dict[str, Any],
    bundle_bytes: bytes,
    resolved_bundle_bytes: bytes,
    successor_report: dict[str, Any],
    successor_detailed: dict[str, Any],
) -> dict[str, Any]:
    if bundle_bytes != resolved_bundle_bytes:
        fail("resolved external evidence bundle bytes mismatch")
    bundle = json.loads(bundle_bytes)
    bundle_result = verify_bundle(profile, parent, bundle)
    successor_label = assert_c2pa_valid(successor_report)
    _label, manifest = active_manifest(successor_report)
    ingredients = [i for i in manifest.get("ingredients", []) if isinstance(i, dict)]
    parents = [i for i in ingredients if str(i.get("relationship", "")).lower() == "parentof"]
    if len(parents) != 1:
        fail(f"successor Update Manifest must expose exactly one parentOf ingredient, found {len(parents)}")
    successor_parent = extract_parent_link(successor_report, successor_detailed)
    if successor_parent != parent:
        fail("successor parent hashed-URI binding differs from bundle predecessor subject")

    assertion = find_external_reference(manifest, profile["external_reference"]["assertion_label"])
    location = (assertion.get("data") or {}).get("location") or {}
    expected_hash = sha256(bundle_bytes)
    bound_hash = normalize_external_hash(location.get("hash"))
    if location.get("url") != profile["external_reference"]["url"]:
        fail("successor external-reference URL mismatch")
    if location.get("alg") != profile["external_reference"]["digest_alg"]:
        fail("successor external-reference algorithm mismatch")
    if location.get("dc:format") != profile["external_reference"]["media_type"]:
        fail("successor external-reference media type mismatch")
    if location.get("size") != len(bundle_bytes):
        fail("successor external-reference size mismatch")
    if bound_hash != expected_hash:
        fail("successor external-reference hash mismatch")

    parent_url = parent["active_manifest"]["url"]
    if successor_label in parent_url:
        fail("same-successor-claim self-reference detected")
    if bundle.get("subject_scope") != "PREDECESSOR_C2PA_MANIFEST_REFERENCED_BY_SUCCESSOR_UPDATE":
        fail("bundle is not predecessor-scoped")

    return {
        **bundle_result,
        "successor_c2pa_validation_accepted": True,
        "successor_update_parent_count": 1,
        "successor_parent_binding_matches_bundle_subject": True,
        "external_reference_exact_bundle_binding": True,
        "same_claim_self_reference_rejected": True,
    }


def build_manifest_config(profile: dict[str, Any], bundle_bytes: bytes) -> dict[str, Any]:
    validate_profile(profile)
    digest = sha256(bundle_bytes)
    return {
        "claim_generator_info": [
            {"name": "UU-AAP witnessed-checkpoint successor fixture", "version": "0.1"}
        ],
        "assertions": [
            {
                "label": profile["external_reference"]["assertion_label"],
                "kind": "Cbor",
                "created": False,
                "data": {
                    "location": {
                        "url": profile["external_reference"]["url"],
                        "alg": profile["external_reference"]["digest_alg"],
                        "hash": list(digest),
                        "dc:format": profile["external_reference"]["media_type"],
                        "size": len(bundle_bytes),
                    },
                    "description": "UU-AAP experimental witnessed-checkpoint evidence about the predecessor manifest referenced by this Update Manifest; not evidence that this successor claim itself was logged."
                },
            }
        ],
    }


def qualify(
    profile: dict[str, Any],
    parent: dict[str, Any],
    bundle_bytes: bytes,
    resolved_bundle_bytes: bytes,
    successor_report: dict[str, Any],
    successor_detailed: dict[str, Any],
    repo_root: Path,
) -> dict[str, Any]:
    validate_predecessor_bindings(profile, repo_root)
    result = verify_successor(profile, parent, bundle_bytes, resolved_bundle_bytes, successor_report, successor_detailed)
    claims = {name: False for name in profile["always_false_claims"]}
    receipt = {
        "schema": RECEIPT_SCHEMA,
        "tracking_issue": 1007,
        "repository_predecessor_main": profile["repository_predecessor_main"],
        "repository_predecessor_tree": profile["repository_predecessor_tree"],
        "accepted_witness_qualification": {
            "receipt_git_blob": profile["accepted_witness_qualification"]["receipt_git_blob"],
            "receipt_fingerprint_sha256": profile["accepted_witness_qualification"]["receipt_fingerprint_sha256"],
        },
        "accepted_c2pa_binding": {
            "receipt_git_blob": profile["accepted_c2pa_binding"]["receipt_git_blob"],
        },
        "predecessor_subject": parent,
        "evidence_bundle": {
            "sha256": sha256_hex(bundle_bytes),
            "bytes": len(bundle_bytes),
            "stable_semantic_fingerprint_sha256": result["stable_semantic_fingerprint_sha256"],
            "transparency_inclusion_verified": result["transparency_inclusion_verified"],
            "checkpoint_log_signature_verified": result["checkpoint_log_signature_verified"],
            "verified_witnesses": result["verified_witnesses"],
            "verified_witness_count": result["verified_witness_count"],
            "quorum_threshold": result["quorum_threshold"],
            "quorum_satisfied": result["quorum_satisfied"],
        },
        "successor_update_manifest": {
            "c2pa_validation_accepted": result["successor_c2pa_validation_accepted"],
            "exactly_one_parent_of": result["successor_update_parent_count"] == 1,
            "parent_binding_matches_bundle_subject": result["successor_parent_binding_matches_bundle_subject"],
            "external_reference_exact_bundle_binding": result["external_reference_exact_bundle_binding"],
            "same_claim_self_reference_classification": "SAME_CLAIM_SELF_REFERENCE_REJECTED",
        },
        "claims": {
            "predecessor_c2pa_evidence_witnessed_and_bound_by_successor_update_manifest": True,
            **claims,
        },
        "automatic_action": False,
        "external_mutation_performed": False,
        "verdict": profile["strong_verdict"],
    }
    receipt["receipt_fingerprint_sha256"] = sha256_hex(canonical(receipt))
    return receipt


def cmd_extract(args: argparse.Namespace) -> int:
    docs = [load_json(p) for p in args.documents]
    write_json(args.output, extract_parent_link(*docs))
    return 0


def cmd_build_bundle(args: argparse.Namespace) -> int:
    profile = load_json(args.profile)
    parent = load_json(args.parent)
    bundle = build_bundle(profile, parent)
    write_json(args.output, bundle)
    return 0


def cmd_verify_bundle(args: argparse.Namespace) -> int:
    profile = load_json(args.profile)
    parent = load_json(args.parent)
    bundle = load_json(args.bundle)
    print(json.dumps(verify_bundle(profile, parent, bundle), indent=2, sort_keys=True))
    return 0


def cmd_build_manifest(args: argparse.Namespace) -> int:
    profile = load_json(args.profile)
    bundle_bytes = Path(args.bundle).read_bytes()
    write_json(args.output, build_manifest_config(profile, bundle_bytes))
    return 0


def cmd_qualify(args: argparse.Namespace) -> int:
    profile = load_json(args.profile)
    parent = load_json(args.parent)
    bundle_bytes = Path(args.bundle).read_bytes()
    resolved = Path(args.resolved_bundle).read_bytes()
    report = load_json(args.successor_report)
    detailed = load_json(args.successor_detailed)
    receipt = qualify(profile, parent, bundle_bytes, resolved, report, detailed, Path(args.repo_root))
    write_json(args.output, receipt)
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("extract-parent")
    p.add_argument("--documents", nargs="+", required=True)
    p.add_argument("--output", required=True)
    p.set_defaults(fn=cmd_extract)

    p = sub.add_parser("build-bundle")
    p.add_argument("--profile", required=True)
    p.add_argument("--parent", required=True)
    p.add_argument("--output", required=True)
    p.set_defaults(fn=cmd_build_bundle)

    p = sub.add_parser("verify-bundle")
    p.add_argument("--profile", required=True)
    p.add_argument("--parent", required=True)
    p.add_argument("--bundle", required=True)
    p.set_defaults(fn=cmd_verify_bundle)

    p = sub.add_parser("build-manifest")
    p.add_argument("--profile", required=True)
    p.add_argument("--bundle", required=True)
    p.add_argument("--output", required=True)
    p.set_defaults(fn=cmd_build_manifest)

    p = sub.add_parser("qualify")
    p.add_argument("--profile", required=True)
    p.add_argument("--parent", required=True)
    p.add_argument("--bundle", required=True)
    p.add_argument("--resolved-bundle", required=True)
    p.add_argument("--successor-report", required=True)
    p.add_argument("--successor-detailed", required=True)
    p.add_argument("--repo-root", default=".")
    p.add_argument("--output", required=True)
    p.set_defaults(fn=cmd_qualify)

    args = ap.parse_args()
    try:
        return args.fn(args)
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"C2PA_WITNESSED_CHECKPOINT_PROFILE_FAIL_CLOSED: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
