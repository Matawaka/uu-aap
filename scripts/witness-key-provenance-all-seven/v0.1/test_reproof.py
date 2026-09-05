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
prior = [pins[0], pins[1], pins[2], pins[5], pins[6]]
pre_profile = {"tracking_issue": 935}
pre_receipt = {
    "tracking_issue": 935,
    "receipt_fingerprint_sha256": profile["required_predecessor_receipt_fingerprint_sha256"],
    "verdict": profile["required_predecessor_verdict"],
    "matched_witness_key_count": 5,
    "unique_source_url_count": 4,
    "unique_source_host_count": 4,
    "source_records": [{"witness_vkey": v, "exact_vkey_observed": True} for v in prior],
}
pin_profile = {"witness_vkeys": pins}


def bodies(all_match=True):
    out = {}
    for s in profile["new_sources"]:
        out[s["source_url"]] = b"operator page\n"
        if all_match:
            out[s["source_url"]] += s["witness_vkey"].encode() + b"\n"
    return out


def expect_error(fn):
    try:
        fn()
    except (ValueError, KeyError, TypeError):
        return
    raise AssertionError("expected fail-closed error")


r = rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, bodies())
assert r["new_exact_witness_key_count"] == 2
assert r["new_exact_source_url_count"] == 2
assert r["predecessor_observed_witness_key_count"] == 5
assert r["composed_exact_pinned_witness_key_count"] == 7
assert r["all_seven_operator_source_observations_composed"] is True
assert r["verdict"] == profile["strong_verdict"]
assert set(r["composed_witness_vkeys"]) == set(pins)
assert all(v is False for v in r["claims"].values())
rv.validate(profile, pre_profile, pre_receipt, pin_profile, r)

b = bodies(); s = profile["new_sources"][0]; b[s["source_url"]] = b"operator page without exact vkey"
x = rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b)
assert x["new_exact_witness_key_count"] == 1
assert x["composed_exact_pinned_witness_key_count"] == 6
assert x["all_seven_operator_source_observations_composed"] is False
assert x["verdict"] == profile["insufficient_verdict"]

b = bodies(); s = profile["new_sources"][1]; b[s["source_url"]] = s["witness_vkey"][:-8].encode()
assert rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b)["new_exact_witness_key_count"] == 1
b = bodies(); b[s["source_url"]] = (s["witness_vkey"].split("+")[0] + "+deadbeef+AAAA").encode()
assert rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b)["new_exact_witness_key_count"] == 1

b = bodies(); b.pop(next(iter(b))); expect_error(lambda: rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b))
b = bodies(); b["https://aggregator.example/"] = b"x"; expect_error(lambda: rp.evaluate(profile, pre_profile, pre_receipt, pin_profile, b))

p = copy.deepcopy(profile); p["new_sources"][0]["source_url"] = "http://www.rgdd.se/poc-witness/about"
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["new_sources"][0]["source_classification"] = "THIRD_PARTY_AGGREGATOR"
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["new_sources"][1]["witness_vkey"] = p["new_sources"][0]["witness_vkey"]
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))
p = copy.deepcopy(profile); p["new_sources"][1]["source_url"] = p["new_sources"][0]["source_url"]
expect_error(lambda: rp.evaluate(p, pre_profile, pre_receipt, pin_profile, bodies()))

pr = copy.deepcopy(pre_receipt); pr["matched_witness_key_count"] = 6
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pr = copy.deepcopy(pre_receipt); pr["receipt_fingerprint_sha256"] = "0"*64
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pr = copy.deepcopy(pre_receipt); pr["verdict"] = "PROMOTED"
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pr = copy.deepcopy(pre_receipt); pr["source_records"].append({"witness_vkey": pins[0], "exact_vkey_observed": True})
expect_error(lambda: rp.evaluate(profile, pre_profile, pr, pin_profile, bodies()))
pp = copy.deepcopy(pin_profile); pp["witness_vkeys"][0] = "substituted"
expect_error(lambda: rp.evaluate(profile, pre_profile, pre_receipt, pp, bodies()))

mutations = [
    lambda z: z.__setitem__("new_exact_witness_key_count", 3),
    lambda z: z.__setitem__("composed_exact_pinned_witness_key_count", 8),
    lambda z: z.__setitem__("verdict", "GLOBAL_NON_EQUIVOCATION_PROVEN"),
    lambda z: z["claims"].__setitem__("operator_independence_proven", True),
    lambda z: z["claims"].__setitem__("all_seven_currently_reobserved_in_one_run", True),
    lambda z: z.__setitem__("automatic_action", True),
    lambda z: z.__setitem__("external_mutation_performed", True),
]
for mutate in mutations:
    z = copy.deepcopy(r); mutate(z); z["receipt_fingerprint_sha256"] = rp.fingerprint(z)
    expect_error(lambda z=z: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))
z = copy.deepcopy(r); z["receipt_fingerprint_sha256"] = "0"*64
expect_error(lambda: rv.validate(profile, pre_profile, pre_receipt, pin_profile, z))

print("PASS all-seven witness-key provenance hostile suite: 20 checks")
