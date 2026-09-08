"""Explicit model-free adapter for one pinned StateBench test split.

Not an upstream repair, scoring adapter, or model runner. Run only under the v0.15
network/effect guard in the qualified v0.14 selected environment.
"""
from __future__ import annotations

from collections import Counter
import copy
import hashlib
import inspect
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any

PROFILE = 'MATAWAKA_STATEBENCH_EXACT_TEST_MODEL_FREE_V015'
GROUP = 'matawaka_statebench_model_free_v015'
LEAF = 'exact_test_model_free'
TASK = GROUP + '::' + LEAF
UPSTREAM = '1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7'
TASK_DIR = 'statebench-lm-eval/lm_eval/tasks/statebench'
SOURCE_BLOBS = {
    '_default_template.yaml': '63316e2a338534b2758fec290c79b2f6d5993a17',
    'statebench.yaml': '361bb6187e9d2a3dab708a4040a29024f0ccfa33',
    'utils.py': 'd868c2138084cf08a842bdddfc204d556d46ed92',
}
DATA_PATH = 'data/releases/v1.0/test.jsonl'
DATA_SHA = '7df54da79653488bcc2253c9431dc35fd5c2411ec12afe1f22958ed09395a7c9'
ROWS_SHA = 'd69e3b197e613f20099ee7b91975d778d7d89d4d849a235deb5744df87d9e8c1'
DOCS_SHA = '30b756a7eb85db5ceeae843f178c34bff3fa1690c73635160d25ed73cabd78f0'
BPE_SHA = '223921b76ee99bde995b7ff738513eef100fb51d18c93597a113bcffe865b2a7'
BPE_KEY = hashlib.sha1(b'https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken').hexdigest()
DESCRIPTION = ('StateBench measures LLM state correctness over multi-turn conversations. '
               'This task evaluates decision accuracy across all 13 benchmark tracks.\n')
SOURCE_VALUES = {
    'group': 'statebench', 'task': 'statebench', 'dataset_path': 'parslee/statebench',
    'dataset_name': None, 'output_type': 'generate_until', 'test_split': 'test',
    'validation_split': 'validation', 'generation_kwargs': {'max_gen_toks': 256, 'temperature': 0, 'do_sample': False},
    'until': ['\n', '\n\n'], 'metadata': {'version': 1.0},
    'filter_docs': None, 'description': DESCRIPTION,
}
FUNCTION_NAMES = ('process_docs', 'doc_to_text', 'doc_to_target')


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def encode(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def blob(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def regular(path: Path) -> bytes:
    require(path.is_file() and not any(p.is_symlink() for p in (path, *path.parents)), 'NONREGULAR_OR_SYMLINKED_INPUT')
    return path.read_bytes()


def bound_file(path: Path, expected_sha: str, size: int) -> bytes:
    data = regular(path)
    require(len(data) == size and sha(data) == expected_sha, 'EXACT_INPUT_BYTES_REQUIRED')
    return data


def verify_rows(rows: Any) -> None:
    require(type(rows) is list and len(rows) == 209, 'EXACT_209_ROW_LIST_REQUIRED')
    require(len({r['id'] for r in rows}) == 209 and sha(encode(rows)) == ROWS_SHA, 'EXACT_ORDERED_ROWS_REQUIRED')


def verify_documents(docs: Any) -> None:
    require(type(docs) is list and len(docs) == 251, 'EXACT_251_DOCUMENT_LIST_REQUIRED')
    require(all(type(d) is dict and type(d.get('query_idx')) is int for d in docs), 'EXACT_DOCUMENT_TYPES_REQUIRED')
    require(sha(encode(docs)) == DOCS_SHA, 'EXACT_ORDERED_DOCUMENT_BYTES_REQUIRED')


def validate_callback(kwargs: dict[str, Any]) -> None:
    # The public standalone leaf factory adds exactly config_source=inline.
    # Neither model_args nor unbounded paths are accepted.
    require(kwargs == {'adapter_profile': PROFILE, 'config_source': 'inline'}, 'UNDECLARED_CALLBACK_ARGUMENTS')


def validate_source_config(raw: dict[str, Any]) -> None:
    require(set(raw) == set(SOURCE_VALUES) | set(FUNCTION_NAMES) | {'metric_list'}, 'UNEXPECTED_UPSTREAM_CONFIG_KEYS')
    require(encode({k: raw[k] for k in SOURCE_VALUES}) == encode(SOURCE_VALUES), 'UPSTREAM_CONFIG_VALUES_CHANGED')
    require(all(callable(raw[name]) for name in FUNCTION_NAMES), 'UPSTREAM_FUNCTION_REQUIRED')
    metrics = raw['metric_list']
    require(type(metrics) is list and len(metrics) == 1, 'UNEXPECTED_METRIC_CONFIGURATION')
    require(set(metrics[0]) == {'metric', 'aggregation', 'higher_is_better'} and
            callable(metrics[0]['metric']) and metrics[0]['aggregation'] == 'mean' and
            metrics[0]['higher_is_better'] is True, 'UNEXPECTED_METRIC_CONFIGURATION')


def adapt_config(raw: dict[str, Any], loader: Any, processor: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    """Whitelist every change; never pass through arbitrary source/caller keys."""
    validate_source_config(raw)
    generation = copy.deepcopy(raw['generation_kwargs'])
    generation['until'] = list(raw['until'])
    leaf = {
        'task': LEAF, 'dataset_path': None, 'dataset_name': None,
        'custom_dataset': loader, 'process_docs': processor,
        'test_split': 'test', 'validation_split': None, 'training_split': None,
        'fewshot_split': None, 'fewshot_config': {'samples': []}, 'num_fewshot': 0,
        'metric_list': [], 'output_type': raw['output_type'],
        'generation_kwargs': generation, 'description': raw['description'],
        'doc_to_text': raw['doc_to_text'], 'doc_to_target': raw['doc_to_target'],
        'metadata': {'adapter_profile': PROFILE},
    }
    group = {'group': GROUP, 'task': [leaf]}
    delta = {
        'schema': 'matawaka.statebench-model-free-adapter-delta/v0.15', 'profile': PROFILE,
        'source_group': raw['group'], 'source_task': raw['task'], 'adapter_group': GROUP, 'adapter_leaf': TASK,
        'source_values': copy.deepcopy(SOURCE_VALUES),
        'changes': {
            'group_and_leaf_separated': True, 'hub_route_replaced_with_exact_local_callback': True,
            'until_moved_to_generation_kwargs': True, 'only_null_filter_docs_removed': True,
            'validation_disabled_not_aliased_to_test': True, 'training_and_fewshot_disabled': True,
            'metrics_disabled_not_reimplemented': True, 'upstream_list_wrapped_in_dataset': True,
            'metadata_replaced_with_adapter_identity': True,
        },
        'preserved': ['description', 'doc_to_text', 'doc_to_target', 'generation_parameter_values', 'test_split'],
        'construction_route': 'PUBLIC_LEAF_TASKMANAGER_THEN_GROUP_ADD_THEN_TASKMANAGER',
        'full_upstream_configuration_equivalence_claimed': False,
        'request_or_generation_semantics_established': False,
    }
    return group, delta


class ExactTestAdapter:
    """Produce rows from exact raw bytes and call the unchanged upstream processor."""
    def __init__(self, upstream: Path, cache: Path):
        self.upstream, self.cache = upstream.absolute(), cache.absolute()
        self.calls: Counter[str] = Counter()
        self.verify_inputs()
        from lm_eval.tasks._yaml_loader import load_yaml
        self.raw = load_yaml(self.upstream / TASK_DIR / 'statebench.yaml')
        validate_source_config(self.raw)
        functions = [self.raw[n] for n in FUNCTION_NAMES] + [self.raw['metric_list'][0]['metric']]
        require([f.__name__ for f in functions] == [*FUNCTION_NAMES, 'decision_accuracy'], 'WRONG_UPSTREAM_FUNCTION')
        for function in functions:
            require(Path(inspect.getsourcefile(function)).resolve() == (self.upstream / TASK_DIR / 'utils.py').resolve(), 'FUNCTION_SOURCE_NOT_PINNED_PLUGIN')
        self.plugin = sys.modules[self.raw['process_docs'].__module__]
        # TaskFactory deep-copies config dictionaries. Plain function closures
        # preserve this adapter's counters without trying to copy module objects.
        def local_exact_rows(**kwargs):
            return self.load_rows(**kwargs)
        def dataset_wrapped_docs(dataset):
            return self.process_rows(dataset)
        self.spec, self.delta = adapt_config(self.raw, local_exact_rows, dataset_wrapped_docs)

    def construct(self):
        # Keep group structure OUT of TaskConfig; use the documented public APIs.
        # Inline group overrides in the pinned factory were observed to leak the
        # group key into its inline leaf. No upstream factory is patched here.
        from lm_eval.tasks import TaskManager
        from lm_eval.api.group import Group
        require(blob(regular(Path(inspect.getsourcefile(Group)))) == '9f210f883e63d62b59c4f39b6c525d75735ece8f', 'GROUP_API_SOURCE_CHANGED')
        manager = TaskManager(include_defaults=False)
        leaf_config = copy.deepcopy(self.spec['task'][0])
        leaf_config['task'] = TASK
        require('group' not in leaf_config, 'GROUP_KEY_IN_LEAF')
        task = manager.load(leaf_config)['tasks'][TASK]
        group = Group(GROUP, aggregate_metric_list=[])
        group.add(task)
        grouped = manager.load(group)
        require(grouped['tasks'][TASK] is task, 'GROUP_CHANGED_TASK_IDENTITY')
        return grouped

    def verify_inputs(self) -> None:
        head = subprocess.check_output(['git', '-C', str(self.upstream), 'rev-parse', 'HEAD'], text=True).strip()
        require(head == UPSTREAM, 'EXACT_UPSTREAM_COMMIT_REQUIRED')
        for name, expected in SOURCE_BLOBS.items():
            require(blob(regular(self.upstream / TASK_DIR / name)) == expected, 'UPSTREAM_SOURCE_BYTES_CHANGED')
        bound_file(self.upstream / DATA_PATH, DATA_SHA, 638933)
        require(self.cache.is_dir() and not self.cache.is_symlink(), 'EXACT_TOKENIZER_CACHE_REQUIRED')
        require(sorted(p.name for p in self.cache.iterdir()) == [BPE_KEY], 'EXACT_SINGLE_BPE_INPUT_REQUIRED')
        bound_file(self.cache / BPE_KEY, BPE_SHA, 1681126)
        os.environ['TIKTOKEN_CACHE_DIR'] = str(self.cache)

    def load_rows(self, **kwargs: Any) -> Any:
        validate_callback(kwargs)
        self.verify_inputs()
        from datasets import Dataset, DatasetDict
        from statebench.huggingface import load_split_as_rows
        require(blob(regular(Path(inspect.getsourcefile(load_split_as_rows)))) == '514f8a8a25729c12b8efc21b569224717bacba45', 'LOADER_SOURCE_CHANGED')
        rows = load_split_as_rows(self.upstream / DATA_PATH)
        verify_rows(rows)
        dataset = Dataset.from_list(rows)
        verify_rows([dict(row) for row in dataset])
        self.calls['exact_raw_dataset_load'] += 1
        return DatasetDict({'test': dataset})

    def process_rows(self, dataset: Any) -> Any:
        from datasets import Dataset
        require(isinstance(dataset, Dataset), 'INPUT_NOT_HF_DATASET')
        verify_rows([dict(row) for row in dataset])
        self.verify_inputs()
        docs = self.raw['process_docs'](dataset)
        verify_documents(docs)
        wrapped = Dataset.from_list(docs)
        verify_documents([dict(doc) for doc in wrapped])
        self.calls['upstream_processing_and_container_wrap'] += 1
        return wrapped
