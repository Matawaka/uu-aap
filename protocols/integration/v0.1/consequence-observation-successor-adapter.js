'use strict';

function assert(value, message) {
  if (!value) throw new Error(`ConsequenceObservationSuccessorAdapter: ${message}`);
}

function evaluateConsequenceSuccessorAdapter({ ingressReceipt }) {
  assert(ingressReceipt && ingressReceipt.artifact_type === 'ConsequenceObservationIngressReceipt' && ingressReceipt.artifact_version === '0.1',
    'typed ingress receipt v0.1 required');
  assert(ingressReceipt.adapter_eligibility && ingressReceipt.adapter_eligibility.eligible_for_successor_adapter === false,
    'generic ingress v0.1 cannot contain positive successor eligibility');
  assert(ingressReceipt.claims && ingressReceipt.claims.ingress_accepted === true,
    'ingress must be accepted before adapter evaluation');
  assert(ingressReceipt.claims.new_external_consequence_observed === false,
    'ingress receipt cannot pre-certify an external consequence');
  return {
    artifact_type: 'ConsequenceObservationSuccessorAdapterDecision',
    artifact_version: '0.1',
    decision: 'blocked',
    reason: ingressReceipt.adapter_eligibility.reason,
    successor_append_may_proceed: false,
    source_specific_adapter_registered: false,
    claims: {
      consequence_successor_adapter_authorized: false,
      new_external_consequence_observed: false,
      causal_proof_certified: false,
      responsibility_for_consequence_attributed: false,
      legal_liability_established: false,
      moral_blame_assigned: false,
      truth_certified: false
    }
  };
}

function assertConsequenceSuccessorAppendMayProceed(args) {
  const decision = evaluateConsequenceSuccessorAdapter(args);
  if (!decision.successor_append_may_proceed) {
    throw new Error(`ConsequenceObservationSuccessorAdapter: source-specific adapter not registered; ${decision.reason}`);
  }
  return true;
}

module.exports = { evaluateConsequenceSuccessorAdapter, assertConsequenceSuccessorAppendMayProceed };
