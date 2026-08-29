'use strict';
const assert=require('node:assert/strict');
const {assessConstraintInheritance,materializeSuccessorConstraints}=require('./constraint-inheritance.js');

let r=assessConstraintInheritance({predecessor_constraints:['no-write'],successor_constraints:['no-write','read-only']});
assert.equal(r.allowed,true);assert.deepEqual(r.removed,[]);
r=assessConstraintInheritance({predecessor_constraints:['no-write'],successor_constraints:[]});
assert.equal(r.allowed,false);assert.equal(r.authorization_required,true);
assert.throws(()=>materializeSuccessorConstraints({predecessor_constraints:['no-write'],successor_constraints:[]}),/NOT_AUTHORIZED/);
r=assessConstraintInheritance({predecessor_constraints:['no-write','no-release'],successor_constraints:['no-release'],authorization_receipt:{kind:'HUMAN_CONSTRAINT_WEAKENING_AUTHORIZATION',explicit:true,removed_constraints:['no-write']}});
assert.equal(r.allowed,true);assert.deepEqual(r.removed,['no-write']);
r=assessConstraintInheritance({predecessor_constraints:['no-write','no-release'],successor_constraints:[],authorization_receipt:{kind:'HUMAN_CONSTRAINT_WEAKENING_AUTHORIZATION',explicit:true,removed_constraints:['no-write']}});
assert.equal(r.allowed,false);
console.log('constraint inheritance tests: ok');
