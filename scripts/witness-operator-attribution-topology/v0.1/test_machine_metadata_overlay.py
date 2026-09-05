#!/usr/bin/env python3
import copy,importlib.util,json,pathlib
D=pathlib.Path(__file__).parent
s=importlib.util.spec_from_file_location('o',D/'machine_metadata_overlay.py'); o=importlib.util.module_from_spec(s); s.loader.exec_module(o)
p=json.load(open(D/'profile.json'))
recs=[]
for x in p['operators']:
 recs.append({'operator_label':x['operator_label'],'attribution_url':x['attribution_url'],'key_material_url':o.V2_HOME if x['operator_label']=='Geomys' else x['key_material_url'],'registry_relation_observed':True,'operator_key_material_relation_observed':True,'all_expected_vkeys_observed':x['operator_label']!='Geomys'})
b={'tracking_issue':941,'verdict':o.BASE_INCOMPLETE,'receipt_fingerprint_sha256':'a'*64,'matched_witness_key_count':6,'registry_relation_count':6,'operator_key_material_relation_count':6,'operator_records':recs,'claims':{c:False for c in o.FALSE_CLAIMS},'automatic_action':False,'external_mutation_performed':False}
m={'monitoring_url':o.MON,'submission_url':o.SUB,'verifier_keys':[o.NAV,'other+key']}; mb=json.dumps(m).encode(); r=o.evaluate(p,b,mb); o.validate(r); n=1
def bad(name,f):
 global n
 try:f();raise AssertionError('accepted '+name)
 except (ValueError,TypeError,KeyError):n+=1
for field in ('registry_relation_count','operator_key_material_relation_count'):
 bad(field,lambda field=field:o.evaluate(p,{**b,field:5},mb))
for field in ('automatic_action','external_mutation_performed'):
 bad(field,lambda field=field:o.evaluate(p,{**b,field:True},mb))
for k,v in (('monitoring_url','https://wrong.example/'),('submission_url','https://wrong.example/'),('verifier_keys',['other'])):
 bad(k,lambda k=k,v=v:o.evaluate(p,b,json.dumps({**m,k:v}).encode()))
for k in ('monitoring_url','submission_url','verifier_keys'):
 bad('missing '+k,lambda k=k:o.evaluate(p,b,json.dumps({x:y for x,y in m.items() if x!=k}).encode()))
bad('malformed',lambda:o.evaluate(p,b,b'{'))
for label in [x['operator_label'] for x in p['operators'] if x['operator_label']!='Geomys']:
 def f(label=label):
  q=copy.deepcopy(b); next(z for z in q['operator_records'] if z['operator_label']==label)['all_expected_vkeys_observed']=False; o.evaluate(p,q,mb)
 bad(label,f)
def conflated_v2_home():
 q=copy.deepcopy(b); next(z for z in q['operator_records'] if z['operator_label']=='Geomys')['key_material_url']=o.MON; o.evaluate(p,q,mb)
bad('v2 homepage conflated with monitoring',conflated_v2_home)
def claims(): q=copy.deepcopy(b);q['claims']['truth_certified']=True;o.evaluate(p,q,mb)
bad('claim',claims)
def fp(): q=copy.deepcopy(r);q['receipt_fingerprint_sha256']='0'*64;o.validate(q)
bad('fingerprint',fp)
print(f'PASS operator-attribution machine overlay hostile suite: {n} checks')
