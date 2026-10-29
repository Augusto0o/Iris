import test from 'node:test';import assert from 'node:assert/strict';
import {parseAmount,dates,parseBill,parseContract,parseText,toNoteHtml} from '../src/scan-parse.js';

test('Argentine amounts: thousands with points, cents with comma',()=>{
 assert.equal(parseAmount('$ 45.000'),45000);assert.equal(parseAmount('1.234.567,89'),1234567.89);
 assert.equal(parseAmount('45000,5'),45000.5);assert.equal(parseAmount('12.50'),12.5);assert.equal(parseAmount('abc'),null);
});
test('Dates in numbers or words',()=>{
 assert.deepEqual(dates('Vto: 05/11/2026 y 7-12-26'),['2026-11-05','2026-12-07']);
 assert.deepEqual(dates('Buenos Aires, 1 de marzo de 2026'),['2026-03-01']);
 assert.deepEqual(dates('32/13/2026'),[]);
});
test('Service bill: provider, total to pay, due date and period',()=>{
 const bill=`EDENOR S.A.\nFactura B N° 0001-1234\nPeríodo: 10/2026\nConsumo 230 kWh   $ 31.200,00\nImpuestos   $ 13.800,50\nTOTAL A PAGAR $ 45.000,50\nVencimiento 05/11/2026`;
 assert.deepEqual(parseBill(bill),{provider:'Edenor',serviceId:null,amount:45000.5,due:'2026-11-05',period:'2026-10'});
 const r=parseBill('Factura de luz\nTotal $ 12.000\nvence el 10/11/2026',{services:[{id:'s1',name:'Luz'}]});
 assert.equal(r.serviceId,'s1');assert.equal(r.provider,'Luz');assert.equal(r.period,'2026-11');
});
test('Rental contract: dates, rent, deposit and payment day',()=>{
 const c=`CONTRATO DE LOCACIÓN DE VIVIENDA\nEl inmueble sito en Av. Corrientes 1234, 5° B, CABA.\nPlazo: desde el 01/03/2026 hasta el 28/02/2029.\nEl precio mensual del alquiler es de $ 450.000 pagaderos del 1 al 10 de cada mes.\nSe entrega en concepto de depósito la suma de $ 450.000.\nLas expensas ordinarias ($ 85.000) quedan a cargo del locatario.`;
 assert.deepEqual(parseContract(c),{name:'CONTRATO DE LOCACIÓN DE VIVIENDA',address:'Av. Corrientes 1234, 5° B, CABA',start:'2026-03-01',end:'2029-02-28',rent:450000,deposit:450000,expenses:85000,day:1});
});
test('Text: joins hyphenated words, keeps paragraphs, picks a title and escapes markup',()=>{
 const t=parseText('Ideas para la tien-\nda online.\nProbar envíos.\n\n<b>Segundo</b> párrafo');
 assert.equal(t.title,'Ideas para la tienda online.');assert.deepEqual(t.paragraphs,['Ideas para la tienda online. Probar envíos.','<b>Segundo</b> párrafo']);
 assert.equal(toNoteHtml(t.paragraphs),'<p>Ideas para la tienda online. Probar envíos.</p><p>&lt;b&gt;Segundo&lt;/b&gt; párrafo</p>');
});
test('To-do list: one task per line, bullets and numbers removed, wrapped lines joined',async()=>{
 const {parseTaskLines}=await import('../src/scan-parse.js');
 assert.deepEqual(parseTaskLines('- Pagar la luz\n• Llamar al plomero por\nla pérdida del baño\n2) Comprar yerba\n[ ] Turno médico\n\n.'),['Pagar la luz','Llamar al plomero por la pérdida del baño','Comprar yerba','Turno médico']);
});

test('comprobantes de Mercado Pago: monto, a quién, fecha, n.° de operación',async()=>{
 const {parseReceipt}=await import('../src/scan-parse.js');
 const t1=`Comprobante de transferencia
Viernes, 25 de octubre de 2026, a las 14:32 hs
$ 12.300
Motivo: Varios
De
Franco Augusto
CUIT/CUIL: 20-12345678-9
Mercado Pago
Para
Juan Pérez
CUIT/CUIL: 20-87654321-0
Banco Galicia
Número de operación de Mercado Pago
89123456789
Código de identificación
ABC123`;
 const r=parseReceipt(t1);
 assert.equal(r.amount,12300);assert.equal(r.who,'Juan Pérez');assert.equal(r.date,'2026-10-25');assert.equal(r.time,'14:32');assert.equal(r.operation,'89123456789');assert.equal(r.incoming,false);assert.equal(r.kind,'transfer');assert.equal(r.isMercadoPago,true);
 const r2=parseReceipt(`Comprobante de pago\nPagaste $ 3.500,50 a Kiosco Don Pepe\n12/10/2026 09:05\nOperación N° 7766554433`);
 assert.equal(r2.amount,3500.5);assert.equal(r2.who,'Kiosco Don Pepe');assert.equal(r2.date,'2026-10-12');assert.equal(r2.operation,'7766554433');assert.equal(r2.kind,'payment');
 const r3=parseReceipt(`Te enviaron dinero\n$ 45.000\nDe Leo Gómez\n3 de noviembre de 2026\nNúmero de operación 55512340000`);
 assert.equal(r3.incoming,true);assert.equal(r3.who,'Leo Gómez');assert.equal(r3.amount,45000);
});
