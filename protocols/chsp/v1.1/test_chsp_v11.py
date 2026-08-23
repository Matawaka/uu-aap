#!/usr/bin/env python3
from __future__ import annotations
import copy, tempfile, importlib.util
from datetime import datetime,timedelta,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('c',ROOT/'chsp_v11.py');C=importlib.util.module_from_spec(s);s.loader.exec_module(C)
def z(d):return C.iso_z(d)
def fail(fn,text=None):
    try:fn()
    except Exception as e:
        if text and text not in str(e):raise AssertionError(str(e))
        return
    raise AssertionError('unexpected success')
def chain(base):
    r={"artifact_type":"CHSPExternalExecutionReceipt","artifact_version":"1.0","receipt_id":"r","project_id":"Matawaka/uu-aap","steward_id":"human:steward","v08_envelope_sha256":"1"*64,"v09_execution_authorization_sha256":"2"*64,"v09_execution_authorization_assessment_sha256":"3"*64,"execution_request_sha256":"4"*64,"provider_adapter_id":"fake","started_at":z(base),"completed_at":z(base+timedelta(minutes=1)),"result":"verified_success","preflight_observed_role":"absent","preflight_evidence_sha256":"5"*64,"operation_results":[{"operation_id":"o","kind":"ensure_role_at_least","status":"changed","mutation_attempted":True,"mutation_performed":True,"before_role":"absent","after_role":"collaborator","provider_evidence_sha256":"6"*64,"provider_request_id":"x","reason":"test"}],"post_observed_role":"collaborator","post_evidence_sha256":"7"*64,"receipt_sha256":"0"*64,"claims":{"executor_invoked":True,"exact_authorization_consumed_locally":True,"external_mutation_performed":True,"external_mutation_may_have_occurred":False,"exact_external_transition_verified":True,"credential_material_persisted":False,"repository_ownership_transferred":False,"account_control_transferred":False,"predecessor_access_removed":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"global_provider_state_proven":False}}
    r['receipt_sha256']=C.self_digest(r,'receipt_sha256')
    a={"artifact_type":"CHSPExternalExecutionAssessment","artifact_version":"1.0","assessment_id":"a","evaluated_at":z(base+timedelta(minutes=2)),"project_id":"Matawaka/uu-aap","steward_id":"human:steward","execution_receipt_sha256":r['receipt_sha256'],"state":"execution_verified_changed","decision":"external_transition_effect_may_be_recorded","reasons":[],"assessment_sha256":"0"*64,"claims":{"policy_sufficiency_only":True,"exact_external_transition_verified":True,"external_effect_recordable":True,"repository_ownership_transferred":False,"account_control_transferred":False,"predecessor_access_removed":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"global_provider_state_proven":False}}
    a['assessment_sha256']=C.self_digest(a,'assessment_sha256');return r,a
def main():
    p=C.load_json(ROOT/'reference.chsp-external-effect-stabilization-policy.json');C.validate_policy(p);b=datetime(2026,8,20,12,tzinfo=timezone.utc);r,a=chain(b)
    o=[C.build_observation(r,a,p,'o1','d1','collaborator','8'*64,z(b+timedelta(hours=1))),C.build_observation(r,a,p,'o2','d2','collaborator','9'*64,z(b+timedelta(hours=13))),C.build_observation(r,a,p,'o3','d1','collaborator','a'*64,z(b+timedelta(hours=26)))]
    st=C.assess_stabilization(r,a,o,p,z(b+timedelta(hours=27)));assert st['state']=='stabilization_eligible' and st['metrics']['stabilization_span_hours']==25
    short=C.assess_stabilization(r,a,o[:2]+[C.build_observation(r,a,p,'o4','d1','collaborator','b'*64,z(b+timedelta(hours=20)))],p,z(b+timedelta(hours=21)));assert short['state']=='effect_not_stabilized'
    drift=o+[C.build_observation(r,a,p,'o5','d3','absent','c'*64,z(b+timedelta(hours=26,minutes=30)))];assert C.assess_stabilization(r,a,drift,p,z(b+timedelta(hours=27)))['state']=='stabilization_blocked'
    ind=o+[C.build_observation(r,a,p,'o6','d3','unknown','d'*64,z(b+timedelta(hours=26,minutes=40)))];assert C.assess_stabilization(r,a,ind,p,z(b+timedelta(hours=27)))['state']=='stabilization_blocked'
    bad=copy.deepcopy(o[0]);bad['observed_role']='absent';fail(lambda:C.assess_stabilization(r,a,[bad]+o[1:],p,z(b+timedelta(hours=27))),'self-digest mismatch')
    x=C.acknowledge(st,p,'human:steward','hd1','e'*64,'nonce-steward-0001',C.ACK_TOKEN,z(b+timedelta(hours=28)));y=C.acknowledge(st,p,'human:reviewer','hd2','f'*64,'nonce-reviewer-001',C.ACK_TOKEN,z(b+timedelta(hours=28,minutes=1)));rec=C.recognize(r,a,st,[x,y],p,z(b+timedelta(hours=28,minutes=2)));assert rec['claims']['external_effect_recognized'] is True and rec['claims']['repository_ownership_transferred'] is False and rec['claims']['kontur_activated'] is False
    fail(lambda:C.recognize(r,a,st,[y],p,z(b+timedelta(hours=29))),'insufficient acknowledgers')
    y2=C.acknowledge(st,p,'human:other','hd3','1'*64,'nonce-reviewer-002',C.ACK_TOKEN,z(b+timedelta(hours=28,minutes=2)));fail(lambda:C.recognize(r,a,st,[y,y2],p,z(b+timedelta(hours=29))),'steward acknowledgement required')
    with tempfile.TemporaryDirectory() as td:
        state=Path(td);x2=C.acknowledge(st,p,'human:steward','hd1','2'*64,'local-steward-0001',C.ACK_TOKEN,z(b+timedelta(hours=30)),state);y3=C.acknowledge(st,p,'human:reviewer','hd2','3'*64,'local-reviewer-0001',C.ACK_TOKEN,z(b+timedelta(hours=30,minutes=1)),state);C.recognize(r,a,st,[x2,y3],p,z(b+timedelta(hours=30,minutes=2)),state);fail(lambda:C.recognize(r,a,st,[x2,y3],p,z(b+timedelta(hours=30,minutes=3)),state),'recognized-effect-assessments')
    print('CHSP v1.1 tests: PASS')
if __name__=='__main__':main()
