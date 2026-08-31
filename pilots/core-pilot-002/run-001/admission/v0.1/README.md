# Core Pilot 002 — Run 001 Exact-Source Admission v0.1

This additive successor records the repository-owner selection of the exact public #422 submission already preserved by `external-input-observation/v0.1`.

## State transition

```text
historical run-admission v0.1 = waiting_for_external_input at its observation frontier
external-input observation v0.1 = source observed, admission not decided
Run 001 admission v0.1 = exact observed source selected/admitted for bounded pilot analysis
```

The historical waiting gate is not rewritten. Later evidence changes the current state without making the earlier observation dishonest.

## Exact source

- GitHub comment `5471862585` on #422;
- source account label `84dnnvbdvp-debug`;
- body SHA-256 `23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8`;
- accepted observation blob `3efeaeffbc39a98d2471973f0af483960dd63739` at merge `1c134694cc4fcbe852afa68353932c13b6104ee3`.

## Selection record

The repository-owner selection is durably recorded on #718 as comment `5474174497`. GitHub reports the account label `Matawaka`, `author_association=OWNER`, and mediation through `chatgpt-codex-connector`.

That repository record establishes the selected project input under repository governance. It does **not** establish the legal/natural-person identity of the decision actor. The same rule applies to the reviewer source account.

```text
repository owner account != verified human identity
source selected != reviewer identity verified
source admitted != claim accepted as truth
admission != disposition
pilot disposition != normative change
```

## What admission permits

The exact source may now be materialized into Core Pilot 002 Run 001 for the pilot's existing `analyze_and_recommend_only` scope. The eventual review case must preserve the original source binding, keep identity/independence/authority/standing separate, preserve the objection, and keep `accepted_as_truth=false`.

## What admission does not permit

No contact or mutation of the review source, no normative Core/SPEC/schema change, no responsibility/liability assignment, no release/tag/publication, no ActionPermit, and no Workbench reactivation.

If analysis recommends a normative responsibility-model change, that recommendation must stop at a separate human decision gate.
