#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

D = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("reproof", D/"reproof.py")
rp = importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)
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
pre_profile = {"tracking_issue": 937}
pre_receipt = {
    "tracking_issue": 937,
    "receipt_fingerprint_sha256": profile["required_predecessor_receipt_fingerprint_sha256"],
    "verdict": profile["required_predecessor_verdict"],
    "composed_exact_pinned_witness_key_count": 7,
    "all_seven_operator_source_observations_composed": True,
    "claims": {"all_seven_currently_reobserved_in_one_run": False},
}
pin_profile = {"witness_vkeys": pins}
checks = 0

def bodies():
    out = {}
    for s in profile["sources"]:
        out.setdefault(s["source_url"], b"bounded source body\n")
        out[s["source_url"]] += s["witness_vkey"].encode() + b"\n"
    return out

def ok(cond):
    global checks
    assert cond
    checks += 1

def expect_error(fn):
    global checks
    try:
        fn()
    except (ValueError, KeyError, TypeError):
        checks += 1
        return
    raise AssertionError("expected fail-closed error")

r = rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, bodies())
ok(r["matched_witness_key_count"] == 7)
ok(r["unique_source_url_count"] == 6)
ok(r["unique_source_host_count"] == 6)
ok(r["observed_witness_vkeys"] == sorted(pins))
ok(r["all_seven_reobserved_in_one_bounded_run"] is True)
ok(r["verdict"] == profile["strong_verdict"])
ok(all(v is False for v in r["claims"].values()))
rv.validate(profile, pre_profile, pre_receipt, pin_profile, r); checks += 1

# One missing key must downgrade the run, even when the #938 predecessor already had historical 7/7.
b = bodies(); s = profile["sources"][0]; b[s["source_url"]] = b"same source without exact pin"
x = rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b)
ok(x["matched_witness_key_count"] == 6 and x["all_seven_reobserved_in_one_bounded_run"] is False and x["verdict"] == profile["insufficient_verdict"])

# A single missing TrustFabric key still leaves six URLs reachable, but cannot satisfy seven-key admission.
b = bodies(); tf = profile["sources"][1]; other = profile["sources"][2]
b[tf["source_url"]] = b"page\n" + other["witness_vkey"].encode() + b"\n"
x = rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b)
ok(x["matched_witness_key_count"] == 6 and x["unique_source_url_count"] == 6 and not x["all_seven_reobserved_in_one_bounded_run"])

# Partial and same-name/wrong-key bytes do not count.
b = bodies(); s = profile["sources"][5]; b[s["source_url"]] = s["witness_vkey"][:-8].encode()
ok(rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b)["matched_witness_key_count"] == 6)
b = bodies(); b[s["source_url"]] = (s["witness_vkey"].split("+")[0] + "+deadbeef+AAAA").encode()
ok(rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b)["matched_witness_key_count"] == 6)

# Source map is exact closed allowlist.
b = bodies(); b.pop(next(iter(b))); expect_error(lambda: rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b))
b = bodies(); b["https://aggregator.example/"] = b"x"; expect_error(lambda: rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b))
b = bodies(); b[next(iter(b))] = b""; expect_error(lambda: rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b))

# Profile substitutions and count inflation fail closed.
p = copy.deepcopy(profile); p["sources"][0]["source_url"] = "http://witness.stagemole.eu/about"
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["sources"][0]["source_classification"] = "THIRD_PARTY_AGGREGATOR"
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["sources"][1]["witness_vkey"] = p["sources"][0]["witness_vkey"]
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["sources"][1]["id"] = p["sources"][0]["id"]
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["sources"][5]["source_url"] = p["sources"][6]["source_url"]
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["required_distinct_source_url_count"] = 5
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["sources"][4]["expected_git_blob"] = "0"*40
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))

# Exact predecessor #938 and #934 pin-set bindings cannot drift.
pr = copy.deepcopy(pre_receipt); pr["receipt_fingerprint_sha256"] = "0"*64
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pr = copy.deepcopy(pre_receipt); pr["verdict"] = "PROMOTED"
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pr = copy.deepcopy(pre_receipt); pr["composed_exact_pinned_witness_key_count"] = 6
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pr = copy.deepcopy(pre_receipt); pr["all_seven_operator_source_observations_composed"] = False
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pr = copy.deepcopy(pre_receipt); pr["claims"]["all_seven_currently_reobserved_in_one_run"] = True
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pp = copy.deepcopy(pre_profile); pp["tracking_issue"] = 999
expect_error(lambda: rp.evaluate(profile, pp, pre_receipt, pin_profile, bodies()))
pins2 = copy.deepcopy(pin_profile); pins2["witness_vkeys"][0] = "substituted"
expect_error(lambda: rp.evaluate(profile, pre_profile, pre_receipt, pins2, bodies()))

# Receipt-side promotion/inflation is rejected even with a recomputed fingerprint.
mutations = [
    lambda z: z.__setitem__("matched_witness_key_count", 8),
    lambda z: z.__setitem__("unique_source_url_count", 7),
    lambda z: z.__setitem__("unique_source_host_count", 7),
    lambda z: z.__setitem__("observed_witness_vkeys", z["observed_witness_vkeys"][:-1]),
    lambda z: z.__setitem__("all_seven_reobserved_in_one_bounded_run", False),
    lambda z: z.__setitem__("verdict", "GLOBAL_NON_EQUIVOCATION_PROVEN"),
    lambda z: z["claims"].__setitem__("all_seven_currently_active_proven", True),
    lambda z: z["claims"].__setitem__("witness_identity_proven", True),
    lambda z: z.__setitem__("automatic_action", True),
    lambda z: z.__setitem__("external_mutation_performed", True),
]
for mutate in mutations:
    z = copy.deepcopy(r); mutate(z); z["receipt_fingerprint_sha256"] = rp.fingerprint(z)
    expect_error(lambda z=z: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))

z = copy.deepcopy(r); z["source_records"][0]["source_host"] = "example.invalid"; z["receipt_fingerprint_sha256"] = rp.fingerprint(z)
expect_error(lambda: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))
z = copy.deepcopy(r); z["source_records"][0]["retrieved_body_sha256"] = "not-a-digest"; z["receipt_fingerprint_sha256"] = rp.fingerprint(z)
expect_error(lambda: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))
z = copy.deepcopy(r); z["receipt_fingerprint_sha256"] = "0"*64
expect_error(lambda: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))

print(f"PASS same-run all-seven witness-key provenance hostile suite: {checks} checks")
