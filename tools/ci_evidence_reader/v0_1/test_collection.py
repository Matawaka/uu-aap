# SPDX-License-Identifier: Apache-2.0
"""Authored finite transport/comparison cases, not independent qualification."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);obj=importlib.util.module_from_spec(spec)
    sys.modules[name]=obj;spec.loader.exec_module(obj);return obj

c=load('bounded_collector_test',HERE/'collector.py')
x=load('bounded_comparison_test',HERE/'compare.py')
f=load('bounded_fixture_test',HERE/'test_reader.py')

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


if __name__=='__main__':unittest.main(verbosity=2)
