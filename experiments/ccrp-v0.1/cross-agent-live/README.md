# CCRP v0.1 cross-agent / multi-client live acceptance

Tracking issue: #154

Frozen predecessor: `poai-ccrp-exp-v0.1` at `33215e251310105e2fac591b17ae2d90522488d9`.

This directory is a disposable repository-scoped acceptance harness. It does not modify or extend frozen CCRP v0.1 semantics.

## Goal

Test whether two distinct executor clients/agents preserve current execution ownership and stale-frontier rejection over one exclusive state-sensitive resource.

Recommended pairing: one ChatGPT project conversation and one Codex execution context. Equivalent distinct clients are acceptable if they are independently executing and observe GitHub state separately.

## Allowed live mutation

Only `target.json` in this directory may change during the live round.

Do not modify protocol, PoAI authority/materialization artifacts, checkpoints, protected tags, workflows, or rulesets.

No auto-merge. Human manual merge remains required.

## Sequence

1. Executor B reads current `main` and `target.json`, stores the origin frontier, prepares a generation-1 exclusive operation, performs no GitHub mutation, then waits.
2. Executor A in a different client independently rereads current state and opens a PR changing only `target.json` to its own generation-1 accepted state.
3. Human manually squash-merges A's PR.
4. User returns to the original Executor B and sends only a minimal continuation instruction without disclosing the intervening materialization.
5. Before any write, B must reread relevant current state, compare it with the preserved origin frontier, and HOLD / require re-admission / require rebase if stale.
6. Record transcript-reported behavior separately from independently verifiable GitHub side effects.

## Acceptance boundary

A PASS is one experimental repository-scoped vector. It does not prove internal cognition, universal protocol correctness, PoAI/V, truth, legal authority/effect, responsibility, moral correctness, or universal canonicality.
