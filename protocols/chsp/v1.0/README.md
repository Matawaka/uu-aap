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
- `mutation performed != transition verified`
- `transition verified != repository ownership transferred`
- `transition verified != predecessor access removed`
- `transition verified != canonical origin mutated`
- `transition verified != canonical publication executed`
- `transition verified != KONTUR activated`
- `provider response != universal provider truth`
- `credential available to runtime != credential embedded in provenance`

## Reference scope

The reference executor supports `github_repository` through a narrowly scoped GitHub REST adapter and a provider-neutral core.

The reference GitHub adapter may:

- verify that the principal is already present;
- ensure an exact principal has at least a bounded repository role;
- verify the post-write role.

The reference policy caps executable role elevation at `maintainer` and allows at most one provider-mutating operation in one execution event.

It MUST NOT:

- grant `admin` or `owner`;
- transfer repository ownership;
- remove predecessor access;
- rotate credentials;
- expose or persist token material;
- mutate canonical origin;
- execute canonical publication;
- activate KONTUR;
- force-push or delete refs.

`record_external_stewardship_mapping` is receipt-local protocol recording only. `ensure_release_signer_binding` is not implemented by the reference GitHub adapter and therefore fails closed before mutation.

## Explicit execution event

Real execution requires a `CHSPExternalExecutionRequest` with typed confirmation:

`EXECUTE_CHSP_V1_EXACT_EXTERNAL_TRANSITION_ONLY`

The request binds the exact v0.9 authorization, v0.9 active assessment, v0.8 envelope, operator identity evidence digest, nonce, and time.

The runtime entrypoint additionally requires an explicit `--commit` flag and the exact authorization SHA-256. The GitHub credential is read from `CHSP_GITHUB_TOKEN` only at runtime and MUST NOT be supplied as a CLI argument or written to any CHSP artifact.

## Preflight and single-mutation rule

Before any provider write, the core validates the entire supplied predecessor chain and asks the adapter for a fresh observation. Every operation is preflighted before the first write.

Reference policy:

- active v0.9 assessment age <= 2 minutes;
- execution request age <= 2 minutes;
- maximum execution duration 120 seconds;
- maximum provider-mutating operations = 1;
- maximum executable role = `maintainer`.

A preflight drift from the v0.9 recheck state is fail-closed and no mutation is attempted.

## Receipt states

The executor emits one immutable `CHSPExternalExecutionReceipt` with one of:

- `verified_success` — exact bounded mutation occurred and the intended effect was re-observed;
- `no_change_verified` — target already satisfied the exact bounded operations;
- `failed_before_mutation` — no provider mutation was attempted;
- `failed_after_mutation` — a provider mutation was attempted but completion was not verified;
- `verification_uncertain` — provider state after the mutation could not be established confidently.

A positive receipt never claims ownership, global provider truth, canonical publication, or KONTUR activation.

## Post-execution assessment

`CHSPExternalExecutionAssessment` can reach `execution_verified_changed` or `execution_verified_no_change`. That only allows the verified external effect to be recorded by a later protocol layer.

The executor does not create a new canonical origin and does not transfer legal or account ownership.

## Credential boundary

Credentials are runtime-only capability material. They are not authority evidence and must never appear in requests, receipts, logs, tests, fixtures, or provenance artifacts.

CI uses a fake adapter only. The real GitHub adapter is compiled and statically checked but never invoked by CI.