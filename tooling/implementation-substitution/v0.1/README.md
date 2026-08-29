# UU-AAP Implementation Substitution Assessment v0.1

**Status:** experimental consumer-specific reusable tooling  
**Issue:** #645  
**Origin frontier:** `5d9d9e0faf35230ede54e8f49c71e049311b7e4a` (merged Receipt Runtime SDK v0.1, PR #644)

## Purpose

This layer answers a question that the existing evidence planes intentionally do not answer:

> For one exact consumer, one exact substitution scope, one incumbent implementation, one candidate implementation, and one evidence frontier, what replacement claim is justified?

Existing layers remain separate:

```text
Protocol Registry          -> exact immutable protocol resolution
Capability Negotiation     -> declared capability comparison
Capability Attestation     -> reproducible conformance evidence
Stack Evolution            -> cross-version translation compatibility
Interface Registry         -> reusable interface discovery
Component Manifest         -> component/dependency/effect metadata
Dependency Impact          -> engineering reachability
Receipt Runtime            -> deterministic receipt identity mechanics
```

T5 composes evidence from those planes. It does not replace or reinterpret them.

## Decision vocabulary

Exactly one decision is produced:

```text
SUBSTITUTABLE
ADAPTER_REQUIRED
NOT_SUBSTITUTABLE
INSUFFICIENT_EVIDENCE
```

Required-dimension precedence is fail-closed:

```text
UNSATISFIED
  -> NOT_SUBSTITUTABLE

else INSUFFICIENT_EVIDENCE
  -> INSUFFICIENT_EVIDENCE

else ADAPTER_REQUIRED
  -> ADAPTER_REQUIRED

else
  -> SUBSTITUTABLE
```

A weaker result can never mask a stronger blocker.

## Assessment dimensions

v0.1 requires an explicit finding for every dimension:

- `wire_schema`
- `semantic`
- `conformance`
- `dependency_fit`
- `effect_ceiling`
- `authority_responsibility`
- `frontier_freshness`
- `consumer_operational`

Dimension findings are:

```text
SATISFIED
ADAPTER_REQUIRED
UNSATISFIED
INSUFFICIENT_EVIDENCE
NOT_APPLICABLE
```

A required dimension may not be `NOT_APPLICABLE`.

## First-slice safety boundary

v0.1 assesses only a named `FUNCTION` or `INTERFACE` scope.

```text
Narrow Scope Substitutable != Whole Component Substitutable
```

`whole_component_substitution` must remain `false`. A future whole-component profile needs separate evidence and a separate merge gate.

The assessment also rejects any input that requests selection, authorization, activation or execution.

## Real T4 acceptance evidence

The first real assessments are post-hoc proofs for the already completed T4 refactor.

### AI Transport Reference

```text
consumer:
  AI-Transport-Reference

scope:
  receipt_identity_mechanics

incumbent:
  component-local zero-content-hash identity
  source blob 2f3f1341bf860085edc513fcc6a59c01c2191b93

candidate:
  Receipt-Runtime/content-hash-zero-field-v0.1
```

### MarketCloser Copy/Export Receipt

```text
consumer:
  MarketCloser-Copy-Export-Receipt

scope:
  receipt_identity_mechanics

incumbent:
  component-local omit-content-hash identity
  source blob 84e9cc5fd9c5ef043a5d149a913340e1539b51a7

candidate:
  Receipt-Runtime/content-hash-omit-field-v0.1
```

Both assessments are bound to `5d9d9e0faf35230ede54e8f49c71e049311b7e4a` and to the frozen T4 differential baseline. CI re-runs the differential and native consumer conformance before accepting the T5 receipts.

A `SUBSTITUTABLE` result therefore means only:

> for this exact consumer, this exact receipt-identity function, and this exact evidence frontier, the candidate has sufficient evidence to replace the incumbent implementation without changing the assessed behavior/boundaries.

It does not mean the two whole components are interchangeable.

## Receipt identity

Assessment inputs and receipts use the existing Receipt Runtime profile:

```text
Receipt-Runtime/content-hash-omit-field-v0.1
```

This reuse does not make Receipt Runtime responsible for substitution semantics.

## Non-effects

Every `SubstitutionAssessmentReceipt` keeps false:

- implementation selected;
- runtime activated;
- authority created or expanded;
- responsibility accepted;
- `ActionPermit` created;
- execution admitted;
- action performed;
- external effect performed;
- universal compatibility established;
- universal substitutability established;
- historical evidence rewritten.

Core invariants:

```text
Substitutable != Selected
Substitutable != Authorized
Substitutable != Activated
Substitutable != Executed

Substitution Assessment != CompatibilityReceipt
Substitution Assessment != Capability Selection
Substitution Assessment != ActionPermit

Consumer A Substitutable != Consumer B Substitutable
Scope X Substitutable != Whole Component Substitutable
Historical Parity != Future Compatibility
```

## CLI

```bash
node tooling/implementation-substitution/v0.1/implementation-substitution.js assess \
  tooling/implementation-substitution/v0.1/examples/ai-transport-receipt-identity.input.json
```

The CLI reads JSON and emits a deterministic receipt. It performs no write, network, provider or execution action.

## Expansion rule

Additional evidence adapters or whole-component substitution claims require separate independent proof. A successful T4 receipt-identity assessment does not authorize broad substitution of unrelated implementations.
