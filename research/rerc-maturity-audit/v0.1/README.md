# RERC Maturity Audit v0.1

This is a read-only maturity audit after merged #919 established the first independently motivated direct-domain reuse of accepted `RERC@0.1`.

## Current state

RERC is already an `experimental` provider-neutral Interface Registry entry from merged #882 / Registry v0.2. This package does not repeat first admission and does not mutate the registry.

The bounded current consumer census is:

```text
Circumstantial Provenance #919  -> DIRECT_INDEPENDENT_DOMAIN_REUSE
RSIC composition                -> COMPOSITION_NOT_INDEPENDENT_DOMAIN_DEMAND
RERC self-tests                 -> SELF_VALIDATION_NOT_CONSUMER
Interface Registry metadata     -> DISCOVERY_METADATA_NOT_CONSUMER
```

Therefore:

```text
independent direct domain consumers = 1
maturity verdict                    = REMAIN_EXPERIMENTAL
second independent direct reuse     = NOT_PROVEN
registry status promotion           = NOT_PERFORMED
Stable Core promotion               = NOT_PERFORMED
```

## Why RSIC does not count

RSIC directly imports RERC and uses `compressGraph` / `restoreGraph`, but its purpose is explicitly to compose ERD + RERC as a synthetic reusable-infrastructure candidate. Counting that composition as a second independent domain would let an architecture manufacture its own maturity evidence.

`Composition Consumer != Independent Domain Demand`.

## What #919 did prove

The Circumstantial Provenance adapter is independently motivated by evidence-independence semantics and invokes accepted RERC bytes unchanged. It preserves independent support, contradictions, protective evidence and lineage gaps while allowing only bounded representational suppression of valid derived-copy relation edges. Exact restoration remains required.

That is meaningful reuse evidence, but one independent domain is not enough by itself to justify a new maturity status.

## Next gate

```text
SEEK_SECOND_INDEPENDENT_DOMAIN_REUSE_OR_MATERIAL_API_EVOLUTION
```

A future promotion requires a separate evidence-backed maturity threshold and explicit review. This audit creates no automatic transition.

## Invariants

```text
Direct Reuse != Stable Core
Experimental Registration != Promotion
Synthetic Composition != Independent Domain Demand
Operational Suppression != Provenance Deletion
Redundancy Group != Semantic Equivalence Proof
```

No scalar maturity/trust/confidence score is produced.

## Non-effects

No RERC/ERD/RSIC implementation mutation, no Interface Registry mutation, no Stable Core/SPEC/PRINCIPLES mutation, no runtime activation, no ActionPermit and no external effect.
