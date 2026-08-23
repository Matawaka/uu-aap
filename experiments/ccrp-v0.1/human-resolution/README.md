# CCRP v0.1 explicit human resolution after semantic HOLD

Tracking issue: `Matawaka/uu-aap#170`.

Frozen predecessor: `poai-ccrp-exp-v0.1` at `33215e251310105e2fac591b17ae2d90522488d9`.

Immediate predecessor conflict experiment: `Matawaka/uu-aap#165`, completed at `dd119229cac18f44b04fdad1ebb4ffe2a8655ec4`.

This directory is a disposable repository-scoped successor acceptance harness. It does **not** modify frozen CCRP v0.1 and is not CCRP/C6.

## Predecessor HOLD

The experiment binds the exact predecessor artifact:

- path: `experiments/ccrp-v0.1/semantic-conflict/result.json`
- Git blob: `416df58dff502ee7816b34af853139a553c3c202`
- semantic result SHA-256: `d0ca939f6806eaa7113ad204694bdf4342cc46b9a14866d862ed710a3a7e2c5d`
- decision slot: `routing_mode`
- conflict set: `direct`, `relay`
- predecessor outcome: `HOLD`
- `human_resolution_required = true`
- `winner_selected = false`
- `conflict_resolved = false`

All predecessor files remain immutable for this experiment.

## Required sequence

1. Merge this setup PR manually.
2. Re-read fresh `main` and verify this setup baseline still has `selected_value = null`.
3. **Only after setup is on `main`, the human participant provides a new explicit instruction selecting exactly one of:**
   - `direct`
   - `relay`
4. Before that new instruction exists, no executor may create a resolution artifact or infer a winner.
5. After the explicit instruction, create a new immutable `resolution.json` in this directory. It must bind the exact predecessor HOLD and record both the selected and non-selected values.
6. Merge the resolution PR manually.
7. Only then may a fresh reconciliation step create `result.json` and record experiment-local `conflict_resolved = true` if the resolution artifact validates.

## Critical negative control

**Merging the setup PR is not a resolution choice.**

Neither of these constitutes a human selection:

- merging this setup PR;
- saying `merged`, `смержил`, `continue`, `продолжи`, or equivalent workflow continuation;
- merge order of predecessor operations;
- PR number, branch name, timestamp or lexical ordering;
- rerunning an executor;
- inferred preference;
- any suggestion made by an assistant before the explicit post-setup choice.

Until a new explicit post-setup selection exists:

`selected_value = null`

`human_resolution_instruction_observed = false`

`resolution_artifact_present = false`

`conflict_resolved = false`

## Resolution semantics for this experiment

The resolution artifact is new evidence. It must not rewrite or invalidate either predecessor source operation.

`resolution != retry`

`resolution != arrival_order`

`resolution != source_rewrite`

`resolution_artifact != retroactive_mutation_of_conflict_evidence`

`explicit_selection != universal_authority`

A valid resolution artifact may establish only this experiment's recorded human selection and successor conflict-resolution state. It does not establish legal identity, legal authority/effect, truth, causality, responsibility, moral correctness, universal canonicality, universal CCRP correctness, or PoAI/V.

## Safety

Only `experiments/ccrp-v0.1/human-resolution/**` may change.

Do not modify:

- `experiments/ccrp-v0.1/semantic-conflict/**`;
- `proposals/ccrp/**`;
- `proposals/poai/**`;
- checkpoint manifests;
- protected checkpoint tags;
- workflows;
- rulesets.

No auto-merge. Human merge remains final.
