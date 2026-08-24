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

Independent bounded KONTUR audit and targeted re-audit reached readiness for human activation review while preserving that readiness is not activation.

The later long-run bounded audit recorded in `audits/kontur/2026-08-24-main-2a0fbd4d/` found three Medium defects in this review contract and concluded `READY_FOR_MORE_TESTING`. This contract was then hardened to address those findings without changing Activation Preflight, Activation Executor, Responsibility Kernel, or Durable Responsibility Ledger behavior.

Audit evidence and human decision remain distinct. Audit remediation is not activation authorization.

## Review packet

`KONTURHumanActivationReviewPacket v0.1` is revision-bound and may be prepared only when:

- the exact `ProjectReadinessCheckpointReceipt v0.1` is established for the same Git revision;
- the exact `KONTURCurrentMainFrontierVerificationReceipt v0.1` proves `push -> refs/heads/main` for that revision;
- the checkpoint's own current-main verification binding exactly matches the supplied current-main verification receipt by artifact type, artifact reference, and RFC8785/JCS SHA-256 digest;
- both predecessor artifacts still preserve the human activation boundary and deny activation/execution/ownership/legal/truth overclaims;
- packet preparation occurs after both predecessor timestamps.

The packet's strongest state is:

`ready_for_human_activation_review`

and its only safe next step is:

`human_review_decision_only`

The packet has a finite 24-hour validity interval. Expiry does not authorize refresh, inheritance, or fallback. A successor packet must be reconstructed from fresh predecessor evidence.

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

The JSON Schema couples each outcome to its exact declaration type, typed confirmation, safe effect, and positive/negative claim. A syntactically valid but semantically contradictory decision must fail validation.

A positive decision requires the exact typed confirmation:

`APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY`

Its strongest effect is only:

`activation_intent_preparation_may_be_requested = true`

It still does not create `KONTURActivationIntent`, run preflight, create an execute command, call the Responsibility Kernel, write the Durable Responsibility Ledger, or activate KONTUR.

`defer` and `reject` both have `safe_effect = no-action`.

## Decision-time revalidation

Decision construction is not allowed to trust the packet by shape alone.

It must:

- revalidate the packet's complete bounded semantics;
- reconstruct the packet from the exact checkpoint and current-main verification predecessors and require an identical RFC8785/JCS SHA-256 digest;
- require a fresh observed current Git revision exactly equal to the packet revision;
- require `prepared_at <= reviewed_at <= observed_at <= expires_at`;
- fail after packet expiry;
- require an explicit complete prior-decision history;
- reject a reused decision nonce;
- reject a second decision for a packet that already has a recorded prior decision.

The review decision records this bounded context as `review_context`, including current revision observation, packet expiry, complete-history assertion, prior-decision count, and positive replay-guard results.

This is fail-closed replay protection relative to the supplied complete decision history. It does not claim universal knowledge of decision artifacts outside that history.

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

## Single-decision packet boundary

A packet is single-decision within the supplied complete decision history.

```text
packet prepared != decision recorded
first decision recorded != permission to overwrite decision
same nonce again != new decision
same packet with different nonce != second decision
```

A changed human conclusion requires a successor review packet rather than mutation or replay of the prior packet.

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

## Preserved non-equivalences

```text
readiness != activation
review packet != human decision
review approval != activation intent
review approval != preflight
review approval != execute command
review approval != responsibility acceptance
review approval != execution authority
review approval != permission expansion
review approval != legal liability
review approval != truth certification
```
