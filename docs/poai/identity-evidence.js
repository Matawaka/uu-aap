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
  const api = factory(bindingApi, signatureApi, continuityApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIIdentityEvidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Binding, Signature, Continuity) {
  'use strict';

  if (!Binding) throw new Error('PoAIBindingReceipt is required before PoAIIdentityEvidence.');
  if (!Signature) throw new Error('PoAISignatureEnvelope is required before PoAIIdentityEvidence.');
  if (!Continuity) throw new Error('PoAIKeyContinuity is required before PoAIIdentityEvidence.');

  const ARTIFACT_TYPE = 'PoAIIdentityEvidenceEnvelope';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const SIGNATURE_PROFILE = 'PoAI-Ed25519-JCS-IdentityEvidence-v0.1';
  const STATEMENT_DOMAIN = 'urn:poai:identity-claim:v0.1';
  const CLAIM_NAMESPACE = 'github';
  const PUBLICATION_METHOD = 'github_repository_publication';

  function webCrypto() {
    if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
    if (typeof require === 'function') return require('crypto').webcrypto;
    throw new Error('WebCrypto is unavailable.');
  }

  function normalizeGithubIdentifier(value) {
    const text = String(value || '').trim();
    if (!text) throw new Error('GitHub identifier is required.');
    if (text.length > 39) throw new Error('GitHub identifier is too long.');
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(text)) {
      throw new Error('GitHub identifier contains unsupported characters.');
    }
    return text;
  }

  function parseGithubRawPublication(urlValue, expectedIdentifier) {
    const raw = String(urlValue || '').trim();
    if (!raw) throw new Error('Publication URL is required.');
    let url;
    try { url = new URL(raw); } catch (_) { throw new Error('Publication URL is invalid.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com') {
      throw new Error('Publication URL must use https://raw.githubusercontent.com/.');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 4) throw new Error('GitHub raw publication URL must include owner, repository, ref, and path.');
    const owner = parts[0];
    const repository = parts[1];
    const ref = parts[2];
    const path = parts.slice(3).join('/');
    if (expectedIdentifier && owner.toLowerCase() !== String(expectedIdentifier).toLowerCase()) {
      throw new Error('Publication owner must match the claimed GitHub identifier.');
    }
    return { url: url.toString(), owner, repository, ref, path };
  }

  function identityStatement(record, input, createdAt) {
    const metadata = record.metadata;
    const identifier = normalizeGithubIdentifier(input.identifier);
    const publication = parseGithubRawPublication(input.publication_url, identifier);
    const displayName = String(input.display_name || '').trim() || null;
    const canonicalIdentifier = `github:${identifier}`;

    return {
      domain: STATEMENT_DOMAIN,
      signature_profile: SIGNATURE_PROFILE,
      created_at: createdAt,
      purpose: 'bind_persistent_key_to_external_identifier_claim',
      subject_claim: {
        namespace: CLAIM_NAMESPACE,
        identifier,
        canonical_identifier: canonicalIdentifier,
        account_url: `https://github.com/${identifier}`,
        display_name: displayName,
        claim_status: 'self_asserted'
      },
      verification_key: {
        algorithm: 'Ed25519',
        key_id: metadata.key_id,
        jwk_thumbprint_algorithm: metadata.jwk_thumbprint_algorithm,
        jwk_thumbprint: metadata.jwk_thumbprint,
        public_key_jwk: metadata.public_key_jwk
      },
      key_continuity: {
        key_id: metadata.key_id,
        continuity_status: metadata.continuity_status,
        continuity_epoch: metadata.continuity_epoch,
        previous_key_thumbprint: metadata.previous_key_thumbprint,
        private_key_extractable: false
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

  async function buildIdentityEvidenceEnvelope(input, activeRecord) {
    const record = await Continuity.normalizeStoredRecord(activeRecord || await Continuity.loadPersistentKey());
    if (!record) throw new Error('A persistent Level 4.0c signer key is required.');
    const createdAt = new Date().toISOString();
    const statement = identityStatement(record, input || {}, createdAt);
    const statementBytes = Binding.utf8Bytes(Binding.canonicalize(statement, '$'));
    const signatureBytes = new Uint8Array(
      await webCrypto().subtle.sign({ name: 'Ed25519' }, record.privateKey, statementBytes)
    );
    const signatureValue = Signature.base64urlEncode(signatureBytes);
    const idSeed = `${statement.subject_claim.canonical_identifier}|${record.metadata.jwk_thumbprint}|${signatureValue}`;
    const idDigest = await Binding.sha256Hex(Binding.utf8Bytes(idSeed));

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      identity_evidence_id: `urn:poai:identity-evidence:${idDigest.slice(0, 16)}`,
      created_at: createdAt,
      subject_claim: statement.subject_claim,
      verification_method: {
        key_format: 'JWK',
        public_key_jwk: record.metadata.public_key_jwk,
        jwk_thumbprint_algorithm: record.metadata.jwk_thumbprint_algorithm,
        jwk_thumbprint: record.metadata.jwk_thumbprint,
        key_id: record.metadata.key_id,
        signer_identity_status: 'claimed_not_verified',
        signer_authority_status: 'unknown',
        materialization_authority_status: 'unknown'
      },
      key_continuity: statement.key_continuity,
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
        signed_identity_claim_present: true,
        account_control_evidence_established: false,
        human_identity_verified: false,
        organization_identity_verified: false,
        signer_identity_verified: false,
        signer_authority_verified: false,
        materialization_authority_verified: false,
        truth_certified: false,
        responsibility_determined: false,
        legal_effect_established: false,
        canonical_successor_established: false,
        poai_v_conformance_established: false
      },
      notes: 'Experimental signed external-identifier claim. A valid signature or matching public repository publication does not establish human/legal identity, organization identity, authority, truth, responsibility, canonical successor status, or PoAI/V.'
    };
  }

  function validateIdentityEvidenceEnvelope(envelope) {
    const errors = [];
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return ['Identity Evidence Envelope must be an object.'];
    }
    if (envelope.artifact_type !== ARTIFACT_TYPE) errors.push(`artifact_type must be ${ARTIFACT_TYPE}.`);
    if (envelope.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (!envelope.identity_evidence_id || typeof envelope.identity_evidence_id !== 'string') errors.push('identity_evidence_id is required.');

    const claim = envelope.subject_claim || {};
    if (claim.namespace !== CLAIM_NAMESPACE) errors.push(`subject_claim.namespace must be ${CLAIM_NAMESPACE}.`);
    try { normalizeGithubIdentifier(claim.identifier); } catch (error) { errors.push(error.message); }
    if (claim.canonical_identifier !== `github:${claim.identifier || ''}`) errors.push('canonical_identifier must match the GitHub identifier.');
    if (claim.claim_status !== 'self_asserted') errors.push('claim_status must remain self_asserted in 4.0d.');

    const vm = envelope.verification_method || {};
    if (!vm.public_key_jwk || vm.public_key_jwk.kty !== 'OKP' || vm.public_key_jwk.crv !== 'Ed25519' || typeof vm.public_key_jwk.x !== 'string') {
      errors.push('Public JWK must be OKP/Ed25519.');
    }
    if (vm.public_key_jwk && Object.prototype.hasOwnProperty.call(vm.public_key_jwk, 'd')) errors.push('Private key material must not appear in the envelope.');
    if (vm.signer_identity_status !== 'claimed_not_verified') errors.push('signer_identity_status must remain claimed_not_verified in 4.0d.');
    if (vm.signer_authority_status !== 'unknown' || vm.materialization_authority_status !== 'unknown') {
      errors.push('Authority statuses must remain unknown in 4.0d.');
    }

    const continuity = envelope.key_continuity || {};
    if (continuity.continuity_status !== 'locally_established') errors.push('key_continuity must remain locally_established.');
    if (continuity.private_key_extractable !== false) errors.push('private_key_extractable must be false.');
    if (!Number.isInteger(continuity.continuity_epoch) || continuity.continuity_epoch < 1) errors.push('continuity_epoch must be a positive integer.');

    const publication = envelope.expected_publication || {};
    if (publication.method !== PUBLICATION_METHOD) errors.push(`expected_publication.method must be ${PUBLICATION_METHOD}.`);
    try {
      const parsed = parseGithubRawPublication(publication.url, claim.identifier);
      if (parsed.owner !== publication.github_owner || parsed.repository !== publication.github_repository || parsed.ref !== publication.git_ref || parsed.path !== publication.repository_path) {
        errors.push('expected_publication metadata does not match its URL.');
      }
    } catch (error) { errors.push(error.message); }

    if (!envelope.signed_statement || typeof envelope.signed_statement !== 'object') {
      errors.push('signed_statement is required.');
    } else {
      const signed = envelope.signed_statement;
      if (Binding.canonicalize(signed.subject_claim || {}, '$') !== Binding.canonicalize(claim, '$')) errors.push('Top-level subject_claim must match signed_statement.subject_claim.');
      if (Binding.canonicalize(signed.key_continuity || {}, '$') !== Binding.canonicalize(continuity, '$')) errors.push('Top-level key_continuity must match signed_statement.key_continuity.');
      if (Binding.canonicalize(signed.expected_publication || {}, '$') !== Binding.canonicalize(publication, '$')) errors.push('Top-level expected_publication must match signed_statement.expected_publication.');
      if (!signed.verification_key || signed.verification_key.jwk_thumbprint !== vm.jwk_thumbprint || signed.verification_key.key_id !== vm.key_id) {
        errors.push('Signed verification key metadata must match verification_method.');
      }
    }

    if (!envelope.signature || envelope.signature.algorithm !== 'Ed25519' || envelope.signature.encoding !== 'base64url' || typeof envelope.signature.value !== 'string') {
      errors.push('Ed25519 base64url signature is required.');
    }

    const claims = envelope.claims || {};
    if (claims.signature_present !== true || claims.local_key_continuity_established !== true || claims.signed_identity_claim_present !== true) {
      errors.push('Signature, continuity, and signed identity claim flags must be true.');
    }
    [
      'account_control_evidence_established',
      'human_identity_verified',
      'organization_identity_verified',
      'signer_identity_verified',
      'signer_authority_verified',
      'materialization_authority_verified',
      'truth_certified',
      'responsibility_determined',
      'legal_effect_established',
      'canonical_successor_established',
      'poai_v_conformance_established'
    ].forEach((field) => {
      if (claims[field] !== false) errors.push(`${field} must remain false in the 4.0d envelope.`);
    });

    if (Object.prototype.hasOwnProperty.call(envelope, 'protocol')) errors.push('Identity Evidence Envelope must not masquerade as a Genesis PoAI record.');
    return errors;
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
    } catch (_) {
      signatureValid = false;
    }

    let activeKeyMatches = null;
    if (activeRecord) {
      const normalized = await Continuity.normalizeStoredRecord(activeRecord);
      activeKeyMatches = normalized.metadata.jwk_thumbprint === envelope.verification_method.jwk_thumbprint;
    }
    return {
      cryptographic_signature_valid: Boolean(signatureValid),
      key_thumbprint_matches: Boolean(thumbprintMatches),
      signature_valid: Boolean(signatureValid && thumbprintMatches),
      active_local_key_matches: activeKeyMatches
    };
  }

  function publicationMatchesEnvelope(envelope, publishedValue) {
    if (!publishedValue || typeof publishedValue !== 'object' || Array.isArray(publishedValue)) return false;
    try {
      return Binding.canonicalize(envelope, '$') === Binding.canonicalize(publishedValue, '$');
    } catch (_) {
      return false;
    }
  }

  async function fetchPublication(urlValue) {
    const publication = parseGithubRawPublication(urlValue);
    if (typeof fetch !== 'function') throw new Error('Fetch is unavailable in this environment.');
    const response = await fetch(publication.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Publication fetch failed with HTTP ${response.status}.`);
    const text = await response.text();
    let value;
    try { value = JSON.parse(text); } catch (_) { throw new Error('Published evidence is not valid JSON.'); }
    return { value, publication };
  }

  async function verifyIdentityEvidenceEnvelope(envelope, options) {
    const errors = validateIdentityEvidenceEnvelope(envelope);
    if (errors.length) {
      return {
        signature_valid: false,
        active_local_key_matches: null,
        publication_match: null,
        publication_observed: false,
        account_control_evidence_observed: false,
        human_identity_verified: false,
        signer_authority_verified: false,
        errors
      };
    }

    const opts = options || {};
    const keyResult = await verifySignatureAndKey(envelope, opts.active_record || null);
    let publicationMatch = null;
    let publicationObserved = false;
    let publicationError = null;
    let publishedValue = opts.published_value;

    if (publishedValue === undefined && opts.fetch_publication) {
      try {
        const fetched = await fetchPublication(envelope.expected_publication.url);
        publishedValue = fetched.value;
        publicationObserved = true;
      } catch (error) {
        publicationError = error.message;
      }
    } else if (publishedValue !== undefined) {
      publicationObserved = true;
    }

    if (publicationObserved) publicationMatch = publicationMatchesEnvelope(envelope, publishedValue);

    return {
      signature_valid: keyResult.signature_valid,
      cryptographic_signature_valid: keyResult.cryptographic_signature_valid,
      key_thumbprint_matches: keyResult.key_thumbprint_matches,
      active_local_key_matches: keyResult.active_local_key_matches,
      publication_observed: publicationObserved,
      publication_match: publicationMatch,
      publication_error: publicationError,
      account_control_evidence_observed: Boolean(keyResult.signature_valid && publicationObserved && publicationMatch),
      human_identity_verified: false,
      organization_identity_verified: false,
      signer_identity_verified: false,
      signer_authority_verified: false,
      materialization_authority_verified: false,
      errors: []
    };
  }

  function currentLanguage() { return document.documentElement.lang === 'ru' ? 'ru' : 'en'; }

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

  function defaultPublicationUrl(identifier) {
    const id = String(identifier || '').trim();
    if (!id) return '';
    return `https://raw.githubusercontent.com/${id}/uu-aap/main/proposals/poai/identity-evidence/github/${id}.poai-identity.json`;
  }

  function ensureControls() {
    if (typeof document === 'undefined' || document.getElementById('identityEvidencePanel')) return;
    const continuityPanel = document.getElementById('keyContinuityPanel');
    if (!continuityPanel) return;
    const ru = currentLanguage() === 'ru';
    const panel = document.createElement('section');
    panel.id = 'identityEvidencePanel';
    panel.className = 'panel identity-evidence-panel';
    panel.innerHTML = `
      <div class="panel-head">
        <div><p class="eyebrow">PoAI · LEVEL 4.0d</p><h2>${ru ? 'Подписанное доказательство идентификатора' : 'Signed identity evidence'}</h2></div>
        <span class="badge neutral">${ru ? 'CLAIM/EVIDENCE · НЕ LEGAL IDENTITY' : 'CLAIM/EVIDENCE · NOT LEGAL IDENTITY'}</span>
      </div>
      <p class="summary">${ru ? 'Связывает persistent key с заявленным внешним идентификатором. Публичная публикация может дать наблюдаемое evidence контроля аккаунта/репозитория, но не доказывает человеческую или юридическую личность и не создаёт полномочия.' : 'Binds the persistent key to a claimed external identifier. Public publication can provide observable account/repository-control evidence, but does not prove human/legal identity or create authority.'}</p>
      <div class="form-grid compact">
        <label>${ru ? 'Пространство идентификатора' : 'Identifier namespace'}<select id="identityNamespace"><option value="github">github</option></select></label>
        <label>${ru ? 'GitHub identifier' : 'GitHub identifier'}<input id="identityIdentifier" placeholder="Matawaka"></label>
        <label class="wide">${ru ? 'Отображаемое имя (необязательно)' : 'Display name (optional)'}<input id="identityDisplayName" placeholder="Dmitrii Kuznetsov"></label>
        <label class="wide">${ru ? 'Ожидаемый raw GitHub URL публикации' : 'Expected raw GitHub publication URL'}<input id="identityPublicationUrl" placeholder="https://raw.githubusercontent.com/..."></label>
      </div>
      <div class="actions">
        <button id="createIdentityClaimBtn" type="button" class="primary">${ru ? 'Создать подписанный identity claim' : 'Create signed identity claim'}</button>
        <button id="verifyIdentityClaimBtn" type="button" disabled>${ru ? 'Проверить claim' : 'Verify claim'}</button>
        <button id="checkIdentityPublicationBtn" type="button" disabled>${ru ? 'Проверить публикацию' : 'Check publication'}</button>
        <button id="downloadIdentityEvidenceBtn" type="button" disabled>${ru ? 'Скачать Identity Evidence' : 'Download Identity Evidence'}</button>
      </div>
      <div class="actions">
        <label class="file-label" for="identityEvidenceInput">${ru ? 'Загрузить Identity Evidence' : 'Load Identity Evidence'}</label>
        <input id="identityEvidenceInput" type="file" accept="application/json,.json" hidden>
      </div>
      <div id="identityEvidenceStatus" class="summary"></div>
    `;
    continuityPanel.insertAdjacentElement('afterend', panel);

    let latestEnvelope = null;
    let activeRecord = null;
    const namespace = panel.querySelector('#identityNamespace');
    const identifier = panel.querySelector('#identityIdentifier');
    const displayName = panel.querySelector('#identityDisplayName');
    const publicationUrl = panel.querySelector('#identityPublicationUrl');
    const createBtn = panel.querySelector('#createIdentityClaimBtn');
    const verifyBtn = panel.querySelector('#verifyIdentityClaimBtn');
    const checkBtn = panel.querySelector('#checkIdentityPublicationBtn');
    const downloadBtn = panel.querySelector('#downloadIdentityEvidenceBtn');
    const input = panel.querySelector('#identityEvidenceInput');
    const status = panel.querySelector('#identityEvidenceStatus');

    identifier.addEventListener('input', () => {
      if (!publicationUrl.value.trim() || publicationUrl.dataset.auto === 'true') {
        publicationUrl.value = defaultPublicationUrl(identifier.value);
        publicationUrl.dataset.auto = 'true';
      }
    });
    publicationUrl.addEventListener('input', () => { publicationUrl.dataset.auto = 'false'; });

    function render(result) {
      const sig = result.signature_valid ? 'SIGNED CLAIM VALID' : 'SIGNED CLAIM INVALID';
      const active = result.active_local_key_matches === true ? 'ACTIVE KEY MATCH' : result.active_local_key_matches === false ? 'ACTIVE KEY MISMATCH' : 'ACTIVE KEY NOT CHECKED';
      const publication = result.publication_match === true
        ? 'PUBLICATION MATCH'
        : result.publication_match === false
          ? 'PUBLICATION MISMATCH'
          : result.publication_error
            ? `PUBLICATION UNAVAILABLE (${result.publication_error})`
            : 'PUBLICATION NOT CHECKED';
      const evidence = result.account_control_evidence_observed ? 'ACCOUNT-CONTROL EVIDENCE OBSERVED' : 'ACCOUNT-CONTROL EVIDENCE NOT ESTABLISHED';
      status.textContent = `${sig} · ${active} · ${publication} · ${evidence} · ${ru ? 'human identity/authority не установлены' : 'human identity/authority not established'}`;
    }

    async function verify(fetchPublicationNow) {
      if (!latestEnvelope) return;
      activeRecord = await Continuity.loadPersistentKey();
      const result = await verifyIdentityEvidenceEnvelope(latestEnvelope, {
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
        latestEnvelope = await buildIdentityEvidenceEnvelope({
          namespace: namespace.value,
          identifier: identifier.value,
          display_name: displayName.value,
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
      const suffix = latestEnvelope.identity_evidence_id.split(':').pop();
      downloadJson(`${suffix}.poai-identity.json`, latestEnvelope);
    });

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        latestEnvelope = JSON.parse(await file.text());
        const errors = validateIdentityEvidenceEnvelope(latestEnvelope);
        if (errors.length) throw new Error(errors.join(' '));
        identifier.value = latestEnvelope.subject_claim.identifier || '';
        displayName.value = latestEnvelope.subject_claim.display_name || '';
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
    CLAIM_NAMESPACE,
    PUBLICATION_METHOD,
    normalizeGithubIdentifier,
    parseGithubRawPublication,
    identityStatement,
    buildIdentityEvidenceEnvelope,
    validateIdentityEvidenceEnvelope,
    verifyIdentityEvidenceEnvelope,
    publicationMatchesEnvelope,
    fetchPublication,
    defaultPublicationUrl
  };
});