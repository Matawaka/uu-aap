#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

D=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("reproof",D/"reproof.py"); rp=importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)
spec2=importlib.util.spec_from_file_location("receipt_validator",D/"receipt_validator.py"); rv=importlib.util.module_from_spec(spec2); spec2.loader.exec_module(rv)

profile=json.load(open(D/"profile.json",encoding="utf-8"))
pre_profile={"quorum_min":4,"key_provenance_assurance":"OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN","witness_vkeys":[
"witness.stagemole.eu+67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv",
"transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM",
"staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL",
"rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG",
"witness1.smartit.nu/witness1+a48c820f+BPSFWg9G6KPiO7QPryYO5Xq4oYJJ+kAvLKLSimDhoxMO",
"remora.n621.de+da77ade7+BOvN63jn/bLvkieywe8R6UYAtVtNbZpXh34x7onlmtw2",
"witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G"]}
pre_receipt={"verdict":profile["required_predecessor_verdict"],"receipt_fingerprint_sha256":profile["required_predecessor_receipt_fingerprint_sha256"],"later_checkpoint":{"key_provenance_assurance":profile["required_predecessor_key_provenance_assurance"],"verified_witness_count":7,"checkpoint_sha256":profile["predecessor_checkpoint_sha256"]},"consistency":{"proof_text_sha256":profile["predecessor_consistency_sha256"]}}

def bodies(all_match=True):
    out={}
    for s in profile["operator_sources"]:
        out.setdefault(s["source_url"],b"operator page\n")
        if all_match:
            out[s["source_url"]]+=s["witness_vkey"].encode()+b"\n"
    return out

def expect_error(fn):
    try: fn()
    except (ValueError,KeyError,TypeError): return
    raise AssertionError("expected fail-closed error")

r=rp.evaluate(profile,pre_profile,pre_receipt,bodies())
assert r["matched_witness_key_count"]==5
assert r["unique_source_url_count"]==4
assert r["unique_source_host_count"]==4
assert r["quorum_many_exact_vkeys_reobserved"] is True
assert r["quorum_many_distinct_source_urls_reobserved"] is True
assert r["verdict"]==profile["strong_verdict"]
assert all(v is False for v in r["claims"].values())
rv.validate(profile,r)

# Literal predecessor boundary: four key matches across only three source URLs are not promoted.
b=bodies(); st=profile["operator_sources"][0]; b[st["source_url"]]=b"operator page without pinned key"
r4=rp.evaluate(profile,pre_profile,pre_receipt,b); assert r4["matched_witness_key_count"]==4; assert r4["quorum_many_exact_vkeys_reobserved"] is True; assert r4["unique_source_url_count"]==3; assert r4["quorum_many_distinct_source_urls_reobserved"] is False; assert r4["verdict"]==profile["insufficient_verdict"]

# Partial/truncated or same-name wrong key bytes do not count.
b=bodies(); s=profile["operator_sources"][3]; b[s["source_url"]]=s["witness_vkey"][:-8].encode(); rbad=rp.evaluate(profile,pre_profile,pre_receipt,b); assert rbad["matched_witness_key_count"]==4
b=bodies(); b[s["source_url"]]=(s["witness_vkey"].split('+')[0]+"+deadbeef+AAAA").encode(); rbad=rp.evaluate(profile,pre_profile,pre_receipt,b); assert rbad["matched_witness_key_count"]==4

# Missing/extra source map fail closed.
b=bodies(); b.pop(next(iter(b))); expect_error(lambda: rp.evaluate(profile,pre_profile,pre_receipt,b))
b=bodies(); b["https://aggregator.example/"]=b"x"; expect_error(lambda: rp.evaluate(profile,pre_profile,pre_receipt,b))

# Duplicate key or source id cannot inflate count.
p=copy.deepcopy(profile); p["operator_sources"].append(copy.deepcopy(p["operator_sources"][0])); expect_error(lambda: rp.evaluate(p,pre_profile,pre_receipt,bodies()))
p=copy.deepcopy(profile); p["operator_sources"][1]["id"]=p["operator_sources"][0]["id"]; expect_error(lambda: rp.evaluate(p,pre_profile,pre_receipt,bodies()))

# Unpinned key, HTTP source, aggregator class, quorum drift all fail closed.
p=copy.deepcopy(profile); p["operator_sources"][0]["witness_vkey"]="example.invalid/witness+deadbeef+AAAA"; expect_error(lambda: rp.evaluate(p,pre_profile,pre_receipt,bodies()))
p=copy.deepcopy(profile); p["operator_sources"][0]["source_url"]="http://transparency.dev/witnesses"; expect_error(lambda: rp.evaluate(p,pre_profile,pre_receipt,bodies()))
p=copy.deepcopy(profile); p["operator_sources"][0]["source_url"]=p["operator_sources"][1]["source_url"]; expect_error(lambda: rp.evaluate(p,pre_profile,pre_receipt,bodies()))
p=copy.deepcopy(profile); p["operator_sources"][0]["source_classification"]="THIRD_PARTY_AGGREGATOR"; expect_error(lambda: rp.evaluate(p,pre_profile,pre_receipt,bodies()))
p=copy.deepcopy(profile); p["quorum_min"]=3; expect_error(lambda: rp.evaluate(p,pre_profile,pre_receipt,bodies()))

# Predecessor provenance/verdict/pin-set substitution fails closed.
pp=copy.deepcopy(pre_profile); pp["key_provenance_assurance"]="INDEPENDENTLY_PROVEN"; expect_error(lambda: rp.evaluate(profile,pp,pre_receipt,bodies()))
pr=copy.deepcopy(pre_receipt); pr["verdict"]="PROMOTED"; expect_error(lambda: rp.evaluate(profile,pre_profile,pr,bodies()))
pp=copy.deepcopy(pre_profile); pp["witness_vkeys"][1]="substituted"; expect_error(lambda: rp.evaluate(profile,pp,pre_receipt,bodies()))

# Receipt count/verdict/claim/fingerprint promotion rejected.
for mutate in [
    lambda x: x.__setitem__("matched_witness_key_count",6),
    lambda x: x.__setitem__("unique_source_host_count",5),
    lambda x: x.__setitem__("verdict","GLOBAL_NON_EQUIVOCATION_PROVEN"),
    lambda x: x["claims"].__setitem__("operator_independence_proven",True),
    lambda x: x.__setitem__("automatic_action",True),
    lambda x: x.__setitem__("external_mutation_performed",True),
]:
    z=copy.deepcopy(r); mutate(z); z["receipt_fingerprint_sha256"]=rp.fingerprint(z); expect_error(lambda z=z: rv.validate(profile,z))
z=copy.deepcopy(r); z["receipt_fingerprint_sha256"]="0"*64; expect_error(lambda: rv.validate(profile,z))

# Same operator page can carry two key matches but cannot inflate host/url counts.
assert sum(1 for x in r["source_records"] if x["source_host"]=="transparency.dev" and x["exact_vkey_observed"])==2
assert r["unique_source_host_count"]==4

print("PASS witness-key provenance reproof hostile suite: 23 checks")
