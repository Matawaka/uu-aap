# Observable Authority Consistency Receipt v0.1

Status: **additive executable observability/interoperability evidence for #891; not C2PA conformance, not UU-AAP Stable Core, not an alerting system, and not remediation authority**.

Predecessor:

- merged #890 / `a5d5fca193c1cd4b49bcfde21b0e5a581994ff21` — C2PA Authority-Admission Consistency Gate v0.1.

Coordination:

- #4 — broader C2PA 2.4 mapping review;
- #777 — historical semantic-boundary draft, not reopened here.

## Why this successor exists

The follow-up correction in `c2pa-org/specifications#122` materially narrowed the external lesson.

Initial observation:

https://github.com/c2pa-org/specifications/issues/122#issuecomment-5544351466

Correction:

https://github.com/c2pa-org/specifications/issues/122#issuecomment-5546329622

The external monitor's actual quorum configuration already excluded the additional witness. The missing control was an externally visible explanation of why two exported authority-related surfaces differed: `witness_keys.json` contained a key that the signed `trust-root.json` beside it did not yet admit.

The external operator reports that a new export audit now compares those surfaces in both directions and prints the delta whether or not it alerts.

This directory does not copy that implementation or cadence. It extracts the reusable boundary:

```text
Correct internal authority state != externally explainable authority state
Exported signer surface != signed-root admission
No alert != no observable delta
```

## Separation from #890

#890 answers quorum eligibility from an exact verified root and normalized crypto observations.

This successor does **not** calculate or mutate quorum. It compares two exact source-bound signer sets:

```text
exact exported signer surface
        vs
exact verified signed-root admitted set
```

and emits a deterministic explanation receipt.

## Input boundary

The input schema is:

```text
urn:uu-aap:observable-authority-consistency-input:0.1
```

The parser is **closed-world**. Only the explicitly defined fields below are accepted; unknown top-level or nested fields fail closed. This prevents semantic-looking controls such as `alert_policy`, `latest`, display hints, scores, or remediation commands from being silently ignored.

Exact top-level fields:

```text
schema
export_surface
signed_root
```

### Export surface

Exact fields:

```text
id
document_sha256
signers
```

Requirements:

- non-empty `id`;
- exact lowercase SHA-256 in `document_sha256`;
- duplicate-free signer ids.

The export surface is **observed**, not trusted or authoritative merely because it is published.

### Signed root

Exact fields:

```text
id
version
document_sha256
verification_status
admitted_signers
```

Requirements:

- non-empty `id`;
- positive integer `version`;
- exact lowercase SHA-256 in `document_sha256`;
- `verification_status = VALID` from an earlier verification boundary;
- duplicate-free `admitted_signers`.

The receipt implementation does not itself verify a signature, certificate, COSE structure, TSA, trust list, or C2PA manifest.

## Symmetric comparison

The receipt always materializes both set differences:

```text
exported_but_unadmitted = export - signed_root
admitted_but_unexported = signed_root - export
```

Allowed descriptive states:

```text
ALIGNED
EXPORTED_UNADMITTED_PRESENT
ADMITTED_UNEXPORTED_PRESENT
BIDIRECTIONAL_DELTA
```

These states are not ordinal and do not encode severity.

## External-shape fixture

`fixtures/external-shape.json` intentionally models only the corrected external **export-vs-root explanation shape**:

```text
exported signers = 8
signed-root admitted signers = 7
```

Expected receipt:

```text
state = EXPORTED_UNADMITTED_PRESENT
exported_but_unadmitted = [fixture-witness-8]
admitted_but_unexported = []
delta_present = true
```

This fixture does **not** claim the external runtime configured eight quorum-weighted witnesses. It models two published surfaces that disagree.

## Reverse and bidirectional cases

`reverse-delta.json` proves that a root signer absent from the export is surfaced separately as `ADMITTED_UNEXPORTED_PRESENT`.

`bidirectional.json` proves that the receipt cannot collapse two opposite differences into one generic mismatch. Both exact delta lists must remain visible.

## Successor/no-backfill case

The same export fixture can be evaluated against a distinct synthetic v3 root in `successor-v3.json`.

The v3 root has a different exact digest and admits the eighth signer, so its new receipt is `ALIGNED`.

That does not rewrite the historical v2 receipt:

```text
v2 receipt = EXPORTED_UNADMITTED_PRESENT
v3 receipt = ALIGNED
```

The primitive performs no latest-root lookup and no historical mutation.

## No alert dependency

There is deliberately no alert-policy input or output, and the closed-world parser rejects attempts to add one.

The delta is observable because it is part of the receipt itself. A separate consumer may later decide whether to alert, log, display, reconcile, or do nothing, but this primitive grants no such authority.

Invariant:

```text
No alert != no observable delta
```

## Forbidden semantic promotion

Inputs containing score/remediation/authority-mutation controls are rejected, including fields such as:

```text
aggregate_score
trust_score
severity
remediation_command
quorum_override
admit
revoke
```

Unknown fields are also rejected even if they are not on this named list.

The receipt itself exposes semantic guards that remain false for:

- authority decisions;
- failure verdicts;
- quorum authority creation;
- quorum mutation;
- signer admission/revocation;
- remediation triggering;
- historical successor backfill.

## Tests

`test_receipt.py` covers 16 positive/hostile/negative cases, including:

- external-shape exported-but-unadmitted delta;
- aligned surfaces;
- reverse delta;
- bidirectional delta;
- v2/v3 successor non-backfill;
- unverified-root rejection;
- duplicate signer rejection on either surface;
- empty signer rejection;
- malformed source digest rejection;
- forbidden score/remediation/authority mutation fields;
- explicit `alert_policy` rejection;
- unknown nested field rejection;
- wrong schema rejection;
- output non-promotion guards.

## Receipt example

```bash
python scripts/observable-authority-consistency/receipt.py \
  scripts/observable-authority-consistency/fixtures/external-shape.json
```

## Non-claims

This layer does not:

- modify Stable Core, `SPEC.md`, or `PRINCIPLES.md`;
- rewrite #890 or #777;
- claim C2PA conformance;
- claim UU-AAP fixes C2PA;
- claim that any observed delta is malicious or unsafe;
- implement live polling;
- prescribe a three-hour cadence;
- alert;
- remediate;
- modify quorum;
- admit/revoke signers;
- create publication/action authority;
- create a trust, reputation, severity, or compatibility score.

Promotion beyond this bounded diagnostic receipt requires a separate successor and explicit authority.