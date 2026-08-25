#!/usr/bin/env node
"use strict";

const fs = require("fs");
const crypto = require("crypto");

const ROOT = "pilots/kontur-game-companion/connectivity-evidence/v0.1";
const MANIFEST_PATH = ROOT + "/game-companion-connectivity.json";
const SCHEMA_PATH = ROOT + "/game-companion-connectivity.schema.json";
const WORKFLOW_PATH = ".github/workflows/kontur-game-companion-connectivity-evidence-v0.1.yml";
const OBSERVED_MAIN = "d8500cdcbf9355cce71ce52beaea01c70e1a1c54";
const SOURCE_AUDIT_FRONTIER = "2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee";

const DIRECTION = [
  "State / Evidence Anchor",
  "Possibility / Availability",
  "Intent",
  "Authority / Responsibility",
  "Coordination / CCRP",
  "Action Gate",
  "Outcome / Provenance / Successor State"
];

const LAYERS = [
  ["stable-core", "stable-primitive", null, null, null, [
    "protocols/core/v0.1/README.md",
    "protocols/core/v0.1/end-to-end.fixture.json",
    "protocols/core/v0.1/validate-core.js",
    ".github/workflows/core-protocol-v0.1-validation.yml"
  ]],
  ["observational-lane", "optional-synthetic-pilot", "stable-core", 446, "75c150a192db68d0c167d2408bd436e54b71d475", [
    "pilots/kontur-game-companion/observational-lane/README.md",
    "pilots/kontur-game-companion/observational-lane/observation-cases.json",
    "pilots/kontur-game-companion/observational-lane/validate.py",
    ".github/workflows/kontur-game-companion-observational-lane.yml"
  ]],
  ["assistance-gate", "optional-synthetic-pilot", "observational-lane", 452, "3fc4b66d6eebe90321baea3c92dbad80f3b0afc0", [
    "pilots/kontur-game-companion/assistance-gate/README.md",
    "pilots/kontur-game-companion/assistance-gate/assistance-gate-cases.json",
    "pilots/kontur-game-companion/assistance-gate/validate.py",
    ".github/workflows/kontur-game-companion-assistance-gate.yml"
  ]],
  ["shared-discovery-memory", "optional-synthetic-pilot", "assistance-gate", 453, "b3df9ac63171e6596421a5e7e1dd20cb6a5df615", [
    "pilots/kontur-game-companion/shared-discovery-memory/README.md",
    "pilots/kontur-game-companion/shared-discovery-memory/shared-memory-cases.json",
    "pilots/kontur-game-companion/shared-discovery-memory/validate.py",
    ".github/workflows/kontur-game-companion-shared-discovery-memory.yml"
  ]],
  ["bounded-initiative", "optional-synthetic-pilot", "shared-discovery-memory", 454, "282f1320b8fffbb1f4beb388082ec8d59924f67a", [
    "pilots/kontur-game-companion/bounded-initiative/README.md",
    "pilots/kontur-game-companion/bounded-initiative/initiative-cases.json",
    "pilots/kontur-game-companion/bounded-initiative/validate.py",
    ".github/workflows/kontur-game-companion-bounded-initiative.yml"
  ]],
  ["focus-diversity", "optional-synthetic-pilot", "bounded-initiative", 455, "b45eaf9ba8864023d822340181ae129f1245beb1", [
    "pilots/kontur-game-companion/focus-diversity/README.md",
    "pilots/kontur-game-companion/focus-diversity/focus-cases.json",
    "pilots/kontur-game-companion/focus-diversity/validate.py",
    ".github/workflows/kontur-game-companion-focus-diversity.yml"
  ]],
  ["interaction-receipt", "optional-synthetic-pilot", "focus-diversity", 456, "7c97e26aa3b7504d48b9ded6f0dfdccab444f8bd", [
    "pilots/kontur-game-companion/interaction-receipt/README.md",
    "pilots/kontur-game-companion/interaction-receipt/interaction-receipt-cases.json",
    "pilots/kontur-game-companion/interaction-receipt/validate.py",
    ".github/workflows/kontur-game-companion-interaction-receipt.yml"
  ]],
  ["pause-resume", "optional-synthetic-pilot", "interaction-receipt", 457, "2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee", [
    "pilots/kontur-game-companion/pause-resume/README.md",
    "pilots/kontur-game-companion/pause-resume/pause-resume-cases.json",
    "pilots/kontur-game-companion/pause-resume/validate.py",
    ".github/workflows/kontur-game-companion-pause-resume.yml"
  ]]
];

const RELATIONS = [
  ["stable-core", "observational-lane", "optional_adapter_reuse", "DOCUMENTED"],
  ["observational-lane", "assistance-gate", "declared_predecessor", "PROVEN"],
  ["assistance-gate", "shared-discovery-memory", "declared_predecessor", "PROVEN"],
  ["shared-discovery-memory", "bounded-initiative", "declared_predecessor", "PROVEN"],
  ["bounded-initiative", "focus-diversity", "declared_predecessor", "DOCUMENTED"],
  ["focus-diversity", "interaction-receipt", "declared_predecessor", "PROVEN"],
  ["interaction-receipt", "pause-resume", "declared_predecessor", "PROVEN"]
];

const TRUE_ASSERTIONS = [
  "exact_artifact_binding_required",
  "repository_proximity_is_not_relation",
  "ci_green_is_not_semantic_proof",
  "receipt_is_not_authority",
  "optional_pilot_is_not_stable_core_requirement",
  "reverse_authority_forbidden",
  "changes_fail_closed_until_evidence_refresh"
];

const FALSE_NON_EFFECTS = [
  "existing_architecture_artifact_modified",
  "stable_core_modified",
  "existing_pilot_behavior_modified",
  "existing_workflow_modified",
  "live_response_generation",
  "proactive_messaging",
  "autonomous_gameplay",
  "game_account_control",
  "external_effect_authorized",
  "action_permit_created",
  "successor_permit_created",
  "automatic_stable_core_promotion",
  "copyright_process_modified",
  "license_or_notice_modified",
  "legal_author_identity_modified",
  "pseudonym_publication_process_modified"
];

const WATCH_PATHS = [
  "protocols/core/v0.1/**",
  "pilots/kontur-game-companion/**",
  ".github/workflows/core-protocol-v0.1-validation.yml",
  ".github/workflows/kontur-game-companion-*.yml"
];

const EXCLUDED_PROCESS_PATHS = [
  "LICENSE*",
  "NOTICE*",
  "legal/**",
  "governance/ip/**",
  "docs/ip/**",
  "docs/legal/**"
];

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function exactKeys(object, expected, label, errors) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    errors.push(label + ":object");
    return;
  }
  const actual = Object.keys(object).sort();
  const wanted = expected.slice().sort();
  if (!same(actual, wanted)) errors.push(label + ":keys");
}

function gitBlobSha(path) {
  const content = fs.readFileSync(path);
  const header = Buffer.from("blob " + content.length + "\0");
  return crypto.createHash("sha1").update(header).update(content).digest("hex");
}

function globMatches(path, pattern) {
  if (pattern.endsWith("/**")) return path.startsWith(pattern.slice(0, -2));
  if (pattern.includes("*")) {
    const parts = pattern.split("*");
    return path.startsWith(parts[0]) && path.endsWith(parts[parts.length - 1]);
  }
  return path === pattern;
}

function validate(data) {
  const errors = [];
  exactKeys(data, [
    "protocol", "version", "artifact_type", "evidence_frontier", "stable_direction",
    "layers", "relations", "trigger_scope", "assertions", "non_effects"
  ], "root", errors);

  if (data.protocol !== "UU-AAP-KONTUR-GAME-COMPANION-CONNECTIVITY-EVIDENCE") errors.push("protocol");
  if (data.version !== "0.1") errors.push("version");
  if (data.artifact_type !== "GameCompanionConnectivityEvidence") errors.push("artifact_type");

  const frontier = data.evidence_frontier || {};
  exactKeys(frontier, [
    "observed_main_sha", "source_issue", "source_audit_pr", "source_audit_frontier", "generated_at"
  ], "evidence_frontier", errors);
  if (frontier.observed_main_sha !== OBSERVED_MAIN) errors.push("observed_main_sha");
  if (frontier.source_issue !== 445) errors.push("source_issue");
  if (frontier.source_audit_pr !== 458) errors.push("source_audit_pr");
  if (frontier.source_audit_frontier !== SOURCE_AUDIT_FRONTIER) errors.push("source_audit_frontier");
  if (!same(data.stable_direction, DIRECTION)) errors.push("stable_direction");

  if (!Array.isArray(data.layers) || data.layers.length !== LAYERS.length) {
    errors.push("layers");
  } else {
    const seenIds = new Set();
    const seenPaths = new Set();
    const roles = ["specification", "fixture", "validator", "workflow"];

    for (let i = 0; i < LAYERS.length; i += 1) {
      const expected = LAYERS[i];
      const layer = data.layers[i] || {};
      exactKeys(layer, [
        "id", "layer_class", "predecessor_layer", "origin_pr", "origin_commit", "artifacts"
      ], "layer:" + i, errors);
      if (layer.id !== expected[0]) errors.push("layer:" + i + ":id");
      if (seenIds.has(layer.id)) errors.push("layer:" + i + ":duplicate-id");
      seenIds.add(layer.id);
      if (layer.layer_class !== expected[1]) errors.push("layer:" + layer.id + ":class");
      if (layer.predecessor_layer !== expected[2]) errors.push("layer:" + layer.id + ":predecessor");
      if (layer.origin_pr !== expected[3]) errors.push("layer:" + layer.id + ":origin-pr");
      if (layer.origin_commit !== expected[4]) errors.push("layer:" + layer.id + ":origin-commit");

      if (!Array.isArray(layer.artifacts) || layer.artifacts.length !== 4) {
        errors.push("layer:" + layer.id + ":artifacts");
        continue;
      }
      for (let j = 0; j < 4; j += 1) {
        const artifact = layer.artifacts[j] || {};
        exactKeys(artifact, ["role", "path", "git_blob_sha"], "artifact:" + layer.id + ":" + j, errors);
        if (artifact.role !== roles[j]) errors.push("artifact:" + layer.id + ":" + j + ":role");
        if (artifact.path !== expected[5][j]) errors.push("artifact:" + layer.id + ":" + j + ":path");
        if (seenPaths.has(artifact.path)) errors.push("artifact:" + layer.id + ":" + j + ":duplicate-path");
        seenPaths.add(artifact.path);
        if (!fs.existsSync(artifact.path)) {
          errors.push("artifact:" + layer.id + ":" + j + ":missing");
        } else if (gitBlobSha(artifact.path) !== artifact.git_blob_sha) {
          errors.push("artifact:" + layer.id + ":" + j + ":blob");
        }
      }
    }
  }

  if (!Array.isArray(data.relations) || data.relations.length !== RELATIONS.length) {
    errors.push("relations");
  } else {
    for (let i = 0; i < RELATIONS.length; i += 1) {
      const relation = data.relations[i] || {};
      const expected = RELATIONS[i];
      exactKeys(relation, [
        "id", "source", "target", "relation_type", "classification",
        "source_artifact_paths", "target_artifact_paths", "authority_effect", "notes"
      ], "relation:" + i, errors);
      if (relation.id !== "GC-REL-" + String(i + 1).padStart(3, "0")) errors.push("relation:" + i + ":id");
      if (relation.source !== expected[0]) errors.push("relation:" + i + ":source");
      if (relation.target !== expected[1]) errors.push("relation:" + i + ":target");
      if (relation.relation_type !== expected[2]) errors.push("relation:" + i + ":type");
      if (relation.classification !== expected[3]) errors.push("relation:" + i + ":classification");
      if (relation.authority_effect !== "none") errors.push("relation:" + i + ":authority");

      const sourceLayer = data.layers.find((layer) => layer.id === expected[0]);
      const targetLayer = data.layers.find((layer) => layer.id === expected[1]);
      const sourcePaths = sourceLayer && sourceLayer.artifacts.map((artifact) => artifact.path);
      const targetPaths = targetLayer && targetLayer.artifacts.map((artifact) => artifact.path);
      if (!same(relation.source_artifact_paths, sourcePaths)) errors.push("relation:" + i + ":source-binding");
      if (!same(relation.target_artifact_paths, targetPaths)) errors.push("relation:" + i + ":target-binding");
    }
    if (data.relations.some((relation) => relation.target === "stable-core")) {
      errors.push("reverse-stable-core-relation");
    }
  }

  const scope = data.trigger_scope || {};
  exactKeys(scope, [
    "watch_paths", "excluded_process_paths", "parallel_ip_process_is_dependency"
  ], "trigger_scope", errors);
  if (!same(scope.watch_paths, WATCH_PATHS)) errors.push("watch_paths");
  if (!same(scope.excluded_process_paths, EXCLUDED_PROCESS_PATHS)) errors.push("excluded_process_paths");
  if (scope.parallel_ip_process_is_dependency !== false) errors.push("parallel_ip_process_is_dependency");

  const watchedArtifacts = (data.layers || []).flatMap((layer) => layer.artifacts || []);
  for (const artifact of watchedArtifacts) {
    if (!scope.watch_paths || !scope.watch_paths.some((pattern) => globMatches(artifact.path, pattern))) {
      errors.push("unwatched:" + artifact.path);
    }
  }
  if (scope.watch_paths && scope.watch_paths.some((pattern) =>
    /license|notice|legal|copyright|governance\/ip|docs\/ip/i.test(pattern))) {
    errors.push("ip-process-watch-leak");
  }

  exactKeys(data.assertions, TRUE_ASSERTIONS, "assertions", errors);
  for (const key of TRUE_ASSERTIONS) {
    if (!data.assertions || data.assertions[key] !== true) errors.push("assertion:" + key);
  }

  exactKeys(data.non_effects, FALSE_NON_EFFECTS, "non_effects", errors);
  for (const key of FALSE_NON_EFFECTS) {
    if (!data.non_effects || data.non_effects[key] !== false) errors.push("non-effect:" + key);
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    errors.push("schema:missing");
  } else {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
    if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") errors.push("schema:draft");
    if (schema.additionalProperties !== false) errors.push("schema:root-open");
  }

  if (!fs.existsSync(WORKFLOW_PATH)) {
    errors.push("workflow:missing");
  } else {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    for (const path of WATCH_PATHS) {
      if (!workflow.includes("\"" + path + "\"")) errors.push("workflow:watch:" + path);
    }
    if (!workflow.includes("node " + ROOT + "/validate-game-companion-connectivity.js")) {
      errors.push("workflow:validator");
    }
    if (/license|notice|legal|copyright|governance\/ip|docs\/ip/i.test(workflow)) {
      errors.push("workflow:ip-process-leak");
    }
  }

  return errors;
}

function mutate(data, fn) {
  const copy = structuredClone(data);
  fn(copy);
  return copy;
}

function main() {
  const data = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const canonicalErrors = validate(data);
  if (canonicalErrors.length) {
    throw new Error("canonical connectivity evidence failed: " + canonicalErrors.join(", "));
  }

  const mutations = [
    ["frontier drift", (x) => { x.evidence_frontier.observed_main_sha = "0".repeat(40); }],
    ["stable class promotion", (x) => { x.layers[0].layer_class = "optional-synthetic-pilot"; }],
    ["missing predecessor", (x) => { x.layers[2].predecessor_layer = null; }],
    ["origin drift", (x) => { x.layers[1].origin_commit = "0".repeat(40); }],
    ["blob drift", (x) => { x.layers[1].artifacts[0].git_blob_sha = "0".repeat(40); }],
    ["missing artifact", (x) => { x.layers[1].artifacts.pop(); }],
    ["duplicate layer", (x) => { x.layers[2].id = x.layers[1].id; }],
    ["reverse core relation", (x) => {
      x.relations[0].source = "observational-lane";
      x.relations[0].target = "stable-core";
    }],
    ["optional relation overclaim", (x) => { x.relations[0].classification = "PROVEN"; }],
    ["binding truncation", (x) => { x.relations[1].source_artifact_paths.pop(); }],
    ["authority leak", (x) => { x.relations[1].authority_effect = "grants"; }],
    ["direction reversal", (x) => { x.stable_direction.reverse(); }],
    ["fail-open assertion", (x) => {
      x.assertions.changes_fail_closed_until_evidence_refresh = false;
    }],
    ["action permit", (x) => { x.non_effects.action_permit_created = true; }],
    ["copyright process mutation", (x) => { x.non_effects.copyright_process_modified = true; }],
    ["existing workflow mutation", (x) => { x.non_effects.existing_workflow_modified = true; }],
    ["IP dependency", (x) => { x.trigger_scope.parallel_ip_process_is_dependency = true; }],
    ["IP path watch leak", (x) => { x.trigger_scope.watch_paths.push("governance/ip/**"); }]
  ];

  const survivors = [];
  for (const mutation of mutations) {
    if (validate(mutate(data, mutation[1])).length === 0) survivors.push(mutation[0]);
  }
  if (survivors.length) {
    throw new Error("fail-closed mutation(s) survived: " + survivors.join(", "));
  }

  console.log(
    "KONTUR Game Companion connectivity evidence PASS: " +
    data.layers.length + " layers, " +
    data.relations.length + " relations, 32 exact artifact bindings, " +
    mutations.length + " fail-closed mutations rejected"
  );
}

main();


