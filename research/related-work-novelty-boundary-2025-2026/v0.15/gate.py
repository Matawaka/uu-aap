"""v0.15 model-free Task adapter gate. Original upstream Task stays NONPASS."""
from __future__ import annotations

import argparse
from collections import Counter
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest

BASE = '997df26af32d23a5fe98dc9f89bba0f37dc1b7ca'
TREE = '42efaef1126466e21207429c7494b4e6cb44cea4'
ROOT = 'research/related-work-novelty-boundary-2025-2026'
WF = '.github/workflows/statebench-model-free-adapter-v0.15.yml'
ENV_RESULT = '7c341beee6680a2d743d723e622f1baa6debdd65b946504144adfbcb40f8e3ff'
TRACE = '3685c45f32574313d11bfdaf8d70ced7843ecd236af4de0e6690a14f176806f3'
NON_EFFECTS = {key: False for key in (
    'upstream_source_modified', 'historical_nonpass_promoted', 'dependency_profile_changed',
    'site_packages_patched', 'full_upstream_task_compatible', 'scoring_compatibility_established',
    'full_request_building_established', 'requests_constructed', 'evaluation_dispatched',
    'model_downloaded', 'model_instantiated', 'model_executed', 'provider_api_called',
    'user_credentials_used', 'hub_dataset_loaded', 'scoring_or_judge_called',
    'benchmark_score_established', 'novelty_established', 'production_ready',
    'release_authorized', 'standards_authorized', 'merge_authorized',
)}


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ValueError('MODULE_SPEC_REQUIRED')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


a = load(Path(__file__).with_name('adapter.py'), 'matawaka_v015_adapter')
require, encode, sha, blob = a.require, a.encode, a.sha, a.blob


def git(repo, *args):
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(repo), *args], text=True).strip()


def boundary(repo):
    git(repo, 'merge-base', '--is-ancestor', BASE, 'HEAD')
    require(git(repo, 'rev-parse', f'HEAD:{ROOT}/v0.14') == TREE, 'PREDECESSOR_SUBTREE_CHANGED')
    for line in git(repo, 'diff', '--no-renames', '--name-status', BASE, 'HEAD').splitlines():
        status, path = line.split('\t', 1)
        require(status == 'A' and (path.startswith(ROOT + '/v0.15/') or path == WF), 'PROTECTED_OR_NONADDITIVE_DIFF')
    require(not git(repo, 'diff', '--name-only'), 'TRACKED_WORKTREE_CHANGED')


def no_promotion(result):
    require(result['profile'] == a.PROFILE and result['original_task_compatibility'] == 'NONPASS', 'HISTORY_PROMOTION')
    require(result['non_effects'] == NON_EFFECTS, 'NON_EFFECT_PROMOTION')
    require(result['documents'] == 251 and type(result['documents']) is int, 'COUNT_PROMOTION')


def run(repo, predecessor, upstream, cache, prior, output):
    output.mkdir(parents=True, exist_ok=False)
    result = {'schema': 'matawaka.model-free-task-adapter-result/v0.15', 'status': 'INCONCLUSIVE',
              'profile': a.PROFILE, 'predecessor': BASE, 'non_effects': NON_EFFECTS.copy()}
    stage, failure = 'preflight', None
    attempts, calls, returns = [], Counter(), []
    try:
        boundary(repo)
        require(git(predecessor, 'rev-parse', 'HEAD') == BASE, 'EXACT_PREDECESSOR_WORKTREE_REQUIRED')
        path14 = predecessor / ROOT / 'v0.14/gate.py'
        require(blob(path14.read_bytes()) == '8390dc543e838d1aaea7a3835de3f36a6a8f3650', 'ENVIRONMENT_GATE_CHANGED')
        g14 = load(path14, 'frozen_v014')
        g14.isolated()
        a.bound_file(prior / 'results.json', ENV_RESULT, 2254)
        expected = json.loads(a.bound_file(prior / 'v012/documents.json', a.DOCS_SHA, 393293))
        a.bound_file(prior / 'v013/format-trace.json', TRACE, 64446)
        a.verify_documents(expected)
        mutants = [expected[:-1], expected + [expected[0]], list(reversed(expected)), [expected[0]] * 251]
        changed = copy.deepcopy(expected); changed[0]['query'] += 'MUTATION'; mutants.append(changed)
        changed = copy.deepcopy(expected); changed[0]['query_idx'] = True; mutants.append(changed)
        for mutant in mutants:
            try:
                a.verify_documents(mutant)
            except ValueError:
                continue
            raise ValueError('HOSTILE_DOCUMENT_MUTATION_ACCEPTED')
        require(json.loads((prior / 'v013/results.json').read_bytes())['compatibility'] == 'NONPASS', 'ORIGINAL_NONPASS_REQUIRED')
        path13 = predecessor / ROOT / 'v0.13/gate.py'
        require(blob(path13.read_bytes()) == '713082bcc9c0aae15f6ec8d6106f3cc819beac89', 'REFERENCE_GATE_CHANGED')
        g13 = load(path13, 'frozen_v013')
        plugin_file = str((upstream / a.TASK_DIR / 'utils.py').resolve())
        def denied(*args, **kwargs):
            attempts.append('socket'); raise RuntimeError('NETWORK_DENIED')
        socket.socket.connect = denied
        socket.socket.connect_ex = denied
        socket.socket.sendto = denied
        socket.create_connection = denied
        socket.getaddrinfo = denied
        def profile(frame, event, arg):
            mod, name = frame.f_globals.get('__name__', ''), frame.f_code.co_name
            if event == 'call':
                forbidden = (
                    (mod.startswith('datasets') and name == 'load_dataset')
                    or (mod.startswith('lm_eval.evaluator') and name in {'evaluate', 'simple_evaluate'})
                    or (mod == 'lm_eval.api.task' and name in {'build_all_requests', 'construct_requests', 'process_results', 'apply_filters'})
                    or (mod.startswith('statebench.evaluation') and name in {'create_judge', 'judge', 'extract_decision', 'decisions_match'})
                    or (frame.f_code.co_filename == plugin_file and name in {'get_judge', 'decision_accuracy'})
                    or (mod.startswith('lm_eval.models') and name in {'__init__', 'generate_until', 'loglikelihood'})
                    or (mod.startswith('transformers') and name == 'from_pretrained')
                    or (mod.startswith('statebench.runner') and name in {'run_evaluation', 'evaluate', '_generate_response', '_get_client'})
                    or (mod in {'openai._client', 'anthropic._client'} and name == '__init__')
                )
                if forbidden:
                    attempts.append(mod + '.' + name); raise RuntimeError('FORBIDDEN_EFFECT:' + mod + '.' + name)
            if frame.f_code.co_filename == plugin_file and name == 'process_docs':
                if event == 'call':
                    calls['upstream_process_docs'] += 1
                elif event == 'return' and type(arg) is list:
                    returns.append({'documents': len(arg), 'sha256': sha(encode(arg))})
        sys.setprofile(profile)
        stage = 'public_task_import'
        from lm_eval.tasks import TaskManager
        from datasets import Dataset
        observations, deltas = [], []
        for repeat in range(2):
            stage = 'adapter_construction_' + str(repeat)
            adapter = a.ExactTestAdapter(upstream, cache)
            loaded = TaskManager(include_defaults=False).load(adapter.spec)
            require(sorted(loaded['tasks']) == [a.TASK] and sorted(loaded['groups']) == [a.GROUP], 'GROUP_OR_LEAF_MEMBERSHIP_WRONG')
            require(loaded['group_map'] == {a.GROUP: [a.TASK]}, 'GROUP_MEMBERSHIP_WRONG')
            task = loaded['tasks'][a.TASK]
            require(task.config.metric_list == [] and task.config.num_fewshot == 0, 'SCORING_OR_FEWSHOT_ENABLED')
            require(task.config.dataset_path is None and task.config.validation_split is None and task.config.training_split is None, 'UNBOUNDED_DATA_ROUTE')
            require(task.config.generation_kwargs == {**a.SOURCE_VALUES['generation_kwargs'], 'until': a.SOURCE_VALUES['until']}, 'GENERATION_CONFIG_CHANGED')
            require(task.config.description == a.DESCRIPTION, 'DESCRIPTION_CHANGED')
            require(task.config.doc_to_text is adapter.raw['doc_to_text'] and task.config.doc_to_target is adapter.raw['doc_to_target'], 'FORMATTING_FUNCTION_REPLACED')
            stage = 'document_and_format_fidelity_' + str(repeat)
            initial = task.task_docs  # Materialized during constructor, without a new callback.
            reread = task.eval_docs  # Real second process_docs call, not an adapter cache.
            for dataset in (initial, reread):
                require(isinstance(dataset, Dataset), 'TASK_DOCUMENTS_NOT_DATASET')
                a.verify_documents([dict(doc) for doc in dataset])
            require(sorted(task.features) == sorted(expected[0]), 'FEATURE_MISMATCH')
            trace = []
            for i, (doc, reference) in enumerate(zip(initial, expected)):
                prompt, target = task.doc_to_text(doc), task.doc_to_target(doc)
                require(prompt == g13.reference_prompt(reference) == adapter.raw['doc_to_text'](reference), 'PROMPT_CHANGED')
                require(target == reference['expected_decision'] == adapter.raw['doc_to_target'](reference), 'TARGET_CHANGED')
                trace.append({'index': i, 'timeline_id': doc['timeline_id'], 'query_idx': doc['query_idx'],
                              'prompt_sha256': sha(prompt.encode()), 'target_sha256': sha(target.encode())})
            require(sha(encode(trace)) == TRACE, 'FORMAT_TRACE_CHANGED')
            require(dict(adapter.calls) == {'exact_raw_dataset_load': 1, 'upstream_processing_and_container_wrap': 2}, 'UNEXPECTED_ADAPTER_CALL_COUNTS')
            require(adapter.plugin._judge is None, 'JUDGE_INITIALIZED')
            adapter.verify_inputs()
            observations.append({'groups': [a.GROUP], 'tasks': [a.TASK], 'group_map': loaded['group_map'],
                'calls': dict(adapter.calls), 'documents': 251, 'documents_sha256': a.DOCS_SHA,
                'format_trace_sha256': TRACE, 'features': sorted(task.features), 'second_eval_docs_equal': True})
            deltas.append(adapter.delta)
        require(encode(observations[0]) == encode(observations[1]) and encode(deltas[0]) == encode(deltas[1]), 'FRESH_ADAPTER_REPEAT_DRIFT')
        require(calls['upstream_process_docs'] == 4 and returns == [{'documents': 251, 'sha256': a.DOCS_SHA}] * 4, 'ACTUAL_UPSTREAM_CALL_EVIDENCE_MISMATCH')
        require(not attempts, 'FORBIDDEN_EFFECT_ATTEMPT')
        sys.setprofile(None)
        boundary(repo)
        (output / 'documents.json').write_bytes(encode([dict(doc) for doc in initial]))
        (output / 'format-trace.json').write_bytes(encode(trace))
        (output / 'config-delta.json').write_bytes(encode(deltas[0]))
        result.update(status='MODEL_FREE_TASK_ADAPTER_EXECUTED_PASS', original_task_compatibility='NONPASS',
                      documents=251, document_sha256=a.DOCS_SHA, format_trace_sha256=TRACE,
                      config_delta_sha256=sha(encode(deltas[0])), constructor_and_reread=observations[0],
                      fresh_adapter_repetitions=2, hostile_exact_document_mutations_rejected=6, actual_upstream_processing_calls=4,
                      upstream_processing_returns=returns, forbidden_effect_attempts=[],
                      environment_result_sha256=ENV_RESULT,
                      qualification_scope='NAMED_ADAPTER_TASK_CONSTRUCTION_AND_DOC_FORMATTING_ONLY')
        no_promotion(result)
    except Exception as exc:
        failure = exc
        result.update(status='ADAPTER_INCONCLUSIVE_OR_NONPASS', failure_stage=stage,
                      failure_type=type(exc).__name__, failure_detail=str(exc)[:1500], forbidden_effect_attempts=attempts)
    finally:
        sys.setprofile(None)
    data = encode(result)
    (output / 'results.json').write_bytes(data)
    print(data.decode(), end='')
    print('RESULT_SHA256=' + sha(data))
    if failure is not None:
        raise SystemExit(1)


class Hostile(unittest.TestCase):
    def fixture(self):
        f = lambda *args, **kwargs: None
        return {**copy.deepcopy(a.SOURCE_VALUES), **{n: f for n in a.FUNCTION_NAMES},
                'metric_list': [{'metric': f, 'aggregation': 'mean', 'higher_is_better': True}]}
    def test_valid_source_and_delta(self):
        raw = self.fixture(); group, delta = a.adapt_config(raw, lambda: None, lambda x: x)
        self.assertEqual(group['task'][0]['metric_list'], [])
        self.assertEqual(group['task'][0]['generation_kwargs']['until'], ['\n', '\n\n'])
        self.assertNotIn('until', group['task'][0]); self.assertNotIn('filter_docs', group['task'][0])
        self.assertFalse(delta['full_upstream_configuration_equivalence_claimed'])
        a.validate_source_config(raw)
    def test_callable_identity_survives_factory_copy(self):
        loader = lambda **kwargs: None
        processor = lambda dataset: dataset
        group, _ = a.adapt_config(self.fixture(), loader, processor)
        copied = copy.deepcopy(group)
        self.assertIs(copied['task'][0]['custom_dataset'], loader)
        self.assertIs(copied['task'][0]['process_docs'], processor)
    def test_unknown_key(self):
        raw = self.fixture(); raw['model_args'] = 'unexpected'
        with self.assertRaises(ValueError): a.validate_source_config(raw)
    def test_missing_key(self):
        raw = self.fixture(); del raw['filter_docs']
        with self.assertRaises(ValueError): a.validate_source_config(raw)
    def test_changed_modes(self):
        for key, value in [('dataset_path', 'other'), ('filter_docs', 'filter'), ('test_split', 'train'),
                           ('validation_split', 'test'), ('output_type', 'loglikelihood'), ('until', ['STOP']), ('group', 'other')]:
            raw = self.fixture(); raw[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): a.validate_source_config(raw)
    def test_generation_bool_not_number(self):
        raw = self.fixture(); raw['generation_kwargs']['max_gen_toks'] = True
        with self.assertRaises(ValueError): a.validate_source_config(raw)
    def test_noncallable(self):
        raw = self.fixture(); raw['process_docs'] = 'eval'
        with self.assertRaises(ValueError): a.validate_source_config(raw)
    def test_metric_drift(self):
        raw = self.fixture(); raw['metric_list'] = []
        with self.assertRaises(ValueError): a.validate_source_config(raw)
    def test_callback_exact(self):
        a.validate_callback({'adapter_profile': a.PROFILE})
    def test_callback_injection(self):
        for kwargs in ({}, {'adapter_profile': a.PROFILE, 'model_args': 'x'}, {'adapter_profile': 'other'}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError): a.validate_callback(kwargs)
    def test_document_wrong_container(self):
        with self.assertRaises(ValueError): a.verify_documents(tuple([{}] * 251))
    def test_document_dropped(self):
        with self.assertRaises(ValueError): a.verify_documents([{}] * 250)
    def test_document_boolean_index(self):
        with self.assertRaises(ValueError): a.verify_documents([{'query_idx': True}] * 251)
    def test_document_wrong_bytes(self):
        with self.assertRaises(ValueError): a.verify_documents([{'query_idx': 0}] * 251)
    def test_rows_dropped(self):
        with self.assertRaises(ValueError): a.verify_rows([])
    def test_rows_duplicate(self):
        with self.assertRaises(ValueError): a.verify_rows([{'id': 'a'}] * 209)
    def test_wrong_file_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'file'; path.write_bytes(b'bad')
            with self.assertRaises(ValueError): a.bound_file(path, sha(b'good'), 4)
    def test_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'file'; path.write_bytes(b'a'); link = Path(tmp) / 'link'; link.symlink_to(path)
            with self.assertRaises(ValueError): a.bound_file(link, sha(b'a'), 1)
    def test_history_promotion(self):
        with self.assertRaises(ValueError): no_promotion({'profile': a.PROFILE, 'original_task_compatibility': 'PASS'})
    def test_non_effect_promotion(self):
        result = {'profile': a.PROFILE, 'original_task_compatibility': 'NONPASS', 'documents': 251, 'non_effects': NON_EFFECTS.copy()}
        no_promotion(result)
        for key in NON_EFFECTS:
            mutant = copy.deepcopy(result); mutant['non_effects'][key] = True
            with self.subTest(key=key), self.assertRaises(ValueError): no_promotion(mutant)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['self-test', 'boundary', 'run'])
    p.add_argument('--repo', type=Path, default=Path.cwd())
    for name in ['predecessor', 'upstream', 'cache', 'prior', 'output']:
        p.add_argument('--' + name, type=Path)
    args = p.parse_args()
    if args.command == 'self-test':
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Hostile))
        raise SystemExit(0 if result.wasSuccessful() else 1)
    if args.command == 'boundary':
        boundary(args.repo); print('V015_PREDECESSOR_AND_ADDITIVE_BOUNDARY_PASS'); return
    require(all(getattr(args, key) is not None for key in ['predecessor', 'upstream', 'cache', 'prior', 'output']), 'EXACT_RUNTIME_PATHS_REQUIRED')
    run(args.repo.resolve(), args.predecessor.resolve(), args.upstream.resolve(), args.cache.resolve(), args.prior.resolve(), args.output.resolve())


if __name__ == '__main__':
    main()
