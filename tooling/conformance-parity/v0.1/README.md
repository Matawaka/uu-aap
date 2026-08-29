# UU-AAP Graph-vs-Manual Conformance Parity v0.1

**Status:** experimental reusable-tooling differential proof  
**Issue:** #635  
**Origin frontier:** `b119fac6f2b3702fd5ed158442bf3dd69e276a93`

## Purpose

This slice proves that the merged Component Manifest + Dependency / Impact Graph tooling can reconstruct one long historical predecessor/conformance command set exactly, before any graph-derived command is executed and before any production CI trigger is narrowed.

The frozen comparison source is:

```text
.github/workflows/marketcloser-publication-observation-v0.1-validation.yml
Git blob b8306d2accf12c0ac4d1324b5992fd4f6ae7ee72
```

Its `Re-run ... predecessors` blocks contain exactly **27 commands**.

The proof is:

```text
historical workflow
-> deterministic predecessor-command extraction
-> frozen manual baseline

MarketCloser-Publication-Observation
-> transitive Component Manifest dependencies
-> graph-derived predecessor components
-> graph-derived conformance commands

manual command set == graph-derived command set
```

The target component's own Publication Observation tests are deliberately excluded from predecessor parity.

## Dependency slice

The manifests materialized for this proof preserve the documented bounded chain:

```text
MarketCloser-Publication-Observation
-> MarketCloser-Copy-Export-Receipt
-> MarketCloser-Human-Response-Approval
-> MarketCloser-Response-Candidate
-> MarketCloser-Human-Analysis-Disposition
-> MarketCloser-Real-Stress-Test-Adapter
-> MarketCloser-Real-Review-Local-Run-Revalidation
-> MarketCloser-Real-Review-Run-Permit
-> MarketCloser-Real-Review-Run-Authority-Gate
-> MarketCloser-Minimized-Real-Review-Bridge
-> MarketCloser-Deployment-Observation
-> MarketCloser-Application-Boundary
```

The bridge/intake branch additionally reaches:

```text
Marketer-Pessimist-Real-Review-Intake
-> Marketer-Pessimist-Product-Contract
-> Marketer-Pessimist-Local-MVP
```

This is a **workflow-covered conformance dependency slice**, not a claim that every runtime import in the repository has already been modeled.

## Exact baseline binding

`marketcloser-publication.manual-baseline.json` binds the exact workflow Git blob and the 27 extracted commands in historical order.

`conformance-parity.js` recomputes the Git blob SHA-1 locally and refuses a drifted workflow even when its extracted commands still look similar.

It then re-extracts the historical commands and requires exact order/content equality with the committed baseline before graph comparison begins.

```text
Baseline File != Trusted Without Source Rebinding
```

## Parity result

The strongest positive result is:

```text
parity = true
manual_command_count = 27
graph_command_count = 27
missing_from_graph = []
extra_in_graph = []
commands_executed = false
```

The report also keeps false:

```text
production_workflow_modified
ci_narrowing_authorized
compatibility_proven
authority_created
```

## Fail-closed coverage

Tests reject or expose:

- historical workflow blob drift;
- committed baseline drift;
- missing graph-derived command;
- extra graph-derived command;
- duplicate graph-derived command;
- unresolved required dependency;
- dependency cycle;
- unknown target component.

## Non-effects

```text
Parity Discovery != Command Execution
Manual Workflow != Universal Dependency Truth
Workflow Coverage != Complete Runtime Import Graph
Equal Command Sets != Compatibility Proof
Equal Command Sets != Authority
Parity Success != Permission To Narrow CI
```

This increment does not modify the historical MarketCloser Publication Observation workflow.

## Successor boundary

Only after exact parity is merged may a separate **Generated Conformance Runner v0.1** execute graph-derived commands. That successor must retain constrained executable/argument semantics, deterministic ordering and fail-closed handling, and must not silently narrow existing CI merely because parity was observed once.
