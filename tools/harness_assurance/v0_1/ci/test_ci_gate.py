# SPDX-License-Identifier: Apache-2.0
"""Tests of the CI acceptance gate; no imports from the evidence reducer."""
import copy
import hashlib
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest import mock

import run_ci

from run_ci import (CheckFailure, check_inventory, check_result, check_mutants,
                    verify_sources, verify_import_surface, load_ha1_suite)


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


class ImportSurfaceChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.package = self.root / 'tools/harness_assurance/v0_1'
        self.package.mkdir(parents=True)
        (self.package / 'ci').mkdir()
        self.relative = 'tools/harness_assurance/v0_1/test_known.py'
        (self.root / self.relative).write_bytes(b'# known test entrypoint\n')
        self.pins = {self.relative: hashlib.sha256(b'# known test entrypoint\n').hexdigest()}

    def test_exact_python_namespace_passes(self):
        self.assertEqual(verify_import_surface(self.root, self.pins), [self.relative])

    def test_zero_test_unpinned_module_refused(self):
        (self.package / 'test_extra.py').write_text('raise AssertionError("must not import")\n')
        with self.assertRaisesRegex(CheckFailure, 'python_source_inventory_mismatch'):
            verify_import_surface(self.root, self.pins)

    def test_shadow_module_in_ci_refused(self):
        (self.package / 'ci/reducer.py').write_text('# unpinned shadow\n')
        with self.assertRaisesRegex(CheckFailure, 'python_source_inventory_mismatch'):
            verify_import_surface(self.root, self.pins)

    def test_nested_unpinned_package_refused(self):
        (self.package / 'nested').mkdir()
        (self.package / 'nested/__init__.py').write_text('# unpinned import hook\n')
        with self.assertRaisesRegex(CheckFailure, 'python_source_inventory_mismatch'):
            verify_import_surface(self.root, self.pins)

    def test_missing_python_source_refused(self):
        (self.root / self.relative).unlink()
        with self.assertRaisesRegex(CheckFailure, 'python_source_inventory_mismatch'):
            verify_import_surface(self.root, self.pins)

    def test_symlink_source_refused(self):
        (self.package / 'test_link.py').symlink_to(self.root / self.relative)
        with self.assertRaisesRegex(CheckFailure, 'python_namespace_symlink'):
            verify_import_surface(self.root, self.pins)

    def test_symlink_directory_refused(self):
        (self.package / 'linked').symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(CheckFailure, 'python_namespace_symlink'):
            verify_import_surface(self.root, self.pins)

    def test_cached_bytecode_refused(self):
        cache = self.package / '__pycache__'
        cache.mkdir()
        (cache / 'test_known.cpython-313.pyc').write_bytes(b'not executable probe')
        with self.assertRaisesRegex(CheckFailure, 'python_namespace_binary'):
            verify_import_surface(self.root, self.pins)

    def test_native_extension_refused(self):
        for suffix in ('.so', '.pyd', '.dll', '.pyo'):
            with self.subTest(suffix=suffix):
                p = self.package / ('test_known' + suffix)
                p.write_bytes(b'not executable probe')
                try:
                    with self.assertRaisesRegex(CheckFailure, 'python_namespace_binary'):
                        verify_import_surface(self.root, self.pins)
                finally:
                    p.unlink()

    def test_documentation_is_not_an_import_entrypoint(self):
        (self.package / 'review.md').write_text('Non-executable review note.\n')
        self.assertEqual(verify_import_surface(self.root, self.pins), [self.relative])

    def test_rejection_happens_before_module_loader(self):
        (self.package / 'test_extra.py').write_text('raise AssertionError("must not import")\n')
        manifest = {'source_files': self.pins, 'test_ids': ['test_known.C.test_a']}
        with mock.patch.object(run_ci, 'ROOT', self.root), \
             mock.patch.object(run_ci, 'PACKAGE', self.package), \
             mock.patch.object(unittest.defaultTestLoader, 'loadTestsFromNames') as loader:
            with self.assertRaisesRegex(CheckFailure, 'python_source_inventory_mismatch'):
                load_ha1_suite(manifest)
            loader.assert_not_called()

    def test_only_named_pinned_modules_are_loaded(self):
        manifest = {'source_files': self.pins, 'test_ids': ['test_known.C.test_a', 'test_known.C.test_b']}
        with mock.patch.object(run_ci, 'ROOT', self.root), \
             mock.patch.object(run_ci, 'PACKAGE', self.package), \
             mock.patch.object(unittest.defaultTestLoader, 'loadTestsFromNames', return_value='suite') as loader:
            self.assertEqual(load_ha1_suite(manifest), 'suite')
            loader.assert_called_once_with(['test_known'])

    def test_unknown_requested_module_refused(self):
        manifest = {'source_files': self.pins, 'test_ids': ['test_unpinned.C.test_a']}
        with mock.patch.object(run_ci, 'ROOT', self.root), \
             mock.patch.object(run_ci, 'PACKAGE', self.package), \
             mock.patch.object(unittest.defaultTestLoader, 'loadTestsFromNames') as loader:
            with self.assertRaisesRegex(CheckFailure, 'test_module_not_pinned'):
                load_ha1_suite(manifest)
            loader.assert_not_called()

    def test_empty_requested_modules_refused(self):
        manifest = {'source_files': self.pins, 'test_ids': []}
        with mock.patch.object(run_ci, 'ROOT', self.root), \
             mock.patch.object(run_ci, 'PACKAGE', self.package):
            with self.assertRaisesRegex(CheckFailure, 'empty_test_inventory'):
                load_ha1_suite(manifest)

    def test_module_path_syntax_refused(self):
        manifest = {'source_files': self.pins, 'test_ids': ['../test_known.C.test_a']}
        with mock.patch.object(run_ci, 'ROOT', self.root), \
             mock.patch.object(run_ci, 'PACKAGE', self.package):
            with self.assertRaisesRegex(CheckFailure, 'test_module_name_invalid'):
                load_ha1_suite(manifest)


if __name__ == '__main__': unittest.main(verbosity=2)
