# KONTUR Core Entrypoint Fail-Closed Targeted Re-audit

**Result:** `KONTUR_CORE_ENTRYPOINT_FAILCLOSED_REAUDIT_PASS`  
**Canonical successor:** `0a8293d4372df7ccb664739715cfe167edb586d9`  
**Tree:** `1fd7d237af97bbf5e5ff5c8b5179046458481225`  
**Parent:** `ce902c25d1e9215833248afce0172c65b6a113b9`  
**Remediation PR:** #313  
**Final tested PR head:** `3893b36d89a28ad416f1ff4b5bb2f089fc8904ca`

## Scope

This is a bounded post-merge re-audit of the three findings introduced by the review of #312. It does not re-audit every KONTUR subsystem and does not create any activation artifact.

The squash merge preserved the exact tested tree: both the final PR head and canonical successor resolve to `1fd7d237af97bbf5e5ff5c8b5179046458481225`.

## Closure

### M1 — direct live executor core bypass — `closed_verified`

The direct `activation-executor-core.js` live path now re-enters the public execute-command validator before durable-ledger recovery or Responsibility Kernel execution. The public validator enforces the exact embedded live-host profile and eligibility receipt, freshness, Git revision, system/server identity and ledger-root binding.

The dedicated direct-core regression proves rejection occurs with zero Kernel calls and zero ledger-recovery calls when host evidence is absent or invalid.

### M2 — test-only/live ledger path confusion — `closed_verified`

`execution_mode=test_only` is no longer permission to target arbitrary persistent state. The execution policy requires `test_only_ledger_root_ephemeral=true`; the executor resolves the nearest existing ancestor through `realpath` and requires it to remain inside the operating-system temporary root.

The regression suite rejects both a non-temporary ledger root and a temporary-path symlink escape before Kernel or ledger access.

### M3 — direct preflight core positive-evidence bypass — `closed_verified`

Direct positive paths through `activation-preflight-core.js` now re-enter the public HAR-bound `validateActivationIntent()` surface before producing or accepting `human_execute_step_may_proceed` evidence.

A predecessor-style intent without the embedded Formal HAR decision binding/evidence therefore fails closed even when the core module is imported directly.

## Execution evidence

The final tested tree passed the following relevant workflows on the same PR head:

- KONTUR Core Entrypoint Fail-Closed v0.1 validation — run `32711336606` — SUCCESS;
- KONTUR Live Host Executor Gate v0.1 validation — run `32711336752` — SUCCESS;
- KONTUR Activation Preflight validation — run `32711336677` — SUCCESS;
- KONTUR Activation Executor validation — run `32711336653` — SUCCESS;
- KONTUR Durable Responsibility Ledger validation — run `32711336735` — SUCCESS;
- KONTUR Responsibility Kernel validation — run `32711336630` — SUCCESS.

The remaining repository-wide PR workflows on the final head also completed successfully.

## Targeted conclusion

No Medium, High or Critical finding remains open in this targeted core-entrypoint/mode-confusion surface.

This conclusion does **not** establish that a live host exists or is eligible, and it does not transfer any prior Human Activation Review approval to the successor revision.

## Explicit non-effects

This evidence-only record does not:

- designate a persistent KONTUR live host;
- establish cryptographic host identity;
- create or infer a Human Activation Review decision;
- create an Activation Intent, preflight or final execute command;
- invoke Responsibility Kernel activation;
- initialize or write a live Durable Responsibility Ledger;
- expand or bypass permissions;
- establish execution authority, legal authority, liability, truth or universal canonicality.

Reviewer identity remains declared rather than cryptographically authenticated, and live-host profile assurance remains `human_designated_not_cryptographically_verified`.

## Safe successor rule

After this evidence-only closure itself becomes canonical, re-fetch the successor `main` before any new Formal HAR or live-host designation. Historical HAR decisions remain revision-bound and must not be carried forward implicitly.
