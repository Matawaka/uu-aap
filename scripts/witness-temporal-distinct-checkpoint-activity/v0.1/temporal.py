#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, importlib.util, json
from pathlib import Path

SCHEMA='urn:uu-aap:witness-temporal-distinct-checkpoint-activity-receipt:0.1'
PSCHEMA='urn:uu-aap:witness-temporal-distinct-checkpoint-activity-profile:0.1'
PREDSCHEMA='urn:uu-aap:witness-current-checkpoint-activity-receipt:0.1'
MAIN='f5e08ebcb2e767250fac5584a848bcc9e2b8dfd9'; TREE='4cc64bb081319b6aee5a3bd332574ef05ac559c0'
PBL='0fa00ac9c3bec86debe7c3ffe96f581f38e3c9e8'; RBL='bb0adafd4c5eb7a6a0d43df059d4296d73e6d7c0'; CBL='518bc61f4db936031b911e392eb6fe053dc03437'
PFP='61fac79b7c121bcfba0d38fd6dd4a42df5147f709577cc9ce6452f0af1d61efe'
PVER='ALL_SEVEN_PINNED_WITNESS_KEYS_CRYPTOGRAPHICALLY_OBSERVED_SIGNING_ONE_FRESH_CURRENT_CHECKPOINT_CONTINUOUS_LIVENESS_NOT_ESTABLISHED'
ORIGIN='markovianprotocol.com/log'; SIZE=7838;
LOG='markovianprotocol.com/log+0302c6c8+ATkpOWo95UuEiW2EhNZAol4f0CS8hMluJfPcTSzrr03v'
PINS=[
'witness.stagemole.eu+67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv',
'transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM',
'staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL',
'rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG',
'witness1.smartit.nu/witness1+a48c820f+BPSFWg9G6KPiO7QPryYO5Xq4oYJJ+kAvLKLSimDhoxMO',
'remora.n621.de+da77ade7+BOvN63jn/bLvkieywe8R6UYAtVtNbZpXh34x7onlmtw2',
'witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G']
ROOT='+BTr4xhWiF31p14hUfaZI+8PE20qXptMgncNfqnZ5VE='
CPHASH='5f4d3f7c0f4e7b6b6849e278436f0a2269670536986a80d0d43f01e2fb358432'; BODYHASH='f79f192495304307362c503548ec8bb9ff97a9d4153d10251c97e3eb0c859d76'
STRONG='ALL_SEVEN_PINNED_WITNESS_KEYS_CRYPTOGRAPHICALLY_OBSERVED_SIGNING_TWO_DISTINCT_APPEND_ONLY_RELATED_CHECKPOINT_STATES_REPEATED_ACTIVITY_ESTABLISHED_CONTINUOUS_AVAILABILITY_NOT_ESTABLISHED'
QUORUM='QUORUM_MANY_PINNED_WITNESS_KEYS_OBSERVED_ON_DISTINCT_APPEND_ONLY_RELATED_SUCCESSOR_CHECKPOINT_REPEATED_ACTIVITY_PARTIAL'
SAME='NO_DISTINCT_SUCCESSOR_CHECKPOINT_OBSERVED'; FAIL='DISTINCT_SUCCESSOR_CHECKPOINT_AUTHENTICATION_OR_CONSISTENCY_FAILED'; INSUFF='INSUFFICIENT_DISTINCT_SUCCESSOR_PINNED_WITNESS_ACTIVITY'; UNAV='EXTERNAL_EVIDENCE_UNAVAILABLE'
FALSE=set('continuous_witness_liveness_proven continuous_witness_availability_proven all_seven_currently_active_proven witness_identity_proven legal_operator_identity_proven cryptographic_operator_identity_binding_proven operator_control_proven operator_independence_proven all_witnesses_independent_proven all_views_non_equivocating_proven producer_non_equivocation_proven global_non_equivocation_proven complete_history_proven all_manifests_submitted_proven selective_submission_absent_proven c2pa_manifest_inclusion_proven trusted_time_proven truth_certified authority_created canonical_branch_selected malicious_behavior_proven automatic_remediation_triggered'.split())

def bad(s): raise ValueError(s)
def canon(x): return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def h256(b): return hashlib.sha256(b).hexdigest()
def ghash(b): return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def rootbytes():
    b=base64.b64decode(ROOT,validate=True)
    if len(b)!=32: bad('baseline root shape')
    return b
def wname(v):
    try: return v.split('+',2)[0]
    except Exception: bad('vkey shape')

def vp(p):
    if p.get('schema')!=PSCHEMA or p.get('tracking_issue')!=948: bad('profile identity drift')
    exact={
      'repository_predecessor_main':MAIN,'repository_predecessor_tree':TREE,
      'predecessor_profile_path':'scripts/witness-current-checkpoint-activity/v0.1/profile.json','predecessor_profile_git_blob':PBL,
      'predecessor_receipt_path':'scripts/witness-current-checkpoint-activity/v0.1/qualification-receipt.json','predecessor_receipt_git_blob':RBL,
      'required_predecessor_receipt_fingerprint_sha256':PFP,'required_predecessor_verdict':PVER,
      'crypto_reference_path':'scripts/anchored-witnessed-consistency-pilot/v0.1/pilot.py','crypto_reference_git_blob':CBL,
      'checkpoint_url':'https://log.markovianprotocol.com/checkpoint','consistency_url_template':'https://log.markovianprotocol.com/consistency?old={from_size}&new={to_size}',
      'required_origin':ORIGIN,'quorum_min':4,'strong_verdict':STRONG,'quorum_verdict':QUORUM,'same_checkpoint_verdict':SAME,
      'authentication_or_consistency_failed_verdict':FAIL,'insufficient_verdict':INSUFF}
    for k,v in exact.items():
        if p.get(k)!=v: bad('profile drift: '+k)
    if p.get('baseline_checkpoint')!={'tree_size':SIZE,'root_b64':ROOT,'checkpoint_sha256':CPHASH,'signed_body_sha256':BODYHASH}: bad('baseline drift')
    pins=p.get('witness_vkeys',[])
    if p.get('log_vkey')!=LOG or pins!=PINS: bad('exact log/witness pin set drift')
    if len(pins)!=7 or len(set(pins))!=7 or len({wname(x) for x in pins})!=7: bad('seven unique pins required')
    if set(p.get('always_false_claims',[]))!=FALSE: bad('false-claim set drift')

def vpred(r,p):
    if r.get('schema')!=PREDSCHEMA or r.get('tracking_issue')!=946 or r.get('receipt_fingerprint_sha256')!=PFP or r.get('verdict')!=PVER: bad('#947 receipt identity drift')
    c=r.get('checkpoint',{}); a=r.get('activity',{})
    if (c.get('origin'),c.get('tree_size'),c.get('root_b64'),c.get('checkpoint_body_sha256'),c.get('signed_body_sha256'),c.get('log_signature_verified'))!=(ORIGIN,SIZE,ROOT,CPHASH,BODYHASH,True): bad('#947 checkpoint drift')
    if a.get('verified_pinned_witness_count')!=7 or a.get('all_seven_signed_fetched_current_checkpoint') is not True or set(a.get('verified_pinned_witness_vkeys',[]))!=set(p['witness_vkeys']): bad('#947 pin activity drift')
    if any(r.get('claims',{}).values()) or r.get('automatic_action') is not False or r.get('external_mutation_performed') is not False: bad('#947 semantic/effect promotion')

def bind(root,p):
    for path,sha in [(p['predecessor_profile_path'],PBL),(p['predecessor_receipt_path'],RBL),(p['crypto_reference_path'],CBL)]:
        b=(root/path).read_bytes()
        if ghash(b)!=sha: bad('Git blob drift: '+path)

def crypto(root,p):
    path=root/p['crypto_reference_path']; b=path.read_bytes()
    if ghash(b)!=CBL: bad('#934 crypto blob drift')
    s=importlib.util.spec_from_file_location('accepted934',path)
    if not s or not s.loader: bad('cannot load #934 crypto')
    m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
    for n in 'parse_checkpoint verify_log_signature verify_witness_cosignatures parse_consistency_proof verify_consistency parse_log_vkey'.split():
        if not hasattr(m,n): bad('#934 crypto API drift: '+n)
    return m

def base(p,verdict):
    return {'schema':SCHEMA,'tracking_issue':948,'repository_predecessor_main':MAIN,'repository_predecessor_tree':TREE,'predecessor_receipt_fingerprint_sha256':PFP,'baseline_checkpoint':dict(p['baseline_checkpoint']),'claims':{k:False for k in p['always_false_claims']},'automatic_action':False,'external_mutation_performed':False,'verdict':verdict}
def finish(r): r['receipt_fingerprint_sha256']=h256(canon(r)); return r

def unavailable(p,msg):
    r=base(p,UNAV); r['successor_checkpoint']=None; r['consistency']={'requested':False,'verified':False,'proof_node_count':0,'proof_text_sha256':None}
    r['temporal_activity']={'distinct_successor_checkpoint_observed':False,'append_only_relation_verified':False,'verified_pinned_witness_count':0,'verified_pinned_witness_names':[],'verified_pinned_witness_vkeys':[],'invalid_pinned_witness_signatures':[],'unknown_cosigner_names':[],'skipped_non_ed25519_cosignature_blobs':0,'repeated_activity_established':False,'same_exact_pins_observed_across_two_distinct_states':False,'state_ordering_basis':'NOT_ESTABLISHED','external_evidence_error':msg[:500]}
    return finish(r)

def evaluate(p,pred,cp,prooftext,m):
    vp(p); vpred(pred,p); body,origin,size,root,sigs=m.parse_checkpoint(cp)
    if origin!=ORIGIN: bad('successor origin mismatch')
    rb64=base64.b64encode(root).decode(); ch=h256(cp); bh=h256(body); same=size==SIZE and rb64==ROOT and bh==BODYHASH
    advanced=size>SIZE; rdiff=rb64!=ROOT; bdiff=ch!=CPHASH; shape=advanced and rdiff and bdiff
    lname,_,_=m.parse_log_vkey(p['log_vkey']); logok=bool(m.verify_log_signature(body,sigs,p['log_vkey'])); w=m.verify_witness_cosignatures(body,sigs,p['witness_vkeys'],lname)
    names=sorted(w['verified']); byname={wname(v):v for v in p['witness_vkeys']}; vkeys=[byname[n] for n in names if n in byname]; count=len(names); invalid=w['invalid']
    requested=advanced; nodes=[]; perr=None; cok=False
    if requested:
        try: nodes=m.parse_consistency_proof(prooftext); cok=bool(m.verify_consistency(SIZE,size,rootbytes(),root,nodes))
        except ValueError as e: perr=str(e)
    auth=logok and not invalid; repeated=shape and auth and cok and count>=p['quorum_min']; all7=repeated and count==7 and set(vkeys)==set(p['witness_vkeys'])
    verdict=SAME if same else (FAIL if not shape or not auth or not cok else (STRONG if all7 else (QUORUM if count>=p['quorum_min'] else INSUFF)))
    r=base(p,verdict)
    r['successor_checkpoint']={'source_url':p['checkpoint_url'],'origin':origin,'tree_size':size,'root_b64':rb64,'checkpoint_sha256':ch,'signed_body_sha256':bh,'log_signature_verified':logok,'tree_size_advanced':advanced,'root_distinct_from_baseline':rdiff,'checkpoint_bytes_distinct_from_baseline':bdiff}
    r['consistency']={'requested':requested,'old_size':SIZE,'new_size':size,'proof_node_count':len(nodes),'proof_text_sha256':h256(prooftext.encode()) if requested else None,'proof_parse_error':perr,'verified':cok}
    r['temporal_activity']={'distinct_successor_checkpoint_observed':shape,'append_only_relation_verified':cok,'verified_pinned_witness_count':count,'verified_pinned_witness_names':names,'verified_pinned_witness_vkeys':vkeys,'invalid_pinned_witness_signatures':invalid,'unknown_cosigner_names':w['unknown'],'skipped_non_ed25519_cosignature_blobs':w['skipped_non_ed25519'],'newest_verified_cosignature_timestamp':w['newest_verified_timestamp'],'repeated_activity_established':repeated,'same_exact_pins_observed_across_two_distinct_states':all7,'state_ordering_basis':'MERKLE_APPEND_ONLY_CONSISTENCY_PROOF' if cok else 'NOT_ESTABLISHED','temporal_scope':'TWO_DISTINCT_CRYPTOGRAPHICALLY_ORDERED_CHECKPOINT_STATES_NO_CONTINUOUS_OR_TRUSTED_TIME_CLAIM' if repeated else 'NO_QUALIFYING_TEMPORAL_COMPOSITION'}
    return finish(r)

def fp(r):
    x=dict(r); x.pop('receipt_fingerprint_sha256',None); return h256(canon(x))
def vr(r,p):
    vp(p)
    if r.get('schema')!=SCHEMA or r.get('tracking_issue')!=948 or r.get('repository_predecessor_main')!=MAIN or r.get('repository_predecessor_tree')!=TREE or r.get('predecessor_receipt_fingerprint_sha256')!=PFP or r.get('baseline_checkpoint')!=p['baseline_checkpoint']: bad('receipt binding drift')
    if set(r.get('claims',{}))!=FALSE or any(r.get('claims',{}).values()) or r.get('automatic_action') is not False or r.get('external_mutation_performed') is not False: bad('receipt claim/effect promotion')
    if r.get('receipt_fingerprint_sha256')!=fp(r): bad('receipt fingerprint mismatch')
    if r.get('verdict') not in {STRONG,QUORUM,SAME,FAIL,INSUFF,UNAV}: bad('receipt verdict drift')
    t=r.get('temporal_activity',{}); n=t.get('verified_pinned_witness_count',0)
    if n>7: bad('witness count inflation')
    if t.get('repeated_activity_established') and not(t.get('distinct_successor_checkpoint_observed') and t.get('append_only_relation_verified')): bad('repeated activity promotion')
    if t.get('same_exact_pins_observed_across_two_distinct_states') and not(n==7 and t.get('repeated_activity_established')): bad('all-seven temporal promotion')
    if r['verdict']==STRONG and not(n==7 and t.get('repeated_activity_established') is True and t.get('same_exact_pins_observed_across_two_distinct_states') is True): bad('strong verdict mismatch')
    if r['verdict']==SAME and t.get('distinct_successor_checkpoint_observed') is not False: bad('same-state mismatch')
    if r['claims']['continuous_witness_liveness_proven'] is not False or r['claims']['continuous_witness_availability_proven'] is not False or r['claims']['trusted_time_proven'] is not False or r['claims']['global_non_equivocation_proven'] is not False: bad('semantic promotion')
def load(p): return json.loads(Path(p).read_text())
def emit(path,r):
    s=json.dumps(r,indent=2,sort_keys=True)+'\n'
    if path: Path(path).write_text(s)
    print(s,end='')

# Compatibility names are kept local to this package's hostile harness.
AUTH_OR_CONSISTENCY_FAILED=FAIL; INSUFFICIENT=INSUFF; EXTERNAL_UNAVAILABLE=UNAV
BASELINE_SIZE=SIZE; BASELINE_ROOT_B64=ROOT; BASELINE_CHECKPOINT_SHA256=CPHASH; BASELINE_SIGNED_BODY_SHA256=BODYHASH
EXPECTED_ACTIVITY_FP=PFP; EXPECTED_ACTIVITY_VERDICT=PVER; EXPECTED_CRYPTO_BLOB=CBL; EXPECTED_ORIGIN=ORIGIN
FALSE_CLAIMS=FALSE; PREDECESSOR_SCHEMA=PREDSCHEMA
validate_profile=vp; validate_predecessor=vpred; validate_receipt=vr; external_unavailable_receipt=unavailable
fingerprint_without_field=fp; git_blob_sha1=ghash; witness_name=wname; load_crypto=crypto
def decode_root(_text=None): return rootbytes()
def require_git_blob(root,rel,expected):
    b=(Path(root)/rel).read_bytes()
    if ghash(b)!=expected: bad('Git blob drift: '+rel)
    return b

def main():
    a=argparse.ArgumentParser(); a.add_argument('--profile',required=True); a.add_argument('--predecessor-receipt'); a.add_argument('--checkpoint'); a.add_argument('--consistency'); a.add_argument('--repo-root',default='.'); a.add_argument('--output'); a.add_argument('--external-error'); a.add_argument('--validate-receipt'); x=a.parse_args()
    try:
        p=load(x.profile); vp(p); rr=Path(x.repo_root); bind(rr,p)
        if x.validate_receipt: vr(load(x.validate_receipt),p); print('TEMPORAL_DISTINCT_RECEIPT_VALID'); return 0
        if not x.predecessor_receipt: bad('--predecessor-receipt required')
        pred=load(x.predecessor_receipt); vpred(pred,p)
        if x.external_error: r=unavailable(p,x.external_error); emit(x.output,r); return 2
        if not x.checkpoint: bad('--checkpoint required')
        r=evaluate(p,pred,Path(x.checkpoint).read_bytes(),Path(x.consistency).read_text() if x.consistency else '',crypto(rr,p)); vr(r,p); emit(x.output,r); return 0 if r['verdict']==STRONG else 2
    except (OSError,json.JSONDecodeError,ValueError) as e: print('TEMPORAL_DISTINCT_CHECKPOINT_FAIL_CLOSED:',e); return 1
if __name__=='__main__': raise SystemExit(main())
