# Release Candidate Checkpoint v0.2

This is a read-only, version-scoped successor to `docs/PROJECT-READINESS-CHECKPOINT-v0.1.md`.

It composes two bounded evidence planes for one exact Git frontier without assurance escalation:

```text
post-T1–T5 engineering convergence evidence
+
mandatory governance review evidence
=
release-candidate checkpoint decision for one exact revision
```

## Engineering gates

`Component Manifest -> Dependency / Impact -> Conformance Parity -> Generated Runner -> Execution Evidence -> Bounded CI Migration -> Receipt Runtime -> Implementation Substitution`.

Engineering `PASS` means only that this checkpoint's bounded source-presence, ancestry and conformance-evidence requirements were externally verified for the assessed frontier. It does not prove universal correctness, compatibility or substitutability.

## Governance gates

Security, Privacy, Accessibility, Contestability, and RU/EN semantic + navigation parity.

Governance evidence states:

```text
PASS
PRESENT_UNVERIFIED
MISSING
INSUFFICIENT_EVIDENCE
```

A governance gate may be `PASS` only when an explicit review outcome is bound to the exact assessed revision.

```text
File Exists != Review Passed
Historical Review != Current-Frontier Review
Technical PASS != Governance PASS
```

## Decision rule

```text
any blocking finding -> BLOCKED
else incomplete engineering evidence -> INSUFFICIENT_EVIDENCE
else engineering PASS + any governance gate != PASS -> RELEASE_CANDIDATE_REVIEW_PENDING
else -> READY
```

The decision is computed; callers cannot submit a desired final decision.

## First factual post-T5 assessment

Bound frontier:

`07009a16566fb839acd753215231c6a9c86a896d`

Result:

```text
engineering = PASS
governance  = REVIEW_PENDING
decision    = RELEASE_CANDIDATE_REVIEW_PENDING
```

Observed governance gaps:

- Security: `INSUFFICIENT_EVIDENCE` — an explicit historical KONTUR-scoped audit exists, but not a current-frontier project security review.
- Privacy: `PRESENT_UNVERIFIED` — a proposal exists, not an explicit current review outcome.
- Accessibility: `MISSING` — no project-wide accessibility review outcome was identified.
- Contestability: `PRESENT_UNVERIFIED` — correction/dispute/appeal questions exist without a current review outcome.
- RU/EN semantic + navigation parity: `INSUFFICIENT_EVIDENCE` — localized navigation exists in slices, but project-wide parity is not established.

These are evidence gaps, not automatically defects or blocking findings.

## CLI

```bash
node tooling/release-candidate-checkpoint/v0.2/release-candidate-checkpoint.js \
  tooling/release-candidate-checkpoint/v0.2/post-t5-frontier.input.json
```

Importing the module has no output and performs no assessment.

## Non-effects

```text
READY != Release
READY != Publication Authorization
READY != Certification
READY != Legal Status
READY != Authority
```

The assessor does not activate runtimes, authorize product actions, create or accept responsibility, mutate external state, or authorize CI narrowing.

`future_evolution_allowed = true` is mandatory.
