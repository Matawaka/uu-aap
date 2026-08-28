'use strict';

function fail(message) { throw new Error(message); }
function parseTime(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(`invalid time: ${label}`);
  return parsed;
}

function validateAuthorizePhase(phase, context) {
  if (!phase || typeof phase !== 'object' || Array.isArray(phase)) fail('authorize phase missing');
  if (!context || typeof context !== 'object' || Array.isArray(context)) fail('authorize context missing');
  const predecessor = context.predecessor_frontier;
  const targetBindingHash = context.target_binding_hash;
  if (!predecessor || !targetBindingHash) fail('authorize context incomplete');

  if (phase.status !== 'authorized') fail('authorize phase status mismatch');
  if (phase.frontier !== predecessor) fail('authorize frontier mismatch');
  if (phase.target_binding_hash !== targetBindingHash) fail('authorize target substitution detected');

  if (!phase.action_permit_ref ||
      phase.action_permit_ref.receipt_type !== 'ActionPermit' ||
      phase.action_permit_ref.frontier !== predecessor) {
    fail('ActionPermit ref mismatch');
  }
  if (!phase.one_shot || phase.consumed) fail('permit must be one-shot and unconsumed before execution');

  if (!phase.assertions ||
      !phase.assertions.action_specific ||
      !phase.assertions.exact_target_bound ||
      !phase.assertions.permit_preexists_admission) {
    fail('authorize assertions incomplete');
  }

  if (!phase.non_effects ||
      phase.non_effects.action_performed !== false ||
      phase.non_effects.authority_expanded !== false ||
      phase.non_effects.future_action_authorized !== false ||
      phase.non_effects.action_permit_created_by_adapter !== false) {
    fail('authorize emitted forbidden effect');
  }

  if (context.requires_approval && !phase.approval_ref) fail('approval required but missing');
  if (phase.approval_ref && phase.approval_ref.frontier !== predecessor) fail('approval frontier mismatch');
  if (phase.admission_assessment_ref && phase.admission_assessment_ref.frontier !== predecessor) fail('admission frontier mismatch');

  const permitIssuedAt = parseTime(phase.action_permit_issued_at, 'action_permit_issued_at');
  const authorizedAt = parseTime(phase.authorized_at, 'authorized_at');
  parseTime(phase.expires_at, 'expires_at');
  if (permitIssuedAt > authorizedAt) fail('authorize predates Core ActionPermit');

  if (phase.admission_assessment_ref) {
    if (!phase.admission_assessed_at) fail('admission assessment time missing');
    const admissionAssessedAt = parseTime(phase.admission_assessed_at, 'admission_assessed_at');
    if (permitIssuedAt > admissionAssessedAt) fail('adapter admission predates Core ActionPermit');
  }

  return true;
}

module.exports = {
  parseTime,
  validateAuthorizePhase,
};
