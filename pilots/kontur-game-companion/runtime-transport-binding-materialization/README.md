# Runtime / Transport Binding Materialization v0.1

Status: **synthetic, local-only, non-executing**.

This layer consumes an active `BOUNDED_BINDING_GRANT_ISSUED` and is the first layer allowed to create a bounded synthetic runtime/transport binding artifact. The artifact binds only the already-reviewed descriptor and attestation references inside a local synthetic state. It does not connect a runtime to an external transport, enable a network, expose a user surface, create an endpoint credential, or permit sending.

## Placement

`... -> Binding Review Receipt -> Bounded Binding Grant -> Local Synthetic Binding Materialization -> later network/user-surface/send gates still required`

## Decisions

- `NOT_APPLICABLE` — binding grant is not active.
- `BINDING_NOT_MATERIALIZED` — active grant exists but no separate materialization request is present.
- `LIFECYCLE_RECHECK_REQUIRED` — materialization was requested but current grant revocation/expiry status has not been rechecked.
- `SYNTHETIC_BINDING_MATERIALIZED` — exact reviewed runtime/transport/endpoint references are bound into a deterministic local synthetic binding object.

## Materialized artifact

A successful materialization derives deterministic SHA-256 references for:

- the local synthetic runtime binding;
- the local synthetic transport binding;
- the locally bound endpoint descriptor;
- the aggregate binding object.

These are provenance references, not credentials or bearer tokens.

The only positive effect is:

`binding_effect = CREATE_LOCAL_SYNTHETIC_BINDING_ARTIFACT`

`authority_effect`, `action_effect`, and `successor_effect` remain `NONE`.

## Mandatory non-effects

Even after `SYNTHETIC_BINDING_MATERIALIZED`:

- `live_runtime_enabled = false`
- `live_runtime_bound = false`
- `external_transport_bound = false`
- `network_enabled = false`
- `user_surface_enabled = false`
- `send_permit = false`
- `transport_invoked = false`
- `external_effect_authorized = false`
- no credentials, secrets, delivery receipt, persistence, proactive/background messaging, autonomous gameplay, account control, profiling, cross-session binding, or Stable Core promotion are created.

The strongest connectedness claim is `LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL`.

## Core boundaries

- `Binding Grant Issued != Binding Materialized`
- `Binding Materialized != Runtime Activated`
- `Runtime Binding Materialized != Live Runtime Bound`
- `Transport Binding Materialized != External Transport Bound`
- `Bound Descriptor != Network Connection`
- `Binding Object != Endpoint Credential`
- `Binding Object != Send Permit`
- `Local Structural Connectedness != External Connectedness`
- `Materialization != Transport Invocation`
- `Materialization != User Exposure`
- `Binding Authority != ActionPermit`
- `Materialized Binding != Persistent Binding`
- `Revoked Grant != Bindable Authority`
- `Expired Grant != Bindable Authority`
- `Binding Digest != Delivery`

## Lifecycle freshness

Materialization requires a separate current-lifecycle recheck. An old active grant receipt is not sufficient by itself: `grant_lifecycle_rechecked`, `grant_not_revoked_confirmed`, and `grant_not_expired_confirmed` must all be true for this materialization event.

## Validation

The validator reconstructs seven active binding grants from the merged synthetic conversation stack, tests unrequested and lifecycle-recheck states, materializes seven deterministic local bindings, checks actual revoked/expired/non-issued grants, and applies fail-closed mutations against provenance, exact reviewed references, local-only semantics, forbidden network/send effects, credential creation, persistent/cross-session expansion, and forged connectedness.

Related: #445, #467, #468, #469, #470, #471, #472, #473, #474, #475, #476, #477, #478, #479, #480.
