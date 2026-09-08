# StateBench singleton response-container/filter bridge v0.19

Tracks #995. Exact additive successor to v0.18 at
`648811172c9711a8b2c482e93ff8cee493ef3b50`, subtree
`127d90ca9c09dad49e017b3c91fe546ac3c2f693`.
Initial status: CANDIDATE_AWAITING_INDEPENDENT_FILTER_RUNTIME.

## New bounded route

`MATAWAKA_SINGLE_RESPONSE_FILTER_BRIDGE_V019` applies only the unchanged built-in
`none: take_first` pipeline, with exactly one synthetic response per real Instance.
The unchanged v0.15 adapter reads the original pinned test.jsonl and processes all
209 timelines / 251 query documents. Real upstream request construction must
reproduce all v0.16 request bytes. No frozen request/documents replace raw data as
adapter input; old outputs are comparison evidence and request anchors.

All 251 response strings are distinct, fixed before runtime:
`MATAWAKA_SYNTHETIC_RESPONSE_V019:000` through `:250`.
They have no model provenance. The v0.18 response envelopes bind exact sequence,
document, request, response bytes and explicitly synthetic origin. The entire
batch and native GroundTruth validate before attachment to Instance.resps.

Before real Task.apply_filters, every Instance identity, ordered request field,
singleton raw response, empty output field and exact built-in filter factory is
checked. After native FilterEnsemble/TakeFirstFilter execution, all outputs must
be strings under the sole `none` key and byte-identical to their own raw responses.
No strip, regex, truncation or answer normalization is part of this profile.

Only then are v0.18 envelopes made from ACTUAL filtered outputs and passed to the
unchanged BoundSyntheticScorer. Its public full-document Task callback and native
judge remain unchanged; complete QueryResult records are retained and checked
against separate native calls. This proves bridge fidelity, not independent
semantic correctness. No aggregated benchmark score is computed.

## Hostile checks and raw upstream diagnostics

Two fresh full bridges per job. Each repetition checks 21 malformed envelope
batches plus early scoring, 15 corrupted pre-filter Instance/pipeline collections,
8 corrupted post-filter collections, refiltering and completed reuse. The expected
94 rejection records per job must have zero native filter and judge calls.
Fault-injected test fixtures are restored ONLY after a precheck that performed no
native effect, not after a failed real filtering run.

Separate diagnostics on temporary copies of real Instances examine built-in
behavior outside the admitted profile: multiple responses keep only the first;
a bare string can become its first character; a late empty response list can
raise IndexError after the preceding output was written. These predictions must
be observed and retained; they are not valid bridge admissions and are not scored.
No monkeypatching of upstream filter, Task, metric or judge functions is allowed.

The bridge is sequential/single-use, not a concurrent service or a security
boundary against arbitrary code inside the same Python process. Filtering or
scoring failures are terminal and no completed bridge receipt is returned. Partial
native writes/calls are not rolled back or falsely described as transactional.

## Reproduction and preserved history

Two independently provisioned Actions lanes replay all exact v0.18 workflow run
blocks in its own detached worktree, recursively preserving older gates and their
NONPASS observations. Same v0.14 selected environment, new empty cache per lane,
one selected sync. Non-root python -I, network namespace, socket and forbidden
call guards, empty credentials and no STATEBENCH_JUDGE override. After v0.19,
namespace and public import evidence must retain prior bytes. This is not a full
filesystem audit of all dependencies.

First full observed A/B evidence is frozen only after execution. A separate pair
must then reproduce exact result and member bytes through an unconditional
qualifier. Archive identity is kept separate from contained-file identity.

## Non-effects

Original metric and Task stay NONPASS. Old sources, profiles and receipts stay
unchanged. No model, provider client/API, LLM judge, credentials, Hub loading,
generation/stopping, evaluator dispatch, request cache, aggregation, benchmark,
performance/novelty, production/release/standards, main update or merge authority.
Hash/origin labels do not establish authenticity. Synthetic empty-answer rejection
must not be used to exclude real-model failures from a future denominator.
General custom filters, regex, multiple-response pipelines and full evaluator
integration are not established. PR stays draft/open; merge_authorized=false.
