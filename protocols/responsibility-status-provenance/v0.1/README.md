# Responsibility Status Provenance Binding v0.1 — Stage B

Status: additive successor contract selected by the human B + C decision recorded on #852.

Origin frontier: `dbdace4548fb6701675a993276da6854c4324bda`.

Evidence predecessor: `pilots/core-pilot-002/run-001/result/v0.1/result.json`.

## Purpose

UU-AAP v0.1 responsibility entries remain historical declarations with the exact existing shape:

`actor_id + scope + status (+ limitations)`.

Stage B does **not** edit that schema. It adds an optional sidecar that can bind provenance for one exact responsibility entry in one exact manifest.

The sidecar is deliberately separate because a historical declaration and later evidence about that declaration are different events.

## Exact target rule

A sidecar binds:

1. target manifest path;
2. SHA-256 of the exact target manifest bytes;
3. responsibility array index;
4. an exact copy of the responsibility entry at that index.

The validator requires the copied responsibility object to equal the target manifest object exactly. Index alone is insufficient, and copied semantics alone are insufficient.

This avoids silently manufacturing a stable responsibility item identifier that UU-AAP v0.1 never defined.

## Binding states

### `DECLARATION_ONLY`

The manifest status is preserved as a declaration. No attributable acceptance event or acceptance evidence is claimed.

A declarant/source reference may be absent. Missing stronger evidence is not failure, rejection, sanction, or a negative score.

### `ATTRIBUTABLE_ACCEPTANCE_EVIDENCE_BOUND`

The exact responsibility entry is additionally bound to:

- a non-empty attributable acceptance-event reference;
- one or more non-empty acceptance evidence references;
- an optional declarant/source reference.

For v0.1 this stronger state is permitted only when the responsibility status is `accepted` or `shared`.

The references establish only that the sidecar binds an attributable event/evidence reference to the exact entry. They do not establish verified natural-person identity, authority, factual truth, legal responsibility, liability, or publication/action rights.

## Core distinctions

`declarant != responsible actor`

`reference/account != verified identity`

`acceptance evidence != authority proof`

`attributable acceptance != factual truth`

`responsibility status != legal liability`

`missing stronger evidence != rejection or sanction`

## Compatibility

- `schema/uu-aap-manifest.schema.json` remains byte-identical to the accepted v0.1 schema.
- Existing manifests require no migration to remain valid declarations.
- Stage B sidecars are optional and separately versioned.
- A sidecar never overwrites or upgrades the historical responsibility status.
- If the target manifest bytes, target index, or copied entry drift, validation fails closed.

## Relationship to Stage C

Stage B only creates reusable machine-native binding capability. It does not define a stronger conformance/assurance profile.

Stage C may consume only a valid Stage B `ATTRIBUTABLE_ACCEPTANCE_EVIDENCE_BOUND` entry when making a stronger claim that attributable acceptance evidence is present. Stage C must not create a parallel identity or authority mechanism.

## Files

- `binding.schema.json` — closed Stage B sidecar schema.
- `declaration-only.fixture.json` — valid declaration-only binding.
- `attributable.fixture.json` — valid attributable-evidence binding.
- `implementation-receipt.json` — source/design/non-effect binding for this implementation layer.
- `validate.py` — deterministic semantic and hostile-mutation validator.

## Non-effects

No Stable Core change. No SPEC or RESPONSIBILITY policy rewrite. No base manifest-schema change. No verified identity. No authority proof. No truth proof. No legal-liability assignment. No release/tag/publication authority. No ActionPermit. No Stage C assurance claim.