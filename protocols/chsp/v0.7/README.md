# CHSP v0.7 — External Binding Human Recognition & Transition Authorization

CHSP v0.7 sits above the proposal-only external binding layer in v0.6.

It separates two human decisions that MUST NOT be collapsed:

1. **binding recognition** — humans recognize one exact v0.6 external mapping proposal as sufficiently evidenced for CHSP transition preparation;
2. **transition-preparation authorization** — humans separately authorize preparation of a bounded external transition envelope for that exact recognized mapping.

Neither step changes an external system.

## Causal chain

`v0.6 binding_review_eligible -> recognition decisions -> CHSPExternalBindingRecognition -> transition decisions -> CHSPExternalTransitionPreparationAuthorization -> current-validity assessment -> external transition executor MAY be requested later`

v0.7 contains no external executor.

## Core invariants

`binding review eligible != binding recognized`

`binding recognized != external binding established`

`binding recognized != external transition authorized`

`transition preparation authorized != external control mutation authorized`

`transition preparation authorized != external control transferred`

`external principal observed != repository/account owner adjudicated`

`CHSP stewardship != GitHub ownership`

`authorization active != executor invoked`

`revocation recorded != historical authorization erased`

`declared human domains != universal independence proven`

## Reference quorum

Recognition requires at least two human decisions from at least two declared decision domains. At least one recognizer must be someone other than the current CHSP steward.

Transition preparation requires a fresh second quorum of at least two humans from at least two declared domains, including explicit consent by the current CHSP steward and at least one additional human.

The two phases use different typed confirmation tokens and different artifact digests. A recognition decision cannot be reused as transition authorization.

## Freshness

Reference policy requires:

- v0.6 review-eligible assessment age <= 24 hours when recognition is issued;
- decision-quorum spread <= 24 hours;
- recognition validity <= 7 days;
- transition-preparation authorization validity <= 24 hours.

These are reference thresholds, not universal governance rules.

## Revocation

Recognition or transition-preparation authorization can be blocked before later execution by immutable revocation/withdrawal events. Historical artifacts remain intact.

## External-effect boundary

Even the strongest valid v0.7 state keeps false:

- external binding established;
- external control mutation authorized;
- external control transferred;
- repository ownership transferred;
- account control transferred;
- canonical origin mutated;
- canonical publication executed;
- KONTUR activated;
- legal ownership adjudicated;
- universal identity proven;
- distributed consensus established.

The strongest decision is only:

`transition_preparation_authorized -> bounded_external_transition_executor_may_be_requested`

A future executor MUST be a separate protocol layer with its own human-controlled boundary.