# KONTUR Bounded Interaction Evidence Envelope v0.1

**Status:** synthetic conformance only / read-only / no-effect  
**Issue:** #759  
**Origin frontier:** `bb199c6272b36d871c62a25517ecb7f32b768106`

## Purpose

#757 established that current real KONTUR field evidence is operational/privacy evidence and does not contain the interaction semantics needed for a field-usefulness claim. This slice defines the missing **pilot-specific evidence interface** without pretending that such field evidence already exists.

```text
Useful Interaction Evidence Admission
  -> Bounded Interaction Evidence Envelope
  -> future separately-authorized field source/admission
  -> future usefulness-admission re-evaluation
```

The only positive v0.1 mode is:

`SYNTHETIC_CONFORMANCE_ONLY`

`FIELD_BOUNDED_INTERACTION` is intentionally rejected in v0.1. A future field package must first have a separately designed source/admission receipt tied to an actually authorized observation source.

`Valid Envelope != Field Evidence`

`Field Evidence != Useful Interaction Proven`

## Reuse instead of raw history

The envelope reuses the Event-Hash Minimalism idea: retain bounded categorical commitments and provenance references rather than requiring a raw transcript or total history.

Each event binds:

- event id and ordinal;
- one bounded event class;
- categorical value;
- evidence/provenance references;
- deterministic SHA-256 commitment over those fields;
- `raw_text_present=false`;
- `total_history_required=false`.

The event commitment is independently recomputed by the validator.

`Event Hash != Semantic Truth`

`Event Commitment != Raw Transcript`

## Categorical evidence vocabulary

The synthetic fixture covers the complete admission vector from #757:

1. player request / requested help depth;
2. player correction or challenge + local repair outcome;
3. decline / ignore / pause + respect outcome;
4. assistance or cue class actually offered;
5. direct answer bound to explicit answer request when applicable;
6. preservation of player-selected focus when applicable;
7. source event commitment / provenance.

The full vocabulary in the synthetic fixture tests the interface; a future bounded field package may be partial. Envelope validity must never be interpreted as a usefulness score.

## Agency-preserving semantics

The validator makes several relationships explicit:

- correction/challenge cannot become global truth automatically;
- pause/decline/ignore do not carry old intent forward;
- a direct answer cannot be marked as bound unless an explicit answer request is present in the categorical evidence;
- one explicit solution request creates no future solution authority;
- player-selected focus cannot be overridden by predicted interest.

`Correction/Challenge != Failure`

`Pause/Decline/Ignore != Failure`

`Explicit Solution Request != Solver Dependence`

## Measurement boundary

The envelope uses:

`CATEGORICAL_EVIDENCE_VECTOR`

and fixes false:

- scalar usefulness score;
- engagement objective;
- retention objective;
- dependency objective;
- session-duration reward;
- message-count reward;
- return-frequency reward;
- correction penalty;
- pause/decline/ignore penalty.

No raw transcript, player identifier, durable profile, behavioral profile, psychological profile or mood profile is part of the interface.

## Exact predecessor binding

The fixture binds the exact merged #757 `admission.json` Git blob and requires its decision to remain:

`DEFER_FIELD_USEFULNESS_CLAIM`

The validator recomputes that Git blob SHA-1 from repository bytes. This keeps the new interface downstream of the evidence-admission boundary rather than silently replacing it.

## Claims boundary

A valid synthetic fixture establishes only:

`interaction_semantics_interface_valid = true`

It explicitly leaves false/unestablished:

- field evidence;
- field usefulness;
- real-player satisfaction/effectiveness;
- semantic truth from the hash;
- identity;
- dependency diagnosis.

## Validation

Run:

```bash
python pilots/kontur-game-companion/bounded-interaction-evidence-envelope-v0.1/validate.py
```

The mutation suite rejects field relabeling, raw transcript/total-history capture, identifier/profile expansion, event-hash substitution, correction-to-truth promotion, stale-intent carryover, unbound direct answer, future solution authority, predicted-interest override, field/usefulness overclaims, scalar/engagement/retention rewards and authority/effect expansion.

Dedicated CI also re-runs unchanged:

- #757 Useful Interaction Evidence Admission;
- Event-Hash Minimalism;
- Interaction Receipt;
- Integrated Conversation Trace.

## Non-effects

Merging this profile authorizes no new observation, field collection, response generation or send, model/provider/transport invocation, runtime activation, ActionPermit, game control, player profiling, Stable Core promotion, release/tag or external effect. No positive field fixture is included.
