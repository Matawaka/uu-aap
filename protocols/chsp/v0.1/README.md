# Canonical Human Succession Protocol (CHSP) v0.1

CHSP defines a machine-readable, evidence-bound process for **human stewardship succession** without treating nomination, familiarity, access, employment, family relation, account control, or emergency availability as automatic trust or canonical authority.

CHSP is intentionally separate from repository rescue and canonical publication protocols.

`candidate named != candidate trusted`

`candidate trusted for a bounded task != canonical successor`

`temporary delegation != authority transfer`

`succession eligible != succession recognized`

`human successor recognized != canonical publication executed`

`repository control != authority to reinterpret the canon`

## Purpose

CHSP exists to make a difficult transition observable and reviewable: a potential human successor must demonstrate sustained understanding and bounded stewardship through evidence collected over time. The protocol evaluates **observable conduct**, not personality declarations or psychological diagnoses.

The v0.1 foundation covers:

1. candidate registration without authority;
2. evidence events from independent observer domains;
3. reversible, expiring delegation records;
4. an appeal-contour binding;
5. fail-closed succession-readiness assessment;
6. transition safeguards that preserve recovery and appeal paths.

v0.1 does **not** recognize a canonical successor and contains no account, repository, KONTUR, publication, or ownership mutation executor.

## Observable evidence classes

Reference CHSP evidence classes are:

- `protocol_comprehension` — demonstrates understanding of protocol meaning and invariants;
- `boundary_respect` — respects explicit limits even when broader action is technically possible;
- `conflict_of_interest_disclosure` — discloses material conflicts instead of silently centralizing decision power;
- `challenged_decision_response` — handles criticism, appeal, or rejection without bypassing the review path;
- `uncertainty_handling` — distinguishes facts, assumptions, unresolved uncertainty, and prohibited inference;
- `reversibility_preservation` — prefers reversible actions while authority is incomplete;
- `appeal_preservation` — preserves an independent path to challenge or recover decisions;
- `operational_stewardship` — performs bounded stewardship tasks with attributable outcomes.

A candidate's own statement does not count as an independent observer event.

`self-description != independent evidence`

## Evidence over time

CHSP does not permit instant promotion from nomination to succession readiness. A policy defines a minimum immersion window, minimum evidence count, required evidence classes, minimum independent observer domains, challenge evidence, and completed reversible delegation requirements.

Reference v0.1 uses a deliberately conservative 90-day minimum immersion span. This is a protocol test value, not a claim that 90 days is universally sufficient.

`minimum duration reached != sufficient evidence`

`sufficient evidence != permanent trust`

## Reversible delegation

Before succession readiness, CHSP may record bounded delegations such as advisory review or supervised stewardship. Every delegation must:

- be explicitly scoped;
- be reversible;
- expire;
- exclude canonical publication, destructive canon rewrite, ownership transfer, KONTUR activation, secret recovery-material disclosure, and removal of appeal paths;
- record a final outcome before it can count toward succession readiness.

CHSP does not itself grant the delegation. It only validates and assesses the resulting artifact.

## Transition safeguards

While canonical human succession is unresolved, the reference policy prohibits treating urgency as authority. The transition safeguards require the architecture to preserve:

- historical canonical anchors;
- appeal and recovery paths;
- the possibility of later review;
- reversibility of temporary authority;
- separation between evidence collection and recognition.

The following remain outside CHSP v0.1 execution authority:

- irreversible canon destruction or rewrite;
- hidden centralization;
- canonical-origin mutation;
- ownership transfer;
- KONTUR activation;
- automatic rescue or failover;
- publication of a new canonical origin.

## State model

The reference assessor emits one of:

`observation_required`

`delegation_eligible`

`succession_eligible`

A positive `succession_eligible` result means only that the supplied evidence satisfies the configured CHSP policy. It may permit a later human-recognition process to be requested.

It never means:

- legal identity proven;
- psychological fitness proven;
- universal trust established;
- ownership transferred;
- canonical successor established;
- canonical publication authorized;
- KONTUR activated.

## Appeal contour

Every candidate registration binds an `appeal_contour_id`. The candidate cannot be the sole appeal contour for their own succession. v0.1 records the identifier but does not claim that the external appeal mechanism is operational unless separately evidenced.

`appeal contour named != appeal contour available`

## Evidence conflicts

Unresolved adverse evidence blocks succession eligibility. Remediated evidence may stop blocking, but does not automatically become supportive evidence. Evidence marked indeterminate does not count toward positive thresholds.

This prevents a protocol from converting the mere passage of time into authority.

## Digest semantics

CHSP v0.1 uses deterministic compact UTF-8 JSON with lexicographically sorted object keys for SHA-256 self-digests. This is explicitly version-scoped and is not represented as RFC 8785/JCS.

## Relationship to existing succession work

Project Survival Plane v0.5 and v0.6 address repository/canonical-publication succession artifacts. CHSP addresses **who may become a human canonical steward**. These are distinct axes.

`human stewardship succession != repository succession`

`recognized repository candidate != recognized human successor`

A future integration layer may bind a CHSP succession-eligibility assessment to a separate explicit human-recognition artifact. v0.1 intentionally stops before that boundary.
