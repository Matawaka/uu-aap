# CHSP v0.8 — External Transition Envelope & Dry-Run Verifier

CHSP v0.8 is the last non-mutating boundary before any future external-control executor.

It consumes one exact active CHSP v0.7 transition-preparation authorization and produces only a machine-readable transition envelope plus a dry-run verification receipt.

Causal line:

`v0.7 transition_preparation_authorized -> observed external before-state -> bounded transition envelope -> dry-run verifier -> dry_run_verified -> external execution authorization MAY be requested`

Core invariants:

`transition preparation authorized != external mutation authorized`

`observed before-state != universal external truth`

`intended after-state != external state changed`

`dry-run verified != transition executed`

`dry-run verified != repository ownership transferred`

`role planning != role grant`

`external executor may be requested != external executor invoked`

The reference implementation is local-only. It performs no network, Git, GitHub API, subprocess, account, repository, canonical-origin, publication, credential, or KONTUR mutation.

## Allowed non-destructive planned operations

- `ensure_principal_presence`
- `ensure_role_at_least`
- `ensure_release_signer_binding`
- `record_external_stewardship_mapping`

Reference v0.8 does not allow planning ownership transfer, predecessor removal, credential rotation, force-push, ref deletion, canonical-origin mutation/publication, or KONTUR activation.

## Observed before-state

`CHSPExternalObservedState` records a bounded observation supplied to the verifier. It is content-addressed, timestamped, observer-attributed and must not contain credentials.

The observation can describe a principal as `absent`, `identity_only`, `collaborator`, `maintainer`, `admin`, `owner`, `release_signer`, or `unknown`.

Observation proves only what the supplied evidence supports; it does not establish universal provider truth.

## Transition envelope

`CHSPExternalTransitionEnvelope` binds:

- exact v0.7 transition-preparation authorization;
- exact v0.7 `transition_preparation_authorized` assessment;
- exact v0.6 binding proposal;
- exact external system/principal;
- exact observed before-state;
- explicit bounded intended operations;
- expected preconditions;
- expiry and nonce.

Every operation has `force=false` and `destructive=false`.

## Dry-run receipt

`CHSPExternalTransitionDryRunReceipt` records whether the envelope is internally consistent with the observed state and reference policy.

A positive receipt may claim only:

- exact envelope validated;
- current supplied observation accepted within freshness policy;
- planned operations are non-destructive and policy-bounded;
- dry-run verification completed.

It always keeps false:

- external mutation performed;
- external control transferred;
- repository ownership transferred;
- account control transferred;
- canonical origin mutated;
- canonical publication executed;
- KONTUR activated;
- legal ownership adjudicated;
- global provider state proven.

## Strongest state

`dry_run_verified -> external_transition_execution_authorization_may_be_requested`

v0.8 stops there. It includes no external executor and no external execution authorization artifact.