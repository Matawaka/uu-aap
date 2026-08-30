# Legacy PoAI roadmap / Level 4 issue-state audit v0.1

**Issue:** #769  
**Origin frontier:** `0d149b1ce7ede7d3a3b389bc6199f68d20f096e2`  
**Mode:** read-only evidence admission before any post-merge issue-state mutation

## Purpose

This audit reconciles a small mixed set of historical PoAI roadmap, terminology, completeness and Level 4 discovery issues against the current repository without converting semantic reuse into fabricated field evidence.

Decision vocabulary:

`CLOSE_COMPLETED | PRESERVE_OPEN | DEFER`

## Result

### Admitted for post-merge closure

- #26 — the frozen `human_judgment` enum remains unchanged while the current compositional model separates resource provenance, availability, consideration, authority and responsibility;
- #31 — review cues are purpose-relative, non-scalar, non-blocking and interface-local; they expose missing/unknown relations without mutating PoAI JSON or certifying truth;
- #73 — the old Level 4 staged architecture discovery work has reusable successors for deterministic binding/signature and later identity/authority/materialization boundaries;
- #80 — signature binding exists as an experimental successor surface and remains explicitly distinct from signer identity, authority, truth, materialization authority and canonicality.

### Preserved open

- #22 — its Level 3.1 roadmap still contains a field-usability stage whose real evidence is not supplied by this audit;
- #28 — the field-usability round explicitly requires real cases. Repository semantics, synthetic vectors, CI or later architecture do not substitute for those observations.

`Semantic Closure != Field Evidence`

`Implemented Main Path != Observed Field Usability`

`Signature Validity != Identity != Authority != Truth != Canonicality`

## Byte-bound evidence

`decisions.json` binds exact Git blob SHA-1 values for:

- `proposals/poai/extensions/COMPOSITIONAL_INTELLIGENCE.md`;
- `docs/poai/review-cues.js`;
- `proposals/poai/extensions/SIGNATURE_BINDING.md`;
- `protocols/experimental/poai-successor-reconciliation/v0.1/legacy-successor-map.json`.

`validate.py` recomputes those blob identities directly from repository bytes and verifies the exact candidate issue set, closure/open sets, semantic boundaries and current reusable references.

The mutation suite rejects closing #22/#28, adding an unauthorized issue, widening the closure set, changing a bound source, weakening the Level 4 decision or converting any declared non-effect into an effect.

## Closure rule

This artifact does not itself close any historical issue. The exact post-merge closure set is limited to:

`#26 | #31 | #73 | #80`

Those issue-state mutations are authorized only after the dedicated PR containing this artifact is merged with green required checks.

## Non-effects

This audit does not rewrite historical RFCs or checkpoints, satisfy field usability, create PoAI/V conformance, certify truth, verify identity or authority, create universal canonicality, create execution/external-effect authority, authorize release, or authorize live observation.
