export function createMobile({cloud,config,dialog,body,vault}){
 const endpoint=config.url+'/functions/v1/mobile';const timerStates=new Map();
 async function call(input){const {data:{session}}=await cloud.client.auth.getSession();if(!session)throw Error('Entrá a tu cuenta primero.');const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:config.key},body:JSON.stringify(input)});const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo completar.');return data}
 const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
 function feedback(text){let e=body.querySelector('.mobile-feedback');if(!e){e=node('p','');e.className='mobile-feedback status';e.setAttribute('role','status');body.prepend(e)}e.textContent=text}
 function button(label,fn){const b=node('button',label);b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){feedback(e.message)}finally{b.disabled=false}};return b}
 function field(label,value){const e=node('label',label),input=document.createElement('textarea');input.readOnly=true;input.value=value;input.rows=Math.min(12,value.split('\n').length+1);e.append(input);return e}
 async function open(){dialog.querySelector('h2').textContent='Notificaciones y atajos';dialog.dataset.view='mobile';body.replaceChildren(node('p','Cargando…'));if(!dialog.open)dialog.showModal();
  if(!cloud.user){body.replaceChildren(node('p','Entrá a tu cuenta desde Cuenta y sincronización para conectar este teléfono.'));return}
  try{const status=await call({action:'status'});if(!dialog.open||dialog.dataset.view!=='mobile')return;paint(status)}catch(e){feedback(e.message)}
 }
 function paint(status){
  body.replaceChildren(node('h3','Notificaciones en este dispositivo'),node('p','Te aviso solo de lo importante: tareas con recordatorio, eventos de tu agenda (30 minutos antes), vencimientos de servicios, cierres y vencimientos de tarjetas, y renovaciones de suscripciones. Horario de Argentina.'));
  {const state=node('p','');state.className='mobile-state';body.append(state);(async()=>{try{const sub='serviceWorker'in navigator?await(await navigator.serviceWorker.ready).pushManager.getSubscription():null,on=('Notification'in window)&&Notification.permission==='granted'&&!!sub;
   state.textContent=on?'● Activadas en este iPhone. Se vuelven a registrar solas cada vez que abrís la app.':('Notification'in window)&&Notification.permission==='denied'?'● Bloqueadas en los ajustes del iPhone (Ajustes › Notificaciones › nubo).':'● Todavía no están activadas en este iPhone.';state.dataset.on=String(on);if(on)heal(true)}catch{}})()}
  const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
  if(supported){body.append(button('Activar notificaciones',async()=>{
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('No se concedió permiso. Podés cambiarlo en los ajustes del iPhone.');
   const registration=await navigator.serviceWorker.ready;const existing=await registration.pushManager.getSubscription();const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:status.publicKey});
   await call({action:'subscribe',subscription:subscription.toJSON()});feedback('Activadas. Usá “Enviar prueba” para comprobar este teléfono.');
  }),button('Enviar prueba',async()=>{const subscription=await (await navigator.serviceWorker.ready).pushManager.getSubscription();if(!subscription)throw Error('Activá las notificaciones primero.');const r=await call({action:'test',endpoint:subscription.endpoint});feedback(r.sent?'Prueba enviada. Comprobá el aviso en tu teléfono.':'No se envió. Esperá 30 segundos y revisá que estén activadas.')}),button('Desactivar en este dispositivo',async()=>{const sub=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(sub){await call({action:'unsubscribe',endpoint:sub.endpoint});await sub.unsubscribe()}feedback('Notificaciones desactivadas en este dispositivo.')}));
  }else body.append(node('p','Este navegador no ofrece notificaciones push. En iPhone necesitás abrir la app instalada en la pantalla de inicio.'));
  body.append(node('hr',''),node('h3','Atajos que guardan directamente'),node('p','Creá una clave para tus atajos. Permite agregar ingresos, gastos, notas y tareas; vence al año y podés revocarla acá. No la compartas.'),button('Crear clave de atajos',async()=>{
   const created=await call({action:'token-create'});body.append(node('h4','Guardá esta clave: se muestra una sola vez'),field('Authorization','Bearer '+created.token),button('Copiar clave',async()=>{await navigator.clipboard.writeText(created.token);feedback('Clave copiada.')}));
   body.append(button('Revocar esta clave',async()=>{await call({action:'token-revoke',id:created.id});await open()}));
  }));
  for(const token of status.tokens)body.append(button('Revocar clave del '+new Date(token.created_at).toLocaleDateString('es-AR'),async()=>{await call({action:'token-revoke',id:token.id});await open()}));
  body.append(node('p','En Atajos: “Generar UUID” → “Obtener contenido de URL” (POST). Agregá los encabezados Content-Type: application/json y Authorization: Bearer TU_CLAVE. Cuerpo JSON: elegí un ejemplo de abajo y reemplazá sus valores por las respuestas de “Solicitar entrada”. Usá un UUID nuevo por registro, y el mismo si reintentás una petición fallida.'),field('URL',endpoint));
  let iris={};try{iris=JSON.parse(vault.getItem('iris03')||'{}')}catch{}
  const accounts=iris.accounts?.filter(a=>!a.archived)||[];
  if(accounts.length)body.append(field('Cuentas de numio (usá el id en accountId)',accounts.map(a=>a.name+' · '+a.currency+': '+a.id).join('\n')));
  const common={action:'record',requestId:'VARIABLE_UUID'};
  for(const [label,data]of [
   ['Gasto',{...common,type:'expense',text:'Compra',amount:'1.500,50',accountId:accounts[0]?.id||'ID_DE_LA_CUENTA',category:iris.expenseCategories?.find(x=>x!=='Prestado')||'Comida',method:'Efectivo'}],
   ['Ingreso',{...common,type:'income',text:'Ingreso',amount:'25.000',accountId:accounts[0]?.id||'ID_DE_LA_CUENTA',category:iris.incomeCategories?.find(x=>x!=='Prestado')||'Sueldo',method:'Transferencia'}],
   ['Nota',{...common,type:'note',title:'Mi idea',body:'Contenido de la nota'}],
   ['Tarea',{...common,type:'task',title:'Mi tarea',date:'2026-10-25',time:'09:00'}]
  ]){const details=document.createElement('details');details.append(node('summary',label),field('Cuerpo JSON',JSON.stringify(data,null,2)));body.append(details)}
  body.append(node('p','Los importes de texto usan punto para miles y coma para decimales. Si no mandás fecha, se usa el día actual en Argentina. Abrí y sincronizá cada app una vez antes de guardar desde Atajos.'));
 }
 async function timer(value){
  if(!cloud.user||!cloud.client)return;
  const key=cloud.user.id+':'+value.id,signature=JSON.stringify(value),old=timerStates.get(key);
  if(old?.signature===signature)return;
  const entry={signature,pending:null};timerStates.set(key,entry);
  entry.pending=Promise.resolve(old?.pending).catch(()=>{}).then(async()=>{if(timerStates.get(key)!==entry)return;try{await call({action:'timer',...value})}catch{if(timerStates.get(key)===entry)timerStates.delete(key)}});
  await entry.pending;
 }
 // iOS sometimes renews or drops the push subscription (an update, a reinstall). On every start the phone
 // re-registers itself, so notifications never switch off silently.
 async function heal(force=false){try{if(!cloud.user||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)||Notification.permission!=='granted')return false;
  let last=0;try{last=+localStorage.getItem('nubo-push-heal')||0}catch{}if(!force&&Date.now()-last<6*3600000)return true;
  const registration=await navigator.serviceWorker.ready;let sub=await registration.pushManager.getSubscription();
  if(!sub){const status=await call({action:'status'});sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:status.publicKey})}
  await call({action:'subscribe',subscription:sub.toJSON()});try{localStorage.setItem('nubo-push-heal',String(Date.now()))}catch{}return true}catch{return false}}
 async function detach(){if(!cloud.user||!('serviceWorker'in navigator))return;const sub=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(sub){await call({action:'unsubscribe',endpoint:sub.endpoint});await sub.unsubscribe()}}
 return {open,timer,detach,call,heal};
}
