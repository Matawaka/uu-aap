# StateBench exact-data plugin processing v0.12

Tracks #980. Status: `CANDIDATE_AWAITING_INDEPENDENT_RUNTIME`.

Exact predecessor: `5e7485cb44624b63756806414d0c5d5b85d60b93`.
Exact v0.11 subtree: `debdd1d7544cda852ea16214d4685cfb79d881b3`.

This stage tests **direct data transformation**, not a language model or a complete lm-eval Task.
The predeclared procedure is preserved in #980 and the initial candidate commit.

## Fixed inputs and processing

Use the unchanged v0.10 lock-project, Python 3.12.14, uv 0.12.10, and exact upstream
`Parslee-ai/statebench@1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7`.
The sole processed release split is `data/releases/v1.0/test.jsonl`: 638933 bytes,
Git blob `3d0bcce1a7725384cf7c25eb4695a784e6a275cd`, SHA-256
`7df54da79653488bcc2253c9431dc35fd5c2411ec12afe1f22958ed09395a7c9`.
All 209 unique ordered timelines and all 251 query events must be retained.

The upstream loader returns an iterator; it is explicitly materialized once for the
independent reference, not silently reused after exhaustion. The upstream functions
`load_split_as_rows`, `hf_row_to_timeline`, and `process_docs` execute unchanged.
The plugin is imported by exact file path, avoiding installation into or shadowing the
separately frozen `lm_eval` package namespace.

## Explicit tokenizer side input

The frozen tiktoken 0.14.0 package declares a runtime download for cl100k_base.
A package lock alone does not establish that this BPE asset is present in a cold cache.

The acquisition subcommand retrieves only
`https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken`, with no
redirects, no credentials, a 2 MiB ceiling, and exact expected SHA-256
`223921b76ee99bde995b7ff738513eef100fb51d18c93597a113bcffe865b2a7`.
The observed size is recorded, not invented in advance. This is tokenizer data, not
model weights. The processing phase verifies a dedicated single-file cache before
imports and runs inside a fresh Linux network namespace with an additional socket guard.
No ambient tokenizer cache, network repair or fallback tokenizer is admitted.

## Acceptance and interpretation

The gate compares full normalized Timeline objects before and after HF conversion,
including all events, initial state, metadata and ground truth. It separately reports
raw JSON -> upstream schema defaulting and timestamp canonicalization. These are not
claimed as raw JSON or byte-for-byte round-trip. Raw field removal, list-length changes,
or value changes other than equivalent timezone-aware timestamp spellings fail closed.

Every output document is compared with an independent reference for identity, order,
per-timeline index, query, ground truth and transcript context. Context reconstruction
uses the pinned strategy's actual user-conversation-only rule, budget 8000 minus 500,
and newest-first selection. It does not inject initial_state, state writes, assistant
turns or generated responses that the upstream strategy does not use. A second full
pass and a reversed-timeline pass check repeatability and reset isolation.

`process_docs` returns a Python list. A PASS here does **not** establish that a complete
lm-eval Task accepts this return type. Task-container compatibility remains a separate
subsequent gate, still before any model execution.

Local hostile tests use synthetic helper fixtures. They are not upstream benchmark
results and are not independent runtime qualification. A non-pass is kept as evidence;
source, data, expectations and old receipts are not changed to force a pass.

## Non-effects

No task YAML loading, Hub dataset loading, model download/instantiation/inference,
provider API, user credentials, judge/scoring, benchmark score, decision accuracy,
SFRR, recall/FPR, advantage/non-advantage or novelty conclusion. No v0.1-v0.11 rewrite,
Stable Core, PoAI, C2PA, runtime, product, release, standards or main mutation.
No merge and no merge authority. #979 stays draft/open unchanged; this successor also
stays draft/open. `merge_authorized=false`.
