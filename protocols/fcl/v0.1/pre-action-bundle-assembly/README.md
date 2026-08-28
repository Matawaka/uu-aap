# FCL PreAction Bundle Assembly v0.1

**Status:** experimental artifact materializer  
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

It does not admit authorize or execute anything.

## Exact-source rule

Both source artifacts are reproducibility-bound:

- the bridge record must be exactly reproducible from its bridge input;
- the approval receipt must be exactly reproducible from its approval input;
- approval and bridge must carry byte-identical `ActionPermit` and ActionPermit binding input objects.

Hash equality is not used as a substitute for exact source equality.

## Identifier separation

The assembler preserves the mapping established by the bridge:

```text
provider-neutral selected operation != FCL target operation
```

For the current interrupt fixture:

```text
interrupt_run != fcl.run.interrupt
```

Selection provenance keeps the provider-neutral operation. Approval and the ActionPermit bind the FCL target operation.

## Derived freshness invariant

A valid FCL ActionPermit is already bounded by its FCL AvailabilityClaim:

```text
ActionPermit.expires_at <= FCL AvailabilityClaim.valid_until
```

The canonical FCL ActionPermit validator rejects any permit that exceeds that availability horizon. Because the bridge revalidates the exact ActionPermit chain, FCL Availability is an explicit freshness source but cannot be an earlier independent lifecycle horizon than the permit.

Therefore every valid assembly must prove:

```text
min(Execution Availability, Approval, ActionPermit)
==
min(Execution Availability, FCL Availability, Approval, ActionPermit)
```

The reusable PreAction v0.1 horizon remains unchanged and is already FCL-bounded transitively through the permit.

```text
Explicit Freshness Source != Independent Limiting Horizon
Derived Redundancy != Missing Constraint
```

## Direct reusable validation

The output bundle is validated directly by the merged bridge-aware reusable API:

```text
validateBundle(bundle, evidenceContext, bridgeContext)
```

No compatibility projection, receipt rewrite, or horizon substitution is used.

## Downstream boundary

The assembly receipt advances only to a read-only assessment step:

```text
EVALUATE_PRE_ACTION_AUTHORIZE_ADMISSION
```

This means the evidence bundle is available for an admission assessment. It does **not** mean authorize has been admitted, a permit has been consumed, or execution may begin.

## Canonical distinctions

```text
Bundle Materialization != Authority Creation
Bundle Materialization != Permit Creation
Bundle Materialization != Permit Consumption
Lifecycle Handoff To Authorize != Authorize Admission
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
