# UU-AAP successor obligations v0.1

This document is normative for `SuccessorManifest` artifacts governed by Stack Evolution / Compatibility v0.1.

## Conformance evidence is mandatory

Every successor manifest MUST declare all of the following as required:

- at least one positive conformance fixture;
- negative conformance fixtures;
- cross-version compatibility vectors;
- Action Gate bypass rejection vectors;
- historical receipt non-reinterpretation vectors.

A successor that omits any of these obligations is not conforming, even if its implementation otherwise passes current tests.

```text
successful current tests != sufficient successor evidence
```

The successor must prove both what is accepted and what is rejected at the changed semantic boundary.

## Independence is mandatory

A Core successor MUST remain implementable without a hidden dependency on:

- KONTUR;
- another external contour;
- a specific runtime vendor/provider.

The manifest therefore requires:

```text
external_contour_required = false
runtime_vendor_required = false
kontur_required = false
```

An external system may implement or adapt the protocol, but its existence cannot become an implicit prerequisite for Core meaning.

## CompatibilityReceipt non-effects

`CompatibilityReceipt.non_effects` is a closed typed object. Every listed semantic escalation field MUST be present and `false`.

Translation alone cannot create or infer intent, create/expand authority, accept responsibility, complete coordination, create an `ActionPermit`, perform an action, refresh a frontier, prove causality, certify truth, establish liability, or establish universal canonicality.

```text
adapter validity != semantic strengthening
translation != re-observation
compatibility != continued freshness
```

These obligations close the Stack Evolution / Compatibility acceptance boundary defined by #324 without modifying frozen `protocols/core/v0.1`.