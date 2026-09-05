#!/usr/bin/env python3
import argparse
import hashlib
import json
import pathlib
import re
from html.parser import HTMLParser
from urllib.parse import urlparse, urlsplit, urlunsplit

PROFILE_SCHEMA = "urn:uu-aap:witness-operator-attribution-topology-profile:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:witness-operator-attribution-topology-receipt:0.1"
REGISTRY_CLASS = "NETWORK_CURATED_OPERATOR_TABLE"
DIRECT_CLASS = "OPERATOR_PUBLISHED_WITNESS_PAGE"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")

EXPECTED_TOPOLOGY = {
    "Mullvad VPN AB": (
        "https://witness.stagemole.eu/about",
        ("witness.stagemole.eu+67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv",),
    ),
    "TrustFabric": (
        "https://transparency.dev/witnesses",
        (
            "transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM",
            "staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL",
        ),
    ),
    "Florian Larysch": (
        "https://remora.n621.de/",
        ("remora.n621.de+da77ade7+BOvN63jn/bLvkieywe8R6UYAtVtNbZpXh34x7onlmtw2",),
    ),
    "Geomys": (
        "https://geomys.org/witness/navigli",
        ("witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G",),
    ),
    "rgdd": (
        "https://www.rgdd.se/poc-witness/about",
        ("rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG",),
    ),
    "Elias Rudberg": (
        "https://witness1.smartit.nu/witness1/about.txt",
        ("witness1.smartit.nu/witness1+a48c820f+BPSFWg9G6KPiO7QPryYO5Xq4oYJJ+kAvLKLSimDhoxMO",),
    ),
}


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


def normalize_url(value):
    if not isinstance(value, str) or not value:
        raise ValueError("URL must be non-empty string")
    s = urlsplit(value)
    if s.scheme != "https" or not s.hostname:
        raise ValueError("URL must be explicit HTTPS")
    path = s.path
    if path != "/":
        path = path.rstrip("/")
    return urlunsplit((s.scheme.lower(), s.netloc.lower(), path, s.query, ""))


class _RegistryTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self._row = None

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "tr":
            self._row = {"text": [], "hrefs": []}
            return
        if self._row is not None and tag.lower() == "a":
            href = dict(attrs).get("href")
            if href:
                self._row["hrefs"].append(href)

    def handle_data(self, data):
        if self._row is not None:
            t = " ".join(data.split())
            if t:
                self._row["text"].append(t)

    def handle_endtag(self, tag):
        if tag.lower() == "tr" and self._row is not None:
            self.rows.append({"text": " ".join(self._row["text"]), "hrefs": list(self._row["hrefs"])})
            self._row = None


def registry_relation_observed(registry_body, operator_label, about_url):
    if not isinstance(registry_body, (bytes, bytearray)) or not registry_body:
        raise ValueError("registry body unavailable or empty")
    try:
        text = bytes(registry_body).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("registry body must be UTF-8 HTML") from exc
    p = _RegistryTableParser()
    p.feed(text)
    target = normalize_url(about_url)
    for row in p.rows:
        if operator_label not in row["text"]:
            continue
        for href in row["hrefs"]:
            try:
                if normalize_url(href) == target:
                    return True
            except ValueError:
                continue
    return False


def validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile):
    expected = {
        "schema", "tracking_issue", "repository_predecessor_main",
        "predecessor_profile_path", "predecessor_profile_git_blob",
        "predecessor_receipt_path", "predecessor_receipt_git_blob",
        "required_predecessor_receipt_fingerprint_sha256", "required_predecessor_verdict",
        "required_predecessor_matched_witness_key_count", "required_predecessor_source_url_count",
        "pin_set_profile_path", "pin_set_profile_git_blob", "registry", "operators",
        "required_operator_label_count", "required_about_surface_count", "strong_verdict",
        "insufficient_verdict", "always_false_claims",
    }
    _strict_keys(profile, expected, "profile")
    if profile["schema"] != PROFILE_SCHEMA or profile["tracking_issue"] != 941:
        raise ValueError("wrong profile identity")
    for k in ("repository_predecessor_main", "predecessor_profile_git_blob", "predecessor_receipt_git_blob", "pin_set_profile_git_blob"):
        if not HEX40.fullmatch(profile[k]):
            raise ValueError(f"invalid git sha field {k}")
    if not HEX64.fullmatch(profile["required_predecessor_receipt_fingerprint_sha256"]):
        raise ValueError("invalid predecessor fingerprint")
    if predecessor_profile.get("tracking_issue") != 939 or predecessor_receipt.get("tracking_issue") != 939:
        raise ValueError("wrong #940 predecessor identity")
    if predecessor_receipt.get("receipt_fingerprint_sha256") != profile["required_predecessor_receipt_fingerprint_sha256"]:
        raise ValueError("#940 receipt fingerprint drift")
    if predecessor_receipt.get("verdict") != profile["required_predecessor_verdict"]:
        raise ValueError("#940 verdict drift")
    if predecessor_receipt.get("matched_witness_key_count") != 7 or profile["required_predecessor_matched_witness_key_count"] != 7:
        raise ValueError("#940 matched key count drift")
    if predecessor_receipt.get("unique_source_url_count") != 6 or profile["required_predecessor_source_url_count"] != 6:
        raise ValueError("#940 source URL count drift")
    if predecessor_receipt.get("all_seven_reobserved_in_one_bounded_run") is not True:
        raise ValueError("#940 same-run all-seven result drift")
    pred_claims = predecessor_receipt.get("claims", {})
    for c in ("witness_identity_proven", "legal_operator_identity_proven", "operator_independence_proven", "all_witnesses_independent_proven", "all_seven_currently_active_proven"):
        if pred_claims.get(c) is not False:
            raise ValueError(f"#940 nonclaim drift: {c}")
    pins = pin_profile.get("witness_vkeys")
    if not isinstance(pins, list) or len(pins) != 7 or len(set(pins)) != 7:
        raise ValueError("exact #934 seven-pin set drift")
    pin_set = set(pins)
    if set(predecessor_receipt.get("observed_witness_vkeys", [])) != pin_set:
        raise ValueError("#940 observed vkey set drift")
    _strict_keys(profile["registry"], {"source_url", "source_classification"}, "registry")
    if normalize_url(profile["registry"]["source_url"]) != normalize_url("https://witness-network.org/witness-tables/") or profile["registry"]["source_classification"] != REGISTRY_CLASS:
        raise ValueError("registry binding drift")
    if profile["required_operator_label_count"] != 6 or profile["required_about_surface_count"] != 6:
        raise ValueError("topology cardinality threshold drift")
    ops = profile["operators"]
    if not isinstance(ops, list) or len(ops) != 6:
        raise ValueError("exactly six operator records required")
    labels, abouts, vkeys, actual = set(), set(), set(), {}
    for op in ops:
        _strict_keys(op, {"operator_label", "about_url", "source_classification", "witness_vkeys"}, "operator")
        label = op["operator_label"]
        if not isinstance(label, str) or not label or label in labels:
            raise ValueError("duplicate/invalid operator label")
        labels.add(label)
        about = normalize_url(op["about_url"])
        if about in abouts:
            raise ValueError("duplicate about surface")
        abouts.add(about)
        if op["source_classification"] != DIRECT_CLASS:
            raise ValueError("direct source classification drift")
        ov = op["witness_vkeys"]
        if not isinstance(ov, list) or not ov or len(ov) != len(set(ov)):
            raise ValueError("invalid operator witness-vkey set")
        for v in ov:
            if v in vkeys or v not in pin_set:
                raise ValueError("invalid/multiply-assigned operator vkey")
            vkeys.add(v)
        actual[label] = (about, tuple(ov))
    expected_topology = {label: (normalize_url(url), tuple(vs)) for label, (url, vs) in EXPECTED_TOPOLOGY.items()}
    if actual != expected_topology or vkeys != pin_set:
        raise ValueError("public operator-attribution topology drift")
    if len(labels) != 6 or len(abouts) != 6 or len(actual["TrustFabric"][1]) != 2:
        raise ValueError("operator/about cardinality or TrustFabric convergence drift")
    if any(len(vs) != 1 for label, (_, vs) in actual.items() if label != "TrustFabric"):
        raise ValueError("unexpected multi-key operator relation")
    claims = profile["always_false_claims"]
    if len(claims) != len(set(claims)):
        raise ValueError("duplicate always-false claim")
    mandatory_false = {"witness_identity_proven", "legal_operator_identity_proven", "cryptographic_operator_identity_binding_proven", "operator_control_proven", "operator_independence_proven", "all_witnesses_independent_proven", "all_seven_currently_active_proven", "global_non_equivocation_proven", "c2pa_manifest_inclusion_proven", "truth_certified", "authority_created", "automatic_remediation_triggered"}
    if not mandatory_false.issubset(set(claims)):
        raise ValueError("mandatory false-claim surface missing")
    return pin_set


def evaluate(profile, predecessor_profile, predecessor_receipt, pin_profile, registry_body, direct_bodies):
    pin_set = validate_profile(profile, predecessor_profile, predecessor_receipt, pin_profile)
    expected_urls = {normalize_url(op["about_url"]) for op in profile["operators"]}
    provided = {normalize_url(k): v for k, v in direct_bodies.items()}
    if set(provided) != expected_urls:
        raise ValueError("direct source map must provide exactly all six allowlisted about URLs")
    if not isinstance(registry_body, (bytes, bytearray)) or len(registry_body) == 0:
        raise ValueError("registry body unavailable or empty")
    records, matched_vkeys, bound_labels, bound_abouts, registry_relations = [], set(), set(), set(), set()
    for op in profile["operators"]:
        about_norm = normalize_url(op["about_url"])
        body = provided[about_norm]
        if not isinstance(body, (bytes, bytearray)) or len(body) == 0:
            raise ValueError("direct about body unavailable or empty")
        observed = [v for v in op["witness_vkeys"] if v.encode("utf-8") in body]
        matched_vkeys.update(observed)
        all_exact = set(observed) == set(op["witness_vkeys"])
        relation = registry_relation_observed(registry_body, op["operator_label"], op["about_url"])
        if relation:
            registry_relations.add(op["operator_label"])
        if all_exact and relation:
            bound_labels.add(op["operator_label"]); bound_abouts.add(about_norm)
        records.append({"operator_label": op["operator_label"], "about_url": op["about_url"], "about_host": urlparse(op["about_url"]).hostname, "source_classification": op["source_classification"], "retrieved_body_sha256": hashlib.sha256(body).hexdigest(), "expected_witness_key_count": len(op["witness_vkeys"]), "witness_vkeys": list(op["witness_vkeys"]), "observed_witness_vkeys": sorted(observed), "all_expected_vkeys_observed": all_exact, "registry_relation_observed": relation})
    strong = matched_vkeys == pin_set and len(matched_vkeys) == 7 and len(bound_labels) == 6 and len(bound_abouts) == 6 and len(registry_relations) == 6
    verdict = profile["strong_verdict"] if strong else profile["insufficient_verdict"]
    assurance = "ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_FROM_CURRENT_DIRECT_SURFACES_AND_NETWORK_CURATED_TABLE_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED" if strong else "INCOMPLETE_PUBLIC_OPERATOR_ATTRIBUTION_TOPOLOGY_FOR_ALL_SEVEN_PINNED_WITNESS_KEYS"
    receipt = {
        "schema": RECEIPT_SCHEMA,
        "tracking_issue": profile["tracking_issue"],
        "predecessor": {"main_sha": profile["repository_predecessor_main"], "profile_git_blob": profile["predecessor_profile_git_blob"], "qualification_receipt_git_blob": profile["predecessor_receipt_git_blob"], "receipt_fingerprint_sha256": predecessor_receipt["receipt_fingerprint_sha256"], "verdict": predecessor_receipt["verdict"], "matched_witness_key_count": predecessor_receipt["matched_witness_key_count"], "unique_source_url_count": predecessor_receipt["unique_source_url_count"]},
        "registry": {"source_url": profile["registry"]["source_url"], "source_classification": profile["registry"]["source_classification"], "retrieved_body_sha256": hashlib.sha256(registry_body).hexdigest()},
        "operator_records": records,
        "matched_witness_key_count": len(matched_vkeys),
        "public_operator_label_count": len(bound_labels),
        "bound_about_surface_count": len(bound_abouts),
        "registry_relation_count": len(registry_relations),
        "observed_operator_labels": sorted(bound_labels),
        "observed_witness_vkeys": sorted(matched_vkeys),
        "trustfabric_pinned_key_count": len(next(r for r in records if r["operator_label"] == "TrustFabric")["observed_witness_vkeys"]),
        "all_seven_public_operator_attributions_bound": strong,
        "operator_attribution_assurance": assurance,
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
    ap.add_argument("--registry-body", required=True)
    ap.add_argument("--source-map", required=True)
    args = ap.parse_args()
    profile = load_json(args.profile)
    predecessor_profile = load_json(profile["predecessor_profile_path"])
    predecessor_receipt = load_json(profile["predecessor_receipt_path"])
    pin_profile = load_json(profile["pin_set_profile_path"])
    source_map = load_json(args.source_map)
    if not isinstance(source_map, dict):
        raise SystemExit("source-map must be object")
    direct_bodies = {url: pathlib.Path(path).read_bytes() for url, path in source_map.items()}
    registry_body = pathlib.Path(args.registry_body).read_bytes()
    print(json.dumps(evaluate(profile, predecessor_profile, predecessor_receipt, pin_profile, registry_body, direct_bodies), indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
