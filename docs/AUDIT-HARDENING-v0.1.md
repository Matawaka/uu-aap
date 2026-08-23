# Independent Audit Hardening v0.1

Status: audit-derived hardening; no authority or activation effect.

Canonical source audit conclusion: `READY_FOR_HUMAN_ACTIVATION_REVIEW` at repository revision `d4e3efd63416d9ef97d868fea096d966b843b350`.

This hardening addresses the three Medium findings from the independent bounded KONTUR audit without changing the conclusion into activation authority.

## H1 — Convergence predecessor verification

A syntactically valid 40-hex SHA is not enough to establish provenance.

The Architecture Convergence assessor now requires externally observed, read-only Git facts. Canonical CI obtains those facts from the local checkout and requires:

```text
declared canonical_predecessor_sha
== observed predecessor SHA
AND predecessor commit object exists
AND predecessor is an ancestor of the assessed revision
```

The assessor itself remains free of network and process-execution imports. Git observation is performed by the read-only workflow using the already checked-out full history.

Invariant:

```text
well-formed predecessor SHA != verified predecessor provenance
```

## H2 — Checkpoint predecessor claim separation

The Project Readiness Checkpoint combines an older Architecture Convergence manifest with later exact current-main frontier evidence.

The checkpoint builder now independently requires the convergence predecessor claim:

```text
current_kontur_activation_frontier_verified == false
```

This prevents a convergence artifact from silently pre-claiming the later evidence that the checkpoint is supposed to join.

Invariant:

```text
convergence evidence + later current-main evidence
!= convergence artifact rewritten as already current-main verified
```

## H3 — Permanent stale-checkout revision gate regression

The independent audit first encountered historical checkout:

`9894f6be4be663863696c5981d3d68c3c6777525`

while the required canonical audit revision was:

`d4e3efd63416d9ef97d868fea096d966b843b350`.

The correct behavior was to stop before substantive architecture tests.

That real incident is now a permanent regression vector:

```text
stale local HEAD
-> revision mismatch
-> audit callback does not run
-> no fallback inference
-> no inherited readiness
-> no state-change authorization
```

The revision gate is generic; the two historical SHAs are retained only as a concrete regression case.

## Non-effects

This hardening does not:

- activate KONTUR;
- authorize activation;
- create or accept a responsibility state;
- grant execution authority;
- mutate canonical origin;
- transfer repository ownership or account control;
- establish legal authority, truth certification, distributed consensus, or universal canonicality.

`READY_FOR_HUMAN_ACTIVATION_REVIEW` remains a review eligibility conclusion only.
