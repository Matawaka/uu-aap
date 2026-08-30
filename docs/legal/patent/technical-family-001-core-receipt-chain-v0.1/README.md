# Patent Track Technical Family 001 — Core Receipt-Chain Inventory v0.1

**Status:** repository-internal technical inventory / no patentability conclusion / no filing effect  
**Issue:** #771  
**Parent:** #492  
**Origin canonical main:** `739f0364172b336f80d870a1ae55418203f059d4`

## Purpose

This slice inventories one already-public implemented UU-AAP mechanism family without converting repository provenance or implementation detail into a patent claim.

The family is the **UU-AAP Core v0.1 receipt-chain validator and state-linkage mechanism** built around:

- `protocols/core/v0.1/validate-core.js`;
- `protocols/core/v0.1/receipt-envelope.schema.json`;
- `protocols/core/v0.1/end-to-end.fixture.json`;
- the normative Core v0.1 description.

The inventory is deliberately narrower than a patentability analysis.

```text
Implemented mechanism observed != Patentable invention
Repository provenance != Inventorship
Public disclosure anchor != Novelty conclusion
Technical inventory != Filing authority
```

## Exact provenance boundary

The current source bytes are bound by Git blob SHA-1 in `inventory.json` and recomputed by `validate.py`.

The earliest known **repository public disclosure** for this family is bound to:

- architecture issue #303;
- origin PR #320;
- merge `fd3a3fa7e84c11a80d2af5ff389fe10979720ef9`;
- merge timestamp `2026-08-24T14:01:17Z` / `2026-08-24T19:01:17+05:00`.

This is an evidence statement about the known repository history only. It is not a universal prior-art search and does not establish novelty.

## Implementation-observable mechanism elements

The bounded inventory records six concrete implementation elements:

1. deterministic receipt identity hashing;
2. typed predecessor hash chaining;
3. fail-closed ActionPermit prerequisite validation;
4. frontier consistency enforcement;
5. assertion/non-effect boundary validation;
6. outcome-to-successor-state linkage.

Each element must point only to byte-bound current Core source files. The validator rejects an element that is relabeled as a patentable invention.

## Semantic/non-technical separation

The inventory separately marks high-level architectural meaning, responsibility/liability semantics and governance/institutional authority rules as:

`NOT_CLASSIFIED_AS_TECHNICAL_MECHANISM_BY_THIS_INVENTORY`

That classification is intentionally conservative. It does not state that those subjects can never participate in a patent claim; it only prevents this repository-internal inventory from laundering abstract or normative concepts into technical patent conclusions.

## Deferred patent gates

The following remain unestablished and explicitly false in this slice:

- inventorship based on actual creative technical contribution;
- novelty search;
- inventive-step analysis;
- industrial-applicability analysis;
- review of 2027 Russian programmable-means examination practice;
- foreign-jurisdiction strategy;
- claim drafting;
- patent filing decision.

The broader patent track #492 therefore remains open.

## Fail-closed validation

Run:

```bash
python docs/legal/patent/technical-family-001-core-receipt-chain-v0.1/validate.py
node protocols/core/v0.1/validate-core.js
```

Mutation tests reject:

- origin-frontier or disclosure-date rewriting;
- source-byte substitution;
- universal prior-art/search claims;
- semantic-to-technical laundering;
- patentability, novelty, inventorship or ownership overclaims;
- filing-status or filing-authority overclaims;
- Core semantic mutation.

## Non-effects

Merging this inventory does not submit a patent search or application, pay a fee, publish private identity data, create filing authority, decide inventorship/ownership, establish novelty/patentability, change Core semantics, create a release/tag, or create any external effect.
