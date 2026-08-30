#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
if (process.argv.length !== 8) {
  throw new Error("usage: test-browser.js <integrity-app.js> <disposition-app.js> <candidate-app.js> <adapter-app.js> <attestation-app.js> <interactive-app.js>");
}
const integrityApp = path.resolve(process.argv[2]);
const dispositionApp = path.resolve(process.argv[3]);
const candidateApp = path.resolve(process.argv[4]);
const adapterApp = path.resolve(process.argv[5]);
const attestationApp = path.resolve(process.argv[6]);
const interactiveApp = path.resolve(process.argv[7]);

globalThis.UUAAPEvidenceAdapter = require(adapterApp);
require(attestationApp);
require(candidateApp);
require(interactiveApp);
require(dispositionApp);
const integrity = require(integrityApp);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectReject(input, mutate, label) {
  const hostile = clone(input);
  mutate(hostile.federated_disposition_result);
  let rejected = false;
  try { integrity.verifyDispositionIntegrity(hostile); } catch (_error) { rejected = true; }
  if (!rejected) throw new Error(`P1.11 browser unexpectedly accepted: ${label}`);
}

const input = JSON.parse(fs.readFileSync(0, "utf8"));
const result = integrity.verifyDispositionIntegrity(input);

expectReject(input, (source) => {
  const receipt = source.materialized_interactive_input.evidence_items.at(-1);
  receipt.payload.actor_ref = "urn:uu-aap:actor:hostile-payload-only";
}, "mutated receipt payload actor_ref");

expectReject(input, (source) => {
  const receipt = source.materialized_interactive_input.evidence_items.at(-1);
  receipt.payload.scope = "publication_authority";
}, "mutated receipt payload scope");

expectReject(input, (source) => {
  const related = source.materialized_interactive_input.related_observations.federated_candidate_disposition;
  related.accepted_candidate_ids = [];
}, "mutated related accepted ids");

expectReject(input, (source) => {
  const related = source.materialized_interactive_input.related_observations.federated_candidate_disposition;
  related.disposition_receipts[0].rationale = "hostile embedded rationale";
}, "mutated related disposition receipt");

expectReject(input, (source) => {
  source.materialized_interactive_input.warnings.push({code: "HOSTILE_EXTRA_WARNING", message: "synthetic mutation"});
}, "changed materialized warnings");

expectReject(input, (source) => {
  const claims = source.materialized_interactive_input.dimension_claims;
  const dimension = Object.keys(claims).find((name) => claims[name].value === "NOT_EVALUATED");
  if (!dimension) throw new Error("fixture lacks NOT_EVALUATED dimension");
  claims[dimension].explanation = "hostile NOT_EVALUATED metadata mutation";
}, "changed NOT_EVALUATED metadata");

process.stdout.write(JSON.stringify(result));
