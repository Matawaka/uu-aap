# KONTUR × DLC-SI — Singular Attention Channel Contention v0.1

Synthetic, non-executing adapter under #722 / #740.

When multiple legitimate attention cues compete for one cursor/peripheral slot, KONTUR delegates contention semantics to canonical DLC-SI v0.1 rather than inventing a winner model.

The adapter preserves every cue legitimacy reference and emits a `KONTURContestedCueReceipt` derived from DLC-SI's `ContestedActionReceipt`.

## Invariants

- `Interface Singularity != Normative Singularity`.
- `Attention Cue != Correct Answer`.
- `Indication != Instruction`.
- `Precedence != Victory`.
- `Selection != Erasure`.
- `Deferred Cue != Invalid Cue`.
- `Eligibility != Authority`.

Temporary precedence is only accepted when the supplied DLC-SI contention contains a bounded lease with authority provenance, expiry and revisit triggers. The adapter itself cannot create that authority.

## Non-effects

No live cursor mutation, response send, autonomous gameplay, game control, engagement objective, mood inference, durable profiling, external-effect authority, ActionPermit, release or Stable Core promotion is created.
