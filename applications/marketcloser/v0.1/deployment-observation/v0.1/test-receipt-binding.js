'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Runtime = require('./deployment-observation.js');
const Binding = require('./receipt-binding.js');

const input = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'examples', 'synthetic-deployment-observation.input.json'), 'utf8'));
const receipt = Runtime.deriveReceipt(input);
Binding.validateReceiptAgainstInput(receipt, input);

const substitutedUrl = JSON.parse(JSON.stringify(receipt));
substitutedUrl.deployment.url = 'https://substituted.marketcloser.invalid';
Runtime.rehash(substitutedUrl);
Runtime.validateReceipt(substitutedUrl);
assert.throws(() => Binding.validateReceiptAgainstInput(substitutedUrl, input));

const substitutedArtifact = JSON.parse(JSON.stringify(receipt));
substitutedArtifact.source_artifact.artifact_ref = 'urn:synthetic:marketcloser:deployment-audit:substituted';
Runtime.rehash(substitutedArtifact);
Runtime.validateReceipt(substitutedArtifact);
assert.throws(() => Binding.validateReceiptAgainstInput(substitutedArtifact, input));

const changedInput = JSON.parse(JSON.stringify(input));
changedInput.observed_application.reported_version = 'different-synthetic-version';
Runtime.rehash(changedInput);
Runtime.validateInput(changedInput);
assert.throws(() => Binding.validateReceiptAgainstInput(receipt, changedInput));

console.log('MarketCloser deployment observation exact source binding: PASS');
