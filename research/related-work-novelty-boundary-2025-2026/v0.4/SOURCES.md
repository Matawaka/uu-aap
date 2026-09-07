# v0.4 source notes

This file summarizes the dated public sources admitted by `taxonomy-ledger.json`. Dates are used only for this bounded research comparison; they are not patent-priority determinations.

## Predecessors before the 2026-08-22 public anchor

### Cheney — Causality and the Semantics of Provenance — 2010-04-19

Public arXiv predecessor, later peer-reviewed. It distinguishes provenance/dependence/influence from causal semantics. It defeats any claim that provenance-versus-causality separation originated with Matawaka, but it is not an AI-agent governance benchmark.

Source: https://arxiv.org/abs/1004.3241

### StateBench — repository created 2025-12-21

Executable conformance suite for stateful AI systems. Its public taxonomy includes Resurrection, Hallucination, Scope Leak, Stale Reasoning, Authority Violation and Temporal Decay Failure. This is a particularly strong predecessor to any broad claim that Matawaka first proposed a multi-class state/authority failure taxonomy.

Source: https://github.com/Parslee-ai/statebench

### Causality Laundering — 2026-04-05

Names denial-feedback causal leakage in tool-calling agents and evaluates a runtime monitor on controlled attack scenarios. It demonstrates that flat provenance may be valid while causal influence still escapes through a later apparently benign action.

Source: https://arxiv.org/abs/2604.04035

### Observation Missingness — 2026-05-12

Formally distinguishes recorded observations from observations potentially available to the original decision-maker. It pressures the PoAI availability layer but does not itself benchmark `available -> considered/intended` promotion.

Source: https://arxiv.org/abs/2605.12831

### Anchored Parallax Log / APL — no later than 2026-05-14

APL names Decontextualization, Frame Laundering and Semantic Overclaim. Its motivation page was publicly updated 2026-05-14 and the current protocol describes an April 2026 protocol date. APL uses content-addressed frames, exclusions, transformations and explicit bridges so authentic observations cannot silently license broader interpretations.

Source: https://apl-protocol.org/motivation

### AIRGuard — Authority Confusion — 2026-05-27

Names `authority confusion`: untrusted material can inform reasoning but must not authorize side effects. AIRGuard evaluates runtime authority control on AgentTrap and DTAP-150 and includes ablation evidence. This is a direct named-and-tested predecessor for `context -> authority` failure semantics.

Source: https://arxiv.org/abs/2605.28914

### CAP+PCL — provenance-bound context attestation — 2026-06-04

Zenodo public record created 2026-06-04. The work isolates forged-but-policy-satisfying context as a policy-blind authorization failure and evaluates 170 scenarios plus a 12-scenario robustness probe. Later SSRN posting dates are not used as the earliest public bound.

Source: https://zenodo.org/records/20539794

### Agent Action Capsule — 2026-06-13

Individual Internet-Draft. Separates authorization evidence from records of what an agent actually did and uses typed action/outcome material rather than silently equating permit and execution.

Source: https://datatracker.ietf.org/doc/draft-mih-scitt-agent-action-capsule/00/

### EP Authorization Evidence Chains — 2026-06-22

Individual Internet-Draft. Identity, delegation, permit, human authorization and transparency are distinct receipt/evidence classes with verifier-specific semantics. This materially pressures `identity -> authority` and `review -> universal execution permission` claims.

Source: https://www.ietf.org/archive/id/draft-schrock-ep-authorization-evidence-chain-00.html

### SCITT AI-Agent Action Receipts — 2026-06-23

Individual Internet-Draft. Provides narrow per-action receipts and explicit boundaries around what their authenticity does not prove about safety, true inputs or real-world effects.

Source: https://datatracker.ietf.org/doc/draft-noa-scitt-ai-agent-receipt/

### WEXP Core — 2026-07-05

The strongest single predecessor to a generic semantic-non-inflation benchmark claim. WEXP defines distinct content bases `observation`, `intent`, `invocation`, `execution`; their structural order is explicitly **not an entailment relation**. The verifier checks each base independently and normatively forbids several promotions: intent does not imply authority/invocation/execution; invocation does not imply execution/effect; execution does not imply durable effect/correctness; provenance does not establish runtime occurrence; a signature does not establish truth. WEXP includes deterministic appraisal rules and conformance vectors.

Source: https://datatracker.ietf.org/doc/html/draft-sergeev-wexp-core-00

### QIK-VRT Effect Acknowledgement — observed 2026-07-22

Individual Internet-Draft. Explicitly separates technical receipt from authorization for a downstream effect and keeps freshness/evidence/origin checks independent.

Source: https://datatracker.ietf.org/doc/html/draft-lohmann-qikvrt-effect-ack-01

## Parallel-window evidence

### ActionProxy — Approval vs Authorization — 2026-08-22

The page's reviewed date is the same calendar day as the public UU-AAP repository anchor. It is therefore not used as predecessor evidence. It independently states that human approval is evidence rather than the full authorization decision and must be revalidated against current identity, policy, payload, reviewer and expiry before dispatch.

Source: https://actionproxy.com/guides/ai-agent-approval-vs-authorization/

## Post-publication convergence

### EAL-Bench — Endogenous Authorization Laundering — 2026-09-01

Post-UU-AAP preprint and open benchmark. It formalizes false authority written into persistent memory and its propagation to unauthorized tool calls through a hidden deterministic authorization ledger. Because the arXiv submission is 2026-09-01, it is convergence evidence only in this audit.

Source: https://arxiv.org/abs/2609.01836

## Bounded synthesis

No single source above is treated as equivalent to the entire Matawaka stack. The combined corpus nevertheless defeats the broad claim that a general idea of semantic non-escalation, a multi-class AI-agent failure taxonomy, or a multi-base claim verifier is unique to Matawaka.

The residual question is narrower and empirical: whether a **single cross-domain mutation corpus** spanning epistemic, provenance, authority/review, execution/effect and causality promotions supplies useful coverage not already available from systems such as StateBench + WEXP + the specialized named-failure benchmarks.
