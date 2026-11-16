'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Ajv2020 = require('ajv/dist/2020');
const { runScenario, hash, ROOT, alwaysFalse } = require('../lifecycle-v0.1/lifecycle-trial.js');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const contract = read('contract.schema.json');
const manifest = read('agent-manifest.json');
const limits = Object.freeze({ ...manifest.limits });
const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false,
  useDefaults: false, removeAdditional: false, validateFormats: false });
ajv.addSchema(contract);
const validate = name => ajv.getSchema(`${contract.$id}#/$defs/${name}`);
const modes = ['fresh_boundary', 'cached_boundary'];
const names = ['describe', 'run', 'compare', 'replay'];
const descriptions = {
  describe: 'Describe the offline synthetic experiment, limits, schemas and fixed scenario catalogue.',
  run: 'Run one bounded data-only scenario in a named arm; output is experimental evidence, not permission.',
  compare: 'Run the same scenario in fresh/cached arms and report their differences without external effects.',
  replay: 'Reproduce a receipt locally with the same pinned source; this does not authenticate its issuer.',
};
const interfaceFiles = ['agent-core.js', 'json-input.js', 'agent-cli.js', 'mcp-server.js',
  'contract.schema.json', 'agent-manifest.json', 'engine-pins.json', 'package.json', 'package-lock.json'];
const startupInterfaceHashes = Object.fromEntries(interfaceFiles.map(n => [n, digestFile(path.join(__dirname, n))]));

class AgentError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function fail(code, message) { throw new AgentError(code, message); }
function bytes(value) { return Buffer.byteLength(JSON.stringify(value), 'utf8'); }
function digestFile(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function preflight(value, maximum = limits.max_request_bytes) {
  const stack = [[value, 0]], seen = new Set();
  let nodes = 0;
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (++nodes > limits.max_nodes || depth > limits.max_depth) fail('REQUEST_LIMIT', 'JSON structural limit exceeded.');
    if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0) ||
      (Number.isInteger(v) && !Number.isSafeInteger(v)))) fail('INVALID_REQUEST', 'Ambiguous JSON number.');
    if (typeof v === 'string' && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)) {
      fail('INVALID_REQUEST', 'Unpaired Unicode surrogate.');
    }
    if (v !== null && typeof v === 'object') {
      if (seen.has(v)) fail('INVALID_REQUEST', 'Non-JSON shared or cyclic object.');
      seen.add(v);
      if (!Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v))) {
        fail('INVALID_REQUEST', 'Non-JSON object.');
      }
      for (const child of Object.values(v)) stack.push([child, depth + 1]);
    } else if (!['string', 'number', 'boolean'].includes(typeof v) && v !== null) {
      fail('INVALID_REQUEST', 'Non-JSON value.');
    }
  }
  if (bytes(value) > maximum) fail('REQUEST_LIMIT', 'JSON byte limit exceeded.');
}

function schemaCheck(name, value) {
  if (!validate(name)(value)) fail('INVALID_REQUEST', `Input does not match ${name}.`);
}

// Export self-contained schemas. No caller-controlled references or fetching.
function schema(name) {
  const selected = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const match = /^#\/\$defs\/([A-Za-z]+)$/.exec(value.$ref);
      if (!match || !contract.$defs[match[1]]) throw new Error('Unknown shipped schema reference');
      if (!selected.has(match[1])) { selected.add(match[1]); visit(contract.$defs[match[1]]); }
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(contract.$defs[name]);
  return structuredClone({ $schema: contract.$schema, ...contract.$defs[name],
    ...(selected.size ? { $defs: Object.fromEntries([...selected].sort().map(n => [n, contract.$defs[n]])) } : {}) });
}

function source() {
  const pins = read('engine-pins.json');
  for (const [relative, expected] of Object.entries(pins.source_sha256)) {
    if (digestFile(path.join(ROOT, relative)) !== expected) fail('SOURCE_MISMATCH', 'Pinned experiment source changed.');
  }
  for (const [name, expected] of Object.entries(startupInterfaceHashes)) {
    if (digestFile(path.join(__dirname, name)) !== expected) fail('SOURCE_MISMATCH', 'Loaded interface source changed; restart with the new version.');
  }
  return {
    experiment_frontier: pins.frontier,
    experiment_source_hash: hash(pins.source_sha256),
    interface_source_hash: hash(startupInterfaceHashes),
    canonicalization: 'COMPONENT_LOCAL_SORTED_JSON_V0_1',
  };
}

function select(input) {
  if ('scenario_id' in input) {
    const scenario = JSON.parse(fs.readFileSync(path.join(__dirname, '../lifecycle-v0.1/scenarios.json'), 'utf8'))
      .find(x => x.id === input.scenario_id);
    if (!scenario) fail('INVALID_REQUEST', 'Unknown reference scenario.');
    return { scenario, origin: 'reference' };
  }
  if (bytes(input.scenario) > limits.max_scenario_bytes) fail('REQUEST_LIMIT', 'Scenario byte limit exceeded.');
  return { scenario: structuredClone(input.scenario), origin: 'caller' };
}

function projection(row) {
  return row ? { response_status: row.response_status, contract_status: row.contract_status,
    contract_reason: row.contract_reason } : null;
}
function differences(a, b) {
  const result = [];
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const fresh = projection(a[index]), cached = projection(b[index]);
    if (hash(fresh) !== hash(cached)) result.push({ index, fresh_boundary: fresh, cached_boundary: cached });
  }
  return result;
}

function createReceipt(operation, args) {
  const input = 'scenario_id' in args ? { scenario_id: args.scenario_id } : { scenario: structuredClone(args.scenario) };
  const selected = select(input);
  const arms = operation === 'experiment.run' ? [args.arm] : modes;
  const observations = arms.map(arm => runScenario(selected.scenario, arm));
  const reference_expectations = observations.map(observation => {
    let status = 'NO_TRUSTED_EXPECTATION';
    if (selected.origin === 'reference') {
      const expected = selected.scenario.expected[observation.arm];
      const matched = expected.length === observation.receipts.length && expected.every((row, index) =>
        Object.entries(row).every(([k, v]) => hash(observation.receipts[index][k]) === hash(v)));
      status = matched ? 'REFERENCE_EXPECTATION_MATCHED' : 'REFERENCE_EXPECTATION_MISMATCH';
    }
    return { arm: observation.arm, status };
  });
  const receipt = {
    receipt_type: 'PersonalAnchorAgentExperimentReceipt', interface_version: '0.1',
    scope: 'OFFLINE_SYNTHETIC_LIFECYCLE', assurance: 'LOCAL_REPRODUCTION_ONLY',
    payload: {
      operation, source: source(), input, hypothesis: args.hypothesis ?? null,
      hypothesis_authority: 'UNASSESSED_CALLER_STATEMENT', arms, observations,
      reference_expectations,
      comparison: arms.length === 2 ? differences(observations[0].receipts, observations[1].receipts) : null,
    }, ...alwaysFalse,
  };
  receipt.receipt_hash = hash(receipt);
  if (bytes(receipt) > limits.max_receipt_bytes) fail('REQUEST_LIMIT', 'Receipt byte limit exceeded.');
  if (!validate('receipt')(receipt)) throw new Error('Produced receipt violates contract');
  return receipt;
}

function toolDefinitions() {
  return names.map(name => ({ name: `experiment.${name}`, description: descriptions[name],
    inputSchema: schema(`${name}Args`), outputSchema: schema(`${name}Output`) }));
}

function dispatch(operation, args) {
  source();
  if (operation === 'experiment.describe') {
    return { manifest: structuredClone(manifest), source: source(),
      tools: toolDefinitions().map(t => ({ name: t.name, description: t.description, arguments_schema: t.inputSchema })),
      response_schema: schema('response'),
      catalogue: JSON.parse(fs.readFileSync(path.join(__dirname, '../lifecycle-v0.1/scenarios.json'), 'utf8'))
        .map(s => ({ id: s.id, title: s.title })), end_to_end_status: 'NOT_EXECUTED' };
  }
  if (['experiment.run', 'experiment.compare'].includes(operation)) return { receipt: createReceipt(operation, args) };
  if (operation === 'experiment.replay') {
    const receipt = args.receipt;
    if (bytes(receipt) > limits.max_receipt_bytes) fail('REQUEST_LIMIT', 'Receipt byte limit exceeded.');
    const withoutHash = structuredClone(receipt); delete withoutHash.receipt_hash;
    if (hash(withoutHash) !== receipt.receipt_hash) fail('RECEIPT_DIGEST_MISMATCH', 'Receipt digest mismatch.');
    if (hash(receipt.payload.source) !== hash(source())) fail('SOURCE_MISMATCH', 'Receipt source does not match this interface.');
    const input = { ...structuredClone(receipt.payload.input),
      ...(receipt.payload.hypothesis === null ? {} : { hypothesis: receipt.payload.hypothesis }) };
    if (receipt.payload.operation === 'experiment.run') input.arm = receipt.payload.arms[0];
    const reproduced = createReceipt(receipt.payload.operation, input);
    if (hash(reproduced) !== hash(receipt)) fail('REPLAY_RESULT_MISMATCH', 'Receipt does not reproduce from its input.');
    return { replay_matched: true, verified_receipt_hash: receipt.receipt_hash,
      verification_scope: 'LOCAL_SAME_SOURCE_REPRODUCTION',
      issuer_authenticity_established: false, independent_review_performed: false };
  }
  fail('UNSUPPORTED_OPERATION', 'Unknown experiment operation.');
}

function errorResponse(operation, code, message) {
  return { interface_version: '0.1', operation, execution_status: 'ERROR',
    scope: 'OFFLINE_SYNTHETIC_LIFECYCLE', identity_established: false,
    authority_created: false, external_effects_performed: false,
    result: null, error: { code, message } };
}

function handle(request) {
  let operation = null;
  try {
    preflight(request);
    if (request && manifest.operations.includes(request.operation)) operation = request.operation;
    else if (request && typeof request.operation === 'string') fail('UNSUPPORTED_OPERATION', 'Unknown experiment operation.');
    schemaCheck('request', request);
    let result;
    try { result = dispatch(operation, request.arguments); }
    catch (error) {
      if (error instanceof AgentError) throw error;
      fail('MODEL_EXECUTION_ERROR', 'The bounded model could not execute this event tape.');
    }
    const response = { interface_version: '0.1', operation, execution_status: 'COMPLETED',
      scope: 'OFFLINE_SYNTHETIC_LIFECYCLE', identity_established: false,
      authority_created: false, external_effects_performed: false, result, error: null };
    if (!validate('response')(response)) throw new Error('Produced response violates contract');
    if (bytes(response) > limits.max_output_bytes) fail('REQUEST_LIMIT', 'Response byte limit exceeded.');
    return response;
  } catch (error) {
    return errorResponse(operation, error instanceof AgentError ? error.code : 'INTERNAL_ERROR',
      error instanceof AgentError ? error.message : 'Internal interface error.');
  }
}

module.exports = { handle, source, schema, validate, toolDefinitions, preflight,
  limits, errorResponse, AgentError, hash };
