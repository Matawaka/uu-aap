#!/usr/bin/env python3
import argparse
import hashlib
import json
import pathlib
import re
from urllib.parse import urlparse

PROFILE_SCHEMA = "urn:uu-aap:witness-key-provenance-same-run-all-seven-profile:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:witness-key-provenance-same-run-all-seven-receipt:0.1"
SOURCE_CLASSES = {
    "OPERATOR_PUBLISHED_WITNESS_PAGE",
    "OPERATOR_OWNED_REPOSITORY_SOURCE",
}
GEOMYS_URL = "https://raw.githubusercontent.com/geomys/magnolia/0545421c001b16c0fb328cd9254010c46fa424a6/cmd/hetrix/geomys.go"
GEOMYS_BLOB = "95a3e95134487229343bb6197f6fa1723cfa20d7"
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


def validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile):
    expected = {
        "schema", "tracking_issue", "repository_predecessor_main",
        "predecessor_profile_path", "predecessor_profile_git_blob",
        "predecessor_receipt_path", "predecessor_receipt_git_blob",
        "required_predecessor_receipt_fingerprint_sha256",
        "required_predecessor_verdict",
        "required_predecessor_composed_witness_key_count",
        "pin_set_profile_path", "pin_set_profile_git_blob",
        "required_distinct_source_url_count",
        "sources", "strong_verdict", "insufficient_verdict",
        "always_false_claims",
    }
    _strict_keys(profile, expected, "profile")
    if profile["schema"] != PROFILE_SCHEMA or profile["tracking_issue"] != 939:
        raise ValueError("wrong profile identity")
    for k in (
        "repository_predecessor_main", "predecessor_profile_git_blob",
        "predecessor_receipt_git_blob", "pin_set_profile_git_blob",
    ):
        if not HEX40.fullmatch(profile[k]):
            raise ValueError(f"invalid git sha field {k}")
    if not HEX64.fullmatch(profile["required_predecessor_receipt_fingerprint_sha256"]):
        raise ValueError("invalid predecessor fingerprint")

    if predecessor_profile.get("tracking_issue") != 937:
        raise ValueError("wrong #938 predecessor profile identity")
    if predecessor_receipt.get("tracking_issue") != 937:
        raise ValueError("wrong #938 predecessor receipt identity")
    if predecessor_receipt.get("receipt_fingerprint_sha256") != profile["required_predecessor_receipt_fingerprint_sha256"]:
        raise ValueError("#938 receipt fingerprint drift")
    if predecessor_receipt.get("verdict") != profile["required_predecessor_verdict"]:
        raise ValueError("#938 verdict drift")
    if (
        predecessor_receipt.get("composed_exact_pinned_witness_key_count")
        != profile["required_predecessor_composed_witness_key_count"]
        or profile["required_predecessor_composed_witness_key_count"] != 7
    ):
        raise ValueError("#938 composed key count drift")
    if predecessor_receipt.get("all_seven_operator_source_observations_composed") is not True:
        raise ValueError("#938 all-seven composition drift")
    if predecessor_receipt.get("claims", {}).get("all_seven_currently_reobserved_in_one_run") is not False:
        raise ValueError("#938 historical same-run nonclaim drift")

    pins = pin_profile.get("witness_vkeys")
    if not isinstance(pins, list) or len(pins) != 7 or len(set(pins)) != 7:
        raise ValueError("exact #934 seven-pin set drift")
    pin_set = set(pins)

    if profile["required_distinct_source_url_count"] != 6:
        raise ValueError("distinct source URL threshold drift")
    if not isinstance(profile["sources"], list) or len(profile["sources"]) != 7:
        raise ValueError("exactly seven source records required")

    ids, vkeys = set(), set()
    urls = set()
    for s in profile["sources"]:
        _strict_keys(s, {"id", "source_url", "source_classification", "witness_vkey", "expected_git_blob"}, "source")
        if s["id"] in ids or s["witness_vkey"] in vkeys:
            raise ValueError("duplicate source id or witness vkey")
        ids.add(s["id"]); vkeys.add(s["witness_vkey"]); urls.add(s["source_url"])
        u = urlparse(s["source_url"])
        if u.scheme != "https" or not u.hostname:
            raise ValueError("source must be explicit HTTPS URL")
        if s["source_classification"] not in SOURCE_CLASSES:
            raise ValueError("unsupported source classification")
        if s["witness_vkey"] not in pin_set:
            raise ValueError("source vkey outside exact #934 pin set")
        eg = s["expected_git_blob"]
        if s["source_url"] == GEOMYS_URL:
            if s["source_classification"] != "OPERATOR_OWNED_REPOSITORY_SOURCE" or eg != GEOMYS_BLOB:
                raise ValueError("Geomys source binding drift")
        else:
            if eg is not None:
                raise ValueError("unexpected git blob binding on non-Geomys source")
            if s["source_classification"] != "OPERATOR_PUBLISHED_WITNESS_PAGE":
                raise ValueError("non-Geomys source class drift")

    if vkeys != pin_set:
        raise ValueError("source records must cover exact #934 seven-pin set")
    if len(urls) != profile["required_distinct_source_url_count"]:
        raise ValueError("source URL cardinality drift")
    # Exactly one repeated URL is permitted: the TrustFabric page carries two exact pins.
    counts = {u: sum(1 for s in profile["sources"] if s["source_url"] == u) for u in urls}
    repeated = [u for u, n in counts.items() if n == 2]
    if repeated != ["https://transparency.dev/witnesses"] or any(n not in (1, 2) for n in counts.values()):
        raise ValueError("source URL reuse contract drift")

    claims = profile["always_false_claims"]
    if len(claims) != len(set(claims)):
        raise ValueError("duplicate always-false claim")
    mandatory_false = {
        "witness_identity_proven", "operator_independence_proven",
        "all_witnesses_independent_proven", "all_seven_currently_active_proven",
        "legal_operator_identity_proven", "global_non_equivocation_proven",
        "c2pa_manifest_inclusion_proven", "truth_certified",
        "authority_created", "automatic_remediation_triggered",
    }
    if not mandatory_false.issubset(set(claims)):
        raise ValueError("mandatory false-claim surface missing")
    return pin_set


def evaluate(profile, predecessor_profile, predecessor_receipt, pin_profile, source_bodies):
    pin_set = validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile)
    source_urls = {s["source_url"] for s in profile["sources"]}
    if set(source_bodies) != source_urls:
        raise ValueError("source map must provide exactly all six allowlisted URLs")

    records = []
    matched_vkeys = set()
    matched_urls = set()
    matched_hosts = set()
    for s in profile["sources"]:
        body = source_bodies[s["source_url"]]
        if not isinstance(body, (bytes, bytearray)) or len(body) == 0:
            raise ValueError("source body unavailable or empty")
        exact = s["witness_vkey"].encode("utf-8") in body
        host = urlparse(s["source_url"]).hostname
        if exact:
            matched_vkeys.add(s["witness_vkey"])
            matched_urls.add(s["source_url"])
            matched_hosts.add(host)
        records.append({
            "id": s["id"],
            "witness_vkey": s["witness_vkey"],
            "source_url": s["source_url"],
            "source_host": host,
            "source_classification": s["source_classification"],
            "retrieved_body_sha256": hashlib.sha256(body).hexdigest(),
            "exact_vkey_observed": exact,
        })

    strong = (
        matched_vkeys == pin_set
        and len(matched_vkeys) == 7
        and len(matched_urls) == profile["required_distinct_source_url_count"]
    )
    verdict = profile["strong_verdict"] if strong else profile["insufficient_verdict"]
    assurance = (
        "ALL_SEVEN_PINNED_WITNESS_KEY_SOURCE_MATERIAL_REOBSERVED_IN_ONE_BOUNDED_RUN_CURRENT_ACTIVITY_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED"
        if strong else
        "INCOMPLETE_SAME_RUN_ALL_SEVEN_PINNED_WITNESS_KEY_SOURCE_MATERIAL_OBSERVATION"
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
            "composed_exact_pinned_witness_key_count": predecessor_receipt["composed_exact_pinned_witness_key_count"],
        },
        "source_records": records,
        "matched_witness_key_count": len(matched_vkeys),
        "unique_source_url_count": len(matched_urls),
        "unique_source_host_count": len(matched_hosts),
        "observed_witness_vkeys": sorted(matched_vkeys),
        "all_seven_reobserved_in_one_bounded_run": strong,
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
    print(json.dumps(evaluate(profile, predecessor_profile, predecessor_receipt, pin_profile, bodies), indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
