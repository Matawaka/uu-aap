# StateBench model-free Task adapter v0.15

Tracks #986. Initial candidate; independent runtime qualification is not yet claimed.
Exact v0.14 predecessor: `997df26af32d23a5fe98dc9f89bba0f37dc1b7ca`.
Predecessor subtree: `42efaef1126466e21207429c7494b4e6cb44cea4`.

## Adapter identity and explicit changes

`MATAWAKA_STATEBENCH_EXACT_TEST_MODEL_FREE_V015` is a separately named research
adapter. It is not the unchanged upstream Task, an official StateBench benchmark,
a model runner, or a scoring implementation. The upstream source files and
historical NONPASS results remain untouched.

The exact source YAML is read with the pinned lm-eval loader. All keys, scalar
values and function origins are checked. No unknown key is passed through. The
adapter creates one explicit group with one inline leaf; replaces the Hub path
with a callback that reads only SHA-bound test.jsonl; moves top-level until into
generation_kwargs; removes only the checked null filter_docs; disables validation,
training and few-shot use; and disables scoring with an empty metric list.
Metadata becomes the explicit adapter identity. Description, doc_to_text,
doc_to_target, test split, and generation parameter values are retained.

These are deliberate changes, not full original-configuration equivalence. In
particular the preserved source description discusses decision accuracy, but this
adapter DOES NOT score or evaluate it. The effective configuration delta is
serialized as evidence. No generation/request-building equivalence is claimed.

## Real data route, not a precomputed-document substitution

The supported custom_dataset callback invokes unchanged upstream load_split_as_rows
on the exact 638933-byte test.jsonl. All 209 ordered HF rows must have the prior
v0.12 row digest. The process_docs callback invokes the unchanged upstream function,
checks its complete 251-document list against the prior digest, wraps only the
container using Dataset.from_list, and checks every byte of the serialized output
again. Frozen documents are an independent comparison input to the test gate,
never the adapter's data source. No input selection, filtering or hidden cache.

Actual pinned TaskManager must construct one group and one leaf with 251 documents
and matching features. The constructor's task_docs and a second eval_docs access
are both checked. The latter invokes processing again: no new cache is inserted.
All 251 prompt/target pairs must match the frozen v0.13 format trace and its
independent prompt formatter. A fresh adapter repeats the entire route. Thus each
job requires two raw dataset loads and four actual upstream process_docs calls.

## Qualified environment, isolation and preservation

Each A/B job starts with a new environment and empty uv cache and the unchanged
v0.14 selection profile. replay_environment.py executes all ten run blocks from
the byte-bound qualified v0.14 workflow in its exact detached worktree. Only the
execution directory argument is rebound from the successor workspace to that
predecessor worktree. Old additive guards and files are not edited or bypassed.
The old v0.11/v0.12/v0.13 outputs and full v0.14 evidence must reproduce first.

New adapter execution is non-root python -I in a separate network namespace, with
socket/forbidden-call guards. No request construction, model, scoring, provider
API, user credentials or Hub loader is allowed. The original YAML loader may
load the pinned external plugin module into this interpreter, as in v0.13; it is
NOT installed into site-packages. A fresh-interpreter namespace census and public
TaskManager import after the adapter must retain the full v0.14 evidence bytes.

## Qualification and next boundary

The first completed A/B observations will be retained separately from an independent
qualification successor. Fresh output must compare with frozen bytes; missing or
changed evidence fails closed. Failed runs retain their cause; no retry-until-GREEN
or reinterpretation of historical results is permitted.

A PASS is limited to named-adapter Task construction, exact data preservation, and
doc_to_text/doc_to_target behavior. Complete request construction, description/chat
template handling, evaluator dispatch, metric API behavior and model performance
remain separate later gates. Original upstream compatibility remains NONPASS.

No old files, lock, profile, Stable Core, main or runtime/product mutation; no
benchmark score, novelty, production, release, standards or merge authority.
Draft/open only; merge_authorized=false.
