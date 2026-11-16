# SPDX-License-Identifier: Apache-2.0
import io
import json
from pathlib import Path
import stat
import sys
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bundle
import core
import fixtures


class BundleTests(unittest.TestCase):
    def setUp(self):
        p, rows = fixtures.base()
        self.pb = json.dumps(p, indent=3).encode() + b"\n"
        self.ob = json.dumps(rows, indent=5).encode() + b"\n"
        self.data = bundle.pack(self.pb, self.ob)

    def restore(self, data):
        return bundle.restore(data, expected_policy_sha256=bundle.sha(self.pb))

    def rewrite(self, mutate):
        with zipfile.ZipFile(io.BytesIO(self.data)) as archive:
            members = {info.filename: archive.read(info) for info in archive.infolist()}
        mutate(members)
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            for name, value in members.items():
                info = zipfile.ZipInfo(name)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o600) << 16
                archive.writestr(info, value)
        return stream.getvalue()

    def test_raw_bytes_restored_exactly(self):
        result = self.restore(self.data)
        self.assertEqual(result["policy_bytes"], self.pb)
        self.assertEqual(result["observation_bytes"], self.ob)
        self.assertFalse(result["origin_authenticated"])

    def test_deterministic_pack(self):
        self.assertEqual(bundle.pack(self.pb, self.ob), self.data)

    def test_external_policy_pin_required(self):
        for pin in (None, "0" * 64):
            with self.assertRaises(core.Refused):
                bundle.restore(self.data, expected_policy_sha256=pin)

    def test_archive_pin_checked(self):
        with self.assertRaisesRegex(core.Refused, "bundle_pin_mismatch"):
            bundle.restore(self.data, expected_policy_sha256=bundle.sha(self.pb), expected_bundle_sha256="0" * 64)

    def test_corrupted_member_rejected(self):
        data = self.rewrite(lambda m: m.update({"observations.json": b"[]"}))
        with self.assertRaisesRegex(core.Refused, "bundle_integrity"):
            self.restore(data)

    def test_missing_member_rejected(self):
        with self.assertRaises(core.Refused):
            self.restore(self.rewrite(lambda m: m.pop("report.json")))

    def test_path_and_code_members_rejected(self):
        for name in ("../outside", "/tmp/escape", "payload.py"):
            with self.subTest(name=name), self.assertRaises(core.Refused):
                self.restore(self.rewrite(lambda m: m.update({name: b"raise Exception()"})))

    def test_truncated_zip_rejected(self):
        with self.assertRaises(core.Refused):
            self.restore(self.data[:-80])

    def test_rehashed_report_lie_rejected(self):
        def mutate(members):
            report = core.parse(members["report.json"])
            report["value"] = "high"
            report["report_sha256"] = core.digest({k: v for k, v in report.items() if k != "report_sha256"})
            members["report.json"] = core.canonical(report)
            manifest = core.parse(members["manifest.json"])
            manifest["files"]["report.json"] = {"sha256": bundle.sha(members["report.json"]), "bytes": len(members["report.json"])}
            members["manifest.json"] = core.canonical(manifest)
        with self.assertRaisesRegex(core.Refused, "bundle_reassessment_mismatch"):
            self.restore(self.rewrite(mutate))

    def test_oversized_archive_rejected_before_parse(self):
        with self.assertRaisesRegex(core.Refused, "bundle_byte_limit"):
            self.restore(b"x" * (bundle.LIMIT + 1))


if __name__ == "__main__":
    unittest.main()
