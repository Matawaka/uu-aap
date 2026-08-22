(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIObservedOutcomeSidecar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAIObservedOutcomeSidecar';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const OUTCOME_STATUSES = new Set([
    'not_yet_observable',
    'realized',
    'not_realized_without_intervention',
    'not_realized_after_intervention',
    'indeterminate',
    'not_applicable'
  ]);
  const METHODS = new Set(['system_record','direct_observation','document_review','multi_source','other','unknown']);
  const CAUSAL_STATUSES = new Set(['not_assessed','associated_not_proven','disputed','unknown']);
  const PROHIBITED_KEYS = new Set([
    'decision_boundary','knowledge_cutoff','review_horizon','appeal_horizon','adjudication_horizon','execution_horizon','verification_horizon',
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

  function cleanStrings(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))).sort();
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

  function buildOutcomeSidecar(record, options) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A source PoAI decision record object is required.');
    if (typeof record.record_id !== 'string' || !record.record_id) throw new Error('Source record_id is required.');
    const opts = options || {};
    const observedAt = isoTimestamp(opts.observedAt, 'observed_at');
    const evidenceCutoff = opts.evidenceCutoff ? isoTimestamp(opts.evidenceCutoff, 'outcome evidence cutoff') : null;
    if (evidenceCutoff && Date.parse(evidenceCutoff) > Date.parse(observedAt)) throw new Error('outcome evidence cutoff must not be later than observed_at');

    const status = OUTCOME_STATUSES.has(opts.outcomeStatus) ? opts.outcomeStatus : 'indeterminate';
    const method = METHODS.has(opts.method) ? opts.method : 'unknown';
    const causalStatus = CAUSAL_STATUSES.has(opts.causalStatus) ? opts.causalStatus : 'unknown';
    const observerLabel = typeof opts.observerLabel === 'string' && opts.observerLabel.trim() ? opts.observerLabel.trim() : null;
    const futureTargetId = typeof opts.futureTargetId === 'string' && opts.futureTargetId.trim() ? opts.futureTargetId.trim() : null;
    const executionIds = cleanStrings(opts.executionIds).filter(v => v.startsWith('urn:poai:execution:'));
    const verificationIds = cleanStrings(opts.verificationIds).filter(v => v.startsWith('urn:poai:verification:'));
    const interventionRefs = cleanStrings(opts.interventionRefs);
    const allInterventionRefs = Array.from(new Set([...interventionRefs, ...executionIds])).sort();

    if (status === 'not_realized_after_intervention' && allInterventionRefs.length === 0) {
      throw new Error('not_realized_after_intervention requires at least one intervention or execution provenance reference');
    }
    if (causalStatus === 'associated_not_proven' && allInterventionRefs.length === 0) {
      throw new Error('associated_not_proven requires at least one intervention or execution provenance reference');
    }

    const notes = typeof opts.notes === 'string' && opts.notes.trim() ? opts.notes.trim() : null;
    const evidenceRefs = cleanStrings(opts.additionalEvidenceRefs);
    const seed = `${record.record_id}|${observedAt}|${status}|${method}|${futureTargetId || ''}|${executionIds.join(',')}|${verificationIds.join(',')}`;

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      observation_id: `urn:poai:outcome-observation:${stableHash(seed)}`,
      observed_at: observedAt,
      decision_record_id: record.record_id,
      future_target_id: futureTargetId,
      source_refs: {
        execution_ids: executionIds,
        verification_ids: verificationIds
      },
      observer: {
        declaration: observerLabel ? 'self_declared' : 'undisclosed',
        label: observerLabel,
        authority_status: 'unknown',
        independence_status: 'unknown'
      },
      observation_horizon: { evidence_cutoff: evidenceCutoff },
      observation_method: { code: method },
      declared_outcome: {
        status,
        establishes_observed_outcome: false
      },
      intervention_refs: allInterventionRefs,
      causal_status: {
        code: causalStatus,
        establishes_causal_proof: false
      },
      additional_evidence_refs: evidenceRefs,
      observation_notes: notes,
      source_validation: {
        status: opts.sourceValidationStatus === 'PASS' ? 'PASS' : 'unknown',
        profile: typeof record.profile === 'string' ? record.profile : null,
        truth_certified: false
      },
      claims: {
        observed_outcome_established: false,
        verified_execution_established: false,
        verified_compliance_established: false,
        truth_certified: false,
        causal_proof_certified: false,
        legal_effect_established: false,
        authority_determined: false,
        independence_determined: false,
        responsibility_determined: false,
        canonical_outcome_established: false,
        canonical_verdict_established: false
      },
      versioning: {
        outcome_artifact_version: 1,
        previous_outcome_observation: null,
        successor_outcome_observation: null
      }
    };
  }

  function validateOutcomeSidecar(sidecar) {
    const errors = [];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return ['Outcome sidecar must be an object.'];
    if (sidecar.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAIObservedOutcomeSidecar.');
    if (sidecar.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof sidecar.observation_id !== 'string' || !sidecar.observation_id.startsWith('urn:poai:outcome-observation:')) errors.push('observation_id is invalid.');
    if (typeof sidecar.decision_record_id !== 'string' || !sidecar.decision_record_id) errors.push('decision_record_id is required.');
    if (Number.isNaN(Date.parse(sidecar.observed_at))) errors.push('observed_at is invalid.');
    const cutoff = sidecar.observation_horizon && sidecar.observation_horizon.evidence_cutoff;
    if (cutoff && Number.isNaN(Date.parse(cutoff))) errors.push('observation_horizon.evidence_cutoff is invalid.');
    if (cutoff && !Number.isNaN(Date.parse(sidecar.observed_at)) && Date.parse(cutoff) > Date.parse(sidecar.observed_at)) errors.push('observation_horizon.evidence_cutoff must not be later than observed_at.');
    if (!sidecar.observer || sidecar.observer.authority_status !== 'unknown' || sidecar.observer.independence_status !== 'unknown') errors.push('observer authority_status and independence_status must remain unknown in this experiment.');
    if (!sidecar.observation_method || !METHODS.has(sidecar.observation_method.code)) errors.push('observation_method.code is invalid.');
    if (!sidecar.declared_outcome || !OUTCOME_STATUSES.has(sidecar.declared_outcome.status) || sidecar.declared_outcome.establishes_observed_outcome !== false) errors.push('declared_outcome must use the Genesis outcome vocabulary and remain non-certifying.');
    if (!sidecar.causal_status || !CAUSAL_STATUSES.has(sidecar.causal_status.code) || sidecar.causal_status.establishes_causal_proof !== false) errors.push('causal_status must be valid and non-certifying.');
    const interventionRefs = Array.isArray(sidecar.intervention_refs) ? sidecar.intervention_refs : [];
    if (sidecar.declared_outcome && sidecar.declared_outcome.status === 'not_realized_after_intervention' && interventionRefs.length === 0) errors.push('not_realized_after_intervention requires intervention provenance.');
    if (sidecar.causal_status && sidecar.causal_status.code === 'associated_not_proven' && interventionRefs.length === 0) errors.push('associated_not_proven requires intervention provenance.');
    if (deepHasProhibitedKey(sidecar)) errors.push('Outcome sidecar contains a prohibited earlier-context or scalar-score key.');
    if (sidecar.claims && Object.values(sidecar.claims).some(v => v !== false)) errors.push('Outcome sidecar must not establish outcome truth, execution/compliance, causality, legal effect, authority, independence, responsibility, or a canonical verdict.');
    if (Object.prototype.hasOwnProperty.call(sidecar, 'protocol')) errors.push('Outcome sidecar must not masquerade as a Genesis PoAI record.');
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
  function splitRefs(value) { return typeof value === 'string' ? value.split(/[\n,]+/).map(v => v.trim()).filter(Boolean) : []; }
  function downloadJson(filename, data) {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function ensureControls() {
    const panel = document.getElementById('reviewCuesPanel');
    if (!panel || panel.querySelector('#observedOutcomeControls')) return;
    const ru = currentLanguage() === 'ru';
    const box = document.createElement('div');
    box.id = 'observedOutcomeControls';
    box.className = 'review-sidecar-controls observed-outcome-controls';
    box.innerHTML = `
      <div class="review-cues-kicker">${ru ? 'ЭКСПЕРИМЕНТАЛЬНОЕ НАБЛЮДЕНИЕ ИСХОДА' : 'EXPERIMENTAL OBSERVED OUTCOME'}</div>
      <div class="review-cues-title">${ru ? 'Отчёт о наблюдаемом исходе' : 'Observed outcome report'}</div>
      <div class="review-cues-note">${ru ? 'Фиксирует заявленное наблюдение исхода, но не устанавливает истину, причинность или ответственность.' : 'Records a declared outcome observation but does not establish truth, causality, or responsibility.'}</div>
      <div class="review-sidecar-grid">
        <label><span>${ru ? 'Future Target ID (необязательно)' : 'Future Target ID (optional)'}</span><input id="outcomeFutureTargetId" type="text" placeholder="future:..."></label>
        <label><span>${ru ? 'Наблюдатель / роль (необязательно)' : 'Observer / role (optional)'}</span><input id="outcomeObserver" type="text"></label>
        <label><span>${ru ? 'Метод наблюдения' : 'Observation method'}</span><select id="outcomeMethod">
          <option value="system_record">system_record</option><option value="direct_observation">direct_observation</option><option value="document_review">document_review</option><option value="multi_source">multi_source</option><option value="other">other</option><option value="unknown">unknown</option>
        </select></label>
        <label><span>${ru ? 'Заявленный статус исхода' : 'Declared outcome status'}</span><select id="outcomeStatus">
          <option value="not_yet_observable">not_yet_observable</option><option value="realized">realized</option><option value="not_realized_without_intervention">not_realized_without_intervention</option><option value="not_realized_after_intervention">not_realized_after_intervention</option><option value="indeterminate">indeterminate</option><option value="not_applicable">not_applicable</option>
        </select></label>
        <label><span>${ru ? 'Causal status' : 'Causal status'}</span><select id="outcomeCausalStatus">
          <option value="not_assessed">not_assessed</option><option value="associated_not_proven">associated_not_proven</option><option value="disputed">disputed</option><option value="unknown">unknown</option>
        </select></label>
        <label><span>${ru ? 'Outcome evidence cutoff (необязательно)' : 'Outcome evidence cutoff (optional)'}</span><input id="outcomeEvidenceCutoff" type="datetime-local"></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Execution / intervention refs (через запятую)' : 'Execution / intervention refs (comma separated)'}</span><input id="outcomeInterventionRefs" type="text" placeholder="urn:poai:execution:..."></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Verification IDs (через запятую)' : 'Verification IDs (comma separated)'}</span><input id="outcomeVerificationRefs" type="text" placeholder="urn:poai:verification:..."></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Примечание (необязательно)' : 'Note (optional)'}</span><input id="outcomeNotes" type="text"></label>
      </div>
      <div class="actions"><button id="downloadOutcomeBtn" type="button">${ru ? 'Скачать Outcome Sidecar' : 'Download Outcome Sidecar'}</button><span class="review-cues-note">${ru ? 'Наблюдение исхода ≠ доказанная причинность ≠ ответственность.' : 'Outcome observation ≠ proven causality ≠ responsibility.'}</span></div>`;
    panel.append(box);
    box.querySelector('#downloadOutcomeBtn').addEventListener('click', () => {
      const record = currentRecord(); if (!record) return;
      try {
        const refs = splitRefs(box.querySelector('#outcomeInterventionRefs').value);
        const sidecar = buildOutcomeSidecar(record, {
          futureTargetId: box.querySelector('#outcomeFutureTargetId').value,
          observerLabel: box.querySelector('#outcomeObserver').value,
          method: box.querySelector('#outcomeMethod').value,
          outcomeStatus: box.querySelector('#outcomeStatus').value,
          causalStatus: box.querySelector('#outcomeCausalStatus').value,
          evidenceCutoff: toIsoFromLocal(box.querySelector('#outcomeEvidenceCutoff').value),
          executionIds: refs.filter(v => v.startsWith('urn:poai:execution:')),
          interventionRefs: refs.filter(v => !v.startsWith('urn:poai:execution:')),
          verificationIds: splitRefs(box.querySelector('#outcomeVerificationRefs').value),
          notes: box.querySelector('#outcomeNotes').value,
          sourceValidationStatus: 'PASS'
        });
        const errors = validateOutcomeSidecar(sidecar); if (errors.length) { alert(errors.join('\n')); return; }
        downloadJson(`${stableHash(sidecar.decision_record_id)}.poai-outcome.json`, sidecar);
      } catch (e) { alert(e.message || String(e)); }
    });
  }

  function initBrowser() {
    ensureControls();
    const target = document.querySelector('[data-panel="verifier"]');
    if (target) new MutationObserver(() => ensureControls()).observe(target, { childList: true, subtree: true });
    document.addEventListener('poai:languagechange', () => { const old = document.getElementById('observedOutcomeControls'); if (old) old.remove(); ensureControls(); });
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser); else initBrowser(); }

  return Object.freeze({ ARTIFACT_TYPE, ARTIFACT_VERSION, OUTCOME_STATUSES, METHODS, CAUSAL_STATUSES, buildOutcomeSidecar, validateOutcomeSidecar, deepHasProhibitedKey, stableHash });
});