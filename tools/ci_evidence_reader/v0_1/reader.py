# SPDX-License-Identifier: Apache-2.0
"""Read captured HA-1 CI R2 bytes; never execute evidence or issue permission."""
from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import re
import stat
import zipfile
import zlib

MAX_BYTES = 2_000_000
MAX_MEMBER = 512_000
MEMBERS = {'ci-report.json', 'ci-gate-tests.log', 'ha1-tests.log', 'ha0-design.json'}
LOGS = MEMBERS - {'ci-report.json'}
GOOD, BAD, GAP, FAIL = 'CAPTURE_MATCHED', 'CAPTURE_INCONSISTENT', 'CAPTURE_INCOMPLETE', 'CAPTURE_RECORDED_FAILURE'
NON_EFFECTS = {k: False for k in ('issues_permits', 'authorizes_merge', 'executes_evidence', 'calls_network', 'calls_models', 'changes_target', 'claims_independent_review')}
REPORT_NON_EFFECTS = {k: False for k in ('authorizes_merge', 'issues_permits', 'independent_review', 'qualifies_live_recorder', 'executes_target_controls', 'starts_ha2')}
GAPS = {
    'independent_review': 'CI is not an independent review.',
    'test_first_execution': 'This CI format does not establish expected RED before implementation.',
    'design_and_contract_review': 'Passing design-data checks do not establish design acceptance.',
    'owner_acceptance': 'The captured format contains no owner acceptance decision.',
    'merge_result': 'The reported source is a PR head, not a qualified merge result.',
    'live_recorder_authentication': 'Caller-selected capture and hashes do not authenticate a live recorder.',
    'external_action_authority': 'CI evidence does not issue an action permit.',
}


class Invalid(ValueError):
    """Fixed diagnostic code; never reflect untrusted text."""


def require(value: bool, code: str = 'invalid_shape') -> None:
    if not value:
        raise Invalid(code)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse(data: bytes) -> dict:
    require(type(data) is bytes and len(data) <= MAX_BYTES, 'input_limit')
    def pairs(items):
        obj = {}
        for key, value in items:
            require(key not in obj, 'duplicate_key')
            obj[key] = value
        return obj
    def no_number(_):
        raise Invalid('unsupported_number')
    value = json.loads(data.decode('utf-8'), object_pairs_hook=pairs,
                       parse_float=no_number, parse_constant=no_number)
    count = [0]
    def walk(item, depth=0):
        count[0] += 1
        require(depth <= 32 and count[0] <= 30_000, 'input_limit')
        if type(item) is dict:
            require(len(item) <= 2048, 'input_limit')
            for k, v in item.items():
                require(type(k) is str and len(k) <= 256, 'invalid_key')
                k.encode('utf-8'); walk(v, depth + 1)
        elif type(item) is list:
            require(len(item) <= 2048, 'input_limit')
            for v in item: walk(v, depth + 1)
        elif type(item) is str:
            require(len(item) <= 131072, 'input_limit'); item.encode('utf-8')
        elif type(item) is int:
            require(abs(item) < 2**53, 'integer_range')
        else:
            require(item is None or type(item) is bool, 'invalid_type')
    walk(value)
    require(type(value) is dict)
    return value


def unique_strings(value, nonempty=True):
    require(type(value) is list and all(type(x) is str and x.strip() for x in value))
    require(len(value) == len(set(value)), 'duplicate_identity')
    require(bool(value) or not nonempty, 'empty_inventory')
    return sorted(value)


def valid_expectation(e):
    require(e.get('schema') == 'matawaka.ci-reader.expectation/v0.1', 'unsupported_expectation')
    for k in ('run_id', 'attempt', 'repository_id'):
        require(type(e[k]) is int and e[k] > 0)
    for k in ('source_sha', 'source_tree', 'source_checkpoint'):
        require(type(e[k]) is str and re.fullmatch('[0-9a-f]{40}', e[k]) is not None)
    require(re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', e['repository']) is not None)
    require(e['event'] == 'pull_request' and e['workflow_path'] == '.github/workflows/harness-assurance-v0.1.yml', 'unsupported_profile')
    for k, n in [('source_pins', 14), ('ci_source_hashes', 4)]:
        require(type(e[k]) is dict and len(e[k]) == n, 'source_inventory_invalid')
        for p, h in e[k].items():
            require(type(h) is str and re.fullmatch('[0-9a-f]{64}', h) is not None)
    require(len(unique_strings(e['import_surface'])) == 8, 'import_inventory_invalid')
    require(set(e['test_ids']) == {'ha1_tests', 'ci_gate_tests'})
    for k,n in [('ha1_tests',114),('ci_gate_tests',46)]:
        require(len(unique_strings(e['test_ids'][k])) == n, 'test_inventory_invalid')
    require(set(e['mutants']) == {'original_mutants', 'review_mutants'})
    for k,n in [('original_mutants',7),('review_mutants',8)]:
        require(len(unique_strings(e['mutants'][k])) == n, 'mutation_inventory_invalid')
    require(type(e['jobs']) is list and len(e['jobs']) == 2)
    require({j['slot'] for j in e['jobs']} == {'py312','py313'})
    for key in ('job_id','artifact_id','name','artifact_name'):
        require(len({j[key] for j in e['jobs']}) == 2, 'duplicate_expected_job')
    for j in e['jobs']:
        require(j['python_prefix'] == {'py312':'3.12','py313':'3.13'}[j['slot']])
        require(type(j['job_id']) is int and type(j['artifact_id']) is int)
        require(j['job_id'] > 0 and j['artifact_id'] > 0)
        require(re.fullmatch('[0-9a-f]{64}', j['archive_sha256']) is not None)
        require(j['name'] == 'HA-1 / Python '+j['python_prefix'])
        require(j['execution_step'] == 'Execute exact HA-1 inventory and CI guard checks')


def zip_members(data: bytes) -> dict[str, bytes]:
    """Bounded in-memory reading only. Never extract or follow a member path."""
    require(type(data) is bytes and len(data) <= MAX_BYTES, 'archive_limit')
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        infos = z.infolist()
        require(len(infos) <= 4, 'archive_member_count')
        names = [x.filename for x in infos]
        require(len(set(names)) == len(names), 'archive_duplicate_member')
        total = 0
        for item in infos:
            require(item.filename in MEMBERS and item.orig_filename == item.filename, 'archive_member_refused')
            require(not item.is_dir(), 'archive_nonregular_member')
            require(stat.S_IFMT(item.external_attr >> 16) in (0, stat.S_IFREG), 'archive_nonregular_member')
            require(not item.flag_bits & 1, 'archive_encrypted')
            require(item.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'archive_compression')
            require(0 <= item.file_size <= MAX_MEMBER, 'archive_member_limit')
            total += item.file_size
        require(total <= MAX_BYTES, 'archive_limit')
        return {i.filename: z.read(i) for i in infos}


def typed_equal(a, b) -> bool:
    """JSON equality with recursive type identity (0 is not false)."""
    if type(a) is not type(b):
        return False
    if type(a) is dict:
        return a.keys() == b.keys() and all(typed_equal(a[k],b[k]) for k in a)
    if type(a) is list:
        return len(a) == len(b) and all(typed_equal(x,y) for x,y in zip(a,b))
    return a == b


def assess(expectation: bytes, capture: bytes, archives: dict[str, bytes]) -> dict:
    """Pure deterministic assessment; expectations are an explicit caller trust input."""
    rows, job_results, warnings = [], [], []
    def add(status, code, subject='capture'):
        rows.append({'status':status, 'code':code, 'subject':subject})
    def equal(actual, expected, code, subject):
        ok = typed_equal(actual, expected)
        add('MATCHED' if ok else 'MISMATCH', code, subject)
        return ok
    def state(obj, subject):
        if obj.get('status') != 'completed': add('MISSING','not_completed',subject)
        elif obj.get('conclusion') == 'success': add('MATCHED','completed_success',subject)
        elif obj.get('conclusion') in ('failure','cancelled','timed_out','action_required'):
            add('FAILURE','recorded_non_success',subject)
        else: add('MISSING','success_not_established',subject)
    result = {'schema':'matawaka.ci-reader.assessment/v0.1', 'status':GAP,
              'trust_basis':'CALLER_SELECTED_CAPTURE_NOT_AUTHENTICATED_BY_READER',
              'workflow_assurance':'INSUFFICIENT_EVIDENCE', 'gaps':dict(GAPS),
              'non_effects':dict(NON_EFFECTS), 'checks':rows, 'jobs':job_results,
              'warnings':warnings, 'input_hashes':{}}
    try:
        e = parse(expectation); valid_expectation(e)
        result.update(repository=e['repository'], run_id=e['run_id'], attempt=e['attempt'], source_sha=e['source_sha'])
        result['input_hashes']['expectation'] = sha(expectation)
        c = parse(capture)
        result['input_hashes']['capture'] = sha(capture)
        require(c.get('schema') == 'matawaka.ci-reader.capture/v0.1', 'unsupported_capture')
        provenance = c['provenance']; require(type(provenance) is dict)
        method = provenance['method']
        if method == 'CONNECTOR_GET_SELECTED_FIELDS_MANUAL_PROJECTION':
            require(provenance['raw_http_bytes_retained'] is False, 'capture_provenance_unsupported')
        elif method == 'BOUNDED_GITHUB_GET_PROJECTION_V1':
            origin = provenance.get('transport_origin')
            require(origin in ('HTTP_RESPONSE_BODY','CONNECTOR_SELECTED_JSON_REPLAY','SYNTHETIC_REPLAY'), 'capture_provenance_unsupported')
            require(provenance.get('raw_http_bytes_retained') is (origin == 'HTTP_RESPONSE_BODY'), 'capture_provenance_unsupported')
            issues = provenance.get('issues'); require(type(issues) is list)
            status = provenance.get('collection_status')
            if status == 'COLLECTION_INCONSISTENT': add('MISMATCH','collection_inconsistent')
            elif status != 'METADATA_CAPTURED' or issues: add('MISSING','collection_incomplete')
            else: add('MATCHED','bounded_collection_reported')
            # Collector metadata is a supplied observation, NOT independently verified transport.
            result['capture_transport_origin'] = origin
        else:
            raise Invalid('capture_provenance_unsupported')
        result['capture_provenance'] = method
        require(type(archives) is dict and set(archives) <= {'py312','py313'}, 'archive_slots_invalid')
        run = c['run']; require(type(run) is dict)
        for k, ek in [('id','run_id'),('attempt','attempt'),('source_sha','source_sha'),('repository_id','repository_id'),('workflow_path','workflow_path'),('event','event')]:
            equal(run.get(k), e[ek], 'run_'+k, 'run')
        state(run,'run')
        lookup = {}
        for kind in ('jobs','artifacts'):
            require(type(c[kind]) is dict)
            observed = c[kind]['rows']; require(type(observed) is list and all(type(x) is dict for x in observed))
            ids = [x['id'] for x in observed]
            require(all(type(x) is int and x > 0 for x in ids))
            require(len(ids) == len(set(ids)), 'duplicate_'+kind)
            total = c[kind]['total_count']; require(type(total) is int and total >= 0)
            if total != len(ids): add('MISSING','capture_pagination_incomplete',kind)
            wanted = {j['job_id' if kind == 'jobs' else 'artifact_id'] for j in e['jobs']}
            if set(ids) - wanted: add('MISMATCH','unexpected_'+kind,kind)
            if wanted - set(ids): add('MISSING','missing_'+kind,kind)
            lookup[kind] = {r['id']:r for r in observed}
        for job in sorted(e['jobs'], key=lambda j:j['slot']):
            slot = job['slot']; begin = len(rows)
            summary = {'slot':slot, 'job_id':job['job_id'], 'artifact_id':job['artifact_id'], 'python':None,
                       'ha1_tests':None,'ci_gate_tests':None,'report_status':None,'assessment':GAP}
            job_results.append(summary)
            j = lookup['jobs'].get(job['job_id'])
            if j is not None:
                for k, v in [('name',job['name']),('run_id',e['run_id']),('attempt',e['attempt']),('source_sha',e['source_sha'])]:
                    equal(j.get(k),v,'job_'+k,slot)
                state(j,slot)
                require(type(j.get('steps')) is list and all(type(s) is dict for s in j['steps']))
                steps = [s for s in j['steps'] if s.get('name') == job['execution_step']]
                if not steps: add('MISSING','execution_step_missing',slot)
                elif len(steps) != 1: add('MISMATCH','execution_step_ambiguous',slot)
                else: state(steps[0],slot+'/execution')
            else: add('MISSING','job_observation_missing',slot)
            meta = lookup['artifacts'].get(job['artifact_id'])
            if meta is not None:
                for k,v in [('name',job['artifact_name']),('run_id',e['run_id']),('source_sha',e['source_sha']),('repository_id',e['repository_id']),('archive_sha256',job['archive_sha256'])]:
                    equal(meta.get(k),v,'artifact_'+k,slot)
                if meta.get('expired') is True: warnings.append({'code':'upstream_expired_local_bytes_still_checkable','subject':slot})
                elif meta.get('expired') is not False: add('MISSING','artifact_retention_unknown',slot)
            else: add('MISSING','artifact_metadata_missing',slot)
            data = archives.get(slot)
            if data is None:
                add('MISSING','archive_missing',slot); summary['assessment'] = _status(rows[begin:]); continue
            require(type(data) is bytes and len(data) <= MAX_BYTES, 'archive_limit')
            result['input_hashes'][slot] = sha(data)
            if not equal(sha(data),job['archive_sha256'],'archive_digest',slot):
                summary['assessment'] = _status(rows[begin:]); continue
            try:
                files = zip_members(data)
                if set(files) != MEMBERS: add('MISSING','archive_files_missing',slot)
                if 'ci-report.json' not in files: continue
                report = parse(files['ci-report.json'])
                summary['report_sha256'] = sha(files['ci-report.json'])
                if report.get('schema') != 'matawaka.ha1.ci-execution/v0.1':
                    add('MISSING','unsupported_report',slot); continue
                # Identity before interpreting success. All output facts are conditional.
                for k,v in [('source_sha',e['source_sha']),('source_tree',e['source_tree']),('run_id',str(e['run_id'])),('run_attempt',str(e['attempt']))]:
                    equal(report.get(k),v,'report_'+k,slot)
                for k,v in [('source_pins',e['source_pins']),('ci_source_hashes',e['ci_source_hashes']),('source_checkpoint',e['source_checkpoint']),('non_effects',REPORT_NON_EFFECTS),('isolated_python',True),('hash_seed','RANDOMIZED_ISOLATED'),('platform','linux'),('scope','SYNTHETIC_TEST_EXECUTION_NOT_INDEPENDENT_REVIEW')]:
                    equal(report.get(k),v,'report_'+k,slot)
                equal(unique_strings(report.get('import_surface',[])), sorted(e['import_surface']), 'import_surface',slot)
                py = report.get('python'); match = re.match(r'^(\d+\.\d+\.\d+)(?:\s|$)',py) if type(py) is str else None
                if match and match[1].startswith(job['python_prefix']+'.'): summary['python'] = match[1]
                else: add('MISMATCH','interpreter_mismatch',slot)
                log_hashes = report.get('log_hashes',{}); require(type(log_hashes) is dict)
                equal(sorted(log_hashes), sorted(LOGS), 'log_inventory',slot)
                for name in sorted(LOGS):
                    if name in files: equal(sha(files[name]),log_hashes.get(name),'log_digest_'+name,slot)
                    else: add('MISSING','log_missing_'+name,slot)
                if report.get('status') == 'CI_CHECKS_FAIL':
                    summary['report_status'] = 'CI_CHECKS_FAIL'; add('FAILURE','ci_report_failure',slot); continue
                if report.get('status') != 'CI_CHECKS_PASS': add('MISSING','ci_report_status_unknown',slot); continue
                summary['report_status'] = 'CI_CHECKS_PASS'
                checks = report.get('checks',{}); require(type(checks) is dict)
                equal(set(checks), {'ha1_tests','ci_gate_tests','original_mutants','review_mutants','historical_design'}, 'check_inventory',slot)
                for suite in ('ha1_tests','ci_gate_tests'):
                    r = checks.get(suite)
                    if r is None: add('MISSING','test_result_missing',slot); continue
                    require(type(r) is dict)
                    ok = equal(unique_strings(r.get('executed_ids',[])),sorted(e['test_ids'][suite]),'test_identity_'+suite,slot)
                    ok = equal(r.get('tests'),len(e['test_ids'][suite]),'test_count_'+suite,slot) and ok
                    for k in ('failures','errors','skipped','expected_failures','unexpected_successes'):
                        ok = equal(r.get(k),0,'test_'+k+'_'+suite,slot) and ok
                    if ok: summary[suite] = r['tests']
                for kind in ('original_mutants','review_mutants'):
                    r = checks.get(kind)
                    if r is None: add('MISSING','mutation_result_missing',slot); continue
                    require(type(r) is dict)
                    expected_names = e['mutants'][kind]
                    for k in ('count','detected'): equal(r.get(k),len(expected_names),'mutation_'+k,slot)
                    equal(r.get('coverage_percentage_claimed'),False,'mutation_coverage_claim',slot)
                    samples = r.get('sample',[]); require(type(samples) is list and all(type(x) is dict for x in samples))
                    equal(unique_strings([x['mutation'] for x in samples]),sorted(expected_names),'mutation_identities',slot)
                    for row in samples:
                        equal(row.get('killed'),True,'mutation_survived',slot)
                        if kind == 'review_mutants':
                            equal(row.get('baseline_satisfied'),True,'mutation_benign_failed',slot)
                            equal(row.get('errors'),0,'mutation_unrelated_error',slot)
                            require(type(row.get('assertion_failures')) is int)
                            if row['assertion_failures'] <= 0: add('MISMATCH','mutation_assertion_missing',slot)
                            target = row.get('target_test')
                            if type(target) is not str or 'test_adversarial.'+target not in e['test_ids']['ha1_tests']:
                                add('MISMATCH','mutation_target_unknown',slot)
                        else:
                            ids = unique_strings(row.get('caught_by_cases',[]))
                            if not set(ids) <= {f'HA-P{i:02}' for i in range(1,41)}: add('MISMATCH','mutation_catching_case_unknown',slot)
                equal(checks.get('historical_design'),{'result':'DESIGN_DATA_CHECKS_PASS','mutations_rejected':10,'scope':'STATIC_DESIGN_ONLY'},'historical_design_summary',slot)
                if 'ha0-design.json' in files:
                    d = parse(files['ha0-design.json'])
                    for k,v in [('result','DESIGN_DATA_CHECKS_PASS'),('design_mutations_rejected',10),('operational_cases_executed',0),('target_controls_executed',0),('independent_review_performed',False)]:
                        equal(d.get(k),v,'historical_design_'+k,slot)
            except (Invalid, ValueError, TypeError, KeyError, RecursionError, UnicodeError, zipfile.BadZipFile, NotImplementedError, RuntimeError, zlib.error):
                add('MISSING','artifact_uninterpretable',slot)
            finally:
                summary['assessment'] = _status(rows[begin:])
        distinct = set()
        for ids in e['test_ids'].values(): distinct.update(ids)
        result['expected_distinct_methods'] = len(distinct)
        result['expected_job_executions'] = len(e['jobs'])
    except (Invalid, ValueError, TypeError, KeyError, RecursionError, UnicodeError, OverflowError):
        add('MISSING','input_invalid')
    result['status'] = _status(rows)
    # An empty row list is never a success. No stdout, clock or other side effects.
    return result


def _status(rows):
    states = {x['status'] for x in rows}
    return BAD if 'MISMATCH' in states else FAIL if 'FAILURE' in states else GAP if not rows or 'MISSING' in states else GOOD


def render_html(report: dict) -> str:
    """Script-free, escaped presentation. No raw evidence or external dependencies."""
    esc = lambda v: html.escape(str(v),quote=True)
    names = {GOOD:'CI-пакет согласован',BAD:'Обнаружены несоответствия',GAP:'Недостаточно данных CI',FAIL:'В CI зафиксирован отказ'}
    cells = ''.join('<tr>'+''.join('<td>'+esc(j.get(k,'—') if j.get(k) is not None else '—')+'</td>' for k in ('slot','python','ha1_tests','ci_gate_tests','assessment'))+'</tr>' for j in report['jobs'])
    issues = ''.join('<li>'+esc(r['subject'])+' — '+esc(r['code'])+'</li>' for r in report['checks'] if r['status'] != 'MATCHED') or '<li>В пределах проверенного состава несоответствий не обнаружено.</li>'
    gap_text = {'independent_review':'Независимое ревью', 'test_first_execution':'Ожидаемый RED до реализации', 'design_and_contract_review':'Приёмка дизайна и контракта', 'owner_acceptance':'Решение владельца', 'merge_result':'Проверка результата merge', 'live_recorder_authentication':'Аутентификация живого регистратора', 'external_action_authority':'Полномочия на внешнее действие'}
    gaps = ''.join('<li>'+esc(gap_text[k])+' — не устанавливается этим форматом CI.</li>' for k in GAPS)
    return '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Matawaka · CI Evidence</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:1080px;margin:3rem auto;padding:0 24px}h1{font-size:2.4rem;line-height:1.2}h2{margin-top:2.3rem}small{font-size:.8em}code{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:.88em}td,th{padding:12px;text-align:left;border-bottom:1px solid}section{padding:18px;border:1px solid;border-radius:8px}li{margin:.6rem 0}footer{margin:3rem 0}</style>
<header><small>MATAWAKA / EXPERIMENTAL CI EVIDENCE READER</small><h1>'''+esc(names.get(report['status'],report['status']))+'''</h1><p>Импортированная проверка — не разрешение на действие.</p></header><section><strong>Источник:</strong> '''+esc(report.get('repository','—'))+'''<br><strong>Run / attempt:</strong> '''+esc(report.get('run_id','—'))+' / '+esc(report.get('attempt','—'))+'''<br><strong>SHA:</strong> <code>'''+esc(report.get('source_sha','—'))+'''</code></section><h2>Что подтверждают предоставленные отчёты</h2><table><thead><tr><th>Задание</th><th>Python</th><th>HA-1</th><th>CI-обвязка</th><th>Сверка</th></tr></thead><tbody>'''+cells+'''</tbody></table><p>Количество методов не суммируется между версиями Python. Сверены закреплённые источники, состав тестов, мутации, архивы и журналы. Это не повторный запуск тестов.</p><h2>Несоответствия или недостающие данные</h2><ul>'''+issues+'''</ul><h2>Чего CI не доказывает</h2><ul>'''+gaps+'''</ul><footer>Доверие: явно выбранная вызывающей стороной сохранённая выборка. Метаданные — явно обозначенная проекция источника; способ сбора сам по себе не подтверждает аутентичность. Читатель не выполняет код из архивов, не вызывает сеть и не выдаёт permit. Разработка может продолжаться отдельно от приёмки.</footer></html>'''


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--expectation',required=True); p.add_argument('--capture',required=True)
    p.add_argument('--py312'); p.add_argument('--py313')
    p.add_argument('--format',choices=['json','html'],default='json')
    args = p.parse_args()
    def read(path):
        with open(path,'rb') as f: data=f.read(MAX_BYTES+1)
        require(len(data) <= MAX_BYTES,'input_limit')
        return data
    try:
        archives = {k:read(getattr(args,k)) for k in ('py312','py313') if getattr(args,k)}
        report = assess(read(args.expectation),read(args.capture),archives)
    except (OSError,Invalid):
        report = assess(b'{}',b'{}',{})
    print(render_html(report) if args.format == 'html' else json.dumps(report,ensure_ascii=True,indent=2))
    return {GOOD:0,BAD:1,GAP:2,FAIL:3}[report['status']]


if __name__ == '__main__':
    raise SystemExit(main())
