'use strict';
const assert = (c,m)=>{if(!c)throw new Error(m);};
const beforeOut = process.stdout.write;
const beforeErr = process.stderr.write;
let out='',err='';
process.stdout.write = chunk => { out += String(chunk); return true; };
process.stderr.write = chunk => { err += String(chunk); return true; };
let mod;
try { mod = require('./copy-export.js'); require('./receipt-binding.js'); }
finally { process.stdout.write = beforeOut; process.stderr.write = beforeErr; }
assert(mod && typeof mod.validateInput==='function' && typeof mod.deriveReceipt==='function','copy/export library API missing');
assert(out==='' && err==='','import must not emit stdout/stderr');
console.log('MarketCloser Copy/Export Receipt import safety: PASS');
