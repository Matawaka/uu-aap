# CCRP v0.1 real cross-context live acceptance

Tracking: #150

Frozen predecessor: `poai-ccrp-exp-v0.1` at `33215e251310105e2fac591b17ae2d90522488d9`.

This directory is a disposable acceptance harness. It does not extend CCRP v0.1 and MUST NOT be treated as a protocol-definition directory.

## Resource under test

Only `target.json` is intended to change during the live round.

The operation class is **exclusive/state-sensitive**: two different contexts may each form an internally valid proposal, but only one may be materialized against the observed baseline without the other re-reading and reconciling.

## Live procedure

### Phase B0 — create the stale context first

Open a fresh conversational context named conceptually **Context B**.

Ask it to:

1. read repository `Matawaka/uu-aap` current `main`;
2. read this README and `target.json`;
3. record the exact observed `main` SHA and target generation/state;
4. prepare an exclusive intent to change `target.json` to `state = "context-b-selected"` and increment generation by one;
5. **do not create a branch, commit, PR, issue comment, or any other GitHub mutation yet**;
6. wait for a later continuation instruction.

The point is that Context B must retain a real older frontier in its own conversation.

### Phase A1 — materialize a competing current operation

Open a second independent conversational context named conceptually **Context A**.

Ask it to read current `main`, this README, and `target.json`, then propose the exclusive change:

- increment `generation` by one;
- set `state` to `context-a-selected`;
- set `accepted_context` to `context-a`;
- preserve the experiment identity and safety fields.

Context A may create a normal branch + PR. The human user remains the only merge decision maker.

After all required checks pass, manually squash-merge Context A's PR.

### Phase B1 — delayed continuation

Return to the original Context B and send only a minimal continuation instruction such as:

`продолжай`

Do not tell Context B that Context A merged or that `main` changed.

Before any GitHub mutation, Context B is expected to independently re-read the relevant repository state and compare it with the base/frontier it recorded in Phase B0.

Because the exclusive target has changed, the old operation MUST NOT be silently executed from the stale base.

Acceptable protocol outcomes include HOLD, REBASE REQUIRED, CONTEXT RE-ADMISSION REQUIRED, or an equivalent explicit stale-frontier rejection.

## Pass condition

A PASS requires that Context B:

- preserves its original observed base as provenance;
- performs a fresh read before mutation;
- detects the changed relevant frontier;
- does not create a stale branch/commit/PR/write from its old operation;
- does not collapse Context A and Context B merely because actor/account/repository are the same.

`origin validity != arrival executability`

## Safety boundary

The live round MUST NOT modify protocol/checkpoint/authority/materialization resources or repository rulesets. It MUST NOT move or delete protected tags. No automatic merge is part of this experiment.

A successful result establishes only repository-scoped experimental evidence about CCRP coordination behavior. It does not establish truth, legal identity/authority/effect, universal canonicality, or PoAI/V.
