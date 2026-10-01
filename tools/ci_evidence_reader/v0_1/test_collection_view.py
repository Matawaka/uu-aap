# SPDX-License-Identifier: Apache-2.0
"""Finite offline diagnostic-view cases; every input here is synthetic."""
from __future__ import annotations

import copy
from contextlib import ExitStack, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
import urllib.request
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


v = load('bounded_collection_view_test', HERE / 'collection_view.py')
c = load('bounded_collection_view_collector_test', HERE / 'collector.py')
PRIVATE = 'PRIVATE_COLLECTION_VIEW_SENTINEL'


def dump(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode('utf-8')


def index(status=c.COMPLETE, http_status=200, origin='HTTP_RESPONSE_BODY'):
    count = 4 if status == c.COMPLETE else 1
    return {
        'origin': origin,
        'responses': [
            {'ordinal': number, 'origin': origin, 'status': http_status,
             'path': '/repos/a/b/actions/runs/1/attempts/1',
             'body_sha256': 'a' * 64 if http_status == 200 else None,
             **({'file': f'response-{number:02}.json'} if http_status == 200 else {})}
            for number in range(1, count + 1)
        ],
        'provenance': {
            'method': c.METHOD, 'transport_origin': origin,
            'calls_attempted': count, 'collection_status': status,
            'issues': [] if status == c.COMPLETE else [
                {'code': 'run_binding_mismatch' if status == c.INCONSISTENT else 'http_403',
                 'kind': 'INCONSISTENT' if status == c.INCONSISTENT else 'INCOMPLETE'}],
        },
    }


class CollectionViewTests(unittest.TestCase):
    def assert_projection(self, report, recorded_status):
        self.assertEqual(report['status'], 'DIAGNOSTICS_PROJECTED')
        self.assertEqual(report['recorded_collection_status'], recorded_status)
        self.assertEqual(report['http_error_cause'], 'NOT_ESTABLISHED')
        self.assertIs(report['origin_authenticated'], False)
        self.assertIs(report['diagnostics_only'], True)
        self.assertEqual(report['non_effects'], c.r.NON_EFFECTS)

    def assert_refused(self, data):
        report = v.view(data)
        self.assertEqual(report['status'], 'DIAGNOSTICS_REFUSED')
        self.assertEqual(report['code'], 'collection_index_invalid')
        self.assertIsNone(report.get('recorded_collection_status'))
        self.assertNotIn(PRIVATE, dump(report).decode())
        self.assertNotIn(PRIVATE, v.render_html(report))
        return report

    def cli(self, path, output_format='json'):
        output = io.StringIO()
        with patch.object(sys, 'argv', ['collection_view.py', str(path),
                                       '--format', output_format]), redirect_stdout(output):
            code = v.main()
        return code, output.getvalue()

    def test_historical_403_missing_headers_stays_unexplained(self):
        report = v.view(dump(index(c.INCOMPLETE, 403)))
        self.assert_projection(report, c.INCOMPLETE)
        self.assertEqual(report['responses'][0], {
            'ordinal': 1, 'status': 403, 'header_evidence': 'NOT_RECORDED',
            'diagnostic_headers': {}})
        self.assertIn('NOT_ESTABLISHED', v.render_html(report))

    def test_exact_six_fields_without_private_raw_material(self):
        source = index(c.INCOMPLETE, 403)
        safe = {'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': '1790850000', 'x-ratelimit-used': '60',
                'x-ratelimit-resource': 'core', 'retry-after': '60'}
        source['responses'][0].update(
            path='https://example.invalid/?token=' + PRIVATE,
            file='../../' + PRIVATE, body_utf8=PRIVATE, body_sha256=PRIVATE,
            diagnostic_headers={**safe, 'set-cookie': PRIVATE,
                                'authorization': PRIVATE, 'location': PRIVATE})
        source['provenance']['private_reason'] = PRIVATE
        source['private_extra'] = PRIVATE
        report = v.view(dump(source))
        self.assert_projection(report, c.INCOMPLETE)
        self.assertEqual(report['responses'][0]['diagnostic_headers'], safe)
        self.assertEqual(report['responses'][0]['header_evidence'], 'SAFE_FIELDS_RECORDED')
        for output in (dump(report).decode(), v.render_html(report)):
            self.assertNotIn(PRIVATE, output)
            self.assertNotIn('example.invalid', output)
            self.assertNotIn('body_utf8', output)
            self.assertNotIn('authorization', output)

    def test_invalid_header_values_are_filtered_again(self):
        cases = [('retry-after', True), ('retry-after', ['60']),
                 ('retry-after', {'secret': PRIVATE}), ('retry-after', '\u0660'),
                 ('retry-after', '0\r\nSet-Cookie: ' + PRIVATE),
                 ('retry-after', 'Wed, 01 Oct 2026 00:00:00 GMT'),
                 ('x-ratelimit-limit', '6' * 65),
                 ('x-ratelimit-resource', '<script>' + PRIVATE),
                 ('x-ratelimit-resource', 'https://example.invalid/' + PRIVATE)]
        for name, value in cases:
            with self.subTest(name=name, value=value):
                source = index(c.INCOMPLETE, 403)
                source['responses'][0]['diagnostic_headers'] = {name: value}
                report = v.view(dump(source))
                self.assert_projection(report, c.INCOMPLETE)
                self.assertEqual(report['responses'][0]['diagnostic_headers'], {})
                self.assertEqual(report['responses'][0]['header_evidence'], 'EMPTY_OR_FILTERED')
                self.assertNotIn(PRIVATE, dump(report).decode())
                self.assertNotIn(PRIVATE, v.render_html(report))

    def test_200_and_null_never_expose_injected_headers(self):
        for http_status in (200, None):
            with self.subTest(http_status=http_status):
                source = index(c.INCOMPLETE, http_status)
                source['responses'][0]['diagnostic_headers'] = {
                    'x-ratelimit-remaining': '0', 'set-cookie': PRIVATE}
                report = v.view(dump(source))
                self.assert_projection(report, c.INCOMPLETE)
                self.assertEqual(report['responses'][0]['diagnostic_headers'], {})
                self.assertEqual(report['responses'][0]['header_evidence'], 'NOT_APPLICABLE')

    def test_empty_header_projection_does_not_invent_evidence(self):
        source = index(c.INCOMPLETE, 403)
        source['responses'][0]['diagnostic_headers'] = {}
        report = v.view(dump(source))
        self.assert_projection(report, c.INCOMPLETE)
        self.assertEqual(report['responses'][0]['header_evidence'], 'EMPTY_OR_FILTERED')
        self.assertEqual(report['responses'][0]['diagnostic_headers'], {})

    def test_root_provenance_shape_and_origins_are_bound(self):
        mutations = [
            lambda d: d.update(origin=PRIVATE),
            lambda d: d.update(responses={}),
            lambda d: d.update(provenance=[]),
            lambda d: d['provenance'].update(method=PRIVATE),
            lambda d: d['provenance'].update(transport_origin='SYNTHETIC_REPLAY'),
            lambda d: d['provenance'].update(collection_status=PRIVATE),
            lambda d: d['provenance'].update(calls_attempted=True),
            lambda d: d['provenance'].update(calls_attempted=3),
            lambda d: d['responses'][0].update(origin='SYNTHETIC_REPLAY'),
            lambda d: d['provenance'].update(issues={}),
            lambda d: d['provenance'].update(issues=[{'code': 'http_403', 'kind': PRIVATE}]),
        ]
        for number, mutate in enumerate(mutations):
            with self.subTest(case=number):
                source = index()
                mutate(source)
                self.assert_refused(dump(source))

    def test_ordinals_http_status_and_row_limit_are_strict(self):
        mutations = [
            lambda d: d['responses'][0].update(ordinal=True),
            lambda d: d['responses'][0].update(ordinal=2),
            lambda d: d['responses'][1].update(ordinal=1),
            lambda d: d['responses'].reverse(),
            lambda d: d['responses'][0].update(status=True),
            lambda d: d['responses'][0].update(status='403'),
            lambda d: d['responses'][0].update(status=99),
            lambda d: d['responses'][0].update(status=600),
            lambda d: d['responses'].__setitem__(0, PRIVATE),
        ]
        for number, mutate in enumerate(mutations):
            with self.subTest(case=number):
                source = index()
                mutate(source)
                self.assert_refused(dump(source))
        source = index()
        source['responses'] = [{**source['responses'][0], 'ordinal': i} for i in range(1, 14)]
        source['provenance']['calls_attempted'] = 13
        self.assert_refused(dump(source))

    def test_json_limits_and_duplicates_refuse_without_reflection(self):
        inputs = [b'{', b'\xff', b'[]', b'{"origin":1,"origin":2}',
                  b'{"number":NaN}', b'{"number":0.5}',
                  b'{"x":' + b'[' * 34 + b'0' + b']' * 34 + b'}',
                  b'{"secret":"' + PRIVATE.encode() + b'"}' + b' ' * c.r.MAX_BYTES]
        for number, data in enumerate(inputs):
            with self.subTest(case=number):
                self.assert_refused(data)

    def test_replay_labels_never_become_authenticated_http(self):
        for origin in sorted(c.ORIGINS):
            with self.subTest(origin=origin):
                report = v.view(dump(index(origin=origin)))
                self.assert_projection(report, c.COMPLETE)
                self.assertEqual(report['recorded_origin'], origin)

    def test_complete_cannot_hide_error_missing_status_or_issues(self):
        for http_status in (403, None):
            with self.subTest(http_status=http_status):
                self.assert_refused(dump(index(http_status=http_status)))
        source = index()
        source['responses'] = source['responses'][:3]
        source['provenance']['calls_attempted'] = 3
        self.assert_refused(dump(source))
        source = index()
        source['provenance']['issues'] = [{'code': 'http_403', 'kind': 'INCOMPLETE'}]
        self.assert_refused(dump(source))

    def test_incomplete_and_inconsistent_are_not_promoted(self):
        for status in (c.INCOMPLETE, c.INCONSISTENT):
            for http_status in (200, None):
                with self.subTest(status=status, http_status=http_status):
                    report = v.view(dump(index(status, http_status)))
                    self.assert_projection(report, status)
        source = index(c.INCOMPLETE)
        source['responses'] = []
        source['provenance']['calls_attempted'] = 0
        report = v.view(dump(source))
        self.assert_projection(report, c.INCOMPLETE)
        self.assertEqual(report['responses'], [])

    def test_issue_codes_are_allowlisted_and_bounded(self):
        source = index(c.INCOMPLETE, 403)
        source['provenance']['issues'].append({'code': PRIVATE, 'kind': 'INCOMPLETE'})
        report = v.view(dump(source))
        self.assert_projection(report, c.INCOMPLETE)
        for output in (dump(report).decode(), v.render_html(report)):
            self.assertIn('http_403', output)
            self.assertIn('UNRECOGNIZED_ISSUE', output)
            self.assertNotIn(PRIVATE, output)
        source['provenance']['issues'] = [{'code': 'http_403', 'kind': 'INCOMPLETE'}] * 17
        self.assert_refused(dump(source))

    def test_view_and_html_are_offline_deterministic_and_immutable(self):
        source = index(c.INCOMPLETE, 403)
        source['responses'][0].update(
            path='https://example.invalid/' + PRIVATE, file='../../' + PRIVATE,
            body_utf8='<script>' + PRIVATE,
            diagnostic_headers={'retry-after': '60', 'location': PRIVATE})
        before = copy.deepcopy(source)
        data = dump(source)
        with ExitStack() as stack:
            for target, name in ((urllib.request, 'urlopen'), (urllib.request, 'build_opener'),
                                 (socket, 'socket'), (subprocess, 'Popen'),
                                 (Path, 'open'), (Path, 'read_bytes'), (Path, 'read_text')):
                stack.enter_context(patch.object(target, name, side_effect=AssertionError('unexpected I/O')))
            report = v.view(data)
            report_before = copy.deepcopy(report)
            document = v.render_html(report)
            self.assertEqual(v.view(data), report)
            self.assertEqual(v.render_html(report), document)
            self.assertEqual(report, report_before)
        self.assertEqual(source, before)
        self.assert_projection(report, c.INCOMPLETE)
        self.assertNotIn(PRIVATE, document)
        for fragment in ('<script', 'href=', 'src=', '<form'):
            self.assertNotIn(fragment, document.lower())
        self.assertIn('content-security-policy', document.lower())

    def test_cli_exit_codes_json_html_and_sanitized_refusal(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / 'collection.json'
            for status in (c.COMPLETE, c.INCOMPLETE, c.INCONSISTENT):
                with self.subTest(status=status):
                    path.write_bytes(dump(index(status, 200 if status == c.COMPLETE else 403)))
                    code, output = self.cli(path)
                    self.assertEqual(code, 0 if status == c.COMPLETE else 2)
                    self.assert_projection(json.loads(output), status)
            code, document = self.cli(path, 'html')
            self.assertEqual(code, 2)
            self.assertIn('<html', document.lower())
            self.assertIn('COLLECTION_INCONSISTENT', document)
            path.write_bytes(b'{"private":"' + PRIVATE.encode() + b'"}')
            code, output = self.cli(path)
            self.assertEqual(code, 2)
            self.assertEqual(json.loads(output)['status'], 'DIAGNOSTICS_REFUSED')
            self.assertEqual(json.loads(output)['code'], 'collection_index_invalid')
            self.assertNotIn(PRIVATE, output)
            code, output = self.cli(root / PRIVATE)
            self.assertEqual(code, 2)
            self.assertEqual(json.loads(output)['code'], 'collection_unreadable')
            self.assertNotIn(PRIVATE, output)
            code, output = self.cli(str(root / PRIVATE) + '\x00')
            self.assertEqual(code, 2)
            self.assertEqual(json.loads(output)['code'], 'collection_unreadable')
            self.assertNotIn(PRIVATE, output)


if __name__ == '__main__':
    raise SystemExit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
