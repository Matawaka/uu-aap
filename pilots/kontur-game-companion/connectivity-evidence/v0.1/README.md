# KONTUR Game Companion Connectivity Evidence v0.1

**Status:** synthetic, non-executing connectivity witness  
**Observed main:** `d8500cdcbf9355cce71ce52beaea01c70e1a1c54`  
**Source line:** issue #445, PRs #446 and #452–#457  
**Source audit:** PR #458 at `2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee`

## Purpose

This component binds the exact repository artifacts that currently materialize Stable
Core and the seven KONTUR Game Companion layers:

```text
Stable Core
→ Observational Lane
→ Assistance Gate
→ Shared Discovery Memory
→ Bounded Initiative
→ Focus Diversity
→ Interaction Receipt
→ Pause / Resume
```

For every layer, the witness records the Git blob identity of its specification,
fixture, validator, and workflow. A read-only validator recomputes those identities and
fails closed when an artifact changes without an explicit evidence refresh.

This closes an evidence-observation gap without rewriting any existing Core or pilot
artifact. It does not claim that file proximity, merge order, or green CI proves a
semantic dependency.

## Architectural boundary

The reusable direction remains:

```text
State / Evidence Anchor
→ Possibility / Availability
→ Intent
→ Authority / Responsibility
→ Coordination / CCRP
→ Action Gate
→ Outcome / Provenance / Successor State
```

KONTUR remains an optional synthetic adapter. The forward Core-to-pilot relation is
classified `DOCUMENTED`, not silently promoted to `PROVEN`, because no new Stable
Core interface registration is created.

The witness preserves the audit classifications, including the prose-level
`bounded-initiative → focus-diversity` predecessor relation. It binds evidence; it
does not manufacture stronger semantic proof.

## Files

- `game-companion-connectivity.json` — exact frontier, layer, relation, artifact, and
  non-effect evidence.
- `game-companion-connectivity.schema.json` — closed JSON Schema for the witness.
- `validate-game-companion-connectivity.js` — dependency-free validator that checks
  structure, provenance, artifact Git blob identities, direction, authority, trigger
  coverage, and negative mutations.
- `.github/workflows/kontur-game-companion-connectivity-evidence-v0.1.yml` — a new
  read-only workflow scoped only to Core/Game Companion connectivity paths.

## Validation

From the repository root:

```bash
node pilots/kontur-game-companion/connectivity-evidence/v0.1/validate-game-companion-connectivity.js
```

The canonical witness passes only when all 32 bound artifacts match. The validator also
rejects frontier drift, origin drift, missing/duplicate artifacts, reverse Stable Core
relations, optionality overclaims, truncated bindings, authority leakage, fail-open
assertions, action permits, and IP-process coupling.

## Copyright and IP-process isolation

This component does not read, write, validate, gate, or depend on licensing,
copyright, legal-author-identity, pseudonym-publication, or patent-process artifacts.
Its workflow path filters exclude those processes. Parallel IP work is not a dependency
of this witness and is not interpreted as KONTUR architecture.

No `LICENSE`, `NOTICE`, legal, IP-governance, author-identity, or pseudonym
publication file is modified.

## Non-effects

This component authorizes no live response generation, proactive messaging, autonomous
gameplay, game-account control, external effect, action permit, successor permit,
automatic Stable Core promotion, workflow-trigger narrowing, deployment, release, tag,
or merge.

Exact artifact binding != runtime authority.

Evidence refresh != architecture promotion.

Connectivity witness != permission to modify copyright processes.


