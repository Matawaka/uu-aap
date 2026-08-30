#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

require("../verifier-evidence-adapter/app.js");
require("../verifier-interactive-surface/app.js");
const acceptance = require("./app.js");

if (process.argv.length !== 5) {
  throw new Error("usage: test-browser.js <adapter-input.json> <decision.json> <output.json>");
}

const adapterInput = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), "utf8"));
const decision = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), "utf8"));
const adapterResult = globalThis.UUAAPEvidenceAdapter.adaptEvidence(adapterInput);
const input = acceptance.buildAcceptanceInput(adapterResult, decision);
const result = acceptance.materializeCandidateAcceptance(input);
acceptance.validateAcceptanceResult(result);
fs.writeFileSync(path.resolve(process.argv[4]), JSON.stringify(result, null, 2) + "\n", "utf8");
console.log("P1.5 browser candidate acceptance result: PASS");
