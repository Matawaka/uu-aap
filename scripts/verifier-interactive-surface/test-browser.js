#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require(path.join(__dirname, "app.js"));
const api = globalThis.UUAAPInteractive;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFailure(value, label) {
  assert.throws(() => api.normalizeInteractiveInput(value), Error, label);
}

const fixturePath = process.argv[2] || path.join(__dirname, "fixture.json");
const outputPath = process.argv[3] || null;
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const baseline = api.normalizeInteractiveInput(fixture);

assert.deepEqual(baseline.dimension_order, api.DIMENSION_ORDER);
assert.equal(Object.keys(baseline.dimensions).length, 7);
assert.equal(baseline.dimensions.identity.value, "NOT_EVALUATED");
assert.equal(baseline.aggregate_score_present, false);
assert.equal(baseline.aggregate_verdict_present, false);

const opaqueMutation = clone(fixture);
opaqueMutation.evidence_items[0].payload = {
  verified: false,
  verified_true: false,
  trust_score: 0.01,
  arbitrary_external_field: "still opaque",
};
const opaqueView = api.normalizeInteractiveInput(opaqueMutation);
assert.deepEqual(opaqueView.dimensions, baseline.dimensions, "opaque evidence payload must not promote dimensions");

const duplicate = clone(fixture);
duplicate.evidence_items.push(clone(duplicate.evidence_items[0]));
expectFailure(duplicate, "duplicate evidence id");

const undeclared = clone(fixture);
undeclared.dimension_claims.integrity.evidence_refs = ["evidence:not-declared"];
expectFailure(undeclared, "undeclared evidence ref");

const missingDimension = clone(fixture);
delete missingDimension.dimension_claims.truth;
expectFailure(missingDimension, "missing dimension");

const extraDimension = clone(fixture);
extraDimension.dimension_claims.reputation = clone(extraDimension.dimension_claims.truth);
expectFailure(extraDimension, "extra dimension");

const notEvaluatedWithEvidence = clone(fixture);
notEvaluatedWithEvidence.dimension_claims.identity.evidence_refs = ["evidence:identity-attestation"];
expectFailure(notEvaluatedWithEvidence, "NOT_EVALUATED with evidence");

const aggregate = clone(fixture);
aggregate.trust_score = 0.99;
expectFailure(aggregate, "aggregate field");

const dimensionAggregate = clone(fixture);
dimensionAggregate.dimension_claims.integrity.overall_verdict = "pass";
expectFailure(dimensionAggregate, "dimension aggregate field");

const identityMutation = clone(fixture);
identityMutation.dimension_claims.identity = {
  value: "ATTESTED",
  evaluation: "SUPPORTED",
  source_layer: "declared-input/example",
  evidence_refs: ["evidence:identity-attestation"],
  explanation: "Synthetic explicit identity attestation for isolation testing.",
  does_not_establish: ["authorship", "authority", "responsibility", "factual truth"],
};
const identityView = api.normalizeInteractiveInput(identityMutation);
assert.deepEqual(identityView.dimensions.authority, baseline.dimensions.authority, "identity must not promote authority");
assert.deepEqual(identityView.dimensions.responsibility, baseline.dimensions.responsibility, "identity must not promote responsibility");

const provenanceMutation = clone(fixture);
provenanceMutation.dimension_claims.provenance = {
  value: "NOT_SUPPORTED",
  evaluation: "NOT_SUPPORTED",
  source_layer: "declared-input/example",
  evidence_refs: ["evidence:provenance-origin"],
  explanation: "Synthetic provenance mutation for isolation testing.",
  does_not_establish: ["availability", "authority", "responsibility", "factual truth"],
};
const provenanceView = api.normalizeInteractiveInput(provenanceMutation);
assert.deepEqual(provenanceView.dimensions.availability, baseline.dimensions.availability, "provenance must not backfill availability");
assert.deepEqual(provenanceView.dimensions.truth, baseline.dimensions.truth, "provenance must not promote truth");

const xssShape = clone(fixture);
xssShape.artifact.description = '<img src=x onerror="alert(1)">';
const xssView = api.normalizeInteractiveInput(xssShape);
assert.equal(xssView.artifact.description, xssShape.artifact.description, "normalizer must preserve user strings without execution");

if (outputPath) {
  fs.writeFileSync(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

console.log("P1.3 browser explicit-claim normalization: PASS");
console.log("opaque evidence != semantic promotion");
console.log("identity != authority != responsibility");
console.log("provenance != availability != truth");
console.log("aggregate verdict -> FORBIDDEN");
