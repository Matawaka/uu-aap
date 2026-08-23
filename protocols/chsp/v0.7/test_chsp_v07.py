#!/usr/bin/env python3
from __future__ import annotations
import copy, importlib.util, tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('chsp_v07_test',ROOT/'chsp_v07.py'); C=importlib.util.module_from_spec(spec); spec.loader.exec_module(C)

def z(x): return C.iso_z(x)
def fail(fn, text=None):
    try: fn()
    except Exception as e:
        if text and text not in str(e): raise AssertionError(f'{text!r} not in {e!r}')
        return
    raise AssertionError('unexpected success')

def pair(base):
    p={"artifact_type":"CHSPExternalBindingProposal","artifact_version":"0.6","proposal_id":"urn:test:p","project_id":"Matawaka/uu-aap","steward_id":"human:steward","v05_stewardship_state_sha256":"1"*64,"v05_execution_receipt_sha256":"2"*64,"claim_sha256":"3"*64,"attestation_set_sha256":"4"*64,"supporting_attestation_sha256s":["5"*64,"6"*64,"7"*64],"observer_domain_ids":["od:a","od:b"],"evidence_classes":["identity_match","challenge_response"],"external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:successor","claimed_role":"maintainer","proposed_binding_scope":"descriptive_external_stewardship_mapping","created_at":z(base),"proposal_sha256":"0"*64,"claims":{"proposal_only":True,"evidence_threshold_satisfied":True,"external_binding_established":False,"external_control_transition_authorized":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"universal_identity_proven":False,"distributed_consensus_established":False}}
    p['proposal_sha256']=C.self_digest(p,'proposal_sha256')
    a={"artifact_type":"CHSPExternalBindingAssessment","artifact_version":"0.6","assessment_id":"urn:test:a","evaluated_at":z(base+timedelta(hours=1)),"project_id":"Matawaka/uu-aap","steward_id":p['steward_id'],"v05_stewardship_state_sha256":"1"*64,"v05_execution_receipt_sha256":"2"*64,"claim_sha256":"3"*64,"attestation_set_sha256":"4"*64,"proposal_sha256":p['proposal_sha256'],"state":"binding_review_eligible","decision":"external_binding_human_review_may_be_requested","metrics":{"supporting_attestations":3,"contradictory_attestations":0,"indeterminate_attestations":0,"observer_domains":2,"evidence_classes":2,"strong_possession_present":True,"oldest_support_age_days":1},"reasons":[],"assessment_sha256":"0"*64,"claims":{"policy_sufficiency_only":True,"external_binding_review_eligible":True,"external_binding_established":False,"external_control_transition_authorized":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"universal_identity_proven":False,"domain_independence_proven":False,"distributed_consensus_established":False}}
    a['assessment_sha256']=C.self_digest(a,'assessment_sha256'); return p,a

def main():
    policy=C.load_json(ROOT/'reference.chsp-external-transition-policy.json'); C.validate_policy(policy)
    base=datetime(2026,8,23,16,0,tzinfo=timezone.utc); p,a=pair(base)
    with tempfile.TemporaryDirectory() as td:
        s=Path(td)
        r1=C.issue_decision(p,a,policy,'recognition',p['steward_id'],'d:steward','a'*64,'rec-decision-000001',C.RECOGNITION_TOKEN,s,z(base+timedelta(hours=2)))
        r2=C.issue_decision(p,a,policy,'recognition','human:reviewer','d:reviewer','b'*64,'rec-decision-000002',C.RECOGNITION_TOKEN,s,z(base+timedelta(hours=3)))
        rec=C.issue_recognition(p,a,policy,[r1,r2],'recognition-nonce-001',s,z(base+timedelta(hours=4)),z(base+timedelta(days=3)))
        x=C.assess_transition(p,a,policy,[r1,r2],rec,[],None,[],z(base+timedelta(hours=5))); assert x['state']=='recognition_active'
        t1=C.issue_decision(p,a,policy,'transition_preparation',p['steward_id'],'d:steward','c'*64,'trans-decision-00001',C.TRANSITION_TOKEN,s,z(base+timedelta(hours=6)),rec)
        t2=C.issue_decision(p,a,policy,'transition_preparation','human:authorizer','d:authorizer','d'*64,'trans-decision-00002',C.TRANSITION_TOKEN,s,z(base+timedelta(hours=7)),rec)
        auth=C.issue_transition_authorization(p,a,policy,rec,[r1,r2],[t1,t2],'trans-auth-nonce-001',s,z(base+timedelta(hours=8)),z(base+timedelta(hours=20)))
        ready=C.assess_transition(p,a,policy,[r1,r2],rec,[t1,t2],auth,[],z(base+timedelta(hours=9)))
        assert ready['state']=='transition_preparation_authorized'; assert ready['decision']=='bounded_external_transition_executor_may_be_requested'; assert ready['claims']['external_control_mutation_authorized'] is False
        rev=C.record_revocation('transition_preparation_authorization',auth,p,policy,'human:authorizer','human_revocation','e'*64,'evidence_changed','revoke-nonce-000001',s,z(base+timedelta(hours=10)))
        blocked=C.assess_transition(p,a,policy,[r1,r2],rec,[t1,t2],auth,[rev],z(base+timedelta(hours=11))); assert blocked['state']=='transition_revoked'
        fail(lambda:C.issue_recognition(p,a,policy,[r1,r2],'recognition-nonce-002',s,z(base+timedelta(hours=5)),z(base+timedelta(days=4))),'external-recognized-proposals')
        fail(lambda:C.issue_transition_authorization(p,a,policy,rec,[r1,r2],[t1,t2],'trans-auth-nonce-002',s,z(base+timedelta(hours=9)),z(base+timedelta(hours=21))),'external-transition-recognitions')
    with tempfile.TemporaryDirectory() as td:
        s=Path(td)
        only=C.issue_decision(p,a,policy,'recognition',p['steward_id'],'d:steward','1'*64,'only-rec-decision-01',C.RECOGNITION_TOKEN,s,z(base+timedelta(hours=2)))
        fail(lambda:C.issue_recognition(p,a,policy,[only],'only-recognition-001',s,z(base+timedelta(hours=3)),z(base+timedelta(days=2))),'insufficient recognizers')
    with tempfile.TemporaryDirectory() as td:
        fail(lambda:C.issue_decision(p,a,policy,'recognition','human:x','d:x','2'*64,'wrong-token-nonce1',C.TRANSITION_TOKEN,Path(td),z(base+timedelta(hours=2))),'typed confirmation')
    with tempfile.TemporaryDirectory() as td:
        s=Path(td)
        r1=C.issue_decision(p,a,policy,'recognition',p['steward_id'],'d:s','3'*64,'stale-rec-dec-0001',C.RECOGNITION_TOKEN,s,z(base+timedelta(days=2)))
        r2=C.issue_decision(p,a,policy,'recognition','human:r','d:r','4'*64,'stale-rec-dec-0002',C.RECOGNITION_TOKEN,s,z(base+timedelta(days=2,hours=1)))
        fail(lambda:C.issue_recognition(p,a,policy,[r1,r2],'stale-recognition-1',s,z(base+timedelta(days=2,hours=2)),z(base+timedelta(days=3))),'too old')
    bad=copy.deepcopy(p); bad['claimed_role']='owner'
    fail(lambda:C.assess_transition(bad,a,policy,[],None,[],None,[],z(base+timedelta(hours=2))),'self-digest mismatch')
    print('CHSP v0.7 tests: PASS')
if __name__=='__main__': main()
