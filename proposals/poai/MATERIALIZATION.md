# PoAI Materialization Boundary

**Status:** Experimental normative semantic draft  
**Version:** 0.1  
**Protocol line:** PoAI successor development after Level 4 evidence experiments  
**Conformance effect:** none yet; this document does **not** establish PoAI/V  
**RFC:** [Issue #104](https://github.com/Matawaka/uu-aap/issues/104)

## 1. Purpose

This document defines the semantic boundary between a **proposed successor** and a **recognized successor** in Proof of Available Intelligence (PoAI).

PoAI already distinguishes decision-time intelligence from later evidence, review, appeal, execution, verification and outcome observation. A remaining problem is institutional rather than merely cryptographic:

> **When may a proposed continuation of a PoAI history be recognized as the continuation that governs a defined scope?**

This document calls that transition **materialization**.

The central distinction is:

`proposal != approval != authority != materialization != canonicality != truth`

and:

`valid signature != verified identity != verified authority != materialization authority`

Materialization is therefore not a synonym for signing, publishing, approving, validating or proving truth.

## 2. Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** express requirements of this experimental PoAI semantic layer.

They are normative only within this proposal. PoAI remains research work and this document does not modify UU-AAP v0.1 conformance.

## 3. Scope

This document applies when one PoAI record or append-only artifact proposes a later state that may be treated as a successor to an earlier PoAI record.

It covers:

- successor proposals;
- materialization policies;
- materialization authority;
- materialization events;
- canonicality claims;
- conflicting successors;
- stays, appeals and supersession;
- preservation of the original decision-time state.

It does **not** define:

- factual truth;
- causal proof;
- legal liability;
- moral legitimacy;
- jurisdiction in law;
- universal identity;
- a universal source of institutional authority.

## 4. Core terms

### 4.1 Source Record

The already-existing PoAI record whose history may receive a successor.

A Source Record is immutable for purposes of materialization. Materialization MUST NOT rewrite its Decision Boundary, Knowledge Cutoff, original Future Target state, original consideration state or original authority state.

### 4.2 Successor Proposal

An append-only artifact that proposes a candidate continuation of a Source Record.

A Successor Proposal MAY contain or bind:

- a proposed successor identifier;
- a candidate successor body;
- a candidate successor digest;
- Outcome Observation references;
- intervention references;
- review or appeal references;
- causal-status claims;
- proposer metadata.

A Successor Proposal is **not** a successor merely because it exists, validates structurally, is signed or is publicly published.

### 4.3 Candidate Successor

The exact record state proposed for recognition.

Before materialization, the Candidate Successor MUST be bound to stable bytes or an equivalent deterministic digest representation. A later mutation MUST produce a different candidate identity or digest.

### 4.4 Materialization Policy

A versioned rule set defining the conditions under which a Candidate Successor may be recognized within a particular **Canonicality Scope**.

A Materialization Policy answers questions such as:

- what successor relationship is permitted;
- what evidence is required;
- what authority scope is required;
- who or what may attest issuer entitlement;
- whether quorum is required;
- whether appeals can stay materialization;
- how conflicts are handled;
- whether multiple recognized heads are permitted;
- how policy replacement is represented.

### 4.5 Materialization Authority

A scoped entitlement to apply a Materialization Policy to a specified target.

Materialization Authority is not inferred from authorship, signature possession, account control, reviewer status, decision authority or ordinary successor-proposal authority.

### 4.6 Materialization Event

An append-only event recording an attempted application of a specific Materialization Policy to an exact Candidate Successor.

A Materialization Event records what was evaluated, by whom or by what process, under which policy, with which evidence and with which declared result.

The event itself does not make its claims true. It creates a verifiable historical assertion about the materialization act.

### 4.7 Canonicality Claim

A claim that a Candidate Successor has a defined recognition state within a declared Canonicality Scope and under a declared Materialization Policy.

Canonicality is **policy-relative**, not a universal metaphysical property of a record.

### 4.8 Canonicality Scope

The domain inside which a Canonicality Claim is intended to govern.

Examples may include:

- one repository;
- one protocol deployment;
- one organization;
- one audit process;
- one contractual workflow;
- one public registry.

Two different scopes MAY legitimately recognize different successors without one record becoming universally false.

### 4.9 Conflict Set

A set of two or more materially incompatible Candidate Successors that claim the same predecessor and overlap in Canonicality Scope.

A conflict MUST remain observable until a declared policy resolves, partitions or explicitly preserves it.

## 5. Fundamental invariants

A conforming materialization design MUST preserve all of the following distinctions.

### 5.1 Proposal is not materialization

Creating, signing, validating or publishing a Successor Proposal MUST NOT by itself establish a Canonical Successor.

### 5.2 Signature is not authority

A valid signature proves only the cryptographic relationship defined by its signature profile. It MUST NOT by itself establish signer identity, signer authority or materialization authority.

### 5.3 Identity evidence is not authority

Evidence linking a key to an external identifier or controlled account MUST NOT by itself establish authority over a PoAI chain.

### 5.4 Authority evidence is not verified authority

A signed and publicly observable authority claim MUST remain distinguishable from verified authority. Verification requires a policy-defined basis for evaluating the issuer's entitlement to grant that scope.

### 5.5 Materialization is not truth

A materialized successor MAY still contain disputed, uncertain, provisional or later-corrected claims.

Materialization MUST NOT imply:

- `truth_certified`;
- `causal_proof_certified`;
- `legal_responsibility_determined`;
- `moral_correctness_established`.

### 5.6 Canonicality is scoped

A Canonicality Claim MUST identify or resolve to its Canonicality Scope and Materialization Policy.

A record MUST NOT claim universal canonicality merely because one policy recognized it.

### 5.7 History is append-only

Materialization MUST NOT silently modify the Source Record or delete conflicting historical proposals.

Corrections, reversals, stays and supersession SHOULD be represented by later artifacts or events.

## 6. Materialization Policy requirements

A Materialization Policy SHOULD be independently addressable and SHOULD contain or bind at least:

```text
policy_id
policy_version
canonicality_scope
applies_to
required_authority_scope
authority_verification_rule
candidate_binding_rule
conflict_rule
appeal_or_stay_rule
effective_from
effective_until
supersedes_policy
```

### 6.1 Stable policy identity

A Materialization Event MUST identify the exact policy version it applies.

If policy content is mutable, the event MUST additionally bind the policy content by digest or equivalent immutable reference.

### 6.2 Candidate binding rule

A policy MUST define how the exact Candidate Successor is identified.

For the current PoAI Level 4 line, the preferred minimum is:

`RFC 8785 JCS -> UTF-8 -> SHA-256`

A policy MAY additionally require a signature envelope or another interoperable content-binding mechanism.

### 6.3 Authority verification rule

A policy MUST define what counts as sufficient evidence for the required materialization authority.

The rule SHOULD be explicit about:

- subject key or actor;
- required scope;
- target resource or chain;
- validity interval;
- delegation state;
- issuer identity evidence;
- issuer entitlement evidence;
- required independent attestations or quorum, if any.

An implementation MUST NOT silently upgrade `authority evidence observed` to `authority verified` without satisfying this rule.

### 6.4 Conflict rule

A policy MUST define the behavior when multiple incompatible Candidate Successors are eligible.

Possible policy behaviors include:

- reject materialization until conflict resolution;
- require quorum;
- require adjudication;
- allow multiple heads in explicitly different scopes;
- recognize one candidate while preserving a contested status;
- defer recognition.

The policy MUST NOT discard conflicting evidence merely to produce a single clean history.

### 6.5 Appeal and stay rule

A policy SHOULD define whether an Appeal Request or other contest can suspend pending materialization.

A stay MUST be represented separately from reversal of the underlying decision or falsification of the candidate.

## 7. Materialization Authority requirements

Materialization Authority MUST be scoped.

A minimum authority description SHOULD identify:

```text
authority_subject
authority_scope
target
valid_from
valid_until
delegation_status
issuer
issuer_entitlement_basis
```

The authority scope for recognizing a successor SHOULD be more specific than ordinary decision authority.

Recommended provisional scope:

`poai.successor.materialization.execute`

The already tested scope:

`poai.successor.materialization.propose`

MUST NOT be interpreted as permission to execute materialization.

This distinction is intentional:

`propose != execute`

## 8. Materialization Event requirements

A Materialization Event SHOULD be represented as a separate append-only artifact.

It SHOULD contain or bind at least:

```text
materialization_event_id
recorded_at
source_record_ref
successor_proposal_ref
candidate_successor_ref
candidate_successor_digest
materialization_policy_ref
materialization_policy_digest
authority_evidence_refs
issuer_entitlement_evidence_refs
contest_or_stay_refs
verification_results
declared_disposition
canonicality_claim
```

### 8.1 Exact candidate requirement

The Materialization Event MUST bind the exact Candidate Successor evaluated by the policy.

A different digest is a different materialization target.

### 8.2 Exact policy requirement

The Materialization Event MUST bind the exact policy version used.

Changing policy after the event MUST NOT retroactively change which rules were evaluated at that time.

### 8.3 Declared disposition

Recommended provisional dispositions:

- `materialized`;
- `rejected`;
- `deferred`;
- `stayed`;
- `conflicted`;
- `indeterminate`.

The disposition is a claim about the materialization process, not a truth verdict on the successor's substantive content.

## 9. Canonicality model

### 9.1 Provisional states

PoAI SHOULD support at least the following policy-relative canonicality states:

- `unmaterialized` — no applicable successful Materialization Event is established;
- `materialized` — a policy-recognized successor is established for the scope;
- `contested` — recognition exists or is claimed but is under an unresolved challenge affecting canonicality;
- `superseded` — a later policy-recognized successor or policy action replaces the earlier recognized head for prospective use;
- `unresolved` — competing or incomplete evidence prevents a policy-relative canonical head from being determined.

### 9.2 No universal canonical bit

PoAI SHOULD NOT define a context-free boolean such as:

```json
"canonical": true
```

without also identifying the policy and scope under which the value is meaningful.

A safer conceptual form is:

```json
{
  "status": "materialized",
  "scope": "github:Matawaka/uu-aap",
  "policy_ref": "urn:poai:materialization-policy:...",
  "materialization_event_ref": "urn:poai:materialization:..."
}
```

## 10. Conflicting successors

Suppose Source Record `R1` receives two incompatible candidates:

```text
R1
 |- S2A: outcome = realized
 `- S2B: outcome = not_realized_after_intervention
```

Both candidates may be:

- structurally valid;
- correctly signed;
- bound to evidence;
- published by recognized identifiers.

PoAI MUST NOT infer that either candidate is canonical from those facts alone.

The candidates form a Conflict Set if they overlap in scope and cannot both satisfy the same single-head policy.

A verifier SHOULD expose:

```text
STRUCTURAL STATUS
SIGNATURE STATUS
ARTIFACT BINDING STATUS
AUTHORITY EVIDENCE STATUS
MATERIALIZATION ELIGIBILITY
CANONICALITY STATUS
CONFLICT STATUS
```

as separate dimensions rather than compressing them into a single `verified` result.

## 11. Contestability, appeal and suspension

A challenge to materialization MAY target:

- candidate identity or digest;
- policy identity or applicability;
- authority scope;
- authority validity interval;
- delegation chain;
- issuer entitlement;
- quorum;
- conflict handling;
- evidence cutoff;
- presence of a stay;
- later supersession.

A challenge SHOULD be append-only.

Where a policy recognizes stays, a pending stay SHOULD prevent a new Materialization Event from declaring `materialized` until the stay is resolved or expires.

A later adjudication MAY lift or confirm the stay without rewriting the original challenge.

## 12. Decision-time preservation

A successor exists after the original Decision Boundary and therefore has access to later information.

That later information MUST NOT be injected into the earlier decision state.

In particular, materialization MUST preserve:

- original `decision_boundary`;
- original `knowledge_cutoff`;
- original Future Target epistemic status;
- original availability claims;
- original consideration state;
- original authority mapping as recorded for the decision time.

A successor MAY add later outcome knowledge, corrections and review, but MUST represent them as later provenance.

## 13. Relation to successful warnings

A Materialization Policy MUST permit the protocol to preserve the difference between:

`prediction false`

and:

`predicted event not realized after intervention`.

A successor carrying `not_realized_after_intervention` MAY become materialized without asserting that the original prediction was false.

Materialization therefore recognizes a later historical state; it does not erase the epistemic validity of the earlier warning at the time it was issued.

## 14. Verification layers

An implementation SHOULD expose the following layers separately:

```text
1. STRUCTURE
2. ARTIFACT BINDING
3. SIGNATURE
4. KEY CONTINUITY
5. IDENTITY EVIDENCE
6. AUTHORITY EVIDENCE
7. ISSUER ENTITLEMENT
8. POLICY APPLICABILITY
9. MATERIALIZATION EVENT
10. CANONICALITY CLAIM
```

No earlier layer automatically establishes a later layer.

In particular:

```text
matching digest
  != valid signature
  != stable key
  != verified identity
  != authority evidence
  != verified authority
  != materialization authority
  != materialized successor
  != factual truth
```

## 15. Threat model

Materialization introduces additional attack classes beyond Genesis PoAI.

### 15.1 Signature laundering

Treating any valid signature as permission to materialize.

### 15.2 Identity laundering

Treating control of an external identifier as proof of legal identity or institutional role.

### 15.3 Authority laundering

Treating a published authority claim as verified authority without checking issuer entitlement.

### 15.4 Policy substitution

Evaluating a candidate under a later or weaker policy while claiming the original policy applied.

### 15.5 Candidate substitution

Approving one digest and publishing another successor body.

### 15.6 Conflict erasure

Deleting or hiding competing valid successors after one candidate is recognized.

### 15.7 Hindsight materialization

Rewriting original decision-time fields using information available only after the Decision Boundary.

### 15.8 Scope inflation

Using authority valid for one target, action or time window to materialize a different chain.

### 15.9 Delegation inflation

Treating `non_delegable` authority as delegable or accepting a delegation path not permitted by policy.

## 16. Minimum machine-layer invariants for a future implementation

Before a materialization artifact can be accepted by a future PoAI machine layer, the implementation SHOULD enforce at least:

1. Source Record reference resolves.
2. Successor Proposal reference resolves.
3. Candidate Successor digest is syntactically valid and matches the supplied candidate when bytes are available.
4. Materialization Policy reference resolves or is digest-bound.
5. Policy version is explicit.
6. Canonicality Scope is explicit.
7. Required authority scope matches exactly or through an explicitly defined policy hierarchy.
8. Authority target covers the Source Record / chain target.
9. Materialization time falls within authority validity.
10. Delegation constraints are satisfied.
11. Required issuer-entitlement evidence is present.
12. Applicable stays are evaluated.
13. Conflict policy is evaluated.
14. Original Decision Boundary and Knowledge Cutoff are not mutated.
15. Materialization does not set truth, causality, legal responsibility or PoAI/V conformance merely from successful recognition.

## 17. Provisional artifact families

This document does not yet freeze JSON schemas, but the following future artifact families are reserved conceptually:

- `PoAIMaterializationPolicy`
- `PoAIMaterializationEvent`
- `PoAICanonicalityClaim`
- `PoAIConflictSet`

They SHOULD remain separate from the Genesis Decision Record unless later evidence demonstrates that embedding them is necessary and safe.

## 18. Relationship to PoAI/V

Level 4 evidence experiments establish components needed by a future PoAI/V profile:

- deterministic binding;
- digital signatures;
- key continuity;
- identity evidence;
- authority evidence.

These components are necessary but not sufficient.

A future PoAI/V profile SHOULD NOT treat a successor as verifiably materialized until a verifier can evaluate:

1. the exact candidate;
2. the exact policy;
3. the required authority;
4. issuer entitlement;
5. conflict/stay state;
6. the Materialization Event;
7. the resulting policy-relative Canonicality Claim.

Therefore:

`Level 4 evidence != PoAI/V`

and:

`cryptographic verifiability != institutional legitimacy`.

## 19. Worked conceptual example

Consider the synthetic shipment Future Target.

### Decision-time record

`R1` records that a shipment delay is probable and that intervention is authorized.

### Later outcome

An Outcome Observation records that the delay did not occur after rerouting and expediting.

### Proposal

A Successor Proposal binds Candidate Successor `R2` with:

`outcome.status = not_realized_after_intervention`.

### Authority evidence

A key may hold evidence for:

`poai.successor.materialization.propose`.

That permits only proposal under the declared evidence semantics. It does not permit materialization.

### Materialization policy

A repository policy may require:

- candidate SHA-256 binding;
- valid successor proposal signature;
- materialization scope `poai.successor.materialization.execute`;
- authority valid for `github:Matawaka/uu-aap`;
- issuer entitlement established by repository governance;
- no active stay;
- no unresolved conflicting candidate.

### Materialization event

If all policy checks pass, a later Materialization Event may declare Candidate `R2` materialized for that repository scope.

The resulting claim means:

> Under policy P, for scope S, the repository recognizes R2 as the successor to R1.

It does **not** mean:

> R2 is universally true, legally binding everywhere, causally proven, or morally correct.

## 20. Open questions

The following questions remain intentionally unresolved:

1. Should a Materialization Policy permit multiple recognized heads within one Canonicality Scope?
2. What is the minimum portable representation of issuer entitlement?
3. When does a repository administrator's technical control count as materialization authority, and when must a separate governance rule exist?
4. Should policy evaluation itself be represented as a signed verifiable artifact?
5. How should quorum and threshold signatures be represented without binding PoAI to one cryptographic system?
6. How should offline/private materialization scopes publish selective proofs?
7. Should a contested materialized successor remain operationally canonical while an appeal is pending, or should that always be policy-specific?
8. How should cross-scope canonicality conflicts be displayed to users without implying that one scope is globally authoritative?

## 21. Normative thesis

PoAI materialization begins from one rule:

> **A successor becomes recognized not because it was written, signed or published, but because an exact candidate was evaluated under an explicit policy by authority that the policy can justify, with conflicts and contestability preserved as part of history.**

The protocol therefore preserves the final distinction:

`proof of provenance != proof of authority != proof of recognition != proof of truth`.
