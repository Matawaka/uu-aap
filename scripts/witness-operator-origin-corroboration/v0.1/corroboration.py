#!/usr/bin/env python3
import argparse, hashlib, html, json, re
from html.parser import HTMLParser
from urllib.parse import urlsplit

SCHEMA='urn:uu-aap:witness-operator-origin-corroboration-receipt:0.1'
PROFILE_SCHEMA='urn:uu-aap:witness-operator-origin-corroboration-profile:0.1'
TRACKING=944
PREDECESSOR_MAIN='66678fb27ce55a3e1bb1bc3bb2bbd6d419840520'
PREDECESSOR_TREE='6d17a25bba8ec1dc18612e0fbeb794cd240ca6ac'
PREDECESSOR_FP='d963ac516836e7dbc0760d273c70ca5861cc0717bdbc4fc23d4a62d5e1683d91'
PREDECESSOR_VERDICT='ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED'
FIVE='FIVE_OF_SIX_PUBLIC_OPERATOR_LABELS_CORROBORATED_BY_OPERATOR_ORIGIN_ATTRIBUTION_EVIDENCE_ONE_OPERATOR_ORIGIN_RELATION_NOT_ESTABLISHED'
ALL='ALL_SIX_PUBLIC_OPERATOR_LABELS_CORROBORATED_BY_OPERATOR_ORIGIN_ATTRIBUTION_EVIDENCE_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED'
INCOMPLETE='INCOMPLETE_OPERATOR_ORIGIN_ATTRIBUTION_CORROBORATION'
ALLOWED_CLASSES={'OPERATOR_PUBLISHED_WITNESS_PAGE','PUBLIC_PARTICIPATION_REQUEST_ATTRIBUTED_TO_OPERATOR'}
LABELS={'Mullvad VPN AB','TrustFabric','Florian Larysch','Geomys','rgdd','Elias Rudberg'}
FALSE_CLAIMS={'witness_identity_proven','legal_operator_identity_proven','cryptographic_operator_identity_binding_proven','operator_control_proven','operator_independence_proven','all_witnesses_independent_proven','all_seven_currently_active_proven','all_views_non_equivocating_proven','producer_non_equivocation_proven','global_non_equivocation_proven','complete_history_proven','all_manifests_submitted_proven','selective_submission_absent_proven','c2pa_manifest_inclusion_proven','trusted_time_proven','truth_certified','authority_created','canonical_branch_selected','malicious_behavior_proven','automatic_remediation_triggered'}
EXPECTED_SOURCE_URLS={
'https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/2025/11/',
'https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/message/VMKKURC6MCXUO42IEEDENGP4R5PVHWHZ/',
'https://transparency.dev/witnesses','https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/2025/10/','https://geomys.org/witness/navigli'}

class Text(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]
    def handle_data(self,d): self.parts.append(d)

def normalize_body(b):
    s=b.decode('utf-8','replace')
    p=Text(); p.feed(s)
    t=html.unescape(' '.join(p.parts))
    return re.sub(r'\s+',' ',t).strip()

def canon(o): return json.dumps(o,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def fp(r):
    x=dict(r); x.pop('receipt_fingerprint_sha256',None); return hashlib.sha256(canon(x)).hexdigest()
def load(p): return json.load(open(p,encoding='utf-8'))

def clean_https(u):
    if not isinstance(u,str): return False
    s=urlsplit(u)
    return s.scheme=='https' and bool(s.hostname) and not s.username and not s.password and not s.fragment

def validate_profile(p):
    if p.get('schema')!=PROFILE_SCHEMA or p.get('tracking_issue')!=TRACKING: raise ValueError('profile identity')
    if p.get('repository_predecessor_main')!=PREDECESSOR_MAIN or p.get('repository_predecessor_tree')!=PREDECESSOR_TREE: raise ValueError('predecessor main/tree')
    if p.get('predecessor_profile_git_blob')!='9e05ec58e84c3a77a91739a875ac899529a55dfd' or p.get('predecessor_receipt_git_blob')!='fae2dfd9461fe699ec415615adfb537617a502fd': raise ValueError('predecessor blob binding')
    if p.get('required_predecessor_receipt_fingerprint_sha256')!=PREDECESSOR_FP or p.get('required_predecessor_verdict')!=PREDECESSOR_VERDICT: raise ValueError('predecessor receipt binding')
    ops=p.get('operators')
    if not isinstance(ops,list) or len(ops)!=6 or {x.get('operator_label') for x in ops}!=LABELS: raise ValueError('operator topology')
    if len([x.get('operator_label') for x in ops])!=len(set(x.get('operator_label') for x in ops)): raise ValueError('duplicate labels')
    seen_urls=set()
    for o in ops:
        if o.get('corroboration_rule')!='ALL_SOURCES' or not clean_https(o.get('about_url')): raise ValueError('operator rule/url')
        if not isinstance(o.get('accepted_vkeys'),list) or not o['accepted_vkeys'] or len(o['accepted_vkeys'])!=len(set(o['accepted_vkeys'])): raise ValueError('operator vkeys')
        sources=o.get('sources')
        if not isinstance(sources,list): raise ValueError('sources type')
        if o['operator_label']=='rgdd' and sources!=[]: raise ValueError('rgdd source not admitted in v0.1')
        for s in sources:
            u=s.get('source_url'); c=s.get('source_classification')
            if u not in EXPECTED_SOURCE_URLS or not clean_https(u): raise ValueError('source allowlist')
            if c not in ALLOWED_CLASSES: raise ValueError('source class')
            fr=s.get('required_fragments')
            if not isinstance(fr,list) or not fr or any(not isinstance(x,str) or not x for x in fr): raise ValueError('source fragments')
            if bool(s.get('bounded_start')) != bool(s.get('bounded_end')): raise ValueError('partial bounded segment')
            seen_urls.add(u)
    if seen_urls!=EXPECTED_SOURCE_URLS: raise ValueError('closed source set')
    if p.get('expected_first_corroborated_operator_label_count')!=5 or p.get('expected_first_missing_operator_labels')!=['rgdd']: raise ValueError('expected first frontier')
    if set(p.get('always_false_claims',[]))!=FALSE_CLAIMS: raise ValueError('false claim set')
    return True

def validate_predecessor(r):
    if r.get('schema')!='urn:uu-aap:witness-operator-attribution-machine-overlay-receipt:0.1' or r.get('tracking_issue')!=941: raise ValueError('predecessor receipt identity')
    if r.get('receipt_fingerprint_sha256')!=PREDECESSOR_FP or r.get('verdict')!=PREDECESSOR_VERDICT: raise ValueError('predecessor verdict/fingerprint')
    if r.get('public_operator_label_count')!=6 or r.get('matched_witness_key_count')!=7: raise ValueError('predecessor topology count')
    if set(r.get('claims',{}))!=FALSE_CLAIMS or any(r['claims'].values()): raise ValueError('predecessor claim promotion')
    if r.get('automatic_action') is not False or r.get('external_mutation_performed') is not False: raise ValueError('predecessor side effect promotion')
    return True

def source_segment(spec, body):
    t=normalize_body(body)
    start=spec.get('bounded_start'); end=spec.get('bounded_end')
    if start:
        a=t.find(start)
        if a<0: return None
        b=t.find(end,a+len(start))
        if b<0: return None
        t=t[a:b]
    return t

def source_result(spec, body):
    seg=source_segment(spec,body)
    ok=seg is not None and all(f in seg for f in spec['required_fragments'])
    return {'source_url':spec['source_url'],'source_classification':spec['source_classification'],'retrieved_body_sha256':hashlib.sha256(body).hexdigest(),'bounded_segment_observed':seg is not None,'required_fragments_observed':bool(ok)}

def evaluate(profile, predecessor, source_map):
    validate_profile(profile); validate_predecessor(predecessor)
    if not isinstance(source_map,dict) or set(source_map)!=EXPECTED_SOURCE_URLS: raise ValueError('source map set')
    records=[]
    for o in profile['operators']:
        ss=[]
        for spec in o['sources']:
            b=source_map.get(spec['source_url'])
            if not isinstance(b,(bytes,bytearray)) or not b: raise ValueError('missing/empty source '+spec['source_url'])
            ss.append(source_result(spec,bytes(b)))
        observed=bool(ss) and all(x['required_fragments_observed'] for x in ss)
        records.append({'operator_label':o['operator_label'],'witness_name':o['witness_name'],'about_url':o['about_url'],'accepted_vkey_count':len(o['accepted_vkeys']),'corroboration_source_count':len(ss),'operator_origin_relation_corroborated':observed,'source_records':ss})
    corroborated=sorted(r['operator_label'] for r in records if r['operator_origin_relation_corroborated'])
    missing=sorted(LABELS-set(corroborated))
    n=len(corroborated)
    verdict=ALL if n==6 else FIVE if n==5 else INCOMPLETE
    receipt={'schema':SCHEMA,'tracking_issue':TRACKING,'repository_predecessor_main':PREDECESSOR_MAIN,'repository_predecessor_tree':PREDECESSOR_TREE,
      'predecessor':{'receipt_fingerprint_sha256':PREDECESSOR_FP,'verdict':PREDECESSOR_VERDICT,'public_operator_label_count':6,'matched_witness_key_count':7},
      'operator_records':records,'corroborated_operator_labels':corroborated,'missing_operator_labels':missing,'corroborated_operator_label_count':n,'public_operator_label_count':6,
      'network_curated_table_counted_as_operator_origin_evidence':False,'claims':{c:False for c in sorted(FALSE_CLAIMS)},'automatic_action':False,'external_mutation_performed':False,'verdict':verdict}
    receipt['receipt_fingerprint_sha256']=fp(receipt)
    return receipt

def validate_receipt(r):
    if r.get('schema')!=SCHEMA or r.get('tracking_issue')!=TRACKING or r.get('repository_predecessor_main')!=PREDECESSOR_MAIN or r.get('repository_predecessor_tree')!=PREDECESSOR_TREE: raise ValueError('receipt identity')
    if r.get('receipt_fingerprint_sha256')!=fp(r): raise ValueError('fingerprint')
    p=r.get('predecessor',{})
    if p.get('receipt_fingerprint_sha256')!=PREDECESSOR_FP or p.get('verdict')!=PREDECESSOR_VERDICT or p.get('public_operator_label_count')!=6 or p.get('matched_witness_key_count')!=7: raise ValueError('predecessor binding')
    records=r.get('operator_records')
    if not isinstance(records,list) or len(records)!=6 or {x.get('operator_label') for x in records}!=LABELS: raise ValueError('record topology')
    if len([x['operator_label'] for x in records])!=len(set(x['operator_label'] for x in records)): raise ValueError('record duplication')
    actual=sorted(x['operator_label'] for x in records if x.get('operator_origin_relation_corroborated') is True)
    missing=sorted(LABELS-set(actual))
    if r.get('corroborated_operator_labels')!=actual or r.get('missing_operator_labels')!=missing or r.get('corroborated_operator_label_count')!=len(actual) or r.get('public_operator_label_count')!=6: raise ValueError('count/list drift')
    expected=ALL if len(actual)==6 else FIVE if len(actual)==5 else INCOMPLETE
    if r.get('verdict')!=expected: raise ValueError('verdict promotion')
    if r.get('network_curated_table_counted_as_operator_origin_evidence') is not False: raise ValueError('curated table promotion')
    if set(r.get('claims',{}))!=FALSE_CLAIMS or any(r['claims'].values()): raise ValueError('claim promotion')
    if r.get('automatic_action') is not False or r.get('external_mutation_performed') is not False: raise ValueError('side effect promotion')
    return True

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--profile'); ap.add_argument('--predecessor'); ap.add_argument('--source-map'); ap.add_argument('--validate')
    a=ap.parse_args()
    if a.validate:
        r=load(a.validate); validate_receipt(r); print(r['verdict']); print(r['receipt_fingerprint_sha256']); return
    if not (a.profile and a.predecessor and a.source_map): ap.error('profile, predecessor, and source-map are required')
    smj=load(a.source_map); sm={u:open(p,'rb').read() for u,p in smj.items()}
    r=evaluate(load(a.profile),load(a.predecessor),sm); validate_receipt(r); print(json.dumps(r,indent=2,sort_keys=True))
if __name__=='__main__': main()
