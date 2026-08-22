# PoAI Genesis Machine Layer v0.0.1

**Status:** experimental implementation layer for the PoAI Genesis v0.0 concept.  
**Relationship to UU-AAP:** research-only; no change to UU-AAP v0.1 conformance.

## Purpose

The machine layer turns the Genesis concepts into something an independent implementer can inspect and test.

It deliberately separates:

1. **structural validation** — JSON Schema Draft 2020-12;
2. **semantic validation** — cross-reference integrity, temporal ordering and PoAI-specific invariants.

A JSON document can therefore have a valid shape while still making a semantically impossible PoAI claim.

## Components

- [`schema/poai-record.schema.json`](schema/poai-record.schema.json)
- [`tools/validate_poai.py`](tools/validate_poai.py)
- [`test-vectors/`](test-vectors/)
- [`examples/vibe-coding-reality.poai.json`](examples/vibe-coding-reality.poai.json)
- [`examples/quasi-existent-future.synthetic.poai.json`](examples/quasi-existent-future.synthetic.poai.json)
- [`examples/quasi-existent-future.synthetic.successor.poai.json`](examples/quasi-existent-future.synthetic.successor.poai.json)

## Executable invariants

The v0.0.1 validator checks at least:

- `protocol == PoAI`;
- actor/resource/evidence references resolve;
- availability claims point to the current subject;
- known `knowledge_cutoff` does not occur after known `closed_at`;
- `not_realized_after_intervention` identifies an intervention;
- Traceable and stronger profiles contain availability, consideration, evidence and contestability;
- Verifiable/Reviewed records do not remain `not_bound`;
- protocol-defined scalar `intelligence_score` and `trust_score` fields are rejected.

## CI

The workflow `.github/workflows/poai-validation.yml` validates all public PoAI examples and runs positive/negative vectors on pull requests and relevant pushes to `main`.

A successful CI run proves machine consistency with the current draft validator. It does **not** prove the factual truth of claims represented by a PoAI record.

## Known limits

Machine layer v0.0.1 does not yet define:

- canonical JSON serialization for signing;
- PoAI/V signature profile;
- vocabulary URIs;
- deterministic cross-file successor resolution;
- formal causal inference;
- browser-based validation;
- an accreditation/reviewer governance system.
