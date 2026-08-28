# FCL PreAction Bundle Assembly v0.1

**Status:** experimental read-only artifact materializer  
**Issue:** #568  
**Predecessor:** merged FCL PreAction Evidence Bridge v0.1 (#567)

## Purpose

This profile performs the first production materialization of a reusable `PreActionEvidenceBundle` from the FCL control chain.

It consumes already-existing evidence only:

```text
FCL PreAction Bridge
+ exact Action-Specific Approval
+ exact pre-existing ActionPermit
-> PreActionEvidenceBundle
+ FCLPreActionBundleAssemblyReceipt
```

It does not authorize or execute anything.

## Exact-source rule

Both source artifacts are reproducibility-bound:

- the supplied bridge record must be exactly reproducible from the supplied bridge input;
- the supplied approval receipt must be exactly reproducible from the supplied approval input;
- the approval and bridge must carry byte-identical `ActionPermit` and ActionPermit binding input objects.

Hash equality alone is not used as a substitute for exact source equality.

## Identifier separation

The assembler preserves the mapping established by the bridge:

```text
provider-neutral selected operation != FCL target operation
```

For the current interrupt fixture this remains:

```text
interrupt_run != fcl.run.interrupt
```

Approval binds the FCL target operation. Selection provenance keeps the provider-neutral operation.

## Four-way authorization horizon

Bridge mode has four independent freshness constraints:

```text
Execution Capability Availability
FCL action-chain Availability
Action-Specific Approval
ActionPermit
```

The assembled bundle MUST advertise:

```text
authorization_must_occur_by = min(all four horizons)
```

This narrows the #567 bridge-mode lifecycle window. The historical no-bridge PreAction horizon remains the original three-way minimum.

## Transitional compatibility projection

The current raw reusable PreAction v0.1 validator still requires the historical three-way horizon. The assembler therefore validates the actual four-way bundle in two parts:

1. it verifies the actual bundle hash and exact four-way horizon;
2. it creates a validation-only compatibility projection whose only semantic difference is replacing the four-way horizon with the historical three-way horizon, recomputes that projection hash, and passes the projection through the existing reusable validator with the exact bridge context.

The compatibility projection is never emitted as the output bundle. A conformance case where FCL Availability is the earliest horizon proves that the stronger assembler accepts the actual bundle while the raw reusable validator rejects it specifically on the historical horizon rule.

## Downstream boundary

Before any admission evaluation, the raw reusable PreAction validator itself must learn the four-way FCL horizon. Therefore the assembly receipt advances only to:

```text
PARAMETERIZE_PRE_ACTION_EVIDENCE_BUNDLE_FCL_HORIZON
```

Only after that successor is complete should `PreAction Authorize Admission` be parameterized or evaluated for the bridged FCL path.

## Canonical distinctions

```text
Bundle Materialization != Authority Creation
Bundle Materialization != Permit Creation
Bundle Materialization != Permit Consumption
Lifecycle Handoff To Authorize != Authorize Admission
Bridge Horizon Narrowing != Semantic Relaxation
Authorize Admission Assessment != Execution
Approval Evidence != Authority Receipt
Bridge Context != Approval
```

## Non-effects

Assembly does not rewrite source receipts, create Core receipts, create intent or authority, create approval, create or consume the ActionPermit, admit authorize, admit execute, perform an action, transition runtime state, or create future action permission.

## CLI

```text
pre-action-bundle-assembly.js validate <input.json>
pre-action-bundle-assembly.js assemble <input.json>
pre-action-bundle-assembly.js validate-receipt <receipt.json>
```

There is no `authorize`, `execute`, `probe`, `consume`, `interrupt`, or `send` command.
