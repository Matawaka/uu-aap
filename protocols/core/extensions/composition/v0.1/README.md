# UU-AAP Extension Composition Receipt v0.1

**Status:** experimental composition-integrity profile  
**Depends on:** `protocols/core/extensions/v0.1`  
**Base invariant:** extension stacking does not create Core authority or execution semantics.

## Purpose

This profile closes the set-level integrity gap above Extension Composition v0.1.

The predecessor profile validates each `ExtensionReceipt` and states that stacked extensions do not create an `ActionPermit`. This profile additionally makes the composition itself content-addressed: it records the exact member receipt hashes, explicit relations among those members, bounded derived signals, and the non-effects that remain false after aggregation.

The central invariant is:

```text
safe individually + aggregated together != stronger hidden authority/effect
```

and specifically:

```text
advisory evidence set != Core receipt != ActionPermit != ActionReceipt
```

## Semantic-laundering firewall

Aggregation MUST NOT be used to launder weaker semantics into a stronger one.

Examples that remain forbidden:

```text
five advisory signals -> merge_authorized
unanimous extension outputs -> authority granted
repeated warnings -> execution veto
converging provenance -> causality proven
appeal + readiness -> stay executed
```

A stronger conclusion requires the normal Core path and its independently valid typed receipts.

## `ExtensionCompositionReceipt`

A composition receipt binds:

- one exact subject;
- one exact predecessor frontier;
- an exact set of extension receipt hashes and extension types;
- explicit member-to-member relations;
- bounded derived signals;
- composition assertions;
- Core Action Gate firewall state;
- aggregation-specific non-effects;
- issuer/time/payload;
- deterministic content hash.

### Order-independent set binding

`members` MUST be unique and lexicographically sorted by `receipt_hash`.

This is normative. It ensures that reordering the same member set cannot create a different semantic priority or a different content identity.

`relations` MUST likewise be unique and sorted by:

```text
from_receipt_hash | to_receipt_hash | relation
```

`derived_signals` MUST be unique and sorted.

The array order therefore carries no priority, voting weight, authority, or precedence meaning.

## Allowed relations

The first profile supports only evidence-level relations:

- `corroborates`
- `challenges`
- `conditions`
- `contextualizes`
- `coexists_with`

A relation is descriptive. It does not modify the semantics of either member receipt.

## Allowed derived signals

The first profile permits only:

- `conflict_present`
- `evidence_convergence_present`
- `intent_checkpoint_pending`
- `readiness_condition_present`
- `review_required`

These are routing/review signals, not external effects.

`merge_authorized`, `stay_executed`, `action_permitted`, `authority_granted`, or equivalent stronger signals are invalid.

## Required aggregation non-effects

Every composition receipt MUST explicitly keep false:

- `intent_created_by_aggregation`
- `authority_created_by_aggregation`
- `responsibility_created_by_aggregation`
- `coordination_completed_by_aggregation`
- `core_receipt_created_by_aggregation`
- `action_authorized_by_aggregation`
- `action_performed_by_aggregation`
- `action_gate_bypassed`
- `member_semantics_strengthened`
- `ordering_implies_priority`
- `unanimity_implies_authority`
- `causal_claim_upgraded`
- `truth_claim_upgraded`
- `liability_established`
- `universal_canonicality_established`

## Source-member binding

For the conformance fixture, the composition receipt is checked against the exact five receipts in:

`protocols/core/extensions/v0.1/composition.fixture.json`

The validator requires exact hash/type/subject/frontier matching and exact set cardinality. An omitted, duplicated, substituted, or unknown member fails closed.

This profile relies on the predecessor Extension Composition validator to establish each member's own validity; the new receipt establishes set-level binding and non-escalation.

## Core firewall

The receipt MUST declare:

```text
core_binding.action_gate_required = true
core_binding.substitutes_for_core_receipt = false
```

The composition itself cannot become a Core receipt.

## Content identity

`content_hash` is SHA-256 over the recursively key-sorted JSON identity projection excluding `content_hash` itself. Arrays retain their normative already-sorted order.

This is the same repository-local deterministic convention used by the predecessor experimental profiles; it is not a claim of universal canonical JSON interoperability.

## Fail-closed vectors

`validate-composition-receipt.js` rejects at least:

1. unsorted members;
2. duplicate members;
3. substituted/unknown member hash;
4. relation to an unknown member;
5. self-relation;
6. semantic-laundering derived signal (`merge_authorized`);
7. unanimity upgraded to authority;
8. Core receipt created by aggregation;
9. Action Gate bypass;
10. frontier mismatch;
11. member ordering treated as priority.

## Run

```bash
node protocols/core/extensions/v0.1/validate-extensions.js
node protocols/core/extensions/composition/v0.1/validate-composition-receipt.js
```

Expected second result:

```text
UU_AAP_EXTENSION_COMPOSITION_RECEIPT_V0_1_PASS
```

## Non-effects

This profile does not activate KONTUR or any other system, create authority, accept responsibility, execute a stay/veto/merge/publication/deletion, establish factual truth or causality, or create universal canonicality.

It makes multi-extension aggregation auditable without allowing the aggregation itself to become an execution path.
