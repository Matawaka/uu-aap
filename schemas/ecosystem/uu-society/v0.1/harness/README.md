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
- I-006 — open interaction does not imply unrestricted consequences;
- I-014 — past/expired authority is not current authority.

The remaining manifest invariants are preserved as normative machine-readable requirements and should be promoted into executable checks incrementally rather than simulated with false precision.

## Scenario facts

`semantic_facts` are explicit test assumptions. The harness does not infer them from prose or use an LLM classifier. A later evidence adapter may derive equivalent facts only through separately auditable rules.
