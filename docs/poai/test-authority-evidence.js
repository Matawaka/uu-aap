'use strict';

const fs = require('fs');
const Authority = require('./authority-evidence.js');
const Continuity = require('./key-continuity.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const pair = await Continuity.generatePersistentKeyPair();
  const metadata = await Continuity.describeKeyPair(pair, {
    epoch: 3,
    previous_thumbprint: 'test-previous-thumbprint'
  });
  const activeRecord = {
    slot: 'test',
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    metadata
  };

  const now = new Date();
  const validFrom = new Date(now.getTime() - 60_000).toISOString();
  const validUntil = new Date(now.getTime() + 3_600_000).toISOString();
  const envelope = await Authority.buildAuthorityEvidenceEnvelope({
    issuer_identifier: 'Matawaka',
    issuer_display_name: 'Test issuer',
    scope: 'poai.successor.materialization.propose',
    target: 'github:Matawaka/uu-aap',
    valid_from: validFrom,
    valid_until: validUntil,
    issuer_identity_evidence_ref: Authority.defaultIdentityEvidenceRef('Matawaka'),
    publication_url: Authority.defaultPublicationUrl('Matawaka')
  }, activeRecord);

  const errors = Authority.validateAuthorityEvidenceEnvelope(envelope);
  assert(errors.length === 0, `Authority envelope validation failed: ${errors.join(' ')}`);
  assert(envelope.artifact_type === 'PoAIAuthorityEvidenceEnvelope', 'Unexpected artifact type.');
  assert(envelope.issuer_claim.canonical_identifier === 'github:Matawaka', 'Issuer canonical identifier mismatch.');
  assert(envelope.authority_claim.scope === 'poai.successor.materialization.propose', 'Scope mismatch.');
  assert(envelope.authority_claim.target === 'github:Matawaka/uu-aap', 'Target mismatch.');
  assert(envelope.authority_claim.delegation_mode === 'non_delegable', 'Delegation mode mismatch.');
  assert(envelope.verification_method.public_key_jwk.kty === 'OKP', 'Expected OKP public key.');
  assert(envelope.verification_method.public_key_jwk.crv === 'Ed25519', 'Expected Ed25519 public key.');
  assert(!Object.prototype.hasOwnProperty.call(envelope.verification_method.public_key_jwk, 'd'), 'Private key material leaked.');
  assert(envelope.claims.signed_authority_claim_present === true, 'Signed authority claim flag must be true.');
  assert(envelope.claims.authority_evidence_established === false, 'Envelope must not pre-establish authority evidence.');
  assert(envelope.claims.issuer_entitlement_verified === false, 'Issuer entitlement must remain false.');
  assert(envelope.claims.authority_verified === false, 'Authority must remain false.');
  assert(envelope.claims.materialization_authority_verified === false, 'Materialization authority must remain false.');
  assert(envelope.claims.poai_v_conformance_established === false, 'PoAI/V must remain false.');

  const exactPublished = JSON.parse(JSON.stringify(envelope));
  const verified = await Authority.verifyAuthorityEvidenceEnvelope(envelope, {
    active_record: activeRecord,
    published_value: exactPublished,
    now: now.toISOString()
  });
  assert(verified.signature_valid === true, 'Signature should verify.');
  assert(verified.active_subject_key_matches === true, 'Active subject key should match.');
  assert(verified.time_window_status === 'active', 'Authority window should be active.');
  assert(verified.scope_target_present === true, 'Scope/target should be present.');
  assert(verified.publication_match === true, 'Exact publication should match.');
  assert(verified.authority_evidence_observed === true, 'Exact signed publication in active window should produce authority-evidence observation.');
  assert(verified.issuer_entitlement_verified === false, 'Issuer entitlement must remain unverified after publication match.');
  assert(verified.authority_verified === false, 'Authority must remain unverified after publication match.');
  assert(verified.materialization_authority_verified === false, 'Materialization authority must remain unverified after publication match.');

  const mismatchedPublication = JSON.parse(JSON.stringify(envelope));
  mismatchedPublication.notes = `${mismatchedPublication.notes} changed`;
  const mismatchResult = await Authority.verifyAuthorityEvidenceEnvelope(envelope, {
    active_record: activeRecord,
    published_value: mismatchedPublication,
    now: now.toISOString()
  });
  assert(mismatchResult.signature_valid === true, 'Local signed authority claim should remain valid.');
  assert(mismatchResult.publication_match === false, 'Modified publication must not match.');
  assert(mismatchResult.authority_evidence_observed === false, 'Mismatched publication must not produce authority-evidence observation.');

  const expiredResult = await Authority.verifyAuthorityEvidenceEnvelope(envelope, {
    active_record: activeRecord,
    published_value: exactPublished,
    now: new Date(new Date(validUntil).getTime() + 60_000).toISOString()
  });
  assert(expiredResult.time_window_status === 'expired', 'Expired authority window must be reported.');
  assert(expiredResult.authority_evidence_observed === false, 'Expired authority evidence must not be observed as active.');

  const tamperedClaim = JSON.parse(JSON.stringify(envelope));
  tamperedClaim.authority_claim.scope = 'poai.successor.materialization.approve';
  const tamperedErrors = Authority.validateAuthorityEvidenceEnvelope(tamperedClaim);
  assert(tamperedErrors.length > 0, 'Tampered top-level authority claim must fail validation.');

  let invalidScopeRejected = false;
  try { Authority.normalizeScope('bad scope with spaces'); } catch (_) { invalidScopeRejected = true; }
  assert(invalidScopeRejected, 'Invalid scope syntax must be rejected.');

  if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(envelope, null, 2)}\n`);
  console.log('PoAI Level 4.0e authority evidence tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
