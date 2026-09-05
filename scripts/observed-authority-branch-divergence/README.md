# Observed Authority Branch Divergence Receipt v0.1

Status: **additive interoperability/observability successor for #899; not Stable Core, not C2PA conformance, not a transparency log, and not a global equivocation verdict**.

Exact predecessor:

- merged #898 / `92c32e58ac59508de66b55bfbbb471e07ef7fcc4` — Authority Surface Continuity Chain Receipt v0.1.

Historical predecessors remain unchanged:

- #890 — Authority-Admission Consistency Gate v0.1;
- #892 — Observable Authority Consistency Receipt v0.1;
- #894 — Authority Surface Triangulation Receipt v0.1;
- #896 — Authority Surface Transition Receipt v0.1;
- #898 — Authority Surface Continuity Chain Receipt v0.1.

## Purpose

#898 proves local adjacency for one supplied observed chain while explicitly denying complete-history and global-non-equivocation claims.

This successor compares two independently valid #898 chains that share an exact observed origin and describes where the supplied observations diverge.

Core boundary:

```text
Observed branch divergence != proven global equivocation
Two valid observed branches != malicious behavior proof
Shared supplied prefix != complete shared history
First differing supplied snapshot != proven immediate causal fork point
Observed reconvergence != identical intermediate history proof
Branch comparison != canonical branch selection
```

## Input

Closed-world schema:

```text
urn:uu-aap:observed-authority-branch-divergence-input:0.1
```

Only these top-level fields are accepted:

```text
schema
left_chain
right_chain
```

`left_chain` and `right_chain` are exact #898 inputs (`schema + snapshots`). They are rematerialized through the merged #898 evaluator. Caller-supplied chain receipts, edge receipts, fork receipts or verdicts are not accepted.

Both chains must begin with the exact same canonical snapshot fingerprint. Different first snapshots fail closed as `NO_COMMON_OBSERVED_ORIGIN`.

## Relations

The longest common supplied snapshot-fingerprint prefix determines one descriptive relation:

```text
IDENTICAL_OBSERVED_BRANCHES
LEFT_IS_OBSERVED_PREFIX
RIGHT_IS_OBSERVED_PREFIX
DIVERGENT_OBSERVED_PATHS
```

A prefix relation is not called a fork: one observed chain may simply contain additional supplied states.

`DIVERGENT_OBSERVED_PATHS` requires both chains to contain a distinct next supplied snapshot after their common prefix.

## Divergence metadata

For divergent paths the receipt records:

- common-prefix length;
- exact shared pivot fingerprint;
- left/right first-divergent fingerprints;
- exact equality of runtime/export/signed-root surfaces at the first divergence;
- exact signed-root id/version/digest on both sides;
- `parallel_same_version_root_variants_observed` when root id+version match while root document digests differ.

The latter is deliberately an observation, not an equivocation claim:

```text
parallel_same_version_root_variants_observed = true
!=
global_equivocation_proven = true
```

## Canonical parallel-root fixture

`fixtures/parallel-root-variants.json` contains a shared root-v2 snapshot and two independently valid root-v3 successors:

```text
shared S0:
  root id      = fixture-root
  root version = 2
  digest       = 3333...

left S1:
  root id      = fixture-root
  root version = 3
  digest       = aaaa...

right S1:
  root id      = fixture-root
  root version = 3
  digest       = bbbb...
```

Both branches pass the existing #896/#898 contracts independently.

Required observation:

```text
relation = DIVERGENT_OBSERVED_PATHS
parallel_same_version_root_variants_observed = true
global_equivocation_proven = false
malicious_behavior_proven = false
canonical_branch_selected = false
```

## Same-root surface divergence

Divergence can also occur while the exact signed root remains identical. The reconvergence fixture demonstrates two different surface updates under root-v2:

```text
left:  export changes
right: runtime changes
root:  exact same v2 bytes
```

The receipt therefore distinguishes surface divergence from root-byte divergence.

## Observed reconvergence

`fixtures/reconvergent.json` later includes one exact common snapshot after the branches diverge.

The receipt reports only:

```text
observed_reconvergence_present = true
first_common_post_divergence_fingerprint_sha256 = <exact fingerprint>
```

It does not prove:

- the branches were complete;
- no states were omitted;
- the two intermediate histories were causally related;
- the common later snapshot is globally canonical.

## Branch binding

Each exact snapshot uses #898's canonical JSON SHA-256 fingerprint construction.

Each branch additionally gets a deterministic SHA-256 over its ordered snapshot fingerprint sequence.

This proves only local source binding of the supplied branch representation. It is not trusted time, signer identity, log inclusion, authority or global uniqueness.

## Hostile coverage

`test_receipt.py` contains 20 positive/negative/hostile tests covering:

- parallel same-version root variants;
- observed reconvergence;
- same-root surface divergence;
- identical branches;
- left/right prefix extension;
- different successor root versions;
- different observed origins;
- invalid branch interiors;
- unknown top-level fields;
- caller-supplied chain receipts;
- canonical/preferred branch controls;
- equivocation verdict injection;
- nested latest-root controls;
- input immutability;
- deterministic output;
- exact branch fingerprints;
- semantic non-claims;
- absence of aggregate score/fraud/failure verdicts;
- wrong schema rejection.

## Explicit non-claims

Every conforming receipt fixes false at minimum:

```text
global_equivocation_proven
malicious_behavior_proven
complete_history_proven
no_omitted_states_proven
all_parallel_branches_observed
trusted_time_proven
immediate_causal_fork_point_proven
canonical_branch_selected
branch_ordering_or_preference_established
authority_mutated
quorum_mutated
remediation_triggered
```

Therefore:

```text
Observed divergence != global fork topology proof
Observed same-version root variants != fraud proof
Observed reconvergence != complete-history proof
More snapshots != preferred branch
```

## Non-effects

This layer does not:

- modify Stable Core, `SPEC.md` or `PRINCIPLES.md`;
- rewrite #890/#892/#894/#896/#898/#777;
- claim C2PA conformance;
- implement a transparency log;
- prove append-only history or global non-equivocation;
- prove trusted chronology;
- infer signer/operator intent, fraud or compromise;
- select a canonical/latest/preferred branch;
- alert or remediate;
- admit/revoke signers;
- calculate or mutate quorum;
- create publication/action authority.

Any stronger fork, non-equivocation, log or authority claim requires a separate successor with its own evidence and authority boundary.
