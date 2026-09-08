# StateBench lm-eval Task compatibility v0.13

Tracks #982. Pre-runtime status: `CANDIDATE_AWAITING_INDEPENDENT_OBSERVATION`.
Exact predecessor: `98f13086f8e2d75fc6692ff68e21700bdffa37a5`.
Exact v0.12 subtree: `82548649f877fb6ba1d405aec239f2a88c3a5997`.

## Question and three separate probes

v0.12 established direct byte-bound processing into 251 query documents from 209 timelines. It did not establish Task API compatibility. This stage asks whether the unchanged pinned StateBench plugin can cross the pinned lm-eval 0.4.13 Task boundary.

**A: unchanged upstream YAML.** Use the real pinned TaskManager and YAML loader on the exact upstream task file. Do not move or remove fields. Source inspection predicts TaskConfig rejection of top-level `until`, and independently of `filter_docs`. Report the manager's actual exception and the two individual TaskConfig probes. Dataset loading is forbidden, not redirected to the ordinary Hub dataset.

**B: isolate the return container.** Use an explicitly different minimal test-only configuration with supported `custom_dataset` returning all 209 exact HF rows, zero few-shot examples and an empty metric list. Call upstream `process_docs`, `doc_to_text` and `doc_to_target` unchanged. Source inspection predicts the real constructor's `.features` access rejects the processor's Python list. Observe actual upstream call/return and require its entire 251-document payload still matches v0.12. This is not a repaired original YAML.

**C: separately named positive diagnostic control.** Pass the already verified v0.12 documents as a HF Dataset, with `process_docs=None`, to isolate whether container provisioning permits Task construction and exact prompt/target handling for all 251 documents. This control is NOT the unchanged upstream task and NOT a qualified production adapter. It disables all scoring and dispatch. It cannot establish benchmark correctness or full integration compatibility.

## Evidence and qualification

Source, dataset, tokenizer and dependency pins are unchanged. Five installed lm-eval Task/config/loader source files are compared to their exact upstream Git blobs, before and after probes. This is selected-surface identity, not a claim about every distribution file.

The prior gate runs in an exact detached v0.12 worktree: its own additive guard and receipts are not modified to admit v0.13. v0.11 import evidence and full v0.12 data-processing evidence must reproduce before the Task probes.

The predeclared expected outcome is `LM_EVAL_TASK_COMPATIBILITY_EXECUTED_NONPASS`, with `audit_execution=COMPLETED` and `compatibility=NONPASS`. It is qualified only after observing the actual classified configuration and container exceptions plus successful diagnostic control. Unrelated bootstrap/import/guard errors are `AUDIT_INCONCLUSIVE`, not StateBench incompatibility. A successful CI diagnostic workflow must never be advertised as an upstream Task PASS.

Probe execution uses a fresh OS network namespace and non-root runner credentials, both mechanically checked, plus a socket guard. A Python call-profile guard records and blocks named dataset-loader, model/evaluator and scoring boundaries; no upstream code is monkeypatched. This is bounded instrumentation, not a general security sandbox proof.

## Non-effects and next boundary

Exact task YAML reading is now in scope. Historical v0.12 non-effects are not rewritten. No model weights, model instantiation/inference, Hub dataset loading, provider call, user credentials, judge/scoring, evaluation/dispatch, performance/advantage/novelty, production, release, standards or merge authority.

Only this research subtree and its dedicated read-only workflow may be added. No prior research, Stable Core, main, runtime or product changes. #981 remains unchanged; the successor remains draft/open. `merge_authorized=false`.

After a reproduced NONPASS, any remediation must be a separately identified research adapter with an explicit YAML/config delta and an explicit list-to-Dataset seam. It must not rewrite the negative observation or masquerade as the unchanged upstream plugin. Model evaluation remains a later, separately bounded gate.
