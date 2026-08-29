'use strict';

const CLASSIFICATIONS = Object.freeze([
  'observed_evidence','interpretation','assumption','hypothesis','declared_objective'
]);
const STATES = Object.freeze(['UNKNOWN','CONFLICT','INSUFFICIENT_EVIDENCE','CANDIDATE_READY']);
const RECOMMENDATION_CANDIDATES = Object.freeze([
  'REQUEST_MORE_EVIDENCE_CANDIDATE','HUMAN_RECONCILIATION_REQUIRED','READY_FOR_HUMAN_DISPOSITION_CANDIDATE'
]);

class MarketCloserRealStressTestEngineError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserRealStressTestEngineError(message); };
const clone = value => JSON.parse(JSON.stringify(value));

function gapRecord(statementId, code, evidenceRef, description) {
  return {
    gap_id: `gap-${statementId}-${code.toLowerCase().replace(/_/g, '-')}${evidenceRef ? `-${evidenceRef}` : ''}`,
    statement_id: statementId,
    code,
    evidence_ref: evidenceRef,
    description
  };
}
function counterargumentRecord(statementId, reasonCode, text, evidenceRefs) {
  return {
    candidate_id: `counter-${statementId}-${reasonCode.toLowerCase().replace(/_/g, '-')}`,
    statement_id: statementId,
    status: 'candidate',
    reason_code: reasonCode,
    text,
    basis_evidence_refs: [...evidenceRefs].sort()
  };
}

function analyzeBoundedCase(boundedCase) {
  req(boundedCase && typeof boundedCase === 'object' && !Array.isArray(boundedCase), 'bounded case required');
  const claim = boundedCase.claim_package;
  const evidenceItems = boundedCase.supporting_evidence;
  const constraints = boundedCase.decision_constraints;
  req(claim && Array.isArray(claim.material_statements) && claim.material_statements.length > 0, 'material statements required');
  req(Array.isArray(evidenceItems), 'supporting evidence must be array');
  req(constraints && typeof constraints === 'object', 'decision constraints required');

  const evidenceById = new Map(evidenceItems.map(item => [item.evidence_id, item]));
  const counts = Object.fromEntries(CLASSIFICATIONS.map(key => [key, 0]));
  const grouped = Object.fromEntries(CLASSIFICATIONS.map(key => [key, []]));
  const evidenceLineage = [];
  const counterarguments = [];
  const causalAlternatives = [];
  const falsifiers = [];
  const missingEvidence = [];
  const uncertaintyStates = new Set();
  let conflictObserved = false;

  for (const statement of claim.material_statements) {
    req(CLASSIFICATIONS.includes(statement.classification), `unsupported classification: ${statement.classification}`);
    counts[statement.classification] += 1;
    grouped[statement.classification].push(statement.statement_id);
    const refs = statement.evidence_refs.map(ref => {
      req(evidenceById.has(ref), `unknown evidence reference: ${ref}`);
      return evidenceById.get(ref);
    });
    const qualities = [...new Set(refs.map(item => item.quality))].sort();
    evidenceLineage.push({
      statement_id: statement.statement_id,
      classification: statement.classification,
      evidence_refs: [...statement.evidence_refs].sort(),
      evidence_quality: qualities
    });

    const contradicting = refs.filter(item => item.contradicts_statement_ids.includes(statement.statement_id));
    const weak = refs.filter(item => ['unverified','stale','conflicting'].includes(item.quality));
    if (statement.classification !== 'declared_objective' && statement.evidence_refs.length === 0) {
      missingEvidence.push(gapRecord(statement.statement_id, 'NO_SUPPORTING_EVIDENCE', null,
        'No supporting or contradicting evidence is bound to this material statement.'));
    }
    for (const item of weak) {
      const code = item.quality === 'unverified' ? 'UNVERIFIED_EVIDENCE'
        : item.quality === 'stale' ? 'STALE_EVIDENCE' : 'CONFLICTING_EVIDENCE';
      missingEvidence.push(gapRecord(statement.statement_id, code, item.evidence_id,
        `Evidence ${item.evidence_id} is ${item.quality}; uncertainty is preserved.`));
      if (item.quality === 'conflicting') conflictObserved = true;
    }
    if (contradicting.length > 0) {
      counterarguments.push(counterargumentRecord(
        statement.statement_id,
        'CONTRADICTING_EVIDENCE_PRESENT',
        'Contradicting evidence is present; the statement cannot be treated as unqualified support.',
        contradicting.map(item => item.evidence_id)
      ));
      conflictObserved = true;
    }
    if (['interpretation','assumption','hypothesis'].includes(statement.classification)) {
      const reason = `${statement.classification.toUpperCase()}_IS_NOT_OBSERVED_EVIDENCE`;
      counterarguments.push(counterargumentRecord(
        statement.statement_id,
        reason,
        `${statement.classification} is not direct observed evidence and remains contestable.`,
        statement.evidence_refs
      ));
      causalAlternatives.push({
        candidate_id: `causal-alt-${statement.statement_id}`,
        statement_id: statement.statement_id,
        status: 'candidate',
        text: 'The observed material may be consistent with causes other than this statement; necessity, sufficiency and exclusivity are not established.',
        basis_evidence_refs: [...statement.evidence_refs].sort()
      });
    }
    if (weak.length > 0) {
      counterarguments.push(counterargumentRecord(
        statement.statement_id,
        'EVIDENCE_QUALITY_LIMITS_SUPPORT',
        'One or more bound evidence items are unverified, stale or conflicting, limiting the strength of this statement.',
        weak.map(item => item.evidence_id)
      ));
    }

    falsifiers.push({
      statement_id: statement.statement_id,
      status: statement.falsification_probe.status,
      kind: statement.falsification_probe.kind,
      description: statement.falsification_probe.description,
      unavailable_reason: statement.falsification_probe.unavailable_reason
    });

    const hasVerifiedSupport = refs.some(item =>
      item.quality === 'verified' && item.supports_statement_ids.includes(statement.statement_id));
    if (['interpretation','assumption','hypothesis'].includes(statement.classification) && !hasVerifiedSupport) {
      uncertaintyStates.add('UNKNOWN');
    }
  }

  if (conflictObserved) uncertaintyStates.add('CONFLICT');
  if (missingEvidence.length > 0) uncertaintyStates.add('INSUFFICIENT_EVIDENCE');
  const state = conflictObserved ? 'CONFLICT' : missingEvidence.length > 0 ? 'INSUFFICIENT_EVIDENCE' : 'CANDIDATE_READY';
  if (state === 'CANDIDATE_READY' && uncertaintyStates.size === 0) uncertaintyStates.add('CANDIDATE_READY');

  const candidate = conflictObserved ? 'HUMAN_RECONCILIATION_REQUIRED'
    : missingEvidence.length > 0 ? 'REQUEST_MORE_EVIDENCE_CANDIDATE'
      : 'READY_FOR_HUMAN_DISPOSITION_CANDIDATE';
  const rationaleCodes = [];
  if (conflictObserved) rationaleCodes.push('CONFLICT_REQUIRES_HUMAN_RECONCILIATION');
  if (missingEvidence.length > 0) rationaleCodes.push('EVIDENCE_GAPS_REMAIN_VISIBLE');
  if (!conflictObserved && missingEvidence.length === 0) rationaleCodes.push('BOUNDED_ANALYSIS_COMPLETE');

  return {
    state,
    uncertainty_states: [...uncertaintyStates].sort(),
    classification_summary: {
      counts,
      statement_ids_by_classification: Object.fromEntries(CLASSIFICATIONS.map(key => [key, [...grouped[key]].sort()]))
    },
    evidence_lineage: evidenceLineage.sort((a,b) => a.statement_id.localeCompare(b.statement_id)),
    counterarguments: counterarguments.sort((a,b) => a.candidate_id.localeCompare(b.candidate_id)),
    causal_alternatives: causalAlternatives.sort((a,b) => a.candidate_id.localeCompare(b.candidate_id)),
    falsifiers: falsifiers.sort((a,b) => a.statement_id.localeCompare(b.statement_id)),
    missing_evidence: missingEvidence.sort((a,b) => a.gap_id.localeCompare(b.gap_id)),
    recommendation_candidate: {
      candidate,
      rationale_codes: rationaleCodes,
      human_disposition_required: true
    },
    success_criteria: {
      material_claim_classification: true,
      recommendation_falsifiability: falsifiers.every(item =>
        item.status === 'available' || (item.status === 'unavailable' && typeof item.unavailable_reason === 'string' && item.unavailable_reason.length > 0)),
      no_external_effect: true
    }
  };
}

module.exports = {
  MarketCloserRealStressTestEngineError,
  CLASSIFICATIONS,
  STATES,
  RECOMMENDATION_CANDIDATES,
  analyzeBoundedCase,
  clone
};
