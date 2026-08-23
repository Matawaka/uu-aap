# Parallel Sustainability Backlog v0.1

**Status:** non-normative parallel draft  
**Repository:** `Matawaka/uu-aap`  
**Branch:** `parallel/sustainability-backlog-v0.1`  
**Origin main SHA:** `89b26161312a120b03c874968245331391c3e107`  
**Observed origin state:** CHSP v0.8 external transition envelope and dry-run verifier merged as PR #271.

## Purpose

This document defines work that can proceed in parallel with the active protocol-development line without changing its semantics, activation state, permissions, workflow requirements, tags, releases, or authority boundaries.

It is intentionally additive and non-normative. It does **not** redefine UU-AAP v0.1, frozen CCRP v0.1, PoAI authority artifacts, CHSP, KONTUR, historical checkpoints, or any current readiness decision.

The goal is to improve project survivability, recoverability, human control, and development sustainability while preserving the right of the active line to evolve independently.

## Non-interference envelope

Parallel work under this backlog MUST NOT:

1. modify `main` directly;
2. rewrite or retarget historical tags/checkpoints;
3. change active CHSP/CCRP schemas, validators, workflows, or reference policies;
4. activate KONTUR or expand any agent permission/capability;
5. claim readiness, authority, legitimacy, truth, or conformance on behalf of another protocol layer;
6. introduce required telemetry of private conversations, biometrics, medical data, or full prompt histories;
7. create a scalar human-performance or trust score;
8. silently convert a research observation into an enforcement rule;
9. merge automatically merely because the parallel artifact is internally complete.

Before integration, every artifact MUST be compared with then-current `main`. If the active line has changed the relevant assumptions, the parallel artifact MUST be revised, superseded, or archived rather than forced into the repository.

## Priority model

Priority is based on reducing irreversible failure and human/project dependency before increasing capability.

`preserve -> recover -> bound -> observe -> coordinate -> expand`

### P0 — survival and reversibility

#### PS-001 Project recovery contract

Define the minimum evidence needed to reconstruct the project after loss of a chat, agent session, workstation, branch, or account path.

Minimum fields:

- canonical repository;
- last independently observed `main` SHA;
- immutable release/checkpoint anchors;
- active and frozen protocol versions;
- open work that has external effect;
- branch/PR references that are only provisional;
- unresolved authority or permission questions;
- safe next entry point.

**Done when:** a new authorized operator can determine the last proven state without relying on hidden conversational memory.

#### PS-002 Human stop / pause / resume invariants

Specify project-level invariants for stopping work without losing correctness.

Required properties:

- STOP does not require cooperation from the component being stopped;
- PAUSE preserves provenance and pending-intent state;
- RESUME requires re-observation of mutable external state;
- ABORT cannot be silently reinterpreted as DELAY;
- stale authorization is not treated as fresh authorization;
- human refusal or inactivity does not trigger permission escalation.

**Done when:** every future execution-capable layer can map its lifecycle to these invariants.

#### PS-003 Capability ceiling record

Define a small machine-readable declaration of the maximum permissions already granted to an agent/component and the explicit statement that it may not request, infer, or route around additional permissions unless a human opens a new authorization event.

**Done when:** capability expansion becomes a new attributable event rather than an implicit continuation.

### P1 — sustainable operation

#### PS-010 Human sustainability plane — observation only

Develop a privacy-preserving model for detecting interaction strain without medical diagnosis and without coercive scoring.

Possible signals are contextual and reversible, for example:

- repeated correction of recently completed actions;
- increasing contradiction between adjacent instructions;
- unusual acceleration of task creation relative to task closure;
- repeated requests to bypass previously chosen safeguards;
- irritation concentrated around clarification burden;
- increased abandonment/restart frequency.

These signals MUST NOT be interpreted as diagnosis, incapacity, or authority loss. The allowed consequence is limited to interface adaptation: shorter prompts, fewer simultaneous decisions, stronger checkpointing, explicit defer/archive options, and reduced novelty injection.

**Done when:** the model can reduce interaction load without restricting the human's authority.

#### PS-011 Motivation governor

Separate idea generation from obligation creation.

Maintain distinct states:

- `idea` — valuable but creates no duty;
- `candidate` — worth structured evaluation;
- `committed` — accepted into a bounded workstream;
- `active` — consuming current attention/resources;
- `deferred` — intentionally not active;
- `closed` — completed, rejected, or superseded with rationale.

The system SHOULD optimize for a sustainable ratio of active commitments to available human review capacity, not for maximum throughput.

**Done when:** new ideas can accumulate safely without automatically increasing execution pressure.

#### PS-012 Parallel-lane admission rule

A task MAY enter a parallel lane only if all are true:

- no modification of files currently owned by the active line is required;
- no permission expansion is required;
- no activation decision is required;
- no historical anchor changes;
- result is independently discardable;
- integration can occur later through ordinary review.

**Done when:** parallelism increases option value without increasing coordination risk.

### P2 — readiness and distributed responsibility

#### PS-020 KONTUR readiness contract — requirements draft only

Define evidence classes that a future KONTUR readiness decision may consume, without producing the readiness decision itself.

Candidate classes:

- control sufficiency;
- capability-boundary integrity;
- recovery sufficiency;
- cross-context continuity;
- freshness of mutable observations;
- unresolved contestability items;
- human stop-path verification;
- external-effect dry-run evidence.

The readiness function MUST be fail-closed on missing required evidence and MUST distinguish `not_ready`, `indeterminate`, and `ready_candidate`. This backlog does not authorize a `ready` transition.

**Done when:** the evidence contract can be reviewed independently of KONTUR activation.

#### PS-021 Responsibility continuity map

Map the lifecycle:

`intent -> authorization -> preparation -> dry-run -> execution -> observation -> verification -> contestation -> closure`

For each edge, specify who/what can advance it, what evidence is consumed, and what predecessor state remains inspectable.

**Done when:** responsibility cannot disappear merely because work crosses an agent, terminal, context, or implementation boundary.

#### PS-022 Multi-plane commitment research

Explore separable commitments for at least:

- Knowledge Plane;
- Authority Plane;
- Legitimacy Plane;

plus a root commitment that binds their contemporaneous relationship without allowing one plane to overwrite the others.

This is research until threat models and migration/deprecation semantics are explicit.

**Done when:** capture/rewrite attacks can be discussed in terms of independently inspectable state changes.

### P3 — expansion after stabilization

Candidate work that remains intentionally downstream:

- Intent/Action language executable subset;
- Circumstantial Provenance formal model;
- institutional foresight / CURA-ONUS integration;
- third-party SDK and interoperability kit;
- independent implementation test vectors;
- standards-venue transition package.

P3 work SHOULD NOT displace unresolved P0/P1 sustainability work merely because it is more novel.

## Suggested execution order

1. PS-001 Project recovery contract.
2. PS-002 Human stop/pause/resume invariants.
3. PS-003 Capability ceiling record.
4. PS-012 Parallel-lane admission rule.
5. PS-011 Motivation governor.
6. PS-010 Human sustainability observation model.
7. PS-020 KONTUR readiness evidence contract.
8. PS-021 Responsibility continuity map.
9. PS-022 Multi-plane commitment research.

Items 1-6 can be developed without changing the active CHSP line. Items 7-9 SHOULD be refreshed against then-current CHSP/KONTUR architecture before integration.

## Integration rule

A parallel artifact is eligible for integration only when:

- it remains additive relative to current `main`;
- its assumptions are still true;
- it does not weaken `PRINCIPLES.md`;
- it does not silently alter protocol conformance;
- changed active-line interfaces have been re-observed;
- ordinary review can reject it without damaging the active line.

`parallel completion != merge obligation`

`useful draft != normative protocol`

`human sustainability != human surveillance`

`readiness evidence != activation authority`

## Immediate parallel deliverables

The next safe artifacts from this backlog are:

- a machine-readable backlog mirror for PS-001..PS-022;
- a non-normative project checkpoint/recovery schema;
- a non-normative capability-ceiling schema;
- test vectors for stop/pause/resume semantics that do not execute external actions.

They SHOULD remain on an isolated branch or draft PR until the active development line reaches a suitable integration point.
