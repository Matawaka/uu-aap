'use strict';

function unique(xs){return [...new Set(xs || [])];}

function assessConstraintInheritance({predecessor_constraints=[],successor_constraints=[],authorization_receipt=null}){
  const prev=unique(predecessor_constraints);
  const next=unique(successor_constraints);
  const removed=prev.filter((x)=>!next.includes(x));
  const added=next.filter((x)=>!prev.includes(x));
  if(removed.length===0) return {allowed:true,removed:[],added,authorization_required:false,reason:'CONSTRAINTS_PRESERVED_OR_STRENGTHENED'};
  const authorized=authorization_receipt && authorization_receipt.kind==='HUMAN_CONSTRAINT_WEAKENING_AUTHORIZATION' && authorization_receipt.explicit===true && Array.isArray(authorization_receipt.removed_constraints) && removed.every((x)=>authorization_receipt.removed_constraints.includes(x));
  if(!authorized) return {allowed:false,removed,added,authorization_required:true,reason:'PREDECESSOR_CONSTRAINT_WEAKENING_NOT_AUTHORIZED'};
  return {allowed:true,removed,added,authorization_required:false,reason:'EXPLICIT_HUMAN_WEAKENING_AUTHORIZATION'};
}

function materializeSuccessorConstraints(args){
  const assessment=assessConstraintInheritance(args);
  if(!assessment.allowed) throw Error(assessment.reason);
  return {constraints:unique(args.successor_constraints),constraint_inheritance:assessment};
}

module.exports={assessConstraintInheritance,materializeSuccessorConstraints};
