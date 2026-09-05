# Observed Authority Branch Set Receipt v0.1

Successor-only interoperability/observability primitive after merged #900.

Accepted predecessor:

- #900 merge commit: `6bfffc03b4ac6b81b998ced1394b15d09d6a72b6`
- implementation branch starts from later current main `d9a5f4d5c16334b84a0fe12519a244e87959fc80`, which also contains unrelated merged #888.

This directory does not edit or reinterpret #890, #892, #894, #896, #898, #900, #777, or #888.

## Question answered

Merged #900 answers a pairwise question:

> Given two independently valid observed chains with one common exact origin, how do the supplied observations relate?

This successor answers only:

> Given 2+ independently valid observed chains with one common exact origin, what distinct branch observations, duplicates, pairwise relations, and signed-root digest variants are present in the supplied set?

It does **not** answer how many branches exist globally.

## Core boundary

```text
Observed branch set != exhaustive branch universe
Observed branch count != total branch count
Pairwise divergence matrix != global fork topology
Observed same-version root multiplicity != global equivocation proof
Most common branch != canonical branch
Longest branch != canonical branch
Duplicate observation != additional independent branch
```

## Input

Closed-world schema:

```text
schema
branches
```

Each item in `branches` is exactly a merged #898 chain input. At least two observations are required.

The implementation:

1. rematerializes every branch through merged #898;
2. computes the canonical branch fingerprint using the same snapshot-fingerprint construction used by #900;
3. requires one exact common first-snapshot fingerprint across all observations;
4. checks cross-branch digest/content consistency;
5. separates total observations from distinct branch fingerprints;
6. rematerializes every unordered pair of distinct branches through merged #900;
7. groups observed signed-root document digests by `(root id, version)`;
8. emits a deterministic source-bound receipt.

Caller-supplied chain receipts, divergence receipts, pairwise matrices, timestamps, scores, canonical/preferred branch controls, or global verdicts are not accepted.

## Duplicate observations

Duplicate exact branch fingerprints remain visible as repeated observations:

```text
observation_count = 3
distinct_branch_count = 2
```

but only the two distinct branch fingerprints participate in the pairwise matrix.

```text
Duplicate observation != independent branch
```

The branch-set fingerprint is a SHA-256 over the sorted **multiset** of observed branch fingerprints, so duplicate multiplicity remains source-bound without minting branch independence.

## Pairwise matrix

For `N` distinct branch fingerprints, the receipt contains exactly:

```text
N * (N - 1) / 2
```

unordered pair entries.

Every pair is rematerialized by #900. The new layer does not define a second divergence algorithm.

Each entry preserves:

- exact left/right branch fingerprints;
- #900 relation;
- common observed prefix length;
- pair-scoped same-version root-variant observation;
- pair-scoped observed reconvergence;
- exact first-divergence root summaries when applicable.

The matrix is sorted by branch fingerprint and never selects a winner.

## Cross-branch digest/content consistency

A branch can be internally valid while another independently valid branch assigns a different normalized source object to the same `document_sha256`.

The set layer fails closed if the same digest maps to different normalized content for any of:

```text
runtime_surface
export_surface
signed_root
```

This is a successor-only consistency closure. It does not rewrite #896 or #900.

```text
same exact source digest + different normalized source content = FAIL_CLOSED
```

## Observed root-variant groups

All supplied snapshots are grouped by:

```text
(root id, root version)
```

Each group exposes sorted distinct signed-root document SHA-256 values.

Example:

```text
root id      = fixture-root
root version = 3
digests      = [aaaa..., bbbb...]
multiple_root_digests_observed = true
```

This remains bounded observation only:

```text
multiple_root_digests_observed != global_equivocation_proven
```

## Canonical fixtures

### `three-branches.json`

Three independently valid branches share one root-v2 origin:

```text
S0 -> root v3 digest A
S0 -> root v3 digest B
S0 -> root v4 digest C
```

Required:

- 3 observations;
- 3 distinct branches;
- 3 pairwise matrix entries;
- root-v3 group contains two distinct digests;
- global equivocation remains unproven.

### `mixed.json`

Contains:

```text
S0 -> A
S0 -> A -> D
S0 -> B
```

so one unordered pair is a prefix relation and two pairs are divergent. The relations remain pair-scoped rather than being collapsed into one branch-set verdict.

## Hostile coverage

`test_receipt.py` contains 21 positive/negative/hostile tests covering:

- exact compatibility with merged #900 for two branches;
- complete pairwise matrix for three branches;
- same-version root digest multiplicity without global verdict;
- duplicate observation deduplication;
- pairwise invariance under duplicate observation;
- input-order invariance;
- mixed prefix/divergence relations;
- pair-scoped reconvergence;
- unrelated-origin rejection;
- invalid-branch rejection;
- single-branch rejection;
- closed-world top-level and nested rejection;
- caller-supplied pairwise result rejection;
- cross-branch runtime/export/root digest-content contradictions;
- branch-set fingerprint binding to duplicate multiplicity;
- input immutability;
- semantic guards;
- absence of aggregate score/rank/severity/fraud verdicts.

## Semantic guards

Every conforming receipt fixes false:

```text
all_existing_branches_observed
global_non_equivocation_proven
global_equivocation_proven
complete_history_proven
no_omitted_states_proven
complete_fork_topology_proven
trusted_time_proven
canonical_branch_selected
preferred_branch_selected
malicious_behavior_proven
authority_mutated
quorum_mutated
remediation_triggered
```

## Non-claims

This primitive is not:

- a transparency log;
- proof that all branches were observed;
- proof of complete history;
- proof of global non-equivocation or equivocation;
- trusted timestamping;
- branch ranking/canonicalization;
- fraud/maliciousness inference;
- authority admission/revocation;
- quorum mutation;
- alerting/remediation;
- C2PA conformance.

It is additive, local, deterministic, source-bound observability only.
