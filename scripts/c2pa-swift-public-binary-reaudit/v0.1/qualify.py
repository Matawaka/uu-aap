#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
import argparse, sys
from pathlib import Path
import reaudit
from inspect_reader import inspect

def qualify(out):
    out=Path(out); raw=(out/'receipt.json').read_bytes(); phase=reaudit.load(out/'receipt.json')
    paths={'classification':'NOT_EXECUTED'}
    observation=phase['observation']
    if observation['native'].get('stage')=='complete':
        paths=inspect(out)
        reaudit.check(paths['codec_extension_equal']==observation['codec_claim'].get('unknown_preserved'), 'codec/raw evidence mismatch')
        reaudit.check(paths['reader_json_extension_equal']==observation['native'].get('claim_preserved'), 'Reader/raw evidence mismatch')
        reaudit.check(paths['reader_json_external_reference_equal']==observation['native'].get('assertion_preserved'), 'assertion/raw evidence mismatch')
    reaudit.save(out/'reader-path-assessment.json',paths)
    receipt={'schema':'urn:uu-aap:swift-public-binary-qualification:0.1','tracking_issue':988,
        'repository_predecessor':reaudit.BASE,'target_id':phase['target_id'],'upstream_commit':phase['upstream_commit'],
        'binary_archive_sha256':reaudit.CHECKSUM,'binary_version':'0.0.13',
        'phase_receipt_sha256':reaudit.digest(raw),
        'resolved_lock_sha256':reaudit.digest((out/'Package.resolved').read_bytes()),
        'consumer_build':observation['consumer_build'],
        'codec_claim':observation['codec_claim']['status'],'codec_assertion':observation['codec_assertion']['status'],
        'reader_paths':paths,'classification':paths['classification'] if paths['classification']!='NOT_EXECUTED' else observation['classification'],
        'execution_scope':{'platform':(out/'platform.log').read_text().strip(),
            'swift':(out/'swift-version.log').read_text().strip(),'xcode':(out/'xcode-version.log').read_text().strip()},
        'android_executed':False,'source_built_native_executed':False,'external_reviewer_execution':False,
        'cross_sdk_compatibility_established':False,'c2pa_conformance':False,'trusted_signer':False,
        'authority_created':False,'historical_evidence_rewritten':False,'production_authority_expanded':False}
    receipt['receipt_fingerprint_sha256']=reaudit.digest(reaudit.encoded(receipt))
    reaudit.save(out/'qualification-receipt.json',receipt)
    return receipt

def main():
    p=argparse.ArgumentParser(); p.add_argument('--target',choices=reaudit.TARGETS,required=True)
    p.add_argument('--repo',required=True); p.add_argument('--out',required=True); a=p.parse_args()
    try:
        reaudit.run_target(a.target,Path(a.repo).resolve(),Path(a.out).resolve())
        print(reaudit.encoded(qualify(a.out)).decode())
    except (ValueError,OSError,KeyError) as e:
        print('SWIFT_QUALIFICATION_FAIL_CLOSED: '+str(e),file=sys.stderr);return 1
    return 0
if __name__=='__main__':raise SystemExit(main())
