'use strict';

const fs = require('fs');
const path = require('path');
const Response = require(path.resolve(__dirname, '../../response-candidate/v0.1/response-candidate.js'));
const ResponsePositive = require(path.resolve(__dirname, '../../response-candidate/v0.1/synthetic-positive-helper.js'));

async function buildReadyResponseCandidate({
  responsePath = '/tmp/marketcloser-approval-positive-response.json',
  ...paths
} = {}) {
  const positive = await ResponsePositive.buildReadyResponseInput({ responsePath, ...paths });
  const receipt = Response.deriveReceipt(positive.responseInput);
  Response.validateReceipt(receipt);
  if (receipt.classification !== 'RESPONSE_CANDIDATE_READY') {
    throw new Error(`synthetic response candidate not ready: ${receipt.classification}`);
  }
  fs.writeFileSync(responsePath, `${JSON.stringify(positive.responseInput, null, 2)}\n`);
  return { ...positive, responseCandidateReceipt: receipt, responsePath };
}

module.exports = { buildReadyResponseCandidate };
