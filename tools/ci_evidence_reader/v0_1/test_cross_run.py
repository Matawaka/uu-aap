# SPDX-License-Identifier: Apache-2.0
"""Finite cross-version tests; all generated evidence here is synthetic."""
from __future__ import annotations
import copy
import importlib.util
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent

def load(name):
    spec = importlib.util.spec_from_file_location('cross_' + name, HERE / (name + '.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

f = load('test_reader'); x = load('compare'); r = x.r
R1 = 'ha1-ci/pre-import-boundary-v0.1'
R2 = 'ha1-ci/import-boundary-r2/v0.1'

def rewrite(e, c, blobs, fn):
    for job in e['jobs']:
        slot=job['slot']; files=r.zip_members(blobs[slot])
        report=json.loads(files['ci-report.json']); fn(report)
        files['ci-report.json']=f.dump(report); blobs[slot]=f.archive(files)
        job['archive_sha256']=r.sha(blobs[slot])
        next(a for a in c['artifacts']['rows'] if a['id']==job['artifact_id'])['archive_sha256']=job['archive_sha256']

def old_fixture():
    e,c,b=f.fixture();e['report_profile']=R1
    e['source_pins']=dict(list(e['source_pins'].items())[:12]);e['import_surface']=[]
    e['test_ids']['ci_gate_tests']=e['test_ids']['ci_gate_tests'][:31]
    def update(report):
        report['source_pins']=e['source_pins'];report['hash_seed']='1'
        report.pop('import_surface');report.pop('isolated_python')
        report['checks']['ci_gate_tests']['tests']=31
        report['checks']['ci_gate_tests']['executed_ids']=e['test_ids']['ci_gate_tests']
    rewrite(e,c,b,update)
    return e,c,b

def pack(obj):return f.dump(obj[0]), f.dump(obj[1]), obj[2]

def second_run(obj):
    e,c,b=copy.deepcopy(obj);e['run_id']+=1;c['run']['id']=e['run_id']
    e['source_sha']='d'*40;e['source_tree']='e'*40;c['run']['source_sha']=e['source_sha']
    for j in e['jobs']:j['job_id']+=100;j['artifact_id']+=100
    for j in c['jobs']['rows']:j.update(id=j['id']+100,run_id=e['run_id'],source_sha=e['source_sha'])
    for a in c['artifacts']['rows']:a.update(id=a['id']+100,run_id=e['run_id'],source_sha=e['source_sha'])
    rewrite(e,c,b,lambda q:q.update(run_id=str(e['run_id']),source_sha=e['source_sha'],source_tree=e['source_tree']))
    return e,c,b

class ProfileTests(unittest.TestCase):
    def test_r1_explicit_matches(self):self.assertEqual(r.assess(*pack(old_fixture()))['status'],r.GOOD)
    def test_r1_no_automatic_downgrade(self):
        e,c,b=old_fixture();e.pop('report_profile');self.assertNotEqual(r.assess(*pack((e,c,b)))['status'],r.GOOD)
    def test_unknown_selector_refused(self):
        e,c,b=f.fixture();e['report_profile']='made-up';self.assertNotEqual(r.assess(*pack((e,c,b)))['status'],r.GOOD)
    def test_r2_explicit_unchanged(self):
        e,c,b=f.fixture();e['report_profile']=R2;self.assertEqual(r.assess(*pack((e,c,b)))['status'],r.GOOD)
    def test_r1_limit_is_visible(self):
        out=r.assess(*pack(old_fixture()));self.assertEqual(out['report_profile'],R1)
        self.assertIn('historical_import_boundary_not_established',out['profile_limits'])
        self.assertEqual(out['expected_distinct_methods'],145)
    def test_r2_limits_preserved(self):
        out=r.assess(*pack(f.fixture()));self.assertEqual(out['report_profile'],R2)
        self.assertNotIn('historical_import_boundary_not_established',out['profile_limits'])
        self.assertEqual(out['expected_distinct_methods'],160)
    def test_r1_retains_assurance_gaps(self):
        out=r.assess(*pack(old_fixture()));self.assertEqual(out['gaps'],r.GAPS)
        self.assertEqual(out['workflow_assurance'],'INSUFFICIENT_EVIDENCE')
    def test_r1_cannot_claim_r2_fields(self):
        e,c,b=old_fixture();rewrite(e,c,b,lambda q:q.update(isolated_python=True))
        self.assertNotEqual(r.assess(*pack((e,c,b)))['status'],r.GOOD)
    def test_r2_missing_isolation_never_r1(self):
        e,c,b=f.fixture();rewrite(e,c,b,lambda q:q.pop('isolated_python'))
        out=r.assess(*pack((e,c,b)));self.assertNotEqual(out['status'],r.GOOD);self.assertEqual(out['report_profile'],R2)
    def test_r1_test_skip_detected(self):
        e,c,b=old_fixture();rewrite(e,c,b,lambda q:q['checks']['ci_gate_tests'].update(skipped=1))
        self.assertEqual(r.assess(*pack((e,c,b)))['status'],r.BAD)
    def test_r1_unpinned_extra_source_refused(self):
        e,c,b=old_fixture();e['source_pins']['extra.py']='a'*64
        self.assertNotEqual(r.assess(*pack((e,c,b)))['status'],r.GOOD)
    def test_r1_hash_seed_bound(self):
        e,c,b=old_fixture();rewrite(e,c,b,lambda q:q.update(hash_seed='other'))
        self.assertEqual(r.assess(*pack((e,c,b)))['status'],r.BAD)
    def test_r1_pure(self):
        p=pack(old_fixture())
        with patch('builtins.open',side_effect=AssertionError('I/O')),patch('socket.socket',side_effect=AssertionError('network')):
            self.assertEqual(r.assess(*p)['status'],r.GOOD)
    def test_r1_input_unchanged(self):
        p=pack(old_fixture());saved=copy.deepcopy(p);r.assess(*p);self.assertEqual(p,saved)
    def test_r1_html_exposes_limit(self):
        self.assertIn('историческ',r.render_html(r.assess(*pack(old_fixture()))).lower())

class CrossRunTests(unittest.TestCase):
    def test_two_profiles_match_separately(self):
        out=x.compare_packages(pack(old_fixture()),pack(second_run(f.fixture())))
        self.assertEqual(out['status'],'OBSERVED_CHANGE')
        self.assertEqual(out['scope'],'DISTINCT_EXECUTIONS_LOGICALLY_PAIRED')
        self.assertTrue(all(not j['same_execution_identity'] for j in out['jobs']))
    def test_profile_change_disclosed(self):
        out=x.compare_packages(pack(old_fixture()),pack(second_run(f.fixture())))
        self.assertIn('report_profile',[c['code'] for c in out['changes']])
    def test_added_test_ids_exposed(self):
        out=x.compare_packages(pack(old_fixture()),pack(second_run(f.fixture())))
        delta=out['inventory_delta']['test_ids']['ci_gate_tests']
        self.assertEqual((delta['before_count'],delta['after_count']), (31,46))
        self.assertEqual(len(delta['added']),15);self.assertEqual(delta['removed'],[])
    def test_unchanged_ha1_ids_exposed(self):
        out=x.compare_packages(pack(old_fixture()),pack(second_run(f.fixture())))
        self.assertEqual(out['inventory_delta']['test_ids']['ha1_tests']['added'],[])
    def test_recorded_failure_not_lost_archive(self):
        before=f.fixture();after=second_run(before);after[1]['run']['conclusion']='failure'
        out=x.compare_packages(pack(before),pack(after))
        self.assertEqual(out['status'],'RECORDED_CI_FAILURE')
        self.assertEqual(out['assessments']['after']['status'],r.FAIL)
    def test_recorded_recovery_not_proven_fix(self):
        before=f.fixture();before[1]['run']['conclusion']='failure';after=second_run(f.fixture())
        out=x.compare_packages(pack(before),pack(after));self.assertEqual(out['status'],'RECORDED_CI_RECOVERY')
        self.assertFalse(out['proves_code_regression_or_fix'])
    def test_real_missing_archive_stays_loss(self):
        before=pack(f.fixture());after=(*before[:2],{})
        self.assertEqual(x.compare_packages(before,after)['status'],'EVIDENCE_LOSS')
    def test_failure_with_missing_artifact_keeps_both_facts(self):
        before=f.fixture();after=second_run(before);after[1]['run']['conclusion']='failure';after[2].pop('py313')
        out=x.compare_packages(pack(before),pack(after));self.assertEqual(out['status'],'RECORDED_CI_FAILURE')
        self.assertIn('archive_missing',[v['code'] for v in out['assessments']['after']['checks']])
    def test_bad_digest_not_called_failure(self):
        before=pack(f.fixture());after=(*before[:2],{'py312':b'bad','py313':before[2]['py313']})
        self.assertEqual(x.compare_packages(before,after)['status'],'EVIDENCE_LOSS')
    def test_order_only_delta_empty(self):
        before=f.fixture();after=copy.deepcopy(before);after[0]['test_ids']['ci_gate_tests'].reverse()
        out=x.compare_packages(pack(before),pack(after));self.assertEqual(out['status'],'NO_OBSERVED_CHANGE')
        self.assertEqual(out['inventory_delta']['test_ids']['ci_gate_tests']['added'],[])
    def test_html_no_false_same_execution(self):
        out=x.compare_packages(pack(old_fixture()),pack(second_run(f.fixture())))
        rendered=x.render_html(out);self.assertNotIn('<script',rendered);self.assertIn('31',rendered);self.assertIn('46',rendered);self.assertIn('не фиксировался',rendered)
    def test_incomplete_html_not_reassuring(self):
        out=x.compare_packages((b'{}',b'{}',{}),pack(f.fixture()))
        self.assertNotIn('Изменений в проверяемом составе не выявлено',x.render_html(out))
    def test_no_new_authority(self):
        out=x.compare_packages(pack(old_fixture()),pack(second_run(f.fixture())))
        self.assertTrue(all(v is False for v in out['non_effects'].values()))

class SmokeExpectationTests(unittest.TestCase):
    def test_frozen_manifest_generates_r2_only(self):
        smoke=load('prepare_smoke');e=smoke.expectation(HERE.parents[2])
        r.valid_expectation(e)
        self.assertEqual(e['source_sha'],smoke.SOURCE)
        self.assertEqual(e['run_id'],36316768214)
        self.assertEqual(len(e['test_ids']['ci_gate_tests']),46)
    def test_missing_manifest_not_reconstructed(self):
        smoke=load('prepare_smoke')
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):smoke.expectation(Path(tmp))
    def test_altered_manifest_not_admitted(self):
        smoke=load('prepare_smoke')
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)/smoke.PREFIX/'manifest.json';dest.parent.mkdir(parents=True);dest.write_bytes(b'{}')
            with self.assertRaisesRegex(ValueError,'historical_manifest_changed'):smoke.expectation(Path(tmp))

if __name__ == '__main__':unittest.main(verbosity=2)
