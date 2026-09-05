# Authority Surface Triangulation Receipt v0.1

Status: **additive executable observability/interoperability evidence for #893; not C2PA conformance, not UU-AAP Stable Core, not an authority decision, and not a trust score**.

Exact predecessor:

```text
9f1f4c4e5f5625f87163073bc919c4da14a9deb8
```

Merged predecessor surfaces:

- #890 — C2PA Authority-Admission Consistency Gate v0.1;
- #892 — Observable Authority Consistency Receipt v0.1;
- #777 — historical semantic-boundary draft, not reopened here.

## Why this successor exists

The corrected `c2pa-org/specifications#122` discussion made a three-surface distinction materially important:

```text
runtime/configured signer set
exported/published signer set
signed-root admitted signer set
```

The external correction explicitly said the monitor's quorum configuration already excluded the additional witness while the exported `witness_keys.json` still contained a key that the signed `trust-root.json` did not yet admit.

That means these statements are distinct:

```text
runtime configuration aligned with signed authority
export aligned with signed authority
runtime configuration aligned with export
```

None implies either of the other two.

Core invariant:

```text
Runtime configuration != exported surface != signed authority root
Pairwise equality on one edge != equality on the other two edges
Observed delta != authority decision
Triangulation != trust score
Triangulation != remediation authority
```

## Separation from #890 and #892

#890 already answers a post-crypto question about quorum eligibility and also exposes a configuration-vs-root diagnostic.

#892 already answers an observability question about export-vs-root delta.

This successor does not rewrite either predecessor. It adds the missing third edge:

```text
runtime configuration <-> export
```

and binds all three pairwise comparisons into one deterministic receipt without creating an aggregate verdict.

## Input boundary

Input schema:

```text
urn:uu-aap:authority-surface-triangulation-input:0.1
```

The parser is **closed-world**. Unknown top-level or nested fields fail closed.

### Runtime surface

Required fields:

```text
id
document_sha256
configured_signers
```

The runtime surface is an exact observed configuration snapshot. Publication of the snapshot does not make it authority.

### Export surface

Required fields:

```text
id
document_sha256
signers
```

The export is an observed published surface. Publication does not make a signer admitted by the governing root.

### Signed root

Required fields:

```text
id
version
document_sha256
verification_status = VALID
admitted_signers
```

The root must arrive from an earlier verification boundary. This primitive does not verify C2PA/COSE signatures, certificates, trust lists, TSAs, or the signed-root signature itself.

All SHA-256 bindings must be exact lowercase 64-character hex strings. Signer arrays must contain unique non-empty strings.

## Three independent symmetric comparisons

The receipt always emits all six directional differences.

### Runtime vs signed root

```text
configured_but_unadmitted
admitted_but_unconfigured
```

### Export vs signed root

```text
exported_but_unadmitted
admitted_but_unexported
```

### Runtime vs export

```text
configured_but_unexported
exported_but_unconfigured
```

Every pair also contains a descriptive `delta_present` boolean.

The top-level `any_delta_present` is observability only. It is **not** a trust/failure/severity verdict.

## Corrected external-shape fixture

`fixtures/corrected-external-shape.json` represents the corrected fact shape synthetically:

```text
runtime/configured = witnesses 1..7
exported           = witnesses 1..8
signed root v2     = witnesses 1..7
```

Required result:

```text
runtime vs root:
  delta_present = false

export vs root:
  exported_but_unadmitted = [fixture-witness-8]

runtime vs export:
  exported_but_unconfigured = [fixture-witness-8]
```

This fixture deliberately does **not** claim the eighth exported witness has runtime quorum weight.

## Additional fixtures

- `aligned.json` — all three signer sets are equal;
- `runtime-only.json` — runtime has one extra signer while export and root agree;
- `root-only.json` — signed root has one signer absent from runtime and export;
- `independent-bidirectional.json` — all three edges contain independent directional deltas;
- `successor-v3.json` — the same runtime/export snapshots are evaluated against a distinct v3 root that admits witness 8.

The successor fixture proves another important non-implication:

```text
export vs root becomes aligned under v3
!=
runtime automatically changed
```

The runtime snapshot remains seven signers, so v3 can align export/root while runtime/root and runtime/export still expose witness 8 on the non-runtime side.

## Historical successor boundary

The primitive performs no latest-root lookup and no historical mutation.

A v3 receipt is a new receipt bound to a different root digest. It does not rewrite the v2 triangulation.

Invariant:

```text
Successor root != historical explanation backfill
```

## Cross-check against merged predecessors

`cross_check.py` evaluates every synthetic fixture through:

1. this triangulation receipt;
2. merged #890's configuration/admission diagnostic boundary;
3. merged #892's export/root observable-consistency boundary.

Required consistency:

```text
triangulation runtime<->root == #890 configuration<->root diagnostic
triangulation export<->root  == #892 export<->root diagnostic
exact signed-root digest      == same digest across all compared receipts
```

Any contradiction fails closed.

The runtime<->export edge remains new and independent.

## Closed-world hostile controls

Inputs fail closed on at least:

- unknown top-level fields;
- unknown nested fields on any surface;
- malformed or missing source digests;
- unverified signed root;
- duplicate signer ids on any surface;
- empty signer ids;
- wrong input schema;
- non-positive or boolean signed-root version.

Because the schema is closed-world, injected controls such as these cannot be silently ignored:

```text
alert_policy
latest
severity
trust_score
remediation_command
quorum_override
admit
revoke
```

## Semantic non-promotion

The receipt explicitly keeps false:

```text
any_delta_is_failure_verdict
triangulation_is_authority_decision
triangulation_mints_trust
triangulation_calculates_or_mutates_quorum
triangulation_admits_or_revokes_signer
triangulation_triggers_alert_or_remediation
successor_root_backfills_historical_receipt
```

No pairwise delta proves malicious behavior, operational failure, falsity, responsibility, or intent.

## CI

Dedicated CI must:

1. rerun merged #890 tests unchanged;
2. rerun merged #892 tests unchanged;
3. run triangulation positive/hostile tests;
4. run `cross_check.py` across all fixtures;
5. emit deterministic receipts for all fixtures;
6. assert the corrected external-shape and successor outcomes exactly;
7. prove validation is repository-read-only / clean-tree.

## Example

```bash
python scripts/authority-surface-triangulation/receipt.py \
  scripts/authority-surface-triangulation/fixtures/corrected-external-shape.json
```

## Non-claims

This layer does not:

- modify Stable Core, `SPEC.md`, or `PRINCIPLES.md`;
- rewrite #890, #892, or #777;
- claim C2PA conformance;
- claim UU-AAP fixes C2PA;
- calculate or mutate quorum;
- admit or revoke signers;
- create an alerting or remediation system;
- prescribe polling cadence;
- create a trust, reputation, severity, or compatibility score;
- create publication/action authority;
- infer malicious behavior from a delta.

Promotion beyond this bounded diagnostic triangulation requires a separate successor and explicit authority.
