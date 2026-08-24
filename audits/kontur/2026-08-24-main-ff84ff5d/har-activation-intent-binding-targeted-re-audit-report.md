# KONTUR HAR → Activation Intent Binding Targeted Re-Audit

Date: 2026-08-24

Result: **HAR_ACTIVATION_INTENT_BINDING_REAUDIT_PASS**

## 1. Exact audited frontier

This re-audit is bound to canonical `main` after merge of PR #309:

- main SHA: `ff84ff5dc470ebd4f560eca8d1edf5003f4a7afd`
- tree SHA: `8a32f3d53eca552da4a69ae3e76e9faa390b6f67`
- parent SHA: `6ef0e97e4fcaf4d1e248959394a4beac8a3d5089`
- GitHub commit verification: `verified=true`, reason `valid`
- merged PR: #309, `Bind Formal HAR approval into KONTUR activation intent`

The targeted finding is:

`HAR-ACTIVATION-INTENT-BINDING-GAP`

Original bounded statement: `KONTURActivationIntent` could previously be constructed without mechanically binding the preceding approved Formal Human Activation Review decision.

## 2. Merge/tree equivalence

PR #309 tested head:

- head SHA: `dff84d84620cb851a60ee427a7b68af5460804d2`
- head tree SHA: `8a32f3d53eca552da4a69ae3e76e9faa390b6f67`

Merged canonical main:

- merge/squash SHA: `ff84ff5dc470ebd4f560eca8d1edf5003f4a7afd`
- tree SHA: `8a32f3d53eca552da4a69ae3e76e9faa390b6f67`

Therefore the source tree exercised by PR CI is byte-identical to the merged canonical source tree. This audit does **not** assert that a separate push-triggered run against the squash commit SHA was independently inspected.

## 3. Executed CI evidence on the identical source tree

All pull-request-triggered workflows returned `success` for PR #309 head `dff84d84620cb851a60ee427a7b68af5460804d2`:

- `32703779763` — KONTUR Activation Preflight validation
- `32703779669` — KONTUR Activation Executor validation
- `32703779725` — KONTUR Responsibility Kernel validation
- `32703779656` — KONTUR Durable Responsibility Ledger validation
- `32703779757` — KONTUR Readiness Aggregator validation
- `32703779655` — PoAI Authority Root validation
- `32703779723` — PoAI Genesis validation
- `32703779671` — CCRP validation
- `32703779713` — PoAI CCRP pre-materialization validation

The two directly critical workflows both completed successfully:

- Activation Preflight reproduced readiness, built the HAR-bound intent/preflight artifacts, validated schemas, rejected overclaims and confirmed no responsibility state or repository mutation.
- Activation Executor completed its isolated test-only execution path and confirmed CI did not activate repository/server KONTUR state.

## 4. Preservation of the pre-existing preflight machine

`server/kontur/v0.1/activation-preflight-core.js` on the audited successor has Git blob SHA:

`966775b9d3b114e6210420bcdfbc61023178dd38`

This is the same blob SHA as the predecessor `activation-preflight.js` before PR #309. The existing readiness/frontier/policy/health/holder/scope/lease/preflight semantics were therefore preserved byte-for-byte as the internal core rather than rewritten.

The public `activation-preflight.js` now acts as a fail-closed HAR provenance wrapper around that preserved core.

## 5. Activation-intent schema closure

`KONTURActivationIntent v0.1` now structurally requires:

- `human_activation_review_decision_binding`
- `human_activation_review_evidence`
- `claims.human_activation_review_approval_bound = true`

The decision binding is constrained to artifact type `KONTURHumanActivationReviewDecision` and RFC8785-JCS / SHA-256 digest shape.

The schema continues to require all activation/authority/legal overclaim fields to remain false at intent construction.

## 6. HAR packet revalidation before intent construction

The public wrapper rejects unless the supplied HAR packet satisfies the bounded v0.1 contract, including:

- exact artifact type/version and contract keys;
- project `Matawaka/uu-aap`;
- exact current Git revision;
- exact 24-hour packet TTL;
- bounded readiness-checkpoint and current-main verification binding shapes;
- all eight required human-confirmation names in canonical order;
- `review_state = ready_for_human_activation_review`;
- `safe_next_step = human_review_decision_only`;
- exact packet claim boundary;
- deterministic packet ID recomputation.

No packet state is converted into intent or activation automatically.

## 7. HAR decision revalidation before intent construction

The wrapper rejects unless the HAR decision satisfies all of the following:

- exact `KONTURHumanActivationReviewDecision v0.1` shape;
- `decision = approve_intent_preparation`;
- `safe_effect = activation_intent_preparation_may_be_requested`;
- all eight required confirmations are explicitly true;
- exact typed declaration `APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY`;
- explicit one-shot HAR nonce shape;
- decision/review observation ordering remains inside packet validity;
- complete prior-decision-history assertion and replay-guard assertions are present;
- exact RFC8785-JCS / SHA-256 decision → packet binding;
- deterministic typed decision identity seed recomputes the exact `decision_id`.

A defer/reject or malformed/tampered decision does not satisfy this boundary.

## 8. Decision → Activation Intent mechanical binding

After HAR approval validation, intent construction:

1. constructs the pre-existing activation intent through the preserved core;
2. computes an exact `KONTURHumanActivationReviewDecision` binding over the approved decision;
3. embeds the exact review packet and decision as bounded HAR evidence;
4. sets `human_activation_review_approval_bound = true`;
5. recomputes the activation-intent deterministic identity with the HAR decision digest included in the identity seed.

Consequently, changing the HAR decision changes the activation-intent identity and a stale/tampered decision binding cannot be substituted while preserving the original intent ID.

## 9. Cross-process revalidation

`validateActivationIntent()` treats the embedded packet and decision as the self-contained HAR provenance source and revalidates them before invoking the preserved core validator.

If external HAR artifacts are also supplied, their canonical digests must exactly match the embedded copies.

`preflightActivation()` and `validateActivationPreflightReceipt()` both call the HAR-bound `validateActivationIntent()` before delegating to the preserved core. Downstream callers, including the Executor path, therefore can revalidate the HAR chain without relying on process-local memory.

The regression suite explicitly exercises validation using only the HAR evidence embedded in the activation intent.

## 10. Permanent negative vectors

The merged regression boundary rejects at least:

- missing HAR packet;
- missing HAR decision;
- defer substituted for approval;
- decision-ID tampering;
- packet substitution;
- HAR revision drift;
- intent HAR-decision binding substitution;
- missing embedded HAR evidence;
- embedded packet tampering;
- embedded decision tampering;
- external-vs-embedded packet substitution;
- external-vs-embedded decision substitution;
- HAR-bound activation-intent ID tampering;
- prior preflight revision/frontier/readiness/policy/health/holder/scope/lease failures and prohibited overclaims.

## 11. Finding disposition

Targeted finding:

`HAR-ACTIVATION-INTENT-BINDING-GAP`

Disposition: **closed_verified**.

Reason: a positive Formal HAR decision is now a mandatory, exact, digest-bound and identity-bound predecessor of any valid `KONTURActivationIntent`; the binding is revalidated again at preflight/downstream validation boundaries.

No Medium-or-higher issue was observed in the specifically targeted mechanical handoff surface during this bounded re-audit.

## 12. Important limits that remain outside this finding

This PASS is intentionally narrow. It does not claim that the human reviewer identity is cryptographically authenticated. `reviewer_ref` remains declared identity evidence.

It also does not claim that merely possessing a structurally valid HAR packet/decision establishes legal authority, truth, execution authority or responsibility. The HAR artifacts remain bounded protocol evidence.

Operational readiness freshness, health freshness, activation-intent age, holder/scopes, fencing epoch, lease validity, separate preflight and final execute-command gates remain mandatory later boundaries.

The activation layer validates the bounded HAR packet and its predecessor binding commitments; it does not independently rehydrate every predecessor artifact from an external evidence store during this handoff. This is not treated as closure of provenance-authentication or long-term evidence-availability concerns.

## 13. Non-effects

This re-audit and its evidence record do not:

- create a fresh Formal HAR decision;
- reuse either historical HAR decision for the successor revision;
- create a live activation intent;
- run live preflight;
- create an execute command;
- invoke the live Activation Executor;
- call Responsibility Kernel for live activation;
- create or accept live responsibility state;
- grant execution authority;
- expand or bypass permissions;
- transfer repository ownership;
- mutate canonical origin;
- activate KONTUR;
- determine legal liability or certify truth.

## 14. Successor rule

The prior human decisions were bound to the predecessor revision and are not transferable to `git:ff84ff5dc470ebd4f560eca8d1edf5003f4a7afd`.

After this re-audit evidence itself is merged and canonicalized, the next admissible step is to generate a **fresh Human Activation Review packet for the exact successor revision**. Its human outcome remains unknown until the human explicitly chooses it.

Final bounded conclusion:

**HAR_ACTIVATION_INTENT_BINDING_REAUDIT_PASS**
