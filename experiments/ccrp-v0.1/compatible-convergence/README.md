# CCRP v0.1 compatible cross-agent deterministic convergence

Tracking issue: `Matawaka/uu-aap#158`.

Frozen predecessor: `poai-ccrp-exp-v0.1` at `33215e251310105e2fac591b17ae2d90522488d9`.

This directory is an experimental repository-scoped live-acceptance harness for the frozen CCRP v0.1 C3 compatible-concurrency semantics. It does not modify CCRP v0.1 and does not establish PoAI/V or universal protocol correctness.

## Logical model

`baseline.json` is immutable after this setup PR is merged. It defines one logical resource whose operation class is `commutative_addition`.

Two distinct executor clients will independently observe the same post-setup `main` and exact `baseline.json` blob before either live operation is merged.

Each executor then adds exactly one immutable operation artifact:

- `operations/executor-a.json`
- `operations/executor-b.json`

The operations MUST:

- bind the same observed post-setup `main` SHA;
- bind the same `baseline.json` blob SHA and logical resource id;
- use `operation_class = "commutative_addition"`;
- use distinct operation ids;
- contribute distinct symbolic values;
- leave all protocol / PoAI / checkpoint / workflow / tag / ruleset files untouched.

Neither executor edits `baseline.json`, the other executor's operation, or a shared result file.

## Reconciliation rule

After both operation PRs are human-merged, reconciliation reads both source operations from fresh `main` and derives `result.json` as follows:

1. reject operations whose baseline/resource binding does not match the experiment baseline;
2. deduplicate exact repeated operation ids;
3. sort accepted operations lexicographically by `operation_id`;
4. project contributions in that semantic order;
5. include each accepted contribution exactly once;
6. preserve both source operation files unchanged.

The reconciler MUST calculate the semantic result from both input orders, A→B and B→A, and show the same ordered operation ids and contribution values for both.

`arrival_order != semantic_priority`.

`deterministic_convergence != materialization`.

## Safety

Only this experiment directory may be changed by the live vector. No auto-merge. Human merge remains final.

Repository evidence can establish observed files, commits and side effects. It does not independently establish an executor's internal cognition or cryptographically attest product/client identity.
