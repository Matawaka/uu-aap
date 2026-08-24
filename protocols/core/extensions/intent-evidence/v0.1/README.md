# UU-AAP Non-Induced Intent / Anti-Leading Intent v0.1

**Status:** experimental normative extension profile  
**Stable Core:** `protocols/core/v0.1`  
**Stack Evolution policy:** `protocols/core/evolution/v0.1`  
**Issue:** #327

## Purpose

This profile prevents interaction artifacts from being silently upgraded into user intent.

Core distinction:

```text
Proof of Exposure != Proof of Understanding != Proof of Acceptance != Proof of Intent
Presented != Read != Understood != Accepted != Intended != Authorized
Silence != Refusal
Delay != Intentional Delay
Absence != Negative Intent
Challenge response != pre-existing intent
```

The act of asking about intent must not manufacture the evidence later used to prove that intent.

## Profile boundary

`IntentEvidenceReceipt` is evidence adjacent to the Core Intent primitive.

```text
IntentEvidenceReceipt != IntentReceipt
intent evidence != intent established
intent established != authority
intent established != authorization
```

The profile may contribute bounded evidence toward a later Core `IntentReceipt`, but it never substitutes for that receipt.

## Explicit evidence stages

The machine vocabulary includes:

- `presented`
- `read`
- `understood`
- `accepted`
- `intended`
- `authorized`
- `not_applicable`

A receipt records only the event/stage it actually binds. No stage implies the next stage automatically.

For non-interaction events (`silence`, `delay`, `absence`) the stage is `not_applicable`.

## Formulation provenance

Every receipt preserves how the relevant formulation entered the interaction.

Origins:

- `system`
- `user`
- `mixed`
- `external`
- `unknown`

The receipt binds the formulation content hash, first-introduced time, first introducer and preservation state.

System-origin or challenge-introduced text has:

```text
independent_intent_evidence_weight = zero
```

by default and by validator rule.

## Challenge provenance

Intent challenges record:

- challenge identifier and issue time;
- challenge style;
- challenge formulation origin;
- whether new content was introduced;
- whether wording was derived from pre-existing user content;
- preserved provenance.

Challenge styles:

- `neutral`
- `leading`
- `system_proposed`
- `derived_from_user`
- `mixed`

If a challenge introduces new content, that content cannot be treated as independent evidence of pre-existing intent.

Post-challenge evidence cannot be backdated into a pre-challenge intent state.

## Silence / delay / absence

The profile rejects automatic conversions:

```text
silence -> refusal
delay -> intentional delay
absence -> negative intent
```

A stronger conclusion requires a separate evidence path. This profile itself does not establish that conclusion.

## Frontier semantics

Intent evidence is bound to an exact source/effective frontier.

```text
translation != re-observation
stale evidence != current intent evidence
```

If `reobserved = false`, the effective frontier must equal the source frontier.

## Required non-effects

Every receipt explicitly keeps false:

- intent establishment/creation/inference from exposure, challenge or silence;
- inferred acceptance or understanding;
- authority creation/expansion;
- responsibility acceptance;
- coordination completion;
- ActionPermit creation;
- performed action;
- liability establishment.

## Core composition

The receipt declares:

```text
may_contribute_to = [IntentReceipt]
substitutes_for_core_intent_receipt = false
requires_core_intent_primitive = true
requires_authority_responsibility_primitive = true
requires_coordination_primitive = true
requires_action_gate = true
```

So even strong intent evidence does not bypass later Core primitives.

## Negative conformance vectors

`validate-intent-evidence.js` rejects at least:

1. system exposure -> intent inference;
2. challenge-introduced wording -> independent pre-existing intent evidence;
3. read -> acceptance inference;
4. acceptance -> authorization inference;
5. silence -> refusal;
6. delay -> intentional delay;
7. post-challenge evidence backdated as pre-challenge intent;
8. hidden formulation provenance;
9. stale frontier upgraded to current evidence;
10. evidence receipt substituting for Core `IntentReceipt`;
11. leading challenge marked neutral;
12. missing challenge provenance for challenge-derived content;
13. authority / ActionPermit escalation.

## Independence

This profile requires no:

- KONTUR;
- external contour;
- AI provider;
- vendor runtime.

External systems may implement the profile, but no implementation defines the protocol merely by existing.

## Non-effects

This profile does not create intent, authority, responsibility, coordination, permission, action, truth, causality or liability. It only records bounded intent-related evidence with provenance.
