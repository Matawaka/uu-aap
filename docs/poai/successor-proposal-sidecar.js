(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAISuccessorProposalSidecar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAISuccessorProposalSidecar';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const OUTCOME_STATUSES = new Set([
    'not_yet_observable',
    'realized',
    'not_realized_without_intervention',
    'not_realized_after_intervention',
    'indeterminate',
    'not_applicable'
  ]);
  const CAUSAL_STATUSES = new Set(['not_assessed', 'associated_not_proven', 'disputed', 'unknown']);
  const CONTRADICTION_STATES = new Set(['none_known', 'present', 'unknown']);
  const PROHIBITED_KEYS = new Set([
    'decision_boundary', 'knowledge_cutoff', 'score', 'percentage', 'rating',
    'intelligence_score', 'trust_score', 'readiness_score', 'completeness_score'
  ]);

  function stableHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function cleanStrings(values) {
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .filter(v => typeof v === 'string' && v.trim())
      .map(v => v.trim()))).sort();
  }

  function optionalIso(value, label) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`${label || 'timestamp'} must be valid`);
    return d.toISOString();
  }

  function deepHasProhibitedKey(value) {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(deepHasProhibitedKey);
    for (const [key, child] of Object.entries(value)) {
      if (PROHIBITED_KEYS.has(key)) return true;
      if (deepHasProhibitedKey(child)) return true;
    }
    return false;
  }

  function sourceRecordVersion(record) {
    const value = record && record.versioning && record.versioning.record_version;
    return Number.isInteger(value) && value >= 1 ? value : 1;
  }

  function buildSuccessorProposal(record, options) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A source PoAI decision record object is required.');
    if (typeof record.record_id !== 'string' || !record.record_id) throw new Error('Source record_id is required.');
    const opts = options || {};
    const sourceVersion = sourceRecordVersion(record);
    const proposedIdInput = typeof opts.successorRecordId === 'string' ? opts.successorRecordId.trim() : '';
    const declaredSourceSuccessor = record.versioning && typeof record.versioning.successor_record === 'string' ? record.versioning.successor_record.trim() : '';
    const proposedSuccessorId = proposedIdInput || declaredSourceSuccessor;
    if (!proposedSuccessorId) throw new Error('A proposed successor record id is required.');
    if (proposedSuccessorId === record.record_id) throw new Error('Proposed successor record id must differ from the source record id.');

    const observationIds = cleanStrings(opts.outcomeObservationIds)
      .filter(v => v.startsWith('urn:poai:outcome-observation:'));
    if (!observationIds.length) throw new Error('At least one Outcome Observation ID is required.');

    const proposedStatus = OUTCOME_STATUSES.has(opts.outcomeStatus) ? opts.outcomeStatus : 'indeterminate';
    const causalStatus = CAUSAL_STATUSES.has(opts.causalStatus) ? opts.causalStatus : 'unknown';
    const contradictionState = CONTRADICTION_STATES.has(opts.contradictionState) ? opts.contradictionState : 'unknown';
    const interventionRefs = cleanStrings(opts.interventionRefs);
    const conflictingObservationIds = cleanStrings(opts.conflictingObservationIds)
      .filter(v => v.startsWith('urn:poai:outcome-observation:'));

    if (proposedStatus === 'not_realized_after_intervention' && interventionRefs.length === 0) {
      throw new Error('not_realized_after_intervention requires intervention provenance.');
    }
    if (causalStatus === 'associated_not_proven' && interventionRefs.length === 0) {
      throw new Error('associated_not_proven requires intervention provenance.');
    }
    if (contradictionState === 'present' && conflictingObservationIds.length === 0) {
      throw new Error('Contradiction state present requires at least one conflicting Outcome Observation ID.');
    }

    const futureTargetId = typeof opts.futureTargetId === 'string' && opts.futureTargetId.trim() ? opts.futureTargetId.trim() : null;
    const proposedObservedAt = optionalIso(opts.proposedObservedAt, 'proposed observed_at');
    const proposerLabel = typeof opts.proposerLabel === 'string' && opts.proposerLabel.trim() ? opts.proposerLabel.trim() : null;
    const notes = typeof opts.notes === 'string' && opts.notes.trim() ? opts.notes.trim() : null;
    const proposedVersion = sourceVersion + 1;
    const seed = `${record.record_id}|${proposedSuccessorId}|${observationIds.join(',')}|${proposedStatus}|${proposedObservedAt || ''}`;

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      proposal_id: `urn:poai:successor-proposal:${stableHash(seed)}`,
      created_at: new Date().toISOString(),
      source_record: {
        decision_record_id: record.record_id,
        record_version: sourceVersion,
        source_validation_status: opts.sourceValidationStatus === 'PASS' ? 'PASS' : 'unknown'
      },
      proposed_successor: {
        decision_record_id: proposedSuccessorId,
        record_version: proposedVersion,
        future_target_id: futureTargetId,
        proposed_outcome: {
          status: proposedStatus,
          observed_at: proposedObservedAt,
          intervention_refs: interventionRefs,
          causal_status: causalStatus
        }
      },
      outcome_observation_refs: observationIds,
      conflicting_outcome_observation_refs: conflictingObservationIds,
      contradiction_state: contradictionState,
      proposer: {
        declaration: proposerLabel ? 'self_declared' : 'undisclosed',
        label: proposerLabel,
        authority_status: 'unknown'
      },
      preservation_requirements: {
        original_decision_boundary: 'must_remain_unchanged',
        original_knowledge_cutoff: 'must_remain_unchanged',
        decision_time_future_target_epistemic_status: 'must_remain_unchanged'
      },
      review_cues: {
        source_record_validated: opts.sourceValidationStatus === 'PASS',
        outcome_observations_present: observationIds.length > 0,
        proposed_successor_distinct_from_source: proposedSuccessorId !== record.record_id,
        proposed_record_version_is_next: proposedVersion === sourceVersion + 1,
        proposed_observed_at_present: proposedObservedAt !== null,
        intervention_provenance_present: interventionRefs.length > 0,
        contradiction_state: contradictionState
      },
      proposal_notes: notes,
      claims: {
        successor_established: false,
        canonical_successor_established: false,
        canonical_outcome_established: false,
        outcome_truth_certified: false,
        causal_proof_certified: false,
        authority_determined: false,
        responsibility_determined: false,
        legal_effect_established: false,
        canonical_verdict_established: false
      },
      versioning: {
        proposal_artifact_version: 1,
        previous_successor_proposal: null,
        successor_successor_proposal: null
      }
    };
  }

  function validateSuccessorProposal(sidecar) {
    const errors = [];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return ['Successor proposal must be an object.'];
    if (sidecar.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAISuccessorProposalSidecar.');
    if (sidecar.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof sidecar.proposal_id !== 'string' || !sidecar.proposal_id.startsWith('urn:poai:successor-proposal:')) errors.push('proposal_id is invalid.');
    if (!sidecar.source_record || typeof sidecar.source_record.decision_record_id !== 'string') errors.push('source_record.decision_record_id is required.');
    if (!sidecar.proposed_successor || typeof sidecar.proposed_successor.decision_record_id !== 'string') errors.push('proposed_successor.decision_record_id is required.');
    if (sidecar.source_record && sidecar.proposed_successor && sidecar.source_record.decision_record_id === sidecar.proposed_successor.decision_record_id) errors.push('Proposed successor must differ from the source record.');
    if (!Number.isInteger(sidecar.source_record && sidecar.source_record.record_version)) errors.push('Source record version is invalid.');
    if (!Number.isInteger(sidecar.proposed_successor && sidecar.proposed_successor.record_version)) errors.push('Proposed successor record version is invalid.');
    if (sidecar.source_record && sidecar.proposed_successor && sidecar.proposed_successor.record_version !== sidecar.source_record.record_version + 1) errors.push('Proposed successor record version must be the next version.');
    if (!Array.isArray(sidecar.outcome_observation_refs) || sidecar.outcome_observation_refs.length === 0) errors.push('At least one Outcome Observation ID is required.');
    if (Array.isArray(sidecar.outcome_observation_refs) && sidecar.outcome_observation_refs.some(v => typeof v !== 'string' || !v.startsWith('urn:poai:outcome-observation:'))) errors.push('Outcome Observation IDs are invalid.');
    const proposedOutcome = sidecar.proposed_successor && sidecar.proposed_successor.proposed_outcome;
    if (!proposedOutcome || !OUTCOME_STATUSES.has(proposedOutcome.status)) errors.push('Proposed outcome status must use the Genesis vocabulary.');
    if (!proposedOutcome || !CAUSAL_STATUSES.has(proposedOutcome.causal_status)) errors.push('Proposed causal status is invalid.');
    const interventions = proposedOutcome && Array.isArray(proposedOutcome.intervention_refs) ? proposedOutcome.intervention_refs : [];
    if (proposedOutcome && proposedOutcome.status === 'not_realized_after_intervention' && interventions.length === 0) errors.push('not_realized_after_intervention requires intervention provenance.');
    if (proposedOutcome && proposedOutcome.causal_status === 'associated_not_proven' && interventions.length === 0) errors.push('associated_not_proven requires intervention provenance.');
    if (!sidecar.proposer || sidecar.proposer.authority_status !== 'unknown') errors.push('Proposer authority must remain unknown in this experiment.');
    if (!sidecar.preservation_requirements || sidecar.preservation_requirements.original_decision_boundary !== 'must_remain_unchanged' || sidecar.preservation_requirements.original_knowledge_cutoff !== 'must_remain_unchanged' || sidecar.preservation_requirements.decision_time_future_target_epistemic_status !== 'must_remain_unchanged') errors.push('Preservation requirements are incomplete.');
    if (!CONTRADICTION_STATES.has(sidecar.contradiction_state)) errors.push('contradiction_state is invalid.');
    if (sidecar.contradiction_state === 'present' && (!Array.isArray(sidecar.conflicting_outcome_observation_refs) || sidecar.conflicting_outcome_observation_refs.length === 0)) errors.push('Contradiction state present requires conflicting observation refs.');
    if (deepHasProhibitedKey(sidecar)) errors.push('Successor proposal contains a prohibited earlier-context or scalar-score key.');
    if (!sidecar.claims || Object.values(sidecar.claims).some(v => v !== false)) errors.push('Successor proposal must not establish successor, canonical outcome, truth, causality, authority, responsibility, legal effect, or canonical verdict.');
    if (Object.prototype.hasOwnProperty.call(sidecar, 'protocol')) errors.push('Successor proposal must not masquerade as a Genesis PoAI record.');
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function ensureControls() {
    const panel = document.getElementById('reviewCuesPanel');
    if (!panel || panel.querySelector('#successorProposalControls')) return;
    const ru = currentLanguage() === 'ru';
    const box = document.createElement('div');
    box.id = 'successorProposalControls';
    box.className = 'review-sidecar-controls successor-proposal-controls';
    box.innerHTML = `
      <div class="review-cues-kicker">${ru ? 'ЭКСПЕРИМЕНТАЛЬНОЕ ПРЕДЛОЖЕНИЕ SUCCESSOR' : 'EXPERIMENTAL SUCCESSOR PROPOSAL'}</div>
      <div class="review-cues-title">${ru ? 'Предложение successor-записи' : 'Successor record proposal'}</div>
      <div class="review-cues-note">${ru ? 'Предлагает append-only переход, но не создаёт и не канонизирует successor record.' : 'Proposes an append-only transition but does not create or canonicalize a successor record.'}</div>
      <div class="review-sidecar-grid">
        <label><span>${ru ? 'Proposed successor record ID' : 'Proposed successor record ID'}</span><input id="successorProposalId" type="text" placeholder="urn:poai:record:...:2"></label>
        <label><span>${ru ? 'Future Target ID (необязательно)' : 'Future Target ID (optional)'}</span><input id="successorFutureTargetId" type="text" placeholder="future:..."></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Outcome Observation IDs (через запятую, обязательно)' : 'Outcome Observation IDs (comma separated, required)'}</span><input id="successorObservationIds" type="text" placeholder="urn:poai:outcome-observation:..."></label>
        <label><span>${ru ? 'Предлагаемый outcome status' : 'Proposed outcome status'}</span><select id="successorOutcomeStatus">
          <option value="not_yet_observable">not_yet_observable</option><option value="realized">realized</option><option value="not_realized_without_intervention">not_realized_without_intervention</option><option value="not_realized_after_intervention">not_realized_after_intervention</option><option value="indeterminate">indeterminate</option><option value="not_applicable">not_applicable</option>
        </select></label>
        <label><span>${ru ? 'Proposed observed_at (необязательно)' : 'Proposed observed_at (optional)'}</span><input id="successorObservedAt" type="datetime-local"></label>
        <label><span>${ru ? 'Causal status' : 'Causal status'}</span><select id="successorCausalStatus"><option value="not_assessed">not_assessed</option><option value="associated_not_proven">associated_not_proven</option><option value="disputed">disputed</option><option value="unknown">unknown</option></select></label>
        <label><span>${ru ? 'Состояние противоречий' : 'Contradiction state'}</span><select id="successorContradictionState"><option value="none_known">none_known</option><option value="present">present</option><option value="unknown">unknown</option></select></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Intervention refs (через запятую)' : 'Intervention refs (comma separated)'}</span><input id="successorInterventionRefs" type="text" placeholder="intervention:..."></label>
        <label class="review-sidecar-wide"><span>${ru ? 'Противоречащие Outcome Observation IDs' : 'Conflicting Outcome Observation IDs'}</span><input id="successorConflictingObservationIds" type="text" placeholder="urn:poai:outcome-observation:..."></label>
        <label><span>${ru ? 'Предлагающий / роль (необязательно)' : 'Proposer / role (optional)'}</span><input id="successorProposer" type="text"></label>
        <label><span>${ru ? 'Примечание (необязательно)' : 'Note (optional)'}</span><input id="successorNotes" type="text"></label>
      </div>
      <div class="actions"><button id="downloadSuccessorProposalBtn" type="button">${ru ? 'Скачать Successor Proposal' : 'Download Successor Proposal'}</button><span class="review-cues-note">${ru ? 'Proposal ≠ successor record ≠ canonical successor.' : 'Proposal ≠ successor record ≠ canonical successor.'}</span></div>`;
    panel.append(box);

    box.querySelector('#downloadSuccessorProposalBtn').addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return;
      try {
        const sidecar = buildSuccessorProposal(record, {
          successorRecordId: box.querySelector('#successorProposalId').value,
          futureTargetId: box.querySelector('#successorFutureTargetId').value,
          outcomeObservationIds: splitRefs(box.querySelector('#successorObservationIds').value),
          outcomeStatus: box.querySelector('#successorOutcomeStatus').value,
          proposedObservedAt: toIsoFromLocal(box.querySelector('#successorObservedAt').value),
          causalStatus: box.querySelector('#successorCausalStatus').value,
          contradictionState: box.querySelector('#successorContradictionState').value,
          interventionRefs: splitRefs(box.querySelector('#successorInterventionRefs').value),
          conflictingObservationIds: splitRefs(box.querySelector('#successorConflictingObservationIds').value),
          proposerLabel: box.querySelector('#successorProposer').value,
          notes: box.querySelector('#successorNotes').value,
          sourceValidationStatus: 'PASS'
        });
        const errors = validateSuccessorProposal(sidecar);
        if (errors.length) { alert(errors.join('\n')); return; }
        downloadJson(`${stableHash(sidecar.source_record.decision_record_id)}.poai-successor-proposal.json`, sidecar);
      } catch (e) { alert(e.message || String(e)); }
    });
  }

  function initBrowser() {
    ensureControls();
    const target = document.querySelector('[data-panel="verifier"]');
    if (target) new MutationObserver(() => ensureControls()).observe(target, { childList: true, subtree: true });
    document.addEventListener('poai:languagechange', () => {
      const old = document.getElementById('successorProposalControls');
      if (old) old.remove();
      ensureControls();
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser);
    else initBrowser();
  }

  return Object.freeze({
    ARTIFACT_TYPE, ARTIFACT_VERSION, OUTCOME_STATUSES, CAUSAL_STATUSES, CONTRADICTION_STATES,
    buildSuccessorProposal, validateSuccessorProposal, deepHasProhibitedKey, stableHash
  });
});
