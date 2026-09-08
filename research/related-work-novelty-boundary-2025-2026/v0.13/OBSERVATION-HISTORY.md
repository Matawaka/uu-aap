# v0.13 observation history

## First run: a disproven observer prediction, preserved

Head: `ed795acdc0dfdb0faa46547fef9094d89f096729`.
Run: `34215268253`; job: `102025422814`; workflow conclusion: `failure`.
Original observer blob: `d9664ada03728fc89aa233dc0651df40732a2462`.
Result: `AUDIT_INCONCLUSIVE`; compatibility: `NOT_ESTABLISHED`.
Reason: `SOURCE_PREDICTED_YAML_REJECTION_NOT_OBSERVED` at `raw_yaml`.

The original observer prematurely expected TaskManager to raise TaskConfig's
unsupported-key error. In fact TaskManager returned without an exception. The
observer stopped before checking the return value and before running the container
or positive-control probes. No compatibility finding is retroactively attributed
to this run. Its v0.11/v0.12 reproductions succeeded and remain historical evidence.

The exact original result is stored in `history/initial-inconclusive-results.json`:
SHA-256 `43cdf77ede5a1dc8847568ed7c570dd0ace9d34556481c6b671677d3e8f87699`.
Artifact 10051516702, 1723-byte ZIP:
`fc6cddc0504629bc405c97d7dd41412f6dcd7679118030ef133f69ac98079a55`.

## Refined observer, registered before its execution

The change was disclosed in #982 comment 5583701724 before the successor run.
No upstream YAML, plugin, library, input data, tokenizer, lock or earlier receipt
was changed. The observer adds exact binding of lm-eval's `_index.py`:
`c37260731dcf3a9dd38815ecb5eb3e3a3f7c93be`.

The index classifies a config containing `group` as GROUP before looking for
`task`. The factory creates children only if `task` is a list. The original YAML
contains `group: statebench` plus the scalar `task: statebench`. Therefore the
refined probe records actual task and group membership, rather than promoting
absence of an exception to successful Task admission.

The observer additionally tests TaskConfig explicitly after exactly the factory's
structural-key removal and probes the unsupported keys individually. This is a
named diagnostic seam, not a repaired original task configuration.
The original list-container probe and the separately named preprocessed HF Dataset
control retain the same input, behavior and scope. All 251 documents and their
prompt/target pairs are checked; scoring and model execution remain out of scope.

A completed diagnostic with `compatibility=NONPASS` is not a Task PASS. The initial
inconclusive result is not promoted by a later successful diagnostic or CI result.

## Second run: membership confirmed, callback contract still incomplete

Head `14370037dee6eccc26e2b7d4502046653880b043`; run `34215721241`;
job `102026872013`. Raw YAML produced zero Tasks and an empty statebench group;
both individual unsupported-field probes returned their TypeErrors. The observer
then stopped at `CONTAINER_FAILURE_NOT_CLASSIFIED` and failed to retain the nested
exception. The second run remains INCONCLUSIVE, not a completed container test.
Its raw JSON is stored in `history/second-inconclusive-results.json`, SHA-256
`f8f2e8a17652e7bf6c6ff910722a1059fb8949aa360279d049ade148b57ba508`.
Artifact 10051693530: 2062-byte ZIP, SHA-256
`e0d67cb64b59325a49b0aeab39c52412f8389b18bfca48e17af662f17e940b81`.

Before the next run, #982 comment 5583754720 records the callback refinement.
Pinned TaskFactory adds metadata `config_source: inline`, and ConfigurableTask
forwards metadata into custom_dataset. The research callback had incorrectly
required no kwargs. The revised observer admits only that exact provenance value,
records received metadata, rejects every other key, and preserves nested exceptions
before classifying them. No upstream code, dataset, lock, processing expectation
or scoring/model authority was changed. The source-derived callback explanation is
not claimed as an exception observed in the second artifact.
