# Independent Open Authorization Protocol — Phase 0 architecture qualification

Date: 2026-11-19. Status: **RESEARCH DRAFT; NON-NORMATIVE; NON-AUTHORIZING**.

## 0. Authority and exact scope

Human architecture-lead decision: pursue a **standalone** open protocol rather than silently renaming UU-AAP. This decision authorizes research/design in a separate draft branch; **it is not an authorization to issue credentials, run an actuator, deploy KONTUR, alter canonical origin, merge this PR, publish normative specifications or make legal claims**.

Inspected repository: [Matawaka/uu-aap](https://github.com/Matawaka/uu-aap) at exact default-branch SHA `8ff0fd01514f7d8bcfc2fb96d794b790b904bafc`. This is an **architecture/evidence inventory**, not a line-by-line formal security audit of every file or validation of every historical CI result. Repository inventory included top-level directories, `protocols/*`, `protocols/integration/*`, `schemas/ecosystem/uu-society/v0.1`, `server/kontur/v0.1`, and workflow names. 387 workflow definitions were present at this frontier; their mere presence is not a green run, nor are they all OAP-dependent. Accessible portfolio listing identified additional product/private repos, **whose contents were not audited for this public report**.

A separate supplied attachment referring to a PR #309 and HAR review does not identify its repository in its own text. It was **not** treated as a current UU-AAP main checkpoint or merge instruction for this phase.

## 1. Audited source map: reuse without hidden inheritance

| Existing source | Observed role | OAP disposition | Evidence ceiling |
| --- | --- | --- | --- |
| [Core README](../../../../protocols/core/v0.1/README.md), `validate-core.js` | typed receipt graph State→Intent→Authority→ActionPermit→ActionReceipt→Outcome | reuse conceptual separation, possibly adapter; **do not copy as OAP normative Core unchanged** | local fixture and structural validation do not establish legal issuer rights |
| [Scoped authority](../../../../protocols/integration/scoped-authority-evidence/v0.1/README.md) | issuer entitlement/scope/time/delegation/revocation evidence, read-only result vocabulary | map as external authority evidence provider | `SUPPORTED` != new grant, ActionPermit or enforceable execution |
| [AI gateway](../../../../protocols/integration/ai-gateway/v0.1/README.md) | `inspect/qualify/authorize/observe`; explicit pre-existing permit | adapter/cross-implementation candidate | gateway admissible != gateway-created authority or actuator execution |
| [Pre-action authorize admission](../../../../protocols/integration/pre-action-authorize-admission/v0.1/README.md) | fresh time/target/permit/bundle re-check | reuse fail-closed timing and binding tests | admission != execute/permission creation |
| [Invocation↔ActionReceipt](../../../../protocols/integration/invocation-action-receipt-binding/v0.1/README.md) | exact permitted invocation + predecessor frontier | source for invoking evidence | actuator emission evidence != independently observed outcome |
| [Personal Anchor trials](../../../../schemas/ecosystem/uu-society/v0.1/personal_anchor_trials/lifecycle-v0.1/README.md) | 16 synthetic tapes, 32 arms, stale/cached boundary failures | optional, **outside OAP baseline** | no real person, trusted clock, cryptographic identity or live effect |
| [Agent JSON/MCP](../../../../schemas/ecosystem/uu-society/v0.1/personal_anchor_trials/agent-v0.1/README.md) | bounded synthetic CLI and stdio MCP consumer surface | pattern for test harness discovery only | READY/replay != identity, authority or permission |
| [KONTUR activation boundary](../../../../server/kontur/v0.1/ACTIVATION_BOUNDARY.md) | human review / intent / preflight / execute explicitly separated | **exclude from independent protocol dependencies** | readiness != activation |
| [Roadmap](../../../../docs/ROADMAP-CURRENT.md) | current evidence/release limits, C2PA incomplete, external review pending | preserve predecessor roadmap; create OAP-specific gates | internal bounded PASS != external qualification |
| [Security](../../../../SECURITY.md), [Governance](../../../../GOVERNANCE.md), [Licensing](../../../../LICENSE.md) | data minimization, qualified provenance, plural governance intent, CC BY 4.0 / Apache-2.0 | derive constraints and review licensing *before copying* | Git provenance != IP adjudication |

Unmerged [PR #1050](https://github.com/Matawaka/uu-aap/pull/1050) at reviewed head `fa613c8479bd04e058d247b787886172f12dcb13` reports cross-interface consumer tests; **state OPEN/NOT MERGED**, so it is not counted as main functionality. Its PR description reports synthetic cached-boundary comparisons and explicitly denies autonomous-agent/end-effect coverage. Historical `main` and current PR data must remain separate.

## 2. Primary external prior art and interoperability baseline

Sources checked 2026-11-19:

1. [GNAP RFC 9635](https://www.rfc-editor.org/rfc/rfc9635.html) (Proposed Standard, 2024) and [GNAP RS RFC 9767](https://www.rfc-editor.org/rfc/rfc9767.html) already address software-delegated authorization and resource-server relationships.
2. [OAuth 2.1 draft-ietf-oauth-v2-1-17](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-17) is an October 2026 Internet-Draft, NOT an issued RFC.
3. [RFC 8693 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693.html) addresses delegation/impersonation, [RFC 9396 RAR](https://www.rfc-editor.org/rfc/rfc9396.html) structured authorization detail, [RFC 9449 DPoP](https://www.rfc-editor.org/rfc/rfc9449.html) sender-constrained tokens. Scope, key binding, request specificity and delegation alone are **not** OAP inventions.
4. [OpenID AuthZEN Authorization API 1.0](https://openid.net/specs/authorization-api-1_0.html), approved final in January 2026, covers decision APIs; OAP must not redefine PDP/PEP semantics merely by renaming them.
5. [OpenID CAEP 1.0](https://openid.net/specs/openid-caep-1_0-final.html) and Shared Signals support revocation/status signaling; reliability and race conditions remain implementation questions.
6. [IETF Transaction Tokens draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-transaction-tokens-11), [AAuth agent-to-resource draft](https://datatracker.ietf.org/doc/html/draft-hardt-oauth-aauth-protocol-11), and [OAuth agent authorization extension](https://datatracker.ietf.org/doc/html/draft-rosenberg-oauth-aauth-02) are active overlapping drafts, not settled universal standards. [OpenID AAuth WG](https://openid.net/wg/aauth/) exists as of November 2026.
7. [OpenA2A Agent Authorization Protocol](https://github.com/opena2a-standards/agent-authorization-protocol) has an overlapping independent agent authorization specification and broker profile; interoperability rather than invention claims is required.
8. **Naming collision:** [Overturo Authorization Protocol (OAP)](https://overturo.com/agent-authorization) and [Open Agent Protocol (OAP)](https://github.com/openagentprotocol-OAP/oap-spec) already use `OAP`. `Open Authorization Protocol / OAP` is a working label only, with no uniqueness or trademark clearance assertion.

**Differentiation hypothesis, not verified superiority:** a protocol-neutral, portable, independently verifiable _authorization-to-effect evidence binding_ connecting an existing authorization decision, a specific gated execution attempt, its independent outcome observation, and the verifiable limits/non-effects of each statement. Competitors have logs, decision receipts, scoped approvals and transaction tokens; it must be tested whether the proposed evidence composition is actually missing, useful or interoperable in practice.

## 3. Gap ledger

| Gap ID | Material missing evidence/decision | Risk | Required acceptance evidence |
| --- | --- | --- | --- |
| G0 | precise minimal interoperable statement model and wire serialization | incompatible meaning across implementations | normative model + independent parsing of common vectors |
| G1 | issuer entitlement and trust-root discovery across domains | signed-but-unauthorized permit | independent entitlement chain/trust policy and negative spoofing tests |
| G2 | action-to-permit canonical binding for actual adapter | intent/target/parameter substitution | exact target, verb, parameter digest, audience and frontier tests |
| G3 | fresh decision/revocation evaluation at actual effect boundary | TOCTOU, stale authorization | denial on revoked/expired/changed state at execution time |
| G4 | replay/duplicate/at-most-once behavior with persistence/crashes | repeated high-impact effects | restart/concurrent competing commit tests; defined idempotency |
| G5 | independent actuator/outcome provenance and evidence minimization | signed log ≠ observed fact; privacy leakage | two distinct trust domains and tampering/payload-redaction tests |
| G6 | interoperation with OAuth/GNAP/AuthZEN/MCP without credential laundering | incompatible deployment / untrusted proxy | adapter contract + no-secret-exposure tests |
| G7 | stable crypto algorithm choices, canonicalization, agility, clock semantics | cross-language signature mismatch | crypto profile review and two-language vectors |
| G8 | governance, namespace, license/IPR and standards venue | adoption/conflict of authority and name | recorded human choices, contribution and IPR disclosures |
| G9 | independent implementation and security review | repository self-confirmation mistaken for certification | separate independent verifier, independent audit |
| G10 | threat evidence from real gated actions under authorized pilot conditions | simulation falsely equated to production | controlled real-effect pilot, observed external evidence and explicit limitations |

## 4. Architecture-qualification conclusion

- **GO:** draft independent non-normative architecture, evidence schema prototypes, offline conformance corpus.
- **CONDITIONAL:** OAP-specific standalone repository, public name, normative wire/version registry, crypto and governance after human choices.
- **NO-GO:** declare production trust, identity continuity, certified authorization, independent qualification, cross-vendor deployment, universal non-repudiation or actual actuator correctness.
- **NO-GO:** activate KONTUR, change predecessor Core/SPEC, retune historical benchmarks, rewrite frozen receipts, auto-merge, or use private repo details as public claims.

**Full GitHub security-audit caveat:** This is a source/boundary-focused review of the canonical project and a repository portfolio inventory, not static/dynamic security testing of all 387 workflows, all products or the private repositories. Those require separate bounded scopes.
