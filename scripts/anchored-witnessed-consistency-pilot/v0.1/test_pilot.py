#!/usr/bin/env python3
from __future__ import annotations

import base64
import copy
import hashlib
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

import pilot
from receipt_validator import validate_receipt

HERE = Path(__file__).resolve().parent
PROFILE = json.loads((HERE / "profile.json").read_text(encoding="utf-8"))
PASSED = 0


def test(name, fn):
    global PASSED
    fn()
    PASSED += 1
    print(f"PASS {name}")


def expect_fail(fn):
    try:
        fn()
    except ValueError:
        return
    raise AssertionError("expected fail-closed rejection")


def raw_pub(priv: Ed25519PrivateKey) -> bytes:
    return priv.public_key().public_bytes_raw()


def log_vkey(name: str, priv: Ed25519PrivateKey) -> tuple[str, bytes]:
    pub = raw_pub(priv)
    kid = hashlib.sha256(name.encode() + b"\n\x01" + pub).digest()[:4]
    encoded = base64.b64encode(bytes([0x01]) + pub).decode().rstrip("=")
    return f"{name}+00000000+{encoded}", kid


def witness_vkey(name: str, priv: Ed25519PrivateKey) -> tuple[str, bytes]:
    pub = raw_pub(priv)
    kid = hashlib.sha256(name.encode() + b"\n\x04" + pub).digest()[:4]
    encoded = base64.b64encode(bytes([0x04]) + pub).decode().rstrip("=")
    return f"{name}+00000000+{encoded}", kid


def make_body(origin="example/log", size=2, root=None):
    root = root or hashlib.sha256(b"root").digest()
    return f"{origin}\n{size}\n{base64.b64encode(root).decode()}\n".encode(), root


def make_log_sig(name, kid, priv, body):
    return (name, kid + priv.sign(body))


def make_cosig(name, kid, priv, body, ts=1788600000):
    msg = b"cosignature/v1\ntime " + str(ts).encode() + b"\n" + body
    return (name, kid + ts.to_bytes(8, "big") + priv.sign(msg))


def valid_receipt():
    old = copy.deepcopy(PROFILE["old_checkpoint"])
    later = {
        "origin": old["origin"],
        "tree_size": 2000,
        "root_b64": base64.b64encode(b"r" * 32).decode(),
        "checkpoint_sha256": "1" * 64,
        "signed_body_sha256": "2" * 64,
        "log_signature_verified": True,
        "verified_witnesses": [v.split("+", 1)[0] for v in PROFILE["witness_vkeys"][:4]],
        "verified_witness_count": 4,
        "invalid_pinned_witness_signatures": [],
        "unknown_cosigner_names": [],
        "skipped_non_ed25519_cosignature_blobs": 2,
        "newest_verified_cosignature_timestamp": 1788600000,
        "quorum_min": 4,
        "authentication_verified": True,
        "key_provenance_assurance": "OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN",
    }
    receipt = {
        "schema": pilot.SCHEMA,
        "tracking_issue": 933,
        "verdict": "OBSERVED_APPEND_ONLY_EXTENSION_VERIFIED_LATER_CHECKPOINT_KEY_PROVENANCE_NOT_INDEPENDENTLY_ESTABLISHED",
        "old_checkpoint": old,
        "later_checkpoint": later,
        "consistency": {
            "old_size": 1387,
            "new_size": 2000,
            "proof_node_count": 12,
            "proof_text_sha256": "3" * 64,
            "verified": True,
        },
        "evidence_layers": {
            "old_checkpoint_external_anchor": "BINDING_VERIFIED_BITCOIN_CHAIN_CONFIRMATION_NOT_ESTABLISHED",
            "later_checkpoint_authentication": "LOG_SIGNATURE_AND_WITNESS_QUORUM_CRYPTOGRAPHICALLY_VERIFIED",
            "witness_key_provenance": "OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN",
            "log_append_only_consistency": "VERIFIED_OBSERVED_PAIR",
            "checkpoint_non_equivocation": "COSIGNATURES_VERIFIED_WITH_OPERATOR_CURATED_KEY_PINS",
            "global_view_consistency": "NOT_PROVEN",
            "semantic_claim_binding": "NOT_IN_SCOPE",
        },
        "claims": {name: False for name in PROFILE["always_false_claims"]},
        "automatic_action": False,
        "external_mutation_performed": False,
    }
    receipt["receipt_fingerprint_sha256"] = pilot.sha256_hex(pilot.canonical_bytes(receipt))
    return receipt


test("accepted profile validates", lambda: pilot.validate_profile(PROFILE))

def t_profile_key_provenance():
    p = copy.deepcopy(PROFILE)
    p["key_provenance_assurance"] = "INDEPENDENTLY_VERIFIED"
    expect_fail(lambda: pilot.validate_profile(p))
test("operator-curated witness pins cannot be promoted", t_profile_key_provenance)

def t_profile_second_anchor():
    p = copy.deepcopy(PROFILE)
    p["old_checkpoint"]["bitcoin_chain_confirmation"] = "VERIFIED"
    expect_fail(lambda: pilot.validate_profile(p))
test("accepted old anchor Bitcoin boundary cannot be rewritten", t_profile_second_anchor)

def t_vkeys():
    p = Ed25519PrivateKey.generate()
    lv, _ = log_vkey("example/log", p)
    name, _kid, pub = pilot.parse_log_vkey(lv)
    assert name == "example/log" and pub == raw_pub(p)
    wv, _ = witness_vkey("witness.example", p)
    name2, _kid2, pub2 = pilot.parse_witness_vkey(wv)
    assert name2 == "witness.example" and pub2 == raw_pub(p)
test("log and witness vkey parsing is independent", t_vkeys)

def t_wrong_vkey_alg():
    p = Ed25519PrivateKey.generate()
    pub = raw_pub(p)
    bad = "example/log+0+" + base64.b64encode(b"\x04" + pub).decode().rstrip("=")
    expect_fail(lambda: pilot.parse_log_vkey(bad))
test("wrong log vkey algorithm byte rejected", t_wrong_vkey_alg)

def t_log_sig():
    p = Ed25519PrivateKey.generate(); v, kid = log_vkey("example/log", p)
    body, _ = make_body()
    assert pilot.verify_log_signature(body, [make_log_sig("example/log", kid, p, body)], v)
test("valid log Ed25519 signature verifies", t_log_sig)

def t_log_sig_tamper():
    p = Ed25519PrivateKey.generate(); v, kid = log_vkey("example/log", p)
    body, _ = make_body()
    sig = make_log_sig("example/log", kid, p, body)
    assert not pilot.verify_log_signature(body + b"x", [sig], v)
test("tampered log body fails signature", t_log_sig_tamper)

def t_witness_valid():
    p = Ed25519PrivateKey.generate(); v, kid = witness_vkey("w1", p)
    body, _ = make_body()
    result = pilot.verify_witness_cosignatures(body, [make_cosig("w1", kid, p, body)], [v], "example/log")
    assert result["verified"] == ["w1"] and result["invalid"] == []
test("valid witness cosignature cryptographically verifies", t_witness_valid)

def t_witness_duplicate():
    p = Ed25519PrivateKey.generate(); v, kid = witness_vkey("w1", p)
    body, _ = make_body(); s = make_cosig("w1", kid, p, body)
    result = pilot.verify_witness_cosignatures(body, [s, s], [v], "example/log")
    assert result["verified"] == ["w1"]
test("duplicate witness cannot inflate quorum", t_witness_duplicate)

def t_unknown_witness():
    p = Ed25519PrivateKey.generate(); body, _ = make_body()
    result = pilot.verify_witness_cosignatures(body, [("unknown", b"x" * 76)], [], "example/log")
    assert result["verified"] == [] and result["unknown"] == ["unknown"]
test("unknown witness name never counts", t_unknown_witness)

def t_wrong_keyhash():
    p = Ed25519PrivateKey.generate(); v, kid = witness_vkey("w1", p)
    body, _ = make_body(); raw = make_cosig("w1", kid, p, body)[1]
    result = pilot.verify_witness_cosignatures(body, [("w1", b"0000" + raw[4:])], [v], "example/log")
    assert result["verified"] == [] and result["invalid"][0]["reason"] == "keyhash mismatch"
test("witness keyhash mismatch is invalid", t_wrong_keyhash)

def t_wrong_witness_sig():
    p = Ed25519PrivateKey.generate(); q = Ed25519PrivateKey.generate(); v, kid = witness_vkey("w1", p)
    body, _ = make_body(); raw = make_cosig("w1", kid, q, body)[1]
    result = pilot.verify_witness_cosignatures(body, [("w1", raw)], [v], "example/log")
    assert result["verified"] == [] and result["invalid"][0]["reason"] == "signature did not verify"
test("witness signature mismatch is invalid", t_wrong_witness_sig)

def t_non_ed_blob():
    p = Ed25519PrivateKey.generate(); v, _ = witness_vkey("w1", p)
    body, _ = make_body()
    result = pilot.verify_witness_cosignatures(body, [("w1", b"x" * 120)], [v], "example/log")
    assert result["skipped_non_ed25519"] == 1 and result["verified"] == []
test("non-Ed25519 witness blob is skipped not counted", t_non_ed_blob)

def t_four_unique():
    body, _ = make_body(); vkeys=[]; sigs=[]
    for i in range(4):
        p=Ed25519PrivateKey.generate(); v,k=witness_vkey(f"w{i}",p); vkeys.append(v); sigs.append(make_cosig(f"w{i}",k,p,body,1788600000+i))
    result=pilot.verify_witness_cosignatures(body,sigs,vkeys,"example/log")
    assert len(result["verified"]) == 4 and result["newest_verified_timestamp"] == 1788600003
test("four distinct verified witnesses remain distinct", t_four_unique)

def t_checkpoint_roundtrip():
    body, root = make_body(); p=Ed25519PrivateKey.generate(); v,k=log_vkey("example/log",p)
    name, raw = make_log_sig("example/log", k, p, body)
    note = body[:-1] + b"\n\n— " + name.encode() + b" " + base64.b64encode(raw) + b"\n"
    parsed_body, origin, size, parsed_root, sigs = pilot.parse_checkpoint(note)
    assert parsed_body == body and origin == "example/log" and size == 2 and parsed_root == root
    assert pilot.verify_log_signature(parsed_body, sigs, v)
test("signed-note checkpoint parse preserves signed body bytes", t_checkpoint_roundtrip)

def t_consistency_1_2():
    a = hashlib.sha256(b"a").digest(); b = hashlib.sha256(b"b").digest()
    root2 = pilot.node_hash(a,b)
    assert pilot.verify_consistency(1,2,a,root2,[b])
test("RFC consistency proof verifies 1 to 2", t_consistency_1_2)

def t_consistency_wrong_root():
    a=hashlib.sha256(b"a").digest(); b=hashlib.sha256(b"b").digest(); root2=pilot.node_hash(a,b)
    assert not pilot.verify_consistency(1,2,hashlib.sha256(b"x").digest(),root2,[b])
test("consistency proof cannot bind a different old root", t_consistency_wrong_root)

def t_consistency_short():
    a=hashlib.sha256(b"a").digest(); root2=pilot.node_hash(a,hashlib.sha256(b"b").digest())
    assert not pilot.verify_consistency(1,2,a,root2,[])
test("short consistency proof rejected", t_consistency_short)

def t_consistency_long():
    a=hashlib.sha256(b"a").digest(); b=hashlib.sha256(b"b").digest(); root2=pilot.node_hash(a,b)
    assert not pilot.verify_consistency(1,2,a,root2,[b,b])
test("long consistency proof rejected", t_consistency_long)

def t_bad_consistency_b64():
    expect_fail(lambda: pilot.parse_consistency_proof("%%%"))
test("malformed consistency base64 rejected", t_bad_consistency_b64)

def t_non32_consistency():
    expect_fail(lambda: pilot.parse_consistency_proof(base64.b64encode(b"x"*31).decode()))
test("non-32-byte consistency node rejected", t_non32_consistency)

test("baseline bounded receipt validates", lambda: validate_receipt(valid_receipt(), PROFILE))

def mutate_receipt(path, value):
    r=valid_receipt(); target=r
    for key in path[:-1]: target=target[key]
    target[path[-1]]=value
    material=dict(r); material.pop("receipt_fingerprint_sha256",None); r["receipt_fingerprint_sha256"]=pilot.sha256_hex(pilot.canonical_bytes(material))
    return r

def t_less_than_quorum():
    r=valid_receipt(); r["later_checkpoint"]["verified_witnesses"]=r["later_checkpoint"]["verified_witnesses"][:3]; r["later_checkpoint"]["verified_witness_count"]=3
    material=dict(r); material.pop("receipt_fingerprint_sha256",None); r["receipt_fingerprint_sha256"]=pilot.sha256_hex(pilot.canonical_bytes(material))
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("fewer than four witnesses cannot retain authenticated success", t_less_than_quorum)

def t_unknown_counted():
    r=valid_receipt(); r["later_checkpoint"]["verified_witnesses"][0]="unknown.example"
    material=dict(r); material.pop("receipt_fingerprint_sha256",None); r["receipt_fingerprint_sha256"]=pilot.sha256_hex(pilot.canonical_bytes(material))
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("unknown witness cannot appear in verified quorum", t_unknown_counted)

def t_key_prov_promote():
    r=mutate_receipt(["later_checkpoint","key_provenance_assurance"],"INDEPENDENTLY_VERIFIED")
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("cryptographic signature verification cannot promote key provenance", t_key_prov_promote)

def t_second_anchor():
    r=mutate_receipt(["claims","second_bitcoin_anchor_proven"],True)
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("second Bitcoin anchor cannot be invented", t_second_anchor)

def t_global():
    r=mutate_receipt(["claims","global_non_equivocation_proven"],True)
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("global non-equivocation promotion rejected", t_global)

def t_complete():
    r=mutate_receipt(["claims","complete_history_proven"],True)
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("complete history promotion rejected", t_complete)

def t_c2pa():
    r=mutate_receipt(["claims","c2pa_manifest_inclusion_proven"],True)
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("C2PA manifest inclusion promotion rejected", t_c2pa)

def t_collision():
    r=mutate_receipt(["claims","collision_semantics_established"],True)
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("semantic collision binding cannot be inferred", t_collision)

def t_auto():
    r=mutate_receipt(["automatic_action"],True)
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("automatic action promotion rejected", t_auto)

def t_score():
    r=valid_receipt(); r["trust_score"]=1
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("scalar trust score surface rejected", t_score)

def t_fingerprint():
    r=valid_receipt(); r["consistency"]["proof_node_count"] += 1
    expect_fail(lambda: validate_receipt(r,PROFILE))
test("receipt fingerprint detects mutation", t_fingerprint)

print(f"ANCHORED_WITNESSED_CONSISTENCY_HOSTILE: {PASSED}/{PASSED} PASS")
