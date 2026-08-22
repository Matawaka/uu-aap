# PoAI Level 3 — Human Interface

**Status:** experimental interface proposal  
**Protocol basis:** PoAI Genesis v0.0 · Machine Layer v0.0.1  
**Canonical predecessor:** [`poai-genesis-v0.0.1`](https://github.com/Matawaka/uu-aap/tree/poai-genesis-v0.0.1) at commit `4f9d1929ba19df9512855001c285d688af8ec6fa`

This directory contains the first human-facing PoAI interface: a browser-only **Web Verifier & Record Builder**.

## Version boundary

Level 3 is developed **after** the frozen Genesis/Machine-Layer checkpoint. The canonical predecessor tag must not move as Level 3 evolves.

This interface therefore consumes and presents PoAI Genesis v0.0 / Machine Layer v0.0.1 records without silently redefining that checkpoint. Any future semantic change belongs in an explicit successor protocol revision and RFC.

## Goals

Level 2 made PoAI machine-readable. Level 3 makes the same distinctions inspectable without requiring users to read JSON directly.

The interface exposes:

- Decision Boundary and Knowledge Cutoff;
- Future Target;
- intelligence resources;
- availability separately from consideration;
- authority scopes;
- outcome/intervention/successor state;
- evidence and artifact-binding state;
- explicit reminders that `proof != truth`.

## Privacy model

The verifier reads pasted or selected JSON locally in the browser. There is no PoAI upload endpoint and no analytics dependency in this implementation.

The page uses no external JavaScript libraries. A selected record is not intentionally transmitted to GitHub, the repository owner, or another PoAI service by the application code.

Normal browser/network behavior still applies to loading the page itself.

## Validation boundary

`validator.js` implements a dependency-free browser mirror of core semantic invariants from `proposals/poai/tools/validate_poai.py`.

It is a usability validator, **not** the normative structural validator. The machine-layer reference remains:

1. JSON Schema Draft 2020-12; and
2. the repository Python semantic validator.

The browser validator deliberately does not claim:

- truth certification;
- legal responsibility;
- causal proof;
- signature verification;
- C2PA verification;
- complete JSON Schema equivalence.

## Record Builder

The builder starts a PoAI/T record as **E0 self-declaration**. Where the UI cannot prove a fact, it defaults availability/authority fields to `unknown` rather than manufacturing certainty.

Generated JSON should be extended with actual resources, evidence, constraints, alternatives, authority evidence and successor records as applicable.

## Tests

From repository root:

```bash
node --check docs/poai/validator.js
node --check docs/poai/app.js
node docs/poai/test-validator.js
```

The smoke test runs the browser validator against the existing public positive/negative PoAI test vectors and examples.

## Hosting

The files are static and can be published by GitHub Pages without a server. Deployment configuration is intentionally separate from protocol semantics so hosting changes do not redefine PoAI conformance.
