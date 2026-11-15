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
