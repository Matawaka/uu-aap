# Canonical Human Succession Protocol (CHSP) v0.2

CHSP v0.2 adds **human recognition, challenge/cooling periods, and progressive authority envelopes** on top of the evidence-bound succession eligibility introduced in CHSP v0.1.

The protocol remains human-controlled and fail-closed.

`succession eligible != human recognition`

`human recognition != authority grant`

`authority envelope != canonical authority`

`higher stage eligible != higher stage granted`

`challenge raised != authority automatically revoked`

`revocation recorded != historical evidence erased`

`final succession review eligible != canonical successor established`

## Scope

v0.2 defines four additional artifact families:

1. `CHSPHumanRecognition` — one explicit human recognition of one exact v0.1 succession-eligible assessment for progressive stewardship consideration only;
2. `CHSPChallenge` — a machine-readable challenge to the recognition or progressive-authority path;
3. `CHSPProgressiveAuthorityEnvelope` — a bounded, expiring and revocable human authorization record for one authority stage;
4. `CHSPTransitionAssessment` — a local-only assessment of whether cooling, challenge and stage-progression conditions are satisfied.

v0.2 does not publish a new canonical origin, mutate repository authority, transfer ownership, activate KONTUR, or establish a canonical human successor.

## Human recognition

Recognition may be recorded only when the bound CHSP v0.1 assessment is exactly:

- `state = succession_eligible`;
- `decision = human_successor_recognition_may_be_requested`;
- self-digest valid;
- project and candidate bindings valid.

The recognizer must be distinct from the candidate and must bind an external evidence digest for the recognizer's authority to make the recognition decision.

Recognition requires the exact typed confirmation token:

`RECOGNIZE_CHSP_SUCCESSOR_CANDIDATE_FOR_PROGRESSIVE_AUTHORITY_ONLY`

The recognition artifact starts two clocks:

- a cooling period;
- a public/review challenge window.

Neither clock grants authority merely by expiring.

`time elapsed != authority acquired`

## Challenge semantics

A challenge may concern:

- protocol boundary;
- conflict of interest;
- evidence integrity;
- process integrity;
- stewardship concern;
- authority scope;
- other documented cause.

`open` and `upheld` challenges block new authority progression. A `resolved_remediated` challenge may stop blocking progression, but it remains part of the historical record and does not become positive evidence.

CHSP v0.2 does not automatically revoke an already issued envelope merely because a challenge is raised. Revocation is a distinct accountable human action.

This preserves causal attribution:

`challenge -> progression blocked`

but not:

`challenge -> hidden automatic authority mutation`

## Progressive authority stages

The reference progression is:

- `A0_observation` — no authority envelope;
- `A1_advisory` — advisory review, issue triage and documentation tasks;
- `A2_reversible_limited` — proposal preparation and non-canonical/test maintenance;
- `A3_supervised_stewardship` — supervised release/policy/incident preparation;
- `A4_canonical_preparation` — preparation of canonical publication or succession packages only.

No CHSP stage includes:

- canonical merge authority;
- account administration;
- ownership transfer;
- canonical-origin publication;
- canonical-origin mutation;
- KONTUR activation;
- secret recovery-material disclosure;
- automatic failover.

`A4_canonical_preparation != canonical publication authority`

## Stage progression

Every envelope must:

- bind the exact recognition digest;
- bind one candidate;
- contain only scopes permitted for its stage;
- name the human authorizer;
- bind authorization-evidence SHA-256;
- have an issue and expiry time;
- be explicitly revocable;
- carry a nonce;
- bind the previous completed envelope when stage > A1;
- never skip a stage.

A higher stage becomes review-eligible only after the immediately preceding stage is completed with a positive attributable outcome and the policy's minimum stage-observation interval is satisfied.

No assessor may create the next envelope automatically.

## Independent authorization at higher stages

The reference policy requires an authorizer distinct from both candidate and original recognizer for A3 and A4. This is a governance topology requirement, not proof that a physically independent human currently exists.

`distinct identifier != absolute independence proof`

## Revocation

An envelope may be recorded as `revoked`. Revocation stops that envelope from counting as a successful predecessor for later progression.

Historical artifacts remain immutable evidence.

`revoked authority != erased history`

## Transition assessment states

The reference assessor may emit:

- `recognition_invalid`;
- `cooling_active`;
- `challenge_blocked`;
- `stage_A1_eligible`;
- `progressive_authority_active`;
- `next_stage_review_eligible`;
- `final_succession_review_eligible`.

The strongest positive v0.2 result is:

`final_succession_review_eligible -> canonical_human_succession_recognition_may_be_requested`

It still does not establish the canonical human successor.

## Safety boundary

All v0.2 outputs preserve:

- `automatic_authority_progression = false`;
- `canonical_successor_established = false`;
- `canonical_origin_mutated = false`;
- `canonical_publication_executed = false`;
- `ownership_transferred = false`;
- `kontur_activated = false`;
- `global_replay_prevention_established = false`;
- `legal_identity_certified = false`;
- `psychological_fitness_certified = false`;
- `universal_trust_established = false`.

## Digest semantics

CHSP v0.2 preserves the v0.1 deterministic compact UTF-8 JSON + lexicographically sorted object-key SHA-256 convention. It is version-scoped and is not represented as RFC 8785/JCS.

## Implementation boundary

The reference implementation is local-only JSON tooling. It may create local recognition/envelope artifacts and local replay reservations, but performs no Git, network, account, publication, ownership, or KONTUR action.
