#!/usr/bin/env python3
import argparse, json, re
from urllib.parse import urlparse
from topology import RECEIPT_SCHEMA, fingerprint, normalize_url, validate_profile
HEX64=re.compile(r"^[0-9a-f]{64}$")

def validate(profile,pre_profile,pre_receipt,pin_profile,receipt):
 pin_set=validate_profile(profile,pre_profile,pre_receipt,pin_profile)
 expected={"schema","tracking_issue","predecessor","registry","operator_records","matched_witness_key_count","public_operator_label_count","bound_attribution_surface_count","bound_key_material_surface_count","registry_relation_count","operator_key_material_relation_count","observed_operator_labels","observed_witness_vkeys","trustfabric_pinned_key_count","all_seven_public_operator_attributions_bound","operator_attribution_assurance","claims","automatic_action","external_mutation_performed","verdict","receipt_fingerprint_sha256"}
 if set(receipt)!=expected or receipt["schema"]!=RECEIPT_SCHEMA or receipt["tracking_issue"]!=941: raise ValueError("receipt identity/shape")
 p=receipt["predecessor"]
 if set(p)!={"main_sha","profile_git_blob","qualification_receipt_git_blob","receipt_fingerprint_sha256","verdict","matched_witness_key_count","unique_source_url_count"}: raise ValueError("predecessor shape")
 if p!={"main_sha":profile["repository_predecessor_main"],"profile_git_blob":profile["predecessor_profile_git_blob"],"qualification_receipt_git_blob":profile["predecessor_receipt_git_blob"],"receipt_fingerprint_sha256":profile["required_predecessor_receipt_fingerprint_sha256"],"verdict":profile["required_predecessor_verdict"],"matched_witness_key_count":7,"unique_source_url_count":6}: raise ValueError("predecessor mismatch")
 reg=receipt["registry"]
 if set(reg)!={"source_url","source_classification","retrieved_body_sha256"} or normalize_url(reg["source_url"])!=normalize_url(profile["registry"]["source_url"]) or reg["source_classification"]!=profile["registry"]["source_classification"] or not HEX64.fullmatch(reg["retrieved_body_sha256"]): raise ValueError("registry mismatch")
 source={o["operator_label"]:o for o in profile["operators"]}; records=receipt["operator_records"]
 if not isinstance(records,list) or len(records)!=6: raise ValueError("records")
 seen=set(); matched=set(); labels=set(); attrs=set(); keysurfs=set(); regrels=set(); keyrels=set(); tf=None
 req={"operator_label","attribution_url","attribution_host","key_material_url","key_material_host","key_material_relation","source_classification","attribution_body_sha256","key_material_body_sha256","expected_witness_key_count","witness_vkeys","observed_witness_vkeys","all_expected_vkeys_observed","registry_relation_observed","operator_key_material_relation_observed"}
 for r in records:
  if set(r)!=req: raise ValueError("record shape")
  l=r["operator_label"]
  if l in seen or l not in source: raise ValueError("record label")
  seen.add(l); s=source[l]
  if normalize_url(r["attribution_url"])!=normalize_url(s["attribution_url"]) or normalize_url(r["key_material_url"])!=normalize_url(s["key_material_url"]): raise ValueError("record URL")
  if r["attribution_host"]!=urlparse(s["attribution_url"]).hostname or r["key_material_host"]!=urlparse(s["key_material_url"]).hostname or r["key_material_relation"]!=s["key_material_relation"] or r["source_classification"]!=s["source_classification"]: raise ValueError("record source contract")
  if not HEX64.fullmatch(r["attribution_body_sha256"]) or not HEX64.fullmatch(r["key_material_body_sha256"]): raise ValueError("digest")
  if r["expected_witness_key_count"]!=len(s["witness_vkeys"]) or r["witness_vkeys"]!=s["witness_vkeys"]: raise ValueError("vkey contract")
  obs=r["observed_witness_vkeys"]
  if not isinstance(obs,list) or obs!=sorted(obs) or len(obs)!=len(set(obs)) or not set(obs).issubset(set(s["witness_vkeys"])): raise ValueError("observed")
  all_exact=set(obs)==set(s["witness_vkeys"])
  if r["all_expected_vkeys_observed"] is not all_exact or not isinstance(r["registry_relation_observed"],bool) or not isinstance(r["operator_key_material_relation_observed"],bool): raise ValueError("flags")
  matched.update(obs)
  if r["registry_relation_observed"]: regrels.add(l)
  if r["operator_key_material_relation_observed"]: keyrels.add(l)
  if all_exact and r["registry_relation_observed"] and r["operator_key_material_relation_observed"]:
   labels.add(l); attrs.add(normalize_url(s["attribution_url"])); keysurfs.add(normalize_url(s["key_material_url"]))
  if l=="TrustFabric": tf=len(obs)
 if seen!=set(source): raise ValueError("incomplete records")
 strong=matched==pin_set and len(matched)==7 and len(labels)==6 and len(attrs)==6 and len(keysurfs)==6 and len(regrels)==6 and len(keyrels)==6
 vals={"matched_witness_key_count":len(matched),"public_operator_label_count":len(labels),"bound_attribution_surface_count":len(attrs),"bound_key_material_surface_count":len(keysurfs),"registry_relation_count":len(regrels),"operator_key_material_relation_count":len(keyrels)}
 for k,v in vals.items():
  if receipt[k]!=v: raise ValueError(k+" inflation")
 if receipt["observed_operator_labels"]!=sorted(labels) or receipt["observed_witness_vkeys"]!=sorted(matched) or receipt["trustfabric_pinned_key_count"]!=tf: raise ValueError("observed summary")
 if receipt["all_seven_public_operator_attributions_bound"] is not strong: raise ValueError("strong flag")
 if receipt["verdict"]!=(profile["strong_verdict"] if strong else profile["insufficient_verdict"]): raise ValueError("verdict")
 assurance="ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_THROUGH_CURRENT_REGISTRY_ATTRIBUTIONS_AND_OPERATOR_KEY_MATERIAL_SURFACES_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED" if strong else profile["insufficient_verdict"]
 if receipt["operator_attribution_assurance"]!=assurance: raise ValueError("assurance")
 if set(receipt["claims"])!=set(profile["always_false_claims"]) or any(v is not False for v in receipt["claims"].values()): raise ValueError("claim promotion")
 if receipt["automatic_action"] is not False or receipt["external_mutation_performed"] is not False: raise ValueError("action")
 if receipt["receipt_fingerprint_sha256"]!=fingerprint(receipt): raise ValueError("fingerprint")
 return True

def main():
 ap=argparse.ArgumentParser(); ap.add_argument("profile"); ap.add_argument("receipt"); a=ap.parse_args(); p=json.load(open(a.profile)); pp=json.load(open(p["predecessor_profile_path"])); pr=json.load(open(p["predecessor_receipt_path"])); pins=json.load(open(p["pin_set_profile_path"])); r=json.load(open(a.receipt)); validate(p,pp,pr,pins,r); print(r["verdict"]); print(r["receipt_fingerprint_sha256"])
if __name__=="__main__": main()
