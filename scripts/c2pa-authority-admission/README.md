# C2PA Authority-Admission Consistency Gate v0.1

Status: **additive executable interoperability evidence for #889; not C2PA conformance, not UU-AAP Stable Core, and not a trust/reputation score**.

Coordination:

- #4 — broader C2PA 2.4 mapping review;
- #778 — executable C2PA interoperability workstream;
- #777 — historical semantic-boundary draft; this gate does not reopen or rewrite it.

## Why this gate exists

A real external transparency/witness implementation disclosed a visible signer/root mismatch in `c2pa-org/specifications#122`: an exported `witness_keys.json` surface included a key whose authority was not carried by the current signed `trust-root.json` v2, and the resulting cosignature was to be treated as unverifiable until a successor signed root admits that key.

Initial motivating observation:

https://github.com/c2pa-org/specifications/issues/122#issuecomment-5544351466

Follow-up correction:

https://github.com/c2pa-org/specifications/issues/122#issuecomment-5546329622

The correction is important. The monitor's actual quorum configuration had already excluded that key deliberately: seven witnesses were pinned, and the additional key carried no quorum weight pending a v3 manifest. The missing control was **explainability/observability across exported evidence surfaces**: nothing compared the shipped `witness_keys.json` against the adjacent `trust-root.json`, so an outside verifier could see a mismatch without an attached explanation.

The operator reports that an export audit now compares those surfaces every three hours, in both directions, and prints the delta whether or not it alerts. The authority gap itself remains open until a v3 manifest is signed with the required offline key; until then, the cosignature remains classified there as unverifiable.

Therefore this external evidence is **not evidence of a runtime quorum-admission bug**. It is evidence of a missing observable consistency receipt between a published signer surface and the governing signed root, despite the internal quorum configuration already being conservative.

The executable fixtures in this directory remain synthetic and deliberately stronger than that external observation. In particular, `hostile-drift.json` tests the hypothetical case `8 configured / 7 admitted` so that even a cryptographically `VALID` but unadmitted signer cannot become a fourth quorum vote. That fixture must not be read as a factual reproduction of the external monitor configuration.

## Boundary

This gate starts **after cryptographic verification**.

Input signatures carry normalized states:

```text
VALID
INVALID
UNVERIFIED
```

The trust-root input must likewise arrive from an earlier verification boundary with:

```text
verification_status = VALID
document_sha256 = exact lowercase SHA-256 of the verified root document
```

Anything else fails closed before admission or quorum calculation. The gate does not itself parse C2PA manifests, validate COSE signatures, validate certificates, resolve trust lists, contact TSAs, verify the root's signature, or establish signer identity. It answers a narrower question:

> Given normalized cryptographic observations and one exact, already-verified trust-root document, which distinct signers are eligible to count toward that root's quorum?

Evaluation order:

```text
verified root digest + normalized cryptographic observations
        -> exact signed trust-root version
        -> signed-root admission
        -> distinct eligible signer set
        -> quorum calculation
        -> explicit receipt bound to the same root digest
```

## Invariants

```text
Safe internal configuration != externally explainable authority state
Exported signer surface != signed-root admission
No alert != no observable delta
Operational configuration != signed-root admission
Root label/version != verified root bytes
Unverified root != admission authority
Cryptographically valid signature != quorum-eligible signature
Participation != quorum authority
Duplicate signature != additional quorum vote
Successor admission != historical admission
Quorum eligibility != authorship, truth, trust score, or broader action authority
```

A `VALID` signature from a signer absent from the supplied signed root is preserved as observable evidence:

```text
CRYPTOGRAPHICALLY_VALID_BUT_UNADMITTED
```

but is explicitly ineligible for quorum. The current receipt represents that with `quorum_eligible: false` and exclusion reason `VALID_BUT_NOT_ADMITTED_BY_SIGNED_ROOT`.

An `UNVERIFIED` signature remains separately classified as:

```text
CRYPTOGRAPHICALLY_UNVERIFIED
```

and is also ineligible. The external operator's word **unverifiable** is not silently promoted here into the stronger normalized state `VALID`; the synthetic `VALID-but-unadmitted` fixture is an independent hostile proof.

## Configuration drift is diagnostic, not authority

The gate compares the operational/configured signer set with the signed-root admitted set and emits one of:

```text
ALIGNED
CONFIGURED_UNADMITTED_PRESENT
SIGNED_ROOT_NOT_CONFIGURED
BIDIRECTIONAL_DRIFT
```

The comparison is intentionally separate from quorum authority.

- A configured signer absent from the signed root does not become eligible.
- An admitted signer absent from current configuration is not retroactively stripped of the root's signed admission.

This separation prevents mutable runtime configuration from silently rewriting a signed authority frontier.

The external follow-up adds a neighboring but distinct lesson: a safe internal configuration can still leave an **external explanation gap** when an exported signer list and a signed root diverge without a bidirectional receipt. This v0.1 gate does not claim to implement that external system's three-hour export monitor; it preserves the reusable admission/quorum boundary and records the corrected evidence framing.

## Synthetic acceptance fixtures

### `hostile-drift.json`

Synthetic hostile control, not a reproduction of the corrected external runtime configuration:

```text
configured signers = 8
verified signed-root v2 signers = 7
quorum required = 4
valid observations = witnesses 1, 2, 3, 8
```

Required result:

```text
cryptographically valid distinct signers = 4
eligible distinct signers = 3
witness 8 = CRYPTOGRAPHICALLY_VALID_BUT_UNADMITTED
quorum = QUORUM_NOT_MET
```

If witness 8 is counted as the fourth eligible signer, the test fails.

### `positive.json`

Four distinct valid admitted signers satisfy quorum. An additional valid-but-unadmitted signer remains excluded and does not change the result.

### `successor-v2.json` / `successor-v3.json`

The same synthetic signer is unadmitted under v2 and admitted under v3. The fixtures bind v2 and v3 to different synthetic root-document SHA-256 values.

The caller must supply the exact root it intends to evaluate. The gate performs no latest-root lookup or substitution. Therefore v3 can establish eligibility for v3 without rewriting the historical v2 receipt.

## Additional fail-closed controls

`test_gate.py` verifies 14 positive/hostile/negative cases, including:

- duplicate observations from one signer count once;
- conflicting crypto observations for one signer exclude that signer;
- an admitted but cryptographically invalid signer is not eligible;
- an unverified and unadmitted signer remains explicitly `CRYPTOGRAPHICALLY_UNVERIFIED` and ineligible;
- an unverified root is rejected before quorum evaluation;
- a malformed root digest is rejected before quorum evaluation;
- duplicate keys in a signed root are rejected;
- a quorum larger than the admitted signer set is rejected;
- unknown crypto states are rejected instead of being normalized into validity;
- the receipt contains no aggregate trust/reputation score.

## Receipt

The deterministic JSON receipt exposes, separately:

- exact root id/version;
- exact verified root-document SHA-256 and verification status;
- admitted signer count and quorum requirement;
- configured signer count and drift sets;
- observation count and distinct signer count;
- cryptographically valid distinct signer count;
- eligible distinct signer count;
- per-signer admission/eligibility/exclusion state;
- quorum result;
- explicit semantic guards against unverified-root promotion, authority promotion, and historical backfill.

Example:

```bash
python scripts/c2pa-authority-admission/gate.py \
  scripts/c2pa-authority-admission/fixtures/hostile-drift.json
```

## Non-claims

This surface does not:

- modify Stable Core, `SPEC.md`, or `PRINCIPLES.md`;
- reopen or rewrite #777;
- claim C2PA conformance;
- claim UU-AAP fixes C2PA;
- claim the external monitor had an unsafe quorum configuration after the follow-up correction;
- claim the external word `unverifiable` proves our normalized `VALID` signature state;
- create a C2PA assertion namespace;
- perform cryptographic verification;
- use a live external witness/log service;
- implement or prescribe the external operator's three-hour polling cadence;
- turn configuration, publication, participation, signature validity, or successor state into retroactive authority;
- promote quorum eligibility into authorship, truth, responsibility, publication authority, or trust.

Promotion beyond this bounded interoperability/reusable-validation surface requires separate evidence and an explicit decision.
