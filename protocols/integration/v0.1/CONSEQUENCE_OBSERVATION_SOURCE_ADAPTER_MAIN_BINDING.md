# ConsequenceObservation Source Adapter Main Binding v0.1

## Purpose

This layer verifies that a source-specific consequence adapter receipt was produced by the exact successful post-merge `push/main` GitHub Actions run and that the exact revision-bound workflow artifact can be retrieved and revalidated.

It exists between source-specific observation qualification and any future successor-consumer policy.

```text
ConsequenceObservationSourceAdapterReceipt
  -> post-merge push/main workflow run
  -> exact revision-bound workflow artifact
  -> ConsequenceObservationSourceAdapterMainBindingReceipt
  -> [future separate successor-consumer policy]
  -> [future separate ResponsibilityEventSuccessorAppend]
```

## Canonical source for this migration

PR #249 established the source-specific adapter. The exact source revision consumed by this migration is:

```text
0ea85faa957cd924c250e0cea0d0758f855d4fd0
```

The workflow must find exactly one successful `push` run of:

```text
ConsequenceObservation Source Adapter validation
```

bound to `main` and the exact revision above, then retrieve:

```text
consequence-source-adapter-0ea85faa957cd924c250e0cea0d0758f855d4fd0
```

A pull-request candidate artifact is never a substitute for the required source artifact.

## Historical frontier assurance boundary

The canonical #249 source bundle contains the exact JCS/SHA-256 binding of its historical `ResponsibilityEventSuccessorLedgerEntry`, but it does **not** contain the bytes of that ledger entry itself.

Therefore this layer must not claim that the historical predecessor bytes were independently reverified after the fact.

It can and does verify that:

- the same `frontier_entry_binding` appears in both the generic assessment and source-specific adapter receipt;
- the same `responsibility_event_head` is preserved through claim, ingress, assessment, and adapter receipt;
- the same `semantic_frontier` is preserved through those artifacts;
- the same `effect_frontier` is preserved through those artifacts;
- all artifacts carrying those values are themselves tied together by their existing JCS/SHA-256 bindings.

The explicit assurance boundary is:

```text
historical_frontier_binding_consistency_verified = true
historical_frontier_bytes_reverified = false
```

This is intentionally different from reconstructing the historical object by rerunning old producers. Runtime-dependent upstream evidence can make such a reconstruction produce different bytes even at the same Git revision. A historical binding is preserved evidence; a later re-execution is a new observation.

## What a positive receipt means

A positive `ConsequenceObservationSourceAdapterMainBindingReceipt` establishes only that, under the exact main-binding policy:

- the expected source revision was explicit;
- the matching GitHub Actions workflow run was a completed successful `push` on `main`;
- the exact revision-bound artifact was located and downloaded;
- the downloaded bundle is schema-valid;
- included artifacts match the JCS/SHA-256 bindings carried by the adapter receipt;
- the historical frontier binding is internally consistent across the preserved evidence chain;
- the historical predecessor bytes are **not** claimed to have been reverified;
- the source runtime context is `main_push` and `refs/heads/main`;
- the source-specific adapter receipt is main-bound and not candidate evidence;
- the source may be presented to a future, separate successor-consumer policy.

## What it does not mean

The receipt does **not** establish:

```text
main evidence verified
  != historical predecessor bytes reverified
  != successor append permission
  != successor append execution
  != external consequence truth
  != generalized causality
  != responsibility attribution
  != responsibility adjudication
  != legal liability or legal effect
  != moral blame or moral correctness
  != universal truth or canonicality
  != PoAI materialization
```

Both `successor_append_may_proceed` and `successor_append_executed` remain `false`.

## KONTUR runtime independence

During continued architecture development KONTUR is intentionally stopped. This integration layer has no runtime dependency on KONTUR and must not start, activate, query, mutate, or gate on KONTUR.

The reference policy fixes:

```text
server_runtime_dependency_required = false
```

and the validation workflow rejects any `server/kontur/**` change in this migration.

This is not a claim that KONTUR is unnecessary in a future deployed architecture. It only keeps current integration-layer development independent from a deliberately stopped server runtime.

## Candidate versus canonical binding receipt

The workflow runs on both pull requests and `push/main`.

- PR execution may produce a **candidate binding receipt**. It verifies the already-main-bound #249 source evidence, but the binding receipt itself is PR-context evidence.
- After human squash merge, the `push/main` execution may produce a **main-bound binding receipt**.

The two are not interchangeable.

A future successor-consumer policy should consume only the exact post-merge main-bound binding receipt from the predecessor revision it declares.

## Authority and permissions

The workflow requests only:

```text
contents: read
actions: read
```

It requests no OIDC permission, repository write permission, secret expansion, activation authority, or auto-merge capability.

Human squash merge remains the final repository mutation boundary.
