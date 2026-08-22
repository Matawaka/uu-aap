'use strict';

const fs = require('fs');
const Identity = require('./identity-evidence.js');
const Continuity = require('./key-continuity.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const pair = await Continuity.generatePersistentKeyPair();
  const metadata = await Continuity.describeKeyPair(pair, {
    epoch: 2,
    previous_thumbprint: 'test-previous-thumbprint'
  });
  const activeRecord = {
    slot: 'test',
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    metadata
  };

  const publicationUrl = Identity.defaultPublicationUrl('Matawaka');
  const envelope = await Identity.buildIdentityEvidenceEnvelope({
    namespace: 'github',
    identifier: 'Matawaka',
    display_name: 'Test account controller',
    publication_url: publicationUrl
  }, activeRecord);

  const errors = Identity.validateIdentityEvidenceEnvelope(envelope);
  assert(errors.length === 0, `Identity envelope validation failed: ${errors.join(' ')}`);
  assert(envelope.artifact_type === 'PoAIIdentityEvidenceEnvelope', 'Unexpected artifact type.');
  assert(envelope.subject_claim.canonical_identifier === 'github:Matawaka', 'Canonical identifier mismatch.');
  assert(envelope.expected_publication.github_owner === 'Matawaka', 'Publication owner mismatch.');
  assert(envelope.verification_method.public_key_jwk.kty === 'OKP', 'Expected OKP public key.');
  assert(envelope.verification_method.public_key_jwk.crv === 'Ed25519', 'Expected Ed25519 public key.');
  assert(!Object.prototype.hasOwnProperty.call(envelope.verification_method.public_key_jwk, 'd'), 'Private key material leaked.');
  assert(envelope.claims.signed_identity_claim_present === true, 'Signed claim flag must be true.');
  assert(envelope.claims.account_control_evidence_established === false, 'Envelope must not pre-establish account control.');
  assert(envelope.claims.human_identity_verified === false, 'Human identity must remain false.');
  assert(envelope.claims.signer_authority_verified === false, 'Authority must remain false.');
  assert(envelope.claims.poai_v_conformance_established === false, 'PoAI/V must remain false.');

  const exactPublished = JSON.parse(JSON.stringify(envelope));
  const verified = await Identity.verifyIdentityEvidenceEnvelope(envelope, {
    active_record: activeRecord,
    published_value: exactPublished
  });
  assert(verified.signature_valid === true, 'Signature should verify.');
  assert(verified.active_local_key_matches === true, 'Active key should match.');
  assert(verified.publication_observed === true, 'Publication should be observed in synthetic test.');
  assert(verified.publication_match === true, 'Exact publication should match.');
  assert(verified.account_control_evidence_observed === true, 'Exact signed publication should produce account-control evidence observation.');
  assert(verified.human_identity_verified === false, 'Human identity must remain unverified after publication match.');
  assert(verified.signer_authority_verified === false, 'Signer authority must remain unverified after publication match.');

  const mismatchedPublication = JSON.parse(JSON.stringify(envelope));
  mismatchedPublication.notes = `${mismatchedPublication.notes} changed`;
  const mismatchResult = await Identity.verifyIdentityEvidenceEnvelope(envelope, {
    active_record: activeRecord,
    published_value: mismatchedPublication
  });
  assert(mismatchResult.signature_valid === true, 'Local signed claim should remain valid.');
  assert(mismatchResult.publication_match === false, 'Modified publication must not match.');
  assert(mismatchResult.account_control_evidence_observed === false, 'Mismatched publication must not establish account-control evidence.');

  const tamperedClaim = JSON.parse(JSON.stringify(envelope));
  tamperedClaim.subject_claim.identifier = 'OtherAccount';
  const tamperedErrors = Identity.validateIdentityEvidenceEnvelope(tamperedClaim);
  assert(tamperedErrors.length > 0, 'Tampered top-level identity claim must fail validation.');

  let wrongOwnerRejected = false;
  try {
    Identity.parseGithubRawPublication(
      'https://raw.githubusercontent.com/OtherAccount/uu-aap/main/proposals/poai/identity-evidence/github/Matawaka.poai-identity.json',
      'Matawaka'
    );
  } catch (_) {
    wrongOwnerRejected = true;
  }
  assert(wrongOwnerRejected, 'Publication owner mismatch must be rejected.');

  if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(envelope, null, 2)}\n`);
  console.log('PoAI Level 4.0d identity evidence tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});