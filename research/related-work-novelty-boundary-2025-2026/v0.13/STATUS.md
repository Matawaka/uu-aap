# v0.13 bounded status and continuation

First complete independent diagnostic: `0f2f1023f8fe1e73e566b4bc00a0ffeba3c4041b`, run `34216120618`, job `102028146188`.

`audit_execution=COMPLETED; compatibility=NONPASS`.

The exact original YAML creates an empty group, not a Task. Separately forced TaskConfig diagnostics reject top-level `until` and `filter_docs`. The minimal exact-data route calls unchanged upstream process_docs, retains the 251-document v0.12 digest, then fails at `lm_eval/api/task.py:805` because a list has no `.features`.

The explicitly different preprocessed HF Dataset diagnostic control constructs a Task and preserves all 251 prompt/target pairs. It is not the unmodified upstream task, a production adapter, a scoring result or a model benchmark.

`results.json` and `qualification-receipt.json` freeze the first complete observed result. `validate_qualification.py` unconditionally requires a separately executed result with identical bytes and the same 251-entry format trace. It binds the exact successful experiment code and first workflow, plus both historical INCONCLUSIVE results and their older observer code identities. The initial README is retained as pre-runtime history; see OBSERVATION-HISTORY.md for explicit observer refinements. No upstream code or earlier version was changed.

Next separate gate after successor reproduction: an explicitly named model-free compatibility adapter, with a declared group/leaf-task configuration delta, correct generation-kwargs location for until, explicit treatment of the null filter_docs field, and a byte-preserving list-to-Dataset seam around unchanged process_docs. It must retain the original NONPASS observation and compare all 251 documents and prompt/target pairs. Scoring compatibility, model execution and benchmark claims remain separate later gates.

No model, provider API, user credentials, scoring/judge, dispatch, Hub dataset, release, main mutation or merge authority. Draft/open PR #983; #981 unchanged.
