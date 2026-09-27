# SPDX-License-Identifier: Apache-2.0
"""Mutate ONLY this package's reducer in memory; never execute evidence content."""
import json
from pathlib import Path
from fixtures import case
from reducer import GOOD, BAD, I

HERE = Path(__file__).resolve().parent


def check_mutations():
    source = (HERE / 'reducer.py').read_text()
    oracle = json.loads((HERE.parents[2] / 'docs/design/harness-assurance/v0.1/probe-matrix.json').read_text())
    changes = {
        'always_satisfied': [("result = BAD if U in states else I if I in states else GOOD", "result = GOOD")],
        'accept_agent_declarations': [("if r['method'] != 'RECORDER_OBSERVATION':", "if False:")],
        'ignore_record_trust': [("if digest(r) not in t['record_digests'] or r['kind'] not in t['producer_roles'].get(r['producer_ref'], []):", "if False:")],
        'accept_wrong_red_cause': [("d['diagnostic_class'] == 'ASSERTION_FAILURE'", "True"), ("d['reason'] == p['expected_red_reason']", "True")],
        'ignore_budget_exhaustion': [("d['budget_used'] > d['budget_limit']", "False")],
        'ignore_final_subject': [("check(r['subject_snapshot'] == expected_subject,", "check(True,")],
        'issue_permit': [("NON_EFFECTS = {k: False for k in", "NON_EFFECTS = {k: (k == 'issues_permits') for k in")],
    }
    results = []
    for name, replacements in changes.items():
        mutated = source
        for old, new in replacements:
            expected_count = 2 if name == 'ignore_budget_exhaustion' else 1
            if mutated.count(old) != expected_count: raise AssertionError('mutation anchor changed: ' + name)
            mutated = mutated.replace(old, new)
        namespace = {'__name__': 'ha1_deliberate_mutant'}
        # Authored reducer source only. No artifact, command or fetched content is evaluated.
        exec(compile(mutated, '<ha1-deliberate-mutant>', 'exec'), namespace)
        caught = []
        for n, entry in enumerate(oracle['cases'], 1):
            x = case(n); r = namespace['reduce'](x['policy'], x['inventory'], x['bundle'], x['trust'])
            expected = {'SATISFIED': GOOD, 'UNSATISFIED': BAD, I: I}[entry['expected_requirement_status']]
            if r['result'] != expected or not all(v is False for v in r['non_effects'].values()): caught.append(entry['id'])
        results.append({'mutation': name, 'killed': bool(caught), 'caught_by_cases': caught})
    if not all(r['killed'] for r in results): raise AssertionError('surviving deliberate mutant')
    return results


if __name__ == '__main__': print(json.dumps(check_mutations(), indent=2))
