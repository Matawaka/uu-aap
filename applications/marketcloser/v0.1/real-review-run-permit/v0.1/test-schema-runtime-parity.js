'use strict';

const fs = require('fs');
const path = require('path');
const Permit = require('./permit.js');

const read = name => JSON.parse(fs.readFileSync(path.resolve(__dirname, name), 'utf8'));
const input = read('input.schema.json');
const decision = read('decision-receipt.schema.json');
const permit = read('permit.schema.json');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(input.properties.protocol.const === Permit.PROTOCOL, 'input protocol drift');
assert(input.properties.version.const === Permit.VERSION, 'input version drift');
assert(input.properties.artifact_type.const === Permit.INPUT_TYPE, 'input type drift');
assert(input.properties.permit_origin.properties.revision.const === Permit.ORIGIN_FRONTIER, 'origin revision drift');
assert(input.properties.permit_origin.properties.tree.const === Permit.ORIGIN_TREE, 'origin tree drift');
assert(input.$defs.requestedRun.properties.operation.const === Permit.OPERATION, 'operation drift');
assert(input.$defs.requestedRun.properties.valid_for_seconds.maximum === Permit.MAX_VALIDITY_SECONDS, 'validity ceiling drift');
assert(decision.properties.receipt_type.const === Permit.DECISION_TYPE, 'decision type drift');
assert(new Set(decision.properties.classification.enum).size === Permit.CLASSIFICATIONS.length, 'decision classifications drift');
assert(permit.properties.artifact_type.const === Permit.PERMIT_TYPE, 'permit type drift');
assert(permit.properties.run.properties.operation.const === Permit.OPERATION, 'permit operation drift');
assert(permit.properties.one_shot.const === true && permit.properties.max_invocations.const === 1, 'one-shot schema drift');
assert(permit.properties.capabilities.properties.local_analysis_permitted.const === true, 'local analysis capability drift');
for (const key of [
  'network_access_permitted', 'filesystem_write_permitted', 'provider_invocation_permitted',
  'platform_mutation_permitted', 'response_publication_permitted', 'pilot_permit_created',
  'action_permit_created', 'external_execution_permitted', 'external_effect_permitted'
]) assert(permit.properties.capabilities.properties[key].const === false, `external capability schema drift: ${key}`);

console.log('MarketCloser run permit schema/runtime parity: PASS');
