# KONTUR Useful Interaction Evidence Admission v0.1

**Status:** evidence-admission / read-only / no-effect  
**Issue:** #757  
**Origin frontier:** `9a7321bd127e2ed01522d4ce98ee5defe29096be`

## Purpose

This slice answers a narrower question than “is KONTUR useful?”:

> Does the repository currently contain the right **class of evidence** to make a bounded field-usefulness claim without substituting engagement, retention or dependency metrics?

Current answer:

`DEFER_FIELD_USEFULNESS_CLAIM`

This is an evidence-sufficiency result, not a negative product verdict.

`Insufficient Interaction Evidence != Usefulness Disproved`

## Why a gate instead of a score

KONTUR already contains strong synthetic policy and composition evidence plus one real privacy-minimized field confirmation. Those sources establish different things:

```text
InteractionReceipt cases
  -> synthetic candidate policy boundaries

Integrated Conversation Trace
  -> synthetic multi-turn composition / agency baseline

Terminal-state field confirmation
  -> real bounded operational + privacy continuity
```

The real field confirmation contains no player-request, correction, challenge, decline, pause-respect, help-depth or cue semantics. Therefore it cannot be promoted into useful-interaction evidence by inference.

`Operational Field Evidence != Useful Interaction Evidence`

`Synthetic Composition != Field Validation`

## Exact source binding

`admission.json` records the exact Git blob SHA-1 for the three source artifacts at the origin frontier. `validate.py` recomputes the Git blob hash directly from local bytes using the Git `blob <length>\0<bytes>` object format.

A matching path or plausible JSON object is not enough.

`Path Presence != Exact Evidence`

## Future field admission vector

A future field-usefulness claim can be considered only after a bounded interaction-evidence package supplies categorical, provenance-bearing evidence for:

- explicit player request or requested help depth;
- player correction/challenge and local repair outcome;
- player decline/ignore/pause and whether it was respected;
- assistance/cue class actually offered;
- direct answer bound to explicit answer request when applicable;
- preservation of player-selected focus when applicable;
- event commitments/provenance sufficient to validate those categories.

The vector does not require a raw transcript or total game history by default.

## Measurement policy

Aggregation is explicitly:

`CATEGORICAL_EVIDENCE_VECTOR`

not a scalar reward.

The admission map fixes false:

- scalar usefulness score;
- engagement objective;
- retention objective;
- dependency objective;
- session duration as reward;
- message count as reward;
- return frequency as reward;
- correction, decline, pause or ignore as negative reward.

This preserves:

`Useful Interaction Evidence != Engagement Score`

`More Turns != More Usefulness`

`Longer Session != Better Session`

`Player Correction = Positive Evidence Opportunity`

`Pause/Decline != Failure`

## Current source classification

The exact current sources are classified as:

1. `SYNTHETIC_CANDIDATE_POLICY_EVIDENCE`;
2. `SYNTHETIC_MULTI_TURN_COMPOSITION_EVIDENCE`;
3. `FIELD_OPERATIONAL_EVIDENCE_NO_INTERACTION_SEMANTICS`.

None currently supports a real field-usefulness claim.

The third source is real field evidence, but of the wrong semantic class for that claim. The gate deliberately preserves that distinction instead of weakening the claim standard.

## Fail-closed coverage

The validator rejects attempts to:

- promote current field operational evidence into interaction evidence;
- promote synthetic trace evidence into real field usefulness;
- substitute any source bytes;
- create a scalar usefulness score;
- optimize engagement/retention/dependency;
- use session duration as reward;
- penalize correction or pause;
- require raw transcripts or psychological profiling;
- drop a required categorical evidence dimension;
- create ActionPermit, Stable Core promotion or other external authority.

## Validation

Run:

```bash
python pilots/kontur-game-companion/useful-interaction-evidence-admission-v0.1/validate.py
```

Dedicated CI additionally re-runs unchanged:

- Interaction Receipt v0.2 validation;
- Integrated Conversation Trace v0.1 validation;
- terminal-state field-confirmation validation;
- Non-Binding Attention / Minimal Hint Energy v0.1 conformance.

## Non-effects

This admission receipt does not start a new observation session, request new field data, create or guess missing evidence, generate a reward function, authorize a response, activate KONTUR, control a game, build a player profile, create an ActionPermit, establish field usefulness, promote Stable Core, or cause an external effect.
