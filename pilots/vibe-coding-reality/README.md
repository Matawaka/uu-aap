# Pilot 001 — «Вайбкодинг реальности»

**UU-AAP profile:** T — Traceable  
**Pilot ID:** UU-BOOK-000001  
**Manifest:** [`manifest.json`](manifest.json)  
**Public provenance date:** 2026-08-22

This is the first real-work pilot of UU-AAP.

The purpose of the pilot is not to present the book as “certified”. It is to test whether UU-AAP can describe a long-form work that was materially developed through human–AI collaboration without reducing authorship to token counts or hiding uncertainty.

## Why profile T

The available project archive contains the complete master manuscript in two parts:

- chapters 1–13;
- chapters 14–22 and the epilogue.

The completed structure is **10 parts, 22 chapters and an epilogue**.

A canonical public PDF or EPUB file has not yet been selected and cryptographically bound to this manifest. Therefore this record intentionally remains **UU-AAP/T**, not V.

`artifact_sha256` is `null` by design.

When a canonical ebook artifact is selected, a successor manifest may move the work to profile V by adding:

1. the exact artifact SHA-256;
2. a signature or Content Credential;
3. a transparency record tied to that artifact;
4. version lineage back to this pilot manifest.

## Accountability model

The pilot publicly identifies **Matawaka** as the accountable human identity for the purposes of this repository.

The manifest records accepted human responsibility for:

- intent governance;
- concept selection;
- structure approval;
- editorial approval;
- publication authorization.

It records limited or unknown responsibility where the evidence does not justify a stronger claim:

- source selection — limited;
- factual verification — limited;
- legal compliance — unknown;
- technical artifact binding — deferred for profile T.

This is deliberate. A provenance record should be able to say **unknown** or **limited** rather than manufacture certainty.

## AI participation

The work used an **OpenAI ChatGPT-assisted “Усиленный Ум” workflow** across multiple sessions.

AI participation is declared as substantial in:

- concept development;
- research assistance;
- structure;
- drafting;
- editing.

Exact model/version continuity was not preserved for every historical session, so the manifest does not invent it.

## Concept lineage

The first pilot records lineage for several concepts central to the manuscript:

- «Вайбкодинг реальности»;
- «Усиленный Ум»;
- «Принцип неаннигиляции»;
- «Политика обратимых версий реальности»;
- «Мир, который может передумать».

The record distinguishes `human_originated` from `co_developed` instead of treating all AI-assisted concepts as one category.

## Evidence and privacy

The underlying master manuscripts and historical human–AI conversations are not published automatically.

UU-AAP/T allows selective disclosure. The public manifest therefore records evidence categories and availability without exposing complete private prompt histories.

That limitation is part of the provenance record, not an exception hidden outside it.

## Contestability

Questions or challenges to this pilot can be raised through:

- [Discussion #8](https://github.com/Matawaka/uu-aap/discussions/8)
- [repository Issues](https://github.com/Matawaka/uu-aap/issues)

A formal independent appeal body does not yet exist, so the manifest states `appeal_available: false`.

## What this pilot tests

This example is meant to test whether the protocol can represent all of the following at once:

1. substantial AI participation;
2. meaningful human governing authority;
3. incomplete historical model metadata;
4. private evidence;
5. partial factual verification;
6. a completed manuscript without a canonical cryptographically bound ebook;
7. correction and future upgrade to a stronger profile.

That combination is intentional. A useful authorship protocol must work on imperfect real creative histories, not only on projects designed from day one for perfect provenance.
