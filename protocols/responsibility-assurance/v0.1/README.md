# UU-AAP Responsibility Assurance Profile RA1 v0.1 — Stage C

Status: optional responsibility-assurance overlay implementing Stage C of the human-selected phased B + C decision in #852.

Origin frontier: `5201cb686bcef52053e055595c2315c36aa1ec56`.

Accepted Stage B: `protocols/responsibility-status-provenance/v0.1/`.

## Purpose

`UU-AAP/RA1` is a stronger **optional overlay**, not a replacement for the existing UU-AAP v0.1 D/T/V/R `profile` field.

A normal v0.1 manifest remains valid without RA1. RA1 exists only for a stronger machine-readable claim that every responsibility entry currently marked `accepted` or `shared` has separately bound attributable acceptance evidence through accepted Stage B.

## RA1 requirement

RA1 validates only when:

1. the target manifest bytes match the declared SHA-256;
2. the referenced Stage B sidecar bytes match the declared SHA-256;
3. the Stage B sidecar itself validates under the accepted Stage B schema and semantic validator;
4. the Stage B sidecar targets the same exact manifest;
5. every target-manifest responsibility entry whose status is `accepted` or `shared` has a corresponding Stage B binding with `binding_state = ATTRIBUTABLE_ACCEPTANCE_EVIDENCE_BOUND`;
6. no accepted/shared responsibility entry is missing from that attributable binding set.

RA1 does not require attributable acceptance evidence for `limited`, `declined`, or `unknown` statuses because it does not reinterpret those statuses as acceptance.

## Exact claim

A passing RA1 overlay means only:

`attributable acceptance evidence is machine-bound for all accepted/shared responsibility entries in this exact manifest`

It does **not** mean:

- the declarant or responsible actor has verified natural-person identity;
- the actor had legal, institutional, repository, publication, or action authority;
- the underlying factual claims are true;
- responsibility has legal effect or creates liability;
- the work is certified;
- the evidence is trustworthy merely because it is referenced;
- D/T/V/R conformance has been upgraded automatically.

## Baseline compatibility

A v0.1 manifest can remain a valid declaration with no Stage B sidecar and no RA1 overlay.

A valid Stage B `DECLARATION_ONLY` binding remains useful baseline provenance but does not satisfy RA1 for an `accepted/shared` entry.

`RA1_NOT_SATISFIED` means only that the stronger assurance claim is unavailable. It MUST NOT be treated as:

- manifest invalidity;
- fault or misconduct;
- negative reputation;
- automatic dispute;
- mandatory identity escalation;
- permission to reject, sanction, or suppress the underlying manifest.

## Why RA1 consumes Stage B

Stage C deliberately does not introduce a second acceptance, identity, or authority vocabulary. It reuses the exact Stage B sidecar contract and checks coverage over it.

`Stage B binding capability -> Stage C stronger coverage requirement`

not

`Stage C profile -> new authority system`.

## UI guidance

A verifier presenting RA1 should keep the base responsibility declaration visible and separately report the overlay, for example:

- `Responsibility status: accepted (manifest declaration)`
- `Attributable acceptance evidence: bound`
- `RA1 coverage: satisfied`

The interface must not collapse those lines into `verified responsibility`, `verified person`, `trusted actor`, or `legally responsible`.

## Files

- `profile.schema.json` — closed RA1 overlay schema.
- `full-attributable-binding.fixture.json` — Stage B-format fixture covering all accepted/shared entries in the Run 001 counterexample manifest.
- `ra1.fixture.json` — passing RA1 overlay over that Stage B fixture.
- `implementation-receipt.json` — accepted-source/design bindings and non-effects.
- `validate.py` — deterministic RA1 + Stage B composition validator and hostile tests.

## Non-effects

No Stable Core rewrite. No base manifest-schema change. No modification of D/T/V/R. No mandatory identity provider. No mandatory public disclosure of private evidence. No scalar score. No truth/authority/liability/certification inference. No release/tag/publication authority. No ActionPermit. No Workbench reactivation.