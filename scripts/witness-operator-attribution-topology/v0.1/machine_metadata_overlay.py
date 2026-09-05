#!/usr/bin/env python3
import argparse, hashlib, json
from urllib.parse import urlsplit, urlunsplit

SCHEMA='urn:uu-aap:witness-operator-attribution-machine-overlay-receipt:0.1'
STRONG='ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED'
BASE_INCOMPLETE='INCOMPLETE_PUBLIC_OPERATOR_ATTRIBUTION_TOPOLOGY_FOR_ALL_SEVEN_PINNED_WITNESS_KEYS'
NAV='witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G'
MON='https://witness.navigli.skylight.geomys.org/'
SUB='https://witness.navigli.sunlight.geomys.org/'
META='https://witness.navigli.sunlight.geomys.org/witness.v0.json'
FALSE_CLAIMS={
'witness_identity_proven','legal_operator_identity_proven','cryptographic_operator_identity_binding_proven','operator_control_proven','operator_independence_proven','all_witnesses_independent_proven','all_seven_currently_active_proven','all_views_non_equivocating_proven','producer_non_equivocation_proven','global_non_equivocation_proven','complete_history_proven','all_manifests_submitted_proven','selective_submission_absent_proven','c2pa_manifest_inclusion_proven','trusted_time_proven','truth_certified','authority_created','canonical_branch_selected','malicious_behavior_proven','automatic_remediation_triggered'}

def norm(u):
    s=urlsplit(u)
    if s.scheme!='https' or not s.hostname or s.username or s.password or s.fragment: raise ValueError('unclean https URL')
    return urlunsplit((s.scheme.lower(),s.netloc.lower(),s.path.rstrip('/'),s.query,''))
def canon(o): return json.dumps(o,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def fp(r):
    x=dict(r); x.pop('receipt_fingerprint_sha256',None); return hashlib.sha256(canon(x)).hexdigest()
def load(p): return json.load(open(p,encoding='utf-8'))

def evaluate(profile, base, metadata_bytes):
    if profile.get('tracking_issue')!=941 or len(profile.get('operators',[]))!=6: raise ValueError('profile identity')
    if base.get('tracking_issue')!=941 or base.get('verdict') not in (BASE_INCOMPLETE,STRONG): raise ValueError('base receipt identity')
    if set(base.get('claims',{}))!=FALSE_CLAIMS or any(base['claims'].values()): raise ValueError('base claim promotion')
    if base.get('automatic_action') is not False or base.get('external_mutation_performed') is not False: raise ValueError('base side effect promotion')
    records=base.get('operator_records');
    if not isinstance(records,list) or len(records)!=6: raise ValueError('base operator records')
    by={r.get('operator_label'):r for r in records}
    expected={o['operator_label'] for o in profile['operators']}
    if set(by)!=expected: raise ValueError('base labels')
    if base.get('registry_relation_count')!=6 or base.get('operator_key_material_relation_count')!=6: raise ValueError('base relation coverage')
    for label,r in by.items():
        if r.get('registry_relation_observed') is not True or r.get('operator_key_material_relation_observed') is not True: raise ValueError('relation missing')
        if label!='Geomys' and r.get('all_expected_vkeys_observed') is not True: raise ValueError('non-Geomys key gap')
    g=by['Geomys']
    if norm(g.get('attribution_url'))!=norm('https://geomys.org/witness/navigli'): raise ValueError('Geomys attribution drift')
    if norm(g.get('key_material_url'))!=norm(MON): raise ValueError('Geomys v2 homepage drift')
    try: meta=json.loads(metadata_bytes.decode('utf-8'))
    except Exception as e: raise ValueError('metadata JSON') from e
    if not isinstance(meta,dict): raise ValueError('metadata object')
    keys=meta.get('verifier_keys')
    if not isinstance(keys,list) or not keys or any(not isinstance(k,str) or not k for k in keys) or len(keys)!=len(set(keys)): raise ValueError('metadata verifier_keys')
    if norm(meta.get('monitoring_url'))!=norm(MON): raise ValueError('metadata monitoring_url')
    if norm(meta.get('submission_url'))!=norm(SUB): raise ValueError('metadata submission_url')
    if NAV not in keys: raise ValueError('exact Navigli key absent from verifier_keys')
    # exact seven-pin set comes from bound profile, not from metadata extras
    pins=[]
    for o in profile['operators']: pins.extend(o['witness_vkeys'])
    if len(pins)!=7 or len(set(pins))!=7 or NAV not in pins: raise ValueError('profile pin topology')
    receipt={
      'schema':SCHEMA,'tracking_issue':941,
      'base_topology':{'receipt_fingerprint_sha256':base['receipt_fingerprint_sha256'],'verdict':base['verdict'],'matched_witness_key_count':base['matched_witness_key_count'],'registry_relation_count':6,'operator_key_material_relation_count':6},
      'geomys_machine_metadata':{'source_url':META,'retrieved_body_sha256':hashlib.sha256(metadata_bytes).hexdigest(),'monitoring_url':meta['monitoring_url'],'submission_url':meta['submission_url'],'exact_navigli_vkey_in_verifier_keys':True,'verifier_key_count':len(keys)},
      'matched_witness_key_count':7,'public_operator_label_count':6,'bound_attribution_surface_count':6,'bound_key_material_surface_count':6,'bound_bridge_surface_count':1,'registry_relation_count':6,'operator_key_material_relation_count':6,'witness_metadata_contract_count':1,'trustfabric_pinned_key_count':2,'all_seven_public_operator_attributions_bound':True,
      'claims':{c:False for c in sorted(FALSE_CLAIMS)},'automatic_action':False,'external_mutation_performed':False,'verdict':STRONG}
    receipt['receipt_fingerprint_sha256']=fp(receipt); return receipt

def validate(r):
    if r.get('schema')!=SCHEMA or r.get('tracking_issue')!=941 or r.get('verdict')!=STRONG: raise ValueError('receipt identity')
    if r.get('receipt_fingerprint_sha256')!=fp(r): raise ValueError('fingerprint')
    if set(r.get('claims',{}))!=FALSE_CLAIMS or any(r['claims'].values()): raise ValueError('claim promotion')
    expected={'matched_witness_key_count':7,'public_operator_label_count':6,'bound_attribution_surface_count':6,'bound_key_material_surface_count':6,'bound_bridge_surface_count':1,'registry_relation_count':6,'operator_key_material_relation_count':6,'witness_metadata_contract_count':1,'trustfabric_pinned_key_count':2}
    for k,v in expected.items():
        if r.get(k)!=v: raise ValueError('count drift '+k)
    if r.get('all_seven_public_operator_attributions_bound') is not True or r.get('automatic_action') is not False or r.get('external_mutation_performed') is not False: raise ValueError('boolean drift')
    g=r.get('geomys_machine_metadata',{})
    if norm(g.get('source_url'))!=norm(META) or norm(g.get('monitoring_url'))!=norm(MON) or norm(g.get('submission_url'))!=norm(SUB) or g.get('exact_navigli_vkey_in_verifier_keys') is not True: raise ValueError('metadata receipt drift')
    return True

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--profile',required=True); ap.add_argument('--base-receipt',required=True); ap.add_argument('--metadata',required=True); ap.add_argument('--validate')
    a=ap.parse_args()
    if a.validate:
        r=load(a.validate); validate(r); print(r['verdict']); print(r['receipt_fingerprint_sha256']); return
    r=evaluate(load(a.profile),load(a.base_receipt),open(a.metadata,'rb').read()); validate(r); print(json.dumps(r,indent=2,sort_keys=True))
if __name__=='__main__': main()
