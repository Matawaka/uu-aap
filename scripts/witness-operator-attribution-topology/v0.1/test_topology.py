#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

D=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('topology',D/'topology.py'); tp=importlib.util.module_from_spec(spec); spec.loader.exec_module(tp)
spec2=importlib.util.spec_from_file_location('receipt_validator',D/'receipt_validator.py'); rv=importlib.util.module_from_spec(spec2); spec2.loader.exec_module(rv)
profile=json.load(open(D/'profile.json',encoding='utf-8'))
pins=[
'witness.stagemole.eu+67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv',
'transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM',
'staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL',
'rgdd.se/poc-witness+db03732e+BCjJKlo6BU0xfIb8LutqerIFTWIXEA0L5n3tW3QyPFgG',
'witness1.smartit.nu/witness1+a48c820f+BPSFWg9G6KPiO7QPryYO5Xq4oYJJ+kAvLKLSimDhoxMO',
'remora.n621.de+da77ade7+BOvN63jn/bLvkieywe8R6UYAtVtNbZpXh34x7onlmtw2',
'witness.navigli.sunlight.geomys.org+a3e00fe2+BNy/co4C1Hn1p+INwJrfUlgz7W55dSZReusH/GhUhJ/G']
pre_profile={'tracking_issue':939}
pre_receipt={'tracking_issue':939,'receipt_fingerprint_sha256':profile['required_predecessor_receipt_fingerprint_sha256'],'verdict':profile['required_predecessor_verdict'],'matched_witness_key_count':7,'unique_source_url_count':6,'all_seven_reobserved_in_one_bounded_run':True,'observed_witness_vkeys':sorted(pins),'claims':{'witness_identity_proven':False,'legal_operator_identity_proven':False,'operator_independence_proven':False,'all_witnesses_independent_proven':False,'all_seven_currently_active_proven':False}}
pin_profile={'witness_vkeys':pins}
checks=0

def ok(v,msg='assertion failed'):
 global checks
 assert v,msg; checks+=1

def expect_error(fn):
 global checks
 try: fn()
 except (ValueError,KeyError,TypeError): checks+=1; return
 raise AssertionError('expected fail-closed error')

def registry_html(omit=None,mismap=None):
 rows=[]
 for op in profile['operators']:
  if op['operator_label']==omit: continue
  href=op['attribution_url']
  if op['operator_label']=='Florian Larysch': href='https://remora.n621.de'  # deliberate root/no-slash equivalence
  if op['operator_label']==mismap: href='https://example.invalid/not-this-surface'
  rows.append(f'<tr><td>{op["operator_label"]}</td><td><a href="{href}">{href}</a></td></tr>')
 return ('<html><table>'+''.join(rows)+'</table></html>').encode()

def bodies():
 out={}
 for op in profile['operators']:
  a=op['attribution_url']; k=op['key_material_url']
  if op['key_material_relation']=='SAME_SURFACE':
   body=b'operator surface\n'+b'\n'.join(v.encode() for v in op['witness_vkeys'])+b'\n'
   out[a]=body
  else:
   out[a]=f'<html><a href="{k}">system homepage</a></html>'.encode()
   out[k]=b'key material\n'+b'\n'.join(v.encode() for v in op['witness_vkeys'])+b'\n'
 return out

# canonical root paths
ok(tp.normalize_url('https://remora.n621.de')==tp.normalize_url('https://remora.n621.de/'))
ok(tp.normalize_url('https://navigli.sunlight.geomys.org')==tp.normalize_url('https://navigli.sunlight.geomys.org/'))

# strong synthetic case
r=tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),bodies())
for expr in [r['matched_witness_key_count']==7,r['public_operator_label_count']==6,r['bound_attribution_surface_count']==6,r['bound_key_material_surface_count']==6,r['registry_relation_count']==6,r['operator_key_material_relation_count']==6,r['trustfabric_pinned_key_count']==2,r['all_seven_public_operator_attributions_bound'] is True,r['verdict']==profile['strong_verdict'],set(r['observed_witness_vkeys'])==set(pins),len(r['observed_operator_labels'])==6,all(v is False for v in r['claims'].values()),rv.validate(profile,pre_profile,pre_receipt,pin_profile,r)]: ok(expr)

# Geomys split relation is mandatory
geo=next(o for o in profile['operators'] if o['operator_label']=='Geomys')
b=bodies(); b[geo['attribution_url']]=b'<html>operator page without homepage link</html>'
x=tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b)
ok(x['matched_witness_key_count']==7); ok(x['operator_key_material_relation_count']==5); ok(x['public_operator_label_count']==5); ok(x['all_seven_public_operator_attributions_bound'] is False); ok(x['verdict']==profile['insufficient_verdict'])
b=bodies(); b[geo['key_material_url']]=b'homepage but exact key absent'
x=tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b)
ok(x['matched_witness_key_count']==6); ok(x['registry_relation_count']==6); ok(x['operator_key_material_relation_count']==6); ok(x['public_operator_label_count']==5)
# partial/wrong key bytes
b=bodies(); v=geo['witness_vkeys'][0]; b[geo['key_material_url']]=v[:-8].encode(); ok(tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b)['matched_witness_key_count']==6)

# TrustFabric remains one label with two keys
trust=next(o for o in profile['operators'] if o['operator_label']=='TrustFabric')
b=bodies(); b[trust['key_material_url']]=trust['witness_vkeys'][0].encode(); x=tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b)
ok(x['matched_witness_key_count']==6); ok(x['trustfabric_pinned_key_count']==1); ok(x['public_operator_label_count']==5)

# registry relation must be row scoped and current
x=tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(omit='Geomys'),bodies()); ok(x['registry_relation_count']==5); ok(x['public_operator_label_count']==5)
x=tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(mismap='Geomys'),bodies()); ok(x['registry_relation_count']==5)
split=b'<table><tr><td>Geomys</td><td><a href="https://example.invalid/">wrong</a></td></tr><tr><td>Someone else</td><td><a href="https://geomys.org/witness/navigli">right url</a></td></tr></table>'
ok(tp.registry_relation_observed(split,'Geomys','https://geomys.org/witness/navigli') is False)

# source-map closure / body availability
b=bodies(); b.pop(next(iter(b))); expect_error(lambda: tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b))
b=bodies(); b['https://extra.invalid/x']=b'x'; expect_error(lambda: tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b))
b=bodies(); rem=b.pop('https://remora.n621.de/'); b['https://remora.n621.de']=rem; b['https://remora.n621.de/']=b'duplicate canonical alias'; expect_error(lambda: tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b))
b=bodies(); b[next(iter(b))]=b''; expect_error(lambda: tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,registry_html(),b))
expect_error(lambda: tp.evaluate(profile,pre_profile,pre_receipt,pin_profile,b'',bodies()))

# profile drift / substitution
mut=[]
p=copy.deepcopy(profile); p['registry']['source_classification']='OPERATOR_PUBLISHED_WITNESS_PAGE'; mut.append(p)
p=copy.deepcopy(profile); p['registry']['source_url']='http://witness-network.org/witness-tables/'; mut.append(p)
p=copy.deepcopy(profile); p['operators'][0]['source_classification']='NETWORK_CURATED_OPERATOR_TABLE'; mut.append(p)
p=copy.deepcopy(profile); p['operators'][0]['operator_label']='Mullvad'; mut.append(p)
p=copy.deepcopy(profile); p['operators'][1]['operator_label']=p['operators'][0]['operator_label']; mut.append(p)
p=copy.deepcopy(profile); p['operators'][1]['witness_vkeys'][0]=p['operators'][0]['witness_vkeys'][0]; mut.append(p)
p=copy.deepcopy(profile); p['operators'][0]['attribution_url']='https://evil.invalid/a'; mut.append(p)
p=copy.deepcopy(profile); p['operators'][0]['key_material_url']='https://evil.invalid/k'; mut.append(p)
p=copy.deepcopy(profile); p['operators'][0]['key_material_relation']='OPERATOR_PAGE_LINK'; mut.append(p)
p=copy.deepcopy(profile); p['operators'][3]['key_material_relation']='SAME_SURFACE'; mut.append(p)
p=copy.deepcopy(profile); p['operators'][3]['key_material_url']=p['operators'][3]['attribution_url']; mut.append(p)
p=copy.deepcopy(profile); p['required_operator_label_count']=7; mut.append(p)
p=copy.deepcopy(profile); p['required_attribution_surface_count']=7; mut.append(p)
p=copy.deepcopy(profile); p['required_key_material_surface_count']=7; mut.append(p)
p=copy.deepcopy(profile); p['always_false_claims'].remove('operator_control_proven'); mut.append(p)
p=copy.deepcopy(profile); p['extra']=True; mut.append(p)
for p in mut: expect_error(lambda p=p: tp.evaluate(p,pre_profile,pre_receipt,pin_profile,registry_html(),bodies()))

# predecessor and pin drift
for alter in [
 lambda q:q.__setitem__('receipt_fingerprint_sha256','0'*64),
 lambda q:q.__setitem__('verdict','PROMOTED'),
 lambda q:q.__setitem__('matched_witness_key_count',6),
 lambda q:q.__setitem__('unique_source_url_count',7),
 lambda q:q.__setitem__('all_seven_reobserved_in_one_bounded_run',False),
]:
 q=copy.deepcopy(pre_receipt); alter(q); expect_error(lambda q=q: tp.evaluate(profile,pre_profile,q,pin_profile,registry_html(),bodies()))
for claim in ('witness_identity_proven','legal_operator_identity_proven','operator_independence_proven','all_witnesses_independent_proven','all_seven_currently_active_proven'):
 q=copy.deepcopy(pre_receipt); q['claims'][claim]=True; expect_error(lambda q=q: tp.evaluate(profile,pre_profile,q,pin_profile,registry_html(),bodies()))
pp=copy.deepcopy(pin_profile); pp['witness_vkeys'][0]='substituted'; expect_error(lambda: tp.evaluate(profile,pre_profile,pre_receipt,pp,registry_html(),bodies()))

# receipt mutation / promotion
mutations=[
 lambda z:z.__setitem__('matched_witness_key_count',8),
 lambda z:z.__setitem__('public_operator_label_count',7),
 lambda z:z.__setitem__('bound_attribution_surface_count',7),
 lambda z:z.__setitem__('bound_key_material_surface_count',7),
 lambda z:z.__setitem__('registry_relation_count',7),
 lambda z:z.__setitem__('operator_key_material_relation_count',7),
 lambda z:z.__setitem__('trustfabric_pinned_key_count',3),
 lambda z:z['observed_operator_labels'].append('Fake'),
 lambda z:z['observed_witness_vkeys'].append('fake'),
 lambda z:z.__setitem__('all_seven_public_operator_attributions_bound',False),
 lambda z:z.__setitem__('verdict','LEGAL_IDENTITY_PROVEN'),
 lambda z:z.__setitem__('operator_attribution_assurance','INDEPENDENCE_PROVEN'),
 lambda z:z['claims'].__setitem__('witness_identity_proven',True),
 lambda z:z['claims'].__setitem__('legal_operator_identity_proven',True),
 lambda z:z['claims'].__setitem__('cryptographic_operator_identity_binding_proven',True),
 lambda z:z['claims'].__setitem__('operator_control_proven',True),
 lambda z:z['claims'].__setitem__('operator_independence_proven',True),
 lambda z:z['claims'].__setitem__('all_witnesses_independent_proven',True),
 lambda z:z['claims'].__setitem__('all_seven_currently_active_proven',True),
 lambda z:z['claims'].__setitem__('global_non_equivocation_proven',True),
 lambda z:z['claims'].__setitem__('c2pa_manifest_inclusion_proven',True),
 lambda z:z['claims'].__setitem__('truth_certified',True),
 lambda z:z['claims'].__setitem__('authority_created',True),
 lambda z:z.__setitem__('automatic_action',True),
 lambda z:z.__setitem__('external_mutation_performed',True),
 lambda z:z['operator_records'][0].__setitem__('attribution_host','evil.example'),
 lambda z:z['operator_records'][0].__setitem__('key_material_host','evil.example'),
 lambda z:z['operator_records'][0].__setitem__('attribution_body_sha256','bad'),
 lambda z:z['operator_records'][0].__setitem__('key_material_body_sha256','bad'),
 lambda z:z['registry'].__setitem__('retrieved_body_sha256','bad'),
 lambda z:z['operator_records'][0].__setitem__('registry_relation_observed',False),
 lambda z:z['operator_records'][0].__setitem__('operator_key_material_relation_observed',False),
 lambda z:z['operator_records'][3].__setitem__('key_material_url','https://evil.invalid/k'),
 lambda z:z['operator_records'][3].__setitem__('key_material_relation','SAME_SURFACE'),
]
for m in mutations:
 z=copy.deepcopy(r); m(z); z['receipt_fingerprint_sha256']=tp.fingerprint(z); expect_error(lambda z=z: rv.validate(profile,pre_profile,pre_receipt,pin_profile,z))
z=copy.deepcopy(r); z['receipt_fingerprint_sha256']='0'*64; expect_error(lambda: rv.validate(profile,pre_profile,pre_receipt,pin_profile,z))
z=copy.deepcopy(r); z['extra']=1; z['receipt_fingerprint_sha256']=tp.fingerprint(z); expect_error(lambda: rv.validate(profile,pre_profile,pre_receipt,pin_profile,z))

print(f'PASS witness operator-attribution topology hostile suite v2: {checks} checks')
