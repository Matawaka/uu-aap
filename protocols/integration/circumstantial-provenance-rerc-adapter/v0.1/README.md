# Circumstantial Provenance → RERC Adapter v0.1

This package materializes the `RERC_ONLY` adapter fit qualified by merged #884 for Circumstantial Provenance / Evidence Independence v0.1.

It is a bounded operational projection. It does **not** modify the Circumstantial Provenance assessment, replace its validator, change RERC semantics, require ERD/RSIC, or promote either component into Stable Core.

## Canonical flow

```text
valid Circumstantial Provenance assessment
        ↓
provider-neutral relation projection
        ↓
RERC observed graph
        ↓
adapter derives only safe representational candidates
        ↓
existing RERC compressGraph(...)
        ↓
operational graph + RERC receipt + adapter receipt
        ↓
existing RERC restoreGraph(...)
        ↓
exact fresh projection equality
```

The source assessment remains unchanged throughout.

## Mapping

Each Circumstantial Provenance evidence item remains a node. Its evidence-to-claim relation becomes an RERC edge.

| Circumstantial Provenance condition | RERC mapping | Adapter suppression policy |
| --- | --- | --- |
| independent/non-derived support | `EVIDENTIARY` | never selected |
| contradiction | `PROTECTIVE` | forbidden |
| `full_payload_required=true` | `PROTECTIVE` | forbidden |
| explicit lineage gap | `PROTECTIVE` | forbidden |
| valid same-group `derived_copy` with retained non-derived peer | `REPRESENTATIONAL` | candidate |
| derived copy without a retained non-derived peer | `REPRESENTATIONAL` | retained |

A shared `independence_group` is used only as an operational grouping boundary. It is **not** evidence that two relations are semantically equivalent.

## Canonical fixture result

The accepted #721 fixture projects as:

```text
ev-direct        EVIDENTIARY   retained
ev-witness       EVIDENTIARY   retained
ev-copy          REPRESENTATIONAL → suppressed relation edge
ev-contradiction PROTECTIVE    retained
gap-1            PROTECTIVE    retained
```

The evidence item `ev-copy` itself is not deleted from the source assessment. Only its operational projected relation edge may be absent from the RERC operational graph.

## Direct reuse proof

`adapter.js` imports and calls the accepted modules directly:

```text
protocols/integration/circumstantial-provenance/v0.1/validate-circumstantial-provenance.js
protocols/integration/rerc/v0.1/rerc.js
```

Suppression, receipt validation and restoration are performed by the existing RERC implementation. The adapter does not reimplement RERC's last-relation, protective-redundancy or exact-restore semantics.

## Invariants

```text
Derived Copy != Independent Evidence
Operational Suppression != Provenance Deletion
Suppressed Relation != Invalidated Relation
RERC Redundancy Group != Semantic Equivalence Proof
Exact Restoration != Historical Rewrite
Adapter Receipt != Truth / Authority / Identity / Causality / Responsibility / Liability
RERC_ONLY != RSIC Composition Demand
Adapter Reuse != Stable Core Admission
```

No scalar trust, independence, confidence, redundancy or compatibility score is defined.

## Source binding

`source-bindings.json` binds the accepted #884 qualification case, Circumstantial Provenance README/validator/fixture, and accepted RERC module/implementation receipt by Git blob.

Dedicated CI reruns both predecessor validators unchanged, verifies source blobs, runs the 23 hostile/positive adapter tests, validates the emitted adapter receipt against the closed JSON Schema, proves deterministic exact restoration, and guards the change set as adapter/workflow-only.

## Non-effects

No Stable Core/SPEC/PRINCIPLES mutation, Interface Registry successor, ERD dependency, RSIC promotion, Circumstantial Provenance source mutation, RERC source mutation, external effect, ActionPermit, release/tag, Workbench reactivation, or exploratory-lane promotion is performed.
