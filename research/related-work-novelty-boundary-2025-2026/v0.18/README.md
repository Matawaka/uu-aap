# StateBench bound synthetic scoring v0.18

Tracks #993; predecessor `05c6cfc746517e6c7befd6995d31be0d0fb738f6`,
v0.17 subtree `51453d6f8b8816eeee53ebdf27a025e93409fad6`.
Initial status: CANDIDATE_AWAITING_INDEPENDENT_RUNTIME.

This is a separately named synthetic-only scoring bridge, not a fix to upstream
`decision_accuracy`. Original Task and metric remain NONPASS. Old profiles,
source, results and receipts are immutable. Draft/open, no merge authority.

## Two distinct kinds of evidence

The full 251-document route checks interface fidelity. The unchanged v0.15
adapter reads the exact raw JSONL and invokes the unchanged plugin processor.
The v0.18 callback receives a FULL document, reconstructs its complete normalized
GroundTruth and calls the existing `create_judge(use_llm=False).judge` interface.
Each native result is compared with a separate direct call on the same data.
This checks the bridge, not independent semantic correctness of that judge.

The 16 precommitted hand-authored controls have explicit expected projections:
binary choices, the short word `now`, categorical lowercase extraction, required
phrase hits/misses, forbidden/negated/numeric-boundary phrases, skipped generic
phrases, restricted/fabricated classifications, explicit kind override and regex.
These are finite examples, not full native semantic verification. All expected
values are fixed before runtime; disagreements must remain visible NONPASS.

## Whole-batch admission and exact binding

A complete batch has 251 envelopes in exact order. Each binds its sequence,
timeline/query identity, full document hash, request-record hash, UTF-8 response
hash and declared synthetic origin. No cryptographic signature, authenticity,
genuine model provenance or authority is inferred from hashes or an origin label.

Every envelope and every GroundTruth is validated before any judge call. Empty,
missing, excess, duplicate, reordered, wrong-type, oversized or misbound inputs
are rejected. The entire batch must be admitted: a late invalid input cannot cause
a valid prefix to be scored. Empty responses are rejected by this specific
synthetic-only profile; that is NOT a recommendation to discard real empty model
outputs or exclude them from a future model benchmark denominator.

The single-use callback accepts only the ordered prevalidated doc/string pair.
Direct Task callback use outside a batch and reuse of a completed batch are
rejected. A runtime failure after admission returns no completed ledger; executed
local judge calls cannot be undone, and no rollback guarantee is claimed.
This is a sequential research adapter, not a concurrency-safe service.

The old loader metadata is retained because Task.download forwards it as callback
arguments. Only Task identity and process_results differ. The new identity is
recorded in the Task name and ledger. No factory, registry, upstream method or
installed package is patched. Per-document `matawaka_synthetic_decision_correct_v018`
values come from native `decision_correct`; every native QueryResult field is
preserved separately. There is NO aggregate accuracy or evaluator integration.

## Execution and qualification

A/B lanes use separate clean environments/caches and replay all six run blocks of
the exact v0.17 workflow in its own detached worktree, recursively reproducing the
previous chain. The v0.14 selection still excludes the conflicting distribution.
New execution uses non-root python -I, a separate network namespace and socket/
forbidden-call guards. All 251 records are processed twice with fresh adapters.
21 malformed batch variants per repetition plus direct bypass/reuse checks must
make zero native judge calls. Real native/callback/Task invocations are observed,
not substituted. Source and complete lm_eval namespace/import hashes are rechecked.

First complete A/B evidence can be frozen only after it exists. A later independent
pair must regenerate it and pass an unconditional byte-for-byte validator. Artifacts
are supplementary with 30-day retention; core results, source, contracts and manifests
are durable Git evidence. Container ZIP hashes are distinct from member hashes.

## Non-effects

No actual model answers, model download/instantiation/inference, provider clients
or APIs, LLM judge, credentials, Hub loading, response filtering, request cache,
evaluator dispatch, aggregate benchmark score, performance, novelty, production,
release, standards, main/protected changes or merge authority. No automatic model
or real-response admission follows this result. Full evaluator/response-filter and
aggregation semantics remain separate later gates.
