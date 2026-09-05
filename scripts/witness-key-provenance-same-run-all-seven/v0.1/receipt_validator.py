#!/usr/bin/env python3
import argparse
import json
import re
from urllib.parse import urlparse
from reproof import RECEIPT_SCHEMA, fingerprint, validate_profile

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def validate(profile, predecessor_profile, predecessor_receipt, pin_profile, receipt):
    pin_set = validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile)
    expected = {
        "schema", "tracking_issue", "predecessor", "source_records",
        "matched_witness_key_count", "unique_source_url_count",
        "unique_source_host_count", "observed_witness_vkeys",
        "all_seven_reobserved_in_one_bounded_run",
        "key_provenance_assurance", "claims", "automatic_action",
        "external_mutation_performed", "verdict", "receipt_fingerprint_sha256",
    }
    if set(receipt) != expected:
        raise ValueError("receipt closed-world top-level mismatch")
    if receipt["schema"] != RECEIPT_SCHEMA or receipt["tracking_issue"] != 939:
        raise ValueError("receipt identity mismatch")

    pred_expected = {
        "main_sha", "profile_git_blob", "qualification_receipt_git_blob",
        "receipt_fingerprint_sha256", "verdict",
        "composed_exact_pinned_witness_key_count",
    }
    if not isinstance(receipt["predecessor"], dict) or set(receipt["predecessor"]) != pred_expected:
        raise ValueError("predecessor summary closed-world mismatch")
    pred = receipt["predecessor"]
    if pred["main_sha"] != profile["repository_predecessor_main"]:
        raise ValueError("predecessor main mismatch")
    if pred["profile_git_blob"] != profile["predecessor_profile_git_blob"]:
        raise ValueError("predecessor profile blob mismatch")
    if pred["qualification_receipt_git_blob"] != profile["predecessor_receipt_git_blob"]:
        raise ValueError("predecessor receipt blob mismatch")
    if pred["receipt_fingerprint_sha256"] != profile["required_predecessor_receipt_fingerprint_sha256"]:
        raise ValueError("predecessor fingerprint mismatch")
    if pred["verdict"] != profile["required_predecessor_verdict"]:
        raise ValueError("predecessor verdict mismatch")
    if pred["composed_exact_pinned_witness_key_count"] != 7:
        raise ValueError("predecessor all-seven count mismatch")

    by_id = {s["id"]: s for s in profile["sources"]}
    if not isinstance(receipt["source_records"], list) or len(receipt["source_records"]) != 7:
        raise ValueError("source receipt cardinality mismatch")
    seen_ids = set()
    matched_vkeys = set()
    matched_urls = set()
    matched_hosts = set()
    for r in receipt["source_records"]:
        required = {
            "id", "witness_vkey", "source_url", "source_host",
            "source_classification", "retrieved_body_sha256",
            "exact_vkey_observed",
        }
        if not isinstance(r, dict) or set(r) != required:
            raise ValueError("source receipt closed-world mismatch")
        if r["id"] in seen_ids or r["id"] not in by_id:
            raise ValueError("duplicate or unknown source id")
        seen_ids.add(r["id"])
        src = by_id[r["id"]]
        for k in ("witness_vkey", "source_url", "source_classification"):
            if r[k] != src[k]:
                raise ValueError(f"source {r['id']} {k} mismatch")
        expected_host = urlparse(r["source_url"]).hostname
        if r["source_host"] != expected_host:
            raise ValueError("source host mismatch")
        if not HEX64.fullmatch(r["retrieved_body_sha256"]):
            raise ValueError("invalid source body digest")
        if not isinstance(r["exact_vkey_observed"], bool):
            raise ValueError("exact flag must be boolean")
        if r["exact_vkey_observed"]:
            matched_vkeys.add(r["witness_vkey"])
            matched_urls.add(r["source_url"])
            matched_hosts.add(r["source_host"])

    strong = (
        matched_vkeys == pin_set
        and len(matched_vkeys) == 7
        and len(matched_urls) == profile["required_distinct_source_url_count"]
    )
    if receipt["matched_witness_key_count"] != len(matched_vkeys):
        raise ValueError("matched key count inflation")
    if receipt["unique_source_url_count"] != len(matched_urls):
        raise ValueError("matched source URL count inflation")
    if receipt["unique_source_host_count"] != len(matched_hosts):
        raise ValueError("matched source host count inflation")
    if receipt["observed_witness_vkeys"] != sorted(matched_vkeys):
        raise ValueError("observed vkey list mismatch")
    if receipt["all_seven_reobserved_in_one_bounded_run"] is not strong:
        raise ValueError("same-run all-seven flag mismatch")
    if receipt["verdict"] != (profile["strong_verdict"] if strong else profile["insufficient_verdict"]):
        raise ValueError("verdict promotion")
    expected_assurance = (
        "ALL_SEVEN_PINNED_WITNESS_KEY_SOURCE_MATERIAL_REOBSERVED_IN_ONE_BOUNDED_RUN_CURRENT_ACTIVITY_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED"
        if strong else
        "INCOMPLETE_SAME_RUN_ALL_SEVEN_PINNED_WITNESS_KEY_SOURCE_MATERIAL_OBSERVATION"
    )
    if receipt["key_provenance_assurance"] != expected_assurance:
        raise ValueError("assurance promotion")
    if set(receipt["claims"]) != set(profile["always_false_claims"]):
        raise ValueError("claims surface mismatch")
    if any(v is not False for v in receipt["claims"].values()):
        raise ValueError("forbidden claim promotion")
    if receipt["automatic_action"] is not False or receipt["external_mutation_performed"] is not False:
        raise ValueError("action/mutation promotion")
    if receipt["receipt_fingerprint_sha256"] != fingerprint(receipt):
        raise ValueError("receipt fingerprint mismatch")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("profile")
    ap.add_argument("receipt")
    a = ap.parse_args()
    profile = json.load(open(a.profile, encoding="utf-8"))
    predecessor_profile = json.load(open(profile["predecessor_profile_path"], encoding="utf-8"))
    predecessor_receipt = json.load(open(profile["predecessor_receipt_path"], encoding="utf-8"))
    pin_profile = json.load(open(profile["pin_set_profile_path"], encoding="utf-8"))
    receipt = json.load(open(a.receipt, encoding="utf-8"))
    validate(profile, predecessor_profile, predecessor_receipt, pin_profile, receipt)
    print(receipt["verdict"])
    print(receipt["receipt_fingerprint_sha256"])


if __name__ == "__main__":
    main()
