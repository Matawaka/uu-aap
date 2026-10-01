# SPDX-License-Identifier: Apache-2.0
"""Project one caller-selected collection index offline; never diagnose a cause."""
from __future__ import annotations

import argparse
import html
import importlib.util
import json
from pathlib import Path
import sys

_spec = importlib.util.spec_from_file_location('collection_view_collector', Path(__file__).with_name('collector.py'))
c = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = c
_spec.loader.exec_module(c)
r = c.r
SCHEMA = 'matawaka.ci-reader.collection-view/v0.1'
ISSUE_CODES = frozenset('''invalid_budget budget_above_profile transport_origin_invalid
path_refused repository_refused replay_origin_invalid replay_exhausted replay_path_mismatch
time_budget call_budget body_limit total_byte_budget transport_shape transport_body
run_repository_missing page_shape pagination_total_changed page_overfull row_identity_invalid
duplicate_page_identity pagination_count_overflow pagination_short_page page_budget
job_steps_missing artifact_owner_missing artifact_digest_missing run_binding_mismatch
repository_binding_mismatch source_tree_mismatch fence_missing run_changed_during_collection
expected_jobs_missing unexpected_jobs expected_artifacts_missing unexpected_artifacts
foreign_job foreign_artifact transport_unavailable response_uninterpretable http_non_success
input_limit duplicate_key unsupported_number invalid_key invalid_type invalid_shape
integer_range duplicate_identity empty_inventory'''.split()) | {
    'http_' + str(status) for status in (301, 302, 307, 308, 401, 403, 404, 410, 429, 500, 502, 503)}


def refused(code='collection_index_invalid'):
    return {'schema': SCHEMA, 'status': 'DIAGNOSTICS_REFUSED', 'code': code,
            'diagnostics_only': True, 'origin_authenticated': False,
            'http_error_cause': 'NOT_ESTABLISHED', 'non_effects': dict(r.NON_EFFECTS)}


def view(data: bytes) -> dict:
    """Keep only bounded status fields and the existing safe header projection.

    Recorded origin/status are caller claims. Paths, files, bodies and other
    provenance fields are neither used nor returned; no sibling file is read.
    """
    try:
        index = r.parse(data)
        origin, rows, provenance = index['origin'], index['responses'], index['provenance']
        r.require(type(origin) is str and origin in c.ORIGINS)
        r.require(type(rows) is list and len(rows) <= 12 and type(provenance) is dict)
        r.require(provenance['method'] == c.METHOD and provenance['transport_origin'] == origin)
        status, issues = provenance['collection_status'], provenance['issues']
        r.require(type(status) is str and status in (c.COMPLETE, c.INCOMPLETE, c.INCONSISTENT))
        r.require(type(provenance['calls_attempted']) is int and provenance['calls_attempted'] == len(rows))
        r.require(type(issues) is list and len(issues) <= 16)
        selected_issues = []
        for issue in issues:
            r.require(type(issue) is dict and type(issue['kind']) is str and
                      issue['kind'] in ('INCOMPLETE', 'INCONSISTENT') and type(issue['code']) is str)
            selected_issues.append({'kind': issue['kind'],
                                    'code': issue['code'] if issue['code'] in ISSUE_CODES else 'UNRECOGNIZED_ISSUE'})
        derived_status = (c.INCONSISTENT if any(v['kind'] == 'INCONSISTENT' for v in selected_issues)
                          else c.INCOMPLETE if selected_issues else c.COMPLETE)
        r.require(status == derived_status)
        selected = []
        for ordinal, row in enumerate(rows, 1):
            r.require(type(row) is dict and type(row['ordinal']) is int and row['ordinal'] == ordinal)
            r.require(row['origin'] == origin)
            http = row['status']
            r.require(http is None or type(http) is int and 100 <= http <= 599)
            headers, evidence = {}, 'NOT_APPLICABLE'
            if http is not None and http != 200:
                evidence = 'NOT_RECORDED'
                if 'diagnostic_headers' in row:
                    headers = c.safe_error_headers(row['diagnostic_headers'])
                    evidence = 'SAFE_FIELDS_RECORDED' if headers else 'EMPTY_OR_FILTERED'
            selected.append({'ordinal': ordinal, 'status': http,
                             'header_evidence': evidence, 'diagnostic_headers': headers})
        if status == c.COMPLETE:
            r.require(len(selected) >= 4 and all(row['status'] == 200 for row in selected))
        return {'schema': SCHEMA, 'status': 'DIAGNOSTICS_PROJECTED',
                'recorded_collection_status': status, 'recorded_origin': origin,
                'input_sha256': r.sha(data), 'responses': selected, 'issues': selected_issues,
                'diagnostics_only': True, 'origin_authenticated': False,
                'http_error_cause': 'NOT_ESTABLISHED', 'non_effects': dict(r.NON_EFFECTS)}
    except (ValueError, TypeError, KeyError, AttributeError, RecursionError, UnicodeError):
        return refused()


def render_html(report: dict) -> str:
    esc = lambda value: html.escape(str(value), quote=True)
    labels = {'NOT_APPLICABLE': 'Не применимо: нет сохранённого отказа HTTP.',
              'NOT_RECORDED': 'Диагностические заголовки не сохранены.',
              'EMPTY_OR_FILTERED': 'Безопасных полей нет; значения могли быть отфильтрованы.',
              'SAFE_FIELDS_RECORDED': 'Сохранены разрешённые диагностические поля.'}
    if report['status'] == 'DIAGNOSTICS_REFUSED':
        content = '<section>Индекс отклонён. Код: <code>' + esc(report['code']) + '</code></section>'
    else:
        content = ('<section>Записанный результат: <code>' + esc(report['recorded_collection_status']) +
                   '</code><br>Записанная метка источника: <code>' + esc(report['recorded_origin']) +
                   '</code><br>SHA-256 выбранного индекса: <code>' + esc(report['input_sha256']) + '</code></section>')
        for row in report['responses']:
            headers = c.safe_error_headers(row['diagnostic_headers'])
            fields = ''.join('<tr><td><code>' + esc(name) + '</code></td><td><code>' + esc(value) +
                             '</code></td></tr>' for name, value in headers.items())
            content += ('<section><h2>Запрос ' + esc(row['ordinal']) + '</h2><p>Сохранённый HTTP status: <code>' +
                        esc(row['status'] if row['status'] is not None else 'НЕ ПОЛУЧЕН') + '</code></p><p>' +
                        esc(labels.get(row['header_evidence'], 'Безопасных полей нет.')) + '</p>' +
                        ('<table><tr><th>Поле</th><th>Значение</th></tr>' + fields + '</table>' if fields else '') + '</section>')
        content += '<h2>Записанные причины неполноты</h2><ul>' + ''.join(
            '<li><code>' + esc(v['kind']) + ' / ' + esc(v['code']) + '</code></li>' for v in report['issues']) + '</ul>'
    return ('''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Matawaka · Диагностика коллекции</title><style>body{font:17px/1.6 system-ui;max-width:900px;margin:2rem auto;padding:0 24px}h1{line-height:1.2}section{padding:16px;border:1px solid;border-radius:8px;margin:16px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid}code,td{overflow-wrap:anywhere}</style></head><body><h1>Диагностика сохранённой коллекции</h1><p>Этот просмотр не устанавливает причину HTTP-ошибки: <code>NOT_ESTABLISHED</code>. Этот просмотр показывает только выбранный индекс; метки источника и результата не аутентифицированы. Хеш связывает выбранные байты, но не подтверждает их происхождение.</p>''' +
            content + '<footer>Тела ответов, пути и соседние файлы не читаются. Запросы не повторяются. Это диагностический просмотр, не оценка CI, приёмка или разрешение на действие.</footer></body></html>')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('collection')
    parser.add_argument('--format', choices=('json', 'html'), default='json')
    args = parser.parse_args()
    try:
        report = view(c.read_explicit(args.collection))
    except (OSError, ValueError, TypeError):
        report = refused('collection_unreadable')
    print(render_html(report) if args.format == 'html' else json.dumps(report, ensure_ascii=True, indent=2))
    return 0 if report.get('recorded_collection_status') == c.COMPLETE and report['status'] == 'DIAGNOSTICS_PROJECTED' else 2


if __name__ == '__main__':
    raise SystemExit(main())
