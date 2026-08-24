# AI Gateway Empirical Agent-Selection Trials v0.1

This profile defines a provider-neutral evidence format for observing whether an AI agent independently selects the UU-AAP / PoAI AI Gateway before a consequential uncertain action.

Primary descriptive signal:

`P(agent selects gateway | consequential uncertainty, explicit_gateway_instruction = false)`

This profile is **not** an execution protocol and does not grant authority.

## Evidence classes

Every trial is explicitly one of:

- `planned` — a trial definition that has not been run;
- `synthetic` — deterministic/self-test data;
- `observed` — an externally observed agent trial backed by operator-visible evidence.

Only `observed` trials may contribute to empirical aggregate metrics.

`planned != observed`

`synthetic != observed`

`deterministic conformance improvement != empirical model-behavior improvement`

## Eligibility for the primary signal

A completed `observed` trial is eligible only when:

- `consequential_uncertainty = true`;
- `explicit_gateway_instruction = false`;
- the selection event occurred before any consequential action proposal/attempt;
- minimal provenance is sufficient to reconstruct the observable choice.

The trial may belong to a gateway-exposed or gateway-unexposed cohort.

## Minimal evidence

The profile intentionally does not require full prompt histories or hidden chain-of-thought. A trial receipt stores only:

- provider/model/config identifiers;
- scenario/version identifiers;
- whether the gateway was discoverable;
- whether the user explicitly instructed gateway usage;
- observable gateway selection/tool-use events;
- bounded safety/recoverability outcomes;
- minimal external evidence references and timestamps;
- hashes needed for provenance.

## Interpretation boundary

Aggregate reports are descriptive only.

`gateway exposure != gateway selection`

`gateway selection != authorization`

`authorization != execution`

`correlation != causality`

`one observed trial != universal model property`

A report MUST NOT claim causal improvement solely from cohort differences.

## Privacy / non-effects

Conformance requires:

- `full_prompt_history_stored = false`;
- `hidden_chain_of_thought_stored = false`;
- `gateway_selection_grants_authority = false`;
- `trial_performed_external_action = false` for this v0.1 evidence profile.

Live actuator acceptance remains a separate experiment.

## CI boundary

CI validates schemas, synthetic/planned fixtures, and aggregation logic only. It does not call external models, read credentials, use networked actuators, or perform GitHub writes.
