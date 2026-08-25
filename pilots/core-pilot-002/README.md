# Core Pilot 002 — Public Review Intake & Contestable Resolution

**Status:** specification / pre-execution  
**Pilot class:** bounded project-edge interaction  
**Predecessor:** Core Pilot 001 post-run assessment (#417)  
**Public-review context:** #1, with concrete review surfaces #2-#7

## Purpose

Exercise the reusable UU-AAP core over one review input that may come from an external participant, while preserving plurality, bounded disclosure and contestability.

The pilot tests a boundary that Core Pilot 001 did not directly exercise: another participant may submit a claim, objection or proposal whose identity, authority, standing, interpretation and desired remedy must remain separate.

## Core path

```text
State / Evidence Anchor
  -> Possibility / Availability
  -> Intent
  -> Authority / Responsibility
  -> Coordination / CCRP
  -> Action Gate
  -> Outcome / Provenance
  -> Successor State
```

## Required distinctions

```text
submitted review != accepted claim
reviewer identity != reviewer authority
reviewer authority != standing
public submission != permission for cross-context profiling
disposition != normative change
accepted concern != truth certification
rejected proposal != reviewer fault or liability
resolution != erasure of objection
human gate != automatic issue mutation
one disposition != future review authority
```

## Intake

A review intake binds exactly one source artifact and preserves its source reference, submission text digest, declared review purpose, requested remedy class, disclosure scope and interpretation state.

The protocol MUST NOT infer legal identity, institutional authority, standing, motive, intent, fault, liability or cross-context profile from a public GitHub identity or submission alone.

## Interpretation and plurality

The reviewer submission, project interpretation and disposition are separate objects. The project may classify a concern as understood, ambiguous, disputed or requiring more evidence without changing the submitted evidence.

Multiple interpretations or competing review submissions may coexist. No scalar reviewer score, trust score or canonical-truth score is introduced.

## Authority / responsibility

The authority to receive and analyze a review is distinct from authority to change normative protocol text, close an issue, publish a release or assign responsibility.

A disposition may recommend one of:
- `accept_for_followup`;
- `request_clarification`;
- `decline_with_rationale`;
- `defer_unresolved`;
- `duplicate_or_already_covered`.

No disposition state itself performs an external mutation.

## Action gate

Any later issue edit/close, normative change, release, disclosure expansion or external response requires its own explicit human gate and exact target binding.

Merging this specification is not authority to act on any reviewer or issue.

## Outcome / successor state

A successful pilot run records a bounded review disposition receipt while preserving:
- exact source review reference;
- original submission evidence binding;
- interpretation provenance;
- unresolved or dissenting state where applicable;
- explicit non-effects;
- no automatic follow-on action.

## First live-vector rule

The specification uses only a synthetic fixture. Selection of a real Public Review item is a separate human-gated run-materialization step after this protocol is merged.

## Non-effects

This specification does not contact reviewers, edit/close issues, change SPEC/PRINCIPLES, resolve identity, construct profiles, mutate KONTUR, create releases/tags, change permissions, sanction anyone, assign liability or infer universal truth.