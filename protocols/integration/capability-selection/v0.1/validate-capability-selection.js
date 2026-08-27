#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const fixturePath = path.join(__dirname, "conformance.fixture.json");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

function hashObject(value, excludedKey) {
  const copy = JSON.parse(JSON.stringify(value));
  if (excludedKey) delete copy[excludedKey];
  return "sha256:" + crypto.createHash("sha256")
    .update(JSON.stringify(stable(copy)))
    .digest("hex");
}

function sameSetOrSuperset(actual, required) {
  const s = new Set(actual || []);
  return (required || []).every(x => s.has(x));
}

function classify(req, p) {
  const failed = [];
  if (p.operation !== req.operation) failed.push("operation");
  if (p.effect_class !== req.effect_class) failed.push("effect_class");
  if (p.authority_scope !== req.authority_scope) failed.push("authority_scope");
  if (p.lifecycle_profile !== req.lifecycle_profile) failed.push("lifecycle_profile");
  if (p.lifecycle_version !== req.lifecycle_version) failed.push("lifecycle_version");
  if (p.lifecycle_mode !== req.lifecycle_mode) failed.push("lifecycle_mode");

  const h = req.hard_constraints;
  if (h.action_specific_approval_required && p.approval_mode !== "action_specific") failed.push("action_specific_approval");
  if (h.scope_bound_approval_required && p.scope_binding_required !== true) failed.push("scope_binding");
  if (h.fresh_availability_probe_required && p.availability_probe_required_before_authorization !== true) failed.push("fresh_availability_probe");
  if (h.exact_target_binding_required && p.exact_target_binding_required !== true) failed.push("exact_target_binding");
  if (h.predecessor_freshness_required && p.predecessor_freshness_required !== true) failed.push("predecessor_freshness");
  if (h.fail_closed_target_guard_required && p.fail_closed_target_guard_required !== true) failed.push("fail_closed_target_guard");
  if (h.one_shot_required && p.one_shot_supported !== true) failed.push("one_shot");
  if (h.expiry_required && p.expiry_required !== true) failed.push("expiry");
  if (h.separate_observer_required && p.separate_observer_required !== true) failed.push("separate_observer");
  if (!sameSetOrSuperset(p.required_phases, req.required_phases)) failed.push("required_phases");
  if (!sameSetOrSuperset(p.pre_action_receipts, req.required_pre_action_receipts)) failed.push("pre_action_receipts");
  if (!sameSetOrSuperset(p.post_action_receipts, req.required_post_action_receipts)) failed.push("post_action_receipts");
  return failed;
}

function preferenceVector(req, p) {
  return req.preference_policy.ordered_preferences.map(pref => {
    if (pref === "prefer_reversible") return p.reversible ? 1 : 0;
    if (pref === "prefer_compensation") return p.compensation_supported ? 1 : 0;
    throw new Error("unsupported preference: " + pref);
  });
}

function compareVectorsDesc(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] || 0, bv = b[i] || 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

function validate(record) {
  const errors = [];
  const fail = msg => errors.push(msg);

  if (!record || typeof record !== "object") return ["record must be object"];
  if (record.protocol !== "UU-AAP-CAPABILITY-SELECTION") fail("protocol mismatch");
  if (record.version !== "0.1") fail("version mismatch");
  if (record.artifact_type !== "CapabilitySelectionRecord") fail("artifact type mismatch");
  if (!record.request || !Array.isArray(record.candidates) || record.candidates.length === 0) fail("request/candidates missing");
  if (!record.result || !record.non_effects) fail("result/non_effects missing");
  if (errors.length) return errors;

  const expectedContentHash = hashObject(record, "content_hash");
  if (record.content_hash !== expectedContentHash) fail("content_hash mismatch");

  const forbiddenEffects = [
    "intent_established","current_availability_asserted","authority_granted","approval_created",
    "action_permit_created","action_authorized","action_performed","causality_proven",
    "truth_certified","liability_established","future_action_permission_created"
  ];
  for (const k of forbiddenEffects) {
    if (record.non_effects[k] !== false) fail(`non_effect ${k} must be false`);
  }

  const a = record.result.assertions || {};
  if (a.hard_constraints_applied_before_preferences !== true) fail("hard constraints must precede preferences");
  if (a.no_constraints_relaxed !== true) fail("constraints may not be relaxed");
  if (a.fresh_availability_still_required !== true) fail("selection cannot establish current availability");
  if (a.authorization_still_required !== true) fail("selection cannot authorize action");

  const req = record.request;
  const ids = new Set();
  const descIds = new Set();
  const eligible = [];

  for (const c of record.candidates) {
    const p = c.operation_projection || {};
    if (ids.has(p.capability_id)) fail("duplicate capability_id");
    ids.add(p.capability_id);
    if (descIds.has(c.descriptor_ref && c.descriptor_ref.descriptor_id)) fail("duplicate descriptor_id");
    descIds.add(c.descriptor_ref && c.descriptor_ref.descriptor_id);

    const expectedProjectionHash = hashObject(p, "projection_hash");
    if (p.projection_hash !== expectedProjectionHash) fail(`projection_hash mismatch for ${p.capability_id}`);

    if (p.current_availability_asserted !== false) fail(`candidate ${p.capability_id} asserts current availability`);

    const failed = classify(req, p).sort();
    const storedFailed = [...(c.assessment.failed_hard_constraints || [])].sort();
    if (JSON.stringify(failed) !== JSON.stringify(storedFailed)) fail(`failed constraints mismatch for ${p.capability_id}`);

    const isEligible = failed.length === 0;
    if (c.assessment.eligible !== isEligible) fail(`eligibility mismatch for ${p.capability_id}`);

    const pv = preferenceVector(req, p);
    if (JSON.stringify(pv) !== JSON.stringify(c.assessment.preference_vector)) fail(`preference vector mismatch for ${p.capability_id}`);

    if (isEligible) eligible.push({candidate:c, vector:pv});
    else if (c.assessment.eligible_rank !== null) fail(`ineligible candidate ${p.capability_id} must not have rank`);
  }

  eligible.sort((x,y) => {
    const byVector = compareVectorsDesc(x.vector, y.vector);
    if (byVector !== 0) return byVector;
    return x.candidate.operation_projection.capability_id.localeCompare(y.candidate.operation_projection.capability_id);
  });

  eligible.forEach((x, i) => {
    if (x.candidate.assessment.eligible_rank !== i + 1) {
      fail(`rank mismatch for ${x.candidate.operation_projection.capability_id}`);
    }
  });

  if (eligible.length === 0) {
    if (record.result.status !== "no_match") fail("no eligible candidate requires no_match");
    if (record.result.selected_capability_id !== null || record.result.selected_descriptor_ref !== null) fail("no_match cannot select candidate");
    if (a.selected_candidate_eligible !== false) fail("no_match selected_candidate_eligible must be false");
  } else {
    if (record.result.status !== "selected") fail("eligible candidate requires selected result");
    const top = eligible[0].candidate;
    if (record.result.selected_capability_id !== top.operation_projection.capability_id) fail("selected candidate is not deterministic rank 1");
    if (JSON.stringify(record.result.selected_descriptor_ref) !== JSON.stringify(top.descriptor_ref)) fail("selected descriptor ref mismatch");
    if (a.selected_candidate_eligible !== true) fail("selected result must assert selected candidate eligible");
  }

  return errors;
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function rehashProjection(p) { p.projection_hash = hashObject(p, "projection_hash"); }
function rehashRecord(r) { r.content_hash = hashObject(r, "content_hash"); }

function runConformance() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const positive = validate(fixture);
  if (positive.length) {
    console.error("Positive fixture failed:", positive);
    process.exit(1);
  }

  const mutations = [
    ["selection grants authority", r => { r.non_effects.authority_granted = true; }],
    ["selection asserts current availability", r => { r.non_effects.current_availability_asserted = true; }],
    ["selection creates intent", r => { r.non_effects.intent_established = true; }],
    ["selection creates approval", r => { r.non_effects.approval_created = true; }],
    ["selection creates ActionPermit", r => { r.non_effects.action_permit_created = true; }],
    ["selection authorizes action", r => { r.non_effects.action_authorized = true; }],
    ["selection performs action", r => { r.non_effects.action_performed = true; }],
    ["selection creates future permission", r => { r.non_effects.future_action_permission_created = true; }],
    ["constraints relaxed", r => { r.result.assertions.no_constraints_relaxed = false; }],
    ["availability no longer required", r => { r.result.assertions.fresh_availability_still_required = false; }],
    ["authorization no longer required", r => { r.result.assertions.authorization_still_required = false; }],
    ["ineligible authority scope marked eligible", r => { r.candidates[2].assessment.eligible = true; r.candidates[2].assessment.failed_hard_constraints = []; r.candidates[2].assessment.eligible_rank = 1; }],
    ["operation substitution", r => { r.candidates[0].operation_projection.operation = "delete"; rehashProjection(r.candidates[0].operation_projection); }],
    ["approval downgrade", r => { r.candidates[0].operation_projection.approval_mode = "none"; rehashProjection(r.candidates[0].operation_projection); }],
    ["availability probe removed", r => { r.candidates[0].operation_projection.availability_probe_required_before_authorization = false; rehashProjection(r.candidates[0].operation_projection); }],
    ["lifecycle phase removed", r => { r.candidates[0].operation_projection.required_phases = ["prepare","authorize","execute","close"]; rehashProjection(r.candidates[0].operation_projection); }],
    ["exact target guard removed", r => { r.candidates[0].operation_projection.exact_target_binding_required = false; rehashProjection(r.candidates[0].operation_projection); }],
    ["predecessor freshness removed", r => { r.candidates[0].operation_projection.predecessor_freshness_required = false; rehashProjection(r.candidates[0].operation_projection); }],
    ["fail closed target guard removed", r => { r.candidates[0].operation_projection.fail_closed_target_guard_required = false; rehashProjection(r.candidates[0].operation_projection); }],
    ["one shot removed", r => { r.candidates[0].operation_projection.one_shot_supported = false; rehashProjection(r.candidates[0].operation_projection); }],
    ["expiry removed", r => { r.candidates[0].operation_projection.expiry_required = false; rehashProjection(r.candidates[0].operation_projection); }],
    ["observer separation removed", r => { r.candidates[0].operation_projection.separate_observer_required = false; rehashProjection(r.candidates[0].operation_projection); }],
    ["ActionPermit receipt removed", r => { r.candidates[0].operation_projection.pre_action_receipts = ["StateReceipt","IntentReceipt","AuthorityReceipt","CoordinationReceipt"]; rehashProjection(r.candidates[0].operation_projection); }],
    ["post-action receipt substituted", r => { r.candidates[0].operation_projection.post_action_receipts = ["ActionReceipt","OutcomeReceipt"]; rehashProjection(r.candidates[0].operation_projection); }],
    ["wrong preference vector", r => { r.candidates[0].assessment.preference_vector = [0,0]; }],
    ["wrong eligible rank", r => { r.candidates[0].assessment.eligible_rank = 1; r.candidates[1].assessment.eligible_rank = 2; }],
    ["lower ranked candidate selected", r => { r.result.selected_capability_id = r.candidates[0].operation_projection.capability_id; r.result.selected_descriptor_ref = r.candidates[0].descriptor_ref; }],
    ["no_match despite eligible candidates", r => { r.result.status = "no_match"; r.result.selected_capability_id = null; r.result.selected_descriptor_ref = null; r.result.assertions.selected_candidate_eligible = false; }],
    ["projection hash mismatch", r => { r.candidates[0].operation_projection.projection_hash = "sha256:" + "0".repeat(64); }],
    ["content hash mismatch", r => { r.content_hash = "sha256:" + "0".repeat(64); }],
  ];

  for (const [name, mutate] of mutations) {
    const r = clone(fixture);
    mutate(r);
    if (name !== "content hash mismatch") rehashRecord(r);
    const errs = validate(r);
    if (errs.length === 0) {
      console.error(`Negative mutation unexpectedly passed: ${name}`);
      process.exit(1);
    }
  }

  console.log(`Capability selection v0.1: positive fixture PASS; ${mutations.length} negative mutations rejected.`);
}

module.exports = { validate, hashObject };

if (require.main === module) runConformance();
