# KONTUR Game Companion — Runtime / Transport Binding Review Receipt v0.1

Status: `SYNTHETIC_NON_EXECUTING`

Historical origin frontier: `7633f6d2d21922cf8ee03fa1f225b9c97f469a07`.

## Purpose

This layer consumes a `READY_FOR_BINDING_REVIEW` result from Runtime / Transport Binding Challenge v0.1 and records a bounded review of the proposed runtime, transport and endpoint descriptors, their attestations, grant scope/capability match, and current grant lifecycle.

It is a review receipt only. It does **not** create the binding being reviewed.

Placement:

`Bounded Authority Grant -> Binding Challenge -> Binding Review Receipt -> separate binding step required -> no send`

## Review dimensions

The review separately records:

- runtime descriptor review / sufficiency;
- transport descriptor review / sufficiency;
- endpoint descriptor review / sufficiency;
- runtime attestation review / sufficiency;
- transport attestation review / sufficiency;
- grant scope match review / validity;
- grant capability match review / validity;
- current grant lifecycle review / validity.

A positive outcome may only exist if the corresponding dimension was explicitly reviewed.

## Decisions

- `NOT_APPLICABLE`
- `REVIEW_INCOMPLETE`
- `REVIEW_REJECTED_RUNTIME_DESCRIPTOR`
- `REVIEW_REJECTED_TRANSPORT_DESCRIPTOR`
- `REVIEW_REJECTED_ENDPOINT_DESCRIPTOR`
- `REVIEW_REJECTED_RUNTIME_ATTESTATION`
- `REVIEW_REJECTED_TRANSPORT_ATTESTATION`
- `REVIEW_REJECTED_SCOPE`
- `REVIEW_REJECTED_CAPABILITY`
- `REVIEW_REJECTED_LIFECYCLE`
- `REVIEW_COMPLETE_BINDING_REQUIRED`

The strongest result means only that the bounded material was sufficient for a separate binding decision. There is intentionally no `BOUND`, `AUTHORIZED`, `CONNECTED`, `SEND_ALLOWED`, or `ACTIVATED` state.

## Core boundaries

- `Descriptor Presented != Descriptor Reviewed`
- `Descriptor Reviewed != Descriptor Sufficient`
- `Attestation Presented != Attestation Reviewed`
- `Attestation Reviewed != Identity Proven`
- `Endpoint Descriptor Sufficient != Endpoint Credential`
- `Scope Match Valid != Scope Ownership`
- `Capability Match Valid != Capability Executed`
- `Lifecycle Current != Future Validity`
- `Binding Review Complete != Binding Authorized`
- `Binding Review Receipt != Binding Token`
- `Binding Sufficiency != Runtime Connectedness`
- `Binding Sufficiency != Send Permit`
- `Reviewer Claim != Reviewer Identity Proof`
- `Independent Review Asserted != Independent Review Proven`
- `Review Digest != Connection`

## Non-effects

Even `REVIEW_COMPLETE_BINDING_REQUIRED` must keep all of the following false:

- binding authorization or binding decision token creation;
- runtime or transport binding creation;
- live runtime / external transport connectedness;
- network or user-surface enablement;
- credential or secret material creation;
- send permit, send authority or response authority;
- delivery attempt or transport invocation;
- external effect, ActionPermit or successor permit;
- payload persistence;
- proactive/background messaging, autonomous gameplay or account control;
- profiling, cross-game scope or persistent binding;
- Stable Core promotion.

The connectedness marker remains `AUTHORITY_PLANE_ONLY_NOT_BOUND`.

## Validation

`validate.py` rebuilds seven `READY_FOR_BINDING_REVIEW` challenges from the integrated synthetic conversation stack, checks incomplete, rejected and fully-passed review states, then applies fail-closed mutations against review context, receipt, upstream challenge provenance and all forbidden runtime/send effects.

Run:

```bash
python pilots/kontur-game-companion/runtime-transport-binding-review/validate.py
```

This layer is a pilot constraint/receipt layer, not a new Stable Core primitive and not live KONTUR connectivity.
