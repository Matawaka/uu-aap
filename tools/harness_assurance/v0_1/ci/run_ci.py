# SPDX-License-Identifier: Apache-2.0
"""Repository test runner, NOT the evidence reducer or an authority issuer.

Executes only this package's hash-pinned Python checks. No evidence commands,
network requests, installation, live adapters, or target controls are executed.
Git and filesystem operations here belong to the CI wrapper, not reduce().
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PACKAGE = HERE.parent
NON_EFFECTS = {
    'authorizes_merge': False, 'issues_permits': False,
    'independent_review': False, 'qualifies_live_recorder': False,
    'executes_target_controls': False, 'starts_ha2': False,
}


class CheckFailure(ValueError):
    """A failed CI requirement, not a target-behaviour judgment."""


def require(value: bool, code: str) -> None:
    if not value:
        raise CheckFailure(code)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources(root: Path, pins: dict[str, str]) -> None:
    require(type(pins) is dict and bool(pins), 'empty_source_inventory')
    for relative, expected in pins.items():
        require(type(relative) is str and type(expected) is str, 'invalid_source_pin')
        path = Path(relative)
        require(not path.is_absolute() and '..' not in path.parts, 'source_path_escape')
        require(re.fullmatch(r'[0-9a-f]{64}', expected) is not None, 'invalid_source_digest')
        candidate = root / path
        require(candidate.resolve().is_relative_to(root.resolve()), 'source_path_escape')
        require(not any(part.is_symlink() for part in [candidate, *candidate.parents]
                        if part != root.parent), 'source_symlink')
        require(candidate.is_file(), 'pinned_source_missing')
        require(sha256(candidate) == expected, 'pinned_source_changed')



def verify_import_surface(root: Path, pins: dict[str, str]) -> list[str]:
    """Admit the fixed package's Python namespace BEFORE importing any tests.

    A source pin inventory is not an executable-entrypoint inventory: unittest
    discovery imports even modules that contribute zero test methods. Keep
    unpinned source, bytecode, native extensions and symlinked trees out of the
    two import roots used below. This is not a sandbox against an edited runner,
    a malicious pin manifest, interpreter, or concurrent checkout mutation.
    """
    package = root / 'tools/harness_assurance/v0_1'
    require(package.is_dir() and not package.is_symlink(), 'python_namespace_missing')
    expected = set()
    for relative in pins:
        path = Path(relative)
        if path.suffix == '.py' and path.is_relative_to(Path('tools/harness_assurance/v0_1')):
            expected.add(path.as_posix())
    require(bool(expected), 'python_source_inventory_empty')
    observed = set()
    for number, entry in enumerate(package.rglob('*'), 1):
        require(number <= 4096, 'python_namespace_limit')
        require(not entry.is_symlink(), 'python_namespace_symlink')
        if not entry.is_file():
            continue
        suffix = entry.suffix.lower()
        require(suffix not in {'.pyc', '.pyo', '.so', '.pyd', '.dll'},
                'python_namespace_binary')
        if suffix == '.py':
            observed.add(entry.relative_to(root).as_posix())
    require(observed == expected, 'python_source_inventory_mismatch')
    return sorted(observed)


def load_ha1_suite(manifest: dict) -> unittest.TestSuite:
    """Validate the import surface, then load ONLY pinned named test modules."""
    verify_sources(ROOT, manifest['source_files'])
    verify_import_surface(ROOT, manifest['source_files'])
    names = sorted({test_id.split('.', 1)[0] for test_id in manifest['test_ids']})
    require(bool(names), 'empty_test_inventory')
    for name in names:
        require(re.fullmatch(r'test_[a-zA-Z0-9_]+', name) is not None,
                'test_module_name_invalid')
        relative = (PACKAGE / (name + '.py')).relative_to(ROOT).as_posix()
        require(relative in manifest['source_files'], 'test_module_not_pinned')
    return unittest.defaultTestLoader.loadTestsFromNames(names)

def flatten(suite: unittest.TestSuite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from flatten(test)
        else:
            yield test


def check_inventory(actual: list[str], expected: list[str]) -> None:
    require(bool(expected), 'empty_test_inventory')
    require(len(expected) == len(set(expected)), 'duplicate_expected_test')
    require(len(actual) == len(set(actual)), 'duplicate_discovered_test')
    require(sorted(actual) == sorted(expected), 'test_inventory_mismatch')


def check_result(result: unittest.TestResult, expected: list[str], observed: list[str]) -> dict:
    check_inventory(observed, expected)
    require(result.testsRun == len(expected), 'test_count_mismatch')
    require(not result.failures and not result.errors, 'test_failure_or_error')
    require(not result.skipped, 'test_skip')
    require(not result.expectedFailures, 'test_expected_failure')
    require(not result.unexpectedSuccesses, 'test_unexpected_success')
    require(result.wasSuccessful(), 'test_runner_not_successful')
    return {'tests': result.testsRun, 'failures': 0, 'errors': 0, 'skipped': 0,
            'expected_failures': 0, 'unexpected_successes': 0,
            'executed_ids': sorted(observed)}


class TrackingResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.observed_ids: list[str] = []

    def startTest(self, test):
        self.observed_ids.append(test.id())
        super().startTest(test)


def execute_suite(suite: unittest.TestSuite, expected: list[str], output: Path, name: str) -> dict:
    check_inventory([test.id() for test in flatten(suite)], expected)
    with (output / (name + '.log')).open('w', encoding='utf-8') as log:
        result = unittest.TextTestRunner(stream=log, verbosity=2,
                                        resultclass=TrackingResult).run(suite)
    return check_result(result, expected, result.observed_ids)


def check_mutants(rows: list[dict], expected: list[str], *, review: bool = False) -> dict:
    require(type(rows) is list and bool(expected), 'mutation_inventory_missing')
    names = [row.get('mutation') for row in rows]
    require(len(names) == len(set(names)) and sorted(names) == sorted(expected), 'mutation_inventory_mismatch')
    for row in rows:
        require(row.get('killed') is True, 'mutation_survived')
        if review:
            require(row.get('baseline_satisfied') is True, 'benign_mutation_baseline_failed')
            require(type(row.get('assertion_failures')) is int and row['assertion_failures'] > 0,
                    'mutation_not_caught_by_assertion')
            require(type(row.get('errors')) is int and row['errors'] == 0, 'unrelated_mutation_error')
        else:
            require(type(row.get('caught_by_cases')) is list and bool(row['caught_by_cases']),
                    'mutation_case_missing')
    return {'count': len(rows), 'detected': len(rows), 'sample': rows,
            'coverage_percentage_claimed': False}


def git(*args: str) -> str:
    result = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True,
                            check=True, timeout=20)
    return result.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-source', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    require(not output.is_relative_to(ROOT), 'output_must_be_outside_checkout')
    output.mkdir(parents=True, exist_ok=True)
    report = {'schema': 'matawaka.ha1.ci-execution/v0.1', 'status': 'CI_CHECKS_FAIL',
              'scope': 'SYNTHETIC_TEST_EXECUTION_NOT_INDEPENDENT_REVIEW',
              'non_effects': dict(NON_EFFECTS), 'checks': {},
              'limitations': ['Checkout and CI configuration remain within repository trust.',
                              'Hosted execution is not an independent reviewer or producer attestation.',
                              'No repository-wide or live harness qualification is claimed.']}
    try:
        require(sys.flags.isolated == 1, 'isolated_python_required')
        require(re.fullmatch('[0-9a-f]{40}', args.expected_source) is not None, 'invalid_source_sha')
        source = git('rev-parse', 'HEAD')
        require(source == args.expected_source, 'checkout_source_mismatch')
        require(not git('status', '--porcelain', '--untracked-files=all'), 'checkout_not_clean')
        report.update(source_sha=source, source_tree=git('rev-parse', 'HEAD^{tree}'),
                      python=sys.version, platform=sys.platform,
                      hash_seed='RANDOMIZED_ISOLATED',
                      run_id=os.environ.get('GITHUB_RUN_ID'), run_attempt=os.environ.get('GITHUB_RUN_ATTEMPT'))
        manifest = json.loads((HERE / 'manifest.json').read_text(encoding='utf-8'))
        require(manifest['schema'] == 'matawaka.ha1.ci-manifest/v0.1', 'unsupported_manifest')
        verify_sources(ROOT, manifest['source_files'])
        report['import_surface'] = verify_import_surface(ROOT, manifest['source_files'])
        report['isolated_python'] = True
        report['source_checkpoint'] = manifest['source_checkpoint']
        report['source_pins'] = manifest['source_files']
        report['ci_source_hashes'] = {str(p.relative_to(ROOT)): sha256(p) for p in [
            HERE / 'run_ci.py', HERE / 'test_ci_gate.py', HERE / 'manifest.json',
            ROOT / '.github/workflows/harness-assurance-v0.1.yml']}
        sys.path.insert(0, str(PACKAGE))
        sys.path.insert(0, str(HERE))
        # No glob discovery: it would execute unpinned zero-test modules.
        suite = load_ha1_suite(manifest)
        report['checks']['ha1_tests'] = execute_suite(suite, manifest['test_ids'], output, 'ha1-tests')
        ci_suite = unittest.defaultTestLoader.loadTestsFromName('test_ci_gate')
        report['checks']['ci_gate_tests'] = execute_suite(ci_suite, manifest['ci_test_ids'], output, 'ci-gate-tests')
        from check_mutations import check_mutations
        from check_review_mutations import check_review_mutations
        for key, function, is_review in [('original_mutants', check_mutations, False),
                                          ('review_mutants', check_review_mutations, True)]:
            report['checks'][key] = check_mutants(function(), manifest[key], review=is_review)
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            runpy.run_path(str(ROOT / 'docs/design/harness-assurance/v0.1/validate_design.py'), run_name='__main__')
        (output / 'ha0-design.json').write_text(buffer.getvalue(), encoding='utf-8')
        design = json.loads(buffer.getvalue())
        require(design['result'] == 'DESIGN_DATA_CHECKS_PASS' and
                design['design_mutations_rejected'] == 10 and design['operational_cases_executed'] == 0,
                'historical_design_check_failed')
        report['checks']['historical_design'] = {'result': design['result'], 'mutations_rejected': 10,
                                                'scope': 'STATIC_DESIGN_ONLY'}
        verify_sources(ROOT, manifest['source_files'])
        verify_import_surface(ROOT, manifest['source_files'])
        require(not git('status', '--porcelain', '--untracked-files=all'), 'checkout_changed')
        report['status'] = 'CI_CHECKS_PASS'
    except Exception as error:
        report['error_class'] = type(error).__name__
        report['error_code'] = str(error) if isinstance(error, CheckFailure) else 'check_execution_failed'
    finally:
        report['log_hashes'] = {p.name: sha256(p) for p in sorted(output.iterdir())
                                if p.is_file() and p.name != 'ci-report.json'}
        text = json.dumps(report, indent=2, ensure_ascii=True) + '\n'
        (output / 'ci-report.json').write_text(text, encoding='utf-8')
        print(text)
    return 0 if report['status'] == 'CI_CHECKS_PASS' else 1


if __name__ == '__main__':
    sys.dont_write_bytecode = True
    raise SystemExit(main())
