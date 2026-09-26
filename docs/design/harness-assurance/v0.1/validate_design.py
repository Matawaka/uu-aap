"""Validate design data only. No target execution, network, writes, or model calls."""
from __future__ import annotations
import copy
import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
FALSE_FLAGS = {
    'creates_authority', 'issues_permits', 'changes_core',
    'changes_existing_workflows', 'executes_target_controls', 'activates_runtime',
    'changes_products', 'calls_models', 'performs_deployment',
    'rewrites_historical_evidence', 'authorizes_merge',
}
REPORTS = {
    'BOUNDED_WORKFLOW_EVIDENCE_SATISFIED',
    'WORKFLOW_REQUIREMENTS_UNSATISFIED', 'INSUFFICIENT_EVIDENCE',
}


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise ValueError(reason)


def check(contract: dict, probes: dict, sources: dict) -> None:
    require(contract['status'] == 'DESIGN_DRAFT_READY_FOR_REVIEW', 'design_status')
    require(contract['operational_status'] == 'NOT_IMPLEMENTED', 'runtime_claim')
    require(contract['probe_status'] == probes['status'] == 'NOT_EXECUTED', 'probe_claim')
    require(set(contract['non_effects']) == FALSE_FLAGS, 'effect_inventory')
    require(all(v is False for v in contract['non_effects'].values()), 'effect_escalation')
    require(set(contract['report_classes']) == REPORTS, 'report_vocabulary')
    require(contract['resolution_order'] == ['UNSATISFIED', 'INSUFFICIENT_EVIDENCE', 'SATISFIED'], 'result_precedence')
    ids = [s['id'] for s in contract['stages']]
    require(bool(ids) and len(ids) == len(set(ids)), 'stage_inventory')
    graph = {s['id']: s['requires'] for s in contract['stages']}
    for key, deps in graph.items():
        require(len(deps) == len(set(deps)) and all(d in graph for d in deps), 'stage_references')
    visited, active = set(), set()
    def visit(key: str) -> None:
        require(key not in active, 'stage_cycle')
        if key in visited:
            return
        active.add(key)
        for dep in graph[key]:
            visit(dep)
        active.remove(key)
        visited.add(key)
    for key in graph:
        visit(key)
    require(graph['implementation_recorded'] == ['expected_red_observed'], 'red_dependency')
    require(set(graph['evidence_reduced']) == {'green_observed', 'code_reviewed'}, 'parallel_join')
    require(contract['risk_policy']['sensitive_overrides_loc'] is True, 'risk_floor')
    require(contract['risk_policy']['silent_downgrade_allowed'] is False, 'tier_downgrade')
    require(contract['budget_policy']['exceeded_result'] == 'INCOMPLETE_NOT_SUCCESS', 'budget_promotion')
    require(contract['next_task']['state'] == 'NOT_STARTED', 'implementation_promotion')
    require(all(contract['next_task'][k] is False for k in ['network', 'model_calls', 'target_control_execution']), 'successor_scope')
    cases = probes['cases']
    require(len(cases) == 40, 'case_inventory')
    require([c['id'] for c in cases] == [f'HA-P{i:02}' for i in range(1, 41)], 'case_identity')
    require(len({c['expected_reason'] for c in cases}) == 40, 'case_reason_identity')
    require(all(c['expected_requirement_status'] in contract['requirement_statuses'] for c in cases), 'case_status')
    require({c['expected_requirement_status'] for c in cases} == {'SATISFIED', 'UNSATISFIED', 'INSUFFICIENT_EVIDENCE'}, 'case_balance')
    require(probes['fixture_origin'] == 'AUTHORED_DESIGN_SCENARIOS_NOT_OBSERVATIONS', 'case_origin')
    require([s['id'] for s in sources['uploaded_files']] == ['S1', 'S2', 'S3', 'S4'], 'source_identity')
    require(all(re.fullmatch('[0-9a-f]{64}', s['sha256']) and s['bytes'] > 0 and s['redistributed'] is False for s in sources['uploaded_files']), 'source_metadata')
    require(contract['repository_predecessor'] == sources['repository_frontier'], 'frontier_binding')
    require(sources['channel_excerpt']['complete_history_read'] is False, 'channel_overclaim')


def main() -> None:
    contract = json.loads((HERE / 'design-contract.json').read_text())
    probes = json.loads((HERE / 'probe-matrix.json').read_text())
    sources = json.loads((HERE / 'sources.json').read_text())
    check(contract, probes, sources)
    mutations = [
        lambda c: c['non_effects'].__setitem__('issues_permits', True),
        lambda c: c.__setitem__('operational_status', 'IMPLEMENTED'),
        lambda c: c.__setitem__('probe_status', 'PASS'),
        lambda c: c['stages'][0]['requires'].append('ready_for_human_decision'),
        lambda c: c['stages'][3].__setitem__('requires', []),
        lambda c: c['stages'][6].__setitem__('requires', ['green_observed']),
        lambda c: c['risk_policy'].__setitem__('sensitive_overrides_loc', False),
        lambda c: c['budget_policy'].__setitem__('exceeded_result', 'SUCCESS'),
        lambda c: c['next_task'].__setitem__('network', True),
        lambda c: c['non_effects'].pop('authorizes_merge'),
    ]
    rejected = 0
    for mutate in mutations:
        candidate = copy.deepcopy(contract)
        mutate(candidate)
        try:
            check(candidate, probes, sources)
        except ValueError:
            rejected += 1
        else:
            raise ValueError('design_mutation_not_rejected')
    roadmap = ROOT / 'docs/roadmaps/HARNESS-ASSURANCE-2026-09-26.md'
    text = roadmap.read_text()
    for row in contract['roadmap']:
        require(f"| {row['id']} | {row['priority']} | {row['status']} |" in text, 'roadmap_status_parity')
    for md in (HERE / 'DESIGN.md', roadmap):
        for link in re.findall(r'\]\(([^)]+)\)', md.read_text()):
            if not link.startswith(('http:', 'https:', '#')):
                require((md.parent / link.split('#')[0]).is_file(), 'document_link')
    files = sorted([HERE / n for n in ['DESIGN.md', 'design-contract.json', 'probe-matrix.json', 'sources.json', 'validate_design.py']] + [roadmap])
    records = []
    for path in files:
        data = path.read_bytes()
        records.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
                        'sha256': hashlib.sha256(data).hexdigest(),
                        'git_blob_sha1': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()})
    print(json.dumps({'result': 'DESIGN_DATA_CHECKS_PASS', 'scope': 'LOCAL_STATIC_DESIGN_CHECKS_ONLY',
                      'design_mutations_rejected': rejected, 'planned_operational_cases': len(probes['cases']),
                      'operational_cases_executed': 0, 'target_controls_executed': 0,
                      'external_harness_executed': False, 'independent_review_performed': False,
                      'files': records}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
