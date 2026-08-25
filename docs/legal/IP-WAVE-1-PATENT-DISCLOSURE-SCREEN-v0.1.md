# IP Wave 1 — Patent / Public-Disclosure Screen v0.1

**Software-registration object:** «Валидатор цепочек квитанций UU-AAP Core v0.1»  
**Rights-cleared frontier:** `8aec7684a54e2570c285720a22d30d99f958131a`  
**Earliest known public disclosure:** `2026-08-24T19:01:17+05:00`  
**Separate technical patent track:** issue #492

## 1. Decision

Wave 1 may continue toward Russian state registration of one concrete program-for-computers expression without treating that filing as a patent application or a conclusion that all underlying UU-AAP technical mechanisms are non-patentable.

For this Wave 1 filing only:

- registration object = selected program expression and identifying materials;
- public-disclosure status = already public;
- patent effect of the software-registration filing = none;
- potentially patentable technical mechanisms = preserved for separate review in issue #492.

`software registration != patent filing`

`program expression != every underlying technical solution`

`resolved Wave 1 patent gate != waiver of separate patent review`

## 2. 2026 Russian legal frontier

Legal snapshot: 2026-08-25.

Federal Law No. 296-FZ was signed on 2026-08-04 and enters into force on 2027-01-01. Rospatent describes the amendments as changing the patent-law regime for programmable means / IT developments and clarifying which IT solutions may receive patent protection.

Therefore this screen does not use a blanket statement that software-related UU-AAP mechanisms can never be patent candidates.

Current Article 1350 of the Civil Code provides a twelve-month grace period for qualifying disclosure of invention information by the inventor/applicant or persons receiving the information from them, provided the application is filed within twelve months and the applicant proves the relevant circumstances.

The known Core disclosure on 2026-08-24 is therefore recorded for a separate Russian patent review. A date of 2027-08-24 is only the conservative outer date associated with that disclosure under the current Russian grace-period rule; it is not a guarantee of novelty, inventorship, technical character or patentability.

Foreign patent rights are not assumed to be preserved by the Russian grace period.

## 3. Scope separation

### Wave 1 software registration

Includes:

- `protocols/core/v0.1/validate-core.js` — program source;
- `protocols/core/v0.1/receipt-envelope.schema.json` — identifying schema;
- `protocols/core/v0.1/end-to-end.fixture.json` — conformance fixture.

Purpose: identify and register one rights-cleared program for computers.

### Separate patent track

Issue #492 must independently evaluate concrete technical mechanisms, including novelty, inventive step, industrial applicability, technical character, inventorship and disclosure history.

Nothing in Wave 1 represents that a patent application has been filed, rejected, abandoned or granted.

## 4. Public-disclosure finding

The selected Core surface was publicly merged in PR #320 at:

`2026-08-24T19:01:17+05:00`

Origin merge:

`fd3a3fa7e84c11a80d2af5ff389fe10979720ef9`

The selected source remained content-identical through the rights-cleared frontier used for deposit freeze.

The correct public-disclosure treatment for Wave 1 is therefore **ALREADY_PUBLIC**, not a fictional pre-publication gate.

## 5. Rospatent deposit requirements used by the freeze

Under the current program-registration rules, the application must concern one program and the deposited materials must identify it. Program-identifying materials may be the full source text or sufficient fragments. The abstract must state the program title, purpose, field of use and functionality, and end with the programming language and machine-readable volume; it must not exceed 900 characters.

Wave 1 therefore records separately:

- program source size;
- identifying/support-material size;
- total frozen surface size;
- SHA-256 for every selected file;
- Git blob SHA-1 as an additional repository identity;
- a canonical SHA-256 package inventory digest;
- one exact Russian title and abstract.

## 6. Freeze semantics

The deposit package is content-frozen by exact file identities, not merely by a moving branch name.

Canonical inventory digest format:

`UU-AAP-DEPOSIT-INVENTORY-v0.1`

For each selected file in lexicographic path order, the digest binds:

`path NUL role NUL size NUL sha256 LF`

The package digest is SHA-256 over that canonical byte sequence.

This avoids dependence on ZIP timestamps, filesystem metadata or archive-tool versions.

## 7. Non-effects

This screen does not:

- grant or waive patent rights;
- determine patentability of any UU-AAP technical mechanism;
- claim foreign grace periods;
- change authorship or exclusive-right ownership already reviewed in Wave 1;
- file anything with Rospatent;
- make `FILED` true;
- make the public Git repository the storage location for private applicant data.
