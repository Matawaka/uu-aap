# P1.3 Interactive Verifier Surface v0.1

P1.3 adds a browser-local input surface to the reusable seven-dimension verifier without changing the merged P1.1 reference artifact or P1.2 reference presentation.

Public deployment target:

```text
/verifier/interactive/
```

## What the input means

The v0.1 envelope separates:

```text
evidence_items      = declared evidence inventory / opaque payload context
dimension_claims    = explicit semantic claims for the seven verifier dimensions
```

The verifier does not inspect opaque payload fields and derive stronger claims from them. A payload field such as `verified`, `verified_true` or `trust_score` remains opaque evidence data. It does not become a UU-AAP verifier verdict.

Exactly seven explicit dimension claims are required:

```text
integrity
identity
provenance
availability
authority
responsibility
truth
```

Each claim uses the existing P1.1 dimension shape and every evidence reference must resolve to a declared evidence item id. `NOT_EVALUATED` remains fail-closed and cannot carry fabricated evidence references.

## Local-only browser boundary

The page accepts either pasted JSON or a locally selected `.json` file. Processing uses browser JSON parsing, `FileReader`, structural validation and DOM text nodes.

No input is uploaded by P1.3. The browser code has no network request API, model call, analytics, third-party script, external CDN, dynamic code execution or raw HTML insertion path.

## One semantic source

The Python package exports:

```python
from uuaap_verifier_presentation import (
    normalize_interactive_input,
    validate_interactive_input,
    validate_interactive_result,
)
```

The browser normalizer mirrors the same structural contract. CI executes both implementations against the same fixture and requires their normalized JSON results to be equal.

This is structural browser portability, not a second inference engine: neither implementation derives a dimension from evidence payload content.

## Deployment layering

P1.2 remains the GitHub Pages deployment owner:

```text
P1.2 build + byte-equivalence checks
                ↓
P1.3 local interactive augmentation
                ↓
validated Pages artifact
```

The existing `/verifier/` HTML remains byte-for-byte equal to the merged P1.1 snapshot. P1.3 only adds `/verifier/interactive/` and a root navigation link after the P1.2 reference checks pass.

## Non-effects

P1.3 does not parse or verify C2PA credentials, certify truth, infer identity, infer authority, infer responsibility, backfill historical availability, create a scalar trust score, create an umbrella verified badge, change Stable Core, or change SPEC semantics.
