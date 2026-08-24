# KONTUR Live Host Eligibility v0.1

**Status:** experimental non-activation infrastructure boundary  
**Scope:** evidence required before a human-designated persistent environment may be treated as a live KONTUR execution host

## Invariant

```text
process persistence
!= durable-state persistence
!= human live-host designation
!= live-host eligibility
!= execution authority
!= activation
```

A temporary process, container, agent session or Codex sandbox does not become a live KONTUR host merely because it can run the repository code. Supplying host parameters to a builder is also not a human designation. v0.1 permits only `host_local` eligibility and requires the explicit designation boundary defined in `LIVE_HOST_DESIGNATION.md`.

## Artifact chain

The host boundary now consists of three machine-readable stages:

1. `KONTURLiveHostDesignationDecision v0.1` — an explicit human decision naming the exact intended persistent repository/ledger boundary and its declarations;
2. `KONTURLiveHostProfile v0.1` — a deterministic profile derived from and cryptographically bound to that exact designation decision;
3. `KONTURLiveHostEligibilityReceipt v0.1` — a bounded observation of whether the current runtime matches the designated profile and may attempt live preflight.

None of these artifacts activates KONTUR.

## KONTURLiveHostProfile

A valid profile cannot be built from raw `hostId`, `operatorRef` and path arguments alone. It requires one exact valid `KONTURLiveHostDesignationDecision` and embeds both:

```text
human_designation_binding
human_designation_evidence
```

The profile derives and revalidates:

- KONTUR `system_id` and `server_instance_id`;
- distinct `host_id`;
- `operator_ref = designator_ref`;
- canonical repository `Matawaka/uu-aap`;
- persistent repository root;
- persistent Durable Responsibility Ledger root;
- `runtime_boundary = host_local`;
- the exact human-designated persistence/outside-repository/CI/sandbox declarations.

The profile creation timestamp cannot predate the designation. Its identity includes the exact human-designation binding and is deterministic under RFC 8785 JCS + SHA-256.

Its assurance remains deliberately:

```text
human_designated_not_cryptographically_verified
```

Therefore:

```text
explicit human designation
!= cryptographic human identity
!= cryptographic hardware identity
!= OS trust attestation
!= execution authority
```

The ledger root must be distinct from the repository root. This keeps durable responsibility state outside Git working-tree mutation semantics.

## KONTURLiveHostEligibilityReceipt

Eligibility consumes the exact bound profile plus an observed runtime surface. A positive decision requires all of the following at once:

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

A negative observation is explicit:

```text
decision = live_host_ineligible
safe_next_step = stop_host_ineligible
```

Human designation cannot override a negative runtime observation.

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

CI validates schemas, deterministic identities and fail-closed vectors only. It may construct synthetic designation/profile/eligibility artifacts for tests, but those artifacts do not designate the GitHub runner or any real host. CI itself must produce an **ineligible** result when its actual runtime is observed as a candidate live host.

The workflow must never create a real human designation, call the Responsibility Kernel or write a live ledger.

## Current integration status

The live Executor requires an exact `KONTURLiveHostEligibilityReceipt` and binds its host/profile/ledger-root evidence into `execution_mode = live`. Direct-core execution re-enters that public gate before mutation, and `test_only` is restricted to an ephemeral OS temporary-root ledger.

The lower-level `evaluateLiveHostEligibility()` remains intentionally pure and accepts a supplied environment object for deterministic fixtures and external observers. Therefore a positive receipt produced from caller assertions alone is insufficient at the effect boundary.

`LIVE_HOST_RUNTIME_REOBSERVATION.md` requires Git/filesystem/process/CI/sandbox facts to be measured again at the live effect boundary and to reproduce the bound receipt before any Kernel or durable-ledger access.

This still does not provide TPM binding, secure-boot attestation, remote-host adapters, distributed host identity or cryptographic human authentication. The v0.1 assurance remains explicit-human-designated, typed and host-locally observed.
