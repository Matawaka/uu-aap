# FCL Capability Identity Mapping v0.1

**Status:** experimental bounded compatibility profile  
**Issue:** #560  
**Predecessor:** #559 import-safe Execution Capability Descriptor + Capability Selection validators

## Purpose

This profile proves an exact identity mapping between a provider-neutral selected execution operation and the exact FCL request scope already established by `FCLAuthorityEvaluationReceipt`.

```text
ExecutionCapabilityDescriptor
+ CapabilitySelectionRecord
+ positive FCLAuthorityEvaluationReceipt
-> FCLCapabilityIdentityMappingReceipt
```

It does not silently equate names.

```text
Selected Capability != FCL Scope
Operation Name != Authority Scope
String Equality != Semantic Proof
Capability Mapping != Availability
Capability Mapping != Authority
Capability Mapping != ActionPermit
```

## Canonical source validation

The adapter directly consumes the canonical import-safe validators merged in #559:

- `Execution Capability Descriptor v0.1`;
- `Capability Selection v0.1`;

and the existing FCL Authority Evaluation validator.

A positive mapping therefore requires all three source artifacts to pass their own semantic validation before cross-artifact binding is considered.

## Exact mapping

The selected candidate must resolve exactly once. Its descriptor reference must equal the supplied descriptor ID and content hash, and its selected capability must equal the descriptor capability.

The selected candidate projection is then compared field-for-field against the exact descriptor operation, including:

- capability and adapter;
- operation name and effect class;
- authority scope;
- reversibility / compensation;
- action-specific scope-bound approval;
- fresh availability probe requirement;
- lifecycle profile/version/mode/phases;
- exact target / predecessor freshness / fail-closed guard;
- one-shot / expiry / separate-observer requirements;
- Core pre/post-action receipt contracts.

Finally:

```text
selection.request.authority_scope
= candidate.operation_projection.authority_scope
= descriptor.operation.authority_scope
= FCLAuthorityEvaluationReceipt.required_scope
```

No prefix, wildcard, synonym, default or approximate match is accepted.

## Output

A positive `FCLCapabilityIdentityMappingReceipt` records source identities and hashes and sets:

```text
mapping_status = EXACT
next_safe_action = BUILD_SOURCE_VERIFIED_PRE_ACTION_EVIDENCE_CONTEXT
```

This is an identity/provenance result only.

## Non-effects

The mapping does not create a selection, observe availability, create an `AvailabilityClaim`, establish intent, grant or expand authority, create approval, create or consume an `ActionPermit`, assemble a PreAction bundle, authorize or execute an action, complete an interrupt, create a successor run, mutate runtime state, establish legal effect, certify truth/causality/liability, or include private reasoning.

## CLI

Read-only commands only:

```text
validate <input.json|->
map <input.json|->
validate-receipt <receipt.json|->
help
```

There is no `probe`, `grant`, `permit`, `authorize`, `execute`, `interrupt`, `create-successor`, or `send` command.

## Next boundary

After this mapping is merged, a later adapter may construct a **source-verified normalized PreAction evidence context** and determine how the existing single Core `AvailabilityClaim` can carry the compatible Selection/Availability provenance required by the reusable PreAction validator.

That later step must preserve:

```text
Availability != Intent
Mapping != Availability
PreActionBundle != AuthorizeAdmission
```
