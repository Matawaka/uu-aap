'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const CopyExport = require(path.resolve(__dirname, '../../copy-export-receipt/v0.1/copy-export.js'));

const PROTOCOL = 'MARKETCLOSER-PUBLICATION-OBSERVATION';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserPublicationObservationInput';
const RECEIPT_TYPE = 'MarketCloserPublicationObservationReceipt';
const ORIGIN_FRONTIER = 'd18416a0f11c5135ba9a4a04bfe366b25a0872eb';
const ORIGIN_TREE = '426bc06cf8a59f6c779b1acf39d1264567911124';
const MATCH_MODE = 'exact_utf8_sha256';

const CLASSIFICATIONS = Object.freeze([
  'COPY_EXPORT_REQUIRED',
  'PUBLICATION_OBSERVATION_REQUIRED',
  'PUBLICATION_NOT_OBSERVED',
  'PUBLICATION_CONTENT_MISMATCH',
  'PUBLICATION_OBSERVED'
]);
const OBSERVATION_CONTEXTS = Object.freeze([
  'synthetic_conformance',
  'application_observed',
  'human_asserted',
  'independent_observer'
]);
const OBSERVATION_METHODS = Object.freeze([
  'synthetic_probe',
  'application_surface',
  'human_visual',
  'http_fetch'
]);
const OBSERVATION_RESULTS = Object.freeze(['not_observed','content_mismatch','content_match']);

const INPUT_KEYS = Object.freeze([
  'protocol','version','artifact_type','observation_id','origin','copy_export_source',
  'copy_export_receipt','observation','controls','content_hash'
]);
const ORIGIN_KEYS = Object.freeze(['repository','revision','tree']);
const SOURCE_KEYS = Object.freeze(['mode','path','expected_copy_export_input_hash']);
const OBSERVATION_KEYS = Object.freeze([
  'context','method','observation_ref','observer_ref','observed_at','publication_url',
  'result','match_mode','observed_content_hash','independently_verified'
]);
const CONTROL_KEYS = Object.freeze([
  'local_only','read_only','publication_observation_recording_available','network_fetch_available',
  'publication_action_available','provider_invocation_available','platform_mutation_available',
  'campaign_send_available','pilot_permit_available','action_permit_available',
  'external_execution_available','external_effect_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol','version','receipt_type','receipt_id','source_input','copy_export_binding',
  'observation_binding','classification','observation_event_recorded','publication_observed',
  'content_match','claims','non_effects','next_safe_action','content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['observation_id','observation_hash']);
const COPY_EXPORT_BINDING_KEYS = Object.freeze([
  'copy_export_id','copy_export_hash','receipt_present','receipt_id','receipt_hash',
  'classification','draft_hash','copied_publication_unverified','exact_receipt_revalidated'
]);
const OBSERVATION_BINDING_KEYS = Object.freeze([
  'present','context','method','observation_ref','observer_ref','observed_at','publication_url',
  'result','match_mode','observed_content_hash','independently_verified'
]);

const FALSE_CLAIMS = Object.freeze([
  'publication_authorized','publication_performed_by_runtime','publication_actor_identity_verified',
  'deployment_provenance_established','runtime_network_accessed','provider_invoked',
  'platform_mutated','campaign_sent','pilot_permit_created','action_permit_created',
  'external_execution_admitted','external_effect_performed','successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([
  'exact_copy_export_source_revalidated','copied_exact_draft_bound',
  'publication_observation_event_recorded','publication_resource_observed',
  'exact_draft_publication_observed','content_hash_exact_match',
  'observation_independently_verified', ...FALSE_CLAIMS
]);
const REQUIRED_NON_EFFECTS = Object.freeze([
  'Copy Export != Platform Publication',
  'Publication Observation != Publication Authority',
  'Observed Publication != Authorized Publication',
  'Human Assertion != Independent Observation',
  'Application Observation != Independent Observation',
  'Content Match != Actor Identity Verification',
  'Publication URL != Deployment Provenance',
  'Publication Observation Receipt != ActionPermit',
  'Publication Observation Receipt != External Effect',
  'Observed External Effect != Authority To Cause Effect'
]);

class MarketCloserPublicationObservationError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserPublicationObservationError(message); };
const clone = value => JSON.parse(JSON.stringify(value));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}
function computeContentHash(value) {
  const copy = clone(value);
  delete copy.content_hash;
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
function instant(value, label) {
  str(value, label);
  const n = Date.parse(value);
  req(Number.isFinite(n), `${label} invalid date-time`);
  return n;
}
function deepEqual(a,b) { return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b)); }

function validatePublicationUrl(value, synthetic = false) {
  str(value, 'observation.publication_url');
  let parsed;
  try { parsed = new URL(value); } catch (_) { throw new MarketCloserPublicationObservationError('publication_url invalid'); }
  req(parsed.protocol === 'https:', 'publication_url must use https');
  req(parsed.hostname.length > 0, 'publication_url hostname required');
  if (synthetic) req(parsed.hostname.endsWith('.invalid'), 'synthetic publication URL must use .invalid');
  return value;
}

function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveCopyExportPath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository copy/export path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'copy/export path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported copy/export source mode');
  return path.resolve(source.path);
}
function loadCopyExportInput(source) {
  const input = JSON.parse(fs.readFileSync(resolveCopyExportPath(source), 'utf8'));
  CopyExport.validateInput(input);
  req(input.content_hash === source.expected_copy_export_input_hash, 'copy/export input hash mismatch');
  return input;
}

function validateObservation(observation) {
  exact(observation, OBSERVATION_KEYS, 'observation');
  req(OBSERVATION_CONTEXTS.includes(observation.context), 'observation context unsupported');
  req(OBSERVATION_METHODS.includes(observation.method), 'observation method unsupported');
  req(OBSERVATION_RESULTS.includes(observation.result), 'observation result unsupported');
  str(observation.observation_ref, 'observation.observation_ref');
  str(observation.observer_ref, 'observation.observer_ref');
  instant(observation.observed_at, 'observation.observed_at');
  validatePublicationUrl(observation.publication_url, observation.context === 'synthetic_conformance');
  req(observation.match_mode === MATCH_MODE, 'observation match mode unsupported');
  req(observation.observed_content_hash === null || /^sha256:[0-9a-f]{64}$/.test(observation.observed_content_hash), 'observed_content_hash invalid');
  req(typeof observation.independently_verified === 'boolean', 'independently_verified must be boolean');

  const methodByContext = {
    synthetic_conformance:'synthetic_probe',
    application_observed:'application_surface',
    human_asserted:'human_visual',
    independent_observer:'http_fetch'
  };
  req(observation.method === methodByContext[observation.context], 'observation method/context mismatch');
  if (observation.context === 'synthetic_conformance') {
    req(observation.observation_ref.startsWith('urn:synthetic:'), 'synthetic observation_ref required');
    req(observation.observer_ref.startsWith('urn:synthetic:'), 'synthetic observer_ref required');
    req(observation.independently_verified === false, 'synthetic observation cannot claim independent verification');
  } else if (observation.context === 'independent_observer') {
    req(observation.independently_verified === true, 'independent_observer requires independently_verified=true');
  } else {
    req(observation.independently_verified === false, 'human/application observation cannot claim independent verification');
  }

  if (observation.result === 'not_observed') req(observation.observed_content_hash === null, 'not_observed requires null content hash');
  else req(observation.observed_content_hash !== null, 'observed content result requires content hash');
  return observation;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.observation_id, 'observation_id', /^urn:uu-aap:marketcloser:publication-observation:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.origin, ORIGIN_KEYS, 'origin');
  req(input.origin.repository === 'Matawaka/uu-aap' && input.origin.revision === ORIGIN_FRONTIER && input.origin.tree === ORIGIN_TREE, 'origin frontier mismatch');
  exact(input.copy_export_source, SOURCE_KEYS, 'copy_export_source');
  req(['repository_synthetic','local_private'].includes(input.copy_export_source.mode), 'copy/export source mode unsupported');
  str(input.copy_export_source.path, 'copy_export_source.path');
  str(input.copy_export_source.expected_copy_export_input_hash, 'expected copy/export input hash', /^sha256:[0-9a-f]{64}$/);

  req(input.copy_export_receipt === null || (input.copy_export_receipt && typeof input.copy_export_receipt === 'object' && !Array.isArray(input.copy_export_receipt)), 'copy_export_receipt must be object or null');
  if (input.copy_export_receipt !== null) CopyExport.validateReceipt(input.copy_export_receipt);
  req(input.observation === null || (input.observation && typeof input.observation === 'object' && !Array.isArray(input.observation)), 'observation must be object or null');
  if (input.observation !== null) validateObservation(input.observation);
  req(input.copy_export_receipt !== null || input.observation === null, 'publication observation cannot exist without copy/export receipt');

  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true &&
    input.controls.publication_observation_recording_available === true,
    'runtime must remain local/read-only observation recorder');
  for (const key of CONTROL_KEYS.filter(k => !['local_only','read_only','publication_observation_recording_available'].includes(k))) {
    req(input.controls[key] === false, `execution/external capability must remain false: ${key}`);
  }
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function classificationForObservation(observation) {
  if (observation.result === 'not_observed') return 'PUBLICATION_NOT_OBSERVED';
  if (observation.result === 'content_mismatch') return 'PUBLICATION_CONTENT_MISMATCH';
  return 'PUBLICATION_OBSERVED';
}
function nextAction(classification) {
  return {
    COPY_EXPORT_REQUIRED:'OBTAIN_COPIED_PUBLICATION_UNVERIFIED',
    PUBLICATION_OBSERVATION_REQUIRED:'RECORD_PUBLICATION_OBSERVATION',
    PUBLICATION_NOT_OBSERVED:'REOBSERVATION_OR_HUMAN_REVIEW_REQUIRED',
    PUBLICATION_CONTENT_MISMATCH:'PUBLICATION_CONTENT_RECONCILIATION_REQUIRED',
    PUBLICATION_OBSERVED:'OUTCOME_EVIDENCE_REQUIRED'
  }[classification];
}

function deriveReceipt(input) {
  validateInput(input);
  const copyInput = loadCopyExportInput(input.copy_export_source);
  const expectedCopyReceipt = CopyExport.deriveReceipt(copyInput);

  let copyPresent = false;
  let exactCopy = false;
  let copied = false;
  if (input.copy_export_receipt !== null) {
    req(deepEqual(expectedCopyReceipt, input.copy_export_receipt), 'copy/export receipt does not match exact source');
    copyPresent = true;
    exactCopy = true;
    copied = input.copy_export_receipt.classification === 'COPIED_PUBLICATION_UNVERIFIED' &&
      input.copy_export_receipt.copy_export_event_recorded === true;
  }

  if (input.observation !== null) req(copied, 'publication observation requires COPIED_PUBLICATION_UNVERIFIED');
  const observationPresent = input.observation !== null;
  const draftHash = copied ? input.copy_export_receipt.approval_binding.draft_hash : null;

  if (observationPresent && input.observation.result === 'content_match') {
    req(input.observation.observed_content_hash === draftHash, 'content_match requires exact copied draft hash');
  }
  if (observationPresent && input.observation.result === 'content_mismatch') {
    req(input.observation.observed_content_hash !== draftHash, 'content_mismatch requires a different content hash');
  }

  const classification = !copied
    ? 'COPY_EXPORT_REQUIRED'
    : !observationPresent
      ? 'PUBLICATION_OBSERVATION_REQUIRED'
      : classificationForObservation(input.observation);

  const publicationObserved = classification === 'PUBLICATION_OBSERVED';
  const resourceObserved = observationPresent && input.observation.result !== 'not_observed';
  const claims = {
    exact_copy_export_source_revalidated:true,
    copied_exact_draft_bound:copied,
    publication_observation_event_recorded:observationPresent,
    publication_resource_observed:resourceObserved,
    exact_draft_publication_observed:publicationObserved,
    content_hash_exact_match:publicationObserved,
    observation_independently_verified:observationPresent ? input.observation.independently_verified : false
  };
  FALSE_CLAIMS.forEach(k => { claims[k] = false; });

  const receipt = {
    protocol:PROTOCOL,
    version:VERSION,
    receipt_type:RECEIPT_TYPE,
    receipt_id:`urn:uu-aap:marketcloser:publication-observation-receipt:${input.content_hash.slice(-24)}`,
    source_input:{ observation_id:input.observation_id, observation_hash:input.content_hash },
    copy_export_binding:{
      copy_export_id:copyInput.copy_export_id,
      copy_export_hash:copyInput.content_hash,
      receipt_present:copyPresent,
      receipt_id:copyPresent ? input.copy_export_receipt.receipt_id : null,
      receipt_hash:copyPresent ? input.copy_export_receipt.content_hash : null,
      classification:copyPresent ? input.copy_export_receipt.classification : null,
      draft_hash:draftHash,
      copied_publication_unverified:copied,
      exact_receipt_revalidated:exactCopy
    },
    observation_binding:{
      present:observationPresent,
      context:observationPresent ? input.observation.context : null,
      method:observationPresent ? input.observation.method : null,
      observation_ref:observationPresent ? input.observation.observation_ref : null,
      observer_ref:observationPresent ? input.observation.observer_ref : null,
      observed_at:observationPresent ? input.observation.observed_at : null,
      publication_url:observationPresent ? input.observation.publication_url : null,
      result:observationPresent ? input.observation.result : null,
      match_mode:observationPresent ? input.observation.match_mode : null,
      observed_content_hash:observationPresent ? input.observation.observed_content_hash : null,
      independently_verified:observationPresent ? input.observation.independently_verified : false
    },
    classification,
    observation_event_recorded:observationPresent,
    publication_observed:publicationObserved,
    content_match:publicationObserved,
    claims,
    non_effects:[...REQUIRED_NON_EFFECTS],
    next_safe_action:nextAction(classification),
    content_hash:''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === RECEIPT_TYPE, 'receipt header mismatch');
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:publication-observation-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.copy_export_binding, COPY_EXPORT_BINDING_KEYS, 'copy_export_binding');
  exact(receipt.observation_binding, OBSERVATION_BINDING_KEYS, 'observation_binding');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification unsupported');

  const copied = receipt.copy_export_binding.copied_publication_unverified === true;
  const observationPresent = receipt.observation_binding.present === true;
  const publicationObserved = receipt.classification === 'PUBLICATION_OBSERVED';

  if (copied) {
    req(receipt.copy_export_binding.classification === 'COPIED_PUBLICATION_UNVERIFIED', 'copy/export classification mismatch');
    str(receipt.copy_export_binding.draft_hash, 'copied draft hash', /^sha256:[0-9a-f]{64}$/);
    req(receipt.copy_export_binding.exact_receipt_revalidated === true, 'copied receipt must be exactly revalidated');
  }
  if (observationPresent) {
    req(copied, 'observation requires copied draft');
    req(OBSERVATION_CONTEXTS.includes(receipt.observation_binding.context), 'observation context mismatch');
    req(OBSERVATION_METHODS.includes(receipt.observation_binding.method), 'observation method mismatch');
    req(OBSERVATION_RESULTS.includes(receipt.observation_binding.result), 'observation result mismatch');
    str(receipt.observation_binding.observation_ref, 'observation_ref');
    str(receipt.observation_binding.observer_ref, 'observer_ref');
    instant(receipt.observation_binding.observed_at, 'observed_at');
    validatePublicationUrl(receipt.observation_binding.publication_url, receipt.observation_binding.context === 'synthetic_conformance');
    req(receipt.observation_binding.match_mode === MATCH_MODE, 'receipt match mode mismatch');
    if (receipt.observation_binding.result === 'not_observed') {
      req(receipt.observation_binding.observed_content_hash === null, 'not_observed receipt hash must be null');
    } else {
      str(receipt.observation_binding.observed_content_hash, 'observed content hash', /^sha256:[0-9a-f]{64}$/);
    }
    if (receipt.observation_binding.context === 'independent_observer') req(receipt.observation_binding.independently_verified === true, 'independent observer verification mismatch');
    else req(receipt.observation_binding.independently_verified === false, 'non-independent observer overclaim');
  } else {
    for (const key of ['context','method','observation_ref','observer_ref','observed_at','publication_url','result','match_mode','observed_content_hash']) {
      req(receipt.observation_binding[key] === null, `missing observation must keep ${key} null`);
    }
    req(receipt.observation_binding.independently_verified === false, 'missing observation cannot be independently verified');
  }

  req(receipt.observation_event_recorded === observationPresent, 'observation_event_recorded mismatch');
  req(receipt.publication_observed === publicationObserved && receipt.content_match === publicationObserved, 'publication/content-match flag mismatch');
  if (publicationObserved) {
    req(observationPresent && receipt.observation_binding.result === 'content_match', 'publication observed requires content_match');
    req(receipt.observation_binding.observed_content_hash === receipt.copy_export_binding.draft_hash, 'publication observed exact hash mismatch');
  }
  if (receipt.classification === 'PUBLICATION_CONTENT_MISMATCH') {
    req(observationPresent && receipt.observation_binding.result === 'content_mismatch', 'content mismatch classification mismatch');
    req(receipt.observation_binding.observed_content_hash !== receipt.copy_export_binding.draft_hash, 'mismatch cannot equal copied draft hash');
  }
  if (receipt.classification === 'PUBLICATION_NOT_OBSERVED') {
    req(observationPresent && receipt.observation_binding.result === 'not_observed', 'not observed classification mismatch');
  }
  if (!observationPresent) req(receipt.classification === (copied ? 'PUBLICATION_OBSERVATION_REQUIRED' : 'COPY_EXPORT_REQUIRED'), 'waiting classification mismatch');

  exact(receipt.claims, CLAIM_KEYS, 'claims');
  req(receipt.claims.exact_copy_export_source_revalidated === true, 'exact copy/export source claim required');
  req(receipt.claims.copied_exact_draft_bound === copied, 'copied draft claim mismatch');
  req(receipt.claims.publication_observation_event_recorded === observationPresent, 'observation claim mismatch');
  req(receipt.claims.publication_resource_observed === (observationPresent && receipt.observation_binding.result !== 'not_observed'), 'resource-observed claim mismatch');
  req(receipt.claims.exact_draft_publication_observed === publicationObserved && receipt.claims.content_hash_exact_match === publicationObserved, 'exact publication claim mismatch');
  req(receipt.claims.observation_independently_verified === (observationPresent ? receipt.observation_binding.independently_verified : false), 'independent verification claim mismatch');
  FALSE_CLAIMS.forEach(k => req(receipt.claims[k] === false, `prohibited claim ${k}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'non_effect set mismatch');
  req(receipt.next_safe_action === nextAction(receipt.classification), 'next_safe_action mismatch');
  req(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol:PROTOCOL,
    version:VERSION,
    receipt_type:'MarketCloserPublicationObservationInputValidationReceipt',
    observation_id:input.observation_id,
    observation_hash:input.content_hash,
    valid:true,
    observation_recorded:false,
    publication_observed:false,
    publication_authorized:false,
    external_effect_available:false
  };
}
function parseText(text) {
  req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserPublicationObservationError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8');
  return parseText(text);
}
function usage() {
  return [
    'MarketCloser Publication Observation v0.1','',
    'Usage:',
    '  node applications/marketcloser/v0.1/publication-observation/v0.1/publication-observation.js validate <file|->',
    '  node applications/marketcloser/v0.1/publication-observation/v0.1/publication-observation.js receipt <file|->',
    '  node applications/marketcloser/v0.1/publication-observation/v0.1/publication-observation.js help','',
    'The runtime records supplied publication-observation evidence only. It does not fetch, publish or mutate an external platform.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help','--help','-h'].includes(command)) return { text:`${usage()}\n`, exitCode:0 };
  req(['validate','receipt'].includes(command), `unsupported command: ${command}`);
  req(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : deriveReceipt(input);
  return { text:`${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode:0 };
}
function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error:'MARKETCLOSER_PUBLICATION_OBSERVATION_REJECTED', message:error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();

module.exports = {
  MarketCloserPublicationObservationError,
  PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,ORIGIN_TREE,MATCH_MODE,
  CLASSIFICATIONS,OBSERVATION_CONTEXTS,OBSERVATION_METHODS,OBSERVATION_RESULTS,
  INPUT_KEYS,CONTROL_KEYS,RECEIPT_KEYS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,
  canonicalize,computeContentHash,rehash,validateInput,validateObservation,loadCopyExportInput,
  classificationForObservation,nextAction,deriveReceipt,validateReceipt,validationReceipt,
  parseText,readInput,usage,runCli
};
