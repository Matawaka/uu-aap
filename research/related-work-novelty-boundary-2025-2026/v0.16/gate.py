"""Exact plain-text request construction, never model dispatch or scoring."""
from __future__ import annotations

import argparse
from collections import Counter
import copy
from dataclasses import fields, is_dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import sys
import sysconfig
import unittest
from typing import Any

BASE = '4b4a7959b6821fa93c31ef2ba2e015b415d5ada9'
TREE = 'c9d6fc3dc8b54e68fc707cd8ec4abb5f57960a39'
ROOT = 'research/related-work-novelty-boundary-2025-2026'
WF = '.github/workflows/statebench-request-construction-v0.16.yml'
ADAPTER = '2bbcc1d996b5b0586371894027153b3765e98c7c'
PREVIOUS_RESULT = 'f83a8be7bb64ed2b8950641c44c7944cbc317f776c1683a043b739168f1605f6'
DOCS = '30b756a7eb85db5ceeae843f178c34bff3fa1690c73635160d25ed73cabd78f0'
FORMAT = '3685c45f32574313d11bfdaf8d70ced7843ecd236af4de0e6690a14f176806f3'
PROFILE = 'MATAWAKA_STATEBENCH_EXACT_PLAIN_REQUESTS_V016'
TASK_NAME = 'matawaka_statebench_model_free_v015::exact_test_model_free'
DESCRIPTION = ('StateBench measures LLM state correctness over multi-turn conversations. '
               'This task evaluates decision accuracy across all 13 benchmark tracks.\n')
FLAGS = dict(limit=None, samples=None, rank=0, world_size=1, cache_requests=False,
             rewrite_requests_cache=False, system_instruction=None, apply_chat_template=False,
             fewshot_as_multiturn=False, chat_template=None, tokenizer_name='')
GENERATION = dict(max_gen_toks=256, temperature=0.0, do_sample=False, until=['\n', '\n\n'])
SOURCES = {'api/task.py': '9255170de444bae6edd53797e3477031cd5d5da5',
           'api/instance.py': 'd3c6afa0644e729ba441728c72a2469fdad07b8f',
           'api/utils.py': 'e38f5f67839633b211219fdd1f1a3ea55ab84fed',
           'utils.py': '602d5c8ced4ded447691dd1a86879340e91b6c69',
           'caching/cache.py': 'ce289cbf472307b0ae8082b52483661422170c71'}
NON_EFFECTS = {key: False for key in (
    'upstream_source_modified', 'adapter_modified', 'dependency_profile_changed',
    'historical_nonpass_promoted', 'full_upstream_task_compatible', 'site_packages_patched',
    'request_cache_used', 'request_cache_written', 'chat_template_applied',
    'system_instruction_added', 'fewshot_examples_used', 'model_context_limit_verified',
    'evaluation_dispatched', 'model_downloaded', 'model_instantiated', 'model_executed',
    'provider_api_called', 'user_credentials_used', 'hub_dataset_loaded',
    'scoring_or_judge_called', 'filters_applied', 'scoring_compatibility_established',
    'benchmark_score_established', 'novelty_established', 'production_ready',
    'release_authorized', 'standards_authorized', 'merge_authorized')}


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise ValueError(reason)


def encode(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n').encode()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def blob(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def bound(path: Path, digest: str) -> bytes:
    require(path.is_file() and not path.is_symlink(), 'REGULAR_EVIDENCE_REQUIRED:' + path.name)
    data = path.read_bytes()
    require(sha(data) == digest, 'EXACT_BYTES_REQUIRED:' + path.name)
    return data


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, 'MODULE_SPEC_REQUIRED')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(repo), *args], text=True).strip()


def boundary(repo: Path) -> None:
    git(repo, 'merge-base', '--is-ancestor', BASE, 'HEAD')
    require(git(repo, 'rev-parse', f'HEAD:{ROOT}/v0.15') == TREE, 'PREDECESSOR_TREE_CHANGED')
    for line in git(repo, 'diff', '--no-renames', '--name-status', BASE, 'HEAD').splitlines():
        status, path = line.split('\t', 1)
        require(status == 'A' and (path.startswith(ROOT + '/v0.16/') or path == WF), 'PROTECTED_OR_NONADDITIVE_DIFF')
    require(not git(repo, 'diff', '--name-only'), 'TRACKED_WORKTREE_CHANGED')


def configuration_snapshot(value: Any) -> tuple:
    """In-process equality only; callable identities never enter durable results."""
    if callable(value):
        return ('callable', id(value))
    if is_dataclass(value):
        return ('dataclass', type(value).__qualname__, tuple((f.name, configuration_snapshot(getattr(value, f.name))) for f in fields(value)))
    if isinstance(value, dict):
        return ('dict', tuple((k, configuration_snapshot(v)) for k, v in sorted(value.items())))
    if isinstance(value, (list, tuple)):
        return (type(value).__name__, tuple(configuration_snapshot(v) for v in value))
    require(value is None or type(value) in (str, int, float, bool), 'UNSUPPORTED_CONFIG_VALUE_TYPE')
    return (type(value).__name__, value)


def reference_prompt(doc: dict) -> str:
    # Independent of upstream formatting/request methods; no target appended.
    return ('Here is the conversation history and relevant context:\n\n' + doc['context']
            + '\n\n---\n\nBased on the above context, please answer the following question:\n\n'
            + doc['query'] + '\n\nAnswer:')


def reference_requests(docs: list[dict]) -> list[dict]:
    return [dict(request_type='generate_until', doc=copy.deepcopy(doc),
                 arguments=[DESCRIPTION + reference_prompt(doc), copy.deepcopy(GENERATION)],
                 idx=0, metadata=[TASK_NAME, i, 1], resps=[], filtered_resps={},
                 task_name=TASK_NAME, doc_id=i, repeats=1) for i, doc in enumerate(docs)]


def validate_flags(flags: dict) -> None:
    require(encode(flags) == encode(FLAGS), 'UNDECLARED_REQUEST_BUILD_MODE')


def validate_trace(actual: Any, expected: list[dict]) -> None:
    require(type(actual) is list and len(actual) == len(expected) and len(actual) > 0, 'REQUEST_COUNT_OR_CONTAINER_MISMATCH')
    for i, (got, wanted) in enumerate(zip(actual, expected)):
        require(type(got) is dict and set(got) == set(wanted), 'REQUEST_FIELDS_MISMATCH')
        for key in ('idx', 'doc_id', 'repeats'):
            require(type(got[key]) is int, 'REQUEST_INTEGER_TYPE_MISMATCH')
        require(encode(got) == encode(wanted), 'REQUEST_CONTENT_MISMATCH:' + str(i))


def snapshots(instances: Any, cls: type, expected: list[dict]) -> list[dict]:
    require(type(instances) is list and len(instances) == len(expected), 'INSTANCE_COUNT_MISMATCH')
    rows = []
    for inst in instances:
        require(type(inst) is cls, 'REAL_UPSTREAM_INSTANCE_REQUIRED')
        require(type(inst.arguments) is tuple and len(inst.arguments) == 2, 'ARGUMENT_TUPLE_REQUIRED')
        require(type(inst.arguments[0]) is str and type(inst.arguments[1]) is dict, 'ARGUMENT_TYPES_REQUIRED')
        require(type(inst.metadata) is tuple, 'METADATA_TUPLE_REQUIRED')
        row = copy.deepcopy(vars(inst))
        row['arguments'] = list(row['arguments'])
        row['metadata'] = list(row['metadata'])
        rows.append(row)
    validate_trace(rows, expected)
    return rows


def guarded_call(module: str, name: str, local: dict, plugin: bool = False) -> bool:
    return ((module.startswith('datasets') and name == 'load_dataset')
        or (module.startswith('lm_eval.evaluator') and name in {'evaluate', 'simple_evaluate'})
        or (module == 'lm_eval.api.task' and name in {'process_results', 'apply_filters'})
        or (module == 'lm_eval.api.group' and name == 'aggregate')
        or (module.startswith('lm_eval.models') and name in {'__init__', 'generate_until', 'loglikelihood'})
        or (module.startswith('transformers') and name == 'from_pretrained')
        or (module.startswith('statebench.evaluation') and name in {'create_judge', 'judge', 'extract_decision', 'decisions_match'})
        or (module.startswith('statebench.runner') and name in {'run_evaluation', 'evaluate', '_generate_response', '_get_client'})
        or (module in {'openai._client', 'anthropic._client'} and name == '__init__')
        or (plugin and name in {'get_judge', 'decision_accuracy'})
        or (module == 'lm_eval.caching.cache' and (name in {'save_to_cache', 'delete_cache'}
            or (name == 'load_from_cache' and local.get('cache') is not False))))


def no_promotion(result: dict) -> None:
    require(result['profile'] == PROFILE and result['original_task_compatibility'] == 'NONPASS', 'TASK_STATUS_PROMOTION')
    require(result['non_effects'] == NON_EFFECTS, 'NON_EFFECT_PROMOTION')
    require(result['effects'] == {'plain_request_objects_constructed': True}, 'EFFECT_SCOPE_CHANGED')


def run(repo: Path, predecessor: Path, upstream: Path, cache: Path, prior: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=False)
    result = dict(schema='matawaka.plain-request-construction-result/v0.16', profile=PROFILE,
                  predecessor=BASE, status='INCONCLUSIVE', non_effects=NON_EFFECTS.copy())
    stage, failure = 'preflight', None
    attempts: list[str] = []
    counts: Counter = Counter()
    try:
        boundary(repo)
        require(git(predecessor, 'rev-parse', 'HEAD') == BASE, 'EXACT_PREDECESSOR_WORKTREE_REQUIRED')
        p = predecessor / ROOT / 'v0.15/adapter.py'
        require(blob(p.read_bytes()) == ADAPTER, 'QUALIFIED_ADAPTER_CHANGED')
        a = load(p, 'frozen_adapter_v015_for_v016')
        p14 = predecessor / ROOT / 'v0.14/gate.py'
        require(blob(p14.read_bytes()) == '8390dc543e838d1aaea7a3835de3f36a6a8f3650', 'ENV_GATE_CHANGED')
        load(p14, 'frozen_environment_v014_for_v016').isolated()
        old = json.loads(bound(prior / 'results.json', PREVIOUS_RESULT))
        require(old['original_task_compatibility'] == 'NONPASS', 'HISTORICAL_NONPASS_REQUIRED')
        docs = json.loads(bound(prior / 'documents.json', DOCS))
        a.verify_documents(docs)
        bound(prior / 'format-trace.json', FORMAT)
        expected = reference_requests(docs)
        contract = json.loads((Path(__file__).with_name('request-contract.json')).read_bytes())
        require(contract['profile'] == PROFILE and contract['flags'] == FLAGS, 'CONTRACT_PROFILE_MISMATCH')
        require(contract['expected_requests_sha256'] == sha(encode(expected)), 'PREDECLARED_REQUEST_ORACLE_MISMATCH')
        validate_flags(FLAGS)
        purelib = Path(sysconfig.get_path('purelib')) / 'lm_eval'
        for name, expected_blob in SOURCES.items():
            require(blob((purelib / name).read_bytes()) == expected_blob, 'REQUEST_SOURCE_CHANGED:' + name)
        plugin_path = str((upstream / a.TASK_DIR / 'utils.py').resolve())
        def denied(*args, **kwargs):
            attempts.append('socket'); raise RuntimeError('NETWORK_DENIED')
        socket.socket.connect = denied
        socket.socket.connect_ex = denied
        socket.socket.sendto = denied
        socket.create_connection = denied
        socket.getaddrinfo = denied
        def observer(frame, event, arg):
            if event != 'call':
                return
            mod, name = frame.f_globals.get('__name__', ''), frame.f_code.co_name
            plugin = frame.f_code.co_filename == plugin_path
            if guarded_call(mod, name, frame.f_locals, plugin):
                attempts.append(mod + '.' + name); raise RuntimeError('FORBIDDEN_EFFECT:' + mod + '.' + name)
            if mod == 'lm_eval.api.task' and name in {'build_all_requests', 'construct_requests', 'fewshot_context'}:
                counts[name] += 1
            if mod == 'lm_eval.api.instance' and name == '__post_init__':
                counts['instance_initializations'] += 1
            if mod == 'lm_eval.caching.cache' and name == 'load_from_cache':
                counts['disabled_cache_reads'] += 1
            if plugin and name == 'process_docs':
                counts['upstream_process_docs'] += 1
        sys.setprofile(observer)
        stage = 'request_imports'
        from lm_eval.api.instance import Instance
        from lm_eval.api.task import Task, ConfigurableTask
        from lm_eval.tasks import TaskManager
        from lm_eval import utils
        require(utils.env.keep_trailing_newline is True, 'TRAILING_NEWLINE_SEMANTICS_CHANGED')
        traces, old_instances, adapters = [], [], []
        for repetition in range(2):
            stage = 'adapter_construction_' + str(repetition)
            adapter = a.ExactTestAdapter(upstream, cache)
            adapters.append(adapter)
            loaded = adapter.construct()
            require(list(loaded['tasks']) == [TASK_NAME] and loaded['group_map'] == {a.GROUP: [TASK_NAME]}, 'WRONG_TASK_MEMBERSHIP')
            task = loaded['tasks'][TASK_NAME]
            require(task.build_all_requests.__func__ is Task.build_all_requests and task.construct_requests.__func__ is ConfigurableTask.construct_requests, 'UPSTREAM_REQUEST_METHOD_REPLACED')
            require(task.config.metric_list == [] and task.config.num_fewshot == 0 and task.config.repeats == 1, 'TASK_MODE_CHANGED')
            require(task.config.gen_prefix is None and task.config.doc_to_choice is None, 'PREFIX_OR_CHOICES_ADDED')
            require(task.config.description == DESCRIPTION, 'DESCRIPTION_CHANGED')
            require(encode(task.config.generation_kwargs) == encode(GENERATION), 'GENERATION_CHANGED')
            require(task.config.doc_to_text is adapter.raw['doc_to_text'] and task.config.doc_to_target is adapter.raw['doc_to_target'], 'FORMAT_METHOD_REPLACED')
            config_before = configuration_snapshot(task.config)
            require(sha(encode([dict(x) for x in task.task_docs])) == DOCS, 'TASK_DOCS_CHANGED')
            for build in range(2 if repetition == 0 else 1):
                stage = 'build_requests_' + str(len(traces))
                task.build_all_requests(**copy.deepcopy(FLAGS))
                instances = task.instances
                trace = snapshots(instances, Instance, expected)
                require(not any(instances is prev for prev in old_instances), 'REBUILD_REUSED_LIST')
                require(not any(id(x) in {id(v) for prev in old_instances for v in prev} for x in instances), 'REBUILD_REUSED_INSTANCE')
                old_instances.append(instances)
                kw_ids = {id(inst.arguments[1]) for inst in instances}
                until_ids = {id(inst.arguments[1]['until']) for inst in instances}
                require(len(kw_ids) == len(until_ids) == 251, 'SHARED_GENERATION_MUTABLES')
                require(id(task.config.generation_kwargs) not in kw_ids and id(task.config.generation_kwargs['until']) not in until_ids, 'GENERATION_ALIASES_TASK_CONFIG')
                require(configuration_snapshot(task.config) == config_before, 'REQUEST_BUILD_MUTATED_CONFIG')
                require(sha(encode([dict(x) for x in task.task_docs])) == DOCS, 'REQUEST_BUILD_MUTATED_TASK_DOCS')
                traces.append(trace)
            require(adapter.plugin._judge is None, 'JUDGE_INITIALIZED')
            adapter.verify_inputs()
        require(all(encode(t) == encode(traces[0]) for t in traces), 'REBUILD_OR_FRESH_ADAPTER_DIFFERS')
        expected_counts = dict(build_all_requests=3, construct_requests=753, fewshot_context=753,
                               instance_initializations=753, disabled_cache_reads=3, upstream_process_docs=5)
        require(dict(counts) == expected_counts, 'ACTUAL_UPSTREAM_CALL_COUNTS:' + repr(dict(counts)))
        require([dict(x.calls) for x in adapters] == [dict(exact_raw_dataset_load=1, upstream_processing_and_container_wrap=3),
                                                     dict(exact_raw_dataset_load=1, upstream_processing_and_container_wrap=2)], 'ADAPTER_CALL_COUNTS_CHANGED')
        require(not attempts, 'FORBIDDEN_EFFECT_ATTEMPT')
        for name, expected_blob in SOURCES.items():
            require(blob((purelib / name).read_bytes()) == expected_blob, 'REQUEST_SOURCE_MUTATED')
        request_data = encode(traces[0])
        (output / 'requests.json').write_bytes(request_data)
        context_trace = [dict(index=i, timeline_id=d['timeline_id'], query_idx=d['query_idx'],
                              request_context_sha256=sha(row['arguments'][0].encode()),
                              doc_prompt_sha256=sha(reference_prompt(d).encode())) for i, (row, d) in enumerate(zip(traces[0], docs))]
        (output / 'context-trace.json').write_bytes(encode(context_trace))
        result.update(status='MODEL_FREE_PLAIN_REQUEST_CONSTRUCTION_EXECUTED_PASS',
            qualification_scope='NAMED_ADAPTER_ZERO_SHOT_PLAIN_REQUEST_CONTENT_ONLY',
            requests=251, builds=3, actual_calls=dict(counts),
            requests_sha256=sha(request_data), context_trace_sha256=sha(encode(context_trace)),
            document_sha256=DOCS, v015_format_trace_sha256=FORMAT, v015_result_sha256=PREVIOUS_RESULT,
            request_contract_sha256=sha(encode(contract)), source_blobs=SOURCES,
            description=dict(source_sha256=sha(DESCRIPTION.encode()), preserved_final_newline=True,
                             combination='DESCRIPTION_PLUS_DOC_PROMPT_WITH_NO_EXTRA_SEPARATOR', target_answer_appended=False),
            generation_arguments=GENERATION, build_flags=FLAGS, same_task_rebuild_identical=True,
            fresh_adapter_build_identical=True, config_and_documents_unchanged=True,
            generation_mutables_independent=True, all_response_fields_empty=True,
            original_task_compatibility='NONPASS', effects={'plain_request_objects_constructed': True},
            forbidden_effect_attempts=[])
        no_promotion(result)
    except Exception as exc:
        failure = exc
        result.update(status='INCONCLUSIVE_OR_NONPASS', failure_stage=stage, failure_type=type(exc).__name__,
                      failure_detail=str(exc)[:1800], actual_calls=dict(counts), forbidden_effect_attempts=attempts)
    finally:
        sys.setprofile(None)
    data = encode(result)
    (output / 'results.json').write_bytes(data)
    print(data.decode(), end=''); print('RESULT_SHA256=' + sha(data))
    if failure is not None:
        raise SystemExit(1)


class Hostile(unittest.TestCase):
    def test_configuration_snapshot_with_nested_callables(self):
        from dataclasses import dataclass
        @dataclass
        class Config:
            nested: dict
        f, h = lambda: None, lambda: None
        c = Config({'nested': [f], 'count': 1})
        self.assertEqual(configuration_snapshot(c), configuration_snapshot(copy.deepcopy(c)))
        before = configuration_snapshot(c)
        c.nested['nested'][0] = h
        self.assertNotEqual(before, configuration_snapshot(c))
        self.assertNotEqual(configuration_snapshot(True), configuration_snapshot(1))
        with self.assertRaises(ValueError): configuration_snapshot(object())
    def fixture(self):
        return reference_requests([dict(context='History', query='Question', expected_decision='SECRET', query_idx=0)])
    def test_reference_excludes_answer(self):
        self.assertNotIn('SECRET', self.fixture()[0]['arguments'][0])
        self.assertTrue(self.fixture()[0]['arguments'][0].startswith(DESCRIPTION))
    def test_valid_request(self):
        r = self.fixture(); validate_trace(copy.deepcopy(r), r)
    def test_count_order_and_container_mutations(self):
        r = self.fixture() * 2; r[1] = copy.deepcopy(r[1]); r[1]['doc_id'] = 1
        for mutant in ([], r[:1], r + r[:1], list(reversed(r)), tuple(r)):
            with self.subTest(mutant=type(mutant)), self.assertRaises(ValueError): validate_trace(mutant, r)
    def test_request_field_mutations(self):
        r = self.fixture()
        for key, value in [('idx', True), ('doc_id', True), ('repeats', 2), ('request_type', 'loglikelihood'),
                           ('metadata', ['other', 0, 1]), ('task_name', 'other'), ('resps', ['answer']), ('filtered_resps', {'x': 'answer'})]:
            m = copy.deepcopy(r); m[0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): validate_trace(m, r)
    def test_missing_or_extra_field(self):
        for add in (True, False):
            r = self.fixture(); m = copy.deepcopy(r)
            if add: m[0]['extra'] = True
            else: del m[0]['resps']
            with self.assertRaises(ValueError): validate_trace(m, r)
    def test_context_mutations(self):
        r = self.fixture()
        for ctx in (reference_prompt(r[0]['doc']), DESCRIPTION.rstrip() + reference_prompt(r[0]['doc']), r[0]['arguments'][0] + 'SECRET'):
            m = copy.deepcopy(r); m[0]['arguments'][0] = ctx
            with self.assertRaises(ValueError): validate_trace(m, r)
    def test_generation_mutations(self):
        r = self.fixture()
        for key, value in [('until', '\n'), ('until', ['\n\n', '\n']), ('max_gen_toks', True), ('temperature', 0), ('do_sample', True), ('extra', 1)]:
            m = copy.deepcopy(r); m[0]['arguments'][1][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): validate_trace(m, r)
    def test_source_document_mutation(self):
        r = self.fixture(); m = copy.deepcopy(r); m[0]['doc']['query'] = 'Changed'
        with self.assertRaises(ValueError): validate_trace(m, r)
    def test_all_scope_flags(self):
        validate_flags(FLAGS)
        mutations = dict(limit=1, samples=[0], rank=1, world_size=2, cache_requests=True, rewrite_requests_cache=True,
                         system_instruction='Other', apply_chat_template=True, fewshot_as_multiturn=True,
                         chat_template='Other', tokenizer_name='Model')
        for key, value in mutations.items():
            f = copy.deepcopy(FLAGS); f[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): validate_flags(f)
    def test_flag_bool_not_int(self):
        f = copy.deepcopy(FLAGS); f['rank'] = False
        with self.assertRaises(ValueError): validate_flags(f)
    def test_dispatch_and_cache_guard(self):
        for module, name, args, plugin in [('lm_eval.models.huggingface', 'generate_until', {}, False),
            ('lm_eval.evaluator', 'evaluate', {}, False), ('lm_eval.api.task', 'process_results', {}, False),
            ('lm_eval.api.task', 'apply_filters', {}, False), ('lm_eval.caching.cache', 'save_to_cache', {}, False),
            ('lm_eval.caching.cache', 'load_from_cache', {'cache': True}, False), ('datasets.load', 'load_dataset', {}, False),
            ('plugin', 'get_judge', {}, True), ('openai._client', '__init__', {}, False), ('transformers.models.auto', 'from_pretrained', {}, False)]:
            self.assertTrue(guarded_call(module, name, args, plugin))
        self.assertFalse(guarded_call('lm_eval.caching.cache', 'load_from_cache', {'cache': False}))
        self.assertFalse(guarded_call('lm_eval.api.task', 'construct_requests', {}))
    def test_no_status_or_authority_promotion(self):
        r = dict(profile=PROFILE, original_task_compatibility='NONPASS', non_effects=copy.deepcopy(NON_EFFECTS), effects={'plain_request_objects_constructed': True})
        no_promotion(r)
        for key in NON_EFFECTS:
            m = copy.deepcopy(r); m['non_effects'][key] = True
            with self.subTest(key=key), self.assertRaises(ValueError): no_promotion(m)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['self-test', 'boundary', 'run'])
    p.add_argument('--repo', type=Path, default=Path.cwd())
    for name in ('predecessor', 'upstream', 'cache', 'prior', 'output'):
        p.add_argument('--' + name, type=Path)
    args = p.parse_args()
    if args.command == 'self-test':
        r = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Hostile))
        raise SystemExit(0 if r.wasSuccessful() else 1)
    if args.command == 'boundary':
        boundary(args.repo); print('V016_FROZEN_PREDECESSOR_AND_ADDITIVE_SCOPE_PASS'); return
    require(all(getattr(args, n) is not None for n in ('predecessor','upstream','cache','prior','output')), 'EXPLICIT_PATHS_REQUIRED')
    run(*[getattr(args, n).resolve() for n in ('repo','predecessor','upstream','cache','prior','output')])


if __name__ == '__main__':
    main()
