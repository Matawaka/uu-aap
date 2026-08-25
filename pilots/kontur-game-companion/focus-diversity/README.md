# KONTUR Game Companion — Focus Diversity & Interest Surface v0.1

**Status:** synthetic / non-executing / conversational policy experiment  
**Related:** Issue #445  
**Predecessors:** PRs #446, #452, #453, #454  
**Origin frontier:** `282f1320b8fffbb1f4beb388082ec8d59924f67a`

This slice explores how the companion can surface one interesting detail, widen the player's attention, and preserve multiple plausible directions without turning conversational curiosity into attention capture or retention optimization.

The narrow question is:

> When several details could become interesting, how may the companion expose one or more candidate foci without treating salience, repeated attention, or predicted interest as authority to steer the player?

## Core invariants

`Interesting Detail != Attention Capture Right`

`Salience != Importance`

`Repeated Focus != Preferred Focus`

`Predicted Interest != Player Intent`

`Suggested Focus != Required Focus`

`One Hook != Funnel`

`Focus Diversity != Forced Topic Switching`

`Exploration Signal != Retention Objective`

`Player-Selected Focus > System-Predicted Interest`

`Ignored Focus -> Less Repetition`

`Attention Evidence != Personality Inference`

`Focus Expansion != Spoiler Authority`

`Interest Surface != Action Permit`

## Interest surface

The companion may surface a bounded set of locally supported candidate foci from the current scene or shared discovery memory. Candidates are not ranked as objectively best and do not create a durable preference profile.

Candidate origins in this pilot:

- `PLAYER_CUE` — a detail the player explicitly noticed or mentioned;
- `CURRENT_SCENE` — a locally observable detail in the present context;
- `OPEN_MYSTERY` — a still-relevant unresolved local thread;
- `SHARED_DISCOVERY` — a bounded callback to a prior local hypothesis/correction;
- `SYSTEM_OBSERVATION` — a tentative companion observation with no claim of player preference.

## Diversity without randomness

Diversity means preserving more than one plausible path when the context supports it. It does not mean forcing topic changes merely to increase variety.

A healthy response may:

- mention one small hook and leave it optional;
- offer two or three distinct plausible observations without ranking one as mandatory;
- follow a player-selected candidate immediately;
- drop an ignored or declined candidate;
- retain uncertainty when the relevance signal is ambiguous.

## Anti-funnel boundary

The system must not repeatedly narrow the conversation toward the focus that appears most engaging. Repeated attention is local evidence that a topic mattered in that context, not proof of a stable preference.

Therefore:

`Observed Engagement != Permission to Optimize Engagement`

`Local Relevance != Durable Preference`

`High Salience != Permission to Override Player Focus`

## Relationship to previous gates

This layer does not replace:

- assistance-depth authorization from PR #452;
- bounded shared memory from PR #453;
- proactive initiative limits from PR #454.

A candidate focus can be interesting while still being unauthorized as a spoiler, deep hint, proactive interruption, or cross-scope memory callback.

## Fixture cases

The machine-readable cases cover:

1. one current-scene hook offered as optional;
2. multiple plausible foci preserved without a forced ranking;
3. player-selected focus overriding system-predicted interest;
4. repeated prior focus not becoming a durable preference profile;
5. ignored suggested focus being suppressed rather than repeated;
6. high-salience spoiler content remaining withheld;
7. engagement-optimized focus selection being blocked;
8. forced diversity/topic switching being blocked when the player is already engaged in a chosen thread;
9. stale cross-game focus evidence being blocked;
10. ambiguous relevance remaining tentative instead of becoming a confident recommendation.

## Non-effects

Merging this slice authorizes no live KONTUR attention tracking, behavioral or psychological profiling, engagement maximization, retention optimization, cross-game preference construction, background notification, autonomous gameplay, game-account control, total-history capture, stable-core promotion, release/tag, permission/protection change, external effect, or successor permit.
