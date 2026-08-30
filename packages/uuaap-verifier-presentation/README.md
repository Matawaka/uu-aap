# UU-AAP Verifier Presentation Package v0.5

This package is the reusable implementation surface for the merged P1.1 Layered Verifier Presentation Contract, P1.3 explicit interactive input, P1.4 bounded evidence adapters, P1.5 explicit candidate acceptance/materialization and the P1.7 contestability overlay.

It preserves one seven-dimension semantic boundary for embedded/library use, the immutable GitHub Pages reference presentation, local interactive validation, candidate adaptation, explicit materialization and visible correction/dispute/appeal history.

```text
integrity
identity
provenance
availability
authority
responsibility
truth
```

Contestability is an overlay over these seven dimensions, not an eighth dimension.

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

Candidate acceptance/materialization API:

```python
from uuaap_verifier_presentation import (
    build_acceptance_input,
    materialize_candidate_acceptance,
    validate_acceptance_input,
    validate_acceptance_result,
)
```

Contestability overlay API:

```python
from uuaap_verifier_presentation import (
    build_contestability_input,
    materialize_contestability_overlay,
    validate_contestability_input,
    validate_contestability_result,
)
```

P1.4 adapters emit **candidate claims**, not accepted P1.3 claims. P1.5 requires every emitted candidate to receive an explicit `ACCEPT`, `REJECT` or `DEFER` disposition and permits at most one accepted candidate per verifier dimension.

An acceptance event records selection for verifier materialization only. Its `actor_ref` does not establish the actor's identity, authorship, authority, responsibility or legal validity. Accepting a candidate does not strengthen its value, evaluation, source layer, explanation or non-effects; the materializer only binds an explicit acceptance receipt to the copied claim.

P1.7 keeps `CORRECTION`, `DISPUTE` and `APPEAL` records distinct. A dispute or appeal never mutates the target claim. An applied correction may supply an explicit successor claim for exactly one dimension, but the previous claim is preserved in `historical_claims`. Challenger/correcting actor references do not prove identity or authority, a correction does not establish factual truth, unresolved disagreement is allowed, and contestability activity is not reputation evidence by itself.

Interactive evidence payloads, adapter payload fields and contestability evidence payloads remain data. A field named `verified`, `verified_true`, `trust_score`, signer, ingredient or action label does not gain UU-AAP semantics merely because it appears in an external payload.

The historical `scripts/verifier-presentation-contract/build.py` and `render.py` paths remain compatibility CLIs and delegate to this package. They are not a second implementation.

This repository package is not published to PyPI by P1.2–P1.7. External registry publication remains a separate distribution decision.
