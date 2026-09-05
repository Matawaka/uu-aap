#!/usr/bin/env python3
from __future__ import annotations
import base64, copy, importlib.util, json, pathlib
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

D=pathlib.Path(__file__).parent
S=importlib.util.spec_from_file_location('a',D/'activity.py'); a=importlib.util.module_from_spec(S); S.loader.exec_module(a)
P=json.load(open(D/'profile.json',encoding='utf-8'))
checks=0

def ok(cond,msg='check'):
    global checks
    assert cond,msg; checks+=1

def raises(fn):
    global checks
    try: fn()
    except ValueError: checks+=1; return
    raise AssertionError('expected ValueError')

def pred():
    return {
      'schema':a.PREDECESSOR_SCHEMA,'tracking_issue':944,'receipt_fingerprint_sha256':a.EXPECTED_PREDECESSOR_FP,
      'verdict':a.EXPECTED_PREDECESSOR_VERDICT,'corroborated_operator_label_count':5,'public_operator_label_count':6,
      'missing_operator_labels':['rgdd'],'network_curated_table_counted_as_operator_origin_evidence':False,
      'claims':{'x':False},'automatic_action':False,'external_mutation_performed':False
    }

def vk(name,priv,prefix):
    pub=priv.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw); raw=bytes([prefix])+pub
    kid=__import__('hashlib').sha256(name.encode()+b'\n'+bytes([prefix])+pub).digest()[:4]
    return f"{name}+deadbeef+{base64.b64encode(raw).decode().rstrip('=')}",kid

def checkpoint(n=7,bad_witness=None,duplicate=False,unknown=False):
    logp=Ed25519PrivateKey.generate(); lv,lid=vk('log.test',logp,1)
    w=[]
    for i in range(7):
        p=Ed25519PrivateKey.generate(); v,k=vk(f'w{i}',p,4); w.append((p,v,k))
    body=b'markovianprotocol.com/log\n8000\n'+base64.b64encode(b'R'*32)+b'\n'
    lines=[]; lines.append('— log.test '+base64.b64encode(lid+logp.sign(body)).decode().rstrip('='))
    ts=123456
    for i,(p,v,k) in enumerate(w[:n]):
        msg=b'cosignature/v1\ntime '+str(ts+i).encode()+b'\n'+body
        sig=p.sign(msg)
        if bad_witness==i: sig=bytes([sig[0]^1])+sig[1:]
        raw=k+(ts+i).to_bytes(8,'big')+sig
        lines.append('— w%d '%i+base64.b64encode(raw).decode().rstrip('='))
        if duplicate and i==0: lines.append(lines[-1])
    if unknown: lines.append('— unknown '+base64.b64encode(b'Z'*76).decode().rstrip('='))
    return body+b'\n'+('\n'.join(lines)+'\n').encode(), lv, [x[1] for x in w]

# Exact profile and predecessor boundaries
a.validate_profile(P); checks+=1
a.validate_predecessor(pred()); checks+=1
for field,value in [('tracking_issue',947),('repository_predecessor_main','x'),('repository_predecessor_tree','x'),('predecessor_profile_git_blob','x'),('predecessor_receipt_git_blob','x'),('required_predecessor_receipt_fingerprint_sha256','x'),('required_predecessor_verdict','x'),('pin_profile_git_blob','x'),('crypto_reference_git_blob','x'),('checkpoint_url','http://x'),('required_origin','x'),('minimum_tree_size',1),('quorum_min',3),('log_vkey','x')]:
    q=copy.deepcopy(P); q[field]=value; raises(lambda q=q:a.validate_profile(q))
q=copy.deepcopy(P); q['witness_vkeys']=q['witness_vkeys'][:-1]; raises(lambda:a.validate_profile(q))
q=copy.deepcopy(P); q['always_false_claims']=q['always_false_claims'][:-1]; raises(lambda:a.validate_profile(q))
for field,value in [('schema','x'),('tracking_issue',1),('receipt_fingerprint_sha256','x'),('verdict','x'),('corroborated_operator_label_count',6),('public_operator_label_count',5),('missing_operator_labels',[])]:
    r=pred(); r[field]=value; raises(lambda r=r:a.validate_predecessor(r))
r=pred(); r['network_curated_table_counted_as_operator_origin_evidence']=True; raises(lambda:a.validate_predecessor(r))
r=pred(); r['claims']={'x':True}; raises(lambda:a.validate_predecessor(r))

# Real crypto behavior with synthetic keys
cp,lv,wv=checkpoint(7); body,origin,size,root,sigs=a.parse_checkpoint(cp); ok(origin==a.EXPECTED_ORIGIN); ok(size==8000); ok(len(root)==32); ok(a.verify_log(body,sigs,lv))
wr=a.verify_witnesses(body,sigs,wv,'log.test'); ok(len(wr['verified_names'])==7); ok(not wr['invalid'])
cp2,lv2,wv2=checkpoint(7,bad_witness=3); b2,_,_,_,s2=a.parse_checkpoint(cp2); wr2=a.verify_witnesses(b2,s2,wv2,'log.test'); ok(len(wr2['verified_names'])==6); ok(wr2['invalid'][0]['name']=='w3')
cp3,lv3,wv3=checkpoint(4,duplicate=True,unknown=True); b3,_,_,_,s3=a.parse_checkpoint(cp3); wr3=a.verify_witnesses(b3,s3,wv3,'log.test'); ok(len(wr3['verified_names'])==4); ok(wr3['unknown']==['unknown'])
raises(lambda:a.parse_checkpoint(b'no signed section'))

# Evaluator classification using synthetic valid policy (validation intentionally bypassed)
def synthetic(n,bad=None):
    cp,lv,wv=checkpoint(n,bad_witness=bad); p=copy.deepcopy(P); p['log_vkey']=lv; p['witness_vkeys']=wv; return p,cp
p,cp=synthetic(7); r=a.evaluate_validated(p,cp); ok(r['verdict']==a.ALL_SEVEN); ok(r['activity']['all_seven_signed_fetched_current_checkpoint']); ok(not any(r['claims'].values()))
p,cp=synthetic(5); r=a.evaluate_validated(p,cp); ok(r['verdict']==a.QUORUM); ok(r['activity']['verified_pinned_witness_count']==5)
p,cp=synthetic(3); r=a.evaluate_validated(p,cp); ok(r['verdict']==a.INSUFFICIENT); ok(not r['activity']['quorum_many_signed_fetched_current_checkpoint'])
p,cp=synthetic(7,bad=1); r=a.evaluate_validated(p,cp); ok(r['verdict']==a.AUTH_FAILED)
# Validator rejects global/current liveness promotion: take strong synthetic receipt but normalize predecessor constants.
p,cp=synthetic(7); r=a.evaluate_validated(p,cp); r['repository_predecessor_main']=a.EXPECTED_MAIN; r['repository_predecessor_tree']=a.EXPECTED_TREE; r['predecessor_receipt_fingerprint_sha256']=a.EXPECTED_PREDECESSOR_FP
# It must still fail because synthetic verified vkeys are not fixed pins.
raises(lambda:a.validate_receipt(r))
print(f'PASS witness current-checkpoint activity hostile suite: {checks} checks')
