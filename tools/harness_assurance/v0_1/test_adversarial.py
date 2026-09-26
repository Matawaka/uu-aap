# SPDX-License-Identifier: Apache-2.0
"""Same-assistant HA-1 R1 review regressions. Synthetic data, no live trust.

Freeze before patching reducer.py. Caller re-pinning admits malformed observations
for assessment; it does not certify their assertions or establish real execution.
"""
import copy
import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from fixtures import base, case, digest, link, trust_for
from reducer import reduce, strict_loads, InvalidInput, GOOD, BAD, I


def evaluate(x):
    return reduce(x['policy'], x['inventory'], x['bundle'], x['trust'])


def repin(x):
    successors = x['trust']['contract_successors'].copy()
    x['bundle']['anchors']['policy_digest'] = digest(x['policy'])
    for record in x['bundle']['records']:
        record['policy_digest'] = digest(x['policy'])
    link(x['bundle'], x['policy'])
    x['trust'] = trust_for(x['policy'], x['inventory'], x['bundle'])
    x['trust']['contract_successors'] = successors


class LifecycleReview(unittest.TestCase):
    def context_check(self, values, result, reason):
        x = base()
        x['bundle']['records'][-1]['data'].update(values)
        repin(x)
        report = evaluate(x)
        self.assertEqual(report['result'], result)
        self.assertIn(reason, {c['reason'] for c in report['checks']})

    def test_stop_advance_without_restart(self):
        self.context_check(dict(human_stop=True, advanced=True), BAD, 'human_stop_bypassed')

    def test_stop_without_restart_is_incomplete(self):
        self.context_check(dict(human_stop=True, completion_claim=False), I, 'human_stop_latched')

    def test_stop_cannot_claim_completion(self):
        self.context_check(dict(human_stop=True), BAD, 'human_stop_bypassed')

    def test_blocked_without_advance_is_incomplete(self):
        self.context_check(dict(blocked_dependencies=['task-0'], completion_claim=False), I, 'dependency_unresolved')

    def test_blocked_cannot_claim_completion(self):
        self.context_check(dict(blocked_dependencies=['task-0']), BAD, 'blocked_dependency_ignored')

    def test_explicit_incomplete_does_not_satisfy(self):
        self.context_check(dict(completion_claim=False), I, 'completion_not_established')

    def test_failure_cannot_claim_success(self):
        self.context_check(dict(outcome='FAILED', success_claim=True), BAD, 'outcome_success_contradiction')

    def test_unperformed_cannot_claim_success(self):
        self.context_check(dict(outcome='NOT_PERFORMED', success_claim=True), BAD, 'outcome_success_contradiction')

    def test_failed_operation_cannot_claim_completion(self):
        self.context_check(dict(outcome='FAILED'), BAD, 'outcome_failure_promotion')

    def test_failed_operation_without_claim_is_incomplete(self):
        self.context_check(dict(outcome='FAILED', completion_claim=False), I, 'outcome_failure_unresolved')

    def test_stop_does_not_erase_unknown_outcome(self):
        x = base()
        x['bundle']['records'][-1]['data'].update(human_stop=True, completion_claim=False, outcome='UNKNOWN')
        repin(x)
        report = evaluate(x)
        self.assertEqual(report['result'], I)
        self.assertTrue({'human_stop_latched', 'outcome_unresolved'} <= {c['reason'] for c in report['checks']})

    def test_benign_no_effect_workflow(self):
        self.assertEqual(evaluate(base())['result'], GOOD)

    def test_benign_observed_success(self):
        self.context_check(dict(outcome='SUCCEEDED', success_claim=True, authority_source='EXTERNAL'), GOOD, 'bounded_requirements_met')


class ObservationReview(unittest.TestCase):
    def test_closed_label_does_not_excuse_effect_after_failure(self):
        x = base()
        x['bundle']['records'][-2]['data']['effect_after_failure'] = True
        repin(x)
        report = evaluate(x)
        self.assertEqual(report['result'], BAD)
        self.assertIn('effect_after_control_failure', {c['reason'] for c in report['checks']})

    def test_non_test_pass_requires_successful_execution(self):
        for stage in ('contract_frozen', 'contract_reviewed', 'implementation_recorded', 'code_reviewed'):
            for field, value in [('exit_code', 1), ('diagnostic_class', 'ENVIRONMENT_FAILURE'), ('failed', 1)]:
                with self.subTest(stage=stage, field=field):
                    x = base()
                    r = next(r for r in x['bundle']['records'] if r['stage_id'] == stage)
                    r['data'][field] = value
                    repin(x)
                    report = evaluate(x)
                    self.assertEqual(report['result'], BAD)
                    self.assertIn('stage_success_contradiction', {c['reason'] for c in report['checks']})

    def test_bad_evidence_does_not_become_valid_prerequisite(self):
        x = base()
        x['bundle']['records'][1]['data']['status'] = 'FAIL'
        repin(x)
        report = evaluate(x)
        self.assertEqual(report['result'], BAD)
        result = next(r for r in report['requirements'] if r['id'] == 'expected_red_observed')
        self.assertNotEqual(result['status'], 'SATISFIED')

    def test_unknown_prerequisite_propagates(self):
        x = case(10)
        report = evaluate(x)
        for stage in ('implementation_recorded', 'green_observed', 'code_reviewed'):
            with self.subTest(stage=stage):
                result = next(r for r in report['requirements'] if r['id'] == stage)
                self.assertEqual(result['status'], I)

    def test_discovered_test_order_is_not_identity(self):
        x = base()
        red = x['bundle']['records'][2]['data']
        green = x['bundle']['records'][4]['data']
        red.update(discovered=2, discovered_ids=['test-foreign', 'test-benign'])
        green.update(discovered=2, discovered_ids=['test-benign', 'test-foreign'])
        repin(x)
        self.assertEqual(evaluate(x)['result'], GOOD)

    def test_changed_test_membership_still_fails(self):
        x = base()
        x['bundle']['records'][4]['data']['discovered_ids'] = ['different-test']
        repin(x)
        self.assertEqual(evaluate(x)['result'], BAD)

    def test_empty_named_assertion_is_not_red(self):
        x = base()
        x['policy']['expected_red_reason'] = ''
        x['bundle']['records'][2]['data']['reason'] = ''
        repin(x)
        self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_unknown_claim_is_not_target_violation(self):
        x = base()
        x['bundle']['records'][-1]['data']['human_stop'] = True
        # Deliberately NOT re-admitted by the caller.
        self.assertEqual(evaluate(x)['result'], I)

    def test_bad_and_missing_evidence_reasons_survive(self):
        x = base()
        x['bundle']['records'][-2]['data']['effect_after_failure'] = True
        repin(x)
        x['bundle']['artifacts'].pop(x['bundle']['anchors']['contract_digest'])
        report = evaluate(x)
        self.assertEqual(report['result'], BAD)
        self.assertTrue({'effect_after_control_failure', 'required_artifact_missing'} <= {c['reason'] for c in report['checks']})


class PolicyReview(unittest.TestCase):
    def test_unknown_domain_cannot_silently_route_as_ordinary(self):
        for domain in ('authentication', 'typo-domain', 'AUTHZ'):
            with self.subTest(domain=domain):
                x = base()
                x['bundle']['records'][-1]['data']['change_domains'] = [domain]
                repin(x)
                report = evaluate(x)
                self.assertEqual(report['result'], I)
                self.assertIn('risk_domain_unestablished', {c['reason'] for c in report['checks']})

    def test_missing_domain_is_unknown(self):
        x = base()
        x['bundle']['records'][-1]['data']['change_domains'] = []
        repin(x)
        self.assertEqual(evaluate(x)['result'], I)

    def test_t3_does_not_establish_unknown_domain(self):
        x = base()
        x['bundle']['records'][-1]['data'].update(tier=3, change_domains=['unknown'])
        repin(x)
        self.assertEqual(evaluate(x)['result'], I)

    def test_explicit_sensitive_domains_require_t3(self):
        for domain in ('authn', 'billing', 'public-api', 'infrastructure', 'control-policy'):
            with self.subTest(domain=domain):
                x = base()
                x['bundle']['records'][-1]['data'].update(tier=2, change_domains=[domain])
                repin(x)
                report = evaluate(x)
                self.assertEqual(report['result'], BAD)
                self.assertIn('sensitive_change_misrouted', {c['reason'] for c in report['checks']})

    def test_benign_t3_sensitive_domains(self):
        for domain in ('authn', 'billing', 'public-api', 'infrastructure', 'control-policy'):
            with self.subTest(domain=domain):
                x = base()
                x['bundle']['records'][-1]['data'].update(tier=3, change_domains=[domain])
                repin(x)
                self.assertEqual(evaluate(x)['result'], GOOD)

    def test_self_contract_successor_is_not_revision(self):
        x = base()
        current = x['bundle']['anchors']['contract_digest']
        x['bundle']['records'][-1]['data'].update(previous_contract=current, revision_reason='self')
        x['trust']['contract_successors'][current] = current
        repin(x)
        self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_cyclic_contract_successors_are_invalid(self):
        x = case(12)
        current = x['bundle']['anchors']['contract_digest']
        previous = x['bundle']['records'][-1]['data']['previous_contract']
        x['trust']['contract_successors'][previous] = current
        report = evaluate(x)
        self.assertEqual(report['input_status'], 'INPUT_INVALID')

    def test_blank_revision_reason_is_not_decision(self):
        x = case(12)
        x['bundle']['records'][-1]['data']['revision_reason'] = ' \t\n '
        repin(x)
        self.assertNotEqual(evaluate(x)['result'], GOOD)

    def test_benign_contract_successor_unchanged(self):
        self.assertEqual(evaluate(case(12))['result'], GOOD)

    def test_benign_not_applicable_unchanged(self):
        self.assertEqual(evaluate(case(34))['result'], GOOD)

    def test_benign_squash_unchanged(self):
        self.assertEqual(evaluate(case(36))['result'], GOOD)


class ParsingReview(unittest.TestCase):
    def test_unpaired_surrogate_has_safe_error_type(self):
        with self.assertRaises(InvalidInput):
            strict_loads('\ud800')

    def test_oversize_structural_input_rejected_before_serialization(self):
        # Shared leaf avoids allocating the adversarial payload in the fixture.
        # Production validation must enforce the aggregate budget before dumps.
        import reducer
        value = ['x' * 65536] * 32
        with patch.object(reducer.json, 'dumps', side_effect=AssertionError('oversize serialization attempted')):
            with self.assertRaises(InvalidInput):
                reducer.digest(value)

    def test_secret_marker_not_in_diagnostics(self):
        marker = 'SYNTHETIC_SECRET_REVIEW_MARKER'
        x = base()
        x['bundle']['records'][-1]['data']['change_domains'] = [marker]
        repin(x)
        self.assertNotIn(marker, json.dumps(evaluate(x)))

    def test_pure_no_io_on_new_counterexample(self):
        x = base()
        x['bundle']['records'][-1]['data'].update(human_stop=True, advanced=True)
        repin(x)
        before = copy.deepcopy(x)
        with patch('builtins.open', side_effect=AssertionError('IO')), patch('io.open', side_effect=AssertionError('IO')), patch('subprocess.run', side_effect=AssertionError('exec')), patch('socket.socket', side_effect=AssertionError('network')):
            self.assertEqual(evaluate(x)['result'], BAD)
        self.assertEqual(x, before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
