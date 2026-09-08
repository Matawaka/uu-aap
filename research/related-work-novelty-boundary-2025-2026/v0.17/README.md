# Synthetic response-to-scoring audit v0.17

Tracks #991. Candidate awaiting independent runtime evidence.
Predecessor: `a5fd76f8d0c21359edd8ec60c22456484db9c240` (#990), exact v0.16
subtree `3950d8778ec8812e21941cd12fbde2d2773ab3bd`.

## Evidence is not model quality

Every response in this experiment is hand-authored SYNTHETIC input. None is a
model-generated answer. CI success can qualify a replicated scoring-contract
NONPASS; it does not mean that the upstream metric or original Task is compatible.
The procedure is fixed in #991 and audit-contract.json before runtime observation.

## Four separately labelled paths

A. Reconstruct the original v0.15 named adapter from exact raw JSONL, and call its
real process_results on all 251 documents with a synthetic response marker.
Its empty metric_list must yield empty dictionaries, with no metric calls.
This means scoring is disabled, not that scoring passed.

B. Construct a separate diagnostic Task using the same exact-data callbacks and
only a different task name plus the original upstream metric_list. Call the real
lm-eval process_results for all 251 documents. The expected finding is that
references are target strings while decision_accuracy expects dictionaries;
lm-eval's TypeError fallback then omits the references argument. Preserve BOTH
exceptions, actual metric inputs and source frames. Do not patch the caller.

C. Call the unchanged metric directly with its documented dictionary references
for all 251 documents. The expected finding is that the ResponseJudge has no
extract_decision method. Inspect decisions_match independently; do not add
missing methods. Empty and one-sided-empty cardinalities are separate controls:
a returned 0.0 without validation is an input-contract observation, not a score.

D. Call actual create_judge(use_llm=False).judge on four entirely synthetic binary
cases, expected booleans true/false/true/false. No mention constraints are used.
This positive control shows only that these calls through the existing judge API
work. It does not establish full native scoring, semantic equivalence, accuracy,
SFRR, or a usable scoring adapter.

All four paths repeat with a fresh adapter. Frozen result documents are comparison
evidence, never the adapter input. No fixture subset or favorable response
selection is applied to A/B/C. Output order, exact documents and exception context
are retained. Unexpected errors remain INCONCLUSIVE, not compatibility evidence.

## Isolation and history

Each predeclared A/B job begins with a fresh v0.14 selected environment and empty
uv cache, and replays every exact v0.16 run block in its own detached worktree.
This recursively preserves the old guards, receipts, request bytes and original
Task NONPASS. No old source/lock/profile is altered. The scoring audit runs under
non-root python -I in a separate network namespace with socket and call guards.
Installed judge/rubric/metrics/schema and Task source blobs are bound. The full
lm_eval namespace census and public TaskManager import must be unchanged after
this audit. StateBench judge code is also checked again after the experiment.

Only deterministic local judge construction and the stated native controls are
newly allowed. No provider client, LLM judge, model, Hub loader, request cache,
response filters, evaluator or dispatch may run. The original v0.16 flags saying
scoring was not called describe that historical stage and stay unchanged.

First full A/B evidence will be frozen only after execution, and an independent
successor must reproduce its exact files. Artifacts are supplementary and expire;
results, receipt and manifest are intended as durable Git evidence. The workflow
copies fixed source files into the runtime artifact for independent recovery.

Next separate gate, only after the audit: an explicitly specified deterministic
scoring adapter with strict input binding/cardinality and a supported judge API.
No such adapter, benchmark, advantage/novelty, production/release/standards,
main mutation, merge or merge authority is established here. Draft/open only.
