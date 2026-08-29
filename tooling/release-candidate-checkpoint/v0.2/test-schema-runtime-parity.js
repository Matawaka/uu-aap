'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runtime = require('./release-candidate-checkpoint.js');

const inputSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'checkpoint-input.schema.json'), 'utf8'));
const reportSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'checkpoint-report.schema.json'), 'utf8'));
assert.equal(inputSchema.properties.artifact_type.const, runtime.INPUT_ARTIFACT_TYPE);
assert.equal(inputSchema.properties.version.const, runtime.VERSION);
assert.deepEqual(inputSchema.$defs.engineeringGate.properties.gate_id.enum, runtime.ENGINEERING_GATES);
assert.deepEqual(inputSchema.$defs.governanceGate.properties.gate_id.enum, runtime.GOVERNANCE_GATES);
assert.equal(reportSchema.properties.artifact_type.const, runtime.ARTIFACT_TYPE);
assert.equal(reportSchema.properties.version.const, runtime.VERSION);
assert.deepEqual(reportSchema.properties.decision.enum, ['BLOCKED','INSUFFICIENT_EVIDENCE','RELEASE_CANDIDATE_REVIEW_PENDING','READY']);
for (const field of ['assurance_escalated','release_authorized','publication_authorized','certification_granted','legal_status_established','authority_created','runtime_activated','ci_narrowing_authorized']) assert.equal(reportSchema.properties[field].const, false);
assert.equal(reportSchema.properties.future_evolution_allowed.const, true);
console.log('Release Candidate Checkpoint v0.2 schema/runtime parity passed');
