# Architecture Convergence / Readiness Manifest v0.1

**Status:** project-level integration review contract  
**Canonical predecessor:** `724ebff7667354f619d0545539c9d513dc58521c`  
**Purpose:** bind the major control planes into one read-only, version-scoped architecture map without granting execution authority or activating KONTUR.

## Core invariant

`plane present != plane current != system executable`

`cross-plane convergence != KONTUR activation readiness`

`historical activation frontier != current activation frontier`

`integration review eligible != execution authorized`

## Required planes

The reference manifest requires exactly these six project planes:

1. `coordination` — CCRP / protocol coordination;
2. `authority-governance` — governance, authority and canonical anchors;
3. `survival-rescue` — continuity / rescue / noncanonical recovery boundaries;
4. `human-succession` — CHSP stewardship / succession boundaries;
5. `sustainability` — Sustainability Kernel v0.1 closure;
6. `kontur` — server-level readiness / responsibility / activation boundary.

Each plane is bound to repository paths that must exist at the declared Git revision.

## Reference bindings

- coordination:
  - `protocols/ccrp`
  - `.github/workflows/ccrp-validation.yml`
- authority-governance:
  - `GOVERNANCE.md`
  - `FILE_HASHES.md`
- survival-rescue:
  - `protection/rescue/v0.6/README.md`
  - `protection/rescue/v0.6/test_canonical_recognition.py`
- human-succession:
  - `protocols/chsp/v1.1/README.md`
  - `protocols/chsp/v1.1/test_chsp_v11.py`
- sustainability:
  - `docs/SUSTAINABILITY-KERNEL-CONFORMANCE-v0.1.md`
  - `schemas/sustainability/v0.1/tests/test_kernel_conformance_closure_v01.py`
- kontur:
  - `server/kontur/v0.1/READINESS_AGGREGATOR.md`
  - `server/kontur/v0.1/ACTIVATION_BOUNDARY.md`
  - `server/kontur/v0.1/RESPONSIBILITY_LEDGER.md`

## Cross-plane result

The strongest positive result is:

`cross-plane-integration-review-eligible`

It may establish only that:

- all six declared planes are present at the exact repository frontier;
- the architecture has explicit separation between coordination, authority, continuity, succession, sustainability and KONTUR;
- no declared plane is allowed to self-promote another plane's evidence into execution authority;
- an integration review may proceed from the exact current frontier.

It MUST keep false:

- `external_execution_authorized`;
- `kontur_activation_authorized`;
- `kontur_activated`;
- `current_kontur_activation_frontier_verified`;
- `repository_ownership_transferred`;
- `canonical_origin_mutated`;
- `legal_authority_established`;
- `distributed_consensus_established`;
- `universal_architecture_completeness_proven`.

## Stale activation-frontier rule

KONTUR readiness and activation artifacts are revision-bound.

A historical successful KONTUR readiness or activation-frontier artifact MUST NOT be reused as current evidence after the repository frontier changes unless the KONTUR protocol explicitly re-verifies and re-binds the exact current revision.

`historical frontier ready + newer main != current frontier ready`

Therefore this manifest intentionally records:

`current_kontur_activation_frontier_verified = false`

until a separate, fresh KONTUR readiness/activation-frontier ceremony is completed on the exact then-current canonical `main`.

This manifest does not perform that ceremony.

## Interaction with CHSP and Sustainability

CHSP may establish bounded human stewardship states, but it does not self-activate KONTUR.

Sustainability Kernel v0.1 may establish project continuity / bounded observation / capability and pause boundaries, but it does not grant KONTUR or external execution authority.

`CHSP stewardship != KONTUR activation`

`Sustainability closure != KONTUR readiness`

## Interaction with Survival / Rescue

Survival and rescue artifacts preserve evidence and bounded continuity semantics. They do not silently replace canonical authority or create activation permission.

`recovered copy != canonical successor`

`rescue authorization != KONTUR activation`

## Review boundary

A positive v0.1 assessment means only:

`architecture evidence is coherent enough for a human integration review`

It does not mean:

`activate`, `execute`, `publish`, `transfer ownership`, `fail over`, or `resume old authorization`.

## Evolution

This is a version-scoped map, not a final ontology. New planes may be added only through a successor version with preserved provenance and explicit reasons.

`v0.1 convergence != architecture frozen forever`
