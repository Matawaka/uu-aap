#!/usr/bin/env node
"use strict";
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const DIR = __dirname;
const SCHEMA_PATH = path.join(DIR, "live-acceptance-audit.schema.json");
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const HASH64 = /^[0-9a-f]{64}$/;

function fail(message) { throw new Error(message); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}
function computeHash(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.content_hash;
  return "sha256:" + crypto.createHash("sha256")
    .update(JSON.stringify(canonical(copy)))
    .digest("hex");
}
function refEqual(a, b) {
  return a && b &&
    a.receipt_type === b.receipt_type &&
    a.content_hash === b.content_hash &&
    a.frontier === b.frontier;
}
function checkRef(ref, type, frontier, label) {
  if (!ref || ref.receipt_type !== type) fail(`${label} must reference ${type}`);
  if (!SHA256.test(ref.content_hash || "")) fail(`${label} content_hash malformed`);
  if (ref.frontier !== frontier) fail(`${label} frontier mismatch`);
}
function validateBase(record, file) {
  if (record.protocol !== "UU-AAP-AI-GATEWAY-LIVE-ACCEPTANCE-AUDIT") fail(`${file}: wrong protocol`);
  if (record.version !== "0.1" || record.artifact_type !== "LiveAcceptanceAuditRecord") fail(`${file}: wrong envelope`);
  if (!record.target || !record.authorization || !record.pre_execution_evidence ||
      !record.execution || !record.observation || !record.assessment || !record.non_effects) {
    fail(`${file}: incomplete audit record`);
  }
  if (!record.target.repository || !Number.isInteger(record.target.pr_number)) fail(`${file}: target identity missing`);
  if (!SHA40.test(record.target.expected_head_sha || "") || !SHA40.test(record.target.expected_base_sha || "")) fail(`${file}: target SHA malformed`);
  if (record.target.merge_method !== "squash") fail(`${file}: merge method must be squash`);
  if (!SHA256.test(record.authorization.approval_text_sha256 || "")) fail(`${file}: approval hash malformed`);
  if (record.authorization.action_specific !== true) fail(`${file}: approval not action-specific`);
  if (record.authorization.general_authority_granted !== false) fail(`${file}: generalized authority forbidden`);
  if (record.authorization.future_action_authorized !== false) fail(`${file}: future authorization forbidden`);

  if (record.execution.expected_head_guard_used !== true) fail(`${file}: expected-head guard missing`);
  if (record.execution.merge_result !== "merged") fail(`${file}: expected merged execution result`);
  if (!SHA40.test(record.execution.merge_commit_sha || "")) fail(`${file}: merge successor malformed`);
  if (record.observation.main_after !== record.execution.merge_commit_sha) fail(`${file}: observed main mismatch`);
  if (record.observation.successor_parent !== record.target.expected_base_sha) fail(`${file}: successor parent mismatch`);
  if (record.observation.commit_signature_verified !== true) fail(`${file}: successor signature not verified`);
  if (record.observation.marker_present !== true) fail(`${file}: target marker not observed`);

  for (const [name, value] of Object.entries(record.non_effects)) {
    if (value !== false) fail(`${file}: non-effect ${name} must remain false`);
  }
  if (record.assessment.actuator_frontier_acceptance !== true) fail(`${file}: actuator/frontier acceptance missing`);
  if (record.assessment.post_hoc_permit_forbidden !== true) fail(`${file}: post-hoc permit prohibition missing`);

  const expected = computeHash(record);
  if (record.content_hash !== expected) fail(`${file}: content hash mismatch: expected ${expected}, got ${record.content_hash}`);
}
function validatePartial(record, file) {
  const pre = record.pre_execution_evidence;
  if (pre.persisted_gateway_decision_receipt !== false) fail(`${file}: historical partial record must not invent persisted GatewayDecisionReceipt`);
  if (pre.persisted_core_action_permit !== false) fail(`${file}: historical partial record must not invent persisted ActionPermit`);
  if (pre.durable_typed_pre_action_bundle_complete !== false) fail(`${file}: historical partial record must remain pre-action incomplete`);
  if (record.assessment.durable_pre_action_provenance_acceptance !== false) fail(`${file}: partial record cannot accept durable provenance`);
  if (record.assessment.full_protocol_acceptance !== false) fail(`${file}: partial record cannot claim full acceptance`);
}
function validateFull(record, file) {
  const pre = record.pre_execution_evidence;
  for (const key of ["persisted_gateway_decision_receipt","persisted_core_action_permit","durable_typed_pre_action_bundle_complete","permit_one_shot"]) {
    if (pre[key] !== true) fail(`${file}: full acceptance requires ${key}=true`);
  }
  if (pre.permit_consumed_before_execution !== false) fail(`${file}: permit must be unconsumed before execution`);
  if (record.execution.permit_consumed_after_execution !== true) fail(`${file}: one-shot permit must be consumed after execution`);
  if (!SHA256.test(pre.pre_action_bundle_hash || "") || !SHA256.test(pre.action_permit_hash || "")) fail(`${file}: pre-action evidence hashes malformed`);
  if (!HASH64.test(pre.gateway_request_hash || "") || !HASH64.test(pre.gateway_decision_receipt_hash || "")) fail(`${file}: gateway hashes malformed`);

  if (record.assessment.durable_pre_action_provenance_acceptance !== true ||
      record.assessment.core_gateway_frontier_alignment !== true ||
      record.assessment.full_protocol_acceptance !== true) {
    fail(`${file}: full acceptance assessment incomplete`);
  }

  const predecessorFrontier = `git:${record.target.repository}@${record.target.expected_base_sha}`;
  const successorFrontier = `git:${record.target.repository}@${record.execution.merge_commit_sha}`;
  const core = record.core_post_action;
  const gateway = record.gateway_observation;
  if (!core || !gateway) fail(`${file}: full acceptance requires Core post-action and Gateway observation evidence`);

  checkRef(core.action_receipt_ref, "ActionReceipt", predecessorFrontier, `${file}: ActionReceipt`);
  checkRef(core.outcome_receipt_ref, "OutcomeReceipt", successorFrontier, `${file}: OutcomeReceipt`);
  checkRef(core.successor_state_receipt_ref, "SuccessorStateReceipt", successorFrontier, `${file}: SuccessorStateReceipt`);

  if (gateway.request_hash !== pre.gateway_request_hash) fail(`${file}: GatewayObservation request hash mismatch`);
  if (gateway.predecessor_frontier !== predecessorFrontier) fail(`${file}: GatewayObservation predecessor frontier mismatch`);
  if (gateway.observed_frontier !== successorFrontier) fail(`${file}: GatewayObservation successor frontier mismatch`);
  if (gateway.external_effect_observed !== true) fail(`${file}: external effect not observed`);
  if (gateway.frontier_roles_aligned_with_core !== true) fail(`${file}: Core/Gateway frontier alignment not asserted`);
  if (!refEqual(gateway.core_action_receipt_ref, core.action_receipt_ref)) fail(`${file}: Gateway/Core ActionReceipt reference mismatch`);
  if (!refEqual(gateway.outcome_receipt_ref, core.outcome_receipt_ref)) fail(`${file}: Gateway/Core OutcomeReceipt reference mismatch`);
  if (!refEqual(gateway.successor_state_receipt_ref, core.successor_state_receipt_ref)) fail(`${file}: Gateway/Core SuccessorStateReceipt reference mismatch`);
}
function validateRecord(record, file) {
  validateBase(record, file);
  if (record.assessment.status === "partial_acceptance") validatePartial(record, file);
  else if (record.assessment.status === "full_acceptance") validateFull(record, file);
  else fail(`${file}: unknown acceptance status`);
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
if (schema.title !== "UU-AAP AI Gateway Live Acceptance Audit Record v0.1") fail("audit schema title mismatch");

const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".record.json")).sort();
if (files.length < 2) fail("audit archive must contain historical partial and full acceptance records");

const statuses = new Set();
for (const file of files) {
  const record = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  validateRecord(record, file);
  statuses.add(record.assessment.status);
  process.stdout.write(`PASS ${record.assessment.status}: ${file}\n`);
}
if (!statuses.has("partial_acceptance")) fail("historical partial acceptance record missing");
if (!statuses.has("full_acceptance")) fail("full acceptance record missing");

console.log("UU_AAP_AI_GATEWAY_LIVE_ACCEPTANCE_AUDIT_V0_1_PASS");
module.exports = { validateRecord, computeHash };
