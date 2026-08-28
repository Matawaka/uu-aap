# FCL PreAction Evidence Bridge v0.1

**Status:** experimental bounded compatibility bridge  
**Issue:** #566  
**Origin frontier:** `5c04365c176320c19bddc17fcd65e935bf1e3057`

## Purpose

Merged #565 proved that the provider-neutral execution evidence line and the FCL action-gate line are semantically reconcilable but are **not receipt-identical** and cannot be passed directly into the historical `PreActionEvidenceBundle` validator.

This profile adds the minimum typed bridge required to consume those two evidence roles without rewriting either source:

```text
Execution Capability Availability provenance
+ FCL State / Availability / Intent / Authority / Coordination / ActionPermit
+ #565 reconciliation
-> FCLPreActionEvidenceBridgeRecord
-> bridge-aware validation by the existing PreActionEvidenceBundle validator
```

The bridge is a semantic projection receipt, not a new Core receipt.

## Preserved distinctions

```text
Semantic Projection != Receipt Rewrite
Compatibility Bridge != Core Receipt
Operation Mapping != Identifier Equality
Generic Availability Provenance != FCL Action-Chain Availability
Bridge Context != Authority
Bridge Context != ActionPermit
Parameterization != Semantic Relaxation
```

For the canonical FCL interrupt example:

```text
selected_operation = interrupt_run
target_operation   = fcl.run.interrupt
```

The identifiers remain different. The bridge proves the exact mapping already established by Capability Identity Mapping and preserves the FCL ActionPermit target binding.

## Two availability roles

The bridge intentionally retains four different Core hashes:

```text
generic evidence StateReceipt
generic evidence AvailabilityClaim
FCL action-chain StateReceipt
FCL action-chain AvailabilityClaim
```

No pair is silently collapsed. The generic pair proves Selection/Descriptor/Observation provenance. The FCL pair proves current run/epoch/chain/scope/target context for the action-gate chain.

## Projected target binding

The bridge revalidates merged #565 and deterministically projects the existing FCL `target_binding_hash` from each of:

- FCL IntentReceipt `fcl_binding.required_scope/required_target` + frontier;
- FCL AuthorityReceipt `authority_scope/authority_target` + frontier;
- FCL CoordinationReceipt `coordination_scope/coordination_target` + frontier.

Each projection must equal the already-materialized FCL ActionPermit target binding. The bridge does not add fields to or rewrite those receipts.

## PreAction API

The historical validator remains valid:

```text
validateBundle(bundle)
validateBundle(bundle, evidenceContext)
```

Bridge-aware use adds only:

```text
validateBundle(bundle, evidenceContext, bridgeContext)
```

Without `bridgeContext`, every historical strict equality and embedded-provenance requirement remains unchanged.

With a canonical bridge, the existing validator may consume the FCL action-chain receipts while keeping generic availability provenance separate and mapping provider-neutral operation identity to the exact FCL target operation.

## Next boundary

A valid bridge may state:

```text
next_safe_action = ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE
```

This profile does not itself publish a production bundle. Conformance constructs a bundle only to prove that the existing validator accepts the canonical FCL chain **only with the exact bridge** and rejects the same shape without it.

## Non-effects

The bridge does not perform a live probe, rewrite a source receipt, create a Core receipt, establish intent or authority, create approval, create or consume an ActionPermit, publish a production PreAction bundle, admit authorize/execute, perform an action, interrupt a run, create a successor, mutate runtime state, establish legal effect, certify truth/causality/liability, or include private reasoning.
