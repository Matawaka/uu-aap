# Protocol Registry v0.1 — Deterministic Resolution Layer

**Status:** experimental repository-scoped registry  
**Repository:** `Matawaka/uu-aap`  
**Initial registered protocol:** CCRP v0.1

## Purpose

A published protocol release is machine-verifiable only after a client knows where to find it. This registry adds a small discovery layer so a client can start from a logical protocol identity and exact version rather than hard-coding a protocol-specific GitHub path.

The v0.1 resolution chain is:

```text
protocol_id + exact version
  -> registry entry
  -> logical protocol URI
  -> immutable release tag
  -> exact release commit
  -> exact release tree
  -> release-manifest path + Git blob identity
  -> publication checkpoint
```

For CCRP v0.1:

```text
CCRP + 0.1
  -> urn:uu-aap:protocol:ccrp:0.1
  -> poai-ccrp-v0.1
  -> 2c98d34ebfb5e86491bffb29a27e5a55b4db707e
```

## Why exact resolution only

Registry v0.1 intentionally does **not** define `latest`, implicit compatibility, version ranges, fallback, or automatic upgrades.

Those features introduce policy decisions that are distinct from identifying an already-published protocol release. A resolver that silently changes its answer over time would weaken reproducibility.

Therefore:

```text
exact identity -> exact immutable release
```

and:

```text
missing version -> failure
ambiguous match -> failure
moved tag -> validation failure
manifest blob drift -> validation failure
```

## Files

- `registry.json` — machine-readable registry;
- `registry.schema.json` — structural contract;
- `validate-registry.js` — semantic and Git-object validator;
- `resolve-protocol.js` — deterministic exact-version resolver;
- `test-resolver.js` — positive and negative resolver vectors.

## Validate

From the repository root:

```bash
node protocols/registry/v0.1/validate-registry.js
```

The validator checks registry uniqueness and verifies each registered release against Git itself:

- release tag -> exact commit;
- release tag -> exact tree;
- `tag:path` -> exact release-manifest Git blob;
- publication checkpoint -> exact current Git blob;
- release manifest protocol/version/tag semantics;
- publication checkpoint release tag/commit/tree semantics.

## Resolve

```bash
node protocols/registry/v0.1/resolve-protocol.js CCRP 0.1
```

The resolver returns the exact registered release binding as JSON. It exits non-zero when no unique exact match exists.

## Scope boundary

This is a **repository-scoped discovery and resolution mechanism**. It is not a universal protocol registry and does not establish:

- factual truth;
- causal proof;
- legal identity or authority;
- universal canonicality;
- compatibility between protocol versions;
- dependency solving;
- signature validity or PoAI/V conformance;
- accreditation;
- permission to perform an external materialization action.

A future federation or external registry MAY reference these logical identities, but doing so does not make this repository universally authoritative.