"""Bound singleton response/filter bridge. No model, evaluator, or upstream repair.

Sequential research code, not a security boundary against arbitrary same-process
code. Native filter failures may leave partial writes; no rollback is claimed.
"""
from __future__ import annotations

import copy
from functools import partial
import hashlib
import json
from typing import Any

PROFILE = 'MATAWAKA_SINGLE_RESPONSE_FILTER_BRIDGE_V019'
ORIGIN = 'HAND_AUTHORED_SYNTHETIC_NOT_MODEL_OUTPUT'
COUNT = 251
FILTER = 'none'


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise ValueError(reason)


def encode(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def equal(a: Any, b: Any) -> None:
    require(encode(a) == encode(b), 'TYPED_CONTENT_MISMATCH')


def response(sequence: int) -> str:
    require(type(sequence) is int and 0 <= sequence < COUNT, 'RESPONSE_SEQUENCE_REQUIRED')
    return f'MATAWAKA_SYNTHETIC_RESPONSE_V019:{sequence:03d}'


def check_raw(raw: Any, expected: str) -> None:
    require(type(raw) is list and len(raw) == 1 and type(raw[0]) is str, 'SINGLE_STRING_RESPONSE_REQUIRED')
    require(raw[0] == expected, 'RAW_RESPONSE_BINDING_MISMATCH')


def check_filtered(value: Any, expected: str | None) -> None:
    require(type(value) is dict, 'FILTERED_DICTIONARY_REQUIRED')
    if expected is None:
        require(value == {}, 'PREEXISTING_FILTERED_RESPONSE')
    else:
        require(set(value) == {FILTER} and type(value[FILTER]) is str, 'EXACT_FILTER_OUTPUT_REQUIRED')
        require(value[FILTER] == expected, 'FILTER_OUTPUT_BINDING_MISMATCH')


def snapshot(inst: Any) -> dict:
    from lm_eval.api.instance import Instance
    require(type(inst) is Instance, 'REAL_INSTANCE_REQUIRED')
    require(type(inst.arguments) is tuple and len(inst.arguments) == 2, 'REQUEST_ARGUMENT_TUPLE_REQUIRED')
    require(type(inst.arguments[0]) is str and type(inst.arguments[1]) is dict, 'REQUEST_ARGUMENT_TYPES_REQUIRED')
    require(type(inst.metadata) is tuple and len(inst.metadata) == 3, 'REQUEST_METADATA_TUPLE_REQUIRED')
    require(type(inst.metadata[0]) is str and all(type(x) is int for x in inst.metadata[1:]), 'REQUEST_METADATA_TYPES_REQUIRED')
    require(all(type(getattr(inst, k)) is int for k in ('idx', 'doc_id', 'repeats')), 'REQUEST_INTEGER_TYPES_REQUIRED')
    row = copy.deepcopy(vars(inst))
    row['arguments'], row['metadata'] = list(row['arguments']), list(row['metadata'])
    return row


def check_pipeline(task: Any) -> None:
    from lm_eval.api.filter import FilterEnsemble
    from lm_eval.filters.selection import TakeFirstFilter
    require(type(task._filters) is list and len(task._filters) == 1, 'SINGLE_DEFAULT_PIPELINE_REQUIRED')
    pipeline = task._filters[0]
    require(type(pipeline) is FilterEnsemble and pipeline.name == FILTER, 'EXACT_PIPELINE_NAME_REQUIRED')
    require(type(pipeline.filters) is list and len(pipeline.filters) == 1, 'SINGLE_FILTER_COMPONENT_REQUIRED')
    factory = pipeline.filters[0]
    require(type(factory) is partial and factory.func is TakeFirstFilter and factory.args == () and factory.keywords == {}, 'EXACT_TAKE_FIRST_FACTORY_REQUIRED')
    require(task.config.repeats == 1 and type(task.config.repeats) is int, 'ONE_REPEAT_REQUIRED')
    require(task.config.filter_list is None, 'UNDECLARED_FILTER_CONFIG')


class BoundResponseFilterBridge:
    """Admit all input, call real Task.apply_filters, validate all output, then score.

    Input/precheck failures do not mutate the state. Once native filtering starts,
    any failure is terminal. An invalid filtered collection never reaches scoring.
    """
    def __init__(self, task: Any, documents: list[dict], requests: list[dict], scorer_module: Any):
        scorer_module.bind_inputs(documents, requests)
        self.task, self.scorer_module = task, scorer_module
        self._docs = encode(documents)
        self._requests = encode(requests)
        self._items: bytes | None = None
        self.state = 'FRESH'
        require(type(task.instances) is list and len(task.instances) == COUNT, 'EXACT_INSTANCE_COUNT_REQUIRED')
        self._objects = tuple(task.instances)
        require(len({id(x) for x in self._objects}) == COUNT, 'UNIQUE_INSTANCE_OBJECTS_REQUIRED')
        self._check('EMPTY')

    def _check(self, mode: str) -> list[dict]:
        check_pipeline(self.task)
        instances, expected = self.task.instances, json.loads(self._requests)
        require(type(instances) is list and len(instances) == COUNT, 'EXACT_INSTANCE_COUNT_REQUIRED')
        rows = []
        raw_ids, filtered_ids = [], []
        for i, inst in enumerate(instances):
            require(inst is self._objects[i], 'INSTANCE_IDENTITY_OR_ORDER_CHANGED')
            row = snapshot(inst)
            if mode == 'EMPTY':
                require(type(inst.resps) is list and inst.resps == [], 'INITIAL_RESPONSE_NOT_EMPTY')
            else:
                check_raw(inst.resps, response(i))
            check_filtered(inst.filtered_resps, response(i) if mode == 'FILTERED' else None)
            raw_ids.append(id(inst.resps)); filtered_ids.append(id(inst.filtered_resps))
            base = copy.deepcopy(row)
            base['resps'], base['filtered_resps'] = [], {}
            equal(base, expected[i])
            rows.append(row)
        require(len(set(raw_ids)) == COUNT and len(set(filtered_ids)) == COUNT, 'SHARED_RESPONSE_CONTAINERS')
        return rows

    def attach(self, items: Any) -> None:
        require(self.state == 'FRESH', 'ATTACH_REQUIRES_FRESH_BRIDGE')
        self._check('EMPTY')
        docs, requests = json.loads(self._docs), json.loads(self._requests)
        checked = self.scorer_module.validate_envelopes(items, docs, requests)
        from statebench.schema.timeline import GroundTruth
        for i, (doc, item) in enumerate(zip(docs, checked, strict=True)):
            require(item['response_origin'] == ORIGIN and item['response'] == response(i), 'FIXED_SYNTHETIC_RESPONSE_REQUIRED')
            gt = GroundTruth.model_validate_json(doc['ground_truth_json'])
            require(gt.model_dump_json() == doc['ground_truth_json'], 'GROUND_TRUTH_ROUNDTRIP_MISMATCH')
            require(gt.decision == doc['expected_decision'] and gt.decision_type == doc['decision_type'], 'GROUND_TRUTH_VIEW_MISMATCH')
        # No partial attachment before all envelopes and ground truth pass.
        for inst, item in zip(self.task.instances, checked, strict=True):
            inst.resps.append(item['response'])
        self._items = encode(checked)
        self.state = 'LOADED'

    def apply(self) -> list[dict]:
        require(self.state == 'LOADED', 'FILTER_REQUIRES_LOADED_BRIDGE')
        self._check('LOADED')
        self.state = 'FILTERING'
        try:
            self.task.apply_filters()
            rows = self._check('FILTERED')
            self.state = 'FILTERED'
            return rows
        except BaseException:
            self.state = 'FAILED'
            raise

    def score(self, scorer: Any) -> dict:
        require(self.state == 'FILTERED', 'SCORING_REQUIRES_FILTERED_BRIDGE')
        rows = self._check('FILTERED')
        docs, requests = json.loads(self._docs), json.loads(self._requests)
        # Read actual filtered values; never substitute frozen or expected output.
        items = [self.scorer_module.envelope(docs[i], requests[i], i, row['filtered_resps'][FILTER]) for i, row in enumerate(rows)]
        equal(items, json.loads(self._items))
        self.scorer_module.validate_envelopes(items, docs, requests)
        self.state = 'SCORING'
        try:
            batch = scorer.score_batch(items)
            self._check('FILTERED')
            self.state = 'COMPLETE'
            return {'profile': PROFILE, 'status': 'COMPLETE_SINGLE_RESPONSE_FILTER_BRIDGE',
                    'response_origin': ORIGIN, 'filter': {'name': FILTER, 'components': ['take_first']},
                    'request_records_sha256': sha(self._requests), 'documents_sha256': sha(self._docs),
                    'response_envelopes_sha256': sha(self._items), 'filtered_instances_sha256': sha(encode(rows)),
                    'scoring_batch': batch, 'aggregate_computed': False, 'authentication_established': False}
        except BaseException:
            self.state = 'FAILED'
            raise
