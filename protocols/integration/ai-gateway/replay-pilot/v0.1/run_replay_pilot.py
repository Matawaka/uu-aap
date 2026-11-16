#!/usr/bin/env python3
"""Build synthetic replay evidence and compare packaging, not vendor security."""
import argparse
import copy
import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path

from verify_evidence import (HERE, ROLES, EvidenceError, canonical, digest,
                             load_dispersed, read_json, verify, without)

ROOT = HERE.parents[4]
HARNESS = ROOT / 'protocols/integration/ai-gateway/harness/v0.1'


def seal(record):
    record['digest'] = digest(without(record, 'digest'))
    return record


def seal_pack(pack):
    pack['pack_digest'] = digest(without(pack, 'pack_digest'))
    return pack


def check_sources():
    bindings = read_json(HERE / 'source-bindings.json')
    protocol = read_json(HERE / 'protocol.json')
    if bindings['base_sha'] != protocol['base_sha']:
        raise EvidenceError('BASE_BINDING_MISMATCH')
    for source in bindings['sources']:
        path = ROOT / source['path']
        if path.is_symlink() or not path.is_file():
            raise EvidenceError('REPLAY_SOURCE_MISSING')
        if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
            raise EvidenceError('REPLAY_SOURCE_DRIFT')
    return bindings


def harness_report(scenario):
    # Only the existing pinned dry-run module is executed. The JSON travels on
    # stdin, not through shell interpolation. No target/API call is performed.
    script = "const fs=require('fs');const h=require(process.argv[1]);process.stdout.write(JSON.stringify(h.runScenario(JSON.parse(fs.readFileSync(0,'utf8')))));"
    run = subprocess.run(['node', '-e', script, str(HARNESS / 'run-harness.js')],
                         input=json.dumps(scenario), text=True, capture_output=True,
                         check=True, timeout=10)
    return json.loads(run.stdout)


def base_pack(case_id, rewritten=False):
    fixture = read_json(HARNESS / 'scenarios.fixture.json')
    scenario = copy.deepcopy(fixture['scenarios'][0])
    a = scenario['authorized']
    if rewritten:
        a.update(repository='Untrusted/rewritten', expected_head_sha='3' * 40,
                 expected_base_sha='4' * 40,
                 authority_scope='repository:Untrusted/rewritten:pull_request:999:merge')
        scenario['current_state'].update(repository=a['repository'],
                                         head_sha=a['expected_head_sha'], base_sha=a['expected_base_sha'])
    target = {'repository': a['repository'], 'pr_number': a['pr_number'],
              'head_sha': a['expected_head_sha'], 'base_sha': a['expected_base_sha'],
              'merge_method': a['merge_method']}
    approval = seal({'approval_id': 'synthetic-approval', 'target': copy.deepcopy(target),
                     'issued_at': '2026-11-15T23:00:00Z', 'expires_at': '2026-11-17T00:00:00Z'})
    permit = seal({'permit_id': 'synthetic-permit', 'target': copy.deepcopy(target),
                   'approval_digest': approval['digest'], 'issued_at': '2026-11-15T23:30:00Z',
                   'expires_at': '2026-11-16T01:00:00Z', 'single_use': True})
    a['approval_reference'], a['action_permit_hash'] = approval['digest'], permit['digest']
    scenario['scenario_id'] = 'portable-replay-' + case_id
    pack = {'protocol': 'UU-AAP-PORTABLE-ACTION-EVIDENCE', 'version': '0.1',
            'evidence_class': 'SYNTHETIC_REPLAY', 'case_id': case_id, 'claim_stage': 'PLAN',
            'decision_time': '2026-11-16T00:00:00Z', 'target': target,
            'approval': approval, 'permit': permit, 'scenario': scenario,
            'harness_report': {}, 'attempts': [], 'observation': None,
            'source_bindings_digest': digest(read_json(HERE / 'source-bindings.json'))}
    return pack


def refresh_references(pack):
    if pack['approval']:
        seal(pack['approval'])
        pack['scenario']['authorized']['approval_reference'] = pack['approval']['digest']
    if pack['permit']:
        if pack['approval']:
            pack['permit']['approval_digest'] = pack['approval']['digest']
        seal(pack['permit'])
        pack['scenario']['authorized']['action_permit_hash'] = pack['permit']['digest']


def observed(pack):
    pack['claim_stage'] = 'OBSERVATION_RECORD'
    attempt = seal({'attempt_id': 'attempt-1', 'permit_digest': pack['permit']['digest'],
                    'target': copy.deepcopy(pack['target']), 'started_at': '2026-11-16T00:00:05Z',
                    'frontier': pack['target']['base_sha'], 'disposition': 'REPORTED_MERGED'})
    pack['attempts'] = [attempt]
    pack['observation'] = seal({'observation_id': 'synthetic-observation', 'attempt_id': attempt['attempt_id'],
                                'permit_digest': pack['permit']['digest'], 'target': copy.deepcopy(pack['target']),
                                'observed_at': '2026-11-16T00:00:10Z', 'status': 'MERGED',
                                'successor_commit': '5' * 40, 'successor_parent': pack['target']['base_sha'],
                                'origin': 'LOCAL_SYNTHETIC'})


def make_case(case_id):
    pack = base_pack(case_id, rewritten=case_id == 'P15')
    if case_id == 'P01':
        pack['scenario']['current_state']['head_sha'] = '9' * 40
    elif case_id == 'P02':
        pack['scenario']['current_state']['repository'] = 'Other/repository'
    elif case_id == 'P03':
        del pack['scenario']['authorized']['approval_reference']
    elif case_id == 'P04':
        pack['approval']['expires_at'] = pack['decision_time']
        refresh_references(pack)
    elif case_id == 'P05':
        pack['permit']['expires_at'] = pack['decision_time']
        refresh_references(pack)
    elif case_id == 'P06':
        pack['claim_stage'] = 'OBSERVATION_RECORD'
    if case_id in ['P07', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15']:
        observed(pack)
    if case_id in ['P10', 'P11']:
        second = copy.deepcopy(pack['attempts'][0])
        second['attempt_id'] = 'attempt-2'
        if case_id == 'P10':
            second['started_at'] = '2026-11-16T00:00:20Z'
        pack['attempts'].append(seal(second))
    elif case_id == 'P12':
        pack['attempts'][0]['disposition'] = 'UNKNOWN'
        seal(pack['attempts'][0])
        pack['observation'].update(status='UNKNOWN', successor_commit=None, successor_parent=None)
        seal(pack['observation'])
    elif case_id == 'P13':
        pack['observation']['permit_digest'] = 'sha256:' + 'e' * 64
        seal(pack['observation'])
    elif case_id == 'P14':
        pack['attempts'][0]['frontier'] = pack['observation']['successor_commit']
        seal(pack['attempts'][0])
    elif case_id == 'P16':
        pack['approval'] = None
    pack['harness_report'] = harness_report(pack['scenario'])
    seal_pack(pack)
    if case_id == 'P08':
        pack['target']['repository'] = 'Tampered/bytes'
    elif case_id == 'P09':
        pack['target']['repository'] = 'Other/rehashed-target'
        seal_pack(pack)
    return pack


def write_json(path, value):
    with Path(path).open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def export_dispersed(pack, directory):
    directory = Path(directory)
    directory.mkdir()
    index = {k: v for k, v in pack.items() if k not in ROLES}
    index['files'] = ROLES
    write_json(directory / 'index.json', index)
    for role, filename in ROLES.items():
        write_json(directory / filename, pack[role])


def run_suite(output):
    check_sources()
    protocol = read_json(HERE / 'protocol.json')
    output.mkdir(parents=True)
    cases = []
    for spec in protocol['cases']:
        case_id = spec['case_id']
        directory = output / case_id
        directory.mkdir()
        pack = make_case(case_id)
        write_json(directory / 'pack.json', pack)
        export_dispersed(pack, directory / 'dispersed')
        portable = verify(read_json(directory / 'pack.json'))
        reference = verify(load_dispersed(directory / 'dispersed'))
        write_json(directory / 'portable-receipt.json', portable)
        write_json(directory / 'composition-receipt.json', reference)
        cases.append({'case_id': case_id, 'name': spec['name'], 'expected_status': spec['expected_status'],
                      'harness_decision': pack['harness_report']['decision'],
                      'portable': portable, 'composition': reference,
                      'conform': portable['status'] == spec['expected_status'] and portable == reference,
                      'single_file_bytes': (directory / 'pack.json').stat().st_size,
                      'dispersed_bytes': sum(p.stat().st_size for p in (directory / 'dispersed').iterdir())})
    result = {'protocol': 'UU-AAP-PORTABLE-REPLAY-PILOT-RESULT', 'version': '0.1',
              'protocol_digest': digest(protocol), 'source_bindings_digest': digest(read_json(HERE / 'source-bindings.json')),
              'evidence_level': 'INTERNAL_SYNTHETIC_REPLAY', 'cases': cases,
              'metrics': {'cases': len(cases), 'conform': sum(c['conform'] for c in cases),
                          'status_counts': dict(sorted(Counter(c['portable']['status'] for c in cases).items())),
                          'harness_decisions': dict(sorted(Counter(c['harness_decision'] for c in cases).items())),
                          'packaging_verdict_differences': sum(c['portable'] != c['composition'] for c in cases),
                          'data_files_per_portable_case': 1, 'data_files_per_composition_case': 8,
                          'single_file_total_bytes': sum(c['single_file_bytes'] for c in cases),
                          'dispersed_total_bytes': sum(c['dispersed_bytes'] for c in cases)},
              'external_evaluation': {'vendor_execution': 'NOT_EXECUTED', 'independent_operator': 'NOT_EXECUTED',
                                      'customer_validation': 'NOT_EXECUTED', 'reconstruction_seconds': None,
                                      'processing_p50_ms': None, 'processing_p95_ms': None, 'willingness_to_pay': None},
              'non_effects': {'network_accessed': False, 'live_action_performed': False,
                              'authority_created': False, 'independence_established': False,
                              'commercial_advantage_established': False}}
    result['trace_digest'] = digest(result)
    write_json(output / 'results.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    suite = sub.add_parser('suite')
    suite.add_argument('--output', required=True, type=Path)
    suite.add_argument('--check-reference', action='store_true')
    export = sub.add_parser('export')
    export.add_argument('--case', default='P00')
    export.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        check_sources()
        protocol = read_json(HERE / 'protocol.json')
        if args.command == 'export':
            if args.case not in {s['case_id'] for s in protocol['cases']}:
                raise EvidenceError('UNKNOWN_CASE')
            write_json(args.output, make_case(args.case))
            print(json.dumps({'case_id':args.case,'exported':True,'evidence_class':'SYNTHETIC_REPLAY'}))
            return 0
        result = run_suite(args.output)
        if args.check_reference and canonical(result) != canonical(read_json(HERE / 'reference-results.json')):
            raise EvidenceError('FROZEN_REFERENCE_MISMATCH')
        print(json.dumps({'metrics':result['metrics'],'trace_digest':result['trace_digest'],
                          'external_evaluation':result['external_evaluation']}, indent=2))
        return 0 if all(c['conform'] for c in result['cases']) else 1
    except (EvidenceError, OSError, subprocess.SubprocessError) as exc:
        print(json.dumps({'status':'REPLAY_ERROR','reason':str(exc) if isinstance(exc, EvidenceError) else 'SOURCE_OR_OUTPUT_ERROR'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
