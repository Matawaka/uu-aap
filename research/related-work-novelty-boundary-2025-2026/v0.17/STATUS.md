# v0.17 negative scoring observation

First complete A/B head: `b878e1caedd739380e17e3f276a90161a2383f60`, run
`34238176563`. Both jobs completed successfully. Their 32 downloaded evidence
members match byte-for-byte. No technical RED preceded this first pair.

The scientific result is NONPASS for the original scoring contract, not a
benchmark score and not model evaluation. All 251 document bindings were checked
in two repetitions per job. The unchanged adapter returns empty metric dicts.
The diagnostic Task passes target strings, while the original callable expects
dictionary references. The first TypeError at plugin utils.py:170 is preserved
as context of the caller's fallback TypeError at lm_eval/api/task.py:1641.
Direct dictionary references then reveal missing ResponseJudge.extract_decision
at plugin utils.py:174. Absence of decisions_match is inspected independently;
it is not claimed as a second executed exception.

The original metric also accepts empty or one-sided-empty inputs and returns 0.0
without cardinality rejection. This is not recorded as model accuracy.
Actual create_judge(use_llm=False).judge handles four fully synthetic binary
controls [true,false,true,false]. This does not establish complete judge semantics,
a working metric adapter, response filtering, generation or a model benchmark.

The first-result receipt binds actual jobs, distinct runners, archive digests and
all 32 evidence members. The qualifier must run AFTER new independent execution;
no frozen files are copied to synthesize runtime observations. A final candidate
is qualified only after both A/B jobs pass this unconditional fresh-output gate.

Stored result digest:
`ed7b625a4fed8699d7e94de294037bbb1502146c1306ea8bb457d167efac1631`.
The result's contract hash is over canonical gate.encode(CONTRACT); the original
contract-file bytes are separately bound by the source member manifest. These
are different identities and must not be conflated.

Full runtime trace, original requests and namespace snapshots are supplementary
Actions artifacts (30 days), not falsely claimed as Git-committed full snapshots.
Result/contract/member manifest/receipt/source/validator are durable Git evidence.

Next separate gate: an explicitly named deterministic scoring adapter with exact
response/document binding, strict cardinality, supported native judge calls and
synthetic semantic tests. It is not implemented here. No models, provider calls,
LLM judge, aggregate benchmark, novelty, production/release/standards/main mutation,
merge or merge authority. #990 and all old receipts remain unchanged.
