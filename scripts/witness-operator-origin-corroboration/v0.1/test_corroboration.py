#!/usr/bin/env python3
import copy, importlib.util, json, pathlib
D=pathlib.Path(__file__).parent
s=importlib.util.spec_from_file_location('c',D/'corroboration.py'); c=importlib.util.module_from_spec(s); s.loader.exec_module(c)
p=json.load(open(D/'profile.json'))
pre={'schema':'urn:uu-aap:witness-operator-attribution-machine-overlay-receipt:0.1','tracking_issue':941,'receipt_fingerprint_sha256':c.PREDECESSOR_FP,'verdict':c.PREDECESSOR_VERDICT,'public_operator_label_count':6,'matched_witness_key_count':7,'claims':{x:False for x in c.FALSE_CLAIMS},'automatic_action':False,'external_mutation_performed':False}
# synthetic bodies exactly isolate each accepted relation. HTML wrappers exercise text extraction.
oct_body=b'''<html><body>Hello! I would like to participate with my test witness called witness1.smartit.nu/witness1 Operator name: Elias Rudberg About page URL: https://witness1.smartit.nu/witness1/about.txt Witness participation request Hi, I'd like to participate in the witness network with my test witness "remora.n621.de". Operator: Florian Larysch About page: https://remora.n621.de Participation request for test log "barreleye" related to the Sigsum project</body></html>'''
nov_body=b'''<html><body>Hello again! We would also like to add our staging witness to the witness network: operator name: Mullvad VPN AB vkey: witness.stagemole.eu +ac5cc086+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv about page: https://witness.stagemole.eu/about Requests to add log serviceberry.tlog.stagemole.eu</body></html>'''
corr_body=b'''<html><body>Sorry, I think I made a mistake when computing the vkey (wrong key type) Here's the correct one: witness.stagemole.eu +67f7aea0+BEqSG3yu9YrmcM3BHvQYTxwFj3uSWakQepafafpUqklv</body></html>'''
trust=b'''<html><body>This page contains information about the witnesses operated by the TrustFabric team. transparency.dev/DEV:witness-little-garden+d8042a87+BCtusOxINQNUTN5Oj8HObRkh2yHf/MwYaGX4CPdiVEPM staging.witness.transparency.goog/ring-any-bells+2e1a8dc9+BG5JTpLc3FJtwzgh1Uv+Qelz9qeOH2bfWjS1s0s+y4rL</body></html>'''
geom=b'''<html><body>witness.navigli.sunlight.geomys.org is a staging transparency log witness operated by Geomys.</body></html>'''
sm={
'https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/2025/11/':nov_body,
'https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/message/VMKKURC6MCXUO42IEEDENGP4R5PVHWHZ/':corr_body,
'https://transparency.dev/witnesses':trust,
'https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/2025/10/':oct_body,
'https://geomys.org/witness/navigli':geom}
r=c.evaluate(p,pre,sm); c.validate_receipt(r); assert r['corroborated_operator_label_count']==5 and r['missing_operator_labels']==['rgdd'] and r['verdict']==c.FIVE
n=1
def bad(name,fn):
 global n
 try: fn(); raise AssertionError('accepted '+name)
 except (ValueError,TypeError,KeyError,AssertionError): n+=1
# profile closure / predecessor integrity
for field,val in [('repository_predecessor_main','0'*40),('repository_predecessor_tree','0'*40),('predecessor_receipt_git_blob','0'*40),('required_predecessor_receipt_fingerprint_sha256','0'*64)]:
 q=copy.deepcopy(p); q[field]=val; bad(field,lambda q=q:c.validate_profile(q))
q=copy.deepcopy(p); q['operators'][0]['operator_label']='TrustFabric'; bad('duplicate label',lambda:c.validate_profile(q))
q=copy.deepcopy(p); q['operators'][4]['sources']=[{'source_url':'https://witness-network.org/witness-tables/','source_classification':'NETWORK_CURATED_OPERATOR_TABLE','required_fragments':['rgdd']}]; bad('curated table as rgdd evidence',lambda:c.validate_profile(q))
q=copy.deepcopy(p); q['operators'][2]['sources'][0]['source_url']='http://example.com'; bad('non https',lambda:c.validate_profile(q))
q=copy.deepcopy(p); q['operators'][2]['sources'][0]['source_url']='https://example.com'; bad('source substitution',lambda:c.validate_profile(q))
q=copy.deepcopy(pre); q['receipt_fingerprint_sha256']='0'*64; bad('predecessor fp',lambda:c.validate_predecessor(q))
q=copy.deepcopy(pre); q['claims']['truth_certified']=True; bad('predecessor claim',lambda:c.validate_predecessor(q))
# source map closure
q=dict(sm); q.pop('https://geomys.org/witness/navigli'); bad('missing source map',lambda:c.evaluate(p,pre,q))
q=dict(sm); q['https://example.com']=b'x'; bad('extra source map',lambda:c.evaluate(p,pre,q))
q=dict(sm); q['https://geomys.org/witness/navigli']=b''; bad('empty source',lambda:c.evaluate(p,pre,q))
# bounded archive anti-join: correct Florian fragments outside its bounded segment must not count
q=dict(sm); q['https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/2025/10/']=b'''Hello! I would like to participate with my test witness called witness1.smartit.nu/witness1 Operator name: Elias Rudberg About page URL: https://witness1.smartit.nu/witness1/about.txt Witness participation request Hi, I'd like to participate in the witness network with my test witness "remora.n621.de". WRONG Participation request for test log "barreleye" related to the Sigsum project Operator: Florian Larysch About page: https://remora.n621.de'''
x=c.evaluate(p,pre,q); assert 'Florian Larysch' in x['missing_operator_labels']; n+=1
# Mullvad must preserve wrong original key + separate correction
q=dict(sm); q['https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/message/VMKKURC6MCXUO42IEEDENGP4R5PVHWHZ/']=b'wrong key type'; x=c.evaluate(p,pre,q); assert 'Mullvad VPN AB' in x['missing_operator_labels']; n+=1
q=dict(sm); q['https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/2025/11/']=nov_body.replace(b'Mullvad VPN AB',b'Other Operator'); x=c.evaluate(p,pre,q); assert 'Mullvad VPN AB' in x['missing_operator_labels']; n+=1
q=dict(sm); q['https://lists.witness-network.org/mailman3/hyperkitty/list/participate%40lists.witness-network.org/2025/11/']=nov_body.replace(b'https://witness.stagemole.eu/about',b'https://wrong.example/about'); x=c.evaluate(p,pre,q); assert 'Mullvad VPN AB' in x['missing_operator_labels']; n+=1
# one source relation disappears => count falls, never promotes
for url in ['https://transparency.dev/witnesses','https://geomys.org/witness/navigli']:
 q=dict(sm); q[url]=b'unrelated'; x=c.evaluate(p,pre,q); assert x['corroborated_operator_label_count']==4 and x['verdict']==c.INCOMPLETE; n+=1
# receipt hostile mutations
for field,val in [('corroborated_operator_label_count',6),('public_operator_label_count',7),('network_curated_table_counted_as_operator_origin_evidence',True),('automatic_action',True),('external_mutation_performed',True),('verdict',c.ALL)]:
 q=copy.deepcopy(r); q[field]=val; q['receipt_fingerprint_sha256']=c.fp(q); bad('receipt '+field,lambda q=q:c.validate_receipt(q))
q=copy.deepcopy(r); q['claims']['legal_operator_identity_proven']=True; q['receipt_fingerprint_sha256']=c.fp(q); bad('claim promotion',lambda:c.validate_receipt(q))
q=copy.deepcopy(r); q['operator_records'].append(copy.deepcopy(q['operator_records'][0])); q['receipt_fingerprint_sha256']=c.fp(q); bad('record inflation',lambda:c.validate_receipt(q))
q=copy.deepcopy(r); q['receipt_fingerprint_sha256']='0'*64; bad('fingerprint',lambda:c.validate_receipt(q))
# 6/6 only valid if rgdd record is actually corroborated in the receipt; profile v0.1 itself still admits no rgdd source.
q=copy.deepcopy(r); rr=next(x for x in q['operator_records'] if x['operator_label']=='rgdd'); rr['operator_origin_relation_corroborated']=True; q['corroborated_operator_labels']=sorted(c.LABELS); q['missing_operator_labels']=[]; q['corroborated_operator_label_count']=6; q['verdict']=c.ALL; q['receipt_fingerprint_sha256']=c.fp(q); c.validate_receipt(q); n+=1
print(f'PASS witness operator-origin corroboration hostile suite: {n} checks')
