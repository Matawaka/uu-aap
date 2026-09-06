#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

SCHEMA = "urn:uu-aap:witness-rgdd-attributed-project-history-receipt:0.1"
PROFILE_SCHEMA = "urn:uu-aap:witness-rgdd-attributed-project-history-profile:0.1"
TEMPORAL_SCHEMA = "urn:uu-aap:witness-temporal-distinct-checkpoint-activity-receipt:0.1"
ORIGIN_SCHEMA = "urn:uu-aap:witness-operator-origin-corroboration-receipt:0.1"
TOPOLOGY_SCHEMA = "urn:uu-aap:witness-operator-attribution-topology-profile:0.1"
MAIN = "373e2911f0a4621a827dee76968a2a2358f6f129"
TREE = "63edff826cacba65384309a49383fd441b411c5b"
TEMPORAL_PROFILE_BLOB = "fac001695e550dc56b5be9f4badeb79badff1fdc"
TEMPORAL_RECEIPT_BLOB = "18342a27d884918bd99eca3d8018c273bf4444c0"
TEMPORAL_FP = "bb7209f25d1516e4ea7da48c468519c64a95ccd3d5fdc854dc09bc3a46e0eb4b"
TEMPORAL_VERDICT = "ALL_SEVEN_PINNED_WITNESS_KEYS_CRYPTOGRAPHICALLY_OBSERVED_SIGNING_TWO_DISTINCT_APPEND_ONLY_RELATED_CHECKPOINT_STATES_REPEATED_ACTIVITY_ESTABLISHED_CONTINUOUS_AVAILABILITY_NOT_ESTABLISHED"
ORIGIN_PROFILE_BLOB = "4e61035e4c1adf62c5927bd2b3de7db8715d028f"
ORIGIN_RECEIPT_BLOB = "b7fd97188f2a033de306ecd51b9f3f0cbcb9b62e"
ORIGIN_FP = "8e07ae4f682d580867f8c93525f0cd20796aa05067f12107602f1bebadcda10a"
ORIGIN_VERDICT = "FIVE_OF_SIX_PUBLIC_OPERATOR_LABELS_CORROBORATED_BY_OPERATOR_ORIGIN_ATTRIBUTION_EVIDENCE_ONE_OPERATOR_ORIGIN_RELATION_NOT_ESTABLISHED"
TOPOLOGY_PROFILE_BLOB = "9e05ec58e84c3a77a91739a875ac899529a55dfd"
UPSTREAM_REPO = "sigsum/sigsum"
UPSTREAM_COMMIT = "e3ee15ecfb343e083398bf05bc5c5fb55e2d0783"
SOURCE_CLASS = "PUBLIC_PROJECT_MINUTES_ATTRIBUTED_TO_OPERATOR_HANDLE"
LABELS = ["Mullvad VPN AB","TrustFabric","Florian Larysch","Geomys","rgdd","Elias Rudberg"]
HISTORICAL = ["Mullvad VPN AB","TrustFabric","Florian Larysch","Geomys","Elias Rudberg"]
TARGET = "rgdd"
WITNESS = "rgdd.se/poc-witness"
STRONG = "ALL_SIX_PUBLIC_OPERATOR_LABELS_CORROBORATED_BY_OPERATOR_ATTRIBUTED_PUBLIC_EVIDENCE_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED"
ONE = "RGDD_OPERATOR_HANDLE_TO_WITNESS_ATTRIBUTION_CORROBORATED_BY_ONE_QUALIFYING_PROJECT_HISTORY_SOURCE_SECOND_SOURCE_NOT_ESTABLISHED"
NONE = "RGDD_OPERATOR_HANDLE_TO_WITNESS_ATTRIBUTION_NOT_ESTABLISHED_FROM_QUALIFYING_PROJECT_HISTORY"
DRIFT = "UPSTREAM_PROJECT_HISTORY_EVIDENCE_DRIFTED_OR_UNAVAILABLE"
FALSE = set("""witness_identity_proven legal_operator_identity_proven cryptographic_operator_identity_binding_proven
operator_domain_control_proven operator_control_proven operator_independence_proven all_witnesses_independent_proven
all_seven_currently_active_proven continuous_witness_liveness_proven continuous_witness_availability_proven
all_views_non_equivocating_proven producer_non_equivocation_proven global_non_equivocation_proven complete_history_proven
all_manifests_submitted_proven selective_submission_absent_proven c2pa_manifest_inclusion_proven trusted_time_proven
truth_certified authority_created canonical_branch_selected malicious_behavior_proven automatic_remediation_triggered""".split())

def bad(msg): raise ValueError(msg)
def canon(x): return json.dumps(x, sort_keys=True, separators=(",",":"), ensure_ascii=False).encode()
def sha256(b): return hashlib.sha256(b).hexdigest()
def git_blob_sha1(b): return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
def load(path): return json.loads(Path(path).read_text(encoding="utf-8"))

def validate_profile(p):
    if p.get("schema") != PROFILE_SCHEMA or p.get("tracking_issue") != 950: bad("profile identity drift")
    exact = {
      "repository_predecessor_main": MAIN, "repository_predecessor_tree": TREE,
      "temporal_profile_path":"scripts/witness-temporal-distinct-checkpoint-activity/v0.1/profile.json",
      "temporal_profile_git_blob":TEMPORAL_PROFILE_BLOB,
      "temporal_receipt_path":"scripts/witness-temporal-distinct-checkpoint-activity/v0.1/qualification-receipt.json",
      "temporal_receipt_git_blob":TEMPORAL_RECEIPT_BLOB,
      "required_temporal_receipt_fingerprint_sha256":TEMPORAL_FP,
      "required_temporal_verdict":TEMPORAL_VERDICT,
      "operator_origin_profile_path":"scripts/witness-operator-origin-corroboration/v0.1/profile.json",
      "operator_origin_profile_git_blob":ORIGIN_PROFILE_BLOB,
      "operator_origin_receipt_path":"scripts/witness-operator-origin-corroboration/v0.1/qualification-receipt.json",
      "operator_origin_receipt_git_blob":ORIGIN_RECEIPT_BLOB,
      "required_operator_origin_receipt_fingerprint_sha256":ORIGIN_FP,
      "required_operator_origin_verdict":ORIGIN_VERDICT,
      "topology_profile_path":"scripts/witness-operator-attribution-topology/v0.1/profile.json",
      "topology_profile_git_blob":TOPOLOGY_PROFILE_BLOB,
      "target_operator_label":TARGET, "target_witness_name":WITNESS,
      "source_classification":SOURCE_CLASS,
      "upstream_repository":UPSTREAM_REPO, "upstream_commit":UPSTREAM_COMMIT,
      "required_distinct_source_count":2,
      "strong_verdict":STRONG, "one_source_verdict":ONE, "none_verdict":NONE, "drift_verdict":DRIFT
    }
    for k,v in exact.items():
        if p.get(k) != v: bad("profile drift: "+k)
    if p.get("required_public_operator_labels") != LABELS: bad("public label set drift")
    if p.get("historical_operator_origin_corroborated_labels") != HISTORICAL: bad("historical five-label set drift")
    sources = p.get("sources")
    if not isinstance(sources,list) or len(sources)!=2: bad("exactly two sources required")
    dates=[s.get("date") for s in sources]; paths=[s.get("path") for s in sources]; blobs=[s.get("git_blob") for s in sources]
    if len(set(dates))!=2 or len(set(paths))!=2 or len(set(blobs))!=2: bad("sources must be independently distinct")
    required = [
      ("2025-01-14","archive/2025-01-14--meeting-minutes.md","405bc5f343fa5da4839ceb4144a4a746402e5352",
       "- rgdd: rgdd.se/poc-witness is now running v0.3.0, worked out of the box","rgdd.se/poc-witness"),
      ("2026-06-09","archive/2026-06-09--meeting-minutes.md","e36839d9963a9f05c04b726f8082bbf95ca382fa",
       "- rgdd: looked at eric's litewitness metrics patch","currently running it on rgdd.se/poc-witness + hooked it up with grafana")
    ]
    for s, r in zip(sources, required):
        if (s.get("date"),s.get("path"),s.get("git_blob"),s.get("attribution_start"),s.get("required_witness_fragment")) != r:
            bad("source binding drift")
    if set(p.get("always_false_claims",[])) != FALSE: bad("false-claim set drift")

def require_blob(root, rel, expected):
    b=(Path(root)/rel).read_bytes()
    if git_blob_sha1(b)!=expected: bad("Git blob drift: "+rel)
    return b

def bind_repo(root,p):
    for rel, expected in [
      (p["temporal_profile_path"],TEMPORAL_PROFILE_BLOB),
      (p["temporal_receipt_path"],TEMPORAL_RECEIPT_BLOB),
      (p["operator_origin_profile_path"],ORIGIN_PROFILE_BLOB),
      (p["operator_origin_receipt_path"],ORIGIN_RECEIPT_BLOB),
      (p["topology_profile_path"],TOPOLOGY_PROFILE_BLOB)
    ]:
        require_blob(root,rel,expected)

def validate_temporal(r):
    if r.get("schema")!=TEMPORAL_SCHEMA or r.get("tracking_issue")!=948: bad("#949 receipt identity drift")
    if r.get("receipt_fingerprint_sha256")!=TEMPORAL_FP or r.get("verdict")!=TEMPORAL_VERDICT: bad("#949 receipt fingerprint/verdict drift")
    t=r.get("temporal_activity",{}); c=r.get("consistency",{}); s=r.get("successor_checkpoint",{})
    if not (t.get("repeated_activity_established") is True and t.get("same_exact_pins_observed_across_two_distinct_states") is True and t.get("verified_pinned_witness_count")==7): bad("#949 temporal evidence drift")
    if not (c.get("verified") is True and c.get("old_size")==7838 and c.get("new_size")==7840): bad("#949 consistency drift")
    if not (s.get("tree_size")==7840 and s.get("log_signature_verified") is True): bad("#949 successor checkpoint drift")
    if any(r.get("claims",{}).values()) or r.get("automatic_action") is not False or r.get("external_mutation_performed") is not False: bad("#949 semantic/effect promotion")

def validate_origin(r):
    if r.get("schema")!=ORIGIN_SCHEMA or r.get("tracking_issue")!=944: bad("#945 receipt identity drift")
    if r.get("receipt_fingerprint_sha256")!=ORIGIN_FP or r.get("verdict")!=ORIGIN_VERDICT: bad("#945 receipt fingerprint/verdict drift")
    if r.get("public_operator_label_count")!=6 or r.get("corroborated_operator_label_count")!=5: bad("#945 count drift")
    if r.get("corroborated_operator_labels")!=sorted(HISTORICAL): bad("#945 historical labels drift")
    if r.get("missing_operator_labels")!=["rgdd"]: bad("#945 missing label drift")
    if r.get("network_curated_table_counted_as_operator_origin_evidence") is not False: bad("#945 source-class promotion")
    if any(r.get("claims",{}).values()) or r.get("automatic_action") is not False or r.get("external_mutation_performed") is not False: bad("#945 semantic/effect promotion")

def validate_topology(p):
    if p.get("schema")!=TOPOLOGY_SCHEMA or p.get("tracking_issue")!=941: bad("#942 profile identity drift")
    ops=p.get("operators",[]); labels=[x.get("operator_label") for x in ops]
    if labels!=LABELS or p.get("required_operator_label_count")!=6: bad("#942 label topology drift")
    rg=[x for x in ops if x.get("operator_label")=="rgdd"]
    if len(rg)!=1 or rg[0].get("witness_vkeys")!=["rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG"]: bad("#942 rgdd witness binding drift")

def extract_attribution_block(text, start):
    lines=text.splitlines(); matches=[i for i,l in enumerate(lines) if l.strip()==start]
    if len(matches)!=1: return None
    i=matches[0]; indent=len(lines[i])-len(lines[i].lstrip(" "))
    if not lines[i].strip().startswith("- rgdd:"): return None
    block=[lines[i]]
    for line in lines[i+1:]:
        if not line.strip(): block.append(line); continue
        ind=len(line)-len(line.lstrip(" "))
        if ind<=indent and line.lstrip().startswith("- "): break
        block.append(line)
    return "\n".join(block)

def inspect_source(spec, raw):
    rec={"date":spec["date"],"path":spec["path"],"source_classification":SOURCE_CLASS,
      "expected_git_blob":spec["git_blob"],"retrieved_git_blob":git_blob_sha1(raw),"retrieved_body_sha256":sha256(raw),
      "exact_blob_matched":False,"attribution_block_observed":False,"required_witness_fragment_observed":False,
      "qualifies":False,"attribution_block_sha256":None}
    if rec["retrieved_git_blob"]!=spec["git_blob"]: return rec
    rec["exact_blob_matched"]=True
    try: text=raw.decode("utf-8")
    except UnicodeDecodeError: return rec
    block=extract_attribution_block(text,spec["attribution_start"])
    if block is None: return rec
    rec["attribution_block_observed"]=True; rec["attribution_block_sha256"]=sha256(block.encode())
    if spec["required_witness_fragment"] not in block or WITNESS not in block: return rec
    rec["required_witness_fragment_observed"]=True; rec["qualifies"]=True
    return rec

def base_receipt(p, verdict):
    return {"schema":SCHEMA,"tracking_issue":950,"repository_predecessor_main":MAIN,"repository_predecessor_tree":TREE,
      "temporal_predecessor":{"receipt_fingerprint_sha256":TEMPORAL_FP,"verdict":TEMPORAL_VERDICT},
      "historical_operator_origin_predecessor":{"receipt_fingerprint_sha256":ORIGIN_FP,"verdict":ORIGIN_VERDICT,"corroborated_operator_label_count":5,"missing_operator_labels":["rgdd"]},
      "public_operator_labels":list(LABELS),"historical_operator_origin_labels":list(HISTORICAL),
      "target_operator_label":TARGET,"target_witness_name":WITNESS,
      "evidence_composition":"FROZEN_FIVE_OPERATOR_ORIGIN_PLUS_LIVE_RGDD_ATTRIBUTED_PROJECT_HISTORY",
      "project_minutes_counted_as_operator_origin_evidence":False,"network_curated_table_counted_as_project_history_evidence":False,
      "claims":{k:False for k in p["always_false_claims"]},"automatic_action":False,"external_mutation_performed":False,"verdict":verdict}

def finish(r): r["receipt_fingerprint_sha256"]=sha256(canon(r)); return r

def evaluate(p, temporal, origin, topology, source_bytes):
    validate_profile(p); validate_temporal(temporal); validate_origin(origin); validate_topology(topology)
    records=[]
    for spec in p["sources"]:
        raw=source_bytes.get(spec["path"])
        if raw is None:
            rec={"date":spec["date"],"path":spec["path"],"source_classification":SOURCE_CLASS,"expected_git_blob":spec["git_blob"],"retrieved_git_blob":None,"retrieved_body_sha256":None,"exact_blob_matched":False,"attribution_block_observed":False,"required_witness_fragment_observed":False,"qualifies":False,"attribution_block_sha256":None}
        else: rec=inspect_source(spec,raw)
        records.append(rec)
    if any(r["retrieved_git_blob"] is not None and not r["exact_blob_matched"] for r in records): verdict=DRIFT
    else:
        count=sum(bool(r["qualifies"]) for r in records); verdict=STRONG if count==2 else (ONE if count==1 else NONE)
    r=base_receipt(p,verdict); r["upstream"]={"repository":UPSTREAM_REPO,"commit":UPSTREAM_COMMIT,"source_classification":SOURCE_CLASS}
    r["source_records"]=records; r["qualifying_distinct_source_count"]=sum(bool(x["qualifies"]) for x in records)
    r["rgdd_handle_to_witness_attribution_corroborated"]=r["qualifying_distinct_source_count"]==2
    r["operator_attributed_public_evidence_label_count"]=6 if r["rgdd_handle_to_witness_attribution_corroborated"] else 5
    return finish(r)

def fp(r):
    x=dict(r); x.pop("receipt_fingerprint_sha256",None); return sha256(canon(x))

def validate_receipt(r,p):
    validate_profile(p)
    if r.get("schema")!=SCHEMA or r.get("tracking_issue")!=950: bad("receipt identity drift")
    if r.get("repository_predecessor_main")!=MAIN or r.get("repository_predecessor_tree")!=TREE: bad("receipt predecessor drift")
    if r.get("receipt_fingerprint_sha256")!=fp(r): bad("receipt fingerprint mismatch")
    if r.get("verdict") not in {STRONG,ONE,NONE,DRIFT}: bad("receipt verdict drift")
    if r.get("public_operator_labels")!=LABELS or r.get("historical_operator_origin_labels")!=HISTORICAL: bad("receipt label set drift")
    if r.get("evidence_composition")!="FROZEN_FIVE_OPERATOR_ORIGIN_PLUS_LIVE_RGDD_ATTRIBUTED_PROJECT_HISTORY": bad("composition drift")
    if r.get("project_minutes_counted_as_operator_origin_evidence") is not False: bad("project history promoted to operator-origin")
    if r.get("network_curated_table_counted_as_project_history_evidence") is not False: bad("network table promotion")
    if set(r.get("claims",{}))!=FALSE or any(r.get("claims",{}).values()): bad("receipt claim promotion")
    if r.get("automatic_action") is not False or r.get("external_mutation_performed") is not False: bad("receipt effect promotion")
    recs=r.get("source_records",[])
    if len(recs)!=2: bad("receipt source count drift")
    expected_paths=[s["path"] for s in p["sources"]]; expected_blobs=[s["git_blob"] for s in p["sources"]]
    if [x.get("path") for x in recs]!=expected_paths: bad("receipt source path/order drift")
    if [x.get("expected_git_blob") for x in recs]!=expected_blobs: bad("receipt expected source blob drift")
    if any(x.get("source_classification")!=SOURCE_CLASS for x in recs): bad("receipt source classification drift")
    if len(set(x.get("path") for x in recs))!=2 or len(set(x.get("expected_git_blob") for x in recs))!=2: bad("receipt duplicate source inflation")
    q=sum(bool(x.get("qualifies")) for x in recs)
    if q!=r.get("qualifying_distinct_source_count"): bad("qualifying count mismatch")
    if r.get("rgdd_handle_to_witness_attribution_corroborated") is not (q==2): bad("rgdd corroboration mismatch")
    if r.get("operator_attributed_public_evidence_label_count")!=(6 if q==2 else 5): bad("composed label count mismatch")
    if r["verdict"]==STRONG:
        if q!=2 or r.get("operator_attributed_public_evidence_label_count")!=6: bad("strong verdict mismatch")
        if not all(x.get("exact_blob_matched") and x.get("attribution_block_observed") and x.get("required_witness_fragment_observed") for x in recs): bad("strong source evidence mismatch")

def emit(path,r):
    s=json.dumps(r,indent=2,sort_keys=True,ensure_ascii=False)+"\n"
    if path: Path(path).write_text(s,encoding="utf-8")
    print(s,end="")

def main():
    a=argparse.ArgumentParser(); a.add_argument("--profile",required=True); a.add_argument("--repo-root",default=".")
    a.add_argument("--temporal-receipt"); a.add_argument("--operator-origin-receipt"); a.add_argument("--topology-profile")
    a.add_argument("--source-a"); a.add_argument("--source-b"); a.add_argument("--output"); a.add_argument("--validate-receipt")
    x=a.parse_args()
    try:
        p=load(x.profile); validate_profile(p); bind_repo(Path(x.repo_root),p)
        if x.validate_receipt: validate_receipt(load(x.validate_receipt),p); print("RGDD_PROJECT_HISTORY_RECEIPT_VALID"); return 0
        if not all([x.temporal_receipt,x.operator_origin_receipt,x.topology_profile]): bad("predecessor inputs required")
        temporal=load(x.temporal_receipt); origin=load(x.operator_origin_receipt); topology=load(x.topology_profile); source_bytes={}
        if x.source_a: source_bytes[p["sources"][0]["path"]]=Path(x.source_a).read_bytes()
        if x.source_b: source_bytes[p["sources"][1]["path"]]=Path(x.source_b).read_bytes()
        r=evaluate(p,temporal,origin,topology,source_bytes); validate_receipt(r,p); emit(x.output,r)
        return 0 if r["verdict"]==STRONG else 2
    except (OSError,json.JSONDecodeError,ValueError) as e:
        print("RGDD_PROJECT_HISTORY_FAIL_CLOSED:",e); return 1

if __name__=="__main__": raise SystemExit(main())
