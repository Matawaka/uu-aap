# SPDX-License-Identifier: Apache-2.0
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cli
import isolation
import core
import fixtures


class CliTests(unittest.TestCase):
    def test_demo_expected_results_and_exact_replay(self):
        result = cli.demo()
        self.assertEqual(len(result["scenarios"]), 10)
        self.assertTrue(result["all_expected"])
        self.assertTrue(result["replay"]["exact_input_bytes"])

    def test_html_escapes_values(self):
        result = cli.demo()
        result["scenarios"][0]["name"] = "<script>alert('x')</script>"
        output = cli.render_demo(result)
        self.assertNotIn("<script>", output)
        self.assertIn("&lt;script&gt;", output)
        self.assertIn("default-src 'none'", output)

    def test_pack_never_overwrites(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "existing.zip"
            target.write_bytes(b"preserve")
            with self.assertRaises(FileExistsError):
                cli.write_new(target, b"replace")
            self.assertEqual(target.read_bytes(), b"preserve")

    def test_cli_round_trip_across_processes(self):
        script = str(Path(cli.__file__))
        p, rows = fixtures.base()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pb = json.dumps(p, indent=3).encode()
            (root / "p.json").write_bytes(pb)
            (root / "o.json").write_text(json.dumps(rows))
            first = subprocess.run([sys.executable, "-I", "-B", script, "pack", str(root / "p.json"),
                                    str(root / "o.json"), str(root / "e.zip")], capture_output=True, timeout=10)
            self.assertEqual(first.returncode, 0, first.stderr)
            second = subprocess.run([sys.executable, "-I", "-B", script, "replay", str(root / "e.zip"),
                                     "--policy-sha256", cli.bundle.sha(pb)], capture_output=True, timeout=10)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(json.loads(second.stdout)["verification"]["status"], "CHECKED_BOUNDED")

    def test_invalid_input_cli_returns_fixed_code(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_bytes(b'{"private":"not-printed", "private":"bad"}')
            result = subprocess.run([sys.executable, "-I", "-B", cli.__file__, "evaluate", str(path), str(path)],
                                    capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 2)
            self.assertNotIn(b"not-printed", result.stdout + result.stderr)
            self.assertEqual(json.loads(result.stdout)["code"], "duplicate_json_key")

    def test_isolation_unavailable_has_no_fallback(self):
        with patch.object(isolation, "_probe", side_effect=PermissionError("private host details")):
            result = isolation.probe()
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertFalse(result["production_isolation_established"])
        self.assertTrue(result["no_unisolated_fallback"])
        self.assertNotIn("private", json.dumps(result))

    def test_isolation_command_has_fixed_worker_and_scoped_mounts(self):
        argv = isolation.command("/usr/bin/bwrap", "/usr/bin/python3", Path("/tmp/package"), Path("/tmp/canary"), 5000)
        self.assertIn("--unshare-all", argv)
        self.assertIn("--clearenv", argv)
        self.assertIn("--cap-drop", argv)
        self.assertNotIn("--share-net", argv)
        self.assertNotIn("/workspace", argv)
        self.assertEqual(argv[-3:], ["/source/isolation.py", "--worker", "5000"])


if __name__ == "__main__":
    unittest.main()
