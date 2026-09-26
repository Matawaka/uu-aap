# HA-1 offline fixture profile — bounded implementation contract

Status: LOCAL_CANDIDATE_40_CASES_CHECKED_REVIEW_PENDING. Tracking #1012, Draft PR #1013.
Design source: `9c1f159dd2aee62ad7efb5da28e27f17a84b8526`.

This is a same-assistant implementation/review candidate under the user's continuation request, not independent design acceptance. The six HA-0 design files are the historical proposal. External review, merge, HA-2 and production use remain gated.

## Review dispositions fixed before implementation

1. **Trust bootstrap:** a producer name, self-declared `trusted` flag, or hash alone cannot establish execution. This first profile accepts only local synthetic observations whose exact digests are separately pinned by the fixture caller. Caller pins also bind policy, inventory, and anchors. The evidence bundle cannot supply its own trust configuration. This is a simulation of an accepted recorder model, not producer authentication, signatures, a trusted clock or a live adapter.
2. **Self-reference:** only the first six input stages are assessed. `evidence_reduced` is this reducer's output; `ready_for_human_decision` is a reporting state, not an observed prior stage or human approval. Parallel GREEN/review are permitted; required data dependencies are not.
3. **Finite scope:** 40 predeclared HA-P cases are normalized synthetic observations. Validations concern supplied records under caller assumptions, not code execution, secret discovery, independent operators, completeness outside inventory or target-control qualification.
4. **Strict parsing and non-effects:** duplicate keys, unsupported fields, unsupported profiles, non-integer numbers, malformed structures and oversized/deep inputs are non-passing. The reducer does not execute commands, resolve URLs/paths, write files, contact providers or issue permits. CLI reads exactly four caller-selected files and prints a bounded report; reads are outside the pure reducer.
5. **No fabricated acceptance:** imported reviewer/recorder observations remain conditional; replay is not independent review. Findings without enough evidence remain unresolved. Historical design checks and operational observations are not relabelled.

## Input boundary

`reduce(policy, inventory, bundle, trust)` is pure. `bundle` contains `anchors`, inline UTF-8 artifacts keyed by SHA-256, and stage/control/context observation records. No references are dereferenced. Policy declares the stage/control inventory before reduction; it is not inferred from the trace. The caller's `trust` pins policy, inventory, anchors and each admitted record digest, plus producer, roles, operator identities, accepted sequence domain and explicit evaluation tick. It MUST originate outside the party being assessed. A caller that pins invented records gets only a conditional assessment of those invented records.

The identity projection is specific to this fixture format: sorted ASCII-key JSON using Python `json.dumps(sort_keys=True, ensure_ascii=True, separators=(',', ':'))`, restricted to null/boolean/integer/string/list/object; SHA-256 of its UTF-8 bytes. This is not JCS and is not a replacement for any existing receipt identity profile. Inline artifacts use SHA-256 of exact UTF-8 text. No old receipts are rehashed.

## Result boundary

Per check: SATISFIED / UNSATISFIED / INSUFFICIENT_EVIDENCE / NOT_APPLICABLE. UNSATISFIED dominates, but all findings are retained; otherwise any missing/untrusted evidence yields INSUFFICIENT_EVIDENCE. BOUNDED_WORKFLOW_EVIDENCE_SATISFIED is never permission. Unparseable input yields INSUFFICIENT_EVIDENCE with INPUT_INVALID and a safe code, not input text.

The fixed stage profile is intentionally not a universal TDD requirement. RED requires named test discovery and the declared assertion failure on the baseline; GREEN must bind the admitted tests/contract and final subject. A contract successor is admitted only by caller-pinned revision observation and re-established dependent stages. Historical pre-squash commit labels do not replace content identities.

All report fields are allowlisted: reason codes, fixed check identifiers, supplied-object digests, explicit trust limitations and non-effects. No raw artifacts, command strings, findings prose, arbitrary source labels or secrets are echoed.

## Exit and remaining work

HA-1 candidate exit: execute all 40 named synthetic cases plus parser/binding/purity tests; retain exact input and code identities and case-by-case outcomes. This does not complete external review or HA-2. No new workflow or dependency is installed. The standard library is sufficient.

## Local result and self-review

The initial 40 scenarios all matched, but five additional regression tests failed against the initial reducer. This was a real same-session self-review result, not an independent review: (F01) a probe could choose its own expected outcome; (F02) an empty mutation suite could pass; (F03) a stale contract could coexist with a positive revalidation sub-result; (F04) a required contract-successor declaration could be omitted; (F05) a positive denominator could be mistaken for an established rate.

All five were fixed and retained as regression tests. Expected mutation outcomes now belong to caller-pinned policy, invalid AND benign cases are mandatory, contract revalidation is conditional on downstream results, caller-required predecessor decisions cannot be omitted, and rate/minimum-cost claims remain unestablished in this profile. A typed diagnostic class, exact source-frontier validation and per-stage reports were also added. Fixture input revision 3 records the schema refinements; none of the original 40 expected statuses or reasons changed. The original oracle file is hash-pinned by the tests.

Final local run: **77 unittest tests passed** (40 named scenarios plus 37 regression/boundary tests; several contain subcases). All **7 deliberately broken implementations** were detected by the named fixtures/non-effect assertions. This is a small authored mutation sample, not a coverage percentage or proof of completeness. Initial-RED source snapshots and raw logs are retained in the downloadable local bundle; `local-checks.json` records their identities and limitations.

## Reproduce from repository root

```bash
python -B tools/harness_assurance/v0_1/test_reducer.py
python -B tools/harness_assurance/v0_1/check_mutations.py
python -B docs/design/harness-assurance/v0.1/validate_design.py
```

All inputs are synthetic. `fixtures.py` is the test caller and may construct pins; it MUST NOT be used to bless a live evidence bundle. The production reducer never calls it. `check_mutations.py` executes only deliberately mutated copies of this package's own reducer, in memory; no code from evidence is interpreted.

For four explicitly prepared local JSON inputs, the reducer CLI is:

```bash
python -B tools/harness_assurance/v0_1/reducer.py --policy policy.json --inventory inventory.json --bundle bundle.json --trust trust.json
```

Exit 0: bounded satisfaction. Exit 1: requirements unsatisfied. Exit 2: insufficient/invalid input. Exit 0 does not authorize anything. No command from an observation is ever executed. The fixed profile supports six mandatory stages, one control, and an optional policy-justified mobile-smoke stage. Broader workflow/recorder formats are unsupported rather than guessed.
