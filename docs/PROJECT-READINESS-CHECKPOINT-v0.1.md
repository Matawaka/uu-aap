# Project Readiness Checkpoint v0.1

## Purpose

This checkpoint composes two already bounded facts without upgrading either one:

1. `Architecture Convergence / Readiness Manifest v0.1` says the declared project planes are present and eligible for cross-plane integration review.
2. `KONTURCurrentMainFrontierVerificationReceipt v0.1` says one KONTUR activation frontier was generated under an exact canonical `push -> refs/heads/main` workflow event for one exact Git revision.

The checkpoint answers only:

> Are these two bounded readiness facts simultaneously valid for one exact current-main revision?

## Composition rule

```text
architecture convergence review eligible
+
current-main KONTUR frontier verified for exact Git SHA
=
project readiness checkpoint established for that SHA
```

This is composition, not assurance escalation.

```text
project readiness checkpoint established
!= KONTUR activation authorized
!= KONTUR activated
!= execution authority granted
!= repository ownership transferred
!= canonical origin mutated
!= universal architecture completeness proven
```

## Exact revision boundary

The checkpoint is bound to:

```text
git:<40-hex-SHA>
```

The current-main verification receipt MUST describe the same revision through all of:

- `workflow_context.github_sha`;
- `workflow_context.checkout_sha`;
- `frontier_git_revision`;
- checkpoint `git_revision`.

Any mismatch fails closed.

A later `main` commit makes the prior checkpoint historical for current-main consideration.

## Source preservation

The Architecture Convergence manifest remains an independent source artifact. In particular, its historical claim that it did not itself verify a current KONTUR activation frontier is not rewritten.

The checkpoint instead binds the exact convergence artifact and the exact later current-main frontier verification receipt with RFC 8785 JCS + SHA-256.

Therefore:

```text
later evidence
!= predecessor evidence rewritten
```

## Human boundary

A positive checkpoint keeps:

```text
human_activation_step_still_required = true
kontur_activation_authorized = false
kontur_activated = false
execution_authority_granted = false
```

The checkpoint may support a later human review of whether to request an activation prompt, but it does not create activation intent and does not invoke any activation executor.

## Workflow behavior

Pull-request runs may test the builder using synthetic exact-bound inputs, but MUST NOT emit a production project readiness checkpoint.

On canonical `push -> refs/heads/main`, the existing KONTUR readiness workflow may emit the checkpoint only after:

1. readiness/frontier generation succeeds;
2. `current-main-frontier-verification.json` is emitted;
3. that receipt passes its own schema and semantic checks;
4. the Architecture Convergence v0.1 manifest remains valid;
5. all revision bindings agree.

The checkpoint is uploaded as evidence only. It does not mutate repository state.

## Evolution

This is a version-scoped checkpoint for the v0.1 architecture composition. It does not freeze future planes, successor policies, or stronger future checkpoint versions.

`future_evolution_allowed = true` is mandatory.
