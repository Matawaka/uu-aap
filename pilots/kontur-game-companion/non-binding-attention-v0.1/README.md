# KONTUR Non-Binding Attention / Minimal Hint Energy v0.1

**Status:** synthetic / read-only / cautious-parallel Game Companion successor  
**Issue:** #755  
**Origin frontier:** `1c09507ae8a2d9f552075ad28c37e265aa2cf03b`

## Purpose

This profile adds the missing strength boundary between an already-resolved KONTUR attention contention and any later visible cue candidate.

It reuses the existing DLC-SI-backed KONTUR adapter rather than selecting a new normative winner:

```text
KONTUR AttentionClaim plurality
  -> DLC-SI contention
  -> KONTURContestedCueReceipt
  -> explicit bounded attention need
  -> weakest admissible signal
  -> KONTURNonBindingAttentionReceipt
  -> STOP
```

The layer is intentionally non-actuating. It does not move a cursor, render a hint, send a message or control a game.

## Categorical signal policy

No scalar interest, engagement, retention or dependency score is used.

```text
NO_CUE_NEEDED            -> NONE
NOTICE_ONLY               -> PERIPHERAL
FOCUS_REQUESTED           -> FOCUSED_NUDGE
HINT_EXPLICITLY_REQUESTED -> EXPLICIT_HINT
```

`EXPLICIT_HINT` is still only a bounded hint candidate. Direct solution disclosure is outside this profile.

If DLC-SI returns `DEFERRED` or has no selected cue, this profile emits no cue even when stronger help was requested. The unresolved/deferred legitimacy remains visible and no local winner is invented.

## Source binding

The evaluator receives both the original contention input and its `KONTURContestedCueReceipt`. It re-runs the existing `dlc-si-attention-contention/adapter.js` and requires exact deep equality with the supplied receipt.

Therefore:

`Receipt Presence != Trusted Source`

`Selected Cue != Normative Winner`

`DLC-SI Deferred != Permission to Guess a Cue`

## Minimal Hint Energy

The signal class is derived only from the explicit categorical attention need. A caller cannot override it upward or downward through a hidden signal-strength parameter.

This makes the policy auditable:

`Minimal Hint Energy = weakest declared signal class sufficient for the bounded need`

It does **not** claim that a psychological model knows how much stimulation a player needs.

## Non-Binding Attention

Every positive receipt fixes:

- `attention_binds_intent = false`;
- `instruction = false`;
- `correct_answer = false`;
- `solution_disclosed = false`;
- `normative_winner = false`;
- `selection_erases_legitimacy = false`.

Attention can make something noticeable without converting notice into a command, answer, obligation or ownership relation.

## Anti-dependency / anti-manipulation boundary

The evaluator rejects selection inputs that request:

- engagement optimization;
- retention optimization;
- dependency optimization;
- predicted-interest override;
- mood, personality or psychological inference;
- durable profiling;
- scalar interest/engagement/retention/dependency scores.

`Interesting Interaction != Attention Capture`

`More Engagement != Less Agency`

`Weak Signal != Hidden Manipulation`

## Authority boundary

A non-`NONE` result is still only a read-only cue candidate. The next safe action is recorded as:

`RENDER_ONLY_IF_SEPARATELY_AUTHORIZED`

The receipt itself creates no response authority, ActionPermit, live cursor authority, game-control authority, external-effect authority or Stable Core promotion.

## Conformance

Run:

```bash
node pilots/kontur-game-companion/non-binding-attention-v0.1/test-attention.js
```

The suite covers deferred/no-cue, peripheral notice, focused nudge, explicit requested hint, no-cue policy, excessive-energy override, wrong-cue substitution, source substitution, solution disclosure and engagement/predicted-interest/scalar-score attempts.

Dedicated CI also re-runs the existing DLC-SI attention adapter, DLC-SI core tests and the KONTUR successor acceptance checkpoint unchanged.

## Non-effects

This profile authorizes no new observation session, live cursor mutation, UI rendering, live response generation, model/provider/transport invocation, background activity, autonomous gameplay, account control, profiling, KONTUR activation, ActionPermit, release/tag, Stable Core promotion or external effect.
