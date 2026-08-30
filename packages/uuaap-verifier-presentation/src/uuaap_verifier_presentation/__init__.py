"""Reusable UU-AAP layered verifier presentation API."""

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
    "DIMENSION_ORDER",
    "EVALUATION_STATES",
    "INTERACTIVE_INPUT_SCHEMA",
    "INTERACTIVE_RESULT_SCHEMA",
    "build_presentation",
    "load_json",
    "normalize_interactive_input",
    "render",
    "validate_fixture",
    "validate_interactive_input",
    "validate_interactive_result",
    "validate_presentation",
]
