"""Reusable UU-AAP layered verifier presentation API."""

from .acceptance import (
    ACCEPTANCE_INPUT_SCHEMA,
    ACCEPTANCE_RESULT_SCHEMA,
    ACCEPTANCE_SCOPE,
    build_acceptance_input,
    materialize_candidate_acceptance,
    validate_acceptance_input,
    validate_acceptance_result,
)
from .adapters import (
    ADAPTER_INPUT_SCHEMA,
    ADAPTER_REGISTRY,
    ADAPTER_RESULT_SCHEMA,
    adapt_evidence,
    validate_adapter_input,
    validate_adapter_result,
)
from .core import (
    DIMENSION_ORDER,
    EVALUATION_STATES,
    build_presentation,
    load_json,
    render,
    validate_fixture,
    validate_presentation,
)
from .interactive import (
    INTERACTIVE_INPUT_SCHEMA,
    INTERACTIVE_RESULT_SCHEMA,
    normalize_interactive_input,
    validate_interactive_input,
    validate_interactive_result,
)

__all__ = [
    "ACCEPTANCE_INPUT_SCHEMA",
    "ACCEPTANCE_RESULT_SCHEMA",
    "ACCEPTANCE_SCOPE",
    "ADAPTER_INPUT_SCHEMA",
    "ADAPTER_REGISTRY",
    "ADAPTER_RESULT_SCHEMA",
    "DIMENSION_ORDER",
    "EVALUATION_STATES",
    "INTERACTIVE_INPUT_SCHEMA",
    "INTERACTIVE_RESULT_SCHEMA",
    "adapt_evidence",
    "build_acceptance_input",
    "build_presentation",
    "load_json",
    "materialize_candidate_acceptance",
    "normalize_interactive_input",
    "render",
    "validate_acceptance_input",
    "validate_acceptance_result",
    "validate_adapter_input",
    "validate_adapter_result",
    "validate_fixture",
    "validate_interactive_input",
    "validate_interactive_result",
    "validate_presentation",
]
