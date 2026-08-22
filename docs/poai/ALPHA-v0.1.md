# PoAI Level 3 Alpha v0.1

**Checkpoint tag:** `poai-level3-alpha-v0.1`  
**Protocol basis:** PoAI Genesis v0.0 · Machine Layer v0.0.1  
**Canonical predecessor:** `poai-genesis-v0.0.1` → `4f9d1929ba19df9512855001c285d688af8ec6fa`  
**Public interface:** https://matawaka.github.io/uu-aap/poai/

## Purpose

This checkpoint freezes the first publicly exercised human-interface layer for **Proof of Available Intelligence (PoAI)**.

It does not introduce a new semantic protocol revision. It packages the Level 3 usability layer that presents existing Genesis/Machine-Layer records to humans without changing their machine values.

## Included

- browser-only PoAI JSON verifier;
- guided PoAI/T Record Builder starting from E0 self-declaration;
- human-readable Decision Boundary and Knowledge Cutoff;
- separate availability, consideration and authority views;
- Future Target / intervention / outcome / successor presentation;
- visible intervention causal status when recorded;
- display-only humanization of enum tokens while raw JSON remains unchanged;
- explicit `Truth certified? NO` and artifact-binding status;
- browser-local file handling with no PoAI upload endpoint;
- mobile responsive layout;
- system dark/light appearance;
- keyboard focus and ARIA tab semantics;
- GitHub Pages deployment with least-privilege workflow permissions;
- required CI parity checks against existing PoAI examples and test vectors.

## Public usability evidence

The first public audit is recorded in [Issue #14](https://github.com/Matawaka/uu-aap/issues/14).

Live tests completed on 22 August 2026 include:

1. a Builder-created PoAI/T record validating as PASS while unproven availability/authority remained `unknown`;
2. `Builder → download JSON → reload → Verifier` round trip without displayed semantic drift;
3. malformed JSON producing an explicit `INVALID JSON` parse failure and clearing stale visualization;
4. synthetic Future Target record showing a probable future risk, intervention and successor reference;
5. successor record showing `not_realized_after_intervention` while separately displaying `associated_not_proven` causal status;
6. Android/mobile portrait rendering without page-level horizontal overflow;
7. dark-mode readability;
8. desktop keyboard navigation with visible focus across tabs, file chooser, JSON input and controls.

## Security and privacy boundary

The interface intentionally does not upload selected PoAI records to a PoAI server. Application JavaScript has no analytics dependency and no record-upload endpoint.

GitHub Pages deployment uses job-scoped permissions and does not grant repository content write access to the deployment job.

Normal browser/network behavior for loading the static site still applies.

## Language policy

Alpha v0.1 is **English-first**.

Protocol enum tokens remain language-neutral machine values. EN/RU localization is deferred so translations can be mapped to the same underlying semantics rather than creating language-specific protocol variants.

## Known limitations

Alpha v0.1 does not provide or certify:

- factual truth;
- legal responsibility;
- causal inference or proof;
- canonical PoAI/V serialization/signing;
- signature verification;
- C2PA verification;
- complete browser-side JSON Schema equivalence;
- final accessibility conformance;
- identity verification;
- server-side collaboration/storage;
- bilingual EN/RU UI;
- CURA/ONUS/APPEAL institutional workflows.

A browser PASS means that the record passes the implemented browser usability checks. It is not a truth certificate.

## Lineage

```text
poai-genesis-v0.0.1
        │
        ▼
Level 3 implementation (PR #12)
        │
        ▼
GitHub Pages publication (PR #13)
        │
        ▼
permission hardening (PR #15)
        │
        ▼
causal-status visibility (PR #16)
        │
        ▼
human-readable enum display (PR #17)
        │
        ▼
accessibility / alpha-scope closure (PR #18)
        │
        ▼
public usability audit #14 complete
        │
        ▼
poai-level3-alpha-v0.1
```

## Successor work

Alpha v0.1 is a checkpoint, not a final interface specification. Likely successor work includes EN/RU localization, deeper accessibility testing, richer Builder authoring, a clearer visual decision graph and eventual PoAI/V cryptographic binding.
