'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Approval = require(path.resolve(__dirname, '../../human-response-approval/v0.1/approval.js'));

const PROTOCOL = 'MARKETCLOSER-COPY-EXPORT-RECEIPT';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserCopyExportInput';
const RECEIPT_TYPE = 'MarketCloserCopyExportReceipt';
const ORIGIN_FRONTIER = '70dcca94b87f392bb74861765133306691f5d165';
const ORIGIN_TREE = 'a15e79f2fe0ea0e3d2f547f6f4e53645c2e2a36a';
const CLASSIFICATIONS = Object.freeze(['APPROVAL_REQUIRED','COPY_EXPORT_EVENT_REQUIRED','COPIED_PUBLICATION_UNVERIFIED']);
const EVENT_CONTEXTS = Object.freeze(['synthetic_conformance','application_observed','human_asserted']);
const EVENT_METHODS = Object.freeze(['clipboard_copy','local_text_export']);

const INPUT_KEYS = Object.freeze(['protocol','version','artifact_type','copy_export_id','origin','approval_source','approval_receipt','event','controls','content_hash']);
const ORIGIN_KEYS = Object.freeze(['repository','revision','tree']);
const SOURCE_KEYS = Object.freeze(['mode','path','expected_approval_input_hash']);
const EVENT_KEYS = Object.freeze(['context','method','event_ref','actor_ref','performed_at','draft_hash','payload_hash','application_event_observed','independently_verified']);
const CONTROL_KEYS = Object.freeze(['local_only','read_only','copy_export_event_recording_available','os_clipboard_mutation_available','filesystem_export_write_available','publication_available','provider_invocation_available','network_access_available','platform_mutation_available','campaign_send_available','pilot_permit_available','action_permit_available','external_execution_available','external_effect_available']);
const RECEIPT_KEYS = Object.freeze(['protocol','version','receipt_type','receipt_id','source_input','approval_binding','event_binding','classification','copy_export_event_recorded','copy_export_event_asserts_performed','claims','non_effects','next_safe_action','content_hash']);
const SOURCE_INPUT_KEYS = Object.freeze(['copy_export_id','copy_export_hash']);
const APPROVAL_BINDING_KEYS = Object.freeze(['approval_id','approval_hash','receipt_present','receipt_id','receipt_hash','classification','draft_hash','copy_export_authorized','exact_receipt_revalidated']);
const EVENT_BINDING_KEYS = Object.freeze(['present','context','method','event_ref','actor_ref','performed_at','draft_hash','payload_hash','application_event_observed','independently_verified']);

const FALSE_CLAIMS = Object.freeze([
  'copy_export_independently_verified','actor_identity_verified','os_clipboard_state_attested','filesystem_export_state_attested',
  'publication_observed','publication_authorized','provider_invoked','network_accessed','platform_mutated','campaign_sent',
  'pilot_permit_created','action_permit_created','external_execution_admitted','external_effect_performed','successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([
  'exact_approval_source_revalidated','approved_exact_draft_bound','copy_export_event_recorded','copy_export_event_asserts_performed',
  'event_payload_matches_approved_draft',...FALSE_CLAIMS
]);
const REQUIRED_NON_EFFECTS = Object.freeze([
  'Approval For Copy Export != Copy Performed',
  'Recorded Copy Event != Independent OS Attestation',
  'Copied Draft != Published Draft',
  'Copy Export != Platform Publication',
  'Copy Export Receipt != Publication Receipt',
  'Copy Event Actor Reference != Verified Actor Identity',
  'Application Observation != External Platform Observation',
  'Local Export != External Delivery',
  'Copy Export Receipt != ActionPermit',
  'Copy Export Receipt != External Effect'
]);

class MarketCloserCopyExportError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserCopyExportError(message); };
const clone = value => JSON.parse(JSON.stringify(value));
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}
function computeContentHash(value) {
  const copy = clone(value); delete copy.content_hash;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(copy)), 'utf8').digest('hex')}`;
}
function rehash(value) { value.content_hash = computeContentHash(value); return value; }
function exact(value, keys, label) {
  req(value && typeof value === 'object' && !Array.isArray(value), `${label} must be object`);
  req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} key mismatch`);
}
function str(value, label, pattern = null) {
  req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
  if (pattern) req(pattern.test(value), `${label} invalid`);
}
function instant(value, label) { str(value, label); const n = Date.parse(value); req(Number.isFinite(n), `${label} invalid date-time`); return n; }
function deepEqual(a,b) { return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b)); }
function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveApprovalPath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository approval path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'approval path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported approval source mode');
  return path.resolve(source.path);
}
function loadApprovalInput(source) {
  const input = JSON.parse(fs.readFileSync(resolveApprovalPath(source), 'utf8'));
  Approval.validateInput(input);
  req(input.content_hash === source.expected_approval_input_hash, 'approval input hash mismatch');
  return input;
}
function validateEvent(event) {
  exact(event, EVENT_KEYS, 'event');
  req(EVENT_CONTEXTS.includes(event.context), 'event context unsupported');
  req(EVENT_METHODS.includes(event.method), 'event method unsupported');
  str(event.event_ref, 'event.event_ref');
  str(event.actor_ref, 'event.actor_ref');
  instant(event.performed_at, 'event.performed_at');
  str(event.draft_hash, 'event.draft_hash', /^sha256:[0-9a-f]{64}$/);
  str(event.payload_hash, 'event.payload_hash', /^sha256:[0-9a-f]{64}$/);
  req(typeof event.application_event_observed === 'boolean', 'event.application_event_observed must be boolean');
  req(event.independently_verified === false, 'v0.1 copy/export event cannot claim independent verification');
  if (event.context === 'application_observed') req(event.application_event_observed === true, 'application_observed requires application_event_observed=true');
  if (event.context === 'human_asserted') req(event.application_event_observed === false, 'human_asserted cannot claim application observation');
  if (event.context === 'synthetic_conformance') {
    req(event.event_ref.startsWith('urn:synthetic:'), 'synthetic event requires synthetic event_ref');
    req(event.actor_ref.startsWith('urn:synthetic:'), 'synthetic event requires synthetic actor_ref');
  }
  return event;
}
function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.copy_export_id, 'copy_export_id', /^urn:uu-aap:marketcloser:copy-export:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.origin, ORIGIN_KEYS, 'origin');
  req(input.origin.repository === 'Matawaka/uu-aap' && input.origin.revision === ORIGIN_FRONTIER && input.origin.tree === ORIGIN_TREE, 'origin frontier mismatch');
  exact(input.approval_source, SOURCE_KEYS, 'approval_source');
  req(['repository_synthetic','local_private'].includes(input.approval_source.mode), 'approval source mode unsupported');
  str(input.approval_source.path, 'approval_source.path');
  str(input.approval_source.expected_approval_input_hash, 'expected approval input hash', /^sha256:[0-9a-f]{64}$/);
  req(input.approval_receipt === null || (input.approval_receipt && typeof input.approval_receipt === 'object' && !Array.isArray(input.approval_receipt)), 'approval_receipt must be object or null');
  if (input.approval_receipt !== null) Approval.validateReceipt(input.approval_receipt);
  req(input.event === null || (input.event && typeof input.event === 'object' && !Array.isArray(input.event)), 'event must be object or null');
  if (input.event !== null) validateEvent(input.event);
  req(input.approval_receipt !== null || input.event === null, 'copy/export event cannot exist without approval receipt');
  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true && input.controls.copy_export_event_recording_available === true, 'runtime must remain local/read-only event recorder');
  for (const key of CONTROL_KEYS.filter(k => !['local_only','read_only','copy_export_event_recording_available'].includes(k))) req(input.controls[key] === false, `execution/external capability must remain false: ${key}`);
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}
function nextAction(classification) {
  return {
    APPROVAL_REQUIRED: 'OBTAIN_APPROVED_FOR_COPY_EXPORT',
    COPY_EXPORT_EVENT_REQUIRED: 'RECORD_COPY_EXPORT_EVENT',
    COPIED_PUBLICATION_UNVERIFIED: 'PUBLICATION_OBSERVATION_REQUIRED'
  }[classification];
}
function deriveReceipt(input) {
  validateInput(input);
  const approvalInput = loadApprovalInput(input.approval_source);
  const expectedApprovalReceipt = Approval.deriveReceipt(approvalInput);
  let approvalPresent = false;
  let exactApproval = false;
  let approved = false;
  if (input.approval_receipt !== null) {
    req(deepEqual(expectedApprovalReceipt, input.approval_receipt), 'approval receipt does not match exact approval source');
    approvalPresent = true;
    exactApproval = true;
    approved = input.approval_receipt.classification === 'APPROVED_FOR_COPY_EXPORT' && input.approval_receipt.copy_export_authorized === true;
  }
  if (input.event !== null) req(approved, 'copy/export event requires APPROVED_FOR_COPY_EXPORT');
  const eventPresent = input.event !== null;
  if (eventPresent) {
    req(input.event.draft_hash === input.approval_receipt.response_binding.draft_hash, 'event draft hash does not match approved draft');
    req(input.event.payload_hash === input.approval_receipt.response_binding.draft_hash, 'event payload hash does not match approved draft');
  }
  const classification = !approved ? 'APPROVAL_REQUIRED' : !eventPresent ? 'COPY_EXPORT_EVENT_REQUIRED' : 'COPIED_PUBLICATION_UNVERIFIED';
  const claims = {
    exact_approval_source_revalidated: true,
    approved_exact_draft_bound: approved,
    copy_export_event_recorded: eventPresent,
    copy_export_event_asserts_performed: eventPresent,
    event_payload_matches_approved_draft: eventPresent
  };
  FALSE_CLAIMS.forEach(k => { claims[k] = false; });
  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:copy-export-receipt:${input.content_hash.slice(-24)}`,
    source_input: { copy_export_id: input.copy_export_id, copy_export_hash: input.content_hash },
    approval_binding: {
      approval_id: approvalInput.approval_id,
      approval_hash: approvalInput.content_hash,
      receipt_present: approvalPresent,
      receipt_id: approvalPresent ? input.approval_receipt.receipt_id : null,
      receipt_hash: approvalPresent ? input.approval_receipt.content_hash : null,
      classification: approvalPresent ? input.approval_receipt.classification : null,
      draft_hash: approvalPresent ? input.approval_receipt.response_binding.draft_hash : null,
      copy_export_authorized: approved,
      exact_receipt_revalidated: exactApproval
    },
    event_binding: {
      present: eventPresent,
      context: eventPresent ? input.event.context : null,
      method: eventPresent ? input.event.method : null,
      event_ref: eventPresent ? input.event.event_ref : null,
      actor_ref: eventPresent ? input.event.actor_ref : null,
      performed_at: eventPresent ? input.event.performed_at : null,
      draft_hash: eventPresent ? input.event.draft_hash : null,
      payload_hash: eventPresent ? input.event.payload_hash : null,
      application_event_observed: eventPresent ? input.event.application_event_observed : false,
      independently_verified: false
    },
    classification,
    copy_export_event_recorded: eventPresent,
    copy_export_event_asserts_performed: eventPresent,
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: nextAction(classification),
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}
function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === RECEIPT_TYPE, 'receipt header mismatch');
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:copy-export-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.approval_binding, APPROVAL_BINDING_KEYS, 'approval_binding');
  exact(receipt.event_binding, EVENT_BINDING_KEYS, 'event_binding');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification unsupported');
  const eventPresent = receipt.event_binding.present === true;
  const approved = receipt.approval_binding.copy_export_authorized === true;
  req(receipt.copy_export_event_recorded === eventPresent && receipt.copy_export_event_asserts_performed === eventPresent, 'event recorded/asserted mismatch');
  if (approved) {
    req(receipt.approval_binding.classification === 'APPROVED_FOR_COPY_EXPORT', 'approval classification mismatch');
    str(receipt.approval_binding.draft_hash, 'approval draft hash', /^sha256:[0-9a-f]{64}$/);
    req(receipt.approval_binding.exact_receipt_revalidated === true, 'approved receipt must be exactly revalidated');
  }
  if (eventPresent) {
    req(approved, 'event requires approval');
    req(EVENT_CONTEXTS.includes(receipt.event_binding.context) && EVENT_METHODS.includes(receipt.event_binding.method), 'event binding vocabulary mismatch');
    str(receipt.event_binding.event_ref, 'event_ref'); str(receipt.event_binding.actor_ref, 'actor_ref'); instant(receipt.event_binding.performed_at, 'performed_at');
    req(receipt.event_binding.draft_hash === receipt.approval_binding.draft_hash && receipt.event_binding.payload_hash === receipt.approval_binding.draft_hash, 'event draft/payload hash mismatch');
    req(receipt.event_binding.independently_verified === false, 'independent verification overclaim');
    req(receipt.classification === 'COPIED_PUBLICATION_UNVERIFIED', 'recorded event classification mismatch');
  } else {
    for (const key of ['context','method','event_ref','actor_ref','performed_at','draft_hash','payload_hash']) req(receipt.event_binding[key] === null, `missing event must keep ${key} null`);
    req(receipt.event_binding.application_event_observed === false && receipt.event_binding.independently_verified === false, 'missing event observation flags mismatch');
    req(receipt.classification === (approved ? 'COPY_EXPORT_EVENT_REQUIRED' : 'APPROVAL_REQUIRED'), 'waiting classification mismatch');
  }
  exact(receipt.claims, CLAIM_KEYS, 'claims');
  req(receipt.claims.exact_approval_source_revalidated === true, 'exact approval source claim required');
  req(receipt.claims.approved_exact_draft_bound === approved, 'approved draft claim mismatch');
  req(receipt.claims.copy_export_event_recorded === eventPresent && receipt.claims.copy_export_event_asserts_performed === eventPresent && receipt.claims.event_payload_matches_approved_draft === eventPresent, 'event claim mismatch');
  FALSE_CLAIMS.forEach(k => req(receipt.claims[k] === false, `prohibited claim ${k}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'non_effect set mismatch');
  req(receipt.next_safe_action === nextAction(receipt.classification), 'next_safe_action mismatch');
  req(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}
function validationReceipt(input) { validateInput(input); return { protocol:PROTOCOL,version:VERSION,receipt_type:'MarketCloserCopyExportInputValidationReceipt',copy_export_id:input.copy_export_id,copy_export_hash:input.content_hash,valid:true,copy_export_event_recorded:false,publication_observed:false,external_effect_available:false }; }
function parseText(text) { req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON'); try { return JSON.parse(text); } catch (error) { throw new MarketCloserCopyExportError(`invalid JSON: ${error.message}`); } }
function readInput(inputPath) { str(inputPath,'input path'); return parseText(inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8')); }
function usage() { return ['MarketCloser Copy/Export Receipt v0.1','','Usage:','  node applications/marketcloser/v0.1/copy-export-receipt/v0.1/copy-export.js validate <file|->','  node applications/marketcloser/v0.1/copy-export-receipt/v0.1/copy-export.js receipt <file|->','  node applications/marketcloser/v0.1/copy-export-receipt/v0.1/copy-export.js help','','This runtime records a bounded copy/export event assertion. It does not mutate clipboard/files or observe publication.'].join('\n'); }
function runCli(argv) { const command=argv[0]||'help'; if(['help','--help','-h'].includes(command)) return {text:`${usage()}\n`,exitCode:0}; req(['validate','receipt'].includes(command),`unsupported command: ${command}`); req(argv.length===2,`${command} requires exactly one input path or -`); const input=readInput(argv[1]); const result=command==='validate'?validationReceipt(input):deriveReceipt(input); return {text:`${JSON.stringify(canonicalize(result),null,2)}\n`,exitCode:0}; }
function main(){ try{const r=runCli(process.argv.slice(2));process.stdout.write(r.text);process.exitCode=r.exitCode;}catch(error){process.stderr.write(`${JSON.stringify({error:'MARKETCLOSER_COPY_EXPORT_REJECTED',message:error.message||String(error)})}\n`);process.exitCode=1;} }
if(require.main===module) main();
module.exports={MarketCloserCopyExportError,PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,ORIGIN_TREE,CLASSIFICATIONS,EVENT_CONTEXTS,EVENT_METHODS,INPUT_KEYS,EVENT_KEYS,CONTROL_KEYS,RECEIPT_KEYS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,canonicalize,computeContentHash,rehash,validateEvent,validateInput,loadApprovalInput,nextAction,deriveReceipt,validateReceipt,validationReceipt,parseText,readInput,usage,runCli};
