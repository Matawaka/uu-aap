# KONTUR Game Companion — Externalization Authority Challenge / Live Activation Request v0.1

Status: synthetic, non-executing, pre-live boundary.

## Purpose

This layer records a bounded request to move a KONTUR Game Companion interaction beyond shadow/null-transport evaluation. It does **not** grant authority and it cannot enable transport, network activity, user exposure, response sending, ActionPermit, or Stable Core promotion.

Placement:

`... → Shadow Runtime / Null Sink → Activation Readiness Assessment → Live Activation Request → Authority Review → no live activation`

The predecessor `runtime-activation-boundary` can prove that technical preconditions are complete while returning `EXTERNAL_AUTHORIZATION_REQUIRED`. This layer gives that requirement a typed request/challenge surface: who claims to request externalization, for what purpose, for what exact scope, and with what claimed identity/authority evidence.

## Request scope

v0.1 permits only the synthetic request shape:

- requester claim: a synthetic operator identifier;
- purpose: `BOUNDED_LIVE_COMPANION_VALIDATION`;
- requested scope: `THIS_SYNTHETIC_SESSION_ONLY`;
- requested capability: `LIVE_RESPONSE_DELIVERY`;
- duration: `ONE_SESSION`;
- no proactive/background messaging;
- no gameplay/account control;
- no cross-game scope;
- rollback and audit requirements acknowledged.

The request may carry evidence-presence markers for requester identity and requester authority. Evidence presence is not evidence validation, and neither is authority itself.

## Decisions

- `NOT_APPLICABLE` — predecessor does not require external authorization.
- `IDENTITY_CHALLENGE_REQUIRED` — no requester identity evidence has been presented.
- `AUTHORITY_CHALLENGE_REQUIRED` — identity evidence is present but authority evidence is absent.
- `READY_FOR_AUTHORITY_REVIEW` — bounded request and both evidence-presence markers are complete. This means only that an independent authority review may now inspect the request.

There is intentionally no `AUTHORIZED`, `LIVE_READY`, `SEND_ALLOWED`, or `ACTIVATED` state.

## Core boundaries

- `Activation Request != Activation`
- `Requester Claim != Requester Identity`
- `Identity Evidence Present != Identity Proven`
- `Authority Evidence Present != Authority Validated`
- `Authority Evidence != Authority Grant`
- `Ready for Authority Review != Authorized`
- `Requested Capability != Granted Capability`
- `Requested Scope != Granted Scope`
- `Request Digest != Authority`
- `Externalization Request != Send Permit`
- `Technical Readiness != Right to Externalize`
- `Live Activation Intent != Live Activation Authority`

## Non-effects

Every request/challenge result keeps all of the following false:

- externalization authority granted;
- live runtime enabled/bound;
- external transport bound;
- network enabled;
- user surface enabled;
- send permit / send authority;
- external effect authorization;
- delivery attempt / transport invocation;
- ActionPermit / successor permit;
- payload persistence;
- background/proactive messaging;
- game/account control;
- Stable Core promotion.

The artifact is synthetic and cannot be used as a runtime authorization token.