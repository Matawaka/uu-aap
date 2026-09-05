#!/usr/bin/env python3
from __future__ import annotations

import base64
import copy
import hashlib
import json
from pathlib import Path

import pilot
from receipt_validator import validate_receipt

HERE = Path(__file__).resolve().parent
PROFILE = json.loads((HERE / "profile.json").read_text(encoding="utf-8"))

passed = 0


def test(name, fn):
    global passed
    fn()
    passed += 1
    print(f"PASS {name}")


def expect_fail(fn):
    try:
        fn()
    except ValueError:
        return
    raise AssertionError("expected fail-closed rejection")


def fake_rootcommit():
    return {
        "checkpoint": {
            "origin": PROFILE["checkpoint"]["origin"],
            "tree_size": PROFILE["checkpoint"]["tree_size"],
            "root_line_verbatim": PROFILE["checkpoint"]["root_b64"],
        },
        "preimage": {
            "wallet": PROFILE["rootcommit"]["wallet"],
            "sha256": PROFILE["rootcommit"]["commitment_sha256"],
        },
        "anchor": {
            "type": "opentimestamps",
            "identifier": PROFILE["rootcommit"]["identifier"],
            "status": "bitcoin-confirmed",
        },
    }


def bind_receipt(r):
    material = dict(r)
    material.pop("receipt_fingerprint_sha256", None)
    r["receipt_fingerprint_sha256"] = pilot.sha256_hex(pilot.canonical_bytes(material))
    return r


def valid_receipt():
    claims = {x: False for x in PROFILE["always_false_claims"]}
    r = {
        "schema": pilot.SCHEMA,
        "tracking_issue": 929,
        "external_source_commit": PROFILE["external_source"]["commit"],
        "verdict": "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_NOT_ESTABLISHED",
        "opaque_leaf": {"index": 0, "raw_sha256": "1" * 64, "raw_bytes": 3, "semantic_claim_profile": None},
        "inclusion": {
            "tree_size": 1387,
            "proof_node_count": 11,
            "proof_text_sha256": "2" * 64,
            "computed_root_b64": PROFILE["checkpoint"]["root_b64"],
            "expected_root_b64": PROFILE["checkpoint"]["root_b64"],
            "verified": True,
        },
        "checkpoint_anchor": {
            "origin": PROFILE["checkpoint"]["origin"],
            "root_b64": PROFILE["checkpoint"]["root_b64"],
            "wallet": PROFILE["rootcommit"]["wallet"],
            "rootcommit_identifier": PROFILE["rootcommit"]["identifier"],
            "preimage_sha256": PROFILE["rootcommit"]["commitment_sha256"],
            "commitment_matches_profile": True,
            "ots_proof_sha256": "3" * 64,
            "ots_committed_digest_sha256": PROFILE["rootcommit"]["commitment_sha256"],
            "ots_binding_verified": True,
            "bitcoin_attestation_tag_present": True,
            "bitcoin_chain_confirmation": "NOT_ESTABLISHED",
        },
        "evidence_layers": {
            "signed_claim": "NOT_IN_SCOPE_OPAQUE_LEAF",
            "claim_commitment": "OPAQUE_LEAF_BYTES_HASHED_ONLY",
            "log_inclusion": "VERIFIED",
            "log_append_only_consistency": "NOT_VERIFIED_SINGLE_CHECKPOINT_ONLY",
            "checkpoint_non_equivocation": "EXTERNAL_ANCHOR_BINDING_VERIFIED",
            "existence_time_evidence": "OTS_BITCOIN_ATTESTATION_PRESENT_CHAIN_CONFIRMATION_NOT_ESTABLISHED",
        },
        "claims": claims,
        "automatic_action": False,
        "external_mutation_performed": False,
    }
    return bind_receipt(r)


test("accepted profile validates", lambda: pilot.validate_profile(PROFILE))

def t_preimage():
    cp, rc = PROFILE["checkpoint"], PROFILE["rootcommit"]
    p = pilot.rootcommit_preimage(cp["origin"], cp["tree_size"], cp["root_b64"], rc["wallet"], rc["identifier"])
    assert hashlib.sha256(p).hexdigest() == rc["commitment_sha256"]
test("rootcommit preimage independently reproduces published commitment", t_preimage)

def t_two_leaf():
    a, b = b"leaf-a", b"leaf-b"
    expected = pilot.node_hash(pilot.leaf_hash(a), pilot.leaf_hash(b))
    assert pilot.root_from_inclusion(0, 2, pilot.leaf_hash(a), [pilot.leaf_hash(b)]) == expected
    assert pilot.root_from_inclusion(1, 2, pilot.leaf_hash(b), [pilot.leaf_hash(a)]) == expected
test("RFC inclusion fold works for both sides of a two-leaf tree", t_two_leaf)

test("too-short inclusion proof rejected", lambda: expect_fail(lambda: pilot.root_from_inclusion(0, 2, pilot.leaf_hash(b"a"), [])))
test("too-long inclusion proof rejected", lambda: expect_fail(lambda: pilot.root_from_inclusion(0, 1, pilot.leaf_hash(b"a"), [b"x" * 32])))
test("invalid leaf index rejected", lambda: expect_fail(lambda: pilot.root_from_inclusion(2, 2, pilot.leaf_hash(b"a"), [])))
test("non-32-byte inclusion node rejected", lambda: expect_fail(lambda: pilot.parse_inclusion_proof(base64.b64encode(b"x" * 31).decode())))
test("invalid inclusion base64 rejected", lambda: expect_fail(lambda: pilot.parse_inclusion_proof("%%%")))

def t_ots():
    magic = bytes.fromhex(PROFILE["rootcommit"]["ots_magic_hex"])
    dig = bytes.fromhex(PROFILE["rootcommit"]["commitment_sha256"])
    proof = magic + b"\x01\x08" + dig + bytes.fromhex(PROFILE["rootcommit"]["bitcoin_attestation_tag_hex"])
    assert pilot.parse_ots_commitment(proof, magic) == dig
test("OTS detached-proof committed digest parsed independently", t_ots)

def t_bad_magic():
    magic = bytes.fromhex(PROFILE["rootcommit"]["ots_magic_hex"])
    proof = b"X" + magic[1:] + b"\x01\x08" + b"z" * 32
    expect_fail(lambda: pilot.parse_ots_commitment(proof, magic))
test("altered OTS magic rejected", t_bad_magic)

def t_bad_version():
    magic = bytes.fromhex(PROFILE["rootcommit"]["ots_magic_hex"])
    expect_fail(lambda: pilot.parse_ots_commitment(magic + b"\x02\x08" + b"z" * 32, magic))
test("unexpected OTS version rejected", t_bad_version)

def t_bad_hashop():
    magic = bytes.fromhex(PROFILE["rootcommit"]["ots_magic_hex"])
    expect_fail(lambda: pilot.parse_ots_commitment(magic + b"\x01\x03" + b"z" * 32, magic))
test("non-SHA256 OTS commitment rejected", t_bad_hashop)

test("external rootcommit metadata shape accepted without trusting status", lambda: pilot.validate_external_rootcommit(PROFILE, fake_rootcommit()))

def t_bad_wallet():
    x = fake_rootcommit(); x["preimage"]["wallet"] = "0x" + "0" * 40
    expect_fail(lambda: pilot.validate_external_rootcommit(PROFILE, x))
test("altered rootcommit wallet rejected", t_bad_wallet)

def t_bad_root():
    x = fake_rootcommit(); x["checkpoint"]["root_line_verbatim"] = base64.b64encode(b"x" * 32).decode()
    expect_fail(lambda: pilot.validate_external_rootcommit(PROFILE, x))
test("altered checkpoint root rejected", t_bad_root)

def t_leaf7235():
    p = copy.deepcopy(PROFILE); p["opaque_leaf"]["index"] = 7235
    expect_fail(lambda: pilot.validate_profile(p))
test("later leaf 7235 cannot be spliced into checkpoint 1387", t_leaf7235)

def t_collision_promotion():
    p = copy.deepcopy(PROFILE); p["opaque_leaf"]["collision_semantics_established"] = True
    expect_fail(lambda: pilot.validate_profile(p))
test("collision semantics cannot be manufactured", t_collision_promotion)

def t_claim_promotion():
    p = copy.deepcopy(PROFILE); p["opaque_leaf"]["semantic_claim_profile"] = "C2PA"
    expect_fail(lambda: pilot.validate_profile(p))
test("opaque leaf cannot be promoted to C2PA claim", t_claim_promotion)

test("baseline receipt semantic boundary validates", lambda: validate_receipt(valid_receipt(), PROFILE))

def t_false_claim():
    r = valid_receipt(); r["claims"]["global_non_equivocation_proven"] = True; bind_receipt(r)
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("global non-equivocation promotion rejected", t_false_claim)

def t_complete():
    r = valid_receipt(); r["claims"]["complete_history_proven"] = True; bind_receipt(r)
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("complete-history promotion rejected", t_complete)

def t_append_only():
    r = valid_receipt(); r["evidence_layers"]["log_append_only_consistency"] = "VERIFIED"; bind_receipt(r)
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("single checkpoint cannot become append-only consistency proof", t_append_only)

def t_strong_without_ref():
    r = valid_receipt(); r["verdict"] = "OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_VERIFIED"; bind_receipt(r)
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("Bitcoin attestation tag alone cannot promote chain confirmation", t_strong_without_ref)

def t_auto():
    r = valid_receipt(); r["automatic_action"] = True; bind_receipt(r)
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("automatic action promotion rejected", t_auto)

def t_mutation():
    r = valid_receipt(); r["external_mutation_performed"] = True; bind_receipt(r)
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("external mutation claim rejected", t_mutation)

def t_score():
    r = valid_receipt(); r["trust_score"] = 1; bind_receipt(r)
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("scalar trust score surface rejected", t_score)

def t_fingerprint():
    r = valid_receipt(); r["opaque_leaf"]["raw_bytes"] += 1
    expect_fail(lambda: validate_receipt(r, PROFILE))
test("receipt fingerprint detects mutation", t_fingerprint)

print(f"EXTERNAL_CHECKPOINT_ANCHOR_PILOT_HOSTILE: {passed}/{passed} PASS")
