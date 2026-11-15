# UU Society v0.1 — Formal State Model

**Status:** experimental formal model  
**Authority:** descriptive only; no Stable Core promotion, legal effect, runtime authority or policy activation  
**Related backlog:** #1021 and #943

## Purpose

This directory starts formal modelling of the UU Society social-economic layer as machine-readable state and transition contracts.

The model is intentionally conservative. It formalizes what can be stated without pretending that a universal numerical trust score, universal value function, or automated definition of a “good” person exists.

The primary chain is:

```text
Actor
  -> Intent
  -> Need
  <-> Capability / Resource
  -> Match
  -> Commitment
  -> Evidence + TrustState + RiskHarmEnvelope
  -> ARAEState
  -> ActionLease
  -> Action
  -> Outcome
  -> Harm / RuleViolation (orthogonal)
  -> Receipt
  -> Contribution / Repair / Dispute
  -> Delegation / GovernanceRule
  -> FailurePattern / Learning
```

## Files

- `uu-society-state.schema.json` — JSON Schema Draft 2020-12 for a complete state snapshot;
- `uu-society-transition.schema.json` — generic evidence/authority-bound transition event;
- `uu-society-model.manifest.json` — agent-readable entity catalog, invariants, interaction rules and transition catalog;
- `README.md` — English guide;
- `README.ru.md` — Russian guide;
- `examples/minimal-mutual-aid.snapshot.json` — minimal mutual-aid state example;
- `examples/minimal-mutual-aid.transition.json` — minimal allowed transition example.

## Agent reading order

1. Read `uu-society-model.manifest.json`.
2. Resolve entity structures in `uu-society-state.schema.json`.
3. Validate state changes against both the entity state enum and `transition_catalog`.
4. Treat `interaction_rules` and `invariants` as semantic constraints that JSON Schema alone cannot fully enforce.
5. Never infer legal effect, moral correctness, identity truth, guilt, or implementation authority from schema validity.

## Core modelling decisions

- Trust is contextual and vector-like; no universal numeric social score exists in v0.1.
- Rights floor is independent from trust and contribution.
- Historical personal data is not current agency.
- ARAE constrains reachable consequences, not human dignity.
- Failure memory is system learning, not permanent personal stigma.
- Contributions are non-fungible by default; v0.1 does not assign a universal exchange value.
- `Harm` and `RuleViolation` are first-class, orthogonal state entities: harm does not prove violation, and violation does not prove harm.
- State transition validity requires fresh evidence/authority at the transition frontier.
- Child delegation authority is monotonic non-increasing: `child authority ⊆ parent authority`.
- Local governance remains subordinate to the constitutional Rights Floor.

## Machine-readable bilingual annotations

The JSON Schema uses English standard fields and `x-title-ru` / `x-description-ru` extensions where appropriate. The manifest carries both `text_en` and `text_ru` for semantic invariants.

## Boundary

Schema validity means only that an artifact conforms structurally to this experimental model. It does not establish factual truth, sufficient evidence, current authority, consent, fairness, legal effect or social legitimacy.


## Meta-resilience analysis

The executable model also contains a population/timeline meta-resilience suite. It does not assign a single "society health score". Instead it checks independent structural failure modes:

- reuse of the same current-control evidence as a multiplier for multiple PERSON identities;
- coordinated actor rotation that erases a recurring cross-actor extraction pattern;
- governance self-ratification inside a closed coalition without independent review;
- long-running restrictions that persist by inertia without fresh evidence or a recovery path;
- attempts to collapse contextual trust into a universal person ranking.

Meta detection is a reason for review, not proof of individual guilt.


## Deterministic population simulation

The v0.1 laboratory layer can run fixed synthetic populations over thousands of interactions using a SHA-256 counter-derived deterministic generator.

Reference fixtures isolate different failure modes rather than combining them into one opaque score:

- P00 — balanced baseline;
- P01 — coalition extraction and access inequality;
- P02 — provider/authority positive-feedback concentration;
- P03 — long restriction pressure with harm suppressed by containment;
- P04 — unmet needs coexisting with stranded capability;
- P05 — high harm pressure under weak containment.

The simulator emits multiple independent aggregate observables. Diagnostic threshold crossings are reasons for architectural review, not judgments about individual people.


## Phase landscape v0.3

Beyond the bounded v0.2 replay sweep, UU Society includes larger deterministic landscape maps.
W00 maps five interacting resilience axes and W01 isolates coalition capture. The analyzer records neighboring phase-boundary edges and a Pareto frontier over independent loss dimensions. A frontier cell is not declared socially optimal; it is only nondominated under the explicitly listed metrics.


## Endogenous adaptation v0.4

Actors can now adapt future interaction choices from lived synthetic history. Adaptation is stored on contextual relationship edges rather than in one global person score. Successful interaction can strengthen a local edge, harm/breach can narrow that edge, Repair can restore it, and bilateral reciprocity can introduce friction against repeated one-way extraction.

A deliberately bad global-generalization policy is retained only as a comparison experiment.


### Adaptive experiment result

A bilateral memory is not enough against rotating free-riding: A04/A05 changed extractor imbalance p95 only from 129 to 127. Context-scoped contribution evidence in A06 reduced it to 28, but overall fulfillment collapsed to 67.1%, exposing a new overconstraint failure mode. In A07, an explicit protected-need exemption preserved 98.2% fulfillment for legitimate asymmetric receivers.

This sharpens the design rule: **distributed reciprocity must see rotation without becoming a universal reputation system, and legitimate need must remain distinguishable from extractive behavior.**


## Endogenous strategy evolution v0.5

The next experimental layer removes preassigned adversarial/extractor actor types. Actors begin with equal strategy values and learn from their own synthetic outcomes. Cooperation, extraction, repair, exit and coalition behavior can therefore expand or disappear as consequences of the simulated environment.

Strategies are temporary behavioral policies, not identities or moral classifications.


### Strategy-evolution findings

The v0.5 experiments show a distinction between **private utility** and **social learnability**. Strong direct rewards alone did not make cooperation, Repair or coalition behavior dominate. Once anonymous aggregate evidence about strategy outcomes was available, cooperation reached an 88.3% tail share and coalition behavior 85%. Repair remained different: under a high-harm environment, evidence propagated EXIT instead, producing a 71.7% exit share.

This suggests a design problem deeper than incentives: a useful social behavior may fail to spread if its benefits are not learnable across actors, while a dangerous environment can make withdrawal rational even when recovery work is highly rewarded.
