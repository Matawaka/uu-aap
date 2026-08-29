# Policy-Relative Materialization v0.1

Read-only successor-recognition profile under #748.

The profile consumes a dedicated `MaterializationAuthorityReceipt` and may produce:

- `RECOGNIZED_IN_SCOPE`
- `CONTESTED`
- `DEFERRED`
- `REJECTED`
- `INSUFFICIENT_EVIDENCE`

A recognition is always relative to an exact policy id/version/scope and exact predecessor→successor pair. The authority receipt must itself be `AUTHORIZED_IN_SCOPE`, explicitly support materialization authority, bind the same policy id/version/scope and exact target, and have an evaluation time no later than the recognition decision time.

An optional recognition validity window is fail-closed: a decision outside that window is `DEFERRED`, not silently recognized. One referenced conflict set or one dispute is sufficient for `CONTESTED`; the profile never requires multiple conflicts before preserving contention. Stays also defer recognition. Appeal and supersession references remain provenance-bearing without rewriting earlier receipts.

Core boundaries:

`Successor Proposal != Materialized Successor`

`Recognition In Scope != Universal Canonicality`

`Scoped Authority Evidence != Materialization Authority`

`Materialization Authority != Execution Authority`

`Recognition Receipt != ActionPermit`

`Later Authority Evidence != Earlier Recognition Authority`

Competing structurally valid successors remain observable. A conflict/dispute does not become normative victory merely because one candidate was selected elsewhere. Historical predecessor evidence, Decision Boundary and Knowledge Cutoff are not rewritten.

No repository mutation, release/tag, runtime activation, external effect, truth/causality/liability/legal-status/certification claim or universal canonicality is created by this profile.
