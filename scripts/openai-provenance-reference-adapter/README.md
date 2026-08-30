# OpenAI Content Provenance Reference Adapter v0.1

Status: **experimental provider-specific interoperability adapter** for `Matawaka/uu-aap#787`.

Predecessor line:

- #778 — CAI/C2PA interoperability roadmap and executable P0.1–P0.5 evidence;
- #777 — superseded semantic-boundary draft;
- #786 — merged evidence-informed C2PA 2.4 × UU-AAP semantic boundary;
- #788 — merged P0.6 ContentAuth WordPress publishing-governance composition;
- canonical predecessor main: `175471dfb62643a7bfea333c2bb5d299c128e578`.

This adapter does **not** modify UU-AAP Core and is not C2PA conformance, an OpenAI API implementation, an identity system, a trust score, or a proof of truth.

## Purpose

OpenAI currently exposes a synchronous Content Provenance API:

```text
POST /v1/content_provenance_checks
```

The documented response contains separate result entries for applicable provenance signals:

```text
C2PA Content Credentials -> image provenance metadata
SynthID                  -> supported image/audio watermark
```

This adapter converts that provider-specific response shape into one bounded `OpenAIProvenanceEvidenceReceipt` while preserving the semantic boundary established by #786.

Reference documentation snapshot reviewed 2026-08-30:

- <https://developers.openai.com/api/docs/guides/content-provenance>
- <https://help.openai.com/en/articles/8912793>
- <https://openai.com/research/verify/>

The adapter does not fetch those pages at runtime. Documentation links are provenance references for the interface contract; deterministic fixtures are committed locally.

## Input boundary

Input is the exact JSON response bytes from a content provenance check.

The current documented shape is:

```json
{
  "object": "content_provenance_check",
  "created_at": 1778000000,
  "results": [
    {
      "type": "c2pa",
      "outcome": "detected",
      "validation_state": "trusted",
      "issuer": "OpenAI OpCo, LLC",
      "model": "gpt-image",
      "generated_at": "2026-07-27T18:34:12Z"
    },
    {
      "type": "synthid",
      "outcome": "not_detected",
      "model": null,
      "generated_at": null
    }
  ]
}
```

The adapter hashes the exact source bytes and maps only the documented result semantics it knows. Unknown future result types are surfaced in `unsupported_result_types` and remain semantically uninterpreted rather than being silently promoted.

`source response hash != API attestation`

The first increment uses deterministic API-shaped fixtures. It explicitly fixes:

```text
live_api_observation_established = false
```

A later separately authorized acceptance can bind a real API response.

## C2PA interpretation

A positive OpenAI C2PA generation signal requires all of:

```text
type = c2pa
outcome = detected
validation_state in {trusted, valid}
```

A third-party/invalid/not-present or otherwise `not_detected` result remains non-positive even if issuer/model display fields are present.

The adapter rejects the inconsistent combination:

```text
outcome = detected
validation_state in {invalid, not_present}
```

It does not replace C2PA validation.

## SynthID interpretation

A positive SynthID observation requires:

```text
type = synthid
outcome = detected
```

`not_detected` means only that this verification surface did not detect the supported watermark.

It MUST NOT be converted to:

```text
human-created
non-AI
non-OpenAI
original
unedited
```

## Signal plurality is not evidence-source independence

C2PA and SynthID are distinct provenance signal channels. When both are present or both are detected, the receipt can expose that plurality.

It always keeps:

```text
independent_corroboration_established = false
```

The adapter therefore distinguishes:

```text
two signal channels != two independent witnesses
```

A later evidence-independence assessment may use additional provenance to make a stronger claim. This adapter does not.

## Mandatory semantic non-effects

Every valid receipt fixes the following to `false`:

```text
creator_identity_established
human_authorship_established
intent_established
purpose_established
authority_established
publication_authority_established
responsibility_established
truth_certified
accuracy_established
unedited_content_proven
legal_ownership_established
correct_context_established
complete_history_established
decision_time_availability_established
consideration_established
causality_established
liability_established
action_permit_created
external_effect_authorized
```

This directly preserves the #786 boundary:

```text
provider provenance != authorship
provider provenance != intent
provider provenance != authority
provider provenance != responsibility
provider provenance != truth
present provenance != historical decision-time availability
```

## Deterministic fixtures

Committed fixtures cover:

1. `both-detected.json` — C2PA trusted + SynthID detected;
2. `c2pa-only.json` — C2PA valid detected + SynthID not detected;
3. `no-signals.json` — no supported signal detected;
4. `invalid-c2pa.json` — invalid C2PA metadata/display fields do not become positive provenance.

`expected-both-detected-receipt.json` is the exact deterministic output for the first fixture.

Run:

```bash
python scripts/openai-provenance-reference-adapter/test_adapter.py
```

or:

```bash
python scripts/openai-provenance-reference-adapter/adapter.py \
  scripts/openai-provenance-reference-adapter/fixtures/both-detected.json
```

## Fail-closed mutations

The test suite rejects:

- provenance -> human authorship;
- provenance -> intent;
- provenance -> authority;
- provenance -> responsibility;
- provenance -> truth;
- present provenance -> decision-time historical availability;
- two provider signals -> independent corroboration;
- aggregate trust-score injection;
- C2PA `detected` paired with `invalid` validation state.

## Fingerprint boundary

The receipt uses an adapter-local deterministic sorted-JSON SHA-256 fingerprint:

```text
sorted-json-sha256-adapter-local-v0.1-not-jcs
```

This is **not** claimed to be RFC 8785 JCS, a C2PA content binding, a digital signature, or a provider attestation. The exact input response bytes are separately SHA-256 committed.

## Future composition

A later layer may consume this receipt as bounded provider provenance evidence:

```text
OpenAI provenance receipt
        -> optional PoAI availability assessment
        -> optional UU-AAP governance/authority/responsibility evidence
```

Those later layers must remain explicit.

`OpenAIProvenanceEvidenceReceipt != StateReceipt != AvailabilityClaim != IntentReceipt != AuthorityReceipt != ActionPermit`
