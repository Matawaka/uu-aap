"""Bound synthetic response-container/filter experiment. No evaluator or model."""
from __future__ import annotations

import argparse
from collections import Counter
import copy
from dataclasses import asdict
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import sysconfig
import unittest

BASE = '648811172c9711a8b2c482e93ff8cee493ef3b50'
TREE = '127d90ca9c09dad49e017b3c91fe546ac3c2f693'
ROOT = 'research/related-work-novelty-boundary-2025-2026'
WF = '.github/workflows/statebench-response-filter-v0.19.yml'
ADAPTER = 'f6735ed35e3474feb63ef68bb089e73518c9fc60'
PRIOR_RESULT = '041800590327928c6a414e7f9284c26cf58eec7081e6b89775cf3d2e040f0c24'
PROFILE = 'MATAWAKA_SINGLE_RESPONSE_FILTER_BRIDGE_V019'
FILTER_SOURCES = {'api/filter.py': '8d9db6821724c497c4a27116a1238e3b8d32ae29',
                  'filters/selection.py': '8c670ed74d00655441cc45181fba1265f0db5290',
                  'filters/__init__.py': '0049be4e01bcf1e0f3adaaf45f43f5443ff13d84'}
CONTRACT = {'schema': 'matawaka.single-response-filter-contract/v0.19', 'profile': PROFILE,
            'predecessor': BASE, 'documents': 251, 'repetitions': 2,
            'filter': {'name': 'none', 'components': ['take_first']}, 'responses_per_request': 1,
            'response_origin': 'HAND_AUTHORED_SYNTHETIC_NOT_MODEL_OUTPUT',
            'response_pattern': 'MATAWAKA_SYNTHETIC_RESPONSE_V019:<three-digit-sequence>',
            'admission': 'WHOLE_BATCH_BEFORE_ATTACHMENT_AND_FILTERING',
            'output_gate': 'WHOLE_FILTERED_COLLECTION_BEFORE_SCORING',
            'scoring': 'UNCHANGED_V018_BOUND_FULL_DOCUMENT_CALLBACK',
            'raw_diagnostics': ['two_responses_keeps_first', 'bare_string_yields_character', 'late_empty_partial_write'],
            'adapter_blob': ADAPTER, 'native_filter_sources': FILTER_SOURCES,
            'original_metric_status': 'NONPASS', 'aggregate_computed': False,
            'model_authorized': False, 'dispatch_authorized': False, 'merge_authorized': False}
NON_EFFECTS = {key: False for key in (
    'old_adapter_modified', 'upstream_source_modified', 'site_packages_patched', 'dependency_profile_changed',
    'old_results_reinterpreted', 'original_metric_compatible', 'full_upstream_task_compatible',
    'model_generated_responses', 'model_downloaded', 'model_instantiated', 'model_executed',
    'provider_client_created', 'provider_api_called', 'llm_judge_called', 'user_credentials_used',
    'hub_dataset_loaded', 'evaluation_dispatched', 'request_cache_used', 'request_cache_written',
    'general_filter_compatibility_established', 'multi_response_profile_qualified',
    'full_evaluator_integration_established', 'aggregate_benchmark_score_established',
    'model_performance_established', 'full_judge_semantics_established', 'novelty_established',
    'production_ready', 'release_authorized', 'standards_authorized', 'merge_authorized')}


def require(ok, reason):
    if not ok: raise ValueError(reason)


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n').encode('utf-8')


def sha(data): return hashlib.sha256(data).hexdigest()


def blob(data): return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def equal(a, b): require(encode(a) == encode(b), 'TYPED_CONTENT_MISMATCH')


def bound(path, expected):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_FILE_REQUIRED:' + path.name)
    data = path.read_bytes(); require(sha(data) == expected, 'EXACT_BYTES_REQUIRED:' + path.name)
    return data


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, 'MODULE_REQUIRED')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def git(repo, *args):
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(repo), *args], text=True).strip()


def boundary(repo):
    git(repo, 'merge-base', '--is-ancestor', BASE, 'HEAD')
    require(git(repo, 'rev-parse', f'HEAD:{ROOT}/v0.18') == TREE, 'PREDECESSOR_TREE_CHANGED')
    for line in git(repo, 'diff', '--no-renames', '--name-status', BASE, 'HEAD').splitlines():
        status, path = line.split('\t', 1)
        require(status == 'A' and (path.startswith(ROOT + '/v0.19/') or path == WF), 'NON_ADDITIVE_OR_PROTECTED_DIFF')
    require(not git(repo, 'diff', '--name-only'), 'TRACKED_WORKTREE_CHANGED')
    root = repo / ROOT / 'v0.19'
    require(blob((root / 'adapter.py').read_bytes()) == ADAPTER, 'ADAPTER_SOURCE_CHANGED')
    equal(json.loads((root / 'contract.json').read_bytes()), CONTRACT)


def rejection(fn, calls, expected=None):
    watched = ('task_apply_filters', 'ensemble_apply', 'take_first_apply', 'judge')
    before = {k: calls[k] for k in watched}
    try: fn()
    except ValueError as exc:
        if expected is not None: require(str(exc) == expected, 'UNEXPECTED_REJECTION:' + str(exc))
        reason = str(exc)
    else: raise ValueError('INVALID_INPUT_ACCEPTED')
    require(before == {k: calls[k] for k in watched}, 'REJECTED_INPUT_REACHED_FILTER_OR_JUDGE')
    return {'reason': reason, 'native_filter_calls': 0, 'native_judge_calls': 0}


def fault_cases(task, after):
    last = task.instances[-1]
    if after:
        return [('missing_output', lambda: setattr(last, 'filtered_resps', {})),
                ('extra_output', lambda: last.filtered_resps.update(extra='x')),
                ('wrong_output_type', lambda: setattr(last, 'filtered_resps', [])),
                ('wrong_output_value', lambda: last.filtered_resps.update(none='wrong')),
                ('list_output', lambda: last.filtered_resps.update(none=['wrong'])),
                ('swapped_output', lambda: last.filtered_resps.update(none=task.instances[0].filtered_resps['none'])),
                ('post_raw_change', lambda: setattr(last, 'resps', ['changed'])),
                ('post_doc_change', lambda: last.doc.update(query='changed'))]
    return [('late_raw_empty', lambda: setattr(last, 'resps', [])),
            ('late_raw_multiple', lambda: last.resps.append('EXTRA_SYNTHETIC')),
            ('late_raw_string', lambda: setattr(last, 'resps', 'RAW')),
            ('late_raw_nested', lambda: setattr(last, 'resps', [['RAW']])),
            ('late_raw_changed', lambda: setattr(last, 'resps', ['wrong'])),
            ('late_stale_output', lambda: last.filtered_resps.update(none='STALE')),
            ('late_bool_repeats', lambda: setattr(last, 'repeats', True)),
            ('late_bool_metadata', lambda: setattr(last, 'metadata', (last.task_name, True, 1))),
            ('late_changed_doc', lambda: last.doc.update(query='changed')),
            ('late_changed_context', lambda: setattr(last, 'arguments', ('changed', last.arguments[1]))),
            ('late_extra_field', lambda: setattr(last, 'extra', 'x')),
            ('missing_instance', lambda: setattr(task, '_instances', task.instances[:-1])),
            ('reordered_instances', lambda: setattr(task, '_instances', list(reversed(task.instances)))),
            ('renamed_pipeline', lambda: setattr(task._filters[0], 'name', 'other')),
            ('extra_pipeline', lambda: task._filters.append(task._filters[0]))]


def test_faults(task, bridge, scorer, calls, after, repetition):
    records = []
    objects, snapshots = list(task.instances), [copy.deepcopy(vars(x)) for x in task.instances]
    filters = copy.deepcopy(task._filters)
    for name, inject in fault_cases(task, after):
        try:
            inject()
            entry = rejection(lambda: bridge.score(scorer) if after else bridge.apply(), calls)
            require(bridge.state == ('FILTERED' if after else 'LOADED'), 'PRECHECK_CHANGED_STATE')
            records.append({'repetition': repetition, 'phase': 'after_filter' if after else 'before_filter', 'case': name, **entry})
        finally:
            # Restore only deliberately corrupted test fixtures whose precheck ran
            # NO native filter/judge. Never repair a failed native filtering run.
            task._instances = objects
            for obj, original in zip(objects, snapshots, strict=True):
                vars(obj).clear(); vars(obj).update(copy.deepcopy(original))
            task._filters = copy.deepcopy(filters)
    return records


def raw_diagnostics(task):
    """Unwrapped upstream behavior on temporary copies; never followed by scoring."""
    records = []
    for name in CONTRACT['raw_diagnostics']:
        pair = copy.deepcopy(task.instances[:2])
        for inst in pair: inst.filtered_resps = {}; inst.resps = ['SAFE']
        error = None
        if name == 'two_responses_keeps_first': pair[0].resps = ['FIRST', 'SECOND']
        elif name == 'bare_string_yields_character': pair[0].resps = 'RAW'
        else: pair[0].resps = ['FIRST']; pair[1].resps = []
        before = [copy.deepcopy(i.resps) for i in pair]
        try: task._filters[0].apply(pair)
        except IndexError as exc: error = {'type': type(exc).__name__, 'message': str(exc)}
        outputs = [i.filtered_resps for i in pair]
        if name == 'two_responses_keeps_first': equal(outputs, [{'none': 'FIRST'}, {'none': 'SAFE'}])
        elif name == 'bare_string_yields_character': equal(outputs, [{'none': 'R'}, {'none': 'SAFE'}])
        else:
            equal(outputs, [{'none': 'FIRST'}, {}]); require(error is not None, 'EXPECTED_RAW_INDEX_ERROR_ABSENT')
        if name != 'late_empty_partial_write': require(error is None, 'UNEXPECTED_RAW_FILTER_ERROR')
        equal(before, [i.resps for i in pair])
        records.append({'case': name, 'raw_inputs': before, 'filtered_outputs': outputs,
                        'exception': error, 'profile_admitted': False, 'scoring_performed': False})
    return records


def run(repo, predecessor, upstream, cache, prior, output):
    output.mkdir(parents=True, exist_ok=False)
    stage, failure = 'preflight', None
    counts, attempts = Counter(), []
    result = {'schema': 'matawaka.single-response-filter-result/v0.19', 'profile': PROFILE,
              'predecessor': BASE, 'status': 'INCONCLUSIVE', 'non_effects': NON_EFFECTS.copy()}
    try:
        boundary(repo)
        require(git(predecessor, 'rev-parse', 'HEAD') == BASE, 'EXACT_PREDECESSOR_REQUIRED')
        r = predecessor / ROOT
        for v, file, expected in [('v0.18', 'adapter.py', '9ed5294978ef4cb7a3f145cc5e9dde13a67c503c'),
                ('v0.18','gate.py','7968debb3af38fdc0a102822d6beb845044a4836'),
                ('v0.17','gate.py','414adb20e87543a35939e40af1eca8dbfe58b916'),
                ('v0.16','gate.py','f63454b95b3ae6f748447eba0150bb58375723a6'),
                ('v0.15','adapter.py','2bbcc1d996b5b0586371894027153b3765e98c7c'),
                ('v0.14','gate.py','8390dc543e838d1aaea7a3835de3f36a6a8f3650')]:
            require(blob((r/v/file).read_bytes()) == expected, 'FROZEN_SOURCE_CHANGED:'+v+'/'+file)
        load(r/'v0.14/gate.py', 'environment_v014').isolated()
        require(not os.environ.get('STATEBENCH_JUDGE'), 'JUDGE_OVERRIDE_FORBIDDEN')
        prior_result = json.loads(bound(prior/'results.json', PRIOR_RESULT))
        require(prior_result['original_metric_compatibility'] == 'NONPASS', 'HISTORICAL_NONPASS_CHANGED')
        a18 = load(r/'v0.18/adapter.py', 'v018_scorer_for_v019')
        g18 = load(r/'v0.18/gate.py', 'v018_gate_for_v019')
        g17 = load(r/'v0.17/gate.py', 'v017_boundary_for_v019')
        g16 = load(r/'v0.16/gate.py', 'v016_requests_for_v019')
        a15 = load(r/'v0.15/adapter.py', 'v015_data_for_v019')
        adapter = load(repo/ROOT/'v0.19/adapter.py', 'v019_filter_adapter')
        expected_docs = json.loads(bound(prior/'predecessor/predecessor/predecessor/documents.json', a18.DOCS_SHA))
        requests = json.loads(bound(prior/'predecessor/predecessor/requests.json', a18.REQUESTS_SHA))
        lm_root = Path(sysconfig.get_path('purelib'))/'lm_eval'
        spec = importlib.util.find_spec('statebench'); require(spec and spec.origin, 'STATEBENCH_REQUIRED')
        sb_root = Path(spec.origin).parent
        sources = {**g16.SOURCES, **g17.LM_SOURCES, **FILTER_SOURCES}
        for directory, files in ((lm_root, sources), (sb_root, g17.STATEBENCH_SOURCES)):
            for file, expected in files.items(): require(blob((directory/file).read_bytes()) == expected, 'NATIVE_SOURCE_CHANGED:'+file)
        plugin = str((upstream/a15.TASK_DIR/'utils.py').resolve())
        def deny(*args, **kwargs):
            attempts.append('socket'); raise RuntimeError('NETWORK_DENIED')
        socket.socket.connect = deny; socket.socket.connect_ex = deny; socket.socket.sendto = deny
        socket.create_connection = deny; socket.getaddrinfo = deny
        def observer(frame, event, arg):
            if event != 'call': return
            module, name, local = frame.f_globals.get('__name__', ''), frame.f_code.co_name, frame.f_locals
            explicitly_allowed = ((module == 'lm_eval.api.task' and name in {'build_all_requests','construct_requests','apply_filters'})
                or (module == 'lm_eval.caching.cache' and name == 'load_from_cache' and local.get('cache') is False))
            if (g17.forbidden(module, name, local) and not explicitly_allowed) or (frame.f_code.co_filename == plugin and name in {'get_judge','decision_accuracy'}):
                attempts.append(module+'.'+name); raise RuntimeError('FORBIDDEN_FILTER_BRIDGE_EFFECT')
            if module == 'lm_eval.api.task' and name in {'build_all_requests','construct_requests','fewshot_context','process_results','apply_filters'}:
                counts['task_apply_filters' if name == 'apply_filters' else name] += 1
            if module == 'lm_eval.api.filter' and name == 'apply': counts['ensemble_apply'] += 1
            if module == 'lm_eval.filters.selection' and name == 'apply': counts['take_first_apply'] += 1
            if module == 'lm_eval.api.instance' and name == '__post_init__': counts['instance_initializations'] += 1
            if module == 'lm_eval.caching.cache' and name == 'load_from_cache': counts['disabled_cache_reads'] += 1
            if module == 'statebench.evaluation.judge' and name in {'create_judge','judge'}: counts[name] += 1
            if module == 'v018_scorer_for_v019' and name == 'bound_full_document_callback': counts['full_doc_callback'] += 1
            if frame.f_code.co_filename == plugin and name == 'process_docs': counts['upstream_process_docs'] += 1
        sys.setprofile(observer)
        from lm_eval.api.instance import Instance
        from statebench.evaluation import create_judge
        from statebench.schema.timeline import GroundTruth
        results, traces, references, raw_tests, rejections = [], [], [], [], []
        for repeat in range(2):
            stage = 'request_construction_'+str(repeat)
            original = a15.ExactTestAdapter(upstream, cache)
            task = original.construct()['tasks'][a15.TASK]
            docs = [dict(d) for d in task.task_docs]; equal(docs, expected_docs)
            config_before = g16.configuration_snapshot(task.config)
            task.build_all_requests(**g16.FLAGS)
            equal(g16.snapshots(task.instances, Instance, requests), requests)
            bridge = adapter.BoundResponseFilterBridge(task, docs, requests, a18)
            scorer = a18.BoundSyntheticScorer(docs, requests); scorer.construct(original)
            items = [a18.envelope(doc, requests[i], i, adapter.response(i)) for i, doc in enumerate(docs)]
            stage = 'envelope_admission_'+str(repeat)
            for name, mutant, reason in g18.mutations(items):
                entry = rejection(lambda: bridge.attach(mutant), counts, reason)
                require(bridge.state == 'FRESH', 'FAILED_ADMISSION_CHANGED_STATE')
                equal(g16.snapshots(task.instances, Instance, requests), requests)
                rejections.append({'repetition': repeat,'phase':'before_attachment','case':name,**entry})
            entry = rejection(lambda: bridge.score(scorer), counts, 'SCORING_REQUIRES_FILTERED_BRIDGE')
            rejections.append({'repetition':repeat,'phase':'before_attachment','case':'early_scoring',**entry})
            bridge.attach(items)
            stage = 'raw_container_admission_'+str(repeat)
            rejections += test_faults(task, bridge, scorer, counts, False, repeat)
            stage = 'native_filter_'+str(repeat)
            filtered_rows = bridge.apply()
            rejections.append({'repetition':repeat,'phase':'after_filter','case':'refilter',**rejection(bridge.apply,counts,'FILTER_REQUIRES_LOADED_BRIDGE')})
            rejections += test_faults(task, bridge, scorer, counts, True, repeat)
            stage = 'bound_scoring_'+str(repeat)
            completed = bridge.score(scorer)
            require(bridge.state == 'COMPLETE' and scorer.state == 'COMPLETE', 'INCOMPLETE_BRIDGE')
            rejections.append({'repetition':repeat,'phase':'complete','case':'reuse',**rejection(lambda: bridge.score(scorer),counts,'SCORING_REQUIRES_FILTERED_BRIDGE')})
            reference_judge = create_judge(use_llm=False)
            reference = []
            for i, doc in enumerate(docs):
                native = asdict(reference_judge.judge(response=adapter.response(i), ground_truth=GroundTruth.model_validate_json(doc['ground_truth_json']),
                    timeline_id=doc['timeline_id'], query_idx=doc['query_idx'], track=doc['track'], domain=doc['domain']))
                equal(native, completed['scoring_batch']['records'][i]['native_result'])
                reference.append(native)
            require(reference_judge.descriptor == 'deterministic-only' and reference_judge._openai_client is None and reference_judge._anthropic_client is None, 'REFERENCE_PROVIDER_EFFECT')
            stage = 'unwrapped_upstream_diagnostics_'+str(repeat)
            raw_tests.append(raw_diagnostics(task))
            require(config_before == g16.configuration_snapshot(task.config), 'TASK_CONFIG_CHANGED')
            equal(filtered_rows, [adapter.snapshot(x) for x in task.instances])
            original.verify_inputs()
            results.append(completed); traces.append(filtered_rows); references.append(reference)
        stage = 'evidence_closure'
        for collection in (results, traces, references, raw_tests): equal(collection[0], collection[1])
        expected_calls = {'build_all_requests':2,'construct_requests':502,'fewshot_context':502,'instance_initializations':502,
            'disabled_cache_reads':2,'task_apply_filters':2,'ensemble_apply':8,'take_first_apply':8,
            'process_results':502,'full_doc_callback':502,'judge':1004,'create_judge':4,'upstream_process_docs':6}
        equal(dict(counts), expected_calls)
        require(len(rejections) == 94 and all(x['native_filter_calls'] == 0 and x['native_judge_calls'] == 0 for x in rejections), 'REJECTION_COVERAGE_MISMATCH')
        require(not attempts, 'FORBIDDEN_EFFECT_OBSERVED')
        for directory, files in ((lm_root,sources),(sb_root,g17.STATEBENCH_SOURCES)):
            for file, expected in files.items(): require(blob((directory/file).read_bytes()) == expected, 'SOURCE_MUTATED_AFTER_FILTER')
        bound(prior/'results.json',PRIOR_RESULT)
        files = {'bridge.json':results[0],'filtered-instances.json':traces[0],'responses.json':items,
                 'native-reference.json':references[0],'raw-filter-diagnostics.json':raw_tests[0],'rejections.json':rejections}
        for name, value in files.items(): (output/name).write_bytes(encode(value))
        result.update(status='BOUND_SINGLE_RESPONSE_FILTER_BRIDGE_EXECUTED_PASS',
            qualification_scope='SINGLE_SYNTHETIC_RESPONSE_DEFAULT_NONE_TAKE_FIRST_TO_V018_ONLY',
            original_task_compatibility='NONPASS',original_metric_compatibility='NONPASS',
            response_origin=adapter.ORIGIN,documents=251,distinct_synthetic_responses=251,repetitions=2,
            filter=CONTRACT['filter'],whole_input_and_output_admission=True,
            native_reference_equal=True,repetitions_identical=True,request_and_raw_bytes_preserved=True,
            invalid_input_filter_and_judge_calls=0,rejection_records=len(rejections),raw_diagnostics=3,
            raw_upstream_partial_write_observed=True,raw_diagnostics_not_profile_admissions=True,
            contract_sha256=sha(encode(CONTRACT)),prior_result_sha256=PRIOR_RESULT,
            requests_sha256=a18.REQUESTS_SHA,documents_sha256=a18.DOCS_SHA,
            evidence_sha256={n:sha(encode(v)) for n,v in files.items()},actual_calls=dict(counts),
            forbidden_effect_attempts=attempts,filter_source_blobs=FILTER_SOURCES,
            effects={'response_containers_populated':True,'native_response_filters_applied':True,'synthetic_bound_scoring_executed':True})
    except Exception as exc:
        failure = exc
        result.update(failure_stage=stage,failure_type=type(exc).__name__,failure_detail=str(exc)[:1600],actual_calls=dict(counts),forbidden_effect_attempts=attempts)
    finally: sys.setprofile(None)
    data=encode(result); (output/'results.json').write_bytes(data)
    print(data.decode(),end=''); print('RESULT_SHA256='+sha(data))
    if failure is not None: raise SystemExit(1)


class Tests(unittest.TestCase):
    def setUp(self): self.a=load(Path(__file__).with_name('adapter.py'),'filter_helpers')
    def test_raw_valid(self): self.a.check_raw(['abc'],'abc')
    def test_raw_invalid_shapes(self):
        for x in ([],['a','b'],'abc',[['abc']],( 'abc', ),[1],[True]):
            with self.subTest(value=x),self.assertRaises(ValueError): self.a.check_raw(x,'abc')
    def test_raw_identity(self):
        with self.assertRaises(ValueError): self.a.check_raw(['other'],'abc')
    def test_filtered_valid(self): self.a.check_filtered({'none':'abc'},'abc')
    def test_filtered_empty_before(self): self.a.check_filtered({},None)
    def test_stale(self):
        with self.assertRaises(ValueError): self.a.check_filtered({'none':'old'},None)
    def test_filtered_invalid(self):
        for x in ([],{}, {'none':['abc']},{'other':'abc'},{'none':'abc','extra':'abc'},{'none':'wrong'}):
            with self.subTest(value=x),self.assertRaises(ValueError):self.a.check_filtered(x,'abc')
    def test_unique_responses(self):self.assertEqual(len({self.a.response(i) for i in range(251)}),251)
    def test_response_index(self):
        for x in (-1,251,True,'0'):
            with self.subTest(value=x),self.assertRaises(ValueError):self.a.response(x)
    def test_no_numeric_coercion(self):
        with self.assertRaises(ValueError):equal(True,1)
    def test_nan(self):
        with self.assertRaises(ValueError):encode(float('nan'))
    def test_rejection_with_effect(self):
        c=Counter()
        def bad():c['ensemble_apply']+=1;raise ValueError('bad')
        with self.assertRaisesRegex(ValueError,'REJECTED_INPUT_REACHED'):rejection(bad,c)
    def test_rejection_without_effect(self):
        def deny():raise ValueError('denied')
        self.assertEqual(rejection(deny,Counter(),'denied')['native_judge_calls'],0)
    def test_false_acceptance(self):
        with self.assertRaisesRegex(ValueError,'INVALID_INPUT_ACCEPTED'):rejection(lambda:None,Counter())
    def test_scope(self):
        self.assertTrue(all(x is False for x in NON_EFFECTS.values()))
        self.assertEqual(CONTRACT['responses_per_request'],1)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('command',choices=['self-test','boundary','run'])
    p.add_argument('--repo',type=Path,default=Path.cwd())
    for name in ('predecessor','upstream','cache','prior','output'):p.add_argument('--'+name,type=Path)
    a=p.parse_args()
    if a.command=='self-test':
        r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests));raise SystemExit(0 if r.wasSuccessful() else 1)
    if a.command=='boundary':boundary(a.repo.resolve());print('V019_ADDITIVE_PREDECESSOR_BOUNDARY_PASS');return
    require(all(getattr(a,n) is not None for n in ('predecessor','upstream','cache','prior','output')),'EXPLICIT_PATHS_REQUIRED')
    run(*[getattr(a,n).resolve() for n in ('repo','predecessor','upstream','cache','prior','output')])


if __name__=='__main__':main()
