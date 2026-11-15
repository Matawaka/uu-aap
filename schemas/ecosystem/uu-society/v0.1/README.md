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
