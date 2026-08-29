# UU-AAP Generated Conformance Runner v0.1

**Status:** experimental reusable-tooling execution boundary  
**Issue:** #637  
**Origin frontier:** `729a9e581c6e5b6dbae95ac3407227e1469cdb68`  
**Predecessors:** Component Manifest v0.1, Dependency / Impact Graph v0.1, Graph-vs-Manual Conformance Parity v0.1

## Purpose

This is the first reusable tooling slice allowed to execute conformance commands discovered from the dependency graph. It does so only after the exact command set has already passed the parity gate against a frozen historical workflow.

```text
Component Manifest
-> Dependency / Impact Graph
-> Graph-vs-Manual Parity
-> immutable Execution Plan
-> Generated Conformance Runner
-> Execution Receipt
```

The runner does not rediscover dependencies independently and does not accept arbitrary shell text.

## Admission gate

A plan can be created only when `ConformanceParity.assessParity()` returns exact parity.

For the first acceptance case:

```text
MarketCloser Publication Observation
manual predecessors = 27 commands
Graph-derived predecessors = 27 commands
missing = 0
extra = 0
```

If the workflow blob, baseline, dependency closure or command set drifts, planning fails before execution.

```text
Parity Success != Permission To Narrow CI
Parity Success != Compatibility Proof
```

## Execution plan

`plan` produces `UU-AAP-Generated-Conformance-Execution-Plan`.

The plan fixes:

- runner origin frontier;
- target component;
- `PREDECESSOR_ONLY` mode;
- exact historical workflow path/blob;
- exact parity counts;
- dependency-first component ordering;
- ordered component-owned command list;
- deterministic plan digest;
- explicit non-effects.

The target component's own conformance commands are excluded by construction in v0.1.

```text
Predecessor Plan != Target Execution
Execution Plan != Authority
```

## Ordering

The parity layer proves set equality. The runner then derives a deterministic dependency-first order from the graph:

```text
predecessor dependencies
before
components that depend on them
```

Command order inside one component remains the order declared by that component's Component Manifest.

This deliberately tests that conformance is not secretly dependent on the manually grouped order of the historical workflow.

## Process boundary

Only these executables are admitted:

```text
node
python
python3
```

Every process is invoked with an argument array and `shell=false`.

Rejected:

- shell-composed arguments;
- unknown executables;
- duplicate commands;
- injected commands not present in the parity-proven set;
- target-component commands in predecessor-only mode.

The runner filters common credential-bearing environment variables and passes only a small runtime environment surface such as `PATH`, temporary/home paths, locale and CI markers.

The runner itself does not provide provider credentials, a network client, product authority or external-effect admission. This is not an OS sandbox: the conformance program being tested remains responsible for its own documented no-effect/import-safety boundaries.

## Stop behavior

v0.1 executes sequentially and stops on the first non-zero/failed child process.

```text
first failed command
-> execution receipt
-> STOP
```

There is no retry, fallback executable, alternate dependency resolution or silent command skipping.

## Repository mutation detection

The runner snapshots repository content before and after execution while excluding `.git` metadata. A changed content snapshot produces:

```text
result = REPOSITORY_MUTATED
repository_changed_after_run = true
```

The dedicated CI also independently verifies `git status --porcelain` after execution.

Temporary conformance output must remain outside the repository checkout.

## Execution receipt

`run` emits `UU-AAP-Generated-Conformance-Execution-Receipt` to stdout.

For each attempted command it records only bounded process evidence:

- component owner;
- executable and args;
- exit code/signal;
- success flag;
- stdout/stderr byte counts;
- SHA-256 digests of stdout/stderr;
- process error code if present.

Raw stdout/stderr are not embedded in the receipt.

```text
Command Output != Semantic Truth
Command Success != Compatibility Proof
```

The receipt also records planned/attempted/succeeded/failed counts, early stop and repository-change status.

## CLI

Plan only:

```bash
node tooling/generated-conformance-runner/v0.1/generated-conformance-runner.js plan \
  tooling/conformance-parity/v0.1/marketcloser-publication.manual-baseline.json \
  .github/workflows/marketcloser-publication-observation-v0.1-validation.yml \
  <component manifests...>
```

Execute parity-proven predecessors:

```bash
node tooling/generated-conformance-runner/v0.1/generated-conformance-runner.js run \
  tooling/conformance-parity/v0.1/marketcloser-publication.manual-baseline.json \
  .github/workflows/marketcloser-publication-observation-v0.1-validation.yml \
  <component manifests...>
```

The CLI emits JSON to stdout. It does not modify the historical workflow.

## First acceptance case

The dedicated CI requires:

```text
planned = 27
attempted = 27
succeeded = 27
failed = 0
stopped_early = false
repository_changed_after_run = false
result = SUCCESS
```

It additionally re-runs Component Manifest, Dependency Impact and Conformance Parity conformance before generated execution.

## Mandatory non-effects

```text
Execution Plan != Authority
Command Success != Semantic Truth
All Tests Pass != Compatibility Proof
Generated Runner != Permission To Narrow CI
Generated Runner != Product Runtime
Conformance Execution != External Effect Authorization
```

The runner does not create or expand authority, responsibility, ActionPermit, PilotPermit, product activation or publication permission.

## Migration boundary

The historical MarketCloser Publication Observation workflow remains unchanged in v0.1.

A later migration gate may compare historical and generated execution evidence and decide whether one manually maintained predecessor block can be replaced by the runner.

```text
Generated Execution Success != Workflow Replacement Authorization
```
