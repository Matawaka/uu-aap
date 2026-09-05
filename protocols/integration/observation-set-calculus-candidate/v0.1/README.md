# Observation Set Calculus Candidate v0.1

**Status:** implemented candidate / provider-neutral / not registered / not Stable Core  
**Tracking:** #909  
**Origin:** merged #908 / `70346024ece165735c7ecb043d048448a18c7578`

## Why this exists

The convergence audit in #908 found a real second-domain semantic match for the upper authority-observability line, but explicitly did **not** prove direct reusable API consumption.

This candidate extracts only the common denominator needed to test direct reuse:

```text
Observed Set
  -> Set Transition
  -> Local Set Chain
```

It deliberately does not generalize the full C2PA authority/quorum/fork model.

## Two bindings, two roles

Each observation carries exactly:

```text
semantic_fingerprint_sha256
source_binding_sha256
```

The semantic fingerprint determines observation-set membership. The source binding identifies the exact domain representation/evidence projected by an adapter.

```text
Semantic identity != Source representation
Source binding != Truth
Source binding != Authority
```

A single semantic observation may have multiple exact source representations when the adapter independently proves them equivalent. Conversely, one exact source binding may never map to two semantic identities:

```text
same source binding + different semantic identity -> FAIL_CLOSED
```

## Set semantics

A set input contains:

```text
schema
scope_binding_sha256
observations[]
```

The profile permits an empty observed set. Empty observation is not global absence.

The deterministic semantic set fingerprint binds:

- the exact observation scope;
- the sorted semantic observation multiset.

Input ordering therefore does not alter semantic set identity, while `exact_input_fingerprint_sha256` still preserves the exact supplied representation.

Duplicates remain observable as multiplicity and do not become votes, trust weight, authority weight or independence proof.

## Transition semantics

The candidate uses only four descriptive relations:

```text
IDENTICAL_OBSERVED_SET
OBSERVATION_MULTIPLICITY_ONLY_CHANGED
OBSERVED_MEMBERSHIP_CHANGED
OBSERVED_MEMBERSHIP_AND_MULTIPLICITY_CHANGED
```

It emits:

```text
newly_observed_semantic_fingerprints_sha256
not_observed_in_after_semantic_fingerprints_sha256
observed_in_both_semantic_fingerprints_sha256
```

and explicit multiplicity lifecycle.

Critical boundary:

```text
newly observed != created
not observed after != deleted
observed in both != continuous existence proof
before/after role != trusted time
```

## Local chain semantics

A chain accepts 2+ supplied sets, rematerializes every set and every adjacent transition, and requires exact endpoint semantic-set fingerprint agreement.

It also applies same-source-binding consistency across the full chain, so a contradiction hidden across a non-adjacent gap still fails closed.

```text
local adjacency != complete history
caller-supplied order != trusted chronology
no adjacent contradiction != no omitted observation set
```

## What this candidate does not contain

It intentionally excludes:

- signer/quorum/trust-root semantics;
- generic branch/fork topology;
- global equivocation or non-equivocation proof;
- identity resolution;
- truth/relevance/admission/disposition semantics;
- KONTUR readiness/activation state machine;
- Bounded Action authorize/execute lifecycle;
- ActionPermit;
- remediation;
- Workbench runtime;
- Interface Registry or Stable Core admission.

`Common denominator != union of domain features`.

## Candidate admission posture

A successful two-domain adapter proof may establish only:

```text
shared candidate implementation consumed by two adapters = true
```

It does **not** establish:

```text
Stable Core admission
Interface Registry admission
universal applicability
complete history
truth
authority
```

A separate evidence-first admission audit remains required after direct reuse is proven.
