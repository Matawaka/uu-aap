(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIExecutionSidecar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAIExecutionSidecar';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const STATUSES = new Set(['not_started','attempted','in_progress','completed','failed','blocked','unknown']);
  const DIRECTIVES = new Set(['reconsider','correct_record','review_evidence','review_authority','suspend_pending_review','issue_successor_record']);
  const PROHIBITED_KEYS = new Set(['decision_boundary','knowledge_cutoff','review_horizon','appeal_horizon','adjudication_horizon','score','percentage','rating','intelligence_score','trust_score']);

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

  function buildExecutionSidecar(record, options) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A source PoAI decision record object is required.');
    if (typeof record.record_id !== 'string' || !record.record_id) throw new Error('Source record_id is required.');
    const opts = options || {};
    const adjudicationId = typeof opts.adjudicationId === 'string' ? opts.adjudicationId.trim() : '';
    if (!adjudicationId.startsWith('urn:poai:adjudication:')) throw new Error('A valid adjudication_id is required.');
    const appealRequestId = typeof opts.appealRequestId === 'string' && opts.appealRequestId.trim() ? opts.appealRequestId.trim() : null;
    if (appealRequestId && !appealRequestId.startsWith('urn:poai:appeal:')) throw new Error('appeal_request_id is invalid.');
    const directive = DIRECTIVES.has(opts.directiveCode) ? opts.directiveCode : null;
    if (!directive) throw new Error('A valid directive_code is required.');
    const recordedAt = isoTimestamp(opts.recordedAt, 'recorded_at');
    const evidenceCutoff = opts.evidenceCutoff ? isoTimestamp(opts.evidenceCutoff, 'execution evidence cutoff') : null;
    if (evidenceCutoff && Date.parse(evidenceCutoff) > Date.parse(recordedAt)) throw new Error('execution evidence cutoff must not be later than recorded_at');
    const executorLabel = typeof opts.executorLabel === 'string' && opts.executorLabel.trim() ? opts.executorLabel.trim() : null;
    const status = STATUSES.has(opts.status) ? opts.status : 'unknown';
    const notes = typeof opts.notes === 'string' && opts.notes.trim() ? opts.notes.trim() : null;
    const evidenceRefs = cleanStrings(opts.additionalEvidenceRefs);
    const seed = `${record.record_id}|${adjudicationId}|${directive}|${recordedAt}|${status}`;

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      execution_id: `urn:poai:execution:${stableHash(seed)}`,
      recorded_at: recordedAt,
      decision_record_id: record.record_id,
      adjudication_id: adjudicationId,
      appeal_request_id: appealRequestId,
      directive_ref: { code: directive },
      executor: { declaration: executorLabel ? 'self_declared' : 'undisclosed', label: executorLabel, authority_status: 'unknown' },
      execution_horizon: { evidence_cutoff: evidenceCutoff },
      declared_execution_status: { code: status, establishes_verified_execution: false },
      additional_evidence_refs: evidenceRefs,
      execution_notes: notes,
      source_validation: { status: opts.sourceValidationStatus === 'PASS' ? 'PASS' : 'unknown', profile: typeof record.profile === 'string' ? record.profile : null, truth_certified: false },
      claims: {
        verified_execution_established: false,
        verified_compliance_established: false,
        observed_outcome_established: false,
        truth_certified: false,
        causal_proof_certified: false,
        legal_effect_established: false,
        authority_determined: false,
        responsibility_determined: false,
        canonical_verdict_established: false
      },
      versioning: { execution_artifact_version: 1, previous_execution: null, successor_execution: null }
    };
  }

  function validateExecutionSidecar(sidecar) {
    const errors = [];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return ['Execution sidecar must be an object.'];
    if (sidecar.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAIExecutionSidecar.');
    if (sidecar.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof sidecar.execution_id !== 'string' || !sidecar.execution_id.startsWith('urn:poai:execution:')) errors.push('execution_id is invalid.');
    if (typeof sidecar.decision_record_id !== 'string' || !sidecar.decision_record_id) errors.push('decision_record_id is required.');
    if (typeof sidecar.adjudication_id !== 'string' || !sidecar.adjudication_id.startsWith('urn:poai:adjudication:')) errors.push('adjudication_id is invalid.');
    if (sidecar.appeal_request_id && !sidecar.appeal_request_id.startsWith('urn:poai:appeal:')) errors.push('appeal_request_id is invalid.');
    if (Number.isNaN(Date.parse(sidecar.recorded_at))) errors.push('recorded_at is invalid.');
    const cutoff = sidecar.execution_horizon && sidecar.execution_horizon.evidence_cutoff;
    if (cutoff && Number.isNaN(Date.parse(cutoff))) errors.push('execution_horizon.evidence_cutoff is invalid.');
    if (cutoff && !Number.isNaN(Date.parse(sidecar.recorded_at)) && Date.parse(cutoff) > Date.parse(sidecar.recorded_at)) errors.push('execution_horizon.evidence_cutoff must not be later than recorded_at.');
    if (!sidecar.directive_ref || !DIRECTIVES.has(sidecar.directive_ref.code)) errors.push('directive_ref.code is invalid.');
    if (!sidecar.executor || sidecar.executor.authority_status !== 'unknown') errors.push('executor authority_status must remain unknown in this experiment.');
    if (!sidecar.declared_execution_status || !STATUSES.has(sidecar.declared_execution_status.code) || sidecar.declared_execution_status.establishes_verified_execution !== false) errors.push('declared_execution_status must be valid and non-verifying.');
    if (deepHasProhibitedKey(sidecar)) errors.push('Execution sidecar contains a prohibited earlier-context or scalar-score key.');
    if (sidecar.claims && Object.values(sidecar.claims).some(v => v !== false)) errors.push('Execution sidecar must not establish verified execution/compliance, outcome, truth, causality, legal effect, authority, responsibility, or a canonical verdict.');
    if (Object.prototype.hasOwnProperty.call(sidecar, 'protocol')) errors.push('Execution sidecar must not masquerade as a Genesis PoAI record.');
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
    if (!panel || panel.querySelector('#executionSidecarControls')) return;
    const ru = currentLanguage() === 'ru';
    const box = document.createElement('div');
    box.id = 'executionSidecarControls';
    box.className = 'review-sidecar-controls execution-sidecar-controls';
    box.innerHTML = `
      <div class="review-cues-kicker">${ru ? 'ЭКСПЕРИМЕНТАЛЬНОЕ ИСПОЛНЕНИЕ' : 'EXPERIMENTAL EXECUTION / COMPLIANCE'}</div>
      <div class="review-cues-title">${ru ? 'Отчёт об исполнении директивы' : 'Execution / compliance report'}</div>
      <div class="review-cues-note">${ru ? 'Фиксирует заявленный статус исполнения, но не доказывает проверенное исполнение, соответствие или исход.' : 'Records a declared execution status but does not prove verified execution, compliance, or outcome.'}</div>
      <div class="review-sidecar-grid">
        <label><span>${ru ? 'Adjudication ID (обязательно)' : 'Adjudication ID (required)'}</span><input id="executionAdjudicationId" type="text" placeholder="urn:poai:adjudication:..."></label>
        <label><span>${ru ? 'Appeal Request ID (необязательно)' : 'Appeal Request ID (optional)'}</span><input id="executionAppealId" type="text" placeholder="urn:poai:appeal:..."></label>
        <label><span>${ru ? 'Исполнитель / роль (необязательно)' : 'Executor / role (optional)'}</span><input id="executionActor" type="text"></label>
        <label><span>${ru ? 'Директива' : 'Directive'}</span><select id="executionDirective">
          <option value="suspend_pending_review">suspend_pending_review</option>
          <option value="reconsider">reconsider</option>
          <option value="correct_record">correct_record</option>
          <option value="review_evidence">review_evidence</option>
          <option value="review_authority">review_authority</option>
          <option value="issue_successor_record">issue_successor_record</option>
        </select></label>
        <label><span>${ru ? 'Заявленный статус исполнения' : 'Declared execution status'}</span><select id="executionStatus">
          <option value="unknown">unknown</option><option value="not_started">not_started</option><option value="attempted">attempted</option><option value="in_progress">in_progress</option><option value="completed">completed</option><option value="failed">failed</option><option value="blocked">blocked</option>
        </select></label>
        <label><span>${ru ? 'Execution evidence cutoff (необязательно)' : 'Execution evidence cutoff (optional)'}</span><input id="executionEvidenceCutoff" type="datetime-local"></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Примечание (необязательно)' : 'Note (optional)'}</span><input id="executionNotes" type="text"></label>
      </div>
      <div class="actions"><button id="downloadExecutionBtn" type="button">${ru ? 'Скачать Execution Sidecar' : 'Download Execution Sidecar'}</button><span class="review-cues-note">${ru ? 'Заявленное исполнение ≠ проверенное исполнение ≠ наблюдаемый исход.' : 'Declared execution ≠ verified execution ≠ observed outcome.'}</span></div>`;
    panel.append(box);
    box.querySelector('#downloadExecutionBtn').addEventListener('click', () => {
      const record = currentRecord(); if (!record) return;
      try {
        const sidecar = buildExecutionSidecar(record, {
          adjudicationId: box.querySelector('#executionAdjudicationId').value,
          appealRequestId: box.querySelector('#executionAppealId').value,
          executorLabel: box.querySelector('#executionActor').value,
          directiveCode: box.querySelector('#executionDirective').value,
          status: box.querySelector('#executionStatus').value,
          evidenceCutoff: toIsoFromLocal(box.querySelector('#executionEvidenceCutoff').value),
          notes: box.querySelector('#executionNotes').value,
          sourceValidationStatus: 'PASS'
        });
        const errors = validateExecutionSidecar(sidecar); if (errors.length) { alert(errors.join('\n')); return; }
        downloadJson(`${stableHash(sidecar.decision_record_id)}.poai-execution.json`, sidecar);
      } catch (e) { alert(e.message || String(e)); }
    });
  }

  function initBrowser() {
    ensureControls();
    const target = document.querySelector('[data-panel="verifier"]');
    if (target) new MutationObserver(() => ensureControls()).observe(target, { childList: true, subtree: true });
    document.addEventListener('poai:languagechange', () => { const old = document.getElementById('executionSidecarControls'); if (old) old.remove(); ensureControls(); });
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser); else initBrowser(); }

  return Object.freeze({ ARTIFACT_TYPE, ARTIFACT_VERSION, STATUSES, DIRECTIVES, buildExecutionSidecar, validateExecutionSidecar, deepHasProhibitedKey, stableHash });
});