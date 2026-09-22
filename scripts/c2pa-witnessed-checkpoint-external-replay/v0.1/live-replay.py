#!/usr/bin/env python3
"""New local C2PA execution, not a reconstruction of the historical successor bytes.
Requires Python >=3.12, Node >=22 and network for two hash-pinned public GETs.
No predecessor Python code, third-party Python modules, tokens or public writes.
"""
import argparse
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import threading
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
TOOL_URL = 'https://github.com/contentauth/c2pa-rs/releases/download/c2patool-v0.27.16/c2patool-v0.27.16-x86_64-unknown-linux-gnu.tar.gz'
TOOL_HASH = '62eed34f0c90a24b696b1969c8aad4340e11ec7264e1cf6fc375ad15c1db7663'
ASSET_URL = 'https://raw.githubusercontent.com/contentauth/c2pa-rs/c2patool-v0.27.16/sdk/tests/fixtures/C.jpg'
ASSET_BLOB = 'b6579b3281fbd448163f77fe46bf8d24f3e5a018'
MAX_FETCH = 64 * 1024 * 1024
ALLOWED_HOSTS = {'github.com', 'raw.githubusercontent.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def write(path, obj):
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + '\n', encoding='utf-8')


class HTTPSRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        p = urllib.parse.urlsplit(newurl)
        if p.scheme != 'https' or p.hostname not in ALLOWED_HOSTS:
            raise ValueError('FETCH_REDIRECT_OUT_OF_SCOPE')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, path):
    opener = urllib.request.build_opener(HTTPSRedirect())
    with opener.open(url, timeout=60) as response:
        data = response.read(MAX_FETCH + 1)
    if len(data) > MAX_FETCH:
        raise ValueError('FETCH_BYTE_LIMIT')
    path.write_bytes(data)
    return data


def run(command, out, env):
    result = subprocess.run(command, capture_output=True, timeout=120, env=env, check=False)
    out.write_bytes(result.stdout)
    out.with_suffix(out.suffix + '.stderr').write_bytes(result.stderr)
    if result.returncode:
        raise RuntimeError(f'COMMAND_FAILED:{Path(command[0]).name}:{result.returncode}:{out.name}')
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    output = Path(args.output_dir).resolve()
    # Never destroy or reuse someone else's directory or local HTTP endpoint.
    output.mkdir(parents=True, exist_ok=False)
    env = dict(os.environ)
    env['HOME'] = str(output / 'isolated-home')
    Path(env['HOME']).mkdir()
    settings = output / 'empty-settings.toml'
    settings.write_text('# Isolated test settings. No TSA URL or network signer configured.\n')
    bundle = (HERE / 'bundle.json').read_bytes()
    pins = json.loads((HERE / 'pins.json').read_text())
    for name in ['bundle.json', 'inputs.json', 'successor-config.json']:
        data = (HERE / name).read_bytes()
        if sha(data) != pins[name]['sha256'] or len(data) != pins[name]['bytes']:
            raise ValueError('PACKAGE_PIN_MISMATCH:' + name)
    if sha(bundle) != '56fb5783904e8b75c1ddd7ed5d13acba111aaf671b8ec2612cec85d3d86e672e':
        raise ValueError('HISTORICAL_BUNDLE_CHANGED')

    archive = output / 'c2patool.tar.gz'
    if sha(fetch(TOOL_URL, archive)) != TOOL_HASH:
        raise ValueError('TOOL_ARCHIVE_DIGEST')
    unpack = output / 'tool'
    unpack.mkdir()
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        if any(m.issym() or m.islnk() or not (m.isfile() or m.isdir()) for m in members):
            raise ValueError('UNEXPECTED_ARCHIVE_ENTRY')
        if sum(m.size for m in members) > 256 * 1024 * 1024:
            raise ValueError('ARCHIVE_EXPANSION_LIMIT')
        tar.extractall(unpack, filter='data')
    bins = [p for p in unpack.rglob('c2patool') if p.is_file()]
    if len(bins) != 1:
        raise ValueError('TOOL_BINARY_AMBIGUOUS')
    tool = bins[0]
    tool.chmod(0o700)
    version = run([str(tool), '--version'], output / 'tool-version.txt', env).decode().strip()
    if '0.27.16' not in version:
        raise ValueError('TOOL_VERSION_MISMATCH')
    parent = output / 'predecessor.jpg'
    data = fetch(ASSET_URL, parent)
    blob = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
    if blob != ASSET_BLOB or len(data) != 132518:
        raise ValueError('PREDECESSOR_ASSET_PIN')
    run([str(tool), str(parent), '--settings', str(settings)], output / 'predecessor-report.json', env)

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != '/witnessed-checkpoint-bundle.json':
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(bundle)))
            self.end_headers()
            self.wfile.write(bundle)
        def log_message(self, *args):
            pass
    server = http.server.HTTPServer(('127.0.0.1', 8765), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    successor = output / 'successor-update.jpg'
    try:
        local = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with local.open('http://127.0.0.1:8765/witnessed-checkpoint-bundle.json', timeout=5) as response:
            resolved = response.read(len(bundle) + 1)
            if response.headers.get_content_type() != 'application/json' or resolved != bundle:
                raise ValueError('LOOPBACK_RESOLUTION_MISMATCH')
        (output / 'resolved-bundle.json').write_bytes(resolved)
        run([str(tool), str(parent), '--settings', str(settings), '--manifest', str(HERE / 'successor-config.json'), '--update', '--output', str(successor)], output / 'signing-report.json', env)
        for name, extra in [('successor-report.json', []), ('successor-detailed.json', ['--detailed'])]:
            run([str(tool), str(successor), '--settings', str(settings), *extra], output / name, env)
        # A second implementation checks bindings in fresh reports, never an old PASS bit.
        raw = run(['node', str(HERE / 'verify.mjs'), '--reports', str(output)], output / 'independent-observation.json', env)
        observed = json.loads(raw)
        if observed['classification'] != 'CRYPTO_AND_FRESH_SDK_REPORT_BINDING_REPLAY_PASS':
            raise ValueError('INDEPENDENT_OBSERVATION_CLASS')
        result = {
            'schema': 'urn:uu-aap:c2pa-external-replay-live-observation:0.1',
            'classification': 'FRESH_LOCAL_SUCCESSOR_C2PA_AND_INDEPENDENT_BINDING_REPLAY_PASS',
            'original_historical_successor_bytes_available': False,
            'historical_successor_asset_revalidated': False,
            'fresh_successor_sdk_validation': True,
            'external_reviewer_execution': False,
            'public_log_or_witness_write': False,
            'predecessor_verifier_imported': False,
            'tool_version': version,
            'tool_archive_sha256': TOOL_HASH,
            'tool_binary_sha256': sha(tool.read_bytes()),
            'predecessor_asset_sha256': sha(data),
            'predecessor_git_blob': blob,
            'fresh_successor_asset_sha256': sha(successor.read_bytes()),
            'bundle_sha256': sha(bundle),
            'semantic_fingerprint_sha256': observed['semantic_fingerprint_sha256'],
            'reports': {name: sha((output / name).read_bytes()) for name in ['predecessor-report.json', 'successor-report.json', 'successor-detailed.json', 'independent-observation.json']},
            'signature_and_instance_bytes_may_vary_per_run': True,
        }
        write(output / 'live-observation.json', result)
        print(json.dumps(result, indent=2, sort_keys=True))
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        raise SystemExit('C2PA_EXTERNAL_LIVE_REPLAY_BLOCKED_OR_FAILED: ' + str(exc)) from exc
