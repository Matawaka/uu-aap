# Public Review → Observation Set Calculus Candidate Adapter v0.1

**Status:** two-domain reuse proof adapter / accepted Public Review evidence source / candidate-neutral target  
**Tracking:** #909

This adapter proves direct consumption of the same candidate observation-set implementation used by the C2PA adapter while preserving Public Review's own evidence/admission/disposition boundaries.

## Accepted source

The positive path uses the exact retained checkpoint accepted through #872:

- `checkpoint.json`;
- repository-wide Issue observation receipt;
- declared Discussion observation receipt;
- accepted `validate_checkpoint.py`.

The existing checkpoint validator is invoked before projection.

Current accepted observation facts remain:

```text
known historical external issue sources = 1
new external issue sources              = 0
external Discussion sources             = 0
```

The one retained historical source is exact #422 comment `5471862585`.

## Projection

The adapter derives candidate scope from:

```text
repository + exact checkpoint covered_surfaces
```

so different observation coverage cannot silently compare as the same universe.

For each accepted repository Issue external source:

```text
semantic identity = SHA-256(repository + source kind + issue/source ids + URL + exact body digest)
source binding     = SHA-256(canonical full accepted source object)
```

Author account label/association are intentionally not semantic source identity. Their exact bytes remain source-bound, but account metadata is not upgraded to verified human identity, independence or authority.

## Current Discussion boundary

The accepted checkpoint contains zero external Discussion sources. v0.1 does not invent a future non-empty Discussion identity projection. A future accepted non-empty Discussion source shape requires a successor adapter rather than silent issue-shaped normalization.

## Candidate reuse boundary

The projected set is evaluated by the exact same candidate profile bytes as the C2PA adapter.

```text
Public Review observation != admission
Admission != disposition
Observed source != relevant/true source
One observed external source != external validation
Candidate set receipt != Public Review decision
```

No reviewer identity proof, admission/disposition, normative change, ActionPermit, Core admission or Interface Registry admission is created.
