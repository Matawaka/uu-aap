# C2PA SDK → Event-Responsive Dormancy Adapter v0.1

Status: **experimental direct-reuse adapter**. Tracking issue: #924.

Repository predecessor: `783a053ff41a94e369aad3155431ded78ed8e98e`.

## Purpose

This adapter materializes the independent `Q1_C2PA_SDK_SUCCESSOR` fit qualified by merged #884. The C2PA SDK preservation line has a real event-responsive need: relevant upstream movement should wake bounded attention for fresh re-evaluation, while the waiting process itself should not remain active and the event must not restore old authority.

The implementation directly reuses accepted `EventResponsiveDormancy@0.1`.

```text
accepted C2PA preservation frontier
        ↓
EventResponsiveDormantCapability
        ↓
explicit EVIDENCE_BOUND upstream-change signal
        ↓
accepted ERD.evaluateWake(... checks: null)
        ↓
WAKE_ATTENTION_ONLY | NO_WAKE_SIGNAL_MATCH
        ↓
separate targeted re-audit review, if warranted
```

## Why `checks: null` is fixed

The C2PA adapter is deliberately narrower than the complete ERD API. It cannot accept caller-provided `current_evidence`, `current_authority`, or `intent_corridor` checks.

Therefore this adapter cannot reach:

- `READY_FOR_SEPARATE_ACTION_ADMISSION`;
- `PreActionEvidenceBundle`;
- ActionPermit;
- authority restoration;
- automatic targeted re-audit execution.

A matching signal creates attention only.

## Accepted source frontier

The dormant capability is bound to the accepted #917 Swift successor evidence:

- Swift main `6fa8a78c16abac3b3f7eb4832c2cc943c9c19f0f`;
- public `C2PAC v0.0.12`;
- source contract `CURRENT_MAIN_SOURCE_PASS`;
- external SwiftPM consumer `BLOCKED_SOURCE_BINARY_SKEW`;
- Android main `077035cda5bf6849abf270829b98af789cc31e4f` / `UNCHANGED_NO_RETEST_REQUIRED`;
- receipt fingerprint `a7ae8037e188e552c07106f546db16169757bb620250cfd8df17e05e2df77b53`.

This source is historical accepted evidence, not current authority and not a compatibility PASS.

## Wake signals

The capability recognizes only:

- `SWIFT_PRESERVATION_FRONTIER_CHANGED`;
- `ANDROID_PRESERVATION_FRONTIER_CHANGED`.

The adapter additionally requires `source_assurance = EVIDENCE_BOUND`. A signal with the wrong context, scope, or kind does not wake. A structurally valid but unestablished signal is rejected by the adapter rather than used as real C2PA wake evidence.

## Direct reuse boundary

`adapter.js` imports:

`protocols/integration/event-responsive-dormancy/v0.1/event-responsive-dormancy.js`

and delegates dormant-capability validation, wake-signal validation, canonical digests and wake evaluation to that accepted module. It does not reimplement ERD state transition semantics.

No RERC or Recoverable State Infrastructure Candidate dependency is introduced.

## Core invariants

```text
Trigger != Authorization
Wake Attention != Targeted Re-audit Execution
Upstream Change != Compatibility PASS
Source Preservation != Consumer Round-trip
Dormant Capability != Polling Process
Historical Frontier != Current Authority
ERD Reuse != RSIC Demand
Direct Reuse != Stable Core Promotion
```

## Output

The adapter returns:

1. the deterministic `EventResponsiveDormantCapability`;
2. the accepted ERD `EventResponsiveDormancyWakeReceipt`;
3. `C2PASDKEventResponsiveDormancyAdapterReceipt`.

The adapter receipt records direct ERD reuse, source binding and whether a separate targeted-re-audit review is warranted. It does not perform that review or execute any re-audit.

## Evidence and tests

`source-bindings.json` binds exact current bytes for ERD, #884 qualification, the C2PA SDK successor classifier and frozen #917 executable evidence.

The hostile suite covers source substitution, compatibility promotion, historical rewrite, signal mismatch, assurance downgrade, caller check injection, authority/action escalation, input mutation, deterministic output and accidental RERC/RSIC coupling.

## Non-effects

No live upstream fetch, polling, scheduler, background process, target re-audit execution, C2PA conformance claim, compatibility PASS, authority, ActionPermit, external effect, RERC/RSIC mutation, Interface Registry mutation, Stable Core/SPEC change, release/tag, Workbench or KONTUR mutation.
