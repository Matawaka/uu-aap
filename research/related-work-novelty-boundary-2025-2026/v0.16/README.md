# StateBench plain request construction v0.16

Tracks #989. Initial candidate: `AWAITING_INDEPENDENT_RUNTIME`.
Exact predecessor: `4b4a7959b6821fa93c31ef2ba2e015b415d5ada9`.
v0.15 subtree: `c9d6fc3dc8b54e68fc707cd8ec4abb5f57960a39`.

## Bounded execution

The unchanged v0.15 named adapter reads exact original JSONL and constructs its
Task in the unchanged v0.14 namespace-safe selected environment. The five exact
v0.15 workflow run blocks are first replayed in their own detached worktree.
Only execution-path substitution GITHUB_WORKSPACE -> PREDECESSOR15 is used.
Old additive guards, evidence bytes and their historical meaning remain unchanged.

The new operation is real `Task.build_all_requests`, including actual upstream
`ConfigurableTask.construct_requests` and `Instance` creation. The primary profile
is zero-shot plain text, all 251 documents, one rank, no limit/subset, no system
instruction, chat template or request cache. Exact flags and the independently
calculated expected request hash are predeclared in request-contract.json. The
oracle is not a runtime result and is never passed as the adapter input.

Every real Instance is checked: full bound document, full context, arguments,
request type, metadata and unpacked metadata, integer indices/repeats, empty
response containers and exact fields. Mutable generation dictionaries and until
lists must be distinct per request and independent of Task config. Three complete
builds are observed: first build, same-Task rebuild, fresh-adapter build. A rebuild
must replace Instances instead of accumulating or reusing them. Profile observation
counts real calls without replacing upstream methods.

## Independent context interpretation

The pinned template environment explicitly preserves trailing newlines. For this
fixed literal description and plain zero-shot mode, the expected full context is
DESCRIPTION + independently formatted document prompt. No whitespace repair,
extra separator, target answer or few-shot example is appended. The complete
expected trace includes the evaluation document (which contains ground truth),
but generation arguments contain only context and generation settings. This is
not a claim that ground-truth strings never occur naturally in the original text.

`max_gen_toks=256`, `temperature=0.0`, `do_sample=false`, and exact ordered
`until=["\n", "\n\n"]` are preserved. Backend use of these options, tokenization,
context-window adequacy and actual stopping behavior are NOT executed here.

## Qualification

Two predeclared A/B jobs use fresh environments and caches, one selected sync per
job, then run all predecessor evidence gates. Both construct new requests and
recheck the full lm_eval namespace census/public import afterward. First complete
observations must be frozen only after execution and independently reproduced.
Missing or differing evidence fails closed. ZIP identity is distinct from identity
of contained files. Artifacts are supplementary with 30-day retention.

The initial 12 helper tests include multiple mutation subcases. They test guards,
not model performance. A CI GREEN is not an official StateBench benchmark result.
Any failure remains historical with its exact cause, not retroactively converted
to upstream incompatibility or removed in order to claim a clean history.

## Non-effects

Request objects are newly in scope; dispatch is not. No scoring, judge, filter
application, model weights/instantiation/inference, provider API, user credentials,
Hub loading, request cache read/write, chat template, benchmark score, novelty,
production/release/standards authority or merge. No old code/receipts or main change.
The original upstream Task remains NONPASS. This gate establishes only the named
adapter's zero-shot plain-text request construction, not full unchanged upstream
compatibility, actual chat-template behavior, model context limits or scoring.
