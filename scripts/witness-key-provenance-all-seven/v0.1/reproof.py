#!/usr/bin/env python3
import argparse
import hashlib
import json
import pathlib
import re
from urllib.parse import urlparse

PROFILE_SCHEMA = "urn:uu-aap:witness-key-provenance-all-seven-profile:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:witness-key-provenance-all-seven-receipt:0.1"
SOURCE_CLASS = "OPERATOR_PUBLISHED_WITNESS_PAGE"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


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


def predecessor_observed_vkeys(predecessor_receipt):
    records = predecessor_receipt.get("source_records")
    if not isinstance(records, list):
        raise ValueError("predecessor source records unavailable")
    out = []
    for r in records:
        if not isinstance(r, dict):
            raise ValueError("invalid predecessor source record")
        if r.get("exact_vkey_observed") is True:
            v = r.get("witness_vkey")
            if not isinstance(v, str) or not v:
                raise ValueError("invalid predecessor observed vkey")
            out.append(v)
    if len(out) != len(set(out)):
        raise ValueError("duplicate predecessor observed vkey")
    if len(out) != 5:
        raise ValueError("predecessor exact-true record count drift")
    return set(out)


def validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile):
    expected = {
        "schema", "tracking_issue", "repository_predecessor_main",
        "predecessor_profile_path", "predecessor_profile_git_blob",
        "predecessor_receipt_path", "predecessor_receipt_git_blob",
        "required_predecessor_receipt_fingerprint_sha256",
        "required_predecessor_verdict",
        "required_predecessor_matched_witness_key_count",
        "required_predecessor_source_url_count",
        "required_predecessor_source_host_count",
        "pin_set_profile_path", "pin_set_profile_git_blob",
        "new_sources", "strong_verdict", "insufficient_verdict",
        "always_false_claims",
    }
    _strict_keys(profile, expected, "profile")
    if profile["schema"] != PROFILE_SCHEMA or profile["tracking_issue"] != 937:
        raise ValueError("wrong profile identity")
    for k in (
        "repository_predecessor_main", "predecessor_profile_git_blob",
        "predecessor_receipt_git_blob", "pin_set_profile_git_blob",
    ):
        if not HEX40.fullmatch(profile[k]):
            raise ValueError(f"invalid git sha field {k}")
    if not HEX64.fullmatch(profile["required_predecessor_receipt_fingerprint_sha256"]):
        raise ValueError("invalid predecessor receipt fingerprint")

    if predecessor_profile.get("tracking_issue") != 935:
        raise ValueError("wrong predecessor profile identity")
    if predecessor_receipt.get("tracking_issue") != 935:
        raise ValueError("wrong predecessor receipt identity")
    if predecessor_receipt.get("receipt_fingerprint_sha256") != profile["required_predecessor_receipt_fingerprint_sha256"]:
        raise ValueError("predecessor receipt fingerprint drift")
    if predecessor_receipt.get("verdict") != profile["required_predecessor_verdict"]:
        raise ValueError("predecessor verdict drift")
    if predecessor_receipt.get("matched_witness_key_count") != profile["required_predecessor_matched_witness_key_count"] or profile["required_predecessor_matched_witness_key_count"] != 5:
        raise ValueError("predecessor matched key count drift")
    if predecessor_receipt.get("unique_source_url_count") != profile["required_predecessor_source_url_count"] or profile["required_predecessor_source_url_count"] != 4:
        raise ValueError("predecessor source URL count drift")
    if predecessor_receipt.get("unique_source_host_count") != profile["required_predecessor_source_host_count"] or profile["required_predecessor_source_host_count"] != 4:
        raise ValueError("predecessor source host count drift")

    pins = pin_profile.get("witness_vkeys")
    if not isinstance(pins, list) or len(pins) != 7 or len(set(pins)) != 7:
        raise ValueError("exact seven-pin predecessor set drift")
    pin_set = set(pins)

    prior = predecessor_observed_vkeys(predecessor_receipt)
    if len(prior) != 5 or prior - pin_set:
        raise ValueError("predecessor observed pin set drift")

    if not isinstance(profile["new_sources"], list) or len(profile["new_sources"]) != 2:
        raise ValueError("exactly two missing sources required")
    ids, urls, vkeys = set(), set(), set()
    for s in profile["new_sources"]:
        _strict_keys(s, {"id", "source_url", "source_classification", "witness_vkey"}, "new source")
        if s["id"] in ids or s["source_url"] in urls or s["witness_vkey"] in vkeys:
            raise ValueError("duplicate new source id/url/vkey")
        ids.add(s["id"]); urls.add(s["source_url"]); vkeys.add(s["witness_vkey"])
        u = urlparse(s["source_url"])
        if u.scheme != "https" or not u.hostname:
            raise ValueError("new source must be explicit HTTPS URL")
        if s["source_classification"] != SOURCE_CLASS:
            raise ValueError("non-operator source classification rejected")
        if s["witness_vkey"] not in pin_set:
            raise ValueError("new source vkey not in exact seven-pin set")
        if s["witness_vkey"] in prior:
            raise ValueError("new source duplicates predecessor-observed pin")

    if prior | vkeys != pin_set:
        raise ValueError("profile does not cover exactly the two missing pins")
    if len(set(profile["always_false_claims"])) != len(profile["always_false_claims"]):
        raise ValueError("duplicate always-false claim")
    required_false = {
        "witness_identity_proven",
        "operator_independence_proven",
        "all_witnesses_independent_proven",
        "all_seven_currently_reobserved_in_one_run",
        "global_non_equivocation_proven",
        "truth_certified",
        "authority_created",
        "automatic_remediation_triggered",
    }
    if not required_false.issubset(set(profile["always_false_claims"])):
        raise ValueError("mandatory false-claim surface missing")
    return pin_set, prior


def evaluate(profile, predecessor_profile, predecessor_receipt, pin_profile, source_bodies):
    pin_set, prior = validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile)
    source_urls = {s["source_url"] for s in profile["new_sources"]}
    if set(source_bodies) != source_urls:
        raise ValueError("source map must provide exactly both allowlisted operator URLs")

    records = []
    matched_new = set()
    matched_urls = set()
    for s in profile["new_sources"]:
        body = source_bodies[s["source_url"]]
        if not isinstance(body, (bytes, bytearray)) or len(body) == 0:
            raise ValueError("source body unavailable or empty")
        exact = s["witness_vkey"].encode("utf-8") in body
        if exact:
            matched_new.add(s["witness_vkey"])
            matched_urls.add(s["source_url"])
        records.append({
            "id": s["id"],
            "witness_vkey": s["witness_vkey"],
            "source_url": s["source_url"],
            "source_host": urlparse(s["source_url"]).hostname,
            "source_classification": s["source_classification"],
            "retrieved_body_sha256": hashlib.sha256(body).hexdigest(),
            "exact_vkey_observed": exact,
        })

    composed = prior | matched_new
    strong = (
        len(prior) == 5
        and len(matched_new) == 2
        and len(composed) == 7
        and composed == pin_set
    )
    verdict = profile["strong_verdict"] if strong else profile["insufficient_verdict"]
    assurance = (
        "ALL_SEVEN_PINNED_WITNESS_KEYS_HAVE_BOUND_OPERATOR_SOURCE_OBSERVATIONS_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED"
        if strong else
        "INCOMPLETE_ALL_SEVEN_OPERATOR_SOURCE_PROVENANCE_OBSERVATIONS"
    )
    receipt = {
        "schema": RECEIPT_SCHEMA,
        "tracking_issue": profile["tracking_issue"],
        "predecessor": {
            "main_sha": profile["repository_predecessor_main"],
            "profile_git_blob": profile["predecessor_profile_git_blob"],
            "qualification_receipt_git_blob": profile["predecessor_receipt_git_blob"],
            "receipt_fingerprint_sha256": predecessor_receipt["receipt_fingerprint_sha256"],
            "verdict": predecessor_receipt["verdict"],
            "matched_witness_key_count": predecessor_receipt["matched_witness_key_count"],
        },
        "predecessor_observed_witness_key_count": len(prior),
        "new_source_records": records,
        "new_exact_witness_key_count": len(matched_new),
        "new_exact_source_url_count": len(matched_urls),
        "composed_exact_pinned_witness_key_count": len(composed),
        "composed_witness_vkeys": sorted(composed),
        "all_seven_operator_source_observations_composed": strong,
        "key_provenance_assurance": assurance,
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
    ap.add_argument("--source-map", required=True)
    args = ap.parse_args()
    profile = load_json(args.profile)
    predecessor_profile = load_json(profile["predecessor_profile_path"])
    predecessor_receipt = load_json(profile["predecessor_receipt_path"])
    pin_profile = load_json(profile["pin_set_profile_path"])
    source_map = load_json(args.source_map)
    if not isinstance(source_map, dict):
        raise SystemExit("source-map must be object")
    bodies = {url: pathlib.Path(path).read_bytes() for url, path in source_map.items()}
    receipt = evaluate(profile, predecessor_profile, predecessor_receipt, pin_profile, bodies)
    print(json.dumps(receipt, indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
