# MarketCloser Deployment-Bound Observation Receipt v0.1

**Status:** experimental successor to MarketCloser Application Boundary v0.1  
**Issue:** #609  
**Origin frontier:** `39af0064e71c545fd38edc65eacd073b7801f729`  
**Origin tree:** `ee09104b6759616e05adfc9b648d2823bb8e5cb3`

## Purpose

This layer records that an operator supplied a deployment address together with a separately observed application artifact. It deliberately does **not** claim that the deployment was independently reached, that the artifact came from that deployment, or that the application conforms to UU-AAP.

```text
operator-supplied deployment URL
-> separately supplied application observation
-> exact local validation
-> MarketCloserDeploymentObservationReceipt
-> binding remains insufficient
-> MINIMIZED_REAL_REVIEW_BRIDGE_REQUIRED
```

## Exact predecessor

The receipt binds the merged MarketCloser Application Boundary v0.1:

```text
sha256:143981c45d5a8cfa82261247325aef81da9686d5303ef9f696683ef6e5e9ee97
```

The predecessor remains unchanged and continues to require a deployment-bound observation receipt as its next safe action.

## What is actually established

A successful manual observation may establish only:

```text
OPERATOR_DEPLOYMENT_OBSERVATION_RECORDED
```

Synthetic CI establishes only:

```text
SYNTHETIC_CONFORMANCE_OBSERVATION_RECORDED
```

In both cases v0.1 fixes:

```text
binding_status = DEPLOYMENT_BINDING_INSUFFICIENT
```

This separation lets the system preserve a real operator observation without upgrading it into stronger provenance.

## Deployment boundary

The deployment address is accepted as operator-supplied routing context.

```text
Deployment URL != Deployment Verification
Operator Observation != Independent Observation
```

v0.1 performs no HTTP request, DNS lookup, browser fetch, provider call or platform mutation. Therefore it keeps false:

```text
deployment_verified
deployment_reachability_verified
independent_observation_completed
network_fetch_performed
dns_resolution_performed
```

## Artifact boundary

A separately supplied audit or metadata export may carry a SHA-256 digest and a declared canonicalization status. The receipt preserves both without promoting the digest to independent attestation.

```text
Audit Export != Deployment Provenance
Audit Digest != Independent Attestation
```

If canonicalization is undeclared, its profile must remain `null`. If a profile is declared, the receipt only records the declaration; v0.1 still does not independently attest it.

Critically:

```text
audit_deployment_binding_established = false
source_provenance_established = false
```

Supplying an URL and an audit in the same interaction does not establish that the audit came from that URL.

## Application/conformance boundary

The operator may record a reported application version and architecture profile. These are observed/reported application properties only.

```text
Application Version != Protocol Conformance
UU-AAP/T-inspired != UU-AAP Conformance
```

The receipt always keeps:

```text
uu_aap_conformance_established = false
```

A later conformance claim would require its own protocol evidence.

## Sharing and authority boundary

Manual sharing is recorded without inventing automatic transmission or publication authority.

```text
Manual Sharing != Automatic Transmission
Developer Analysis Authorization != Publication Authority
Application Event != Authority Effect
```

The runtime cannot create publication authority, ActionPermit, PilotPermit, execution admission or external effect.

## Private pilot evidence

Repository fixtures are synthetic only. No real deployment URL, real audit digest, raw review text, developer feedback or other manually shared pilot material is committed by this profile.

The real path is supported as local input with:

```text
observation.method = manual_operator_sharing
source_artifact.kind = audit_export | metadata_export
```

but such input remains outside repository conformance fixtures.

## Exact source binding

`receipt-binding.js` re-derives the complete receipt from the exact input and requires canonical equality.

Therefore a receipt can remain internally valid after substituting a URL or artifact reference, yet still fail exact source binding.

```text
Receipt Self-Consistency != Exact Deployment Observation Binding
```

## CLI

Allowed local read-only commands:

```text
validate
receipt
inspect
help
```

Forbidden action-like commands fail closed because no such command exists.

## Next bounded successor

Every v0.1 receipt points to:

```text
MINIMIZED_REAL_REVIEW_BRIDGE_REQUIRED
```

That successor may connect human-reviewed minimized real review content to the existing Marketer Pessimist Real Review Intake, while raw review content remains application-side.

It must not use this receipt as proof of deployment verification, source provenance or UU-AAP conformance.
