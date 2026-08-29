'use strict';
const CopyExport = require('./copy-export.js');
function validateReceiptForSource(input, receipt) {
  CopyExport.validateInput(input);
  CopyExport.validateReceipt(receipt);
  const expected = CopyExport.deriveReceipt(input);
  if (JSON.stringify(CopyExport.canonicalize(expected)) !== JSON.stringify(CopyExport.canonicalize(receipt))) {
    throw new CopyExport.MarketCloserCopyExportError('receipt does not match exact copy/export source');
  }
  return receipt;
}
module.exports = { validateReceiptForSource };
