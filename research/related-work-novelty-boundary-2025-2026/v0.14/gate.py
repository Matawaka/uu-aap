"""Namespace-safe install selection; environment PASS never means upstream Task PASS."""
from __future__ import annotations

import argparse
import base64
from collections import defaultdict, deque
import copy
import hashlib
from importlib import metadata
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import socket
import subprocess
import sys
import sysconfig
import tomllib
import unittest

BASE = '497002001f9eac4adafe2db525d5bb07d9205d21'
TREE13 = '434414badeea8ffdaa05e827c9212bd10a2dc0ca'
BASE12 = '98f13086f8e2d75fc6692ff68e21700bdffa37a5'
TREE12 = '82548649f877fb6ba1d405aec239f2a88c3a5997'
ROOT = 'research/related-work-novelty-boundary-2025-2026'
WF = '.github/workflows/statebench-namespace-safe-env-v0.14.yml'
LOCK_SHA = '324ab96f208bfbe1e6a2d03bc6ceb4bf5aa4867a57eeac5217e81571b7925532'
UPSTREAM = '1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7'
OLD_OWNERSHIP = 'ce1ae236ab7036d9d2d35bf1dc971d115ae8f6e57026e9385db0f0eb89bba318'
CRITICAL = {
    'tasks/__init__.py': 'b70b6a5f4062a51b95e885112ffde0fca302fd6b',
    'api/task.py': '9255170de444bae6edd53797e3477031cd5d5da5',
    'config/task.py': 'c3a3b712be912789370d18f2abc89d7439dcf1a7',
    'tasks/manager.py': '1e4d5b631f46a83367e7a834c1530d93ef923fe6',
    'tasks/_factory.py': 'a43b2d48d6f5c656b7cd4c0e16caec67db17c63c',
    'tasks/_yaml_loader.py': '9e608eb4cdf07927825b66aea5df884c9a742247',
    'tasks/_index.py': 'c37260731dcf3a9dd38815ecb5eb3e3a3f7c93be',
}
EXPECTED_REPLAY = {
    'v011-import.json': '08068dd3ebaf9546b5c1592cf77908487fc09cc8944f19f08c55ec9e298a8ce1',
    'v012/results.json': '677c354a5edf1052e1a616da65f84ca04d0df6e1eba60821e4080236250ceac3',
    'v012/documents.json': '30b756a7eb85db5ceeae843f178c34bff3fa1690c73635160d25ed73cabd78f0',
    'v012/normalization.json': '240080ccdfeca319d98da16479907b9433536715fa80c9ee8768fa29379f0602',
    'v013/results.json': '2528206426613f1efce19ff3f4dab17a1daac34f828af37df021c054e78c16d8',
    'v013/format-trace.json': '3685c45f32574313d11bfdaf8d70ced7843ecd236af4de0e6690a14f176806f3',
}
PROFILE = {
    'schema': 'matawaka.statebench-install-selection/v0.14',
    'name': 'MATAWAKA_NAMESPACE_SAFE_EXTERNAL_PLUGIN_SOURCE',
    'blocked_predecessor': BASE,
    'last_fully_qualified_predecessor': BASE12,
    'lock_path': ROOT + '/v0.10/lock-project/uv.lock',
    'lock_sha256': LOCK_SHA,
    'python': '3.12.14', 'uv': '0.12.10',
    'runner': 'ubuntu-24.04', 'machine': 'x86_64',
    'sync_selection': ['--frozen', '--no-install-package', 'statebench-lm-eval'],
    'excluded_distributions': ['statebench-lm-eval'],
    'expected_installed_distributions': 129,
    'requested_extras': {'lm-eval': ['hf']},
    'external_plugin_commit': UPSTREAM,
    'external_plugin_blob': 'd868c2138084cf08a842bdddfc204d556d46ed92',
    'full_original_project_sync_claimed': False,
    'two_independent_jobs_required': True,
    'fresh_environment_and_cache_per_job': True,
    'reinstall_or_initializer_repair_allowed': False,
    'namespace_scope': 'lm_eval/',
    'whole_dependency_filesystem_audit_claimed': False,
}
NON_EFFECTS = {key: False for key in (
    'old_lock_changed', 'upstream_source_changed', 'old_receipts_reinterpreted',
    'excluded_distribution_installed_then_removed', 'package_reinstalled',
    'initializer_repaired', 'task_adapter_implemented', 'upstream_task_compatible',
    'model_downloaded', 'model_instantiated', 'model_executed', 'provider_api_called',
    'user_credentials_used', 'hub_dataset_loaded', 'scoring_or_judge_called',
    'evaluation_dispatched', 'benchmark_score_established', 'novelty_established',
    'production_ready', 'release_authorized', 'standards_authorized', 'merge_authorized',
)}
CREDENTIALS = ('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY',
               'HF_TOKEN', 'HUGGING_FACE_HUB_TOKEN', 'AZURE_OPENAI_API_KEY',
               'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'GOOGLE_APPLICATION_CREDENTIALS')
OFFLINE = ('HF_HUB_OFFLINE', 'HF_DATASETS_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_HUB_DISABLE_TELEMETRY')


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def encode(value):
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def git(repo, *args):
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(repo), *args], text=True).strip()


def canonical(name):
    return re.sub(r'[-_.]+', '-', name).lower()


def read_bound(path, expected):
    require(path.is_file() and not path.is_symlink(), 'REGULAR_FILE_REQUIRED:' + path.name)
    data = path.read_bytes()
    require(sha(data) == expected, 'HASH_MISMATCH:' + path.name)
    return data


def exact(a, b):
    require(a == b, 'BYTE_IDENTITY_MISMATCH')


def boundary(repo):
    git(repo, 'merge-base', '--is-ancestor', BASE, 'HEAD')
    for version, tree in [('v0.13', TREE13), ('v0.12', TREE12)]:
        require(git(repo, 'rev-parse', f'HEAD:{ROOT}/{version}') == tree, 'HISTORICAL_TREE_CHANGED:' + version)
    for line in git(repo, 'diff', '--no-renames', '--name-status', BASE, 'HEAD').splitlines():
        status, path = line.split('\t', 1)
        require(status == 'A' and (path.startswith(ROOT + '/v0.14/') or path == WF), 'NON_ADDITIVE_OR_PROTECTED_DIFF:' + path)
    require(not git(repo, 'diff', '--name-only', '--', ROOT), 'TRACKED_RESEARCH_WORKTREE_CHANGED')
    read_bound(repo / PROFILE['lock_path'], LOCK_SHA)
    project = ROOT + '/v0.10/lock-project/pyproject.toml'
    require(blob((repo / project).read_bytes()) == git(repo, 'rev-parse', BASE + ':' + project), 'OLD_PROJECT_CHANGED')
    exact((repo / ROOT / 'v0.14/environment-profile.json').read_bytes(), encode(PROFILE))
    old = json.loads(read_bound(repo / ROOT / 'v0.14/history/v013-namespace-ownership.json', OLD_OWNERSHIP))
    require(old['conflicting_record_claims'] is True, 'HISTORICAL_COLLISION_ERASED')


def isolated():
    require(platform.python_version() == '3.12.14' and platform.machine() == 'x86_64', 'EXACT_RUNTIME_REQUIRED')
    require(os.geteuid() != 0 and sys.flags.isolated == 1, 'NON_ROOT_ISOLATED_PYTHON_REQUIRED')
    require(sys.prefix != sys.base_prefix, 'FRESH_VENV_REQUIRED')
    parent = os.environ.get('MATAWAKA_PARENT_NETNS')
    require(parent and parent != os.readlink('/proc/self/ns/net'), 'SEPARATE_NETWORK_NAMESPACE_REQUIRED')
    interfaces = sorted(line.split(':', 1)[0].strip() for line in Path('/proc/net/dev').read_text().splitlines() if ':' in line)
    require(interfaces == ['lo'], 'UNEXPECTED_NETWORK_INTERFACES')
    require(not any(os.environ.get(k) for k in CREDENTIALS), 'CREDENTIAL_PRESENT')
    require(all(os.environ.get(k) == '1' for k in OFFLINE), 'OFFLINE_FLAGS_REQUIRED')


def check_inventory(inventory, locked):
    require('statebench-lm-eval' not in inventory, 'EXCLUDED_DISTRIBUTION_PRESENT')
    require(len(inventory) == PROFILE['expected_installed_distributions'], 'INSTALLED_MEMBERSHIP_COUNT_MISMATCH')
    require(all((name, version) in locked for name, version in inventory.items()), 'UNLOCKED_INSTALLED_DISTRIBUTION')
    require(inventory.get('lm-eval') == '0.4.13' and inventory.get('statebench') == '2.0.0', 'CORE_DISTRIBUTION_MISSING')


def requirements_closure(distributions, inventory):
    from packaging.markers import default_environment
    from packaging.requirements import Requirement
    environment = default_environment()
    queue = deque((name, '') for name in sorted(inventory))
    queue.append(('lm-eval', 'hf'))
    visited, edges = set(), set()
    while queue:
        name, extra = queue.popleft()
        if (name, extra) in visited:
            continue
        visited.add((name, extra))
        for value in distributions[name].requires or []:
            req = Requirement(value)
            if req.marker and not req.marker.evaluate({**environment, 'extra': extra}):
                continue
            target = canonical(req.name)
            require(target in inventory, 'ACTIVE_RUNTIME_REQUIREMENT_MISSING:' + name + ':' + target)
            require(not req.specifier or req.specifier.contains(inventory[target], prereleases=True), 'ACTIVE_RUNTIME_REQUIREMENT_VERSION_MISMATCH:' + name + ':' + target)
            edges.add((name, extra, target, str(req.specifier), str(req.url or ''), ','.join(sorted(req.extras))))
            for requested in sorted(req.extras):
                queue.append((target, requested))
    return [list(edge) for edge in sorted(edges)]


def logical_path(value):
    p = PurePosixPath(value)
    require(not p.is_absolute() and '\\' not in value and '..' not in p.parts and p.parts and p.parts[0] == 'lm_eval', 'NONCANONICAL_NAMESPACE_PATH')
    require(p.as_posix() == value, 'NONCANONICAL_NAMESPACE_PATH')
    return p


def check_claims(claims, files):
    require(claims and set(claims) == set(files), 'MISSING_OR_UNOWNED_NAMESPACE_FILE')
    for name, owners in claims.items():
        logical_path(name)
        require(len(owners) == 1 and owners[0]['owner'] == 'lm-eval', 'NAMESPACE_OWNERSHIP_CONFLICT:' + name)
        item = owners[0]
        require(item['declared_sha256'] == files[name]['sha256'], 'NAMESPACE_RECORD_HASH_MISMATCH:' + name)
        require(item['declared_bytes'] == files[name]['bytes'], 'NAMESPACE_RECORD_SIZE_MISMATCH:' + name)


def observe(repo):
    isolated()
    boundary(repo)
    require(not any(n == 'lm_eval' or n.startswith('lm_eval.') for n in sys.modules), 'OBSERVER_IMPORTED_TARGET_NAMESPACE')
    purelib = Path(sysconfig.get_path('purelib')).resolve()
    require(purelib.is_relative_to(Path(sys.prefix).resolve()), 'SITE_PACKAGES_OUTSIDE_VENV')
    namespace = purelib / 'lm_eval'
    require(namespace.is_dir() and not namespace.is_symlink(), 'NAMESPACE_NOT_REGULAR_DIRECTORY')
    distributions = {}
    for dist in metadata.distributions():
        name = canonical(dist.metadata['Name'])
        require(name not in distributions, 'DUPLICATE_DISTRIBUTION:' + name)
        require(Path(dist.locate_file('')).resolve() == purelib, 'DISTRIBUTION_OUTSIDE_SELECTED_VENV:' + name)
        distributions[name] = dist
    inventory = {name: dist.version for name, dist in sorted(distributions.items())}
    locked = {(canonical(p['name']), p['version']) for p in tomllib.loads(read_bound(repo / PROFILE['lock_path'], LOCK_SHA).decode())['package']}
    check_inventory(inventory, locked)
    direct = json.loads(distributions['statebench'].read_text('direct_url.json') or '{}')
    require(direct.get('vcs_info', {}).get('commit_id') == UPSTREAM, 'STATEBENCH_DIRECT_SOURCE_COMMIT_MISMATCH')
    edges = requirements_closure(distributions, inventory)
    claims = defaultdict(list)
    for owner, dist in sorted(distributions.items()):
        require(dist.files is not None, 'DISTRIBUTION_RECORD_UNAVAILABLE:' + owner)
        for entry in dist.files:
            located = Path(dist.locate_file(entry))
            # Resolve every claim, including aliases, before selecting the namespace.
            if not located.resolve().is_relative_to(namespace):
                continue
            name = entry.as_posix()
            logical_path(name)
            require(not located.is_symlink(), 'SYMLINKED_RECORD_FILE:' + name)
            if '__pycache__' in entry.parts or entry.suffix == '.pyc':
                continue  # Generated bytecode is explicitly outside the source census.
            require(entry.hash is not None and entry.hash.mode == 'sha256' and type(entry.size) is int, 'HASHED_RECORD_REQUIRED:' + name)
            declared = base64.urlsafe_b64decode(entry.hash.value + '=' * (-len(entry.hash.value) % 4)).hex()
            claims[name].append({'owner': owner, 'declared_sha256': declared, 'declared_bytes': entry.size})
    files = {}
    for path in sorted(namespace.rglob('*')):
        require(not path.is_symlink(), 'SYMLINK_IN_NAMESPACE')
        if not path.is_file() or '__pycache__' in path.parts or path.suffix == '.pyc':
            continue
        data = path.read_bytes()
        files[path.relative_to(purelib).as_posix()] = {'sha256': sha(data), 'bytes': len(data)}
    check_claims(claims, files)
    for relative, expected in CRITICAL.items():
        require(blob((namespace / relative).read_bytes()) == expected, 'CRITICAL_UPSTREAM_SOURCE_MISMATCH:' + relative)
    return {'schema': 'matawaka.namespace-safe-record-census/v0.14', 'status': 'SINGLE_OWNER_VERIFIED',
            'scope': 'lm_eval/', 'generated_bytecode_excluded': True,
            'installed_distributions': inventory, 'active_requirements': edges,
            'statebench_source_commit': UPSTREAM, 'excluded_distribution_present': False,
            'namespace_file_count': len(files), 'namespace_files': files,
            'namespace_owner': 'lm-eval', 'conflicting_or_unowned_files': [],
            'critical_source_blobs': CRITICAL, 'record_hash_and_size_verified': True}


def imports():
    isolated()
    attempts = []
    def denied(*args, **kwargs):
        attempts.append('socket'); raise RuntimeError('NETWORK_DENIED')
    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.socket.sendto = denied
    socket.create_connection = denied
    socket.getaddrinfo = denied
    def profile(frame, event, arg):
        if event != 'call':
            return
        mod, name = frame.f_globals.get('__name__', ''), frame.f_code.co_name
        if ((mod.startswith('lm_eval.models') and name in {'__init__', 'generate_until', 'loglikelihood'})
            or (mod.startswith('transformers') and name == 'from_pretrained')
            or (mod == 'datasets.load' and name == 'load_dataset')
            or (mod in {'openai._client', 'anthropic._client'} and name == '__init__')
            or (mod.startswith('lm_eval.evaluator') and name in {'evaluate', 'simple_evaluate'})):
            attempts.append(mod + '.' + name); raise RuntimeError('FORBIDDEN_RUNTIME_CALL')
    sys.setprofile(profile)
    try:
        from lm_eval.tasks import TaskManager
        from lm_eval.tasks.manager import TaskManager as implementation
        from lm_eval.api.task import ConfigurableTask
        from lm_eval.tasks._yaml_loader import load_yaml
        require(TaskManager is implementation, 'PUBLIC_TASKMANAGER_EXPORT_DIFFERS')
        root = Path(sysconfig.get_path('purelib')).resolve() / 'lm_eval'
        for name, module in list(sys.modules.items()):
            if name == 'lm_eval' or name.startswith('lm_eval.'):
                origin = getattr(module, '__file__', None)
                require(origin and Path(origin).resolve().is_relative_to(root), 'SHADOWED_LM_EVAL_MODULE:' + name)
        for relative, expected in CRITICAL.items():
            require(blob((root / relative).read_bytes()) == expected, 'IMPORTED_NAMESPACE_SOURCE_CHANGED')
        require(not attempts, 'FORBIDDEN_IMPORT_EFFECT')
        return {'schema': 'matawaka.namespace-safe-import/v0.14', 'status': 'PUBLIC_TASKMANAGER_IMPORT_PASS',
                'public_export_matches_implementation': True, 'isolated_interpreter': True,
                'network_namespace_verified': True, 'non_root': True,
                'constructor_or_task_loading_called': False, 'forbidden_attempts': [],
                'critical_source_blobs': CRITICAL,
                'exports': {'TaskManager': TaskManager.__module__, 'ConfigurableTask': ConfigurableTask.__module__, 'load_yaml': load_yaml.__module__}}
    finally:
        sys.setprofile(None)


def finish(repo, evidence):
    boundary(repo)
    before = (evidence / 'namespace-before.json').read_bytes()
    exact(before, (evidence / 'namespace-after.json').read_bytes())
    import_before = (evidence / 'imports-before.json').read_bytes()
    exact(import_before, (evidence / 'imports-after.json').read_bytes())
    census, imported = json.loads(before), json.loads(import_before)
    require(census['status'] == 'SINGLE_OWNER_VERIFIED' and imported['status'] == 'PUBLIC_TASKMANAGER_IMPORT_PASS', 'ENVIRONMENT_PROBE_NOT_PASS')
    require(census['conflicting_or_unowned_files'] == [] and census['excluded_distribution_present'] is False, 'NAMESPACE_NOT_SAFE')
    for name, expected in EXPECTED_REPLAY.items():
        read_bound(evidence / name, expected)
    task = json.loads((evidence / 'v013/results.json').read_bytes())
    require(task['compatibility'] == 'NONPASS', 'OLD_TASK_NONPASS_PROMOTED')
    result = {'schema': 'matawaka.namespace-safe-environment-result/v0.14',
              'status': 'NAMESPACE_SAFE_SELECTED_ENVIRONMENT_EXECUTED_PASS',
              'blocked_predecessor': BASE, 'historical_v013_remains_blocked': True,
              'environment_profile_sha256': sha(encode(PROFILE)),
              'installed_distribution_count': len(census['installed_distributions']),
              'namespace_file_count': census['namespace_file_count'],
              'namespace_census_sha256': sha(before), 'imports_sha256': sha(import_before),
              'before_after_namespace_equal': True, 'two_fresh_interpreter_imports_equal': True,
              'replayed_probe_hashes': EXPECTED_REPLAY,
              'task_compatibility': 'NONPASS', 'source_plugin_not_installed_as_distribution': True,
              'old_root_full_dependency_installation_claimed': False, 'non_effects': NON_EFFECTS}
    print('NAMESPACE_FILES=' + str(census['namespace_file_count']))
    return result


class Hostile(unittest.TestCase):
    def record(self):
        return {'lm_eval/a.py': [{'owner': 'lm-eval', 'declared_sha256': 'abc', 'declared_bytes': 3}]}, {'lm_eval/a.py': {'sha256': 'abc', 'bytes': 3}}
    def test_single_owner(self):
        check_claims(*self.record())
    def test_conflicting_owner(self):
        c, f = self.record(); c['lm_eval/a.py'].append({'owner': 'plugin', 'declared_sha256': 'other', 'declared_bytes': 0})
        with self.assertRaises(ValueError): check_claims(c, f)
    def test_same_bytes_second_owner(self):
        c, f = self.record(); c['lm_eval/a.py'].append(c['lm_eval/a.py'][0].copy())
        with self.assertRaises(ValueError): check_claims(c, f)
    def test_wrong_single_owner(self):
        c, f = self.record(); c['lm_eval/a.py'][0]['owner'] = 'other'
        with self.assertRaises(ValueError): check_claims(c, f)
    def test_changed_content(self):
        c, f = self.record(); f['lm_eval/a.py']['sha256'] = 'other'
        with self.assertRaises(ValueError): check_claims(c, f)
    def test_changed_length(self):
        c, f = self.record(); f['lm_eval/a.py']['bytes'] = 0
        with self.assertRaises(ValueError): check_claims(c, f)
    def test_unowned_file(self):
        c, f = self.record(); f['lm_eval/extra.py'] = f['lm_eval/a.py']
        with self.assertRaises(ValueError): check_claims(c, f)
    def test_missing_file(self):
        c, f = self.record(); f.clear()
        with self.assertRaises(ValueError): check_claims(c, f)
    def test_empty_census(self):
        with self.assertRaises(ValueError): check_claims({}, {})
    def test_path_traversal(self):
        with self.assertRaises(ValueError): logical_path('lm_eval/../other')
    def test_absolute_path(self):
        with self.assertRaises(ValueError): logical_path('/lm_eval/a.py')
    def test_noncanonical_path(self):
        for p in ('lm_eval//a.py', 'lm_eval/./a.py', 'lm_eval\\a.py', 'other/a.py'):
            with self.subTest(path=p), self.assertRaises(ValueError): logical_path(p)
    def test_plugin_exclusion(self):
        with self.assertRaises(ValueError): check_inventory({'statebench-lm-eval': '0.1.0'}, set())
    def test_membership_count(self):
        with self.assertRaises(ValueError): check_inventory({}, set())
    def test_unlocked_version(self):
        inventory = {'p' + str(i): '1' for i in range(127)} | {'lm-eval': '0.4.13', 'statebench': '2.0.0'}
        with self.assertRaises(ValueError): check_inventory(inventory, set())
    def test_byte_identity(self):
        exact(b'NONPASS\n', b'NONPASS\n')
    def test_status_promotion(self):
        with self.assertRaises(ValueError): exact(b'PASS\n', b'NONPASS\n')
    def test_semantic_not_byte_identity(self):
        with self.assertRaises(ValueError): exact(b'{"a":1}', b'{"a": 1}')
    def test_fixed_profile(self):
        self.assertFalse(PROFILE['full_original_project_sync_claimed'])
        self.assertEqual(PROFILE['excluded_distributions'], ['statebench-lm-eval'])
        self.assertTrue(all(v is False for v in NON_EFFECTS.values()))
    def test_historical_nonpass_binding(self):
        self.assertEqual(EXPECTED_REPLAY['v013/results.json'], '2528206426613f1efce19ff3f4dab17a1daac34f828af37df021c054e78c16d8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['self-test', 'boundary', 'observe', 'imports', 'finish'])
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--output', type=Path)
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    if args.command == 'self-test':
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Hostile))
        raise SystemExit(0 if result.wasSuccessful() else 1)
    if args.command == 'boundary':
        boundary(args.repo.resolve()); print('V014_EXACT_BLOCKED_PREDECESSOR_AND_ADDITIVE_SCOPE_PASS'); return
    require(args.output is not None and not args.output.exists(), 'FRESH_OUTPUT_REQUIRED')
    try:
        if args.command == 'observe':
            result = observe(args.repo.resolve())
        elif args.command == 'imports':
            result = imports()
        else:
            require(args.evidence is not None, 'FRESH_EVIDENCE_REQUIRED')
            result = finish(args.repo.resolve(), args.evidence.resolve())
    except Exception as exc:
        failure = {'schema': 'matawaka.namespace-safe-environment-failure/v0.14', 'status': 'INCONCLUSIVE_OR_NONPASS',
                   'stage': args.command, 'failure_type': type(exc).__name__, 'failure_detail': str(exc)[:1500]}
        args.output.write_bytes(encode(failure))
        print(json.dumps(failure, sort_keys=True)); raise SystemExit(1)
    data = encode(result)
    with args.output.open('xb') as out:
        out.write(data)
    print(args.output.name + ' SHA256=' + sha(data))


if __name__ == '__main__':
    main()
