'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Disposition = require(path.resolve(__dirname, '../../human-analysis-disposition/v0.1/disposition.js'));
const Adapter = require(path.resolve(__dirname, '../../real-stress-test-adapter/v0.1/adapter.js'));
const Revalidation = require(path.resolve(__dirname, '../../real-review-local-run-revalidation/v0.1/revalidation.js'));

const PROTOCOL = 'MARKETCLOSER-RESPONSE-CANDIDATE';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserResponseCandidateInput';
const RECEIPT_TYPE = 'MarketCloserResponseCandidateReceipt';
const ORIGIN_FRONTIER = '0cac7d49bda673f6bd500fcedf74031064f8ee53';
const ORIGIN_TREE = '6c008f46c177e12ec12830a025180b71dba48c62';
const NEXT_SAFE_ACTION = 'HUMAN_RESPONSE_APPROVAL_REQUIRED';

const CONTEXT_MODES = Object.freeze(['synthetic_conformance', 'human_supplied_minimized']);
const TONES = Object.freeze(['neutral_professional', 'empathetic_bounded', 'concise_factual']);
const LANGUAGES = Object.freeze(['ru']);
const CLASSIFICATIONS = Object.freeze([
  'DISPOSITION_ACCEPTANCE_REQUIRED',
  'CUSTOMER_CONTEXT_REQUIRED',
  'RESPONSE_CANDIDATE_READY'
]);

const INPUT_KEYS = Object.freeze([
  'protocol','version','artifact_type','request_id','origin','disposition_source',
  'disposition_receipt','customer_context','controls','content_hash'
]);
const ORIGIN_KEYS = Object.freeze(['repository','revision','tree']);
const SOURCE_KEYS = Object.freeze(['mode','path','expected_disposition_input_hash']);
const CONTEXT_KEYS = Object.freeze([
  'mode','context_id','language','response_purpose','tone','selected_statement_ids',
  'include_uncertainty_disclosures','privacy'
]);
const PRIVACY_KEYS = Object.freeze([
  'human_minimization_reviewed','personal_data_present','sensitive_personal_data_present',
  'reviewer_identity_present','protected_attribute_data_present','psychological_vulnerability_data_present',
  'cross_context_identifier_present','raw_review_content_present','business_pressure_included'
]);
const CONTROL_KEYS = Object.freeze([
  'local_only','read_only','response_candidate_construction_available','human_response_approval_available',
  'copy_export_available','publication_available','provider_invocation_available','network_access_available',
  'platform_mutation_available','campaign_send_available','pilot_permit_available','action_permit_available',
  'external_execution_available','external_effect_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol','version','receipt_type','receipt_id','source_input','disposition_binding',
  'customer_context_binding','classification','response_candidate','claims','non_effects',
  'next_safe_action','content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['request_id','request_hash']);
const DISPOSITION_BINDING_KEYS = Object.freeze([
  'disposition_id','disposition_hash','receipt_present','receipt_id','receipt_hash',
  'classification','decision_value','exact_receipt_revalidated','accepted_for_human_use'
]);
const CONTEXT_BINDING_KEYS = Object.freeze([
  'present','context_id','mode','language','tone','selected_statement_ids','privacy_minimized'
]);
const RESPONSE_KEYS = Object.freeze([
  'candidate_id','language','tone','acknowledgement','evidence_bound_points','uncertainty_disclosures',
  'next_step','closing','draft_text','human_approval_required','approved','copy_export_allowed','published'
]);
const POINT_KEYS = Object.freeze([
  'statement_id','classification','rendering','basis_evidence_refs','text'
]);
const UNCERTAINTY_KEYS = Object.freeze(['statement_id','code','text']);

const TRUE_CLAIMS = Object.freeze([
  'exact_disposition_source_revalidated','accepted_analysis_bound','customer_context_minimized',
  'response_candidate_created','evidence_quality_preserved','human_response_approval_required'
]);
const FALSE_CLAIMS = Object.freeze([
  'raw_review_reconstructed','reviewer_identity_inferred','truth_certified','unsupported_fact_added',
  'response_approved','copy_export_authorized','publication_authorized','provider_invoked','network_accessed',
  'platform_mutated','campaign_sent','pilot_permit_created','action_permit_created',
  'external_execution_admitted','external_effect_performed','successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Accepted Analysis != Approved Response',
  'Response Candidate != Approved Response',
  'Response Candidate != Published Response',
  'Minimized Analysis != Raw Review Reconstruction',
  'Unverified Evidence != Public Fact',
  'Missing Evidence != Negative Fact',
  'Counterargument != Accusation',
  'Risk Hypothesis != Admission of Harm',
  'Response Draft != Publication Authority',
  'Response Draft != Platform Mutation',
  'Response Candidate != ActionPermit',
  'Response Candidate != External Effect',
  'Customer Context != Reviewer Identity'
]);

class MarketCloserResponseCandidateError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserResponseCandidateError(message); };
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
function stringArray(value, label, { minItems = 0 } = {}) {
  req(Array.isArray(value) && value.length >= minItems, `${label} invalid`);
  const seen = new Set();
  value.forEach((item, index) => {
    str(item, `${label}[${index}]`);
    req(!seen.has(item), `${label} must contain unique items`);
    seen.add(item);
  });
}
function deepEqual(a, b) { return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b)); }

function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveDispositionPath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository disposition path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'disposition path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported disposition source mode');
  return path.resolve(source.path);
}
function loadDispositionInput(source) {
  const resolved = resolveDispositionPath(source);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  Disposition.validateInput(input);
  req(input.content_hash === source.expected_disposition_input_hash, 'disposition input hash mismatch');
  return input;
}

function validateCustomerContext(context) {
  exact(context, CONTEXT_KEYS, 'customer_context');
  req(CONTEXT_MODES.includes(context.mode), 'customer_context mode unsupported');
  str(context.context_id, 'customer_context.context_id', /^urn:(?:synthetic|uu-aap):marketcloser:response-context:[a-z0-9][a-z0-9:-]{2,191}$/);
  req(LANGUAGES.includes(context.language), 'customer_context language unsupported');
  req(context.response_purpose === 'public_review_response_candidate', 'customer_context response purpose unsupported');
  req(TONES.includes(context.tone), 'customer_context tone unsupported');
  stringArray(context.selected_statement_ids, 'customer_context.selected_statement_ids', { minItems: 1 });
  req(context.include_uncertainty_disclosures === true, 'uncertainty disclosures must remain enabled');
  exact(context.privacy, PRIVACY_KEYS, 'customer_context.privacy');
  req(context.privacy.human_minimization_reviewed === true, 'human minimization review required');
  for (const key of PRIVACY_KEYS.filter(key => key !== 'human_minimization_reviewed')) {
    req(context.privacy[key] === false, `customer context privacy boundary must keep ${key}=false`);
  }
  if (context.mode === 'synthetic_conformance') req(context.context_id.startsWith('urn:synthetic:'), 'synthetic context requires synthetic id');
  return context;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.request_id, 'request_id', /^urn:uu-aap:marketcloser:response-candidate-request:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.origin, ORIGIN_KEYS, 'origin');
  req(input.origin.repository === 'Matawaka/uu-aap' && input.origin.revision === ORIGIN_FRONTIER && input.origin.tree === ORIGIN_TREE,
    'origin frontier mismatch');
  exact(input.disposition_source, SOURCE_KEYS, 'disposition_source');
  req(['repository_synthetic','local_private'].includes(input.disposition_source.mode), 'disposition source mode unsupported');
  str(input.disposition_source.path, 'disposition_source.path');
  str(input.disposition_source.expected_disposition_input_hash, 'expected disposition hash', /^sha256:[0-9a-f]{64}$/);
  req(input.disposition_receipt === null || (input.disposition_receipt && typeof input.disposition_receipt === 'object' && !Array.isArray(input.disposition_receipt)),
    'disposition_receipt must be object or null');
  if (input.disposition_receipt !== null) Disposition.validateReceipt(input.disposition_receipt);
  req(input.customer_context === null || (input.customer_context && typeof input.customer_context === 'object' && !Array.isArray(input.customer_context)),
    'customer_context must be object or null');
  if (input.customer_context !== null) validateCustomerContext(input.customer_context);
  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true && input.controls.response_candidate_construction_available === true,
    'response candidate construction must remain local/read-only');
  for (const key of CONTROL_KEYS.filter(key => !['local_only','read_only','response_candidate_construction_available'].includes(key))) {
    req(input.controls[key] === false, `external capability must remain false: ${key}`);
  }
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function evidenceMap(candidate) {
  return new Map(candidate.bounded_case.supporting_evidence.map(item => [item.evidence_id, item]));
}
function statementMap(candidate) {
  return new Map(candidate.bounded_case.claim_package.material_statements.map(item => [item.statement_id, item]));
}
function pointRendering(statement, evidence) {
  const refs = statement.evidence_refs.map(ref => evidence.get(ref)).filter(Boolean);
  const contradicting = refs.some(item => item.contradicts_statement_ids.includes(statement.statement_id));
  const allVerifiedSupport = refs.length > 0 && refs.every(item =>
    item.quality === 'verified' && item.supports_statement_ids.includes(statement.statement_id) &&
    !item.contradicts_statement_ids.includes(statement.statement_id));
  if (contradicting || refs.some(item => item.quality === 'conflicting')) return 'conflict';
  if (statement.classification === 'observed_evidence' && allVerifiedSupport) return 'verified_fact';
  return 'qualified';
}
function renderPoint(statement, rendering) {
  if (rendering === 'verified_fact') return `По подтверждённым данным: ${statement.text}`;
  if (rendering === 'conflict') return `По этому пункту есть противоречивые данные, поэтому мы не делаем однозначный вывод: ${statement.text}`;
  return `По имеющейся информации это пока нельзя считать полностью подтверждённым фактом: ${statement.text}`;
}
function renderUncertainty(code) {
  return {
    NO_SUPPORTING_EVIDENCE: 'По этому пункту у нас недостаточно подтверждающих данных.',
    UNVERIFIED_EVIDENCE: 'Связанная информация пока не подтверждена независимо.',
    STALE_EVIDENCE: 'Связанная информация может быть устаревшей.',
    CONFLICTING_EVIDENCE: 'По этому пункту есть противоречивые данные.'
  }[code] || 'По этому пункту сохраняется неопределённость, поэтому окончательный вывод преждевременен.';
}
function acknowledgement(tone) {
  return {
    neutral_professional: 'Спасибо за обратную связь. Мы рассмотрели относящиеся к вопросу сведения.',
    empathetic_bounded: 'Спасибо, что обратили внимание на эту ситуацию. Мы внимательно рассмотрели доступные сведения и хотим ответить без преждевременных выводов.',
    concise_factual: 'Спасибо за обратную связь. Ниже — то, что можно сказать по имеющимся данным.'
  }[tone];
}
function closing(tone) {
  return {
    neutral_professional: 'Спасибо за обратную связь и возможность уточнить ситуацию.',
    empathetic_bounded: 'Спасибо, что поделились опытом — для нас важно корректно разобраться в ситуации.',
    concise_factual: 'Спасибо за обратную связь.'
  }[tone];
}
function nextStep(recommendation) {
  return {
    REQUEST_MORE_EVIDENCE_CANDIDATE: 'Для уверенного вывода нам нужны дополнительные подтверждающие данные.',
    HUMAN_RECONCILIATION_REQUIRED: 'В доступных данных есть противоречия; их нужно дополнительно сверить до окончательного вывода.',
    READY_FOR_HUMAN_DISPOSITION_CANDIDATE: 'По имеющимся данным анализ завершён, но итоговая формулировка ответа всё равно требует отдельного одобрения человеком.'
  }[recommendation];
}

function reconstructAcceptedChain(dispositionInput, dispositionReceipt) {
  req(dispositionReceipt.classification === 'ANALYSIS_ACCEPTED_FOR_HUMAN_USE', 'accepted human analysis disposition required');
  req(dispositionReceipt.human_decision.value === 'ACCEPT_FOR_HUMAN_USE', 'accepted decision value required');
  req(dispositionInput.analysis_receipt !== null, 'accepted disposition requires analysis receipt');
  const adapterInput = Disposition.loadAdapterInput(dispositionInput.analysis_source);
  const analysisReceipt = Adapter.stressTest(adapterInput);
  req(deepEqual(analysisReceipt, dispositionInput.analysis_receipt), 'disposition analysis receipt no longer matches adapter source');
  const revalidationInput = Adapter.loadRevalidationInput(adapterInput.revalidation_source);
  const revalidationReceipt = Revalidation.deriveReceipt(revalidationInput);
  const chain = Adapter.reconstructCandidate(revalidationInput, revalidationReceipt);
  req(chain.candidate.content_hash === analysisReceipt.candidate_binding.candidate_hash, 'candidate hash mismatch');
  return { adapterInput, analysisReceipt, revalidationInput, revalidationReceipt, candidate: chain.candidate };
}

function buildResponseCandidate(input, dispositionInput, dispositionReceipt) {
  const context = input.customer_context;
  req(context !== null, 'customer context required');
  validateCustomerContext(context);
  const chain = reconstructAcceptedChain(dispositionInput, dispositionReceipt);
  const candidate = chain.candidate;
  const statements = statementMap(candidate);
  const evidence = evidenceMap(candidate);
  const selected = context.selected_statement_ids.map(id => {
    req(statements.has(id), `selected statement not found in exact accepted analysis: ${id}`);
    return statements.get(id);
  });
  const points = selected.map(statement => {
    const rendering = pointRendering(statement, evidence);
    return {
      statement_id: statement.statement_id,
      classification: statement.classification,
      rendering,
      basis_evidence_refs: [...statement.evidence_refs].sort(),
      text: renderPoint(statement, rendering)
    };
  });
  const selectedIds = new Set(selected.map(item => item.statement_id));
  const uncertainties = chain.analysisReceipt.analysis.missing_evidence
    .filter(item => selectedIds.has(item.statement_id))
    .map(item => ({ statement_id: item.statement_id, code: item.code, text: renderUncertainty(item.code) }))
    .sort((a, b) => `${a.statement_id}|${a.code}`.localeCompare(`${b.statement_id}|${b.code}`));
  const opening = acknowledgement(context.tone);
  const step = nextStep(chain.analysisReceipt.analysis.recommendation_candidate.candidate);
  const end = closing(context.tone);
  const paragraphs = [
    opening,
    ...points.map(item => item.text),
    ...uncertainties.map(item => item.text),
    step,
    end
  ];
  const response = {
    candidate_id: `urn:uu-aap:marketcloser:response-candidate:${input.content_hash.slice(-24)}`,
    language: context.language,
    tone: context.tone,
    acknowledgement: opening,
    evidence_bound_points: points,
    uncertainty_disclosures: uncertainties,
    next_step: step,
    closing: end,
    draft_text: paragraphs.join('\n\n'),
    human_approval_required: true,
    approved: false,
    copy_export_allowed: false,
    published: false
  };
  return { response, chain };
}

function deriveReceipt(input) {
  validateInput(input);
  const dispositionInput = loadDispositionInput(input.disposition_source);
  const expectedDispositionReceipt = Disposition.deriveReceipt(dispositionInput);
  let exactDispositionReceipt = false;
  if (input.disposition_receipt !== null) {
    req(deepEqual(input.disposition_receipt, expectedDispositionReceipt), 'disposition receipt does not match exact source');
    exactDispositionReceipt = true;
  }
  const accepted = exactDispositionReceipt && expectedDispositionReceipt.classification === 'ANALYSIS_ACCEPTED_FOR_HUMAN_USE';
  let classification = accepted ? (input.customer_context === null ? 'CUSTOMER_CONTEXT_REQUIRED' : 'RESPONSE_CANDIDATE_READY') : 'DISPOSITION_ACCEPTANCE_REQUIRED';
  let responseCandidate = null;
  let customerContextMinimized = false;
  if (classification === 'RESPONSE_CANDIDATE_READY') {
    const built = buildResponseCandidate(input, dispositionInput, expectedDispositionReceipt);
    responseCandidate = built.response;
    customerContextMinimized = true;
  }
  const claims = {};
  TRUE_CLAIMS.forEach(key => { claims[key] = classification === 'RESPONSE_CANDIDATE_READY'; });
  claims.exact_disposition_source_revalidated = true;
  FALSE_CLAIMS.forEach(key => { claims[key] = false; });
  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:response-candidate-receipt:${input.content_hash.slice(-24)}`,
    source_input: { request_id: input.request_id, request_hash: input.content_hash },
    disposition_binding: {
      disposition_id: dispositionInput.disposition_id,
      disposition_hash: dispositionInput.content_hash,
      receipt_present: input.disposition_receipt !== null,
      receipt_id: input.disposition_receipt ? input.disposition_receipt.receipt_id : null,
      receipt_hash: input.disposition_receipt ? input.disposition_receipt.content_hash : null,
      classification: expectedDispositionReceipt.classification,
      decision_value: expectedDispositionReceipt.human_decision.value,
      exact_receipt_revalidated: exactDispositionReceipt,
      accepted_for_human_use: accepted
    },
    customer_context_binding: {
      present: input.customer_context !== null,
      context_id: input.customer_context ? input.customer_context.context_id : null,
      mode: input.customer_context ? input.customer_context.mode : null,
      language: input.customer_context ? input.customer_context.language : null,
      tone: input.customer_context ? input.customer_context.tone : null,
      selected_statement_ids: input.customer_context ? [...input.customer_context.selected_statement_ids] : [],
      privacy_minimized: customerContextMinimized
    },
    classification,
    response_candidate: responseCandidate,
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: classification === 'RESPONSE_CANDIDATE_READY'
      ? NEXT_SAFE_ACTION
      : classification === 'CUSTOMER_CONTEXT_REQUIRED'
        ? 'OBTAIN_HUMAN_MINIMIZED_CUSTOMER_CONTEXT'
        : 'OBTAIN_ACCEPTED_HUMAN_ANALYSIS_DISPOSITION',
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === RECEIPT_TYPE, 'receipt header mismatch');
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:response-candidate-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.disposition_binding, DISPOSITION_BINDING_KEYS, 'disposition_binding');
  exact(receipt.customer_context_binding, CONTEXT_BINDING_KEYS, 'customer_context_binding');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification unsupported');
  if (receipt.classification === 'RESPONSE_CANDIDATE_READY') {
    req(receipt.disposition_binding.accepted_for_human_use === true && receipt.disposition_binding.exact_receipt_revalidated === true,
      'ready candidate requires exact accepted disposition');
    req(receipt.customer_context_binding.present === true && receipt.customer_context_binding.privacy_minimized === true,
      'ready candidate requires minimized customer context');
    exact(receipt.response_candidate, RESPONSE_KEYS, 'response_candidate');
    req(receipt.response_candidate.language === 'ru' && TONES.includes(receipt.response_candidate.tone), 'response candidate language/tone invalid');
    req(Array.isArray(receipt.response_candidate.evidence_bound_points) && receipt.response_candidate.evidence_bound_points.length > 0,
      'response candidate points required');
    receipt.response_candidate.evidence_bound_points.forEach(item => {
      exact(item, POINT_KEYS, 'response_candidate point');
      req(['verified_fact','qualified','conflict'].includes(item.rendering), 'response point rendering invalid');
      req(Array.isArray(item.basis_evidence_refs), 'basis evidence refs invalid');
      str(item.text, 'response point text');
    });
    req(Array.isArray(receipt.response_candidate.uncertainty_disclosures), 'uncertainty disclosures invalid');
    receipt.response_candidate.uncertainty_disclosures.forEach(item => {
      exact(item, UNCERTAINTY_KEYS, 'uncertainty disclosure');
      str(item.text, 'uncertainty text');
    });
    str(receipt.response_candidate.draft_text, 'draft_text');
    req(receipt.response_candidate.human_approval_required === true && receipt.response_candidate.approved === false &&
      receipt.response_candidate.copy_export_allowed === false && receipt.response_candidate.published === false,
      'candidate approval/publication boundary violated');
    req(receipt.next_safe_action === NEXT_SAFE_ACTION, 'ready next safe action mismatch');
  } else {
    req(receipt.response_candidate === null, 'non-ready receipt cannot contain response candidate');
  }
  exact(receipt.claims, CLAIM_KEYS, 'claims');
  req(receipt.claims.exact_disposition_source_revalidated === true, 'exact disposition source revalidation claim required');
  const ready = receipt.classification === 'RESPONSE_CANDIDATE_READY';
  for (const key of TRUE_CLAIMS.filter(key => key !== 'exact_disposition_source_revalidated')) req(receipt.claims[key] === ready, `${key} claim mismatch`);
  FALSE_CLAIMS.forEach(key => req(receipt.claims[key] === false, `prohibited claim ${key}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'non_effect set mismatch');
  req(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}

function inspectionReceipt(input) {
  const receipt = deriveReceipt(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserResponseCandidateInspectionReceipt',
    request_id: input.request_id,
    request_hash: input.content_hash,
    classification: receipt.classification,
    response_candidate_created: receipt.response_candidate !== null,
    next_safe_action: receipt.next_safe_action,
    external_effect_available: false
  };
}
function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserResponseCandidateInputValidationReceipt',
    request_id: input.request_id,
    request_hash: input.content_hash,
    valid: true,
    response_candidate_created: false,
    publication_available: false,
    external_effect_available: false
  };
}
function parseText(text) {
  req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserResponseCandidateError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function usage() {
  return [
    'MarketCloser Response Candidate Construction v0.1','',
    'Usage:',
    '  node applications/marketcloser/v0.1/response-candidate/v0.1/response-candidate.js validate <file|->',
    '  node applications/marketcloser/v0.1/response-candidate/v0.1/response-candidate.js inspect <file|->',
    '  node applications/marketcloser/v0.1/response-candidate/v0.1/response-candidate.js candidate <file|->',
    '  node applications/marketcloser/v0.1/response-candidate/v0.1/response-candidate.js help','',
    'A response candidate is local draft material for human approval only. It is not approved, copied, published or externally sent.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help','--help','-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  req(['validate','inspect','candidate'].includes(command), `unsupported command: ${command}`);
  req(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  if (command === 'validate') return { text: `${JSON.stringify(canonicalize(validationReceipt(input)), null, 2)}\n`, exitCode: 0 };
  if (command === 'inspect') return { text: `${JSON.stringify(canonicalize(inspectionReceipt(input)), null, 2)}\n`, exitCode: 0 };
  const receipt = deriveReceipt(input);
  req(receipt.classification === 'RESPONSE_CANDIDATE_READY', `response candidate not ready: ${receipt.classification}`);
  return { text: `${JSON.stringify(canonicalize(receipt), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try { const result = runCli(process.argv.slice(2)); process.stdout.write(result.text); process.exitCode = result.exitCode; }
  catch (error) { process.stderr.write(`${JSON.stringify({ error:'MARKETCLOSER_RESPONSE_CANDIDATE_REJECTED', message:error.message || String(error) })}\n`); process.exitCode = 1; }
}
if (require.main === module) main();

module.exports = {
  MarketCloserResponseCandidateError,
  PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,ORIGIN_TREE,NEXT_SAFE_ACTION,
  CONTEXT_MODES,TONES,LANGUAGES,CLASSIFICATIONS,INPUT_KEYS,CONTROL_KEYS,RECEIPT_KEYS,
  TRUE_CLAIMS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,
  canonicalize,computeContentHash,rehash,validateCustomerContext,validateInput,loadDispositionInput,
  pointRendering,renderPoint,renderUncertainty,acknowledgement,closing,nextStep,reconstructAcceptedChain,
  buildResponseCandidate,deriveReceipt,validateReceipt,inspectionReceipt,validationReceipt,parseText,readInput,usage,runCli
};
