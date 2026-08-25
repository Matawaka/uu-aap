# Core Pilot 004 Run 001 — Exact Single-Use Comment Permit

**Status:** permit candidate / NOT authorized for execution  
**Target issue:** #435  
**Canonical frontier:** `d9cfe44aa327e81dcb1a7e8823f0e9eee2322e74`

## Intended effect

Exactly one external effect is proposed:

`issue_comment_create` on `Matawaka/uu-aap#435`

The exact comment body and its SHA-256 are bound in `permit-candidate.json`.

## Current gate

The permit candidate deliberately contains:

```text
human_authorized = false
execution_authorized = false
status = awaiting_explicit_human_authorization
```

Therefore the effect MUST NOT be executed yet.

Merging this candidate does not itself authorize the comment. A separate explicit human approval must bind to this exact permit id, repository, issue number, canonical frontier, effect type and payload digest.

## Required pre-execution revalidation

Immediately before execution, verify:

- current canonical `main` is still the bound frontier or the approved authorization explicitly names a successor frontier;
- issue #435 exists and is still open;
- no prior Run 001 execution comment has consumed this permit;
- effect type is still exactly `issue_comment_create`;
- body SHA-256 is exactly `f3fa252bd30068853d15c730eb0d805cef53816fcfba04b89d30bb82c3eed2d0`;
- explicit human authorization has been received for this exact permit.

Any mismatch means STOP / fail closed.

## After success

The execution receipt must record exactly one effect and mark the permit consumed. The successful comment does not create successor authority.

`successful effect != successor permit`

`permit consumed != authority retained`
