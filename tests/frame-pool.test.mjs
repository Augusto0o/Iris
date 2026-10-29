import test from 'node:test';import assert from 'node:assert/strict';
import {framesToRelease,IDLE_MS} from '../src/frame-pool.js';
test('Only hidden, idle apps without a running activity are released',()=>{
 const now=1e9,old=now-IDLE_MS-1,recent=now-1000;
 const lastUsed=new Map([['centro',old],['iris',old],['journal',recent],['organizador',old],['mi-espacio',old]]);
 assert.deepEqual(framesToRelease({ids:[...lastUsed.keys()],current:'centro',lastUsed,activities:new Map([['organizador',{}]]),now}),['iris','mi-espacio']);
 assert.deepEqual(framesToRelease({ids:['mi-espacio'],current:'centro',lastUsed,activities:new Map([['kitchen',{}]]),now}),[]);
 assert.deepEqual(framesToRelease({ids:['iris'],current:'centro',lastUsed:new Map(),activities:new Map(),now}),[]); // never used: unknown, keep
});
