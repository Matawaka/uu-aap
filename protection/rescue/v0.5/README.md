# Project Survival Plane v0.5 — Canonical Succession Proposal Protocol

This layer begins **after** a successful bounded non-canonical recovery from v0.4.

Its purpose is to make a possible canonical succession reviewable without allowing a recovered copy, a continuation workspace, an automated process, or the proposal itself to declare a new canonical origin.

## Core boundary

`recovered copy != canonical successor`

`sealed recovery evidence != continuation workspace`

`continued local work != canonical succession`

`proposal admissible != proposal accepted`

`proposal reviewable != canonical recognition`

`human recognition requested != ownership transferred`

`canonical succession != KONTUR activation`

## Causal chain

```text
repository-scoped canonical predecessor binding
        |
verified RescueExecutionReceipt v0.4
        |
SEALED RECOVERED_NONCANONICAL repository
        |                       \
        |                        -> remains byte/ref-set stable evidence
        v
separate local bare candidate repository
        |
local candidate refs / post-recovery work
        |
ancestor / integrity / no-remote checks
        |
CanonicalSuccessionProposal v0.5
        |
CanonicalSuccessionProposalAssessment v0.5
        |
proposal_reviewable
        |
SEPARATE HUMAN RECOGNITION BOUNDARY
```

v0.5 stops before the final line. It contains no canonical-recognition executor.

## Why the candidate repository is separate

The v0.4 execution receipt seals the recovered Git ref-set. Mutating that repository after recovery would invalidate its receipt and destroy the clean evidence boundary.

Therefore v0.5 requires two distinct local objects:

1. the **sealed recovery directory**, which must continue to verify under v0.4; and
2. a **separate non-canonical candidate bare repository**, which may contain local continuation work.

The reference v0.5 tool does not create or mutate the candidate repository. An external, separately attributable action may prepare it from the sealed recovery. v0.5 only reads it.

## Canonical predecessor binding

A `CanonicalPredecessorBinding` records the repository-scoped origin and a precise frontier before succession is considered. The reference builder is local-only and records:

- project ID;
- canonical origin ID;
- exact frontier ref;
- exact frontier commit and tree;
- normalized Git ref-set SHA-256;
- binding time;
- a self-digest.

The binding does not claim universal canonicality, legal ownership, or selection of a future successor.

## Candidate requirements

A proposal may be created only when:

1. the sealed v0.4 recovery directory verifies successfully;
2. its receipt is self-digested and explicitly non-canonical;
3. the predecessor binding matches the project and recovered frontier;
4. the separate candidate repository is local, bare and non-symlink;
5. the candidate repository has no Git remotes;
6. `git fsck --full` succeeds;
7. the recovered frontier commit is present in the candidate repository;
8. the candidate ref is a local `refs/heads/*` ref;
9. that ref resolves to a commit;
10. the recovered frontier is an ancestor of the candidate commit (equality is allowed);
11. the candidate tree and normalized ref-set are recorded.

v0.5 does not create candidate commits, update refs, copy Git objects, create remotes, or publish anything.

## Proposal assessment

The assessor independently re-verifies:

- the sealed v0.4 recovery directory;
- predecessor binding self-digest and claims;
- project and exact recovered-frontier binding;
- proposal self-digest and non-authority claims;
- separate candidate repository integrity;
- no-remote condition;
- candidate ref;
- candidate ancestry;
- candidate tree;
- candidate ref-set digest.

A successful assessment can only return:

`human_canonical_recognition_may_be_requested`

It cannot return `canonical_successor_established`.

A proposal is rejected if any required binding, ancestry, integrity, no-remote, project or digest check fails.

## Candidate advancement

The candidate may be exactly the recovered frontier or a descendant of it.

- equality means the proposal asks to preserve the last recovered canonical content as a possible successor frontier;
- a descendant means separately attributable local post-recovery work exists and its lineage from the recovered frontier is provable.

Neither case grants canonicality.

## Local-only behavior

The reference implementation:

- performs no network access;
- creates no Git remote;
- performs no Git push/fetch/clone;
- creates no tag or branch;
- updates no candidate ref;
- changes no sealed recovery state;
- changes no canonical repository state;
- changes no KONTUR state;
- does not transfer ownership;
- does not publish a successor.

## Human boundary

A future recognition layer must consume a reviewable proposal and require an explicit human recognition artifact. Recognition must remain separate from proposal generation, candidate preparation, and non-canonical recovery execution.

## Non-goals

v0.5 does not establish:

- a canonical successor;
- a new canonical URL or hosting provider;
- repository ownership transfer;
- legal identity or legal effect;
- universal canonicality;
- distributed consensus;
- KONTUR activation;
- factual truth of the recovered history.

The canonical predecessor remains canonical for repository-scoped lineage until a later, explicitly authorized recognition protocol says otherwise.
