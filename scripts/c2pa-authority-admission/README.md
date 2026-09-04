# C2PA Authority-Admission Consistency Gate v0.1

Status: **additive executable interoperability evidence for #889; not C2PA conformance, not UU-AAP Stable Core, and not a trust/reputation score**.

Coordination:

- #4 — broader C2PA 2.4 mapping review;
- #778 — executable C2PA interoperability workstream;
- #777 — historical semantic-boundary draft; this gate does not reopen or rewrite it.

## Why this gate exists

A real external transparency/witness implementation disclosed a trust-root drift in `c2pa-org/specifications#122`: its operational/exported witness list contained a key that was actively cosigning while the current signed trust root did not admit that key. The operator correctly concluded that a verifier following the signed root should treat that cosignature as unverifiable/ineligible for quorum until a successor signed root admits it.

Motivating observation:

https://github.com/c2pa-org/specifications/issues/122#issuecomment-5544351466

That observation is **motivation only**. This directory uses synthetic local fixtures, makes no claim about the external operator beyond the cited observation, has no live dependency on that system, and does not treat the GitHub discussion as a C2PA normative decision.

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

## Synthetic acceptance fixtures

### `hostile-drift.json`

Models the essential external failure shape without copying external identities or requiring the network:

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

`test_gate.py` verifies 13 positive/hostile/negative cases, including:

- duplicate observations from one signer count once;
- conflicting crypto observations for one signer exclude that signer;
- an admitted but cryptographically invalid signer is not eligible;
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
- create a C2PA assertion namespace;
- perform cryptographic verification;
- use a live external witness/log service;
- turn configuration, participation, signature validity, or successor state into retroactive authority;
- promote quorum eligibility into authorship, truth, responsibility, publication authority, or trust.

Promotion beyond this bounded interoperability/reusable-validation surface requires separate evidence and an explicit decision.
