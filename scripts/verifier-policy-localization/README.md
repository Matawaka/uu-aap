# P1.6 Verifier Technical Policy + EN/RU Localization Shell v0.1

This surface localizes verifier **presentation**, not protocol semantics.

```text
localized presentation != localized protocol semantics
translated UI label != translated evidence
language selection != semantic transformation
```

## Public additions

- `/verifier/policy/` — implementation-backed technical processing and semantic policy;
- EN/RU static-shell language controls on the Pages landing plus P1.3 `/interactive/`, P1.4 `/adapt/` and P1.5 `/accept/`;
- one local, generated `verifier/assets/l10n.js` runtime and published message catalog.

The immutable P1.1 `/verifier/` reference is not modified or localized.

## What is localized

Only allowlisted static UI nodes marked with `data-i18n` are translated. The runtime has no translation service, backend, model call or network-request API.

The following remain canonical and are not automatically translated:

- JSON/schema field names and URNs;
- enum values;
- the seven dimension tokens;
- source-layer identifiers and evidence references;
- normalized JSON;
- artifact/evidence text supplied by users;
- payloads, rationales and dispute data;
- validation diagnostics in v0.1.

Locale selection is page-local and in-memory only. P1.6 does not use cookies, `localStorage`, `sessionStorage` or analytics.

## Technical policy boundary

The verifier policy page is not a new legal privacy policy or regulatory/WCAG certification. It describes behavior supported by the validated verifier implementation and defers repository-level policy to exact Git-blob-bound sources:

- `SECURITY.md` for security, privacy and coercion resistance;
- `CONTRIBUTING.md` for accessibility/internationalization feedback and contribution boundaries;
- `CODE_OF_CONDUCT.md` for community privacy and anti-doxxing expectations.

Browser, extension, operating-system, hosting-platform and device behavior outside verifier application code is outside the local-processing guarantee.

## Accessibility posture

P1.6 keeps native keyboard-operable controls, explicit form labels, existing `aria-live` status/error regions and adds an `aria-pressed` language selector. It does not claim audited or complete WCAG conformance.

## Deployment ordering

P1.6 is a post-build augmentation only:

```text
P1.2 immutable reference
  -> P1.3 explicit input
  -> P1.4 candidate adapters
  -> P1.5 explicit acceptance/materialization
  -> P1.6 technical policy + localized static shell
  -> re-check immutable /verifier/
  -> upload/deploy
```

No Stable Core or `SPEC.md` change is required.
