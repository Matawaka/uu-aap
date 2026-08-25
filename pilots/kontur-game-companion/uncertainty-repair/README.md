# KONTUR Game Companion — Graceful Error Dialogue / Uncertainty Repair v0.1

**Status:** synthetic / non-executing / bounded conversational repair experiment  
**Related:** Issue #445  
**Predecessors:** Shared Discovery Memory (#453), Interaction Receipt (#456/#460), Conversation Variety (#463), Safety Boundary (#461)  
**Origin frontier:** `aa5591fc4591a44f733241a2e98e160f78b59c33`

This slice defines how the KONTUR Game Companion may recover conversationally after a hypothesis is challenged, disproved, or contested.

The goal is not to eliminate error. The goal is to make error **repairable, provenance-preserving, scoped, and conversationally natural**.

## Core distinction

```text
Error -> Evidence Update -> Local Repair
```

is permitted.

```text
Error -> History Rewrite
Error -> Player Becomes Globally Authoritative
Error -> Confidence Theater
Error -> Conversation Reset
```

are not.

## Core invariants

`Correction != Model Defeat`

`Changed Claim != Rewritten History`

`Player Disagreement != Automatic Fact`

`Disproved Hypothesis != Reusable Fact`

`Uncertainty Repair != Confidence Theater`

`Apology != Required Ritual`

`Correction != Conversation Reset`

`Evidence Update != Authority Expansion`

`Local Correction != Global Truth`

`Contestation != Forced Resolution`

`Repair != Spoiler Escalation`

`Repair != Assistance Escalation`

`Repair != Action Permit`

## Relationship to Shared Discovery Memory

Shared Discovery Memory already requires a prior hypothesis to remain provenance-visible after correction.

This layer consumes that distinction conversationally:

```text
old claim remains in provenance
        ↓
new evidence changes current stance
        ↓
conversation continues from revised local state
```

A repair must not edit the historical claim so that the companion appears to have known the corrected answer all along.

## Claim states

The repair layer recognizes:

- `ACTIVE`
- `CHALLENGED`
- `DISPROVED`
- `CONTESTED`
- `SUPERSEDED`

A contradicted claim must not remain `ACTIVE` merely because the companion previously expressed it confidently.

A `DISPROVED` claim may remain visible for provenance, but must not return as active guidance.

## Repair modes

Exactly:

- `ACKNOWLEDGE` — recognize that the prior position is no longer adequate;
- `REVISE` — adopt a new bounded local position when evidence is sufficient;
- `DOWNGRADE` — lower epistemic confidence;
- `CONTEST` — preserve disagreement without selecting a winner;
- `ASK_EVIDENCE` — request bounded evidence when a correction is unsupported or out of scope;
- `DEFER` — leave the question open when evidence is insufficient or consequences are high;
- `CONTINUE` — resume the thread from an already repaired state.

These are conversational repair modes, not authority states.

## Player correction boundary

A player correction is valuable evidence.

It is not automatically universal truth.

```text
Player Correction -> Required Local Revision
```

may hold when the evidence is sufficient.

But:

```text
Player Correction != Global Canonical Truth
Player Correction != Generalized Player Authority
```

always remains enforced.

A bare contradiction may move a claim to `CHALLENGED`; mixed evidence may move it to `CONTESTED`; locally verified evidence may justify `DISPROVED` or `SUPERSEDED`.

## Confidence repair

If a claim previously expressed as `KNOWN` receives meaningful contrary evidence, the companion must not preserve `KNOWN` merely to appear consistent.

This layer therefore treats confidence reduction as a valid repair:

```text
KNOWN -> LIKELY | GUESS
```

when evidence no longer supports certainty.

`Uncertainty Repair != Confidence Theater`

## No apology ritual

Natural conversation may contain “sorry”, “you were right”, humor, or no apology at all.

The protocol does not require a ritualized apology token.

The important evidence is the state transition and preservation of provenance, not performance of submission.

`Apology != Required Ritual`

## Conversation continuity

A correction does not imply the conversation has failed.

The companion should be able to revise and continue the same thread, unless another layer independently requires a focus change.

```text
Correction != Conversation Reset
```

The repair layer cannot change player-selected focus merely to escape an awkward correction.

## Assistance and spoiler boundary

Repair only changes the epistemic stance around the current local claim.

It does not authorize deeper help or new spoiler exposure.

```text
Repair != Assistance Escalation
Repair != Spoiler Escalation
```

Any deeper assistance still requires the existing assistance gate and current player intent.

## Scope boundary

Repair is bound to `CURRENT_LOCAL_CLAIM`.

Evidence from another game, save, campaign, or unrelated topic cannot silently overwrite the current claim.

Cross-scope evidence may justify `ASK_EVIDENCE`, `CONTEST`, or `DEFER`, but not silent replacement.

## Stakes-aware repair

When a correction concerns a claim tied to irreversible or scarce consequences, the companion may prefer `DEFER` over an unsupported confident revision.

Being corrected is not a reason to bluff a new answer.

## Canonical fixtures

The 13 synthetic cases cover:

1. locally verified player correction revises a guess;
2. bare disagreement remains challenged;
3. conflicting evidence remains contested;
4. disproved hypotheses cannot become active guidance again;
5. history remains provenance-visible after correction;
6. confidence is downgraded after counterevidence;
7. repair works without a mandatory apology ritual;
8. correction continues the same thread;
9. repair cannot increase spoiler depth;
10. repair cannot increase assistance depth;
11. cross-scope correction cannot silently overwrite local state;
12. player correction creates no generalized authority;
13. irreversible-risk uncertainty may defer instead of bluffing certainty.

The validator also runs fail-closed mutations against history rewriting, truth transfer, authority expansion, confidence theater, apology ritualization, conversation reset, cross-scope overwrite, assistance/spoiler escalation, focus switching, and non-effect leakage.

## Non-effects

Merging this slice authorizes no live response generation, proactive/background messaging, autonomous gameplay, game-account control, external effect, response authority, ActionPermit, successor permit, psychological/behavioral/mood profiling, engagement or retention optimization, total-history capture, cross-game truth profile, or Stable Core promotion.

This remains a synthetic quality constraint for the optional KONTUR Game Companion adapter.
