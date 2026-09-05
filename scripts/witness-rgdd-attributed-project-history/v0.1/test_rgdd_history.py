#!/usr/bin/env python3
from __future__ import annotations
import copy, importlib.util, json, tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("R",HERE/"rgdd_history.py")
R=importlib.util.module_from_spec(spec); spec.loader.exec_module(R)
p=json.loads((HERE/"profile.json").read_text(encoding="utf-8"))
checks=0

def ok(cond,msg):
    global checks
    if not cond: raise AssertionError(msg)
    checks+=1

def raises(fn,msg):
    global checks
    try: fn()
    except ValueError:
        checks+=1; return
    raise AssertionError(msg)

def recalc(r):
    r["receipt_fingerprint_sha256"]=R.fp(r); return r

R.validate_profile(p); ok(True,"accepted profile validates")
for key,badv in [
    ("repository_predecessor_main","0"*40),("repository_predecessor_tree","0"*40),
    ("temporal_profile_git_blob","0"*40),("temporal_receipt_git_blob","0"*40),
    ("required_temporal_receipt_fingerprint_sha256","0"*64),("required_temporal_verdict","NO"),
    ("operator_origin_profile_git_blob","0"*40),("operator_origin_receipt_git_blob","0"*40),
    ("required_operator_origin_receipt_fingerprint_sha256","0"*64),("required_operator_origin_verdict","NO"),
    ("topology_profile_git_blob","0"*40),("upstream_repository","other/repo"),("upstream_commit","0"*40),
    ("source_classification","NETWORK_CURATED_OPERATOR_TABLE"),("target_operator_label","someone"),("target_witness_name","other.example/witness")]:
    q=copy.deepcopy(p); q[key]=badv
    raises(lambda q=q:R.validate_profile(q),f"profile drift accepted: {key}")
q=copy.deepcopy(p); q["required_public_operator_labels"]=list(reversed(q["required_public_operator_labels"])); raises(lambda:R.validate_profile(q),"label drift accepted")
q=copy.deepcopy(p); q["historical_operator_origin_corroborated_labels"].append("rgdd"); raises(lambda:R.validate_profile(q),"historical 5/6 rewrite accepted")
q=copy.deepcopy(p); q["sources"][1]["git_blob"]=q["sources"][0]["git_blob"]; raises(lambda:R.validate_profile(q),"same blob counted twice")
q=copy.deepcopy(p); q["sources"][1]["path"]=q["sources"][0]["path"]; raises(lambda:R.validate_profile(q),"same path counted twice")
q=copy.deepcopy(p); q["sources"][1]["date"]=q["sources"][0]["date"]; raises(lambda:R.validate_profile(q),"same date counted twice")
q=copy.deepcopy(p); q["sources"][0]["attribution_start"]="someone: rgdd.se/poc-witness"; raises(lambda:R.validate_profile(q),"third-party start accepted")

def spec_for(raw,start,required):
    return {"date":"x","path":"x.md","git_blob":R.git_blob_sha1(raw),"attribution_start":start,"required_witness_fragment":required}
raw=(b"# Status\n" b"- rgdd: rgdd.se/poc-witness is now running v0.3.0, worked out of the box\n" b"  - child note\n" b"- elias: unrelated\n")
s=spec_for(raw,"- rgdd: rgdd.se/poc-witness is now running v0.3.0, worked out of the box","rgdd.se/poc-witness")
ok(R.inspect_source(s,raw)["qualifies"] is True,"exact rgdd block should qualify")
raw2=(b"# Status\n" b"- rgdd: looked at eric's litewitness metrics patch\n" b"  - currently running it on rgdd.se/poc-witness + hooked it up with grafana\n" b"- elias: witness1.smartit.nu\n")
s2=spec_for(raw2,"- rgdd: looked at eric's litewitness metrics patch","currently running it on rgdd.se/poc-witness + hooked it up with grafana")
ok(R.inspect_source(s2,raw2)["qualifies"] is True,"nested rgdd block should qualify")
raw3=(b"# Status\n" b"- rgdd: looked at eric's litewitness metrics patch\n" b"- elias: currently running it on rgdd.se/poc-witness + hooked it up with grafana\n")
s3=spec_for(raw3,"- rgdd: looked at eric's litewitness metrics patch","currently running it on rgdd.se/poc-witness + hooked it up with grafana")
ok(R.inspect_source(s3,raw3)["qualifies"] is False,"cross-speaker splicing accepted")
raw4=b"- alice: rgdd says rgdd.se/poc-witness is running\n"
s4=spec_for(raw4,"- rgdd: rgdd.se/poc-witness is running","rgdd.se/poc-witness")
ok(R.inspect_source(s4,raw4)["qualifies"] is False,"third-party sentence accepted")
raw5=b"- rgdd: metrics look healthy\n- elias: rgdd.se/poc-witness is running\n"
s5=spec_for(raw5,"- rgdd: metrics look healthy","rgdd.se/poc-witness")
ok(R.inspect_source(s5,raw5)["qualifies"] is False,"witness from another block accepted")
ok(R.inspect_source(s,raw+b"extra\n")["qualifies"] is False,"blob drift accepted")
dup=raw+raw; sd=spec_for(dup,"- rgdd: rgdd.se/poc-witness is now running v0.3.0, worked out of the box","rgdd.se/poc-witness")
ok(R.inspect_source(sd,dup)["qualifies"] is False,"duplicate attributed item accepted")

temporal={"schema":R.TEMPORAL_SCHEMA,"tracking_issue":948,"receipt_fingerprint_sha256":R.TEMPORAL_FP,"verdict":R.TEMPORAL_VERDICT,
 "temporal_activity":{"repeated_activity_established":True,"same_exact_pins_observed_across_two_distinct_states":True,"verified_pinned_witness_count":7},
 "consistency":{"verified":True,"old_size":7838,"new_size":7840},"successor_checkpoint":{"tree_size":7840,"log_signature_verified":True},
 "claims":{"x":False},"automatic_action":False,"external_mutation_performed":False}
R.validate_temporal(temporal); ok(True,"temporal predecessor validates")
for mut in [lambda x:x.__setitem__("receipt_fingerprint_sha256","0"*64),lambda x:x.__setitem__("verdict","NO"),lambda x:x["temporal_activity"].__setitem__("repeated_activity_established",False),lambda x:x["temporal_activity"].__setitem__("same_exact_pins_observed_across_two_distinct_states",False),lambda x:x["temporal_activity"].__setitem__("verified_pinned_witness_count",6),lambda x:x["consistency"].__setitem__("verified",False),lambda x:x["consistency"].__setitem__("new_size",7841),lambda x:x["successor_checkpoint"].__setitem__("log_signature_verified",False),lambda x:x.__setitem__("automatic_action",True),lambda x:x.__setitem__("external_mutation_performed",True)]:
    z=copy.deepcopy(temporal); mut(z); raises(lambda z=z:R.validate_temporal(z),"#949 predecessor drift accepted")
origin={"schema":R.ORIGIN_SCHEMA,"tracking_issue":944,"receipt_fingerprint_sha256":R.ORIGIN_FP,"verdict":R.ORIGIN_VERDICT,"public_operator_label_count":6,"corroborated_operator_label_count":5,"corroborated_operator_labels":sorted(R.HISTORICAL),"missing_operator_labels":["rgdd"],"network_curated_table_counted_as_operator_origin_evidence":False,"claims":{"x":False},"automatic_action":False,"external_mutation_performed":False}
R.validate_origin(origin); ok(True,"#945 predecessor validates")
for mut in [lambda x:x.__setitem__("receipt_fingerprint_sha256","0"*64),lambda x:x.__setitem__("verdict","NO"),lambda x:x.__setitem__("corroborated_operator_label_count",6),lambda x:x.__setitem__("missing_operator_labels",[]),lambda x:x.__setitem__("network_curated_table_counted_as_operator_origin_evidence",True),lambda x:x.__setitem__("automatic_action",True)]:
    z=copy.deepcopy(origin); mut(z); raises(lambda z=z:R.validate_origin(z),"#945 predecessor rewrite accepted")
topology={"schema":R.TOPOLOGY_SCHEMA,"tracking_issue":941,"required_operator_label_count":6,"operators":[{"operator_label":x,"witness_vkeys":["rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG"] if x=="rgdd" else ["k"]} for x in R.LABELS]}
R.validate_topology(topology); ok(True,"#942 topology validates")
z=copy.deepcopy(topology); z["operators"][0]["operator_label"]="Other"; raises(lambda:R.validate_topology(z),"#942 label set drift accepted")
z=copy.deepcopy(topology); [o for o in z["operators"] if o["operator_label"]=="rgdd"][0]["witness_vkeys"]=["wrong"]; raises(lambda:R.validate_topology(z),"#942 rgdd witness drift accepted")

def source_record(spec):
    return {"date":spec["date"],"path":spec["path"],"source_classification":R.SOURCE_CLASS,"expected_git_blob":spec["git_blob"],"retrieved_git_blob":spec["git_blob"],"retrieved_body_sha256":"1"*64,"exact_blob_matched":True,"attribution_block_observed":True,"required_witness_fragment_observed":True,"qualifies":True,"attribution_block_sha256":"2"*64}
strong=R.base_receipt(p,R.STRONG); strong["upstream"]={"repository":R.UPSTREAM_REPO,"commit":R.UPSTREAM_COMMIT,"source_classification":R.SOURCE_CLASS}; strong["source_records"]=[source_record(x) for x in p["sources"]]; strong["qualifying_distinct_source_count"]=2; strong["rgdd_handle_to_witness_attribution_corroborated"]=True; strong["operator_attributed_public_evidence_label_count"]=6; R.finish(strong)
R.validate_receipt(strong,p); ok(True,"strong receipt validates")
for claim in sorted(R.FALSE):
    z=copy.deepcopy(strong); z["claims"][claim]=True; recalc(z); raises(lambda z=z:R.validate_receipt(z,p),f"claim promotion accepted: {claim}")
mutators=[lambda x:x.__setitem__("project_minutes_counted_as_operator_origin_evidence",True),lambda x:x.__setitem__("network_curated_table_counted_as_project_history_evidence",True),lambda x:x.__setitem__("automatic_action",True),lambda x:x.__setitem__("external_mutation_performed",True),lambda x:x.__setitem__("operator_attributed_public_evidence_label_count",7),lambda x:x.__setitem__("qualifying_distinct_source_count",1),lambda x:x.__setitem__("rgdd_handle_to_witness_attribution_corroborated",False),lambda x:x["source_records"][0].__setitem__("source_classification","NETWORK_CURATED_OPERATOR_TABLE"),lambda x:x["source_records"][1].__setitem__("path",x["source_records"][0]["path"]),lambda x:x["source_records"][1].__setitem__("expected_git_blob",x["source_records"][0]["expected_git_blob"]),lambda x:x["source_records"][0].__setitem__("qualifies",False),lambda x:x["source_records"][0].__setitem__("exact_blob_matched",False),lambda x:x["source_records"][0].__setitem__("attribution_block_observed",False),lambda x:x["source_records"][0].__setitem__("required_witness_fragment_observed",False)]
for i,mut in enumerate(mutators):
    z=copy.deepcopy(strong); mut(z); recalc(z); raises(lambda z=z:R.validate_receipt(z,p),f"strong receipt mutation {i} accepted")
z=copy.deepcopy(strong); z["receipt_fingerprint_sha256"]="0"*64; raises(lambda:R.validate_receipt(z,p),"bad receipt fingerprint accepted")
with tempfile.TemporaryDirectory() as td:
    root=Path(td); (root/"x").write_bytes(b"abc"); exp=R.git_blob_sha1(b"abc"); ok(R.require_blob(root,"x",exp)==b"abc","generic exact blob binding"); raises(lambda:R.require_blob(root,"x","0"*40),"generic blob drift accepted")
repo_root=HERE.parents[2] if len(HERE.parents)>=3 else HERE
if (repo_root/p["temporal_receipt_path"]).exists():
    R.bind_repo(repo_root,p); ok(True,"real predecessor Git blobs exact")
    R.validate_temporal(json.loads((repo_root/p["temporal_receipt_path"]).read_text())); ok(True,"real #949 receipt valid")
    R.validate_origin(json.loads((repo_root/p["operator_origin_receipt_path"]).read_text())); ok(True,"real #945 receipt valid")
    R.validate_topology(json.loads((repo_root/p["topology_profile_path"]).read_text())); ok(True,"real #942 topology valid")
print(f"RGDD_PROJECT_HISTORY_HOSTILE_PASS: {checks}/{checks}")
