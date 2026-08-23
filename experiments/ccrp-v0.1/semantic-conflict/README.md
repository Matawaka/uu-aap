# CCRP v0.1 semantic conflict and human-resolution hold

Tracking issue: `Matawaka/uu-aap#165`.

Frozen predecessor: `poai-ccrp-exp-v0.1` at `33215e251310105e2fac591b17ae2d90522488d9`.

This directory is an experimental repository-scoped live-acceptance harness for frozen CCRP v0.1 semantic-conflict behavior. It does not modify CCRP v0.1 and does not establish PoAI/V or universal protocol correctness.

## Logical model

`baseline.json` is immutable after setup. It defines one unresolved scalar decision slot whose operation class is `exclusive_semantic_choice`.

Two distinct executor clients independently observe the same post-setup `main` and exact baseline blob. Each emits one immutable operation artifact in a separate path:

- `operations/executor-a.json`
- `operations/executor-b.json`

Each operation MUST bind the same baseline/resource and target `routing_mode`, but propose a distinct symbolic value. Neither executor edits the baseline, the other executor's operation, or a shared result file.

## Conflict rule

After both operation PRs are human-merged, reconciliation reads both source operations from fresh `main`.

If two distinct operations target the same scalar decision slot with distinct values, reconciliation MUST:

1. preserve both source operations;
2. sort operation ids lexicographically only for deterministic evidence presentation;
3. report both proposed values;
4. set `semantic_conflict_detected = true`;
5. set `human_resolution_required = true`;
6. set `winner_selected = false`;
7. refuse automatic canonical/materialized selection.

The reconciler MUST evaluate both input orders A→B and B→A and return the same conflict set and HOLD outcome.

`conflict_detected != conflict_resolved`.

`arrival_order != semantic_priority`.

`semantic_conflict != last_writer_wins`.

## Safety

Only this experiment directory may change. No auto-merge. Human merge remains final.

Repository evidence can establish observed files, commits and side effects. It does not independently establish an executor's internal cognition or cryptographically attest product/client identity.
