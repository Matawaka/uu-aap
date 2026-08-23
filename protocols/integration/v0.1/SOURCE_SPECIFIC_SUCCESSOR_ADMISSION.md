# Source-Specific Successor Admission v0.1

## Purpose

This layer admits the exact canonical post-merge consequence-source binding produced after PR #251 for **future successor-adapter design** without registering an adapter, changing the generic successor policy, or appending an event.

Canonical predecessor:

- main `4c76d80ead3e0d8d3af14375a3478cc72beddefa`
- original source-evidence revision `0ea85faa957cd924c250e0cea0d0758f855d4fd0`

KONTUR is intentionally stopped during architecture development and is outside this profile.

## Boundary

```text
canonical #251 MainBindingReceipt
        |
        v
SourceSpecificSuccessorAdmissionPolicy
        |
        v
SourceSpecificSuccessorAdmissionReceipt
        |
        +--> future adapter-registration proposal
        |
        X   no adapter registration here
        X   no successor-policy mutation here
        X   no append permission here
        X   no append execution here
```

The central invariant is:

```text
main-bound source binding accepted
!= successor adapter registered
!= successor policy modified
!= successor append permitted
!= successor append executed
```

## Why admission is separate

`ResponsibilityEventSuccessorPolicy v0.1` already provides generic durable successor semantics, but its current reference policy allows only:

`responsibility_event_append_ledger_reobservation_v0.1`

That source is a maintenance reobservation. The current policy must not be silently widened merely because a source-specific consequence profile has become machine-verifiable.

This layer therefore answers only:

> Is the exact canonical source-binding evidence sufficiently identified and bounded to be used as input to a future adapter-registration design?

It does not answer:

> Has that adapter been registered, and may a successor append occur?

## Exact upstream evidence

The workflow locates the successful `push/main` run of:

`ConsequenceObservation Source Adapter Main Binding validation`

at exact revision:

`4c76d80ead3e0d8d3af14375a3478cc72beddefa`

and requires the exact artifact:

`consequence-source-main-binding-4c76d80ead3e0d8d3af14375a3478cc72beddefa`

The downloaded `ConsequenceObservationSourceAdapterMainBindingReceipt` must itself prove:

- `main_bound_binding_receipt = true`;
- `candidate_binding_receipt = false`;
- original source revision `0ea85faa957cd924c250e0cea0d0758f855d4fd0`;
- main-bound source evidence verified;
- historical frontier binding consistency verified;
- historical predecessor bytes **not** reverified;
- source may be presented to a future successor policy;
- append permission and execution remain false.

## Historical frontier boundary

The upstream #251 evidence contains the exact digest binding of the historical `ResponsibilityEventSuccessorLedgerEntry`, not the historical entry bytes.

Admission preserves that distinction:

```text
historical_frontier_binding_consistency_preserved = true
historical_frontier_bytes_reverified = false
```

Admission must not manufacture historical bytes or treat re-execution as reconstruction of the old object.

## Positive meaning

A positive `SourceSpecificSuccessorAdmissionReceipt@0.1` may establish only:

- exact canonical MainBindingReceipt verified;
- exact input bytes JCS/SHA-256 bound;
- main-bound source binding accepted;
- source profile admitted for future successor-adapter design;
- source semantics admitted for that bounded design purpose;
- a future adapter-registration proposal may be prepared.

It always keeps:

```text
successor_adapter_registered = false
successor_policy_modified = false
successor_append_may_proceed = false
successor_append_executed = false
```

A separate future policy step is required to register any new successor adapter. A further separate append admission/execution boundary remains required after that.

## Existing successor policy is frozen in this step

This layer must not modify:

`protocols/integration/v0.1/policies/reference.responsibility-event-successor-policy.json`

The workflow checks this directly against the canonical predecessor SHA.

## KONTUR independence

The workflow also verifies:

- no file under `server/kontur/**` is changed;
- the admission evaluator/test does not call KONTUR readiness, preflight, activation, or kernel code;
- `server_runtime_dependency_required = false`.

Existing KONTUR CI jobs may still execute as regression tests of repository code. They are not a runtime dependency of this protocol and do not constitute KONTUR activation.

## Assurance boundary

Admission does not establish:

- a new external consequence;
- generalized external causality;
- causal proof;
- responsibility attribution or adjudication;
- legal liability/effect;
- moral blame/correctness;
- truth;
- global replay protection;
- distributed consensus;
- PoAI materialization;
- universal canonicality.

No scalar responsibility, probability, confidence, readiness, or likelihood score is allowed.

## Candidate versus canonical admission

A PR run may emit a **candidate admission receipt** while consuming an already canonical upstream MainBindingReceipt.

Only a later successful `push/main` run after human squash merge may emit a **main-bound admission receipt**.

Neither receipt registers an adapter or executes an append.

No auto-merge. Human squash merge remains final.
