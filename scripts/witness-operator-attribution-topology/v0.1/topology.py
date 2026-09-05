#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, re
from html.parser import HTMLParser
from urllib.parse import urlparse, urlsplit, urlunsplit

PROFILE_SCHEMA="urn:uu-aap:witness-operator-attribution-topology-profile:0.1"
RECEIPT_SCHEMA="urn:uu-aap:witness-operator-attribution-topology-receipt:0.1"
REGISTRY_CLASS="NETWORK_CURATED_OPERATOR_TABLE"
DIRECT_CLASS="OPERATOR_PUBLISHED_WITNESS_PAGE"
RELATIONS={"SAME_SURFACE","OPERATOR_PAGE_LINK"}
HEX40=re.compile(r"^[0-9a-f]{40}$"); HEX64=re.compile(r"^[0-9a-f]{64}$")

EXPECTED_TOPOLOGY={
"Mullvad VPN AB":("https://witness.stagemole.eu/about","https://witness.stagemole.eu/about","SAME_SURFACE",("witness.stagemole.eu+67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv",)),
"TrustFabric":("https://transparency.dev/witnesses","https://transparency.dev/witnesses","SAME_SURFACE",("transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM","staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL")),
"Florian Larysch":("https://remora.n621.de/","https://remora.n621.de/","SAME_SURFACE",("remora.n621.de+da77ade7+BOvN63jn/bLvkieywe8R6UYAtVtNbZpXh34x7onlmtw2",)),
"Geomys":("https://geomys.org/witness/navigli","https://navigli.sunlight.geomys.org/","OPERATOR_PAGE_LINK",("witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G",)),
"rgdd":("https://www.rgdd.se/poc-witness/about","https://www.rgdd.se/poc-witness/about","SAME_SURFACE",("rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG",)),
"Elias Rudberg":("https://witness1.smartit.nu/witness1/about.txt","https://witness1.smartit.nu/witness1/about.txt","SAME_SURFACE",("witness1.smartit.nu/witness1+a48c820f+BPSFWg9G6KPiO7QPryYO5Xq4oYJJ+kAvLKLSimDhoxMO",)),
}

def canonical(o): return json.dumps(o,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
def fingerprint(r):
 x=dict(r); x.pop("receipt_fingerprint_sha256",None); return hashlib.sha256(canonical(x)).hexdigest()
def _strict_keys(o,e,l):
 if set(o)!=set(e): raise ValueError(f"{l} closed-world keys mismatch")
def normalize_url(v):
 if not isinstance(v,str) or not v: raise ValueError("URL must be non-empty string")
 s=urlsplit(v)
 if s.scheme!="https" or not s.hostname: raise ValueError("URL must be explicit HTTPS")
 path=s.path.rstrip("/")
 return urlunsplit((s.scheme.lower(),s.netloc.lower(),path,s.query,""))

class TableParser(HTMLParser):
 def __init__(self): super().__init__(); self.rows=[]; self.row=None; self.hrefs=[]
 def handle_starttag(self,tag,attrs):
  tag=tag.lower()
  if tag=="tr": self.row={"text":[],"hrefs":[]}
  if tag=="a":
   h=dict(attrs).get("href")
   if h:
    self.hrefs.append(h)
    if self.row is not None: self.row["hrefs"].append(h)
 def handle_data(self,data):
  if self.row is not None:
   t=" ".join(data.split())
   if t: self.row["text"].append(t)
 def handle_endtag(self,tag):
  if tag.lower()=="tr" and self.row is not None:
   self.rows.append({"text":" ".join(self.row["text"]),"hrefs":list(self.row["hrefs"])}); self.row=None

def _parse_html(body):
 if not isinstance(body,(bytes,bytearray)) or not body: raise ValueError("HTML body unavailable or empty")
 try: text=bytes(body).decode("utf-8")
 except UnicodeDecodeError as e: raise ValueError("HTML must be UTF-8") from e
 p=TableParser(); p.feed(text); return p

def registry_relation_observed(body,label,url):
 p=_parse_html(body); target=normalize_url(url)
 for row in p.rows:
  if label not in row["text"]: continue
  for h in row["hrefs"]:
   try:
    if normalize_url(h)==target: return True
   except ValueError: pass
 return False

def operator_key_relation_observed(attribution_body, attribution_url, key_url, mode):
 a=normalize_url(attribution_url); k=normalize_url(key_url)
 if mode=="SAME_SURFACE": return a==k
 if mode!="OPERATOR_PAGE_LINK" or a==k: return False
 p=_parse_html(attribution_body)
 for h in p.hrefs:
  try:
   if normalize_url(h)==k: return True
  except ValueError: pass
 return False

def validate_profile(profile,pre_profile,pre_receipt,pin_profile):
 expected={"schema","tracking_issue","repository_predecessor_main","predecessor_profile_path","predecessor_profile_git_blob","predecessor_receipt_path","predecessor_receipt_git_blob","required_predecessor_receipt_fingerprint_sha256","required_predecessor_verdict","required_predecessor_matched_witness_key_count","required_predecessor_source_url_count","pin_set_profile_path","pin_set_profile_git_blob","registry","operators","required_operator_label_count","required_attribution_surface_count","required_key_material_surface_count","strong_verdict","insufficient_verdict","always_false_claims"}
 _strict_keys(profile,expected,"profile")
 if profile["schema"]!=PROFILE_SCHEMA or profile["tracking_issue"]!=941: raise ValueError("profile identity")
 for k in ("repository_predecessor_main","predecessor_profile_git_blob","predecessor_receipt_git_blob","pin_set_profile_git_blob"):
  if not HEX40.fullmatch(profile[k]): raise ValueError("git sha")
 if not HEX64.fullmatch(profile["required_predecessor_receipt_fingerprint_sha256"]): raise ValueError("fingerprint")
 if pre_profile.get("tracking_issue")!=939 or pre_receipt.get("tracking_issue")!=939: raise ValueError("predecessor identity")
 if pre_receipt.get("receipt_fingerprint_sha256")!=profile["required_predecessor_receipt_fingerprint_sha256"] or pre_receipt.get("verdict")!=profile["required_predecessor_verdict"]: raise ValueError("predecessor evidence")
 if pre_receipt.get("matched_witness_key_count")!=7 or profile["required_predecessor_matched_witness_key_count"]!=7 or pre_receipt.get("unique_source_url_count")!=6 or profile["required_predecessor_source_url_count"]!=6: raise ValueError("predecessor counts")
 if pre_receipt.get("all_seven_reobserved_in_one_bounded_run") is not True: raise ValueError("predecessor same-run")
 for c in ("witness_identity_proven","legal_operator_identity_proven","operator_independence_proven","all_witnesses_independent_proven","all_seven_currently_active_proven"):
  if pre_receipt.get("claims",{}).get(c) is not False: raise ValueError("predecessor nonclaim")
 pins=pin_profile.get("witness_vkeys")
 if not isinstance(pins,list) or len(pins)!=7 or len(set(pins))!=7: raise ValueError("pin set")
 pin_set=set(pins)
 if set(pre_receipt.get("observed_witness_vkeys",[]))!=pin_set: raise ValueError("predecessor pins")
 _strict_keys(profile["registry"],{"source_url","source_classification"},"registry")
 if normalize_url(profile["registry"]["source_url"])!=normalize_url("https://witness-network.org/witness-tables/") or profile["registry"]["source_classification"]!=REGISTRY_CLASS: raise ValueError("registry")
 if (profile["required_operator_label_count"],profile["required_attribution_surface_count"],profile["required_key_material_surface_count"])!=(6,6,6): raise ValueError("thresholds")
 if not isinstance(profile["operators"],list) or len(profile["operators"])!=6: raise ValueError("operators")
 labels=set(); attrs=set(); keysurfs=set(); vkeys=set(); actual={}
 for op in profile["operators"]:
  _strict_keys(op,{"operator_label","attribution_url","key_material_url","key_material_relation","source_classification","witness_vkeys"},"operator")
  label=op["operator_label"]
  if not label or label in labels: raise ValueError("label")
  labels.add(label); a=normalize_url(op["attribution_url"]); k=normalize_url(op["key_material_url"]); attrs.add(a); keysurfs.add(k)
  if op["source_classification"]!=DIRECT_CLASS or op["key_material_relation"] not in RELATIONS: raise ValueError("source contract")
  if op["key_material_relation"]=="SAME_SURFACE" and a!=k: raise ValueError("same-surface drift")
  if op["key_material_relation"]=="OPERATOR_PAGE_LINK" and a==k: raise ValueError("linked-surface drift")
  ov=op["witness_vkeys"]
  if not isinstance(ov,list) or not ov or len(ov)!=len(set(ov)): raise ValueError("vkeys")
  for v in ov:
   if v in vkeys or v not in pin_set: raise ValueError("vkey assignment")
   vkeys.add(v)
  actual[label]=(a,k,op["key_material_relation"],tuple(ov))
 expected_top={l:(normalize_url(a),normalize_url(k),m,tuple(vs)) for l,(a,k,m,vs) in EXPECTED_TOPOLOGY.items()}
 if actual!=expected_top or vkeys!=pin_set or len(labels)!=6 or len(attrs)!=6 or len(keysurfs)!=6: raise ValueError("topology drift")
 if len(actual["TrustFabric"][3])!=2 or any(len(vs)!=1 for l,(_,_,_,vs) in actual.items() if l!="TrustFabric"): raise ValueError("key convergence")
 claims=profile["always_false_claims"]
 mandatory={"witness_identity_proven","legal_operator_identity_proven","cryptographic_operator_identity_binding_proven","operator_control_proven","operator_independence_proven","all_witnesses_independent_proven","all_seven_currently_active_proven","global_non_equivocation_proven","c2pa_manifest_inclusion_proven","truth_certified","authority_created","automatic_remediation_triggered"}
 if len(claims)!=len(set(claims)) or not mandatory.issubset(set(claims)): raise ValueError("claim surface")
 return pin_set

def evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_body,source_bodies):
 pin_set=validate_profile(profile,pre_profile,pre_receipt,pin_profile)
 expected_urls={normalize_url(u) for op in profile["operators"] for u in (op["attribution_url"],op["key_material_url"])}
 provided={normalize_url(k):v for k,v in source_bodies.items()}
 if len(provided)!=len(source_bodies): raise ValueError("duplicate canonical source URL alias")
 if set(provided)!=expected_urls: raise ValueError("source map")
 if not registry_body: raise ValueError("registry")
 records=[]; matched=set(); bound_labels=set(); attrs=set(); keysurfs=set(); regrels=set(); keyrels=set()
 for op in profile["operators"]:
  a=normalize_url(op["attribution_url"]); k=normalize_url(op["key_material_url"]); ab=provided[a]; kb=provided[k]
  if not ab or not kb: raise ValueError("source body")
  observed=[v for v in op["witness_vkeys"] if v.encode() in kb]; matched.update(observed); all_exact=set(observed)==set(op["witness_vkeys"])
  rr=registry_relation_observed(registry_body,op["operator_label"],op["attribution_url"])
  kr=operator_key_relation_observed(ab,op["attribution_url"],op["key_material_url"],op["key_material_relation"])
  if rr: regrels.add(op["operator_label"])
  if kr: keyrels.add(op["operator_label"])
  if rr and kr and all_exact:
   bound_labels.add(op["operator_label"]); attrs.add(a); keysurfs.add(k)
  records.append({"operator_label":op["operator_label"],"attribution_url":op["attribution_url"],"attribution_host":urlparse(op["attribution_url"]).hostname,"key_material_url":op["key_material_url"],"key_material_host":urlparse(op["key_material_url"]).hostname,"key_material_relation":op["key_material_relation"],"source_classification":op["source_classification"],"attribution_body_sha256":hashlib.sha256(ab).hexdigest(),"key_material_body_sha256":hashlib.sha256(kb).hexdigest(),"expected_witness_key_count":len(op["witness_vkeys"]),"witness_vkeys":list(op["witness_vkeys"]),"observed_witness_vkeys":sorted(observed),"all_expected_vkeys_observed":all_exact,"registry_relation_observed":rr,"operator_key_material_relation_observed":kr})
 strong=matched==pin_set and len(matched)==7 and len(bound_labels)==6 and len(attrs)==6 and len(keysurfs)==6 and len(regrels)==6 and len(keyrels)==6
 verdict=profile["strong_verdict"] if strong else profile["insufficient_verdict"]
 assurance="ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_THROUGH_CURRENT_REGISTRY_ATTRIBUTIONS_AND_OPERATOR_KEY_MATERIAL_SURFACES_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED" if strong else profile["insufficient_verdict"]
 receipt={"schema":RECEIPT_SCHEMA,"tracking_issue":941,"predecessor":{"main_sha":profile["repository_predecessor_main"],"profile_git_blob":profile["predecessor_profile_git_blob"],"qualification_receipt_git_blob":profile["predecessor_receipt_git_blob"],"receipt_fingerprint_sha256":pre_receipt["receipt_fingerprint_sha256"],"verdict":pre_receipt["verdict"],"matched_witness_key_count":pre_receipt["matched_witness_key_count"],"unique_source_url_count":pre_receipt["unique_source_url_count"]},"registry":{"source_url":profile["registry"]["source_url"],"source_classification":profile["registry"]["source_classification"],"retrieved_body_sha256":hashlib.sha256(registry_body).hexdigest()},"operator_records":records,"matched_witness_key_count":len(matched),"public_operator_label_count":len(bound_labels),"bound_attribution_surface_count":len(attrs),"bound_key_material_surface_count":len(keysurfs),"registry_relation_count":len(regrels),"operator_key_material_relation_count":len(keyrels),"observed_operator_labels":sorted(bound_labels),"observed_witness_vkeys":sorted(matched),"trustfabric_pinned_key_count":len(next(r for r in records if r["operator_label"]=="TrustFabric")["observed_witness_vkeys"]),"all_seven_public_operator_attributions_bound":strong,"operator_attribution_assurance":assurance,"claims":{c:False for c in profile["always_false_claims"]},"automatic_action":False,"external_mutation_performed":False,"verdict":verdict}
 receipt["receipt_fingerprint_sha256"]=fingerprint(receipt); return receipt

def load_json(p): return json.loads(pathlib.Path(p).read_text())
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--profile",required=True); ap.add_argument("--registry-body",required=True); ap.add_argument("--source-map",required=True); a=ap.parse_args()
 p=load_json(a.profile); pp=load_json(p["predecessor_profile_path"]); pr=load_json(p["predecessor_receipt_path"]); pins=load_json(p["pin_set_profile_path"]); sm=load_json(a.source_map); bodies={u:pathlib.Path(f).read_bytes() for u,f in sm.items()}; reg=pathlib.Path(a.registry_body).read_bytes(); print(json.dumps(evaluate(p,pp,pr,pins,reg,bodies),indent=2,sort_keys=True))
if __name__=="__main__": main()
