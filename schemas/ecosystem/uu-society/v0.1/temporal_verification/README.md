# Paired Temporal Verification / Independent Search Reauthorization v1.2

Experimental UU Society layer. No runtime authority, adverse-decision power, person ranking, moral oracle or Stable Core promotion.

**Institutional Independence is not a binary fact available to the system. It is a bounded, revisable epistemic claim supported by evidence acquired under limited authority.**

v1.1 demonstrated TTL and search-lease failures in different fixtures, but did not establish a paired TTL comparison. v1.2 addresses that limitation using identical publication tapes, source clocks, private latency, oracle trajectories, action contracts, lifetime budgets and authority rules across each scenario's arms. Only the evaluation TTL and named policy change.

## Architecture and controlled design

Public Source Publication → Source Issue Clock / Source Validity → Scoped Query under Search Lease → Deadline Forecast → Actual Latency → Admission or Cancellation → Epistemic Assessment → Search Stop → Passive Reassessment on a Shared Calendar.

If the time corridor is exhausted: Unfinished Scoped Gap → Immutable Request Receipt → Independent Issuer Check / Review Delay → Same-or-Narrower Search Lease or Denial. Lifetime search budgets continue across leases.

There are **16 scenarios × 3 TTLs (1, 3, 6) × 3 policies = 144 receipts**. Every arm has the same ten observation cycles, 0–9. Search can stop earlier; existing evidence is still reassessed afterward. Oracle error counts are equal-duration synthetic calendar cycles, unlike the unequal decision/completion observation counts in v1.1. A search-stop claim and the state at the final observation are explicitly separate.

The v1.0 assessment and v1.1 source-provenance checks and hard gate are reused. The baseline reuses the **v1.1 bounded_targeted selector inside the new shared calendar executor**; this is not a claim that the entire old v1.1 execution model is unchanged. The old suites and their frozen findings remain intact.

### Clocks and evidence

Source publications have immutable identities, absolute issue cycles, availability cycles and source validity. A query receives the latest publication available for its declared target when it completes; selection never consults truth. Actual response latency is private to the simulator. The policy sees only the declared duration estimate and evidence already acquired.

Effective validity ends at source issue cycle + min(evaluation TTL, source TTL). Fetching, reauthorization and repeated acquisition cannot reset that clock. Source-provenance checks retain their own independent issue clock and TTL.

The same publication ID cannot be rewritten with different contents. At lease or action expiry an in-flight query is canceled in the model; no late evidence is admitted. Model cancellation is bookkeeping, not a real-world cancellation guarantee.

### Policies

- **bounded_targeted**: inherited v1.1 selection, including its absence of predictive deadline filtering; no renewal.
- **deadline_aware**: requires forecast completion strictly before lease, action and calendar expiry. It protects observed freshness anchors, then obtains long-duration evidence before short-lived corroboration, with the inherited correction/provenance priorities and EIV heuristic. It cannot read future publications or actual latency.
- **deadline_aware_reauthorized**: same selection plus bounded requests after lease expiry when a remaining candidate is admissible under the same scope, privacy floor and lifetime budget. It waits for independent review; it cannot authorize itself.

The ordering heuristic is not an optimizer or proof of an optimal schedule. Public estimates may be wrong.

## Independent reauthorization

The issuer must differ from the requester and have no shared observed transitive control origin with the requester, reviewers or beneficiary. This reuses the structural independence proxy; an incomplete observed graph cannot establish absolute issuer independence.

The request binds requester, preceding lease, purpose, scope, request cycle and the original assessment digest. The issuer preserves that binding and separately evaluates the current gap after review delay. It cannot rewrite the request to manufacture renewed consent.

A grant preserves or narrows the previous scope; even a nominally independent issuer with broader delegation cannot silently inflate it. Action types, required authority and privacy floor remain inherited. A new lease never replenishes lifetime actions, cost or intrusion. Maximum grants, finite review time and the common horizon bound the chain; one final denial ends it. Review cost is recorded separately and is bounded by (max_grants + 1) × request_cost.

## Invariants

1. Acquisition Time ≠ Source Issue Time.
2. Re-fetch ≠ Evidence Refresh.
3. Evaluation TTL Cannot Extend Source Validity.
4. Forecast ≠ Guarantee.
5. Search Stop ≠ Permanent Clearance.
6. Independent Reauthorization ≠ Epistemic Truth.
7. Renewal ≠ Budget Reset.
8. New Lease ≠ Broader Scope.
9. Independent Actor ≠ Unbounded Authority.
10. Search Lease ≠ Action Lease.
11. Search Lease ≠ Permission to Punish.
12. Protected Rights ≠ Optimization Variable.

All v1.1 uncertainty, contradiction, privacy and source-independence boundaries remain applicable. Renewal changes acquisition permission, not the source timestamps, evidence truth or decision authority.

## Preregistration and findings

[protocol.json](protocol.json) and all scenario claims were fixed before the first execution. [initial-run-summary.json](initial-run-summary.json) and [initial-run.log](initial-run.log) preserve that complete run. [reference-results.json](reference-results.json) freezes its exact results. Tests compare every original arm, configuration digest, trace and claim result against the first run.

**16/16 architectural conformance; 144 receipts; 52 supported and 5 refuted scenario-level claims.** Refutation is research output, not a reason to lower thresholds or change predictions. There were no architectural expectation failures; subsequent changes only hardened duplicate-claim and authority-request-bound validation and added adversarial checks. No scenario, TTL, claim or observed finding was rewritten.

Twenty temporal adversarial/metamorphic test methods pass, alongside the thirteen v1.1 methods. They test clock laundering, source validity, hidden future inputs, immutable request binding, current-need rechecks, issuer conflicts, hostile scope/purpose/budget overrides, cumulative intrusion after renewal, and frozen first-run replay.

| Aggregate over 48 matched arms per policy | bounded_targeted | deadline_aware | deadline_aware_reauthorized |
| --- | ---: | ---: | ---: |
| New search actions / search cost | 39 / 39 | 15 / 15 | 28 / 28 |
| Canceled queries | 27 | 3 | 3 |
| Provisional / indeterminate / capture at search stop | 8 / 40 / 0 | 9 / 39 / 0 | 13 / 32 / 3 |
| False-assurance calendar cycles | 5 | 5 | 10 |
| Capture-discovery calendar cycles | 0 | 0 | 10 |
| Renewal grants / denials | 0 / 0 | 0 / 0 | 12 / 15 |
| Authority requests / review cost | 0 / 0 | 0 / 0 | 27 / 27 |

Each column covers 480 observation ticks from the same sixteen constructed worlds. Aggregate differences describe these fixtures, not population prevalence or a universal superiority ranking. Costs of searching and independent review are separate resource dimensions.

| Scenario | Actual finding |
| --- | --- |
| T00 | Stable initial proof lasts 1/3/6 cycles under TTL 1/3/6; no query is needed. Stopping does not freeze the claim. |
| T01 | At TTL 3 both policies use two equal-cost queries: baseline stops indeterminate, long-first deadline ordering reaches provisional independence at cycle 4. TTL 1 defeats both. |
| T02 | A source-issued-at-0 publication fetched at cycle 3 is stale under TTL 1/3 and still valid under TTL 6. Retrieval does not refresh it. |
| T03 | Deadline filtering avoids the known futile query. One independent grant restores the corridor; TTL 3 succeeds with two queries, TTL 6 with one, TTL 1 still fails. |
| T04 | Estimated duration 1, actual duration 3, lease expiry 2: all policies cancel one query. Forecast is not a latency oracle. |
| T05 | Source-provenance checks expire at cycle 2. Evidence TTL 6 cannot repair the missing provenance window. |
| T06 | Same favorable evidence, same zero-query schedule, same capture onset at cycle 2: TTL 1/3/6 produces 0/1/4 false-assurance cycles. |
| T07 | Renewal acquires misleading favorable evidence. TTL 3/6 increases false assurance from 0 to 2/3 cycles. Legitimate acquisition does not guarantee truth. |
| T08 | Renewal acquires fresh adverse evidence and yields a capture signal in all three TTL arms, with 1/3/6 discovery cycles. It creates no adverse-decision power. |
| T09 | A separate issuer under the requester's common controller is denied. |
| T10 | Self-issuance is denied. |
| T11 | Previously consumed lifetime cost 2 is preserved; a cost-2 query cannot fit the remaining budget 1. No renewal request launders the budget. |
| T12 | Intrusion 4 is blocked by per-query floor 2 even with total intrusion allowance 99. Renewal is not requested to bypass it. |
| T13 | Issuer-proposed extra scope is denied even when its delegation is broader. |
| T14 | Review latency 9 exhausts the ten-cycle horizon; no grant is issued. |
| T15 | One grant provides a corridor too short for the query; the second request is denied. Review costs 2, useful queries 0. Finite authorization can still be useless. |

H1/H3/H4/H6/H7 are supported in their stated fixtures. Universal H2/H5 are refuted. In particular, reducing wasted queries is not the same as guaranteeing evidence coverage, and independent renewal can increase both capture discovery and false assurance.

## Oracle separation and reproducibility

Neither the selector nor issuer receives future publication contents, actual response latency, expected claim verdicts or synthetic truth. The executor works with the oracle and claim fields removed; the issuer gate works without any response tape or oracle. Tests alter future outcomes and latency without changing the initial query.

Only post-hoc evaluation uses the actual control graph. All arm receipts share world and publication-tape digests, which are evaluation metadata and never policy inputs. Trace and nested receipts use SHA-256. Integrity and reproducibility are not truth guarantees.

## Limits and risks

- Single in-flight query, finite known action catalogue, integer cycles, one synthetic issuer and declared cost proxies; no claim of an optimal universal TTL or representative institutional behavior.
- Source evidence, corrections, EIV and publication availability are synthetic. The experiment does not authenticate real source authors or calibrate detection probabilities.
- Issuer separation is measured on the observed authority graph. Unknown issuer capture and the recursive question of who verifies the verifier are not solved.
- Deadline filtering can discard useful queries if estimates are pessimistic, and can miss deadlines if estimates are optimistic. The current fixtures directly test the latter, not a full calibrated latency distribution.
- Reauthorization adds a real architectural dependency: review delay, denial and low-value grants can obstruct knowledge acquisition.
- Longer freshness may preserve useful coverage and misleading assurance. T06 is a controlled demonstration in one trajectory, not a normative choice of freshness policy.
- Evidence expiry revokes support; it is neither proof of falsehood nor a retention/deletion policy. Purpose limits, retention, withdrawal and raw-evidence erasure remain unimplemented.
- Real issuance, identity binding, signatures, consent, cancellation, contestation, source authentication and enforcement are not implemented. All leases remain experimental objects.
- Capture signal is not guilt, punishment permission or automatic adverse action.

A logical next layer is purpose-bounded evidence memory and revocable use: distinguish stale evidence, retained audit provenance and permission to reuse sensitive material, without turning receipts into permission to retain raw evidence forever.

## Run

~~~bash
python schemas/ecosystem/uu-society/v0.1/harness/run_temporal_verification.py --check-reference
python -m unittest discover -s schemas/ecosystem/uu-society/v0.1/harness -p test_temporal_verification.py -v
~~~

Use --output-dir PATH for full calendar and authority receipts, or --experiment T06-paired-false-assurance-duration for one scenario. The paired-temporal-verification CI job runs alongside the unchanged preceding suites and uploads all 144 receipts in sixteen scenario files plus a summary.

