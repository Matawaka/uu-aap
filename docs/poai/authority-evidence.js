(function (root, factory) {
  const bindingApi = (typeof module === 'object' && module.exports)
    ? require('./binding-receipt.js')
    : root && root.PoAIBindingReceipt;
  const signatureApi = (typeof module === 'object' && module.exports)
    ? require('./signature-envelope.js')
    : root && root.PoAISignatureEnvelope;
  const continuityApi = (typeof module === 'object' && module.exports)
    ? require('./key-continuity.js')
    : root && root.PoAIKeyContinuity;
  const identityApi = (typeof module === 'object' && module.exports)
    ? require('./identity-evidence.js')
    : root && root.PoAIIdentityEvidence;
  const api = factory(bindingApi, signatureApi, continuityApi, identityApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIAuthorityEvidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Binding, Signature, Continuity, Identity) {
  'use strict';

  if (!Binding) throw new Error('PoAIBindingReceipt is required before PoAIAuthorityEvidence.');
  if (!Signature) throw new Error('PoAISignatureEnvelope is required before PoAIAuthorityEvidence.');
  if (!Continuity) throw new Error('PoAIKeyContinuity is required before PoAIAuthorityEvidence.');
  if (!Identity) throw new Error('PoAIIdentityEvidence is required before PoAIAuthorityEvidence.');

  const ARTIFACT_TYPE = 'PoAIAuthorityEvidenceEnvelope';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const SIGNATURE_PROFILE = 'PoAI-Ed25519-JCS-AuthorityEvidence-v0.1';
  const STATEMENT_DOMAIN = 'urn:poai:authority-claim:v0.1';
  const PUBLICATION_METHOD = 'github_repository_publication';
  const DELEGATION_MODE = 'non_delegable';

  function webCrypto() {
    if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
    if (typeof require === 'function') return require('crypto').webcrypto;
    throw new Error('WebCrypto is unavailable.');
  }

  function nonEmpty(value, label, maxLength) {
    const text = String(value || '').trim();
    if (!text) throw new Error(`${label} is required.`);
    if (maxLength && text.length > maxLength) throw new Error(`${label} is too long.`);
    return text;
  }

  function normalizeScope(value) {
    const text = nonEmpty(value, 'Authority scope', 180);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text)) throw new Error('Authority scope contains unsupported characters.');
    return text;
  }

  function normalizeTarget(value) {
    const text = nonEmpty(value, 'Authority target', 240);
    if (/\s/.test(text)) throw new Error('Authority target must not contain whitespace.');
    return text;
  }

  function normalizeInstant(value, label, optional) {
    if ((value === null || value === undefined || value === '') && optional) return null;
    const text = nonEmpty(value, label, 80);
    const date = new Date(text);
    if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
    return date.toISOString();
  }

  function normalizeWindow(validFromValue, validUntilValue) {
    const validFrom = normalizeInstant(validFromValue, 'valid_from', false);
    const validUntil = normalizeInstant(validUntilValue, 'valid_until', true);
    if (validUntil && new Date(validUntil).getTime() <= new Date(validFrom).getTime()) {
      throw new Error('valid_until must be later than valid_from.');
    }
    return { valid_from: validFrom, valid_until: validUntil };
  }

  function defaultPublicationUrl(identifier) {
    const id = String(identifier || '').trim();
    if (!id) return '';
    return `https://raw.githubusercontent.com/${id}/uu-aap/main/proposals/poai/authority-evidence/github/${id}.poai-authority.json`;
  }

  function defaultIdentityEvidenceRef(identifier) {
    const id = String(identifier || '').trim();
    if (!id) return null;
    return `https://raw.githubusercontent.com/${id}/uu-aap/main/proposals/poai/identity-evidence/github/${id}.poai-identity.json`;
  }

  function authorityStatement(record, input, createdAt) {
    const metadata = record.metadata;
    const issuerIdentifier = Identity.normalizeGithubIdentifier(input.issuer_identifier);
    const publication = Identity.parseGithubRawPublication(input.publication_url, issuerIdentifier);
    const scope = normalizeScope(input.scope);
    const target = normalizeTarget(input.target);
    const window = normalizeWindow(input.valid_from, input.valid_until);
    const issuerDisplayName = String(input.issuer_display_name || '').trim() || null;
    const identityEvidenceRef = String(input.issuer_identity_evidence_ref || '').trim() || defaultIdentityEvidenceRef(issuerIdentifier);

    return {
      domain: STATEMENT_DOMAIN,
      signature_profile: SIGNATURE_PROFILE,
      created_at: createdAt,
      purpose: 'record_scoped_authority_evidence_without_verifying_authority',
      issuer_claim: {
        namespace: 'github',
        identifier: issuerIdentifier,
        canonical_identifier: `github:${issuerIdentifier}`,
        account_url: `https://github.com/${issuerIdentifier}`,
        display_name: issuerDisplayName,
        claim_status: 'self_asserted'
      },
      issuer_key: {
        algorithm: 'Ed25519',
        key_id: metadata.key_id,
        jwk_thumbprint_algorithm: metadata.jwk_thumbprint_algorithm,
        jwk_thumbprint: metadata.jwk_thumbprint,
        public_key_jwk: metadata.public_key_jwk
      },
      subject_key: {
        key_id: metadata.key_id,
        jwk_thumbprint_algorithm: metadata.jwk_thumbprint_algorithm,
        jwk_thumbprint: metadata.jwk_thumbprint,
        relationship_to_issuer_key: 'same_key_first_scenario'
      },
      authority_claim: {
        scope,
        target,
        valid_from: window.valid_from,
        valid_until: window.valid_until,
        delegation_mode: DELEGATION_MODE,
        claim_status: 'self_asserted_not_verified'
      },
      issuer_evidence: {
        identity_evidence_ref: identityEvidenceRef,
        issuer_entitlement_status: 'unknown'
      },
      expected_publication: {
        method: PUBLICATION_METHOD,
        url: publication.url,
        github_owner: publication.owner,
        github_repository: publication.repository,
        git_ref: publication.ref,
        repository_path: publication.path,
        comparison: 'RFC8785-JCS-canonical-equality'
      }
    };
  }

  async function buildAuthorityEvidenceEnvelope(input, activeRecord) {
    const record = await Continuity.normalizeStoredRecord(activeRecord || await Continuity.loadPersistentKey());
    if (!record) throw new Error('A persistent Level 4.0c signer key is required.');
    const createdAt = new Date().toISOString();
    const statement = authorityStatement(record, input || {}, createdAt);
    const statementBytes = Binding.utf8Bytes(Binding.canonicalize(statement, '$'));
    const signatureBytes = new Uint8Array(
      await webCrypto().subtle.sign({ name: 'Ed25519' }, record.privateKey, statementBytes)
    );
    const signatureValue = Signature.base64urlEncode(signatureBytes);
    const idSeed = `${statement.issuer_claim.canonical_identifier}|${statement.authority_claim.scope}|${statement.authority_claim.target}|${statement.subject_key.jwk_thumbprint}|${signatureValue}`;
    const idDigest = await Binding.sha256Hex(Binding.utf8Bytes(idSeed));

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      authority_evidence_id: `urn:poai:authority-evidence:${idDigest.slice(0, 16)}`,
      created_at: createdAt,
      issuer_claim: statement.issuer_claim,
      subject_key: statement.subject_key,
      authority_claim: statement.authority_claim,
      verification_method: {
        key_format: 'JWK',
        public_key_jwk: record.metadata.public_key_jwk,
        jwk_thumbprint_algorithm: record.metadata.jwk_thumbprint_algorithm,
        jwk_thumbprint: record.metadata.jwk_thumbprint,
        key_id: record.metadata.key_id,
        issuer_identity_status: 'claimed_not_verified',
        issuer_entitlement_status: 'unknown',
        authority_status: 'claimed_not_verified',
        materialization_authority_status: 'unknown'
      },
      key_continuity: {
        key_id: record.metadata.key_id,
        continuity_status: record.metadata.continuity_status,
        continuity_epoch: record.metadata.continuity_epoch,
        previous_key_thumbprint: record.metadata.previous_key_thumbprint,
        private_key_extractable: false
      },
      issuer_evidence: statement.issuer_evidence,
      expected_publication: statement.expected_publication,
      signed_statement: statement,
      signature: {
        algorithm: 'Ed25519',
        encoding: 'base64url',
        value: signatureValue
      },
      claims: {
        signature_present: true,
        local_key_continuity_established: true,
        signed_authority_claim_present: true,
        authority_evidence_established: false,
        issuer_entitlement_verified: false,
        authority_verified: false,
        signer_authority_verified: false,
        materialization_authority_verified: false,
        human_identity_verified: false,
        truth_certified: false,
        responsibility_determined: false,
        legal_effect_established: false,
        canonical_successor_established: false,
        poai_v_conformance_established: false
      },
      notes: 'Experimental scoped authority evidence. A valid signature, matching publication, active time window or explicit scope does not establish issuer entitlement, verified authority, materialization authority, legal effect, canonical successor status, or PoAI/V.'
    };
  }

  function validateAuthorityEvidenceEnvelope(envelope) {
    const errors = [];
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return ['Authority Evidence Envelope must be an object.'];
    if (envelope.artifact_type !== ARTIFACT_TYPE) errors.push(`artifact_type must be ${ARTIFACT_TYPE}.`);
    if (envelope.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (!envelope.authority_evidence_id || typeof envelope.authority_evidence_id !== 'string') errors.push('authority_evidence_id is required.');

    const issuer = envelope.issuer_claim || {};
    if (issuer.namespace !== 'github') errors.push('issuer_claim.namespace must be github.');
    try { Identity.normalizeGithubIdentifier(issuer.identifier); } catch (error) { errors.push(error.message); }
    if (issuer.canonical_identifier !== `github:${issuer.identifier || ''}`) errors.push('issuer canonical_identifier must match the GitHub identifier.');
    if (issuer.claim_status !== 'self_asserted') errors.push('issuer claim_status must remain self_asserted in 4.0e.');

    const claim = envelope.authority_claim || {};
    try { normalizeScope(claim.scope); } catch (error) { errors.push(error.message); }
    try { normalizeTarget(claim.target); } catch (error) { errors.push(error.message); }
    try { normalizeWindow(claim.valid_from, claim.valid_until); } catch (error) { errors.push(error.message); }
    if (claim.delegation_mode !== DELEGATION_MODE) errors.push(`delegation_mode must be ${DELEGATION_MODE}.`);
    if (claim.claim_status !== 'self_asserted_not_verified') errors.push('authority claim_status must remain self_asserted_not_verified.');

    const vm = envelope.verification_method || {};
    if (!vm.public_key_jwk || vm.public_key_jwk.kty !== 'OKP' || vm.public_key_jwk.crv !== 'Ed25519' || typeof vm.public_key_jwk.x !== 'string') {
      errors.push('Public JWK must be OKP/Ed25519.');
    }
    if (vm.public_key_jwk && Object.prototype.hasOwnProperty.call(vm.public_key_jwk, 'd')) errors.push('Private key material must not appear in the envelope.');
    if (vm.issuer_identity_status !== 'claimed_not_verified') errors.push('issuer_identity_status must remain claimed_not_verified.');
    if (vm.issuer_entitlement_status !== 'unknown') errors.push('issuer_entitlement_status must remain unknown.');
    if (vm.authority_status !== 'claimed_not_verified') errors.push('authority_status must remain claimed_not_verified.');
    if (vm.materialization_authority_status !== 'unknown') errors.push('materialization_authority_status must remain unknown.');

    const subject = envelope.subject_key || {};
    if (!subject.key_id || subject.key_id !== vm.key_id) errors.push('subject_key.key_id must match verification_method.key_id in the first scenario.');
    if (!subject.jwk_thumbprint || subject.jwk_thumbprint !== vm.jwk_thumbprint) errors.push('subject_key thumbprint must match verification_method in the first scenario.');
    if (subject.relationship_to_issuer_key !== 'same_key_first_scenario') errors.push('subject/issuer relationship must remain same_key_first_scenario in 4.0e.');

    const continuity = envelope.key_continuity || {};
    if (continuity.continuity_status !== 'locally_established') errors.push('key_continuity must remain locally_established.');
    if (continuity.private_key_extractable !== false) errors.push('private_key_extractable must be false.');
    if (!Number.isInteger(continuity.continuity_epoch) || continuity.continuity_epoch < 1) errors.push('continuity_epoch must be a positive integer.');

    const issuerEvidence = envelope.issuer_evidence || {};
    if (issuerEvidence.issuer_entitlement_status !== 'unknown') errors.push('issuer_evidence.issuer_entitlement_status must remain unknown.');

    const publication = envelope.expected_publication || {};
    if (publication.method !== PUBLICATION_METHOD) errors.push(`expected_publication.method must be ${PUBLICATION_METHOD}.`);
    try {
      const parsed = Identity.parseGithubRawPublication(publication.url, issuer.identifier);
      if (parsed.owner !== publication.github_owner || parsed.repository !== publication.github_repository || parsed.ref !== publication.git_ref || parsed.path !== publication.repository_path) {
        errors.push('expected_publication metadata does not match its URL.');
      }
    } catch (error) { errors.push(error.message); }

    if (!envelope.signed_statement || typeof envelope.signed_statement !== 'object') {
      errors.push('signed_statement is required.');
    } else {
      const signed = envelope.signed_statement;
      if (Binding.canonicalize(signed.issuer_claim || {}, '$') !== Binding.canonicalize(issuer, '$')) errors.push('Top-level issuer_claim must match signed_statement.issuer_claim.');
      if (Binding.canonicalize(signed.subject_key || {}, '$') !== Binding.canonicalize(subject, '$')) errors.push('Top-level subject_key must match signed_statement.subject_key.');
      if (Binding.canonicalize(signed.authority_claim || {}, '$') !== Binding.canonicalize(claim, '$')) errors.push('Top-level authority_claim must match signed_statement.authority_claim.');
      if (Binding.canonicalize(signed.expected_publication || {}, '$') !== Binding.canonicalize(publication, '$')) errors.push('Top-level expected_publication must match signed_statement.expected_publication.');
      if (!signed.issuer_key || signed.issuer_key.jwk_thumbprint !== vm.jwk_thumbprint || signed.issuer_key.key_id !== vm.key_id) errors.push('Signed issuer key metadata must match verification_method.');
    }

    if (!envelope.signature || envelope.signature.algorithm !== 'Ed25519' || envelope.signature.encoding !== 'base64url' || typeof envelope.signature.value !== 'string') {
      errors.push('Ed25519 base64url signature is required.');
    }

    const claims = envelope.claims || {};
    if (claims.signature_present !== true || claims.local_key_continuity_established !== true || claims.signed_authority_claim_present !== true) {
      errors.push('Signature, continuity and signed authority claim flags must be true.');
    }
    [
      'authority_evidence_established',
      'issuer_entitlement_verified',
      'authority_verified',
      'signer_authority_verified',
      'materialization_authority_verified',
      'human_identity_verified',
      'truth_certified',
      'responsibility_determined',
      'legal_effect_established',
      'canonical_successor_established',
      'poai_v_conformance_established'
    ].forEach((field) => {
      if (claims[field] !== false) errors.push(`${field} must remain false in the 4.0e envelope.`);
    });

    if (Object.prototype.hasOwnProperty.call(envelope, 'protocol')) errors.push('Authority Evidence Envelope must not masquerade as a Genesis PoAI record.');
    return errors;
  }

  function evaluateTimeWindow(authorityClaim, nowValue) {
    let now;
    try { now = new Date(nowValue || new Date().toISOString()); } catch (_) { return 'indeterminate'; }
    if (!Number.isFinite(now.getTime())) return 'indeterminate';
    const start = new Date(authorityClaim.valid_from);
    if (!Number.isFinite(start.getTime())) return 'indeterminate';
    if (now.getTime() < start.getTime()) return 'not_yet_valid';
    if (authorityClaim.valid_until) {
      const end = new Date(authorityClaim.valid_until);
      if (!Number.isFinite(end.getTime())) return 'indeterminate';
      if (now.getTime() > end.getTime()) return 'expired';
    }
    return 'active';
  }

  async function verifySignatureAndKey(envelope, activeRecord) {
    const publicJwk = Signature.publicOnlyJwk(envelope.verification_method.public_key_jwk);
    const thumbprint = await Signature.publicJwkThumbprint(publicJwk);
    const thumbprintMatches = thumbprint === envelope.verification_method.jwk_thumbprint;
    let signatureValid = false;
    try {
      const publicKey = await webCrypto().subtle.importKey('jwk', publicJwk, { name: 'Ed25519' }, true, ['verify']);
      const bytes = Binding.utf8Bytes(Binding.canonicalize(envelope.signed_statement, '$'));
      signatureValid = await webCrypto().subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        Signature.base64urlDecode(envelope.signature.value),
        bytes
      );
    } catch (_) { signatureValid = false; }

    let activeKeyMatches = null;
    if (activeRecord) {
      const normalized = await Continuity.normalizeStoredRecord(activeRecord);
      activeKeyMatches = normalized.metadata.jwk_thumbprint === envelope.subject_key.jwk_thumbprint;
    }
    return {
      signature_valid: Boolean(signatureValid && thumbprintMatches),
      cryptographic_signature_valid: Boolean(signatureValid),
      key_thumbprint_matches: Boolean(thumbprintMatches),
      active_subject_key_matches: activeKeyMatches
    };
  }

  function publicationMatchesEnvelope(envelope, publishedValue) {
    if (!publishedValue || typeof publishedValue !== 'object' || Array.isArray(publishedValue)) return false;
    try { return Binding.canonicalize(envelope, '$') === Binding.canonicalize(publishedValue, '$'); }
    catch (_) { return false; }
  }

  async function fetchPublication(urlValue) {
    const publication = Identity.parseGithubRawPublication(urlValue);
    if (typeof fetch !== 'function') throw new Error('Fetch is unavailable in this environment.');
    const response = await fetch(publication.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Publication fetch failed with HTTP ${response.status}.`);
    const text = await response.text();
    let value;
    try { value = JSON.parse(text); } catch (_) { throw new Error('Published authority evidence is not valid JSON.'); }
    return { value, publication };
  }

  async function verifyAuthorityEvidenceEnvelope(envelope, options) {
    const errors = validateAuthorityEvidenceEnvelope(envelope);
    if (errors.length) {
      return {
        signature_valid: false,
        active_subject_key_matches: null,
        time_window_status: 'indeterminate',
        publication_match: null,
        publication_observed: false,
        authority_evidence_observed: false,
        issuer_entitlement_verified: false,
        authority_verified: false,
        materialization_authority_verified: false,
        errors
      };
    }

    const opts = options || {};
    const keyResult = await verifySignatureAndKey(envelope, opts.active_record || null);
    const timeStatus = evaluateTimeWindow(envelope.authority_claim, opts.now || null);
    let publicationMatch = null;
    let publicationObserved = false;
    let publicationError = null;
    let publishedValue = opts.published_value;

    if (publishedValue === undefined && opts.fetch_publication) {
      try {
        const fetched = await fetchPublication(envelope.expected_publication.url);
        publishedValue = fetched.value;
        publicationObserved = true;
      } catch (error) { publicationError = error.message; }
    } else if (publishedValue !== undefined) {
      publicationObserved = true;
    }
    if (publicationObserved) publicationMatch = publicationMatchesEnvelope(envelope, publishedValue);

    const scopeTargetPresent = Boolean(envelope.authority_claim.scope && envelope.authority_claim.target);
    const evidenceObserved = Boolean(
      keyResult.signature_valid &&
      scopeTargetPresent &&
      timeStatus === 'active' &&
      publicationObserved &&
      publicationMatch
    );

    return {
      signature_valid: keyResult.signature_valid,
      cryptographic_signature_valid: keyResult.cryptographic_signature_valid,
      key_thumbprint_matches: keyResult.key_thumbprint_matches,
      active_subject_key_matches: keyResult.active_subject_key_matches,
      time_window_status: timeStatus,
      scope_target_present: scopeTargetPresent,
      publication_observed: publicationObserved,
      publication_match: publicationMatch,
      publication_error: publicationError,
      authority_evidence_observed: evidenceObserved,
      issuer_entitlement_verified: false,
      authority_verified: false,
      signer_authority_verified: false,
      materialization_authority_verified: false,
      errors: []
    };
  }

  function currentLanguage() { return document.documentElement.lang === 'ru' ? 'ru' : 'en'; }

  function localDateTimeValue(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function isoFromLocal(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function downloadJson(filename, data) {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function ensureControls() {
    if (typeof document === 'undefined' || document.getElementById('authorityEvidencePanel')) return;
    const identityPanel = document.getElementById('identityEvidencePanel');
    if (!identityPanel) return;
    const ru = currentLanguage() === 'ru';
    const panel = document.createElement('section');
    panel.id = 'authorityEvidencePanel';
    panel.className = 'panel authority-evidence-panel';
    panel.innerHTML = `
      <div class="panel-head">
        <div><p class="eyebrow">PoAI · LEVEL 4.0e</p><h2>${ru ? 'Ограниченное доказательство полномочия' : 'Scoped authority evidence'}</h2></div>
        <span class="badge neutral">${ru ? 'EVIDENCE · НЕ VERIFIED AUTHORITY' : 'EVIDENCE · NOT VERIFIED AUTHORITY'}</span>
      </div>
      <p class="summary">${ru ? 'Фиксирует подписанное утверждение о конкретном полномочии, цели и сроке. Подпись и публикация показывают существование evidence, но не доказывают право issuer выдавать полномочие и не создают materialization authority.' : 'Records a signed claim about a specific authority scope, target and validity window. Signature and publication show that evidence exists, but do not prove issuer entitlement or create materialization authority.'}</p>
      <div class="form-grid compact">
        <label>${ru ? 'Issuer namespace' : 'Issuer namespace'}<select id="authorityIssuerNamespace"><option value="github">github</option></select></label>
        <label>${ru ? 'GitHub issuer' : 'GitHub issuer'}<input id="authorityIssuerIdentifier" placeholder="Matawaka"></label>
        <label class="wide">${ru ? 'Имя issuer (необязательно)' : 'Issuer display name (optional)'}<input id="authorityIssuerDisplayName" placeholder="Dmitrii Kuznetsov"></label>
        <label>${ru ? 'Область полномочия' : 'Authority scope'}<select id="authorityScope"><option value="poai.successor.materialization.propose">poai.successor.materialization.propose</option><option value="poai.successor.materialization.approve">poai.successor.materialization.approve</option><option value="poai.record.publish">poai.record.publish</option><option value="poai.review.perform">poai.review.perform</option></select></label>
        <label>${ru ? 'Целевой ресурс' : 'Target resource'}<input id="authorityTarget" placeholder="github:Matawaka/uu-aap"></label>
        <label>${ru ? 'Действует с' : 'Valid from'}<input id="authorityValidFrom" type="datetime-local"></label>
        <label>${ru ? 'Действует до (необязательно)' : 'Valid until (optional)'}<input id="authorityValidUntil" type="datetime-local"></label>
        <label>${ru ? 'Делегируемость' : 'Delegation mode'}<select id="authorityDelegationMode"><option value="non_delegable">non_delegable</option></select></label>
        <label class="wide">${ru ? 'Identity evidence issuer (необязательно)' : 'Issuer identity evidence ref (optional)'}<input id="authorityIdentityEvidenceRef" placeholder="https://raw.githubusercontent.com/..."></label>
        <label class="wide">${ru ? 'Ожидаемый raw GitHub URL публикации' : 'Expected raw GitHub publication URL'}<input id="authorityPublicationUrl" placeholder="https://raw.githubusercontent.com/..."></label>
      </div>
      <div class="actions">
        <button id="createAuthorityEvidenceBtn" type="button" class="primary">${ru ? 'Создать подписанное authority evidence' : 'Create signed authority evidence'}</button>
        <button id="verifyAuthorityEvidenceBtn" type="button" disabled>${ru ? 'Проверить evidence' : 'Verify evidence'}</button>
        <button id="checkAuthorityPublicationBtn" type="button" disabled>${ru ? 'Проверить публикацию' : 'Check publication'}</button>
        <button id="downloadAuthorityEvidenceBtn" type="button" disabled>${ru ? 'Скачать Authority Evidence' : 'Download Authority Evidence'}</button>
      </div>
      <div class="actions">
        <label class="file-label" for="authorityEvidenceInput">${ru ? 'Загрузить Authority Evidence' : 'Load Authority Evidence'}</label>
        <input id="authorityEvidenceInput" type="file" accept="application/json,.json" hidden>
      </div>
      <div id="authorityEvidenceStatus" class="summary"></div>
    `;
    identityPanel.insertAdjacentElement('afterend', panel);

    let latestEnvelope = null;
    let activeRecord = null;
    const issuerIdentifier = panel.querySelector('#authorityIssuerIdentifier');
    const issuerDisplayName = panel.querySelector('#authorityIssuerDisplayName');
    const scope = panel.querySelector('#authorityScope');
    const target = panel.querySelector('#authorityTarget');
    const validFrom = panel.querySelector('#authorityValidFrom');
    const validUntil = panel.querySelector('#authorityValidUntil');
    const identityEvidenceRef = panel.querySelector('#authorityIdentityEvidenceRef');
    const publicationUrl = panel.querySelector('#authorityPublicationUrl');
    const createBtn = panel.querySelector('#createAuthorityEvidenceBtn');
    const verifyBtn = panel.querySelector('#verifyAuthorityEvidenceBtn');
    const checkBtn = panel.querySelector('#checkAuthorityPublicationBtn');
    const downloadBtn = panel.querySelector('#downloadAuthorityEvidenceBtn');
    const input = panel.querySelector('#authorityEvidenceInput');
    const status = panel.querySelector('#authorityEvidenceStatus');

    validFrom.value = localDateTimeValue(new Date());

    issuerIdentifier.addEventListener('input', () => {
      const id = issuerIdentifier.value.trim();
      if (!target.value.trim() || target.dataset.auto === 'true') {
        target.value = id ? `github:${id}/uu-aap` : '';
        target.dataset.auto = 'true';
      }
      if (!publicationUrl.value.trim() || publicationUrl.dataset.auto === 'true') {
        publicationUrl.value = defaultPublicationUrl(id);
        publicationUrl.dataset.auto = 'true';
      }
      if (!identityEvidenceRef.value.trim() || identityEvidenceRef.dataset.auto === 'true') {
        identityEvidenceRef.value = defaultIdentityEvidenceRef(id) || '';
        identityEvidenceRef.dataset.auto = 'true';
      }
    });
    target.addEventListener('input', () => { target.dataset.auto = 'false'; });
    publicationUrl.addEventListener('input', () => { publicationUrl.dataset.auto = 'false'; });
    identityEvidenceRef.addEventListener('input', () => { identityEvidenceRef.dataset.auto = 'false'; });

    function render(result) {
      const sig = result.signature_valid ? 'SIGNED AUTHORITY CLAIM VALID' : 'SIGNED AUTHORITY CLAIM INVALID';
      const active = result.active_subject_key_matches === true ? 'ACTIVE SUBJECT KEY MATCH' : result.active_subject_key_matches === false ? 'ACTIVE SUBJECT KEY MISMATCH' : 'ACTIVE SUBJECT KEY NOT CHECKED';
      const time = `TIME ${String(result.time_window_status || 'indeterminate').toUpperCase()}`;
      const publication = result.publication_match === true ? 'PUBLICATION MATCH' : result.publication_match === false ? 'PUBLICATION MISMATCH' : result.publication_error ? `PUBLICATION UNAVAILABLE (${result.publication_error})` : 'PUBLICATION NOT CHECKED';
      const evidence = result.authority_evidence_observed ? 'AUTHORITY EVIDENCE OBSERVED' : 'AUTHORITY EVIDENCE NOT ESTABLISHED';
      status.textContent = `${sig} · ${active} · ${time} · ${publication} · ${evidence} · ${ru ? 'issuer entitlement/verified authority не установлены' : 'issuer entitlement/verified authority not established'}`;
    }

    async function verify(fetchPublicationNow) {
      if (!latestEnvelope) return;
      activeRecord = await Continuity.loadPersistentKey();
      const result = await verifyAuthorityEvidenceEnvelope(latestEnvelope, {
        active_record: activeRecord,
        fetch_publication: Boolean(fetchPublicationNow)
      });
      if (result.errors.length) throw new Error(result.errors.join(' '));
      render(result);
    }

    createBtn.addEventListener('click', async () => {
      try {
        activeRecord = await Continuity.loadPersistentKey();
        if (!activeRecord) throw new Error(ru ? 'Сначала создайте persistent key в Level 4.0c.' : 'Create a persistent Level 4.0c key first.');
        latestEnvelope = await buildAuthorityEvidenceEnvelope({
          issuer_identifier: issuerIdentifier.value,
          issuer_display_name: issuerDisplayName.value,
          scope: scope.value,
          target: target.value,
          valid_from: isoFromLocal(validFrom.value),
          valid_until: isoFromLocal(validUntil.value),
          delegation_mode: DELEGATION_MODE,
          issuer_identity_evidence_ref: identityEvidenceRef.value,
          publication_url: publicationUrl.value
        }, activeRecord);
        verifyBtn.disabled = false;
        checkBtn.disabled = false;
        downloadBtn.disabled = false;
        await verify(false);
      } catch (error) { status.textContent = error.message; }
    });

    verifyBtn.addEventListener('click', async () => {
      try { await verify(false); } catch (error) { status.textContent = error.message; }
    });

    checkBtn.addEventListener('click', async () => {
      try { await verify(true); } catch (error) { status.textContent = error.message; }
    });

    downloadBtn.addEventListener('click', () => {
      if (!latestEnvelope) return;
      const suffix = latestEnvelope.authority_evidence_id.split(':').pop();
      downloadJson(`${suffix}.poai-authority.json`, latestEnvelope);
    });

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        latestEnvelope = JSON.parse(await file.text());
        const errors = validateAuthorityEvidenceEnvelope(latestEnvelope);
        if (errors.length) throw new Error(errors.join(' '));
        issuerIdentifier.value = latestEnvelope.issuer_claim.identifier || '';
        issuerDisplayName.value = latestEnvelope.issuer_claim.display_name || '';
        scope.value = latestEnvelope.authority_claim.scope || 'poai.successor.materialization.propose';
        target.value = latestEnvelope.authority_claim.target || '';
        target.dataset.auto = 'false';
        validFrom.value = localDateTimeValue(latestEnvelope.authority_claim.valid_from);
        validUntil.value = latestEnvelope.authority_claim.valid_until ? localDateTimeValue(latestEnvelope.authority_claim.valid_until) : '';
        identityEvidenceRef.value = latestEnvelope.issuer_evidence.identity_evidence_ref || '';
        identityEvidenceRef.dataset.auto = 'false';
        publicationUrl.value = latestEnvelope.expected_publication.url || '';
        publicationUrl.dataset.auto = 'false';
        verifyBtn.disabled = false;
        checkBtn.disabled = false;
        downloadBtn.disabled = false;
        await verify(false);
      } catch (error) {
        latestEnvelope = null;
        verifyBtn.disabled = true;
        checkBtn.disabled = true;
        downloadBtn.disabled = true;
        status.textContent = error.message;
      }
    });
  }

  function init() { ensureControls(); }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }

  return {
    ARTIFACT_TYPE,
    ARTIFACT_VERSION,
    SIGNATURE_PROFILE,
    STATEMENT_DOMAIN,
    PUBLICATION_METHOD,
    DELEGATION_MODE,
    normalizeScope,
    normalizeTarget,
    normalizeWindow,
    defaultPublicationUrl,
    defaultIdentityEvidenceRef,
    authorityStatement,
    buildAuthorityEvidenceEnvelope,
    validateAuthorityEvidenceEnvelope,
    evaluateTimeWindow,
    verifyAuthorityEvidenceEnvelope,
    publicationMatchesEnvelope,
    fetchPublication
  };
});
