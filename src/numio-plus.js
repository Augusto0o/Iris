// numio · the money advice Iris gave: "Balance" (how much you can still spend this month and per day, where you
// are over your usual, what to cut, with the AI's advice too), "¿Puedo hacer este gasto?", Suscripciones with their
// renewals, and card statements imported from a PDF or a photo (closing, due date, total and purchases).
(()=>{
'use strict';
if(typeof irisMarkup!=='function'||typeof state==='undefined')return;
const host=()=>parent.EcosystemHost;
const SPARK='<svg class="ai-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';
state.subscriptions||=[];state.subscriptionCharges||=[];state.cardStatements||=[];state.planPrefs||={saveRate:10};
const today=()=>localDay(),month=()=>today().slice(0,7);
const sum=(list,f=x=>x.amount)=>list.reduce((a,x)=>a+cents(f(x)),0)/100;
const inMonth=(d,m)=>String(d||'').startsWith(m);
const cur=()=>irisCurrency||'ARS';
const money=(n,c=cur())=>cash(n,c);
const NEEDS=/alquiler|expensa|servicio|super|mercado|almac|verdul|salud|farmac|m[eé]dic|prepaga|transporte|nafta|combust|colectivo|subte|tren|educa|colegio|facultad|impuesto|seguro|luz|gas|agua|internet|celular|tel[eé]fono|comida/i;

// ---- the month in numbers ------------------------------------------------------------------------------------
function monthData(m=irisMonth||month()){const c=cur(),isNow=m===month();
 const exp=state.expenses.filter(e=>recordCurrency(e)===c&&inMonth(e.date,m)&&e.category!=='Prestado');
 const cardBuys=(typeof cardSpendRows==='function'?cardSpendRows():[]).filter(e=>recordCurrency(e)===c&&inMonth(e.date,m));
 const income=sum(state.incomes.filter(e=>recordCurrency(e)===c&&inMonth(e.date,m)&&e.category!=='Prestado'));
 const prev=[1,2,3].map(k=>shiftMonth(m,-k));
 const incomePrev=prev.map(p=>sum(state.incomes.filter(e=>recordCurrency(e)===c&&inMonth(e.date,p)&&e.category!=='Prestado'))).filter(v=>v>0);
 const avgIncome=incomePrev.length?incomePrev.reduce((a,b)=>a+b,0)/incomePrev.length:0,expected=isNow?Math.max(income,avgIncome):income;
 // what still has to be paid this month: card installments (or the imported statement), services, subscriptions
 const cardsDue=state.cards.filter(k=>!k.archived&&k.currency===c).map(k=>{const st=state.cardStatements.filter(s=>s.cardId===k.id&&inMonth(s.due,m)).sort((a,b)=>b.due.localeCompare(a.due))[0];
  const inst=state.cardPurchases.filter(p=>p.cardId===k.id&&!p.cancelled).flatMap(cardSchedule).filter(q=>inMonth(q.date,m));const paid=sum(state.cardPayments.filter(p=>p.cardId===k.id&&inMonth(p.date,m)));
  const total=st?st.total:sum(inst);return {card:k,total,paid,left:Math.max(0,total-paid),due:st?.due||dateAtMonth(m,k.dueDay),fromStatement:!!st}}).filter(x=>x.total>0);
 const services=(state.services||[]).filter(s=>!s.archived&&(s.currency||'ARS')===c&&!(s.activeFrom>m)).map(s=>({s,st:irisServiceStatus(s,m)})).filter(x=>!x.st.payment);
 const subs=subsDue(m).filter(x=>x.sub.currency===c&&!x.charged&&!x.sub.cardId);
 const committed=sum(cardsDue,x=>x.left)+sum(services,x=>x.s.amount)+sum(subs,x=>x.sub.amount);
 const spentCash=sum(exp),spentAll=spentCash+sum(cardBuys);
 const save=Math.round(expected*(+state.planPrefs.saveRate||0)/100);
 const free=expected-spentCash-committed-save,end=new Date(+m.slice(0,4),+m.slice(5,7),0).getDate(),left=isNow?end-new Date().getDate()+1:0;
 // by category: this month (cash + card purchases) against the average of the 3 months before
 const cats={};for(const e of [...exp,...cardBuys])cats[e.category||'Otros']=(cats[e.category||'Otros']||0)+cents(e.amount)/100;
 const avg={};for(const p of prev){for(const e of [...state.expenses.filter(x=>recordCurrency(x)===c&&inMonth(x.date,p)&&x.category!=='Prestado'),...(typeof cardSpendRows==='function'?cardSpendRows():[]).filter(x=>recordCurrency(x)===c&&inMonth(x.date,p))])avg[e.category||'Otros']=(avg[e.category||'Otros']||0)+cents(e.amount)/100/3}
 const rows=[...new Set([...Object.keys(cats),...Object.keys(avg)])].map(k=>({name:k,now:cats[k]||0,avg:avg[k]||0,need:NEEDS.test(k)})).sort((a,b)=>b.now-a.now);
 const needs=sum(rows.filter(r=>r.need),r=>r.now),wants=sum(rows.filter(r=>!r.need),r=>r.now);
 return {m,c,isNow,income,expected,avgIncome,spentCash,spentAll,committed,save,free,left,perDay:left?free/left:0,cardsDue,services,subs,rows,needs,wants}}

function tips(d){const out=[];if(!d.expected)out.push('Registrá tus ingresos del mes: sin ellos no puedo calcular cuánto te queda.');
 for(const r of d.rows.filter(r=>r.avg>0&&r.now>r.avg*1.2&&r.now-r.avg>d.expected*.03).slice(0,3))out.push(`En ${r.name} vas ${money(r.now-r.avg)} arriba de tu promedio (${money(r.avg)} por mes).`);
 const top=d.rows.filter(r=>!r.need&&r.now>0)[0];if(top)out.push(`Si bajás ${top.name} un 20 %, este mes te ahorrás ${money(top.now*.2)}.`);
 const subsTotal=monthlySubs(d.c);if(subsTotal>0&&d.expected&&subsTotal>d.expected*.04)out.push(`Tus suscripciones suman ${money(subsTotal,d.c)} por mes: revisá si usás todas.`);
 if(d.expected&&d.wants>d.expected*.3)out.push(`Los gustos ya son el ${Math.round(d.wants/d.expected*100)} % de tus ingresos (lo sano es hasta 30 %).`);
 if(d.free<0)out.push(`Con lo que falta pagar te pasás ${money(-d.free)}. Postergá compras no urgentes o pasá alguna a cuotas sin interés.`);
 return out.slice(0,5)}
const facts=d=>({mes:d.m,moneda:d.c,ingresos:d.income,ingresoEsperado:d.expected,promedioIngresos:Math.round(d.avgIncome),gastado:d.spentAll,faltaPagar:d.committed,ahorroObjetivo:d.save,disponible:Math.round(d.free),diasRestantes:d.left,porDia:Math.round(d.perDay),
 tarjetas:d.cardsDue.map(x=>({tarjeta:x.card.name,aPagar:x.left,vence:x.due})),servicios:d.services.map(x=>({servicio:x.s.name,importe:x.s.amount})),suscripciones:monthlySubs(d.c),
 categorias:d.rows.slice(0,12).map(r=>({categoria:r.name,esteMes:Math.round(r.now),promedio:Math.round(r.avg),necesaria:r.need}))});

let advice=null,check=null;
function planMarkup(){const d=monthData(),state0=d.free<0?'bad':d.expected&&d.free<d.expected*.1?'warn':'ok',cats=d.rows.filter(r=>r.now||r.avg).slice(0,8),max=Math.max(1,...cats.map(r=>Math.max(r.now,r.avg)));
 return `<section class="card np-hero np-${state0}"><p class="small">${d.isNow?'Te queda para gastar este mes':'Resultado de '+esc(d.m)}</p><div class="np-big">${money(d.free)}</div>
  ${d.isNow&&d.left?`<p class="np-day">${d.perDay>0?`<b>${money(d.perDay)}</b> por día durante ${d.left} día${d.left>1?'s':''}`:'Ya no queda margen este mes'}</p>`:''}
  <div class="np-flow"><span>Ingresos${d.income<d.expected?' esperados':''}<b>${money(d.expected)}</b></span><span>Gastado<b>− ${money(d.spentCash)}</b></span><span>Falta pagar<b>− ${money(d.committed)}</b></span><span>Ahorro (${state.planPrefs.saveRate||0} %)<b>− ${money(d.save)}</b></span></div>
  <label class="np-rate">Ahorro objetivo<select onchange="numioSaveRate(this.value)">${[0,5,10,15,20,25,30].map(v=>`<option value="${v}" ${+state.planPrefs.saveRate===v?'selected':''}>${v} %</option>`).join('')}</select></label></section>
 <section class="card np-ask"><h2>¿Puedo hacer este gasto?</h2><form class="form" id="npCheck" onsubmit="event.preventDefault();numioCheck()"><div class="form-pair"><label>Importe<input name="amount" type="number" inputmode="decimal" min="1" step="0.01" required value="${check?.amount||''}"></label><label>En qué<input name="what" maxlength="80" placeholder="Zapatillas, una cena…" value="${esc(check?.what||'')}"></label></div>
  <div class="form-pair"><label>Cómo<select name="how"><option value="cash">Efectivo o débito</option>${state.cards.filter(k=>!k.archived&&k.currency===d.c).map(k=>`<option value="card:${k.id}">${esc(k.name)}</option>`).join('')}</select></label><label>Cuotas<select name="n">${[1,3,6,9,12,18].map(n=>`<option>${n}</option>`).join('')}</select></label></div><button class="primary">Calcular</button></form>
  ${check?.result?`<div class="np-verdict np-${check.result.level}"><strong>${check.result.title}</strong><p>${esc(check.result.text)}</p>${check.ai?`<p class="np-ai">${SPARK}${esc(check.ai.answer)}</p>${check.ai.tips?.length?`<ul>${check.ai.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}`:`<button type="button" class="ghost" onclick="numioCheckAI()">${SPARK}Segunda opinión de la IA</button>`}</div>`:''}</section>
 ${d.cardsDue.length||d.services.length||d.subs.length?`<section class="card"><h2>Lo que falta pagar</h2><ul class="np-list">${d.cardsDue.map(x=>`<li><span>${esc(x.card.name)}<small>vence ${esc(x.due.split('-').reverse().slice(0,2).join('/'))}${x.fromStatement?' · resumen':''}</small></span><b>${money(x.left)}</b></li>`).join('')}${d.services.map(x=>`<li><span>${esc(x.s.name)}<small>${esc(x.st.label)} · día ${x.s.day}</small></span><b>${money(x.s.amount)}</b></li>`).join('')}${d.subs.map(x=>`<li><span>${esc(x.sub.name)}<small>suscripción · ${esc(x.date.split('-').reverse().slice(0,2).join('/'))}</small></span><b>${money(x.sub.amount,x.sub.currency)}</b></li>`).join('')}</ul></section>`:''}
 <section class="card"><h2>Dónde se va la plata</h2><p class="small">Este mes contra tu promedio de los 3 meses anteriores (incluye compras con tarjeta).</p>${cats.length?`<div class="np-cats">${cats.map(r=>`<div class="np-cat ${r.avg&&r.now>r.avg*1.2?'over':''}"><span>${esc(r.name)}${r.need?'':' <i>gusto</i>'}</span><div class="np-bar"><i style="width:${r.now/max*100}%"></i>${r.avg?`<em style="left:${r.avg/max*100}%"></em>`:''}</div><b>${money(r.now)}</b></div>`).join('')}</div>
  ${d.expected?`<div class="np-503020"><span>Necesidades <b>${Math.round(d.needs/d.expected*100)} %</b><small>ideal 50 %</small></span><span>Gustos <b>${Math.round(d.wants/d.expected*100)} %</b><small>ideal 30 %</small></span><span>Ahorro <b>${Math.max(0,Math.round((d.expected-d.spentAll)/d.expected*100))} %</b><small>ideal 20 %</small></span></div>`:''}`:'<p class="small">Todavía no hay gastos este mes.</p>'}</section>
 <section class="card"><h2>Recomendaciones</h2><ul class="np-tips">${tips(d).map(t=>`<li>${esc(t)}</li>`).join('')||'<li>Vas bien este mes. Seguí registrando tus gastos.</li>'}</ul>
  ${advice?`<div class="np-ai-box">${SPARK}<div><p>${esc(advice.answer)}</p><ul>${advice.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></div>`:`<button type="button" class="ghost" id="npAdvice" onclick="numioAdvice()">${SPARK}Consejos de la IA para este mes</button>`}</section>`}
window.numioSaveRate=v=>{state.planPrefs.saveRate=+v||0;save()};
window.numioAdvice=async()=>{const b=document.getElementById('npAdvice');if(b){b.disabled=true;b.textContent='Pensando…'}try{advice=await host().ai({task:'money',facts:facts(monthData())});render()}catch(e){notify(e.message||'No se pudo pedir a la IA.');if(b){b.disabled=false;b.innerHTML=SPARK+'Consejos de la IA para este mes'}}};
window.numioCheck=()=>{const f=document.getElementById('npCheck'),amount=+f.amount.value,how=f.how.value,n=+f.n.value||1,d=monthData();if(!(amount>0))return;
 let level,title,text;
 if(how==='cash'||n===1&&how==='cash'){const after=d.free-amount;level=after>=d.expected*.1?'ok':after>=0?'warn':'bad';title=level==='ok'?'Sí, podés':level==='warn'?'Podés, con cuidado':'No conviene ahora';
  text=after>=0?`Te quedarían ${money(after)}${d.left?` (${money(after/d.left)} por día los ${d.left} días que faltan)`:''}.`:`Te pasarías ${money(-after)} de lo que te queda este mes.`}
 else{const card=getCard(how.slice(5)),day=+today().slice(8),first=shiftMonth(month(),day<=card.closeDay?1:2),cuota=amount/n;
  const margin=d.avgIncome||d.expected,usual=d.rows.reduce((a,r)=>a+r.avg,0),already=sum(state.cardPurchases.filter(p=>!p.cancelled).flatMap(cardSchedule).filter(q=>inMonth(q.date,first)));
  const room=margin-usual-already-(margin*(+state.planPrefs.saveRate||0)/100);level=cuota<=room*.5?'ok':cuota<=room?'warn':'bad';title=level==='ok'?'Sí, podés':level==='warn'?'Podés, con cuidado':'No conviene ahora';
  text=`${n>1?n+' cuotas de '+money(cuota):'Un pago de '+money(amount)} desde ${first.split('-').reverse().join('/')} en ${card.name}. Ese mes ya tenés ${money(already)} en cuotas${margin?` y te sobran unos ${money(Math.max(0,room))} sobre tu gasto habitual`:''}.`}
 check={amount,what:f.what.value,how,n,result:{level,title,text}};render()};
window.numioCheckAI=async()=>{if(!check)return;try{const d=monthData();check.ai=await host().ai({task:'money',facts:facts(d),question:`${check.what||'un gasto'} de ${money(check.amount)} ${check.how==='cash'?'en efectivo o débito':'con tarjeta en '+check.n+' cuota(s)'}`});render()}catch(e){notify(e.message||'No se pudo pedir a la IA.')}};

// ---- subscriptions -----------------------------------------------------------------------------------------------
const PRESETS=[['Netflix','ARS'],['Spotify','ARS'],['YouTube Premium','ARS'],['Disney+','ARS'],['Prime Video','ARS'],['Max','ARS'],['Paramount+','ARS'],['Apple TV+','USD'],['iCloud+','USD'],['Google One','ARS'],['ChatGPT Plus','USD'],['Claude Pro','USD'],['Xbox Game Pass','ARS'],['PlayStation Plus','USD'],['Crunchyroll','ARS'],['Mercado Pago / Meli+','ARS']];
function nextCharge(s,from=today()){if(s.cycle==='anual'){const y=+from.slice(0,4);for(const yy of [y,y+1]){const d=dateAtMonth(yy+'-'+String(s.month||1).padStart(2,'0'),s.day||1);if(d>=from)return d}}
 const m=from.slice(0,7);const d=dateAtMonth(m,s.day||1);return d>=from?d:dateAtMonth(shiftMonth(m,1),s.day||1)}
function subsDue(m){const out=[];for(const sub of state.subscriptions.filter(s=>s.active!==false)){const date=sub.cycle==='anual'?(+String(sub.month||1)===+m.slice(5,7)?dateAtMonth(m,sub.day||1):null):dateAtMonth(m,sub.day||1);if(!date)continue;
 out.push({sub,date,charged:state.subscriptionCharges.some(c=>c.subId===sub.id&&c.period===m)})}return out}
function monthlySubs(c){return state.subscriptions.filter(s=>s.active!==false&&s.currency===c).reduce((a,s)=>a+(s.cycle==='anual'?s.amount/12:s.amount),0)}
function subsMarkup(){const list=[...state.subscriptions].sort((a,b)=>nextCharge(a).localeCompare(nextCharge(b))),ars=monthlySubs('ARS'),usd=monthlySubs('USD'),m=month(),fmt=d=>{const diff=Math.round((Date.parse(d)-Date.parse(today()))/864e5);return diff===0?'hoy':diff===1?'mañana':diff<7?'en '+diff+' días':d.split('-').reverse().slice(0,2).join('/')};
 return `<div class="heading"><div><button class="textbtn" onclick="irisTab='summary';render()">${icon('left')}numio</button><h1>Suscripciones</h1><p>Lo que pagás todos los meses y cuándo se renueva. Te aviso antes de cada cobro.</p></div><div class="finance-actions"><button class="primary" onclick="numioSub()">${icon('plus')}Agregar</button></div></div>
 <div class="finance-kpis"><section class="card"><p>Por mes</p><div class="value">${money(ars,'ARS')}</div>${usd?`<p class="small">+ ${money(usd,'USD')}</p>`:''}</section><section class="card"><p>Por año</p><div class="value">${money(ars*12,'ARS')}</div>${usd?`<p class="small">+ ${money(usd*12,'USD')}</p>`:''}</section></div>
 <section class="card">${list.length?`<ul class="np-subs">${list.map(s=>{const next=nextCharge(s),charged=state.subscriptionCharges.some(c=>c.subId===s.id&&c.period===next.slice(0,7));return `<li class="${s.active===false?'off':''}"><span class="np-sub-mark">${esc(s.name.slice(0,1).toUpperCase())}</span><span class="np-sub-copy"><strong>${esc(s.name)}</strong><small>${s.active===false?'Pausada':charged?'Cobrada este mes':'Se cobra '+fmt(next)}${s.cardId?' · '+esc(getCard(s.cardId)?.name||''):''}${s.cycle==='anual'?' · anual':''}</small></span><b>${money(s.amount,s.currency)}</b>
  <span class="np-sub-actions">${s.active!==false&&!charged?`<button type="button" onclick="numioCharge('${s.id}')">Registrar cobro</button>`:''}<button type="button" onclick="numioSub('${s.id}')">Editar</button></span></li>`}).join('')}</ul>`:`<div class="empty">Agregá Netflix, Spotify, YouTube y las demás para ver cuánto suman y que te avise antes de cada renovación.</div>`}</section>`}
window.numioSub=id=>{const s=state.subscriptions.find(x=>x.id===id)||{name:'',amount:'',currency:'ARS',cycle:'mensual',day:+today().slice(8),month:+today().slice(5,7),cardId:'',remindDays:1,active:true};
 modal(id?'Editar suscripción':'Nueva suscripción',`<form class="form" id="subForm">${id?'':`<div class="np-presets">${PRESETS.map(([n,c])=>`<button type="button" data-n="${esc(n)}" data-c="${c}">${esc(n)}</button>`).join('')}</div>`}
  <label>Nombre<input name="name" required maxlength="60" value="${esc(s.name)}"></label><div class="form-pair"><label>Importe<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${s.amount}"></label><label>Moneda<select name="currency">${['ARS','USD','EUR'].map(c=>`<option ${s.currency===c?'selected':''}>${c}</option>`).join('')}</select></label></div>
  <div class="form-pair"><label>Se cobra<select name="cycle"><option value="mensual" ${s.cycle!=='anual'?'selected':''}>Todos los meses</option><option value="anual" ${s.cycle==='anual'?'selected':''}>Una vez al año</option></select></label><label>Día<input name="day" type="number" min="1" max="31" required value="${s.day}"></label></div>
  <label class="np-month" ${s.cycle==='anual'?'':'hidden'}>Mes de renovación<select name="month">${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].map((n,i)=>`<option value="${i+1}" ${+s.month===i+1?'selected':''}>${n}</option>`).join('')}</select></label>
  <div class="form-pair"><label>Con qué tarjeta<select name="cardId"><option value="">Débito u otro medio</option>${state.cards.filter(k=>!k.archived).map(k=>`<option value="${k.id}" ${s.cardId===k.id?'selected':''}>${esc(k.name)}</option>`).join('')}</select></label><label>Avisarme<select name="remindDays">${[[0,'El mismo día'],[1,'1 día antes'],[2,'2 días antes'],[3,'3 días antes'],[7,'Una semana antes']].map(([v,l])=>`<option value="${v}" ${+s.remindDays===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <label class="checklabel"><input type="checkbox" name="active" ${s.active!==false?'checked':''}>Activa</label>
  <button class="primary">Guardar</button>${id?`<button type="button" class="danger" id="subDelete">Eliminar</button>`:''}<button type="button" onclick="closeModal()">Cancelar</button></form>`);
 const f=document.getElementById('subForm');f.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{f.name.value=b.dataset.n;f.currency.value=b.dataset.c;f.amount.focus()});
 f.cycle.onchange=()=>{f.querySelector('.np-month').hidden=f.cycle.value!=='anual'};
 document.getElementById('subDelete')?.addEventListener('click',()=>{state.subscriptions=state.subscriptions.filter(x=>x.id!==id);closeModal();save()});
 f.onsubmit=e=>{e.preventDefault();const v={id:id||crypto.randomUUID(),name:f.name.value.trim(),amount:Math.round(+f.amount.value*100)/100,currency:f.currency.value,cycle:f.cycle.value,day:Math.min(31,Math.max(1,+f.day.value||1)),month:+f.month.value||1,cardId:f.cardId.value,remindDays:+f.remindDays.value||0,active:f.active.checked};
  if(!v.name||!(v.amount>0)){notify('Completá el nombre y el importe.');return}state.subscriptions=[...state.subscriptions.filter(x=>x.id!==v.id),v];closeModal();save()}};
window.numioCharge=id=>{const s=state.subscriptions.find(x=>x.id===id);if(!s)return;const date=today(),period=nextCharge(s).slice(0,7),card=getCard(s.cardId);
 try{if(card&&card.currency===s.currency){const day=+date.slice(8);storeCardPurchase({cardId:card.id,text:s.name,amount:s.amount,installments:1,date,firstMonth:shiftMonth(date.slice(0,7),day<=card.closeDay?1:2),category:'Suscripciones'})}
  else{const account=state.accounts.find(a=>!a.archived&&a.currency===s.currency)||state.accounts.find(a=>!a.archived);storeIrisMovement('expenses',{text:s.name,amount:s.amount,date,category:state.expenseCategories.includes('Suscripciones')?'Suscripciones':'Otros',method:'Débito automático',accountId:account?.id})}
  state.subscriptionCharges=[...state.subscriptionCharges.filter(c=>!(c.subId===id&&c.period===period)),{subId:id,period,date}].slice(-500);save()}catch(e){notify(e.message||'No se pudo registrar.')}};
if(Array.isArray(state.expenseCategories)&&!state.expenseCategories.includes('Suscripciones'))state.expenseCategories.push('Suscripciones');

// ---- card statements (from the scanner: PDF or photo, read by the AI) ---------------------------------------------
window.ecosystemCards=()=>state.cards.filter(c=>!c.archived).map(c=>({id:c.id,name:c.name,currency:c.currency,closeDay:c.closeDay,dueDay:c.dueDay}));
window.ecosystemStatement=(data,{cardId,updateDays,addItems})=>{const card=getCard(cardId);if(!card)throw Error('Elegí la tarjeta del resumen.');
 const period=(data.due||data.closing||today()).slice(0,7);
 state.cardStatements=[...state.cardStatements.filter(s=>!(s.cardId===card.id&&s.period===period)),{id:crypto.randomUUID(),cardId:card.id,period,closing:data.closing,due:data.due,nextClosing:data.nextClosing,nextDue:data.nextDue,total:data.total,totalUSD:data.totalUSD,minimum:data.minimum,importedAt:new Date().toISOString()}].slice(-60);
 if(updateDays){const nc=+(data.nextClosing||data.closing||'').slice(8),nd=+(data.nextDue||data.due||'').slice(8);if(nc)card.closeDay=nc;if(nd)card.dueDay=nd}
 let added=0;if(addItems)for(const i of data.items||[]){if(i.currency!==card.currency||!i.date||!(i.amount>0))continue;const m=/(\d+)\s*\/\s*(\d+)/.exec(i.installment||'');if(m&&+m[1]>1)continue; // a later installment of an older purchase
  if(state.cardPurchases.some(p=>p.cardId===card.id&&p.date===i.date&&Math.abs(cents(p.amount)-cents(m?i.amount*+m[2]:i.amount))<100))continue;
  try{const n=m?+m[2]:1,first=data.due?data.due.slice(0,7):shiftMonth(i.date.slice(0,7),1);storeCardPurchase({cardId:card.id,text:i.text,amount:Math.round(i.amount*n*100)/100,installments:n,date:i.date,firstMonth:first<i.date.slice(0,7)?i.date.slice(0,7):first,category:'Otros'});added++}catch{}}
 irisTab='cards';save();return {added,card:card.name}};

// ---- the cards' closings and due dates, in the iPhone Calendar (repeating, with alerts) ------------------------------------
window.numioCalendar=()=>{const esc2=t=>String(t).replace(/[\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n'),stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),start=localDay().slice(0,7);
 const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//nubo//numio//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:numio'];
 const ev=(uid,title,date,rule,alarms,desc)=>{L.push('BEGIN:VEVENT','UID:'+uid+'@nubo','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+date.replaceAll('-',''),'RRULE:'+rule,'SUMMARY:'+esc2(title),'DESCRIPTION:'+esc2(desc),'TRANSP:TRANSPARENT');
  for(const a of alarms)L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+esc2(title),'TRIGGER:'+a,'END:VALARM');L.push('END:VEVENT')};
 let n=0;for(const c of state.cards.filter(k=>!k.archived)){ev('close-'+c.id,'Cierra '+c.name,dateAtMonth(start,c.closeDay),`FREQ=MONTHLY;BYMONTHDAY=${c.closeDay>28?-1:c.closeDay}`,['-PT14H','PT10H'],'Lo que compres después entra en el próximo resumen.');
  ev('due-'+c.id,'Vence '+c.name,dateAtMonth(start,c.dueDay),`FREQ=MONTHLY;BYMONTHDAY=${c.dueDay>28?-1:c.dueDay}`,['-P1DT15H','PT9H'],'Pagá el resumen de '+c.name+'. Revisá el total en numio.');n++}
 for(const s of state.subscriptions.filter(x=>x.active!==false)){const first=nextCharge(s);ev('sub-'+s.id,s.name+' · '+cash(s.amount,s.currency),first,s.cycle==='anual'?'FREQ=YEARLY':`FREQ=MONTHLY;BYMONTHDAY=${(s.day||1)>28?-1:s.day||1}`,[(+s.remindDays||0)>0?`-PT${(+s.remindDays)*24-10}H`:'PT10H'],'Renovación de '+s.name);n++}
 L.push('END:VCALENDAR');if(!n){notify('Primero agregá una tarjeta o una suscripción.');return}
 const url=URL.createObjectURL(new Blob([L.join('\r\n')],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='numio-tarjetas.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)};

// ---- where it all shows ---------------------------------------------------------------------------------------------
if(Array.isArray(IRIS_NAV)&&!IRIS_NAV.some(n=>n[0]==='subscriptions')){IRIS_NAV.splice(1,0,['plan','Balance','chart']);IRIS_NAV.push(['subscriptions','Suscripciones','repeat'])}
const markupBefore=irisMarkup;
irisMarkup=function(){if(irisTab==='subscriptions')return subsMarkup();const plan=irisTab==='plan';let html;if(plan){const am=analysisMarkup;analysisMarkup=planMarkup;irisTab='analysis';try{html=markupBefore()}finally{analysisMarkup=am;irisTab='plan'}}else html=markupBefore();
 const holder=document.createElement('div');holder.innerHTML=html;const tabs=holder.querySelector('.iris-tabs');
 if(plan){const h=holder.querySelector('h1');if(h)h.textContent='Balance';const sub=h?.nextElementSibling;if(sub?.tagName==='P')sub.textContent='Cuánto podés gastar, dónde te pasás y qué recortar.'}
 if(tabs){for(const b of tabs.querySelectorAll('button'))if(plan){b.classList.remove('active');b.setAttribute('aria-pressed','false')}
  const b=document.createElement('button');b.textContent='Balance';b.className=plan?'active':'';b.setAttribute('aria-pressed',String(plan));b.setAttribute('onclick',"irisTab='plan';irisMonth='';render()");tabs.children[0]?.after(b)}
 if(irisTab==='cards'){const section=holder.querySelector('.card');const t=document.createElement('template');
  const last=state.cardStatements.filter(s=>getCard(s.cardId)?.currency===cur()).sort((a,b)=>String(b.due).localeCompare(String(a.due))).slice(0,3);
  t.innerHTML=`<section class="card np-statement"><div><h2>Resúmenes</h2><p class="small">Subí el PDF del resumen (o una foto): leo el cierre, el vencimiento, el total y los consumos que falten.</p></div><div class="np-two"><button class="primary" onclick="parent.EcosystemHost.openScanner({types:['statement']})">${icon('plus')}Importar resumen</button><button onclick="numioCalendar()">${icon('calendar')}Cierres al Calendario</button></div><p class="small">«Cierres al Calendario» agrega cada cierre y vencimiento al Calendario del iPhone, todos los meses y con aviso: llegan aunque nubo esté cerrado.</p>
   ${last.length?`<ul class="np-list">${last.map(s=>`<li><span>${esc(getCard(s.cardId)?.name||'Tarjeta')}<small>cierre ${esc(String(s.closing||'').split('-').reverse().slice(0,2).join('/'))} · vence ${esc(String(s.due||'').split('-').reverse().slice(0,2).join('/'))}${s.minimum?' · mínimo '+money(s.minimum):''}</small></span><b>${money(s.total)}</b></li>`).join('')}</ul>`:''}</section>`;
  section?section.before(t.content):holder.append(t.content)}
 return holder.innerHTML};
// "Balance" and "Suscripciones" from the sections menu
const goBefore=go;go=function(v){if(v==='plan'||v==='subscriptions'){irisTab=v;if(v==='plan')irisMonth='';view='expenses';query='';render();window.scrollTo(0,0);return}return goBefore(v)};
try{render()}catch{}
})();
