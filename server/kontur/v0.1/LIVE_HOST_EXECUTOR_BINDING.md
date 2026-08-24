# KONTUR Live Host Eligibility -> Activation Executor Binding v0.1

**Status:** bounded execution-gate hardening  
**Scope:** require exact live-host eligibility before `execution_mode=live`

## Invariant

```text
live-host designation
!= live-host eligibility
!= positive preflight
!= final human execute
!= Kernel activation
!= durable genesis commit
```

The executor must not infer live-host eligibility from the fact that repository code is running. A CI runner, temporary Codex sandbox, disposable container, or alternate ledger path cannot become the `reference-primary` live execution host by selecting `execution_mode=live`.

## Bound evidence

For a live execute command, the command now carries:

- exact `KONTURLiveHostEligibilityReceipt` JCS/SHA-256 binding;
- embedded exact `KONTURLiveHostProfile`;
- embedded exact `KONTURLiveHostEligibilityReceipt`.

The executor revalidates the embedded host profile and receipt rather than trusting a caller-provided boolean.

The receipt must establish:

```text
decision = live_host_eligible
safe_next_step = live_preflight_may_be_attempted
```

and its exact Git revision, system/server identity, repository root and durable-ledger root must remain consistent.

## Freshness and ordering

The reference execution policy adds:

```text
max_live_host_eligibility_age_seconds = 60
```

The host eligibility observation must:

1. exist before the activation preflight evaluation;
2. be no more than 60 seconds old at preflight;
3. still be no more than 60 seconds old at final command validation/execution.

No timestamp may be backdated to satisfy this requirement.

## Durable ledger path gate

For live execution the `ledgerRoot` supplied to the executor must resolve to the same path as both:

- `KONTURLiveHostProfile.durable_ledger_root`;
- `KONTURLiveHostEligibilityReceipt.observations.observed_durable_ledger_root`.

This prevents a valid receipt for one persistent location from being reused to create genesis state in another directory.

## Test-only separation

`execution_mode=test_only` remains supported and must carry:

```text
live_host_eligibility_binding = null
live_host_eligibility_evidence = null
```

Supplying live-host evidence to `test_only` is rejected. This keeps synthetic CI execution from inheriting a live-host claim.

CI may construct a synthetic in-memory eligible fixture solely to test command validation. It must not perform a positive `live` `executeActivation()` call, create a live ledger entry, or claim `live_kontur_activated=true`.

## Execute-command identity

The wrapper replaces the earlier raw concatenated command identity with a typed RFC8785/JCS identity seed that covers:

- exact Git revision;
- activation intent binding;
- activation preflight binding;
- execution policy binding;
- execution mode;
- live-host eligibility binding or explicit null;
- holder and responsibility scopes;
- fencing epoch and lease;
- final human execute declaration;
- command timestamps.

Therefore a host-binding, mode, holder, lease or final-human-declaration substitution changes the command ID.

## Preserved execution core

The predecessor `activation-executor.js` from canonical main
`401dcc8aecea18fff3b2ce5e6e86ce559af26205`
is preserved byte-for-byte as:

`activation-executor-core.js`

with Git blob:

`16ba271345a8cc74d70841c35c7039648f16d968`

The public `activation-executor.js` is now a gate wrapper. It performs host-eligibility validation and then delegates to the preserved execution core.

The wrapper contains no direct Responsibility Kernel import, Durable Ledger import, transition call, or ledger commit call.

## Policy requirements

The reference `KONTURActivationExecutionPolicy` now requires:

- `live_host_eligibility_required_for_live_mode = true`;
- `live_ledger_root_matches_host_profile = true`;
- `test_only_carries_no_live_host_eligibility = true`;
- host eligibility freshness <= 60 seconds.

These requirements supplement, and do not replace, the existing exact revision, fresh preflight/readiness/health, live lease, empty genesis ledger, one-shot execute nonce, exactly-once Kernel call, durable commit and post-commit recovery requirements.

## Non-effects

This hardening change does **not**:

- designate any concrete machine as the live KONTUR host;
- create a fresh Formal HAR approval for its successor revision;
- create an Activation Intent;
- create a live preflight;
- create an ActivationExecuteCommand;
- invoke Responsibility Kernel activation;
- initialize or write a live Durable Responsibility Ledger;
- expand or bypass permissions;
- cryptographically authenticate a human or host.

After merge, the successor canonical revision still requires a fresh human-controlled chain and a concrete positive `KONTURLiveHostEligibilityReceipt` produced on the actual persistent host before live execution can be considered.
