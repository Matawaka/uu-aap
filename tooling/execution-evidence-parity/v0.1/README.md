# UU-AAP Execution Evidence Parity v0.1

**Status:** experimental reusable-tooling differential evidence boundary  
**Issue:** #639  
**Origin frontier:** `8197e803a242fe6d7729963ae7ac9a9fb389b3cc`  
**Predecessor:** Generated Conformance Runner v0.1 (#637/#638)

## Purpose

T3a proved exact command-set parity. T3b proved that the generated dependency-first plan can execute all 27 predecessor commands. T3c asks a narrower but stronger engineering question:

```text
Does changing only the conformance-command order
change the observable execution evidence?
```

The comparison is intentionally bounded to one exact repository frontier and one frozen historical workflow.

```text
Historical workflow -> exact manual command order
                  +
Parity-proven graph -> generated dependency-first order
                  ↓
        same constrained Runner.executePlan()
                  ↓
     per-command execution evidence comparison
```

No production workflow is replaced or narrowed here.

## Two execution profiles

### HISTORICAL_MANUAL_ORDER

The order is re-extracted from the exact frozen workflow blob through the existing Conformance Parity source-binding logic. Component ownership is recovered only by matching each command identity to the already parity-proven generated plan.

### GENERATED_DEPENDENCY_FIRST_ORDER

The order is the exact plan produced by `Generated Conformance Runner v0.1`.

Both profiles therefore contain the same 27 command identities and exclude the target component's own commands.

## Shared execution boundary

This layer does **not** implement another subprocess policy. Both profiles are executed through:

```text
Runner.executePlan()
Runner.safeChildEnvironment()
Runner.snapshotRepository()
```

Consequently both use the same:

- `node | python | python3` executable allowlist;
- argument arrays;
- `shell=false`;
- stop-on-first-failure behavior;
- bounded child environment;
- output digesting;
- repository mutation detection.

## Comparison key

Results are joined by command identity:

```text
executable + NUL + args...
```

Sequence number is evidence about order, not command identity.

For every command T3c compares:

```text
exit_code
signal
success
error_code
stdout_sha256
stdout_bytes
stderr_sha256
stderr_bytes
```

Raw stdout/stderr are never stored in the parity report.

## Classifications

```text
EXACT_EXECUTION_EVIDENCE_PARITY
ORDER_INSENSITIVE_SUCCESS_OUTPUT_DIFFERS
ORDER_SENSITIVE_EXECUTION
REPOSITORY_MUTATION_DETECTED
INSUFFICIENT_EVIDENCE
```

### EXACT_EXECUTION_EVIDENCE_PARITY

Both complete runs succeed, repository snapshots remain unchanged, and every compared field is byte-evidence identical by command identity.

### ORDER_INSENSITIVE_SUCCESS_OUTPUT_DIFFERS

Both complete runs succeed with identical process status/signal evidence, but one or more stdout/stderr digests or byte counts differ.

This is not treated as exact evidence parity.

### ORDER_SENSITIVE_EXECUTION

A complete evidence pair shows different success/failure, exit-code, signal or error-code evidence for at least one command.

### REPOSITORY_MUTATION_DETECTED

Either run changes repository content. This dominates other classifications.

### INSUFFICIENT_EVIDENCE

Complete evidence exists but does not support one of the stronger classifications, for example identical failure in both orders.

Incomplete command evidence fails closed before classification.

## Evidence ceiling

```text
Execution Evidence Parity != Semantic Truth
Output Digest Equality != Behavioral Equivalence Beyond This Frontier
Order Insensitivity Here != Universal Order Independence
Execution Parity != Compatibility Proof
Execution Parity != Substitutability
Execution Parity != Authority
Execution Parity != CI Migration Authorization
```

`EXACT_EXECUTION_EVIDENCE_PARITY` is therefore a bounded statement only about these commands, this workflow binding, this frontier and the compared process/output evidence.

## Fail-closed boundary

The implementation rejects:

- workflow/blob drift;
- baseline drift;
- manual/generated command-set mismatch;
- duplicate command result;
- missing command result;
- injected extra result;
- target-component result in predecessor-only evidence;
- malformed execution receipt.

A stopped-early receipt is incomplete evidence for a 27-command parity comparison and therefore cannot be silently promoted into a full comparison report.

## Successor

T3d may evaluate one bounded CI migration only after this evidence is merged.

```text
Execution Parity Evidence != CI Migration Decision
Migration Review Eligible != Migration Authorized
```

T3d must remain a separate review/merge gate.