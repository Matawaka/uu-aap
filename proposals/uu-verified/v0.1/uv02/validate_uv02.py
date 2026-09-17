#!/usr/bin/env python3
import argparse,copy,hashlib,json
from pathlib import Path
from jsonschema import Draft202012Validator,FormatChecker
STAGES=['DECLARED','EVIDENCE_BOUND','REPRODUCED','INDEPENDENTLY_REVIEWED','ISSUED','CURRENTLY_VALID']
class DuplicateKey(ValueError): pass
def pairs(xs):
    d={}
    for k,v in xs:
        if k in d: raise DuplicateKey(k)
        d[k]=v
    return d
def load(p,limit=None):
    b=Path(p).read_bytes()
    if limit and len(b)>limit: raise ValueError('record too large')
    return json.loads(b,object_pairs_hook=pairs),b
def dep(v):
    if isinstance(v,dict): return 1+max([dep(x) for x in v.values()] or [0])
    if isinstance(v,list): return 1+max([dep(x) for x in v] or [0])
    return 1
def validate(r,s,p,praw):
    e=[]
    for x in Draft202012Validator(s,format_checker=FormatChecker()).iter_errors(r): e.append('SCHEMA:'+x.message)
    if e:return e
    if dep(r)>p['parserLimits']['maxDepth']: e.append('RECORD_DEPTH_EXCEEDED')
    if r['profileBinding']['sha256']!=hashlib.sha256(praw).hexdigest(): e.append('PROFILE_BINDING_MISMATCH')
    want=[x['id'] for x in p['requirements'] if x['mandatory']]; ids=[x['requirementId'] for x in r['findings']]
    if len(set(ids))!=len(ids): e.append('DUPLICATE_REQUIREMENT')
    if set(ids)!=set(want): e.append('REQUIRED_REQUIREMENT_SET_MISMATCH')
    for f in r['findings']:
        if f['result']=='PASS' and not any(x['observationState']=='OBSERVED' for x in f['evidence']): e.append('PASS_WITHOUT_OBSERVED_EVIDENCE')
        if f['result']=='NOT_APPLICABLE' and f['requirementId'] not in p['topLevelNotApplicableAllowed']: e.append('NOT_APPLICABLE_NOT_ALLOWED')
    k=r['subject']['kind']
    if k=='BUILD_ARTIFACT' and not r['subject']['artifactDigests']: e.append('SUBJECT_BINDING_INCOMPLETE')
    if k=='DEPLOYMENT' and r['displayDecision']=='VERIFIED_CURRENT': e.append('UNSUPPORTED_SUBJECT_KIND')
    if k=='DESIGN_DOCUMENT' and r['displayDecision']=='VERIFIED_CURRENT': e.append('DESIGN_ONLY_CANNOT_BE_CURRENT')
    i=STAGES.index(r['stage'])
    if i>=STAGES.index('INDEPENDENTLY_REVIEWED'):
        if r['review']['state']!='INDEPENDENT_REVIEW' or r['review']['independence']!='OUTSIDE_IMPLEMENTER_CONTROL': e.append('REVIEW_NOT_INDEPENDENT')
        if set(r['subject']['operatorIds'])&set(r['review']['reviewerOperatorIds']): e.append('SELF_REVIEW_LAUNDERING')
    if i>=STAGES.index('ISSUED') and r['issuance']['state']!='ISSUED': e.append('ISSUANCE_NOT_ESTABLISHED')
    if not set(p['requiredNonEffects'])<=set(r['nonEffects']): e.append('NON_EFFECTS_INCOMPLETE')
    blocked=set(p['blockingLifecycleStates'])
    if r['displayDecision']=='VERIFIED_CURRENT':
        if k not in p['subjectPolicy']['eligibleKinds']: e.append('UNSUPPORTED_SUBJECT_KIND')
        if any(x['result']!='PASS' for x in r['findings']): e.append('EVIDENCE_INSUFFICIENT')
        if r['stage']!='CURRENTLY_VALID': e.append('STATUS_NOT_CURRENT')
        if r['review']['state']!='INDEPENDENT_REVIEW' or r['review']['independence']!='OUTSIDE_IMPLEMENTER_CONTROL': e.append('REVIEW_NOT_INDEPENDENT')
        if r['issuance']['state']!='ISSUED' or r['issuance']['issuerPolicyBinding'] is None or r['issuance']['signatureBinding'] is None: e.append('ISSUANCE_NOT_ESTABLISHED')
        if r['lifecycle']['state']!='ACTIVE' or r['lifecycle']['statusBinding'] is None: e.append('STATUS_BLOCKS_POSITIVE_DISPLAY')
    elif r['lifecycle']['state'] in blocked and r['displayDecision']!='NO_MARK': e.append('BLOCKING_LIFECYCLE_REQUIRES_NO_MARK')
    c=r.get('c2paInterop')
    if c and (c['baseline']!='2.4' or c['binding']!='c2pa.external-reference'): e.append('C2PA_SEMANTIC_ESCALATION')
    return e
def fixture(praw):
    req=[f'UV-P{i:02d}' for i in range(1,13)]+[f'UV-A{i:02d}' for i in range(1,8)]
    return {'recordType':'UU_VERIFIED_RECORD','schemaVersion':'0.1.0-draft','recordId':'urn:uu-verified:fixture:uv02','stage':'EVIDENCE_BOUND','profileBinding':{'profileId':'UV-ARCH-1','profileVersion':'0.1.0-draft','sha256':hashlib.sha256(praw).hexdigest()},'subject':{'kind':'SOURCE_IMPLEMENTATION','subjectId':'fixture','operatorIds':['impl'],'sourceRepository':'https://example.invalid/repo','sourceCommit':{'algorithm':'git-sha1','oid':'0'*40},'artifactDigests':[],'configuration':{'state':'NOT_APPLICABLE','reason':'fixture'},'dependencies':{'state':'NOT_APPLICABLE','reason':'fixture'},'environment':{'state':'NOT_APPLICABLE','reason':'fixture'}},'findings':[{'requirementId':x,'result':'INSUFFICIENT_EVIDENCE','evidence':[],'reason':'UV-02 structural fixture only'} for x in req],'review':{'state':'NOT_PERFORMED','reviewerOperatorIds':[],'independence':'NOT_ESTABLISHED','conflicts':[],'disposition':'NOT_REVIEWED'},'issuance':{'state':'NOT_ISSUED','issuerId':None,'issuerPolicyBinding':None,'decisionId':None,'signatureBinding':None},'lifecycle':{'state':'DRAFT','asOf':'2026-09-17T00:00:00Z','validFrom':None,'validUntil':None,'clockBasis':'FIXTURE_ONLY','statusBinding':None,'successorRecordIds':[]},'displayDecision':'NO_MARK','failureReasons':['EVIDENCE_INSUFFICIENT','REVIEW_NOT_INDEPENDENT','ISSUANCE_NOT_ESTABLISHED','STATUS_NOT_CURRENT'],'discovery':{'machineRecord':'https://example.invalid/r','schema':'https://example.invalid/s','humanEn':'https://example.invalid/en','humanRu':'https://example.invalid/ru','challenge':'https://example.invalid/c','requiresLogin':False,'requiresPayment':False,'requiresProprietaryProvider':False},'c2paInterop':{'baseline':'2.4','binding':'c2pa.external-reference','externalReference':{'algorithm':'sha256','value':'0'*64}},'nonEffects':['DOES_NOT_CERTIFY_TRUTH','DOES_NOT_ESTABLISH_COPYRIGHT_OWNERSHIP','DOES_NOT_ESTABLISH_LEGAL_IDENTITY','DOES_NOT_GRANT_ACTION_AUTHORITY','DOES_NOT_ESTABLISH_LEGAL_LIABILITY','DOES_NOT_GUARANTEE_UNIVERSAL_PRODUCTION_SAFETY']}
def selftest(s,p,praw):
    b=fixture(praw); assert not validate(b,s,p,praw); n=0
    def bad(fn,needle):
        nonlocal n; r=copy.deepcopy(b); fn(r); assert any(needle in x for x in validate(r,s,p,praw)); n+=1
    bad(lambda r:r.__setitem__('verified',True),'SCHEMA:')
    bad(lambda r:r['findings'].pop(),'SCHEMA:')
    bad(lambda r:r['findings'].__setitem__(1,copy.deepcopy(r['findings'][0])),'DUPLICATE_REQUIREMENT')
    bad(lambda r:r['findings'][0].update(result='PASS',evidence=[]),'PASS_WITHOUT_OBSERVED_EVIDENCE')
    bad(lambda r:r['findings'][0].update(result='NOT_APPLICABLE'),'NOT_APPLICABLE_NOT_ALLOWED')
    bad(lambda r:r.update(displayDecision='VERIFIED_CURRENT',stage='CURRENTLY_VALID'),'EVIDENCE_INSUFFICIENT')
    bad(lambda r:(r.update(displayDecision='REVIEWED_DESIGN_ONLY'),r['lifecycle'].__setitem__('state','REVOKED')),'BLOCKING_LIFECYCLE_REQUIRES_NO_MARK')
    bad(lambda r:(r['subject'].__setitem__('kind','DEPLOYMENT'),r.update(displayDecision='VERIFIED_CURRENT')),'UNSUPPORTED_SUBJECT_KIND')
    bad(lambda r:r['profileBinding'].__setitem__('sha256','f'*64),'PROFILE_BINDING_MISMATCH')
    bad(lambda r:r['c2paInterop'].__setitem__('binding','custom.uu-aap'),'SCHEMA:')
    try: json.loads('{"a":1,"a":2}',object_pairs_hook=pairs); raise AssertionError
    except DuplicateKey: n+=1
    print(f'UV-02 bounded hostile suite: {n}/11 PASS; structural fixture=NO_MARK')
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('record',nargs='?'); ap.add_argument('--self-test',action='store_true'); a=ap.parse_args(); root=Path(__file__).parent
    p,praw=load(root/'profile.json'); s,_=load(root/'record.schema.json'); Draft202012Validator.check_schema(s)
    if a.self_test: selftest(s,p,praw); return 0
    if not a.record: ap.error('record required')
    r,_=load(a.record,p['parserLimits']['maxRecordBytes']); e=validate(r,s,p,praw)
    if e: print('\n'.join(e)); return 1
    print('PASS'); return 0
if __name__=='__main__': raise SystemExit(main())
