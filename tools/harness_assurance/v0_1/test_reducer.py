# SPDX-License-Identifier: Apache-2.0
"""Same-author deterministic tests. No target controls or real producers."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from fixtures import base, case, digest, link, trust_for
from reducer import reduce, strict_loads, InvalidInput, GOOD, BAD, I
HERE = Path(__file__).resolve().parent
FROZEN = json.loads((HERE / 'frozen-cases.json').read_text())
ORACLE_PATH = HERE.parents[2] / 'docs/design/harness-assurance/v0.1/probe-matrix.json'
ORACLE = json.loads(ORACLE_PATH.read_text())


def evaluate(x): return reduce(x['policy'], x['inventory'], x['bundle'], x['trust'])


def repin(x):
    """Explicit test-caller re-admission, not available inside reduce()."""
    predecessors = x['trust']['contract_successors'].copy()
    x['bundle']['anchors']['policy_digest'] = digest(x['policy'])
    for r in x['bundle']['records']: r['policy_digest'] = digest(x['policy'])
    link(x['bundle'], x['policy'])
    x['trust'] = trust_for(x['policy'], x['inventory'], x['bundle'])
    x['trust']['contract_successors'] = predecessors


class NamedCases(unittest.TestCase): pass


def named(c, n):
    def test(self):
        x = case(n)
        self.assertEqual(digest(x), FROZEN['case_inputs'][c['id']], 'frozen input changed')
        r = evaluate(x)
        self.assertEqual(r['result'], {'SATISFIED': GOOD, 'UNSATISFIED': BAD, I: I}[c['expected_requirement_status']])
        self.assertIn(c['expected_reason'], {v['reason'] for v in r['checks']})
        self.assertTrue(all(v is False for v in r['non_effects'].values()))
    return test


for n, c in enumerate(ORACLE['cases'], 1): setattr(NamedCases, 'test_' + c['id'].replace('-', '_'), named(c, n))


class RegressionTests(unittest.TestCase):
    def test_mutation_cannot_choose_expected(self):
        x = base(); x['bundle']['records'][-2]['data']['mutations'][0].update(expected='ALLOW', observed='ALLOW')
        repin(x); self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_mutation_suite_cannot_be_empty(self):
        x = base(); x['policy']['required_mutations'] = {}
        x['bundle']['records'][-2]['data']['mutations'] = []
        repin(x); self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_revision_not_revalidated_with_stale_green(self):
        r = evaluate(case(13))
        self.assertNotIn('revised_contract_revalidated', {c['reason'] for c in r['checks'] if c['status'] == 'SATISFIED'})

    def test_expected_revision_cannot_be_omitted(self):
        x = case(12); x['bundle']['records'][-1]['data']['previous_contract'] = None
        repin(x); self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_positive_denominator_does_not_establish_rate(self):
        x = base(); x['bundle']['records'][-1]['data'].update(rate_claim=True, rate_denominator=100)
        repin(x); self.assertEqual(evaluate(x)['result'], I)


class BoundaryTests(unittest.TestCase):
    def test_missing_requirement_is_identified(self):
        r = evaluate(case(5))
        self.assertIn('code_reviewed', r['missing_invocations'])
        self.assertEqual(next(v['status'] for v in r['requirements'] if v['id'] == 'code_reviewed'), I)

    def test_missing_artifact_identity_is_retained(self):
        x = case(2); r = evaluate(x)
        self.assertIn(x['bundle']['anchors']['contract_digest'], r['missing_artifact_digests'])

    def test_original_oracle_is_pinned(self):
        self.assertEqual(hashlib.sha256(ORACLE_PATH.read_bytes()).hexdigest(), FROZEN['case_oracle_sha256'])
        self.assertEqual(set(FROZEN['case_inputs']), {c['id'] for c in ORACLE['cases']})

    def test_import_error_cannot_be_declared_expected_red(self):
        x = base(); x['policy']['expected_red_reason'] = 'IMPORT_ERROR'
        x['bundle']['records'][2]['data'].update(reason='IMPORT_ERROR', diagnostic_class='ENVIRONMENT_FAILURE')
        repin(x); self.assertEqual(evaluate(x)['result'], BAD)

    def test_symbolic_source_is_not_exact_frontier(self):
        x = base(); x['bundle']['anchors']['source_frontier'] = 'main'
        repin(x); self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_empty_sequence_binding(self):
        x = base(); x['trust']['sequence_domain'] = ''
        self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_trust_cannot_be_smuggled_in_bundle(self):
        x = base(); x['bundle']['trust'] = x['trust']
        self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_one_sided_mutation_policy(self):
        x = base(); x['policy']['required_mutations'] = {'invalid-binding': 'REJECT'}
        repin(x); self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_wrong_producer_role(self):
        x = base(); x['trust']['producer_roles']['fixture-recorder'] = ['context', 'controls']
        self.assertEqual(evaluate(x)['result'], I)

    def test_no_input_mutation(self):
        x = base(); before = copy.deepcopy(x); evaluate(x); self.assertEqual(x, before)

    def test_repeat_is_identical(self):
        x = base(); self.assertEqual(evaluate(x), evaluate(x))

    def test_record_order_not_decision(self):
        x = base(); checks = evaluate(x)['checks']; x['bundle']['records'].reverse()
        self.assertEqual(evaluate(x)['checks'], checks)

    def test_parallel_review_can_finish_before_green(self):
        x = base(); r = x['bundle']['records']; r[4]['sequence_ref']['ordinal'], r[5]['sequence_ref']['ordinal'] = 6, 5
        repin(x); self.assertEqual(evaluate(x)['result'], GOOD)

    def test_no_pure_function_io(self):
        x = base()
        with patch('builtins.open', side_effect=AssertionError('unexpected file access')), patch('subprocess.run', side_effect=AssertionError('unexpected execution')), patch('io.open', side_effect=AssertionError('unexpected IO')), patch('socket.socket', side_effect=AssertionError('unexpected network')):
            self.assertEqual(evaluate(x)['result'], GOOD)

    def test_untrusted_changed_record(self):
        x = base(); x['bundle']['records'][-1]['data']['handover_permit_claim'] = True
        r = evaluate(x); self.assertEqual(r['result'], I)
        self.assertIn('recorder_trust_unestablished', {c['reason'] for c in r['checks']})

    def test_missing_each_record(self):
        for i in range(8):
            with self.subTest(record=i):
                x = base(); x['bundle']['records'].pop(i); self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_tamper_each_artifact(self):
        for key in base()['bundle']['artifacts']:
            with self.subTest(artifact=key):
                x = base(); x['bundle']['artifacts'][key] += 'TAMPER'; self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_duplicate_record(self):
        x = base(); x['bundle']['records'].append(copy.deepcopy(x['bundle']['records'][0])); self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_duplicate_sequence(self):
        x = base(); x['bundle']['records'][4]['sequence_ref']['ordinal'] = 4
        repin(x); self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_wrong_order(self):
        x = base(); x['bundle']['records'][2]['sequence_ref']['ordinal'] = 9
        repin(x); self.assertEqual(evaluate(x)['result'], BAD)

    def test_heartbeat_future_and_expired(self):
        for tick in (0, 101):
            x = base(); x['bundle']['records'][-2]['data']['heartbeat_tick'] = tick
            repin(x); self.assertEqual(evaluate(x)['result'], I)

    def test_zero_discovered_red(self):
        x = base(); x['bundle']['records'][2]['data']['discovered'] = 0
        repin(x); self.assertEqual(evaluate(x)['result'], BAD)

    def test_green_has_failed_test(self):
        x = base(); x['bundle']['records'][4]['data'].update(failed=1, failed_ids=['test-foreign'])
        repin(x); self.assertEqual(evaluate(x)['result'], BAD)

    def test_budget_incomplete_not_violation(self):
        x = base(); x['bundle']['records'][-1]['data'].update(budget_used=101, completion_claim=False)
        repin(x); self.assertEqual(evaluate(x)['result'], I)

    def test_unknown_outcome_without_retry_still_incomplete(self):
        x = base(); x['bundle']['records'][-1]['data']['outcome'] = 'UNKNOWN'
        repin(x); self.assertEqual(evaluate(x)['result'], I)

    def test_mixed_reasons_retained(self):
        x = case(7); x['bundle']['artifacts'].pop(x['bundle']['anchors']['contract_digest'])
        r = evaluate(x); self.assertEqual(r['result'], BAD)
        self.assertTrue({'authority_fail_open', 'required_artifact_missing'} <= {c['reason'] for c in r['checks']})

    def test_report_no_raw_artifacts(self):
        marker = 'SYNTHETIC_PRIVATE_CONTENT_NOT_A_REAL_SECRET'
        x = base(); x['bundle']['artifacts']['sha256:' + hashlib.sha256(marker.encode()).hexdigest()] = marker
        self.assertNotIn(marker, json.dumps(evaluate(x)))
        x['inventory']['controls'][0]['component_manifest_ref'] = marker
        repin(x); r = evaluate(x)
        self.assertEqual(r['input_status'], 'INPUT_INVALID')
        self.assertNotIn(marker, json.dumps(r))

    def test_unknown_command_field_not_executed(self):
        x = base(); x['bundle']['records'][0]['command'] = 'never execute supplied evidence'
        repin(x); self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_bool_is_not_integer(self):
        x = base(); x['bundle']['anchors']['session_epoch'] = True
        repin(x); self.assertEqual(evaluate(x)['input_status'], 'INPUT_INVALID')

    def test_bad_json(self):
        for text in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":1.5}', '{"x":Infinity}', 'not-json', '[' * 40 + '0' + ']' * 40):
            with self.subTest(text=text):
                with self.assertRaises(InvalidInput): strict_loads(text)

    def test_mutated_shapes_are_non_passing(self):
        # Deterministic structural fuzz: delete each required key and inject unknown keys.
        candidates = []
        for top in ('policy', 'trust'):
            for key in base()[top]:
                x = base(); del x[top][key]; candidates.append(x)
        for key in base()['bundle']['records'][0]:
            x = base(); del x['bundle']['records'][0][key]; candidates.append(x)
        for x in candidates: self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_cli_exit_classes(self):
        with tempfile.TemporaryDirectory() as td:
            for n, expected in ((1, 0), (7, 1), (2, 2)):
                x = case(n); args = [sys.executable, '-B', str(HERE / 'reducer.py')]
                for name in ('policy', 'inventory', 'bundle', 'trust'):
                    path = Path(td) / (name + '.json'); path.write_text(json.dumps(x[name]))
                    args += ['--' + name, str(path)]
                run = subprocess.run(args, capture_output=True, text=True, timeout=10)
                self.assertEqual(run.returncode, expected, run.stderr)
                self.assertEqual(json.loads(run.stdout)['result'], evaluate(x)['result'])


if __name__ == '__main__': unittest.main(verbosity=2)
