#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

if (process.argv.length !== 5) {
  throw new Error("usage: test-browser.js <federation-app.js> <adapter-app.js> <attestation-app.js>");
}

const federationApp = path.resolve(process.argv[2]);
const adapterApp = path.resolve(process.argv[3]);
const attestationApp = path.resolve(process.argv[4]);

const adapter = require(adapterApp);
globalThis.UUAAPEvidenceAdapter = adapter;
require(attestationApp);
if (!globalThis.UUAAPAttestations) throw new Error("P1.8 validator did not install global API");
const federation = require(federationApp);

const input = JSON.parse(fs.readFileSync(0, "utf8"));
const result = federation.federateCandidateSources(input);
process.stdout.write(JSON.stringify(result));
