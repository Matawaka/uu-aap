"""Synthetic-only full-document scoring bridge; no evaluator or model backend.

Use inside the v0.18 isolated gate. Hashes bind bytes; they are not authentication.
The original plugin metric and previous named adapter are never patched.
"""
from __future__ import annotations

import copy
from dataclasses import asdict
import hashlib
import json
from typing import Any

PROFILE = 'MATAWAKA_BOUND_SYNTHETIC_SCORING_V018'
TASK = 'matawaka_bound_synthetic_scoring_v018'
ORIGIN = 'HAND_AUTHORED_SYNTHETIC_NOT_MODEL_OUTPUT'
MARKER = 'MATAWAKA_SYNTHETIC_RESPONSE_V018'
METRIC = 'matawaka_synthetic_decision_correct_v018'
DOCS_SHA = '30b756a7eb85db5ceeae843f178c34bff3fa1690c73635160d25ed73cabd78f0'
REQUESTS_SHA = '05740117ac6a6b139d51882873f99eafa0373c6874eb00c7871ee8772bbc36be'
COUNT = 251
ENVELOPE_KEYS = {'sequence', 'timeline_id', 'query_idx', 'document_sha256',
                 'request_sha256', 'response', 'response_sha256', 'response_origin'}


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise ValueError(reason)


def encode(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n').encode('utf-8')


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def equal(left: Any, right: Any) -> None:
    require(encode(left) == encode(right), 'TYPED_CONTENT_MISMATCH')


def bind_inputs(documents: Any, requests: Any) -> None:
    require(type(documents) is list and len(documents) == COUNT, 'EXACT_DOCUMENT_COUNT_REQUIRED')
    require(type(requests) is list and len(requests) == COUNT, 'EXACT_REQUEST_COUNT_REQUIRED')
    require(sha(encode(documents)) == DOCS_SHA, 'EXACT_ORDERED_DOCUMENTS_REQUIRED')
    require(sha(encode(requests)) == REQUESTS_SHA, 'EXACT_ORDERED_REQUESTS_REQUIRED')
    ids = []
    for i, (doc, req) in enumerate(zip(documents, requests, strict=True)):
        require(type(doc) is dict and type(doc['query_idx']) is int, 'DOCUMENT_TYPE_REQUIRED')
        require(type(req['doc_id']) is int and req['doc_id'] == i, 'REQUEST_INDEX_REQUIRED')
        equal(doc, req['doc'])
        ids.append((doc['timeline_id'], doc['query_idx']))
    require(len(set(ids)) == COUNT, 'UNIQUE_QUERY_IDENTITIES_REQUIRED')


def envelope(doc: dict, req: dict, sequence: int, response: str) -> dict:
    require(type(response) is str and bool(response.strip()), 'NONEMPTY_RESPONSE_STRING_REQUIRED')
    return {'sequence': sequence, 'timeline_id': doc['timeline_id'], 'query_idx': doc['query_idx'],
            'document_sha256': sha(encode(doc)), 'request_sha256': sha(encode(req)),
            'response': response, 'response_sha256': sha(response.encode('utf-8')), 'response_origin': ORIGIN}


def validate_envelopes(envelopes: Any, documents: list[dict], requests: list[dict]) -> list[dict]:
    """Validate the entire ordered batch without invoking any judge or callback."""
    bind_inputs(documents, requests)
    require(type(envelopes) is list and len(envelopes) == COUNT, 'EXACT_RESPONSE_CARDINALITY_REQUIRED')
    checked = []
    for i in range(COUNT):
        item, doc, req = envelopes[i], documents[i], requests[i]
        require(type(item) is dict and set(item) == ENVELOPE_KEYS, 'EXACT_ENVELOPE_FIELDS_REQUIRED')
        require(type(item['sequence']) is int and type(item['query_idx']) is int, 'INTEGER_BINDING_FIELDS_REQUIRED')
        require(all(type(item[k]) is str for k in ENVELOPE_KEYS - {'sequence', 'query_idx'}), 'STRING_BINDING_FIELDS_REQUIRED')
        require(bool(item['response'].strip()) and len(item['response'].encode('utf-8')) <= 65536, 'BOUNDED_NONEMPTY_RESPONSE_REQUIRED')
        equal(item, envelope(doc, req, i, item['response']))
        checked.append(copy.deepcopy(item))
    return checked


def native_result(judge: Any, doc: dict, response: str, ground_truth: Any) -> dict:
    """Use the existing public interface, preserving every returned native field."""
    require(judge.use_llm_judge is False and judge.descriptor == 'deterministic-only', 'DETERMINISTIC_JUDGE_REQUIRED')
    require(judge._openai_client is None and judge._anthropic_client is None, 'PROVIDER_CLIENT_FORBIDDEN')
    require(type(response) is str and bool(response.strip()), 'NONEMPTY_RESPONSE_STRING_REQUIRED')
    result = asdict(judge.judge(response=response, ground_truth=ground_truth,
                              timeline_id=doc['timeline_id'], query_idx=doc['query_idx'],
                              track=doc['track'], domain=doc['domain']))
    equal({k: result[k] for k in ('timeline_id', 'query_idx', 'track', 'domain')},
          {k: doc[k] for k in ('timeline_id', 'query_idx', 'track', 'domain')})
    require(result['response'] == response and result['expected_decision'] == ground_truth.decision,
            'NATIVE_RESULT_BINDING_MISMATCH')
    require(type(result['decision_correct']) is bool, 'NATIVE_BOOLEAN_REQUIRED')
    require(judge._openai_client is None and judge._anthropic_client is None, 'PROVIDER_CLIENT_CREATED')
    return result


class BoundSyntheticScorer:
    """Single-use, whole-batch admission and ordered full-doc Task callback.

    A runtime exception may occur after local judge calls; no rollback is claimed.
    No completed ledger is returned unless every admitted record was processed.
    """
    def __init__(self, documents: list[dict], requests: list[dict]):
        bind_inputs(documents, requests)
        self._documents_bytes = encode(documents)
        self._requests_bytes = encode(requests)
        self.state = 'FRESH'
        self._active = None
        self._task = None
        self._judge = None
        self._cursor = 0
        self._records = []
        def bound_full_document_callback(doc, results):
            return self._process(doc, results)
        self.callback = bound_full_document_callback

    def construct(self, old_adapter: Any) -> Any:
        require(self.state == 'FRESH' and self._task is None, 'SINGLE_TASK_CONSTRUCTION_REQUIRED')
        from lm_eval.tasks import TaskManager
        config = copy.deepcopy(old_adapter.spec['task'][0])
        require(config['metric_list'] == [] and 'process_results' not in config, 'OLD_SCORING_DISABLED_REQUIRED')
        config['task'] = TASK
        # Preserve loader metadata: it is forwarded as custom_dataset kwargs.
        config['process_results'] = self.callback
        task = TaskManager(include_defaults=False).load(config)['tasks'][TASK]
        equal([dict(d) for d in task.task_docs], json.loads(self._documents_bytes))
        require(task.config.process_results is self.callback and task.config.metric_list == [], 'FULL_DOC_CALLBACK_NOT_INSTALLED')
        self._task = task
        return task

    def score_batch(self, envelopes: Any) -> dict:
        require(self.state == 'FRESH' and self._task is not None, 'SINGLE_USE_CONSTRUCTED_BATCH_REQUIRED')
        # No state change and no judge call before the complete admission succeeds.
        docs, requests = json.loads(self._documents_bytes), json.loads(self._requests_bytes)
        checked = validate_envelopes(envelopes, docs, requests)
        from statebench.schema.timeline import GroundTruth
        ground_truths = [GroundTruth.model_validate_json(d['ground_truth_json']) for d in docs]
        for gt, d in zip(ground_truths, docs, strict=True):
            require(gt.model_dump_json() == d['ground_truth_json'], 'GROUND_TRUTH_ROUNDTRIP_MISMATCH')
            require(gt.decision == d['expected_decision'] and gt.decision_type == d['decision_type'], 'GROUND_TRUTH_VIEW_MISMATCH')
        from statebench.evaluation import create_judge
        self.state = 'ACTIVE'
        self._active = (checked, docs, ground_truths)
        try:
            self._judge = create_judge(use_llm=False)
            for i, item in enumerate(checked):
                before = self._cursor
                value = self._task.process_results(copy.deepcopy(docs[i]), [item['response']])
                require(self._cursor == before + 1, 'CALLBACK_NOT_EXECUTED_EXACTLY_ONCE')
                equal(value, self._records[-1]['task_result'])
            require(self._cursor == COUNT and len(self._records) == COUNT, 'INCOMPLETE_BATCH')
            require(self._task.config.process_results is self.callback and self._task.config.metric_list == [], 'SCORING_CONFIG_MUTATED')
            equal([dict(d) for d in self._task.task_docs], docs)
            result = {'profile': PROFILE, 'response_origin': ORIGIN, 'status': 'COMPLETE_BOUND_SYNTHETIC_BATCH',
                      'documents': COUNT, 'envelopes_sha256': sha(encode(checked)),
                      'records': copy.deepcopy(self._records), 'aggregate_computed': False}
            self.state = 'COMPLETE'
            return result
        except BaseException:
            self.state = 'FAILED'
            raise
        finally:
            self._active = None
            self._judge = None
            self._records = []

    def _process(self, doc: Any, results: Any) -> dict:
        require(self.state == 'ACTIVE' and self._active is not None and self._judge is not None,
                'CALLBACK_OUTSIDE_ADMITTED_BATCH')
        items, docs, ground_truths = self._active
        require(self._cursor < COUNT, 'EXCESS_CALLBACK')
        i = self._cursor
        require(type(doc) is dict and type(results) is list and len(results) == 1 and type(results[0]) is str,
                'ONE_STRING_RESPONSE_AND_FULL_DOC_REQUIRED')
        equal(doc, docs[i])
        equal(results, [items[i]['response']])
        result = native_result(self._judge, doc, results[0], ground_truths[i])
        scored = {METRIC: float(result['decision_correct'])}
        self._records.append({**copy.deepcopy(items[i]), 'native_result': result, 'task_result': scored})
        self._cursor += 1
        return copy.deepcopy(scored)
