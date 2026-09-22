#!/usr/bin/env python3
from __future__ import annotations

import base64
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("wcprofile", HERE / "profile.py")
m = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(m)

profile = json.loads((HERE / "profile.json").read_text(encoding="utf-8"))

parent = {
    "relationship": "parentOf",
    "active_manifest": {
        "url": "self#jumbf=/c2pa/urn:c2pa:PREDECESSOR",
        "alg": "sha256",
        "hash_b64": base64.b64encode(bytes(range(32))).decode("ascii"),
        "hash_hex": bytes(range(32)).hex(),
    },
    "claim_signature": {
        "url": "self#jumbf=/c2pa/urn:c2pa:PREDECESSOR/c2pa.signature",
        "alg": "sha256",
        "hash_b64": base64.b64encode(bytes(range(32, 64))).decode("ascii"),
        "hash_hex": bytes(range(32, 64)).hex(),
    },
}


def hostile(fn, needle: str) -> None:
    try:
        fn()
    except ValueError as exc:
        if needle not in str(exc):
            raise AssertionError(f"expected {needle!r}, got {exc!r}") from exc
        return
    raise AssertionError(f"hostile mutation unexpectedly accepted: {needle}")


def synthetic_successor(bundle_bytes: bytes, detailed_parent=None, active_label="urn:c2pa:SUCCESSOR"):
    digest = m.sha256(bundle_bytes)
    report = {
        "active_manifest": active_label,
        "manifests": {
            active_label: {
                "ingredients": [
                    {
                        "relationship": "parentOf",
                        "active_manifest": "urn:c2pa:PREDECESSOR",
                        "label": "c2pa.ingredient.v3",
                    }
                ],
                "assertions": [
                    {
                        "label": "c2pa.external-reference",
                        "data": {
                            "location": {
                                "url": profile["external_reference"]["url"],
                                "alg": "sha256",
                                "hash": list(digest),
                                "dc:format": "application/json",
                                "size": len(bundle_bytes),
                            }
                        },
                    }
                ],
            }
        },
        "validation_results": {
            "activeManifest": {
                "success": [
                    {"code": "claimSignature.validated"},
                    {"code": "claimSignature.insideValidity"},
                ],
                "failure": [{"code": "signingCredential.untrusted"}],
            }
        },
        "validation_state": "Valid",
    }
    p = detailed_parent or {
        "relationship": "parentOf",
        "activeManifest": {
            "url": parent["active_manifest"]["url"],
            "alg": "sha256",
            "hash": list(bytes.fromhex(parent["active_manifest"]["hash_hex"])),
        },
        "claimSignature": {
            "url": parent["claim_signature"]["url"],
            "alg": "sha256",
            "hash": list(bytes.fromhex(parent["claim_signature"]["hash_hex"])),
        },
    }
    detailed = {"manifest": {"assertions": [{"data": p}]}}
    return report, detailed


def flip_log_signature(bundle: dict):
    b = copy.deepcopy(bundle)
    lines = b["checkpoint"]["signed_note"].splitlines()
    raw = bytearray(base64.b64decode(lines[4].split(" ", 2)[2]))
    raw[-1] ^= 1
    lines[4] = lines[4].rsplit(" ", 1)[0] + " " + base64.b64encode(raw).decode("ascii")
    b["checkpoint"]["signed_note"] = "\n".join(lines) + "\n"
    b["checkpoint"]["sha256"] = m.sha256_hex(b["checkpoint"]["signed_note"].encode())
    return b


def duplicate_one_witness(bundle: dict):
    b = copy.deepcopy(bundle)
    lines = b["checkpoint"]["signed_note"].splitlines()
    # body lines 0..2, empty separator 3, log 4, witness-a 5, witness-b 6
    lines[6] = lines[5]
    b["checkpoint"]["signed_note"] = "\n".join(lines) + "\n"
    b["checkpoint"]["sha256"] = m.sha256_hex(b["checkpoint"]["signed_note"].encode())
    b["witness_observation"]["verified_witness_count"] = 1
    b["witness_observation"]["cosigned_witnesses"] = [b["witness_observation"]["cosigned_witnesses"][0]]
    return b


def main():
    m.validate_profile(profile)

    doc = {
        "anything": [{
            "relationship": "parentOf",
            "activeManifest": {
                "url": parent["active_manifest"]["url"],
                "alg": "sha256",
                "hash": list(bytes.fromhex(parent["active_manifest"]["hash_hex"])),
            },
            "claimSignature": {
                "url": parent["claim_signature"]["url"],
                "alg": "sha256",
                "hash": list(bytes.fromhex(parent["claim_signature"]["hash_hex"])),
            },
        }]
    }
    assert m.extract_parent_link(doc) == parent

    bundle = m.build_bundle(profile, parent)
    result = m.verify_bundle(profile, parent, bundle)
    assert result["transparency_inclusion_verified"] is True
    assert result["checkpoint_log_signature_verified"] is True
    assert result["verified_witness_count"] == 2
    assert result["quorum_threshold"] == 2

    bundle_bytes = (json.dumps(bundle, indent=2, sort_keys=True) + "\n").encode()
    report, detailed = synthetic_successor(bundle_bytes)
    accepted = m.verify_successor(profile, parent, bundle_bytes, bundle_bytes, report, detailed)
    assert accepted["same_claim_self_reference_rejected"] is True

    hostile(lambda: m.verify_bundle(profile, {
        **parent,
        "active_manifest": {**parent["active_manifest"], "hash_hex": "00" * 32, "hash_b64": base64.b64encode(b"\0" * 32).decode()},
    }, bundle), "activeManifest mismatch")

    bad = copy.deepcopy(bundle)
    bad["subject"]["claim_signature"]["hash_hex"] = "00" * 32
    hostile(lambda: m.verify_bundle(profile, parent, bad), "claimSignature mismatch")

    bad = copy.deepcopy(bundle)
    bad["subject"]["commitment_domain"] = "urn:hostile"
    hostile(lambda: m.verify_bundle(profile, parent, bad), "commitment domain mismatch")

    bad = copy.deepcopy(bundle)
    bad["log"]["leaf_index"] = 0
    hostile(lambda: m.verify_bundle(profile, parent, bad), "log inclusion shape mismatch")

    bad = copy.deepcopy(bundle)
    raw = bytearray(base64.b64decode(bad["log"]["inclusion_proof_b64"][0]))
    raw[0] ^= 1
    bad["log"]["inclusion_proof_b64"][0] = base64.b64encode(raw).decode()
    hostile(lambda: m.verify_bundle(profile, parent, bad), "transparency inclusion proof failed")

    bad = flip_log_signature(bundle)
    hostile(lambda: m.verify_bundle(profile, parent, bad), "checkpoint log signature invalid")

    bad = duplicate_one_witness(bundle)
    hostile(lambda: m.verify_bundle(profile, parent, bad), "witness quorum not satisfied")

    bad = copy.deepcopy(bundle)
    bad["witness_policy"]["policy_sha256"] = "0" * 64
    hostile(lambda: m.verify_bundle(profile, parent, bad), "witness policy binding mismatch")

    bad = copy.deepcopy(bundle)
    bad["semantic_boundaries"]["submission_completeness_proven"] = True
    hostile(lambda: m.verify_bundle(profile, parent, bad), "semantic-boundary promotion")

    bad_report = copy.deepcopy(report)
    bad_report["manifests"][report["active_manifest"]]["assertions"][0]["data"]["location"]["url"] = "https://example.invalid/drift"
    hostile(lambda: m.verify_successor(profile, parent, bundle_bytes, bundle_bytes, bad_report, detailed), "URL mismatch")

    bad_report = copy.deepcopy(report)
    bad_report["manifests"][report["active_manifest"]]["assertions"][0]["data"]["location"]["hash"][0] ^= 1
    hostile(lambda: m.verify_successor(profile, parent, bundle_bytes, bundle_bytes, bad_report, detailed), "hash mismatch")

    bad_detail = copy.deepcopy(detailed)
    bad_detail["manifest"]["assertions"][0]["data"]["activeManifest"]["hash"][0] ^= 1
    hostile(lambda: m.verify_successor(profile, parent, bundle_bytes, bundle_bytes, report, bad_detail), "parent hashed-URI binding differs")

    predecessor_label = "urn:c2pa:PREDECESSOR"
    self_report, self_detail = synthetic_successor(bundle_bytes, active_label=predecessor_label)
    hostile(lambda: m.verify_successor(profile, parent, bundle_bytes, bundle_bytes, self_report, self_detail), "self-reference detected")

    hostile(lambda: m.verify_successor(profile, parent, bundle_bytes, bundle_bytes + b" ", report, detailed), "resolved external evidence bundle bytes mismatch")

    assert m.analyze_threshold_policy(3, 2)["disjoint_quorum_possible"] is False
    assert m.analyze_threshold_policy(3, 2)["minimum_pairwise_quorum_intersection"] == 1
    assert m.analyze_threshold_policy(3, 1)["disjoint_quorum_possible"] is True

    bad_profile = copy.deepcopy(profile)
    bad_profile["experimental_witness_policy"]["threshold"] = 1
    hostile(lambda: m.validate_profile(bad_profile), "witness-policy shape drift")

    bad_profile = copy.deepcopy(profile)
    bad_profile["frozen_qualification"]["receipt_sha256"] = "0" * 64
    hostile(lambda: m.validate_profile(bad_profile), "frozen qualification binding drift")

    print("C2PA_WITNESSED_CHECKPOINT_PROFILE_HOSTILE: PASS")


if __name__ == "__main__":
    main()
