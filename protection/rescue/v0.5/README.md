# Project Survival Plane v0.5 — Canonical Succession Proposal Protocol

This layer begins **after** a successful bounded non-canonical recovery from v0.4.

Its purpose is to make a possible canonical succession reviewable without allowing a recovered copy, an automated process, or the proposal itself to declare a new canonical origin.

## Core boundary

`recovered copy != canonical successor`

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
RECOVERED_NONCANONICAL bare repository
        |
local candidate ref
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

1. the v0.4 recovery directory verifies successfully;
2. its receipt is self-digested and explicitly non-canonical;
3. the predecessor binding matches the project and the recovered frontier;
4. the candidate repository is the recovered local bare repository;
5. the candidate repository has no Git remotes;
6. `git fsck --full` succeeds;
7. the candidate ref is a local `refs/heads/*` ref;
8. that ref resolves to a commit;
9. the recovered frontier is an ancestor of the candidate commit (equality is allowed);
10. the candidate tree and normalized ref-set are recorded.

v0.5 does not create candidate commits or update candidate refs. It only observes an already-existing local candidate.

## Proposal assessment

The assessor independently re-verifies the recovery directory, predecessor binding, proposal self-digest, candidate ref and ancestry. A successful assessment can only return:

`human_canonical_recognition_may_be_requested`

It cannot return `canonical_successor_established`.

A proposal is rejected if any required binding, ancestry, integrity, no-remote, project or digest check fails.

## Candidate advancement

The candidate may be exactly the recovered frontier or a descendant of it.

- equality means the proposal asks to preserve the last recovered canonical content as a possible successor frontier;
- a descendant means local post-recovery work exists and its lineage from the recovered frontier is provable.

Neither case grants canonicality.

## Local-only behavior

The reference implementation:

- performs no network access;
- creates no Git remote;
- performs no Git push;
- creates no tag or branch;
- changes no canonical repository state;
- changes no KONTUR state;
- does not transfer ownership;
- does not publish a successor.

## Human boundary

The next protocol layer, if introduced, must consume a reviewable proposal and require an explicit human recognition artifact. Recognition must remain separate from proposal generation and from non-canonical recovery execution.

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
