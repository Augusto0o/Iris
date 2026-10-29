import test from 'node:test';import assert from 'node:assert/strict';
import {buildSearchIndex,search} from '../src/search.js';
const store={
 iris03:JSON.stringify({expenses:[{id:'e1',text:'Supermercado',category:'Comida',amount:15200,currency:'ARS',method:'Débito'}],accounts:[{id:'a1',name:'Mercado Pago'},{id:'a2',name:'Vieja',archived:true}]}),
 'ecosistema03-journal':JSON.stringify({records:{notes:[{id:'n1',title:'Ideas para la tienda',body:'<p>Probar envíos a <b>Córdoba</b></p>',tags:'intencional'}]}}),
 'ecosistema03-organizer':JSON.stringify({records:{tasks:[{id:'t1',title:'Pagar electricidad',date:'2026-10-26',priority:'Alta',subtasks:[{id:'s',text:'Buscar factura'}]}]}}),
 'ecosistema03-space':'{not json',
};
const index=buildSearchIndex(k=>store[k]);
test('Indexes every app from its saved data, skipping archived records and broken storage',()=>{
 assert.deepEqual(index.map(e=>e.app+':'+e.kind+':'+e.id).sort(),['iris:accounts:a1','iris:expenses:e1','journal:notes:n1','organizador:tasks:t1']);
});
test('Matches without accents or case, inside note bodies and subtasks, and ranks title hits first',()=>{
 assert.deepEqual(search(index,'cordoba').map(e=>e.id),['n1']);
 assert.deepEqual(search(index,'FACTURA').map(e=>e.id),['t1']);
 assert.deepEqual(search(index,'mercado').map(e=>e.id),['a1','e1']); // "Mercado Pago" title starts with it
 assert.deepEqual(search(index,'gasto comida').map(e=>e.id),['e1']);
 assert.deepEqual(search(index,'   '),[]);
});
test('Each result knows where to open',()=>{
 const t=search(index,'electricidad')[0];assert.equal(t.app,'organizador');assert.equal(t.view,'tasks');assert.equal(t.appName,'foco');
 assert.match(t.subtitle,/^foco · Tarea · 26 oct( 2026)? · Alta$/);
});
test('Dates read as short Spanish dates, with the year only when it is another one',async()=>{
 const {shortDate}=await import('../src/search.js');
 assert.equal(shortDate('2026-10-10',new Date(2026,5,1)),'10 oct');
 assert.equal(shortDate('2025-03-02',new Date(2026,5,1)),'2 mar 2025');
 assert.equal(shortDate('sin fecha'),'sin fecha');
});
