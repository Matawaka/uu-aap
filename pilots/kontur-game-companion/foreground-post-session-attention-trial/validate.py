#!/usr/bin/env python3
"""Deterministic validation for the foreground post-session attention trial."""

import ast
import copy
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# Dynamic predecessor imports must not create bytecode in the repository.
sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RUN_PATH = HERE / "run.py"
RENDER_PATH = HERE / "render.py"
CMD_PATH = HERE / "run-local-attention-trial.cmd"
UPSTREAM_FIXTURE = (
    ROOT
    / "pilots/kontur-game-companion/external-sandbox-sidecar-ingest/fixtures/synthetic-sidecar"
)
UPSTREAM_FINAL = "sessions/synthetic-complete/session-final.json"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise AssertionError(f"module unavailable: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


trial = loadmod("kontur_foreground_attention_trial_validate_run", RUN_PATH)
renderer = loadmod("kontur_foreground_attention_trial_validate_render", RENDER_PATH)
bridge = trial.bridge
ingest = loadmod(
    "kontur_foreground_attention_trial_validate_ingest",
    ROOT / "pilots/kontur-game-companion/external-sandbox-sidecar-ingest/ingest.py",
)


EXPECTED_CUES = {
    "overview",
    "lifecycle",
    "severity",
    "terms",
    "pause",
    "resume",
    "decline",
    "redirect",
    "none",
}
EXPECTED_CARD_KEYS = {
    "schema_version",
    "status",
    "input_status",
    "cue_identity",
    "category_identities",
    "provenance_status",
    "bridge_status",
    "effect_status",
}
EXPECTED_CATEGORY_KEYS = {"available", "selected", "bridged"}
EXPECTED_PROVENANCE_KEYS = {
    "source_ingest_receipt_digest",
    "source_external_session_evidence_ref",
    "source_summary_digest",
    "state_anchor_digest",
    "structured_cue_digest",
    "bridge_receipt_digest",
    "source_integrity",
    "source_authenticity",
    "runtime_state_authentication",
    "cue_authentication",
    "source_currentness",
}
EXPECTED_BRIDGE_STATUS_KEYS = {
    "decision",
    "reason",
    "event_candidate",
    "runtime_eligibility",
    "semantic_game_fact",
    "next_boundary",
    "next_human_decision",
}
EXPECTED_EFFECT_STATUS = {
    "authority": "NONE",
    "action": "NONE",
    "successor": "NONE",
    "external": "NONE",
    "persistence": "NONE",
}
ALL_CATEGORIES = ["LIFECYCLE_COUNTS", "SEVERITY_COUNTS", "TERM_COUNTS"]
EXPECTED_BY_CUE = {
    "overview": (
        "SYNTHETIC_PLAYER_EVENT_CANDIDATE_CREATED",
        ALL_CATEGORIES,
        None,
        "CREATED_NOT_ADMITTED",
    ),
    "lifecycle": (
        "SYNTHETIC_PLAYER_EVENT_CANDIDATE_CREATED",
        ["LIFECYCLE_COUNTS"],
        "LIFECYCLE_COUNTS",
        "CREATED_NOT_ADMITTED",
    ),
    "severity": (
        "SYNTHETIC_PLAYER_EVENT_CANDIDATE_CREATED",
        ["SEVERITY_COUNTS"],
        "SEVERITY_COUNTS",
        "CREATED_NOT_ADMITTED",
    ),
    "terms": (
        "SYNTHETIC_PLAYER_EVENT_CANDIDATE_CREATED",
        ["TERM_COUNTS"],
        "TERM_COUNTS",
        "CREATED_NOT_ADMITTED",
    ),
    "pause": (
        "SYNTHETIC_PLAYER_EVENT_CANDIDATE_CREATED",
        [],
        None,
        "CREATED_NOT_ADMITTED",
    ),
    "resume": ("STATE_PHASE_BLOCKED", [], None, "NOT_CREATED"),
    "decline": ("SUPPRESSED_BY_PLAYER_CUE", [], None, "NOT_CREATED"),
    "redirect": ("SUPPRESSED_BY_PLAYER_CUE", [], None, "NOT_CREATED"),
    "none": ("WAIT_FOR_CURRENT_PLAYER_CUE", [], None, "NOT_CREATED"),
}
EXPECTED_VISIBLE_BY_CUE = {
    "overview": ALL_CATEGORIES,
    "lifecycle": ["LIFECYCLE_COUNTS"],
    "severity": ["SEVERITY_COUNTS"],
    "terms": ["TERM_COUNTS"],
    "pause": [],
    "resume": [],
    "decline": [],
    "redirect": [],
    "none": [],
}
FORBIDDEN_CARD_KEYS = {
    "bytes_processed",
    "lines_processed",
    "log_file_count",
    "sensitive_identifier_line_count",
    "severity_counts",
    "term_counts",
    "lifecycle_counts",
    "response_text",
    "advice",
    "recommendation",
    "model_output",
    "message",
    "send_authority",
    "action_permit",
    "successor_permit",
    "raw_log",
    "raw_text",
}


def write_json(path, value):
    Path(path).write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def make_repository_fixture_receipt():
    """Run the real ingest over the repository fixture, matching PR #506."""

    with tempfile.TemporaryDirectory(prefix="kontur-foreground-attention-") as temp_name:
        sidecar_root = Path(temp_name) / "KONTUR_PILOT_INFO"
        shutil.copytree(UPSTREAM_FIXTURE, sidecar_root)

        policy_path = sidecar_root / "runtime-collection-policy.json"
        canonical_policy_path = (
            ROOT
            / "pilots/kontur-game-companion/external-observation-session/runtime-collection-policy.json"
        )
        # Git may expose a CRLF worktree while the policy digest is defined over
        # repository LF bytes. Normalize the copied fixture deterministically.
        policy_path.write_bytes(canonical_policy_path.read_bytes().replace(b"\r\n", b"\n"))
        policy_sha = hashlib.sha256(policy_path.read_bytes()).hexdigest()
        if policy_sha != bridge.EXPECTED_POLICY_SHA256:
            raise AssertionError("canonical observation policy digest")

        start_path = sidecar_root / "sessions/synthetic-complete/session-start.json"
        start = json.loads(start_path.read_text(encoding="utf-8"))
        start["policy_sha256"] = policy_sha
        write_json(start_path, start)

        final_path = sidecar_root / UPSTREAM_FINAL
        final = json.loads(final_path.read_text(encoding="utf-8"))
        final["policy_sha256"] = policy_sha
        write_json(final_path, final)

        pilot_receipt = ingest.local_run.execute("synthetic-ready")
        context = ingest.default_ingest_context(pilot_receipt)
        context["external_sandbox_ingest_requested"] = True
        context["human_external_sandbox_decision"] = ingest.HUMAN_DECISION
        context["session_id"] = "synthetic-complete"
        context["expected_policy_sha256"] = policy_sha
        context["sidecar_root_reference_digest"] = ingest.sidecar_root_reference_digest(
            sidecar_root
        )
        for field in ingest.PRECHECK_FIELDS:
            context[field] = True
        receipt = ingest.ingest_completed_session(pilot_receipt, context, sidecar_root)
        bridge.validate_source_ingest_receipt(receipt)
        return receipt


def clone_without_severity_signal(source):
    candidate = copy.deepcopy(source)
    candidate["sanitized_summary"]["severity_counts"] = {}
    candidate["external_sandbox_sidecar_ingest_receipt_digest"] = bridge.sha(
        {
            key: value
            for key, value in candidate.items()
            if key != "external_sandbox_sidecar_ingest_receipt_digest"
        }
    )
    bridge.validate_source_ingest_receipt(candidate)
    return candidate


def walk(value):
    yield value
    if isinstance(value, dict):
        for key, nested in value.items():
            yield key
            yield from walk(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from walk(nested)


def assert_value_free_card(card, source):
    if set(card) != EXPECTED_CARD_KEYS:
        raise AssertionError("card exact keys")
    if set(card["category_identities"]) != EXPECTED_CATEGORY_KEYS:
        raise AssertionError("category identity exact keys")
    if set(card["provenance_status"]) != EXPECTED_PROVENANCE_KEYS:
        raise AssertionError("provenance exact keys")
    if set(card["bridge_status"]) != EXPECTED_BRIDGE_STATUS_KEYS:
        raise AssertionError("bridge status exact keys")
    if card["effect_status"] != EXPECTED_EFFECT_STATUS:
        raise AssertionError("effect status")
    if card["schema_version"] != renderer.SCHEMA_VERSION or card["status"] != renderer.STATUS:
        raise AssertionError("card classification")

    values = list(walk(card))
    if any(type(value) in {int, float} for value in values):
        raise AssertionError("numeric aggregate leaked into card")
    if FORBIDDEN_CARD_KEYS.intersection(value for value in values if isinstance(value, str)):
        raise AssertionError("forbidden response/count key leaked into card")
    if source["session_id"] in values:
        raise AssertionError("session id leaked into card")
    if card["provenance_status"]["source_currentness"] != (
        "COMPLETED_SESSION_NOT_CURRENT_GAME_EVENT"
    ):
        raise AssertionError("completed-session currentness")
    if card["provenance_status"]["source_authenticity"] != "NOT_PROVEN":
        raise AssertionError("source authenticity promoted")
    if card["provenance_status"]["runtime_state_authentication"] != "NOT_PROVEN":
        raise AssertionError("runtime authentication promoted")
    if card["provenance_status"]["cue_authentication"] != "NOT_PROVEN":
        raise AssertionError("cue authentication promoted")
    if card["bridge_status"]["runtime_eligibility"] != "DENIED":
        raise AssertionError("runtime eligibility promoted")
    if card["bridge_status"]["semantic_game_fact"] != "NOT_CLAIMED":
        raise AssertionError("semantic fact promoted")


def validate_exact_non_effects(source, cue_identity):
    state = trial.make_state(source)
    cue = trial.make_cue(cue_identity, source, state)
    receipt = bridge.evaluate(source, state, cue)
    if set(receipt["non_effects"]) != set(bridge.NON_EFFECT_FIELDS):
        raise AssertionError(f"{cue_identity}: non-effect exact fields")
    if any(receipt["non_effects"].values()):
        raise AssertionError(f"{cue_identity}: non-effect enabled")
    false_fields = (
        "source_authenticity_proven",
        "source_is_current_game_event",
        "runtime_state_authentication_proven",
        "cue_authentication_proven",
        "input_adapter_verified",
        "cue_replay_protection_proven",
        "durable_suppression_state_created",
        "state_transition_applied",
        "candidate_envelope_admission_proven",
        "downstream_policy_evaluation_performed",
        "event_runtime_eligible",
        "current_game_state_claimed",
        "semantic_game_fact_claimed",
        "message_send_eligible",
        "response_authority_created",
        "send_authority",
        "action_permit_created",
        "successor_permit_created",
        "future_help_authority",
        "future_solution_authority",
        "persistent_solver_mode",
    )
    if any(receipt[field] is not False for field in false_fields):
        raise AssertionError(f"{cue_identity}: effect or authority enabled")
    if receipt["response_text"] is not None or receipt["response_admissible"] is not None:
        raise AssertionError(f"{cue_identity}: response materialized")
    if receipt["help_request"] != "NONE":
        raise AssertionError(f"{cue_identity}: advice/help request inferred")
    if len(
        {
            receipt["authority_effect"],
            receipt["action_effect"],
            receipt["successor_effect"],
        }
    ) != 1:
        raise AssertionError(f"{cue_identity}: inconsistent effect fields")
    if any(
        receipt[field] != "NONE"
        for field in ("authority_effect", "action_effect", "successor_effect")
    ):
        raise AssertionError(f"{cue_identity}: non-none effect")
    return receipt


def validate_cues(source):
    if set(trial.CUE_BINDINGS) != EXPECTED_CUES:
        raise AssertionError("exact cue surface")
    cards = {}
    for cue_identity in trial.CUE_BINDINGS:
        first = trial.execute(source, cue_identity, "SUPPLIED_COMPLETED_INGEST_RECEIPT")
        second = trial.execute(source, cue_identity, "SUPPLIED_COMPLETED_INGEST_RECEIPT")
        if first != second:
            raise AssertionError(f"{cue_identity}: nondeterministic execution")
        assert_value_free_card(first, source)
        receipt = validate_exact_non_effects(source, cue_identity)
        expected_decision, expected_bridged, expected_selected, expected_event = (
            EXPECTED_BY_CUE[cue_identity]
        )
        if first["bridge_status"]["decision"] != expected_decision:
            raise AssertionError(f"{cue_identity}: decision")
        if first["bridge_status"]["event_candidate"] != expected_event:
            raise AssertionError(f"{cue_identity}: event status")
        if first["category_identities"]["bridged"] != expected_bridged:
            raise AssertionError(f"{cue_identity}: bridged categories")
        if first["category_identities"]["selected"] != expected_selected:
            raise AssertionError(f"{cue_identity}: selected category")
        if first["category_identities"]["available"] != EXPECTED_VISIBLE_BY_CUE[cue_identity]:
            raise AssertionError(f"{cue_identity}: visible category disclosure")
        if receipt["player_event_candidate_created"] is not (
            expected_event == "CREATED_NOT_ADMITTED"
        ):
            raise AssertionError(f"{cue_identity}: event marker")
        cards[cue_identity] = first
    return cards


def validate_no_signal(source):
    empty = clone_without_severity_signal(source)
    card = trial.execute(empty, "severity", "SUPPLIED_COMPLETED_INGEST_RECEIPT")
    assert_value_free_card(card, empty)
    if card["category_identities"]["available"] != []:
        raise AssertionError("no-signal available categories")
    if card["category_identities"]["bridged"] != []:
        raise AssertionError("no-signal fallback category")
    if card["bridge_status"]["decision"] != "NO_SUPPORTED_AGGREGATE":
        raise AssertionError("no-signal decision")
    if card["bridge_status"]["reason"] != "SELECTED_CATEGORY_HAS_NO_SANITIZED_SIGNAL":
        raise AssertionError("no-signal reason")
    if card["bridge_status"]["event_candidate"] != "NOT_CREATED":
        raise AssertionError("no-signal event")


def expect_trial_input_error(action):
    try:
        action()
    except trial.TrialInputError:
        return
    raise AssertionError("strict receipt input was accepted")


def validate_strict_receipt_loading(source):
    duplicate = b'{"status":"one","status":"two"}'
    if trial.decode_strict_json(b"{}") != {}:
        raise AssertionError("valid JSON object rejected by strict decoder")
    try:
        trial.execute({}, "overview", "SUPPLIED_COMPLETED_INGEST_RECEIPT")
    except bridge.PlayerCuedObservationBridgeError:
        pass
    else:
        raise AssertionError("schema-empty receipt reached the renderer")
    for raw in (duplicate, b'{"value":NaN}', b'{"value":Infinity}', b'{"value":-Infinity}'):
        expect_trial_input_error(lambda raw=raw: trial.decode_strict_json(raw))
    expect_trial_input_error(lambda: trial.decode_strict_json(b"\xff"))
    expect_trial_input_error(lambda: trial.decode_strict_json(b"[]"))
    expect_trial_input_error(lambda: trial.decode_strict_json("{}"))
    expect_trial_input_error(
        lambda: trial.decode_strict_json(b" " * (trial.MAX_RECEIPT_BYTES + 1))
    )

    with tempfile.TemporaryDirectory(prefix="kontur-attention-input-") as temp_name:
        root = Path(temp_name)
        valid = root / "receipt.json"
        valid.write_bytes(
            json.dumps(source, ensure_ascii=False, sort_keys=True).encode("utf-8")
        )
        if trial.read_receipt_file(valid) != source:
            raise AssertionError("ordinary receipt file changed during load")
        expect_trial_input_error(lambda: trial.read_receipt_file(root))
        expect_trial_input_error(lambda: trial.read_receipt_file(root / "missing.json"))
        oversized = root / "oversized.json"
        oversized.write_bytes(b" " * (trial.MAX_RECEIPT_BYTES + 1))
        expect_trial_input_error(lambda: trial.read_receipt_file(oversized))
        duplicate_file = root / "duplicate.json"
        duplicate_file.write_bytes(duplicate)
        expect_trial_input_error(lambda: trial.read_receipt_file(duplicate_file))
        link = root / "receipt-link.json"
        try:
            link.symlink_to(valid)
        except OSError:
            # Windows may deny symlink creation outside Developer Mode. Linux CI
            # always exercises this branch; runtime rejection remains fail closed.
            pass
        else:
            expect_trial_input_error(lambda: trial.read_receipt_file(link))


def validate_renderer_fail_closed(source):
    state = trial.make_state(source)
    cue = trial.make_cue("overview", source, state)
    receipt = bridge.evaluate(source, state, cue)
    forged = copy.deepcopy(receipt)
    forged["decision"] = 7
    try:
        renderer.build_context_card(
            input_status="SUPPLIED_COMPLETED_INGEST_RECEIPT",
            cue_identity="overview",
            selected_category_identity=None,
            available_category_identities=ALL_CATEGORIES,
            bridge_receipt=forged,
        )
    except renderer.ContextCardError:
        pass
    else:
        raise AssertionError("renderer accepted numeric output")


def imported_modules(tree):
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            names.add(node.module)
    return names


def validate_runtime_source_surface():
    expected_imports = {
        RUN_PATH: {"argparse", "importlib.util", "json", "os", "pathlib", "stat", "sys"},
        RENDER_PATH: set(),
    }
    forbidden_import_roots = {
        "asyncio",
        "ctypes",
        "http",
        "multiprocessing",
        "openai",
        "psutil",
        "requests",
        "socket",
        "subprocess",
        "threading",
        "urllib",
        "webbrowser",
        "wmi",
        "win32api",
        "win32process",
    }
    forbidden_calls = {
        "Popen",
        "call",
        "check_call",
        "check_output",
        "connect",
        "exec",
        "eval",
        "compile",
        "__import__",
        "mkdir",
        "openai",
        "remove",
        "rename",
        "replace",
        "request",
        "rmdir",
        "run",
        "send",
        "sendall",
        "spawn",
        "startfile",
        "system",
        "touch",
        "unlink",
        "urlopen",
        "write",
        "write_bytes",
        "write_text",
        "writelines",
    }
    for path, exact_imports in expected_imports.items():
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        imports = imported_modules(tree)
        if imports != exact_imports:
            raise AssertionError(f"{path.name}: import surface {sorted(imports)}")
        if {name.split(".")[0] for name in imports}.intersection(forbidden_import_roots):
            raise AssertionError(f"{path.name}: forbidden capability import")
        if any(isinstance(node, (ast.AsyncFunctionDef, ast.Await, ast.While)) for node in ast.walk(tree)):
            raise AssertionError(f"{path.name}: async/polling surface")
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = None
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            if name in forbidden_calls:
                raise AssertionError(f"{path.name}: forbidden call {name}")
            if name == "open":
                mode = node.args[0].value if node.args and isinstance(node.args[0], ast.Constant) else None
                if mode not in {"r", "rb"}:
                    raise AssertionError(f"{path.name}: non-read-only open")
    if trial.MAX_RECEIPT_BYTES != 256 * 1024:
        raise AssertionError("receipt input is not explicitly bounded")
    if tuple(bridge.CATEGORIES) != tuple(ALL_CATEGORIES):
        raise AssertionError("category loop is not bounded to the three known identities")
    run_source = RUN_PATH.read_text(encoding="utf-8")
    if "sys.dont_write_bytecode = True" not in run_source:
        raise AssertionError("repository bytecode write suppression")


def run_cli(arguments, *, stdin=None):
    environment = dict(os.environ)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        [sys.executable, str(RUN_PATH), *arguments],
        cwd=ROOT,
        input=stdin,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=15,
        env=environment,
    )


def validate_cli(source):
    arguments = ["--scenario", "synthetic", "--cue", "overview"]
    first = run_cli(arguments)
    second = run_cli(arguments)
    if first.returncode != 0 or second.returncode != 0:
        raise AssertionError(f"synthetic CLI failed: {first.stderr!r} {second.stderr!r}")
    if first.stdout != second.stdout or first.stderr != second.stderr:
        raise AssertionError("synthetic CLI is not byte-deterministic")
    cli_card = json.loads(first.stdout.decode("utf-8"))
    assert_value_free_card(cli_card, trial.synthetic_receipt())
    if len(first.stdout) > 16 * 1024:
        raise AssertionError("single-shot context card output budget")

    encoded = json.dumps(source, sort_keys=True, ensure_ascii=False).encode("utf-8")
    stdin_run = run_cli(["--receipt", "-", "--cue", "terms"], stdin=encoded)
    if stdin_run.returncode != 0:
        raise AssertionError(f"stdin CLI failed: {stdin_run.stderr!r}")
    stdin_card = json.loads(stdin_run.stdout.decode("utf-8"))
    assert_value_free_card(stdin_card, source)
    if stdin_card["input_status"] != "STDIN_COMPLETED_INGEST_RECEIPT":
        raise AssertionError("stdin input status")

    rejected = run_cli(["--receipt", "-"], stdin=b'{"x":NaN}')
    if rejected.returncode != 2 or b"foreground_attention_trial_error:" not in rejected.stderr:
        raise AssertionError("invalid CLI receipt did not fail closed")


def validate_cmd_smoke():
    if os.name != "nt":
        return False
    if not CMD_PATH.is_file():
        raise AssertionError("Windows CMD launcher missing")
    comspec = os.environ.get("COMSPEC", "cmd.exe")
    environment = dict(os.environ)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        [comspec, "/d", "/c", "call", str(CMD_PATH)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=20,
        env=environment,
    )
    if completed.returncode != 0:
        raise AssertionError(f"CMD launcher failed: {completed.stderr!r}")
    card = json.loads(completed.stdout.decode("utf-8"))
    assert_value_free_card(card, trial.synthetic_receipt())
    if card["cue_identity"] != "overview":
        raise AssertionError("CMD launcher default cue")
    missing = HERE / "intentionally-missing-receipt.json"
    rejected = subprocess.run(
        [
            comspec,
            "/d",
            "/c",
            "call",
            str(CMD_PATH),
            "--receipt",
            str(missing),
            "--cue",
            "overview",
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=20,
        env=environment,
    )
    if rejected.returncode != 2:
        raise AssertionError(
            f"CMD launcher did not preserve Python failure exit code: {rejected.returncode}"
        )
    if b"foreground_attention_trial_error:" not in rejected.stderr:
        raise AssertionError("CMD launcher failure receipt missing")
    return True


def main():
    source = make_repository_fixture_receipt()
    bridge.validate_source_ingest_receipt(trial.synthetic_receipt())
    cards = validate_cues(source)
    validate_no_signal(source)
    validate_strict_receipt_loading(source)
    validate_renderer_fail_closed(source)
    validate_runtime_source_surface()
    validate_cli(source)
    cmd_smoked = validate_cmd_smoke()
    print(
        "KONTUR foreground post-session attention trial: PASS; "
        f"cues={len(cards)}; no_signal=1; strict_input_rejections=12; "
        "count_values_rendered=0; response_or_advice_generated=0; "
        "model_or_send_or_action_effects=0; foreground_single_shot=true; "
        f"windows_cmd_success_and_failure_smoke={str(cmd_smoked).lower()}"
    )


if __name__ == "__main__":
    main()
