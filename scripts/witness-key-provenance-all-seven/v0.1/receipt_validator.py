#!/usr/bin/env python3
import argparse
import json
import re
from reproof import RECEIPT_SCHEMA, fingerprint, validate_profile

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def validate(profile, predecessor_profile, predecessor_receipt, pin_profile, receipt):
    pin_set, prior = validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile)
    expected = {
        "schema", "tracking_issue", "predecessor",
        "predecessor_observed_witness_key_count",
        "new_source_records", "new_exact_witness_key_count",
        "new_exact_source_url_count", "composed_exact_pinned_witness_key_count",
        "composed_witness_vkeys", "all_seven_operator_source_observations_composed",
        "key_provenance_assurance", "claims", "automatic_action",
        "external_mutation_performed", "verdict", "receipt_fingerprint_sha256",
    }
    if set(receipt) != expected:
        raise ValueError("receipt closed-world top-level mismatch")
    if receipt["schema"] != RECEIPT_SCHEMA or receipt["tracking_issue"] != 937:
        raise ValueError("receipt identity mismatch")
    pred_expected = {
        "main_sha", "profile_git_blob", "qualification_receipt_git_blob",
        "receipt_fingerprint_sha256", "verdict", "matched_witness_key_count",
    }
    if set(receipt["predecessor"]) != pred_expected:
        raise ValueError("predecessor summary closed-world mismatch")
    p = receipt["predecessor"]
    if p["main_sha"] != profile["repository_predecessor_main"]:
        raise ValueError("predecessor main mismatch")
    if p["profile_git_blob"] != profile["predecessor_profile_git_blob"]:
        raise ValueError("predecessor profile blob mismatch")
    if p["qualification_receipt_git_blob"] != profile["predecessor_receipt_git_blob"]:
        raise ValueError("predecessor receipt blob mismatch")
    if p["receipt_fingerprint_sha256"] != profile["required_predecessor_receipt_fingerprint_sha256"]:
        raise ValueError("predecessor fingerprint mismatch")
    if p["verdict"] != profile["required_predecessor_verdict"]:
        raise ValueError("predecessor verdict mismatch")
    if p["matched_witness_key_count"] != 5:
        raise ValueError("predecessor matched count mismatch")
    if receipt["predecessor_observed_witness_key_count"] != len(prior) or len(prior) != 5:
        raise ValueError("predecessor observed count mismatch")

    source_by_id = {s["id"]: s for s in profile["new_sources"]}
    if len(receipt["new_source_records"]) != 2:
        raise ValueError("new source record count mismatch")
    seen_ids = set()
    matched_new = set()
    matched_urls = set()
    for r in receipt["new_source_records"]:
        required = {
            "id", "witness_vkey", "source_url", "source_host",
            "source_classification", "retrieved_body_sha256", "exact_vkey_observed",
        }
        if set(r) != required:
            raise ValueError("new source receipt closed-world mismatch")
        if r["id"] in seen_ids or r["id"] not in source_by_id:
            raise ValueError("duplicate or unknown source id")
        seen_ids.add(r["id"])
        src = source_by_id[r["id"]]
        for k in ("witness_vkey", "source_url", "source_classification"):
            if r[k] != src[k]:
                raise ValueError(f"source {r['id']} {k} mismatch")
        if not HEX64.fullmatch(r["retrieved_body_sha256"]):
            raise ValueError("invalid source body digest")
        if not isinstance(r["exact_vkey_observed"], bool):
            raise ValueError("exact match flag not boolean")
        if r["exact_vkey_observed"]:
            matched_new.add(r["witness_vkey"])
            matched_urls.add(r["source_url"])

    composed = prior | matched_new
    strong = len(matched_new) == 2 and len(composed) == 7 and composed == pin_set
    if receipt["new_exact_witness_key_count"] != len(matched_new):
        raise ValueError("new exact key count inflation")
    if receipt["new_exact_source_url_count"] != len(matched_urls):
        raise ValueError("new exact source URL count inflation")
    if receipt["composed_exact_pinned_witness_key_count"] != len(composed):
        raise ValueError("composed pin count inflation")
    if receipt["composed_witness_vkeys"] != sorted(composed):
        raise ValueError("composed pin list mismatch")
    if receipt["all_seven_operator_source_observations_composed"] is not strong:
        raise ValueError("all-seven composition flag mismatch")
    if receipt["verdict"] != (profile["strong_verdict"] if strong else profile["insufficient_verdict"]):
        raise ValueError("verdict promotion")
    expected_assurance = (
        "ALL_SEVEN_PINNED_WITNESS_KEYS_HAVE_BOUND_OPERATOR_SOURCE_OBSERVATIONS_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED"
        if strong else
        "INCOMPLETE_ALL_SEVEN_OPERATOR_SOURCE_PROVENANCE_OBSERVATIONS"
    )
    if receipt["key_provenance_assurance"] != expected_assurance:
        raise ValueError("provenance assurance promotion")
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
