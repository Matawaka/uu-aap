# SPDX-License-Identifier: Apache-2.0
"""Authored finite transport/comparison cases, not independent qualification."""
import copy
import importlib.util
import io
import json
from email.message import Message
import stat
from pathlib import Path
import sys
import tempfile
import unittest
import warnings
import zipfile
from unittest.mock import patch

HERE=Path(__file__).resolve().parent

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);obj=importlib.util.module_from_spec(spec)
    sys.modules[name]=obj;spec.loader.exec_module(obj);return obj

c=load('bounded_collector_test',HERE/'collector.py')
x=load('bounded_comparison_test',HERE/'compare.py')
f=load('bounded_fixture_test',HERE/'test_reader.py')
b=load('bounded_bundle_test',HERE/'bundle.py')

def dump(obj):return (json.dumps(obj,sort_keys=True)+'\n').encode()

def replay_fixture():
    e,cap,blobs=f.fixture()
    # fixture() returns JSON objects, raw archives separately.
    base=f"/repos/{e['repository']}/actions/runs/{e['run_id']}"
    ap=base+f"/attempts/{e['attempt']}"
    run={'id':e['run_id'],'run_attempt':e['attempt'],'head_sha':e['source_sha'],
         'repository':{'id':e['repository_id'],'full_name':e['repository']},
         'path':e['workflow_path'],'event':e['event'],'status':'completed','conclusion':'success',
         'updated_at':'2026-09-27T00:00:00Z','head_commit':{'tree_id':e['source_tree']}}
    jobs=[{'id':j['id'],'name':j['name'],'run_id':j['run_id'],'run_attempt':j['attempt'],
           'head_sha':j['source_sha'],'status':j['status'],'conclusion':j['conclusion'],'steps':j['steps']}
          for j in cap['jobs']['rows']]
    artifacts=[{'id':a['id'],'name':a['name'],'workflow_run':{'id':a['run_id'],
                'repository_id':a['repository_id'],'head_sha':a['source_sha']},
                'digest':'sha256:'+a['archive_sha256'],'expired':a['expired']}
               for a in cap['artifacts']['rows']]
    def row(path,body):return {'path':path,'status':200,'body_utf8':dump(body).decode()}
    rows=[row(ap,run)]
    rows +=[row(ap+f'/jobs?per_page=1&page={i+1}',{'total_count':2,'jobs':[j]}) for i,j in enumerate(jobs)]
    rows +=[row(base+f'/artifacts?per_page=1&page={i+1}',{'total_count':2,'artifacts':[a]}) for i,a in enumerate(artifacts)]
    rows.append(row(ap,run))
    return e,cap,blobs,rows


class CollectionTests(unittest.TestCase):
    def setUp(self):self.e,self.cap,self.blobs,self.rows=replay_fixture()
    def run_capture(self,rows=None,limits=None):
        return c.collect(dump(self.e),c.Replay(self.rows if rows is None else rows),
                         limits=limits or c.Limits(per_page=1),clock=lambda:0)
    def mutate(self,index,fn):
        obj=json.loads(self.rows[index]['body_utf8']);fn(obj);self.rows[index]['body_utf8']=dump(obj).decode()
    def issue(self,code):
        cap,raw=self.run_capture();self.assertIn(code,[v['code'] for v in cap['provenance']['issues']]);return cap,raw
    def test_multipage_and_reader(self):
        cap,raw=self.run_capture();self.assertEqual(cap['provenance']['collection_status'],c.COMPLETE)
        self.assertEqual(len(raw),6);self.assertEqual(c.r.assess(dump(self.e),dump(cap),self.blobs)['status'],c.r.GOOD)
    def test_retains_exact_transport_bodies(self):
        cap,raw=self.run_capture();self.assertEqual([v['body_utf8'] for v in raw],[v['body_utf8'] for v in self.rows])
    def test_replay_never_http_claim(self):
        cap,_=self.run_capture();self.assertIs(cap['provenance']['raw_http_bytes_retained'],False)
    def test_rate_limit_no_retry(self):
        self.rows[1]['status']=429;_,raw=self.issue('http_429');self.assertEqual(len(raw),2)
    def test_redirect_not_followed(self):
        self.rows[0]['status']=302;_,raw=self.issue('http_302');self.assertEqual(len(raw),1)
    def test_duplicate_id(self):
        one=json.loads(self.rows[1]['body_utf8'])['jobs'][0]
        self.mutate(2,lambda o:o['jobs'].__setitem__(0,one));self.issue('duplicate_page_identity')
    def test_total_drift(self):
        self.mutate(2,lambda o:o.update(total_count=3));self.issue('pagination_total_changed')
    def test_short_page(self):
        self.mutate(2,lambda o:o.update(jobs=[]));self.issue('pagination_short_page')
    def test_missing_tail(self):self.rows=self.rows[:2];self.issue('replay_exhausted')
    def test_wrong_run_before_no_further_calls(self):
        self.mutate(0,lambda o:o.update(id=999));_,raw=self.issue('run_binding_mismatch');self.assertEqual(len(raw),1)
    def test_bool_run_id(self):
        self.mutate(0,lambda o:o.update(id=True));self.issue('run_binding_mismatch')
    def test_foreign_job(self):
        self.mutate(1,lambda o:o['jobs'][0].update(run_id=999));self.issue('foreign_job')
    def test_foreign_artifact(self):
        self.mutate(3,lambda o:o['artifacts'][0]['workflow_run'].update(id=999));self.issue('foreign_artifact')
    def test_attempt_fence_drift(self):
        self.mutate(5,lambda o:o.update(run_attempt=2));self.issue('run_changed_during_collection')
    def test_update_fence_drift(self):
        self.mutate(5,lambda o:o.update(updated_at='later'));self.issue('run_changed_during_collection')
    def test_missing_fence(self):
        self.mutate(0,lambda o:o.pop('updated_at'));self.issue('fence_missing')
    def test_invalid_json(self):self.rows[0]['body_utf8']='{';self.issue('response_uninterpretable')
    def test_duplicate_key(self):self.rows[0]['body_utf8']='{"id":1,"id":2}';self.issue('duplicate_key')
    def test_call_budget(self):
        cap,raw=self.run_capture(limits=c.Limits(per_page=1,max_calls=2))
        self.assertEqual(len(raw),2);self.assertEqual(cap['provenance']['issues'][0]['code'],'call_budget')
    def test_page_budget(self):
        cap,raw=self.run_capture(limits=c.Limits(per_page=1,max_pages=1))
        self.assertEqual(cap['provenance']['issues'][0]['code'],'page_budget')
    def test_body_limit(self):
        cap,raw=self.run_capture(limits=c.Limits(per_page=1,max_body=1))
        self.assertEqual(cap['provenance']['issues'][0]['code'],'body_limit')
    def test_total_limit(self):
        cap,raw=self.run_capture(limits=c.Limits(per_page=1,max_total=1))
        self.assertIn(cap['provenance']['issues'][0]['code'],('total_byte_budget','body_limit'))
    def test_timeout_stops(self):
        ticks=iter([0,31]);cap,_=c.collect(dump(self.e),c.Replay(self.rows),clock=lambda:next(ticks))
        self.assertEqual(cap['provenance']['issues'][0]['code'],'time_budget')
    def test_transport_failure(self):
        class Broken:
            origin='HTTP_RESPONSE_BODY'
            def __call__(self,*args):raise OSError('private reason must not leak')
        cap,raw=c.collect(dump(self.e),Broken());self.assertEqual(cap['provenance']['issues'][0]['code'],'transport_unavailable')
        self.assertNotIn('private reason',dump(cap).decode());self.assertEqual(len(raw),1)
    def test_unknown_origin(self):
        cap,_=c.collect(dump(self.e),lambda *a:None);self.assertEqual(cap['provenance']['issues'][0]['code'],'transport_origin_invalid')
    def test_budget_cannot_grow(self):
        cap,_=self.run_capture(limits=c.Limits(max_calls=13));self.assertEqual(cap['provenance']['issues'][0]['code'],'budget_above_profile')
    def test_bool_budget(self):
        cap,_=self.run_capture(limits=c.Limits(max_calls=True));self.assertEqual(cap['provenance']['issues'][0]['code'],'invalid_budget')
    def test_repo_escape_refused(self):self.e['repository']='../project';self.issue('repository_refused')
    def test_source_tree_binding(self):
        self.mutate(0,lambda o:o['head_commit'].update(tree_id='f'*40));self.issue('source_tree_mismatch')
    def test_missing_artifact_digest(self):
        self.mutate(3,lambda o:o['artifacts'][0].pop('digest'));self.issue('artifact_digest_missing')
    def test_missing_attempt_uses_endpoint_not_observed_claim(self):
        self.mutate(1,lambda o:o['jobs'][0].pop('run_attempt'));cap,_=self.run_capture()
        self.assertEqual(cap['jobs']['rows'][0]['attempt_basis'],'ATTEMPT_ENDPOINT')
    def test_body_urls_never_followed(self):
        self.mutate(0,lambda o:o.update(jobs_url='https://bad.invalid/x'));cap,raw=self.run_capture()
        self.assertEqual(len(raw),6);self.assertEqual(cap['provenance']['collection_status'],c.COMPLETE)
    def test_recorded_failure_survives_collection_gap(self):
        self.mutate(0,lambda o:o.update(conclusion='failure'));self.rows=self.rows[:1]
        cap,_=self.run_capture();rep=c.r.assess(dump(self.e),dump(cap),self.blobs)
        self.assertEqual(rep['status'],c.r.FAIL)
    def test_deterministic_replay(self):self.assertEqual(self.run_capture(),self.run_capture())
    def test_no_source_mutation(self):
        before=copy.deepcopy(self.rows);self.run_capture();self.assertEqual(self.rows,before)
    def test_metadata_does_not_download_archives(self):
        _,raw=self.run_capture();self.assertFalse(any(v['path'].endswith('/zip') for v in raw))
    def test_single_page(self):
        rows=copy.deepcopy(self.rows)
        jobs=[json.loads(rows[i]['body_utf8'])['jobs'][0] for i in (1,2)]
        arts=[json.loads(rows[i]['body_utf8'])['artifacts'][0] for i in (3,4)]
        rows[1]['path']=rows[1]['path'].replace('per_page=1','per_page=100');rows[1]['body_utf8']=dump({'total_count':2,'jobs':jobs}).decode()
        rows[3]['path']=rows[3]['path'].replace('per_page=1','per_page=100');rows[3]['body_utf8']=dump({'total_count':2,'artifacts':arts}).decode()
        cap,raw=self.run_capture([rows[i] for i in (0,1,3,5)],c.Limits());self.assertEqual(len(raw),4);self.assertEqual(cap['provenance']['collection_status'],c.COMPLETE)
    def test_public_transport_refuses_external_path_before_network(self):
        transport=c.PublicGitHub()
        with patch.object(transport.opener,'open',side_effect=AssertionError('network')):
            with self.assertRaises(c.r.Invalid):transport('//other/host',10,100)
    def test_public_transport_bounds_timeout_and_body(self):
        transport=c.PublicGitHub()
        class Raw:
            status=200
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def read(self,n):self.n=n;return b'{}'
        raw=Raw()
        with patch.object(transport.opener,'open',return_value=raw) as mocked:
            result=transport('/repos/a/b/actions/runs/1/attempts/1',99,100)
        self.assertEqual(raw.n,101);self.assertEqual(mocked.call_args.kwargs['timeout'],10)
        self.assertEqual(result.body,b'{}')


class HttpErrorDiagnosticsTests(unittest.TestCase):
    PRIVATE = 'PRIVATE_ERROR_SENTINEL'

    def headers(self):
        headers = Message()
        for name, value in {
            'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': '1790850000', 'X-RateLimit-Used': '60',
            'X-RateLimit-Resource': 'core', 'Retry-After': '60',
            'Set-Cookie': self.PRIVATE, 'Authorization': self.PRIVATE,
            'Location': 'https://example.invalid/?token=' + self.PRIVATE,
            'X-OAuth-Scopes': self.PRIVATE,
        }.items():
            headers[name] = value
        return headers

    def error(self, status, headers):
        body = io.BytesIO(self.PRIVATE.encode())
        error = c.urllib.error.HTTPError('https://api.github.com', status,
                                        self.PRIVATE, headers, body)
        return error, body

    def test_error_headers_allowlisted_body_unread_request_anonymous(self):
        transport = c.PublicGitHub()
        error, body = self.error(403, self.headers())
        with patch.object(transport.opener, 'open', side_effect=error) as opened, \
                patch.object(error, 'read', side_effect=AssertionError('error body read')) as read:
            response = transport('/repos/a/b/actions/runs/1/attempts/1', 10, 100)
        self.assertEqual(response.status, 403)
        self.assertEqual(response.body, b'')
        self.assertEqual(response.diagnostic_headers, {
            'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1790850000', 'x-ratelimit-used': '60',
            'x-ratelimit-resource': 'core', 'retry-after': '60'})
        read.assert_not_called()
        self.assertTrue(body.closed)
        request = opened.call_args.args[0]
        self.assertEqual(request.get_method(), 'GET')
        self.assertEqual(dict(request.header_items()), {
            'Accept': 'application/vnd.github+json',
            'User-agent': 'Matawaka-CI-Capture/0.1'})

    def test_duplicate_unsafe_oversized_and_nonascii_values_omitted(self):
        headers = Message()
        for name, value in (
            ('X-RateLimit-Remaining', '0'), ('X-RateLimit-Remaining', '1'),
            ('X-RateLimit-Limit', '6' * 65), ('X-RateLimit-Used', '\u0660'),
            ('X-RateLimit-Reset', '0\r\nSet-Cookie: ' + self.PRIVATE),
            ('X-RateLimit-Resource', 'https://example.invalid/' + self.PRIVATE),
            ('Retry-After', 'Wed, 01 Oct 2026 00:00:00 GMT')):
            headers[name] = value
        transport = c.PublicGitHub()
        error, body = self.error(403, headers)
        with patch.object(transport.opener, 'open', side_effect=error):
            response = transport('/repos/a/b/actions/runs/1/attempts/1', 10, 100)
        self.assertEqual(response.diagnostic_headers, {})
        self.assertTrue(body.closed)

    def test_missing_or_unreadable_headers_preserve_http_status(self):
        class BrokenHeaders:
            def get(self, name): raise ValueError('private header failure')
        for headers in (None, BrokenHeaders()):
            with self.subTest(headers=type(headers).__name__):
                transport = c.PublicGitHub()
                error, body = self.error(403, headers)
                with patch.object(transport.opener, 'open', side_effect=error):
                    response = transport('/repos/a/b/actions/runs/1/attempts/1', 10, 100)
                self.assertEqual(response.status, 403)
                self.assertEqual(response.diagnostic_headers, {})
                self.assertTrue(body.closed)

    def test_403_429_and_redirect_remain_incomplete_without_retry(self):
        expected, _, _, _ = replay_fixture()
        for status in (403, 429, 302):
            with self.subTest(status=status):
                transport = c.PublicGitHub()
                error, body = self.error(status, self.headers())
                with patch.object(transport.opener, 'open', side_effect=error) as opened:
                    capture, rows = c.collect(dump(expected), transport, clock=lambda: 0)
                self.assertEqual(capture['provenance']['collection_status'], c.INCOMPLETE)
                self.assertEqual(capture['provenance']['issues'],
                                 [{'code': 'http_' + str(status), 'kind': 'INCOMPLETE'}])
                self.assertEqual(capture['provenance']['calls_attempted'], 1)
                self.assertEqual(capture['provenance']['bytes_received'], 0)
                self.assertEqual(capture['provenance']['response_hashes'], [])
                self.assertEqual(rows[0]['diagnostic_headers']['x-ratelimit-remaining'], '0')
                self.assertIsNone(rows[0]['body_utf8'])
                self.assertIsNone(rows[0]['body_sha256'])
                opened.assert_called_once()
                self.assertTrue(body.closed)
                self.assertNotIn(self.PRIVATE, dump([capture, rows]).decode())

    def test_collector_refilters_injected_diagnostics(self):
        class Denied:
            origin = 'SYNTHETIC_REPLAY'
            def __call__(self, *args):
                return c.Response(403, b'', {'x-ratelimit-remaining': '0',
                    'retry-after': True, 'set-cookie': HttpErrorDiagnosticsTests.PRIVATE})
        expected, _, _, _ = replay_fixture()
        capture, rows = c.collect(dump(expected), Denied(), clock=lambda: 0)
        self.assertEqual(capture['provenance']['collection_status'], c.INCOMPLETE)
        self.assertEqual(rows[0]['diagnostic_headers'], {'x-ratelimit-remaining': '0'})
        self.assertNotIn(self.PRIVATE, dump([capture, rows]).decode())

    def test_successful_response_diagnostics_are_not_recorded(self):
        class WithHeaders(c.Replay):
            def __call__(self, *args):
                response = super().__call__(*args)
                return c.Response(response.status, response.body, {'retry-after': '60'})
        expected, _, _, rows = replay_fixture()
        capture, retained = c.collect(dump(expected), WithHeaders(rows),
                                     limits=c.Limits(per_page=1), clock=lambda: 0)
        self.assertEqual(capture['provenance']['collection_status'], c.COMPLETE)
        self.assertTrue(all('diagnostic_headers' not in row for row in retained))
        self.assertEqual([row['body_utf8'] for row in retained],
                         [row['body_utf8'] for row in rows])

    def test_cli_retains_filtered_diagnostics_without_body_or_cause_claim(self):
        expected, _, _, _ = replay_fixture()
        transport = c.PublicGitHub()
        error, body = self.error(403, self.headers())
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            expectation = root / 'expectation.json'
            expectation.write_bytes(dump(expected))
            output = root / 'output'
            with patch.object(c, 'PublicGitHub', return_value=transport), \
                    patch.object(transport.opener, 'open', side_effect=error) as opened, \
                    patch.object(sys, 'argv', ['collector.py', '--expectation', str(expectation),
                                              '--output', str(output)]), patch('builtins.print'):
                self.assertEqual(c.main(), 2)
            collection = json.loads((output / 'collection.json').read_text())
            capture = json.loads((output / 'capture.json').read_text())
            self.assertEqual(collection['responses'][0]['diagnostic_headers']['retry-after'], '60')
            self.assertEqual(capture['provenance']['collection_status'], c.INCOMPLETE)
            self.assertEqual(capture['provenance']['issues'],
                             [{'code': 'http_403', 'kind': 'INCOMPLETE'}])
            self.assertEqual(list((output / 'responses').iterdir()), [])
            self.assertTrue(all(self.PRIVATE not in p.read_text()
                                for p in output.rglob('*') if p.is_file()))
            opened.assert_called_once()
        self.assertTrue(body.closed)


class BundleTests(unittest.TestCase):
    def setUp(self):
        expected, capture, archives = f.fixture()
        self.snapshot = (dump(expected), dump(capture), archives)
        self.data = b.pack(self.snapshot, self.snapshot)

    def members(self, data=None):
        with zipfile.ZipFile(io.BytesIO(self.data if data is None else data)) as archive:
            return {name: archive.read(name) for name in archive.namelist()}

    def rewrite(self, members, *, symlink=None, duplicate=None, compression=zipfile.ZIP_STORED):
        output = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(output, 'w', compression=compression) as archive:
                for name, blob in members.items():
                    if name == symlink:
                        info = zipfile.ZipInfo(name)
                        info.create_system = 3
                        info.external_attr = (stat.S_IFLNK | 0o777) << 16
                        archive.writestr(info, blob)
                    else:
                        archive.writestr(name, blob)
                if duplicate:
                    archive.writestr(duplicate, members[duplicate])
        return output.getvalue()

    def test_exact_roundtrip_and_fresh_assessment(self):
        self.assertEqual(b.read_bundle(self.data), (self.snapshot, self.snapshot))
        report = b.view(self.data)
        self.assertEqual(report['status'], 'NO_OBSERVED_CHANGE')
        self.assertFalse(report['bundle']['origin_authenticated'])
        self.assertFalse(report['bundle']['saved_reports_trusted'])
        self.assertTrue(all(value is False for value in report['non_effects'].values()))

    def test_deterministic_bytes(self):
        self.assertEqual(self.data, b.pack(self.snapshot, self.snapshot))

    def test_external_pin_checked(self):
        self.assertEqual(b.view(self.data, b.r.sha(self.data))['bundle']['integrity'], 'PINNED_HASH_MATCHED')
        for pin in ('0' * 64, 'private invalid pin'):
            with self.subTest(pin=pin), self.assertRaises(b.r.Invalid):
                b.view(self.data, pin)

    def test_coordinated_hash_rewrite_does_not_defeat_external_pin(self):
        members = self.members()
        name = 'after/capture.json'
        members[name] += b'\n'
        manifest = json.loads(members['manifest.json'])
        manifest['files'][name] = {'bytes': len(members[name]), 'sha256': b.r.sha(members[name])}
        members['manifest.json'] = dump(manifest)
        changed = self.rewrite(members)
        self.assertFalse(b.view(changed)['bundle']['origin_authenticated'])
        with self.assertRaisesRegex(b.r.Invalid, 'bundle_pin_mismatch'):
            b.view(changed, b.r.sha(self.data))

    def test_tampered_payload_refused(self):
        members = self.members()
        members['after/capture.json'] += b'\n'
        with self.assertRaises(b.r.Invalid):
            b.view(self.rewrite(members))

    def test_saved_report_is_not_an_admitted_member(self):
        members = self.members()
        members['report.json'] = b'{"status":"CAPTURE_MATCHED"}'
        with self.assertRaises(b.r.Invalid):
            b.view(self.rewrite(members))

    def test_unknown_paths_directories_and_symlinks_refused(self):
        for name in ('../private', '/absolute', 'before/extra.py', 'before/'):
            with self.subTest(name=name):
                members = self.members()
                members[name] = b'private'
                with self.assertRaises(b.r.Invalid):
                    b.view(self.rewrite(members))
        with self.assertRaisesRegex(b.r.Invalid, 'bundle_nonregular'):
            b.view(self.rewrite(self.members(), symlink='before/capture.json'))

    def test_duplicate_member_refused(self):
        with self.assertRaises(b.r.Invalid):
            b.view(self.rewrite(self.members(), duplicate='manifest.json'))

    def test_required_member_missing_refused(self):
        members = self.members()
        del members['before/expectation.json']
        with self.assertRaisesRegex(b.r.Invalid, 'bundle_member_set'):
            b.view(self.rewrite(members))

    def test_manifest_inventory_and_typed_sizes_checked(self):
        for mutation in ('missing', 'extra', 'bool'):
            with self.subTest(mutation=mutation):
                members = self.members()
                manifest = json.loads(members['manifest.json'])
                if mutation == 'missing': del manifest['files']['before/capture.json']
                elif mutation == 'extra': manifest['files']['extra'] = {}
                else: manifest['files']['before/capture.json']['bytes'] = True
                members['manifest.json'] = dump(manifest)
                with self.assertRaises(b.r.Invalid):
                    b.view(self.rewrite(members))

    def test_member_and_manifest_limits_checked_before_read(self):
        for name, size in (('before/capture.json', b.r.MAX_BYTES + 1),
                           ('manifest.json', b.MAX_MANIFEST + 1)):
            with self.subTest(name=name):
                members = self.members()
                members[name] = b'0' * size
                with self.assertRaisesRegex(b.r.Invalid, 'bundle_member_limit'):
                    b.view(self.rewrite(members, compression=zipfile.ZIP_DEFLATED))

    def test_unsupported_compression_refused(self):
        with self.assertRaisesRegex(b.r.Invalid, 'bundle_compression'):
            b.view(self.rewrite(self.members(), compression=zipfile.ZIP_BZIP2))

    def test_missing_archive_stays_evidence_loss(self):
        incomplete = (*self.snapshot[:2], {'py312': self.snapshot[2]['py312']})
        report = b.view(b.pack(self.snapshot, incomplete))
        self.assertEqual(report['status'], 'EVIDENCE_LOSS')
        self.assertNotEqual(report['assessments']['after']['status'], b.r.GOOD)

    def test_corrupt_nested_archive_not_promoted_by_container_hashes(self):
        corrupt = (*self.snapshot[:2], {**self.snapshot[2], 'py312': b'corrupt'})
        report = b.view(b.pack(self.snapshot, corrupt))
        self.assertEqual(report['status'], 'EVIDENCE_LOSS')
        self.assertEqual(report['bundle']['integrity'], 'INTERNAL_HASHES_MATCHED')

    def test_pure_memory_operations_no_io_network_or_mutation(self):
        saved = copy.deepcopy(self.snapshot)
        with patch('builtins.open', side_effect=AssertionError('I/O')), \
                patch('socket.socket', side_effect=AssertionError('network')):
            self.assertEqual(b.view(b.pack(self.snapshot, self.snapshot))['status'], 'NO_OBSERVED_CHANGE')
        self.assertEqual(self.snapshot, saved)

    def test_cli_pack_view_and_overwrite_refusal(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for side in ('before', 'after'):
                folder = root / side
                folder.mkdir()
                for name, data in (('expectation.json', self.snapshot[0]), ('capture.json', self.snapshot[1])):
                    (folder / name).write_bytes(data)
                for slot, data in self.snapshot[2].items(): (folder / (slot + '.zip')).write_bytes(data)
            output = root / 'bundle.zip'
            argv = ['bundle.py', 'pack', '--before', str(root / 'before'), '--after',
                    str(root / 'after'), '--output', str(output)]
            with patch.object(sys, 'argv', argv), patch('builtins.print'):
                self.assertEqual(b.main(), 0)
            original = output.read_bytes()
            with patch.object(sys, 'argv', argv), patch('builtins.print'):
                self.assertEqual(b.main(), 2)
            self.assertEqual(output.read_bytes(), original)
            with patch.object(sys, 'argv', ['bundle.py', 'view', str(output), '--sha256', b.r.sha(original)]), \
                    patch('builtins.print') as printed:
                self.assertEqual(b.main(), 0)
            self.assertEqual(json.loads(printed.call_args.args[0])['status'], 'NO_OBSERVED_CHANGE')

    def test_cli_refusal_has_fixed_diagnostic_without_exception_prose(self):
        with patch.object(sys, 'argv', ['bundle.py', 'view', 'caller-selected.zip']), \
                patch.object(b, 'read_explicit', side_effect=OSError('PRIVATE_SENTINEL')), \
                patch('builtins.print') as printed:
            self.assertEqual(b.main(), 2)
        report = json.loads(printed.call_args.args[0])
        self.assertEqual(report['status'], 'BUNDLE_REFUSED')
        self.assertEqual(report['bundle']['code'], 'bundle_unreadable')
        self.assertNotIn('PRIVATE_SENTINEL', printed.call_args.args[0])
        rendered = b.render_html(report)
        self.assertIn('оценка evidence не выполнена', rendered)
        self.assertNotIn('Результат рассчитан заново', rendered)

    def test_html_escaped_without_active_dependencies(self):
        report = b.view(self.data)
        report['bundle']['sha256'] = '<script>private</script>'
        rendered = b.render_html(report)
        self.assertIn('&lt;script&gt;', rendered)
        for fragment in ('<script', '<iframe', 'src=', 'onclick='):
            self.assertNotIn(fragment, rendered)


class ComparisonTests(unittest.TestCase):
    def setUp(self):self.e,self.cap,self.blobs,_=replay_fixture()
    def package(self):return dump(self.e),dump(self.cap),self.blobs
    def test_identical(self):self.assertEqual(x.compare_packages(self.package(),self.package())['status'],'NO_OBSERVED_CHANGE')
    def test_missing_archive(self):
        before=self.package();after=(*before[:2],{'py312':self.blobs['py312']})
        self.assertEqual(x.compare_packages(before,after)['status'],'EVIDENCE_LOSS')
    def test_tampered_archive(self):
        before=self.package();after=(*before[:2],{**self.blobs,'py312':b'bad'})
        self.assertEqual(x.compare_packages(before,after)['status'],'EVIDENCE_LOSS')
    def test_both_unknown_never_no_change(self):
        p=(*self.package()[:2],{});self.assertEqual(x.compare_packages(p,p)['status'],'COMPARISON_INCOMPLETE')
    def test_different_repo_not_comparable(self):
        before=self.package();self.e['repository_id']=999
        self.assertEqual(x.compare_packages(before,self.package())['status'],'NOT_COMPARABLE')
    def test_same_attempt_different_source(self):
        before=self.package();self.e['source_sha']='f'*40
        self.assertEqual(x.compare_packages(before,self.package())['status'],'INCONSISTENT_EXECUTION_IDENTITY')
    def test_different_attempt_disclosed(self):
        before=self.package();self.e['attempt']=2
        out=x.compare_packages(before,self.package());self.assertEqual(out['scope'],'DISTINCT_EXECUTIONS_LOGICALLY_PAIRED')
        self.assertFalse(out['jobs'][0]['same_execution_identity'])
    def test_reordering_not_change(self):
        before=self.package();self.e['jobs'].reverse();self.cap['jobs']['rows'].reverse()
        for v in self.e['test_ids'].values():v.reverse()
        self.assertEqual(x.compare_packages(before,self.package())['status'],'NO_OBSERVED_CHANGE')
    def test_no_io(self):
        with patch('builtins.open',side_effect=AssertionError('I/O')):
            self.assertEqual(x.compare_packages(self.package(),self.package())['status'],'NO_OBSERVED_CHANGE')
    def test_no_mutation(self):
        p=self.package();saved=copy.deepcopy(p);x.compare_packages(p,p);self.assertEqual(p,saved)
    def test_invalid_input(self):self.assertEqual(x.compare_packages((b'bad',b'{}',{}),self.package())['status'],'COMPARISON_INCOMPLETE')
    def test_html_escape(self):
        out=x.compare_packages(self.package(),self.package());out['scope']='<script>alert(1)</script>'
        text=x.render_html(out);self.assertNotIn('<script>',text);self.assertIn('&lt;script&gt;',text)
    def test_no_active_html_dependencies(self):
        text=x.render_html(x.compare_packages(self.package(),self.package()))
        for fragment in ('<script','<iframe','src=','onclick='):self.assertNotIn(fragment,text)
    def test_no_permission(self):
        out=x.compare_packages(self.package(),self.package());self.assertTrue(all(v is False for v in out['non_effects'].values()))
    def test_old_manual_capture_preserved(self):
        self.assertEqual(x.r.assess(*self.package())['capture_provenance'],'CONNECTOR_GET_SELECTED_FIELDS_MANUAL_PROJECTION')
    def test_collector_incomplete_cannot_match(self):
        e,_,_,rows=replay_fixture();cap,_=c.collect(dump(e),c.Replay(rows[:2]),limits=c.Limits(per_page=1),clock=lambda:0)
        self.assertNotEqual(x.r.assess(dump(e),dump(cap),self.blobs)['status'],x.r.GOOD)


def load_tests(loader, tests, pattern):
    cases = load('bounded_collection_view_cases', HERE/'test_collection_view.py')
    tests.addTests(loader.loadTestsFromModule(cases))
    return tests


if __name__=='__main__':unittest.main(verbosity=2)
