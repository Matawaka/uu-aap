# Backlog Entity Reconciliation v0.1

**Status:** additive / machine-readable / non-authorizing  
**Tracking issue:** #875  
**Origin frontier:** `1a5232fc3d3af8b6bc41de78a510e1ac9129c50a`

## Purpose

This layer records a bounded current classification for ten named backlog/concept entities without converting classification into roadmap priority, implementation authority, Stable Core promotion, release authority, or an ActionPermit.

It is a successor registry, not a rewrite of historical Backlog Reconciliation #697. Historical #697 classified issue state under its own protocol; this layer classifies named entities under the fixed v0.1 vocabulary.

## Fixed classifications

- Non-Binding Attention -> `IMPLEMENTED`
- No Silent Reinterpretation -> `INVARIANT`
- Pause/Freeze/Resume -> `PARTIALLY_COVERED`
- RERC -> `NEW_CANDIDATE`
- Event-Responsive Dormancy -> `NEW_CANDIDATE`
- SCAF -> `EXPLORATORY`
- CPOT -> `EXPLORATORY`
- Immune Tremor -> `EXPLORATORY`
- Conscious AI -> `EXPLORATORY`
- Workbench -> `PAUSED`

## Bounded exact-materialization rule

When bounded current exact-term search does not produce a safe source binding, the only absence-like statement permitted by this layer is:

`exact materialization not found in bounded current audit`

This statement is deliberately epistemic and scoped. It does not mean that the entity is absent from history, prior discussion, another representation, another repository, or future work.

`Exact Materialization Not Found In Bounded Current Audit != Entity Absent`

## Source-binding rules

### Non-Binding Attention

`IMPLEMENTED` is bound to #755, merged PR #756, and the current implementation README blob under `pilots/kontur-game-companion/non-binding-attention-v0.1/`.

### No Silent Reinterpretation

`INVARIANT` is supported by explicit accepted/current semantics including #852 and `docs/ROADMAP-CURRENT.md`. The exact standalone label is not promoted into a new Core primitive.

### Pause/Freeze/Resume

`PARTIALLY_COVERED` binds explicit CCRP/C4 pause/resume/handoff semantics from #144. The broader word `Freeze` remains a visible uncovered semantic remainder rather than being silently equated with `pause`.

### Workbench

`PAUSED` binds the current `docs/ROADMAP-CURRENT.md` statement `PAUSED_EXTERNAL_PRODUCT`. Historical Workbench continuity evidence remains provenance only and creates no reactivation authority.

### RERC, Event-Responsive Dormancy, SCAF, CPOT, Immune Tremor, Conscious AI

The registry records only the fixed candidate/exploratory classifications plus the bounded exact-materialization statement above. It does not invent current source bindings to manufacture implementation status.

## Historical boundaries

- #697 is historical Backlog Reconciliation evidence; it is not semantic authority for these entity classifications.
- #422 remains the historical external-review entry in its accepted Pilot 002/disposition lineage; this registry does not reinterpret it and creates no new disposition.
- Stable Core, SPEC, PRINCIPLES, CONTESTABILITY, base manifest schema, and the current roadmap are not modified.

## Files

- `registry.json` — canonical fixed v0.1 registry.
- `registry.schema.json` — closed Draft 2020-12 schema.
- `implementation-receipt.json` — exact origin/source/non-effect binding.
- `validate_registry.py` — deterministic fail-closed validation and git/blob guards.
- `test_registry.py` — positive baseline plus hostile mutations.

## Validate

```bash
python tooling/backlog-entity-reconciliation/v0.1/validate_registry.py
python tooling/backlog-entity-reconciliation/v0.1/test_registry.py
```

The dedicated workflow is read-only, has no schedule, fetches complete history only to verify the exact origin/source blobs, and limits the PR diff to this additive tooling directory plus its workflow.

## Non-effects

`Registry Classification != Roadmap Priority`

`Registry Classification != Implementation Authority`

`Candidate != Authorization`

`Exploratory != Scheduled Work`

`Invariant Evidence != Stable Core Rewrite`

`Paused != Deleted`

No Stable Core/SPEC change, no #422 reinterpretation, no #697 rewrite, no Workbench reactivation, no release/tag/publication/runtime authority, and no ActionPermit.
