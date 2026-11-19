# SPDX-License-Identifier: Apache-2.0
"""Re-derive preservation from raw files, not from the Swift probe's PASS bits."""
import base64, json
from pathlib import Path

def load(p): return json.loads(Path(p).read_bytes())
def require(ok, msg):
    if not ok: raise ValueError(msg)
def same(a,b): return json.dumps(a,sort_keys=True,separators=(',',':')) == json.dumps(b,sort_keys=True,separators=(',',':'))
def changes(a,b,path=''):
    if type(a) is not type(b): return [{'path':path,'before_type':type(a).__name__,'after_type':type(b).__name__,'before':a,'after':b}]
    if isinstance(a,dict):
        result=[]
        for key in sorted(a.keys() | b.keys()):
            if key not in a or key not in b: result.append({'path':path+'/'+key,'presence_changed':True})
            else: result.extend(changes(a[key],b[key],path+'/'+key))
        return result
    if isinstance(a,list):
        if len(a)!=len(b): return [{'path':path,'length_changed':True}]
        return sum((changes(x,y,path+'/'+str(i)) for i,(x,y) in enumerate(zip(a,b))),[])
    return [] if same(a,b) else [{'path':path,'value_changed':True,'before':a,'after':b}]
def payload(value):
    value=json.loads(json.dumps(value)); h=value['location']['hash']
    if isinstance(h,str): value['location']['hash']=list(base64.b64decode(h,validate=True))
    return value

def inspect(out):
    out=Path(out); key='org.example.uu_aap_reference'
    original=load(out/'fixtures/claim-generator-info.json'); expected=original[key]
    codec=load(out/'codec-claim-output.json')
    manifest=load(out/'native-manifest-input.json')
    inputs=manifest['claim_generator_info']; require(len(inputs)==1,'ambiguous native input')
    require(same(expected,inputs[0].get(key)),'extension changed before native Builder call')
    report=load(out/'native-reader.json'); active=report['active_manifest']; current=report['manifests'][active]
    generators=[x for x in current['claim_generator_info'] if x.get('name')==original['name']]
    require(len(generators)==1,'ambiguous native output generator')
    json_value=generators[0].get(key)
    cr=load(out/'native-reader-crjson.json'); cms=[x for x in cr['manifests'] if x.get('label')==active]
    require(len(cms)==1,'crJSON not bound to the same active manifest')
    cr_value=cms[0]['claim.v2']['claim_generator_info'].get(key)
    assertions=[x for x in current['assertions'] if x.get('label')=='c2pa.external-reference']
    require(len(assertions)==1,'ambiguous external-reference')
    expected_assertion=load(out/'fixtures/native-external-reference.json')['data']
    json_diffs=changes(expected,json_value)
    json_ok=same(expected,json_value); cr_ok=same(expected,cr_value)
    if not json_ok and cr_ok and len(json_diffs)==1 and json_diffs[0].get('before_type')=='list' and json_diffs[0].get('after_type')=='str':
        classification='READER_JSON_EXTENSION_TYPE_DRIFT_CRJSON_PRESERVED'
    elif json_ok and cr_ok: classification='BOTH_READER_PATHS_PRESERVE_TESTED_EXTENSION'
    else: classification='AT_LEAST_ONE_READER_PATH_DOES_NOT_PRESERVE_TESTED_EXTENSION'
    return {'classification':classification,'native_input_extension_equal':True,
        'codec_extension_equal':same(expected,codec.get(key)),
        'reader_json_extension_equal':json_ok,'reader_crjson_extension_equal':cr_ok,
        'reader_json_differences':json_diffs,'reader_crjson_differences':changes(expected,cr_value),
        'reader_json_external_reference_equal':same(payload(expected_assertion),payload(assertions[0]['data'])),
        'crjson_assertion_payload_evaluated':False,
        'reader_reported_native_core':generators[0].get('org.contentauth.c2pa_rs'),
        'irreversible_signed_asset_data_loss_proven':False}
