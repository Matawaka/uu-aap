# Portable Action Evidence / Comparative Replay Pilot v0.1

Status: **INTERNAL_REPLAY_READY / EXTERNAL_EVIDENCE_PENDING**. This is an experimental integration layer above the existing AI Gateway reference harness. UU Society remains at v1.2; this package is not a new Core primitive or a claim of completed external validation.

It makes one synthetic GitHub merge evidence record exportable and separately checkable, and prepares a controlled comparison with a participant's existing stack. The historical live acceptance is a pinned reference only. All 17 generated cases are `SYNTHETIC_REPLAY`; neither the generator nor verifier contacts GitHub or performs a merge.

## Architecture and boundary

Existing pinned scenario/planner → scoped approval/permit representations → evidence pack → offline consistency verifier → explicit missing/conflicting evidence → paired packaging receipts → separately executed external pilot.

`verify_evidence.py` accepts an input file, rather than selecting an expected fixture. It checks closed schemas, canonical SHA-256 digests, exact target/scope/reference bindings, declared validity windows and chronology, the frozen planner result, predecessor/successor roles, and recorded reuse. It can run without Node or the repository once its local schema, source-binding index and installed Python dependency accompany it. It does not import the generator or read the case expectations. A separate executable is not an independently reviewed implementation.

**The approval and permit objects are synthetic representations, not issued Core receipts.** The checker does not validate a real issuer, signature, human approval, live state, trusted time, atomic consumption or actual effect. Every receipt keeps `issuer_authenticated`, `live_state_checked`, `atomic_consumption_proven`, `actual_effect_proven`, `execution_authorized` and `independent_review_verified` false. Source hashes bind declared bytes; the offline pack does not authenticate their publisher.

## Reproduce

Prerequisites: Python 3.11+ and Node 20+ for generation; `jsonschema==4.26.0`. Install dependencies before disconnecting. The verifier itself needs no Node, credentials or network.

```sh
PILOT_PATH=protocols/integration/ai-gateway/replay-pilot/v0.1
python3 -m pip install -r "$PILOT_PATH/requirements.txt"
PILOT_WORK=$(mktemp -d)
python3 -B "$PILOT_PATH/validate_package.py"
python3 -B "$PILOT_PATH/run_replay_pilot.py" suite --output "$PILOT_WORK/replay" --check-reference
python3 -B "$PILOT_PATH/verify_evidence.py" --pack "$PILOT_WORK/replay/P07/pack.json"
python3 -B "$PILOT_PATH/verify_evidence.py" --dispersed "$PILOT_WORK/replay/P07/dispersed"
python3 -B -m unittest discover -s "$PILOT_PATH" -p 'test_*.py' -v
```

Use a fresh output path: exports refuse overwrites. Preserve LF source bytes when checking the four predecessor source pins. The suite writes 17 single-file packs, 17 eight-file compositions, both verification receipts per case and `results.json`. Exit 0 from the verifier means record consistency only; it is not an ActionPermit and must not be used to trigger an actuator. Exit 1 covers denied, indeterminate, conflicting or invalid evidence; exit 2 is an input/parse failure. The suite regards a correctly rejected negative control as conformant.

For a repository-free replay, copy `verify_evidence.py`, `evidence-pack.schema.json`, `source-bindings.json` and an exported `pack.json` into one directory. With the Python dependency already installed, run `python3 verify_evidence.py --pack pack.json`. This is tested locally with no Node in `PATH`; it is not external reviewer acceptance.

## Preregistered cases and actual results

`protocol.json` was written before the first suite invocation; its SHA-256 is `7bffbf4583923fc3b1323901272629d3ae11f43ead4138df37156a33a9a13cd1`. This is an internally recorded ordering, not an independently timestamped preregistration. Expectations are evaluation data outside the verifier's input.

| Cases | Mechanism | Actual status |
| --- | --- | --- |
| P00 | Exact scoped plan | CONSISTENT_PLAN |
| P01–P03 | Stale head, different repository, missing approval reference | REPLAY_DENIED |
| P04–P05 | Approval/permit expiry | REPLAY_DENIED |
| P06 | Missing outcome | EVIDENCE_INDETERMINATE |
| P07 | Consistent synthetic observation | CONSISTENT_OBSERVATION_RECORD |
| P08 | Unrehashed tampering | INVALID_EVIDENCE |
| P09 | Rehashed target substitution | REPLAY_DENIED |
| P10–P11 | Sequential/same-start-time attempt records for one single-use reference | EVIDENCE_CONFLICT |
| P12 | Ambiguous outcome | EVIDENCE_INDETERMINATE; no retry authority |
| P13–P14 | Wrong outcome permit / action relabelled onto successor frontier | INVALID_EVIDENCE |
| P15 | Fully rewritten, internally consistent, untrusted synthetic record | CONSISTENT_OBSERVATION_RECORD; authentication remains false |
| P16 | Approval payload redacted, reference retained | EVIDENCE_INDETERMINATE |

17/17 conform. Counts: 1 consistent plan, 2 consistent observation records, 6 denied, 3 indeterminate, 2 conflicts and 3 invalid evidence records. The old planner returns 14 `allow_plan` and 3 `deny`; that is planning output, not authorization or a false-allow security rate.

The two packaging arms use **the same verifier and evidence**, including the same negative controls. There are **0 verdict differences**. `LOCAL_REFERENCE_COMPOSITION` is a strong local packaging control, not an AWS/Arcade implementation. Per-case data artifacts: 1 versus 8, excluding shared verifier/schema/dependency files. Total serialized data: **89,775 bytes versus 88,133 bytes**. The single-file representation is 1,642 bytes larger; file count reduction does not establish smaller storage, faster review or commercial value.

## Preserved negative results and real fixes

- P15 demonstrates that self-consistent fabricated data can pass an integrity/consistency check. Hashes do not authenticate an issuer or establish truth; this result is intentionally retained.
- P10/P11 detect conflicting records. They do not execute competing requests or prove atomic single-use enforcement. Equal declared timestamps are not a measured race.
- P04/P05 surface validity information absent from the historical planner's contract. The planner remains byte-for-byte unchanged; its different remit is not repaired by relabelling it a production actuator.
- P16 shows a privacy/verification tradeoff: removing approval content loses a consistency claim. Payload disclosure is not automatically authorized to recover that claim.
- Packaging produces no detection advantage and increases serialized bytes in this format. Human review time, vendor performance, integration cost and willingness to pay remain unmeasured.

The first hostile test run had 3 failures across 33 methods; a second run found 2 additional failures across 35. F01–F05 are genuine verifier/schema defects: invalid case-ID leakage into a receipt, contradictory merge/non-merge records, unknown outcomes carrying a successor, unbound scope and a trailing-newline identifier. The prototype verifier/schema, raw failing logs and separate follow-up ledger are retained under `evidence/`. The corrected checker rejects these cases. No expected status or threshold was relaxed.

`evidence/first-results.json` preserves the original 17-case result and trace `sha256:b9c51595365f7538bd0250c68caf8aff32eb999ef4a196bd33e05a740041f5b8`. The corrected `reference-results.json` retains every status, metric and input pack; F04 adds one scope-mismatch reason to P09. `evidence/reference-correction.json` records the exact difference. Corrected trace: `sha256:1f369a4bfda9e8fe37d2480f2d36b5abc1efa0d86030128b9a2079a8ac4143dc`.

## External operator and customer comparison

`comparison-plan.json` is **NOT_EXECUTED**, with no recruited participant, selected vendor/version/configuration or measured results. All external measurements are null. Its schema rejects promoting this preparation record into executed vendor/customer evidence. No outreach was sent.

Before an actual comparison, the participant must select one consequential sandbox workflow and its current stack, record exact source/configuration versions, preregister decision criteria and assign an operator. Run the same target, permissions, evidence and allowed/denied cases in counterbalanced order. Record setup hours, reconstruction time and manual log lookups, false allows/blocks, processing latency separately from human waiting, retained sensitive bytes and offline replay completion. Thresholds must be fixed before measurements; missing measurements remain null.

Operator-owned raw observations, command/output hashes, relationship disclosure and limitations belong in a separate successor trial record. A self-declared different operator is not proof of independence. Positive commercial interpretation requires a real problem owner and willingness-to-pay evidence; otherwise preserve no advantage or insufficient evidence and narrow the hypothesis.

## Relation to previous layers and invariants

This consumes the existing Gateway planning contract; it does not alter Core, frozen receipts, UU Society or the historical acceptance. v0.8/v0.9 model structural control and capture/recovery; v1.0 separates evidence from truth; v1.1 bounds acquisition; v1.2 preserves evidence clocks and independent reauthorization. Those research findings motivate scope, freshness and uncertainty discipline here, without making institutional independence a binary available fact or turning synthetic costs into product metrics.

`Portable Evidence != Authenticated Authority`

`Consistent Record != Actual Effect`

`Recorded Reuse Detection != Atomic Prevention`

`Same Checker + Same Evidence != Measured Detection Advantage`

`Fewer Files != Faster Investigation`

`Missing Measurement != Zero Cost`

`Unknown Outcome != Retry Permission`

No LLM oracle, person ranking, runtime authority, customer validation, automatic Stable Core promotion or production/security certification is established.

[Русская версия](README.ru.md) · [Market review](../../../../../research/market/2026-11-16/README.md)
