# Parallel Sustainability Kernel v0.1

**Status:** non-normative draft  
**Branch:** `parallel/sustainability-backlog-v0.1`  
**Purpose:** compact the isolated sustainability side-track into a small set of invariants that may be reviewed or selectively adopted later without requiring whole-branch integration.

This document does not change `main`, CHSP, CCRP, KONTUR, repository governance, release state, workflow requirements, or execution authority.

## Kernel invariants

### K1. Main-line independence

The active main line MUST NOT depend on the parallel side-track in order to continue.

`parallel may observe main`

`main does not depend on parallel`

No parallel artifact is a required check, required workflow, prerequisite, or implicit gate for main-line progress.

### K2. Information is not authority

Recovery checkpoints, handoffs, observations, assessments, archive records, and convergence reviews carry information only.

`state transfer != authority transfer`

`observation != authorization`

`recommendation != execution authority`

### K3. Freshness before re-entry

Any movement of mutable external state invalidates assumptions tied to the old observation frontier.

Before resuming, integrating, or relying on side-track conclusions, re-observe the current external state and reassess semantic/path overlap.

`old observation + changed world -> stale assumption`

### K4. Capability expansion is attributable

A component MUST NOT expand its own capability ceiling, infer broader permission from unrelated authorization, route around denial, or treat inactivity/delay as consent.

Any expansion requires a new attributable authorization event.

### K5. Pause and inactivity preserve history, not permission

A human may pause or leave the project without losing the achieved project state.

At the same time, inactivity does not preserve mutable external authorization indefinitely and does not become consent.

`project continuity != authorization continuity`

### K6. Parallel work creates no merge entitlement

Age, effort, novelty, commit count, branch distance, or earlier creation do not create a right to integration.

A future main-line implementation may overlap, partially supersede, fully supersede, selectively adopt, or remain independent from a side-track artifact.

`parallel existence != merge obligation`

### K7. Selective adoption over whole-branch pressure

If useful material survives future review, prefer adoption of bounded invariants or individual artifacts with provenance over merging the entire historical side-track by inertia.

Integration requires fresh observation, overlap review, validation, and an explicit human decision.

### K8. Supersession preserves provenance

Archival, rejection, supersession, or selective adoption MUST NOT silently erase historical origin, disagreement, or reasons for disposition.

`supersession != historical deletion`

`archive != hidden execution queue`

### K9. Human-sustainability signals have no authority effect

Interaction-load observations may adapt pacing, checkpointing, novelty, or decision density, but MUST NOT become medical diagnosis, biometric inference, hidden psychological scoring, fitness determination, or authority reduction.

`interaction adaptation != authority change`

### K10. Observation itself is bounded

The side-track SHOULD observe external state only when necessary to avoid material staleness. Continuous polling, background monitoring, or observe-then-auto-act behavior is outside this kernel.

`observe to avoid stale assumptions != monitor to control main`

## Minimal future adoption set

A future reviewer can evaluate these invariants independently of the rest of the side-track. No reviewer needs to merge the branch, preserve every draft schema, or accept every exploratory artifact in order to reuse one kernel invariant.

The expected disposition choices remain:

- keep isolated;
- selectively adopt;
- supersede by main;
- archive;
- reject;
- defer.

None is automatic.

## Non-goals

This kernel does not:

- authorize CHSP v1.0 or any executor;
- activate KONTUR;
- alter repository roles or collaborator permissions;
- create a workflow or required status check;
- change tags, releases, checkpoints, canonical origin, or provenance anchors;
- require main to stop, wait, review, or merge;
- diagnose human health or competence.

## Compact causal chain

`isolated work -> bounded observation -> stale-state detection -> independent re-observation -> overlap review -> explicit disposition -> selective adoption OR preserved isolation/archive`

The main line remains independently free to continue throughout that chain.
