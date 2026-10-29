const fail=message=>{throw Error(message)};
export function money(value){
 if(typeof value==='number'){if(!Number.isFinite(value)||value<=0||value>999999999)fail('Importe inválido');return Math.round(value*100)/100}
 const s=String(value??'').trim();if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))fail('Usá punto para miles y coma para decimales');return money(Number(s.replaceAll('.','').replace(',','.')));
}
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('Completá el texto requerido');return v.trim()};
export function appendShortcut(snapshot,input,{id,now=new Date().toISOString()}={}){
 const s=structuredClone(snapshot),type=input.type;
 const day=input.date||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)fail('Fecha inválida');
 if(type==='income'||type==='expense'){
  const account=s.accounts?.find(a=>a.id===input.accountId&&!a.archived);if(!account)fail('Elegí una cuenta activa de Iris');
  if(input.currency&&input.currency!==account.currency)fail('La moneda no coincide con la cuenta');
  const categories=type==='income'?s.incomeCategories:s.expenseCategories;
  const category=text(input.category,80);if(!categories?.includes(category)||category==='Prestado')fail('Elegí una categoría de Iris; los préstamos se registran en Deudas');
  const methods=type==='income'?['Transferencia','Efectivo','Billetera virtual','Depósito bancario','Tarjeta','Otro']:['Transferencia','Efectivo','Tarjeta de débito','Billetera virtual','Débito automático','Otro'];
  if(!methods.includes(input.method))fail('Medio de pago inválido');
  const collection=type==='income'?'incomes':'expenses';if(!Array.isArray(s[collection]))fail('Abrí Iris y sincronizá antes de usar el atajo');
  s[collection].push({id,text:text(input.text,120),amount:money(input.amount),date:day,category,method:input.method,accountId:account.id,currency:account.currency,account:'',who:''});
 }else if(type==='note'){
  if(!Array.isArray(s.records?.notes))fail('Abrí Journal y sincronizá antes de usar el atajo');
  const escaped=text(input.body,20000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replaceAll('\n','<br>');
  s.records.notes.push({id,title:text(input.title,240),body:escaped,notebook:'Personal',date:day,tags:'',favorite:false,related:[],createdAt:now,updatedAt:now});
 }else if(type==='task'){
  if(!Array.isArray(s.records?.tasks))fail('Abrí Organizador y sincronizá antes de usar el atajo');
  if(input.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))fail('Hora inválida');
  s.records.tasks.push({id,title:text(input.title,240),description:'',date:day,time:input.time||'',priority:'Media',projectId:'',reminder:true,done:false,subtasks:[],createdAt:now,updatedAt:now});
 }else fail('Acción no admitida');
 return s;
}
// Reminders worded like Apple's Reminders: the title is the thing itself, the line below says when and how much.
const TZ='America/Argentina/Buenos_Aires';
const fmtMoney=(n,c='ARS')=>(c==='USD'?'US$ ':c==='EUR'?'€ ':'$ ')+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:Number(n)%1?2:0,maximumFractionDigits:2});
const ymd=t=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
function when(day,now){const d=Math.round((Date.parse(day+'T12:00:00-03:00')-Date.parse(ymd(now)+'T12:00:00-03:00'))/864e5);
 return d===0?'hoy':d===1?'mañana':d===2?'pasado mañana':d>2&&d<7?'el '+new Intl.DateTimeFormat('es-AR',{timeZone:TZ,weekday:'long'}).format(new Date(day+'T12:00:00-03:00')):'el '+day.slice(8)+'/'+day.slice(5,7)}
export function dueNotices(module,s,now=Date.now()){
 const notices=[],add=(key,title,body,due,view)=>{if(Number.isFinite(due)&&due<=now&&due>now-300000)notices.push({key,title,body,due,url:'/#/'+module+'/'+view})};
 const local=(day,time='09:00')=>Date.parse(day+'T'+(time||'09:00')+':00-03:00');
 const month=ymd(now).slice(0,7),lastDay=m=>{const [y,mm]=m.split('-').map(Number);return new Date(Date.UTC(y,mm,0)).getUTCDate()},at=(m,d)=>m+'-'+String(Math.min(Number(d)||1,lastDay(m))).padStart(2,'0');
 const shift=(m,n)=>{const [y,mm]=m.split('-').map(Number),d=new Date(Date.UTC(y,mm-1+n,1));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')};
 if(module==='organizador'){
  for(const r of s.records?.tasks||[]){if(!r.reminder||r.done||!r.date)continue;const due=local(r.date,r.time);add('tasks:'+r.id+':'+due,r.title,r.time?'Hoy a las '+r.time:'Para hoy',due,'tasks')}
  for(const r of s.records?.events||[]){if(r.reminder===false||!r.date)continue;const start=local(r.date,r.time||'08:30'),due=r.time?start-30*60000:start;
   add('events:'+r.id+':'+due,r.title,(r.time?'En 30 minutos · '+r.time+(r.endTime?'–'+r.endTime:''):'Hoy, todo el día')+(r.place?' · '+r.place:''),due,'calendar')}
 }
 if(module==='iris'){
  for(const r of s.services||[]){if(r.archived||r.activeFrom>month||(s.servicePayments||[]).some(p=>p.serviceId===r.id&&p.period===month))continue;
   const day=at(month,r.day),due=local(day,r.remindTime||'09:00')-(Number(r.remindDays)||0)*86400000;
   add('service:'+r.id+':'+month,r.name,'Vence '+when(day,due)+(r.amount?' · '+fmtMoney(r.amount,r.currency):''),due,'services');
  }
  // credit cards: the day before closing, and two days before / on the due date
  for(const c of s.cards||[]){if(c.archived)continue;
   for(const m of [month,shift(month,1)]){
    const st=(s.cardStatements||[]).find(x=>x.cardId===c.id&&String(x.due||'').startsWith(m)),closing=st?.nextClosing&&st.nextClosing.startsWith(m)?st.nextClosing:at(m,c.closeDay),dueDay=st?.due||at(m,c.dueDay);
    const paid=(s.cardPayments||[]).filter(p=>p.cardId===c.id&&String(p.date||'').startsWith(dueDay.slice(0,7))).reduce((a,p)=>a+Number(p.amount||0),0);
    const total=st?.total||0,amount=total?(paid>=total?0:total-paid):0;
    for(const before of [1]){const due=local(closing,'10:00')-before*86400000;add('card-close:'+c.id+':'+closing,c.name,'Cierra '+when(closing,due)+'. Lo que compres después entra en el próximo resumen.',due,'expenses')}
    if(total&&!amount)continue;
    for(const [days,hour] of [[2,'10:00'],[0,'09:00']]){const due=local(dueDay,hour)-days*86400000;
     add('card-due:'+c.id+':'+dueDay+':'+days,c.name,'Vence '+when(dueDay,due)+(amount?' · '+fmtMoney(amount,c.currency)+(st?.minimum?' · mínimo '+fmtMoney(st.minimum,c.currency):''):''),due,'expenses')}
   }
  }
  // subscriptions: before each renewal
  for(const sub of s.subscriptions||[]){if(sub.active===false)continue;
   for(const m of [month,shift(month,1)]){if(sub.cycle==='anual'&&Number(m.slice(5,7))!==Number(sub.month||1))continue;const day=at(m,sub.day);
    if((s.subscriptionCharges||[]).some(x=>x.subId===sub.id&&x.period===m))continue;
    const due=local(day,'10:00')-(Number(sub.remindDays)||0)*86400000,card=(s.cards||[]).find(k=>k.id===sub.cardId);
    add('sub:'+sub.id+':'+day,sub.name,(sub.cycle==='anual'?'Se renueva ':'Se cobra ')+when(day,due)+' · '+fmtMoney(sub.amount,sub.currency)+(card?' con '+card.name:''),due,'subscriptions')}
  }
 }
 return notices;
}
export function validEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.notify.windows.com'))}catch{return false}}
