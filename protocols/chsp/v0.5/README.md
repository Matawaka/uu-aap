# CHSP v0.5 — Bounded Canonical Stewardship Handover Executor & Receipt

CHSP v0.5 is the first CHSP layer that may **execute the protocol-level stewardship handover already authorized by CHSP v0.4**.

It does not administer GitHub, Git remotes, repository ownership, accounts, canonical-origin publication, credentials, legal ownership, or KONTUR.

## Boundary

`v0.4 authorization_active -> bounded local execution -> CHSPCanonicalStewardshipState -> CHSPHandoverExecutionReceipt`

The execution changes only the CHSP protocol record.

Core distinctions:

`handover authorized != handover executed`

`CHSP stewardship effective != repository ownership transferred`

`CHSP stewardship effective != account control transferred`

`CHSP stewardship effective != canonical origin published`

`CHSP stewardship effective != KONTUR activated`

`execution receipt != legal title`

## Inputs

The executor requires exact artifacts from v0.4:

- `CHSPCanonicalStewardshipHandoverAuthorization`;
- a self-digested `CHSPHandoverAuthorizationAssessment` whose state is `authorization_active` and decision is `bounded_handover_executor_may_be_requested`;
- the v0.5 execution policy;
- recorder identity label and recorder-evidence SHA-256;
- an execution nonce;
- a new local output directory.

The v0.4 assessment MUST bind the exact authorization digest and MUST be fresh enough for the v0.5 reference policy. The authorization MUST still be inside its own validity window at execution time.

Reference policy uses a maximum authorization-assessment age of 15 minutes.

A fresh local assessment reduces stale-state risk but does not establish the global absence of a later revocation that was not presented to the local executor.

`fresh local assessment != global revocation absence proven`

## Recorder is not the authority source

The technical recorder does not create the authority to transfer stewardship.

Authority provenance remains:

`v0.3 positive dual-control outcome -> v0.4 human approval quorum -> v0.4 bounded authorization -> v0.5 execution`

The recorder is recorded for causal attribution only.

`recorder performed execution != recorder granted authority`

## Durable local execution

Reference execution is local-only and fail-closed:

1. validate policy, authorization and active assessment;
2. verify freshness and expiry;
3. reserve the authorization digest and execution nonce using exclusive local files;
4. build a temporary output directory;
5. write and fsync `chsp-canonical-stewardship-state.json`;
6. write and fsync `chsp-handover-execution-receipt.json`;
7. write `CHSP_PROTOCOL_STEWARDSHIP_RECORDED` last;
8. atomically rename the temporary directory into place.

The destination MUST NOT already exist.

If execution reaches the reservation boundary and later fails, the local reservation remains consumed. This is intentional fail-closed behavior and is not claimed as global replay prevention.

## Stewardship state

A successful execution records the candidate as the effective **CHSP protocol canonical steward** for the exact project and authorization.

This is intentionally narrower than external control. The state keeps false:

- repository ownership transferred;
- account control transferred;
- canonical origin mutated;
- canonical publication executed;
- external system control changed;
- KONTUR activated;
- legal ownership adjudicated;
- distributed consensus established;
- universal trust established.

The predecessor's legal rights or external account rights are not adjudicated by this protocol record.

## Receipt

`CHSPHandoverExecutionReceipt` binds:

- exact v0.4 authorization SHA-256;
- exact v0.4 active-assessment SHA-256;
- exact resulting stewardship-state SHA-256;
- execution nonce;
- recorder identity label;
- recorder-evidence SHA-256;
- execution time.

The receipt may truthfully claim that the **CHSP protocol handover execution was performed** and that the CHSP stewardship state was recorded. It may not claim any external transfer.

## Post-execution revocation semantics

A v0.4 authorization revocation or candidate withdrawal is a pre-execution control.

Once a valid v0.5 receipt has been recorded, a later v0.4 revocation does not retroactively erase the historical execution.

`later revocation != execution never happened`

Any later change of CHSP canonical stewardship requires a new evidence-bound CHSP succession chain rather than mutation of the existing state or receipt.

## Assessment

`CHSPHandoverExecutionAssessment` has only two states:

- `execution_invalid`;
- `protocol_handover_recorded`.

Strongest decision:

`protocol_handover_recorded -> chsp_protocol_canonical_stewardship_is_effective`

This remains scoped to CHSP itself.

## Non-capabilities

The reference executor contains no network client, Git invocation, subprocess execution, GitHub API call, account mutation, credential use, canonical publication, ownership transfer, or KONTUR activation.
