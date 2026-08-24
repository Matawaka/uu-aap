# KONTUR Live Host Runtime Re-observation — Targeted Post-Merge Re-audit

**Result:** `KONTUR_LIVE_HOST_RUNTIME_REOBSERVATION_REAUDIT_PASS`  
**Finding:** `KONTUR-LIVE-HOST-OBSERVATION-INTEGRITY-GAP`  
**Disposition:** `closed_verified`  
**Canonical successor revision:** `git:0236588a46ebb0e71e95c8f18a05cee72882ee5f`  
**Canonical successor tree:** `3e928e78af1828f0764aac95d78ae675f578b0fe`  
**Predecessor revision:** `git:d544e90d290bc02d819237134480a091f65c4335`  
**Merged remediation PR:** `#315`  
**Tested PR head:** `git:2ddb43b78a844911c08bf731a87648ebc8bf1afa`  
**Tested PR head tree:** `3e928e78af1828f0764aac95d78ae675f578b0fe`

## Scope

This re-audit is narrowly limited to the observation-integrity gap at the live execution effect boundary: a caller-supplied `environment` object can be used by the lower-level pure eligibility evaluator, so a structurally positive eligibility receipt must not by itself authorize crossing into Kernel or durable-ledger effects.

This report does not reopen or broaden Formal Human Activation Review, human identity, legal authority, responsibility, or cryptographic machine-attestation questions.

## Merge integrity

PR #315 was merged onto the exact predecessor `d544e90d290bc02d819237134480a091f65c4335`.

The resulting canonical `main` revision is `0236588a46ebb0e71e95c8f18a05cee72882ee5f`, with parent exactly equal to the predecessor and GitHub verification `verified=true`, `reason=valid`.

The canonical successor tree `3e928e78af1828f0764aac95d78ae675f578b0fe` is byte-identical to the tree of the tested PR head `2ddb43b78a844911c08bf731a87648ebc8bf1afa`. Therefore the squash merge did not alter the tested source tree.

## Re-audited enforcement path

The successor source now enforces all of the following for `execution_mode = live` at the effect-bound path:

1. the execution policy must contain `live_host_runtime_reobservation_before_mutation = true`;
2. the embedded `KONTURLiveHostProfile` and `KONTURLiveHostEligibilityReceipt` are structurally and deterministically validated;
3. the live ledger root must match the profile and eligibility observation;
4. when the actual `ledgerRoot` is supplied, `activation-executor.js` invokes `RuntimeHost.assertRuntimeMatchesEligibilityReceipt(...)`;
5. the runtime observer measures current Git/filesystem/process/CI/sandbox facts rather than accepting those facts from the activation caller;
6. the newly measured environment is evaluated again and must deterministically reproduce the bound eligibility receipt;
7. any mismatch fails before Core/Kernel/durable-ledger effects.

The prior direct-core live guard continues to re-enter the public Executor validator with the actual `ledgerRoot`, so the same runtime re-observation protects both the wrapper and direct-core effect paths without a second parallel implementation.

## Targeted CI evidence on tested head

All PR-triggered workflows observed on tested head `2ddb43b78a844911c08bf731a87648ebc8bf1afa` completed successfully. The most directly relevant runs were:

- `32713047249` — KONTUR Live Host Runtime Re-observation v0.1 validation — success;
- `32713047240` — KONTUR Live Host Executor Gate v0.1 validation — success;
- `32713047162` — KONTUR Activation Executor validation — success;
- `32713047166` — KONTUR Core Entrypoint Fail-Closed v0.1 validation — success;
- `32713047280` — KONTUR Durable Responsibility Ledger validation — success;
- `32713047287` — KONTUR Live Host Eligibility v0.1 validation — success.

The dedicated runtime re-observation job asserted that a caller-asserted positive receipt was rejected in the actual CI runtime before effect, with:

- `kernel_calls = 0`;
- `initial_ledger_recovery_calls = 0`;
- `ledger_commit_calls = 0`;
- `post_commit_recovery_calls = 0`;
- `live_execute_completed = false`.

The same workflow also confirmed that the observer itself has no activation path, CI performs no positive live execution, and the repository checkout remained unmodified.

## Bounded conclusion

The finding `KONTUR-LIVE-HOST-OBSERVATION-INTEGRITY-GAP` is `closed_verified` for the application-level effect boundary represented by KONTUR v0.1.

A caller can still construct a structurally valid positive eligibility receipt through the lower-level pure evaluator for tests or external observers, but that receipt cannot by itself cross the live effect boundary: the process about to mutate live state must re-observe current runtime facts and reproduce the receipt before Kernel or ledger access.

## Explicit non-effects and remaining limitations

This PASS does **not** establish any of the following:

- cryptographic machine identity or TPM/secure-boot attestation;
- protection against a compromised OS, malicious Git executable, privileged filesystem deception, or lower-layer host compromise;
- cryptographic authentication of the human operator;
- concrete live-host designation;
- Human Activation Review approval;
- Activation Intent, preflight, final Human Execute command, or activation;
- responsibility acceptance, permission expansion, permission bypass, legal authority, truth certification, liability, or universal canonicality.

No live Durable Responsibility Ledger was written by this re-audit.

## Evidence limitation

This re-audit independently inspected the merged successor source and merge metadata and relies on exact tree equality to transfer the successful PR-head CI evidence to the squash successor. A separate push-triggered workflow run against the squash commit SHA is not asserted as independently inspected here.

## Safe next step

The observation-integrity remediation is closed. The next bounded infrastructure step may proceed from the canonical successor `0236588a46ebb0e71e95c8f18a05cee72882ee5f`: designate and independently observe a concrete persistent host profile before any fresh Formal Human Activation Review or live activation artifacts are considered.
