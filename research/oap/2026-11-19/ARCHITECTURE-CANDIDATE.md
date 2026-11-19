# Candidate independent OAP architecture — for human review, not a protocol release

Date 2026-11-19. State `PROPOSED`, version `phase0`; **all capitalized types are candidate names, not wire-level MUSTs**.

## Hypothesis and non-goals

Hypothesis: independent parties can verify a portable record that links **a pre-existing authority entitlement, a scoped decision at a particular frontier, an action-specific gate/permit, an invocation, and an observation**, without assuming that a hash, signature, identity assertion or signed self-report proves the world state.

OAP does **not** mint global authority, replace OAuth/GNAP/IdP/PDP, activate a system, execute a tool, certify personhood, assign legal liability, or require surveillance. Use existing authentication, resource policy and trust roots.

## Candidate actor roles

- `Principal`: human, organization or non-human actor represented by authenticated statements; presence does not prove legal identity.
- `AuthoritySource`: rights-granting or entitlement-asserting system with a defined trust domain; must have independent evidence of authority for the claimed scope.
- `Requester` / `Agent`: proposes an action, cannot self-authorize by claiming consent.
- `PDP`: evaluates requested action under policy (possibly via OpenID AuthZEN); decision != execution permit.
- `PEP / ActionGate`: actual pre-effect enforcement point; rejects missing or stale proof, consumption errors and overbroad requests.
- `Actuator`: carries out one bounded effect; may differ from gate and evidence observer.
- `Observer`: attests bounded observable facts after invocation; independence is a separately evidenced attribute.
- `Verifier`: checks consistency/trust, records unsupported conclusions, does not infer event truth.
- `RevocationSource`: authentic current status under applicable trust and freshness requirements.

## Candidate types and their non-effects

| Candidate artifact | Carries | Never sufficient by itself |
| --- | --- | --- |
| `AuthorityReference` | issuer, principal/agent, delegation lineage, rights/entitlement reference, scope, status locator | legal identity, enforceable authority without issuer trust |
| `ActionRequest` | request ID, agent, target/resource, operation, parameters commitment, requested effects, purpose, exact frontier | authorization |
| `DecisionEvidence` | policy/version, trusted evaluator identity, decision, evaluation time and dependencies | action permit or performed action |
| `ActionPermitBinding` | decision & entitlement hashes, exact action digest, audience, bound key, validity, nonce, enforcement domain | transferable global access, completed action |
| `InvocationEvidence` | consumed permit reference, adapter, invocation ID, attempt status, transaction/idempotency record | successful outcome / real-world causal proof |
| `OutcomeObservation` | bounded source, observation time/frontier, observed effect, limits/conflicts | proof of truth of everything / unique cause |
| `RevocationStatus` | signed/secured current status, source epoch and freshness class | retroactive erasure of valid historical observations |
| `VerificationResult` | verifier checks, status, explicit non-effects, evidence horizon | legal or moral judgment |

## Proposed sequence

```text
Authorized principal / AuthoritySource
   -> external authN + entitlement + delegation evidence
Requester -> ActionRequest (specific parameters + scope + frontier)
PDP/AuthZEN -> DecisionEvidence (not a grant)
ActionGate -> FRESH verify: trust, scope, target, policy, expiry,
              delegation, revocation, binding, one-shot state
           -> ActionPermitBinding (only exact action, consumed atomically)
Actuator -> InvocationEvidence (emission/attempt, not outcome)
Observer -> OutcomeObservation (bounded observed claim)
Verifier -> VerificationResult + non_effects + disagreement/insufficient-evidence
```

The first standalone profile could be `OAP-AEB/0.1` (Action-Evidence Binding) but this ID is **NOT APPROVED**. Vendor-specific gateway adapters are informative, not requirements.

## Provisional invariants

- `Evidence != Entitlement != Decision != Permit != Invocation != Outcome != Truth != Liability`.
- Deny rather than extrapolate when issuer authority, proof of possession, scope, target, policy version, trust domain, current revocation or gate clock is unknown.
- A child delegation may not exceed parent scope/time/audience; each hop has a verified signer and entitlement path.
- The permit binds target, exact operation, parameters (canonical digest), principal/agent, audience, frontier, policy/version, expiry and anti-replay mechanism.
- Intent/prompt/agent model output cannot be promoted into grants without independent external authority.
- A cached evaluation is not current approval. The gate must revalidate **at the execution boundary**, not infer freshness from client timestamps.
- At-most-once is **not guaranteed by a nonce or receipt**. It requires durable, atomic consumption/idempotency at the action boundary and explicit crash semantics.
- If revocation propagation is delayed, the protocol can only report assurance within a declared freshness bound; no universal instant revocation claim.
- Outcome observation may conflict with invocation or be absent; return `DISPUTED` / `INSUFFICIENT_EVIDENCE`, not forced truth.
- Retain historical evidence after revocation without silently reauthorizing future actions.
- Sensitive history, raw prompts, biometric details, private credentials and access tokens MUST NOT be required in baseline exported receipts.

## Profiles, interoperability and versioning (candidates)

- `Transport-independent Core Envelope`: version, type, canonical encoding, issuer verification profile, subject/request/action bindings, predecessor digest, non-effects.
- `Authorization adapters`: OAuth2/OIDC, GNAP and AuthZEN mapped to authority/decision evidence without weakening original standard semantics. Consider RFC 9396, RFC 8693, RFC 9449; do not substitute OAP for those RFCs.
- `Agent adapter`: MCP/A2A action annotations and evidence export; MCP transport authentication is external.
- `Observation adapter`: signed event and/or independent service attestation; label evidence source and confidence precisely.
- `Optional Personal Anchor profile`: future experimental continuity claims only, never required for OAP base.
- `Crypto profile`: undecided JCS/RFC 8785 or other canonical byte encoding, algorithm identifiers, signature/key material, rotation, revocation/trusted time, cross-language vectors.
- `Governance`: open spec with clearly defined editorial control, IPR/licensing compatibility and independent conformance governance; no implicit legal transfer from UU-AAP.

## Decision points deliberately frozen for the human lead

See [DECISIONS.md](DECISIONS.md). In particular: name/acronym, target trust model, mandatory vs optional signed receipts, hard vs soft gate and failure policy for offline operation, hosting and licence/standards governance, and public normative publication are **not** approved here.
