# SPDX-License-Identifier: Apache-2.0
import copy, unittest
from reaudit import summarize, png, digest

def valid():
    return {'schema':'urn:uu-aap:swift-public-consumer-probe:0.1',
        'codec_claim':{'status':'PASS','unknown_inspectable':True,'unknown_preserved':True,'no_promotion':True},
        'codec_assertion':{'status':'PASS','generic_payload_preserved':True},
        'native':{'status':'PASS','stage':'complete','signed':True,'reader_json_called':True,'reader_crjson_called':True,
            'crjson_parsed':True,'claim_preserved':True,'assertion_preserved':True,'signature_validated':True},
        'claims':{k:False for k in ('cross_sdk_compatibility','c2pa_conformance','trusted_signer','truth','authority','external_review')}}

class Gates(unittest.TestCase):
    def test_native_and_codec_are_not_conflated(self):
        p=valid(); self.assertEqual(summarize(0,0,'',p)['classification'],'CODEC_AND_NATIVE_SIGN_READ_PRESERVATION_PASS')
        for status, expected in [('ERROR','NATIVE_SIGN_OR_READ_FAILED'),('LOSSY','NATIVE_SIGN_READ_LOSSY')]:
            q=copy.deepcopy(p); q['native']['status']=status
            if status=='LOSSY': q['native']['claim_preserved']=False
            self.assertEqual(summarize(0,0,'',q)['classification'],expected)
    def test_missing_runtime_never_passes(self):
        self.assertEqual(summarize(0,0,'',None)['classification'],'PROBE_RUNTIME_FAILED')
        with self.assertRaises(ValueError): summarize(0,1,'',valid())
        with self.assertRaises(ValueError): summarize(1,None,'',valid())
        with self.assertRaises(ValueError): summarize(0,None,'',None)
    def test_build_failure_cause(self):
        skew="Reader.swift: error: cannot find 'c2pa_reader_crjson' in scope"
        self.assertEqual(summarize(0,1,skew,None)['classification'],'BLOCKED_SOURCE_BINARY_SKEW')
        self.assertEqual(summarize(0,1,'Probe.swift: undefined helper',None)['classification'],'BUILD_FAILED_OTHER')
        self.assertEqual(summarize(1,None,'',None)['classification'],'PACKAGE_RESOLUTION_FAILED')
    def test_native_not_run_or_false_evidence(self):
        for k in ('signed','reader_json_called','reader_crjson_called','crjson_parsed','claim_preserved','assertion_preserved'):
            with self.subTest(k=k):
                p=valid(); p['native'][k]=False
                with self.assertRaises(ValueError): summarize(0,0,'',p)
    def test_codec_not_run_or_false_evidence(self):
        for k in ('unknown_inspectable','unknown_preserved','no_promotion'):
            with self.subTest(k=k):
                p=valid(); p['codec_claim'][k]=False
                with self.assertRaises(ValueError): summarize(0,0,'',p)
        p=valid(); p['codec_assertion']['generic_payload_preserved']=False
        with self.assertRaises(ValueError): summarize(0,0,'',p)
    def test_claim_promotion(self):
        for k in valid()['claims']:
            with self.subTest(k=k):
                p=valid(); p['claims'][k]=True
                with self.assertRaises(ValueError): summarize(0,0,'',p)
    def test_partial_or_fake_receipt(self):
        for k in ('codec_claim','codec_assertion','native','schema','claims'):
            with self.subTest(k=k):
                p=valid(); del p[k]
                with self.assertRaises(ValueError): summarize(0,0,'',p)
    def test_codec_failure_not_overruled_by_native(self):
        p=valid(); p['codec_claim']['status']='LOSSY'
        self.assertEqual(summarize(0,0,'',p)['classification'],'CODEC_ROUNDTRIP_FAILED')
    def test_valid_fixture_png(self):
        self.assertEqual(png(),png()); self.assertTrue(png().startswith(b'\x89PNG\r\n\x1a\n'))

if __name__=='__main__': unittest.main(verbosity=2)
