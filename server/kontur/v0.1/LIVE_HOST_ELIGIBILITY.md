# KONTUR Live Host Eligibility v0.1

**Status:** experimental non-activation infrastructure boundary  
**Scope:** evidence required before a concrete environment may be treated as a live KONTUR execution host

## Invariant

```text
process persistence
!= durable-state persistence
!= live-host eligibility
!= execution authority
!= activation
```

A temporary process, container, agent session or Codex sandbox does not become a live KONTUR host merely because it can run the repository code. Conversely, process ephemerality is not by itself the decisive property: a future controller may act through a separately authenticated persistent host adapter. v0.1 deliberately does **not** define that remote-adapter mode and permits only `host_local` eligibility.

## Why this boundary exists

The activation pipeline already distinguishes readiness, Formal Human Activation Review, Activation Intent, preflight, final human execute and durable Kernel execution. A remaining operational gap appears when those artifacts are evaluated in an environment that is only a temporary CI or sandbox filesystem.

Without a typed host boundary, code could be mechanically valid while the claimed `reference-primary` server identity and durable ledger location are only assumed.

This layer therefore adds two machine-readable artifacts:

1. `KONTURLiveHostProfile v0.1` — an explicit human designation of one persistent repository/ledger boundary;
2. `KONTURLiveHostEligibilityReceipt v0.1` — a bounded observation of whether the current runtime matches that profile and may attempt live preflight.

Neither artifact activates KONTUR.

## KONTURLiveHostProfile

The profile binds:

- KONTUR `system_id` and `server_instance_id`;
- a distinct `host_id`;
- declared operator reference;
- canonical repository `Matawaka/uu-aap`;
- persistent repository root;
- persistent Durable Responsibility Ledger root;
- `runtime_boundary = host_local`;
- declared absence of CI and temporary-sandbox status.

The profile identity is deterministic under RFC 8785 JCS + SHA-256.

Its identity assurance is deliberately:

```text
human_designated_not_cryptographically_verified
```

Therefore:

```text
host profile designated
!= cryptographic hardware identity
!= OS trust attestation
!= execution authority
```

The ledger root must be distinct from the repository root. This keeps durable responsibility state outside Git working-tree mutation semantics.

## KONTURLiveHostEligibilityReceipt

Eligibility consumes the exact profile plus an observed runtime surface. The positive decision requires all of the following at once:

- repository root exactly matches the profile;
- durable ledger root exactly matches the profile;
- durable ledger root exists;
- durable ledger root is readable;
- durable ledger root is writable;
- durable ledger root is outside the repository;
- observed Git revision equals the exact expected revision;
- CI is not detected;
- a temporary sandbox is not detected;
- runtime boundary is exactly `host_local`.

A positive receipt has only:

```text
decision = live_host_eligible
safe_next_step = live_preflight_may_be_attempted
```

A negative observation is represented explicitly rather than silently discarded:

```text
decision = live_host_ineligible
safe_next_step = stop_host_ineligible
```

This makes a sandbox refusal a valid protocol outcome rather than an operational accident.

## Non-effects

Even a positive eligibility receipt must keep false:

- execution authority granted;
- execute command created;
- Kernel activated;
- responsibility state created or accepted;
- durable ledger written;
- permission expansion or bypass;
- legal authority;
- truth certification;
- universal canonicality.

Thus:

```text
live_host_eligible
!= live_preflight_passed
!= final human execute
!= live KONTUR activated
```

## CI semantics

CI validates schemas, deterministic identities and fail-closed vectors only. CI itself must produce an **ineligible** result when represented as a candidate live host. The workflow must never manufacture a positive live-host receipt for the GitHub runner, create an execute command, call the Responsibility Kernel or write a live ledger.

## Current integration status

The live Executor now requires an exact `KONTURLiveHostEligibilityReceipt` and binds its host/profile/ledger-root evidence into `execution_mode = live`. Direct-core execution also re-enters that public gate before mutation, and `test_only` is restricted to an ephemeral OS temporary-root ledger.

The lower-level `evaluateLiveHostEligibility()` remains intentionally pure and accepts a supplied environment object for deterministic tests and external observers. Therefore a positive receipt produced from caller assertions alone must not be treated as sufficient effect-time observation.

The successor runtime-re-observation layer in `LIVE_HOST_RUNTIME_REOBSERVATION.md` measures Git/filesystem/process/CI/sandbox facts again at the live effect boundary and requires those measurements to reproduce the bound receipt before any Kernel or durable-ledger access.

This still does not provide cryptographic machine attestation, TPM binding, remote-host adapters or distributed host identity. The v0.1 assurance remains typed, human-designated and host-locally observed.
