"""Local-only checks for the active main-line exclusion fence.

The test reads static side-track JSON only. It does not query GitHub, mutate
refs, edit the active pull request, or perform any external operation.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:  # pragma: no cover
    Draft202012Validator = None
    FormatChecker = None


ROOT = Path(__file__).resolve().parents[1]


def load(name: str):
    with (ROOT / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


@unittest.skipIf(Draft202012Validator is None, "jsonschema is not installed; local validation skipped")
class ActiveMainLineFenceTests(unittest.TestCase):
    def test_example_validates(self):
        schema = load("active-main-line-fence.schema.json")
        instance = load("examples/active-main-line-fence.example.json")
        Draft202012Validator.check_schema(schema)
        errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(instance))
        self.assertEqual([], errors, "\n".join(error.message for error in errors))

    def test_parallel_prefixes_do_not_enter_active_fence(self):
        fence = load("examples/active-main-line-fence.example.json")
        protected = tuple(fence["protected_path_prefixes"])
        for prefix in fence["parallel_allowed_path_prefixes"]:
            with self.subTest(prefix=prefix):
                self.assertFalse(prefix.startswith(protected))

    def test_active_paths_are_inside_declared_protected_surface(self):
        fence = load("examples/active-main-line-fence.example.json")
        protected = tuple(fence["protected_path_prefixes"])
        for active in fence["active_work"]:
            for path in active["changed_paths"]:
                with self.subTest(path=path):
                    self.assertTrue(path.startswith(protected))

    def test_integration_actions_are_blocked_while_fence_is_current(self):
        fence = load("examples/active-main-line-fence.example.json")
        blocked = set(fence["integration_actions_blocked"])
        required = {
            "open_parallel_pr",
            "rebase_parallel_onto_active_main",
            "merge_parallel_into_main",
            "edit_active_pr",
            "comment_on_active_pr",
            "update_main_ref",
        }
        self.assertTrue(required.issubset(blocked))
        self.assertIs(fence["main_mutation_allowed"], False)
        self.assertEqual("none", fence["authority_effect"])


if __name__ == "__main__":
    unittest.main()
