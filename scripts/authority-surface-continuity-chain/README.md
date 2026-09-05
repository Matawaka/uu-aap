# Authority Surface Continuity Chain Receipt v0.1

Status: **additive local continuity/observability evidence for #897; not a transparency log, not global non-equivocation proof, not trusted time, not Stable Core**.

Exact predecessor:

- merged #896 / `ad8942def0c99c9c9cf0651799c1fcefbdd7d6e8` — Authority Surface Transition Receipt v0.1.

Preserved predecessor stack:

- #890 — authority-admission / quorum eligibility boundary;
- #892 — export-vs-root observable consistency;
- #894 — three-surface triangulation snapshot;
- #896 — one explicit transition between two #894 snapshots.

## Why this successor exists

#896 proves one bounded transition:

```text
snapshot A -> snapshot B
```

Real observed histories may contain more than one supplied state. This successor composes a caller-supplied sequence:

```text
S0 -> S1 -> S2 -> ... -> Sn
```

but only proves that **each supplied adjacent pair is locally valid under #896**.

The important boundary is:

```text
Locally continuous observed chain != complete history
Observed adjacency != proof that no state was omitted
Single observed chain != global non-equivocation
Chain order != trusted time
Transition sequence != causal explanation
Continuity receipt != append-only log
```

A valid receipt may describe one observed branch while other unobserved or parallel states still exist.

## Input

Closed-world schema:

```text
urn:uu-aap:authority-surface-continuity-chain-input:0.1
```

Exactly:

```json
{
  "schema": "urn:uu-aap:authority-surface-continuity-chain-input:0.1",
  "snapshots": [ ... ]
}
```

At least two snapshots are required.

Every element of `snapshots` must be an exact #894 `AuthoritySurfaceTriangulation` input object.

There is deliberately no input for:

```text
transition_receipts
edge_receipts
latest_root
timestamp
trusted_time
history_complete
non_equivocation
append_only
alert
remediation
quorum_override
admit
revoke
trust_score
severity
```

Unknown fields fail closed.

## Predecessor reuse

The implementation imports the merged predecessor implementations.

For every supplied snapshot:

```text
snapshot[i]
    -> merged #894 evaluator
    -> exact triangulation receipt
```

For every adjacent pair:

```text
snapshot[i] + snapshot[i+1]
    -> merged #896 evaluator
    -> exact transition receipt
```

The chain layer does not recreate snapshot or transition semantics.

It does not accept independently supplied transition receipts in v0.1. This prevents a caller from giving endpoint snapshots plus a different edge description.

## Canonical snapshot fingerprint

Each exact input snapshot receives a deterministic local transport fingerprint:

```text
SHA-256(canonical JSON bytes of exact #894 input snapshot)
```

The fingerprint is not signer identity, trust, authority or C2PA cryptographic verification.

Every edge records:

```text
before_snapshot_fingerprint_sha256
after_snapshot_fingerprint_sha256
```

and these must equal the fingerprints of its exact neighboring snapshot entries.

Thus an interior snapshot S1 is explicitly shared:

```text
edge[0].after_fingerprint
        ==
snapshot[1].fingerprint
        ==
edge[1].before_fingerprint
```

This is the bounded meaning of `local_adjacency_continuous = true`.

## Output

Receipt schema:

```text
urn:uu-aap:authority-surface-continuity-chain-receipt:0.1
```

The deterministic receipt includes:

- `snapshot_count`;
- `edge_count = snapshot_count - 1`;
- exact snapshot fingerprints;
- exact runtime/export/root source ids and digests for every snapshot;
- root version and verification state for every snapshot;
- each rematerialized edge's #896 root relation;
- each edge's surface membership transitions;
- each edge's six directional delta lifecycles;
- exact first and last snapshot fingerprints/root summaries;
- `SAME_ROOT` and `SUCCESSOR_ROOT` edge counts;
- explicit non-claim guards.

## Mixed chain fixture

`fixtures/three-snapshot.json` contains:

```text
S0
runtime 1..7
export  1..8
root v2 1..7

S1
runtime 1..7
export  1..7
root v2 1..7

S2
runtime 1..7
export  1..7
root v3 1..8
```

Expected root-relation sequence:

```text
SAME_ROOT
SUCCESSOR_ROOT
```

This intentionally shows that surface correction and authority-root succession are separate edges.

## Same-root chain fixture

`fixtures/all-same-root.json` performs multiple runtime/export changes while the exact root v2 remains unchanged.

Expected:

```text
root_relation_sequence = [SAME_ROOT, SAME_ROOT]
```

Changing operational or published surfaces does not imply root authority succession.

## No-op interior fixture

`fixtures/no-op-interior.json` repeats an exact snapshot before another valid change.

A repeated snapshot produces a valid #896 no-op edge:

```text
before fingerprint == after fingerprint
root_relation = SAME_ROOT
any_membership_change = false
any_delta_lifecycle_change = false
```

The chain does not invent progress merely because another list element exists.

## Minimum chain

`fixtures/two-snapshot.json` proves the smallest valid chain:

```text
2 snapshots
1 edge
```

A single snapshot is rejected because it contains no transition to compose.

## Root safety inherited from #896

Every edge fails closed on predecessor conditions including:

```text
root version rollback
same-version different-root digest replacement
successor version reusing identical root digest
root identity substitution
unverified root
same exact surface digest + changed signer set
```

One invalid interior edge rejects the whole chain.

## Snapshot safety inherited from #894

Every snapshot remains closed-world and exact source-bound.

Malformed digests, unknown fields, duplicate signer ids, empty signer ids or unverified roots reject the whole chain before a successful receipt is emitted.

## Explicit incompleteness

A conforming receipt always carries:

```text
local_adjacency_continuous = true
history_complete = false
no_omitted_states_proven = false
global_non_equivocation_proven = false
no_parallel_fork_proven = false
append_only_log_proven = false
trusted_time_proven = false
chain_order_proves_chronology = false
chain_proves_causality = false
```

This distinction matters for transparency-log discussions.

A locally valid sequence does not prove that:

- no intermediate snapshot was omitted;
- another observer did not receive a different branch;
- the producer issued only one successor;
- the sequence was submitted to an append-only log;
- any timestamp is trustworthy;
- a transition happened for a particular reason.

Those require separate evidence and successors.

## Hostile coverage

`test_receipt.py` contains 19 positive/negative/hostile tests covering:

- three-snapshot mixed chain;
- exact interior endpoint fingerprint binding;
- all-same-root chain;
- no-op interior edge;
- two-snapshot minimum;
- single-snapshot rejection;
- non-array rejection;
- wrong schema;
- semantic-control injection rejection;
- nested timestamp injection rejection through #894;
- malformed interior snapshot;
- interior root rollback;
- same-version root replacement;
- same-digest changed-content contradiction;
- input immutability;
- deterministic output;
- edge-count completeness;
- explicit incompleteness/non-authority guards;
- absence of aggregate trust/failure scoring.

## CI

Dedicated CI first reruns unchanged accepted predecessors:

```text
#890 authority-admission tests
#892 observable-consistency tests
#894 triangulation tests
#894 predecessor cross-check
#896 transition tests
```

Then it runs chain tests, emits deterministic fixture receipts, asserts exact root-relation/fingerprint/non-claim outcomes and proves the validation process leaves the checkout unchanged.

## Non-claims

This layer does not:

- modify Stable Core, `SPEC.md`, `PRINCIPLES.md`, #890, #892, #894, #896 or #777;
- implement C2PA conformance;
- implement a transparency log;
- prove append-only behavior;
- prove global non-equivocation;
- prove complete history;
- prove absence of omitted or parallel states;
- establish trusted time;
- infer causality;
- poll a network;
- alert or remediate;
- admit/revoke signers;
- calculate or mutate quorum;
- create publication/action authority;
- create a trust/reputation/severity score.

Promotion beyond local observed continuity requires a separate successor and explicit authority.