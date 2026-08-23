# Canonical Human Succession Protocol (CHSP) v0.3

CHSP v0.3 defines the boundary between a fully progressed successor candidate and a **reviewable dual-control handover**.

It does not itself transfer repository ownership, account control, legal title, canonical publication authority, or KONTUR authority.

Core distinctions:

`final succession review eligible != final human recognition`

`final human recognition != exclusive authority`

`predecessor unavailable for protocol action != legal incapacity established`

`dual-control handover != ownership transfer`

`positive handover outcome != canonical successor established`

`canonical stewardship handover review eligible != handover executed`

## Required predecessor disposition

Before final recognition, the transition must bind one predecessor disposition.

Two modes are allowed:

1. `acknowledged` — the currently recorded predecessor steward explicitly acknowledges that the named candidate may enter CHSP dual-control handover review.
2. `protocol_unavailability_attested` — the predecessor cannot provide the required protocol action and the alternative path is supported by multiple evidence-bearing attestors from distinct declared domains.

The unavailability path proves only policy-scoped unavailability for the required protocol action. It does not certify death, medical incapacity, legal incapacity, abandonment, waiver, ownership loss, or account loss.

## Final recognition

`CHSPFinalHumanRecognition` binds:

- one exact CHSP v0.2 `final_succession_review_eligible` assessment;
- one exact predecessor disposition;
- one final recognizer distinct from both candidate and predecessor steward;
- authority-evidence SHA-256;
- nonce;
- exact typed confirmation;
- a final cooling period.

The artifact records a human decision to permit dual-control handover consideration only.

It never grants exclusive control or canonical succession.

## Final challenge contour

`CHSPFinalChallenge` records objections raised after final recognition.

Open or upheld challenges block handover issuance and completion review. Resolved/remediated challenges remain historical evidence and do not become positive evidence automatically.

A challenge never silently revokes an already-issued handover artifact; revocation must be separately recorded in the handover outcome path.

## Dual-control handover

The handover window is deliberately non-exclusive.

A `CHSPDualControlHandover`:

- binds the final recognition;
- names predecessor and successor candidate;
- has a bounded scope;
- expires;
- is revocable;
- requires an explicit human authorizer;
- preserves appeal and recovery paths;
- records whether the predecessor participates directly or the protocol-unavailability alternative is being used.

Allowed scopes remain review, supervised preparation, incident coordination, policy drafting, release preparation, provenance verification, and succession-package validation.

No v0.3 scope includes account administration, ownership transfer, secret recovery-material disclosure, canonical-origin mutation, canonical publication execution, or KONTUR activation.

## Immutable handover outcome

Permission and result remain separate immutable artifacts:

`final recognition -> dual-control handover -> handover outcome`

A positive outcome may count only after the policy minimum dual-control observation interval.

`positive outcome != permanent trust`

`positive outcome != canonical authority`

## State model

The local assessor may emit only:

- `final_recognition_invalid`
- `final_cooling_active`
- `final_challenge_blocked`
- `dual_control_handover_eligible`
- `dual_control_active`
- `handover_reset_required`
- `canonical_stewardship_handover_review_eligible`

The strongest positive result means only:

`canonical_stewardship_handover_review_eligible -> canonical_stewardship_handover_may_be_requested`

v0.3 intentionally stops before an executable canonical stewardship handover.

## Authority boundary

Every v0.3 assessment keeps false:

- automatic stewardship transfer;
- exclusive successor authority;
- canonical successor established;
- canonical origin mutated;
- canonical publication executed;
- repository/account ownership transferred;
- KONTUR activated;
- legal incapacity established;
- medical incapacity established;
- distributed consensus established;
- universal trust established.

## Digest semantics

CHSP v0.3 preserves the CHSP v0.1/v0.2 deterministic compact UTF-8 JSON + lexicographically sorted keys SHA-256 scheme. It does not silently reinterpret predecessor digests as RFC 8785/JCS.

## Execution boundary

The reference implementation is local JSON validation, issuance, reservation, and assessment tooling only. It performs no network, Git, account, publication, ownership, secret-recovery, or KONTUR action.
