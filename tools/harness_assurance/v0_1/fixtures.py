# SPDX-License-Identifier: Apache-2.0
"""Synthetic fixture caller, NOT a recorder or production trust bootstrap."""
import copy
import hashlib
import json


def digest(value):
    return 'sha256:' + hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':')).encode()).hexdigest()


def blob(text):
    return 'sha256:' + hashlib.sha256(text.encode()).hexdigest()


STAGES = {
    'contract_frozen': [], 'contract_reviewed': ['contract_frozen'],
    'expected_red_observed': ['contract_reviewed'],
    'implementation_recorded': ['expected_red_observed'],
    'green_observed': ['implementation_recorded'],
    'code_reviewed': ['implementation_recorded'],
}


def base():
    texts = {k: 'SYNTHETIC ' + k for k in ('contract', 'baseline', 'subject', 'tests', 'environment', 'component')}
    ids = {k: blob(v) for k, v in texts.items()}
    policy = {'profile': 'ha1-fixture/v0.1', 'stages': [
        {'id': k, 'requires': v, 'applicable': True, 'applicability_ref': None}
        for k, v in STAGES.items()], 'expected_red_reason': 'reject_foreign_authority',
        'minimum_tier': 2, 'max_heartbeat_age': 20, 'required_mutations': {'invalid-binding': 'REJECT', 'benign-binding': 'ALLOW'}}
    inventory = {'controls': [{'id': 'control-1', 'revision': blob('control-v1'),
                               'component_manifest_ref': ids['component'], 'protected': True}]}
    anchors = {'task_id': 'task-1', 'attempt_id': 'attempt-1', 'session_epoch': 3,
               'contract_digest': ids['contract'], 'baseline_digest': ids['baseline'],
               'subject_digest': ids['subject'], 'test_digest': ids['tests'],
               'environment_digest': ids['environment'], 'policy_digest': digest(policy),
               'source_frontier': '9c1f159dd2aee62ad7efb5da28e27f17a84b8526'}
    bundle = {'anchors': anchors, 'artifacts': {ids[k]: v for k, v in texts.items()}, 'records': []}
    for n, stage in enumerate(STAGES, 1):
        bundle['records'].append({'id': 'record-' + str(n), 'kind': 'stage', 'stage_id': stage,
            'task_id': anchors['task_id'], 'attempt_id': anchors['attempt_id'],
            'session_epoch': 3, 'subject_snapshot': ids['baseline'] if n <= 3 else ids['subject'],
            'contract_digest': ids['contract'], 'policy_digest': digest(policy),
            'control_id': 'control-1', 'control_revision': inventory['controls'][0]['revision'],
            'environment_digest': ids['environment'], 'producer_ref': 'fixture-recorder',
            'sequence_ref': {'domain': 'attempt-sequence', 'ordinal': n},
            'evidence_refs': [ids['contract'], ids['tests']], 'prerequisite_refs': {},
            'method': 'RECORDER_OBSERVATION', 'data': {'status': 'PASS', 'test_digest': ids['tests'],
                'discovered': 1, 'failed': 0, 'skipped': 0, 'reason': 'none',
                'discovered_ids': ['test-foreign'], 'failed_ids': [], 'exit_code': 0, 'diagnostic_class': 'NONE'}})
    red = bundle['records'][2]['data']
    red.update(status='RED', failed=1, reason='reject_foreign_authority', failed_ids=['test-foreign'], exit_code=1, diagnostic_class='ASSERTION_FAILURE')
    common = copy.deepcopy(bundle['records'][-1])
    control = copy.deepcopy(common)
    control.update(id='control-observation', kind='controls', stage_id='controls',
        sequence_ref={'domain': 'attempt-sequence', 'ordinal': 7}, data={
        'heartbeat_revision': inventory['controls'][0]['revision'], 'heartbeat_tick': 95,
        'heartbeat_status': 'PASS', 'failure_mode': 'CLOSED', 'effect_after_failure': False,
        'mutations': [
            {'id': 'invalid-binding', 'expected': 'REJECT', 'observed': 'REJECT', 'cause': 'TARGET_CONTROL', 'control_id': 'control-1', 'revision': inventory['controls'][0]['revision']},
            {'id': 'benign-binding', 'expected': 'ALLOW', 'observed': 'ALLOW', 'cause': 'TARGET_CONTROL', 'control_id': 'control-1', 'revision': inventory['controls'][0]['revision']}]})
    context = copy.deepcopy(common)
    context.update(id='context-observation', kind='context', stage_id='context',
        sequence_ref={'domain': 'attempt-sequence', 'ordinal': 8}, data={
        'human_stop': False, 'restarted': False, 'handover_permit_claim': False,
        'budget_used': 20, 'budget_limit': 100, 'completion_claim': True,
        'blocked_dependencies': [], 'advanced': False, 'environment_status': 'OK',
        'tier': 2, 'change_domains': ['ordinary-code'], 'unresolved_critical': 0,
        'reviewers': ['reviewer-a', 'reviewer-b'], 'independence_claim': False,
        'no_findings': True, 'absence_of_defects_claim': False, 'disclosures': [],
        'rate_claim': False, 'rate_denominator': None, 'minimum_cost_claim': False,
        'cache_share_ppm': 997000, 'outcome': 'NOT_PERFORMED', 'retry_count': 0,
        'success_claim': False, 'authority_source': 'NONE', 'removed_controls': [],
        'previous_contract': None, 'revision_reason': None, 'squash_commit': None})
    bundle['records'] += [control, context]
    link(bundle, policy)
    return {'policy': policy, 'inventory': inventory, 'bundle': bundle, 'trust': trust_for(policy, inventory, bundle)}


def link(bundle, policy):
    """Build references in dependency order, independently of the reducer."""
    records = {r['stage_id']: r for r in bundle['records'] if r['kind'] == 'stage'}
    for s in policy['stages']:
        if s['id'] in records:
            records[s['id']]['prerequisite_refs'] = {d: digest(records[d]) for d in s['requires'] if d in records}


def trust_for(policy, inventory, bundle):
    return {'profile': 'caller-pinned-synthetic/v0.1', 'policy_digest': digest(policy),
        'inventory_digest': digest(inventory), 'anchors_digest': digest(bundle['anchors']),
        'record_digests': [digest(r) for r in bundle['records']], 'evaluation_tick': 100,
        'sequence_domain': 'attempt-sequence', 'producer_roles': {'fixture-recorder': ['stage', 'controls', 'context']},
        'reviewer_operators': {'reviewer-a': 'operator-1', 'reviewer-b': 'operator-1'},
        'contract_successors': {}}


def case(number):
    x = base(); p, b = x['policy'], x['bundle']; r = b['records']; a = b['anchors']
    c = r[-1]['data']; control = r[-2]['data']
    if number == 2: b['artifacts'].pop(a['contract_digest'])
    elif number == 3: r[4]['method'] = 'AGENT_DECLARATION'
    elif number == 4: r[3]['prerequisite_refs'] = {}
    elif number == 5: r.pop(5)
    elif number == 6: control['heartbeat_revision'] = blob('old-control')
    elif number == 7: control.update(failure_mode='OPEN', effect_after_failure=True)
    elif number == 8: control['mutations'][0]['observed'] = 'ALLOW'
    elif number == 9: r[2]['data'].update(reason='IMPORT_ERROR', diagnostic_class='ENVIRONMENT_FAILURE')
    elif number == 10: r[2]['method'] = 'AGENT_DECLARATION'
    elif number == 11: r[4]['data']['test_digest'] = blob('changed-tests')
    elif number in (12, 13):
        old = a['contract_digest']; new = blob('SYNTHETIC revised contract')
        b['artifacts'][new] = 'SYNTHETIC revised contract'; a['contract_digest'] = new
        for record in r:
            record['contract_digest'] = new
            record['evidence_refs'] = [new if e == old else e for e in record['evidence_refs']]
        c.update(previous_contract=old, revision_reason='corrected acceptance edge case')
        if number == 13: r[4]['contract_digest'] = old
    elif number == 14: r[4]['attempt_id'] = 'another-attempt'
    elif number == 15: c['handover_permit_claim'] = True
    elif number == 16: r[4]['session_epoch'] = 2
    elif number == 17: c.update(human_stop=True, restarted=True)
    elif number == 18: c['budget_used'] = 101
    elif number == 19: c.update(blocked_dependencies=['task-0'], advanced=True)
    elif number == 20: c['environment_status'] = 'FAILED'
    elif number == 21:
        for record in r: record['environment_digest'] = None
    elif number == 22: c.update(tier=1, change_domains=['authz'])
    elif number == 23: b['artifacts'] = {}
    elif number == 24: c['unresolved_critical'] = 1
    elif number == 25: c['independence_claim'] = True
    elif number == 26: c['absence_of_defects_claim'] = True
    elif number == 28: x['inventory'] = None
    elif number == 29: c['disclosures'] = [{'artifact_digest': a['test_digest'], 'classification': 'SECRET'}]
    elif number == 30: c['rate_claim'] = True
    elif number == 31: c['minimum_cost_claim'] = True
    elif number == 32: r[4]['subject_snapshot'] = a['baseline_digest']
    elif number == 33: p['stages'] = []
    elif number == 34:
        ref = blob('SYNTHETIC not a mobile task'); b['artifacts'][ref] = 'SYNTHETIC not a mobile task'
        p['stages'].append({'id': 'mobile_smoke', 'requires': ['green_observed'], 'applicable': False, 'applicability_ref': ref})
    elif number == 35: c.update(outcome='UNKNOWN', retry_count=1, success_claim=True)
    elif number == 36: c['squash_commit'] = 'a' * 40
    elif number == 37: control['mutations'][0].update(observed='ERROR', cause='ENVIRONMENT')
    elif number == 38: c.update(outcome='SUCCEEDED', success_claim=True, authority_source='OBSERVER_REPORT')
    elif number == 39: r[4]['policy_digest'] = blob('different-policy')
    elif number == 40: c['removed_controls'] = ['control-1']
    if number in (33, 34):
        a['policy_digest'] = digest(p)
        for record in r: record['policy_digest'] = digest(p)
    if number != 4: link(b, p)
    x['trust'] = trust_for(p, x['inventory'], b)
    if number in (12, 13): x['trust']['contract_successors'][a['contract_digest']] = c['previous_contract']
    if number == 27: x['trust']['record_digests'] = []
    return x
