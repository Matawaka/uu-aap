#!/usr/bin/env python3
"""Validate frozen internal findings and the explicitly unexecuted external lane."""
import hashlib
from collections import Counter

from jsonschema import Draft202012Validator

from run_replay_pilot import check_sources
from verify_evidence import HERE, canonical, digest, read_json, without


def require(condition):
    if not condition:
        raise ValueError("PACKAGE_INVARIANT_FAILED")


def validate():
    check_sources()
    for data, schema in [('protocol.json','replay-pilot.config.schema.json'),
                         ('reference-results.json','replay-result.schema.json'),
                         ('comparison-plan.json','comparison-plan.schema.json')]:
        spec = read_json(HERE / schema)
        Draft202012Validator.check_schema(spec)
        Draft202012Validator(spec).validate(read_json(HERE / data))
    protocol = read_json(HERE / 'protocol.json')
    result = read_json(HERE / 'reference-results.json')
    followups = read_json(HERE / 'evidence/defect-followups.json')
    require(hashlib.sha256((HERE/'protocol.json').read_bytes()).hexdigest() == followups['original_protocol_sha256'])
    require(hashlib.sha256((HERE/'evidence/prototype-verifier.py.txt').read_bytes()).hexdigest() == followups['prototype_sha256'])
    first = read_json(HERE/'evidence/first-results.json')
    require(first['trace_digest'] == followups['original_reference_trace'])
    require(first['trace_digest'] == digest(without(first,'trace_digest')))
    require(first['protocol_digest'] == result['protocol_digest'])
    require(first['metrics'] == result['metrics'])
    require([c['expected_status'] for c in first['cases']] == [c['expected_status'] for c in result['cases']])
    require([c['portable']['input_digest'] for c in first['cases']] == [c['portable']['input_digest'] for c in result['cases']])
    require(result['trace_digest'] == digest(without(result,'trace_digest')))
    require(result['protocol_digest'] == digest(protocol))
    require(result['source_bindings_digest'] == digest(read_json(HERE/'source-bindings.json')))
    require([c['case_id'] for c in result['cases']] == [c['case_id'] for c in protocol['cases']])
    for case, spec in zip(result['cases'],protocol['cases']):
        require(case['expected_status'] == spec['expected_status'])
        require(case['name'] == spec['name'])
        require(case['conform'] == (case['portable']['status'] == spec['expected_status'] and case['portable'] == case['composition']))
        for profile in ['portable','composition']:
            receipt = case[profile]
            require(receipt['digest'] == digest(without(receipt,'digest')))
    metrics = result['metrics']
    require(metrics['cases'] == len(result['cases']))
    require(metrics['conform'] == sum(c['conform'] for c in result['cases']))
    require(metrics['status_counts'] == dict(Counter(c['portable']['status'] for c in result['cases'])))
    require(metrics['harness_decisions'] == dict(Counter(c['harness_decision'] for c in result['cases'])))
    require(metrics['packaging_verdict_differences'] == sum(c['portable'] != c['composition'] for c in result['cases']))
    require(metrics['single_file_total_bytes'] == sum(c['single_file_bytes'] for c in result['cases']))
    require(metrics['dispersed_total_bytes'] == sum(c['dispersed_bytes'] for c in result['cases']))
    # These are equal-evidence packaging arms, not third-party implementations.
    require(all(c['portable'] == c['composition'] for c in result['cases']))
    require(all(not any(c['portable']['assurance'].values()) for c in result['cases']))
    manifest = read_json(HERE/'manifest.json')
    require(manifest['status'] == 'INTERNAL_REPLAY_READY_EXTERNAL_EVIDENCE_PENDING')
    require(manifest['trace_digest'] == result['trace_digest'])
    require(manifest['source_frontier'] == protocol['base_sha'])
    require(manifest['case_ids'] == [c['case_id'] for c in protocol['cases']])
    require(manifest['external_evaluation'] == result['external_evaluation'])
    require(not any(manifest['non_effects'].values()))
    implementation = read_json(HERE/'implementation-receipt.json')
    require(implementation['source_frontier'] == protocol['base_sha'])
    for artifact in implementation['artifacts']:
        require(hashlib.sha256((HERE/artifact['path']).read_bytes()).hexdigest() == artifact['sha256'])
    print('PORTABLE_ACTION_EVIDENCE_V0_1_PACKAGE_PASS')


if __name__ == '__main__':
    validate()
