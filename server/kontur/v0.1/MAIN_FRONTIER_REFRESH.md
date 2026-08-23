# KONTUR Canonical Main Frontier Refresh v0.1

## Purpose

A `KONTURActivationFrontierReceipt` is bound to an exact Git revision. Therefore a frontier verified for one canonical `main` commit cannot remain current after `main` advances, even when the later change is outside `server/kontur/**`.

Core invariant:

```text
frontier verified at revision A
+ canonical main advanced to revision B
!= frontier current at revision B
```

## Canonical refresh rule

For the canonical repository, every successful push to `main` MUST rerun the existing KONTUR readiness aggregation and dry-run acceptance machinery and MAY publish a new revision-bound readiness/frontier evidence artifact.

This refresh is evidence regeneration only. It does not create an activation intent, does not call the activation executor, and does not create a KONTUR responsibility state.

```text
main advanced
-> readiness evidence regenerated
-> dry-run acceptance regenerated
-> activation frontier regenerated
-> human boundary remains closed
```

## PR versus canonical main

Pull-request runs remain candidate-only and may stay path-scoped.

A PR-run frontier:

```text
candidate frontier != canonical main frontier
```

Only a successful run whose checkout revision is the exact canonical `main` revision may be treated as the current repository frontier evidence for that revision.

## Freshness boundary

The newest successful frontier is current only while its `git_revision` equals the repository's current canonical `main` commit.

Any later `main` commit immediately makes the previous frontier historical:

```text
current_main_sha != frontier.git_revision
-> frontier stale for current-main activation consideration
```

No path-based exception exists because Git identity is repository-wide.

## Non-effects

A successful canonical refresh does not establish:

- KONTUR activation;
- activation intent;
- execution authority;
- responsibility acceptance;
- repository ownership or account control;
- canonical-origin mutation;
- legal responsibility;
- truth certification;
- universal canonicality.

The strongest effect remains:

```text
current revision-bound activation frontier evidence available for human review
```

and, only when the existing KONTUR frontier contract itself says so:

```text
activation prompt may be requested
```

The human activation step remains separate and explicit.
