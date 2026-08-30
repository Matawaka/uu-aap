# UU-AAP Verifier Presentation Package v0.2

This package is the reusable implementation surface for the merged P1.1 Layered Verifier Presentation Contract and the P1.3 explicit interactive input contract.

It preserves one seven-dimension semantic boundary for embedded/library use, the immutable GitHub Pages reference presentation and local interactive validation.

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

Reference presentation API:

```python
from uuaap_verifier_presentation import (
    DIMENSION_ORDER,
    build_presentation,
    validate_fixture,
    validate_presentation,
    render,
)
```

Interactive explicit-input API:

```python
from uuaap_verifier_presentation import (
    normalize_interactive_input,
    validate_interactive_input,
    validate_interactive_result,
)
```

Interactive evidence payloads are opaque data. The package validates explicit dimension claims and their evidence references; it does not derive integrity, identity, provenance, availability, authority, responsibility or truth from opaque payload fields.

The historical `scripts/verifier-presentation-contract/build.py` and `render.py` paths remain compatibility CLIs and delegate to this package. They are not a second implementation.

This repository package is not published to PyPI by P1.2/P1.3. External registry publication remains a separate distribution decision.
