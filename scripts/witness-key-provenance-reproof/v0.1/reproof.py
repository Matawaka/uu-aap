#!/usr/bin/env python3
import argparse
import hashlib
import json
import pathlib
import re
from urllib.parse import urlparse

PROFILE_SCHEMA = "urn:uu-aap:witness-key-provenance-reproof-profile:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:witness-key-provenance-reproof-receipt:0.1"
SOURCE_CLASS = "OPERATOR_PUBLISHED_WITNESS_PAGE"
HEX40 = re.compile(r"^[0-9a-f]{40}$")


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def fingerprint(receipt):
    x = dict(receipt)
    x.pop("receipt_fingerprint_sha256", None)
    return hashlib.sha256(canonical(x)).hexdigest()


def _strict_keys(obj, expected, label):
    if set(obj) != set(expected):
        extra = sorted(set(obj) - set(expected))
        missing = sorted(set(expected) - set(obj))
        raise ValueError(f"{label} closed-world keys mismatch extra={extra} missing={missing}")


def validate_profile(profile, predecessor_profile, predecessor_receipt):
    expected = {
        "schema", "tracking_issue", "repository_predecessor_main",
        "predecessor_profile_path", "predecessor_profile_git_blob",
        "predecessor_receipt_path", "predecessor_receipt_git_blob",
        "predecessor_checkpoint_path", "predecessor_checkpoint_sha256",
        "predecessor_consistency_sha256", "required_predecessor_receipt_fingerprint_sha256",
        "predecessor_qualification_artifact", "required_predecessor_verdict",
        "required_predecessor_key_provenance_assurance", "quorum_min",
        "operator_sources", "strong_verdict", "insufficient_verdict",
        "always_false_claims"
    }
    _strict_keys(profile, expected, "profile")
    if profile["schema"] != PROFILE_SCHEMA or profile["tracking_issue"] != 935:
        raise ValueError("wrong profile identity")
    for k in ("repository_predecessor_main", "predecessor_profile_git_blob", "predecessor_receipt_git_blob"):
        if not HEX40.fullmatch(profile[k]):
            raise ValueError(f"invalid sha field {k}")
    for k in ("predecessor_checkpoint_sha256", "predecessor_consistency_sha256", "required_predecessor_receipt_fingerprint_sha256"):
        if not re.fullmatch(r"[0-9a-f]{64}", profile[k]):
            raise ValueError(f"invalid sha256 field {k}")
    art = profile["predecessor_qualification_artifact"]
    _strict_keys(art, {"workflow_run_id", "artifact_id", "artifact_digest_sha256", "qualified_head_sha"}, "predecessor artifact")
    if not isinstance(art["workflow_run_id"], int) or not isinstance(art["artifact_id"], int):
        raise ValueError("invalid predecessor artifact ids")
    if not re.fullmatch(r"[0-9a-f]{64}", art["artifact_digest_sha256"]) or not HEX40.fullmatch(art["qualified_head_sha"]):
        raise ValueError("invalid predecessor artifact binding")
    if predecessor_profile.get("quorum_min") != profile["quorum_min"] or profile["quorum_min"] != 4:
        raise ValueError("quorum drift")
    if predecessor_profile.get("key_provenance_assurance") != profile["required_predecessor_key_provenance_assurance"]:
        raise ValueError("predecessor profile provenance drift")
    if predecessor_receipt.get("receipt_fingerprint_sha256") != profile["required_predecessor_receipt_fingerprint_sha256"]:
        raise ValueError("predecessor receipt fingerprint drift")
    if predecessor_receipt.get("later_checkpoint", {}).get("checkpoint_sha256") != profile["predecessor_checkpoint_sha256"]:
        raise ValueError("predecessor checkpoint digest drift")
    if predecessor_receipt.get("consistency", {}).get("proof_text_sha256") != profile["predecessor_consistency_sha256"]:
        raise ValueError("predecessor consistency digest drift")
    if predecessor_receipt.get("verdict") != profile["required_predecessor_verdict"]:
        raise ValueError("predecessor receipt verdict drift")
    if predecessor_receipt.get("later_checkpoint", {}).get("key_provenance_assurance") != profile["required_predecessor_key_provenance_assurance"]:
        raise ValueError("predecessor receipt key provenance drift")
    pinned = predecessor_profile.get("witness_vkeys")
    if not isinstance(pinned, list) or len(pinned) != 7 or len(set(pinned)) != 7:
        raise ValueError("predecessor pinned witness set drift")

    ids, vkeys = set(), set()
    for s in profile["operator_sources"]:
        _strict_keys(s, {"id", "source_url", "source_classification", "witness_vkey"}, "source")
        if s["id"] in ids or s["witness_vkey"] in vkeys:
            raise ValueError("duplicate source id or witness key")
        ids.add(s["id"]); vkeys.add(s["witness_vkey"])
        u = urlparse(s["source_url"])
        if u.scheme != "https" or not u.hostname:
            raise ValueError("source must be explicit HTTPS URL")
        if s["source_classification"] != SOURCE_CLASS:
            raise ValueError("non-operator source classification rejected")
        if s["witness_vkey"] not in pinned:
            raise ValueError("source witness key is not pinned by predecessor")
    if len(profile["operator_sources"]) < profile["quorum_min"]:
        raise ValueError("profile cannot satisfy quorum-many provenance")
    if len({s["source_url"] for s in profile["operator_sources"]}) < profile["quorum_min"]:
        raise ValueError("profile lacks quorum-many distinct operator source URLs")
    if len(set(profile["always_false_claims"])) != len(profile["always_false_claims"]):
        raise ValueError("duplicate false claim")


def evaluate(profile, predecessor_profile, predecessor_receipt, source_bodies):
    validate_profile(profile, predecessor_profile, predecessor_receipt)
    source_urls = {s["source_url"] for s in profile["operator_sources"]}
    if set(source_bodies) != source_urls:
        raise ValueError("source map must provide exactly all allowlisted URLs")

    records = []
    matched_vkeys = set()
    for s in profile["operator_sources"]:
        body = source_bodies[s["source_url"]]
        if not isinstance(body, (bytes, bytearray)) or len(body) == 0:
            raise ValueError("source body unavailable or empty")
        exact = s["witness_vkey"].encode("utf-8") in body
        if exact:
            matched_vkeys.add(s["witness_vkey"])
        host = urlparse(s["source_url"]).hostname
        records.append({
            "id": s["id"],
            "witness_vkey": s["witness_vkey"],
            "source_url": s["source_url"],
            "source_host": host,
            "source_classification": s["source_classification"],
            "retrieved_body_sha256": hashlib.sha256(body).hexdigest(),
            "exact_vkey_observed": exact,
        })

    matched_records = [r for r in records if r["exact_vkey_observed"]]
    matched_count = len(matched_vkeys)
    unique_urls = len({r["source_url"] for r in matched_records})
    unique_hosts = len({r["source_host"] for r in matched_records})
    quorum_many_keys = matched_count >= profile["quorum_min"]
    quorum_many_distinct_sources = unique_urls >= profile["quorum_min"]
    strong = quorum_many_keys and quorum_many_distinct_sources
    verdict = profile["strong_verdict"] if strong else profile["insufficient_verdict"]
    receipt = {
        "schema": RECEIPT_SCHEMA,
        "tracking_issue": profile["tracking_issue"],
        "predecessor": {
            "main_sha": profile["repository_predecessor_main"],
            "verdict": predecessor_receipt["verdict"],
            "receipt_fingerprint_sha256": predecessor_receipt["receipt_fingerprint_sha256"],
            "key_provenance_assurance": predecessor_receipt["later_checkpoint"]["key_provenance_assurance"],
            "verified_witness_count": predecessor_receipt["later_checkpoint"]["verified_witness_count"],
        },
        "quorum_min": profile["quorum_min"],
        "source_records": records,
        "matched_witness_key_count": matched_count,
        "unique_source_url_count": unique_urls,
        "unique_source_host_count": unique_hosts,
        "quorum_many_exact_vkeys_reobserved": quorum_many_keys,
        "quorum_many_distinct_source_urls_reobserved": quorum_many_distinct_sources,
        "key_provenance_assurance": (
            "QUORUM_MANY_OPERATOR_PUBLISHED_EXACT_VKEYS_REOBSERVED_FROM_QUORUM_MANY_SOURCE_URLS_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED"
            if strong else
            "INSUFFICIENT_OPERATOR_PUBLISHED_EXACT_VKEYS_REOBSERVED"
        ),
        "claims": {c: False for c in profile["always_false_claims"]},
        "automatic_action": False,
        "external_mutation_performed": False,
        "verdict": verdict,
    }
    receipt["receipt_fingerprint_sha256"] = fingerprint(receipt)
    return receipt


def load_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", required=True)
    ap.add_argument("--source-map", required=True, help="JSON object mapping exact source URL to local fetched file")
    args = ap.parse_args()
    profile = load_json(args.profile)
    predecessor_profile = load_json(profile["predecessor_profile_path"])
    predecessor_receipt = load_json(profile["predecessor_receipt_path"])
    source_map = load_json(args.source_map)
    if not isinstance(source_map, dict):
        raise SystemExit("source-map must be object")
    bodies = {url: pathlib.Path(path).read_bytes() for url, path in source_map.items()}
    print(json.dumps(evaluate(profile, predecessor_profile, predecessor_receipt, bodies), indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
