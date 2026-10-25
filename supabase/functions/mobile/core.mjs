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
export function dueNotices(module,s,now=Date.now()){
 const notices=[],add=(key,title,body,due,view)=>{if(Number.isFinite(due)&&due<=now&&due>now-300000)notices.push({key,title,body,due,url:'/#/'+module+'/'+view})};
 const local=(day,time='09:00')=>Date.parse(day+'T'+(time||'09:00')+':00-03:00');
 if(module==='organizador')for(const type of ['tasks','events'])for(const r of s.records?.[type]||[]){if(!r.reminder||r.done||!r.date)continue;const due=local(r.date,r.time);add(type+':'+r.id+':'+due,type==='tasks'?'Recordatorio de tarea':'Tu evento',r.title,due,type)}
 if(module==='iris'){
  const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit'}).format(new Date(now));
  for(const r of s.services||[]){if(r.archived||r.activeFrom>month||(s.servicePayments||[]).some(p=>p.serviceId===r.id&&p.period===month))continue;
   const [y,m]=month.split('-').map(Number),day=Math.min(Number(r.day),new Date(Date.UTC(y,m,0)).getUTCDate());
   const due=local(month+'-'+String(day).padStart(2,'0'),r.remindTime||'09:00')-(Number(r.remindDays)||0)*86400000;
   add('service:'+r.id+':'+month,'Vencimiento de servicio',r.name,due,'services');
  }
 }
 return notices;
}
export function validEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.notify.windows.com'))}catch{return false}}
