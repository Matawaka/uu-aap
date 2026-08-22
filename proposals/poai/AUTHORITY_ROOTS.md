# PoAI Authority Root and Issuer Entitlement Boundary

**Status:** Experimental normative semantic draft  
**Version:** 0.1  
**Protocol line:** PoAI materialization governance after Materialization Machine Layer v0.1  
**Conformance effect:** none yet; this document does **not** establish PoAI/V  
**RFC:** [Issue #108](https://github.com/Matawaka/uu-aap/issues/108)  
**Implementation tracker:** [Issue #109](https://github.com/Matawaka/uu-aap/issues/109)

## 1. Purpose

This document defines how Proof of Available Intelligence (PoAI) may reason about the origin of authority without converting cryptographic evidence, identity evidence, account control or institutional claims into universal legitimacy.

The immediate problem appears at the Materialization Boundary.

A Materialization Policy can require:

`poai.successor.materialization.execute`

but a verifier still needs to answer:

> **Why is this issuer entitled to grant that authority, and where does recursive authority verification stop?**

PoAI answers by making the stopping point explicit.

The central model is:

`authority evidence -> issuer entitlement -> authority grant -> materialization authority`

with every verified path terminating in an explicit **Authority Root** accepted by the exact policy for the exact scope.

The root is not universal truth or universal legitimacy. It is a declared governance anchor.

Core distinctions:

`signature != identity != role != issuer entitlement != delegated authority != materialization authority`

`authority root acceptance != universal legitimacy`

`policy controller != authority issuer != materialization executor`

`repository control != legal identity != external institutional authority`

## 2. Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** express requirements of this experimental PoAI semantic layer.

They are normative only within this proposal. PoAI remains research work. This document does not modify UU-AAP v0.1 conformance and does not by itself establish PoAI/V.

## 3. Scope

This document applies when PoAI needs to evaluate whether an actor or key is entitled to:

- issue a scoped authority grant;
- delegate an existing authority;
- control or replace a Materialization Policy;
- execute a Materialization Policy;
- attest another actor's entitlement;
- participate in a quorum or collective authority root;
- rotate or supersede an authority root.

It covers:

- Authority Roots;
- Root Acceptance Rules;
- root evidence;
- issuer entitlement;
- authority grants and delegation;
- authority provenance graphs;
- Policy Controllers;
- self-governed resource roots;
- institutional, contractual, registry, statutory and quorum roots;
- root rotation, revocation and supersession;
- authority conflicts;
- integration with Materialization Policy verification.

It does **not** define or prove:

- ultimate philosophical legitimacy;
- legal identity;
- legal ownership;
- employment status;
- statutory authority as a matter of law;
- factual truth;
- causal proof;
- moral legitimacy;
- legal liability;
- universal canonicality;
- universal trust scores.

## 4. The regress boundary

Authority verification otherwise produces an infinite question:

```text
Who authorized A?
Who authorized the issuer of A?
Who authorized that issuer?
...
```

PoAI MUST NOT hide this regress behind a signature, account name, organization label or `verified` badge.

Instead, a conforming authority verification path terminates at one or more explicitly declared **Authority Roots**.

The verifier then evaluates:

```text
authority path
  -> declared Authority Root
  -> root evidence
  -> exact policy Root Acceptance Rule
  -> accepted or not accepted for this scope
```

PoAI can verify consistency **from an accepted root downward**.

PoAI cannot cryptographically prove that every verifier, court, institution, society or person ought to accept that root.

That remaining choice is governance, not cryptographic proof.

## 5. Core terms

### 5.1 Authority Root

An **Authority Root** is a versioned, scope-bounded governance anchor at which recursive issuer-entitlement resolution intentionally stops.

An Authority Root MUST declare:

- a stable root identifier;
- root version;
- root mode;
- governed target or namespace;
- canonicality/governance scope;
- accepted authority actions;
- controller information or controller rule;
- evidence basis;
- effective interval;
- replacement/supersession state;
- whether and how downstream delegation is permitted.

An Authority Root is not universal authority merely because it is structurally valid, signed, published or accepted by one policy.

### 5.2 Root Manifest

A **Root Manifest** is the machine-addressable representation of an Authority Root.

A Root Manifest SHOULD be independently bindable using deterministic bytes and digest semantics compatible with the PoAI Level 4 line.

A Root Manifest MAY be signed, but signature validity MUST remain separate from root acceptance.

### 5.3 Root Acceptance Rule

A **Root Acceptance Rule** is the rule by which an exact Materialization Policy or other authority-consuming policy decides whether a particular Authority Root is accepted for a particular action, target and scope.

Root acceptance is therefore policy-relative.

A Root Acceptance Rule MUST NOT silently treat all structurally valid roots as accepted roots.

### 5.4 Root Evidence

**Root Evidence** is evidence relevant to the policy's basis for accepting a root.

Examples include:

- public repository-control evidence;
- a versioned charter;
- a signed contract;
- an external registry statement;
- a statutory instrument reference;
- quorum signatures;
- a previous root's authorized supersession event.

Root Evidence is evidence, not truth certification.

### 5.5 Governance Scope

The **Governance Scope** is the maximum domain over which an Authority Root can be used as an authority source.

A root MUST NOT issue or validate authority outside its Governance Scope.

### 5.6 Root Controller

A **Root Controller** is a key, actor, set of actors or rule recognized by the root for actions that govern the root itself.

Root-control actions may include:

- issuing direct grants;
- changing controller membership;
- replacing the root;
- suspending the root;
- authorizing a Policy Controller.

Control of a root is not automatically materialization execution authority.

### 5.7 Policy Controller

A **Policy Controller** is an actor, key, quorum or mechanism entitled to create, replace, suspend or supersede a Materialization Policy for a declared scope.

Recommended provisional action:

`poai.materialization.policy.control`

This MUST remain distinct from:

`poai.successor.materialization.execute`

An actor MAY hold both, but each authority MUST be independently established.

### 5.8 Issuer Entitlement

**Issuer Entitlement** is the verified policy-relative conclusion that an issuer is permitted to grant a specific authority action to a subject over a specific target and interval.

Issuer Entitlement is not inferred from issuer identity alone.

### 5.9 Authority Grant

An **Authority Grant** is an append-only, bound claim that an issuer grants one or more constrained authority actions to a subject.

A grant MAY be signed. A valid signature proves only the cryptographic relation to the signed grant statement.

The grant becomes usable as verified authority only when the entire upstream authority provenance satisfies the policy.

### 5.10 Authority Provenance Graph

An **Authority Provenance Graph** is the directed graph connecting:

- Authority Roots;
- Root Acceptance Rules;
- issuers;
- subjects;
- Authority Grants;
- delegation steps;
- quorum contributions;
- Policy Controllers;
- final authority consumers such as a Materialization Event.

The graph MUST be acyclic for a single verification result.

A simple delegation is a chain. A quorum or multi-root rule may form a directed acyclic graph.

### 5.11 Root Transition

A **Root Transition** is an append-only event that creates a later root version, supersedes an earlier root, changes controllers, or terminates a root's prospective authority.

A Root Transition MUST NOT rewrite historical materializations made under the earlier root.

## 6. Fundamental invariants

### 6.1 Root acceptance is not universal legitimacy

A policy may accept an Authority Root for one scope.

That MUST NOT be represented as proof that the root is universally legitimate.

### 6.2 Identity is not issuer entitlement

Verified control of a key, account or external identifier MUST NOT by itself establish that the actor may grant authority.

### 6.3 Account control is scoped evidence

Observable control of a repository or account MAY be accepted by a policy as governance evidence for that exact resource.

It MUST NOT silently establish legal identity, organization ownership, authority over third parties or authority over external resources.

### 6.4 Child authority cannot exceed parent authority

Every delegated Authority Grant MUST be equal to or narrower than its verified parent authority.

A child MUST NOT broaden:

- action scope;
- target;
- governance scope;
- validity interval;
- delegation depth;
- quorum privileges;
- policy-control privileges;
- root-control privileges.

### 6.5 Non-delegable means terminal

If a parent authority is `non_delegable`, it MUST NOT be used as the basis for a child Authority Grant.

### 6.6 Execute does not imply policy control

`poai.successor.materialization.execute`

MUST NOT imply:

`poai.materialization.policy.control`

### 6.7 Policy control does not imply truth control

The ability to define a policy MUST NOT be treated as authority to certify factual truth, causality, responsibility or moral correctness.

### 6.8 Authority graphs are acyclic

An authority path MUST NOT validate if entitlement ultimately depends on itself.

Cycles MUST fail verification rather than being collapsed into mutual confirmation.

### 6.9 Historical evaluation uses historical roots

A later root replacement MUST NOT retroactively alter which root, policy or authority path applied to an earlier Materialization Event.

### 6.10 Root evidence remains distinct from root acceptance

A verifier SHOULD expose at least:

```text
ROOT DECLARED
ROOT EVIDENCE OBSERVED
ROOT ACCEPTED BY POLICY
ISSUER ENTITLEMENT CHAIN VALID
MATERIALIZATION AUTHORITY ESTABLISHED
```

as separate states.

## 7. Authority Root modes

The following root modes are provisional and non-exclusive.

### 7.1 `self_governed_resource`

A resource is governed by a control mechanism associated with that resource itself.

Examples:

- a personal repository;
- a private registry namespace;
- a local project deployment;
- a single-owner publication channel.

This mode is intentionally narrow.

A self-governed resource root MUST NOT claim authority outside its declared resource boundary.

### 7.2 `institutional_charter`

The root derives its governance basis from a named and versioned institutional instrument.

The protocol records and verifies evidence relative to policy requirements; it does not independently adjudicate the institution's legal existence or validity.

### 7.3 `contractual_root`

The root derives from a named agreement, compact or contract accepted by the relevant policy.

PoAI MUST distinguish evidence of the agreement from a legal conclusion that the agreement is enforceable.

### 7.4 `registry_root`

The root derives from an external registry or directory recognized by policy.

Registry inclusion is evidence only within the semantics defined by the policy.

### 7.5 `statutory_root`

The root cites an external legal or statutory instrument recognized by policy.

A PoAI verifier MAY verify identifiers, signatures, publications and dates, but MUST NOT present that as an independent legal opinion.

### 7.6 `quorum_root`

The root requires multiple independent controllers or root contributors.

A quorum root MUST define:

- participant set or participant-resolution rule;
- threshold;
- whether weights exist;
- whether participants can delegate;
- how participant rotation occurs;
- how conflicting signatures are handled.

PoAI SHOULD avoid scalar social-trust scoring in quorum rules.

## 8. Root Manifest requirements

A Root Manifest SHOULD contain or bind at least:

```text
root_id
root_version
root_mode
governance_scope
target
accepted_actions
controller_rule
root_evidence_rule
effective_from
effective_until
delegation_policy
policy_control_rule
supersedes_root
previous_root_ref
claims
```

### 8.1 Stable identity

`root_id` MUST be stable within one root lineage.

`root_version` MUST change when normative root content changes.

### 8.2 Exact binding

A policy that accepts a root SHOULD bind the exact Root Manifest by digest or equivalent immutable reference.

For the current PoAI Level 4 line, the preferred minimum is:

`RFC 8785 JCS -> UTF-8 -> SHA-256`

### 8.3 Claims boundary

A Root Manifest MUST NOT claim, merely from its own existence:

- `legal_identity_verified`;
- `universal_authority_established`;
- `truth_certified`;
- `causal_proof_certified`;
- `legal_responsibility_determined`;
- `moral_correctness_established`;
- `poai_v_conformance_established`.

## 9. Root Acceptance Rule requirements

A Root Acceptance Rule MUST identify what evidence makes a root acceptable for a particular policy.

It SHOULD include or resolve:

```text
accepted_root_id or accepted_root_mode
accepted_root_digest
required_target
required_governance_scope
required_actions
required_evidence_types
freshness_rule
controller_rule
quorum_rule
supersession_rule
conflict_rule
```

A verifier MUST NOT infer root acceptance merely because a root is present in the same repository or signed by the same key as the policy.

## 10. Self-governed repository root

The first PoAI live experiment uses a self-governed GitHub repository root.

Target:

`github:Matawaka/uu-aap`

The intended conclusion is narrow:

```text
observable repository control
  + exact root publication
  + exact policy accepting self_governed_resource
  + scope/target match
  -> repository-scoped root accepted by this policy
```

The intended conclusion is **not**:

```text
repository control
  -> legal identity
  -> universal ownership
  -> authority over third parties
  -> universal PoAI authority
```

### 10.1 Bootstrap rule

The first root version necessarily contains a bootstrap choice.

For a self-governed repository root, a policy MAY define a bootstrap rule such as:

- the exact Root Manifest is publicly retrievable from the governed repository;
- the publication path is stable and declared;
- the root's target equals that repository;
- repository-control evidence is observed at verification time or satisfies an explicitly time-bounded cached-evidence rule;
- the root cannot issue authority outside that repository scope.

This is an explicit trust-anchor rule, not a proof of ultimate legitimacy.

### 10.2 Repository owner versus repository controller

Public repository publication generally demonstrates a form of repository control, but not necessarily legal ownership or exclusive control by one human.

PoAI SHOULD therefore prefer the term:

`repository_control_evidence`

rather than:

`repository_owner_proof`.

### 10.3 Scope containment

A self-governed repository root for:

`github:Matawaka/uu-aap`

MUST NOT grant authority targeting:

- another repository;
- another account;
- an unrelated organization;
- a legal person as a whole;
- a public authority;
- universal PoAI governance.

## 11. Issuer Entitlement verification

Issuer Entitlement exists only relative to an accepted root and policy.

A verifier SHOULD evaluate the following dimensions separately:

```text
issuer identity/key binding
parent authority resolution
root resolution
root acceptance
requested action containment
target containment
validity containment
delegation permission
quorum satisfaction
revocation/supersession state
policy applicability
```

Only after all required dimensions succeed may the verifier emit:

`issuer_entitlement_chain_valid = true`

This value MUST remain scoped to the exact verification context.

## 12. Authority Grant requirements

An Authority Grant SHOULD contain or bind at least:

```text
grant_id
grant_version
issuer_ref
issuer_key_ref
subject_ref
subject_key_ref
parent_authority_ref
root_ref
actions
target
valid_from
valid_until
delegation_mode
delegation_depth_remaining
policy_ref or policy_scope
revocation_refs
supersedes_grant
signature_or_binding
claims
```

### 12.1 Action containment

A child grant MUST NOT contain an action absent from the verified parent authority.

### 12.2 Target containment

A child target MUST be equal to or contained by the parent target.

### 12.3 Time containment

A child validity interval MUST fit inside the parent validity interval.

### 12.4 Delegation containment

A child grant MUST NOT increase remaining delegation depth.

### 12.5 Controller privilege containment

A grant for materialization execution MUST NOT gain policy-control or root-control privileges unless those actions are separately present in the parent authority.

## 13. Authority Provenance Graph requirements

A verifier MUST build or logically evaluate an Authority Provenance Graph before asserting verified authority.

The graph MUST satisfy:

1. every required leaf authority resolves;
2. every upstream issuer has an entitlement path;
3. every path terminates in an accepted Authority Root;
4. no path contains a cycle;
5. all target/action/time/delegation constraints are monotonic or narrowing;
6. all required quorum conditions are satisfied;
7. no required root or grant is revoked or superseded for the evaluated time;
8. the exact policy used for acceptance is identified.

A graph MAY have multiple roots if the policy explicitly requires or permits them.

## 14. Multiple roots and quorum

A policy MAY accept:

- one root;
- any one of several roots;
- all of several roots;
- a threshold quorum of roots;
- a threshold quorum of controllers beneath one root.

The combination rule MUST be explicit.

Recommended provisional operators:

- `all_of`;
- `any_of`;
- `threshold`.

A verifier MUST NOT silently convert `all_of` to `any_of` or reduce a threshold.

## 15. Policy Controller semantics

A Materialization Policy SHOULD identify its controller rule separately from its executor rule.

Example:

```text
policy_control_action = poai.materialization.policy.control
materialization_action = poai.successor.materialization.execute
```

A Policy Controller MAY:

- publish a new policy version;
- supersede a policy;
- suspend a policy;
- alter accepted root references according to root/controller rules.

A Policy Controller MUST NOT retroactively rewrite which policy governed an earlier Materialization Event.

## 16. Root rotation, revocation and supersession

### 16.1 Rotation

A root controller key MAY rotate if the current root permits rotation.

Rotation MUST produce append-only evidence.

### 16.2 Supersession

A later root version MAY supersede an earlier root for prospective evaluation.

The new root SHOULD reference the previous root and the authorizing transition evidence.

### 16.3 Historical preservation

Historical authority verification MUST use the root and policy state applicable at the historical event time.

A later root MUST NOT invalidate a historically valid signature merely because the active key changed.

A later root MAY change whether a new action is authorized prospectively.

### 16.4 Unauthorized replacement

A newly published Root Manifest MUST NOT become accepted merely because it has the same `root_id`.

For non-bootstrap versions, replacement MUST satisfy the previous root's controller/supersession rule or another policy-explicit recovery rule.

## 17. Conflicting roots

Two roots may make incompatible governance claims over overlapping scope.

PoAI MUST NOT resolve such a conflict through a hidden trust score.

A policy MUST define one of the following or an equivalent rule:

- reject until resolved;
- require a specified quorum;
- accept one named root lineage;
- partition scopes;
- retain unresolved status;
- require external adjudication.

Conflicting root claims SHOULD remain observable.

## 18. Integration with Materialization Policy

A Materialization Policy that requires verified authority SHOULD identify or bind:

```text
required_authority_scope
accepted_root_rule
authority_graph_rule
issuer_entitlement_rule
policy_controller_rule
```

For a materialization event to establish policy-relative canonicality, the verifier SHOULD have independently established:

```text
candidate binding valid
policy binding valid
root evidence observed
root accepted by exact policy
issuer entitlement chain valid
materialization execute authority valid
stay/conflict rules satisfied
```

Only then may:

`materialization_authority_established = true`

be used as a materialization prerequisite.

Even then:

```text
materialization_authority_established
  != universal authority
  != legal authority generally
  != factual truth
  != causal proof
  != responsibility determination
  != PoAI/V
```

## 19. Verification result model

A verifier SHOULD avoid one generic `verified` boolean.

Recommended dimensions include:

```text
root_declared
root_binding_valid
root_signature_valid
root_evidence_observed
root_accepted_by_policy
authority_graph_acyclic
issuer_entitlement_chain_valid
authority_action_match
authority_target_match
authority_time_match
delegation_constraints_satisfied
policy_control_established
materialization_authority_established
```

Stronger unrelated claims SHOULD remain independently represented.

## 20. Threat model

### 20.1 Root laundering

Publishing any signed root and treating it as accepted authority.

### 20.2 Account-control laundering

Treating repository/account control as proof of legal identity or authority over external subjects.

### 20.3 Scope escape

Using a root for a target outside its Governance Scope.

### 20.4 Action inflation

Turning a narrow action such as `propose` or `execute` into policy-control authority.

### 20.5 Delegation inflation

Granting more delegation depth than the parent possesses.

### 20.6 Time inflation

Creating a child grant valid beyond the parent's interval.

### 20.7 Circular authority

A authorizes B, B authorizes A, and the cycle is presented as independent entitlement.

### 20.8 Root replacement attack

Publishing a new manifest with the same root identifier without satisfying the prior root's transition rule.

### 20.9 Policy-root collusion hidden as proof

A policy accepts a root solely because the same unauthenticated actor created both, while the verifier presents the result as independent authority verification.

PoAI MAY permit self-governed roots, but the self-governed bootstrap MUST be explicit rather than described as independent validation.

### 20.10 Quorum collapse

Treating multiple identifiers controlled by one underlying controller as independent quorum participants when the policy requires independence.

### 20.11 Truth laundering

Using successful authority verification to imply substantive truth of a successor.

## 21. Privacy and selective disclosure

Authority provenance can expose sensitive organizational structure.

Implementations SHOULD support selective disclosure where practical.

A verifier may need to know that:

- a root was accepted;
- a valid entitlement path existed;
- the required action/target/time constraints were satisfied;

without receiving every internal organizational record.

Possible future mechanisms include:

- hash-bound private evidence;
- escrowed evidence;
- reviewer attestations;
- selective-disclosure credentials;
- zero-knowledge proofs for narrow predicates.

Privacy mechanisms MUST NOT convert hidden evidence into unchallengeable authority.

## 22. Minimum machine-layer invariants

A future machine layer implementing this document SHOULD enforce at least:

1. Authority Root has stable id/version/mode/scope/target.
2. Root target is contained by its governance scope model.
3. Self-governed resource roots cannot issue authority outside the governed resource.
4. Accepted root is explicitly referenced by the exact policy or matches an explicit root-mode acceptance rule.
5. Root evidence required by policy is present and independently evaluated.
6. Authority provenance graph is acyclic.
7. Every issuer path terminates at an accepted root.
8. Child actions are contained by parent actions.
9. Child targets are contained by parent targets.
10. Child validity is contained by parent validity.
11. Delegation depth never increases.
12. `non_delegable` authority cannot issue a child grant.
13. Materialization execute authority does not imply policy-control authority.
14. Root replacement requires previous-root authorization or an explicit policy recovery rule.
15. Historical evaluation binds the historical root/policy version.
16. Root/authority verification does not set truth, causality, legal identity, universal authority, responsibility or PoAI/V claims.

## 23. First repository-scoped pilot

The first implementation SHOULD use a synthetic or public repository-scoped root for:

`github:Matawaka/uu-aap`

The experiment SHOULD demonstrate:

```text
PoAIAuthorityRoot
  root_mode = self_governed_resource
  target = github:Matawaka/uu-aap
  accepted_actions includes poai.materialization.policy.control

        |
        v

policy accepts exact root for repository scope

        |
        v

Authority Grant
  action = poai.successor.materialization.execute
  target = github:Matawaka/uu-aap

        |
        v

issuer_entitlement_chain_valid = true
materialization_authority_established = true
```

while preserving:

```text
legal_identity_verified = false
universal_authority_established = false
universal_canonicality_established = false
truth_certified = false
causal_proof_certified = false
legal_responsibility_determined = false
moral_correctness_established = false
poai_v_conformance_established = false
```

The experiment is successful only if both the positive path and the negative scope/delegation/root-replacement tests are executable.

## 24. Relationship to existing PoAI layers

The authority progression is now:

```text
Level 4.0b  valid signature
Level 4.0c  persistent key continuity
Level 4.0d  external identifier / account-control evidence
Level 4.0e  scoped authority evidence claim
Authority Root layer
            root acceptance + issuer entitlement provenance
Materialization layer
            policy-relative successor recognition
```

No earlier layer automatically establishes a later one.

## 25. Non-goals for v0.1

This document does not require:

- DID infrastructure;
- PKI hierarchy;
- blockchain;
- government identity;
- KYC;
- universal organization registries;
- one global authority root;
- one global canonical history;
- trust or reputation scoring;
- automatic browser materialization;
- legal-effect claims;
- PoAI/V conformance.

## 26. Open questions

1. Should Policy Controller rules live in the Root Manifest or a separate artifact after the first experiment?
2. Should self-governed repository root acceptance require live repository-control evidence on every verification or permit time-bounded cached evidence?
3. Should root recovery be distinct from ordinary root supersession?
4. How should controller independence be evidenced for quorum roots?
5. When multiple policies accept different roots for overlapping scopes, should PoAI expose a higher-level conflict artifact or leave the disagreement at policy scope?
6. Should authority target containment use exact URNs only in v0.1 or define hierarchical namespace semantics?
7. What is the minimum evidence class required before a non-synthetic verifier may emit `root_evidence_observed = true`?

## 27. Conformance boundary

This document defines an experimental semantic boundary only.

An implementation conforming to this draft may verify policy-relative authority provenance while still being **non-conforming to PoAI/V**.

The strongest safe statement from this layer is:

> Under the identified policy, root, scope, evidence and time context, this authority path satisfied the declared issuer-entitlement rules.

It is not:

> This actor is universally or legally authorized, and the resulting successor is true.
