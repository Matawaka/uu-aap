# cryptovalid-opencore C2SP witness qualification v0.1

Tracking issue: #1005.

This package independently executes one normalized checkpoint vector set against
`robertolocatelli81-dev/cryptovalid-opencore@v0.14.0` and
`transparency-dev/witness@55a5a0bf332a04f64296841ea857f86ec4494fc3`.

The reference driver creates the signed-note fixtures from the reference witness
test signer, then evaluates those exact bytes with the Go witness. The candidate
driver evaluates the same files with `cryptovalid_witness.py`. `qualify.py`
compares only bounded semantic classes and independently re-verifies the
candidate's portable split-view evidence pair with the already accepted UU-AAP
checkpoint verifier from #934.

The strongest result is deliberately narrow:

`CROSS_IMPLEMENTATION_MATCH_ON_BOUNDED_VECTOR_SET_PORTABLE_CONFLICT_EVIDENCE_REVERIFIED_AUTHENTICATED_POLICY_OBJECT_ABSENT`

It does **not** establish specification conformance, C2PA adoption, global or
producer non-equivocation, submission completeness, witness independence,
trusted universal time, truth, authority, or canonical branch selection.

## Candidate policy boundary

`cryptovalid-opencore v0.14.0` exposes a scalar relying-party threshold
`min_witnesses=N`; it does not expose the authenticated policy object proposed
as a separate UU-AAP experiment in #1005. Absence of that object is recorded as
a capability boundary rather than a candidate failure.

The harness also checks that Ed25519 and ML-DSA-44 cosignatures with the same
witness name count as one witness, not two.

## Cases

- first valid checkpoint;
- valid append-only successor with the same consistency proof bytes;
- rollback/replay;
- same-size conflicting root;
- invalid log signature.

For the same-size conflict, `cryptovalid-opencore` must preserve a retrievable
pair of log-signed notes. UU-AAP independently verifies both log signatures,
same origin and tree size, and distinct roots.

## Reproducibility boundary

The raw split-view evidence file is retained exactly as emitted by each execution,
but it is **not** expected to be byte-identical across executions because the
stored previous checkpoint contains an ML-DSA-44 cosignature and ML-DSA signing
is randomized. The qualification therefore binds a deterministic semantic pair
fingerprint over the authenticated origin, tree size, the two checkpoint roots,
root distinctness, and verification of both log signatures.

The first successful execution receipt and artifact remain frozen as historical
evidence. Later runs must reproduce the same bounded semantic contract; they must
not manufacture byte parity by stripping or rewriting the original evidence.

`ML-DSA randomized signature bytes != semantic drift`

`Frozen historical execution receipt != byte-reproducible live receipt`

`Portable conflict evidence != global equivocation`

`Non-equivocation evidence != submission completeness`

`Exact pin verified != behavioral qualification PASS`
