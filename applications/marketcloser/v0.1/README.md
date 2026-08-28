# MarketCloser Application Boundary v0.1

**Status:** experimental application boundary  
**Issue:** #607  
**Origin frontier:** `9d30ec25b64430235389526267c742ea37d36dba`  
**Origin tree:** `ce7daa841e56ace21e05a982e0ca069113e56746`

## Purpose

MarketCloser is treated as a live application layer, not as a synonym for the reusable **Маркетолог Пессимиста** analytical core.

The application may own review workflow, privacy minimization, business-pressure context, response preparation, human review, copy/export state and post-publication observation. The Marketer Pessimist core remains an evidence-first bounded adversarial analysis product.

```text
MarketCloser Application != Marketer Pessimist Core
```

This separation avoids widening the already-merged Marketer Pessimist Product Contract merely because a deployed application now has a richer lifecycle.

## Application chain

```text
observed external review
-> raw-content privacy boundary
-> minimized claim/evidence representation
-> pressure context kept separate from epistemic evidence
-> Marketer Pessimist analysis candidate
-> response candidate
-> human review
-> copy/export boundary
-> publication observation
-> outcome / successor evidence
```

No transition above is an implicit authority transfer.

## Raw review boundary

A public review may contain names, order details, contact information or other personal data. Public visibility therefore does not make raw review content automatically safe for the Marketer Pessimist core.

```text
Public Content != Non-Personal Data
```

Raw review content remains application-side. Before data crosses into the Marketer Pessimist boundary it must be minimized into a bounded claim/evidence representation. The first boundary profile requires the minimized representation to contain no personal or sensitive personal data.

```text
Minimized Claim != Raw Review Identity
```

The application boundary does not claim that heuristic redaction is a privacy guarantee:

```text
Heuristic Redaction != Privacy Guarantee
```

## Epistemic symmetry

A customer review is an observed claim, not a verified fact. A merchant explanation is also a claim until supported.

```text
Public Review != Verified Fact
Merchant Explanation != Verified Fact
```

Evidence references may be stored while remaining explicitly unverified. A reference becomes independently verified only through a separate evidence-verification process.

```text
Evidence Reference != Independently Verified Evidence
```

The application must not turn a missing, unavailable or unverified evidence reference into proof that either side is false.

## Business-pressure firewall

MarketCloser may receive operational context such as platform dependency, reserve horizon, case age, response urgency or similar business-pressure signals.

Those fields may influence **triage** or the order in which a human reviews cases. They may not change:

- evidence quality;
- epistemic status;
- truth claims;
- falsification requirements;
- privacy requirements;
- publication authority.

```text
Business Pressure != Epistemic Weight
Urgency != Permission to Manipulate
```

This is an epistemic firewall between commercial pressure and the evidence layer.

## Response lifecycle

The application vocabulary separates at least these states:

```text
REVIEW_OBSERVED
EVIDENCE_RECORDED
MINIMIZATION_REQUIRED
ANALYSIS_CANDIDATE_READY
RESPONSE_CANDIDATE_READY
HUMAN_APPROVAL_REQUIRED
APPROVED_FOR_COPY_EXPORT
COPIED_PUBLICATION_UNVERIFIED
PUBLICATION_OBSERVED
OUTCOME_EVIDENCE_RECORDED
```

The state names do not imply that every deployment currently implements every transition. They define the allowed distinctions for application successors.

Critical separations:

```text
Response Candidate != Approved Response
Approved Response != Published Response
Copied Response != Published Response
Publication Observation != Publication Authority
```

A copy/export event may be locally observable while external publication remains unknown.

## Deployment provenance

A deployment address supplied by an operator is useful routing context but is not, by itself, proof that a particular audit, review or response came from that deployment.

```text
Deployment URL != Source Provenance Without Binding
```

A future deployment-binding receipt should bind at minimum:

- deployment URL;
- application identifier/version;
- observation time;
- content or export digest;
- declared canonicalization;
- observation method;
- whether the observation was independent or operator-supplied.

This v0.1 profile performs no network fetch.

The version of a deployed application and the version of this application-boundary contract are independent version axes:

```text
Deployment Version != Application Boundary Version
```

## Audit and conformance boundary

Developer/pilot audit metadata is distinct from full review content and from platform publication evidence.

```text
Audit Export != Full Case Export
Audit Digest != Independent Attestation Without Declared Canonicalization
Audit Export != Automatic Transmission
```

Observed application events do not create authority merely because they are durably recorded:

```text
Application Event != Authority Effect
```

A live application may describe itself as inspired by UU-AAP/T or another architecture without proving exact repository conformance. Real pilot evidence is evidence about the application/pilot, not automatic proof that every canonical UU-AAP receipt or invariant was exercised.

```text
UU-AAP/T-inspired != UU-AAP Conformance
Live Pilot Evidence != Protocol Conformance
```

Authorization to analyze a manually shared developer/pilot artifact is narrower than authority to publish that artifact or its content externally:

```text
Developer Analysis Authorization != External Publication Authority
```

No private pilot audit, raw review text or manually shared developer feedback is committed in this profile. The repository fixture is synthetic.

## Dependency boundary

MarketCloser consumes the existing Marketer Pessimist Product Contract as a bounded analysis dependency.

```text
authority_transfer = false
responsibility_transfer = false
raw_review_transfer = false
reverse_core_dependency = false
```

The application may later consume FREESHIELD or transport components, but those are not mandatory dependencies of this boundary profile.

## External-effect boundary

This contract models state but creates no external publication authority.

Unavailable by construction in v0.1:

```text
network publication
platform mutation
advertising account mutation
campaign send
spend
audience upload
personal targeting
identity resolution
ActionPermit creation
PilotPermit creation
execution admission
```

A future external-platform adapter must be separately bounded and must include both pre-action authority and post-action observation. It may not be smuggled into this application contract.

## Synthetic conformance

`examples/synthetic-boundary-case.json` is fictional and exists only to exercise the boundary vocabulary. It must not be presented as pilot evidence.

The validator checks:

- exact Marketer Pessimist contract dependency;
- no authority/responsibility/raw-data transfer;
- raw review content remains outside the core boundary;
- minimized input is the only allowed cross-core representation;
- business pressure has zero epistemic weight;
- unverified evidence stays unverified;
- copy/approval/publication remain distinct;
- live pilot evidence remains distinct from protocol conformance;
- audit sharing remains distinct from transmission/publication authority;
- no external-effect capability is created;
- canonical manifest hash is reproducible.

## Next boundary

After this application contract is merged, the next bounded increment should be a **Deployment-Bound Observation Receipt**, followed by a **Minimized Real Review Bridge**.

That sequence can consume real application evidence without committing raw pilot data and without weakening the Marketer Pessimist core.
