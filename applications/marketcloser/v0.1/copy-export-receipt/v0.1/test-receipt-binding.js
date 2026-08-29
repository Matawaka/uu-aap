'use strict';

const CopyExport = require('./copy-export.js');
const Binding = require('./receipt-binding.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function inputFor(positive) {
  const draftHash = positive.approvalReceipt.response_binding.draft_hash;
  const input = {
    protocol:CopyExport.PROTOCOL,version:CopyExport.VERSION,artifact_type:CopyExport.INPUT_TYPE,
    copy_export_id:'urn:uu-aap:marketcloser:copy-export:synthetic-binding-001',
    origin:{repository:'Matawaka/uu-aap',revision:CopyExport.ORIGIN_FRONTIER,tree:CopyExport.ORIGIN_TREE},
    approval_source:{mode:'local_private',path:positive.approvalPath,expected_approval_input_hash:positive.approvalInput.content_hash},
    approval_receipt:positive.approvalReceipt,
    event:{
      context:'synthetic_conformance',method:'clipboard_copy',event_ref:'urn:synthetic:marketcloser:copy-export-event:binding-001',
      actor_ref:'urn:synthetic:marketcloser:copy-export-actor:binding-001',performed_at:'2026-08-29T03:20:20Z',
      draft_hash:draftHash,payload_hash:draftHash,application_event_observed:false,independently_verified:false
    },
    controls:{local_only:true,read_only:true,copy_export_event_recording_available:true,os_clipboard_mutation_available:false,filesystem_export_write_available:false,publication_available:false,provider_invocation_available:false,network_access_available:false,platform_mutation_available:false,campaign_send_available:false,pilot_permit_available:false,action_permit_available:false,external_execution_available:false,external_effect_available:false},
    content_hash:''
  };
  CopyExport.rehash(input); return input;
}

(async()=>{
  const positive = await Positive.buildApprovedResponse({approvalPath:'/tmp/marketcloser-copy-export-binding-approval.json'});
  const input = inputFor(positive);
  const receipt = CopyExport.deriveReceipt(input);
  Binding.validateReceiptForSource(input, receipt);

  const substitutions = [
    source => { source.copy_export_id='urn:uu-aap:marketcloser:copy-export:synthetic-binding-substitution'; },
    source => { source.event.event_ref='urn:synthetic:marketcloser:copy-export-event:substituted'; },
    source => { source.event.actor_ref='urn:synthetic:marketcloser:copy-export-actor:substituted'; },
    source => { source.event.method='local_text_export'; },
    source => { source.event.performed_at='2026-08-29T03:20:21Z'; }
  ];
  for(const mutate of substitutions){
    const source=clone(input); mutate(source); CopyExport.rehash(source);
    let rejected=false; try{Binding.validateReceiptForSource(source,receipt);}catch(_){rejected=true;}
    assert(rejected,'source-substituted copy/export receipt binding must fail closed');
  }

  const changed=clone(receipt); changed.event_binding.event_ref='urn:synthetic:marketcloser:copy-export-event:receipt-substitution'; CopyExport.rehash(changed);
  let rejected=false; try{Binding.validateReceiptForSource(input,changed);}catch(_){rejected=true;}
  assert(rejected,'receipt-substituted copy/export binding must fail closed');

  console.log('MarketCloser copy/export exact source binding: PASS');
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
