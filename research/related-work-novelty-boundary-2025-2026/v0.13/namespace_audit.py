"""Read-only ownership census for the shared lm_eval.tasks initializer.

No imports from lm_eval/StateBench, no repairs, no package installation, no models.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
from importlib import metadata
import json
import os
from pathlib import Path
import platform
import unittest

PATH = 'lm_eval/tasks/__init__.py'
VERSIONS = {'lm-eval': '0.4.13', 'statebench-lm-eval': '0.1.0'}
SOURCE_BLOBS = {'lm-eval': 'b70b6a5f4062a51b95e885112ffde0fca302fd6b', 'statebench-lm-eval': 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def encode(value):
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + '\n').encode()


def classify(entries):
    require(set(entries) == set(VERSIONS), 'EXACT_TWO_DISTRIBUTIONS_REQUIRED')
    a, b = (entries[name] for name in VERSIONS)
    require(a['physical_path'] == b['physical_path'], 'NOT_THE_SAME_INSTALLED_PATH')
    require(a['declared_sha256'] != b['declared_sha256'], 'NO_CONFLICTING_DECLARED_BYTES')
    require(a['actual_sha256'] == b['actual_sha256'], 'READ_SNAPSHOT_CHANGED')
    matches = [name for name, item in entries.items() if item['actual_sha256'] == item['declared_sha256']]
    require(len(matches) == 1, 'ACTUAL_BYTES_MATCH_NEITHER_CLAIM')
    return matches[0]


def observe(output):
    require(platform.python_version() == '3.12.14', 'EXACT_PYTHON_REQUIRED')
    require(os.geteuid() != 0, 'NON_ROOT_OBSERVER_REQUIRED')
    entries = {}
    for name, version in VERSIONS.items():
        dist = metadata.distribution(name)
        require(dist.version == version, 'FROZEN_VERSION_MISMATCH')
        matches = [f for f in (dist.files or []) if f.as_posix() == PATH]
        require(len(matches) == 1, 'EXACT_RECORD_PATH_NOT_FOUND:' + name)
        file = matches[0]
        require(file.hash is not None and file.hash.mode == 'sha256', 'SHA256_RECORD_REQUIRED')
        declared = base64.urlsafe_b64decode(file.hash.value + '=' * (-len(file.hash.value) % 4)).hex()
        located = Path(dist.locate_file(file))
        require(located.is_file() and not located.is_symlink(), 'REGULAR_INITIALIZER_REQUIRED')
        data = located.read_bytes()
        require(len(data) < 100000, 'INITIALIZER_BYTE_CEILING')
        entries[name] = {'version': dist.version, 'physical_path': str(located.resolve()),
                         'declared_sha256': declared, 'declared_bytes': file.size,
                         'actual_sha256': hashlib.sha256(data).hexdigest(), 'actual_bytes': len(data),
                         'actual_git_blob': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()}
    winner = classify(entries)
    require(entries[winner]['actual_git_blob'] == SOURCE_BLOBS[winner], 'WINNING_INITIALIZER_NOT_PINNED_SOURCE')
    for item in entries.values():
        item.pop('physical_path')
        item['installed_bytes_match_own_record'] = item['declared_sha256'] == item['actual_sha256']
    result = {'schema': 'matawaka.statebench-namespace-ownership-observation/v0.13',
              'status': 'FROZEN_ENVIRONMENT_NAMESPACE_COLLISION_OBSERVED',
              'logical_path': PATH, 'same_installed_path': True, 'conflicting_record_claims': True,
              'distributions': entries, 'installed_bytes_match_distribution': winner,
              'source_initializer_blobs': SOURCE_BLOBS,
              'interpretation': 'TWO_PINNED_DISTRIBUTIONS_CLAIM_DIFFERENT_BYTES_AT_ONE_PATH',
              'installation_order_or_race_mechanism_proven': False,
              'non_effects': {'package_reinstalled': False, 'initializer_repaired': False,
                              'dependency_lock_changed': False, 'upstream_code_changed': False,
                              'lm_eval_imported_by_observer': False, 'model_executed': False,
                              'provider_api_called': False, 'scoring_called': False,
                              'merge_authorized': False}}
    data = encode(result)
    with output.open('xb') as f:
        f.write(data)
    print(data.decode(), end='')
    print('NAMESPACE_OBSERVATION_SHA256=' + hashlib.sha256(data).hexdigest())


class OwnershipTests(unittest.TestCase):
    def fixture(self):
        return {'lm-eval': {'physical_path': 'same', 'declared_sha256': 'a', 'actual_sha256': 'a'},
                'statebench-lm-eval': {'physical_path': 'same', 'declared_sha256': 'b', 'actual_sha256': 'a'}}
    def test_conflicting_ownership(self):
        self.assertEqual(classify(self.fixture()), 'lm-eval')
    def test_either_installed_owner(self):
        r = self.fixture()
        for v in r.values(): v['actual_sha256'] = 'b'
        self.assertEqual(classify(r), 'statebench-lm-eval')
    def test_no_conflict_not_promoted(self):
        r = self.fixture(); r['statebench-lm-eval']['declared_sha256'] = 'a'
        with self.assertRaises(ValueError): classify(r)
    def test_distinct_paths(self):
        r = self.fixture(); r['statebench-lm-eval']['physical_path'] = 'other'
        with self.assertRaises(ValueError): classify(r)
    def test_unmatched_actual(self):
        r = self.fixture()
        for v in r.values(): v['actual_sha256'] = 'c'
        with self.assertRaises(ValueError): classify(r)
    def test_missing_owner(self):
        r = self.fixture(); r.pop('lm-eval')
        with self.assertRaises(ValueError): classify(r)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        tests = unittest.defaultTestLoader.loadTestsFromTestCase(OwnershipTests)
        raise SystemExit(0 if unittest.TextTestRunner(verbosity=2).run(tests).wasSuccessful() else 1)
    require(args.output is not None, 'OUTPUT_REQUIRED')
    observe(args.output)


if __name__ == '__main__':
    main()
