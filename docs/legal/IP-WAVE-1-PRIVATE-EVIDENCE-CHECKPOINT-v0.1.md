# IP Wave 1 — Private Evidence Checkpoint v0.1

**Status:** AWAITING_PRIVATE_DECLARATION  
**Object:** UU-AAP Core v0.1 Receipt Chain Validator  
**Public frontier after #489:** `f72efcafb0376d99c7b9645ada33158bba619d7e`

## 1. Purpose

This checkpoint converts the unresolved authorship/rights gate into a short private factual declaration while keeping sensitive evidence outside the public repository.

The public repository stores only:

- the selected IP object ID;
- the public Git frontier;
- non-sensitive categorical answers after review;
- the classification result;
- the SHA-256 digest of the completed private declaration;
- unresolved items and successor-state linkage.

The completed declaration itself, supporting contracts, signatures, addresses, private working notes and any sensitive prompt/work history remain outside GitHub.

`private evidence retained != private evidence published`

`digest binding != truth certification`

`declaration != automatic ownership`

## 2. Selected Wave 1 scope

Executable:

- `protocols/core/v0.1/validate-core.js`

Identifying/support material:

- `protocols/core/v0.1/receipt-envelope.schema.json`
- `protocols/core/v0.1/end-to-end.fixture.json`

The declaration must answer only for this selected scope, not for the entire repository or every future UU-AAP application.

## 3. Private declaration questions

Use `docs/legal/AUTHOR-RIGHTS-DECLARATION-TEMPLATE-v0.1.md` as the full private form. For the Wave 1 gate, the following ten factual questions are sufficient to classify the next protocol state.

1. **Human architecture choices** — Did a natural person make the substantive architecture/design choices embodied in this selected Core validator?
2. **Human source expression** — Did a natural person personally write protected source-code expression in the selected scope, in whole or in part?
3. **Generative AI use** — Was generative AI used to produce source code or other expressive material in the selected scope?
4. **AI-generated expression scope** — If yes, was the generated expression none / partial / substantial / effectively full relative to the selected filing scope?
5. **Human material transformation** — Did a natural person materially select, rewrite, restructure, correct or integrate generated/other material through creative choices?
6. **Other human creative contributors** — Did any other natural person contribute potentially copyright-relevant creative expression to the selected scope?
7. **Employment duties** — Was the selected protected expression created within established employment duties or a specific employer task covering this software?
8. **Commission/customer contract** — Does any commission, development, consulting or customer contract affect ownership of the selected protected expression?
9. **Assignment** — Does any exclusive-right assignment affect the selected scope?
10. **Third-party expression** — Is protected third-party expression copied/adapted/incorporated into the selected filing scope, beyond ordinary external/runtime platform dependencies?

If any answer is genuinely unknown, record `UNKNOWN`; do not convert uncertainty into a favorable assumption.

## 4. Classification rules

### HUMAN_AUTHORED

Candidate only when the private evidence supports meaningful natural-person creation of the protected source expression and no unresolved rights allocation blocks remain.

### AI_ASSISTED_HUMAN_CREATION

Candidate when generative AI was used but the private evidence supports substantive human creative contribution to the resulting protected expression through choices such as material rewriting, restructuring, correction, integration or other non-mechanical transformation.

This is not a percentage-of-lines test.

### AUTHORSHIP_CLAIM_NARROWING_REQUIRED

Use when some selected expression has supportable human authorship/rights evidence while other portions remain uncertain. The filing/deposit scope may then be narrowed without falsifying the technical identity of the program.

### NO_HUMAN_AUTHORSHIP_ESTABLISHED

Use when available evidence does not support a natural-person creative contribution to protected expression in the selected scope.

### BLOCKED

Use where employment, customer, assignment, coauthor or third-party rights uncertainty prevents a truthful exclusive-right claim.

## 5. Gate semantics

The public machine record is:

`schemas/ip/v0.1/examples/uu-aap-core-private-evidence-checkpoint.json`

Until a completed private declaration is retained and hashed, the required result is:

`UNRESOLVED -> KEEP_RIGHTS_REVIEW`

`MAY_ADVANCE_TO_RIGHTS_CLEARED` is permitted only when all of the following are true:

- private declaration status is `COMPLETED`;
- a valid SHA-256 digest binds the retained private artifact;
- human-authorship/AI-assisted classification is resolved or the claim is defensibly narrowed;
- no answer required for rights allocation remains `UNKNOWN`;
- other human creative contributors are resolved;
- employment/commission/assignment issues are resolved;
- third-party incorporated expression is cleared or excluded.

The CI must reject an advance result when those conditions are not met.

## 6. Private artifact retention

Recommended private artifact name:

`UU-AAP-Core-v0.1-Author-Rights-Declaration-<date>.pdf` or equivalent signed/attested immutable file.

After completion:

1. retain the artifact outside the public repository;
2. compute SHA-256 over the exact retained bytes;
3. record only `sha256:<64 lowercase hex>` in the public checkpoint;
4. optionally retain a private storage reference that does not expose credentials or sensitive path details;
5. never replace the private artifact without creating a successor checkpoint and a new digest.

## 7. Next transition

Current:

`RIGHTS_REVIEW`

After this checkpoint is completed and classified:

- clean human/AI-assisted rights evidence -> candidate `RIGHTS_CLEARED`;
- partial evidence -> narrow filing claim/deposit and repeat checkpoint;
- rights conflict -> remain `RIGHTS_REVIEW` or `BLOCKED`;
- no supportable human authorship -> do not name a natural person as author merely to satisfy a filing form.

Only after rights clearance should Wave 1 freeze the actual deposit checkpoint, calculate final source/package hashes, language list, size and final Rospatent abstract.

## 8. Non-effects

This checkpoint does not:

- publish private evidence;
- declare a person to be the legal author before evidence exists;
- decide a disputed employment/customer ownership question;
- transfer exclusive rights;
- guarantee registrability;
- file an application;
- freeze the deposit while the rights gate remains unresolved.
