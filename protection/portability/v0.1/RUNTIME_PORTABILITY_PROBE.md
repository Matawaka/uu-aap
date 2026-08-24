# Runtime Portability Probe v0.1

## Purpose

`RuntimePortabilityReceipt v0.1` records what one concrete runtime actually demonstrated for three narrow filesystem capabilities:

- creation of an isolated temporary workspace using the OS-native temp root;
- file `fsync`;
- directory `fsync`.

This exists so platform-dependent failures can be classified as observed runtime capability differences instead of being conflated with protocol or architecture defects.

## Observation, not fallback

The receipt deliberately uses the terms:

- `observed_supported`
- `observed_unavailable`

It does not claim universal support or universal absence on a platform.

One failed observation may reflect OS semantics, filesystem type, sandbox policy, permissions, or another runtime condition.

Most importantly:

```text
capability observed
!= durability requirement satisfied
!= fallback authorized
```

A caller whose protocol requires directory `fsync` MUST still fail closed when that required operation is unavailable unless a separate versioned policy explicitly defines an acceptable durability mechanism.

The probe cannot create such a policy.

## Why this layer exists

Several recovery/continuity-style tests historically assumed POSIX `/tmp` and directory `fsync`. On Windows, those assumptions can fail before the higher-level semantic test is reached.

A portability receipt lets later test harnesses distinguish:

```text
architecture semantic failure
```

from:

```text
required filesystem primitive not observed in this runtime
```

without changing the durability requirement itself.

## Receipt semantics

The receipt records:

- observation timestamp;
- runtime platform;
- architecture;
- Node runtime version;
- `os_native` temporary-root strategy;
- observation result and error code for each capability.

The receipt identity is derived from the RFC8785/JCS SHA-256 of the observation core.

## Claims intentionally false

A valid receipt always keeps false:

- cross-platform equivalence proven;
- durability requirement satisfied;
- durability fallback authorized;
- authority established;
- canonicality established;
- legal liability determined;
- KONTUR readiness established;
- KONTUR activation authorized;
- KONTUR activated.

Thus even a runtime where both file and directory `fsync` succeed does not receive a blanket claim that every higher-level durability contract is satisfied.

## Temporary workspace behavior

The probe uses `os.tmpdir()` by default rather than hard-coding `/tmp`.

It creates a unique workspace, performs the observations, and removes the workspace before returning.

A failure to create the temporary workspace is a probe failure and produces no positive receipt.

## CLI

Probe the current runtime and create a new receipt file:

```text
node runtime-portability-probe.js probe <output.json> [observed_at]
```

Verify the bounded internal semantics and deterministic receipt identity:

```text
node runtime-portability-probe.js verify <receipt.json>
```

Existing output files are not overwritten.

## KONTUR boundary

This primitive is in the generic protection/portability plane.

It does not import or invoke KONTUR readiness, Human Activation Review, Activation Preflight, Activation Executor, Responsibility Kernel, or Durable Responsibility Ledger.

A future consumer may use the receipt to explain an environment limitation, but:

```text
portability receipt
!= KONTUR evidence freshness
!= Human Activation Review decision
!= activation permission
```
