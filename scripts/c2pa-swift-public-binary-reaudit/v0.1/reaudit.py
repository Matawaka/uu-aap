#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""External public SwiftPM consumer, two exact targets; no upstream patches."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, struct, subprocess, sys, tempfile, zlib
from pathlib import Path

BASE = '260e325619ffd2eed12c43f982c369e6468d5f07'
TREE = 'e31aa59a911ae9d393721d6c74c7a906ba810865'
UPSTREAM = 'https://github.com/contentauth/c2pa-swift.git'
BINARY = 'https://github.com/contentauth/c2pa-swift/releases/download/v0.0.13/C2PAC.xcframework.zip'
CHECKSUM = '631ebb565d7f893dded6d99526067b3d901e209705c80d7be51be111a5aeefec'
TARGETS = {
    'release_frontier': '75312abc1d7f2e2be6964a4bdad7c98cdecb36d2',
    'current_main': '4a698825259ff1142df7de90d62a0d3f2f50b467',
}
OLD = 'scripts/c2pa-swift-upstream-merge-reaudit'
PINS = {
    f'{OLD}/fixtures/claim-generator-info.json': 'fe692ed23edef6ebbf58dd6f9bf871563c15b25e',
    f'{OLD}/fixtures/external-reference.json': 'b324c12d86ee82f02ef0fe0b71c9c7d215d40613',
    f'{OLD}/current-receipt.json': '357a92b96847251f4d4f974c432cc3fa9b3af40b',
    'scripts/c2pa-witnessed-checkpoint-external-replay/v0.1/qualification-receipt.json': 'eae4083459874ff0024b64a6faf44152671aae91',
}
HERE = Path(__file__).resolve().parent

def digest(b: bytes) -> str: return hashlib.sha256(b).hexdigest()
def blob(b: bytes) -> str: return hashlib.sha1(f'blob {len(b)}\0'.encode() + b).hexdigest()
def encoded(o) -> bytes: return (json.dumps(o, sort_keys=True, indent=2, ensure_ascii=False) + '\n').encode()
def save(path, o): Path(path).write_bytes(encoded(o))
def pairs(items):
    d = {}
    for k, v in items:
        if k in d: raise ValueError('duplicate JSON key: ' + k)
        d[k] = v
    return d

def load(path): return json.loads(Path(path).read_bytes(), object_pairs_hook=pairs)
def check(ok, reason):
    if not ok: raise ValueError(reason)

def summarize(resolve_rc, build_rc, log, probe):
    """Compatibility is derived from executed phases, never from a previous receipt."""
    missing = sorted(set(re.findall(r"cannot find '(c2pa_\w+)' in scope", log)))
    if resolve_rc != 0:
        check(build_rc is None and probe is None, 'runtime/build cannot precede successful resolution')
        build = 'NOT_EXECUTED'; overall = 'PACKAGE_RESOLUTION_FAILED'
    elif build_rc is None:
        raise ValueError('build observation missing')
    elif build_rc != 0:
        check(probe is None, 'failed build cannot carry a runtime PASS')
        # The runner additionally verifies origin and header absence of these symbols.
        overall = 'BLOCKED_SOURCE_BINARY_SKEW' if missing else 'BUILD_FAILED_OTHER'
        build = overall
    else:
        build = 'PASS'; overall = 'PROBE_RUNTIME_FAILED'
        if probe is not None:
            check(probe.get('schema') == 'urn:uu-aap:swift-public-consumer-probe:0.1', 'wrong probe schema')
            check(probe.get('claims') == {k: False for k in
                ('cross_sdk_compatibility','c2pa_conformance','trusted_signer','truth','authority','external_review')}, 'claim promotion')
            for k in ('codec_claim', 'codec_assertion', 'native'):
                check(probe.get(k, {}).get('status') in ('PASS','LOSSY','ERROR'), 'incomplete probe phase: ' + k)
            n = probe['native']
            if n['status'] in ('PASS', 'LOSSY'):
                check(all(n.get(k) is True for k in ('signed','reader_json_called','reader_crjson_called','crjson_parsed')), 'native phase not executed')
            if n['status'] == 'PASS':
                check(n.get('claim_preserved') is True and n.get('assertion_preserved') is True, 'native PASS lacks preservation')
            for name in ('codec_claim','codec_assertion'):
                if probe[name]['status'] == 'PASS':
                    fields = ('unknown_inspectable','unknown_preserved','no_promotion') if name == 'codec_claim' else ('generic_payload_preserved',)
                    check(all(probe[name].get(k) is True for k in fields), 'codec PASS unsupported')
            if any(probe[k]['status'] != 'PASS' for k in ('codec_claim','codec_assertion')):
                overall = 'CODEC_ROUNDTRIP_FAILED'
            elif n['status'] == 'PASS': overall = 'CODEC_AND_NATIVE_SIGN_READ_PRESERVATION_PASS'
            elif n['status'] == 'LOSSY': overall = 'NATIVE_SIGN_READ_LOSSY'
            else: overall = 'NATIVE_SIGN_OR_READ_FAILED'
    # Details and validation URLs remain in raw probe.json, not normalized away.
    codec = {k: (probe[k] if probe else {'status':'NOT_EXECUTED'}) for k in ('codec_claim','codec_assertion')}
    native = {'status':'NOT_EXECUTED'} if probe is None else {
        k:v for k,v in probe['native'].items() if k not in ('detail','validation_success_codes','validation_failure_codes')}
    return {'classification': overall, 'package_resolution': 'PASS' if resolve_rc == 0 else 'ERROR',
        'consumer_build': build, 'missing_c_symbols': missing, **codec, 'native': native}

def chunk(kind, payload):
    return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)
def png():
    ihdr = struct.pack('>IIBBBBB', 8, 8, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress((b'\0'+b'\xff\xff\xff'*8)*8)) + chunk(b'IEND', b'')

def run_target(target: str, repo: Path, out: Path):
    check(sys.platform == 'darwin', 'Apple binary consumer requires macOS, not Linux source emulation')
    check(target in TARGETS, 'unknown target')
    check(not out.exists(), 'fresh output directory required')
    out.mkdir(parents=True); work = Path(tempfile.mkdtemp(prefix='uu-aap-swift-'))
    consumer, fixture = work / 'consumer', out / 'fixtures'
    consumer.mkdir(); fixture.mkdir(); (consumer / 'Sources').mkdir()
    commands = []
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    for k in list(env):
        if k in ('GH_TOKEN','GITHUB_TOKEN','OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY'): env.pop(k, None)
    def cmd(name, args, cwd=consumer, timeout=1200):
        p = subprocess.run(args, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        (out / f'{name}.log').write_bytes(p.stdout)
        commands.append({'name':name, 'argv':args, 'exit_code':p.returncode, 'log_sha256':digest(p.stdout)})
        return p.returncode, p.stdout.decode('utf-8', errors='replace')
    try:
        for rel, pin in PINS.items(): check(blob((repo/rel).read_bytes()) == pin, 'predecessor pin drift: '+rel)
        for f in ('claim-generator-info.json','external-reference.json'):
            shutil.copyfile(repo / OLD / 'fixtures' / f, fixture / f)
        src = HERE / 'Probe.swift'; shutil.copyfile(src, consumer/'Sources/main.swift')
        manifest = '''// swift-tools-version:5.9
import PackageDescription
let package = Package(name: "UUAAPPreservation", platforms: [.macOS(.v14)],
 products: [.executable(name: "PreservationProbe", targets: ["PreservationProbe"])],
 dependencies: [.package(url: "%s", revision: "%s")],
 targets: [.executableTarget(name: "PreservationProbe", dependencies: [.product(name: "C2PA", package: "c2pa-swift")], path: "Sources")])
''' % (UPSTREAM, TARGETS[target])
        (consumer/'Package.swift').write_text(manifest); (out/'Package.swift').write_text(manifest)
        lock = HERE / 'locks' / (target + '.resolved')
        if lock.exists(): shutil.copyfile(lock, consumer/'Package.resolved')
        cmd('swift-version', ['swift','--version'], timeout=30)
        cmd('xcode-version', ['xcodebuild','-version'], timeout=30)
        cmd('platform', ['sw_vers'], timeout=30)
        # Verify the published artifact independently; SwiftPM must also verify its selection.
        archive = work/'C2PAC.zip'
        rc, _ = cmd('archive-download', ['curl','--fail','--location','--silent','--show-error','--proto','=https','--max-time','180','--max-filesize','536870912',BINARY,'-o',str(archive)], timeout=200)
        check(rc == 0 and digest(archive.read_bytes()) == CHECKSUM, 'public C2PAC archive unavailable or checksum mismatch')
        resolve_rc, _ = cmd('resolve', ['swift','package','resolve'])
        build_rc, build_log, probe = None, '', None
        deps, source_pins, binary_files = [], {}, {}
        if resolve_rc == 0:
            resolved = load(consumer/'Package.resolved')
            deps = resolved.get('pins', resolved.get('object', {}).get('pins', []))
            check(deps, 'resolved dependency pins missing')
            check(any(p.get('identity') == 'c2pa-swift' and p.get('state',{}).get('revision') == TARGETS[target] for p in deps), 'wrong resolved SDK revision')
            shutil.copyfile(consumer/'Package.resolved', out/'Package.resolved')
            if lock.exists(): check(load(lock) == resolved, 'resolved dependency lock changed')
            checkout = consumer/'.build/checkouts/c2pa-swift'
            rc, actual = cmd('upstream-head', ['git','rev-parse','HEAD'], checkout, 30)
            check(rc == 0 and actual.strip() == TARGETS[target], 'upstream checkout revision mismatch')
            package_bytes = (checkout/'Package.swift').read_bytes()
            check(BINARY in package_bytes.decode() and CHECKSUM in package_bytes.decode(), 'SDK did not select pinned public C2PAC')
            for rel in ('Package.swift','Library/Sources/Reader.swift','Library/Sources/Builder.swift'):
                data = (checkout/rel).read_bytes(); source_pins[rel] = {'git_blob':blob(data),'sha256':digest(data)}
            artifacts = consumer/'.build/artifacts'
            for p in sorted(artifacts.rglob('*')):
                if p.is_file() and (p.suffix in ('.h','.a','.dylib') or p.name == 'module.modulemap'):
                    binary_files[str(p.relative_to(artifacts))] = {'sha256':digest(p.read_bytes()), 'bytes':p.stat().st_size}
            check(binary_files, 'resolved public binary evidence absent')
            build_rc, build_log = cmd('build', ['swift','build'])
            check(load(consumer/'Package.resolved') == resolved, 'dependency pins changed during build')
            if build_rc == 0:
                for upstream_name, local, expected in (
                    ('default_certs.pem','certs.pem','f24c51cd294aeefee2d8bff020f825768309796a'),
                    ('default_private.key','private.key','5e59fcc5e05eec74818af610042eb51ca02fb700')):
                    data = (checkout/'ExampleApp/Resources'/upstream_name).read_bytes()
                    check(blob(data) == expected, 'public signing test resource drift')
                    (fixture/local).write_bytes(data)
                (fixture/'source.png').write_bytes(png())
                record = b'{"fixture":"UU-AAP native preservation only","authority":false}\n'
                (fixture/'record.json').write_bytes(record)
                assertion = load(fixture/'external-reference.json')
                assertion['data']['location'].update(url='https://example.invalid/uu-aap/native-fixture.json',
                    hash=list(hashlib.sha256(record).digest()), size=len(record))
                save(fixture/'native-external-reference.json', assertion)
                rc, where = cmd('bin-path', ['swift','build','--show-bin-path'], timeout=60)
                check(rc == 0, 'cannot locate external consumer executable')
                exe = Path(where.strip())/'PreservationProbe'; check(exe.is_file(), 'executable missing')
                check(Path('/usr/bin/sandbox-exec').is_file(), 'native no-network sandbox unavailable')
                rc, _ = cmd('probe', ['/usr/bin/sandbox-exec','-p','(version 1) (allow default) (deny network*)',str(exe),str(fixture),str(out)], timeout=120)
                if rc == 0 and (out/'probe.json').is_file(): probe = load(out/'probe.json')
        summary = summarize(resolve_rc, build_rc, build_log, probe)
        if summary['classification'] == 'BLOCKED_SOURCE_BINARY_SKEW':
            headers = '\n'.join(p.read_text(errors='replace') for p in (consumer/'.build/artifacts').rglob('*.h'))
            sources = '\n'.join(p.read_text(errors='replace') for p in (consumer/'.build/checkouts/c2pa-swift/Library/Sources').rglob('*.swift'))
            check(all(s in sources and s not in headers for s in summary['missing_c_symbols']), 'symbol-skew cause not independently localized')
        receipt = {'schema':'urn:uu-aap:swift-public-binary-reaudit:0.1', 'tracking_issue':988,
            'repository_predecessor':BASE, 'target_id':target, 'upstream_commit':TARGETS[target],
            'public_binary':{'version':'0.0.13','url':BINARY,'archive_sha256':CHECKSUM},
            'upstream_source_pins':source_pins, 'resolved_dependencies':deps,
            'resolved_binary_files':binary_files, 'fixtures':{f:{'bytes':(fixture/f).stat().st_size,'sha256':digest((fixture/f).read_bytes())}
                for f in ('claim-generator-info.json','external-reference.json','native-external-reference.json','source.png','record.json') if (fixture/f).is_file()},
            'observation':summary, 'android_executed':False, 'source_built_native_executed':False,
            'external_reviewer_execution':False, 'cross_sdk_compatibility_established':False,
            'historical_evidence_rewritten':False, 'public_log_or_witness_write':False,
            'native_network_policy':'DENY_NETWORK_SANDBOX_REQUIRED_BEFORE_RUNTIME',
            'trusted_signer_claim':False, 'c2pa_conformance_claim':False, 'authority_created':False}
        receipt['receipt_fingerprint_sha256'] = digest(encoded(receipt))
        save(out/'receipt.json', receipt)
        print(json.dumps({'target':target, **summary}, indent=2))
    finally:
        # Raw logs/results are execution-specific, including generated signatures and failure details.
        files = {str(p.relative_to(out)):{'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())}
            for p in sorted(out.rglob('*')) if p.is_file()}
        save(out/'execution.json', {'commands':commands,'files':files,'swiftpm_workdir':str(consumer)})
        shutil.rmtree(work, ignore_errors=True)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--target', choices=TARGETS, required=True)
    ap.add_argument('--repo', required=True); ap.add_argument('--out', required=True)
    a=ap.parse_args()
    try: run_target(a.target, Path(a.repo).resolve(), Path(a.out).resolve())
    except (ValueError,OSError,subprocess.TimeoutExpired) as e:
        print('SWIFT_REAUDIT_NOT_QUALIFIED: '+str(e), file=sys.stderr); return 1
    return 0
if __name__=='__main__': raise SystemExit(main())
