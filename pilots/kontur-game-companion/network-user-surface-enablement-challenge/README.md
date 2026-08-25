# Network / User Surface Enablement Challenge v0.1

This synthetic, non-executing package sits after
`network-user-surface-activation-materialization`.

It consumes only a local
`SYNTHETIC_ACTIVATION_STATE_MATERIALIZED` receipt and may create a bounded local
challenge asking whether the exact reviewed network/user-surface shape should enter a
separate enablement review. It does not enable a network, expose a user surface, bind a
live endpoint, invoke transport, deliver a message, or issue enablement/send authority.

## Placement

```text
... → Bounded Activation Grant
    → Local Synthetic Activation State
    → Enablement Challenge
    → later Enablement Externalization Review
    → later Bounded Enablement Grant
    → later Enablement Materialization
    → later Send-Permit Boundary
```

The challenge is the first evidence step after local activation-state materialization.
It is not any of the later boundaries.

## Decisions

- `NOT_APPLICABLE`
- `ENABLEMENT_CHALLENGE_NOT_CREATED`
- `LIFECYCLE_RECHECK_REQUIRED`
- `BOUNDED_ENABLEMENT_CHALLENGE_CREATED`

Challenge creation requires an explicit request and fresh confirmation that the source
activation state remains local, reversible, not rolled back, and bound to the same
reviewed runtime/transport/endpoint, network, and user-surface evidence.

## Positive local effect

A successful challenge may create only:

- `enablement_challenge_created = true`;
- a deterministic `enablement_challenge_ref`;
- requirements for a separate externalization review, grant, materialization, and
  send-permit boundary;
- `challenge_effect = CREATE_LOCAL_SYNTHETIC_ENABLEMENT_CHALLENGE_ARTIFACT`.

## Core boundaries

- `Activation State Materialized != Enablement Requested`
- `Enablement Challenge != Enablement Review`
- `Enablement Challenge != Enablement Grant`
- `Enablement Challenge != Network Enabled`
- `Enablement Challenge != User Surface Exposed`
- `Challenge Ref != Endpoint Credential`
- `Lifecycle Rechecked != Future Freshness`
- `Local Activation State != External Connectedness`
- `Receipt != Authority`
- `Challenge != ActionPermit`
- `Challenge != Successor Permit`
- `Enablement Challenge != Send Permit`

## Bounds

The challenge is bound to:

- one activation materialization receipt and digest;
- the exact activation, network-state, and user-surface-state refs;
- the exact reviewed runtime/transport/endpoint binding;
- the exact network and user-surface contracts;
- rollback and delivery-audit refs;
- one synthetic session;
- one later review capability only.

## Copyright and IP-process isolation

The challenge has no dependency on licensing, copyright, patent, legal-author-identity,
or pseudonym-publication processes. It cannot request or record changes to those
processes. No `LICENSE`, `NOTICE`, legal, IP-governance, author-identity, or
pseudonym-publication file is modified by this package.

## Non-effects

Even after `BOUNDED_ENABLEMENT_CHALLENGE_CREATED`, all of the following remain false:

- network enablement or connection;
- user-surface enablement or exposure;
- live runtime/external transport binding;
- transport invocation, delivery attempt, or payload persistence;
- enablement review completion;
- enablement grant or authority;
- enablement materialization;
- send permit/send authority;
- credentials, secrets, or bearer tokens;
- ActionPermit/successor permit;
- proactive/background messaging;
- autonomous gameplay/account control/profiling;
- persistent/cross-session/cross-game enablement;
- Stable Core promotion;
- copyright, licensing, legal-author-identity, or pseudonym-publication modification.

Connectedness remains
`LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL`.

## Validation

`validate.py` rebuilds seven upstream local activation states, proves deterministic
default non-creation and bounded challenge creation, checks lifecycle freshness and
exact provenance, and rejects authority, enablement, sending, credential, scope,
external-connectedness, and copyright/IP-process mutations fail closed.


