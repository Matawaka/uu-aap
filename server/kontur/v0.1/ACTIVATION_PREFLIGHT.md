# KONTUR Activation Intent and Preflight v0.1

**Status:** experimental server-level pre-activation control layer  
**Machine identity:** `KONTUR`  
**Scope:** reference server responsibility control plane

## Position

```text
KONTURActivationFrontierReceipt
        |
        v
explicit human activation intent
        |
        v
KONTURActivationIntent
        |
        v
KONTURActivationPreflightReceipt
        |
        v
HUMAN EXECUTE BOUNDARY
        |
        v
KONTUR Responsibility Kernel / activate
```

This layer deliberately stops before the final line.

Core invariant:

```text
activation frontier ready
!= human activation intent
!= activation preflight admitted
!= kernel activated
!= responsibility state created
!= execution authority
```

## Why this layer exists

A valid readiness frontier tells us that the system has enough bounded machine evidence to allow a human to request an activation prompt. It does not freeze the world between that decision and execution.

Before a real activation, the server must therefore re-check the exact revision, frontier, readiness signal, policies, epoch, holder, scopes, lease, health and active-holder frontier.

The preflight converts that requirement into a typed, digest-bound, fail-closed boundary.

## KONTURActivationPolicy v0.1

The reference activation policy is:

`urn:uu-aap:kontur:activation-policy:reference-server:1`

It fixes:

- only transition `activate` is admissible;
- exact Git revision is required;
- exact frontier/readiness/policy bindings are required;
- exact system/server identity is required;
- readiness epoch and fencing epoch must be exact;
- server health must be healthy and no older than 60 seconds;
- human activation intent must be no older than 300 seconds;
- lease must be live;
- parallel active holder must be absent;
- genesis activation requires no current responsibility state;
- preflight must be side-effect free;
- auto activation is prohibited.

Responsibility scopes are not duplicated into this policy. Their source remains the exact `KONTURResponsibilityPolicy` allowlist.

## KONTURActivationIntent v0.1

The intent binds exact bytes or exact values for:

- canonical Git revision;
- `KONTURActivationFrontierReceipt`;
- `KONTURReadinessSignal`;
- readiness aggregation policy;
- responsibility policy;
- activation policy;
- healthy server observation;
- system/server identity;
- readiness/fencing epoch;
- responsibility holder;
- responsibility scopes;
- lease;
- explicit human activation declaration and nonce.

The declaration is intentionally represented as:

`identity_assurance = declared_not_cryptographically_verified`

Therefore:

```text
explicit human intent declared
!= cryptographic human identity verification
!= legal identity
!= legal authority
```

A future identity/signature layer may strengthen that boundary without rewriting v0.1.

## KONTURActivationPreflightReceipt v0.1

Immediately before an eventual execute step, preflight revalidates:

1. current Git revision equals the intent/frontier revision;
2. frontier still has `activation_prompt_may_be_requested`;
3. frontier/readiness/policy digests are exact;
4. readiness signal is still valid and all checks pass;
5. activation policy is effective;
6. health artifact is exact, healthy and fresh;
7. system/server identity is exact;
8. readiness/fencing epoch is exact;
9. holder and scopes equal the intent and scopes remain policy-allowed;
10. lease is exact and live;
11. no parallel active holder exists;
12. no current responsibility state exists for genesis activation;
13. human intent is explicit and fresh;
14. transition is exactly `activate`;
15. preflight itself has no activation side effect.

A positive result has the single disposition:

`decision = human_execute_step_may_proceed`

It does **not** mean the kernel has run.

## Side-effect separation

`activation-preflight.js` is structurally prohibited from importing `responsibility-kernel.js` or calling `transitionResponsibility`.

CI checks this directly.

The preflight harness must not produce:

- `responsibility-state.json`
- `activation-receipt.json`

The generated evidence is limited to the activation intent, preflight receipt, readiness prerequisites and summary.

## Drift semantics

The following are invalidation events, not refresh requests:

- Git revision changes;
- frontier ref/digest changes;
- readiness signal ref/digest changes or expires;
- any policy changes;
- system/server identity changes;
- epoch changes;
- holder changes;
- scope changes;
- lease changes/expires;
- health becomes stale/degraded/critical;
- another active holder appears;
- a responsibility state already exists.

The machine must fail closed and require a successor intent/frontier as appropriate. It must never silently substitute a newer convenient value into an old human intent.

## Assurance boundary

A positive preflight may establish only:

- `activation_intent_verified = true`
- `activation_preconditions_revalidated = true`
- `human_execute_step_may_proceed = true`

It must keep false:

- `kernel_activated`
- `responsibility_state_created`
- `responsibility_accepted`
- `execution_authority_granted`
- legal responsibility/effect
- moral blame
- truth certification
- PoAI materialization
- universal canonicality

## CI and PR semantics

PR CI may produce a candidate preflight bound to the PR checkout only to test the protocol. Such an artifact is not a canonical activation authorization.

A real activation prompt must bind a canonical `main` frontier and must perform a fresh preflight immediately before a separate explicit human execution step.

No auto-merge. No auto-activation. Human control remains the terminal boundary.
