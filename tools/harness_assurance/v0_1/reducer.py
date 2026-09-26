# SPDX-License-Identifier: Apache-2.0
"""Pure, bounded assessment of caller-pinned synthetic evidence. Never a permit."""
from __future__ import annotations
import hashlib
import json
import re

PROFILE = 'ha1-fixture/v0.1'
GOOD = 'BOUNDED_WORKFLOW_EVIDENCE_SATISFIED'
BAD = 'WORKFLOW_REQUIREMENTS_UNSATISFIED'
UNKNOWN = 'INSUFFICIENT_EVIDENCE'
S, U, I, N = 'SATISFIED', 'UNSATISFIED', UNKNOWN, 'NOT_APPLICABLE'
MAX_BYTES = 2_000_000
DEPS = {'contract_frozen': [], 'contract_reviewed': ['contract_frozen'],
        'expected_red_observed': ['contract_reviewed'],
        'implementation_recorded': ['expected_red_observed'],
        'green_observed': ['implementation_recorded'],
        'code_reviewed': ['implementation_recorded']}
NON_EFFECTS = {k: False for k in ('issues_permits', 'authorizes_merge', 'executes_commands',
                                'calls_network', 'calls_models', 'modifies_target')}


class InvalidInput(ValueError):
    """Safe fixed reason only; never include supplied input in this exception."""


def need(ok, code='shape_invalid'):
    if not ok:
        raise InvalidInput(code)


def _json_tree(value, depth=0, count=None):
    count = [0] if count is None else count
    count[0] += 1
    need(depth <= 32 and count[0] <= 50_000, 'input_limit')
    if type(value) is dict:
        need(len(value) <= 2048, 'input_limit')
        for k, v in value.items():
            need(type(k) is str and len(k) <= 128, 'key_invalid')
            _json_tree(v, depth + 1, count)
    elif type(value) is list:
        need(len(value) <= 2048, 'input_limit')
        for v in value:
            _json_tree(v, depth + 1, count)
    elif type(value) is str:
        need(len(value) <= 65536, 'input_limit')
        value.encode('utf-8')
    elif type(value) is int:
        need(abs(value) <= 2**53 - 1, 'integer_range')
    else:
        need(value is None or type(value) is bool, 'json_type_invalid')


def digest(value):
    """Fixture-only JSON identity, NOT JCS or an existing receipt projection."""
    _json_tree(value)
    data = json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':')).encode()
    need(len(data) <= MAX_BYTES, 'input_limit')
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def text_digest(text):
    return 'sha256:' + hashlib.sha256(text.encode('utf-8')).hexdigest()


def strict_loads(text):
    def pairs(items):
        obj = {}
        for k, v in items:
            need(k not in obj, 'duplicate_json_key')
            obj[k] = v
        return obj
    def invalid_number(_):
        raise InvalidInput('non_integer_number')
    need(type(text) is str and len(text.encode('utf-8')) <= MAX_BYTES, 'input_limit')
    try:
        value = json.loads(text, object_pairs_hook=pairs, parse_float=invalid_number, parse_constant=invalid_number)
        _json_tree(value)
        return value
    except InvalidInput:
        raise
    except (ValueError, TypeError, RecursionError, UnicodeError):
        raise InvalidInput('json_invalid') from None


# Closed schemas: unknown fields cannot silently carry unassessed instructions/claims.
NULLTEXT = (str, type(None))
NULLINT = (int, type(None))
STAGE_DATA = {'status': ('PASS', 'RED', 'FAIL', 'SKIPPED'), 'test_digest': str,
              'discovered': int, 'failed': int, 'skipped': int, 'reason': str,
              'discovered_ids': [str], 'failed_ids': [str], 'exit_code': int,
              'diagnostic_class': ('NONE', 'ASSERTION_FAILURE', 'ENVIRONMENT_FAILURE')}
CONTROL_DATA = {'heartbeat_revision': str, 'heartbeat_tick': int, 'heartbeat_status': ('PASS', 'FAIL'),
    'failure_mode': ('OPEN', 'CLOSED'), 'effect_after_failure': bool,
    'mutations': [{'id': str, 'expected': ('ALLOW', 'REJECT'), 'observed': ('ALLOW', 'REJECT', 'ERROR'),
                  'cause': ('TARGET_CONTROL', 'ENVIRONMENT'), 'control_id': str, 'revision': str}]}
CONTEXT_DATA = {'human_stop': bool, 'restarted': bool, 'handover_permit_claim': bool,
    'budget_used': int, 'budget_limit': int, 'completion_claim': bool, 'blocked_dependencies': [str],
    'advanced': bool, 'environment_status': ('OK', 'FAILED', 'UNKNOWN'), 'tier': int,
    'change_domains': [str], 'unresolved_critical': int, 'reviewers': [str],
    'independence_claim': bool, 'no_findings': bool, 'absence_of_defects_claim': bool,
    'disclosures': [{'artifact_digest': str, 'classification': ('PUBLIC', 'SECRET')}],
    'rate_claim': bool, 'rate_denominator': NULLINT, 'minimum_cost_claim': bool, 'cache_share_ppm': int,
    'outcome': ('NOT_PERFORMED', 'UNKNOWN', 'SUCCEEDED', 'FAILED'), 'retry_count': int,
    'success_claim': bool, 'authority_source': ('NONE', 'EXTERNAL', 'OBSERVER_REPORT'),
    'removed_controls': [str], 'previous_contract': NULLTEXT, 'revision_reason': NULLTEXT, 'squash_commit': NULLTEXT}
POLICY = {'profile': str, 'stages': [{'id': str, 'requires': [str], 'applicable': bool, 'applicability_ref': NULLTEXT}],
          'expected_red_reason': str, 'minimum_tier': int, 'max_heartbeat_age': int, 'required_mutations': {'*': ('ALLOW', 'REJECT')}}
INVENTORY = {'controls': [{'id': str, 'revision': str, 'component_manifest_ref': str, 'protected': bool}]}
ANCHORS = {'task_id': str, 'attempt_id': str, 'session_epoch': int, 'contract_digest': str,
           'baseline_digest': str, 'subject_digest': str, 'test_digest': str,
           'environment_digest': str, 'policy_digest': str, 'source_frontier': str}
TRUST = {'profile': str, 'policy_digest': str, 'inventory_digest': str, 'anchors_digest': str,
         'record_digests': [str], 'evaluation_tick': int, 'sequence_domain': str,
         'producer_roles': {'*': [str]}, 'reviewer_operators': {'*': str}, 'contract_successors': {'*': str}}
HEADER = {'id': str, 'kind': ('stage', 'controls', 'context'), 'stage_id': str,
          'task_id': str, 'attempt_id': str, 'session_epoch': int, 'subject_snapshot': str,
          'contract_digest': str, 'policy_digest': str, 'control_id': str, 'control_revision': str,
          'environment_digest': NULLTEXT, 'producer_ref': str,
          'sequence_ref': {'domain': str, 'ordinal': int}, 'evidence_refs': [str],
          'prerequisite_refs': {'*': str}, 'method': ('RECORDER_OBSERVATION', 'AGENT_DECLARATION')}


def shape(value, spec):
    if type(spec) is type:
        need(type(value) is spec)
    elif type(spec) is tuple:
        need(any(type(value) is x if type(x) is type else type(value) is type(x) and value == x for x in spec))
    elif type(spec) is list:
        need(type(value) is list)
        for v in value:
            shape(v, spec[0])
    else:
        need(type(value) is dict)
        if set(spec) == {'*'}:
            for v in value.values(): shape(v, spec['*'])
        else:
            need(set(value) == set(spec))
            for k in spec: shape(value[k], spec[k])


def invalid_report(code='input_invalid'):
    return {'profile': PROFILE, 'result': I, 'input_status': 'INPUT_INVALID',
            'checks': [{'dimension': 'input', 'status': I, 'reason': code}],
            'non_effects': dict(NON_EFFECTS), 'limitations': ['No assessment of target behaviour; invalid supplied input.']}


def reduce(policy, inventory, bundle, trust):
    """No I/O; does not mutate inputs. trust MUST be selected out-of-band by caller."""
    try:
        return _reduce(policy, inventory, bundle, trust)
    except InvalidInput as e:
        return invalid_report(str(e))
    except (KeyError, TypeError, ValueError, RecursionError, UnicodeError, OverflowError):
        return invalid_report()


def _reduce(p, inventory, b, t):
    inputs = {'policy': p, 'inventory': inventory, 'bundle': b, 'trust': t}
    input_digest = digest(inputs)
    shape(p, POLICY); shape(t, TRUST)
    need(set(b) == {'anchors', 'artifacts', 'records'})
    shape(b['anchors'], ANCHORS); shape(b['artifacts'], {'*': str})
    need(type(b['records']) is list and len(b['records']) <= 128, 'record_limit')
    if inventory is not None: shape(inventory, INVENTORY)
    need(p['profile'] == PROFILE and t['profile'] == 'caller-pinned-synthetic/v0.1', 'unsupported_profile')
    need(p['minimum_tier'] in (1, 2, 3) and p['max_heartbeat_age'] >= 0, 'policy_range')
    need(t['evaluation_tick'] >= 0 and b['anchors']['session_epoch'] >= 0, 'anchor_range')
    need(bool(p['required_mutations']) and set(p['required_mutations'].values()) == {'ALLOW', 'REJECT'}, 'mutation_policy_empty_or_one_sided')
    a = b['anchors']; rows = set(); current_requirement = 'profile'; missing_artifacts = set(); missing_invocations = set()
    need(all(re.fullmatch(r'sha256:[0-9a-f]{64}', a[k]) for k in ANCHORS if k.endswith('_digest')), 'anchor_digest_invalid')
    need(re.fullmatch(r'[0-9a-f]{40}', a['source_frontier']) is not None, 'source_frontier_invalid')
    need(all(v.strip() for v in (a['task_id'], a['attempt_id'], t['sequence_domain'])), 'empty_binding')
    def add(dimension, status, reason): rows.add((current_requirement, dimension, status, reason))
    def check(ok, dimension, reason, failure=U):
        add(dimension, S if ok else failure, 'bounded_requirements_met' if ok else reason)
    def finish():
        states = {status for _, _, status, _ in rows}
        requirements = []
        for key in sorted({key for key, _, _, _ in rows}):
            statuses = {s for k, _, s, _ in rows if k == key}
            status = U if U in statuses else I if I in statuses else N if statuses == {N} else S
            requirements.append({'id': key, 'status': status})
        result = BAD if U in states else I if I in states else GOOD
        return {'profile': PROFILE, 'result': result, 'input_status': 'ASSESSED',
            'input_digest': input_digest, 'policy_digest': digest(p), 'inventory_digest': digest(inventory),
            'anchors_digest': digest(a), 'source_frontier': a['source_frontier'],
            'trust_configuration_digest': digest(t), 'requirements': requirements,
            'missing_artifact_digests': sorted(missing_artifacts), 'missing_invocations': sorted(missing_invocations),
            'evidence_frontier': sorted(digest(r) for r in b['records']),
            'checks': [{'requirement_id': k, 'dimension': d, 'status': s, 'reason': r} for k, d, s, r in sorted(rows)],
            'non_effects': dict(NON_EFFECTS), 'limitations': [
                'Caller-pinned synthetic observations only; no live authentication or target execution.',
                'Pins establish accepted bytes, not historical truth, complete mediation or trusted time.',
                'No secret scanner, general risk classifier, operator-independence proof or minimum-cost proof.',
                'Evidence satisfaction is not authority, deployment approval or independent qualification.']}
    # Without out-of-band pins, do not treat supplied assertions as established violations.
    if any(t[k] != digest(v) for k, v in [('policy_digest', p), ('inventory_digest', inventory), ('anchors_digest', a)]):
        add('trust', I, 'caller_pin_mismatch'); return finish()
    check(a['policy_digest'] == digest(p), 'bindings', 'policy_digest_mismatch')
    if not p['stages']:
        add('process_coverage', U, 'empty_obligation_set'); return finish()
    graph = {s['id']: s for s in p['stages']}
    need(len(graph) == len(p['stages']), 'duplicate_stage')
    need(set(graph) <= set(DEPS) | {'mobile_smoke'} and set(DEPS) <= set(graph), 'unsupported_stage_profile')
    for k, deps in DEPS.items():
        need(graph[k]['requires'] == deps and graph[k]['applicable'], 'mandatory_stage_changed')
    if 'mobile_smoke' in graph: need(graph['mobile_smoke']['requires'] == ['green_observed'], 'optional_dependency')
    controls = {} if inventory is None else {c['id']: c for c in inventory['controls']}
    if inventory is None: add('process_coverage', I, 'coverage_baseline_missing')
    else:
        need(len(controls) == len(inventory['controls']) == 1 and set(controls) == {'control-1'}, 'unsupported_control_inventory')
        need(all(re.fullmatch(r'sha256:[0-9a-f]{64}', c[k]) for c in controls.values() for k in ('revision', 'component_manifest_ref')), 'control_identity_invalid')
    available = set()
    for h, text in b['artifacts'].items():
        if h == text_digest(text): available.add(h)
        else: add('bindings', U, 'artifact_digest_mismatch')
    if not b['artifacts']: add('retention', I, 'retained_evidence_unavailable')
    required = [a[k] for k in ('contract_digest', 'baseline_digest', 'subject_digest', 'test_digest', 'environment_digest')]
    required += [c['component_manifest_ref'] for c in controls.values()]
    missing_artifacts.update(h for h in required if h not in available)
    check(all(h in available for h in required), 'artifacts', 'required_artifact_missing', I)
    admitted, all_records, ordinals = {}, {}, set()
    for r in b['records']:
        need(type(r) is dict and r.get('kind') in ('stage', 'controls', 'context'))
        shape(r, {**HEADER, 'data': {'stage': STAGE_DATA, 'controls': CONTROL_DATA, 'context': CONTEXT_DATA}[r['kind']]})
        key = r['stage_id']
        need(all(re.fullmatch(r'sha256:[0-9a-f]{64}', h) for h in r['evidence_refs']), 'evidence_digest_invalid')
        need(key not in all_records and r['id'] not in {v['id'] for v in all_records.values()}, 'duplicate_record')
        need(key in graph if r['kind'] == 'stage' else key == r['kind'], 'record_role_mismatch')
        all_records[key] = r; current_requirement = key
        if digest(r) not in t['record_digests'] or r['kind'] not in t['producer_roles'].get(r['producer_ref'], []):
            add('trust', I, 'recorder_trust_unestablished'); continue
        if r['method'] != 'RECORDER_OBSERVATION':
            add('actual_invocation', I, 'red_execution_not_established' if key == 'expected_red_observed' else 'invocation_not_established'); continue
        check((r['task_id'], r['attempt_id']) == (a['task_id'], a['attempt_id']), 'bindings', 'cross_attempt_replay')
        check(r['session_epoch'] == a['session_epoch'], 'bindings', 'stale_session_epoch')
        check(r['policy_digest'] == digest(p), 'bindings', 'policy_digest_mismatch')
        check(r['contract_digest'] == a['contract_digest'], 'bindings', 'contract_evidence_stale')
        check(r['environment_digest'] == a['environment_digest'], 'bindings', 'environment_evidence_missing', I)
        expected_subject = a['baseline_digest'] if key in list(DEPS)[:3] else a['subject_digest']
        check(r['subject_snapshot'] == expected_subject, 'bindings', 'final_subject_mismatch')
        if inventory is not None:
            check(r['control_id'] in controls and r['control_revision'] == controls[r['control_id']]['revision'], 'carrier_binding', 'control_revision_mismatch')
        missing_artifacts.update(h for h in r['evidence_refs'] if h not in available)
        check(bool(r['evidence_refs']) and all(h in available for h in r['evidence_refs']), 'artifacts', 'required_artifact_missing', I)
        seq = r['sequence_ref']
        need(seq['ordinal'] > 0 and (seq['domain'], seq['ordinal']) not in ordinals, 'sequence_invalid')
        ordinals.add((seq['domain'], seq['ordinal']))
        check(seq['domain'] == t['sequence_domain'], 'ordering', 'sequence_domain_unestablished', I)
        admitted[key] = r
    for key, stage in graph.items():
        current_requirement = key
        if not stage['applicable']:
            if stage['applicability_ref'] in available:
                add('process_coverage', N, 'justified_not_applicable')
            else: add('process_coverage', I, 'applicability_evidence_missing')
            continue
        if key not in admitted:
            missing_invocations.add(key)
            add('actual_invocation', I, 'expected_invocation_not_observed'); continue
        r = admitted[key]
        check(set(r['prerequisite_refs']) == set(stage['requires']), 'process_coverage', 'required_stage_dependency_missing')
        for dep in stage['requires']:
            if dep not in admitted:
                add('ordering', I, 'prerequisite_not_observed'); continue
            prev = admitted[dep]
            check(r['prerequisite_refs'].get(dep) == digest(prev), 'ordering', 'prerequisite_digest_mismatch')
            check(prev['sequence_ref']['ordinal'] < r['sequence_ref']['ordinal'], 'ordering', 'causal_order_mismatch')
        if key != 'expected_red_observed': check(r['data']['status'] == 'PASS', 'stage_outcome', 'stage_not_passed')
    red, green = admitted.get('expected_red_observed'), admitted.get('green_observed')
    for r in (red, green):
        if r is None: continue
        current_requirement = r['stage_id']
        d = r['data']; count = d['discovered']
        check(count > 0 and count == len(set(d['discovered_ids'])) == len(d['discovered_ids']) and
              d['failed'] == len(set(d['failed_ids'])) == len(d['failed_ids']) and
              set(d['failed_ids']) <= set(d['discovered_ids']) and d['skipped'] == 0, 'test_observation', 'test_discovery_invalid')
        check(d['test_digest'] == a['test_digest'], 'test_observation', 'test_identity_drift')
    if red:
        current_requirement = 'expected_red_observed'; d = red['data']
        check(d['status'] == 'RED' and d['diagnostic_class'] == 'ASSERTION_FAILURE' and d['failed'] > 0 and d['exit_code'] != 0 and d['reason'] == p['expected_red_reason'], 'test_observation', 'red_reason_mismatch')
    current_requirement = 'green_observed'
    if green: check(green['data']['failed'] == 0 and green['data']['exit_code'] == 0 and green['data']['diagnostic_class'] == 'NONE', 'test_observation', 'green_not_established')
    if red and green: check(red['data']['discovered_ids'] == green['data']['discovered_ids'], 'test_observation', 'test_identity_drift')
    current_requirement = 'controls'
    cr = admitted.get('controls')
    if cr is None: add('liveness_observation', I, 'control_observation_missing')
    else:
        d = cr['data']
        check(d['heartbeat_revision'] == cr['control_revision'], 'liveness_observation', 'liveness_wrong_revision', I)
        check(d['heartbeat_status'] == 'PASS' and 0 <= t['evaluation_tick'] - d['heartbeat_tick'] <= p['max_heartbeat_age'], 'liveness_observation', 'liveness_not_established', I)
        check(not (d['failure_mode'] == 'OPEN' and d['effect_after_failure']), 'effect_boundary', 'authority_fail_open')
        need(len({m['id'] for m in d['mutations']}) == len(d['mutations']), 'duplicate_mutation')
        check(set(p['required_mutations']) <= {m['id'] for m in d['mutations']}, 'mutation_sensitivity', 'mutation_evidence_missing', I)
        for m in d['mutations']:
            check(m['cause'] == 'TARGET_CONTROL' and m['control_id'] == cr['control_id'] and m['revision'] == cr['control_revision'], 'mutation_sensitivity', 'wrong_control_failure')
            check(m['id'] in p['required_mutations'] and m['expected'] == p['required_mutations'][m['id']], 'mutation_sensitivity', 'mutation_expectation_drift')
            check(m['observed'] == p['required_mutations'].get(m['id']), 'mutation_sensitivity', 'mutation_not_detected')
    current_requirement = 'context'
    ctx = admitted.get('context')
    if ctx is None: add('context', I, 'context_observation_missing')
    else:
        d = ctx['data']
        need(d['tier'] in (1, 2, 3) and all(d[k] >= 0 for k in ('budget_used', 'budget_limit', 'unresolved_critical', 'retry_count')), 'context_range')
        need(0 <= d['cache_share_ppm'] <= 1_000_000, 'context_range')
        check(not d['handover_permit_claim'], 'session', 'handover_authority_escalation')
        check(not (d['human_stop'] and d['restarted']), 'session', 'human_stop_bypassed')
        check(not (d['budget_used'] > d['budget_limit'] and d['completion_claim']), 'budget', 'budget_success_promotion')
        if d['budget_used'] > d['budget_limit']: add('budget', I, 'budget_incomplete')
        check(not (d['blocked_dependencies'] and d['advanced']), 'dependencies', 'blocked_dependency_ignored')
        check(not (d['environment_status'] == 'FAILED' and d['completion_claim']), 'environment', 'environment_failure_promotion')
        if d['environment_status'] != 'OK': add('environment', I, 'environment_evidence_missing')
        sensitive = bool(set(d['change_domains']) & {'authz', 'crypto', 'secrets', 'payment', 'migration', 'external-mutation'})
        check(d['tier'] >= max(p['minimum_tier'], 3 if sensitive else 1), 'risk', 'sensitive_change_misrouted')
        if d['unresolved_critical']: add('review', I, 'critical_triage_unresolved')
        operators = [t['reviewer_operators'].get(v) for v in d['reviewers']]
        if d['independence_claim']:
            check(len(operators) >= 2 and None not in operators and len(set(operators)) == len(operators), 'review', 'independence_overclaim')
        check(not d['absence_of_defects_claim'], 'review', 'negative_review_overclaim')
        check(all(v['classification'] != 'SECRET' for v in d['disclosures']), 'disclosure', 'evidence_disclosure_violation')
        if d['rate_claim']:
            add('metrics', I, 'effectiveness_denominator_missing' if d['rate_denominator'] is None or d['rate_denominator'] <= 0 else 'rate_value_not_established')
        if d['minimum_cost_claim']: add('metrics', I, 'cost_not_established')
        check(not (d['outcome'] == 'UNKNOWN' and (d['retry_count'] or d['success_claim'])), 'outcome_observation', 'unknown_outcome_promoted')
        if d['outcome'] == 'UNKNOWN': add('outcome_observation', I, 'outcome_unresolved')
        check(d['authority_source'] != 'OBSERVER_REPORT', 'effect_boundary', 'observer_authority_escalation')
        check(not any(c['protected'] and c['id'] in d['removed_controls'] for c in controls.values()), 'protective_coverage', 'protective_requirement_pruned')
        if d['previous_contract'] is not None or a['contract_digest'] in t['contract_successors']:
            admitted_revision = (d['previous_contract'] is not None and
                t['contract_successors'].get(a['contract_digest']) == d['previous_contract'] and
                d['previous_contract'] in available and bool(d['revision_reason']))
            revalidated = all(v['contract_digest'] == a['contract_digest'] for v in admitted.values()) and all(k in admitted for k in DEPS) and not any(status in (U, I) for _, _, status, _ in rows)
            if admitted_revision and revalidated: add('contract_revision', S, 'revised_contract_revalidated')
            else: add('contract_revision', I, 'contract_revision_not_admitted_or_revalidated')
        if d['squash_commit'] is not None and all(h in available for h in required):
            add('retention', S, 'history_compaction_preserves_bound_evidence')
    return finish()


def main():
    """Explicit local input reads only; pure reduce() does not read any files."""
    import argparse
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('policy', 'inventory', 'bundle', 'trust'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    try:
        values = []
        for name in ('policy', 'inventory', 'bundle', 'trust'):
            with Path(getattr(args, name)).open('rb') as f:
                data = f.read(MAX_BYTES + 1)
            need(len(data) <= MAX_BYTES, 'input_limit')
            values.append(strict_loads(data.decode('utf-8')))
        report = reduce(*values)
    except (OSError, ValueError, UnicodeError, RecursionError):
        report = invalid_report('local_input_unavailable_or_invalid')
    print(json.dumps(report, sort_keys=True, indent=2))
    return {GOOD: 0, BAD: 1, I: 2}[report['result']]


if __name__ == '__main__':
    raise SystemExit(main())
