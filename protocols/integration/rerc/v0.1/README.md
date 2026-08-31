# RERC / Reversible Epistemic Redundancy Control v0.1

**Status:** experimental integration profile / provider-neutral / non-actuating  
**Tracking issue:** #879  
**Origin frontier:** `0039375897f2de683afac62e902335f53a1a7d98`

RERC separates a source-rich **Observed Relation Graph** from a reduced **Operational Graph**.

Every operational suppression is explicit and produces a `RERCSuppressionCompressionReceipt` that retains the
complete suppressed relations and their evidence references. The compressor immediately reconstructs the source
graph and will not emit a receipt unless its canonical digest is reproduced exactly.

## Categorical redundancy

`REPRESENTATIONAL | CAUSAL | EVIDENTIARY | COORDINATION | PROTECTIVE`

No scalar score is used. `PROTECTIVE` relations are non-suppressible in v0.1.

A declared `redundancy_group` constrains which relation may be removed from the active operational view: at least
one relation in the same group must remain. The group is caller/source metadata, not proof that relations are
semantically equivalent.

## Invariants

`Redundant != Invalid`

`Suppressed Operationally != Ontologically Deleted`

`Compression != Evidence Destruction`

`Operational Graph != Observed Relation Graph`

`Redundancy Group != Semantic Equivalence Proof`

`Simplification != Fact Creation != Authority Creation`

`Evidence Preserved != Evidence Trusted`

## Reversibility

`restoreGraph(operational_graph, receipt)` verifies the operational digest, source binding, retained/suppressed
partition and exact source edge order. Receipt or operational mutation fails closed.

## Relation to ERD

RERC and Event-Responsive Dormancy are independently reusable. ERD is only the repository predecessor in the
selected implementation sequence. A later composition may combine both under the principle:

`Cost Reduction != Loss of Recoverable State != Authority Creation`.

## Non-effects

No Stable Core/SPEC/roadmap/interface-registry change, no external graph mutation, no evidence deletion,
no authority/ActionPermit, no runtime activation, no release/tag, and no Workbench reactivation.
