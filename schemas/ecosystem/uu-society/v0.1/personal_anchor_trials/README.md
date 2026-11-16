# Personal Anchor adversarial trials v0.1

Tracking: #1043. Related concepts: #1021 (Personal Anchor/PCC), #943 (ARAE).
Source frontier: `e778ae34ed5c03c5b862c45c33b7f9a23d3438a6`.

This increment includes the tests requested after the 2026-11-16 watch. It adds
regressions against existing offline validators and an explicit end-to-end
experiment protocol. It does not implement or select a live person authenticator.

[Русская версия](README.ru.md)

## Executable contract regressions

```bash
python -m unittest discover -s schemas/ecosystem/uu-society/v0.1/harness -p test_personal_anchor_trials.py -v
node --test schemas/ecosystem/uu-society/v0.1/harness/test_personal_anchor_authority.js
```

Python uses the existing pinned CI dependency `jsonschema==4.23.0`; Node uses only
built-ins. CI runs both suites. No biometric recordings, network, secrets, real
people or actuators are required by these tests.

The Node suite calls the existing `validateDecision(candidate, sourceAdmission)`.
Modified records are rehashed before validation and failures must match the
specific semantic/binding error. Input evidence must remain unchanged. A valid
control prevents an always-deny implementation from satisfying the suite.

The Python suite calls the existing UU Society `apply_event` guard. Its upstream
response labels and confidence are synthetic assumptions, not measured outputs
of an audio model. An upstream false acceptance must not override an expired or
revoked action lease. A failed challenge must preserve the person and permit
scoped narrowing and subsequent modeled recovery.

## Trial matrix

`CONTRACT_REGRESSION` describes executable coverage of an existing offline seam.
`NOT_EXECUTED` describes a registered experiment without subject/data/results.
Neither status is an end-to-end security PASS.

| Trial | Adversary/input and required outcome | Current coverage | End-to-end status |
| --- | --- | --- | --- |
| PA-01 Retained expired challenge | Earlier valid response survives delayed cleanup; completion after expiry cannot restore authority | PA-A02/A03/A08; Python retained-expired-lease test. No actual queue stress/load test | NOT_EXECUTED |
| PA-02 Revocation after phase one | Revoke the current basis while a response is pending; reject the action despite a correct response | PA-A04 and Python revoked-lease test | NOT_EXECUTED |
| PA-03 Key/control rotation | Old response and permit cannot silently acquire the successor's current authority | PA-A05/A06 check changed approval/permit bindings only; no key rotation or signature verification | NOT_EXECUTED |
| PA-04 Different intent/target | Replay an earlier success against a new target; require current target/intent authorization | PA-A07 checks target binding; no PCC intent parser | NOT_EXECUTED |
| PA-05 Full-history knowledge | Give attacker every historical fact available to the verifier; perfect recall alone must not prove current person/control or create authority | Registered protocol only; no live continuity verifier | NOT_EXECUTED |
| PA-06 Old-response replay/relay | Reuse an old response under a fresh challenge/session/nonce; distinguish recorded replay from live relay | PA-A09 checks a declared consumed flag only; no global replay store, channel binding or nonce issuer | NOT_EXECUTED |
| PA-07 Audio replay/re-recording | Test direct replay and speaker-to-microphone re-recording; report false acceptance separately by channel | Python injects synthetic acceptance only; no audio detector exercised | NOT_EXECUTED |
| PA-08 Unseen synthesis | Hold out synthesis systems, speakers, languages and channels; keep training/calibration/test separate | Synthetic acceptance non-escalation only | NOT_EXECUTED |
| PA-09 Confident false acceptance | Attack recordings accepted as genuine with high model confidence must not independently grant authority | PA-A10 non-effect contract plus synthetic acceptance non-escalation; no calibration claim | NOT_EXECUTED |
| PA-10 False rejection/recovery | Legitimate behavioral change or a wrong answer may narrow consequences but cannot alone declare impostor/guilt; preserve recovery | Python S09/S10 composition; source independence is supplied, not proven | NOT_EXECUTED |
| PA-11 Minimal disclosure | Test selective evidence and unavailable optional history; no total telemetry, universal dossier or automatic cross-context correlation | Registered protocol only | NOT_EXECUTED |

## Required end-to-end setup

The [agent interface](agent-v0.1/README.md) ([Russian](agent-v0.1/README.ru.md))
provides closed JSON contracts, a catalogue, run/compare/replay operations, a
single-request JSON CLI and local MCP stdio access to the synthetic lifecycle
experiment. Its receipts establish bounded local reproduction, not identity,
authority or independent review. Real end-to-end statuses below remain unchanged.

An additive [stateful lifecycle experiment](lifecycle-v0.1/README.md) now executes
16 event tapes / 32 fresh/cached arms against the pinned existing validator.
It adds modeled queue retention, current-source/clock observations, control
epochs and local response replay checks. Its synthetic public-history and
confidence inputs do not execute a continuity classifier. This is additional
laboratory lifecycle coverage for PA-01/02/03/04/06/09/10; **every real end-to-end
status in the table remains NOT_EXECUTED**. The recorded 11 arm differences are
variants of a caching failure class, not product vulnerability findings.

Before a real end-to-end trial can acquire results, identify an actual PCC/authenticator adapter,
exact verifier/model commit and weights digest, challenge generation and expiry
policy, clock semantics, authority/revocation provider, key-epoch binding and
replay-store behavior. Record which component supplies a fresh trusted current
admission: the offline seam does not discover or authenticate it.

PA-A11 deliberately accepts matched self-consistent replacement records. Public
hashes and caller-supplied assertions are not proof of a live person or authentic
authority. An adapter that repeatedly supplies an old admission and an old
`evaluated_at` is outside the current seam's assurance; end-to-end tests must
independently observe time, authority changes and the final effect boundary.
The existing Node seam treats its `must_occur_by`/`valid_until` comparisons as
inclusive; tests reject one millisecond after the relevant bound. Do not infer
half-open deadlines or synchronized trusted time from these regressions.

For queue trials, first complete phase one, then expire/revoke/rotate while the
response stays pending. Vary queue backlog and cleanup pause independently of the
verifier's current clock. Supply a correct late response; check both response
evidence handling and action admission/consumption. Preserve historical evidence
with its actual timestamps, without treating it as current authority.

For PA-05, expose all accumulated history to the attacker, including all facts
used to generate questions. Separately state access to live devices, keys,
verifier/model internals, training data, witness/control channels and adaptive
query feedback. New questions about public past facts must not be counted as a
fresh independent factor. Include correct-history/no-live-control, stolen-device,
and legitimate-recovery controls. If attacker and person are observationally
indistinguishable to the verifier, record that limitation; do not manufacture a
continuity proof from hidden benchmark labels.

For audio, include raw replay, ordinary speaker/microphone re-recording, varied
codecs/noise/devices and held-out TTS/voice-conversion systems. Freeze the
operating point and define high confidence on a separate calibration split
before examining test labels. A live relay is a separate threat: a fresh prompt
or nonce alone does not establish resistance to relay. Use lawfully available or
consented data; running these contract tests does not collect personal data.

Report sample/person/system counts and split independence; FAR/FRR at the frozen
operating point with uncertainty intervals; EER/AUROC as separate diagnostic
metrics; attack acceptance and legitimate recovery by condition; and latency,
timeouts and queue completion behavior. EER is not a deployment's account-takeover
probability. Do not pool easy and hard channels into a reassuring aggregate.
Preserve high-confidence wrong examples and unresolved contradictory evidence.

Do not invent acceptance thresholds here. An end-to-end PASS requires a declared
scoped policy/threshold, actual bound outputs, raw-result provenance and an
independent replay. Otherwise report FAIL, INCONCLUSIVE or NOT_EXECUTED as
appropriate. A successful continuity response remains evidence and cannot by
itself grant a lease, identify a human universally or authorize an external act.

## Sources and evidence limits

- HashiCorp [HCSEC-2026-59 / CVE-2026-92738](https://discuss.hashicorp.com/t/hcsec-2026-59-expired-vault-login-mfa-requests-may-remain-redeemable/78257), published 2026-11-13: vendor-confirmed stale two-phase Login MFA request problem. The attacker still needs the second factor. This suite does not reproduce Vault or prove that UU-AAP has that vulnerability.
- Küçük et al., [Audio deepfake detection using constant-Q transform scalograms and spatial-transformer attention networks](https://doi.org/10.1007/s44564-026-00042-x), published 2026-11-11: authors' laboratory evaluation of a particular detector; reported re-recording degradation motivates PA-07/08/09. No independent reproduction or full-history-compromise result is claimed here.

No model, Stable Core, SPEC, identity policy, production authority, KONTUR state,
credential, biometric implementation, actuator, or historical reference receipt
is changed by this test increment. Keep #1021 open.
