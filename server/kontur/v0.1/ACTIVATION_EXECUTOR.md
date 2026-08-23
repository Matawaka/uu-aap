# KONTUR Activation Executor v0.1

`KONTUR Activation Executor` is the final server-level execution boundary between a positive activation preflight and a durably recoverable KONTUR responsibility state.

## Position

```text
KONTURReadinessSignal
  -> KONTURActivationFrontierReceipt
  -> KONTURActivationIntent
  -> KONTURActivationPreflightReceipt
  -> explicit final human execute
  -> KONTURActivationExecuteCommand
  -> KONTUR Activation Executor
  -> Responsibility Kernel / activate
  -> Durable Responsibility Ledger / genesis commit
  -> disk recovery
  -> KONTURActivationExecutionReceipt
```

The stages are deliberately non-equivalent:

```text
system ready
!= activation intent declared
!= preflight admitted
!= final human execute declared
!= Kernel transition produced
!= durable ledger commit
!= recovered authoritative active head
!= activation completed
```

## Final human execute command

`KONTURActivationExecuteCommand v0.1` is a second explicit human boundary after the earlier activation intent.

It binds exact:

- current Git revision;
- `KONTURActivationIntent` bytes/digest;
- `KONTURActivationPreflightReceipt` bytes/digest;
- Activation Execution Policy bytes/digest;
- system/server identity;
- holder, responsibility scopes, fencing epoch and lease;
- an explicit final human actor reference;
- a one-shot execute nonce distinct from the activation-intent nonce;
- a 30-second command validity window.

The human identity assurance remains `declared_not_cryptographically_verified` in v0.1.

The execute command itself keeps all activation/state claims false.

## Execution policy

The reference `KONTURActivationExecutionPolicy` requires:

- final command age <= 30 seconds;
- preflight age <= 30 seconds;
- exact Git/intent/preflight bindings;
- current readiness;
- current healthy server observation;
- live lease;
- empty genesis ledger;
- one-shot execute nonce;
- exactly one Kernel activation call;
- durable genesis commit;
- post-commit disk recovery;
- exact recovered head;
- no automatic retry;
- no auto-activation.

These rules are policy-bound and digest-bound rather than implicit executor constants.

## Durable execution lineage

The genesis ledger entry remains governed by the existing Durable Responsibility Ledger semantics.

The Executor additionally embeds:

- exact `KONTURActivationExecuteCommand` bytes;
- its exact JCS/SHA-256 binding.

These fields are covered by the ledger entry digest and immutable filename. Existing pre-executor v0.1 test entries remain schema-compatible because the extension is optional at the generic ledger layer, while the Executor requires it for its own genesis path.

The ledger's `command_nonce` is the one-shot final execute nonce. Its namespace remains under `activation-intent-nonce:execute:` for compatibility with the already frozen v0.1 ledger nonce contract, but it is semantically distinct from the earlier activation intent nonce.

## Completion rule

A successful Kernel call is not activation completion.

The Executor may emit a positive `KONTURActivationExecutionReceipt` only after:

1. final execute command validation;
2. predecessor/preflight revalidation;
3. empty-ledger recovery;
4. exactly one `transitionResponsibility(... activate ...)` call;
5. genesis ledger entry construction;
6. atomic ledger commit;
7. post-commit ledger recovery;
8. exact recovered active head comparison.

Only then may the receipt establish:

- final human execute command verified;
- Kernel activation transition produced;
- genesis entry durably committed;
- authoritative active head recovered;
- structural responsibility state established;
- local KONTUR activation completed.

## Partial-failure semantics

### Kernel failure

No ledger entry exists. Activation is incomplete.

### Ledger commit failure before durable publication

No positive execution receipt is emitted. Activation is incomplete.

### Failure after durable genesis commit

The committed ledger entry remains authoritative even if recovery verification or execution-receipt publication fails.

A retry is not automatically permitted. Recovery must expose the existing genesis head, and a repeated genesis activation will fail because the ledger is no longer empty.

This prevents an ambiguous post-commit failure from becoming duplicate activation.

## Test-only mode

CI uses only `execution_mode = test_only` and an isolated temporary ledger.

A test-only positive execution may establish local test execution semantics, but the schema requires:

```text
live_kontur_activated = false
```

No repository/server live state may be written by CI.

A separate Node process performs recovery after the positive synthetic execution to demonstrate process-independent disk reconstruction.

## Assurance boundary

Even a successful live activation receipt would not establish:

- new execution authority beyond the existing authority chain;
- legal responsibility or legal liability;
- legal effect;
- moral blame or correctness;
- universal truth;
- universal causality;
- PoAI MaterializationEvent;
- universal canonicality;
- distributed consensus across servers.

The positive claim is deliberately local and structural: the exact KONTUR server responsibility state has been activated and durably recovered under the exact bound frontier and policies.

## Human boundary

This implementation PR does not activate live KONTUR.

After this layer is merged and validated on canonical `main`, the canonical activation prompt may instantiate a concrete live `KONTURActivationIntent` and fresh preflight. The user must still issue a separate explicit final execute instruction before `KONTURActivationExecuteCommand` can exist.
