# SPDX-License-Identifier: Apache-2.0
"""Emit one expectation from a pinned historical manifest; never from a CI report."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

PREFIX = 'tools/harness_assurance/v0_1/ci/'
MANIFEST_SHA256 = '30cbd302ac6692386148ae6c8ad5b5a386a53cec7bfd1128e71ca71703648494'
SOURCE = 'a57c8923552972a9dd2318d5ddbc4db2aba20ac7'
TREE = 'b20fe5327430498e0d492590a39ebd7aed7f6d90'
WORKFLOW = '.github/workflows/harness-assurance-v0.1.yml'


def expectation(root: Path) -> dict:
    data = (root / (PREFIX+'manifest.json')).read_bytes()
    if hashlib.sha256(data).hexdigest() != MANIFEST_SHA256:
        raise ValueError('historical_manifest_changed')
    manifest = json.loads(data)
    pins = manifest['source_files']
    expected = {'schema':'matawaka.ci-reader.expectation/v0.1',
        'repository':'Matawaka/uu-aap','repository_id':1342444825,
        'run_id':36316768214,'attempt':1,'source_sha':SOURCE,'source_tree':TREE,
        'workflow_path':WORKFLOW,'event':'pull_request',
        'source_checkpoint':manifest['source_checkpoint'],'source_pins':pins,
        'ci_source_hashes':{PREFIX+'run_ci.py':pins[PREFIX+'run_ci.py'],
            PREFIX+'test_ci_gate.py':pins[PREFIX+'test_ci_gate.py'],
            PREFIX+'manifest.json':MANIFEST_SHA256,
            WORKFLOW:'a01d261d01af3d29645016b414fdc932e8c3bb11a94f2d5c6957be7672fb534c'},
        'import_surface':sorted(p for p in pins if p.startswith('tools/harness_assurance/v0_1/') and p.endswith('.py')),
        'test_ids':{'ha1_tests':manifest['test_ids'],'ci_gate_tests':manifest['ci_test_ids']},
        'mutants':{k:manifest[k] for k in ('original_mutants','review_mutants')},'jobs':[]}
    for slot,py,jid,aid,digest in [
        ('py312','3.12',108612828145,10931196274,'83d09741736f41a7895cb12b1f2a821d953056f50415bbb55424f22fde79cf88'),
        ('py313','3.13',108612827991,10930892944,'3fb49a2560f828e55d78fd9e0b84569113d7ef3a4b078824640527b206bb8c42')]:
        expected['jobs'].append({'slot':slot,'job_id':jid,'name':'HA-1 / Python '+py,
            'python_prefix':py,'artifact_id':aid,'artifact_name':f'ha1-ci-36316768214-1-py{py}',
            'archive_sha256':digest,'execution_step':'Execute exact HA-1 inventory and CI guard checks'})
    return expected


if __name__ == '__main__':
    try:
        print(json.dumps(expectation(Path(__file__).resolve().parents[3]), indent=2))
    except (OSError,ValueError,KeyError):
        raise SystemExit('SMOKE_EXPECTATION_UNAVAILABLE')
