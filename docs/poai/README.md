# PoAI Level 3 — Human Interface

**Status:** Level 3.1 successor development · experimental human interface  
**Protocol basis:** PoAI Genesis v0.0 · Machine Layer v0.0.1  
**Canonical predecessor:** [`poai-genesis-v0.0.1`](https://github.com/Matawaka/uu-aap/tree/poai-genesis-v0.0.1) at commit `4f9d1929ba19df9512855001c285d688af8ec6fa`  
**Frozen first-alpha checkpoint:** `poai-level3-alpha-v0.1`

This directory contains the human-facing PoAI **Web Verifier & Record Builder** and successor Level 3.1 usability experiments.

Public interface: https://matawaka.github.io/uu-aap/poai/

## Version boundary

Level 3 is developed **after** the frozen Genesis/Machine-Layer checkpoint. The canonical predecessor tag must not move as Level 3 evolves.

The first public human-interface checkpoint is also frozen at `poai-level3-alpha-v0.1`. Current Level 3.1 work is a successor line and must not be read back into that alpha checkpoint.

The interface consumes and presents PoAI Genesis v0.0 / Machine Layer v0.0.1 records without silently redefining that checkpoint. Any future machine-semantic change belongs in an explicit successor protocol revision and RFC.

## Alpha v0.1 checkpoint

The first Level 3 alpha checkpoint followed the completed public usability audit in [Issue #14](https://github.com/Matawaka/uu-aap/issues/14).

The audit covered a live Builder record, JSON download/reload round trip, malformed JSON handling, Future Target and successor records, causal-status visibility, Android/mobile rendering, dark-mode rendering and desktop keyboard navigation.

See [`ALPHA-v0.1.md`](ALPHA-v0.1.md) for the frozen checkpoint scope, evidence and known limitations at that time.

## Current Level 3.1 direction

Successor development after alpha v0.1 currently includes:

- bilingual EN/RU presentation while preserving identical machine values;
- a deeper guided Record Builder;
- repeatable compositional intelligence resources;
- separate availability, consideration and evidence per resource;
- explicit separation of resource provenance from decision authority;
- provisional presentation of `human_judgment` as **Human evaluative contribution / Оценочный вклад человека** without renaming the frozen machine enum;
- non-scalar review cues for valid records;
- experimental purpose-relative review lenses.

The compositional-intelligence research extension is documented under `proposals/poai/extensions/` and is being field-tested before any machine-taxonomy revision is proposed.

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

Display-only labels may translate or humanize protocol enum tokens for readability. The raw JSON and downloaded artifact retain the original machine values.

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

The builder starts a PoAI/T record as **E0 self-declaration**. Where the UI cannot prove a fact, it defaults availability, consideration and authority fields to `unknown` rather than manufacturing certainty.

Level 3.1 supports multiple intelligence resources in one decision record. Each resource keeps its own provenance, availability, consideration and evidence while decision authority remains separately declared.

Generated JSON remains a draft. Filling a field records a declaration; it does not independently prove availability, authority, evidence strength, causality or truth.

## Validity, completeness and truth

Level 3.1d experimentally preserves the distinction:

`validity != completeness != truth`

A record may pass structural and semantic validation while still containing unknown or undeclared relations that matter for a particular review purpose.

`review-cues.js` therefore provides a read-only, non-blocking review layer. Review cues:

- never change `PASS` into failure;
- never fill missing values;
- never convert `unknown` into `available` or `unavailable`;
- never emit a scalar completeness, trust or intelligence score;
- never modify the loaded or downloaded PoAI JSON.

The purpose-relative review experiment lets the reviewer choose an interface-local lens such as general review, operational decision trace, Future Target/intervention trace, historical reconstruction, or publication/accountability. The selected purpose is **not written into the record** and is not a PoAI conformance profile.

This experiment is tracked in [Issue #31](https://github.com/Matawaka/uu-aap/issues/31) and must survive field testing before any protocol-adjacent completeness mechanism is proposed.

## Accessibility boundary

The interface uses native controls, visible focus treatment and ARIA tab/tabpanel semantics. The Verifier and Record Builder tabs support `ArrowLeft`, `ArrowRight`, `Home` and `End` keyboard navigation in addition to normal `Tab` navigation.

The hidden file input receives a visible focus proxy on its `Choose a .json file` label so keyboard focus is not invisible.

The stylesheet supports system light/dark preference through `prefers-color-scheme`. Full assistive-technology conformance testing is not yet claimed.

## Language policy

The frozen `poai-level3-alpha-v0.1` checkpoint was English-first. Current Level 3.1 successor development provides EN/RU presentation.

Language selection affects presentation only. Machine protocol values, validation, Builder JSON and downloaded artifacts remain language-independent.

Translation choices that could alter conceptual meaning are treated as terminology questions rather than silently becoming parallel protocol semantics.

## Known current limitations

The current interface does not provide or claim:

- cryptographic signing or PoAI/V canonical binding;
- signature or C2PA verification;
- causal inference;
- legal-responsibility determination;
- server-side storage, collaboration or identity verification;
- complete JSON Schema validation in the browser;
- final accessibility certification;
- normative completeness/conformance profiles;
- institutional CURA/ONUS/APPEAL workflows.

Review purposes and review cues are experimental usability aids, not machine-level conformance rules.

## Tests

From repository root:

```bash
node --check docs/poai/validator.js
node --check docs/poai/i18n.js
node --check docs/poai/builder-core.js
node --check docs/poai/builder-ui.js
node --check docs/poai/review-cues.js
node --check docs/poai/app.js
node --check docs/poai/accessibility.js
node docs/poai/test-validator.js
node docs/poai/test-builder.js
node docs/poai/test-review-cues.js
```

Repository CI also validates generated Builder records and public examples through the canonical Python semantic validator plus JSON Schema.

## Hosting

The files are static and can be published by GitHub Pages without a server. Deployment configuration is intentionally separate from protocol semantics so hosting changes do not redefine PoAI conformance.
