# PoAI Genesis test vectors

This directory contains small machine fixtures for the PoAI Genesis machine layer.

## Expected-valid

`valid/minimal-t.json` MUST pass both:

- JSON Schema structural validation;
- Genesis semantic validation.

## Expected-invalid

Every file under `invalid/` MUST be rejected for the reason encoded in its filename:

- `dangling-resource.json` — Availability Claim points to a missing Intelligence Resource;
- `knowledge-cutoff-after-close.json` — knowledge cutoff occurs after the known decision close;
- `scalar-intelligence-score.json` — attempts to collapse PoAI into a protocol-defined scalar intelligence score;
- `missing-intervention.json` — declares `not_realized_after_intervention` without identifying an intervention.

Some negative vectors are deliberately **schema-valid but semantically invalid**.

This distinction is intentional. JSON Schema can validate local structure and vocabularies, but cross-reference integrity, time ordering and protocol invariants require a semantic validation layer.

## Run

From the repository root:

```bash
python proposals/poai/tools/validate_poai.py \
  --test-vectors proposals/poai/test-vectors
```

With JSON Schema validation enabled:

```bash
python -m pip install "jsonschema>=4.22,<5"

python proposals/poai/tools/validate_poai.py \
  --schema proposals/poai/schema/poai-record.schema.json \
  --test-vectors proposals/poai/test-vectors
```

A future PoAI release should turn these fixtures into stable interoperability vectors before claiming a normative machine-readable specification.
