# CHSP v1.0 — Bounded External Transition Executor & Post-Execution Receipt

CHSP v1.0 is the first CHSP layer that can perform an external control-plane mutation, but only for one exact v0.8 operation set that has an active v0.9 human execution authorization.

The repository merge, CI, imports, and tests MUST NOT execute any external mutation. Real execution is a separate operator event.

Causal chain:

`v0.8 envelope + dry-run receipt + dry-run assessment -> v0.9 execution recheck + exact execution authorization + active authorization assessment -> explicit v1.0 execution request -> provider preflight -> at most one bounded provider mutation -> post-write verification -> immutable execution receipt -> post-execution assessment`

Core invariants:

- `v1.0 code merged != external execution requested`
- `execution request != execution authorization`
- `execution authorization active != executor invoked`
- `executor invoked != mutation performed`
- `provider write may have occurred != provider write confirmed`
- `mutation performed != transition verified`
- `transition verified != repository ownership transferred`
- `transition verified != predecessor access removed`
- `transition verified != canonical origin mutated`
- `transition verified != canonical publication executed`
- `transition verified != KONTUR activated`
- `provider response != universal provider truth`
- `credential available to runtime != credential embedded in provenance`

## Reference scope

The reference executor supports the current `github_repository` control plane through a narrowly scoped GitHub REST adapter and a provider-neutral core.

`Matawaka/uu-aap` is owned by a personal GitHub account. GitHub documents personal-account repositories as having two access levels: owner and collaborator. Granular `maintain` / `admin` repository-role assignment is an organization-repository concept, and the REST collaborator `permission` parameter is documented as valid only for organization-owned repositories.

Therefore the v1.0 reference adapter is deliberately **personal-repository collaborator-only**. It may:

- observe whether the exact principal currently has collaborator/write access;
- add the exact principal as a standard personal-repository collaborator;
- re-observe collaborator access after the provider call.

The reference policy caps executable role elevation at `collaborator` and allows at most one provider-mutating operation in one execution event.

It MUST NOT:

- assign granular `maintain`, `admin`, or `owner` roles;
- transfer repository ownership;
- remove predecessor access;
- rotate credentials;
- expose or persist token material;
- mutate canonical origin;
- execute canonical publication;
- activate KONTUR;
- force-push or delete refs.

The adapter issues `PUT /repos/{owner}/{repo}/collaborators/{username}` without a `permission` body. It never uses collaborator `DELETE`, repository-content/ref mutation, or ownership APIs.

`record_external_stewardship_mapping` is receipt-local protocol recording only. `ensure_release_signer_binding` is not implemented by the reference GitHub adapter and therefore fails closed before mutation.

## Explicit execution event

Real execution requires a `CHSPExternalExecutionRequest` with typed confirmation:

`EXECUTE_CHSP_V1_EXACT_EXTERNAL_TRANSITION_ONLY`

The request binds the exact v0.9 authorization, v0.9 active assessment, v0.8 envelope, operator identity evidence digest, nonce, and time.

The runtime entrypoint additionally requires an explicit `--commit` flag and the exact authorization SHA-256. The GitHub credential is read from `CHSP_GITHUB_TOKEN` only at runtime and MUST NOT be supplied as a CLI argument or written to any CHSP artifact.

## Preflight, replay, and single-mutation rule

Before any first-use provider write, the core validates the entire supplied predecessor chain and asks the adapter for a fresh observation. Every operation is preflighted before the first write.

A previously consumed authorization/request is rejected before any new provider read. On first use, the execution reservation is created only after deterministic checks plus fresh provider-read preflight have succeeded.

Reference policy:

- active v0.9 assessment age <= 2 minutes;
- execution request age <= 2 minutes;
- maximum execution duration 120 seconds;
- maximum provider-mutating operations = 1;
- maximum executable role = `collaborator`.

A preflight drift from the v0.9 recheck state is fail-closed and no mutation is attempted.

## Receipt states

The executor emits one immutable `CHSPExternalExecutionReceipt` with one of:

- `verified_success` — exact bounded mutation occurred and the intended effect was re-observed;
- `no_change_verified` — target already satisfied the exact bounded operations;
- `failed_before_mutation` — no provider mutation was attempted;
- `failed_after_mutation` — a provider mutation was attempted but completion was not verified;
- `verification_uncertain` — provider state after crossing a possible write boundary could not be established confidently.

Receipts distinguish `external_mutation_performed` from `external_mutation_may_have_occurred`. A network/provider failure after entering a preflighted mutation call can therefore preserve uncertainty without falsely asserting either success or definite non-mutation.

A positive receipt never claims ownership, global provider truth, canonical publication, or KONTUR activation.

## Post-execution assessment

`CHSPExternalExecutionAssessment` can reach `execution_verified_changed` or `execution_verified_no_change`. That only allows the verified external effect to be recorded by a later protocol layer.

The executor does not create a new canonical origin and does not transfer legal or account ownership.

## Credential boundary

Credentials are runtime-only capability material. They are not authority evidence and must never appear in requests, receipts, logs, tests, fixtures, or provenance artifacts.

CI uses a fake adapter only. The real GitHub adapter is compiled and statically checked but never invoked by CI.
