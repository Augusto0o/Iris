import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
import {appendShortcut,dueNotices,validEndpoint} from './core.mjs';
const origin='https://ecosistema-personal-sand.vercel.app';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const digest=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const check=(r:any)=>{if(r.error)throw Error('No se pudo guardar. Reintentá.');return r.data};
async function vapid(){
 let row=check(await db.from('ecosystem_mobile_secrets').select('value').eq('key','vapid').maybeSingle());
 if(!row){const keys=webpush.generateVAPIDKeys();check(await db.from('ecosystem_mobile_secrets').upsert({key:'vapid',value:keys},{onConflict:'key',ignoreDuplicates:true}));row=check(await db.from('ecosystem_mobile_secrets').select('value').eq('key','vapid').single())}
 return row.value;
}
async function send(sub:any,notice:any,keys:any){
 const prior=check(await db.from('ecosystem_push_deliveries').select('claimed_at,sent_at').eq('endpoint',sub.endpoint).eq('key',notice.key).maybeSingle());
 if(prior&&(prior.sent_at||Date.parse(prior.claimed_at)>Date.now()-120000))return false;
 if(prior){const claimed=check(await db.from('ecosystem_push_deliveries').update({claimed_at:new Date().toISOString()}).eq('endpoint',sub.endpoint).eq('key',notice.key).eq('claimed_at',prior.claimed_at).select('key'));if(!claimed.length)return false}
 else {const inserted=await db.from('ecosystem_push_deliveries').insert({endpoint:sub.endpoint,key:notice.key});if(inserted.error?.code==='23505')return false;check(inserted)}
 try{
  await webpush.sendNotification(sub.subscription,JSON.stringify({title:notice.title,body:notice.body,tag:notice.key,url:notice.url}),{vapidDetails:{subject:origin,publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:300,timeout:8000});
  check(await db.from('ecosystem_push_deliveries').update({sent_at:new Date().toISOString()}).eq('endpoint',sub.endpoint).eq('key',notice.key));return true;
 }catch(e){if([404,410].includes(e.statusCode))check(await db.from('ecosystem_push_subscriptions').delete().eq('endpoint',sub.endpoint));else check(await db.from('ecosystem_push_deliveries').delete().eq('endpoint',sub.endpoint).eq('key',notice.key));return false}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'Usá POST'},405);
 try{
  const raw=await req.text();if(raw.length>40000)return reply({error:'Solicitud demasiado grande'},413);
  const input=JSON.parse(raw||'{}'),token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
  if(!token)return reply({error:'Iniciá sesión'},401);
  if(input.action==='dispatch'){
   const secret=check(await db.from('ecosystem_mobile_secrets').select('value').eq('key','scheduler').single());
   if(await digest(token)!==await digest(secret.value.token))return reply({error:'No autorizado'},401);
   const subs=check(await db.from('ecosystem_push_subscriptions').select('*').limit(200)),keys=await vapid();let sent=0;
   for(const uid of new Set(subs.map((s:any)=>s.user_id))){
    const docs=check(await db.from('ecosystem_documents').select('module,payload').eq('user_id',uid));
    const notices=docs.flatMap((d:any)=>dueNotices(d.module,d.payload));
    const timers=check(await db.from('ecosystem_push_timers').select('*').eq('user_id',uid).lte('due_at',new Date().toISOString()).gte('due_at',new Date(Date.now()-300000).toISOString()));
    for(const t of timers)notices.push({...t.payload,key:t.id+':'+t.due_at,due:Date.parse(t.due_at)});
    for(const sub of subs.filter((s:any)=>s.user_id===uid))for(const n of notices){if(n.due<Date.parse(sub.created_at))continue;if(await send(sub,n,keys))sent++}
   }
   check(await db.from('ecosystem_push_timers').delete().lt('due_at',new Date(Date.now()-86400000).toISOString()));
   check(await db.from('ecosystem_push_deliveries').delete().lt('claimed_at',new Date(Date.now()-7*86400000).toISOString()));
   return reply({sent});
  }
  if(input.action==='record'){
   if(!token.startsWith('eco_'))return reply({error:'Clave de atajo inválida'},401);
   const credential=check(await db.from('ecosystem_shortcut_tokens').select('id,user_id,expires_at,revoked_at').eq('token_hash',await digest(token)).maybeSingle());
   if(!credential||credential.revoked_at||Date.parse(credential.expires_at)<Date.now())return reply({error:'Clave vencida o revocada'},401);
   const uid=credential.user_id;if(!/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId||''))return reply({error:'Agregá un UUID nuevo como requestId; conservá el mismo al reintentar'},400);
   const key='shortcut:'+input.requestId,prior=check(await db.from('ecosystem_mobile_receipts').select('result').eq('user_id',uid).eq('key',key).maybeSingle());if(prior)return reply(prior.result);
   const {count,error}=await db.from('ecosystem_mobile_receipts').select('key',{count:'exact',head:true}).eq('user_id',uid).gte('created_at',new Date(Date.now()-60000).toISOString());if(error)throw error;if((count||0)>=30)return reply({error:'Esperá un minuto antes de continuar'},429);
   const module=['income','expense'].includes(input.type)?'iris':input.type==='note'?'journal':input.type==='task'?'organizador':null;if(!module)return reply({error:'Acción inválida'},400);
   for(let attempt=0;attempt<3;attempt++){
    const doc=check(await db.from('ecosystem_documents').select('payload,revision').eq('user_id',uid).eq('module',module).maybeSingle());if(!doc)return reply({error:'Abrí y sincronizá esta app primero'},409);
    const id=crypto.randomUUID(),payload=appendShortcut(doc.payload,input,{id}),result={saved:true,id,module};
    const saved=await db.rpc('ecosystem_mobile_append',{p_user:uid,p_module:module,p_payload:payload,p_expected:doc.revision,p_key:key,p_result:result});
    if(saved.error?.code==='40001')continue;check(saved);return reply(saved.data);
   }return reply({error:'La app se está actualizando. Reintentá con el mismo requestId'},409);
  }
  const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return reply({error:'Iniciá sesión nuevamente'},401);
  const uid=user.id;
  if(input.action==='status')return reply({publicKey:(await vapid()).publicKey,subscriptions:check(await db.from('ecosystem_push_subscriptions').select('endpoint').eq('user_id',uid)).length,tokens:check(await db.from('ecosystem_shortcut_tokens').select('id,created_at,expires_at').eq('user_id',uid).is('revoked_at',null))});
  if(input.action==='subscribe'){
   const s=input.subscription;if(!s||!validEndpoint(s.endpoint)||!/^[-\w]{80,100}$/.test(s.keys?.p256dh||'')||!/^[-\w]{20,30}$/.test(s.keys?.auth||''))return reply({error:'Suscripción inválida'},400);
   const prior=check(await db.from('ecosystem_push_subscriptions').select('user_id').eq('endpoint',s.endpoint).maybeSingle());if(prior&&prior.user_id!==uid)return reply({error:'Desactivá las notificaciones de la cuenta anterior en este dispositivo'},409);
   check(await db.from('ecosystem_push_subscriptions').upsert({endpoint:s.endpoint,user_id:uid,subscription:s},{onConflict:'endpoint'}));return reply({saved:true});
  }
  if(input.action==='unsubscribe'){check(await db.from('ecosystem_push_subscriptions').delete().eq('user_id',uid).eq('endpoint',String(input.endpoint)));return reply({saved:true})}
  if(input.action==='test'){
   const subs=check(await db.from('ecosystem_push_subscriptions').select('*').eq('user_id',uid).eq('endpoint',String(input.endpoint))),keys=await vapid();let sent=0;
   for(const sub of subs)if(await send(sub,{key:'test:'+Math.floor(Date.now()/30000),title:'Ecosistema Personal',body:'Las notificaciones están conectadas.',url:'/#/centro/home'},keys))sent++;
   return reply({sent});
  }
  if(input.action==='timer'){
   if(!/^timer:[a-zA-Z0-9_-]{1,100}$/.test(input.id||''))return reply({error:'Temporizador inválido'},400);
   if(!input.due){check(await db.from('ecosystem_push_timers').delete().eq('user_id',uid).eq('id',input.id));return reply({saved:true})}
   const due=Number(input.due);if(!Number.isFinite(due)||due<Date.now()||due>Date.now()+86400000)return reply({error:'Duración inválida'},400);
   check(await db.from('ecosystem_push_timers').upsert({user_id:uid,id:input.id,due_at:new Date(due).toISOString(),payload:{title:input.kind==='recipe'?'Listo en la cocina':'Pomodoro terminado',body:'Tu temporizador llegó a cero.',url:input.kind==='recipe'?'/#/mi-espacio/recipes':'/#/organizador/focus'}},{onConflict:'user_id,id'}));return reply({saved:true});
  }
  if(input.action==='token-create'){
   const token='eco_'+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const row=check(await db.from('ecosystem_shortcut_tokens').insert({user_id:uid,token_hash:await digest(token)}).select('id,expires_at').single());return reply({...row,token});
  }
  if(input.action==='token-revoke'){check(await db.from('ecosystem_shortcut_tokens').update({revoked_at:new Date().toISOString()}).eq('user_id',uid).eq('id',String(input.id)));return reply({saved:true})}
  return reply({error:'Acción no admitida'},400);
 }catch(e){return reply({error:e instanceof Error?e.message:'No se pudo completar'},400)}
});
