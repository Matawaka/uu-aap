# KONTUR Human Activation Review v0.1

## Status

This contract inserts an explicit human review boundary between project readiness and construction of a `KONTURActivationIntent`.

The chain is:

```text
current canonical main
-> current-main frontier verification
-> ProjectReadinessCheckpointReceipt
-> KONTURHumanActivationReviewPacket
-> explicit human review decision
-> at most activation_intent_preparation_may_be_requested
-> KONTURActivationIntent (separate future artifact)
-> fresh preflight
-> separate human execute command
-> Activation Executor
```

No step in this document activates KONTUR.

## Why this layer exists

Independent bounded KONTUR audit and targeted re-audit reached `READY_FOR_HUMAN_ACTIVATION_REVIEW` / `AUDIT_HARDENING_VERIFIED_READY_FOR_HUMAN_ACTIVATION_REVIEW` while preserving that readiness is not activation.

Those audit conclusions motivate this review layer but are not silently converted into machine authority. Repository evidence and human decision remain distinct.

## Review packet

`KONTURHumanActivationReviewPacket v0.1` is revision-bound and may be prepared only when:

- the exact `ProjectReadinessCheckpointReceipt v0.1` is established for the same Git revision;
- the exact `KONTURCurrentMainFrontierVerificationReceipt v0.1` proves `push -> refs/heads/main` for that revision;
- both predecessor artifacts still preserve the human activation boundary and deny activation/execution/ownership/legal/truth overclaims.

The packet's strongest state is:

`ready_for_human_activation_review`

and its only safe next step is:

`human_review_decision_only`

The packet itself must keep false:

- human review decision recorded;
- activation intent preparation authorized;
- activation intent created;
- preflight requested;
- execute command created;
- KONTUR activated;
- responsibility state created or accepted;
- execution authority granted;
- permission expansion or bypass authorized;
- repository ownership transfer;
- canonical-origin mutation;
- legal authority;
- truth certification;
- distributed consensus.

## Human confirmations

A positive review decision requires the reviewer to explicitly confirm all of the following:

1. the exact revision and review packet are understood;
2. only already-existing permissions may be used;
3. permission bypass or escalation is prohibited;
4. an activation intent is a separate future artifact;
5. preflight remains separate and must be fresh;
6. an execute command requires a separate human step;
7. holder, responsibility scopes and lease must be explicitly chosen before intent construction;
8. activation does not establish legal truth or universal authority.

These are decision-time confirmations, not psychological or competence assessments.

## Human decision

The decision artifact supports exactly three outcomes:

- `approve_intent_preparation`
- `defer`
- `reject`

A positive decision requires the exact typed confirmation:

`APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY`

Its strongest effect is only:

`activation_intent_preparation_may_be_requested = true`

It still does not create `KONTURActivationIntent`, run preflight, create an execute command, call the Responsibility Kernel, write the Durable Responsibility Ledger, or activate KONTUR.

`defer` and `reject` both have `safe_effect = no-action`.

## Permission ceiling

Human review cannot expand KONTUR permissions.

```text
review approval
!= new permission
!= permission escalation
!= permission bypass
```

If a later activation intent would require a permission not already granted, that later operation must fail closed rather than treating review approval as permission expansion.

## Revision drift

A review packet is bound to one exact canonical Git revision. Any later `main` commit makes the packet historical for current-main activation consideration.

A successor packet must be produced from a fresh current-main frontier/checkpoint for the new revision.

`reviewed once != current forever`

## CI boundary

The validation workflow may automatically generate a **review packet** on canonical `push` to `main`.

It must never automatically generate a positive human review decision.

The workflow is read-only with respect to the repository and must not invoke:

- activation preflight;
- activation executor;
- Responsibility Kernel activation;
- Durable Responsibility Ledger genesis creation;
- GitHub/repository permission mutations.

The human decision remains outside automatic CI execution.
