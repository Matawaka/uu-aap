# External Review Request — draft, not sent

**Date:** 2026-11-04  
**Status:** communication draft. No maintainer or reviewer has been contacted by this file.

## Suggested technical request (English)

**Subject:** Feedback on C2PA external-reference + independent UU-AAP decision-authority evidence

Hello,

We maintain UU-AAP, an independent open proposal for accountable human–AI authorship and decision provenance. We are exploring a narrow application-level composition with C2PA 2.4, *not* a new C2PA namespace or a change to C2PA validation.

Our minimal example uses a standard gathered, hashed `c2pa.external-reference` on a signed asset to bind the exact bytes of an external UU-AAP record. A separate consumer rubric intentionally refuses the inference that a valid C2PA signer is thereby the author, approver, or publication authority. This keeps C2PA provenance distinct from decision-time evidence and scoped responsibility.

Could you give **one specific technical counterexample** or independently reproduce the bounded case? In particular, are there SDK/report representations, gathered-vs-created handling, or external-resource validation limitations we have overlooked?

Brief: [public draft PR to be linked after approval]. Replay guide: [public draft PR to be linked after approval]. Canonical repository: https://github.com/Matawaka/uu-aap . Base interop fixture: https://github.com/Matawaka/uu-aap/tree/main/scripts/c2pa-external-reference .

We do not claim C2PA conformance, endorsement, portable cross-SDK PASS, trusted issuer identity, or that provenance proves truth or action authority. Any review result remains reviewer-owned evidence.

Thank you.

## Outreach gate

Send or post only after the brief and referenced replay package have been reviewed for accuracy; replace placeholders with exact permanent links. Do not tag or solicit named upstream participants automatically. Use the most relevant existing discussion/channel and follow its contribution policy; do not file a normative spec defect merely to advertise a separate protocol. Public sharing, reviewer participation and later normative proposal are separate decisions.