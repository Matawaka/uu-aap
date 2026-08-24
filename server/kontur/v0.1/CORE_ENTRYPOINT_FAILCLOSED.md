# KONTUR Core Entrypoint Fail-Closed Remediation v0.1

**Status:** remediation candidate pending CI and post-merge targeted re-audit  
**Base canonical frontier:** `ce902c25d1e9215833248afce0172c65b6a113b9`

## Findings discovered by post-merge review of #312

### M1 — direct live executor core bypass

`activation-executor-core.js` remained an executable CommonJS module. The public `activation-executor.js` wrapper correctly required live-host eligibility, but a caller could import the preserved core directly and reach the old live execution path without the new live-host gate.

Impact: a canonical code path could potentially reach Kernel / durable ledger mutation while bypassing the host-eligibility wrapper.

Remediation candidate:

- `activation-executor-core.js::executeActivation()` now detects `execution_mode=live` before any ledger recovery or Kernel call;
- it dynamically re-enters the canonical public `activation-executor.js::validateExecuteCommand()` surface;
- therefore direct-core live execution must satisfy the same embedded live-host profile/eligibility binding, freshness, Git revision, system/server identity and exact ledger-root checks as the public wrapper;
- regression instrumentation requires zero Kernel calls and zero ledger-recovery calls when the direct-core bypass vector is attempted.

### M2 — test-only/live ledger path confusion

`execution_mode=test_only` previously accepted an arbitrary `ledgerRoot`. A caller could therefore point the test-only executor at a persistent live ledger path. The receipt would remain `test_only`, but the physical state mutation could affect the live responsibility ledger.

Remediation candidate:

- canonical execution policy now requires `test_only_ledger_root_ephemeral=true`;
- core execution requires a test-only ledger root whose nearest existing ancestor resolves under the operating-system temporary directory;
- `realpath` is used so a symlink located under the temp directory cannot escape to the repository or another persistent path;
- this check occurs before ledger recovery or Kernel execution.

### M3 — direct preflight core positive-evidence bypass

`activation-preflight-core.js` remained directly importable and could produce or validate a positive `human_execute_step_may_proceed` receipt using the predecessor non-HAR-bound validation path.

Downstream execution already re-entered the public HAR-bound preflight surface, so this did not provide a direct Kernel activation path. It nevertheless weakened evidence integrity because a standalone positive preflight receipt could be produced through the core entrypoint.

Remediation candidate:

- direct `preflightActivation()` re-enters public `activation-preflight.js::validateActivationIntent()` before producing a positive receipt;
- direct `validateActivationPreflightReceipt()` re-enters the same public HAR-bound validation before accepting a positive receipt;
- a predecessor-style intent with HAR binding/evidence removed must therefore fail closed.

## Invariants

```text
internal implementation module
!= bypass authority

execution_mode=test_only
!= permission to target arbitrary persistent state

positive preflight evidence
requires the same human gate regardless of entrypoint

live execution
requires the same live-host gate regardless of entrypoint
```

## Explicit non-effects

This remediation does not:

- create or infer a new Human Activation Review decision;
- transfer any historical HAR approval to the successor revision;
- designate a concrete live host;
- create live-host eligibility evidence;
- create a live Activation Intent or preflight;
- create an ActivationExecuteCommand;
- invoke a positive live Kernel activation in CI;
- initialize or write a live Durable Responsibility Ledger;
- expand, bypass or request permissions;
- establish cryptographic human or host identity;
- establish legal authority, truth, liability or universal canonicality.

## Closure rule

These findings are **not closed merely because this file exists or because the branch was created**.

Closure requires:

1. targeted direct-core regression workflow PASS on the final PR head;
2. existing Activation Preflight, Activation Executor and Durable Ledger workflows PASS on the same head;
3. repository-wide relevant checks PASS;
4. merge into an unchanged canonical base;
5. post-merge targeted re-audit against the exact successor SHA.

Only then may M1/M2/M3 be recorded `closed_verified`.
