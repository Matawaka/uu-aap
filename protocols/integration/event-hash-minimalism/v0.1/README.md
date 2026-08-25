# UU-AAP Event-Hash Minimalism v0.1

**Status:** experimental reusable evidence-minimization profile  
**Issue:** #391

## Purpose

Record a cryptographic commitment to a meaningful event or canonical evidence state without requiring a full low-level action trace by default.

```text
meaningful event / canonical evidence state
  -> canonicalization
  -> event hash commitment
  -> optional external payload / evidence package
  != full surveillance log
  != proof of semantics, intent, authorship or responsibility
```

## Normative separations

- `Stored Hash != Stored Action Trace`
- `Hash Commitment != Full Surveillance Log`
- `Proof of Event Integrity != Storage of Event History`
- `Event Hash != Event Payload != Evidence Package != Interpretation`
- `Available Payload != Required Payload Retention`
- `Hash Match != Proof of Intent`
- `Hash Match != Proof of Authorship`
- `Hash Match != Attribution of Responsibility`
- `Hash Match != Liability`

## Minimal storage boundary

A conforming record binds an event ID, canonicalization profile, hash algorithm, event commitment, payload-retention mode, optional external payload/evidence references, and optional provenance links.

Payload retention modes are explicit: `absent`, `local`, `distributed`, `selective`, or `temporary`. The commitment may remain useful even when payload is not stored by the commitment holder.

## Verification support

External verification may use one or more of:

- externally supplied payload;
- witness receipts;
- Circumstantial Provenance references;
- Merkle inclusion proofs;
- predecessor/successor-state linkage.

These are evidence inputs, not automatic semantic conclusions.

## Non-effects

A conforming commitment does not by itself establish semantic content, intent, authorship, identity, attribution, authority, responsibility, causality, liability, truth, execution, complete history, or permission to inspect withheld payload.

The profile performs no telemetry collection, external lookup, payload acquisition, actuator invocation, KONTUR mutation, authority expansion or publication.

## Conformance

`validate-event-hash-minimalism.js` validates the positive fixture and rejects full-trace conflation, mandatory payload retention, hash/payload conflation, unsupported semantic claims, authority/responsibility escalation, surveillance-history claims and external-effect claims.

CI is read-only.