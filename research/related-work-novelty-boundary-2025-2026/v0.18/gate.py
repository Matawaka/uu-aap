"""Qualify only the bound synthetic scoring bridge, not an upstream benchmark."""
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

BASE = '05c6cfc746517e6c7befd6995d31be0d0fb738f6'
TREE = '51453d6f8b8816eeee53ebdf27a025e93409fad6'
ROOT = 'research/related-work-novelty-boundary-2025-2026'
WF = '.github/workflows/statebench-bound-scoring-v0.18.yml'
PRIOR_RESULT = 'ed7b625a4fed8699d7e94de294037bbb1502146c1306ea8bb457d167efac1631'
PRIOR_GATE = '414adb20e87543a35939e40af1eca8dbfe58b916'
ADAPTER_BLOB = '9ed5294978ef4cb7a3f145cc5e9dde13a67c503c'
CASES_SHA = '7a4a46a01e8aebb9747f7b80e24acef1a2543a08ce85607a151b426c1f9c5574'
PROFILE = 'MATAWAKA_BOUND_SYNTHETIC_SCORING_V018'
CONTRACT = {
    'schema': 'matawaka.bound-synthetic-scoring-contract/v0.18', 'profile': PROFILE,
    'predecessor': BASE, 'documents': 251, 'repetitions': 2, 'semantic_cases': 16,
    'response_origin': 'HAND_AUTHORED_SYNTHETIC_NOT_MODEL_OUTPUT',
    'response_marker': 'MATAWAKA_SYNTHETIC_RESPONSE_V018',
    'semantic_controls_sha256': CASES_SHA,
    'adapter_blob': ADAPTER_BLOB, 'response_byte_ceiling': 65536,
    'admission': 'ENTIRE_ORDERED_BATCH_AND_GROUND_TRUTH_BEFORE_JUDGE',
    'native_interface': 'create_judge(use_llm=False).judge',
    'task_delta': ['task', 'process_results'], 'old_loader_metadata_preserved': True,
    'metric_list': [], 'no_aggregation': True, 'single_use': True,
    'hashes_prove_authenticity': False, 'native_reference_proves_semantic_correctness': False,
    'upstream_metric_status': 'NONPASS', 'model_authorized': False, 'merge_authorized': False,
}
NON_EFFECTS = {k: False for k in (
    'model_generated_responses', 'model_downloaded', 'model_instantiated', 'model_executed',
    'provider_api_called', 'provider_client_created', 'llm_judge_called', 'user_credentials_used',
    'hub_dataset_loaded', 'evaluation_dispatched', 'response_filters_applied', 'request_cache_used',
    'old_adapter_modified', 'old_results_reinterpreted', 'upstream_source_modified',
    'dependency_profile_changed', 'site_packages_patched', 'original_metric_compatible',
    'full_upstream_task_compatible', 'full_judge_semantics_established',
    'full_evaluator_integration_established', 'aggregate_benchmark_score_established',
    'model_performance_established', 'novelty_established', 'production_ready',
    'release_authorized', 'standards_authorized', 'merge_authorized',
)}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def encode(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def equal(a, b):
    require(encode(a) == encode(b), 'TYPED_CONTENT_MISMATCH')


def bound(path, digest):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_FILE_REQUIRED:' + path.name)
    data = path.read_bytes()
    require(sha(data) == digest, 'EXACT_BYTES_REQUIRED:' + path.name)
    return data


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, 'MODULE_REQUIRED')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(repo, *args):
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(repo), *args], text=True).strip()


def boundary(repo):
    git(repo, 'merge-base', '--is-ancestor', BASE, 'HEAD')
    require(git(repo, 'rev-parse', f'HEAD:{ROOT}/v0.17') == TREE, 'PREDECESSOR_TREE_CHANGED')
    for line in git(repo, 'diff', '--no-renames', '--name-status', BASE, 'HEAD').splitlines():
        status, path = line.split('\t', 1)
        require(status == 'A' and (path.startswith(ROOT + '/v0.18/') or path == WF), 'NON_ADDITIVE_OR_PROTECTED_DIFF')
    require(not git(repo, 'diff', '--name-only'), 'TRACKED_WORKTREE_CHANGED')
    root = repo / ROOT / 'v0.18'
    require(blob((root / 'adapter.py').read_bytes()) == ADAPTER_BLOB, 'ADAPTER_SOURCE_CHANGED')
    bound(root / 'semantic-controls.json', CASES_SHA)
    equal(json.loads((root / 'contract.json').read_bytes()), CONTRACT)


def rejected(fn, reason, calls):
    before = calls['judge']
    try:
        fn()
    except ValueError as exc:
        require(str(exc) == reason, 'UNEXPECTED_REJECTION:' + str(exc))
    else:
        raise ValueError('INVALID_INPUT_ACCEPTED')
    require(calls['judge'] == before, 'INVALID_INPUT_SCORED_PREFIX')
    return {'reason': reason, 'native_judge_calls': 0}


def mutations(items):
    yield 'empty', [], 'EXACT_RESPONSE_CARDINALITY_REQUIRED'
    yield 'missing', items[:-1], 'EXACT_RESPONSE_CARDINALITY_REQUIRED'
    yield 'extra', items + [items[-1]], 'EXACT_RESPONSE_CARDINALITY_REQUIRED'
    yield 'tuple', tuple(items), 'EXACT_RESPONSE_CARDINALITY_REQUIRED'
    yield 'reverse', list(reversed(items)), 'TYPED_CONTENT_MISMATCH'
    duplicate = copy.deepcopy(items); duplicate[-1] = copy.deepcopy(items[0])
    yield 'duplicate_at_end', duplicate, 'TYPED_CONTENT_MISMATCH'
    for name, key, value, reason in (
        ('late_wrong_id', 'timeline_id', 'wrong', 'TYPED_CONTENT_MISMATCH'),
        ('late_wrong_query', 'query_idx', 999, 'TYPED_CONTENT_MISMATCH'),
        ('late_bool_query', 'query_idx', True, 'INTEGER_BINDING_FIELDS_REQUIRED'),
        ('late_bool_sequence', 'sequence', True, 'INTEGER_BINDING_FIELDS_REQUIRED'),
        ('late_wrong_sequence', 'sequence', 249, 'TYPED_CONTENT_MISMATCH'),
        ('late_doc_hash', 'document_sha256', '0'*64, 'TYPED_CONTENT_MISMATCH'),
        ('late_request_hash', 'request_sha256', '0'*64, 'TYPED_CONTENT_MISMATCH'),
        ('late_origin', 'response_origin', 'MODEL_OUTPUT', 'TYPED_CONTENT_MISMATCH'),
        ('late_response_hash', 'response_sha256', '0'*64, 'TYPED_CONTENT_MISMATCH'),
        ('late_empty', 'response', '', 'BOUNDED_NONEMPTY_RESPONSE_REQUIRED'),
        ('late_whitespace', 'response', ' \n', 'BOUNDED_NONEMPTY_RESPONSE_REQUIRED'),
        ('late_response_list', 'response', ['yes'], 'STRING_BINDING_FIELDS_REQUIRED'),
        ('late_oversize', 'response', 'x'*65537, 'BOUNDED_NONEMPTY_RESPONSE_REQUIRED'),
    ):
        value_items = copy.deepcopy(items); value_items[-1][key] = value
        yield name, value_items, reason
    for name, change in [('extra_field', True), ('missing_field', False)]:
        value_items = copy.deepcopy(items)
        if change:
            value_items[-1]['extra'] = True
        else:
            del value_items[-1]['response_sha256']
        yield name, value_items, 'EXACT_ENVELOPE_FIELDS_REQUIRED'


def no_promotion(result):
    require(result['profile'] == PROFILE and result['original_metric_compatibility'] == 'NONPASS', 'HISTORY_PROMOTION')
    equal(result['non_effects'], NON_EFFECTS)


def run(repo, predecessor, upstream, cache, prior, output):
    output.mkdir(parents=True, exist_ok=False)
    stage, failure = 'preflight', None
    result = {'schema': 'matawaka.bound-synthetic-scoring-result/v0.18', 'profile': PROFILE,
              'predecessor': BASE, 'status': 'INCONCLUSIVE', 'non_effects': NON_EFFECTS.copy()}
    calls, attempts = Counter(), []
    try:
        boundary(repo)
        require(git(predecessor, 'rev-parse', 'HEAD') == BASE, 'EXACT_PREDECESSOR_REQUIRED')
        previous_path = predecessor / ROOT / 'v0.17/gate.py'
        require(blob(previous_path.read_bytes()) == PRIOR_GATE, 'OLD_AUDIT_CHANGED')
        old = load(previous_path, 'scoring_audit_v017_preserved')
        env_path = predecessor / ROOT / 'v0.14/gate.py'
        require(blob(env_path.read_bytes()) == old.ENV_GATE, 'ENVIRONMENT_GATE_CHANGED')
        load(env_path, 'scoring_env_v014_preserved').isolated()
        require(not os.environ.get('STATEBENCH_JUDGE'), 'JUDGE_OVERRIDE_FORBIDDEN')
        old_result = json.loads(bound(prior / 'results.json', PRIOR_RESULT))
        require(old_result['scoring_compatibility'] == 'NONPASS' and old_result['original_task_compatibility'] == 'NONPASS', 'OLD_NONPASS_CHANGED')
        root = repo / ROOT / 'v0.18'
        adapter = load(root / 'adapter.py', 'bound_scoring_v018')
        ap = predecessor / ROOT / 'v0.15/adapter.py'
        require(blob(ap.read_bytes()) == old.ADAPTER, 'DATA_ADAPTER_CHANGED')
        data_adapter = load(ap, 'scoring_data_adapter_v015')
        expected_docs = json.loads(bound(prior / 'predecessor/predecessor/documents.json', adapter.DOCS_SHA))
        requests = json.loads(bound(prior / 'predecessor/requests.json', adapter.REQUESTS_SHA))
        cases = json.loads(bound(root / 'semantic-controls.json', CASES_SHA))['cases']
        require(len(cases) == 16, 'SEMANTIC_CASE_COUNT_CHANGED')
        lm_root = Path(sysconfig.get_path('purelib')) / 'lm_eval'
        spec = importlib.util.find_spec('statebench')
        require(spec is not None and spec.origin is not None, 'STATEBENCH_SOURCE_MISSING')
        sb_root = Path(spec.origin).parent
        for directory, files in ((lm_root, old.LM_SOURCES), (sb_root, old.STATEBENCH_SOURCES)):
            for path, digest in files.items():
                require(blob((directory / path).read_bytes()) == digest, 'NATIVE_SOURCE_CHANGED:' + path)
        plugin_path = str((upstream / data_adapter.TASK_DIR / 'utils.py').resolve())
        def denied(*args, **kwargs):
            attempts.append('socket'); raise RuntimeError('NETWORK_DENIED')
        socket.socket.connect = denied
        socket.socket.connect_ex = denied
        socket.socket.sendto = denied
        socket.create_connection = denied
        socket.getaddrinfo = denied
        def observe(frame, event, arg):
            if event != 'call':
                return
            mod, name = frame.f_globals.get('__name__', ''), frame.f_code.co_name
            if old.forbidden(mod, name, frame.f_locals) or (frame.f_code.co_filename == plugin_path and name in {'decision_accuracy', 'get_judge'}):
                attempts.append(mod + '.' + name); raise RuntimeError('FORBIDDEN_SCORING_BRIDGE_EFFECT')
            if mod == 'lm_eval.api.task' and name == 'process_results': calls['task_process_results'] += 1
            if mod == 'statebench.evaluation.judge' and name in {'create_judge', 'judge'}: calls[name] += 1
            if mod == 'bound_scoring_v018' and name == 'bound_full_document_callback': calls['full_doc_callback'] += 1
            if frame.f_code.co_filename == plugin_path and name == 'process_docs': calls['upstream_process_docs'] += 1
        sys.setprofile(observe)
        from statebench.evaluation import create_judge
        from statebench.schema.timeline import GroundTruth
        repetitions, semantics, rejections = [], [], []
        for repetition in range(2):
            stage = 'construct_' + str(repetition)
            original = data_adapter.ExactTestAdapter(upstream, cache)
            original_task = original.construct()['tasks'][data_adapter.TASK]
            docs = [dict(d) for d in original_task.task_docs]
            equal(docs, expected_docs)
            scorer = adapter.BoundSyntheticScorer(docs, requests)
            task = scorer.construct(original)
            items = [adapter.envelope(d, requests[i], i, adapter.MARKER) for i, d in enumerate(docs)]
            config_delta = {'task': {'from': data_adapter.LEAF, 'to': adapter.TASK},
                            'process_results': 'BOUND_FULL_DOCUMENT_CALLBACK',
                            'metric_list': [], 'loader_metadata_unchanged': True,
                            'aggregation_not_implemented': True}
            stage = 'hostile_admission_' + str(repetition)
            for name, mutant, reason in mutations(items):
                record = rejected(lambda: scorer.score_batch(mutant), reason, calls)
                require(scorer.state == 'FRESH', 'REJECTED_ADMISSION_CHANGED_STATE')
                rejections.append({'repetition': repetition, 'case': name, **record})
            record = rejected(lambda: task.process_results(docs[0], [adapter.MARKER]), 'CALLBACK_OUTSIDE_ADMITTED_BATCH', calls)
            rejections.append({'repetition': repetition, 'case': 'direct_task_bypass', **record})
            stage = 'complete_batch_' + str(repetition)
            batch = scorer.score_batch(items)
            equal(items, [adapter.envelope(d, requests[i], i, adapter.MARKER) for i, d in enumerate(docs)])
            record = rejected(lambda: scorer.score_batch(items), 'SINGLE_USE_CONSTRUCTED_BATCH_REQUIRED', calls)
            rejections.append({'repetition': repetition, 'case': 'completed_reuse', **record})
            stage = 'native_reference_' + str(repetition)
            reference_judge = create_judge(use_llm=False)
            reference = []
            for i, d in enumerate(docs):
                # A separate direct native call, not a read of the bridge ledger.
                native = asdict(reference_judge.judge(response=adapter.MARKER,
                    ground_truth=GroundTruth.model_validate_json(d['ground_truth_json']),
                    timeline_id=d['timeline_id'], query_idx=d['query_idx'], track=d['track'], domain=d['domain']))
                equal(native, batch['records'][i]['native_result'])
                equal(batch['records'][i]['task_result'], {adapter.METRIC: float(native['decision_correct'])})
                reference.append(native)
            require(reference_judge.descriptor == 'deterministic-only' and reference_judge._openai_client is None and reference_judge._anthropic_client is None, 'REFERENCE_PROVIDER_EFFECT')
            stage = 'semantic_controls_' + str(repetition)
            semantic_trace = []
            for i, c in enumerate(cases):
                doc = {'timeline_id': 'SYNTHETIC_V018_' + c['id'], 'query_idx': i,
                       'track': c['track'], 'domain': c['domain']}
                gt = GroundTruth.model_validate(c['ground_truth'])
                observed = adapter.native_result(reference_judge, doc, c['response'], gt)
                projection = {k: observed[k] for k in c['expected_projection']}
                semantic_trace.append({'case': c['id'], 'input': c, 'native_result': observed,
                                       'projection_matches': encode(projection) == encode(c['expected_projection'])})
            semantics.append(semantic_trace)
            repetitions.append(batch)
            (output / 'semantic-trace.json').write_bytes(encode(semantics))
            if not all(x['projection_matches'] for x in semantic_trace):
                result['status'] = 'SYNTHETIC_SEMANTIC_EXPECTATION_NONPASS'
                raise ValueError('PREDECLARED_SEMANTIC_EXPECTATION_MISMATCH')
            require(scorer.state == 'COMPLETE', 'SCORER_NOT_COMPLETE')
            original.verify_inputs()
        stage = 'final_evidence'
        equal(repetitions[0], repetitions[1])
        equal(semantics[0], semantics[1])
        expected_calls = {'task_process_results': 504, 'full_doc_callback': 504, 'judge': 1036,
                          'create_judge': 4, 'upstream_process_docs': 4}
        equal(dict(calls), expected_calls)
        require(not attempts, 'FORBIDDEN_EFFECT_OBSERVED')
        for directory, files in ((lm_root, old.LM_SOURCES), (sb_root, old.STATEBENCH_SOURCES)):
            for path, digest in files.items():
                require(blob((directory / path).read_bytes()) == digest, 'SOURCE_MUTATED_AFTER_SCORING')
        bound(prior / 'results.json', PRIOR_RESULT)
        bound(prior / 'predecessor/requests.json', adapter.REQUESTS_SHA)
        (output / 'batch.json').write_bytes(encode(repetitions[0]))
        (output / 'responses.json').write_bytes(encode(items))
        (output / 'native-reference.json').write_bytes(encode(reference))
        (output / 'semantic-trace.json').write_bytes(encode(semantics[0]))
        (output / 'rejections.json').write_bytes(encode(rejections))
        (output / 'config-delta.json').write_bytes(encode(config_delta))
        result.update(status='BOUND_SYNTHETIC_SCORING_ADAPTER_EXECUTED_PASS',
            qualification_scope='SYNTHETIC_PER_DOCUMENT_BRIDGE_AND_16_FIXED_SEMANTIC_CONTROLS_ONLY',
            original_metric_compatibility='NONPASS', original_task_compatibility='NONPASS',
            response_origin=adapter.ORIGIN, documents=251, repetitions=2,
            complete_native_records_equal_to_separate_reference=True, repetitions_identical=True,
            whole_batch_admission_rejections_per_repetition=21,
            direct_task_bypass_and_reuse_rejected=True, invalid_input_native_calls=0,
            semantic_controls=16, semantic_expectations_matched=True,
            actual_calls=dict(calls), forbidden_effect_attempts=attempts,
            contract_sha256=sha(encode(CONTRACT)), prior_result_sha256=PRIOR_RESULT,
            document_sha256=adapter.DOCS_SHA, requests_sha256=adapter.REQUESTS_SHA,
            batch_sha256=sha(encode(repetitions[0])), responses_sha256=sha(encode(items)),
            native_reference_sha256=sha(encode(reference)), semantic_trace_sha256=sha(encode(semantics[0])),
            rejections_sha256=sha(encode(rejections)), config_delta_sha256=sha(encode(config_delta)))
        no_promotion(result)
    except Exception as exc:
        failure = exc
        result.update(failure_stage=stage, failure_type=type(exc).__name__, failure_detail=str(exc)[:1500],
                      observed_calls=dict(calls), forbidden_effect_attempts=attempts)
    finally:
        sys.setprofile(None)
    data = encode(result)
    (output / 'results.json').write_bytes(data)
    print(data.decode(), end='')
    print('RESULT_SHA256=' + sha(data))
    if failure is not None:
        raise SystemExit(1)


class Tests(unittest.TestCase):
    def setUp(self):
        self.adapter = load(Path(__file__).with_name('adapter.py'), 'adapter_helper_test')
    def test_synthetic_origin(self):
        self.assertEqual(self.adapter.ORIGIN, 'HAND_AUTHORED_SYNTHETIC_NOT_MODEL_OUTPUT')
    def test_empty_response(self):
        with self.assertRaises(ValueError): self.adapter.envelope({}, {}, 0, '')
    def test_nonstring_response(self):
        with self.assertRaises(ValueError): self.adapter.envelope({}, {}, 0, ['yes'])
    def test_response_unicode_bytes(self):
        x = self.adapter.envelope({'timeline_id':'x','query_idx':0}, {}, 0, 'Да')
        self.assertEqual(x['response_sha256'], sha('Да'.encode('utf-8')))
    def test_missing_documents(self):
        with self.assertRaises(ValueError): self.adapter.bind_inputs([], [])
    def test_changed_documents(self):
        with self.assertRaises(ValueError): self.adapter.bind_inputs([{}]*251, [{}]*251)
    def test_boolean_not_integer(self):
        with self.assertRaises(ValueError): equal(True, 1)
    def test_nan(self):
        with self.assertRaises(ValueError): encode(float('nan'))
    def test_expected_mutation_count(self):
        item = {k: 'x' for k in self.adapter.ENVELOPE_KEYS}
        self.assertEqual(len(list(mutations([item]*251))), 21)
    def test_non_effects(self):
        self.assertTrue(all(x is False for x in NON_EFFECTS.values()))
    def test_status_promotion(self):
        with self.assertRaises(ValueError): no_promotion({'profile':PROFILE, 'original_metric_compatibility':'PASS', 'non_effects':NON_EFFECTS})
    def test_semantic_cases_bound(self):
        data = json.loads(bound(Path(__file__).with_name('semantic-controls.json'), CASES_SHA))
        self.assertEqual(len(data['cases']), 16)
        self.assertEqual(len({x['id'] for x in data['cases']}), 16)
    def test_typed_equal(self):
        equal({'x':1}, {'x':1})
    def test_side_effect_in_rejection_detected(self):
        c = Counter()
        def bad():
            c['judge'] += 1; raise ValueError('bad')
        with self.assertRaisesRegex(ValueError, 'INVALID_INPUT_SCORED_PREFIX'): rejected(bad, 'bad', c)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['self-test', 'boundary', 'run'])
    p.add_argument('--repo', type=Path, default=Path.cwd())
    for name in ('predecessor', 'upstream', 'cache', 'prior', 'output'):
        p.add_argument('--' + name, type=Path)
    args = p.parse_args()
    if args.command == 'self-test':
        res = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
        raise SystemExit(0 if res.wasSuccessful() else 1)
    if args.command == 'boundary':
        boundary(args.repo.resolve()); print('BOUND_V018_ADDITIVE_PREDECESSOR_PASS'); return
    require(all(getattr(args, n) is not None for n in ('predecessor','upstream','cache','prior','output')), 'ALL_PATHS_REQUIRED')
    run(*(getattr(args, n).resolve() for n in ('repo','predecessor','upstream','cache','prior','output')))


if __name__ == '__main__':
    main()
