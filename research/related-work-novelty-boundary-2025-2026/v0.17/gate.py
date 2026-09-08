"""Synthetic response-to-scoring audit. Completed audit != scoring compatibility."""
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
from typing import Any

BASE = 'a5fd76f8d0c21359edd8ec60c22456484db9c240'
TREE = '3950d8778ec8812e21941cd12fbde2d2773ab3bd'
ROOT = 'research/related-work-novelty-boundary-2025-2026'
WF = '.github/workflows/statebench-scoring-contract-v0.17.yml'
PROFILE = 'MATAWAKA_SYNTHETIC_RESPONSE_SCORING_AUDIT_V017'
MARKER = 'MATAWAKA_SYNTHETIC_RESPONSE_V017'
DIAGNOSTIC_TASK = 'matawaka_statebench_original_metric_diagnostic_v017'
DOCS = '30b756a7eb85db5ceeae843f178c34bff3fa1690c73635160d25ed73cabd78f0'
PREVIOUS_RESULT = 'fbee1820bd69778462ca8ea74d91f9ea28a0d547a4e7921af05c881538186d5b'
REQUESTS = '05740117ac6a6b139d51882873f99eafa0373c6874eb00c7871ee8772bbc36be'
ADAPTER = '2bbcc1d996b5b0586371894027153b3765e98c7c'
ENV_GATE = '8390dc543e838d1aaea7a3835de3f36a6a8f3650'
STATEBENCH_SOURCES = {
    'evaluation/__init__.py': 'f8bfa0e42b3bfc9ea6066c70963d0b9ea3e80ab3',
    'evaluation/judge.py': 'aac5ce3c9cf301fe0150e45eedb48379773e9130',
    'evaluation/rubric.py': '3fbeb680f0bb899fc208e1754f1d67cb9d93611a',
    'evaluation/metrics.py': 'b4be7173bbcc166a9cdedb569858b152aab5c962',
    'evaluation/phrase_quality.py': '1053fefedccf21122eb4cf60e5892b72f857739b',
    'schema/timeline.py': '6dd5849aa4ad22c37cf68a73606eab8155c7f1c1',
}
LM_SOURCES = {
    'api/task.py': '9255170de444bae6edd53797e3477031cd5d5da5',
    'config/task.py': 'c3a3b712be912789370d18f2abc89d7439dcf1a7',
}
CASES = [
    {'id': 'synthetic_yes_yes', 'response': 'yes', 'expected': 'yes', 'correct': True},
    {'id': 'synthetic_no_yes', 'response': 'no', 'expected': 'yes', 'correct': False},
    {'id': 'synthetic_no_no', 'response': 'no', 'expected': 'no', 'correct': True},
    {'id': 'synthetic_yes_no', 'response': 'yes', 'expected': 'no', 'correct': False},
]
CONTRACT = {
    'schema': 'matawaka.synthetic-scoring-audit-contract/v0.17', 'profile': PROFILE,
    'predecessor': BASE, 'response_origin': 'HAND_AUTHORED_SYNTHETIC_NOT_MODEL_OUTPUT',
    'response_marker': MARKER, 'documents': 251, 'fresh_repetitions': 2,
    'diagnostic_task': DIAGNOSTIC_TASK, 'native_controls': CASES,
    'cardinality_probes': ['empty_both', 'empty_predictions_one_reference', 'one_prediction_empty_references'],
    'expected_scoring_compatibility': 'NONPASS',
    'expected_native_control_booleans': [True, False, True, False],
    'model_or_provider_authorized': False, 'merge_authorized': False,
}
NON_EFFECTS = {key: False for key in (
    'model_generated_responses', 'model_downloaded', 'model_instantiated', 'model_executed',
    'provider_api_called', 'user_credentials_used', 'hub_dataset_loaded',
    'llm_judge_called', 'evaluation_dispatched', 'request_cache_used', 'filters_applied',
    'upstream_source_modified', 'old_adapter_modified', 'dependency_profile_changed',
    'site_packages_patched', 'scoring_adapter_implemented', 'original_metric_compatible',
    'full_upstream_task_compatible', 'full_native_judge_semantics_established',
    'historical_nonpass_promoted', 'aggregate_benchmark_score_established',
    'model_performance_established', 'novelty_established', 'production_ready',
    'release_authorized', 'standards_authorized', 'merge_authorized',
)}
EFFECTS = {'synthetic_responses_used': True, 'task_process_results_called': True,
           'upstream_metric_attempted': True, 'deterministic_judge_controls_executed': True}


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise ValueError(reason)


def encode(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def blob(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def bound(path: Path, digest: str) -> bytes:
    require(path.is_file() and not path.is_symlink(), 'REGULAR_FILE_REQUIRED:' + path.name)
    data = path.read_bytes()
    require(sha(data) == digest, 'EXACT_BYTES_REQUIRED:' + path.name)
    return data


def exact(actual: Any, expected: Any) -> None:
    require(encode(actual) == encode(expected), 'TYPED_CONTENT_MISMATCH')


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, 'MODULE_REQUIRED')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(repo), *args], text=True).strip()


def boundary(repo: Path) -> None:
    git(repo, 'merge-base', '--is-ancestor', BASE, 'HEAD')
    require(git(repo, 'rev-parse', f'HEAD:{ROOT}/v0.16') == TREE, 'PREDECESSOR_TREE_CHANGED')
    for line in git(repo, 'diff', '--no-renames', '--name-status', BASE, 'HEAD').splitlines():
        status, name = line.split('\t', 1)
        require(status == 'A' and (name.startswith(ROOT + '/v0.17/') or name == WF), 'NON_ADDITIVE_OR_PROTECTED_DIFF')
    require(not git(repo, 'diff', '--name-only'), 'TRACKED_WORKTREE_CHANGED')
    exact(json.loads((repo / ROOT / 'v0.17/audit-contract.json').read_bytes()), CONTRACT)


def exception_record(exc: BaseException) -> dict:
    chain, seen = [], set()
    while exc is not None and id(exc) not in seen:
        seen.add(id(exc))
        frames, tb = [], exc.__traceback__
        while tb is not None:
            frame = tb.tb_frame
            module = frame.f_globals.get('__name__', '')
            filename = frame.f_code.co_filename.replace('\\', '/')
            if '/lm_eval/' in filename:
                frames.append({'file': 'lm_eval/' + filename.rsplit('/lm_eval/', 1)[1],
                               'function': frame.f_code.co_name, 'line': tb.tb_lineno})
            elif module.startswith('statebench.'):
                frames.append({'file': module.replace('.', '/') + '.py',
                               'function': frame.f_code.co_name, 'line': tb.tb_lineno})
            tb = tb.tb_next
        chain.append({'type': type(exc).__name__, 'message': str(exc), 'upstream_frames': frames})
        exc = exc.__cause__ if exc.__cause__ is not None else exc.__context__
    return {'chain': chain}


def expect_error(fn, kind: str) -> dict:
    try:
        value = fn()
    except Exception as exc:
        record = exception_record(exc)
        chain = record['chain']
        if kind == 'task_metric':
            require(type(exc) is TypeError and 'references' in str(exc) and 'required positional argument' in str(exc), 'UNEXPECTED_TASK_METRIC_EXCEPTION:' + str(exc))
            require(any(e['type'] == 'TypeError' and 'string indices' in e['message'] for e in chain[1:]), 'ORIGINAL_REFERENCE_TYPE_ERROR_NOT_RETAINED')
            require(any(f['file'].endswith('statebench/utils.py') for e in chain[1:] for f in e['upstream_frames']), 'ORIGINAL_PLUGIN_ERROR_FRAME_MISSING')
        else:
            require(type(exc) is AttributeError and 'extract_decision' in str(exc) and 'ResponseJudge' in str(exc), 'UNEXPECTED_DIRECT_METRIC_EXCEPTION:' + str(exc))
            require(any(f['file'].endswith('statebench/utils.py') for f in chain[0]['upstream_frames']), 'PLUGIN_JUDGE_ERROR_FRAME_MISSING')
        return record
    raise ValueError('EXPECTED_SCORING_NONPASS_NOT_OBSERVED:' + repr(value))


def forbidden(module: str, name: str, local: dict) -> bool:
    if module.startswith('statebench.evaluation'):
        if name == 'create_judge':
            return local.get('use_llm') is not False
        if name == '__init__' and type(local.get('self')).__name__ == 'ResponseJudge':
            return local.get('use_llm_judge') is not False
        if name in {'_complete', '_get_openai_client', '_get_anthropic_client', '_llm_extract_decision', '_llm_check_paraphrase'}:
            return True
    return ((module.startswith('datasets') and name == 'load_dataset')
            or (module.startswith('lm_eval.evaluator') and name in {'evaluate', 'simple_evaluate'})
            or (module == 'lm_eval.api.task' and name in {'build_all_requests', 'construct_requests', 'apply_filters'})
            or (module == 'lm_eval.api.group' and name == 'aggregate')
            or (module.startswith('lm_eval.models') and name in {'__init__', 'generate_until', 'loglikelihood'})
            or (module.startswith('transformers') and name in {'from_pretrained', 'generate'})
            or (module.startswith('statebench.runner') and name in {'run_evaluation', 'evaluate', '_generate_response', '_get_client', 'car_complete'})
            or (module in {'openai._client', 'anthropic._client'} and name == '__init__')
            or (module == 'lm_eval.caching.cache' and name in {'load_from_cache', 'save_to_cache', 'delete_cache'}))


def no_promotion(result: dict) -> None:
    require(result['profile'] == PROFILE and result['scoring_compatibility'] == 'NONPASS', 'SCORING_STATUS_PROMOTION')
    exact(result['non_effects'], NON_EFFECTS)
    exact(result['effects'], EFFECTS)


def run(repo: Path, predecessor: Path, upstream: Path, cache: Path, prior: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=False)
    stage, failure = 'preflight', None
    result = {'schema': 'matawaka.synthetic-scoring-audit-result/v0.17', 'profile': PROFILE,
              'status': 'INCONCLUSIVE', 'predecessor': BASE, 'non_effects': NON_EFFECTS.copy()}
    attempts, calls, metric_inputs = [], Counter(), []
    try:
        boundary(repo)
        require(git(predecessor, 'rev-parse', 'HEAD') == BASE, 'EXACT_PREDECESSOR_REQUIRED')
        ap = predecessor / ROOT / 'v0.15/adapter.py'
        require(blob(ap.read_bytes()) == ADAPTER, 'FROZEN_ADAPTER_CHANGED')
        a = load(ap, 'adapter_v015_for_v017')
        ep = predecessor / ROOT / 'v0.14/gate.py'
        require(blob(ep.read_bytes()) == ENV_GATE, 'FROZEN_ENVIRONMENT_GATE_CHANGED')
        load(ep, 'env_v014_for_v017').isolated()
        require(not os.environ.get('STATEBENCH_JUDGE'), 'UNDECLARED_JUDGE_ENVIRONMENT_OVERRIDE')
        old = json.loads(bound(prior / 'results.json', PREVIOUS_RESULT))
        require(old['original_task_compatibility'] == 'NONPASS', 'HISTORICAL_NONPASS_CHANGED')
        bound(prior / 'requests.json', REQUESTS)
        expected_docs = json.loads(bound(prior / 'predecessor/documents.json', DOCS))
        a.verify_documents(expected_docs)
        lm_root = Path(sysconfig.get_path('purelib')) / 'lm_eval'
        sb_spec = importlib.util.find_spec('statebench')
        require(sb_spec is not None and sb_spec.origin is not None, 'STATEBENCH_SOURCE_MISSING')
        sb_root = Path(sb_spec.origin).parent
        for root, files in [(lm_root, LM_SOURCES), (sb_root, STATEBENCH_SOURCES)]:
            for name, digest in files.items():
                require(blob((root / name).read_bytes()) == digest, 'SCORING_SOURCE_CHANGED:' + name)
        plugin_path = str((upstream / a.TASK_DIR / 'utils.py').resolve())
        def denied(*args, **kwargs):
            attempts.append('socket'); raise RuntimeError('NETWORK_DENIED')
        socket.socket.connect = denied
        socket.socket.connect_ex = denied
        socket.socket.sendto = denied
        socket.create_connection = denied
        socket.getaddrinfo = denied
        def profile(frame, event, arg):
            if event != 'call':
                return
            module, name = frame.f_globals.get('__name__', ''), frame.f_code.co_name
            local = frame.f_locals
            if forbidden(module, name, local):
                attempts.append(module + '.' + name); raise RuntimeError('FORBIDDEN_SCORING_AUDIT_EFFECT:' + module + '.' + name)
            if module == 'lm_eval.api.task' and name == 'process_results':
                calls['task_process_results'] += 1
            if module == 'statebench.evaluation.judge' and name in {'create_judge', 'judge'}:
                calls[name] += 1
            if frame.f_code.co_filename == plugin_path and name in {'decision_accuracy', 'process_docs', 'get_judge'}:
                calls['plugin_' + name] += 1
                if name == 'decision_accuracy':
                    refs, preds = local['references'], local['predictions']
                    metric_inputs.append({'predictions': copy.deepcopy(preds),
                                          'reference_types': [type(r).__name__ for r in refs],
                                          'string_references': copy.deepcopy(refs) if all(type(r) is str for r in refs) else None})
        sys.setprofile(profile)
        from lm_eval.tasks import TaskManager
        from statebench.evaluation import create_judge
        from statebench.schema.timeline import GroundTruth
        repetitions = []
        for repetition in range(2):
            stage = 'adapter_construction_' + str(repetition)
            adapter = a.ExactTestAdapter(upstream, cache)
            task = adapter.construct()['tasks'][a.TASK]
            docs = [dict(d) for d in task.task_docs]
            a.verify_documents(docs)
            exact(docs, expected_docs)
            require(task.config.metric_list == [] and task._metric_fn_list == {}, 'HISTORICAL_ADAPTER_SCORING_NOT_DISABLED')
            original_config = copy.deepcopy(adapter.spec['task'][0])
            diagnostic_config = copy.deepcopy(original_config)
            diagnostic_config['task'] = DIAGNOSTIC_TASK
            diagnostic_config['metric_list'] = copy.deepcopy(adapter.raw['metric_list'])
            # Changes are transient diagnostic configuration, not an adapter repair.
            for key in original_config:
                if key not in {'task', 'metric_list'}:
                    require(diagnostic_config[key] == original_config[key], 'UNDECLARED_DIAGNOSTIC_CONFIG_CHANGE')
            diagnostic = TaskManager(include_defaults=False).load(diagnostic_config)['tasks'][DIAGNOSTIC_TASK]
            exact([dict(d) for d in diagnostic.task_docs], docs)
            require(set(diagnostic._metric_fn_list) == {'decision_accuracy'}, 'ORIGINAL_METRIC_NOT_REGISTERED')
            before = calls.copy()
            stage = 'disabled_adapter_' + str(repetition)
            empty = [task.process_results(doc, [MARKER]) for doc in docs]
            exact(empty, [{} for _ in docs])
            require(calls['plugin_decision_accuracy'] == before['plugin_decision_accuracy'], 'DISABLED_PATH_CALLED_METRIC')
            trace = []
            stage = 'task_metric_' + str(repetition)
            for i, doc in enumerate(docs):
                start = len(metric_inputs)
                error = expect_error(lambda: diagnostic.process_results(doc, [MARKER]), 'task_metric')
                inputs = metric_inputs[start:]
                exact(inputs, [{'predictions': [MARKER], 'reference_types': ['str'], 'string_references': [doc['expected_decision']]}])
                trace.append({'document_id': i, 'timeline_id': doc['timeline_id'], 'query_idx': doc['query_idx'],
                              'document_sha256': sha(encode(doc)), 'response_origin': 'SYNTHETIC',
                              'disabled_result': empty[i], 'task_metric_inputs': inputs, 'task_metric_error': error})
            stage = 'direct_metric_' + str(repetition)
            for doc, entry in zip(docs, trace):
                entry['document_reference_metric_error'] = expect_error(
                    lambda: adapter.plugin.decision_accuracy(predictions=[MARKER], references=[doc]), 'direct_metric')
            judge = adapter.plugin.get_judge()
            judge_api = {'class': type(judge).__name__, 'descriptor': judge.descriptor,
                         'extract_decision_method_exists': callable(getattr(judge, 'extract_decision', None)),
                         'decisions_match_method_exists': callable(getattr(judge, 'decisions_match', None)),
                         'judge_method_exists': callable(getattr(judge, 'judge', None)),
                         'use_llm_judge': judge.use_llm_judge}
            exact(judge_api, {'class': 'ResponseJudge', 'descriptor': 'deterministic-only',
                             'extract_decision_method_exists': False, 'decisions_match_method_exists': False,
                             'judge_method_exists': True, 'use_llm_judge': False})
            require(judge._openai_client is None and judge._anthropic_client is None, 'PROVIDER_CLIENT_CREATED')
            cardinality = []
            cases = [('empty_both', [], []), ('empty_predictions_one_reference', [], [docs[0]]),
                     ('one_prediction_empty_references', [MARKER], [])]
            for name, predictions, references in cases:
                value = adapter.plugin.decision_accuracy(predictions=predictions, references=references)
                require(type(value) is float and value == 0.0, 'UNEXPECTED_CARDINALITY_OBSERVATION')
                cardinality.append({'case': name, 'predictions': len(predictions), 'references': len(references),
                                    'observed_return': value, 'interpretation': 'NO_INPUT_CARDINALITY_REJECTION_NOT_BENCHMARK_SCORE'})
            stage = 'native_judge_controls_' + str(repetition)
            native = create_judge(use_llm=False)
            controls = []
            for case in CASES:
                gt = GroundTruth(decision=case['expected'], decision_type='binary', must_mention=[], must_not_mention=[])
                actual = native.judge(response=case['response'], ground_truth=gt, timeline_id=case['id'],
                                      query_idx=0, track='supersession', domain='synthetic-control')
                require(type(actual.decision_correct) is bool and actual.decision_correct is case['correct'], 'NATIVE_CONTROL_BOOLEAN_MISMATCH')
                require(actual.actual_decision == case['response'], 'NATIVE_CONTROL_EXTRACTION_MISMATCH')
                require(actual.response == case['response'] and actual.timeline_id == case['id'], 'NATIVE_CONTROL_BINDING_MISMATCH')
                controls.append({'origin': 'FULLY_SYNTHETIC_CONTROL', 'case': case, 'result': asdict(actual)})
            require(native.descriptor == 'deterministic-only' and native.use_llm_judge is False, 'LLM_JUDGE_NOT_DISABLED')
            require(native._openai_client is None and native._anthropic_client is None, 'CONTROL_PROVIDER_CLIENT_CREATED')
            delta = {k: calls[k] - before[k] for k in ('task_process_results', 'plugin_decision_accuracy', 'judge')}
            exact(delta, {'task_process_results': 502, 'plugin_decision_accuracy': 505, 'judge': 4})
            exact([dict(d) for d in task.task_docs], expected_docs)
            exact([dict(d) for d in diagnostic.task_docs], expected_docs)
            require(task.config.metric_list == [] and task._metric_fn_list == {}, 'OLD_ADAPTER_SCORING_MUTATED')
            adapter.verify_inputs()
            repetitions.append({'documents': trace, 'judge_api': judge_api, 'cardinality': cardinality,
                                'native_controls': controls, 'audited_calls': delta})
        exact(repetitions[0], repetitions[1])
        require(not attempts, 'FORBIDDEN_EFFECT_ATTEMPTED')
        for root, files in [(lm_root, LM_SOURCES), (sb_root, STATEBENCH_SOURCES)]:
            for name, digest in files.items():
                require(blob((root / name).read_bytes()) == digest, 'SCORING_SOURCE_MUTATED')
        evidence = repetitions[0]
        (output / 'scoring-trace.json').write_bytes(encode(evidence))
        result.update(status='SYNTHETIC_SCORING_CONTRACT_AUDIT_EXECUTED_NONPASS', audit_execution='COMPLETED',
                      scoring_compatibility='NONPASS', original_task_compatibility='NONPASS',
                      effects=EFFECTS, response_origin=CONTRACT['response_origin'], contract_sha256=sha(encode(CONTRACT)),
                      source_blobs={'statebench': STATEBENCH_SOURCES, 'lm_eval': LM_SOURCES},
                      prior_result_sha256=PREVIOUS_RESULT, document_sha256=DOCS, requests_sha256=REQUESTS,
                      documents_per_repetition=251, repetitions=2, repetitions_identical=True,
                      adapter_default='SCORING_DISABLED_EMPTY_DICTIONARIES',
                      task_metric='STRING_REFERENCE_TYPE_ERROR_THEN_MISSING_REFERENCE_FALLBACK_ARGUMENT',
                      direct_metric='RESPONSEJUDGE_EXTRACT_DECISION_METHOD_ABSENT', judge_api=evidence['judge_api'],
                      cardinality_probes=evidence['cardinality'], native_control_booleans=[c['result']['decision_correct'] for c in evidence['native_controls']],
                      actual_calls=dict(sorted(calls.items())), scoring_trace_sha256=sha(encode(evidence)),
                      forbidden_effect_attempts=attempts)
        no_promotion(result)
    except Exception as exc:
        failure = exc
        result.update(status='INCONCLUSIVE', stage=stage, failure=exception_record(exc),
                      forbidden_effect_attempts=attempts, actual_calls=dict(sorted(calls.items())))
    finally:
        sys.setprofile(None)
    data = encode(result)
    (output / 'results.json').write_bytes(data)
    print(data.decode(), end='')
    print('RESULT_SHA256=' + sha(data))
    if failure is not None:
        raise SystemExit(1)


class Tests(unittest.TestCase):
    def test_typed_equal(self): exact({'correct': False}, {'correct': False})
    def test_bool_not_int(self):
        with self.assertRaises(ValueError): exact({'correct': False}, {'correct': 0})
    def test_nonpass_not_pass(self):
        with self.assertRaises(ValueError): exact('NONPASS', 'PASS')
    def test_order(self):
        with self.assertRaises(ValueError): exact(['yes', 'no'], ['no', 'yes'])
    def test_cardinality(self):
        with self.assertRaises(ValueError): exact([{}], [{}, {}])
    def test_reference_shape(self):
        with self.assertRaises(ValueError): exact(['yes'], [{'expected_decision': 'yes'}])
    def test_provider_blocked(self):
        self.assertTrue(forbidden('openai._client', '__init__', {}))
    def test_llm_judge_blocked(self):
        self.assertTrue(forbidden('statebench.evaluation.judge', 'create_judge', {'use_llm': True}))
    def test_deterministic_judge_allowed(self):
        self.assertFalse(forbidden('statebench.evaluation.judge', 'create_judge', {'use_llm': False}))
    def test_dispatch_and_cache_blocked(self):
        for module, name in [('lm_eval.evaluator', 'evaluate'), ('lm_eval.caching.cache', 'load_from_cache'),
                             ('lm_eval.api.task', 'apply_filters'), ('statebench.evaluation.judge', '_complete')]:
            with self.subTest(module=module, name=name): self.assertTrue(forbidden(module, name, {}))
    def test_all_non_effects(self):
        self.assertTrue(all(v is False for v in NON_EFFECTS.values()))
    def test_control_inputs(self):
        self.assertEqual([c['correct'] for c in CASES], [True, False, True, False])
    def test_effect_promotion(self):
        fixture = {'profile': PROFILE, 'scoring_compatibility': 'NONPASS', 'effects': EFFECTS, 'non_effects': NON_EFFECTS}
        no_promotion(fixture)
        for key in NON_EFFECTS:
            mutant = copy.deepcopy(fixture); mutant['non_effects'][key] = True
            with self.subTest(key=key), self.assertRaises(ValueError): no_promotion(mutant)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['self-test', 'boundary', 'run'])
    p.add_argument('--repo', type=Path, default=Path.cwd())
    for arg in ('predecessor', 'upstream', 'cache', 'prior', 'output'):
        p.add_argument('--' + arg, type=Path)
    args = p.parse_args()
    if args.command == 'self-test':
        r = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
        raise SystemExit(0 if r.wasSuccessful() else 1)
    if args.command == 'boundary':
        boundary(args.repo.resolve()); print('V017_EXACT_PREDECESSOR_ADDITIVE_BOUNDARY_PASS'); return
    require(all(getattr(args, name) is not None for name in ('predecessor', 'upstream', 'cache', 'prior', 'output')), 'EXPLICIT_PATHS_REQUIRED')
    run(args.repo.resolve(), args.predecessor.resolve(), args.upstream.resolve(), args.cache.resolve(), args.prior.resolve(), args.output.resolve())


if __name__ == '__main__':
    main()
