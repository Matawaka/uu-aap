# UU-AAP Bounded CI Migration Gate v0.1

**Status:** experimental reusable-tooling migration boundary  
**Issue:** #641  
**Origin frontier:** `cdab3d75c3fdc21ec3dc61000b7dc732d3ee11ae`  
**Predecessors:** Component Manifest v0.1, Dependency / Impact Graph v0.1, Graph-vs-Manual Conformance Parity v0.1, Generated Conformance Runner v0.1, Execution Evidence Parity v0.1

## Purpose

T3d is the first point at which reusable conformance tooling is permitted to replace a duplicated CI orchestration block. The permission is deliberately local: one named historical block, one frozen rollback frontier, one exact component slice.

```text
frozen manual workflow
        +
full 27-command parity-proven plan
        +
exact T3c execution evidence
        ↓
bounded migration slice
        ↓
5-command generated execution
```

The first migration target is only:

`Re-run Marketer Pessimist predecessors`

in `.github/workflows/marketcloser-publication-observation-v0.1-validation.yml`.

The remaining 22 MarketCloser predecessor commands are outside this migration.

## Frozen rollback boundary

```text
pre-migration frontier:
cdab3d75c3fdc21ec3dc61000b7dc732d3ee11ae

historical workflow blob:
b8306d2accf12c0ac4d1324b5992fd4f6ae7ee72
```

The old workflow remains addressable from Git history. Historical T3a/T3b/T3c workflows materialize that frozen file explicitly after the live workflow changes.

```text
Live Workflow Change != Historical Evidence Rewrite
Rollback Evidence != Live Execution Authority
```

## Migrated component slice

Exactly three Component Manifests own the five migrated commands:

```text
Marketer-Pessimist-Product-Contract
        ↓
Marketer-Pessimist-Local-MVP
        ↓
Marketer-Pessimist-Real-Review-Intake
```

The committed `marketcloser-marketer-pessimist.slice.json` binds the component IDs, manifest paths and exact five historical commands.

At runtime T3d first rebuilds the **full historical 27-command Generated Conformance plan** from the frozen workflow and baseline. The five-command slice is then selected from that validated parent plan by component identity. Arbitrary subset plans are not accepted as migration evidence.

## Commands

```text
node tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js verify <slice.json> <baseline.json> <frozen-workflow.yml>
node tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js run <slice.json> <baseline.json> <frozen-workflow.yml>
node tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js verify-workflow <slice.json> <frozen-workflow.yml> <current-workflow.yml>
```

`verify` executes the frozen five-command rollback order and the generated five-command slice through the **same T3b `Runner.executePlan()` boundary** and compares per-command process/output evidence.

`run` executes only the admitted generated slice. This is the operation used by the migrated production CI step.

`verify-workflow` proves the migration changed only the named step while preserving workflow triggers and all non-target steps byte-for-byte.

## Migration admission

The first slice is admissible only when all of the following hold:

- frozen workflow blob is exact and addressable;
- full 27-command parity plan is valid;
- parent plan digest matches the pinned migration spec once frozen;
- exactly the three declared components are selected;
- exactly five commands are selected;
- generated commands equal the frozen rollback commands;
- the five rollback commands are a contiguous historical baseline slice;
- rollback and generated execution both succeed 5/5;
- status/signal and stdout/stderr digest evidence match exactly;
- neither execution changes repository content;
- live workflow triggers are unchanged;
- every non-target workflow step is unchanged.

The resulting positive classification is:

`MIGRATION_ADMISSIBLE`

Anything weaker is not automatically promoted to migration evidence.

## Runtime reuse

T3d contains no `child_process`, network provider or file-write execution implementation. It delegates actual command execution to merged Generated Conformance Runner v0.1.

```text
T3d Admission != Second Process Executor
T3d Migration != Product Runtime
```

## Mandatory invariants

```text
One Migrated Block != Global CI Migration
Exact T3c Evidence != Automatic Migration Right
Migration Admission != Runtime Authority
Migration Admission != Compatibility Proof
Migration Admission != Substitutability
Rollback Evidence Must Remain Addressable
Trigger Preservation != Conformance Equivalence
```

A successful T3d merge reduces duplicated CI code. It does not authorize migration of any other workflow block.

## Successor

After this bounded migration is merged and stable, the primary reusable-runtime line advances to **T4 Receipt Runtime SDK v0.1**. Additional CI migrations remain separately evidenced maintenance work rather than an implicit bulk conversion.
