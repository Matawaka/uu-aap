'use strict';

const fs = require('fs');
const path = require('path');
const CopyExport = require('./copy-export.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fixturePath = path.resolve(__dirname, 'examples/synthetic-copy-export-wait.input.json');

function inputFor(positive, event = null, id = 'synthetic-positive-001') {
  const input = {
    protocol:CopyExport.PROTOCOL,
    version:CopyExport.VERSION,
    artifact_type:CopyExport.INPUT_TYPE,
    copy_export_id:`urn:uu-aap:marketcloser:copy-export:${id}`,
    origin:{repository:'Matawaka/uu-aap',revision:CopyExport.ORIGIN_FRONTIER,tree:CopyExport.ORIGIN_TREE},
    approval_source:{mode:'local_private',path:positive.approvalPath,expected_approval_input_hash:positive.approvalInput.content_hash},
    approval_receipt:positive.approvalReceipt,
    event,
    controls:{
      local_only:true,read_only:true,copy_export_event_recording_available:true,
      os_clipboard_mutation_available:false,filesystem_export_write_available:false,publication_available:false,
      provider_invocation_available:false,network_access_available:false,platform_mutation_available:false,campaign_send_available:false,
      pilot_permit_available:false,action_permit_available:false,external_execution_available:false,external_effect_available:false
    },
    content_hash:''
  };
  CopyExport.rehash(input); return input;
}
function syntheticEvent(positive, method='clipboard_copy', suffix='001') {
  const draftHash = positive.approvalReceipt.response_binding.draft_hash;
  return {
    context:'synthetic_conformance',method,
    event_ref:`urn:synthetic:marketcloser:copy-export-event:${suffix}`,
    actor_ref:'urn:synthetic:marketcloser:copy-export-actor:001',
    performed_at:'2026-08-29T03:20:10Z',draft_hash:draftHash,payload_hash:draftHash,
    application_event_observed:false,independently_verified:false
  };
}

(async () => {
  const wait = JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  CopyExport.validateInput(wait);
  const waitReceipt = CopyExport.deriveReceipt(wait);
  assert(waitReceipt.classification === 'APPROVAL_REQUIRED', 'committed fixture must require approval');
  assert(waitReceipt.copy_export_event_recorded === false, 'waiting fixture cannot record event');

  const positive = await Positive.buildApprovedResponse();
  const approvedNoEvent = inputFor(positive, null, 'synthetic-approved-wait-001');
  const approvedReceipt = CopyExport.deriveReceipt(approvedNoEvent);
  assert(approvedReceipt.classification === 'COPY_EXPORT_EVENT_REQUIRED', 'approved draft without event must wait');

  const clipboard = inputFor(positive, syntheticEvent(positive,'clipboard_copy','clipboard-001'), 'synthetic-clipboard-001');
  const clipboardReceipt = CopyExport.deriveReceipt(clipboard);
  assert(clipboardReceipt.classification === 'COPIED_PUBLICATION_UNVERIFIED', 'clipboard event expected');
  assert(clipboardReceipt.copy_export_event_recorded === true, 'copy event must be recorded');
  assert(clipboardReceipt.claims.copy_export_independently_verified === false, 'copy cannot be independently verified');
  assert(clipboardReceipt.claims.publication_observed === false && clipboardReceipt.claims.publication_authorized === false, 'copy cannot become publication');
  assert(clipboardReceipt.next_safe_action === 'PUBLICATION_OBSERVATION_REQUIRED', 'next action mismatch');

  const localExport = inputFor(positive, syntheticEvent(positive,'local_text_export','export-001'), 'synthetic-export-001');
  const exportReceipt = CopyExport.deriveReceipt(localExport);
  assert(exportReceipt.classification === 'COPIED_PUBLICATION_UNVERIFIED', 'local export event expected');

  const wrongHash = clone(clipboard); wrongHash.event.payload_hash = `sha256:${'0'.repeat(64)}`; CopyExport.rehash(wrongHash);
  let rejected=false; try{CopyExport.deriveReceipt(wrongHash);}catch(_){rejected=true;} assert(rejected,'payload hash mismatch must fail');

  const independent = clone(clipboard); independent.event.independently_verified=true; CopyExport.rehash(independent);
  rejected=false; try{CopyExport.validateInput(independent);}catch(_){rejected=true;} assert(rejected,'independent verification overclaim must fail');

  const observed = clone(clipboard); observed.event.context='application_observed'; observed.event.event_ref='urn:uu-aap:marketcloser:copy-event:observed-001'; observed.event.actor_ref='urn:uu-aap:marketcloser:actor:opaque-001'; observed.event.application_event_observed=false; CopyExport.rehash(observed);
  rejected=false; try{CopyExport.validateInput(observed);}catch(_){rejected=true;} assert(rejected,'application observed event requires observation flag');

  const noApproval = clone(wait); noApproval.event=syntheticEvent(positive,'clipboard_copy','no-approval-001'); CopyExport.rehash(noApproval);
  rejected=false; try{CopyExport.validateInput(noApproval);}catch(_){rejected=true;} assert(rejected,'event without approval must fail');

  fs.writeFileSync('/tmp/marketcloser-copy-export-positive-input.json', `${JSON.stringify(clipboard,null,2)}\n`);
  fs.writeFileSync('/tmp/marketcloser-copy-export-positive-receipt.json', `${JSON.stringify(clipboardReceipt,null,2)}\n`);
  console.log('MarketCloser Copy/Export Receipt v0.1 conformance: PASS');
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

module.exports = { inputFor, syntheticEvent };
