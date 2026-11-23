# OAP phase 0 threat model and conformance test plan

Date 2026-11-19. Proposed offline-first test plan; **not executed OAP conformance evidence**.

## Target security properties

S1 — no unauthenticated party can promote evidence or an AI-generated intent into an authority grant.

S2 — an execution permit never authorizes broader subject, target, operation, parameters, audience, time or delegation depth than the verified grant.

S3 — the gate checks current authoritative conditions at the real effect boundary, not from client-controlled time or a cached response.

S4 — duplicates and parallel retries cannot consume a one-shot permit more than once *if* the deployment claims durable one-shot behavior. No implicit guarantee from protocol serialization alone.

S5 — evidence signatures validate origin/integrity under a selected key/trust policy; they never establish independent observation, physical outcome, legal liability or causal truth.

S6 — a verifier distinguishes `DENIED`, `REVOKED`, `EXPIRED`, `DISPUTED`, `INSUFFICIENT_EVIDENCE`, `OBSERVED`, and `NOT_EXECUTED` where applicable, without treating unknown as allowed.

S7 — a public/exported receipt does not require raw personal history, complete prompts, credentials, biometric material or undisclosed private data.

## Threat actors / boundaries

Compromised agent process; stolen bearer token/key; malicious issuer claiming unearned scope; misconfigured PDP; stale/cached gate; relay or cross-audience replay; swapped target parameters; race between revoke/execute; malicious actuator fabricating success; colluding observer; compromised or divergent clocks; coerced disclosure; schema confusion and algorithm downgrade; unauthorized registry/name claiming.

## Proposed frozen test matrix

| ID | Input/attack | Expected essential behavior |
| --- | --- | --- |
| T00 | valid exact grant, request, gate and observation | bounded success, no truth/identity overclaim |
| T01 | unknown issuer, valid signature | DENY / issuer entitlement unverified |
| T02 | child grant widens target/operation/time | DENY |
| T03 | request parameter or target altered after approval | DENY |
| T04 | action on another domain/audience | DENY |
| T05 | expired permit / client clock backdated | DENY using gate clock/source |
| T06 | revoke between prior approval and execution | DENY at execution check |
| T07 | revocation source unavailable / stale | DENY or declared explicit fail-closed profile; never silently permit |
| T08 | repeated nonce/permit across processes | no second effect under claimed one-shot implementation |
| T09 | concurrent commit, crash after side effect, retry | retain honest ambiguity; no unjustified exactly-once assertion |
| T10 | keyed signature valid but evidence payload fabricated | signature valid; external truth NOT_ESTABLISHED |
| T11 | actuator says success, independent observer contradicts | DISPUTED, neither outcome auto-upgraded |
| T12 | altered signed receipt or predecessor digest | verification fails |
| T13 | changed policy version or exact frontier | re-evaluate / DENY if mismatch |
| T14 | revoked historical permit with past valid observation | preserve history, forbid future reuse |
| T15 | prompt injection masquerading as human approval | no authority promotion |
| T16 | attempt to expose access token/private challenge response | rejected public evidence / redacted export |
| T17 | OAuth/GNAP token mapped to broader OAP action | DENY; never scope-launder |
| T18 | unsupported algorithm, critical extension or encoding ambiguity | DENY |
| T19 | offline verifier lacks trusted revocation freshness | `INSUFFICIENT_EVIDENCE`, not unbounded allow |
| T20 | independent language implementations parse same vectors | identical accept/deny and canonical bytes for approved profile |
| T21 | key rotation/compromise and historical assertions | explicit epochs; no reauthorization by old signature alone |
| T22 | missing `OutcomeObservation` after sent invocation | `OUTCOME_UNKNOWN`, not `SUCCESS` |
| T23 | external effect bypasses ActionGate | violation detected in integration pilot; never conformance pass |

Test oracles MUST be authored and committed before executing a given frozen run. Retain every negative result, including where the design itself fails. Do not adjust thresholds to convert RED to GREEN.

## Phase gates

**P0 (this PR):** reviewable threat model, source-linked audit and decision register; no executable change. 

**P1:** approved schema, wire canonicalization and two-role verifier / issuer prototype under synthetic trust; T01–T07, T12–T15, T18–T19.

**P2:** independent language implementation and persistence/revocation race harness; T08–T11, T16–T17, T20–T22.

**P3:** permissioned controlled external-effect pilot with independent audit; T23 plus real outcome provenance. Requires separate explicit human authorization and ethical/legal clearance.

No result is production certification without an independent test and published scope. Repo CI green means exactly that bounded test passed, not absence of compromise.

## Open measures

Specify: false-accepting unauthorized actions (must be zero in frozen security vectors); false-denying authorized actions (report separately); median/P95 latency at decision and gate; revocation stale window; duplicate effects under crash/retry; per-receipt exported personal data; cross-implementation serialization conflicts; proportion of outcomes independently observable. No post-hoc tuning to maximize green rate.
