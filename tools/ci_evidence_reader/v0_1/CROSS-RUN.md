# Cross-run evidence comparison — bounded development contract

2026-09-28. Parent reader/capture commit: 58e4f440edcdb5486964e68cd2ad12d501f24e15.
Frozen HA-1 stays at a57c8923552972a9dd2318d5ddbc4db2aba20ac7.

## Goal and scope

Compare the two already completed HA-1 runs: 36291169014/1 at 3336c22 and
36316768214/1 at a57c892. This is reading existing evidence, not re-running HA-1.
The first format has 12 source pins, 114+31 tests and no import/isolation evidence;
the second has 14 source pins, 114+46 tests, eight admitted Python files and an
isolated-interpreter assertion. Do not label old fields absent as a modern PASS.

Add exactly two named consumer profiles, selected by the out-of-band expectation:
`ha1-ci/pre-import-boundary-v0.1` and `ha1-ci/import-boundary-r2/v0.1`.
An omitted selector retains the existing R2 interpretation. Unknown selectors
fail incomplete. Never infer or downgrade the profile from the observed report.
An R1 match means consistency with that historical format, not endorsement of
its known import-discovery gap. Keep the seven broader assurance gaps unchanged.
Report profile limitations separately, including absence of the R2 controls.
No new general schema language, authority, stage generator or reviewer.

Compare exact per-suite test identities and source pins. Expose added/removed/changed
inventory entries, source and physical run/job identities, not just aggregate counts.
The expected manifests are sourced separately from the reports. Callers still choose
expectations and captures: matching hashes are not an origin signature.

A recorded CI failure must not be reported merely as a missing archive. Preserve
all side assessments, existing evidence-loss behavior for incomplete/inconsistent
packages, and use explicit failure/recovery classifications where recorded facts
support them. A change in test contract is not a claim of improved code quality.
A capture's nested PR head may be current while run.head_sha is historical; only
run/attempt identity belongs to this consumer's source binding.

## Finite validation

Keep all previous 119 tests. Add fixed tests for named historical profile, refusal
to auto-downgrade, missing/extra old/new fields, changed test inventories, distinct
runs, recorded failure vs missing evidence, safe HTML and unchanged purity. Keep
pre-implementation output as baseline; unsupported R1 input is a missing feature,
not an old bug. A mislabelled recorded failure is a separate demonstrated defect.

After inspecting code, a dedicated read-only GitHub Actions job may execute these
consumer tests and ONE bounded public GET-only collector smoke on the fixed R2 run.
Use an explicit head checkout, no secret/token discovery, no pull_request_target,
no credential forwarding, and the existing 12-call/30-second collector limits.
Retain failure evidence and do not claim HTTP success until that run is observed.
The offline reader remains network-free. No changes to HA-1 workflow or main.
