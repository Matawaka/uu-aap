# Authority Surface Transition Receipt v0.1

Status: **additive temporal-observability/interoperability evidence for #895; not trusted time, not C2PA conformance, not UU-AAP Stable Core, and not authority/remediation**.

Exact predecessor:

- merged #894 / `cec86dae75dba8722d4f8196db3cf9e3eb2088c3` — Authority Surface Triangulation Receipt v0.1.

Historical predecessors remain unchanged:

- #890 — authority-admission / quorum eligibility;
- #892 — observable export↔root consistency;
- #894 — three-surface triangulation.

## Why this successor exists

#894 describes one exact authority-surface snapshot:

```text
runtime/configuration
export/published signer surface
signed-root admitted signer set
```

This successor asks a narrower question:

> Given two independently valid #894 snapshots, what set membership and pairwise-delta changes are observable between the explicit `before` and `after` roles?

It does not answer why a change happened, whether the ordering is externally trustworthy, whether the change is safe, or whether remediation is required.

Core invariants:

```text
Current state != historical state
Observed transition != causal explanation
Delta disappeared != reason proven
Successor alignment != historical backfill
Later root != earlier authority
Transition receipt != remediation authority
Transition receipt != trusted time proof
```

## Input boundary

The input schema is:

```text
urn:uu-aap:authority-surface-transition-input:0.1
```

It is closed-world and contains exactly:

```json
{
  "schema": "...",
  "before": { "... exact #894 input ..." },
  "after":  { "... exact #894 input ..." }
}
```

Both snapshots are passed directly to the merged #894 evaluator. The transition layer does not reimplement the triangulation contract.

`before` and `after` are explicit caller roles only. They are not timestamps, clock attestations, TSA evidence, or proof of real-world chronology.

## Root relation

Allowed relations:

```text
SAME_ROOT
SUCCESSOR_ROOT
```

Rules:

- same version + same digest => `SAME_ROOT`;
- greater after-version + different digest => `SUCCESSOR_ROOT`;
- same version + different digest => fail closed;
- lower after-version => fail closed;
- greater after-version + identical digest => fail closed;
- root id substitution => fail closed.

Version order is only a bounded root-lineage rule. It is not trusted time.

## Digest/content consistency closure

A temporal comparison adds one narrow consistency rule over the already accepted source bindings:

```text
same document SHA-256 + different signer set = contradictory transition input
```

This is enforced independently for runtime, export, and signed-root signer sets.

The rule does not change #894. It only prevents this successor from accepting two different semantic set representations while claiming the same exact source document digest.

## Per-surface membership transition

Each surface exposes:

```text
added
removed
persisted
document_sha256_changed
```

for:

```text
runtime
export
root_admission
```

`added` and `removed` are set-membership descriptions between the supplied roles only.

```text
root_admission.added != admission action performed
runtime.added != authority granted
export.removed != revocation performed
```

## Directional delta lifecycle

All six directional deltas from #894 are preserved independently:

```text
configured_but_unadmitted
admitted_but_unconfigured
exported_but_unadmitted
admitted_but_unexported
configured_but_unexported
exported_but_unconfigured
```

Each has:

```text
introduced
resolved
persisted
```

Definitions:

- `introduced`: absent before, present after;
- `resolved`: present before, absent after;
- `persisted`: present in both.

These are descriptive only:

```text
introduced != failure
resolved != safe
persisted != malicious
```

## Canonical root-successor fixture

`fixtures/root-successor.json` models:

```text
before:
  runtime = 1..7
  export  = 1..8
  root v2 = 1..7

after:
  runtime = 1..7
  export  = 1..8
  root v3 = 1..8
```

Required observations:

```text
root_relation = SUCCESSOR_ROOT
root_admission.added = witness-8
exported_but_unadmitted.resolved = witness-8
admitted_but_unconfigured.introduced = witness-8
exported_but_unconfigured.persisted = witness-8
runtime.added = []
```

The critical point is that successor root admission does not manufacture a runtime configuration update.

## Same-root fixtures

`same-root-export-correction.json` changes only the exported signer surface. Root authority remains byte-identical.

`same-root-runtime-update.json` changes only runtime configuration. Root authority remains byte-identical.

These fixtures prove that a mutation on one surface is not silently promoted into a change on another.

## No-op fixture

`no-op.json` passes the same exact snapshot in both roles.

Required:

```text
root_relation = SAME_ROOT
any_membership_change = false
any_delta_lifecycle_change = false
```

Current deltas may persist; persistence is observable without being assigned severity or intent.

## Fail-closed controls

The hostile test corpus rejects at least:

- same-version different-root digest replacement;
- root version rollback;
- successor version reusing identical root digest;
- root identity substitution;
- changed runtime signer set under identical runtime digest;
- changed export signer set under identical export digest;
- changed admitted signer set under identical root digest;
- unverified roots;
- unknown top-level fields such as `timestamp`, `trusted_time`, `latest_root`, `alert_policy`, `remediation`, `trust_score`;
- unknown nested #894 snapshot fields.

## Receipt boundary

The deterministic receipt includes:

- exact before/after #894 surface ids/digests and root versions;
- root relation;
- per-surface added/removed/persisted arrays;
- digest-change booleans;
- lifecycle for all six directional deltas;
- observability booleans `any_membership_change` and `any_delta_lifecycle_change`;
- explicit semantic guards against trusted-time proof, causal inference, authority/quorum mutation, latest-root substitution, remediation and historical backfill.

No aggregate trust/failure/severity score.

## Example

```bash
python scripts/authority-surface-transition/receipt.py \
  scripts/authority-surface-transition/fixtures/root-successor.json
```

## Non-claims

This layer does not:

- modify Stable Core, `SPEC.md`, `PRINCIPLES.md`, #890, #892, #894, or #777;
- establish trusted timestamps or real-world chronology;
- prove causality, intent, compromise, fault, truth, safety or maliciousness;
- perform signer admission/revocation;
- calculate or mutate quorum;
- perform latest-root lookup/substitution;
- alert, remediate, poll, publish, or create action authority;
- create a trust, reputation, severity, or compatibility score.

Promotion beyond this bounded temporal-observability receipt requires a separate successor and explicit authority.
