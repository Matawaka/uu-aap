'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {validateQualification}=require('./validate_qualification.js');
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'qualification.json'),'utf8'));
function clone(x){return JSON.parse(JSON.stringify(x));}
function reject(name,mutate){const x=clone(base);mutate(x);try{validateQualification(x,{checkGit:false});}catch{return;}throw new Error(`unsafe mutation accepted: ${name}`);}
validateQualification(base,{checkGit:false});
const mutations=[
['erd-component-blob-substitution',x=>x.component_bindings.event_responsive_dormancy.module_blob='0'.repeat(40)],
['rerc-receipt-substitution',x=>x.component_bindings.rerc.implementation_receipt_blob='0'.repeat(40)],
['rsic-receipt-substitution',x=>x.component_bindings.recoverable_state_infrastructure_candidate.implementation_receipt_blob='0'.repeat(40)],
['consumer-source-drift',x=>x.cases[0].source.blob='0'.repeat(40)],
['c2pa-direct-fit-overclaim',x=>x.cases[0].erd_fit='DIRECT_FIT'],
['c2pa-composition-forced',x=>x.cases[0].recommended_dependency='ERD_RERC_COMPOSITION'],
['provenance-independent-support-suppression',x=>x.cases[1].evidence_summary='all provenance evidence may be suppressed'],
['p1-11-suppressible',x=>x.cases[2].rerc_fit='ADAPTER_FIT'],
['p1-9-equivalent',x=>x.cases[3].rerc_fit='ADAPTER_FIT'],
['public-review-forced-erd',x=>x.cases[4].erd_fit='ADAPTER_FIT'],
['composition-demand-invented',x=>{x.composition_evidence.independent_demand_established=true;x.composition_evidence.qualifying_independent_consumers=['Q1_C2PA_SDK_SUCCESSOR'];}],
['composition-overall-promoted',x=>x.overall.composition_independent_demand_established=true],
['candidate-invalidated',x=>x.overall.rsic_candidate_invalidated=true],
['candidate-promotion',x=>x.overall.rsic_promotion_authorized=true],
['stable-core-admission',x=>x.overall.stable_core_admission=true],
['registry-successor-required',x=>x.overall.interface_registry_successor_required=true],
['adapter-authority',x=>x.overall.adapter_implementation_authorized=true],
['release-promotion',x=>x.overall.published_release=true],
['performance-overclaim',x=>x.overall.performance_gain_proven=true],
['resource-overclaim',x=>x.overall.resource_savings_proven=true],
['exploratory-promotion',x=>x.overall.exploratory_lane_promoted=true],
['related-lineage-counted',x=>x.cases[0].consumer_family='KONTUR_PCL'],
['extra-case',x=>x.cases.push(clone(x.cases[0]))]
];
for(const [n,m] of mutations)reject(n,m);
console.log(`RSIC_QUALIFICATION_HOSTILE_PASS: ${mutations.length} unsafe mutations rejected.`);
