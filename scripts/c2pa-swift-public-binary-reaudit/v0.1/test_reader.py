# SPDX-License-Identifier: Apache-2.0
import copy, json, tempfile, unittest
from pathlib import Path
from inspect_reader import inspect, changes, same

class ReaderEvidence(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name); (self.root/'fixtures').mkdir()
        self.key='org.example.uu_aap_reference'
        self.claim={'name':'fixture',self.key:{'nested':{'sequence':[1,2,3]}}}
        self.assertion={'label':'c2pa.external-reference','data':{'location':{'hash':list(range(32))}}}
        self.put('fixtures/claim-generator-info.json',self.claim)
        self.put('codec-claim-output.json',self.claim)
        self.put('native-manifest-input.json',{'claim_generator_info':[self.claim]})
        self.put('fixtures/native-external-reference.json',self.assertion)
        drift=copy.deepcopy(self.claim); drift[self.key]['nested']['sequence']='AQID'
        self.put('native-reader.json',{'active_manifest':'current','manifests':{'current':{
            'claim_generator_info':[drift],'assertions':[self.assertion]}}})
        self.put('native-reader-crjson.json',{'manifests':[{'label':'current','claim.v2':{'claim_generator_info':self.claim}}]})
    def put(self,name,obj): (self.root/name).write_text(json.dumps(obj))
    def test_route_difference_not_irreversible_loss(self):
        r=inspect(self.root)
        self.assertEqual(r['classification'],'READER_JSON_EXTENSION_TYPE_DRIFT_CRJSON_PRESERVED')
        self.assertFalse(r['reader_json_extension_equal']); self.assertTrue(r['reader_crjson_extension_equal'])
        self.assertFalse(r['irreversible_signed_asset_data_loss_proven'])
        self.assertEqual(r['reader_json_differences'][0]['path'],'/nested/sequence')
    def test_crjson_parsing_is_not_semantic_preservation(self):
        bad=copy.deepcopy(self.claim); bad[self.key]['nested']['sequence']='AQID'
        self.put('native-reader-crjson.json',{'manifests':[{'label':'current','claim.v2':{'claim_generator_info':bad}}]})
        self.assertFalse(inspect(self.root)['reader_crjson_extension_equal'])
        self.assertNotEqual(inspect(self.root)['classification'],'READER_JSON_EXTENSION_TYPE_DRIFT_CRJSON_PRESERVED')
    def test_other_manifest_cannot_supply_extension(self):
        self.put('native-reader-crjson.json',{'manifests':[{'label':'ancestor','claim.v2':{'claim_generator_info':self.claim}}]})
        with self.assertRaises(ValueError): inspect(self.root)
    def test_pre_native_loss_cannot_be_blame_shifted(self):
        self.put('native-manifest-input.json',{'claim_generator_info':[{'name':'fixture'}]})
        with self.assertRaises(ValueError): inspect(self.root)
    def test_types_are_preserved_in_comparison(self):
        self.assertFalse(same(True,1)); self.assertFalse(same([1,2,3],'AQID'))
        self.assertEqual(changes([1,2,3],'AQID')[0]['before_type'],'list')

if __name__=='__main__': unittest.main(verbosity=2)
