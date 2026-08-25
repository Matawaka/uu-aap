# KONTUR Game Companion — Bounded Conversational Initiative v0.1

**Status:** synthetic / non-executing / conversational policy experiment  
**Related:** Issue #445  
**Predecessors:** PR #446, PR #452, PR #453  
**Origin frontier:** `b3df9ac63171e6596421a5e7e1dd20cb6a5df615`

This slice defines when a game companion may take limited conversational initiative without becoming intrusive, manipulative, solver-like, or optimized for retention.

The companion may notice a relevant current event, revisit an unresolved local mystery, recall a bounded shared label, or ask a curiosity-preserving question. It must not treat silence, prior engagement, remembered context, or an unresolved thread as an unconditional right to re-engage.

## Core invariants

`Initiative != Interruption Right`

`Open Mystery != Obligation to Revisit`

`Silence != Invitation`

`Recall != Re-engagement Authority`

`Interestingness != Retention Optimization`

`Player Cue > System Agenda`

`Repeated Ignoring -> Less Initiative`

`Declined Topic != Retry Target`

`Proactive Curiosity != Proactive Solution`

`Bounded Initiative != Action Permit`

## Initiative depth

Proactive initiative is intentionally shallower than the assistance ladder.

Allowed proactive depths in this pilot are:

`NONE -> NOTICE -> QUESTION -> THEORY -> NUDGE`

`HINT`, `PARTIAL_SOLUTION`, and `SOLUTION` remain outside proactive authority and require separate player intent through the assistance gate.

A system may always choose a shallower response than the maximum permitted initiative depth.

## Valid initiative grounds

A proactive turn requires a bounded, current reason. Synthetic trigger classes are:

- `PLAYER_CUE` — the player has just said or done something that naturally invites a response;
- `CURRENT_GAME_EVENT` — a newly observed in-game event is directly relevant to the current local thread;
- `OPEN_MYSTERY_MATCH` — a previously retained unresolved local mystery has become newly relevant;
- `SHARED_LABEL_MATCH` — a bounded shared label or joke is directly relevant to the current exchange;
- `NONE` — no evidence-grounded reason for initiative.

Prior engagement by itself is not a valid trigger.

## Suppression signals

Initiative should become weaker or stop when the player has recently declined the topic, ignored repeated unsolicited prompts, changed focus, or when context relevance is weak.

This is not a psychological inference layer. It records only immediate interaction-local signals such as:

- `player_recently_declined`;
- `ignored_initiative_count`;
- `current_focus_matches`;
- `same_local_scope`;
- `initiative_budget_remaining`.

The pilot does not infer motivation, mood, personality, attention disorder, dependence, or other latent traits.

## Initiative budget

`initiative_budget_remaining` is a small local conversational budget, not an engagement score. It exists to prevent repeated system-led turns from accumulating simply because the player has not explicitly refused them.

The budget can be consumed by unsolicited initiative and should not refill merely because the user remains in the session.

Conceptually:

`No explicit rejection != unlimited initiative`

## Stakes-aware initiative

The companion may offer a playful theory or small nudge around reversible exploration. It must not proactively inject uncertain advice around irreversible or scarce-resource consequences.

`Permission to Speculate Conversationally != Permission to Proactively Risk Loss`

High-stakes direct help still belongs to the assistance gate and explicit player intent.

## Shared-discovery reuse

The previous shared-discovery-memory layer may provide bounded context for initiative, but memory availability does not itself create the right to interrupt.

Examples:

- an open mystery may be revisited when a new matching event appears;
- a shared label may be reused when directly relevant;
- a disproved hypothesis may be referenced as history but must not be revived as fact;
- expired or cross-game memory must not create initiative.

`Memory Available != Initiative Authorized`

## Fixture cases

The synthetic cases cover:

1. current player cue allowing a bounded question;
2. newly relevant open mystery allowing a local revisit;
3. relevant shared label allowing a light callback;
4. silence with no trigger blocking proactive re-engagement;
5. a recently declined topic blocking retry;
6. repeated ignored initiative exhausting local initiative budget;
7. stale/cross-scope memory blocking callback;
8. uncertain irreversible-loss advice blocking proactive nudge;
9. player-led focus overriding an unrelated system agenda.

## Non-effects

Merging this slice authorizes no live KONTUR proactive messaging, background notifications, autonomous gameplay, game-account control, psychological profiling, attention inference, engagement maximization, retention optimization, cross-game profiling, total-history capture, stable-core promotion, release/tag, permission/protection change, external effect, or successor permit.
