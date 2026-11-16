import copy
import json
import importlib.machinery
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from jsonschema import Draft202012Validator

import run_replay_pilot as runner
from verify_evidence import (ASSURANCE, EvidenceError, HERE, ROLES, canonical,
                             digest, load_dispersed, read_json, verify)


class ReplayPilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        runner.check_sources()
        cls.protocol = read_json(HERE / 'protocol.json')
        cls.packs = {c['case_id']: runner.make_case(c['case_id']) for c in cls.protocol['cases']}

    def pack(self, case='P07'):
        return copy.deepcopy(self.packs[case])

    def status(self, p):
        return verify(p)['status']

    def test_preregistered_cases(self):
        for spec in self.protocol['cases']:
            with self.subTest(spec['case_id']):
                self.assertEqual(self.status(self.packs[spec['case_id']]), spec['expected_status'])

    def test_all_receipts_have_closed_assurance(self):
        schema = read_json(HERE / 'verification-receipt.schema.json')
        for p in self.packs.values():
            r = verify(p)
            Draft202012Validator(schema).validate(r)
            self.assertEqual(r['assurance'], ASSURANCE)
            self.assertFalse(any(r['assurance'].values()))

    def test_schemas_are_valid(self):
        for name in ['evidence-pack.schema.json', 'verification-receipt.schema.json']:
            Draft202012Validator.check_schema(read_json(HERE / name))

    def test_both_packaging_forms_replay_identically(self):
        with tempfile.TemporaryDirectory() as tmp:
            for case, pack in self.packs.items():
                dest = Path(tmp) / case
                runner.export_dispersed(pack, dest)
                self.assertEqual(verify(pack), verify(load_dispersed(dest)))

    def test_self_consistent_untrusted_rewrite_remains_untrusted(self):
        p = self.pack('P15')
        self.assertEqual(self.status(p), 'CONSISTENT_OBSERVATION_RECORD')
        self.assertEqual(verify(p)['assurance'], ASSURANCE)
        self.assertNotEqual(p['target'], self.packs['P07']['target'])

    def test_case_label_does_not_select_verdict(self):
        for case in ['P00', 'P01', 'P04', 'P07', 'P10', 'P12', 'P16']:
            p = self.pack(case)
            original = verify(p)
            p['case_id'] = 'P99'
            runner.seal_pack(p)
            changed = verify(p)
            self.assertEqual(changed['status'], original['status'])
            self.assertEqual(changed['reasons'], original['reasons'])

    def test_bad_case_id_still_emits_valid_receipt(self):
        p = self.pack('P00')
        p['case_id'] = 42
        runner.seal_pack(p)
        r = verify(p)
        self.assertEqual(r['status'], 'INVALID_EVIDENCE')
        self.assertIsNone(r['case_id'])
        Draft202012Validator(read_json(HERE / 'verification-receipt.schema.json')).validate(r)

    def test_nonmerge_conflicts_with_reported_merge(self):
        p = self.pack()
        p['observation'].update(status='NOT_MERGED', successor_commit=None, successor_parent=None)
        runner.seal(p['observation'])
        runner.seal_pack(p)
        self.assertEqual(self.status(p), 'EVIDENCE_CONFLICT')

    def test_unknown_outcome_cannot_carry_known_successor(self):
        p = self.pack()
        p['observation']['status'] = 'UNKNOWN'
        runner.seal(p['observation'])
        runner.seal_pack(p)
        self.assertEqual(self.status(p), 'INVALID_EVIDENCE')

    def test_unknown_extra_field_is_rejected(self):
        p = self.pack()
        p['execution_authorized'] = True
        runner.seal_pack(p)
        self.assertEqual(self.status(p), 'INVALID_EVIDENCE')

    def test_scope_string_must_match_exact_target(self):
        p = self.pack('P00')
        p['scenario']['authorized']['authority_scope'] = 'repository:Other/repo:pull_request:999:merge'
        p['harness_report'] = runner.harness_report(p['scenario'])
        runner.seal_pack(p)
        self.assertEqual(self.status(p), 'REPLAY_DENIED')

    def test_target_trailing_newline_is_invalid(self):
        p = self.pack('P00')
        for target in [p['target'], p['approval']['target'], p['permit']['target']]:
            target['repository'] = 'Matawaka/uu-aap\n'
        p['scenario']['authorized']['repository'] = 'Matawaka/uu-aap\n'
        p['scenario']['authorized']['authority_scope'] = 'repository:Matawaka/uu-aap\n:pull_request:999:merge'
        p['scenario']['current_state']['repository'] = 'Matawaka/uu-aap\n'
        runner.refresh_references(p)
        p['harness_report'] = runner.harness_report(p['scenario'])
        runner.seal_pack(p)
        self.assertEqual(self.status(p), 'INVALID_EVIDENCE')

    def test_boolean_is_not_pr_number(self):
        p = self.pack()
        p['target']['pr_number'] = True
        runner.seal_pack(p)
        self.assertEqual(self.status(p), 'INVALID_EVIDENCE')

    def test_nested_digest_tamper_is_not_hidden_by_outer_rehash(self):
        p = self.pack()
        p['approval']['approval_id'] = 'changed'
        runner.seal_pack(p)
        self.assertIn('APPROVAL_DIGEST_MISMATCH', verify(p)['reasons'])

    def test_wrong_report_rehash_is_not_harness_replay(self):
        p = self.pack('P01')
        p['harness_report'].update(decision='allow_plan', reasons=[])
        p['harness_report']['content_hash'] = digest({k:v for k,v in p['harness_report'].items() if k != 'content_hash'})[7:]
        runner.seal_pack(p)
        self.assertIn('HARNESS_REPLAY_MISMATCH', verify(p)['reasons'])

    def test_approval_expiry_is_exclusive(self):
        p = self.pack('P04')
        self.assertEqual(p['approval']['expires_at'], p['decision_time'])
        self.assertIn('APPROVAL_OUTSIDE_WINDOW', verify(p)['reasons'])

    def test_permit_expiry_is_checked_at_attempt_time(self):
        p = self.pack()
        p['attempts'][0]['started_at'] = p['permit']['expires_at']
        p['observation']['observed_at'] = '2026-11-16T01:00:10Z'
        runner.seal(p['attempts'][0]); runner.seal(p['observation']); runner.seal_pack(p)
        self.assertIn('PERMIT_EXPIRED_AT_ATTEMPT', verify(p)['reasons'])

    def test_invalid_calendar_date(self):
        p = self.pack('P00')
        p['decision_time'] = '2026-02-30T00:00:00Z'
        runner.seal_pack(p)
        self.assertIn('INVALID_CALENDAR_TIME', verify(p)['reasons'])

    def test_duplicate_attempt_ids(self):
        p = self.pack('P10')
        p['attempts'][1]['attempt_id'] = p['attempts'][0]['attempt_id']
        runner.seal(p['attempts'][1]); runner.seal_pack(p)
        self.assertEqual(self.status(p), 'INVALID_EVIDENCE')

    def test_source_binding_digest_is_checked(self):
        p = self.pack('P00')
        p['source_bindings_digest'] = 'sha256:' + '0' * 64
        runner.seal_pack(p)
        self.assertIn('SOURCE_BINDING_DIGEST_MISMATCH', verify(p)['reasons'])

    def test_no_retry_permission_for_unknown_effect(self):
        r = verify(self.pack('P12'))
        self.assertEqual(r['status'], 'EVIDENCE_INDETERMINATE')
        self.assertFalse(r['assurance']['execution_authorized'])

    def test_redaction_withholds_consistency_claim(self):
        self.assertEqual(self.status(self.pack('P16')), 'EVIDENCE_INDETERMINATE')

    def test_json_duplicate_keys_rejected(self):
        self.assert_read_error('{"status":0,"status":1}', 'DUPLICATE_JSON_KEY')

    def test_json_nonfinite_and_float_rejected(self):
        for text in ['{"n":NaN}', '{"n":Infinity}', '{"n":1.5}']:
            self.assert_read_error(text, 'NON_INTEGER_JSON_NUMBER')

    def test_large_integer_rejected(self):
        self.assert_read_error('{"n":9007199254740992}', 'JSON_INTEGER_OUT_OF_RANGE')

    def test_oversized_input_rejected(self):
        self.assert_read_error(' ' * 1048577, 'INPUT_TOO_LARGE')

    def assert_read_error(self, text, reason):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'input.json'
            p.write_text(text)
            with self.assertRaisesRegex(EvidenceError, reason):
                read_json(p)

    def test_symlink_input_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'input.json'
            p.write_text('{}')
            link = Path(tmp) / 'link.json'
            link.symlink_to(p)
            with self.assertRaisesRegex(EvidenceError, 'INPUT_NOT_REGULAR_FILE'):
                read_json(link)

    def test_dispersed_path_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'parts'
            runner.export_dispersed(self.pack(), dest)
            index = read_json(dest / 'index.json')
            index['files']['approval'] = '../elsewhere.json'
            (dest / 'index.json').write_text(json.dumps(index))
            with self.assertRaisesRegex(EvidenceError, 'DISPERSED_ROLE_MAP_MISMATCH'):
                load_dispersed(dest)

    def test_dispersed_extra_file_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'parts'
            runner.export_dispersed(self.pack(), dest)
            (dest / 'extra.json').write_text('{}')
            with self.assertRaisesRegex(EvidenceError, 'DISPERSED_FILE_SET_MISMATCH'):
                load_dispersed(dest)

    def test_dispersed_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'parts'
            runner.export_dispersed(self.pack(), dest)
            target = dest / 'approval.json'
            saved = Path(tmp) / 'saved.json'
            target.rename(saved); target.symlink_to(saved)
            with self.assertRaisesRegex(EvidenceError, 'DISPERSED_NON_REGULAR_FILE'):
                load_dispersed(dest)

    def test_writer_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'existing.json'
            p.write_text('original')
            with self.assertRaises(FileExistsError):
                runner.write_json(p, {'changed':True})
            self.assertEqual(p.read_text(), 'original')

    def test_source_drift_refuses_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(runner, 'ROOT', Path(tmp)):
                with self.assertRaisesRegex(EvidenceError, 'REPLAY_SOURCE_MISSING'):
                    runner.check_sources()

    def test_cli_verifies_exported_pack_offline(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'pack.json'
            runner.write_json(p, self.pack('P00'))
            result = subprocess.run([sys.executable, str(HERE/'verify_evidence.py'), '--pack', str(p)], text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads(result.stdout)['assurance'], ASSURANCE)

    def test_cli_malformed_input_is_safe(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'bad.json'
            p.write_text('{"api_token":"do-not-echo",')
            result = subprocess.run([sys.executable, str(HERE/'verify_evidence.py'), '--pack', str(p)], text=True, capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertNotIn('do-not-echo', result.stdout + result.stderr)

    def test_verifier_does_not_invoke_node_or_network(self):
        with patch('subprocess.run', side_effect=AssertionError('subprocess forbidden')):
            with patch('socket.socket', side_effect=AssertionError('network forbidden')):
                self.assertEqual(self.status(self.pack()), 'CONSISTENT_OBSERVATION_RECORD')

    def test_verifier_runs_outside_repository_without_node(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)
            for name in ['verify_evidence.py','evidence-pack.schema.json','source-bindings.json']:
                shutil.copyfile(HERE/name, dest/name)
            runner.write_json(dest/'pack.json', self.pack())
            env = dict(os.environ, PATH='')
            result = subprocess.run([sys.executable, str(dest/'verify_evidence.py'), '--pack', str(dest/'pack.json')], cwd=dest, env=env, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads(result.stdout)['status'], 'CONSISTENT_OBSERVATION_RECORD')

    def test_frozen_prototype_reproduces_semantic_defects(self):
        loader = importlib.machinery.SourceFileLoader('frozen_prototype', str(HERE/'evidence/prototype-verifier.py.txt'))
        spec = importlib.util.spec_from_loader(loader.name, loader)
        prototype = importlib.util.module_from_spec(spec)
        loader.exec_module(prototype)
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)
            shutil.copyfile(HERE/'evidence/prototype-evidence-pack.schema.json', dest/'evidence-pack.schema.json')
            shutil.copyfile(HERE/'source-bindings.json',dest/'source-bindings.json')
            prototype.HERE = dest
            p = self.pack(); p['observation'].update(status='NOT_MERGED', successor_commit=None, successor_parent=None)
            runner.seal(p['observation']); runner.seal_pack(p)
            self.assertEqual(prototype.verify(p)['status'], 'CONSISTENT_OBSERVATION_RECORD')
            self.assertEqual(verify(p)['status'], 'EVIDENCE_CONFLICT')
            p = self.pack(); p['observation']['status'] = 'UNKNOWN'
            runner.seal(p['observation']); runner.seal_pack(p)
            self.assertEqual(prototype.verify(p)['status'], 'EVIDENCE_INDETERMINATE')
            self.assertEqual(verify(p)['status'], 'INVALID_EVIDENCE')

    def test_external_measurement_inflation_is_rejected(self):
        schema = read_json(HERE/'replay-result.schema.json')
        result = read_json(HERE/'reference-results.json')
        result['external_evaluation']['vendor_execution'] = 'EXECUTED'
        result['external_evaluation']['reconstruction_seconds'] = 0
        self.assertTrue(list(Draft202012Validator(schema).iter_errors(result)))


if __name__ == '__main__':
    unittest.main()
