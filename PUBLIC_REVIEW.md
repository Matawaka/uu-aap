# Public Review — UU-AAP v0.1

**[Русский быстрый маршрут / Russian quick path](PUBLIC_REVIEW.ru.md)**

**Opening:** 22 August 2026  
**First disposition cutoff:** 6 October 2026

This is a Request for Comment, not a request for endorsement.

## Live review channels

- **Core Pilot 002 — one concrete external review:** [Issue #422 — External Review Entry](https://github.com/Matawaka/uu-aap/issues/422)
- **Russian quick review path:** [PUBLIC_REVIEW.ru.md](PUBLIC_REVIEW.ru.md)
- **Broad design discussion:** [Discussion #8 — What should accountable AI-augmented authorship mean?](https://github.com/Matawaka/uu-aap/discussions/8)
- **Main RFC:** [Issue #1 — UU-AAP v0.1 Public Review](https://github.com/Matawaka/uu-aap/issues/1)
- **Concrete defects and change proposals:** [Repository Issues](https://github.com/Matawaka/uu-aap/issues)

### Fastest useful contribution

If you have only a few minutes, use [Core Pilot 002 Issue #422](https://github.com/Matawaka/uu-aap/issues/422) and post **one concrete failure case or counterexample**. You do not need to read the entire repository, propose code, prove your identity, or endorse the project.

A short review can be as little as:

1. what could go wrong;
2. why it matters;
3. where you think the problem is, if known;
4. an optional fix or competing interpretation.

The project-authored invitation text is not itself external review evidence. A submission from another account may become eligible input for Core Pilot 002 only after the fail-closed Run Admission Gate checks it.

`public comment != verified identity != authority != standing != accepted claim`

Please do not publish secrets, private credentials, personal contact details, private prompts, or evidence you do not want public.

## First real-work test

The public draft includes **Pilot 001 — «Вайбкодинг реальности»**, a UU-AAP/T manifest for a completed long-form work developed through substantial human–AI collaboration.

- [Pilot overview](pilots/vibe-coding-reality/README.md)
- [Manifest JSON](pilots/vibe-coding-reality/manifest.json)
- [Evidence and limitations](pilots/vibe-coding-reality/EVIDENCE.md)

Reviewers are encouraged to test the protocol against the pilot rather than only against the abstract schema. In particular: does the pilot disclose enough to be useful, does it overclaim human control anywhere, and are the `limited`, `unknown` and private-evidence states represented fairly?

## Core Pilot 002 — review the review process itself

Core Pilot 002 tests whether the reusable core can process one real external review without collapsing submission, identity, authority, interpretation, disposition and implementation into one event.

- [Pilot 002 protocol](pilots/core-pilot-002/README.md)
- [Russian Pilot 002 guide](pilots/core-pilot-002/README.ru.md)
- [Run Admission Gate](pilots/core-pilot-002/run-admission/README.md)
- [External Review Entry — Issue #422](https://github.com/Matawaka/uu-aap/issues/422)

Core Pilot 002 **Run 001 is completed**. A public #422 submission was first preserved as an observation, then admitted through a separate project selection gate, reproduced against the exact current manifest schema, and dispositioned `accept_for_followup`. The machine-readable result is preserved under `pilots/core-pilot-002/run-001/result/v0.1/`.

The run confirmed a narrow responsibility-status declaration-provenance gap while preserving the existing declaration/attestation mitigation. The follow-up was implemented additively as optional **Responsibility Status Provenance Binding v0.1** (Stage B) and optional **UU-AAP/RA1** responsibility-assurance overlay (Stage C). Historical v0.1 manifests were not silently reinterpreted.

The source account was not promoted by the run into verified human identity, independence, expertise, standing or authority, and the submitted claim was not accepted as truth merely because it was admitted or reproduced.

`one completed external-source run != external validation or certification`

`accept_for_followup != normative truth`

`RA1 != identity != authority != liability`

The project will not manufacture a reviewer or promote a synthetic fixture to real external evidence merely to make later review gates pass. Additional external participation remains welcome, and the broader Public Review #1–#7 remains open.

If a submission is admitted, the source evidence remains distinct from the project's interpretation and disposition. A disposition does not erase an objection and does not itself edit the protocol, close an issue, publish a release, or establish truth, fault or liability.

## What the project asks reviewers to do

Try to break the protocol.

Useful criticism includes:

- a realistic scenario where responsibility is assigned falsely or unfairly;
- a privacy or coercion risk;
- a claim that cannot be verified as described;
- a field that is impossible for ordinary authors to maintain;
- a C2PA/W3C interoperability problem;
- accessibility or internationalization issues;
- a governance mechanism that gives one party too much power;
- a dispute case the current model cannot represent;
- a review workflow that could erase dissent, over-infer identity/authority, over-disclose information, or turn a disposition into an automatic normative effect.

## How to submit

For the lowest-friction Pilot 002 path, comment on [Issue #422](https://github.com/Matawaka/uu-aap/issues/422) or open a new issue using the **Core Pilot 002 external review** template.

Use [Discussion #8](https://github.com/Matawaka/uu-aap/discussions/8) for broad philosophy, use cases, countermodels and open-ended design alternatives.

Prefer one GitHub Issue per concrete protocol problem or normative change.

For a normative change, include when practical:

1. affected clause or object;
2. failure case;
3. impact;
4. proposed change, if possible;
5. compatibility impact;
6. privacy/security impact;
7. competing view, if known.

These fields are guidance, not a completeness test for whether criticism is worth reading.

## Review rules

- Criticism of the draft is welcome.
- Criticism of people for using or not using AI is not relevant to conformance.
- “I dislike AI” and “AI should replace authors” are positions, not protocol failure cases unless translated into a concrete design requirement.
- The initial editor does not receive a permanent veto.
- Significant rejected proposals SHOULD receive a public disposition rationale.
- Unresolved minority objections MAY be preserved in the record.
- A GitHub account identifier MUST NOT be upgraded by the review process into verified legal identity, expertise, authority or standing without separate evidence.
- A review disposition MUST NOT silently erase the original objection or become a normative change without a separate action gate.

## Priority questions

1. Does the responsibility matrix reflect real publishing workflows?
2. Is human governing authority defined too strongly or too weakly?
3. Is `concept lineage` core protocol material or an extension?
4. Is `epistemic_status` useful or too burdensome?
5. What minimum evidence should profile V require?
6. How should private prompts be handled in audits?
7. How should multiple human authors divide authority?
8. Should reviewer attestations use W3C Verifiable Credentials?
9. What should a C2PA assertion mapping contain?
10. What dispute/appeal object is missing?
11. What would make the protocol coercive in workplaces or education?
12. Which fields would prevent adoption by independent authors?
13. Does Pilot 001 demonstrate meaningful human governance without overstating what the available evidence can prove?
14. Can Pilot 002 receive, interpret and disposition criticism without inferring reviewer identity/authority, erasing disagreement, or producing an automatic protocol effect?

## Expected output of the review

Before v0.2, editors SHOULD publish:

- an issue disposition table;
- accepted/rejected/deferred changes with reasons;
- unresolved objections;
- v0.2 breaking changes;
- migration notes from v0.1;
- updated threat model.
