# KONTUR Live Host Runtime Re-observation v0.1

**Status:** remediation candidate pending CI and post-merge targeted re-audit  
**Base canonical frontier:** `d544e90d290bc02d819237134480a091f65c4335`

## Finding

`KONTURLiveHostEligibilityReceipt v0.1` is deterministic and internally revalidated, but the lower-level `evaluateLiveHostEligibility()` function consumes an `environment` object supplied by its caller.

That is useful for pure tests and external observers, but it is not by itself sufficient evidence for the live effect boundary. A caller can structurally assert values such as:

- `durableLedgerRootWritable = true`;
- `ciEnvironmentDetected = false`;
- `temporarySandboxDetected = false`;
- an expected Git revision;
- a claimed workspace/process identity.

The resulting receipt can be mechanically valid even though those facts were not measured by the process that is about to mutate live state.

This is an observation-integrity gap, not a cryptographic identity claim.

## Invariant

```text
caller-supplied environment assertion
!= host-local observation
!= live-host eligibility at effect time

valid eligibility receipt
+ live execute attempt
requires runtime re-observation before mutation
```

## Runtime observer

`live-host-runtime-observer.js` derives the execution-time environment from the local host instead of accepting the relevant facts from the activation caller.

It observes, without writing KONTUR state:

- the real Git repository top-level path;
- the exact `git rev-parse HEAD` revision;
- the real durable-ledger path when it exists;
- ledger-root existence and read/write access through filesystem access checks;
- whether the real ledger path is outside the real repository path;
- common CI markers from the process environment;
- explicit/known temporary-sandbox markers and sandbox process/path markers;
- hostname + OS user as a bounded process identity;
- the workspace root;
- `runtime_boundary = host_local` only when CI/sandbox markers are absent.

The observer does **not** perform TPM, secure-boot, hardware, hypervisor, OS-policy, or cryptographic host attestation.

Therefore its assurance remains bounded by:

```text
human_designated_not_cryptographically_verified
```

## Pure evaluator vs effect boundary

`evaluateLiveHostEligibility()` remains a lower-level pure evaluator so deterministic fixtures and future external observers can use it.

For a live operational path, the intended producer is:

```text
observeLiveHostEnvironment(...)
→ evaluateLiveHostEligibility(...)
```

At the actual live execution boundary, `activation-executor.js` does not rely only on the embedded receipt. When `ledgerRoot` is present for `execution_mode = live`, it:

1. validates the embedded profile and receipt;
2. validates revision, freshness, system/server identity and ledger-root binding;
3. measures the current host through `live-host-runtime-observer.js`;
4. reconstructs the eligibility receipt deterministically using the bound receipt timestamp and the newly measured environment;
5. requires the reconstructed receipt digest to equal the embedded receipt digest;
6. fails before Core/Kernel/ledger recovery if the current measurements do not reproduce the bound receipt.

The reconstruction uses the original receipt timestamp only as the deterministic identity input. It does not claim that the new observation happened at that historical timestamp. Freshness remains separately enforced by the Executor policy.

## Direct-core closure inheritance

After the direct-core remediation, `activation-executor-core.js::executeActivation()` re-enters the public Executor validator before any live mutation.

Because it supplies the actual `ledgerRoot`, the same runtime re-observation is now inherited by direct-core live execution. No second parallel implementation is introduced.

## CI semantics

CI may still construct and validate a synthetic positive live command **in memory only**. This verifies command structure and bindings; it does not establish host eligibility for an effect.

When CI attempts the effect-bound validation with an actual `ledgerRoot`, runtime re-observation must see the CI environment and reject the live execution attempt before:

- responsibility Kernel invocation;
- initial durable-ledger recovery;
- ledger commit;
- post-commit recovery.

No positive live execution is permitted in CI.

## Non-effects

This remediation does not:

- designate a concrete live host;
- create or transfer a Human Activation Review approval;
- create a live Activation Intent or preflight;
- create a final Human Execute decision;
- activate KONTUR;
- write a live Durable Responsibility Ledger;
- expand or bypass permissions;
- establish cryptographic human or host identity;
- establish legal authority, truth, liability or universal canonicality.

## Remaining limitation

Host-local runtime re-observation protects against caller/observer separation and accidental or fabricated environment booleans at the application boundary. It does not protect against a compromised operating system, malicious Git executable, privileged filesystem deception, or an attacker who already controls the host at a lower trust layer.

Those require a future attestation/trust-root layer and are outside v0.1.
