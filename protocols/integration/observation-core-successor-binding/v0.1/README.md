# UU-AAP Observation Evidence ↔ Core Outcome/Successor Binding v0.1

**Status:** experimental stacked reusable post-execution profile  
**Issue:** #371  
**Dependency:** #369 / PR #370

## Purpose

Bridge one exact Core `ActionReceipt` to independently observed successor evidence, then to Core-valid `OutcomeReceipt` and `SuccessorStateReceipt`.

```text
ActionReceipt(predecessor frontier)
  -> independent observation
  -> OutcomeReceipt(successor frontier)
  -> SuccessorStateReceipt(same successor frontier)
```

This complements the existing `ObservationReceipt` integration surface. A Git-object readback receipt is one possible source; no observation provider is mandatory.

## Boundaries

`observation != execution`, `observed successor != causality proof`, and `post-action evidence != future authority` are normative. Outcome and successor evidence must not certify truth, liability, universal canonicality, authority expansion or future permission.

## Core alignment

The `OutcomeReceipt` has the exact `ActionReceipt` as predecessor and moves to the independently observed successor frontier. The `SuccessorStateReceipt` has the exact `OutcomeReceipt` as predecessor and stays on that same successor frontier. Both use Core v0.1 identity hashing.

## Conformance

The validator rejects action-binding substitution, missing independent readback, predecessor/successor collapse, wrong Core predecessors, frontier relabeling, receipt hash laundering, execution replay claims, causality/truth/liability/canonicality escalation and authority/future-permission escalation.

CI is read-only and performs no external observation or action.
