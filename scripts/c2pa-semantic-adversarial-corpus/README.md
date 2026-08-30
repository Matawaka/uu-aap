# P0.7 Semantic-Adversarial C2PA Corpus v0.1

Status: **executable application-semantics interoperability evidence for #792**. It is not C2PA conformance, not a parser-security suite, not UU-AAP Core, and not a trust/reputation score.

Canonical predecessor:

`5e174d9de2b7978e8e612b3f70b49afdaf5ceb3c`

Predecessor semantics remain unchanged:

- #779 / Semantic Boundary Rubric v0.1;
- #786 / evidence-informed C2PA 2.4 × UU-AAP profile;
- #791 / SDK preservation successor re-audit.

## Question

P0.7 asks a deliberately different question from C2PA cryptographic validation:

> Can a consumer receive currently valid provenance evidence and still draw an unsafe stronger conclusion that the provenance layer does not establish?

The required composition is:

```text
fresh C2PA-bearing test asset
        ↓
official C2PA validation
        ↓
Valid / Trusted provenance state
        ↓
consumer interpretation overlay
        ↓
UU-AAP semantic-boundary evaluation
        ↓
safe PASS or unsafe REJECT
```

A C2PA-valid asset is allowed to coexist with a failed semantic interpretation. That is the target observation, not a contradiction.

## External tooling anchors

`tooling-baseline.json` pins exact public upstream frontiers.

### `contentauth/c2pagen`

Pinned SHA:

`23c2d4c317bbbb5b049c11cc6d8e85a4729704df`

The upstream project describes itself as a CLI for bulk generation of reproducible C2PA assets for testing and benchmarking. The first live P0.7 base uses only the bounded `small-png` preset.

The tool's embedded Ed25519 certificate chain is explicitly marked `FOR TESTING_ONLY`. The leaf validity extends through August 2030. P0.7 therefore accepts only the already-established development/test distinction:

```text
cryptographically Valid != production Trusted identity
```

The live workflow never promotes the test signer into UU-AAP authorship, authority or responsibility.

### `contentauth/c2pa-attacks`

Pinned SHA:

`4f750daa888d2ff93a1659fc016be584dc43ae5c`

Its upstream documentation describes an injection/parser-security framework and explicitly notes that the tool does not automatically determine whether an attack succeeded.

P0.7 preserves the distinction:

```text
parser/security attack != semantic overclaim attack
```

The first P0.7 increment pins and verifies that boundary but does not execute an XSS/injection attack. A future parser/UI security composition can do so separately if it produces a distinct useful claim.

## Five semantic adversarial cases

`corpus-v0.1.json` contains paired unsafe and safe consumer interpretations.

### 1. Signer display `Author` -> authorship

Unsafe:

```text
C2PA signer display = Author
-> UU-AAP author
```

Expected rejection: `I1_SIGNER_NOT_GOVERNANCE`.

Safe: signer provenance remains visible, while authorship is supported separately by a UU-AAP authorship attestation.

### 2. Human-validated AI disclosure -> responsibility

Unsafe:

```text
C2PA AI disclosure: human_validated
-> responsible actor
```

Expected rejection: `I4_AI_DISCLOSURE_NOT_AUTHORITY`.

Safe: AI disclosure remains process evidence; scoped responsibility is independently declared.

### 3. Ingredient title `Original Concept` -> concept origin

Unsafe:

```text
C2PA ingredient title = Original Concept
-> UU-AAP concept origin
```

Expected rejection: `I3_INGREDIENT_NOT_CONCEPT_ORIGIN`.

Safe: artifact genealogy and intellectual genealogy remain separate.

### 4. Action text `approved` -> publication authority

The historical P0.1 rule `I2_ACTION_NOT_DECISION` correctly addresses action -> decision, but does not directly target publication authorization.

P0.7 therefore adds **one local additive rule**:

`P07_ACTION_NOT_PUBLICATION_AUTHORITY`

It does not modify `scripts/c2pa-semantic-boundary/rubric-v0.1.json`.

Unsafe:

```text
C2PA action/display = approved
-> UU-AAP publication authorization
```

Safe: action provenance remains visible; publication authorization is independently scoped.

### 5. Trusted repository/integrity -> `Verified True`

Unsafe:

```text
repository receipt + valid integrity
-> epistemic truth / Verified True
```

Expected rejections:

- `I5_RECEIPT_NOT_TRUTH_REVIEW_AUTHORIZATION`;
- `I6_INTEGRITY_NOT_TRUTH`.

Safe: repository presence and integrity remain separate from factual verification.

## Historical rubric preservation

The original P0.1 rubric is not edited. CI binds its exact Git blob:

`f6eec3dfe3c3973245991210755fbac74e667396`

`validate-corpus.js` composes that frozen rubric with `supplemental-rules-v0.1.json` at evaluation time.

This creates an explicit successor rule instead of silently expanding the historical meaning of P0.1.

## Deterministic corpus

Run:

```bash
node scripts/c2pa-semantic-adversarial-corpus/validate-corpus.js
node scripts/c2pa-semantic-adversarial-corpus/test-corpus.js
```

Acceptance requires:

- exactly five corpus cases;
- every unsafe interpretation produces exactly its expected invariant finding(s);
- every safe paired interpretation passes;
- semantic evaluation never claims C2PA conformance;
- no aggregate trust/compatibility/confidence score;
- all non-effects remain false.

## Live C2PA base

The live workflow:

1. checks out exact `c2pagen` source;
2. verifies pinned source/file identities;
3. builds the pinned generator;
4. generates only `small-png` into `/tmp`;
5. validates `small-png-signed.png` with pinned official `c2patool v0.27.16`;
6. requires a current `Valid` or `Trusted` state under the existing P0.1 validation helper;
7. only then evaluates all five semantic adversarial cases.

The semantic layer cannot make a failed C2PA asset acceptable and cannot mutate the C2PA validation result.

## Non-effects

P0.7 does not:

- modify `protocols/core/**`;
- redefine C2PA conformance;
- register a UU-AAP C2PA namespace;
- convert signer identity into authorship;
- convert AI disclosure into responsibility;
- convert ingredient names into concept origin;
- convert action text into publication authority;
- convert cryptographic integrity or repository presence into factual truth;
- establish decision-time availability;
- execute a parser/XSS attack;
- create a scalar trust/reputation/compatibility score.

## Next gate

After an accepted P0.7 successor, the next distinct interoperability experiment is P0.8:

```text
soft-binding / present-day resolvability
!=
PoAI historical decision-time availability
```

SDK preservation successor re-audit (#791) remains independently rerunnable and is not folded into this corpus.
