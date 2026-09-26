# SPDX-License-Identifier: Apache-2.0
"""Finite R1 self-review mutation sample; executes only this package's own code."""
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import test_adversarial as tests
from reducer import GOOD


def check_review_mutations():
    source = Path(__file__).with_name('reducer.py').read_text(encoding='utf-8')
    mutations = [
        ('stop_only_checks_restart',
         "(d['restarted'] or d['advanced'] or d['completion_claim'])", "d['restarted']",
         tests.LifecycleReview, 'test_stop_advance_without_restart'),
        ('trust_closed_label',
         "check(not d['effect_after_failure'],", "check(True,",
         tests.ObservationReview, 'test_closed_label_does_not_excuse_effect_after_failure'),
        ('pass_ignores_execution_outcome',
         "d['exit_code'] == 0 and d['diagnostic_class'] == 'NONE' and\n                      d['failed'] == 0 and not d['failed_ids'] and d['skipped'] == 0", "True",
         tests.ObservationReview, 'test_non_test_pass_requires_successful_execution'),
        ('skip_prerequisite_status',
         "if any(k == dep and status in (U, I) for k, _, status, _ in rows):", "if False:",
         tests.ObservationReview, 'test_unknown_prerequisite_propagates'),
        ('unknown_domain_is_ordinary',
         "if not domains or not domains <= CHANGE_DOMAINS:", "if False:",
         tests.PolicyReview, 'test_unknown_domain_cannot_silently_route_as_ordinary'),
        ('allow_contract_cycles',
         "while current in successors and current not in visited:", "while False:",
         tests.PolicyReview, 'test_self_contract_successor_is_not_revision'),
        ('unperformed_success_allowed',
         "check(not (d['success_claim'] and d['outcome'] in ('FAILED', 'NOT_PERFORMED')),", "check(True,",
         tests.LifecycleReview, 'test_unperformed_cannot_claim_success'),
        ('test_order_is_identity',
         "set(red['data']['discovered_ids']) == set(green['data']['discovered_ids'])", "red['data']['discovered_ids'] == green['data']['discovered_ids']",
         tests.ObservationReview, 'test_discovered_test_order_is_not_identity'),
    ]
    output = []
    for name, old, new, test_class, method in mutations:
        if source.count(old) != 1:
            raise AssertionError('mutation anchor changed: ' + name)
        namespace = {'__name__': 'ha1_r1_authored_mutant'}
        # Never compile observation/artifact content. This is a copy of reducer.py.
        exec(compile(source.replace(old, new), '<ha1-r1-authored-mutant>', 'exec'), namespace)
        with patch.object(tests, 'reduce', namespace['reduce']):
            benign = tests.evaluate(tests.base())['result'] == GOOD
            result = unittest.TextTestRunner(stream=io.StringIO()).run(test_class(method))
        killed = benign and bool(result.failures) and not result.errors
        output.append({'mutation': name, 'target_test': test_class.__name__ + '.' + method,
                       'baseline_satisfied': benign, 'assertion_failures': len(result.failures),
                       'errors': len(result.errors), 'killed': killed})
    if not all(item['killed'] for item in output):
        raise AssertionError('R1 mutation survived or had unrelated error: ' + json.dumps(output))
    return output


if __name__ == '__main__':
    print(json.dumps(check_review_mutations(), indent=2))
