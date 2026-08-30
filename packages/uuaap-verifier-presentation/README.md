# UU-AAP Verifier Presentation Package v0.3

This package is the reusable implementation surface for the merged P1.1 Layered Verifier Presentation Contract, the P1.3 explicit interactive input contract and the P1.4 bounded evidence adapter layer.

It preserves one seven-dimension semantic boundary for embedded/library use, the immutable GitHub Pages reference presentation, local interactive validation and candidate-claim adaptation.

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

Bounded evidence-adapter API:

```python
from uuaap_verifier_presentation import (
    ADAPTER_REGISTRY,
    adapt_evidence,
    validate_adapter_input,
    validate_adapter_result,
)
```

P1.4 adapters emit **candidate claims**, not accepted P1.3 claims. Each adapter is restricted to one allowlisted verifier dimension. The initial registry contains C2PA provenance, PoAI availability, UU-AAP authority and UU-AAP responsibility adapters; none may emit identity or truth.

Interactive evidence payloads and adapter payload fields outside each documented adapter contract remain data. A field named `verified`, `verified_true`, `trust_score`, signer, ingredient or action label does not gain UU-AAP semantics merely because it appears in an external payload.

The historical `scripts/verifier-presentation-contract/build.py` and `render.py` paths remain compatibility CLIs and delegate to this package. They are not a second implementation.

This repository package is not published to PyPI by P1.2/P1.3/P1.4. External registry publication remains a separate distribution decision.
