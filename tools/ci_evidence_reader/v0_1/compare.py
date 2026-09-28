# SPDX-License-Identifier: Apache-2.0
"""Compare two evidence packages by typed scope; never infer code regression."""
from __future__ import annotations
import argparse
import html
import importlib.util
import json
from pathlib import Path

_spec = importlib.util.spec_from_file_location('comparison_reader',Path(__file__).with_name('reader.py'))
r=importlib.util.module_from_spec(_spec); _spec.loader.exec_module(r)


def compare_packages(before: tuple, after: tuple) -> dict:
    """Each tuple is (expectation bytes, capture bytes, archives dict).

    Both sides are assessed here; saved summaries are never accepted as evidence.
    A Python slot is only a logical pairing label, not physical execution identity.
    """
    out={'schema':'matawaka.ci-reader.comparison/v0.1','status':'COMPARISON_INCOMPLETE',
         'scope':None,'changes':[],'jobs':[], 'non_effects':dict(r.NON_EFFECTS),
         'limitations':['Evidence changes are not proven code regressions.',
                        'Caller-selected snapshots do not establish chronology or live authentication.',
                        'Logical slots never establish identical physical execution.']}
    try:
        a,b=r.assess(*before),r.assess(*after)
        ea,eb=r.parse(before[0]),r.parse(after[0]);r.valid_expectation(ea);r.valid_expectation(eb)
        out['assessments']={'before':a,'after':b}
        out['source_hashes']={'before':dict(a['input_hashes']),'after':dict(b['input_hashes'])}
        scope=lambda e:(e['repository_id'],e['repository'],e['workflow_path'])
        if scope(ea)!=scope(eb):
            out['status']='NOT_COMPARABLE';out['scope']='DIFFERENT_REPOSITORY_OR_WORKFLOW';return out
        same_attempt=(ea['run_id'],ea['attempt'])==(eb['run_id'],eb['attempt'])
        out['scope']='SAME_ATTEMPT' if same_attempt else 'DISTINCT_EXECUTIONS_LOGICALLY_PAIRED'
        def change(code, left, right):
            if not r.typed_equal(left,right):out['changes'].append({'code':code,'before':left,'after':right})
        for field in ('run_id','attempt','source_sha','source_tree'):
            change(field,ea[field],eb[field])
        if same_attempt and (ea['source_sha']!=eb['source_sha'] or ea['source_tree']!=eb['source_tree']):
            out['status']='INCONSISTENT_EXECUTION_IDENTITY';return out
        def inventory(e):
            return {'source_pins':e['source_pins'],'ci_source_hashes':e['ci_source_hashes'],
                    'test_ids':{k:sorted(v) for k,v in e['test_ids'].items()},
                    'mutants':{k:sorted(v) for k,v in e['mutants'].items()},'import_surface':sorted(e['import_surface'])}
        if not r.typed_equal(inventory(ea),inventory(eb)):
            out['changes'].append({'code':'expectation_inventory_changed','before':'BOUND_BEFORE','after':'BOUND_AFTER'})
        change('capture_assessment',a['status'],b['status'])
        def signature(report):
            return sorted((v['subject'],v['code'],v['status']) for v in report['checks']
                          if v['status']!='MATCHED')
        change('nonmatching_checks',signature(a),signature(b))
        for slot in ('py312','py313'):
            pairs=[]
            for e, report in ((ea,a),(eb,b)):
                expected=next(j for j in e['jobs'] if j['slot']==slot)
                observed=next((j for j in report['jobs'] if j['slot']==slot),{})
                pairs.append({'physical_key':['job',e['repository_id'],e['run_id'],e['attempt'],expected['job_id']],
                              'artifact_key':['artifact',e['repository_id'],expected['artifact_id']],
                              'archive_sha256':expected['archive_sha256'],
                              **{k:observed.get(k) for k in ('assessment','report_sha256','ha1_tests','ci_gate_tests','python')}})
            left,right=pairs
            out['jobs'].append({'logical_slot':slot,'same_execution_identity':left['physical_key']==right['physical_key'],
                                'before':left,'after':right})
            change('job_'+slot,left,right)
        # Missing or unparseable inputs must not produce a reassuring no-change verdict.
        if any(x['status']!=r.GOOD for x in (a,b)):
            out['status']='EVIDENCE_LOSS' if a['status']==r.GOOD and b['status']!=r.GOOD else 'COMPARISON_INCOMPLETE'
        else:out['status']='OBSERVED_CHANGE' if out['changes'] else 'NO_OBSERVED_CHANGE'
    except (r.Invalid,ValueError,TypeError,KeyError,StopIteration,UnicodeError):
        out['status']='COMPARISON_INCOMPLETE'
    return out


def render_html(report):
    esc=lambda v:html.escape(str(v),quote=True)
    names={'NO_OBSERVED_CHANGE':'Подтверждённый состав не изменился','OBSERVED_CHANGE':'Обнаружено изменение',
           'EVIDENCE_LOSS':'Во второй выборке потеряны свидетельства','COMPARISON_INCOMPLETE':'Сравнение неполно',
           'NOT_COMPARABLE':'Выборки относятся к разным областям','INCONSISTENT_EXECUTION_IDENTITY':'Противоречивая идентичность запуска'}
    rows=''.join('<tr><td>'+esc(j['logical_slot'])+'</td><td>'+esc(j['before']['assessment'])+'</td><td>'+esc(j['after']['assessment'])+'</td><td>'+esc(j['same_execution_identity'])+'</td></tr>' for j in report['jobs'])
    changes=''.join('<li>'+esc(c['code'])+'</li>' for c in report['changes']) or '<li>Изменений в проверяемом составе не выявлено.</li>'
    return '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Matawaka · Сравнение CI</title><style>body{font:17px/1.6 system-ui;max-width:1050px;margin:3rem auto;padding:0 24px}h1{line-height:1.2}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid;overflow-wrap:anywhere}code{overflow-wrap:anywhere}section{padding:16px;border:1px solid;border-radius:8px}footer{margin-top:3rem}</style></head><body><small>MATAWAKA / CI EVIDENCE COMPARISON</small><h1>'''+esc(names.get(report['status'],'Сравнение неполно'))+'''</h1><section>Область: <code>'''+esc(report['scope'])+'''</code><br>Это сравнение сохранённых свидетельств, не повторный запуск тестов.</section><h2>Логические пары заданий</h2><table><tr><th>Среда</th><th>До</th><th>После</th><th>Тот же запуск</th></tr>'''+rows+'''</table><h2>Изменения</h2><ul>'''+changes+'''</ul><footer>Потеря evidence не доказывает регрессию кода. Разные попытки не объединяются. Неизвестные результаты остаются неизвестными. Сравнение не выдаёт разрешений и не заменяет приёмку.</footer></body></html>'''


def read_package(folder):
    folder=Path(folder)
    def read(name):
        with (folder/name).open('rb') as stream:data=stream.read(r.MAX_BYTES+1)
        r.require(len(data)<=r.MAX_BYTES,'input_limit');return data
    return read('expectation.json'),read('capture.json'),{slot:read(slot+'.zip') for slot in ('py312','py313') if (folder/(slot+'.zip')).exists()}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--before',required=True);p.add_argument('--after',required=True)
    p.add_argument('--format',choices=('json','html'),default='json');args=p.parse_args()
    try:result=compare_packages(read_package(args.before),read_package(args.after))
    except (OSError,r.Invalid):result=compare_packages((b'{}',b'{}',{}),(b'{}',b'{}',{}))
    print(render_html(result) if args.format=='html' else json.dumps(result,ensure_ascii=True,indent=2))
    return 0 if result['status'] in ('NO_OBSERVED_CHANGE','OBSERVED_CHANGE') else 2


if __name__=='__main__':raise SystemExit(main())
