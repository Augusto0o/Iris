import test from 'node:test';import assert from 'node:assert/strict';
import {money,appendShortcut,dueNotices,validEndpoint} from '../supabase/functions/mobile/core.mjs';
test('Argentine money formatting never interprets a thousands point as cents',()=>{assert.equal(money('1.500,50'),1500.5);assert.equal(money('25.000'),25000);assert.equal(money(12.5),12.5);for(const bad of ['1.50','1,500.50','-5','NaN','',0])assert.throws(()=>money(bad))});
test('Shortcut expenses preserve account currency and validate method, category and account',()=>{const s={accounts:[{id:'cash',currency:'ARS'}],expenses:[],expenseCategories:['Comida','Prestado']},input={type:'expense',accountId:'cash',text:'Lunch',amount:'1.500',category:'Comida',method:'Efectivo'};const result=appendShortcut(s,input,{id:'new',now:'2026-10-24T12:00:00Z'});assert.equal(result.expenses[0].amount,1500);assert.equal(result.expenses[0].currency,'ARS');assert.equal(s.expenses.length,0);for(const patch of [{accountId:'other'},{currency:'USD'},{method:'Credit card'},{category:'Prestado'}])assert.throws(()=>appendShortcut(s,{...input,...patch},{id:'new'}))});
test('Notes escape markup and do not mutate existing records',()=>{const s={records:{notes:[]}},r=appendShortcut(s,{type:'note',title:'Idea',body:'<img src=x onerror=alert(1)>'},{id:'note'});assert(!r.records.notes[0].body.includes('<img'));assert.equal(s.records.notes.length,0)});
test('Only due, enabled, incomplete reminders are selected; paid services are excluded',()=>{const now=Date.parse('2026-10-24T12:00:30Z'),r={id:'t',title:'Task',date:'2026-10-24',time:'09:00',reminder:true};assert.equal(dueNotices('organizador',{records:{tasks:[r]}},now).length,1);assert.equal(dueNotices('organizador',{records:{tasks:[{...r,done:true}]}},now).length,0);assert.equal(dueNotices('organizador',{records:{tasks:[r]}},now+600000).length,0);const s={services:[{id:'s',name:'Electricidad',day:24}],servicePayments:[]};assert.equal(dueNotices('iris',s,now).length,1);s.servicePayments.push({serviceId:'s',period:'2026-10'});assert.equal(dueNotices('iris',s,now).length,0)});
test('Push delivery cannot target arbitrary servers or local addresses',()=>{assert(validEndpoint('https://web.push.apple.com/token'));for(const endpoint of ['https://127.0.0.1/test','https://example.com','https://web.push.apple.com.evil.test/x','http://web.push.apple.com/x','https://user@web.push.apple.com/x'])assert.equal(validEndpoint(endpoint),false)});
test('Cards, subscriptions and events: reminders worded like Apple Reminders',()=>{
 const now=Date.parse('2026-10-24T13:00:10Z'); // 10:00 in Buenos Aires
 const s={cards:[{id:'v',name:'Visa Galicia',closeDay:25,dueDay:26,currency:'ARS'}],cardStatements:[{cardId:'v',due:'2026-10-26',total:120500,minimum:12000}],cardPayments:[],
  subscriptions:[{id:'n',name:'Netflix',amount:9.99,currency:'USD',cycle:'mensual',day:25,remindDays:1,cardId:'v'}],subscriptionCharges:[]};
 const n=dueNotices('iris',s,now),by=k=>n.find(x=>x.key.startsWith(k));
 assert.equal(by('card-close').title,'Visa Galicia');assert.match(by('card-close').body,/^Cierra mañana/);
 assert.match(by('card-due').body,/^Vence pasado mañana · \$ 120\.500 · mínimo \$ 12\.000/);
 assert.equal(by('sub').title,'Netflix');assert.match(by('sub').body,/^Se cobra mañana · US\$ 9,99 con Visa Galicia/);
 s.cardPayments.push({cardId:'v',date:'2026-10-20',amount:120500});assert.equal(dueNotices('iris',s,now).some(x=>x.key.startsWith('card-due')),false,'paid statements are quiet');
 const ev={records:{events:[{id:'e',title:'Dentista',date:'2026-10-24',time:'10:30',place:'Consultorio'}]}};
 const e=dueNotices('organizador',ev,now)[0];assert.equal(e.title,'Dentista');assert.equal(e.body,'En 30 minutos · 10:30 · Consultorio');
});
