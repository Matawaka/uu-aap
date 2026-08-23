# Sustainability v0.1 — Parallel Non-Normative Drafts

This directory is an isolated, non-normative side-track for project sustainability and recovery experiments.

It does **not** amend UU-AAP, CCRP, CHSP, KONTUR, PoAI authority semantics, release checkpoints, GitHub Rulesets, or any frozen historical artifact.

## Isolation rule

The current side-track is intended to remain additive while the active main-line process continues.

Allowed work in this branch is limited to new files under:

- `schemas/sustainability/v0.1/`
- `docs/PARALLEL-SUSTAINABILITY-*`

The side-track must not use its existence as evidence of future integration approval.

## Draft artifacts

The current drafts cover:

- project recovery checkpoints;
- capability ceilings;
- STOP / PAUSE / RESUME / ABORT validation vectors;
- recovery handoff between contexts;
- motivation-governor state separation;
- non-diagnostic human interaction-load observations;
- explicit parallel integration gates;
- machine-readable branch-isolation constraints.

## Local validation only

Validation code in `tests/` is deliberately not connected to GitHub Actions.

Where Python `jsonschema` is available, schema fixtures can be checked locally with:

```bash
python -m unittest schemas.sustainability.v0.1.tests.test_sustainability_v01
```

Because the directory name `v0.1` is not a valid Python package identifier, direct file execution is the portable form:

```bash
python schemas/sustainability/v0.1/tests/test_sustainability_v01.py
python schemas/sustainability/v0.1/tests/test_parallel_work_isolation_v01.py
```

The isolation verifier reads the local Git history and diff only. It performs no fetch, push, merge, ref update, file mutation, workflow activation, or external-system action.

## Integration is a separate event

A later proposal to integrate any of these drafts must be treated as a new event and must, at minimum:

1. freshly observe the then-current `main`;
2. review changed-path overlap with main-line work completed since the side-track base;
3. validate relevant schemas/examples;
4. resolve semantic overlap rather than silently overwriting either lineage;
5. obtain an explicit human integration decision.

Branch creation, elapsed time, successful local validation, or semantic similarity to later main-line work are not integration authorization.

`parallel preparation != merge authorization`

`handoff != authority transfer`

`observation != diagnosis`

`idea captured != execution duty`
