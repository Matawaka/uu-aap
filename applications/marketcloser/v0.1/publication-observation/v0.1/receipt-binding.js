'use strict';

const Publication = require('./publication-observation.js');

function deepEqual(a,b) {
  return JSON.stringify(Publication.canonicalize(a)) === JSON.stringify(Publication.canonicalize(b));
}
function validateReceiptForSource(input, receipt) {
  Publication.validateInput(input);
  Publication.validateReceipt(receipt);
  const expected = Publication.deriveReceipt(input);
  if (!deepEqual(expected, receipt)) throw new Publication.MarketCloserPublicationObservationError('publication observation receipt does not match exact source');
  return receipt;
}
module.exports = { validateReceiptForSource };
