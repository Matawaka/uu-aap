# SPDX-License-Identifier: Apache-2.0
"""Tests of the CI acceptance gate; no imports from the evidence reducer."""
import copy
import hashlib
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest

from run_ci import CheckFailure, check_inventory, check_result, check_mutants, verify_sources


def good_result():
    return SimpleNamespace(testsRun=1, failures=[], errors=[], skipped=[], expectedFailures=[],
                           unexpectedSuccesses=[], wasSuccessful=lambda: True)


def mutant(review=False):
    row = {'mutation': 'one', 'killed': True, 'caught_by_cases': ['HA-P01']}
    if review:
        row.update(baseline_satisfied=True, assertion_failures=1, errors=0)
    return row


class InventoryChecks(unittest.TestCase):
    def test_exact_inventory_passes(self): check_inventory(['b', 'a'], ['a', 'b'])
    def test_empty_inventory_fails(self):
        with self.assertRaises(CheckFailure): check_inventory([], [])
    def test_missing_test_fails(self):
        with self.assertRaises(CheckFailure): check_inventory(['a'], ['a', 'b'])
    def test_extra_test_fails(self):
        with self.assertRaises(CheckFailure): check_inventory(['a', 'b'], ['a'])
    def test_duplicate_actual_fails(self):
        with self.assertRaises(CheckFailure): check_inventory(['a', 'a'], ['a'])
    def test_duplicate_expected_fails(self):
        with self.assertRaises(CheckFailure): check_inventory(['a'], ['a', 'a'])


class ResultChecks(unittest.TestCase):
    def test_clean_pass(self): self.assertEqual(check_result(good_result(), ['a'], ['a'])['tests'], 1)
    def test_incomplete_execution_fails(self):
        with self.assertRaises(CheckFailure): check_result(good_result(), ['a'], [])
    def test_wrong_count_fails(self):
        r = good_result(); r.testsRun = 0
        with self.assertRaises(CheckFailure): check_result(r, ['a'], ['a'])
    def test_failure_fails(self):
        r = good_result(); r.failures = ['failure']
        with self.assertRaises(CheckFailure): check_result(r, ['a'], ['a'])
    def test_error_fails(self):
        r = good_result(); r.errors = ['error']
        with self.assertRaises(CheckFailure): check_result(r, ['a'], ['a'])
    def test_skip_fails(self):
        r = good_result(); r.skipped = ['skipped']
        with self.assertRaises(CheckFailure): check_result(r, ['a'], ['a'])
    def test_expected_failure_fails(self):
        r = good_result(); r.expectedFailures = ['expected']
        with self.assertRaises(CheckFailure): check_result(r, ['a'], ['a'])
    def test_unexpected_success_fails(self):
        r = good_result(); r.unexpectedSuccesses = ['unexpected']
        with self.assertRaises(CheckFailure): check_result(r, ['a'], ['a'])
    def test_runner_failure_fails(self):
        r = good_result(); r.wasSuccessful = lambda: False
        with self.assertRaises(CheckFailure): check_result(r, ['a'], ['a'])


class MutationChecks(unittest.TestCase):
    def test_original_pass(self): self.assertEqual(check_mutants([mutant()], ['one'])['detected'], 1)
    def test_review_pass(self): self.assertEqual(check_mutants([mutant(True)], ['one'], review=True)['detected'], 1)
    def test_missing_mutant_fails(self):
        with self.assertRaises(CheckFailure): check_mutants([], ['one'])
    def test_duplicate_mutant_fails(self):
        with self.assertRaises(CheckFailure): check_mutants([mutant(), mutant()], ['one'])
    def test_surviving_mutant_fails(self):
        r = mutant(); r['killed'] = False
        with self.assertRaises(CheckFailure): check_mutants([r], ['one'])
    def test_no_catching_case_fails(self):
        r = mutant(); r['caught_by_cases'] = []
        with self.assertRaises(CheckFailure): check_mutants([r], ['one'])
    def test_false_benign_baseline_fails(self):
        r = mutant(True); r['baseline_satisfied'] = False
        with self.assertRaises(CheckFailure): check_mutants([r], ['one'], review=True)
    def test_unrelated_error_fails(self):
        r = mutant(True); r['errors'] = 1
        with self.assertRaises(CheckFailure): check_mutants([r], ['one'], review=True)
    def test_no_assertion_failure_fails(self):
        r = mutant(True); r['assertion_failures'] = 0
        with self.assertRaises(CheckFailure): check_mutants([r], ['one'], review=True)
    def test_truthy_string_not_success(self):
        r = mutant(); r['killed'] = 'true'
        with self.assertRaises(CheckFailure): check_mutants([r], ['one'])


class SourceChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve(); (self.root/'source.py').write_bytes(b'# sample\n')
        self.pins = {'source.py': hashlib.sha256(b'# sample\n').hexdigest()}
    def test_exact_source_passes(self): verify_sources(self.root, self.pins)
    def test_changed_source_fails(self):
        (self.root/'source.py').write_bytes(b'# changed\n')
        with self.assertRaises(CheckFailure): verify_sources(self.root, self.pins)
    def test_missing_source_fails(self):
        (self.root/'source.py').unlink()
        with self.assertRaises(CheckFailure): verify_sources(self.root, self.pins)
    def test_path_escape_fails(self):
        with self.assertRaises(CheckFailure): verify_sources(self.root, {'../source.py': self.pins['source.py']})
    def test_symlink_fails(self):
        (self.root/'link.py').symlink_to(self.root/'source.py')
        with self.assertRaises(CheckFailure): verify_sources(self.root, {'link.py': self.pins['source.py']})
    def test_empty_sources_fail(self):
        with self.assertRaises(CheckFailure): verify_sources(self.root, {})


if __name__ == '__main__': unittest.main(verbosity=2)
