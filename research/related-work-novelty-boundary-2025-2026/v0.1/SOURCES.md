# Sources — Related Work & Novelty Boundary 2025–2026

This bibliography is a human-readable companion to `source-ledger.json`. The JSON ledger is the machine-readable source of classification for this audit.

## Source-status rule

Sources are not treated as equal merely because they are public.

Current classes, roughly from standards maturity to exploratory evidence rather than by intellectual value:

- `IETF_CONSENSUS_RFC` — IETF-stream RFC / consensus standards artifact;
- `STANDARDS_BODY_RATIFIED` — ratified specification from another standards body;
- `STANDARDS_BODY_DRAFT` — active working draft, subject to change;
- `PEER_REVIEWED_ARTICLE` — scholarly peer-reviewed publication;
- `INDIVIDUAL_INTERNET_DRAFT` — public IETF submission, not IETF consensus;
- `PREPRINT` — public scholarly/conceptual work not treated here as peer-reviewed;
- `PUBLIC_GITHUB_PROPOSAL` — public technical proposal/discussion, not normative adoption;
- `INDUSTRY_ANNOUNCEMENT` — product/industry evidence, not protocol consensus;
- `PROJECT_PUBLICATION` — public framework/white-paper style project publication.

`status maturity != correctness != importance != endorsement`.

## A. Human–AI authorship and accountability

### `gaidet-2025` — GAIDeT

- Date: 2025-08-08
- Status: peer-reviewed article
- URL: https://www.tandfonline.com/doi/full/10.1080/08989621.2025.2544331
- Relevance: structured delegation/disclosure of GenAI contribution and human oversight.
- Boundary: reporting taxonomy, not execution-time authorization.

### `tas5-2025` — TAS-5

- Date: 2025-12-12
- Status: project/framework publication
- URL: https://www.media.mit.edu/articles/tas-5-a-cross-industry-framework-for-transparent-disclosure-of-ai-involvement-in-content-creation/
- Relevance: cross-industry disclosure levels for AI involvement in content creation.
- Boundary: disclosure framework, not typed authority/action semantics.

### `provenance-not-prohibition-2026`

- Date: 2026-06-29
- Status: peer-reviewed article
- URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC13314381/
- Relevance: provenance-centered governance for AI-assisted scholarly publishing.
- Boundary: publication-policy framework, not action permit/execution protocol.

### `petmalu-ai-2026`

- Date: 2026-07-15
- Status: peer-reviewed article
- URL: https://doi.org/10.3390/educsci16071127
- Relevance: explicit reporting of human accountability, AI contribution, prompting, provenance, validation and limitations.
- Boundary: reporting checklist, not machine-enforced cross-layer receipts.

### `authorship-after-generative-ai-2026`

- Date: 2026-08-12
- Status: peer-reviewed article
- URL: https://link.springer.com/article/10.1007/s13347-026-01170-w
- Relevance: relational/distributed authorship with continuing human answerability.
- Boundary: philosophical/accountability analysis, not conformance protocol.

### `ethical-llm-assisted-research-2026`

- Date: 2026-08-24
- Status: preprint
- Temporal class: parallel window
- URL: https://arxiv.org/abs/2608.23644
- Relevance: separates contribution origin, verification, responsibility, human ownership and epistemic outcome.
- Boundary: same narrow public window as the stable-core/gateway anchors; chronology does not support influence claims.

## B. C2PA / CAWG provenance, identity, consent and permission

### `cawg-endorsement-1.0-draft`

- Date: 2025-04-14
- Status: standards-body draft
- URL: https://cawg.io/endorsement/1.0-draft/
- Relevance: signed endorsement for bounded downstream workflow actions.
- Boundary: asset-workflow endorsement, not general AI-agent execution authority.

### `c2pa-digital-likeness-100`

- Date: 2026-03-11
- Status: external public GitHub proposal
- URL: https://github.com/c2pa-org/specifications/issues/100
- Relevance: explicitly distinguishes C2PA provenance, CAWG identity, rights terms and live permission state; states `Provenance is not permission.`
- Boundary: external proposal does not equal C2PA normative adoption.

### `cawg-consent-2026`

- Date: 2026-07-12
- Status: standards-body working draft
- URL: https://cawg.io/consent/1.0-draft/
- Relevance: signed machine-readable reference to authoritative consent/permission source.
- Boundary: working draft and asset-consent scope.

### `cawg-identity-1.3-2026`

- Date: 2026-08-17
- Status: DIF-ratified CAWG specification
- Temporal class: parallel window
- URL: https://cawg.io/identity/1.3/
- Relevance: proves control over digital identity and represents actor roles in C2PA asset lifecycle.
- Boundary: identity/role is not itself decision authority or action permission.

## C. Decision evidence, traces and outcomes

### `baxdt-2025`

- Date: 2025-11-04
- Status: peer-reviewed article
- URL: https://www.sciencedirect.com/science/article/pii/S0950705125014418
- Relevance: immutable per-decision trace with model/explanation/context evidence.
- Boundary: decision/XAI trace, not a general authority lifecycle.

### `omp-2026`

- Date: 2026-03-21
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-veridom-omp-00
- Relevance: deterministic decision-time routing and tamper-evident decision accountability trace.
- Boundary: individual draft; routing/accountability focus.

### `decision-event-schema-2026`

- Date: 2026-04-10
- Status: preprint
- URL: https://arxiv.org/abs/2604.09296
- Relevance: machine-readable governance event combining inference, policy evaluation and decision evidence.
- Boundary: reconstruction schema rather than complete authorization/action lifecycle.

### `sato-gar-2026`

- Date: 2026-05-17
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/draft-sato-soos-gar/00/
- Relevance: signed governance audit records for agent sessions.
- Boundary: SOOS-specific; not IETF consensus.

### `auditable-llm-autonomy-2026`

- Date: 2026-06-15
- Status: peer-reviewed article
- URL: https://www.techscience.com/cmc/v88n2/67675
- Relevance: evidence, decision-trace and outcome planes; provenance/freshness constraints; action gating; association does not prove causality.
- Boundary: assurance architecture rather than typed UU-AAP authority/responsibility protocol.

### `certified-amnesia-2026`

- Date: 2026-07-29
- Status: preprint/public research copy
- URL: https://www.researchgate.net/publication/410951333_Certified_Amnesia_A_Decision-Evidence_Protocol_for_Provable_Context_Exclusion_in_AI_Agents
- Relevance: pre-action context-exclusion certificate bound to action/policy plus separate execution receipt.
- Boundary: context-exclusion assurance rather than complete available-intelligence inventory.

## D. Agent intent, authorization, delegation and effect boundaries

### `agentic-jwt-2025`

- Date: 2025-12-31
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-goswami-agentic-jwt-00
- Relevance: identifies user-intent versus autonomous-execution drift in OAuth-style agentic systems.
- Boundary: JWT/OAuth extension; not IETF consensus.

### `ferz-authorization-boundary-2026`

- Public posting: 2026-02-20; paper date: 2026-02-11
- Status: SSRN/Zenodo conceptual paper
- URL: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6219602
- Relevance: distinguishes access authorization from action authorization and defines a deterministic/reconstructable authorization boundary for specific policy-governed output.
- Boundary: conceptual work; author discloses commercial interest in deterministic authorization infrastructure.

### `mastercard-verifiable-intent-2026`

- Date: 2026-03-05
- Status: industry announcement
- URL: https://www.mastercard.com/global/en/news-and-trends/stories/2026/verifiable-intent.html
- Relevance: tamper-resistant evidence of what a person authorized an AI agent to do.
- Boundary: commercial/commerce-specific announcement, not general consensus protocol.

### `intent-token-2026`

- Date: 2026-03-19
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-williams-intent-token-00
- Relevance: signed, time-bounded action authorization for autonomous agents; anti-replay/delegation/audit.
- Boundary: not IETF consensus.

### `agentroa-2026`

- Date: 2026-04-08
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-nivalto-agentroa-route-authorization-00
- Relevance: signed agent action policy envelope, monotonic delegation narrowing and execution receipts at tool-call boundary.
- Boundary: not IETF consensus.

### `delegation-receipt-protocol-2026`

- Date: 2026-04-26
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-nelson-agent-delegation-receipts-04
- Relevance: user-signed authorization object before runtime control, scope/validity/instruction binding, append-only record.
- Boundary: delegation-specific and not IETF consensus.

### `sato-idp-2026`

- Date: 2026-05-10
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-sato-soos-idp-00
- Relevance: structured intent declaration at action-step granularity.
- Boundary: agent-declared intent primitive, not user-intent provenance or general PoAI availability.

### `sato-mjwt-2026`

- Date: 2026-05-24
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/draft-sato-soos-mjwt/00/
- Relevance: binds human principal, resource, mission and action scope with delegation traceability.
- Boundary: credential profile; not complete lifecycle.

### `permit-receipts-2026`

- Date: 2026-06-04
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-lee-orprg-permit-receipts-00
- Relevance: canonical effect request + policy epoch + validity + anti-replay before protected external effect is committed.
- Boundary: individual draft; related IETF IPR disclosure exists and must be considered separately from this research comparison.

### `mission-bound-authorization-2026`

- Date: 2026-07-06
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-mcguinness-oauth-mission-00
- Relevance: human-approved mission artifact and explicit approval-to-execution gap.
- Boundary: authorization issuance; separate runtime enforcement still required.

### `ncs-2026`

- Date: 2026-07-17
- Status: preprint
- URL: https://arxiv.org/abs/2607.15596
- Relevance: neural planner has no execution authority; deterministic controller releases exactly authorized instruction; mismatch fails closed.
- Boundary: cryptographic workflow control, not full authorship/PoAI stack.

### `cva-2026`

- Date: 2026-07-23
- Status: preprint
- URL: https://arxiv.org/abs/2607.21325
- Relevance: separates identity binding, authorization-request binding and runtime execution binding.
- Boundary: preliminary cryptographic authorization model.

## E. Human escalation and enforcement-loop governance

### `cheq-2025`

- Date: 2025-10-19
- Status: expired individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-rosenberg-aiproto-cheq-00
- Relevance: human confirmation protocol for AI-proposed decisions/actions, including signed confirmation objects and MCP/A2A composition.
- Boundary: expired individual draft; not IETF consensus.

### `sato-hem-2026`

- Date: 2026-05-10
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/draft-sato-soos-hem/00/
- Relevance: explicit human-escalation state that prevents agent progression while human decision is pending.
- Boundary: SOOS-specific and not IETF consensus.

### `sato-aep-2026`

- Date: 2026-05-24
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/draft-sato-soos-aep/00/
- Relevance: normative interface between reasoning loop and enforcement kernel, with state/permission context and tamper-evident transition records.
- Boundary: runtime/kernel architecture rather than broad authorship/decision protocol.

## F. Heterogeneous evidence composition and semantic claim separation

### `principal-verifier-binding-2026`

- Date: 2026-07-04
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-bu-agentproto-security-principal-binding-00
- Relevance: identity, user authority, delegation, session continuity and action evidence are different claims with different verifiers/bindings/freshness rules; collapsing them can overstate authority/accountability.
- Boundary: verifier-facing security comparison, not full state-to-successor semantics.

### `ep-aec-2026`

- Initial public family date used by this audit: 2026-07-06
- Status: individual Internet-Draft
- URL: https://datatracker.ietf.org/doc/html/draft-schrock-ep-authorization-evidence-chain-04
- Relevance: composes heterogeneous identity/delegation/policy/permit/approval/transparency/capability/execution evidence; SATISFIED is not universal authorization or execution/outcome proof.
- Boundary: closest evidence-composition pressure, but scoped around authorization evidence for a material action.

### `stored-is-not-supported-2026`

- Date: 2026-09-02
- Status: preprint
- Temporal class: post-publication convergence
- URL: https://arxiv.org/abs/2609.02127
- Relevance: persistence changes availability, not epistemic standing; typed provenance/semantic guardrails.
- Boundary: cannot be used as evidence that a pre-August Matawaka claim was already non-novel; chronology supports convergence only.

## G. Transparency / non-equivocation

### `scitt-rfc9943-2026`

- Date: June 2026
- Status: IETF consensus RFC / Proposed Standard
- URL: https://www.rfc-editor.org/info/rfc9943/
- Relevance: signed statements, transparency services, receipts and auditable digital supply-chain history.
- Boundary: statement transparency, not complete agent decision/authority semantics.

### `c2pa-non-equivocation-122`

- Date: 2026-07-08
- Status: external public GitHub proposal/discussion
- URL: https://github.com/c2pa-org/specifications/issues/122
- Relevance: separates C2PA signature/TSA evidence from append-only consistency, checkpoint non-equivocation and existence-time evidence.
- Boundary: external issue/discussion, not C2PA specification adoption.

## H. Post-publication industry convergence

### `agentminder-2026`

- Date: 2026-08-31
- Status: industry announcement
- URL: https://investors.broadcom.com/news-releases/news-release-details/broadcom-unveils-agentminder-enterprise-solution-ai-agent
- Relevance: verifies agent identity and actions against declared mission, intent, context and risk before enterprise effects.
- Boundary: postdates public Matawaka anchors and is used only as convergence evidence; no influence is inferred.

## Sources not yet admitted as claim-bearing ledger entries

The next successor audit should explicitly inspect, at minimum:

- Agent Action Capsule / SCITT capsule-provenance-binding family;
- full Sato/SOOS draft family beyond the entries already included;
- C2PA 2.4 `c2pa.repository-receipt` history and exact publication frontier;
- FERZ Execution-Time Authorization and related Authorization Boundary Integrity Model papers as separate entries;
- formal provenance calculi, negative claims, refinement/type systems and proof-carrying authorization outside AI;
- decision-science and information-set literature on available-versus-considered information;
- accountable-computing and safety-case literature with explicit negative guarantees/non-effects.

Until those searches are complete, surviving novelty claims remain candidates only.
