# P1.2 Verifier Distribution Surface v0.1

Status: additive distribution successor for #798.

P1.2 implements the selected **both** deployment posture without creating two semantic implementations:

```text
P1.1 layered verifier semantics
        ↓
uuaap-verifier-presentation package
        ├── reusable Python library API
        ├── legacy P1.1 CLI compatibility shims
        └── generated GitHub Pages reference site
```

## Canonical package

`packages/uuaap-verifier-presentation` owns the reusable implementation. It exposes the seven-dimension builder, validators and deterministic HTML renderer.

The historical P1.1 paths remain callable but delegate to the package. P1.1 fixtures, schema, adversarial tests and reference snapshot remain regression evidence.

## Pages build

`build_site.py` produces:

```text
_site/
  .nojekyll
  index.html
  verifier/
    index.html
    presentation.json
```

`verifier/index.html` is the exact canonical package rendering for the P1.1 reference fixture. The root landing is only navigation/context and obtains the dimension list from `DIMENSION_ORDER`.

No semantic JavaScript, external CDN, analytics, tracker, remote model or third-party runtime is required.

## CI equivalence

`test.py` proves:

- installed/importable package exposes the seven dimensions;
- legacy P1.1 builder output equals package output;
- legacy P1.1 renderer equals package renderer;
- package renderer equals the merged P1.1 byte snapshot;
- generated Pages verifier equals the same package renderer;
- generated machine-readable JSON equals the same presentation object;
- no aggregate trust/truth/verdict surface appears.

## Deployment boundary

Pull requests build and validate the Pages artifact but do **not** deploy it.

After merge to `main`, the same workflow uses the official GitHub Pages Actions path to publish the validated static artifact. If repository-level Pages enablement is not available to `GITHUB_TOKEN`, deployment must fail visibly rather than silently fall back to another hosting mechanism.

P1.2 does not publish the Python package to PyPI, does not create a custom domain, and does not add an interactive upload/parser surface. Those remain later distribution/product decisions.

## Non-effects

P1.2 does not modify Stable Core or SPEC semantics, does not create a new verifier truth model, does not alter P0/P1.1 evidence meanings, and does not introduce a scalar score or whole-record verdict.
