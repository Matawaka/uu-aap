# Rospatent registration 2026691650 — primary-document supplement

Recorded: **2026-11-18**  
Scope: **UU-AAP Core v0.1 Receipt Chain Validator**  
Evidence classification: **applicant-supplied copies of official-looking PDF documents; authenticity not independently verified**.

## Purpose and predecessor

This append-only supplement follows the [original outcome](ROSPATENT-REGISTRATION-2026691650.md) and its [frozen machine receipt](../../schemas/ip/v0.1/examples/registration-outcome.json). The original receipt accurately recorded the narrower evidence then available; **do not rewrite its `null` fields or receipt digest**. The new [supplemental receipt](../../schemas/ip/v0.1/examples/registration-primary-document-review.json) records the subsequent inspection of the supplied PDFs.

## Fields directly visible in the supplied documents

| Field | Inspected document evidence |
| --- | --- |
| Registration number | `2026691650` — certificate and notification |
| Program title | `Валидатор цепочек квитанций UU-AAP Core v0.1` — both |
| Registration date | `2026-10-14` — certificate and notification |
| Application received date | `2026-08-26` — certificate and notification |
| Application number on certificate | `2026691663` |
| Application number on notification/conclusion | `2026691663/69` |
| Decision date | **Not independently stated as a separate date; remains unknown** |

The shorter application number in the certificate and its `/69`-suffixed representation in the notice are transcribed distinctly rather than silently normalized. The document copies name an author and right holder, but this public supplement deliberately does **not** republish their names, addresses, personal identifiers or contact details.

## Privacy-safe evidence bindings

Exact SHA-256 of the privately retained **certificate PDF copy**:

`bf16ef27882c907f76cfd9e70da3e81dc137df8d7bd24c5ded1b35f095e00865`

Exact SHA-256 of the privately retained **two-page notice and conclusion PDF copy**:

`b53f42ba7e9251e6d3ca6e5891f157f4fe3c815af98f16cd41a14bb0c78d30f5`

These are digests of the copies presented for review, **not** the source-code deposit, the completed EPGU submission packet, or independently authenticated FIPS originals. Their private bytes are not committed. Public hashes may correlate copies if someone later obtains them, so do not treat these digests as a substitute for protecting the private originals.

## Evidence and non-effects

- The certificate and notice agree on the registration number, title and material dates.
- Visual PDF signature/certificate markings do not establish completed cryptographic signature validation. No independent live-register retrieval is asserted here.
- The prior frozen Git candidate is 15,144 bytes; **exact submitted program bytes are still unverified**.
- The difference between the applicant's intended `MATAWAKA` pseudonym publication and the legal-name publication reported in the public record remains **OPEN**; this supplement does not infer consent or authorize a registry correction.
- This is software registration, **not a patent** or registration of the entire UU-AAP architecture. Existing licenses and historic checkpoints do not change.
- No undocumented `READY_TO_FILE`, `FILED`, fee, consent, signature, or submission-packet facts have been reconstructed.

The separate [patent issue #492](https://github.com/Matawaka/uu-aap/issues/492) remains unaffected. Closing the deposited-byte gap requires the **actual submitted program materials and submission receipt**; a certificate cannot establish their exact bytes.
