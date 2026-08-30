#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
if (process.argv.length !== 7) throw new Error("usage: test-browser.js <disposition-app.js> <candidate-app.js> <adapter-app.js> <attestation-app.js> <interactive-app.js>");
const dispositionApp = path.resolve(process.argv[2]);
const candidateApp = path.resolve(process.argv[3]);
const adapterApp = path.resolve(process.argv[4]);
const attestationApp = path.resolve(process.argv[5]);
const interactiveApp = path.resolve(process.argv[6]);
globalThis.UUAAPEvidenceAdapter = require(adapterApp);
require(attestationApp);
require(candidateApp);
require(interactiveApp);
const disposition = require(dispositionApp);
const input = JSON.parse(fs.readFileSync(0, "utf8"));
const result = disposition.materializeFederatedDisposition(input);
if (!globalThis.UUAAPInteractive || typeof globalThis.UUAAPInteractive.validateInteractiveInput !== "function") {
  throw new Error("P1.3 browser validator unavailable");
}
globalThis.UUAAPInteractive.validateInteractiveInput(result.materialized_interactive_input);
process.stdout.write(JSON.stringify(result));
