# SPDX-License-Identifier: Apache-2.0
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import core
import workshop

ROOT = Path(__file__).resolve().parent


def example():
    return json.loads((ROOT / "workshop-example.json").read_text())


def complete():
    case = example()
    for key, fact in case["requirements"].items():
        if fact["value"] is None:
            fact["value"] = "synthetic-owner-reviewed-value"
        fact["state"] = "confirmed"
        fact["source_refs"] = ["synthetic-owner-reviewed-record"]
    for cost in case["costs"].values():
        cost.update(state="confirmed", amount_minor=10001, basis_ref="synthetic-cost-record")
    return case


class WorkshopTests(unittest.TestCase):
    def test_conflicting_sketch_blocks_handoff_and_price_total(self):
        output = workshop.build(example())
        self.assertEqual(output["owner"]["readiness"], "RESOLVE_CONFLICTS")
        self.assertEqual(output["workshop"]["status"], "HOLD")
        self.assertNotIn("dimensions_mm", output["workshop"]["confirmed_requirements"])
        self.assertIsNone(output["owner"]["cost_review"]["complete_total_minor"])
        self.assertEqual(output["owner"]["cost_review"]["known_subtotal_minor"], 3050000)
        self.assertEqual(output["owner"]["requirement_review"]["dimensions_mm"]["source_refs"],
                         ["synthetic-message-r1","synthetic-sketch-r2"])
        rendered = workshop.render(output["workshop"])
        self.assertIn("HOLD",rendered)
        self.assertIn(workshop.FIELDS["dimensions_mm"],rendered)

    def test_empty_intake_produces_nine_questions_and_no_cost_total(self):
        case = json.loads((ROOT / "workshop-intake.json").read_text())
        output = workshop.build(case)
        self.assertEqual(len(output["client"]["questions"]), 9)
        self.assertEqual(output["owner"]["readiness"], "CLARIFY_REQUIREMENTS")
        self.assertEqual(len(output["owner"]["cost_review"]["missing_categories"]), 7)
        self.assertIsNone(output["owner"]["cost_review"]["complete_total_minor"])

    def test_complete_case_still_requires_owner_and_never_releases_work(self):
        output = workshop.build(complete())
        self.assertEqual(output["owner"]["readiness"], "OWNER_REVIEW_REQUIRED")
        self.assertEqual(output["owner"]["cost_review"]["complete_total_minor"], 70007)
        self.assertFalse(output["owner"]["cost_review"]["sales_price_computed"])
        self.assertTrue(all(v is False for v in output["owner"]["boundaries"].values()))
        self.assertFalse(output["client"]["send_authorized"])
        self.assertFalse(output["workshop"]["production_authorized"])

    def test_missing_and_estimated_costs_are_not_zero_or_final(self):
        for state in ("missing", "estimate"):
            with self.subTest(state=state):
                case = complete()
                case["costs"]["overhead"] = {"state":state, "amount_minor":None if state == "missing" else 123,
                                             "basis_ref":None if state == "missing" else "owner-estimate"}
                output = workshop.build(case)["owner"]
                self.assertEqual(output["readiness"], "REVIEW_COSTS")
                self.assertIsNone(output["cost_review"]["complete_total_minor"])

    def test_explicit_nonapplicable_cost_needs_zero_and_a_basis(self):
        case = complete()
        cost = case["costs"]["outside_services"]
        cost.update(state="not_applicable", amount_minor=0, basis_ref="in-house-only")
        self.assertEqual(workshop.build(case)["owner"]["cost_review"]["complete_total_minor"], 60006)
        for amount, basis in ((1,"in-house-only"),(0,None)):
            cost.update(amount_minor=amount,basis_ref=basis)
            with self.assertRaises(core.Refused):
                workshop.build(case)

    def test_private_cost_changes_do_not_change_other_audiences(self):
        case = complete()
        before = workshop.build(case)
        case["tenant"] = "private-owner-name"
        case["costs"]["materials"].update(amount_minor=987654321,basis_ref="secret-supplier-discount")
        after = workshop.build(case)
        self.assertEqual(before["client"], after["client"])
        self.assertEqual(before["workshop"], after["workshop"])
        self.assertNotEqual(before["owner"], after["owner"])

    def test_client_projection_omits_raw_text_and_source_references(self):
        case = example()
        case["requirements"]["product"]["value"] = "PRIVATE-CUSTOMER-DETAILS"
        case["requirements"]["finish"]["source_refs"] = ["SECRET-DRAWING-REF"]
        view = workshop.build(case)["client"]
        output = json.dumps(view) + workshop.render(view)
        for secret in ("PRIVATE-CUSTOMER-DETAILS", "SECRET-DRAWING-REF", "known_subtotal", "input_sha256", "tenant"):
            self.assertNotIn(secret, output)

    def test_repeating_extractors_does_not_confirm_candidate(self):
        case = complete()
        field = case["requirements"]["material"]
        field.update(state="candidate",source_refs=["drawing-reader-a","drawing-reader-b","drawing-reader-c"])
        output = workshop.build(case)
        self.assertEqual(output["owner"]["readiness"], "CLARIFY_REQUIREMENTS")
        self.assertNotIn("material",output["workshop"]["confirmed_requirements"])

    def test_missing_source_never_counts_as_confirmation(self):
        case = complete()
        case["requirements"]["quantity"]["source_refs"] = []
        with self.assertRaisesRegex(core.Refused,"workshop_source_required"):
            workshop.build(case)

    def test_invalid_physical_values_and_bool_money_refused(self):
        edits = [lambda c:c["requirements"]["quantity"].update(value=True),
                 lambda c:c["requirements"]["dimensions_mm"]["value"].update(width=-1),
                 lambda c:c["requirements"]["requested_date"].update(value="2026-02-30"),
                 lambda c:c["costs"]["labor"].update(amount_minor=True),
                 lambda c:c["costs"]["labor"].update(amount_minor=1.5),
                 lambda c:c.update(currency="JPY"),
                 lambda c:c.update(revision=False)]
        for index, edit in enumerate(edits):
            with self.subTest(index=index):
                case = complete()
                edit(case)
                with self.assertRaises(core.Refused):
                    workshop.build(case)

    def test_required_field_cannot_be_silently_omitted(self):
        for category in ("requirements","costs"):
            case = complete()
            case[category].pop(next(iter(case[category])))
            with self.assertRaises(core.Refused):
                workshop.build(case)

    def test_extra_fields_cannot_smuggle_machine_or_model_commands(self):
        case = complete()
        case["machine_program"] = "execute-this"
        with self.assertRaisesRegex(core.Refused,"workshop_shape"):
            workshop.build(case)

    def test_input_is_immutable_and_revision_is_retained(self):
        case = example()
        before = deepcopy(case)
        output = workshop.build(case)
        self.assertEqual(case,before)
        for view in output.values():
            self.assertEqual(view["revision"],case["revision"])

    def test_render_escapes_confirmed_text(self):
        case = complete()
        case["requirements"]["product"]["value"] = "<script>privateInstruction()</script>"
        output = workshop.render(workshop.build(case)["owner"])
        self.assertNotIn("<script>",output)
        self.assertIn("&lt;script&gt;",output)
        self.assertIn("default-src 'none'",output)

    def test_cli_selects_audience_before_rendering(self):
        for audience in ("owner","client","workshop"):
            for format in ("json","html"):
                with self.subTest(audience=audience,format=format):
                    result = subprocess.run([sys.executable,"-I","-B",str(ROOT/"cli.py"),"workshop",
                                             str(ROOT/"workshop-example.json"),"--audience",audience,"--format",format],
                                            capture_output=True,timeout=10)
                    self.assertEqual(result.returncode,0,result.stderr)
                    self.assertNotIn(b"30500",result.stdout if audience != "owner" else b"")
                    if format == "json":
                        self.assertEqual(json.loads(result.stdout),workshop.build(example())[audience])

    def test_cli_refuses_without_exposing_invalid_private_field(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"bad.json"
            case = example()
            case["customer_phone"] = "private-phone"
            path.write_text(json.dumps(case))
            result = subprocess.run([sys.executable,"-I","-B",str(ROOT/"cli.py"),"workshop",str(path)],
                                    capture_output=True,timeout=10)
            self.assertEqual(result.returncode,2)
            self.assertEqual(json.loads(result.stdout)["code"],"workshop_shape")
            self.assertNotIn(b"private-phone",result.stdout+result.stderr)


if __name__ == "__main__":
    unittest.main()
