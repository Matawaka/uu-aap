# KONTUR Game Companion — Pause / Resume & Session Boundary v0.1

This synthetic, non-executing pilot extends the game-companion line after PR #456.

Its purpose is to preserve conversational continuity across pauses without silently carrying forward stale intent, focus, authority, mood assumptions, or cross-game player profiling.

## Core invariants

- `Recall != Intent Continuity`
- `Previous Goal != Current Goal`
- `Previous Help Request != Current Help Request`
- `Previous Interest != Durable Preference`
- `Pause != Permission to Re-engage`
- `Session Resume != Topic Resume`
- `Same Player != Same Context`
- `Old Decline Survives Until Fresh Reopening`
- `Remembered Spoiler Exposure != Deeper Spoiler Authority`
- `Ambiguous Return != Permission to Infer Mood or Goal`
- `Cross-Game Memory != Cross-Game Profile`
- `Resume Receipt != Successor Permit`

## Resume modes

The pilot uses four bounded response modes:

`NONE -> LIGHT_RECALL -> NEUTRAL_CHECKIN -> RESUME_THREAD`

`LIGHT_RECALL` may mention a still-valid local fact or open thread without treating it as the player's present goal.

`NEUTRAL_CHECKIN` asks what the player wants to do now.

`RESUME_THREAD` requires a fresh current cue compatible with that thread.

No resume mode itself grants `HINT`, `PARTIAL_SOLUTION`, or `SOLUTION` authority. Assistance depth remains governed by the assistance gate and current player intent.

## Session boundaries

A gap can be:

- `MICRO_PAUSE`
- `SESSION_BREAK`
- `LONG_BREAK`
- `GAME_SWITCH`

The longer or more discontinuous the gap, the less may be reused without current confirmation.

A `GAME_SWITCH` blocks active reuse of prior game-specific memory by default.

## Canonical cases

1. short same-thread pause allows light recall, but does not carry old intent;
2. explicit player resume reopens the same local thread;
3. old solution request is not carried across a session break;
4. prior interest is not promoted into a durable preference;
5. a new player-selected focus overrides the old thread;
6. cross-game active memory reuse is blocked;
7. expired local memory is not reused actively;
8. a previously declined topic remains suppressed until explicitly reopened;
9. ambiguous return uses a neutral check-in rather than inferred mood or goal;
10. prior spoiler exposure may be remembered, but does not authorize deeper disclosure.

## Non-effects

This pilot authorizes no live KONTUR response generation, proactive messaging, background notification, game-account control, autonomous gameplay, psychological or mood inference, behavioral profiling, cross-game preference construction, engagement/retention optimization, total-history capture, stable-core promotion, release/tag, permission/protection change, external effect, action permit, or successor permit.

Related: #445, #446, #452, #453, #454, #455, #456.
