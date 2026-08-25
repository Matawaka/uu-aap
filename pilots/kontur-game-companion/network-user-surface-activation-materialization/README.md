# Synthetic Network / User Surface Activation Materialization v0.1

This package sits after `network-user-surface-activation-grant`.

It consumes only an active `BOUNDED_ACTIVATION_GRANT_ISSUED` and may create a **local synthetic activation-state artifact** for exactly the reviewed binding/network/user-surface shape. It does not enable a network, expose a user surface, bind a live transport, invoke transport, create credentials, deliver a message, or issue a send permit.

## Placement

`... -> Externalization Review -> Bounded Activation Grant -> Local Synthetic Activation State -> later enablement boundary -> later send-permit boundary`

## Decisions

- `NOT_APPLICABLE`
- `ACTIVATION_NOT_MATERIALIZED`
- `LIFECYCLE_RECHECK_REQUIRED`
- `SYNTHETIC_ACTIVATION_STATE_MATERIALIZED`

Materialization requires a separate request plus a fresh check that the bounded activation grant is still active, not revoked, not expired, and still points at the reviewed binding.

## Positive local effect

A successful materialization may create only:

- `activation_state_artifact_created = true`
- `network_activation_state_materialized = true`
- `user_surface_activation_state_materialized = true`
- deterministic activation/network/user-surface state refs and digest
- `activation_effect = CREATE_LOCAL_SYNTHETIC_ACTIVATION_STATE_ARTIFACT`

The grant is not consumed and does not become a bearer credential.

## Core boundaries

- `Activation Grant Issued != Activation Materialized`
- `Activation State Materialized != Network Enabled`
- `Activation State Materialized != User Surface Exposed`
- `Local Activation State != External Connectedness`
- `Activation Authority Used != Activation Authority Consumed`
- `Activation State Digest != Connection`
- `Activation State Ref != Endpoint Credential`
- `Network Activation State != Network Connection`
- `User Surface Activation State != User Exposure`
- `Lifecycle Rechecked != Future Freshness`
- `Local Structural State != ActionPermit`
- `Materialization != Send Permit`

## Bounds

The materialized state is bound to:

- one activation grant receipt;
- the exact reviewed binding object and runtime/transport/endpoint refs;
- the exact reviewed network and user-surface contracts;
- rollback and delivery-audit refs;
- the activation grant scope/capability/duration and revocation handle;
- one synthetic session.

## Non-effects

Even after `SYNTHETIC_ACTIVATION_STATE_MATERIALIZED`, all of the following remain false:

- network enablement or connection;
- user-surface exposure;
- live runtime/external transport binding;
- send permit/send authority;
- transport invocation or delivery attempt;
- credentials/secrets/bearer tokens;
- ActionPermit/successor permit;
- payload persistence;
- proactive/background messaging;
- autonomous gameplay/account control/profiling;
- persistent/cross-session/cross-game activation;
- Stable Core promotion.

Connectedness becomes only `LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL`.

## Validation

`validate.py` rebuilds seven active activation grants from the synthetic KONTUR conversation stack, verifies default non-materialization, successful bounded materialization, lifecycle recheck requirements, revoked/expired rejection, deterministic refs/digests, exact provenance and fail-closed rejection of forged network/user-surface enablement, credentials, sending, transport invocation, widened scope and external connectedness.
