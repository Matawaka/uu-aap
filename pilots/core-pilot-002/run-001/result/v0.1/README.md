# Core Pilot 002 — Run 001 machine-readable result v0.1

This directory completes the first admitted real-source review run without turning a review disposition into a normative protocol change.

## Exact predecessor and source

Accepted predecessor:

`b7178fe9f36e7be0954e97564e82361215e68220`

Run 001 admission:

`pilots/core-pilot-002/run-001/admission/v0.1/admission.json`

Admitted public source:

`https://github.com/Matawaka/uu-aap/issues/422#issuecomment-5471862585`

Body SHA-256:

`23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8`

The source-account label, app mediation, public repository and admitted source binding are evidence about the submission path only. They do not establish verified human identity, independence, standing, expertise, authority, truth, fault or liability.

## Reproduced counterexample

`counterexample.manifest.json` contains two synthetic actors, Alice and Bob. The manifest records Alice with:

```json
{
  "actor_id": "actor:alice",
  "scope": "factual_verification",
  "status": "accepted",
  "limitations": null
}
```

The exact current v0.1 manifest schema accepts this fixture. The closed responsibility-item schema requires only `actor_id`, `scope` and `status`; `limitations` is the only optional field. It has no field for the declarant of the status, an attributable acceptance event, or an acceptance-evidence reference. Adding any of those fields directly to the responsibility item is rejected because `additionalProperties=false`.

Therefore the current machine entry alone cannot distinguish:

`manifest declares Alice accepted`

from

`Alice's acceptance is separately attributable / attested`.

## Existing mitigation matters

The admitted comment's strongest possible interpretation would be too broad. Current SPEC §22 already recommends displaying:

`Responsibility: scoped declarations present`

and:

`Claims: self-declared unless individually attested`.

`RESPONSIBILITY.md` also explicitly states:

`responsibility requires explicit attributable action`.

So Run 001 does **not** conclude that UU-AAP currently treats every `accepted` value as proven consent. It concludes that the machine representation does not preserve the provenance of the responsibility-status declaration inside the responsibility entry, while current display guidance partially mitigates the risk of overinterpretation.

## Machine-readable disposition

`review-case.json` uses the already accepted Core Pilot 002 review-case contract.

`result.json` adds the exact reproduction/evidence binding and records:

```text
REPRESENTATION_PROVENANCE_GAP_CONFIRMED_WITH_EXISTING_DISPLAY_MITIGATION

disposition = accept_for_followup
next gate   = HUMAN_NORMATIVE_DESIGN_DECISION_REQUIRED
```

The disposition means only that the concern merits a separate design decision. It does not authorize a Core/SPEC/schema patch.

## Candidate successor classes — not selected here

The machine result preserves three broad repair classes without choosing among them:

1. verifier-only clarification of declaration vs attributable acceptance;
2. optional declarant / acceptance-event / evidence binding in a successor representation;
3. attributable acceptance evidence required only for a stronger profile or stronger responsibility claim.

Choosing among these affects normative semantics and compatibility and therefore remains a separate human decision.

## Non-effects

This run does not contact the reviewer, mutate the source comment, resolve identity, create a reviewer reputation score, modify Core/SPEC/RESPONSIBILITY/schema, assign liability, create a release/tag, authorize publication, create an ActionPermit, or reactivate Workbench.

`admission != truth`

`disposition != normative change`

`representation gap confirmed != repair selected`
