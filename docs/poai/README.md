# PoAI Level 3 — Human Interface

**Status:** pre-alpha experimental human interface  
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
- intervention causal status when recorded;
- evidence and artifact-binding state;
- explicit reminders that `proof != truth`.

Display-only labels may humanize protocol enum tokens for readability. The raw JSON and downloaded artifact retain the original machine values.

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

## Accessibility boundary

The pre-alpha interface uses native controls, visible focus treatment and ARIA tab/tabpanel semantics. The Verifier and Record Builder tabs support `ArrowLeft`, `ArrowRight`, `Home` and `End` keyboard navigation in addition to normal `Tab` navigation.

The hidden file input receives a visible focus proxy on its `Choose a .json file` label so keyboard focus is not invisible.

The stylesheet supports system light/dark preference through `prefers-color-scheme`. Full assistive-technology conformance testing is not yet claimed.

## Language policy for alpha

The first Level 3 alpha is **English-first**. Machine protocol values remain language-neutral tokens. EN/RU localization is intentionally deferred to a later usability iteration so translation work does not create parallel protocol semantics before the first alpha checkpoint.

A future bilingual UI should map both languages to the same underlying protocol terms and values.

## Known pre-alpha limitations

The current interface does not provide or claim:

- cryptographic signing or PoAI/V canonical binding;
- signature or C2PA verification;
- causal inference;
- legal-responsibility determination;
- server-side storage, collaboration or identity verification;
- complete JSON Schema validation in the browser;
- final accessibility certification;
- bilingual EN/RU interface;
- institutional CURA/ONUS/APPEAL workflows.

These limits are deliberate and must not be interpreted as protocol guarantees.

## Tests

From repository root:

```bash
node --check docs/poai/validator.js
node --check docs/poai/app.js
node --check docs/poai/accessibility.js
node docs/poai/test-validator.js
```

The smoke test runs the browser validator against the existing public positive/negative PoAI test vectors and examples.

## Hosting

The files are static and can be published by GitHub Pages without a server. Deployment configuration is intentionally separate from protocol semantics so hosting changes do not redefine PoAI conformance.
