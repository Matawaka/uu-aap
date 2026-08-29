# DLC-SI v0.1 — first bounded slice

Extends CCRP for simultaneous legitimate claims constrained by a singular interface.

First-slice path:

`PriorityClaim × SharedInterfaceDescriptor → InterfaceContention → TEMPORARY_PRECEDENCE | DEFERRED | UNRESOLVED → ContestedActionReceipt`

## Authority rule

`TEMPORARY_PRECEDENCE` may be produced by either:

1. an explicit human resolution for the concrete contention; or
2. a previously human-authorized `BOUNDED_PRECEDENCE_POLICY` whose scope, allowed grounds, maximum lease and revisit triggers cover the decision.

The resolver cannot create or enlarge such policy authority. Outside policy scope the result remains `UNRESOLVED` and requires human resolution.

## Invariants

- Legitimacy != Priority.
- Precedence != Victory.
- Selection != Erasure.
- Interface Singularity != Normative Singularity.
- Temporary Precedence != Permanent Authority.
- Deferred Claim != Invalid Claim.
- A bounded policy is not self-authorizing.
- Arrival order, implementation convenience and interface capacity alone do not establish normative victory.

This slice creates no external-effect authority and does not execute contested actions.
