// nubo · Contraseñas, like the vault in Personal OS. Everything stays on this phone, encrypted:
//  - key: PBKDF2-SHA256 (310 000 rounds) from your master password; AES-GCM 256 per item with a random IV
//  - the master password is never stored nor sent anywhere (not to Supabase, not to the AI)
//  - optional Face ID: a passkey with the PRF extension unwraps the master password (iOS 18 or later)
//  - it locks itself after 5 minutes without use or 1 minute in the background
// An encrypted backup file can be exported and imported (to move to another phone).
const DB='nubo-vault',STORE='vault',CHECK='nubo-vault-v1',ROUNDS=310000,AUTO_LOCK=5*60000,HIDDEN_LOCK=60000;
export const CATEGORIES=[['web','Web'],['app','App'],['email','Email'],['wifi','Wi-Fi'],['card','Tarjeta'],['other','Otro']];
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=buf=>{const a=new Uint8Array(buf instanceof ArrayBuffer?buf:buf.buffer?buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength):buf);let s='';for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---- storage -----------------------------------------------------------------------------------------------
let dbp=null;
function db(){return dbp||=new Promise((ok,ko)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)})}
async function tx(mode,fn){const d=await db();return new Promise((ok,ko)=>{const t=d.transaction(STORE,mode),s=t.objectStore(STORE),r=fn(s);t.oncomplete=()=>ok(r?.result);t.onerror=()=>ko(t.error)})}
const get=id=>tx('readonly',s=>s.get(id)),put=v=>tx('readwrite',s=>s.put(v)),del=id=>tx('readwrite',s=>s.delete(id)),all=()=>tx('readonly',s=>s.getAll());

// ---- crypto ------------------------------------------------------------------------------------------------
export async function deriveKey(master,salt,rounds=ROUNDS){const base=await crypto.subtle.importKey('raw',enc.encode(master),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:rounds},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function seal(key,value){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value))))}}
export async function open(key,box){return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},key,unb64(box.data))))}

// ---- passwords ---------------------------------------------------------------------------------------------
export function generate({length=20,symbols=true,numbers=true,upper=true}={}){
 const sets=['abcdefghijkmnopqrstuvwxyz',upper&&'ABCDEFGHJKLMNPQRSTUVWXYZ',numbers&&'23456789',symbols&&'!@#$%&*?-_=+.'].filter(Boolean),pool=sets.join('');
 const pick=n=>{const r=new Uint32Array(1);const lim=Math.floor(2**32/n)*n;do crypto.getRandomValues(r);while(r[0]>=lim);return r[0]%n};
 const out=sets.map(s=>s[pick(s.length)]);while(out.length<length)out.push(pool[pick(pool.length)]);
 for(let i=out.length-1;i>0;i--){const j=pick(i+1);[out[i],out[j]]=[out[j],out[i]]}return out.join('')}
export function strength(p){p=String(p||'');if(!p)return {score:0,label:''};let pool=0;if(/[a-z]/.test(p))pool+=26;if(/[A-Z]/.test(p))pool+=26;if(/\d/.test(p))pool+=10;if(/[^\w]/.test(p))pool+=20;
 let bits=p.length*Math.log2(Math.max(pool,1));if(/(.)\1{2,}/.test(p)||/^(123|abc|qwe|pass|contra)/i.test(p))bits*=.6;
 const score=bits<35?1:bits<60?2:bits<85?3:4;return {score,label:['','Débil','Regular','Buena','Muy fuerte'][score]}}

// ---- the vault ---------------------------------------------------------------------------------------------
export function createVault(){
 let key=null,items=[],lockTimer=null,hiddenAt=0;const listeners=new Set();
 const emit=()=>listeners.forEach(l=>l());
 const touch=()=>{clearTimeout(lockTimer);if(key)lockTimer=setTimeout(lock,AUTO_LOCK)};
 function lock(){key=null;items=[];clearTimeout(lockTimer);emit()}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(key&&hiddenAt&&Date.now()-hiddenAt>HIDDEN_LOCK)lock()});
 async function load(){items=[];for(const r of await all()){if(!r.id.startsWith('item:'))continue;try{items.push({...(await open(key,r)),id:r.id.slice(5)})}catch{}}items.sort((a,b)=>a.title.localeCompare(b.title,'es'))}
 const api={
  on(l){listeners.add(l);return ()=>listeners.delete(l)},
  get unlocked(){return !!key},get items(){return items},
  async configured(){return !!(await get('config'))},
  async setup(master){if(String(master).length<8)throw Error('La contraseña maestra tiene que tener al menos 8 caracteres.');if(await get('config'))throw Error('La bóveda ya existe.');
   const salt=crypto.getRandomValues(new Uint8Array(16));key=await deriveKey(master,salt);await put({id:'config',salt:b64(salt),rounds:ROUNDS,check:await seal(key,CHECK)});items=[];touch();emit()},
  async unlock(master){const c=await get('config');if(!c)throw Error('Todavía no creaste la bóveda.');const k=await deriveKey(master,unb64(c.salt),c.rounds||ROUNDS);
   try{if(await open(k,c.check)!==CHECK)throw 0}catch{throw Error('Contraseña maestra incorrecta.')}key=k;await load();touch();emit()},
  lock,
  async save(item){if(!key)throw Error('La bóveda está bloqueada.');const title=String(item.title||'').trim();if(!title)throw Error('Poné un nombre (por ejemplo, el sitio o la app).');
   const now=new Date().toISOString(),id=item.id||crypto.randomUUID(),old=items.find(i=>i.id===id);
   const value={title:title.slice(0,120),username:String(item.username||'').slice(0,200),password:String(item.password||'').slice(0,500),url:String(item.url||'').trim().slice(0,500),notes:String(item.notes||'').slice(0,4000),
    category:CATEGORIES.some(c=>c[0]===item.category)?item.category:'web',favorite:!!item.favorite,createdAt:old?.createdAt||now,updatedAt:now};
   await put({id:'item:'+id,...await seal(key,value)});items=[...items.filter(i=>i.id!==id),{...value,id}].sort((a,b)=>a.title.localeCompare(b.title,'es'));touch();emit();return id},
  async remove(id){await del('item:'+id);items=items.filter(i=>i.id!==id);touch();emit()},
  async changeMaster(current,next){const c=await get('config');const k=await deriveKey(current,unb64(c.salt),c.rounds||ROUNDS);try{await open(k,c.check)}catch{throw Error('La contraseña actual no es correcta.')}
   if(String(next).length<8)throw Error('La nueva contraseña tiene que tener al menos 8 caracteres.');
   const salt=crypto.getRandomValues(new Uint8Array(16)),nk=await deriveKey(next,salt),list=[];for(const r of await all())if(r.id.startsWith('item:'))list.push([r.id,await open(k,r)]);
   for(const [id,v] of list)await put({id,...await seal(nk,v)});await put({id:'config',salt:b64(salt),rounds:ROUNDS,check:await seal(nk,CHECK)});await del('bio');key=nk;touch();emit()},
  async exportBackup(){const rows=await all();return JSON.stringify({app:'nubo-vault',version:1,exported:new Date().toISOString(),rows:rows.filter(r=>r.id==='config'||r.id.startsWith('item:'))})},
  async importBackup(text,master){const data=JSON.parse(text);if(data?.app!=='nubo-vault'||!Array.isArray(data.rows))throw Error('Ese archivo no es una copia de la bóveda de nubo.');
   const c=data.rows.find(r=>r.id==='config');const k=await deriveKey(master,unb64(c.salt),c.rounds||ROUNDS);try{await open(k,c.check)}catch{throw Error('La contraseña maestra de esa copia no coincide.')}
   if(!key)throw Error('Desbloqueá la bóveda primero.');let n=0;for(const r of data.rows){if(!r.id.startsWith('item:'))continue;const v=await open(k,r);await put({id:r.id,...await seal(key,v)});n++}await load();emit();return n},
  // Face ID (passkey + PRF)
  async bioSupported(){try{return !!window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()}catch{return false}},
  async bioConfigured(){return !!(await get('bio'))},
  async enableBio(master){const c=await get('config');const k=await deriveKey(master,unb64(c.salt),c.rounds||ROUNDS);try{await open(k,c.check)}catch{throw Error('Contraseña maestra incorrecta.')}
   const salt=crypto.getRandomValues(new Uint8Array(32));
   const cred=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{id:location.hostname,name:'nubo'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'Contraseñas de nubo',displayName:'Contraseñas de nubo'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},timeout:60000,extensions:{prf:{eval:{first:salt}}}}});
   if(!cred)throw Error('No se creó la llave.');const ext=cred.getClientExtensionResults?.()||{};if(ext.prf?.enabled===false)throw Error('Este iPhone no permite Face ID para la web (hace falta iOS 18 o superior).');
   const id=new Uint8Array(cred.rawId),prf=ext.prf?.results?.first||await prfOf(id,salt),wrap=await prfKey(prf),iv=crypto.getRandomValues(new Uint8Array(12));
   await put({id:'bio',credentialId:b64(id),salt:b64(salt),iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},wrap,enc.encode(master)))})},
  async disableBio(){await del('bio')},
  async unlockBio(){const r=await get('bio');if(!r)return false;let master;try{const prf=await prfOf(unb64(r.credentialId),unb64(r.salt));master=dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(r.iv)},await prfKey(prf),unb64(r.data)))}
   catch(e){if(['NotAllowedError','AbortError'].includes(e?.name))return false;throw e}await api.unlock(master);return true},
  touch,
 };
 return api;
}
async function prfKey(prf){const base=await crypto.subtle.importKey('raw',prf,'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('nubo-vault-bio'),info:new Uint8Array()},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function prfOf(id,salt){const cred=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rpId:location.hostname,allowCredentials:[{type:'public-key',id,transports:['internal','hybrid']}],userVerification:'required',timeout:60000,extensions:{prf:{eval:{first:salt}}}}});
 const out=cred?.getClientExtensionResults?.()?.prf?.results?.first;if(!out)throw Error('Este iPhone no permite Face ID para la web (hace falta iOS 18 o superior).');return out}

// ---- screens (inside the account dialog) -------------------------------------------------------------------
const IC={key:'<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/></svg>',up:'<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>',down:'<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>',search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',lock:'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg>',eye:'<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
 copy:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',dice:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/></svg>',
 star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
 face:'<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9v4h-1M9.5 16c1.5 1 3.5 1 5 0"/></svg>',plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',back:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'};
export function createVaultScreens({dialog,body,notify}){
 const vault=createVault();let view={q:'',cat:'all'};
 const title=t=>{dialog.querySelector('h2').textContent=t};
 const html=s=>{const t=document.createElement('template');t.innerHTML=s.trim();body.replaceChildren(t.content);body.scrollTop=0};
 const err=(box,e)=>{box.textContent=e?.message||String(e);box.hidden=false};
 vault.on(()=>{if(dialog.open&&dialog.dataset.view==='vault'&&!vault.unlocked)locked()});
 body.addEventListener('pointerdown',()=>vault.touch());
 async function copy(text,what,btn){try{await navigator.clipboard.writeText(text);if(btn){btn.classList.add('done');setTimeout(()=>btn.classList.remove('done'),1400)}}catch{notify?.('No se pudo copiar.')}}
 async function openVault(){dialog.dataset.view='vault';title('Contraseñas');if(!dialog.open)dialog.showModal();if(vault.unlocked)return list();if(!(await vault.configured()))return setup();locked(true)}
 function meter(input,box){const paint=()=>{const s=strength(input.value);box.dataset.score=s.score;box.querySelector('span').textContent=s.label};input.addEventListener('input',paint);paint()}
 function setup(){title('Crear la bóveda');
  html(`<form class="vault-form" id="vaultSetup"><span class="vault-hero">${IC.lock}</span><p class="muted">Tus contraseñas se guardan cifradas solo en este teléfono. Elegí una contraseña maestra: es la única que vas a tener que recordar.</p>
   <label>Contraseña maestra<input name="a" type="password" autocomplete="new-password" minlength="8" required></label><div class="vault-meter"><i></i><span></span></div>
   <label>Repetila<input name="b" type="password" autocomplete="new-password" required></label>
   <p class="vault-warn">Si la olvidás no hay forma de recuperarla: nadie más la tiene, ni siquiera nubo.</p><p class="vault-error" hidden></p>
   <button class="primary">Crear bóveda</button></form>`);
  const f=body.querySelector('form');meter(f.a,body.querySelector('.vault-meter'));
  f.onsubmit=async e=>{e.preventDefault();const box=f.querySelector('.vault-error');box.hidden=true;if(f.a.value!==f.b.value)return err(box,Error('Las contraseñas no coinciden.'));
   const b=f.querySelector('.primary');b.disabled=true;b.textContent='Creando…';try{await vault.setup(f.a.value);list();offerBio(f.a.value)}catch(x){err(box,x)}finally{b.disabled=false;b.textContent='Crear bóveda'}}}
 async function offerBio(master){if(!(await vault.bioSupported())||await vault.bioConfigured())return;sheet(`<strong>¿Entrar con Face ID?</strong><p class="muted">Así no tenés que escribir la contraseña maestra cada vez.</p><div class="vault-actions"><button type="button" class="primary" data-a="yes">${IC.face}Activar Face ID</button><button type="button" data-a="no">Ahora no</button></div>`,async a=>{if(a!=='yes')return true;try{await vault.enableBio(master);notify?.('Face ID activado');return true}catch(x){notify?.(x.message);return true}})}
 async function locked(auto=false){title('Contraseñas');const bio=await vault.bioConfigured();
  html(`<form class="vault-form" id="vaultUnlock"><span class="vault-hero">${IC.lock}</span><p class="muted">La bóveda está bloqueada.</p>
   <label>Contraseña maestra<input name="m" type="password" autocomplete="current-password" required></label><p class="vault-error" hidden></p>
   <button class="primary">Desbloquear</button>${bio?`<button type="button" class="vault-bio">${IC.face}Usar Face ID</button>`:''}</form>`);
  const f=body.querySelector('form'),box=f.querySelector('.vault-error');
  f.onsubmit=async e=>{e.preventDefault();box.hidden=true;const b=f.querySelector('.primary');b.disabled=true;b.textContent='Abriendo…';try{await vault.unlock(f.m.value);list()}catch(x){err(box,x)}finally{b.disabled=false;b.textContent='Desbloquear'}};
  const useBio=async()=>{box.hidden=true;try{if(await vault.unlockBio())list()}catch(x){err(box,x)}};
  f.querySelector('.vault-bio')?.addEventListener('click',useBio);if(bio&&auto)useBio()}
 const rows=()=>{const q=view.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');return vault.items.filter(i=>(view.cat==='all'||(view.cat==='fav'?i.favorite:i.category===view.cat))&&(!q||[i.title,i.username,i.url].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(q)))
  .sort((a,b)=>(b.favorite-a.favorite)||a.title.localeCompare(b.title,'es'))};
 const host=u=>{try{return new URL(/^\w+:/.test(u)?u:'https://'+u).hostname.replace(/^www\./,'')}catch{return ''}};
 const tile=i=>`<span class="vault-tile" data-c="${esc(i.category)}">${esc((i.title||'?').trim()[0]?.toUpperCase()||'?')}</span>`;
 function listRows(){const r=rows();return r.length?r.map(i=>`<button type="button" class="vault-row" data-id="${esc(i.id)}">${tile(i)}<span class="vault-copy"><strong>${esc(i.title)}${i.favorite?' <em>★</em>':''}</strong><small>${esc(i.username||host(i.url)||CATEGORIES.find(c=>c[0]===i.category)?.[1]||'')}</small></span></button>`).join('')
  :vault.items.length?`<p class="muted vault-empty">No hay contraseñas con eso.</p>`:`<div class="vault-empty"><span class="vault-hero">${IC.key}</span><strong>Tus contraseñas, en un solo lugar</strong><p class="muted">Se guardan cifradas en este teléfono y solo se abren con tu contraseña maestra o Face ID.</p></div>`}
 function list(){title('Contraseñas');const cats=[['all','Todas'],['fav','Favoritas'],...CATEGORIES.filter(c=>vault.items.some(i=>i.category===c[0]))];
  html(`<div class="vault-list"><div class="vault-top"><label class="vault-search">${IC.search}<input type="search" aria-label="Buscar contraseñas" placeholder="Buscar" value="${esc(view.q)}" autocomplete="off"></label><button type="button" class="vault-round" data-a="settings" aria-label="Opciones">${IC.gear}</button><button type="button" class="vault-round" data-a="lock" aria-label="Bloquear">${IC.lock}</button></div>
   <div class="vault-chips">${cats.map(([k,l])=>`<button type="button" data-cat="${k}" aria-pressed="${view.cat===k}">${l}</button>`).join('')}</div>
   <div class="vault-rows">${listRows()}</div><button type="button" class="primary vault-new" data-a="new">${IC.plus}Nueva contraseña</button></div>`);
  const paint=()=>{body.querySelector('.vault-rows').innerHTML=listRows();bindRows()};
  const bindRows=()=>body.querySelectorAll('.vault-row').forEach(b=>b.onclick=()=>detail(b.dataset.id));bindRows();
  body.querySelector('.vault-search input').oninput=e=>{view.q=e.target.value;paint()};
  body.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{view.cat=b.dataset.cat;list()});
  body.querySelector('[data-a=new]').onclick=()=>edit();body.querySelector('[data-a=lock]').onclick=()=>{vault.lock()};body.querySelector('[data-a=settings]').onclick=settings}
 function detail(id){const i=vault.items.find(x=>x.id===id);if(!i)return list();title(i.title);
  html(`<div class="vault-detail"><button type="button" class="vault-back">${IC.back}Contraseñas</button><div class="vault-head">${tile(i)}<div><strong>${esc(i.title)}</strong><small>${esc(CATEGORIES.find(c=>c[0]===i.category)?.[1]||'')}</small></div></div>
   <div class="vault-fields">${i.username?`<div class="vault-field"><small>Usuario</small><span>${esc(i.username)}</span><button type="button" class="vault-round" data-copy="u" aria-label="Copiar usuario">${IC.copy}</button></div>`:''}
    <div class="vault-field"><small>Contraseña</small><span class="vault-secret" data-shown="false">••••••••••</span><button type="button" class="vault-round" data-a="show" aria-label="Mostrar">${IC.eye}</button><button type="button" class="vault-round" data-copy="p" aria-label="Copiar contraseña">${IC.copy}</button></div>
    ${i.url?`<div class="vault-field"><small>Sitio</small><a href="${esc(/^\w+:/.test(i.url)?i.url:'https://'+i.url)}" target="_blank" rel="noopener noreferrer">${esc(host(i.url)||i.url)}</a></div>`:''}
    ${i.notes?`<div class="vault-field vault-notes"><small>Notas</small><span>${esc(i.notes)}</span></div>`:''}</div>
   <p class="muted vault-when">Actualizada ${esc(new Date(i.updatedAt).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'}))} · ${esc(strength(i.password).label||'sin contraseña')}</p>
   <div class="vault-actions"><button type="button" class="primary" data-a="edit">Editar</button><button type="button" data-a="fav">${i.favorite?'Quitar de favoritas':'Favorita'}</button><button type="button" class="danger" data-a="del">Eliminar</button></div></div>`);
  body.querySelector('.vault-back').onclick=list;
  body.querySelector('[data-copy=p]').onclick=e=>copy(i.password,'Contraseña',e.currentTarget);body.querySelector('[data-copy=u]')?.addEventListener('click',e=>copy(i.username,'Usuario',e.currentTarget));
  body.querySelector('[data-a=show]').onclick=()=>{const s=body.querySelector('.vault-secret'),on=s.dataset.shown!=='true';s.dataset.shown=String(on);s.textContent=on?i.password||'(vacía)':'••••••••••'};
  body.querySelector('[data-a=edit]').onclick=()=>edit(i);body.querySelector('[data-a=fav]').onclick=async()=>{await vault.save({...i,favorite:!i.favorite});detail(i.id)};
  body.querySelector('[data-a=del]').onclick=()=>sheet(`<strong>¿Eliminar «${esc(i.title)}»?</strong><p class="muted">No se puede deshacer.</p><div class="vault-actions"><button type="button" class="danger primary" data-a="yes">Eliminar</button><button type="button" data-a="no">Cancelar</button></div>`,async a=>{if(a==='yes'){await vault.remove(i.id);list()}return true})}
 function edit(i={category:'web'}){title(i.id?'Editar':'Nueva contraseña');
  html(`<form class="vault-form" id="vaultItem"><button type="button" class="vault-back">${IC.back}${i.id?esc(i.title):'Contraseñas'}</button>
   <label>Nombre<input name="title" maxlength="120" required value="${esc(i.title||'')}" placeholder="Netflix, Banco, Wi-Fi de casa…" autocomplete="off"></label>
   <label>Usuario o email<input name="username" maxlength="200" value="${esc(i.username||'')}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
   <label>Contraseña<span class="vault-pass"><input name="password" type="password" maxlength="500" value="${esc(i.password||'')}" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="vault-round" data-a="show" aria-label="Mostrar">${IC.eye}</button><button type="button" class="vault-round" data-a="gen" aria-label="Generar una contraseña">${IC.dice}</button></span></label><div class="vault-meter"><i></i><span></span></div>
   <div class="vault-gen" hidden><label>Largo <b>20</b><input type="range" name="len" min="8" max="40" value="20"></label><label class="vault-check"><input type="checkbox" name="sym" checked> Símbolos</label><label class="vault-check"><input type="checkbox" name="num" checked> Números</label><button type="button" data-a="again">Otra</button></div>
   <label>Sitio<input name="url" maxlength="500" value="${esc(i.url||'')}" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="netflix.com"></label>
   <label>Tipo<select name="category">${CATEGORIES.map(([k,l])=>`<option value="${k}" ${k===i.category?'selected':''}>${l}</option>`).join('')}</select></label>
   <label>Notas<textarea name="notes" rows="3" maxlength="4000">${esc(i.notes||'')}</textarea></label>
   <label class="vault-check"><input type="checkbox" name="favorite" ${i.favorite?'checked':''}> Favorita</label><p class="vault-error" hidden></p>
   <button class="primary">Guardar</button></form>`);
  const f=body.querySelector('form'),gen=f.querySelector('.vault-gen');meter(f.password,body.querySelector('.vault-meter'));
  const make=()=>{f.password.value=generate({length:+f.len.value,symbols:f.sym.checked,numbers:f.num.checked});f.password.type='text';f.password.dispatchEvent(new Event('input'));gen.querySelector('b').textContent=f.len.value};
  f.querySelector('.vault-back').onclick=()=>i.id?detail(i.id):list();
  f.querySelector('[data-a=show]').onclick=()=>{f.password.type=f.password.type==='password'?'text':'password'};
  f.querySelector('[data-a=gen]').onclick=()=>{gen.hidden=false;make()};f.querySelector('[data-a=again]').onclick=make;f.len.oninput=make;f.sym.onchange=make;f.num.onchange=make;
  f.onsubmit=async e=>{e.preventDefault();const box=f.querySelector('.vault-error');box.hidden=true;try{const d=Object.fromEntries(new FormData(f));const id=await vault.save({...i,...d,favorite:d.favorite==='on'});detail(id)}catch(x){err(box,x)}}}
 async function settings(){title('Opciones');const sup=await vault.bioSupported(),bio=await vault.bioConfigured();
  html(`<div class="vault-form vault-settings"><button type="button" class="vault-back">${IC.back}Contraseñas</button>
   ${sup?`<p class="vault-caption">Desbloqueo</p><div class="vault-group"><label class="vault-setting vault-toggle"><span><strong>Face ID</strong><small>${bio?'Desbloqueás sin escribir la contraseña maestra.':'Desbloqueá la bóveda con tu cara.'}</small></span><input type="checkbox" role="switch" data-a="bio" ${bio?'checked':''} aria-label="Face ID"></label></div>`:''}
   <p class="vault-caption">Contraseña maestra</p><form class="vault-group vault-form" id="vaultMaster"><label>Actual<input name="cur" type="password" autocomplete="current-password" required></label><label>Nueva<input name="next" type="password" autocomplete="new-password" minlength="8" required placeholder="Al menos 8 caracteres"></label><div class="vault-meter"><i></i><span></span></div><p class="vault-error" hidden></p><button class="primary">Cambiar contraseña maestra</button></form>
   <p class="vault-caption">Copia de seguridad</p><div class="vault-group"><p class="vault-note">Un archivo cifrado con tu contraseña maestra, para pasar tus contraseñas a otro teléfono.</p><span class="vault-two"><button type="button" data-a="export">${IC.up}Exportar</button><label class="vault-file">${IC.down}Importar<input type="file" accept="application/json,.json"></label></span></div></div>`);
  body.querySelector('.vault-back').onclick=list;
  const m=body.querySelector('#vaultMaster');meter(m.next,m.querySelector('.vault-meter'));
  m.onsubmit=async e=>{e.preventDefault();const box=m.querySelector('.vault-error');box.hidden=true;try{await vault.changeMaster(m.cur.value,m.next.value);notify?.('Contraseña maestra cambiada'+(bio?'. Volvé a activar Face ID.':''));settings()}catch(x){err(box,x)}};
  body.querySelector('[data-a=bio]')?.addEventListener('change',async e=>{e.target.checked=bio;if(bio){await vault.disableBio();return settings()}
   sheet(`<strong>Activar Face ID</strong><label>Contraseña maestra<input name="m" type="password" autocomplete="current-password"></label><p class="vault-error" hidden></p><div class="vault-actions"><button type="button" class="primary" data-a="yes">Activar</button><button type="button" data-a="no">Cancelar</button></div>`,async(a,box)=>{if(a!=='yes')return true;
    try{await vault.enableBio(box.querySelector('[name=m]').value);notify?.('Face ID activado');settings();return true}catch(x){err(box.querySelector('.vault-error'),x);return false}})});
  body.querySelector('[data-a=export]').onclick=async()=>{const blob=new Blob([await vault.exportBackup()],{type:'application/json'}),file=new File([blob],`contraseñas-nubo-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});
   try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Copia cifrada de tus contraseñas'});else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click()}}catch(x){if(x?.name!=='AbortError')notify?.('No se pudo exportar.')}};
  body.querySelector('.vault-file input').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;
   sheet(`<strong>Importar copia</strong><p class="muted">Escribí la contraseña maestra con la que se hizo esa copia.</p><label>Contraseña maestra de la copia<input name="m" type="password"></label><p class="vault-error" hidden></p><div class="vault-actions"><button type="button" class="primary" data-a="yes">Importar</button><button type="button" data-a="no">Cancelar</button></div>`,async(a,box)=>{if(a!=='yes')return true;
    try{const n=await vault.importBackup(await file.text(),box.querySelector('[name=m]').value);notify?.(n+(n===1?' contraseña importada':' contraseñas importadas'));list();return true}catch(x){err(box.querySelector('.vault-error'),x);return false}})}}
 // a small sheet over the current screen
 function sheet(content,onAnswer){const s=document.createElement('div');s.className='vault-sheet';s.innerHTML=`<div class="vault-sheet-card">${content}</div>`;body.append(s);s.querySelector('input')?.focus();
  s.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b&&e.target!==s)return;const close=await onAnswer(b?.dataset.a||'no',s);if(close!==false)s.remove()})}
 return {open:openVault,vault};
}
