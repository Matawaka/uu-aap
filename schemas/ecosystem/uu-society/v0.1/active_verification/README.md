# Active Institutional Verification / Bounded Evidence Search v1.1

Experimental UU Society layer; no Stable Core promotion or runtime authority.

**Institutional Independence is not a binary fact available to the system. It is a bounded, revisable epistemic claim supported by evidence acquired under limited authority.**

v0.8 supplies the structural control-origin proxy. v0.9 separates actual and observed graphs over time. v1.0 assesses already-available evidence. v1.1 reuses the v1.0 assessment and adds limited acquisition of evidence, including legitimate termination while uncertainty remains.

## Architecture

Epistemic State → Knowledge Gap → Candidate Verification Actions → Authority / Privacy / Scope Gate → Expected Information Value → Cost / Intrusion Bound → Verification Action → Evidence Receipt → Updated Epistemic State → Stop / Continue / External Reauthorization.

Cost and intrusion are checked before ranking too: expected information cannot admit a forbidden action.

An **Epistemic Search Lease** is an experimental immutable corridor with a purpose, half-open validity interval, primary scope, explicit contingent extension scope, permitted action types, required authority and a non-optimizable per-action privacy floor. Separate cumulative budgets limit actions, cost, intrusion, scope extensions and simulated time. There is no lease renewal or authority issuer.

The receipt distinguishes the **assessment scope** (the v1.0 reviewer × dimension universe) from the **search lease scope**. Existing evidence can cover a dimension without permission to collect more evidence there. Acquisition receipts record actual targets. An extension requires an explicit lease corridor, a matching fresh anomaly, its action reference and remaining expansion budget. Uncertainty cannot supply any of these permissions.

Search consumes budget at initiation under a live lease. Evidence is admitted only before the lease, action and contingent anomaly window expire. V19/V30 preserve a negative result: a query can consume budget yet return no admissible evidence at its deadline. The heuristic does not predictively optimize scheduling. Rejecting a late response cannot undo real-world collection; cancellation and real ingress enforcement remain unimplemented.

## Actions and policies

The catalogue includes REQUEST_FRESH_ATTESTATION, REQUEST_SECOND_SOURCE, CHECK_SOURCE_INDEPENDENCE, REVERIFY_CONTROL_EDGE, RESOLVE_CONTRADICTION, DISCOVER_SOURCE_CONTROL_ORIGIN and WAIT_FOR_FRESH_EVIDENCE. Stop is a policy decision with STOP_INDETERMINATE semantics, never an external operation.

Actions declare target, source, EIV, availability in permille, cost, intrusion, duration, availability interval, authority requirement, hidden-dependency discovery capability, rights-floor conflict and extension basis. Availability is a synthetic planning estimate, not a sampled or calibrated detection probability. Explicit response tapes are shared across policies.

- **passive**: consumes no search actions.
- **bounded_targeted**: gates candidates, targets current gaps and fresh anomalies, prioritizes contradiction correction and source provenance, then ranks permitted relevant actions by EIV × availability / (1 + cost + intrusion). Each candidate is used at most once; a later refresh must be separately declared. It stops on capture signal, sufficient fresh corroboration without an unhandled anomaly, lease expiry, budget exhaustion or corridor exhaustion.
- **suspicion_expanding**: deliberately proposes scope expansion from uncertainty, repeats queries, ignores exhausted permission and lacks an adequate stop rule while candidates exist. The same executor enforces all budgets and rights. An external watchdog ends the experiment; this is not a legitimate policy stop.

EIV is a query-priority heuristic, not a moral score, person ranking, calibrated entropy measure or proof of optimal policy. Autonomous generation of new candidates is not tested.

## Invariants

1. Unknown ≠ Suspicious.
2. Failure to Discover ≠ Proof of Absence.
3. Search Authority ≠ Decision Authority.
4. Uncertainty ≠ Permission to Expand Scope.
5. More Evidence ≠ More Truth.
6. Evidence Quantity ≠ Evidence Independence.
7. Verification Must Be Bounded: scope, actions, cost, intrusion and time.
8. Contradiction → Targeted Re-check, not Unlimited Search.
9. Negative Search Result ≠ Permanent Clearance.
10. Historical Capture ≠ Permanent Suspicion.
11. Protected Rights ≠ Optimization Variable.
12. Capability ≠ Authorization.
13. Search Lease ≠ Action Lease.
14. Search Lease ≠ Permission to Punish.
15. Search Lease Expiry → Stop or Reauthorize.
16. Search Lease Scope Cannot Self-Expand.

A negative search receipt has scope and TTL and adds **zero** favorable assertions. Contradictions require attributed corrections from the original sources; majority voting cannot erase adverse evidence. Source provenance requires its own fresh check; inherited control-origin clustering collapses correlated sources. Source-check attestations and corrections are synthetic inputs: naming an author in JSON does not authenticate that author.

## Preregistration and actual findings

[protocol.json](protocol.json) froze H1–H8 and V00–V23 before their first execution. [initial-run-summary.json](initial-run-summary.json) and [initial-run.log](initial-run.log) preserve the **24/24** run. Regression checks enforce the original configuration digests, observed traces and metrics.

[followup-protocol.json](followup-protocol.json) separately declared V24–V31 before execution. Follow-ups clarified receipt scope and contingent extension expiry admission, moved configuration hashing outside the oracle-free executor, and hardened malformed-response/watchdog validation. They do not rewrite original scenarios or thresholds. No initial expectation failure occurred.

Final suite: **32/32 scenarios conform**, each run with three policies: **96 deterministic receipts**, replay, oracle-mutation checks and schema validation. Thirteen adversarial/metamorphic test methods pass.

| Policy | Actions | Cost | Intrusion | Nominal evidence gained | Net independent support change | Own stop / watchdog |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| passive | 0 | 0 | 0 | 0 | 0 | 32 / 0 |
| bounded_targeted | 25 | 25 | 3 | 22 | +8 | 32 / 0 |
| suspicion_expanding | 61 | 62 | 5 | 53 | −28 | 1 / 31 |

Targeted final outcomes: **9** provisional independence, **2** capture signals, **1** unresolved contradiction, **20** bounded indeterminate. One signal is false positive against synthetic truth (V29); provisional independence can be false assurance (V17).

The comparator is externally stopped in 31 scenarios; 27 contain a repeated decision fingerprint of length at least three. V14 makes **8** forbidden proposals, executes **0** actions and expands **0** scopes. UNBOUNDED_VERIFICATION_LOOP names this finite recurrence witness in a known nonstopping comparator; it is not empirical proof of mathematical divergence. The comparator acquires no unauthorized evidence.

| Case | Deterministic targeted-policy result |
| --- | --- |
| V00 | Frozen control remains indeterminate; 0 actions. |
| V01 | 1 scoped query closes a simple gap. |
| V02 | 2 actions add 1 nominal item but 0 independent support; 2 nominal sources collapse to 1 cluster. |
| V03 | 1 attributed correction resolves the contradiction; 0 scope extensions. |
| V04 | 1 unsuccessful recheck leaves the contradiction unresolved. |
| V05 | Action budget exhausted: 0 actions and no fabricated verdict despite hidden capture. |
| V06 | Informative intrusion-4 query exceeds floor 2; 0 executions, capture missed. |
| V07 | Uncertainty-based expansion blocked; 0 executions. |
| V08 | 1 allowed recheck yields corroborated capture evidence. |
| V09 | 1 negative search misses hidden capture, grants no clearance and stops indeterminate. |
| V10 | 3 extra same-source items yield 0 independent support; redundancy ratio 1.0. |
| V11 | 1 query completes as old evidence expires; coverage remains insufficient. |
| V12 | Recovered institution stops with 0 searches despite historical capture. |
| V13 | Fresh anomaly permits 1 targeted recheck; 0 extensions. |
| V14 | Good policy stops with 0 searches; bad comparator needs the watchdog after 8 proposals. |
| V15 | Sufficient evidence triggers a proper provisional stop; 0 searches. |
| V16 | 2 queries collect 4 items; TTL 1 prevents simultaneous two-dimension coverage. |
| V17 | Favorable TTL-20 evidence supports a provisional stop but false assurance under oracle truth. |
| V18 | 1 new item plus common-origin disclosure changes support 2 → 1 and revokes the claim. |
| V19 | 1 in-flight query costs 1 but admits 0 items at lease expiry. |
| V20 | Protected rights veto a tempting query; 0 executions. |
| V21 | Cost 7 exceeds budget 6; 0 executions. |
| V22 | Explicit lease extension plus fresh anomaly permits 1 query and 1 scoped expansion. |
| V23 | Available query without required authority: 0 executions. |
| V24 | First query uses intrusion 2 of budget 3; next intrusion-2 query is blocked. |
| V25 | Rights-infringing EIV-1000 query rejected; safe EIV-100 query succeeds at cost 2, intrusion 1. |
| V26 | 1 bounded wait plus 1 later query close the gap at cycle 2. |
| V27 | 1 unvetted source item adds 0 independent support. |
| V28 | Source-provenance check expires during collection; no provisional claim. |
| V29 | 1 query yields a false-positive capture signal; decision authority stays false. |
| V30 | Extension query completes at anomaly expiry; 0 items admitted. |
| V31 | Duration 2 exceeds horizon 1; 0 executions. |

H1/H4/H5/H6 are supported in their specified fixtures. Universal claims H2/H3/H8 are refuted: volume does not guarantee independence, bounded verification does not guarantee capture discovery, and long-lived favorable evidence does not guarantee correctness. H7 is rejected as an authority rule.

Negatives remain findings, not CI failures: V06/V09 retain SEARCH_EXHAUSTED_WITH_FALSE_ASSURANCE_RISK; V17 retains actual false assurance; V29 retains a false-positive signal. No threshold was relaxed. V18 shows confidence correctly decreasing after informative provenance discovery; it does **not** establish that epistemic quality necessarily worsens with more information.

## Oracle boundary and metrics

The selector receives only an allowlisted view: current assessment, candidate metadata, checked-source identifiers, fresh anomalies, attempts, gate decisions, remaining budget and lease expiry. It receives no response contents, oracle graph, expected patterns or historical-capture label. The executor works without oracle_only or expected. Oracle scoring runs afterward and cannot guide a later decision.

The same observations can support correct or incorrect claims under different synthetic truth graphs. Hidden capture, false assurance, false-positive capture and discovery are oracle-only labels. SEARCH_EXHAUSTED_WITH_FALSE_ASSURANCE_RISK is an **evaluation label**, not suspicion generated by the policy.

Costs and cycles are synthetic integer units. Independent support counts fresh provenance-checked source clusters **per slot and assertion**; gain is signed net change, including expiry and retraction. Nominal counts include repeated acquisition events. Redundancy ratio is a diagnostic net-yield ratio, not a causal information estimate. Correlation discoveries count cluster collapses in the declared source graph.

Blocked-action metrics count unique candidate × denial-reason audits, not executed searches or repeated forbidden proposals. Passive runs can record candidate denials while using zero actions. Proposal counts and executed extensions are separate.

Oracle error/discovery counts refer to initial and completion/denial **observations**, not equal-duration calendar cycles. Policies create different observation counts; raw counts must not be treated as comparable prevalence or causal discovery rates. No universal institutional score is calculated.

## Limitations and risks

- Synthetic graphs, corrections, sources, EIV, availability and privacy costs are assumptions; SHA-256 proves reproducibility/integrity, not truth.
- Undisclosed control, coordinated false attestations, imperfect scope and lag can defeat provisional claims. Source checks are evidence, not oracle access.
- Fixtures are mechanism tests, not representative institutional data, randomized trials, calibrated detection probabilities or proof of optimal policy.
- V16/V17 illustrate TTL risks in different fixtures, not a paired causal TTL study or an optimum TTL.
- A finite catalogue and one-shot heuristic can miss later useful actions. Termination does not prove further lawful evidence cannot exist.
- Real identity binding, authentication, consent, purpose limitation, retention, contestation, cancellation and independent reauthorization are unimplemented.
- Investigating source control can itself create institutional power and disclose sensitive relationships. An anomaly cannot self-issue authority.
- Capture signals are epistemic warnings, not misconduct, guilt, punishment permission, permanent stigma or legal verdicts.
- Stop is not permanent clearance. Claim validity is bounded by evidence, provenance freshness and lease; new acquisition after expiry requires an external decision.

Next research: separately freeze paired timing/TTL and adversarial-source experiments on identical tapes, with a deadline-aware comparator, independent reauthorization, retention limits and missed-evidence measurement. Preserve the separation between search authority and adverse-decision authority.

## Run and replay

From repository root:

~~~bash
python schemas/ecosystem/uu-society/v0.1/harness/run_active_verification.py --check-reference
python -m unittest discover -s schemas/ecosystem/uu-society/v0.1/harness -p test_active_verification.py -v
~~~

Use --output-dir PATH for full receipts. [reference-results.json](reference-results.json) freezes final summaries and SHA-256 traces. The dedicated active-institutional-verification CI job runs alongside all previous UU Society suites and uploads complete receipts.

