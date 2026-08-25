# KONTUR Game Companion — Cross-Cutting Safety Boundary v0.1

Status: synthetic / non-executing / cross-cutting constraint plane

Related: #445, #458, #459, #460. Audit findings: F-005, F-007.

Origin frontier: `af14ba8154665db069055d9cc8b6f27d7aa51063`

## Purpose

This contract closes two evidence gaps identified by the connectivity audit without adding an eighth causal layer to the Game Companion chain.

`Cross-Cutting Constraint != Causal Successor`

It machine-represents broad non-effects that were previously stated unevenly across specifications, and it materializes two remaining prose-only invariants:

- `Advice != Command`
- `Correction by Player != Model Defeat`

The contract applies across the existing seven-layer Game Companion line while preserving each layer's local semantics and the exact dependency chain introduced by #459.

## Canonical non-effects

The following effects remain denied at this cross-cutting boundary:

- live response generation;
- proactive messaging;
- background activity;
- autonomous gameplay;
- game-account control;
- external effects;
- action permits;
- successor permits;
- response authority creation;
- behavioral profiling;
- psychological inference;
- mood inference;
- attention tracking;
- engagement maximization;
- retention optimization;
- cross-game preference profiling;
- total-history capture;
- automatic Stable Core promotion.

All are machine-readable and must remain `false`.

`Documented Non-Effect != Enforced Non-Effect`

This contract exists specifically so these broad denials are deterministically enforced rather than merely repeated in prose.

## Advice is not command

Advice is admissible only when it remains optional and ignorable.

The contract distinguishes:

- `advice_present` from `command_semantics`;
- useful recommendation from compliance requirement;
- conversational guidance from external control;
- candidate wording from an action permit.

A candidate violates the boundary if advice is represented as mandatory, non-ignorable, externally controlling, or permit-creating.

`Advice != Command`

`Recommendation != Compliance Requirement`

`Strong Suggestion != External Control`

`Advice != Action Permit`

## Player correction is not model defeat

A player correction may require local revision or may remain contested, but it does not create a global factual authority, durable player authority, or a declaration that the model has been defeated.

`Correction by Player != Model Defeat`

`Local Revision != Global Truth`

`Player Correction != Universal Player Authority`

`Changed Hypothesis != Rewritten Provenance`

The synthetic cases explicitly distinguish a healthy local revision from forbidden model-defeat framing, global-truth promotion, and generalized authority transfer.

## Scope

This is a cross-cutting constraint plane over the existing layers:

1. observational-lane
2. assistance-gate
3. shared-discovery-memory
4. bounded-initiative
5. focus-diversity
6. interaction-receipt
7. pause-resume

It does not replace, reorder, or become a predecessor/successor in that chain.

## Non-authority boundary

`Safety Boundary != Authority`

`Boundary Satisfaction != Response Authorization`

`Boundary Satisfaction != Action Permit`

`Boundary Satisfaction != Successor Permit`

A passing case means only that the tested candidate does not violate this cross-cutting contract.

## Validation

Run from repository root:

```bash
python pilots/kontur-game-companion/safety-boundary/validate.py
```

The validator checks exact cross-layer scope, the complete denied-effect set, the two explicit invariants, canonical synthetic cases, source evidence paths, and a fail-closed mutation suite.
