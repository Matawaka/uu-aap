# Local Synthetic Network / User Surface Enablement Materialization v0.1

Status: **synthetic / non-executing / local-only**.

This package consumes only an active
`BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED` receipt and may create a local,
reversible enablement-state artifact for exactly the reviewed activation state and
network/user-surface shape.

It does not enable or connect a network, expose a user surface, resolve an endpoint,
bind or invoke transport, deliver a message, create credentials, or issue a send
permit.

## Placement

```text
... -> Bounded Enablement Grant
    -> Local Synthetic Enablement State (this package)
    -> local trial pilot
    -> later external-enablement decision
    -> later send-permit boundary
```

## Decisions

- `NOT_APPLICABLE`
- `ENABLEMENT_NOT_MATERIALIZED`
- `LIFECYCLE_RECHECK_REQUIRED`
- `LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED`

Materialization requires a separate request and fresh confirmation that the grant is
still active, not revoked, not expired, still bound to the reviewed evidence, and that
the asserted decision-evidence reference remains current for the local synthetic scope.

## Positive local effect

A successful result may create only:

- deterministic enablement/network/user-surface state references;
- a deterministic enablement-state digest;
- `enablement_state_artifact_created = true`;
- `enablement_state_local_only = true`;
- `enablement_state_reversible = true`;
- `materialization_effect = CREATE_LOCAL_SYNTHETIC_ENABLEMENT_STATE_ARTIFACT`.

The grant is not consumed and does not become a bearer credential.

## Core boundaries

- `Enablement Grant Issued != Enablement Materialized`
- `Enablement State Materialized != Network Enabled`
- `Enablement State Materialized != User Surface Exposed`
- `Local Enablement State != External Connectedness`
- `Enablement Authority Used != Enablement Authority Consumed`
- `State Digest != Connection`
- `State Ref != Endpoint Credential`
- `Lifecycle Rechecked != Future Freshness`
- `Materialization != ActionPermit`
- `Materialization != Successor Permit`
- `Materialization != Send Permit`
- `Local Pilot Ready != External Pilot Authorized`

## Mandatory non-effects

Even after successful materialization:

- no network enablement or connection;
- no user-surface exposure or enablement;
- no live runtime or external transport binding;
- no endpoint resolution, transport invocation, or delivery attempt;
- no send permit or send authority;
- no credentials, secrets, bearer tokens, ActionPermit, or successor permit;
- no payload persistence, background/proactive messaging, gameplay/account control,
  profiling, cross-session/cross-game enablement, or Stable Core promotion;
- no copyright, licensing, legal-author-identity, or pseudonym-publication change.

Connectedness remains
`LOCAL_SYNTHETIC_ENABLEMENT_STATE_ONLY_NOT_EXTERNAL`.

## Validation

`validate.py` rebuilds seven bounded synthetic enablement grants, proves deterministic
default non-materialization and bounded materialization, checks lifecycle and exact
provenance, rejects revoked/expired grants, and rejects forged external enablement,
sending, credentials, widened scope, external connectedness, and copyright/IP changes
fail closed.
