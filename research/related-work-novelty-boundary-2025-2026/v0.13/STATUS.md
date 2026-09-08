# v0.13 current status: successor reproduction blocked

`COMPATIBILITY_NONPASS_OBSERVED; SUCCESSOR_REPRODUCTION_BLOCKED`.

Do NOT label the whole v0.13 candidate qualified and do NOT create a v0.13 qualified-base ref. The frozen first-complete receipt records one real diagnostic observation, not a guarantee that the frozen environment reproduces that observation reliably.

## Preserved complete observation

Head `0f2f1023f8fe1e73e566b4bc00a0ffeba3c4041b`, run `34216120618`, job `102028146188`: all diagnostic steps completed. `audit_execution=COMPLETED; compatibility=NONPASS`.

Original YAML: empty group, zero Tasks. Separate forced TaskConfig probes: unsupported top-level `until` and `filter_docs`. Minimal exact-data Task: unchanged process_docs produced the exact 251 v0.12 documents, then AttributeError at `lm_eval/api/task.py:805` because list has no `.features`. A separately named preprocessed Dataset diagnostic control constructed a Task and preserved all 251 prompt/target pairs. It is not the unchanged upstream task or a model/scoring result.

`results.json`, its digest, first-complete `qualification-receipt.json` and experiment code remain frozen. The two earlier INCONCLUSIVE observations are retained separately in history and described in OBSERVATION-HISTORY.md.

## Failed independent successor

Head `2a298cdf1de05f794273026e30f38f65b810a366`, run `34216833250`, job `102030474477`: v0.11 and v0.12 reproduced, but v0.13 imports failed: cannot import TaskManager from lm_eval.tasks. Task probes and final qualification were not executed. Its exact result is `history/successor-import-inconclusive-results.json`, SHA-256 `3c750e8901b74c017968eabf8af2f0fabb74638d820c905b1fb6988913e98af1`.

The six bound installed source files did not include the shared tasks/__init__.py. Source inspection shows both pinned distributions install that path, with the plugin's initializer empty. `namespace_audit.py` separately inspects both installed RECORD claims and actual bytes, without importing lm_eval or changing any file/package. It admits either observed owner and never treats a lucky initializer selection as a fix. The workflow fails closed if actual conflicting ownership is observed. See #982 for the exact subsequent audit run and raw ownership observation.

## Next boundary

Resolve frozen-environment namespace ownership in a SEPARATE explicit successor environment; retain the old lock and all successful/failed historical observations unchanged. Reordering installation, force-reinstalling, overwriting __init__.py, changing imports merely to bypass the initializer or retrying until GREEN are not qualified remedies.

Only after a collision-free installation is verified should a separately named model-free task adapter address the original group/leaf, until/filter_docs and list-to-Dataset boundaries. Preserve 209 timelines, 251 documents and their prompt/target hashes. Scoring and model evaluation remain later gates.

No model, provider API, user credentials, scoring, dispatch, Hub dataset load, upstream patch, main mutation, release or merge authority. PR #983 stays draft/open; #981 and v0.1-v0.12 are unchanged.
