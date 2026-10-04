# SPDX-License-Identifier: Apache-2.0
"""Finite authored mutations of checker source, without changing repository files."""
from copy import deepcopy
from pathlib import Path
import sys
import types
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import core
import check
import fixtures


def with_rehash(report):
    report["report_sha256"] = core.digest({k: v for k, v in report.items() if k != "report_sha256"})
    return report


class CheckerMutationTests(unittest.TestCase):
    def test_each_authored_checker_mutant_is_caught_by_named_counterexample(self):
        source = Path(check.__file__).read_text()
        p, rows = fixtures.base()
        clean = core.evaluate(p, rows)
        cases = [
            ("ignore_policy_binding", 'expect(report["policy_sha256"] == _hash(policy), "POLICY_BINDING")',
             lambda r: r.update(policy_sha256="0" * 64)),
            ("ignore_source_binding", 'expect(report["observations_sha256"] == _hash(observations), "OBSERVATION_BINDING")',
             lambda r: r.update(observations_sha256="0" * 64)),
            ("ignore_verdict", 'expect(report["decision"] == expected, "VERDICT")',
             lambda r: r.update(decision="DISPUTED")),
            ("ignore_value", 'expect(report["value"] == (values[0] if expected == "CORROBORATED_UNDER_DECLARED_MODEL" else None), "VALUE_ESCALATION")',
             lambda r: r.update(value="high")),
        ]
        for name, statement, alter in cases:
            with self.subTest(mutant=name):
                self.assertEqual(source.count(statement), 1, "mutation must match exactly once")
                mutated = source.replace(statement, "pass # authored mutant: " + name)
                module = types.ModuleType(name)
                exec(compile(mutated, '<authored-checker-mutant>', 'exec'), module.__dict__)
                self.assertEqual(module.verify(p, rows, clean)["status"], "CHECKED_BOUNDED", "benign control must survive")
                bad = deepcopy(clean)
                alter(bad)
                with_rehash(bad)
                self.assertEqual(check.verify(p, rows, bad)["status"], "REJECTED", "original must catch intended defect")
                self.assertEqual(module.verify(p, rows, bad)["status"], "CHECKED_BOUNDED", "negative obligation must kill this mutant")


if __name__ == "__main__":
    unittest.main()
