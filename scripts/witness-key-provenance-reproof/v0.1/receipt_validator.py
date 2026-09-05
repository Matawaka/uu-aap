#!/usr/bin/env python3
import argparse
import json
import re
from reproof import RECEIPT_SCHEMA, fingerprint

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def validate(profile, receipt):
    expected = {
        "schema", "tracking_issue", "predecessor", "quorum_min", "source_records",
        "matched_witness_key_count", "unique_source_url_count", "unique_source_host_count",
        "quorum_many_exact_vkeys_reobserved", "quorum_many_distinct_source_urls_reobserved",
        "key_provenance_assurance", "claims",
        "automatic_action", "external_mutation_performed", "verdict", "receipt_fingerprint_sha256"
    }
    if set(receipt) != expected:
        raise ValueError("receipt closed-world top-level mismatch")
    if receipt["schema"] != RECEIPT_SCHEMA or receipt["tracking_issue"] != 935:
        raise ValueError("receipt identity mismatch")
    if receipt["quorum_min"] != profile["quorum_min"]:
        raise ValueError("receipt quorum mismatch")
    if set(receipt["predecessor"]) != {"main_sha", "verdict", "receipt_fingerprint_sha256", "key_provenance_assurance", "verified_witness_count"}:
        raise ValueError("predecessor receipt summary closed-world mismatch")
    if receipt["predecessor"]["main_sha"] != profile["repository_predecessor_main"]:
        raise ValueError("predecessor main mismatch")
    if not HEX64.fullmatch(receipt["predecessor"]["receipt_fingerprint_sha256"]):
        raise ValueError("predecessor receipt fingerprint format mismatch")
    if receipt["predecessor"]["verified_witness_count"] != 7:
        raise ValueError("predecessor verified witness count drift")
    if receipt["predecessor"]["verdict"] != profile["required_predecessor_verdict"]:
        raise ValueError("predecessor verdict mismatch")
    if receipt["predecessor"]["key_provenance_assurance"] != profile["required_predecessor_key_provenance_assurance"]:
        raise ValueError("predecessor provenance mismatch")
    if len(receipt["source_records"]) != len(profile["operator_sources"]):
        raise ValueError("source record count mismatch")
    source_by_id = {s["id"]: s for s in profile["operator_sources"]}
    if len(source_by_id) != len(profile["operator_sources"]):
        raise ValueError("duplicate profile source id")
    seen_ids, matched_vkeys = set(), set()
    matched_urls, matched_hosts = set(), set()
    for r in receipt["source_records"]:
        if set(r) != {"id", "witness_vkey", "source_url", "source_host", "source_classification", "retrieved_body_sha256", "exact_vkey_observed"}:
            raise ValueError("source receipt closed-world mismatch")
        if r["id"] in seen_ids or r["id"] not in source_by_id:
            raise ValueError("duplicate/unknown source id")
        seen_ids.add(r["id"])
        p = source_by_id[r["id"]]
        for k in ("witness_vkey", "source_url", "source_classification"):
            if r[k] != p[k]:
                raise ValueError(f"source {r['id']} {k} mismatch")
        if not HEX64.fullmatch(r["retrieved_body_sha256"]):
            raise ValueError("invalid body digest")
        if not isinstance(r["exact_vkey_observed"], bool):
            raise ValueError("exact match flag not boolean")
        if r["exact_vkey_observed"]:
            matched_vkeys.add(r["witness_vkey"]); matched_urls.add(r["source_url"]); matched_hosts.add(r["source_host"])
    if receipt["matched_witness_key_count"] != len(matched_vkeys):
        raise ValueError("matched witness count inflation")
    if receipt["unique_source_url_count"] != len(matched_urls):
        raise ValueError("source URL count inflation")
    if receipt["unique_source_host_count"] != len(matched_hosts):
        raise ValueError("source host count inflation")
    quorum_many_keys = len(matched_vkeys) >= profile["quorum_min"]
    quorum_many_sources = len(matched_urls) >= profile["quorum_min"]
    strong = quorum_many_keys and quorum_many_sources
    if receipt["quorum_many_exact_vkeys_reobserved"] is not quorum_many_keys:
        raise ValueError("key quorum flag mismatch")
    if receipt["quorum_many_distinct_source_urls_reobserved"] is not quorum_many_sources:
        raise ValueError("source quorum flag mismatch")
    if receipt["verdict"] != (profile["strong_verdict"] if strong else profile["insufficient_verdict"]):
        raise ValueError("verdict promotion")
    expected_assurance = (
        "QUORUM_MANY_OPERATOR_PUBLISHED_EXACT_VKEYS_REOBSERVED_FROM_QUORUM_MANY_SOURCE_URLS_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED"
        if strong else "INSUFFICIENT_OPERATOR_PUBLISHED_EXACT_VKEYS_REOBSERVED"
    )
    if receipt["key_provenance_assurance"] != expected_assurance:
        raise ValueError("provenance assurance promotion")
    if set(receipt["claims"]) != set(profile["always_false_claims"]):
        raise ValueError("claims surface mismatch")
    if any(v is not False for v in receipt["claims"].values()):
        raise ValueError("forbidden claim promotion")
    if receipt["automatic_action"] is not False or receipt["external_mutation_performed"] is not False:
        raise ValueError("action/mutation promotion")
    if receipt["claims"]["all_seven_key_provenance_reproven"] is not False:
        raise ValueError("all-seven overclaim")
    if receipt["receipt_fingerprint_sha256"] != fingerprint(receipt):
        raise ValueError("receipt fingerprint mismatch")
    return True


def main():
    ap=argparse.ArgumentParser(); ap.add_argument("profile"); ap.add_argument("receipt"); a=ap.parse_args()
    profile=json.load(open(a.profile,encoding="utf-8")); receipt=json.load(open(a.receipt,encoding="utf-8"))
    validate(profile,receipt); print(receipt["verdict"]); print(receipt["receipt_fingerprint_sha256"])

if __name__ == "__main__": main()
