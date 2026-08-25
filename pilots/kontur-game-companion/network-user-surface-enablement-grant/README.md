# Network / User Surface Bounded Enablement Grant v0.1

Status: **synthetic / non-executing / authority-plane only**.

This package consumes only an
`ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED` receipt and models a
separate, bounded, revocable authority-plane decision for materializing the exact
reviewed local synthetic enablement state.

Authorization to develop this boundary is not an issued grant. The default result is
`ENABLEMENT_GRANT_DECISION_REQUIRED`. A grant can be represented only when an explicit
human decision assertion and a bounded decision-evidence reference are supplied.

## Placement

```text
... -> Enablement Challenge
    -> Enablement Externalization Review Receipt
    -> Bounded Enablement Grant (this package)
    -> later local enablement materialization
    -> later external enablement boundary
    -> later send-permit boundary
```

This package does not implement any of the later steps.

## Human decisions

- `NO_HUMAN_DECISION`
- `DENY_BOUNDED_SYNTHETIC_ENABLEMENT`
- `REQUEST_MORE_ENABLEMENT_EVIDENCE`
- `GRANT_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION`

The code validates an asserted decision and its provenance. It does not authenticate a
human identity, infer consent from silence, or manufacture a decision from CI success,
repository state, or the preceding review receipt.

## Grant decisions

- `NOT_APPLICABLE`
- `ENABLEMENT_GRANT_DECISION_REQUIRED`
- `ENABLEMENT_GRANT_DENIED`
- `ENABLEMENT_GRANT_MORE_EVIDENCE_REQUIRED`
- `BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED`
- `ENABLEMENT_GRANT_REVOKED`
- `ENABLEMENT_GRANT_EXPIRED`

## Grant bounds

- scope: `THIS_REVIEWED_LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY`
- capability: `MATERIALIZE_LOCAL_SYNTHETIC_NETWORK_USER_SURFACE_ENABLEMENT_STATE`
- duration: `ONE_SYNTHETIC_SESSION`
- expiry: `SYNTHETIC_SESSION_END`
- revocation: `EXPLICIT_OR_SYNTHETIC_SESSION_END`
- provenance: the exact review, challenge, activation-state, binding, contract,
  rollback, and audit references

The decision-evidence reference and revocation handle are non-bearer identifiers. They
are neither credentials nor tokens.

## Positive authority effect

Only an active `BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED` may set:

- `enablement_authority_granted = true`;
- `network_enablement_authority_granted = true`;
- `user_surface_enablement_authority_granted = true`;
- `enablement_materialization_required = true`;
- `authority_effect = CREATE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY`.

This is a local synthetic authority-plane fact only. It does not itself materialize an
enablement state. `action_effect` and `successor_effect` remain `NONE`.

## Core boundaries

- `Permission to Implement Grant Boundary != Grant Issued`
- `Review Complete != Enablement Granted`
- `Human Decision Asserted != Human Identity Proven`
- `Decision Evidence Ref != Credential`
- `Enablement Grant Issued != Enablement Materialized`
- `Enablement Authority != Network Enabled`
- `Enablement Authority != User Surface Exposed`
- `Enablement Authority != Send Permit`
- `Grant Receipt != Bearer Token`
- `Revocation Handle != Credential`
- `Synthetic Authority != Real-World Authority`
- `One Synthetic Session != Persistent Authority`
- `Revoked Grant != Never-Issued Grant`
- `Expired Grant != Erased Grant`
- `Grant != ActionPermit`
- `Grant != Successor Permit`

## Mandatory non-effects

Even for an active grant:

- no network connection or enablement;
- no user-surface exposure or enablement;
- no live runtime or external transport binding;
- no endpoint resolution or transport invocation;
- no delivery attempt or payload persistence;
- no send permit or send authority;
- no credentials, secrets, bearer tokens, ActionPermit, or successor permit;
- no proactive/background messaging, gameplay control, account control, profiling,
  persistence, cross-session/cross-game scope, or Stable Core promotion;
- no copyright, licensing, legal-author-identity, or pseudonym-publication modification.

Connectedness remains
`LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL`.

## Validation

`validate.py` reconstructs seven complete enablement-review receipts, proves default
non-issuance, denial, more-evidence, active grant, revocation, expiry, and
non-applicability, and rejects forged decisions, widened bounds, provenance drift,
credentials, external effects, sending, persistence, and copyright/IP-process changes
fail closed.
