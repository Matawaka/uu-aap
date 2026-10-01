# SPDX-License-Identifier: Apache-2.0
"""Bounded GET-only metadata capture; artifact bytes remain separate inputs."""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

_spec = importlib.util.spec_from_file_location('capture_reader', Path(__file__).with_name('reader.py'))
r = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(r)
METHOD = 'BOUNDED_GITHUB_GET_PROJECTION_V1'
ORIGINS = {'HTTP_RESPONSE_BODY', 'CONNECTOR_SELECTED_JSON_REPLAY', 'SYNTHETIC_REPLAY'}
COMPLETE, INCOMPLETE, INCONSISTENT = 'METADATA_CAPTURED', 'COLLECTION_INCOMPLETE', 'COLLECTION_INCONSISTENT'


@dataclass(frozen=True)
class Limits:
    max_calls: int = 12
    max_pages: int = 4
    per_page: int = 100
    max_body: int = 2_000_000
    max_total: int = 8_000_000
    max_seconds: int = 30

    def validate(self):
        for v in (self.max_calls, self.max_pages, self.per_page, self.max_body, self.max_total, self.max_seconds):
            r.require(type(v) is int and v > 0, 'invalid_budget')
        r.require(self.max_calls <= 12 and self.max_pages <= 4 and self.per_page <= 100
                  and self.max_body <= 2_000_000 and self.max_total <= 8_000_000
                  and self.max_seconds <= 30, 'budget_above_profile')


@dataclass(frozen=True)
class Response:
    status: int
    body: bytes
    diagnostic_headers: dict[str, str] | None = None


ERROR_HEADER_PATTERNS = {
    'x-ratelimit-limit': r'[0-9]{1,10}',
    'x-ratelimit-remaining': r'[0-9]{1,10}',
    'x-ratelimit-reset': r'[0-9]{1,12}',
    'x-ratelimit-used': r'[0-9]{1,10}',
    'x-ratelimit-resource': r'[a-z_]{1,40}',
    'retry-after': r'[0-9]{1,10}',
}


def safe_error_headers(headers):
    """Bounded selected fields, not raw headers or an inferred error cause."""
    result = {}
    if headers is None:
        return result
    try:
        for name, pattern in ERROR_HEADER_PATTERNS.items():
            values = headers.get_all(name, []) if hasattr(headers, 'get_all') else [headers.get(name)]
            if len(values) != 1:
                continue  # Ambiguous duplicate headers are not diagnostic evidence.
            value = values[0]
            if type(value) is str and len(value) <= 64:
                value = value.strip(' \t')
                if re.fullmatch(pattern, value):
                    result[name] = value
    except (AttributeError, TypeError, ValueError):
        return {}  # Missing diagnostics must not replace the observed HTTP status.
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class PublicGitHub:
    """Anonymous HTTPS only; no env proxy, token discovery, retries or redirects."""
    origin = 'HTTP_RESPONSE_BODY'

    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def __call__(self, path: str, timeout: float, max_bytes: int) -> Response:
        # Fail closed even when this transport is invoked outside collect().
        r.require(re.fullmatch(r'/repos/[A-Za-z0-9_-][A-Za-z0-9_.-]*/[A-Za-z0-9_-][A-Za-z0-9_.-]*/actions/runs/[1-9][0-9]*(?:/attempts/[1-9][0-9]*)?(?:/jobs|/artifacts)?(?:\?per_page=[1-9][0-9]*&page=[1-9][0-9]*)?', path), 'path_refused')
        req = urllib.request.Request('https://api.github.com' + path, method='GET', headers={
            'Accept': 'application/vnd.github+json', 'User-Agent': 'Matawaka-CI-Capture/0.1'})
        try:
            with self.opener.open(req, timeout=min(timeout, 10)) as response:
                return Response(response.status, response.read(max_bytes + 1))
        except urllib.error.HTTPError as error:
            # Error prose, signed URLs and credentials remain unretained.
            try:
                diagnostics = safe_error_headers(error.headers)
            finally:
                error.close()
            return Response(error.code, b'', diagnostics)


class Replay:
    """Explicit ordered replay. Paths must match; never follows a body URL."""
    def __init__(self, rows: list, origin='SYNTHETIC_REPLAY'):
        r.require(origin in ORIGINS - {'HTTP_RESPONSE_BODY'}, 'replay_origin_invalid')
        self.rows, self.index, self.origin = rows, 0, origin

    def __call__(self, path, timeout, max_bytes):
        r.require(self.index < len(self.rows), 'replay_exhausted')
        row = self.rows[self.index]
        self.index += 1
        r.require(row['path'] == path, 'replay_path_mismatch')
        return Response(row['status'], row['body_utf8'].encode('utf-8'))


def collect(expected: bytes, get, *, limits=Limits(), clock=time.monotonic) -> tuple[dict, list[dict]]:
    """Finite collection on an injected GET transport; returns capture + source bodies.

    No artifact download, expectation generation, tests, stage receipts or permits.
    Partial observations survive a refused/incomplete collection.
    """
    captures, problems, used_bytes = [], [], 0
    origin = getattr(get, 'origin', None)
    capture = {'schema': 'matawaka.ci-reader.capture/v0.1', 'provenance': {
        'method': METHOD, 'transport_origin': origin, 'raw_http_bytes_retained': origin == 'HTTP_RESPONSE_BODY',
        'collection_status': INCOMPLETE, 'issues': problems, 'response_hashes': [],
        'atomic_snapshot': False, 'archives_downloaded': False},
        'run': {}, 'jobs': {'total_count': 0, 'rows': []}, 'artifacts': {'total_count': 0, 'rows': []}}
    start = clock()
    def issue(code, conflict=False):
        problems.append({'code': code, 'kind': 'INCONSISTENT' if conflict else 'INCOMPLETE'})
    def fetch(path):
        nonlocal used_bytes
        remaining = limits.max_seconds - (clock() - start)
        r.require(remaining > 0, 'time_budget')
        r.require(len(captures) < limits.max_calls, 'call_budget')
        row = {'ordinal': len(captures) + 1, 'path': path, 'origin': origin, 'status': None,
               'body_sha256': None, 'body_utf8': None}
        captures.append(row)  # failed calls consume budget too
        response = get(path, min(10, remaining), min(limits.max_body, limits.max_total - used_bytes))
        r.require(type(response) is Response and type(response.status) is int, 'transport_shape')
        row['status'] = response.status
        if response.status != 200:
            row['diagnostic_headers'] = safe_error_headers(response.diagnostic_headers)
        r.require(type(response.body) is bytes, 'transport_body')
        r.require(len(response.body) <= limits.max_body, 'body_limit')
        used_bytes += len(response.body)
        r.require(used_bytes <= limits.max_total, 'total_byte_budget')
        # Successful bodies retained as exact bytes delivered by this transport.
        if response.status == 200:
            row['body_sha256'] = r.sha(response.body)
            row['body_utf8'] = response.body.decode('utf-8')
        r.require(clock() - start <= limits.max_seconds, 'time_budget')
        r.require(response.status == 200, 'http_' + str(response.status) if response.status in
                  (301, 302, 307, 308, 401, 403, 404, 410, 429, 500, 502, 503) else 'http_non_success')
        return r.parse(response.body)
    def run_projection(obj):
        repo = obj.get('repository')
        r.require(type(repo) is dict, 'run_repository_missing')
        return {'id': obj.get('id'), 'attempt': obj.get('run_attempt'),
                'source_sha': obj.get('head_sha'), 'repository_id': repo.get('id'),
                'workflow_path': obj.get('path'), 'event': obj.get('event'),
                'status': obj.get('status'), 'conclusion': obj.get('conclusion')}
    def pages(path, kind):
        rows, ids, total = [], set(), None
        for page in range(1, limits.max_pages + 1):
            obj = fetch(path + f'?per_page={limits.per_page}&page={page}')
            count, batch = obj.get('total_count'), obj.get(kind)
            r.require(type(count) is int and 0 <= count <= 10_000 and type(batch) is list, 'page_shape')
            if total is None:
                total = count
                capture[kind]['total_count'] = total
            r.require(count == total, 'pagination_total_changed')
            r.require(len(batch) <= limits.per_page, 'page_overfull')
            for item in batch:
                r.require(type(item) is dict and type(item.get('id')) is int and item['id'] > 0, 'row_identity_invalid')
                r.require(item['id'] not in ids, 'duplicate_page_identity')
                ids.add(item['id']); rows.append(item)
                # Normalize as each admitted row arrives so later gaps don't erase failures.
                capture[kind]['rows'].append(normalize(item, kind))
            r.require(len(rows) <= total, 'pagination_count_overflow')
            if len(rows) == total:
                return rows
            r.require(len(batch) == limits.per_page, 'pagination_short_page')
        raise r.Invalid('page_budget')
    def normalize(item, kind):
        if kind == 'jobs':
            steps = item.get('steps')
            r.require(type(steps) is list and all(type(s) is dict for s in steps), 'job_steps_missing')
            # Endpoint implies requested attempt; record whether field was observed or scoped.
            attempt = item.get('run_attempt', e['attempt'])
            return {'id': item['id'], 'name': item.get('name'), 'run_id': item.get('run_id'),
                    'attempt': attempt, 'attempt_basis': 'ROW' if 'run_attempt' in item else 'ATTEMPT_ENDPOINT',
                    'source_sha': item.get('head_sha'), 'status': item.get('status'),
                    'conclusion': item.get('conclusion'), 'steps': [
                        {k: s.get(k) for k in ('name', 'status', 'conclusion')} for s in steps]}
        owner = item.get('workflow_run')
        r.require(type(owner) is dict, 'artifact_owner_missing')
        digest = item.get('digest')
        r.require(type(digest) is str and re.fullmatch('sha256:[0-9a-f]{64}', digest), 'artifact_digest_missing')
        return {'id': item['id'], 'name': item.get('name'), 'run_id': owner.get('id'),
                'source_sha': owner.get('head_sha'), 'repository_id': owner.get('repository_id'),
                'archive_sha256': digest[7:], 'expired': item.get('expired'),
                'expires_at': item.get('expires_at')}
    try:
        limits.validate()
        r.require(origin in ORIGINS, 'transport_origin_invalid')
        e = r.parse(expected); r.valid_expectation(e)
        r.require(all(re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9_.-]*', s) and s not in ('.', '..')
                      for s in e['repository'].split('/')), 'repository_refused')
        base = f"/repos/{e['repository']}/actions/runs/{e['run_id']}"
        path = base + f"/attempts/{e['attempt']}"
        before = fetch(path)
        capture['run'] = run_projection(before)
        desired = {k: e[v] for k, v in [('id','run_id'),('attempt','attempt'),('source_sha','source_sha'),
                   ('repository_id','repository_id'),('workflow_path','workflow_path'),('event','event')]}
        r.require(r.typed_equal({k:capture['run'][k] for k in desired}, desired), 'run_binding_mismatch')
        r.require(before['repository'].get('full_name') == e['repository'], 'repository_binding_mismatch')
        r.require((before.get('head_commit') or {}).get('tree_id') == e['source_tree'], 'source_tree_mismatch')
        pages(path + '/jobs', 'jobs')
        pages(base + '/artifacts', 'artifacts')
        after = fetch(path)
        def fence(obj):
            return {'run': run_projection(obj), 'updated_at': obj.get('updated_at'),
                    'tree': (obj.get('head_commit') or {}).get('tree_id')}
        r.require(type(before.get('updated_at')) is str and before['updated_at'], 'fence_missing')
        r.require(r.typed_equal(fence(before), fence(after)), 'run_changed_during_collection')
        capture['provenance']['fence'] = {'before': captures[0]['body_sha256'], 'after': captures[-1]['body_sha256'],
                                         'matched_selected_fields': True}
        # Check exact expected identity sets; artifacts are a run-wide list, not an attempt list.
        for kind, key in [('jobs','job_id'),('artifacts','artifact_id')]:
            actual, wanted = {row['id'] for row in capture[kind]['rows']}, {j[key] for j in e['jobs']}
            if wanted - actual: issue('expected_' + kind + '_missing')
            if actual - wanted: issue('unexpected_' + kind, True)
        for j in capture['jobs']['rows']:
            r.require(r.typed_equal([j['run_id'],j['attempt'],j['source_sha']], [e['run_id'],e['attempt'],e['source_sha']]), 'foreign_job')
        for a in capture['artifacts']['rows']:
            r.require(r.typed_equal([a['run_id'],a['source_sha'],a['repository_id']], [e['run_id'],e['source_sha'],e['repository_id']]), 'foreign_artifact')
    except r.Invalid as error:
        code = str(error)
        issue(code, code in {'run_binding_mismatch','repository_binding_mismatch','foreign_job','foreign_artifact',
                             'source_tree_mismatch','duplicate_page_identity','pagination_total_changed','pagination_count_overflow','run_changed_during_collection'})
    except (OSError, TimeoutError, urllib.error.URLError):
        issue('transport_unavailable')
    except (ValueError, TypeError, KeyError, AttributeError, RecursionError, UnicodeError):
        issue('response_uninterpretable')
    status = INCONSISTENT if any(p['kind'] == 'INCONSISTENT' for p in problems) else INCOMPLETE if problems else COMPLETE
    capture['provenance'].update(collection_status=status, calls_attempted=len(captures), bytes_received=used_bytes,
        response_hashes=[c['body_sha256'] for c in captures if c['body_sha256']],
        limits={k:getattr(limits,k) for k in limits.__dataclass_fields__})
    return capture, captures


def read_explicit(path):
    with Path(path).open('rb') as stream:
        data = stream.read(r.MAX_BYTES + 1)
    r.require(len(data) <= r.MAX_BYTES, 'input_limit')
    return data


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--expectation', required=True); p.add_argument('--output', required=True)
    p.add_argument('--replay'); p.add_argument('--per-page', type=int, default=100)
    args = p.parse_args()
    output = Path(args.output)
    try:
        expected = read_explicit(args.expectation)
        if args.replay:
            data = r.parse(read_explicit(args.replay))
            get = Replay(data['responses'], data['origin'])
        else:
            get = PublicGitHub()
        started_at = datetime.now(timezone.utc).isoformat()
        capture, responses = collect(expected, get, limits=Limits(per_page=args.per_page))
        capture['provenance']['collection_window'] = {'started_at': started_at,
            'ended_at': datetime.now(timezone.utc).isoformat(), 'trusted_clock': False,
            'meaning': 'LOCAL_ORCHESTRATOR_WINDOW_NOT_UPSTREAM_EVENT_TIME'}
        output.mkdir(parents=True, exist_ok=False)
        (output/'expectation.json').write_bytes(expected)
        (output/'capture.json').write_text(json.dumps(capture,ensure_ascii=True,indent=2)+'\n',encoding='utf-8')
        (output/'responses').mkdir()
        index=[]
        for row in responses:
            row=dict(row); body=row.pop('body_utf8')
            if body is not None:
                name=f"response-{row['ordinal']:02}.json"
                (output/'responses'/name).write_bytes(body.encode('utf-8')); row['file']=name
            index.append(row)
        (output/'collection.json').write_text(json.dumps({'origin':get.origin,'responses':index,'provenance':capture['provenance']},indent=2)+'\n')
        print(capture['provenance']['collection_status'])
        return 0 if capture['provenance']['collection_status']==COMPLETE else 2
    except (OSError, r.Invalid, ValueError, KeyError, TypeError):
        print('COLLECTION_NOT_WRITTEN'); return 2


if __name__ == '__main__':
    raise SystemExit(main())
