# Receipt Runtime SDK v0.1

Status: **experimental reusable tooling**  
Issue: **#643**  
Origin frontier: `eddc49d2b3978558c35f029d9a5bfb46b5e4f6c1`

## Purpose

Extract repeated deterministic receipt/content identity mechanics without replacing component-owned semantics.

The runtime provides:

```text
canonicalize(value)
project(profile, value)
canonicalJson(profile, value)
computeContentHash(profile, value)
verifyContentHash(profile, value)
rehash(profile, value)
deepEqualCanonical(left, right)
```

It performs no schema interpretation, authority evaluation, predecessor resolution, storage, network access, provider invocation or external effect.

## Explicit identity profiles

### `content-hash-zero-field-v0.1`

Historical behavior first evidenced by `AI-Transport-Reference`:

1. JSON-clone the value;
2. retain `content_hash` in the projected object;
3. set `content_hash` to the empty string;
4. recursively sort object keys while preserving array order;
5. JSON-serialize without extra whitespace;
6. hash UTF-8 bytes with SHA-256;
7. prefix the lowercase digest with `sha256:`.

### `content-hash-omit-field-v0.1`

Historical behavior first evidenced by `MarketCloser-Copy-Export-Receipt`:

1. JSON-clone the value;
2. remove `content_hash` from the projected object;
3. recursively sort object keys while preserving array order;
4. JSON-serialize without extra whitespace;
5. hash UTF-8 bytes with SHA-256;
6. prefix the lowercase digest with `sha256:`.

These profiles are deliberately distinct. A caller must select one explicitly.

## First differential consumers

```text
AI-Transport-Reference
  source blob: 2f3f1341bf860085edc513fcc6a59c01c2191b93
  profile: content-hash-zero-field-v0.1

MarketCloser-Copy-Export-Receipt
  source blob: 84e9cc5fd9c5ef043a5d149a913340e1539b51a7
  profile: content-hash-omit-field-v0.1
```

`differential-baseline.json` binds these exact historical implementations and the first byte-stability vectors.

## Admission sequence

T4a uses a two-stage extraction:

```text
historical component-local implementation
        + shared runtime in parallel
        ↓
byte-identical differential parity
        ↓
explicit profile delegation in two consumers
        ↓
existing consumer conformance + differential parity rerun
```

The shared runtime is not allowed to become the source of historical truth before parity is demonstrated.

## Invariants

```text
Shared Runtime != Universal Canonicalization Algorithm
Same SHA-256 Primitive != Same Identity Projection
Profile Selection != Semantic Compatibility
Hash Equality != Receipt Truth
Hash Equality != Authority
Runtime Reuse != Core Promotion
Refactor Success != Historical Receipt Rewrite
```

## Non-effects

Receipt Runtime v0.1:

- does not create or infer intent;
- does not create or transfer authority;
- does not accept responsibility;
- does not create an ActionPermit;
- does not admit execution;
- does not perform external effects;
- does not certify semantic compatibility or substitutability;
- does not rewrite already-issued receipts;
- does not define one universal identity projection for UU-AAP.

## Next evidence

Only after both first consumers remain byte-identical through shared-profile delegation should T4 consider extracting other operations such as frontier, predecessor or non-effect verification. Each additional helper requires independent repeated evidence; proximity in code is not sufficient promotion evidence.
