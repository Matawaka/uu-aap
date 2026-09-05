# Observed Authority Branch-Set Transition Chain Receipt v0.1

Status: successor-only interoperability / temporal-observability evidence after merged #904.

Exact predecessor main used for this line:

```text
6855cd22003d93187c521c8acac54c43b39d3f61
```

Issue: #905.

## Purpose

Merged #902 materializes one deterministic observed branch set. Merged #904 materializes one observation-only transition between two such sets.

This primitive composes **2 or more supplied branch sets** into one locally adjacent sequence:

```text
set[0] -> set[1] -> ... -> set[n]
```

Every set is rematerialized through merged #902. Every adjacent edge is rematerialized through merged #904.

The receipt proves only that the supplied sequence is locally self-consistent under those accepted contracts.

## Core boundary

```text
Locally adjacent observed-set chain != complete observation history
Caller-supplied set order != trusted chronology
Adjacent transition != proof no observation set was omitted
Newly observed on an edge != globally created
Not observed in next set != globally deleted
Observed in adjacent sets != continuous real-world existence
Repeated semantic set != progress
Transition-chain receipt != append-only log
```

There is no global branch-existence or topology verdict.

## Input

Closed-world schema:

```text
schema
sets
```

`sets` must contain at least two exact #902 input objects.

Caller-supplied transition receipts, timestamps, latest/preferred/canonical controls, completeness claims, scores, remediation controls and authority mutations are rejected as unknown input.

## Two binding layers

Every set summary carries two hashes with different meanings.

### Exact input fingerprint

```text
set_input_fingerprint_sha256
```

This is SHA-256 over canonical JSON of the exact supplied set object. It preserves a deterministic local provenance binding to the representation that was actually supplied.

### Semantic observed-set fingerprint

```text
branch_set_fingerprint_sha256
```

This is the accepted #902 semantic multiset fingerprint.

It deliberately ignores input branch-array ordering while preserving observation multiplicity. #902 also preserves alias/order semantics for same-digest signer membership.

Therefore:

```text
exact input A != exact input B
```

may coexist with:

```text
semantic set A == semantic set B
```

when the supplied observations are semantically the same under merged #902.

**Adjacency uses the #902 semantic set fingerprint, not input ordering or alias spelling.**

For an interior set:

```text
edge[0].after_set_fingerprint
    == set[1].branch_set_fingerprint
    == edge[1].before_set_fingerprint
```

## Predecessor reuse

The implementation imports:

- `scripts/observed-authority-branch-set/receipt.py` from merged #902;
- `scripts/observed-authority-branch-set-transition/receipt.py` from merged #904.

It does not recreate branch-set or transition semantics independently.

## Chain-wide consistency guard

Adjacent transitions alone have a bounded blind spot.

Example:

```text
set[0]: digest X -> signer membership A
set[1]: digest X not observed
set[2]: digest X -> signer membership B
```

Both adjacent comparisons could be internally valid because the conflicting digest is never present on both sides of one edge.

The chain therefore also invokes merged #902's normalized digest/content consistency guard across the union of **all branch observations in all supplied sets**.

Required result:

```text
same document_sha256 + different normalized signer membership
    -> FAIL_CLOSED
```

The normalization remains the accepted #896/#902 semantics:

- runtime/export alias IDs do not change signer membership;
- signer input order does not change signer membership;
- signed-root signer order does not change admitted membership.

The chain does not strengthen this into byte identity or identity-string equality.

## Edge evidence

Every adjacent #904 edge preserves:

- before/after semantic set fingerprints;
- common origin fingerprint;
- exact #904 relation;
- distinct-branch observation lifecycle;
- observation multiplicity lifecycle;
- observed root-variant lifecycle;
- pairwise observation lifecycle;
- descriptive membership/multiplicity change booleans.

Allowed relations are exactly the merged #904 relations:

```text
IDENTICAL_OBSERVED_SET
OBSERVATION_MULTIPLICITY_ONLY_CHANGED
OBSERVED_BRANCH_MEMBERSHIP_CHANGED
OBSERVED_BRANCH_AND_MULTIPLICITY_CHANGED
```

The chain emits both the exact relation sequence and deterministic counts.

## Observation origin

All sets must carry one exact #902 common-origin snapshot fingerprint.

A different valid origin anywhere in the sequence fails closed as:

```text
OBSERVED_SET_ORIGIN_CHANGED
```

This is source/observation scoping only. It is not a global identity or trusted-time assertion.

## Executable cases

The 24-test corpus covers:

- two-set minimum;
- three-set branch membership add/remove observation sequence;
- multiplicity-only interior transitions;
- semantic no-op under branch input reordering;
- repeated exact-set no-op;
- single-set rejection;
- malformed schema/closed-world controls;
- invalid interior #902 set;
- changed common origin;
- non-adjacent same-root-digest contradiction;
- non-adjacent alias/order-compatible reuse;
- exact edge-to-neighbor semantic fingerprint binding;
- edge-count completeness;
- deterministic relation counts;
- origin binding on every set and edge;
- input immutability;
- deterministic output;
- explicit semantic non-claims;
- absence of aggregate trust/fraud/severity/progress verdicts.

No new standalone snapshot fixtures are needed: tests and CI construct chain examples from the already merged #902 canonical fixtures, keeping the successor vocabulary bound to the predecessor line.

## Semantic guards

Every conforming receipt fixes the following to `false`:

```text
complete_observation_history_proven
no_omitted_observation_sets_proven
trusted_time_proven
set_sequence_proves_chronology
newly_observed_proves_branch_creation
not_observed_in_next_proves_branch_deletion
repeated_observation_proves_continuous_existence
complete_fork_topology_proven
global_non_equivocation_proven
global_equivocation_proven
append_only_log_proven
canonical_branch_selected
preferred_branch_selected
authority_mutated
quorum_mutated
remediation_triggered
```

## Non-claims

This layer does **not** provide:

- Stable Core or SPEC changes;
- C2PA conformance;
- transparency-log or append-only guarantees;
- trusted timestamps;
- complete observation history;
- proof that no intermediate observation set was omitted;
- global fork topology;
- global non-equivocation or equivocation proof;
- branch creation/deletion evidence;
- branch canonicalization/preference;
- authority or quorum mutation;
- alert/remediation authority;
- fraud, intent, trust, severity or progress scoring.

It is additive, deterministic, source-bound, predecessor-preserving, read-only and fail-closed evidence only.
