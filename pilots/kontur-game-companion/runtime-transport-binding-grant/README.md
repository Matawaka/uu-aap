# KONTUR Game Companion — Separate Runtime / Transport Binding Grant Boundary v0.1

Status: `SYNTHETIC_NON_EXECUTING`

Historical origin frontier: `aa895ae1dfadf32f6944394179181e801096e662`.

## Purpose

This layer consumes `REVIEW_COMPLETE_BINDING_REQUIRED` from Runtime / Transport Binding Review Receipt v0.1 and models a separately issued, bounded **binding authority grant**.

It does **not** create a runtime binding, transport binding, endpoint credential, network connection, send permit, user exposure, or live KONTUR activation.

Placement:

`... -> Binding Challenge -> Binding Review Receipt -> Separate Binding Grant -> later binding materialization still required -> no send`

## Grant lifecycle

- `NOT_APPLICABLE`
- `BINDING_GRANT_NOT_ISSUED`
- `BOUNDED_BINDING_GRANT_ISSUED`
- `BINDING_GRANT_REVOKED`
- `BINDING_GRANT_EXPIRED`

Only a complete binding review may enter this layer. The grant is limited to:

- scope: `THIS_REVIEWED_BINDING_ONLY`;
- capability: `MATERIALIZE_REVIEWED_SYNTHETIC_BINDING`;
- duration: `ONE_SESSION`;
- expiry: `SESSION_END`;
- revocation: `EXPLICIT_OR_SESSION_END`;
- the exact reviewed runtime / transport / endpoint descriptor and attestation references.

The grant can create authority only in this synthetic binding-authority plane. It cannot itself execute that authority.

## Core boundaries

- `Binding Review Complete != Binding Grant Issued`
- `Binding Grant Issued != Binding Created`
- `Binding Authority != Runtime Binding`
- `Binding Authority != Transport Binding`
- `Binding Authority != Send Permit`
- `Grant Receipt != Endpoint Credential`
- `Reviewed Descriptor Set != Bound Endpoint`
- `Grant Scope != Persistent Binding`
- `Granted Capability != Executed Binding`
- `Revocable != Revoked`
- `Revoked Grant != Erased Grant`
- `Expired Grant != Renewable Authority`
- `Binding Grant Digest != Connection`
- `Synthetic Binding Authority != Real Runtime Authority Proof`

## Non-effects

Even `BOUNDED_BINDING_GRANT_ISSUED` must keep all of the following false:

- runtime or transport binding creation;
- live runtime / external transport connectedness;
- network or user-surface enablement;
- endpoint credential or secret material creation;
- send permit, send authority or response authority;
- delivery attempt or transport invocation;
- external effect, ActionPermit or successor permit;
- payload persistence;
- proactive/background messaging, autonomous gameplay or account control;
- profiling, cross-game or cross-session binding;
- Stable Core promotion.

The connectedness marker remains `AUTHORITY_PLANE_ONLY_NOT_BOUND`.

## Validation

`validate.py` deterministically rebuilds the seven complete binding review receipts from the merged synthetic conversation stack, checks not-issued / issued / revoked / expired lifecycle states, verifies non-complete reviews cannot receive a binding grant, and applies fail-closed mutations against scope, capability, lifecycle, provenance and all forbidden runtime/send effects.

Run:

```bash
python pilots/kontur-game-companion/runtime-transport-binding-grant/validate.py
```

This is a pilot authority-boundary layer, not a Stable Core primitive and not live KONTUR connectivity.
