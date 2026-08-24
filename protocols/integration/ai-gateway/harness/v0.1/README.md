# UU-AAP AI Gateway GitHub Reference Harness v0.1

Status: executable reference harness above AI Gateway v0.1 and GitHub adapter v0.1.

This harness demonstrates how an implementation can consume already-qualified gateway and adapter artifacts without granting itself authority or performing network mutations by default.

## Boundary

The harness is executable code, but v0.1 is deliberately **dry-run only**:

```text
harness execution != actuator execution
planned call != performed call
allow_plan != ActionPermit
fixture state != live state
```

It consumes a scenario, validates exact bindings, and returns either:

- `allow_plan` with a bounded GitHub tool-call plan; or
- `deny` with explicit reasons and no planned actuator call.

It never opens a network connection, reads credentials, or invokes GitHub.

## Required inputs

A scenario binds:

- Gateway decision (`admissible` required for consequential planning);
- Core `ActionPermit` reference;
- explicit action approval reference;
- exact repository;
- exact PR number;
- expected PR head SHA;
- expected base SHA;
- allowed merge method;
- observed current state used only for freshness comparison;
- `live_execution_enabled = false`.

## Fail-closed properties

The harness denies when any of the following is missing or mismatched:

- gateway decision is not `admissible`;
- ActionPermit reference is absent;
- explicit approval is absent;
- repository/operation/PR differs from the authorized target;
- current head or base SHA differs from the expected state;
- merge method differs from the authorized method;
- transport attempts to define authority;
- secrets/credentials appear in scenario input;
- live execution is enabled;
- expected effects overlap explicit non-effects.

## Output

`HarnessReport` is evidence about planning only.

```text
HarnessReport != GitHubActuatorObservation
HarnessReport != Core ActionReceipt
HarnessReport != performed action
HarnessReport != causality
```

The executable harness emits a deterministic report hash over canonical JSON.

## Files

- `harness-report.schema.json` — typed dry-run result.
- `scenarios.fixture.json` — paired ALLOW/DENY reference scenarios.
- `run-harness.js` — executable planner.
- `validate-harness.js` — conformance and negative-vector validator.

## Next layer

A later live reference executor, if introduced, must be a separate artifact and MUST require an external authority/approval boundary. It may consume an `allow_plan`, but `allow_plan` alone must never trigger a mutation.
