# Network / User Surface Activation Grant Boundary v0.1

This layer consumes a completed Network / User Surface Externalization Review Receipt and models a **separate bounded synthetic authority-plane grant** for activation of exactly the reviewed network/user-surface shape.

It does **not** enable a network, expose a user surface, bind an external transport, invoke transport, create credentials, deliver a message, or issue a send permit.

## Placement

`... -> Local Synthetic Binding -> Activation Challenge -> Externalization Review Receipt -> Bounded Activation Grant -> later activation materialization -> later network/user-surface enablement -> later send-permit boundary`

## Decisions

- `NOT_APPLICABLE`
- `ACTIVATION_GRANT_NOT_ISSUED`
- `BOUNDED_ACTIVATION_GRANT_ISSUED`
- `ACTIVATION_GRANT_REVOKED`
- `ACTIVATION_GRANT_EXPIRED`

Only `EXTERNALIZATION_REVIEW_COMPLETE_ACTIVATION_REQUIRED` is eligible for grant issuance.

## Grant bounds

The grant is fixed to:

- scope: `THIS_REVIEWED_SYNTHETIC_SURFACE_ONLY`
- capability: `ACTIVATE_REVIEWED_SYNTHETIC_NETWORK_USER_SURFACE`
- duration: `ONE_SESSION`
- expiry: `SESSION_END`
- revocation: `EXPLICIT_OR_SESSION_END`
- exact reviewed binding object, runtime/transport/endpoint refs, and contract refs

It is non-transferable in semantics: no bearer token or endpoint credential is created. A deterministic revocation handle identifies the grant lifecycle without becoming a credential.

## Positive authority effect

An active grant may set:

- `activation_authority_granted = true`
- `network_activation_authority_granted = true`
- `user_surface_activation_authority_granted = true`
- `authority_effect = CREATE_BOUNDED_SYNTHETIC_SURFACE_ACTIVATION_AUTHORITY`

This is **authority-plane only**. `action_effect` and `successor_effect` remain `NONE`.

Revocation and expiry remove current activation authority while preserving the historical fact that the grant existed.

## Core boundaries

- `Externalization Review Complete != Activation Granted`
- `Activation Grant Issued != Network Enabled`
- `Activation Grant Issued != User Surface Exposed`
- `Activation Authority != ActionPermit`
- `Activation Authority != Send Permit`
- `Network Activation Authority != Network Connection`
- `User Surface Activation Authority != User Exposure`
- `Grant Receipt != Activation Token`
- `Revocation Handle != Bearer Credential`
- `Synthetic Activation Authority != Real-World Authority`
- `One Session Grant != Persistent Activation Authority`
- `Revoked Grant != Never-Issued Grant`
- `Expired Grant != Erased Grant`
- `Grant Digest != Connection`

## Mandatory non-effects

Even for `BOUNDED_ACTIVATION_GRANT_ISSUED`:

- `network_enabled = false`
- `user_surface_enabled = false`
- `network_connection_created = false`
- `user_surface_exposure_created = false`
- `live_runtime_enabled = false`
- `external_transport_bound = false`
- `send_permit = false`
- `send_authority = false`
- `transport_invoked = false`
- `delivery_attempted = false`
- no credentials or secrets are created
- no ActionPermit or successor permit is created
- no proactive/background messaging, gameplay control, profiling, persistence, cross-session/cross-game expansion, or Stable Core promotion is enabled

Connectedness remains `LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL`.

## Why a separate grant exists

Review sufficiency and authority issuance are different proof events. A reviewer can conclude that the reviewed contracts are sufficient without itself granting activation. The grant then records a narrow, revocable authority-plane fact while preserving a downstream requirement for a separate activation/materialization step.

This prevents a common collapse:

`review passed -> network enabled`

The intended sequence remains:

`review passed -> separate bounded grant -> separate activation materialization -> separate enablement -> separate send permission`.

## Validation

`validate.py` reconstructs seven complete externalization-review receipts from the synthetic KONTUR conversation stack, checks default non-issuance, active grants, revocation, expiry, non-applicable reviews, exact provenance binding, grant bounds, and fail-closed mutations covering widened scope/capability, forged real-world authority, credentials, network/user-surface effects, transport invocation, send permission, persistence, lifecycle misuse, and forged connectedness.

The workflow is read-only and is also included in the umbrella KONTUR cross-layer validation chain.
