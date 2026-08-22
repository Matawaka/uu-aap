# PoAI research extension — Compositional Intelligence Horizon

**Status:** experimental successor research after `poai-genesis-v0.0.1`  
**Machine compatibility:** uses existing PoAI v0.0.1 arrays and enums; no Genesis enum is renamed or added  
**Motivating implementation:** Level 3.1c compositional Record Builder / Issue #27

## Problem

A decision is often not formed from one intelligence source.

A human decision-maker may combine:

- a human evaluative contribution;
- an AI system;
- a forecasting model;
- documents or datasets;
- an expert group;
- an institutional process.

Collapsing this into a single `human_judgment` or `ai_system` resource destroys provenance and can falsely imply that the actor who ultimately decided was the sole source of the intelligence used.

## Compositional Intelligence Horizon

For one decision `D` at decision boundary `B`, define its **Compositional Intelligence Horizon** as the ordered set of independently represented intelligence resources that were potentially relevant to the decision:

`H(D,B) = {R1, R2, ... Rn}`

Each resource retains its own:

- identity and type;
- actor references where appropriate;
- availability vector;
- consideration state;
- evidence references and evidence class.

The horizon is not an intelligence score and MUST NOT be reduced to a scalar.

## Core separation

Composition does not collapse the existing PoAI distinctions:

`resource provenance != availability != consideration != authority != responsibility`

A resource can exist without being practically available.

A resource can be available without being considered.

A resource can be considered without conferring authority.

A decision-maker can have a wider intelligence horizon than peers without thereby gaining authority to decide for them.

This yields an additional research invariant:

> **Epistemic advantage is not authority.**

## The augmented-observer / colony stress test

Consider one participant who can "see higher" than the group because of chance, role, selection, technology or AI augmentation.

PoAI should distinguish:

1. the participant's own evaluative contribution — `human_judgment`;
2. the augmentation — for example `ai_system`;
3. independent informational inputs — for example `forecasting_model`, `dataset`, `document`;
4. collective input — for example `expert_group` or `institutional_process`;
5. whether each resource was practically available;
6. whether each was invoked, considered, relied upon or rejected;
7. who actually held authority to observe, recommend, decide, approve or execute.

The participant may therefore be the node through which a wider horizon becomes actionable without being the sole origin of that intelligence.

## `human_judgment` interpretation

The frozen Genesis enum `human_judgment` remains unchanged.

For current successor research it SHOULD be interpreted narrowly as a **human-origin evaluative contribution to a decision**, not as proof that:

- cognition was unaided by AI;
- the contribution was socially isolated;
- the human held authority;
- the contribution was correct;
- the contribution was the only intelligence source.

The Level 3.1 presentation layer may display this as:

- English: `Human evaluative contribution`
- Russian: `Оценочный вклад человека`

This is a presentation hypothesis, not a machine-level rename.

## Representation pattern

A compositional record SHOULD use existing arrays rather than a new opaque `augmented_human` type:

```text
intelligence_resources[]
        ↓ one-to-one / per resource
availability[]
consideration[]
evidence[]

actors[]
        ↓ separate relation
authority[]
```

Adding resources MUST NOT automatically create authority relations.

AI involvement MUST NOT erase human provenance.

Human involvement MUST NOT erase AI, model, data, group or institutional provenance.

## Evidence and uncertainty

The presence of a resource entry is not evidence that the resource was available or used.

Unless independently supported:

- availability SHOULD remain `unknown`;
- consideration SHOULD remain `unknown`;
- evidence SHOULD remain E0;
- authority SHOULD remain `unknown` or otherwise explicitly declared.

No chain-of-thought is required or stored. PoAI records observable provenance and declared decision relations rather than private internal reasoning traces.

## Synthetic example

See:

[`../examples/augmented-observer.synthetic.poai.json`](../examples/augmented-observer.synthetic.poai.json)

The example contains four heterogeneous resources and exactly one decision-level authority relation.

## Open questions

1. When should collective cognition be represented as `expert_group`, `institutional_process`, multiple `human_judgment` resources, or a future explicit collective-intelligence type?
2. Should future PoAI revisions permit multiple authority actors with scoped and time-bounded relations?
3. How should resource-to-resource dependency be represented when one AI system consumes another model or dataset?
4. Should consideration record a derived synthesis relation, or remain strictly per resource?
5. When does repeated epistemic advantage become an institutional role, and how should delegation be recorded without rewriting history?

## Boundary

This extension does not modify the frozen `poai-genesis-v0.0.1` checkpoint and does not introduce PoAI/V cryptographic claims.

It is a successor research layer intended to survive field testing before any machine-taxonomy revision is proposed.
