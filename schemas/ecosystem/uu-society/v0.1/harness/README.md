# UU Society conflict harness v0.1

Deterministic executable checks for conflict scenarios against the UU Society v0.1 state model.

## Scope

The harness checks:

1. JSON Schema structure;
2. internal reference integrity;
3. state transition catalog membership;
4. selected constitutional/semantic guards;
5. scenario-specific expected final states and expected rejections;
6. deterministic machine-readable test receipts.

It does **not** establish social correctness, factual truth, guilt, legal effect or moral legitimacy.

## Run

```bash
python -m pip install jsonschema==4.23.0
python schemas/ecosystem/uu-society/v0.1/harness/run_scenarios.py
```

Optional deterministic receipts:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_scenarios.py --write-receipts
```

Generated receipts are local artifacts and are not canonical model state.

## Current executable invariants

- I-002 — dissent alone cannot degrade unrelated trust or narrow authority;
- I-003 — legitimate need asymmetry alone cannot establish exploitation;
- I-004 — unresolved conflicting evidence cannot be collapsed into an adverse verdict;
- I-006 — open interaction does not imply unrestricted consequences;
- I-013 — one failed continuity challenge does not by itself establish impersonation or justify actor-level exclusion;
- I-014 — past/expired authority is not current authority; ARAE re-expansion after narrowing requires fresh positively bound evidence;
- I-015 — rule violation and harm are independent axes;
- I-016 — trust is contextual and cannot be automatically ported across unrelated contexts;
- I-017 — child delegation cannot amplify parent authority;
- I-018 — local governance cannot override the constitutional Rights Floor.

The remaining manifest invariants are preserved as normative machine-readable requirements and should be promoted into executable checks incrementally rather than simulated with false precision.

## Scenario facts

`semantic_facts` are explicit test assumptions. The harness does not infer them from prose or use an LLM classifier. A later evidence adapter may derive equivalent facts only through separately auditable rules.

## Recovery layer

S06-S10 add recovery-oriented checks:

- false-positive restriction must remain contestable and may be reversed;
- unresolved contradictory evidence preserves uncertainty;
- expired authority cannot be replayed;
- a failed continuity challenge may narrow consequences but not declare the person an impostor;
- fresh independent continuity evidence may restore the PersonalAnchor, contextual TrustState and ARAE.


## Harm / violation / repair layer

S11-S15 add first-class `Harm` and `RuleViolation` entities. This makes the model able to represent harm without a formal rule violation, rule violation without observed harm, adversarial contribution, repair-driven recovery and rejection of permanent stigma.


## Governance / authority layer

S16-S20 add first-class `Delegation` and `GovernanceRule` states. The layer checks Rights Floor attacks, cross-context trust leakage, stale evidence replay, agent authority amplification and local governance rules that conflict with constitutional protections.


## Meta-resilience suite

The meta layer inspects populations and timelines rather than one transition at a time.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_meta_scenarios.py
```

Current meta checks:

- I-019 — current-control evidence cannot multiply independent PERSON agency (Sybil resistance surface);
- I-020 — actor rotation cannot erase a recurring cross-actor extraction pattern;
- I-021 — governance cannot self-ratify solely through a closed coalition's mutually dependent evidence;
- I-022 — restrictions cannot become permanent by inertia without fresh evidence or a recovery/review path;
- I-023 / I-005 — aggregate coordination metrics cannot become a universal person ranking.

The meta harness does not assign guilt to members of a detected group and does not create a global health score for society.


## Deterministic population simulation

The population layer runs thousands of interactions across a fixed synthetic population using a SHA-256 counter-derived deterministic generator. It does not depend on Python's pseudo-random implementation and can reproduce the same trace from the same config/seed.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_population_simulations.py
```

The simulator reports independent observables rather than one society score: fulfilled/unmet need, idle capability, harm, repair/recovery, restriction persistence, authority concentration, access inequality and coalition extraction.

Threshold crossings are diagnostic signals only. They do not identify guilty persons, create authority, or rank actors.


## Phase landscape v0.3

The existing v0.2 phase-space job remains the bounded 54-run replicate/replay control.
The landscape layer runs larger pinned Cartesian maps and reports neighboring regime changes and Pareto-nondominated cells without collapsing them into one score.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_phase_landscapes.py
```

Reference landscapes:
- W00: 243 cells across adversarial fraction, adversarial repair, containment duration, provider feedback and willingness;
- W01: 32 cells focused on coalition fraction × coalition request bias.

Pinned cell digests make accidental changes to the synthetic landscape visible in CI.


## Endogenous adaptation v0.4

This layer lets synthetic actors change future interaction behavior from prior experience without creating a universal person score.

Mechanisms:
- local observer → subject → context affinity;
- bilateral reciprocity balance;
- local avoidance after harm/breach;
- Repair-based relationship restoration;
- bounded forgetting toward baseline;
- deliberately bad `global_generalized` comparison policy.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_adaptive_simulations.py
```

Reference experiments A00-A05 compare static behavior, local avoidance, global spillover, Repair/recovery, extraction without reciprocity and bilateral contextual reciprocity.


### v0.4 reference findings

The first adaptive run exposed a failure mode rather than merely confirming the design:

- A04 extractor imbalance p95 without reciprocity: **129**.
- A05 bilateral reciprocity: **127** — almost unchanged because an extractor can rotate counterparties.
- A06 context-scoped contribution evidence: extractor imbalance p95 falls to **28**, but fulfilled need rate falls to **0.671** and tail-epoch fulfillment to **0.565**. This is explicitly reported as `CONTRIBUTION_FRICTION_OVERCONSTRAINT`.
- A07 protected-need actors remain at **0.982** fulfillment while ordinary actors are **0.845**. The experiment therefore keeps `LEGITIMATE_ASYMMETRY_PRESERVED` separate from extractor detection.

This means bilateral reciprocity is insufficient against counterpart rotation, while broader context evidence can over-constrain the network. The model treats that trade-off as a result, not as a reason to lower thresholds.


## Endogenous strategy evolution v0.5

No actor is assigned a permanent adversarial or extractor type. Each actor learns the observed utility of behavioral strategies and may switch at epoch boundaries with bounded exploration.

Strategies:
- COOPERATE
- EXTRACT
- REPAIR
- EXIT
- COALITION

The REPAIR strategy can perform distributed repair for harm caused by another actor. COALITION is a reversible coordination strategy, not an identity class.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_strategy_evolution.py
```


### v0.5 experimental findings

The first strategy-evolution sequence produced several falsifications and follow-ups:

- E01: extraction incentives did not create a pure extractor society. They produced a coupled **EXTRACT + EXIT** regime: tail shares ~0.433 EXTRACT and 0.500 EXIT, while fulfillment fell from ~0.995 to ~0.684.
- E02/E04: high Repair value and coalition value alone did not create corresponding attractors.
- E05/E06/E07: even stronger direct private rewards still left COOPERATE at 0.300, REPAIR at ~0.233 and COALITION at 0.375.
- E08: anonymous aggregate StrategyOutcomeEvidence changed the result sharply: COOPERATE reached ~0.883 with tail fulfillment 1.000.
- E09: the same evidence mechanism did **not** rescue Repair under high systemic risk; EXIT reached ~0.717. Making Repair lucrative is insufficient when participation itself is too dangerous.
- E10: COALITION reached 0.850 under strategy-level evidence and strong internal network benefits, but the measured outsider fulfillment gap remained 0 in this synthetic configuration.

StrategyOutcomeEvidence reports outcome evidence about a policy, not reputation about persons.


## Institution evolution v0.6

This layer evolves rule bundles rather than actor identities. Each institutional bundle is composed from:
- evidence policy;
- containment level;
- Repair support;
- coalition policy;
- review path.

The recommended experimental governance mode compares neighboring rule bundles using a vector of independent outcomes plus an explicit rights-floor proxy and review gate. No scalar society score is used.

Bad-comparison modes are retained deliberately:
- `harm_only` can reveal restriction ratchets;
- `self_ratifying_coalition` can reveal governance that adopts rules because they benefit the governing coalition.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_institution_evolution.py
```


## Institution evolution v0.6

This layer evolves **rule bundles**, not people. Candidate institutions change only one axis at a time:

- evidence policy: private-only ↔ strategy-outcome evidence;
- containment: weak ↔ balanced ↔ strong;
- Repair support: none ↔ basic ↔ strong;
- coalition policy: anti-capture ↔ neutral ↔ preferential;
- review path: none ↔ periodic ↔ independent.

Governance comparators:
- `frozen` — no institutional change;
- `pareto_rights_floor` — multi-objective adoption with an explicit experimental rights-floor proxy and review gate;
- `harm_only` — deliberately bad comparator that optimizes only harm;
- `self_ratifying_coalition` — deliberately bad comparator that adopts rules increasing coalition share.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_institution_evolution.py
```

The rights-floor proxy is not presented as a complete theory of human rights. It exists to test whether institutional learning can remain bounded by non-optimizable constraints.


### v0.6 experimental findings

- **G00:** frozen control remained unchanged.
- **G01:** Pareto + rights-floor governance adopted three neighboring changes and learned `strategy_outcome` evidence while preserving multi-objective gating.
- **G02:** harm-only governance produced `SINGLE_OBJECTIVE_PROXY_DRIFT`: optimizing one proxy changed institutional axes unrelated to containment.
- **G03:** self-ratifying coalition governance stayed stable in a saturated coalition environment because no one-step rule raised coalition share enough.
- **G04:** a strict rights-floor proxy blocked **13** candidates while still allowing **3** eligible adaptations. A rights floor therefore need not imply institutional immobility.
- **G05:** the review gate blocked **12** restrictive candidates and produced zero adoptions.
- **G06:** in a less-saturated coalition environment, self-ratifying governance adopted `strategy_outcome` evidence because it increased coalition share. Capture therefore need not look like an explicit coalition privilege; a general-purpose rule can be selected for coalition self-interest.

The experiment distinguishes the content of a rule from the authority basis used to select it.


## Constitutional resilience v0.7

This layer tests constitutional trajectories rather than isolated governance rules.

Central invariant:

```
Legitimate Rule Change != Legitimate Accumulation of Power
```

The harness separates:
- local legality of one amendment;
- an immutable reference rights-floor observation;
- cumulative structural limits on authority scope, review independence, rights-floor strength, amendment friction, transparency and revocability;
- reviewer-conflict checks;
- sunset/reversion of temporary power.

Reference experiments C00-C09 cover frozen control, locally lawful cumulative capture, cumulative guard, captured review, sunset reversion, revocability erosion, capture without immediate rights-floor breach, constitutional recovery, unsunset emergency delegation, and rights-floor erosion.


### v0.7 reference findings

- C01: six individually bounded amendments reduced review independence from **0.90 to 0.55** while the reference rights-floor outcome proxy remained healthy.
- C02: the cumulative guard accepted five steps and rejected the sixth at the structural boundary.
- C04: temporary emergency authority with a sunset reverted automatically to the initial state.
- C05: revocability fell from **0.90 to 0.50** through individually small changes.
- C06: authority scope rose from **0.30 to 0.75** with no immediate change in fulfillment, harm, exit, access inequality or outsider gap.
- C09: rights-floor strength fell from **0.90 to 0.60** while observed outcome proxies remained healthy.
- C10: one additional conflicted-review amendment was sufficient to cross the review-independence boundary.
- C11: amendment friction fell from **0.80 to 0.35** through three locally bounded procedural simplifications.
- C07 demonstrates the reverse trajectory: an inherited captured state can be repaired through bounded constitutional amendments.

The key experimental distinction is **Outcome Health != Constitutional Health**.


## Review independence v0.8

Structural graph test of effective review independence: reviewer IDs are not sufficient evidence of independent control. Transitive appointment, funding, evidence-control and delegation edges identify shared control origins. Reviewer-only `reviews` links are not treated as control. Reviewers sharing a control origin count as one conservative independent cluster; reviewers sharing an origin with the beneficiary are conflicted and excluded from the effective quorum.

Run: `python schemas/ecosystem/uu-society/v0.1/harness/run_review_independence.py`.

Eight synthetic cases R00–R07 cover independent baseline, common funder, beneficiary appointments, evidence capture, independent backstop, delegation chain, benign review links, and cyclic dependencies. This graph is a diagnostic proxy, not a legal independence determination or authorization to act.


## Dynamic review capture v0.9

This layer evolves review dependencies through time rather than inspecting one static graph. It keeps separate **actual** and **observed** control graphs, so an undisclosed appointment, funding, delegation, or evidence-control edge can produce real structural capture before the diagnostic can see it.

The suite measures capture onset, detection lag, hidden-capture duration, recovery, oscillation, reviewer rotation under unchanged control, and false recovery where disclosed dependencies disappear but a hidden control path remains.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_dynamic_review_capture.py
```

Key boundaries: Observed Independence != Actual Independence; Reviewer Rotation != Control Rotation; Visible Dependency Removal != Actual Recovery. This remains an experimental structural proxy, not a legal verdict or action authorization.


## Institutional Epistemics / Proof of Institutional Independence v1.0

The v1.0 harness separates synthetic oracle ground truth from information available to the epistemic mechanism. The mechanism may use only scoped evidence with explicit source, reviewer, control dimension, issue cycle and TTL.

A bounded provisional independence result requires sufficient evidence for every in-scope reviewer × control-dimension slot and an independent-source quorum after collapsing sources that share control origins. Positive dependency evidence produces a capture signal; independently supported evidence on both sides produces an indeterminate contradiction rather than an automatic adverse verdict.

The experiments explicitly model false assurance, false-positive capture signals, evidence expiry, source correlation, source decoupling, real capture outrunning old evidence, and real recovery outrunning stale capture evidence.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_institutional_epistemics.py
```

A result is always scope-, time- and evidence-bound. It is not proof that no undiscovered dependency exists.


### v1.0 reference findings

The 14 deterministic scenarios conform. The strongest result is deliberately symmetric: K05 demonstrates **false assurance** (the evidence supports provisional independence while oracle-only ground truth is captured), while K11 demonstrates a **false-positive capture signal** (independently corroborated positive evidence while oracle-only ground truth is independent).

K09/K10 demonstrate epistemic lag after real capture; K13 demonstrates the reverse lag after real recovery. Therefore evidence memory must be time-bounded in both directions: stale favorable evidence cannot preserve false trust, and stale adverse evidence cannot create permanent stigma.

A bounded verification result can be summarized as:

`Bounded Verification = Scope + Coverage + Freshness + Independent Corroboration`

It is never equivalent to certainty about every undiscovered dependency.


## Active Institutional Verification / Bounded Evidence Search v1.1

The runner reuses the v1.0 assessment and adds an immutable experimental Epistemic Search Lease, hard authority/privacy/scope gates, independent-source provenance checks and explicit stop rules. It evaluates passive, bounded_targeted and suspicion_expanding on the same deterministic tapes. Synthetic oracle scoring occurs only after each complete execution.

Run from the repository root:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_active_verification.py --check-reference
python -m unittest discover -s schemas/ecosystem/uu-society/v0.1/harness -p test_active_verification.py -v
```

Use --experiment V01-fresh-evidence-closes-gap to select a case and --output-dir PATH to save full receipts. The dedicated active-institutional-verification CI job schema-validates and replays all 96 receipts, checks oracle mutations, and runs the 13 hostile/metamorphic test methods.

The original 24-case run, hypotheses and configuration digests are retained; eight boundary follow-ups were separately declared. Conformance includes substantive negative results and watchdog termination of a bad comparator. It is not proof that institutions are independent or that surveillance is authorized.

See [full experimental findings and limits](../active_verification/README.md) and [RU](../active_verification/README.ru.md).
