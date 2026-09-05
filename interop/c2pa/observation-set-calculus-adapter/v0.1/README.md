# C2PA → Observation Set Calculus Candidate Adapter v0.1

**Status:** two-domain reuse proof adapter / C2PA-specific source / candidate-neutral target  
**Tracking:** #909

This adapter proves that accepted C2PA authority-observability evidence can consume the same candidate observation-set implementation as a non-C2PA domain without rewriting the accepted C2PA stack.

## Source contracts

The adapter directly invokes merged:

- #902 `Observed Authority Branch Set Receipt v0.1`;
- #904 `Observed Authority Branch-Set Transition Receipt v0.1`;
- #906 `Observed Authority Branch-Set Transition Chain Receipt v0.1`.

No source receipt is trusted by shape alone: the accepted evaluator is re-run first.

## Projection

For every accepted #902 branch observation:

```text
candidate semantic_fingerprint_sha256 = exact #902 branch fingerprint
candidate source_binding_sha256       = SHA-256(canonical exact branch input)
candidate scope_binding_sha256        = #902 common-origin snapshot fingerprint
```

The adapter then invokes the provider-neutral candidate profile.

## Parity proof

For transitions it requires exact parity with #904 for:

- membership relation class after the domain→neutral vocabulary mapping;
- newly observed branch fingerprints;
- not-observed-after branch fingerprints;
- observed-in-both branch fingerprints;
- multiplicity lifecycle.

For chains it requires parity with #906 for:

- set count;
- edge count;
- mapped relation sequence;
- per-edge membership lifecycle;
- local adjacency.

## Deliberately not projected

C2PA-specific semantics remain in the C2PA source layer:

- runtime/configured signers;
- exported signers;
- signed-root admission;
- crypto verification state;
- quorum eligibility;
- root-version variants;
- pairwise branch/fork topology;
- global equivocation/non-equivocation claims.

`Adapter Projection != Source Receipt Rewrite`  
`Common Candidate Calculus != Generic C2PA Authority Model`

The adapter creates no C2PA reclassification, quorum mutation, authority, Core admission or Interface Registry admission.
