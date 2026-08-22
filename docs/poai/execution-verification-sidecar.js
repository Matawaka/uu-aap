(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIExecutionVerificationSidecar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAIExecutionVerificationSidecar';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const RESULTS = new Set(['supported','partially_supported','contradicted','inconclusive','not_reviewed','unknown']);
  const METHODS = new Set(['document_review','system_log_review','witness_attestation','multi_source','other','unknown']);
  const PROHIBITED_KEYS = new Set([
    'decision_boundary','knowledge_cutoff','review_horizon','appeal_horizon','adjudication_horizon','execution_horizon',
    'score','percentage','rating','intelligence_score','trust_score'
  ]);

  function stableHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function isoTimestamp(value, label) {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) throw new Error(`${label || 'timestamp'} must be valid`);
    return d.toISOString();
  }
  function deepHasProhibitedKey(value) {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(deepHasProhibitedKey);
    for (const [k, v] of Object.entries(value)) {
      if (PROHIBITED_KEYS.has(k)) return true;
      if (deepHasProhibitedKey(v)) return true;
    }
    return false;
  }
  function cleanStrings(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))).sort();
  }

  function buildVerificationSidecar(record, options) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A source PoAI decision record object is required.');
    if (typeof record.record_id !== 'string' || !record.record_id) throw new Error('Source record_id is required.');
    const opts = options || {};
    const executionId = typeof opts.executionId === 'string' ? opts.executionId.trim() : '';
    if (!executionId.startsWith('urn:poai:execution:')) throw new Error('A valid execution_id is required.');
    const adjudicationId = typeof opts.adjudicationId === 'string' && opts.adjudicationId.trim() ? opts.adjudicationId.trim() : null;
    if (adjudicationId && !adjudicationId.startsWith('urn:poai:adjudication:')) throw new Error('adjudication_id is invalid.');
    const appealRequestId = typeof opts.appealRequestId === 'string' && opts.appealRequestId.trim() ? opts.appealRequestId.trim() : null;
    if (appealRequestId && !appealRequestId.startsWith('urn:poai:appeal:')) throw new Error('appeal_request_id is invalid.');
    const verifiedAt = isoTimestamp(opts.verifiedAt, 'verified_at');
    const evidenceCutoff = opts.evidenceCutoff ? isoTimestamp(opts.evidenceCutoff, 'verification evidence cutoff') : null;
    if (evidenceCutoff && Date.parse(evidenceCutoff) > Date.parse(verifiedAt)) throw new Error('verification evidence cutoff must not be later than verified_at');
    const verifierLabel = typeof opts.verifierLabel === 'string' && opts.verifierLabel.trim() ? opts.verifierLabel.trim() : null;
    const result = RESULTS.has(opts.result) ? opts.result : 'unknown';
    const method = METHODS.has(opts.method) ? opts.method : 'unknown';
    const notes = typeof opts.notes === 'string' && opts.notes.trim() ? opts.notes.trim() : null;
    const evidenceRefs = cleanStrings(opts.additionalEvidenceRefs);
    const seed = `${record.record_id}|${executionId}|${verifiedAt}|${result}|${method}`;

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      verification_id: `urn:poai:verification:${stableHash(seed)}`,
      verified_at: verifiedAt,
      decision_record_id: record.record_id,
      execution_id: executionId,
      adjudication_id: adjudicationId,
      appeal_request_id: appealRequestId,
      verifier: {
        declaration: verifierLabel ? 'self_declared' : 'undisclosed',
        label: verifierLabel,
        authority_status: 'unknown',
        independence_status: 'unknown'
      },
      verification_horizon: { evidence_cutoff: evidenceCutoff },
      verification_method: { code: method },
      declared_verification_result: { code: result, establishes_verified_execution: false },
      additional_evidence_refs: evidenceRefs,
      verification_notes: notes,
      source_validation: {
        status: opts.sourceValidationStatus === 'PASS' ? 'PASS' : 'unknown',
        profile: typeof record.profile === 'string' ? record.profile : null,
        truth_certified: false
      },
      claims: {
        verified_execution_established: false,
        verified_compliance_established: false,
        observed_outcome_established: false,
        truth_certified: false,
        causal_proof_certified: false,
        legal_effect_established: false,
        authority_determined: false,
        independence_determined: false,
        responsibility_determined: false,
        canonical_verdict_established: false
      },
      versioning: { verification_artifact_version: 1, previous_verification: null, successor_verification: null }
    };
  }

  function validateVerificationSidecar(sidecar) {
    const errors = [];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return ['Verification sidecar must be an object.'];
    if (sidecar.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAIExecutionVerificationSidecar.');
    if (sidecar.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof sidecar.verification_id !== 'string' || !sidecar.verification_id.startsWith('urn:poai:verification:')) errors.push('verification_id is invalid.');
    if (typeof sidecar.decision_record_id !== 'string' || !sidecar.decision_record_id) errors.push('decision_record_id is required.');
    if (typeof sidecar.execution_id !== 'string' || !sidecar.execution_id.startsWith('urn:poai:execution:')) errors.push('execution_id is invalid.');
    if (sidecar.adjudication_id && !sidecar.adjudication_id.startsWith('urn:poai:adjudication:')) errors.push('adjudication_id is invalid.');
    if (sidecar.appeal_request_id && !sidecar.appeal_request_id.startsWith('urn:poai:appeal:')) errors.push('appeal_request_id is invalid.');
    if (Number.isNaN(Date.parse(sidecar.verified_at))) errors.push('verified_at is invalid.');
    const cutoff = sidecar.verification_horizon && sidecar.verification_horizon.evidence_cutoff;
    if (cutoff && Number.isNaN(Date.parse(cutoff))) errors.push('verification_horizon.evidence_cutoff is invalid.');
    if (cutoff && !Number.isNaN(Date.parse(sidecar.verified_at)) && Date.parse(cutoff) > Date.parse(sidecar.verified_at)) errors.push('verification_horizon.evidence_cutoff must not be later than verified_at.');
    if (!sidecar.verifier || sidecar.verifier.authority_status !== 'unknown' || sidecar.verifier.independence_status !== 'unknown') errors.push('verifier authority_status and independence_status must remain unknown in this experiment.');
    if (!sidecar.verification_method || !METHODS.has(sidecar.verification_method.code)) errors.push('verification_method.code is invalid.');
    if (!sidecar.declared_verification_result || !RESULTS.has(sidecar.declared_verification_result.code) || sidecar.declared_verification_result.establishes_verified_execution !== false) errors.push('declared_verification_result must be valid and non-certifying.');
    if (deepHasProhibitedKey(sidecar)) errors.push('Verification sidecar contains a prohibited earlier-context or scalar-score key.');
    if (sidecar.claims && Object.values(sidecar.claims).some(v => v !== false)) errors.push('Verification sidecar must not establish execution/compliance, outcome, truth, causality, legal effect, authority, independence, responsibility, or a canonical verdict.');
    if (Object.prototype.hasOwnProperty.call(sidecar, 'protocol')) errors.push('Verification sidecar must not masquerade as a Genesis PoAI record.');
    return errors;
  }

  function currentLanguage() { return document.documentElement.lang === 'ru' ? 'ru' : 'en'; }
  function currentRecord() {
    const input = document.getElementById('jsonInput');
    const status = document.getElementById('statusBadge');
    if (!input || !status || !status.classList.contains('good')) return null;
    try { return JSON.parse(input.value); } catch (_) { return null; }
  }
  function toIsoFromLocal(value) { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  function downloadJson(filename, data) {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function ensureControls() {
    const panel = document.getElementById('reviewCuesPanel');
    if (!panel || panel.querySelector('#executionVerificationControls')) return;
    const ru = currentLanguage() === 'ru';
    const box = document.createElement('div');
    box.id = 'executionVerificationControls';
    box.className = 'review-sidecar-controls execution-verification-controls';
    box.innerHTML = `
      <div class="review-cues-kicker">${ru ? 'ЭКСПЕРИМЕНТАЛЬНАЯ ПРОВЕРКА ИСПОЛНЕНИЯ' : 'EXPERIMENTAL EXECUTION VERIFICATION'}</div>
      <div class="review-cues-title">${ru ? 'Отчёт о проверке Execution Sidecar' : 'Execution verification report'}</div>
      <div class="review-cues-note">${ru ? 'Фиксирует заявленный результат проверки, но не устанавливает доказанное исполнение, соответствие или наблюдаемый исход.' : 'Records a declared verification result but does not establish verified execution, compliance, or observed outcome.'}</div>
      <div class="review-sidecar-grid">
        <label><span>${ru ? 'Execution ID (обязательно)' : 'Execution ID (required)'}</span><input id="verificationExecutionId" type="text" placeholder="urn:poai:execution:..."></label>
        <label><span>${ru ? 'Adjudication ID (необязательно)' : 'Adjudication ID (optional)'}</span><input id="verificationAdjudicationId" type="text" placeholder="urn:poai:adjudication:..."></label>
        <label><span>${ru ? 'Appeal Request ID (необязательно)' : 'Appeal Request ID (optional)'}</span><input id="verificationAppealId" type="text" placeholder="urn:poai:appeal:..."></label>
        <label><span>${ru ? 'Проверяющий / роль (необязательно)' : 'Verifier / role (optional)'}</span><input id="verificationActor" type="text"></label>
        <label><span>${ru ? 'Метод проверки' : 'Verification method'}</span><select id="verificationMethod">
          <option value="system_log_review">system_log_review</option><option value="document_review">document_review</option><option value="witness_attestation">witness_attestation</option><option value="multi_source">multi_source</option><option value="other">other</option><option value="unknown">unknown</option>
        </select></label>
        <label><span>${ru ? 'Заявленный результат проверки' : 'Declared verification result'}</span><select id="verificationResult">
          <option value="supported">supported</option><option value="partially_supported">partially_supported</option><option value="contradicted">contradicted</option><option value="inconclusive">inconclusive</option><option value="not_reviewed">not_reviewed</option><option value="unknown">unknown</option>
        </select></label>
        <label><span>${ru ? 'Verification evidence cutoff (необязательно)' : 'Verification evidence cutoff (optional)'}</span><input id="verificationEvidenceCutoff" type="datetime-local"></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Примечание (необязательно)' : 'Note (optional)'}</span><input id="verificationNotes" type="text"></label>
      </div>
      <div class="actions"><button id="downloadVerificationBtn" type="button">${ru ? 'Скачать Verification Sidecar' : 'Download Verification Sidecar'}</button><span class="review-cues-note">${ru ? 'Заявленный результат проверки ≠ сертифицированный факт ≠ наблюдаемый исход.' : 'Declared verification result ≠ certified fact ≠ observed outcome.'}</span></div>`;
    panel.append(box);
    box.querySelector('#downloadVerificationBtn').addEventListener('click', () => {
      const record = currentRecord(); if (!record) return;
      try {
        const sidecar = buildVerificationSidecar(record, {
          executionId: box.querySelector('#verificationExecutionId').value,
          adjudicationId: box.querySelector('#verificationAdjudicationId').value,
          appealRequestId: box.querySelector('#verificationAppealId').value,
          verifierLabel: box.querySelector('#verificationActor').value,
          method: box.querySelector('#verificationMethod').value,
          result: box.querySelector('#verificationResult').value,
          evidenceCutoff: toIsoFromLocal(box.querySelector('#verificationEvidenceCutoff').value),
          notes: box.querySelector('#verificationNotes').value,
          sourceValidationStatus: 'PASS'
        });
        const errors = validateVerificationSidecar(sidecar); if (errors.length) { alert(errors.join('\n')); return; }
        downloadJson(`${stableHash(sidecar.decision_record_id)}.poai-verification.json`, sidecar);
      } catch (e) { alert(e.message || String(e)); }
    });
  }

  function initBrowser() {
    ensureControls();
    const target = document.querySelector('[data-panel="verifier"]');
    if (target) new MutationObserver(() => ensureControls()).observe(target, { childList: true, subtree: true });
    document.addEventListener('poai:languagechange', () => { const old = document.getElementById('executionVerificationControls'); if (old) old.remove(); ensureControls(); });
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser); else initBrowser(); }

  return Object.freeze({ ARTIFACT_TYPE, ARTIFACT_VERSION, RESULTS, METHODS, buildVerificationSidecar, validateVerificationSidecar, deepHasProhibitedKey, stableHash });
});
