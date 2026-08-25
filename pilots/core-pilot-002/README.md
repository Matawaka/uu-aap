# Core Pilot 002 — Public Review Intake & Contestable Resolution

**Status:** specification / pre-execution  
**Pilot class:** bounded project-edge interaction  
**Predecessor:** Core Pilot 001 post-run assessment (#417)  
**Public-review context:** #1, with concrete review surfaces #2-#7

## Purpose

Exercise the reusable UU-AAP core over one review input that may come from an external participant, while preserving plurality, bounded disclosure and contestability.

The pilot tests a boundary that Core Pilot 001 did not directly exercise: another participant may submit a claim, objection or proposal whose identity, authority, standing, interpretation and desired remedy must remain separate.

## External review entry point

The dedicated low-friction public intake surface for the first real run is **Issue #422 — External Review Entry — Core Pilot 002 Run 001**:

https://github.com/Matawaka/uu-aap/issues/422

An external reviewer does not need to understand the whole stack or propose a patch. One short, concrete counterexample is useful. The reviewer may comment on #422 or open a separate issue using the Core Pilot 002 external-review issue template.

Useful input includes a realistic case where the protocol or pilot could assign responsibility unfairly, infer authority from identity/account presence, erase dissent, over-disclose information, mishandle conflicting interpretations, create unnecessary adoption burden, or imply truth/fault/liability from a review outcome.

The project-authored text of #422 is not itself external evidence. A real run remains fail-closed until a directly observable submission from another account satisfies the Run Admission Gate.

```text
public surface exists != external input exists
external comment != verified identity
external comment != authority or standing
eligible input != accepted claim
```

Please do not publish secrets, private credentials, personal contact details, private prompts, or evidence you do not want public.

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

The Run Admission Gate is intentionally allowed to remain `waiting_for_external_input`. No synthetic fixture, project-authored prompt, or self-comment may be promoted into external participant evidence merely to start the pilot.

## Non-effects

This specification does not contact reviewers, edit/close issues, change SPEC/PRINCIPLES, resolve identity, construct profiles, mutate KONTUR, create releases/tags, change permissions, sanction anyone, assign liability or infer universal truth.