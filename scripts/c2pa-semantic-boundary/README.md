# C2PA Semantic Boundary Rubric v0.1

Status: **experimental application-semantics harness; not C2PA conformance**.

Related roadmap: `Matawaka/uu-aap#778` (P0.1). Semantic contract: PR `#777` while that draft remains open.

## Purpose

This harness tests a narrow interoperability failure mode: a consumer receives valid C2PA provenance evidence and silently promotes it into a stronger UU-AAP or PoAI claim that the C2PA evidence does not establish.

It keeps two questions separate:

1. **C2PA validation:** is the asset/manifest relation structurally and cryptographically valid under the C2PA validator being used?
2. **Semantic-boundary evaluation:** did an application infer authorship, authority, responsibility, truth, decision provenance, concept origin, review, or decision-time availability from the wrong evidence class?

The second result MUST NOT be presented as C2PA conformance and MUST NOT change the result of C2PA validation.

## Rubric

`rubric-v0.1.json` encodes seven initial invariants:

- C2PA signer != UU-AAP authorship/approval/authority/responsibility/publication authorization;
- C2PA action != UU-AAP decision;
- C2PA ingredient != UU-AAP concept origin;
- C2PA AI disclosure != UU-AAP authority/responsibility/authorship;
- repository receipt != truth/review/publication authorization;
- cryptographic integrity != epistemic truth;
- artifact existence/provenance != PoAI decision-time availability.

A finding is produced only when a target claim cites a prohibited C2PA evidence class and lacks an explicitly permitted independent evidence class for that target. Adding unrelated C2PA evidence does not clear the finding.

## Deterministic fixtures

Run:

```bash
node scripts/c2pa-semantic-boundary/test.js
```

The unsafe fixture must trigger all seven invariant IDs. The safe fixture keeps the same C2PA evidence but adds explicit UU-AAP/PoAI evidence of the required semantic class and must pass.

For direct evaluation:

```bash
node scripts/c2pa-semantic-boundary/evaluate.js \
  scripts/c2pa-semantic-boundary/rubric-v0.1.json \
  scripts/c2pa-semantic-boundary/fixtures/unsafe-all-invariants.json
```

The evaluator exits non-zero when semantic-boundary findings exist. Its JSON output always states `c2pa_conformance_evaluated: false`.

## Live C2PA composition fixture

CI runs a networked acceptance check with the official prebuilt `contentauth/c2pa-rs` toolchain:

- validator/generator: `c2patool v0.27.16`;
- release archive SHA-256: `62eed34f0c90a24b696b1969c8aad4340e11ec7264e1cf6fc375ad15c1db7663`;
- source asset: deterministic 1x1 PNG created inside the CI job;
- manifest: fresh C2PA manifest generated in the same job with `--create digitalCapture` and the tool's built-in **FOR TESTING ONLY** development signer;
- test signer certificate validity: through 2030-08-26; it is not treated as a production or trusted identity credential.

The workflow generates the asset, reads it again through `c2patool`, requires a C2PA `Valid` or `Trusted` state under current validation semantics, and only then applies `live-signer-overlay.json`. The overlay deliberately makes the unsafe consumer inference `C2PA signer -> UU-AAP author`. Acceptance succeeds only when the semantic rubric catches that promotion.

This proves composition, not equivalence:

```text
fresh C2PA asset -> C2PA validator -> provenance evidence
                                       |
                                       v
                            consumer semantic claim
                                       |
                                       v
                          UU-AAP boundary rubric
```

A C2PA-valid asset can therefore coexist with a failed semantic-boundary evaluation. That is the intended result.

### Temporal fixture lesson

An earlier live candidate used the pinned upstream `contentauth/c2pa-conformance-tool-cli` asset `PXL_20260208_202351558.jpg`. On 2026-08-30 the current validator reported `signingCredential.expired`, making its validation state `Invalid` even though the asset remains useful as historical provenance material.

The harness deliberately did **not** tolerate that failure. Positive CI acceptance now creates a fresh asset instead of weakening C2PA validity rules to keep a stale fixture green. This is itself an interoperability lesson:

`historically useful provenance fixture != currently Valid C2PA credential state`.

## C2PA validation-state boundary

`check-live-report.js` mirrors only the subset needed to keep this composition gate honest:

- `Valid` requires the active claim signature to validate and be inside its validity interval;
- `signingCredential.untrusted` is compatible with `Valid` but not `Trusted`;
- `cawg.x509.*` identity-assertion failures are tolerated at the enclosing-manifest validity layer in the same way as the current SDK logic;
- expiry, data-hash mismatch, or other non-tolerated failures fail the live gate.

This helper is not a replacement C2PA validator. The authoritative validation is still performed first by the pinned `c2patool` binary.

## Common-interface direction

The CAI conformance tool evaluates YAML-authored rubrics over C2PA reports. This v0.1 harness deliberately does not fork that conformance semantics or register a UU-AAP C2PA assertion. Its reusable interface is the small pair:

```text
evidence[]: { id, kind, ... }
claims[]:   { id, kind, value, evidence_refs[] }
```

A later adapter can derive these application-level claims from a verifier/UI/agent trace and expose the resulting indicators to a CAI-style custom rubric. That adapter should be proposed externally only after the local fixture is stable and reproducible.

## Public benefit

The immediate protected users are readers, journalists, creators, publishers, institutions, and AI agents consuming Content Credentials. The harness prevents a trustworthy provenance interface from accidentally becoming a truth badge, authorship badge, authority badge, or responsibility-laundering mechanism.
