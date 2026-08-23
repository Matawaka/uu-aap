# CHSP v0.9 — External Transition Execution Authorization

CHSP v0.9 is the final human-controlled authorization boundary before any future bounded external executor.

It does **not** execute Git, GitHub API, account, ownership, canonical-origin, publication, credential, or KONTUR mutations.

## Causal chain

`v0.8 dry_run_verified -> fresh execution recheck -> phase-specific human execution decisions -> exact execution authorization -> current authorization assessment -> bounded executor MAY be requested`

## Core invariants

`dry_run verified != execution authorized`

`recheck matched != human authorization`

`human decision != authorization quorum`

`bounded exact execution authorized != unbounded external mutation authority`

`execution authorization active != executor invoked`

`execution authorization active != execution performed`

`authorization revoked != historical authorization erased`

## Fresh recheck

`CHSPExternalExecutionRecheck` binds the exact v0.8 envelope, dry-run receipt and dry-run assessment to a fresh external observation.

Reference v0.9 treats any material role drift from the v0.8 before-state as fail-closed and requires a new dry-run. A matching recheck is evidence about the supplied observation only; it does not prove global provider state.

Credentials are prohibited.

## Human execution decision

Every execution decision binds the exact recheck and uses the typed confirmation:

`AUTHORIZE_CHSP_EXACT_EXTERNAL_EXECUTION_ONLY`

Reference policy requires at least two distinct humans in two declared decision domains, explicit consent from the current CHSP steward, and at least one non-steward authorizer.

Declared domains are topology metadata, not universal independence proof.

## Exact execution authorization

`CHSPExternalExecutionAuthorization` binds:

- exact v0.8 transition envelope;
- exact positive dry-run receipt;
- exact `dry_run_verified` assessment;
- exact fresh matching execution recheck;
- exact operation-set digest;
- exact human decision-set digest;
- expiry and nonce.

It authorizes only the exact already-bounded operations in the v0.8 envelope.

It never authorizes:

- ownership transfer;
- account-control transfer;
- predecessor access removal;
- credential rotation or disclosure;
- force-push or ref deletion;
- canonical-origin mutation;
- canonical publication;
- KONTUR activation.

## Revocation

Authorization remains revocable before future execution through an immutable `CHSPExternalExecutionAuthorizationRevocation` artifact.

`revocation != historical authorization erased`

## Strongest state

`execution_authorization_active -> bounded_external_execution_executor_may_be_requested`

Even then `executor_invoked=false` and `execution_performed=false`.

Actual bounded external execution is intentionally deferred to a later protocol version.
