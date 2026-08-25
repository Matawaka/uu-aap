# Core Pilot 002 — Run Admission Gate

This gate prevents Pilot 002 from inventing a real participant when no eligible external public-review input exists.

## Current observed state

At gate creation, Public Review #1 and review issues #2-#7 contained no comments. Therefore Pilot 002 Run 001 is not yet admissible and remains at `waiting_for_external_input`.

## Admission semantics

A real run may be admitted only when one directly observable external public-review submission exists and is bound exactly by source identifier, URL, author account identifier, observed text digest, observation time, and bounded processing scope.

The source account identifier is evidence only of the account label shown by the source system. It does not establish human identity, authority, standing, independence, expertise, legal status, or liability.

## Invariants

- `Review surface exists != External review input exists`
- `Project-authored prompt != External participant submission`
- `Synthetic fixture != Real participant evidence`
- `GitHub account identifier != Verified identity`
- `Observed submission != Authority or standing`
- `Admission != Disposition`
- `Disposition preparation != Issue mutation`
- `No eligible input != Permission to fabricate one`

## Fail-closed behavior

If no eligible source exists, the only valid state is `waiting_for_external_input`. No synthetic fixture, project-authored review question, assistant-generated proposal, or copied historical text may be promoted into a real Run 001 input.

If an eligible source later appears, a new admission artifact must bind that exact source before any intake/disposition run begins.

This gate performs no external contact, issue mutation, identity resolution, normative change, release/tag creation, KONTUR mutation, sanction, liability assignment, or authority transfer.