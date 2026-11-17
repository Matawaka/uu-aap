# Rospatent software registration 2026691650

Recorded: **2026-11-17**  
Observed outcome: **REGISTERED — applicant-reported**  
Object: **UU-AAP Core v0.1 Receipt Chain Validator**

## Registration record and evidence boundary

The applicant supplied a registration review confirming that Rospatent issued
software registration **2026691650** for this program. The review reports that
the certificate and public register identify the program and a source volume of
**15,144 bytes**. This repository records that reported external outcome.

[Official FIPS record lookup](https://www1.fips.ru/registers-doc-view/fips_servlet?DB=EVM&DocNumber=2026691650&TypeFile=html)
uses the reported registration number. The recording session could not retrieve
the registry page. The link is a lookup reference, not a claim that an
independent registry verification succeeded. The registration date, decision
date, application number and filing date were not supplied in the review and
remain `null`; the recording date above is not an official registration date.
No certificate image or private submission artifact was inspected or hashed in
this change.

The [machine-readable outcome](../../schemas/ip/v0.1/examples/registration-outcome.json)
is a typed receipt in the existing
[IP registration protocol](IP-RIGHTS-REGISTRATION-PROTOCOL-v0.1.md#13-receipts).
It references the same software object, the
[historical registration plan](../../schemas/ip/v0.1/examples/uu-aap-core-registration-plan.json),
the frozen manifest and the applicant decision checkpoint.

## Reconciliation with the historical state

The last public preparation record remains `PATENT_SCREEN`, with its private
packet incomplete in the public evidence. The outcome receipt records
`REGISTERED` as an externally reported successor outcome. It does not manufacture
`READY_TO_FILE`, `FILED`, consents, signature confirmation, fee payment, submission
dates or private packet hashes for the intervening period.

This is an external-outcome reconciliation, not a newly authorized filing and
not an assertion that the historical filing-readiness gates were completed.
The [Wave 1 preparation document](ROSPATENT-WAVE-1-v0.1.md) and its machine plan
remain historical snapshots. Current outcome readers should use this document
and its linked receipt. The existing registration-plan schema and validator
retain their original fail-closed requirements.

## Link to the frozen program

The [existing deposit manifest](../../schemas/ip/v0.1/examples/uu-aap-core-deposit-freeze.json)
identifies the candidate registered version:

| Property | Frozen repository evidence |
| --- | --- |
| English identifier | UU-AAP Core v0.1 Receipt Chain Validator |
| Prepared Russian filing title | Валидатор цепочек квитанций UU-AAP Core v0.1 |
| Freeze commit | `8aec7684a54e2570c285720a22d30d99f958131a` |
| Program source | `protocols/core/v0.1/validate-core.js` |
| Source bytes | 15144 |
| Source SHA-256 | `4315bc0661698de4946a0f24478c8f98dcdfadca7289178a04e436232acd5fd7` |
| Frozen inventory digest | `sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8` |

[Immutable source at the freeze commit](https://github.com/Matawaka/uu-aap/blob/8aec7684a54e2570c285720a22d30d99f958131a/protocols/core/v0.1/validate-core.js).

CI recomputes all three frozen Git blobs, byte sizes and hashes, as well as the
existing inventory digest. It binds repository evidence to that historical
commit, without depending on platform line-ending conversion or future Core
changes.

The reported object identity and byte volume are consistent with the prepared
package. **Exact equality of the deposited bytes and the frozen Git version
remains NOT_VERIFIED.** The manifest digest identifies the prepared repository
inventory; it is not asserted to be the digest of an actual submitted archive.
A byte count or matching technical description alone cannot establish byte
identity.

To close this gap, privately retain the actual submitted materials and portal
receipt, hash their exact bytes, and compare the extracted program and supporting
files with the frozen manifest. Add a successor verification receipt with
privacy-safe digests and comparison results. Do not overwrite this observation
or publish personal documents to close the gap.

## Author publication discrepancy

The [original applicant decision](IP-WAVE-1-APPLICANT-DECISION-GATE-v0.1.md)
and [machine checkpoint](../../schemas/ip/v0.1/examples/uu-aap-core-applicant-decision-checkpoint.json)
selected `PSEUDONYM` with public pseudonym `MATAWAKA`.
The supplied review reports that the issued certificate and public registry
instead publish the legal name.

This is an **OPEN discrepancy between intended publication and reported
outcome**. The original decision is preserved. This receipt does not infer why
the difference occurred, treat publication as new consent, or submit a correction
request. The legal name is not repeated in the new outcome record. Any desired
change to registry fields requires a separate inquiry and applicant decision.

## Scope, licensing and patent work

The recorded object is the concrete Wave 1 program expression, with the schema
and fixture serving as identifying/support material. It does not register the
abstract UU-AAP architecture, unrelated implementations, KONTUR, PoAI or future
applications. Registration is not treated as a conclusive authorship or
exclusive-ownership adjudication.

The [existing licensing map](../../LICENSE.md) continues to apply: software is
Apache-2.0 and non-software content is CC BY 4.0, subject to existing overrides.
Registration creates no additional permission requirement for licensed reuse.
Historical tags and release anchors remain preserved.

[Patent review issue #492](https://github.com/Matawaka/uu-aap/issues/492) remains
a separate track. This software registration is not a patent grant and does not
close that issue.

## Validation and next checkpoint

The read-only registration-outcome CI checks the closed JSON contract,
cross-record references, frozen Git bytes, local Markdown link targets and
bounded disclosure controls. Offline checks verify the structure of official
and immutable GitHub links; they do not certify remote availability, registry
contents, document authenticity or the absence of every possible sensitive datum.
New legal text is restricted to an approved public digest, and the receipt's
closed schema admits no personal-identity fields or document attachments.

After a successful squash merge, verify the receipt and checks on `main` and
retain the resulting commit SHA as the next repository checkpoint. That future
SHA cannot be embedded in its own commit. Verification of deposited bytes remains
a separate open evidence task.
