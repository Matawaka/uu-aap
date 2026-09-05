#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

D = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("topology", D/"topology.py")
tp = importlib.util.module_from_spec(spec); spec.loader.exec_module(tp)
spec2 = importlib.util.spec_from_file_location("receipt_validator", D/"receipt_validator.py")
rv = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(rv)

profile = json.load(open(D/"profile.json", encoding="utf-8"))
pins = [
    "witness.stagemole.eu+67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv",
    "transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM",
    "staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL",
    "rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG",
    "witness1.smartit.nu/witness1+a48c820f+BPSFWg9G6KPiO7QPryYO5Xq4oYJJ+kAvLKLSimDhoxMO",
    "remora.n621.de+da77ade7+BOvN63jn/bLvkieywe8R6UYAtVtNbZpXh34x7onlmtw2",
    "witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G",
]
pre_profile = {"tracking_issue": 939}
pre_receipt = {
    "tracking_issue": 939,
    "receipt_fingerprint_sha256": profile["required_predecessor_receipt_fingerprint_sha256"],
    "verdict": profile["required_predecessor_verdict"],
    "matched_witness_key_count": 7,
    "unique_source_url_count": 6,
    "all_seven_reobserved_in_one_bounded_run": True,
    "observed_witness_vkeys": sorted(pins),
    "claims": {"witness_identity_proven": False,"legal_operator_identity_proven": False,"operator_independence_proven": False,"all_witnesses_independent_proven": False,"all_seven_currently_active_proven": False},
}
pin_profile = {"witness_vkeys": pins}
checks = 0


def ok(value, msg="assertion failed"):
    global checks
    assert value, msg
    checks += 1


def expect_error(fn):
    global checks
    try:
        fn()
    except (ValueError, KeyError, TypeError):
        checks += 1
        return
    raise AssertionError("expected fail-closed error")


def direct_bodies():
    out = {}
    for op in profile["operators"]:
        body = b"operator witness page\n"
        for v in op["witness_vkeys"]:
            body += v.encode() + b"\n"
        out[op["about_url"]] = body
    return out


def registry_html(omit_label=None, mismap_label=None):
    rows = []
    for op in profile["operators"]:
        if op["operator_label"] == omit_label:
            continue
        href = op["about_url"]
        if op["operator_label"] == mismap_label:
            href = "https://example.invalid/not-the-about-page"
        rows.append(f'<tr><td>{op["operator_label"]}</td><td>testing/log-list.1</td><td><a href="{href}">{href}</a></td></tr>')
    return ("<html><body><table>" + "".join(rows) + "</table></body></html>").encode()


r = tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies())
ok(r["matched_witness_key_count"] == 7)
ok(r["public_operator_label_count"] == 6)
ok(r["bound_about_surface_count"] == 6)
ok(r["registry_relation_count"] == 6)
ok(r["trustfabric_pinned_key_count"] == 2)
ok(r["all_seven_public_operator_attributions_bound"] is True)
ok(r["verdict"] == profile["strong_verdict"])
ok(set(r["observed_operator_labels"]) == {o["operator_label"] for o in profile["operators"]})
ok(set(r["observed_witness_vkeys"]) == set(pins))
ok(all(v is False for v in r["claims"].values()))
ok(rv.validate(profile, pre_profile, pre_receipt, pin_profile, r))

b = direct_bodies(); op = profile["operators"][0]; b[op["about_url"]] = b"page without key"
x = tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(), b)
ok(x["matched_witness_key_count"] == 6); ok(x["all_seven_public_operator_attributions_bound"] is False); ok(x["verdict"] == profile["insufficient_verdict"])

b = direct_bodies(); trust = next(o for o in profile["operators"] if o["operator_label"] == "TrustFabric"); b[trust["about_url"]] = trust["witness_vkeys"][0].encode()
x = tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(), b)
ok(x["matched_witness_key_count"] == 6); ok(x["trustfabric_pinned_key_count"] == 1); ok(x["public_operator_label_count"] == 5)

b = direct_bodies(); v = op["witness_vkeys"][0]; b[op["about_url"]] = v[:-8].encode()
ok(tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(), b)["matched_witness_key_count"] == 6)
b = direct_bodies(); b.pop(next(iter(b))); expect_error(lambda: tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(), b))
b = direct_bodies(); b["https://extra.invalid/about"] = b"x"; expect_error(lambda: tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(), b))
b = direct_bodies(); b[op["about_url"]] = b""; expect_error(lambda: tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(), b))
expect_error(lambda: tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b"", direct_bodies()))

x = tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(omit_label="Geomys"), direct_bodies())
ok(x["registry_relation_count"] == 5); ok(x["all_seven_public_operator_attributions_bound"] is False)
x = tp.evaluate(profile, pre_profile, pre_receipt, pin_profile, registry_html(mismap_label="Geomys"), direct_bodies())
ok(x["registry_relation_count"] == 5)
split = ('<table><tr><td>Geomys</td><td><a href="https://example.invalid/">wrong</a></td></tr><tr><td>Someone else</td><td><a href="https://geomys.org/witness/navigli">right url</a></td></tr>').encode()
ok(tp.registry_relation_observed(split, "Geomys", "https://geomys.org/witness/navigli") is False)

p = copy.deepcopy(profile); p["registry"]["source_classification"] = "OPERATOR_PUBLISHED_WITNESS_PAGE"; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["registry"]["source_url"] = "http://witness-network.org/witness-tables/"; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["operators"][0]["source_classification"] = "NETWORK_CURATED_OPERATOR_TABLE"; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["operators"][0]["operator_label"] = "Mullvad"; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["operators"][1]["operator_label"] = p["operators"][0]["operator_label"]; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["operators"][1]["about_url"] = p["operators"][0]["about_url"]; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["operators"][1]["witness_vkeys"][0] = p["operators"][0]["witness_vkeys"][0]; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); moved = p["operators"][1]["witness_vkeys"].pop(); p["operators"][0]["witness_vkeys"].append(moved); expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["required_operator_label_count"] = 7; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["always_false_claims"].remove("operator_control_proven"); expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))
p = copy.deepcopy(profile); p["extra"] = True; expect_error(lambda: tp.evaluate(p, pre_profile, pre_receipt, pin_profile, registry_html(), direct_bodies()))

pr = copy.deepcopy(pre_receipt); pr["receipt_fingerprint_sha256"] = "0"*64; expect_error(lambda: tp.evaluate(profile, pre_profile, pr, pin_profile, registry_html(), direct_bodies()))
pr = copy.deepcopy(pre_receipt); pr["verdict"] = "PROMOTED"; expect_error(lambda: tp.evaluate(profile, pre_profile, pr, pin_profile, registry_html(), direct_bodies()))
pr = copy.deepcopy(pre_receipt); pr["matched_witness_key_count"] = 6; expect_error(lambda: tp.evaluate(profile, pre_profile, pr, pin_profile, registry_html(), direct_bodies()))
pr = copy.deepcopy(pre_receipt); pr["unique_source_url_count"] = 7; expect_error(lambda: tp.evaluate(profile, pre_profile, pr, pin_profile, registry_html(), direct_bodies()))
pr = copy.deepcopy(pre_receipt); pr["all_seven_reobserved_in_one_bounded_run"] = False; expect_error(lambda: tp.evaluate(profile, pre_profile, pr, pin_profile, registry_html(), direct_bodies()))
for claim in ("witness_identity_proven", "legal_operator_identity_proven", "operator_independence_proven", "all_seven_currently_active_proven"):
    pr = copy.deepcopy(pre_receipt); pr["claims"][claim] = True; expect_error(lambda pr=pr: tp.evaluate(profile, pre_profile, pr, pin_profile, registry_html(), direct_bodies()))
pp = copy.deepcopy(pin_profile); pp["witness_vkeys"][0] = "substituted"; expect_error(lambda: tp.evaluate(profile, pre_profile, pre_receipt, pp, registry_html(), direct_bodies()))

mutations = [
    lambda z: z.__setitem__("matched_witness_key_count", 8), lambda z: z.__setitem__("public_operator_label_count", 7), lambda z: z.__setitem__("bound_about_surface_count", 7), lambda z: z.__setitem__("registry_relation_count", 7), lambda z: z.__setitem__("trustfabric_pinned_key_count", 3), lambda z: z["observed_operator_labels"].append("Fake"), lambda z: z["observed_witness_vkeys"].append("fake"), lambda z: z.__setitem__("all_seven_public_operator_attributions_bound", False), lambda z: z.__setitem__("verdict", "LEGAL_IDENTITY_PROVEN"), lambda z: z.__setitem__("operator_attribution_assurance", "INDEPENDENCE_PROVEN"), lambda z: z["claims"].__setitem__("legal_operator_identity_proven", True), lambda z: z["claims"].__setitem__("operator_control_proven", True), lambda z: z["claims"].__setitem__("operator_independence_proven", True), lambda z: z["claims"].__setitem__("all_seven_currently_active_proven", True), lambda z: z.__setitem__("automatic_action", True), lambda z: z.__setitem__("external_mutation_performed", True), lambda z: z["operator_records"][0].__setitem__("about_host", "evil.example"), lambda z: z["operator_records"][0].__setitem__("retrieved_body_sha256", "bad"), lambda z: z["registry"].__setitem__("retrieved_body_sha256", "bad"), lambda z: z["operator_records"][0].__setitem__("registry_relation_observed", False),
]
for mutate in mutations:
    z = copy.deepcopy(r); mutate(z); z["receipt_fingerprint_sha256"] = tp.fingerprint(z); expect_error(lambda z=z: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))
z = copy.deepcopy(r); z["receipt_fingerprint_sha256"] = "0"*64; expect_error(lambda: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))
z = copy.deepcopy(r); z["extra"] = 1; z["receipt_fingerprint_sha256"] = tp.fingerprint(z); expect_error(lambda: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))

print(f"PASS witness operator-attribution topology hostile suite: {checks} checks")
