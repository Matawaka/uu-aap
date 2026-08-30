# UU-AAP Verifier Presentation Package v0.1

This package is the reusable implementation surface for the merged P1.1 Layered Verifier Presentation Contract.

It exposes one seven-dimension semantic presentation engine for both embedded/library use and the GitHub Pages reference deployment.

```text
integrity
identity
provenance
availability
authority
responsibility
truth
```

The package does not produce an aggregate trust, truth, reputation, confidence, reliability or compatibility score and does not create an umbrella verified verdict.

Public API:

```python
from uuaap_verifier_presentation import (
    DIMENSION_ORDER,
    build_presentation,
    validate_fixture,
    validate_presentation,
    render,
)
```

The historical `scripts/verifier-presentation-contract/build.py` and `render.py` paths remain compatibility CLIs and delegate to this package. They are not a second implementation.

This repository package is not published to PyPI by P1.2. External registry publication is a separate distribution decision.
