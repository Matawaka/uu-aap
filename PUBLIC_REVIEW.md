# Public Review — UU-AAP v0.1

**Opening:** 22 August 2026  
**First disposition cutoff:** 6 October 2026

This is a Request for Comment, not a request for endorsement.

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
- a dispute case the current model cannot represent.

## How to submit

Prefer one GitHub Issue per concrete problem. Use Discussions for broader philosophy, use cases and design alternatives.

For a normative change, include:

1. affected clause or object;
2. failure case;
3. impact;
4. proposed change, if possible;
5. compatibility impact;
6. privacy/security impact;
7. competing view, if known.

## Review rules

- Criticism of the draft is welcome.
- Criticism of people for using or not using AI is not relevant to conformance.
- “I dislike AI” and “AI should replace authors” are positions, not protocol failure cases unless translated into a concrete design requirement.
- The initial editor does not receive a permanent veto.
- Significant rejected proposals SHOULD receive a public disposition rationale.
- Unresolved minority objections MAY be preserved in the record.

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

## Expected output of the review

Before v0.2, editors SHOULD publish:

- an issue disposition table;
- accepted/rejected/deferred changes with reasons;
- unresolved objections;
- v0.2 breaking changes;
- migration notes from v0.1;
- updated threat model.
