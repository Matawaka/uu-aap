# SPDX-License-Identifier: Apache-2.0
"""Pack two caller-selected snapshots and re-assess them offline; never extract."""
from __future__ import annotations

import argparse
import html
import importlib.util
import io
import json
from pathlib import Path
import re
import stat
import zipfile
import zlib

_spec = importlib.util.spec_from_file_location('bundle_comparison', Path(__file__).with_name('compare.py'))
x = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(x)
r = x.r
SCHEMA = 'matawaka.ci-reader.bundle/v0.1'
SIDES = ('before', 'after')
SLOTS = ('py312', 'py313')
REQUIRED = {side + '/' + name for side in SIDES for name in ('expectation.json', 'capture.json')}
OPTIONAL = {side + '/' + slot + '.zip' for side in SIDES for slot in SLOTS}
ALLOWED = REQUIRED | OPTIONAL | {'manifest.json'}
MAX_MANIFEST = 65_536
MAX_TOTAL = 8 * r.MAX_BYTES + MAX_MANIFEST
MAX_BUNDLE = MAX_TOTAL + 4096


def pack(before: tuple, after: tuple) -> bytes:
    """Retain exact selected input bytes, including incomplete evidence."""
    members = {}
    for side, snapshot in zip(SIDES, (before, after)):
        expected, captured, archives = snapshot
        r.require(type(archives) is dict and set(archives) <= set(SLOTS), 'bundle_archive_slots')
        members[side + '/expectation.json'] = expected
        members[side + '/capture.json'] = captured
        members.update({side + '/' + slot + '.zip': blob for slot, blob in archives.items()})
    for blob in members.values():
        r.require(type(blob) is bytes and len(blob) <= r.MAX_BYTES, 'bundle_member_limit')
    manifest = {'schema': SCHEMA, 'files': {
        name: {'bytes': len(blob), 'sha256': r.sha(blob)} for name, blob in sorted(members.items())}}
    members['manifest.json'] = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    r.require(len(members['manifest.json']) <= MAX_MANIFEST, 'bundle_manifest_limit')
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, blob in sorted(members.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, blob)
    data = output.getvalue()
    r.require(len(data) <= MAX_BUNDLE, 'bundle_limit')
    return data


def read_bundle(data: bytes, expected_sha256: str | None = None) -> tuple:
    """Check fixed member names, byte limits and hashes without filesystem writes."""
    r.require(type(data) is bytes and len(data) <= MAX_BUNDLE, 'bundle_limit')
    if expected_sha256 is not None:
        r.require(type(expected_sha256) is str and
                  re.fullmatch('[0-9a-f]{64}', expected_sha256), 'bundle_pin_invalid')
        r.require(r.sha(data) == expected_sha256, 'bundle_pin_mismatch')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        infos = archive.infolist()
        r.require(len(infos) <= len(ALLOWED), 'bundle_member_count')
        names = [info.filename for info in infos]
        r.require(len(names) == len(set(names)), 'bundle_duplicate_member')
        r.require(REQUIRED | {'manifest.json'} <= set(names) <= ALLOWED, 'bundle_member_set')
        total = 0
        for info in infos:
            r.require(info.orig_filename == info.filename and not info.is_dir(), 'bundle_member_refused')
            r.require(stat.S_IFMT(info.external_attr >> 16) in (0, stat.S_IFREG), 'bundle_nonregular')
            r.require(not info.flag_bits & 1, 'bundle_encrypted')
            r.require(info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'bundle_compression')
            limit = MAX_MANIFEST if info.filename == 'manifest.json' else r.MAX_BYTES
            r.require(0 <= info.file_size <= limit, 'bundle_member_limit')
            total += info.file_size
        r.require(total <= MAX_TOTAL, 'bundle_total_limit')
        members = {info.filename: archive.read(info) for info in infos}
    manifest = r.parse(members.pop('manifest.json'))
    r.require(set(manifest) == {'schema', 'files'} and manifest['schema'] == SCHEMA, 'bundle_manifest_shape')
    inventory = manifest['files']
    r.require(type(inventory) is dict and set(inventory) == set(members), 'bundle_inventory_mismatch')
    for name, blob in members.items():
        pin = inventory[name]
        r.require(type(pin) is dict and set(pin) == {'bytes', 'sha256'}, 'bundle_pin_shape')
        r.require(type(pin['bytes']) is int and pin['bytes'] == len(blob), 'bundle_size_mismatch')
        r.require(type(pin['sha256']) is str and re.fullmatch('[0-9a-f]{64}', pin['sha256']), 'bundle_hash_shape')
        r.require(r.sha(blob) == pin['sha256'], 'bundle_hash_mismatch')
    snapshots = []
    for side in SIDES:
        prefix = side + '/'
        snapshots.append((members[prefix + 'expectation.json'], members[prefix + 'capture.json'],
                          {slot: members[prefix + slot + '.zip'] for slot in SLOTS
                           if prefix + slot + '.zip' in members}))
    return tuple(snapshots)


def view(data: bytes, expected_sha256: str | None = None) -> dict:
    before, after = read_bundle(data, expected_sha256)
    report = x.compare_packages(before, after)
    report['bundle'] = {
        'schema': SCHEMA, 'sha256': r.sha(data),
        'integrity': 'PINNED_HASH_MATCHED' if expected_sha256 is not None else 'INTERNAL_HASHES_MATCHED',
        'origin_authenticated': False, 'saved_reports_trusted': False,
        'meaning': 'CALLER_SELECTED_BYTES_REASSESSED_OFFLINE',
    }
    return report


def render_html(report: dict) -> str:
    bundle = report['bundle']
    esc = lambda value: html.escape(str(value), quote=True)
    detail = ('Пакет отклонён; оценка evidence не выполнена. Код: <code>' +
              esc(bundle.get('code', 'bundle_unreadable')) + '</code>'
              if bundle['integrity'] == 'REFUSED' else
              'Проверка хешей не устанавливает аутентичность источника. '
              'Ожидания выбраны вызывающей стороной. Результат рассчитан заново '
              'из сохранённых байтов.')
    panel = ('<section><strong>Целостность пакета:</strong> <code>' +
             esc(bundle['integrity']) + '</code><br><strong>SHA-256:</strong> <code>' +
             esc(bundle.get('sha256', '—')) + '</code><p>' + detail + '</p></section>')
    return x.render_html(report).replace('</h1>', '</h1>' + panel, 1)


def read_explicit(path: str) -> bytes:
    with Path(path).open('rb') as stream:
        data = stream.read(MAX_BUNDLE + 1)
    r.require(len(data) <= MAX_BUNDLE, 'bundle_limit')
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    packing = commands.add_parser('pack')
    packing.add_argument('--before', required=True)
    packing.add_argument('--after', required=True)
    packing.add_argument('--output', required=True)
    viewing = commands.add_parser('view')
    viewing.add_argument('bundle')
    viewing.add_argument('--sha256')
    viewing.add_argument('--format', choices=('json', 'html'), default='json')
    args = parser.parse_args()
    try:
        if args.command == 'pack':
            data = pack(x.read_package(args.before), x.read_package(args.after))
            with Path(args.output).open('xb') as stream:
                stream.write(data)
            print(json.dumps({'status': 'BUNDLE_WRITTEN', 'sha256': r.sha(data), 'bytes': len(data)}))
            return 0
        report = view(read_explicit(args.bundle), args.sha256)
    except (OSError, r.Invalid, ValueError, TypeError, KeyError, AttributeError,
            RecursionError, zipfile.BadZipFile, zipfile.LargeZipFile, zlib.error) as error:
        report = {'status': 'BUNDLE_REFUSED', 'scope': None, 'changes': [], 'jobs': [],
                  'non_effects': dict(r.NON_EFFECTS), 'bundle': {'integrity': 'REFUSED',
                  'code': str(error) if isinstance(error, r.Invalid) else 'bundle_unreadable',
                  'origin_authenticated': False}}
    print(render_html(report) if getattr(args, 'format', 'json') == 'html'
          else json.dumps(report, ensure_ascii=True, indent=2))
    return 0 if report['status'] in ('NO_OBSERVED_CHANGE', 'OBSERVED_CHANGE') else 2


if __name__ == '__main__':
    raise SystemExit(main())
