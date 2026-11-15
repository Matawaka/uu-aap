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
  -> Receipt
  -> Contribution / Repair / Dispute
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
- Rule violation and harm are separate dimensions.
- State transition validity requires fresh evidence/authority at the transition frontier.

## Machine-readable bilingual annotations

The JSON Schema uses English standard fields and `x-title-ru` / `x-description-ru` extensions where appropriate. The manifest carries both `text_en` and `text_ru` for semantic invariants.

## Boundary

Schema validity means only that an artifact conforms structurally to this experimental model. It does not establish factual truth, sufficient evidence, current authority, consent, fairness, legal effect or social legitimacy.
