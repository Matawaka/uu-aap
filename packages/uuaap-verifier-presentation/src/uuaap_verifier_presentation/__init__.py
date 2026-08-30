"""Reusable UU-AAP layered verifier presentation API."""

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
    "ADAPTER_INPUT_SCHEMA",
    "ADAPTER_REGISTRY",
    "ADAPTER_RESULT_SCHEMA",
    "DIMENSION_ORDER",
    "EVALUATION_STATES",
    "INTERACTIVE_INPUT_SCHEMA",
    "INTERACTIVE_RESULT_SCHEMA",
    "adapt_evidence",
    "build_presentation",
    "load_json",
    "normalize_interactive_input",
    "render",
    "validate_adapter_input",
    "validate_adapter_result",
    "validate_fixture",
    "validate_interactive_input",
    "validate_interactive_result",
    "validate_presentation",
]
