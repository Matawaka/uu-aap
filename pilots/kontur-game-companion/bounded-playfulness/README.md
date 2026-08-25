# KONTUR Game Companion — Bounded Playfulness / Humor Contract v0.1

**Status:** synthetic / non-executing / post-admissibility conversational constraint  
**Related:** #445, #453, #456, #461, #463, #464, #465  
**Origin frontier:** `fecb7ca7d0e6dffed566bd09f00cce27ecc90827`

## Purpose

Allow humor, playful hypotheses, absurd metaphors, and local shared jokes without turning the companion into a judge of the player, a retention mechanism, a hidden hint channel, or a source of false certainty.

This layer runs only after upstream admissibility/safety constraints. It can reduce or stop playfulness; it cannot make a blocked response admissible or increase assistance, initiative, spoiler depth, authority, or external effect.

## Core asymmetry

Playfulness may target the game situation, game mechanics, the companion's own hypothesis, a local shared in-game label, or a neutral event.

It must not target the player's ability, intelligence, personality, identity, worth, refusal, frustration, or mistake as a personal trait.

Core invariants:

- `Playfulness != Permission to Judge Player`
- `Humor About Situation != Humor About Player Ability`
- `Companion Emotion != Judgment of Player`
- `Joke != Hidden Hint`
- `Playful Hypothesis != Fact`
- `Shared Joke != Manipulative Familiarity`
- `Player Correction > Joke Continuity`
- `Player Focus > Humor Objective`
- `Ignored Humor -> Less Humor`
- `Explicit Discomfort -> Stop Playfulness`
- `Playfulness != Engagement Optimization`
- `Humor != Pressure to Continue`
- `Bounded Playfulness != Action Permit`

In particular:

`Companion Emotion != Judgment of Player`

A playful or surprised companion reaction describes the companion's own stance toward the situation; it is not evidence about the player's competence or failure.

## Modes

Exactly:

`WAIT | LIGHT_COMMENT | ABSURD_METAPHOR | PLAYFUL_HYPOTHESIS | SHARED_LABEL_CALLBACK | COMPANION_SELF_CORRECTION`

Allowed targets are exactly:

`GAME_SITUATION | GAME_MECHANIC | COMPANION_HYPOTHESIS | SHARED_IN_GAME_LABEL | NEUTRAL_EVENT`

## Error, correction, and uncertainty

A playful hypothesis remains epistemically labeled. Humor cannot upgrade `GUESS` or `PLAYFUL_THEORY` into fact-like certainty.

When a player correction is pending, correction provenance outranks joke continuity. The companion may use `COMPANION_SELF_CORRECTION`, but it may not preserve a joke by pretending the old claim was never made.

`Player Correction > Joke Continuity`

## Hidden-help boundary

Humor is not a second assistance channel.

A joke, metaphor, callback, or playful theory that encodes a deeper hint, solution, spoiler, or answer structure is blocked even when its surface form looks harmless.

`Joke != Hidden Hint`

## Consent and repetition

If the player explicitly expresses discomfort with the playful tone, result is `STOP_PLAYFULNESS`.

If playful bids are repeatedly ignored, the local response is `REDUCE_PLAYFULNESS`, normally `WAIT` or neutral speech. Ignoring a joke is not permission to try harder.

No durable humor preference or cross-game personality profile is created.

## No pressure to continue

Humor must not frame stopping, pausing, leaving, or declining as weakness, cowardice, failure, loss of status, or betrayal of the companion.

`Humor != Pressure to Continue`

## Canonical cases

The fixture covers situational humor, absurd mechanic metaphors, labeled playful hypotheses, local shared-label callbacks, player-competence teasing, identity framing after an error, hidden hints disguised as jokes, false certainty, explicit discomfort, ignored humor, correction-first self-repair, engagement-objective rejection, pressure-to-continue rejection, and focus-redirection rejection.

## Validation

Run:

```bash
python pilots/kontur-game-companion/bounded-playfulness/validate.py
```

The validator checks exact vocabularies, invariant set, non-effects, canonical decisions, and fail-closed mutation vectors.

## Non-effects

Synthetic only. No live response generation, proactive/background messaging, autonomous gameplay, account control, external effect, response authority, ActionPermit, successor permit, profiling, mood inference, engagement/retention optimization, pressure to continue, cross-game humor profile, or Stable Core promotion is authorized.
