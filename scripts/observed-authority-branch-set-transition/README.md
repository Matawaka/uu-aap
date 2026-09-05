# Observed Authority Branch-Set Transition Receipt v0.1

This directory materializes issue #903 as a successor-only temporal-observability primitive after merged #902.

It compares two independently valid **observed branch sets** without treating the caller-supplied `before_set` / `after_set` roles as trusted time and without turning changes in supplied observations into claims about global branch existence.

## Predecessor boundary

The implementation imports and invokes the merged #902 evaluator directly:

```text
before_set branches -> merged #902 -> before receipt
                                      \
after_set branches  -> merged #902 -> transition observation
                                      /
```

It does not define another branch-set, continuity, or divergence model.

Accepted predecessor frontier when this layer was opened:

```text
#902 merge/main = c83bcceb0e1b314d8077180dea4f95dd9c690f36
```

## Core distinction

```text
newly observed branch
        !=
newly created branch

not observed in after
        !=
branch deleted / terminated

observed in both
        !=
continuous existence proven
```

The receipt compares only the two supplied observation sets.

## Closed-world input

```json
{
  "schema": "urn:uu-aap:observed-authority-branch-set-transition-input:0.1",
  "before_set": {
    "schema": "urn:uu-aap:observed-authority-branch-set-input:0.1",
    "branches": []
  },
  "after_set": {
    "schema": "urn:uu-aap:observed-authority-branch-set-input:0.1",
    "branches": []
  }
}
```

Each nested set must independently satisfy merged #902.

The transition layer rejects unknown top-level controls and inherits #902's closed-world validation for each nested set.

Forbidden control surfaces include timestamps/trusted-time claims, latest/canonical/preferred branch controls, creation/deletion claims, scores/verdicts, alert/remediation commands and authority/quorum mutations.

## Common-origin requirement

The two independently accepted #902 receipts must bind the same exact:

```text
common_origin_snapshot_fingerprint_sha256
```

Otherwise the comparison fails closed as:

```text
OBSERVED_SET_ORIGIN_CHANGED
```

This avoids pretending that two unrelated branch universes form one temporal comparison.

The common fingerprint is exact local source binding, not trusted chronology or global identity.

## Distinct-branch observation lifecycle

The receipt emits:

```text
newly_observed_branch_fingerprints
not_observed_in_after_branch_fingerprints
observed_in_both_branch_fingerprints
```

Those names are deliberate.

They never imply:

```text
creation
deletion
termination
continuous existence
first-ever observation
last-ever observation
```

## Observation multiplicity

For every branch fingerprint present in either set:

```text
before_observation_count
after_observation_count
delta
```

Duplicate observations stay observations only.

```text
more observations != more authority
more observations != more trust
more observations != quorum weight
more observations != branch preference
```

## Descriptive relation

Exactly one relation is emitted:

```text
IDENTICAL_OBSERVED_SET
OBSERVATION_MULTIPLICITY_ONLY_CHANGED
OBSERVED_BRANCH_MEMBERSHIP_CHANGED
OBSERVED_BRANCH_AND_MULTIPLICITY_CHANGED
```

For the last class, "multiplicity" means the observation count of at least one **persisted** branch also changed. The count of a newly observed or no-longer-supplied branch does not by itself promote a membership change into the combined class.

None of these relations proves trusted time or real-world creation/deletion.

## Root-variant observation lifecycle

For every observed `(root id, root version)` group across either #902 receipt, the transition reports:

```text
newly_observed_digests
not_observed_in_after_digests
observed_in_both_digests
```

Boundary:

```text
newly observed digest != newly issued root
absent-after digest != revoked root
multiple observed digests != global equivocation proof
```

## Pairwise observation lifecycle

Every #902 pairwise matrix row is keyed by the exact unordered pair of branch fingerprints.

The transition emits:

```text
newly_observed_pairs
not_observed_in_after_pairs
observed_in_both_pairs
```

For a pair present in both sets, its deterministic #900-derived evidence must match exactly. A mismatch fails closed rather than silently treating the same exact pair as two different relations.

Pair disappearance means only that at least one member branch was not supplied in the after set.

## Cross-set digest consistency

Merged #902 validates same-digest semantics inside each set. This successor additionally applies the **same merged #902 normalized signer-membership guard across the union** of before and after observations:

```text
same document_sha256
    + different normalized signer membership
    = FAIL_CLOSED
```

This check remains alias/order safe:

```text
surface alias id change != signer membership change
signer input order change != signer membership change
```

The successor does not strengthen exact source bytes into ontology. It only prevents contradictory normalized signer membership from being associated with one exact source digest across the compared observations.

## Semantic guards

Every receipt fixes all of these to `false`:

```text
before_after_roles_prove_trusted_time
newly_observed_proves_branch_creation
not_observed_in_after_proves_branch_deletion
observed_in_both_proves_continuous_existence
root_digest_newly_observed_proves_issuance
root_digest_absent_after_proves_revocation
all_existing_branches_observed
global_non_equivocation_proven
global_equivocation_proven
complete_history_proven
complete_fork_topology_proven
canonical_branch_selected
preferred_branch_selected
malicious_behavior_proven
authority_mutated
quorum_mutated
remediation_triggered
```

There is no aggregate trust, fraud, failure, severity, likelihood, or branch-ranking score.

## Hostile coverage

`test_receipt.py` contains 23 tests covering:

1. exact-set equality despite input order;
2. duplicate-observation multiplicity change;
3. newly observed distinct branch;
4. branch not supplied in after;
5. simultaneous membership + persisted multiplicity change;
6. root-digest observation expansion;
7. root-digest observation contraction;
8. pairwise lifecycle introduction;
9. persistent pair evidence under duplicate change;
10. different valid common origins;
11. invalid before set;
12. invalid after set;
13. cross-set runtime digest contradiction;
14. cross-set export digest contradiction;
15. cross-set signed-root digest contradiction;
16. later surface alias change remains admissible;
17. later signer ordering change remains admissible;
18. unknown transition controls;
19. unknown nested set controls;
20. input immutability;
21. deterministic output;
22. semantic guards fixed false;
23. absence of aggregate score/verdict fields.

## CI predecessor preservation

Dedicated validation re-runs unchanged:

```text
#890 authority-admission tests
#892 observable-consistency tests
#894 triangulation tests
#894 predecessor cross-check
#896 transition tests
#898 continuity-chain tests
#900 divergence tests
#902 branch-set tests
#902 alias/order regression tests
```

Only after that does it run this successor's tests and exact receipt assertions.

Validation is repository-read-only and uses `PYTHONDONTWRITEBYTECODE=1` so the clean-tree proof is meaningful.

## Non-claims

This primitive does **not** implement or prove:

- Stable Core/SPEC changes;
- C2PA conformance;
- transparency-log semantics;
- trusted timestamps;
- complete history or complete fork topology;
- global non-equivocation or global equivocation;
- branch creation/deletion/termination;
- branch canonicalization or preference;
- live polling;
- alert/remediation;
- signer authority mutation;
- quorum mutation;
- malicious intent or fraud.

It is additive, local, deterministic, source-bound observability evidence only.
