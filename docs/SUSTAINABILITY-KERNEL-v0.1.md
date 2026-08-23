# Sustainability Kernel v0.1

**Status:** non-normative integration candidate  
**Observed predecessor:** `0885e230872c546a395cab5c1c5319f99ba3d0c2` (CHSP v1.0 merged main)  
**Purpose:** preserve a small set of project-continuity and non-interference invariants without making the active main line depend on a historical parallel branch.

This document does not authorize execution, activate KONTUR, alter CHSP/CCRP semantics, change repository permissions, create required checks, or establish a new canonical authority layer.

## Kernel invariants

### K1. Main-line independence

The active main line MUST NOT depend on exploratory or parallel work in order to continue.

`parallel may observe main`

`main does not depend on parallel`

No exploratory artifact is an implicit required check, workflow prerequisite, or merge gate.

### K2. Information is not authority

Checkpoints, handoffs, observations, assessments, archive records, recommendations, and convergence reviews carry information only.

`state transfer != authority transfer`

`observation != authorization`

`recommendation != execution authority`

### K3. Freshness before re-entry

A change in mutable external state invalidates assumptions bound to an older observation frontier.

Before resuming, integrating, or relying on earlier conclusions, re-observe the relevant current state and reassess semantic/path overlap.

`old observation + changed world -> stale assumption`

This complements CHSP v1.0 stale-request, fresh-preflight, and post-write re-observation semantics; it does not replace them.

### K4. Capability expansion is attributable

A component MUST NOT expand its own capability ceiling, infer broader permission from unrelated authorization, route around denial, or treat inactivity/delay as consent.

Any capability expansion requires a new attributable authorization event.

This is a general project invariant and does not widen any CHSP v1.0 authorization.

### K5. Pause preserves history, not mutable permission

A human may pause or leave the project without losing the achieved project state.

Inactivity does not preserve mutable external authorization indefinitely and does not become consent.

`project continuity != authorization continuity`

### K6. Exploratory work creates no merge entitlement

Age, effort, novelty, commit count, branch distance, or earlier creation do not create a right to integration.

`exploratory existence != merge obligation`

### K7. Selective adoption over whole-branch pressure

If useful material survives later review, prefer bounded adoption of specific invariants or artifacts with provenance over merging an entire historical branch by inertia.

Integration requires fresh observation, overlap review, validation, and an explicit human decision.

### K8. Supersession preserves provenance

Archival, rejection, supersession, or selective adoption MUST NOT silently erase historical origin, disagreement, or reasons for disposition.

`supersession != historical deletion`

`archive != hidden execution queue`

### K9. Human-sustainability signals have no authority effect

Interaction-load observations may adapt pacing, checkpointing, novelty, or decision density, but MUST NOT become medical diagnosis, biometric inference, hidden psychological scoring, fitness determination, or authority reduction.

`interaction adaptation != authority change`

### K10. Observation is bounded

Observe external state only when needed to avoid material staleness. Continuous polling, background monitoring, or observe-then-auto-act behavior is outside this kernel.

`observe to avoid stale assumptions != monitor to control main`

## Relationship to CHSP v1.0

CHSP v1.0 remains the specific bounded external transition execution architecture. Its execution request, fresh provider preflight, exact authorization binding, replay protection, post-write verification, uncertainty handling, and receipt semantics remain authoritative within CHSP.

The kernel is deliberately orthogonal:

- K2 and K3 reinforce CHSP's separation of evidence, authorization, freshness, and execution;
- K4 generalizes the no-self-escalation principle beyond one CHSP operation;
- K1, K5-K10 address project continuity, parallel work, provenance, human sustainability, and bounded observation outside CHSP's executor scope.

`kernel adoption != CHSP execution`

`kernel adoption != KONTUR activation`

## Non-goals

This kernel does not:

- invoke or authorize the CHSP v1.0 executor;
- create provider credentials or collaborator changes;
- activate KONTUR;
- change workflows or required status checks;
- change tags, releases, checkpoints, canonical origin, or historical anchors;
- require main to stop, wait, review, or merge future exploratory work;
- diagnose human health or competence.

## Compact causal chain

`preserve -> observe only as needed -> detect staleness -> re-observe -> review overlap -> explicit disposition -> selectively adopt OR preserve isolation/archive`

The active main line remains independently free to continue throughout this chain.
