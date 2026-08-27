#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = __dirname;
const fixturePath = path.join(dir, "conformance.fixture.json");

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((o, k) => {
      o[k] = stable(value[k]);
      return o;
    }, {});
  }
  return value;
}

function contentHash(record) {
  const copy = clone(record);
  delete copy.content_hash;
  return "sha256:" + crypto.createHash("sha256")
    .update(JSON.stringify(stable(copy)))
    .digest("hex");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const FALSE_GLOBALS = [
  "authority_granted",
  "intent_created",
  "action_permit_created",
  "action_authorized",
  "action_performed",
  "current_availability_asserted",
  "causality_proven",
  "truth_certified",
  "liability_established",
  "future_action_permission_created"
];

const FULL_LIFECYCLE = ["prepare", "authorize", "execute", "observe", "close"];
const CORE_POST = ["ActionReceipt", "OutcomeReceipt", "SuccessorStateReceipt"];
const FORBIDDEN_ACTUATOR_CORE = new Set([
  "StateReceipt", "AvailabilityClaim", "IntentReceipt", "AuthorityReceipt",
  "ResponsibilityReceipt", "CoordinationReceipt", "ActionPermit",
  "ActionReceipt", "OutcomeReceipt", "SuccessorStateReceipt"
]);

function sameArray(a, b) {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function hasAll(arr, values) {
  return Array.isArray(arr) && values.every(v => arr.includes(v));
}

function validate(record) {
  assert(record && typeof record === "object", "descriptor must be an object");
  assert(record.protocol === "UU-AAP-EXECUTION-CAPABILITY-DESCRIPTOR", "wrong protocol");
  assert(record.version === "0.1", "wrong version");
  assert(record.artifact_type === "ExecutionCapabilityDescriptor", "wrong artifact_type");
  assert(typeof record.descriptor_id === "string" && record.descriptor_id.length > 0, "descriptor_id required");

  const cap = record.capability || {};
  assert(typeof cap.capability_id === "string" && cap.capability_id.length > 0, "capability_id required");
  assert(typeof cap.adapter_id === "string" && cap.adapter_id.length > 0, "adapter_id required");
  assert(cap.provider_neutral_schema === true, "schema must remain provider-neutral");
  assert(cap.discovery_only === true, "descriptor must remain discovery-only");

  assert(Array.isArray(record.operations) && record.operations.length > 0, "at least one operation required");
  const names = record.operations.map(o => o.operation);
  assert(new Set(names).size === names.length, "operation names must be unique");

  const globals = record.global_non_effects || {};
  for (const key of FALSE_GLOBALS) assert(globals[key] === false, `global non-effect ${key} must be false`);

  for (const op of record.operations) {
    assert(typeof op.operation === "string" && op.operation.length > 0, "operation name required");
    assert(["read_only", "external_effect"].includes(op.effect_class), "invalid effect_class");
    assert(typeof op.reversible === "boolean", "reversible must be boolean");
    assert(typeof op.compensation_supported === "boolean", "compensation_supported must be boolean");

    const approval = op.approval_contract || {};
    const availability = op.availability_contract || {};
    const lifecycle = op.lifecycle_contract || {};
    const receipts = op.receipt_contract || {};
    const effects = op.effect_contract || {};

    assert(approval.protocol_mode_consent_sufficient === false, "protocol-mode consent cannot authorize an operation");
    assert(availability.advertised_capability_is_current_availability === false, "advertised capability cannot assert current availability");
    assert(availability.availability_proof_is_authority === false, "availability proof cannot become authority");
    assert(receipts.actuator_creates_core_action_permit === false, "actuator cannot create Core ActionPermit");
    assert(receipts.actuator_creates_core_post_action_receipts === false, "actuator cannot create Core post-action receipts");
    assert(receipts.advertised_receipt_support_is_receipt === false, "advertised receipt support is not an actual receipt");
    assert(effects.effect_observation_is_causality_proof === false, "effect observation cannot prove causality");

    const expected = effects.expected_effect_categories || [];
    const nonEffects = effects.explicit_non_effects || [];
    assert(expected.every(x => !nonEffects.includes(x)), "expected effects and explicit non-effects overlap");

    for (const emitted of (receipts.actuator_may_emit || [])) {
      assert(!FORBIDDEN_ACTUATOR_CORE.has(emitted), `actuator cannot advertise emission of Core receipt ${emitted}`);
    }

    if (op.effect_class === "external_effect") {
      assert(typeof op.authority_scope === "string" && op.authority_scope.length > 0, "external effect requires authority_scope");
      assert(approval.required === true, "external effect requires approval");
      assert(approval.mode === "action_specific", "external effect approval must be action_specific");
      assert(approval.scope_binding_required === true, "external effect approval must be scope-bound");

      assert(availability.availability_probe_required_before_authorization === true, "external effect requires fresh availability probe");

      assert(lifecycle.profile === "UU-AAP-BOUNDED-EXECUTION-LIFECYCLE", "external effect must bind Bounded Execution Lifecycle");
      assert(lifecycle.version === "0.1", "wrong lifecycle version");
      assert(lifecycle.mode === "bounded_external_effect", "external effect must use bounded_external_effect mode");
      assert(sameArray(lifecycle.required_phases, FULL_LIFECYCLE), "external effect requires full ordered lifecycle");
      assert(lifecycle.exact_target_binding_required === true, "exact target binding required");
      assert(lifecycle.predecessor_freshness_required === true, "predecessor freshness required");
      assert(lifecycle.fail_closed_target_guard_required === true, "fail-closed target guard required");
      assert(lifecycle.one_shot_supported === true, "one-shot support required");
      assert(lifecycle.expiry_required === true, "permit expiry required");
      assert(lifecycle.separate_observer_required === true, "separate observer required");

      const pre = receipts.pre_action_required || [];
      assert(hasAll(pre, ["StateReceipt", "IntentReceipt", "CoordinationReceipt", "ActionPermit"]), "missing required pre-action Core receipts");
      assert(pre.includes("AuthorityReceipt") || pre.includes("ResponsibilityReceipt"), "authority/responsibility evidence required");
      assert(sameArray(receipts.core_post_action_required, CORE_POST), "Core post-action receipt contract mismatch");
    } else {
      assert(approval.required === false, "read-only operation must not require action approval");
      assert(approval.mode === "none", "read-only approval mode must be none");
      assert(lifecycle.mode === "read_only_lightweight", "read-only operation must use lightweight lifecycle mode");
      assert(!lifecycle.required_phases.includes("execute"), "read-only operation cannot require execute phase");
    }
  }

  assert(record.content_hash === contentHash(record), "content_hash mismatch");
  return true;
}

function expectInvalid(base, label, mutate) {
  const x = clone(base);
  mutate(x);
  x.content_hash = contentHash(x);
  let failed = false;
  try { validate(x); } catch (_) { failed = true; }
  assert(failed, `negative test unexpectedly passed: ${label}`);
}

function runConformance() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  validate(fixture);

  const tests = [
    ["descriptor grants more than discovery", x => { x.capability.discovery_only = false; }],
    ["descriptor grants authority", x => { x.global_non_effects.authority_granted = true; }],
    ["descriptor asserts current availability", x => { x.global_non_effects.current_availability_asserted = true; }],
    ["external effect without approval", x => { x.operations[0].approval_contract.required = false; }],
    ["external effect blanket approval mode", x => { x.operations[0].approval_contract.mode = "none"; }],
    ["protocol mode consent treated as sufficient", x => { x.operations[0].approval_contract.protocol_mode_consent_sufficient = true; }],
    ["advertisement treated as current availability", x => { x.operations[0].availability_contract.advertised_capability_is_current_availability = true; }],
    ["availability treated as authority", x => { x.operations[0].availability_contract.availability_proof_is_authority = true; }],
    ["availability probe removed", x => { x.operations[0].availability_contract.availability_probe_required_before_authorization = false; }],
    ["execute phase omitted", x => { x.operations[0].lifecycle_contract.required_phases = ["prepare","authorize","observe","close"]; }],
    ["exact target binding removed", x => { x.operations[0].lifecycle_contract.exact_target_binding_required = false; }],
    ["predecessor freshness removed", x => { x.operations[0].lifecycle_contract.predecessor_freshness_required = false; }],
    ["fail-closed guard removed", x => { x.operations[0].lifecycle_contract.fail_closed_target_guard_required = false; }],
    ["one-shot unsupported", x => { x.operations[0].lifecycle_contract.one_shot_supported = false; }],
    ["expiry removed", x => { x.operations[0].lifecycle_contract.expiry_required = false; }],
    ["observer separation removed", x => { x.operations[0].lifecycle_contract.separate_observer_required = false; }],
    ["ActionPermit omitted", x => { x.operations[0].receipt_contract.pre_action_required = x.operations[0].receipt_contract.pre_action_required.filter(v => v !== "ActionPermit"); }],
    ["actuator advertises ActionPermit emission", x => { x.operations[0].receipt_contract.actuator_may_emit.push("ActionPermit"); }],
    ["actuator creates ActionPermit", x => { x.operations[0].receipt_contract.actuator_creates_core_action_permit = true; }],
    ["actuator creates Core post-action receipts", x => { x.operations[0].receipt_contract.actuator_creates_core_post_action_receipts = true; }],
    ["advertised receipt support treated as receipt", x => { x.operations[0].receipt_contract.advertised_receipt_support_is_receipt = true; }],
    ["post-action receipt contract substituted", x => { x.operations[0].receipt_contract.core_post_action_required = ["ActionReceipt","OutcomeReceipt"]; }],
    ["effect/non-effect overlap", x => { x.operations[0].effect_contract.explicit_non_effects.push("demo_state_change"); }],
    ["observation treated as causality proof", x => { x.operations[0].effect_contract.effect_observation_is_causality_proof = true; }]
  ];

  for (const [label, mutate] of tests) expectInvalid(fixture, label, mutate);

  const wrongHash = clone(fixture);
  wrongHash.content_hash = "sha256:" + "0".repeat(64);
  let hashFailed = false;
  try { validate(wrongHash); } catch (_) { hashFailed = true; }
  assert(hashFailed, "negative test unexpectedly passed: content hash mismatch");

  console.log(`Execution Capability Descriptor v0.1: PASS (${tests.length + 1} negative tests)`);
}

module.exports = { validate, contentHash };

if (require.main === module) runConformance();
