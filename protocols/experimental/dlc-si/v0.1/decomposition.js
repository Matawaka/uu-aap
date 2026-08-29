'use strict';
const DIMS=new Set(['TIME','SCOPE','SPACE_RESOURCE','AUTHORITY_BOUNDARY','REVERSIBILITY','REALITY_MODEL','SUBJECT_OBJECT']);
function assessDecomposition(input){
 if(!input||!Array.isArray(input.options)) throw Error('decomposition options required');
 const options=input.options.map(o=>{if(!DIMS.has(o.dimension))throw Error('unsupported decomposition dimension');if(typeof o.safe!=='boolean')throw Error('safe flag required');if(typeof o.preserves_causal_value_a!=='boolean'||typeof o.preserves_causal_value_b!=='boolean')throw Error('causal value evidence required');return {...o,sufficient:o.safe&&o.preserves_causal_value_a&&o.preserves_causal_value_b};});
 const sufficient=options.filter(o=>o.sufficient);
 return {type:'DecompositionAssessment',options,sufficient_options:sufficient.map(o=>o.option_id),decomposition_required:sufficient.length>0,temporary_precedence_permitted:sufficient.length===0,formal_decomposition_without_preserved_value:options.some(o=>o.safe&&!o.sufficient),normative_winner:null,external_effect_authority_created:false};
}
function chooseMode(assessment){if(!assessment||assessment.type!=='DecompositionAssessment')throw Error('assessment required');if(assessment.decomposition_required)return{mode:'PARTITIONED_OR_DEFERRED_REQUIRED',temporary_precedence_permitted:false,normative_winner:null};return{mode:'TEMPORARY_PRECEDENCE_ELIGIBLE',temporary_precedence_permitted:true,normative_winner:null,requires_separate_bounded_precedence_authority:true};}
module.exports={assessDecomposition,chooseMode};
