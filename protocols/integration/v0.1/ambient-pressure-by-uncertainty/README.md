# Ambient Pressure by Uncertainty v0.1

Status: experimental, provider-neutral, non-actuating.

This profile represents a bounded causal state created when a sufficiently real possibility of interaction changes attention, readiness, resource allocation, waiting behavior, or alternative decisions even though no interaction outcome has yet been observed.

## Invariants

- `No Observable Interaction != No Causal State`
- `Silence != Refusal`
- `Delay != Intentional Delay`
- `Absence != Negative Intent`
- `Unknown Availability != Deliberate Withholding`
- `Reserved Readiness != Proven Coercion`
- `Causal Relevance != Intent Attribution != Liability`

## Model

A receipt binds one possibility/expectation source, one observer/context, a bounded uncertainty interval, observable effects on attention/resources/alternatives, and an interpretation state. The default interpretation is epistemically weak: `unknown` or `no_response`.

The stronger states `abstention` and `refusal` require a separate evidence reference and MUST NOT be inferred from silence, elapsed time, absence, or resource reservation alone.

Observable pressure may be causally relevant because the possibility changed what another participant held ready, deferred, monitored, or reserved. This does not establish motive, malice, coercive purpose, responsibility, liability, authority, sanction, or permission to act.

## Interpretation states

- `no_response`: no response event observed inside the bounded interval;
- `unknown`: evidence is insufficient to classify the non-interaction;
- `delay`: an observable response/event is delayed, without inferring intentional delay;
- `unavailable`: separate evidence establishes unavailability;
- `abstention`: separate evidence establishes conscious abstention;
- `refusal`: separate evidence establishes refusal.

`unavailable`, `abstention`, and `refusal` require `interpretation_evidence_ref`.

## Non-effects

A conforming receipt does not perform external observation, identity resolution, profiling, sanction, actuator execution, KONTUR mutation, authority transfer, permission change, release/tag/publication, or canonical-origin mutation.

The receipt may support later causal analysis, but is not itself proof of intent, responsibility, liability, truth, or authorization.
