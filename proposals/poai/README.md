# Proof of Available Intelligence (PoAI)

**Genesis Proposal v0.0 · Machine Layer draft v0.0.1**  
**Status:** experimental research proposal; **not** part of UU-AAP v0.1 conformance.

> **What relevant intelligence was actually available to this decision before it became history?**

PoAI is an experimental protocol model for describing the human, machine, institutional and documentary intelligence that was practically available to a specific decision at a specific time.

It is intentionally adjacent to UU-AAP:

- **UU-AAP** describes governance of meaning in AI-augmented intellectual works.
- **PoAI** describes the information/capability horizon of a decision itself.

PoAI keeps four distinctions explicit:

`availability != use != authority != responsibility`

and:

`proof != truth`

## 60-second path

If you only want to understand the proposal:

1. Read [`PRINCIPLES.md`](PRINCIPLES.md).
2. Read the short conceptual model in [`CONCEPT.md`](CONCEPT.md).
3. Open the first real-work reconstruction: [`examples/vibe-coding-reality.poai.json`](examples/vibe-coding-reality.poai.json).
4. Open the synthetic future-event pair:
   - [`examples/quasi-existent-future.synthetic.poai.json`](examples/quasi-existent-future.synthetic.poai.json)
   - [`examples/quasi-existent-future.synthetic.successor.poai.json`](examples/quasi-existent-future.synthetic.successor.poai.json)

For implementation, continue with [`DATA_MODEL.md`](DATA_MODEL.md) and the machine-readable schema.

## Machine layer v0.0.1

The first executable layer contains:

- [`schema/poai-record.schema.json`](schema/poai-record.schema.json) — JSON Schema Draft 2020-12 structural validation;
- [`tools/validate_poai.py`](tools/validate_poai.py) — semantic validator for cross-references and core PoAI invariants;
- [`test-vectors/`](test-vectors/) — expected-valid and expected-invalid records;
- two example families covering authorship governance and a Future Target with a successor outcome.

The schema revision is **0.0.1**. The conceptual protocol remains **Genesis v0.0** while the machine model is being tested.

## Quick Start

From the repository root:

```bash
python proposals/poai/tools/validate_poai.py \
  proposals/poai/examples/vibe-coding-reality.poai.json
```

The validator has no required third-party dependency for semantic validation.

For full JSON Schema validation as well:

```bash
python -m pip install "jsonschema>=4.22,<5"
python proposals/poai/tools/validate_poai.py \
  --schema proposals/poai/schema/poai-record.schema.json \
  proposals/poai/examples/vibe-coding-reality.poai.json
```

Run the machine test vectors:

```bash
python proposals/poai/tools/validate_poai.py \
  --test-vectors proposals/poai/test-vectors
```

## What the validator checks

The Genesis validator checks, among other things:

- `protocol == "PoAI"`;
- resource and actor references resolve;
- evidence references resolve;
- `knowledge_cutoff` does not silently occur after a known decision close;
- a `not_realized_after_intervention` outcome includes an intervention;
- availability remains separate from consideration;
- authority is explicit;
- protocol-defined scalar `intelligence_score` or `trust_score` fields are rejected;
- profile-T records contain traceability objects.

These are early interoperability invariants, not a claim of final PoAI standardization.

## Examples

### 1. «Вайбкодинг реальности»

The first PoAI/T example is a conservative historical reconstruction linked to the existing UU-AAP/T pilot.

It intentionally leaves unavailable historical facts unknown rather than reconstructing them from plausibility.

### 2. Quasi-Existent Future — synthetic shipment case

The second example is intentionally synthetic.

It demonstrates:

1. a future shipment failure becoming actionable before it becomes factual;
2. a forecasting resource becoming available to a decision;
3. human authority to intervene;
4. an intervention performed before the observation window;
5. a successor record where the predicted failure does **not** occur after intervention.

The successor therefore records:

`not_realized_after_intervention`

rather than rewriting the original forecast as simply false.

## Conformance profiles — experimental

- **PoAI/D — Declared**
- **PoAI/T — Traceable**
- **PoAI/V — Verifiable**
- **PoAI/R — Reviewed**

Profiles describe evidence strength. They do not rank intelligence, truth, morality or legal responsibility.

## Public review

PoAI Genesis is deliberately contestable.

Useful challenges include:

- an availability dimension that cannot be implemented;
- a case where nominal access is mistaken for practical availability;
- a privacy or coercion failure;
- a misleading future-event outcome;
- a dangling or ambiguous authority relation;
- a case the schema cannot represent without inventing certainty.

Use the repository Issues for concrete defects and the existing public Discussion for broader design alternatives.

## Language

This file is the implementation-oriented English landing page.

A concise Russian guide is available in [`README.ru.md`](README.ru.md).

## Current boundary

PoAI remains a research proposal inside `uu-aap`.

It SHOULD become a standalone repository only after:

1. the data model survives multiple non-authorship pilots;
2. the schema and semantic validator stabilize;
3. interoperability mappings are tested;
4. public review demonstrates that the abstraction is useful beyond UU-AAP.
