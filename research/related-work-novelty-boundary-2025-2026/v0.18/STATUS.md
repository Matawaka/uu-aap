# v0.18 first observed evidence and qualification boundary

First complete A/B head: `49a161c3fa67589b9e3393cb5b162db0a24948d5`.
Run `34242614698`; A job `102116361815`, B job `102116361663`.
Both jobs succeeded on distinct runners. All 47 downloaded members match exactly.
No technical runtime RED preceded this pair.

The separately named synthetic-only scoring bridge processed all 251 exact
documents twice per job through the supported full-document Task callback and
native deterministic judge. Complete native records match separate direct native
calls. This is bridge fidelity, not an independent proof of judge semantics.

All 16 precommitted semantic-control projections matched without changes to the
expected fixtures. All 21 invalid-batch variants per repetition plus direct
callback bypass and completed-batch reuse were rejected with zero judge calls:
46 recorded rejections per job. Input hashes/origin labels establish byte binding,
not authenticity or genuine model provenance.

The actual call counts per job are 504 Task.process_results, 504 full-doc callback,
1036 native judge, 4 create_judge, 4 upstream process_docs. The judge count consists
of 502 bridge calls, 502 separate reference calls and 32 finite semantic controls.
The two extra Task/callback calls are the rejected direct-use controls.

Original upstream Task and metric remain NONPASS. The prior 32-file v0.17 evidence
set and all namespace/import evidence retain their exact original bytes. No old
source, lock, adapter, package or historical result was changed.

Frozen result SHA-256:
`041800590327928c6a414e7f9284c26cf58eec7081e6b89775cf3d2e040f0c24`.
First evidence manifest SHA-256:
`3a1a253b8d51278edaca9e3385c71e6b5da4750216126a9c9c37bd721833d368`.

A successor is qualified only after BOTH new independent A/B jobs execute the
unchanged bridge and pass the unconditional fresh-evidence validator. It requires
all member hashes and sizes, first source/workflow identity, receipt integrity,
all finite control projections, zero judge calls on invalid admission, and old
NONPASS preservation. Missing evidence has no fallback to frozen files.

Result, source, contract, fixtures, manifest and receipt are durable Git files.
Full runtime ledgers, response/reference/namespace snapshots are supplementary
Actions artifacts (30-day retention), not claimed as Git-committed full traces.
ZIP container identity is separate from contained-file identity.

No real model answers, model/backend/LLM judge, provider API/client, user credentials,
Hub loading, evaluator dispatch, response filtering, request cache or aggregation.
No benchmark/model-quality/novelty/production/release/standards or merge authority.
The synthetic empty-response rejection is not a model-benchmark denominator policy.
This sequential adapter makes no concurrency, untrusted-in-process isolation or
rollback guarantee. Full response/evaluator/aggregation integration remains a
separate later gate. PR #994 stays draft/open; #992 stays unchanged.
