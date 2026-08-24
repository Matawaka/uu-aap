const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = __dirname;
const fixturePath = path.join(dir, "conformance.fixture.json");
const schemaPath = path.join(dir, "binding.schema.json");

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, sortDeep(value[k])]));
  }
  return value;
}

function hashObjectWithoutContentHash(obj) {
  const copy = JSON.parse(JSON.stringify(obj));
  delete copy.content_hash;
  const canonical = JSON.stringify(sortDeep(copy));
  return "sha256:" + crypto.createHash("sha256").update(canonical).digest("hex");
}

function fail(msg) { throw new Error(msg); }

function sameRef(a, b) {
  return a && b && a.receipt_type === b.receipt_type && a.content_hash === b.content_hash && a.frontier === b.frontier;
}

function validateBinding(r) {
  if (r.protocol !== "UU-AAP-AI-GATEWAY-EXECUTION-LIFECYCLE-BINDING") fail("wrong protocol");
  if (r.version !== "0.1") fail("wrong version");
  if (r.artifact_type !== "GatewayExecutionLifecycleBinding") fail("wrong artifact_type");
  if (r.gateway_profile?.protocol !== "UU-AAP-AI-GATEWAY" || r.gateway_profile?.version !== "0.1") fail("wrong Gateway profile");
  if (r.lifecycle_profile?.protocol !== "UU-AAP-BOUNDED-EXECUTION-LIFECYCLE" || r.lifecycle_profile?.version !== "0.1") fail("wrong lifecycle profile");

  const m = r.mappings;
  if (!m) fail("mappings missing");

  if (JSON.stringify(m.prepare.gateway_operations) !== JSON.stringify(["inspect", "qualify"])) fail("prepare must map only inspect/qualify");
  if (m.prepare.lifecycle_phase !== "prepare") fail("prepare phase mismatch");
  if (m.prepare.assertions?.read_only_only !== true) fail("prepare must remain read-only");
  if (m.prepare.assertions?.no_action_permit_created !== true) fail("prepare cannot create permit");
  if (m.prepare.assertions?.no_action_armed !== true) fail("prepare cannot arm action");
  if (m.prepare.non_effects?.authority_expanded !== false || m.prepare.non_effects?.action_performed !== false) fail("prepare non-effects violated");

  if (m.authorize.gateway_operation !== "authorize" || m.authorize.lifecycle_phase !== "authorize") fail("authorize mapping mismatch");
  if (m.authorize.gateway_decision_ref?.receipt_type !== "GatewayDecisionReceipt") fail("authorize decision ref type mismatch");
  if (m.authorize.gateway_decision_ref?.result !== "admissible") fail("only admissible Gateway decision may map to lifecycle admission");
  if (m.authorize.gateway_decision_ref?.frontier !== r.predecessor_frontier) fail("Gateway decision frontier mismatch");
  if (m.authorize.core_action_permit_ref?.receipt_type !== "ActionPermit") fail("Core ActionPermit missing");
  if (m.authorize.core_action_permit_ref?.frontier !== r.predecessor_frontier) fail("Core ActionPermit frontier mismatch");
  if (!sameRef(m.authorize.core_action_permit_ref, m.authorize.lifecycle_action_permit_ref)) fail("Core/lifecycle ActionPermit mismatch");
  if (m.authorize.target_binding_hash !== r.target_binding_hash) fail("authorize target binding mismatch");
  if (m.authorize.assertions?.gateway_decision_is_admission_only !== true) fail("Gateway decision must be admission only");
  if (m.authorize.assertions?.action_permit_preexists_gateway_decision !== true) fail("ActionPermit must preexist Gateway decision");
  if (m.authorize.assertions?.permit_matches_lifecycle !== true) fail("permit must match lifecycle");
  if (m.authorize.assertions?.approval_scope_matches !== true) fail("approval scope must match");
  if (m.authorize.non_effects?.action_permit_created_by_gateway !== false) fail("Gateway cannot create ActionPermit");
  if (m.authorize.non_effects?.authority_expanded !== false || m.authorize.non_effects?.action_performed !== false) fail("authorize non-effects violated");

  if (m.execute.gateway_operation !== null) fail("Gateway operation must not map to execute");
  if (m.execute.lifecycle_phase !== "execute") fail("execute phase mismatch");
  if (m.execute.actuator_separate !== true) fail("actuator must remain separate");
  if (!sameRef(m.execute.action_permit_ref, m.authorize.core_action_permit_ref)) fail("execute permit mismatch");
  if (m.execute.target_binding_hash !== r.target_binding_hash) fail("execute target binding mismatch");
  if (m.execute.assertions?.gateway_not_actuator !== true) fail("Gateway must not be actuator");
  if (m.execute.assertions?.exact_target_preserved !== true) fail("execute target must stay exact");
  if (m.execute.non_effects?.gateway_action_performed !== false) fail("Gateway execution non-effect violated");

  if (m.observe.gateway_operation !== "observe" || m.observe.lifecycle_phase !== "observe") fail("observe mapping mismatch");
  if (m.observe.gateway_observation_ref?.receipt_type !== "GatewayObservationReceipt") fail("Gateway observation ref missing");
  if (m.observe.gateway_observation_ref?.predecessor_frontier !== r.predecessor_frontier) fail("observation predecessor mismatch");
  const observed = m.observe.gateway_observation_ref?.observed_frontier;
  if (!observed) fail("observed frontier missing");
  if (m.observe.core_action_receipt_ref?.receipt_type !== "ActionReceipt") fail("ActionReceipt missing");
  if (m.observe.core_action_receipt_ref?.frontier !== r.predecessor_frontier) fail("ActionReceipt must remain on predecessor frontier");
  if (m.observe.outcome_receipt_ref?.receipt_type !== "OutcomeReceipt" || m.observe.outcome_receipt_ref?.frontier !== observed) fail("OutcomeReceipt must use observed frontier");
  if (m.observe.successor_state_receipt_ref?.receipt_type !== "SuccessorStateReceipt" || m.observe.successor_state_receipt_ref?.frontier !== observed) fail("SuccessorStateReceipt must use observed frontier");
  if (m.observe.assertions?.gateway_observation_is_adapter_evidence !== true) fail("Gateway observation must remain adapter evidence");
  if (m.observe.assertions?.core_receipts_not_created_by_gateway !== true) fail("Gateway cannot create Core post-action receipts");
  if (m.observe.assertions?.observation_not_execution !== true) fail("observation cannot be execution");
  if (m.observe.assertions?.outcome_not_causality !== true) fail("outcome cannot imply causality");
  if (m.observe.non_effects?.action_performed_by_gateway !== false) fail("Gateway cannot claim execution");
  if (m.observe.non_effects?.causality_proven !== false || m.observe.non_effects?.truth_certified !== false || m.observe.non_effects?.liability_established !== false) fail("observe overclaim");

  if (m.close.gateway_operation !== null) fail("Gateway operation must not map to close");
  if (m.close.lifecycle_phase !== "close" || m.close.closure_processor_separate !== true) fail("close boundary mismatch");
  if (m.close.final_frontier !== observed) fail("close frontier must equal observed frontier");
  if (m.close.assertions?.gateway_not_closure_authority !== true) fail("Gateway must not be closure authority");
  if (m.close.assertions?.bounded_scope_exhausted !== true) fail("bounded scope must be exhausted");
  if (m.close.non_effects?.future_action_authorized !== false || m.close.non_effects?.general_authority_created !== false || m.close.non_effects?.liability_established !== false) fail("close non-effects violated");

  const ne = r.non_effects;
  for (const key of ["gateway_is_actuator","gateway_creates_action_permit","gateway_creates_core_post_action_receipts","gateway_closes_with_future_authority","causality_proven","truth_certified","liability_established"]) {
    if (ne?.[key] !== false) fail(`global non-effect violated: ${key}`);
  }

  if (r.content_hash !== hashObjectWithoutContentHash(r)) fail("content hash mismatch");
  return true;
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function expectReject(name, mutate) {
  const x = clone(fixture);
  mutate(x);
  try { validateBinding(x); } catch (_) { return; }
  fail(`negative test unexpectedly passed: ${name}`);
}

JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
validateBinding(fixture);

const tests = [
  ["authorize in prepare", x => x.mappings.prepare.gateway_operations = ["inspect","authorize"]],
  ["prepare arms action", x => x.mappings.prepare.assertions.no_action_armed = false],
  ["non-admissible decision", x => x.mappings.authorize.gateway_decision_ref.result = "approval_required"],
  ["Gateway creates permit", x => x.mappings.authorize.non_effects.action_permit_created_by_gateway = true],
  ["permit mismatch", x => x.mappings.authorize.lifecycle_action_permit_ref.content_hash = "sha256:" + "a".repeat(64)],
  ["target substitution", x => x.mappings.execute.target_binding_hash = "sha256:" + "b".repeat(64)],
  ["Gateway mapped to execute", x => x.mappings.execute.gateway_operation = "authorize"],
  ["Gateway used as actuator", x => x.mappings.execute.actuator_separate = false],
  ["ActionReceipt on successor", x => x.mappings.observe.core_action_receipt_ref.frontier = x.mappings.observe.gateway_observation_ref.observed_frontier],
  ["OutcomeReceipt on predecessor", x => x.mappings.observe.outcome_receipt_ref.frontier = x.predecessor_frontier],
  ["SuccessorStateReceipt on predecessor", x => x.mappings.observe.successor_state_receipt_ref.frontier = x.predecessor_frontier],
  ["Gateway observation claims execution", x => x.mappings.observe.non_effects.action_performed_by_gateway = true],
  ["Gateway observation claims causality", x => x.mappings.observe.non_effects.causality_proven = true],
  ["Gateway mapped to close", x => x.mappings.close.gateway_operation = "observe"],
  ["closure creates future authority", x => x.mappings.close.non_effects.future_action_authorized = true],
  ["global Gateway actuator claim", x => x.non_effects.gateway_is_actuator = true],
  ["content hash mismatch", x => x.content_hash = "sha256:" + "0".repeat(64)]
];

for (const [name, mutate] of tests) expectReject(name, mutate);

console.log(`AI Gateway ↔ Bounded Execution Lifecycle binding v0.1: PASS (${tests.length} negative tests)`);
