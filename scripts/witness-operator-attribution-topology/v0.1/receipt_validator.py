#!/usr/bin/env python3
import argparse
import json
import re
from urllib.parse import urlparse

from topology import RECEIPT_SCHEMA, fingerprint, normalize_url, validate_profile

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def validate(profile, predecessor_profile, predecessor_receipt, pin_profile, receipt):
    pin_set = validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile)
    expected_top = {
        "schema", "tracking_issue", "predecessor", "registry",
        "operator_records", "matched_witness_key_count",
        "public_operator_label_count", "bound_about_surface_count",
        "registry_relation_count", "observed_operator_labels",
        "observed_witness_vkeys", "trustfabric_pinned_key_count",
        "all_seven_public_operator_attributions_bound",
        "operator_attribution_assurance", "claims", "automatic_action",
        "external_mutation_performed", "verdict", "receipt_fingerprint_sha256",
    }
    if set(receipt) != expected_top:
        raise ValueError("receipt closed-world top-level mismatch")
    if receipt["schema"] != RECEIPT_SCHEMA or receipt["tracking_issue"] != 941:
        raise ValueError("receipt identity mismatch")
    pred_expected = {"main_sha", "profile_git_blob", "qualification_receipt_git_blob", "receipt_fingerprint_sha256", "verdict", "matched_witness_key_count", "unique_source_url_count"}
    p = receipt["predecessor"]
    if set(p) != pred_expected:
        raise ValueError("predecessor summary closed-world mismatch")
    if p["main_sha"] != profile["repository_predecessor_main"] or p["profile_git_blob"] != profile["predecessor_profile_git_blob"] or p["qualification_receipt_git_blob"] != profile["predecessor_receipt_git_blob"]:
        raise ValueError("predecessor binding mismatch")
    if p["receipt_fingerprint_sha256"] != profile["required_predecessor_receipt_fingerprint_sha256"] or p["verdict"] != profile["required_predecessor_verdict"]:
        raise ValueError("predecessor evidence mismatch")
    if p["matched_witness_key_count"] != 7 or p["unique_source_url_count"] != 6:
        raise ValueError("predecessor count mismatch")
    reg = receipt["registry"]
    if set(reg) != {"source_url", "source_classification", "retrieved_body_sha256"}:
        raise ValueError("registry receipt closed-world mismatch")
    if normalize_url(reg["source_url"]) != normalize_url(profile["registry"]["source_url"]) or reg["source_classification"] != profile["registry"]["source_classification"] or not HEX64.fullmatch(reg["retrieved_body_sha256"]):
        raise ValueError("registry receipt binding mismatch")
    source_by_label = {op["operator_label"]: op for op in profile["operators"]}
    records = receipt["operator_records"]
    if not isinstance(records, list) or len(records) != 6:
        raise ValueError("operator record count mismatch")
    seen_labels, matched_vkeys, bound_labels, bound_abouts, registry_relations = set(), set(), set(), set(), set()
    trustfabric_count = None
    required_record = {"operator_label", "about_url", "about_host", "source_classification", "retrieved_body_sha256", "expected_witness_key_count", "witness_vkeys", "observed_witness_vkeys", "all_expected_vkeys_observed", "registry_relation_observed"}
    for r in records:
        if set(r) != required_record:
            raise ValueError("operator record closed-world mismatch")
        label = r["operator_label"]
        if label in seen_labels or label not in source_by_label:
            raise ValueError("duplicate or unknown operator label")
        seen_labels.add(label)
        src = source_by_label[label]
        if normalize_url(r["about_url"]) != normalize_url(src["about_url"]) or r["about_host"] != urlparse(src["about_url"]).hostname or r["source_classification"] != src["source_classification"]:
            raise ValueError("operator source binding mismatch")
        if not HEX64.fullmatch(r["retrieved_body_sha256"]):
            raise ValueError("invalid direct body digest")
        if r["expected_witness_key_count"] != len(src["witness_vkeys"]) or r["witness_vkeys"] != src["witness_vkeys"]:
            raise ValueError("operator witness-vkey contract mismatch")
        observed = r["observed_witness_vkeys"]
        if not isinstance(observed, list) or observed != sorted(observed) or len(observed) != len(set(observed)) or not set(observed).issubset(set(src["witness_vkeys"])):
            raise ValueError("observed vkey list mismatch")
        all_exact = set(observed) == set(src["witness_vkeys"])
        if not isinstance(r["all_expected_vkeys_observed"], bool) or r["all_expected_vkeys_observed"] is not all_exact or not isinstance(r["registry_relation_observed"], bool):
            raise ValueError("operator evidence flag mismatch")
        matched_vkeys.update(observed)
        if r["registry_relation_observed"]:
            registry_relations.add(label)
        if all_exact and r["registry_relation_observed"]:
            bound_labels.add(label); bound_abouts.add(normalize_url(src["about_url"]))
        if label == "TrustFabric":
            trustfabric_count = len(observed)
    if seen_labels != set(source_by_label):
        raise ValueError("operator record set incomplete")
    strong = matched_vkeys == pin_set and len(matched_vkeys) == 7 and len(bound_labels) == 6 and len(bound_abouts) == 6 and len(registry_relations) == 6
    checks = {
        "matched_witness_key_count": len(matched_vkeys),
        "public_operator_label_count": len(bound_labels),
        "bound_about_surface_count": len(bound_abouts),
        "registry_relation_count": len(registry_relations),
    }
    for k, v in checks.items():
        if receipt[k] != v:
            raise ValueError(f"{k} inflation")
    if receipt["observed_operator_labels"] != sorted(bound_labels) or receipt["observed_witness_vkeys"] != sorted(matched_vkeys):
        raise ValueError("observed set mismatch")
    if receipt["trustfabric_pinned_key_count"] != trustfabric_count or receipt["trustfabric_pinned_key_count"] not in (0, 1, 2):
        raise ValueError("TrustFabric pinned-key count mismatch")
    if receipt["all_seven_public_operator_attributions_bound"] is not strong:
        raise ValueError("all-seven attribution flag mismatch")
    if receipt["verdict"] != (profile["strong_verdict"] if strong else profile["insufficient_verdict"]):
        raise ValueError("verdict promotion")
    expected_assurance = "ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_FROM_CURRENT_DIRECT_SURFACES_AND_NETWORK_CURATED_TABLE_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED" if strong else "INCOMPLETE_PUBLIC_OPERATOR_ATTRIBUTION_TOPOLOGY_FOR_ALL_SEVEN_PINNED_WITNESS_KEYS"
    if receipt["operator_attribution_assurance"] != expected_assurance:
        raise ValueError("operator attribution assurance promotion")
    if set(receipt["claims"]) != set(profile["always_false_claims"]) or any(v is not False for v in receipt["claims"].values()):
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
    args = ap.parse_args()
    profile = json.load(open(args.profile, encoding="utf-8"))
    predecessor_profile = json.load(open(profile["predecessor_profile_path"], encoding="utf-8"))
    predecessor_receipt = json.load(open(profile["predecessor_receipt_path"], encoding="utf-8"))
    pin_profile = json.load(open(profile["pin_set_profile_path"], encoding="utf-8"))
    receipt = json.load(open(args.receipt, encoding="utf-8"))
    validate(profile, predecessor_profile, predecessor_receipt, pin_profile, receipt)
    print(receipt["verdict"])
    print(receipt["receipt_fingerprint_sha256"])


if __name__ == "__main__":
    main()
