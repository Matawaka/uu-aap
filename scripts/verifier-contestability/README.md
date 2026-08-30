# P1.7 Contestability Overlay v0.1

P1.7 materializes the existing UU-AAP correction/dispute/appeal semantics in the verifier without creating an eighth semantic dimension.

Reference anchors are exact-Git-blob-bound `SPEC.md` and `CONTESTABILITY.md`.

```text
contestability overlay != verifier dimension
correction != dispute != appeal
dispute != claim negation
appeal != repeated dispute
correction != history erasure
```

## Input

The canonical API consumes:

- one validated P1.3 interactive verifier input;
- separate contestability evidence items;
- an ordered list of explicit `CORRECTION`, `DISPUTE` and `APPEAL` records.

Contestability evidence payloads remain opaque. Semantic-looking payload keys such as `verified` or `trust_score` are not promoted into verifier semantics.

## Correction

An applied correction supplies one explicit successor claim for exactly one canonical verifier dimension. The previous current claim is copied into `historical_claims` before the successor becomes current.

Multiple applied corrections are processed in record order, so every replaced state remains visible.

A correction does not establish factual truth, actor identity or authority merely because it was accepted as a successor record.

## Dispute

A dispute records a third-party challenge against one dimension. It may be `OPEN`, `RESPONDED`, `RESOLVED` or `UNRESOLVED`, but it cannot carry a successor claim and cannot mutate the target claim.

Unresolved/open dispute record ids remain visible in the overlay.

## Appeal

An appeal must reference a previously recorded correction or dispute in the same dimension. It challenges the disposition/process outcome and cannot carry a successor claim or rewrite the underlying claim.

## Output

P1.7 returns:

- the original P1.3 input unchanged;
- the seven current dimension claims;
- a separate seven-key contestability overlay;
- ordered historical records;
- separate contestability evidence;
- explicit non-effects and no aggregate score/verdict.

## Public surface

`/verifier/contest/` is browser-local and uses the same P1.3 validator for base and successor-claim validation. It does not upload input, use analytics, call a model or resolve identity/authority.

P1.6 EN/RU localization is extended only for the static contestability shell. User challenge/correction/appeal statements, actor refs, evidence and machine tokens are not translated.

## Non-effects

No Stable Core or `SPEC.md` modification. No formal registry or appeal authority. No identity proof. No authority proof. No truth inference. No history deletion. No forced consensus. No reputation score.
