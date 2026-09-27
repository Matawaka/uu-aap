# SPDX-License-Identifier: Apache-2.0
"""Finite authored tests; synthetic captures are NOT evidence of a GitHub run."""
from __future__ import annotations
import copy
import importlib.util
import io
import json
from pathlib import Path
import stat
import unittest
from unittest.mock import patch
import warnings
import zipfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ci_capture_reader',HERE/'reader.py')
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)


def dump(obj): return (json.dumps(obj,sort_keys=True)+'\n').encode()


def archive(files):
    b=io.BytesIO()
    with zipfile.ZipFile(b,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,data in files.items(): z.writestr(name,data)
    return b.getvalue()


def fixture():
    """Authored synthetic input; no source data is imported or authenticated here."""
    h=lambda label:r.sha(label.encode())
    source='a'*40
    tests={'ha1_tests':['test_adversarial.Group.test_target']+[f'test_reducer.Group.test_{i:03}' for i in range(113)],'ci_gate_tests':[f'test_ci_gate.Group.test_{i:03}' for i in range(46)]}
    expected={'schema':'matawaka.ci-reader.expectation/v0.1','repository':'example/project','repository_id':1,'run_id':20,'attempt':1,'source_sha':source,'source_tree':'b'*40,'workflow_path':'.github/workflows/harness-assurance-v0.1.yml','event':'pull_request','source_checkpoint':'c'*40,'source_pins':{f'file{i}.py':h(str(i)) for i in range(14)},'ci_source_hashes':{f'ci{i}.py':h('ci'+str(i)) for i in range(4)},'import_surface':[f'file{i}.py' for i in range(8)],'test_ids':tests,'mutants':{'original_mutants':[f'm{i}' for i in range(7)],'review_mutants':[f'r{i}' for i in range(8)]},'jobs':[]}
    capture={'schema':'matawaka.ci-reader.capture/v0.1','provenance':{'method':'CONNECTOR_GET_SELECTED_FIELDS_MANUAL_PROJECTION','raw_http_bytes_retained':False},'run':{'id':20,'attempt':1,'source_sha':source,'repository_id':1,'workflow_path':expected['workflow_path'],'event':'pull_request','status':'completed','conclusion':'success'},'jobs':{'total_count':2,'rows':[]},'artifacts':{'total_count':2,'rows':[]}}
    blobs={}
    for i,(slot,version) in enumerate([('py312','3.12'),('py313','3.13')]):
        job={'slot':slot,'job_id':30+i,'name':'HA-1 / Python '+version,'python_prefix':version,'artifact_id':40+i,'artifact_name':f'fixture-{slot}','archive_sha256':'','execution_step':'Execute exact HA-1 inventory and CI guard checks'}
        checks={k:{'tests':len(ids),'failures':0,'errors':0,'skipped':0,'expected_failures':0,'unexpected_successes':0,'executed_ids':ids} for k,ids in tests.items()}
        for key,ids in expected['mutants'].items():
            rows=[]
            for name in ids:
                row={'mutation':name,'killed':True}
                row.update({'caught_by_cases':['HA-P01']} if key=='original_mutants' else {'target_test':'Group.test_target','baseline_satisfied':True,'assertion_failures':1,'errors':0})
                rows.append(row)
            checks[key]={'count':len(ids),'detected':len(ids),'sample':rows,'coverage_percentage_claimed':False}
        checks['historical_design']={'result':'DESIGN_DATA_CHECKS_PASS','mutations_rejected':10,'scope':'STATIC_DESIGN_ONLY'}
        files={'ha1-tests.log':b'synthetic log, not a historical run\n','ci-gate-tests.log':b'synthetic wrapper log\n','ha0-design.json':dump({'result':'DESIGN_DATA_CHECKS_PASS','design_mutations_rejected':10,'operational_cases_executed':0,'target_controls_executed':0,'independent_review_performed':False})}
        report={'schema':'matawaka.ha1.ci-execution/v0.1','status':'CI_CHECKS_PASS','scope':'SYNTHETIC_TEST_EXECUTION_NOT_INDEPENDENT_REVIEW','non_effects':dict(r.REPORT_NON_EFFECTS),'source_sha':source,'source_tree':expected['source_tree'],'run_id':'20','run_attempt':'1','python':version+'.1 fixture','platform':'linux','hash_seed':'RANDOMIZED_ISOLATED','isolated_python':True,'source_checkpoint':expected['source_checkpoint'],'source_pins':expected['source_pins'],'ci_source_hashes':expected['ci_source_hashes'],'import_surface':expected['import_surface'],'checks':checks,'log_hashes':{k:r.sha(v) for k,v in files.items()}}
        files['ci-report.json']=dump(report); blobs[slot]=archive(files);job['archive_sha256']=r.sha(blobs[slot]);expected['jobs'].append(job)
        capture['jobs']['rows'].append({'id':job['job_id'],'name':job['name'],'run_id':20,'attempt':1,'source_sha':source,'status':'completed','conclusion':'success','steps':[{'name':job['execution_step'],'status':'completed','conclusion':'success'}]})
        capture['artifacts']['rows'].append({'id':job['artifact_id'],'name':job['artifact_name'],'run_id':20,'source_sha':source,'repository_id':1,'archive_sha256':job['archive_sha256'],'expired':False})
    return expected,capture,blobs


class ReaderTests(unittest.TestCase):
    def setUp(self): self.e,self.c,self.b=fixture()
    def run_read(self): return r.assess(dump(self.e),dump(self.c),self.b)
    def expect(self,status,code=None):
        out=self.run_read();self.assertEqual(out['status'],status)
        if code:self.assertIn(code,[x['code'] for x in out['checks']])
        return out
    def repin(self,data,slot='py312'):
        self.b[slot]=data
        next(j for j in self.e['jobs'] if j['slot']==slot)['archive_sha256']=r.sha(data)
        i=0 if slot=='py312' else 1;self.c['artifacts']['rows'][i]['archive_sha256']=r.sha(data)
    def change_report(self,fn):
        files=r.zip_members(self.b['py312']);obj=json.loads(files['ci-report.json']);fn(obj);files['ci-report.json']=dump(obj);self.repin(archive(files))
    def test_positive_capture(self):
        out=self.expect(r.GOOD);self.assertEqual(out['expected_distinct_methods'],160)
        self.assertEqual(out['workflow_assurance'],'INSUFFICIENT_EVIDENCE');self.assertEqual(len(out['gaps']),7)
    def test_no_permission_even_on_success(self): self.assertTrue(all(v is False for v in self.expect(r.GOOD)['non_effects'].values()))
    def test_input_immutable(self):
        before=copy.deepcopy((self.e,self.c,self.b));self.run_read();self.assertEqual(before,(self.e,self.c,self.b))
    def test_replay_identical(self): self.assertEqual(self.run_read(),self.run_read())
    def test_pure_no_io(self):
        e,c=dump(self.e),dump(self.c)
        with patch('builtins.open',side_effect=AssertionError('file I/O')),patch('socket.socket',side_effect=AssertionError('network')):
            self.assertEqual(r.assess(e,c,self.b)['status'],r.GOOD)
    def test_reordered_metadata(self):
        self.c['jobs']['rows'].reverse();self.c['artifacts']['rows'].reverse();self.expect(r.GOOD)
    def test_missing_job(self): self.c['jobs']['rows'].pop();self.expect(r.GAP,'missing_jobs')
    def test_extra_job(self):
        j=copy.deepcopy(self.c['jobs']['rows'][0]);j['id']=99;self.c['jobs']['rows'].append(j);self.c['jobs']['total_count']=3;self.expect(r.BAD,'unexpected_jobs')
    def test_duplicate_job(self): self.c['jobs']['rows'][1]=copy.deepcopy(self.c['jobs']['rows'][0]);self.expect(r.GAP,'input_invalid')
    def test_foreign_job_attempt(self): self.c['jobs']['rows'][0]['attempt']=2;self.expect(r.BAD,'job_attempt')
    def test_foreign_job_source(self): self.c['jobs']['rows'][0]['source_sha']='d'*40;self.expect(r.BAD,'job_source_sha')
    def test_foreign_run(self): self.c['run']['id']=21;self.expect(r.BAD,'run_id')
    def test_foreign_repository(self): self.c['run']['repository_id']=2;self.expect(r.BAD,'run_repository_id')
    def test_null_run_conclusion(self): self.c['run']['conclusion']=None;self.expect(r.GAP)
    def test_boolean_run_id_not_int(self): self.c['run']['id']=True;self.expect(r.BAD)
    def test_skipped_execution(self): self.c['jobs']['rows'][0]['steps'][0]['conclusion']='skipped';self.expect(r.GAP,'success_not_established')
    def test_missing_execution_step(self): self.c['jobs']['rows'][0]['steps']=[];self.expect(r.GAP,'execution_step_missing')
    def test_pending_job(self): self.c['jobs']['rows'][0]['status']='in_progress';self.expect(r.GAP,'not_completed')
    def test_failure_survives_missing_artifact(self):
        self.c['jobs']['rows'][0]['conclusion']='failure';self.b.pop('py313');out=self.expect(r.FAIL);self.assertIn('archive_missing',[x['code'] for x in out['checks']])
    def test_report_only_no_job_proof(self): self.c['jobs']['rows']=[];self.expect(r.GAP)
    def test_capture_pagination(self): self.c['jobs']['total_count']=3;self.expect(r.GAP,'capture_pagination_incomplete')
    def test_missing_archive(self): self.b.pop('py312');self.expect(r.GAP,'archive_missing')
    def test_missing_artifact_metadata(self): self.c['artifacts']['rows'].pop();self.expect(r.GAP,'missing_artifacts')
    def test_artifact_foreign_source(self): self.c['artifacts']['rows'][0]['source_sha']='d'*40;self.expect(r.BAD,'artifact_source_sha')
    def test_tampered_archive(self): self.b['py312']+=b'changed';self.expect(r.BAD,'archive_digest')
    def test_retained_expired_is_usable(self): self.c['artifacts']['rows'][0]['expired']=True;self.assertTrue(self.expect(r.GOOD)['warnings'])
    def test_corrupt_zip(self): self.repin(b'not zip');self.expect(r.GAP,'artifact_uninterpretable')
    def test_empty_zip(self): self.repin(archive({}));self.expect(r.GAP,'archive_files_missing')
    def test_path_member(self): self.repin(archive({'../ci-report.json':b'{}'}));self.expect(r.GAP)
    def test_duplicate_zip_member(self):
        b=io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            with zipfile.ZipFile(b,'w') as z:z.writestr('ci-report.json',b'{}');z.writestr('ci-report.json',b'{}')
        self.repin(b.getvalue());self.expect(r.GAP)
    def test_symlink_member(self):
        b=io.BytesIO();info=zipfile.ZipInfo('ci-report.json');info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16
        with zipfile.ZipFile(b,'w') as z:z.writestr(info,b'/tmp/outside')
        self.repin(b.getvalue());self.expect(r.GAP)
    def test_oversized_member(self): self.repin(archive({'ci-report.json':b' '* (r.MAX_MEMBER+1)}));self.expect(r.GAP)
    def test_missing_report(self): self.repin(archive({'ha1-tests.log':b'only log'}));self.expect(r.GAP)
    def test_duplicate_json_key(self):
        files=r.zip_members(self.b['py312']);files['ci-report.json']=b'{"schema":"a","schema":"b"}';self.repin(archive(files));self.expect(r.GAP)
    def test_unknown_schema(self): self.change_report(lambda x:x.update(schema='other'));self.expect(r.GAP,'unsupported_report')
    def test_report_foreign_attempt(self): self.change_report(lambda x:x.update(run_attempt='2'));self.expect(r.BAD,'report_run_attempt')
    def test_report_foreign_tree(self): self.change_report(lambda x:x.update(source_tree='d'*40));self.expect(r.BAD,'report_source_tree')
    def test_source_pin_changed(self): self.change_report(lambda x:x['source_pins'].update({'file0.py':'0'*64}));self.expect(r.BAD,'report_source_pins')
    def test_source_pins_missing(self): self.change_report(lambda x:x.pop('source_pins'));self.expect(r.BAD,'report_source_pins')
    def test_missing_original_log(self):
        files=r.zip_members(self.b['py312']);del files['ha1-tests.log'];self.repin(archive(files));self.expect(r.GAP,'log_missing_ha1-tests.log')
    def test_tampered_log(self):
        files=r.zip_members(self.b['py312']);files['ha1-tests.log']=b'new';self.repin(archive(files));self.expect(r.BAD,'log_digest_ha1-tests.log')
    def test_test_count_wrong(self): self.change_report(lambda x:x['checks']['ha1_tests'].update(tests=0));self.expect(r.BAD)
    def test_partial_test_ids(self): self.change_report(lambda x:x['checks']['ha1_tests']['executed_ids'].pop());self.expect(r.BAD)
    def test_duplicate_test_ids(self): self.change_report(lambda x:x['checks']['ha1_tests']['executed_ids'].append(x['checks']['ha1_tests']['executed_ids'][0]));self.expect(r.GAP)
    def test_skip_is_not_pass(self): self.change_report(lambda x:x['checks']['ha1_tests'].update(skipped=1));self.expect(r.BAD)
    def test_bool_count_not_zero(self): self.change_report(lambda x:x['checks']['ha1_tests'].update(errors=False));self.expect(r.BAD)
    def test_mutant_survives(self): self.change_report(lambda x:x['checks']['review_mutants']['sample'][0].update(killed=False));self.expect(r.BAD,'mutation_survived')
    def test_mutant_error_not_detection(self): self.change_report(lambda x:x['checks']['review_mutants']['sample'][0].update(errors=1));self.expect(r.BAD,'mutation_unrelated_error')
    def test_mutant_baseline_false(self): self.change_report(lambda x:x['checks']['review_mutants']['sample'][0].update(baseline_satisfied=False));self.expect(r.BAD)
    def test_unknown_mutant_target(self): self.change_report(lambda x:x['checks']['review_mutants']['sample'][0].update(target_test='unknown'));self.expect(r.BAD)
    def test_authority_flag(self): self.change_report(lambda x:x['non_effects'].update(issues_permits=True));self.expect(r.BAD,'report_non_effects')
    def test_numeric_false_not_permission_boolean(self): self.change_report(lambda x:x['non_effects'].update(issues_permits=0));self.expect(r.BAD,'report_non_effects')
    def test_no_historical_promotion(self):
        files=r.zip_members(self.b['py312']);d=json.loads(files['ha0-design.json']);d['operational_cases_executed']=40;files['ha0-design.json']=dump(d)
        p=json.loads(files['ci-report.json']);p['log_hashes']['ha0-design.json']=r.sha(files['ha0-design.json']);files['ci-report.json']=dump(p)
        self.repin(archive(files));self.expect(r.BAD)
    def test_report_failure_recorded(self): self.change_report(lambda x:x.update(status='CI_CHECKS_FAIL'));self.expect(r.FAIL,'ci_report_failure')
    def test_unknown_python(self): self.change_report(lambda x:x.update(python='unknown'));self.expect(r.BAD,'interpreter_mismatch')
    def test_nonisolated(self): self.change_report(lambda x:x.update(isolated_python=False));self.expect(r.BAD)
    def test_empty_expected_inventory(self): self.e['test_ids']['ha1_tests']=[];self.expect(r.GAP,'input_invalid')
    def test_invalid_json(self): self.assertEqual(r.assess(b'{',dump(self.c),self.b)['status'],r.GAP)
    def test_invalid_unicode(self): self.assertEqual(r.assess(b'\xff',dump(self.c),self.b)['status'],r.GAP)
    def test_oversized_json(self): self.assertEqual(r.assess(b' '* (r.MAX_BYTES+1),dump(self.c),self.b)['status'],r.GAP)
    def test_no_secret_echo(self):
        self.change_report(lambda x:x.update(python='SECRET_SENTINEL_123'));out=self.run_read();self.assertNotIn('SECRET_SENTINEL_123',json.dumps(out))
    def test_html_no_script_or_raw_evidence(self):
        out=self.run_read();out['jobs'][0]['slot']='<script>alert(1)</script>';page=r.render_html(out)
        self.assertNotIn('<script>',page);self.assertIn('&lt;script&gt;',page);self.assertNotIn('synthetic log',page)
    def test_malformed_nested_records_are_nonpassing(self):
        for key in ('run','jobs','artifacts','provenance'):
            for bad in (None,0,[],True):
                with self.subTest(key=key,bad=bad):
                    e,c,b=fixture();c[key]=bad
                    self.assertNotEqual(r.assess(dump(e),dump(c),b)['status'],r.GOOD)
        for key in ('checks','log_hashes'):
            for bad in (None,0,[],True):
                with self.subTest(report_key=key,bad=bad):
                    self.e,self.c,self.b=fixture()
                    self.change_report(lambda x:x.update({key:bad}))
                    self.assertNotEqual(self.run_read()['status'],r.GOOD)

    def test_missing_job_assessment_is_explicit(self):
        self.b.pop('py312');out=self.expect(r.GAP);self.assertEqual(out['jobs'][0]['assessment'],r.GAP)


if __name__=='__main__': unittest.main(verbosity=2)
