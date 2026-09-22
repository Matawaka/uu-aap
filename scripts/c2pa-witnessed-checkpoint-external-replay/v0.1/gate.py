#!/usr/bin/env python3
"""Assemble a bounded readiness receipt from actually executed replay/test outputs."""
import argparse
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
HASH = '56fb5783904e8b75c1ddd7ed5d13acba111aaf671b8ec2612cec85d3d86e672e'
SEMANTIC = '39ad8a08ac1637d5afebdccf444aee39eb65ccfea18139a903b03375f9234480'


def load(p):
    return json.loads(Path(p).read_text(encoding='utf-8'))


def require(ok, message):
    if not ok:
        raise ValueError(message)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', required=True)
    ap.add_argument('--live', required=True)
    ap.add_argument('--tests', required=True)
    ap.add_argument('--output', required=True)
    a = ap.parse_args()
    offline, live = load(a.offline), load(a.live)
    require(offline['classification'] == 'OFFLINE_CRYPTO_AND_REPORTED_C2PA_BINDING_REPLAY_PASS', 'OFFLINE_REPLAY')
    require(live['classification'] == 'FRESH_LOCAL_SUCCESSOR_C2PA_AND_INDEPENDENT_BINDING_REPLAY_PASS', 'LIVE_REPLAY')
    for obj in [offline, live]:
        require(obj['bundle_sha256'] == HASH and obj['semantic_fingerprint_sha256'] == SEMANTIC, 'IDENTITY_DRIFT')
        require(obj['external_reviewer_execution'] is False, 'EXTERNAL_REVIEW_PROMOTION')
        require(obj['predecessor_verifier_imported'] is False, 'SHARED_VERIFIER')
    require(offline['historical_receipt_used_as_oracle'] is False, 'ORACLE_PROMOTION')
    require(offline['historical_c2pa_asset_revalidated'] is False, 'HISTORICAL_ASSET_PROMOTION')
    require(live['historical_successor_asset_revalidated'] is False, 'HISTORICAL_LIVE_PROMOTION')
    require(live['fresh_successor_sdk_validation'] is True and live['public_log_or_witness_write'] is False, 'LIVE_BOUNDARY')
    require(not any(offline['claims'].values()), 'NONCLAIM_PROMOTION')
    tap = Path(a.tests).read_text(encoding='utf-8')
    values = {key: int(re.search(r'^# ' + key + r' (\d+)$', tap, re.M).group(1)) for key in ['tests', 'pass', 'fail', 'skipped', 'cancelled']}
    require(values['tests'] == values['pass'] == 83, 'TEST_COUNT')
    require(values['fail'] == values['skipped'] == values['cancelled'] == 0, 'TEST_RESULT')
    files = {}
    for name in ['bundle.json', 'inputs.json', 'pins.json', 'successor-config.json', 'historical-receipt.json', 'verify.mjs', 'test.mjs', 'live-replay.py', 'gate.py']:
        raw = (HERE / name).read_bytes()
        files[name] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    pins = load(HERE / 'pins.json')
    require(all(files[name] == pin for name, pin in pins.items()), 'FROZEN_INPUT_PIN')
    require(files['historical-receipt.json']['sha256'] == 'e9c1ecbfefc9fdd7c1e53768b62ecc0f57197a6ac3e6d13e3ade1d662eda01f4', 'PREDECESSOR_RECEIPT')
    receipt = {
        'schema': 'urn:uu-aap:c2pa-external-replay-readiness:0.1',
        'tracking_issue': 1009,
        'accepted_predecessor': '06b6d9b194938a1d6de21d9958b67f264ea47c25',
        'files': files,
        'bundle_sha256': HASH,
        'semantic_fingerprint_sha256': SEMANTIC,
        'offline_crypto_and_report_binding_replayed': True,
        'fresh_local_successor_sdk_validation_replayed': True,
        'historical_successor_asset_revalidated': False,
        'historical_receipt_used_as_oracle': False,
        'predecessor_source_imported_by_verifier': False,
        'hostile_and_positive_tests': values,
        'external_reviewer_execution': False,
        'external_review_status': 'AWAITING_ACTUAL_REVIEWER_OWNED_EXECUTION',
        'public_spec_gate': 'CLOSED_PENDING_EXTERNAL_REVIEW',
        'witness_state_transition_replayed': False,
        'honest_intersection_with_one_fault_guaranteed': False,
        'tool_archive_sha256': live['tool_archive_sha256'],
        'raw_live_execution_bytes_are_run_specific': True,
        'public_log_or_witness_write': False,
        'classification': 'PORTABLE_EXTERNAL_REPLAY_PACKAGE_READY',
    }
    preimage = json.dumps(receipt, sort_keys=True, separators=(',', ':')).encode()
    receipt['receipt_fingerprint_sha256'] = hashlib.sha256(preimage).hexdigest()
    Path(a.output).write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
