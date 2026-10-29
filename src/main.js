import {createMobileNav} from './mobile-nav.js';
import {installViewport} from './viewport.js';
import {installTouchGuard} from './touch-guard.js';
import {framesToRelease} from './frame-pool.js';
import {buildSearchIndex,search,aiContext} from './search.js';
import names from './brand.json';
import {createMobile} from './mobile.js';
import './style.css';

import {createIsland} from './island.js';

import {SHORTCUTS,shortcutFromHash} from './shortcuts.js';

import {Vault,MODULE_KEYS} from './storage.js';

import {CloudSync} from './cloud.js';

const MODULES=__MODULES__,CONFIG=__CONFIG__;

const workspace=document.getElementById('workspace'),loading=document.getElementById('loading'),dialog=document.getElementById('account'),body=document.getElementById('accountBody');

const initialShortcut=shortcutFromHash(location.hash);
const activities=new Map();
function updateActivity(value,source='organizador'){if(value)activities.set(source,value);else activities.delete(source);island.activity([...activities.values()].sort((a,b)=>(b.priority||0)-(a.priority||0))[0]||null)}

// While the island's drop falls or rises, the status bar band turns island-black so the drop looks attached to the real island.
let statusHold=false,statusColor=null;const themeMeta=()=>document.querySelector('meta[name=theme-color]');
// iOS reads theme-color only when the app returns to the foreground, so a temporary colour stays stuck: never change it live.
function holdStatusBar(){}
const island=createIsland({statusBar:holdStatusBar,navigate:async(id,view)=>{routes.set(id,{...stateFor(id),view});await openApp(id);frames.get(id)?.contentWindow.ecosystemRestore?.(stateFor(id))}});

const authReturn=/(?:[?#&])(?:access_token|refresh_token|code|error_description)=/.test(location.href);let authPending=authReturn;

let current=null,index=0,transition=0,frameEpoch=0,noticeTimer;const frames=new Map(),jobs=new Map(),routes=new Map();

function notice(text){const el=document.getElementById('notice');el.textContent=text;el.hidden=false;island.suspend('root-notice',true);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.hidden=true;island.suspend('root-notice',false)},5000)}

const vault=new Vault(localStorage,(key)=>cloud.changed(key));vault.importLegacy();

function resetFrames(){mobileNav.hide();activities.clear();island.clear();frameEpoch++;for(const frame of frames.values()){frame.contentWindow.ecosystemDeactivate?.();frame.remove()}frames.clear();jobs.clear();transition++;if(current)openApp(current,{record:false})}

let previousCloudStatus='';
const cloud=new CloudSync(vault,CONFIG,{status(text){previousCloudStatus=text;/* syncing is silent; problems show in Cuenta */if(dialog.open&&dialog.dataset.view==="account")paintAccount()},owner:resetFrames,reload:resetFrames});

const mobile=createMobile({cloud,config:CONFIG,dialog,body,vault});
setTimeout(()=>mobile.heal(),8000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)mobile.heal()});
// Switching apps always lands on that app's home (its first screen), not where you left it.
async function openHome(id){routes.delete(id);const kept=frames.has(id);await openApp(id);if(kept&&current===id)frames.get(id)?.contentWindow.ecosystemRestore?.(stateFor(id))}
const mobileNav=createMobileNav({names,current:()=>current,switchApp:id=>openHome(id)});
// Each module gets the visible area in its own coordinates, so its windows can sit right above the keyboard.
const frameViewport=(frame,value)=>({...value,top:Math.round((value.offset||0)-(frame.getBoundingClientRect?.().top||0))});
const viewport=installViewport({onChange:value=>{for(const frame of frames.values())frame.contentWindow.ecosystemViewport?.(frameViewport(frame,value))}});
// iOS scrolls even an overflow:hidden page to reveal a focused field; the shell never scrolls, so undo it.
addEventListener('scroll',()=>{if(scrollX||scrollY)scrollTo(0,0)},{passive:true});

function parseURL(){const match=location.hash.match(/^#\/([^/?]+)(?:\/([^/?]+))?/);const path=location.pathname.replace(/^\//,'').replace(/\.html$/,'');const id=match?.[1]||path;return {id:MODULES[id]?id:'centro',view:match?.[2]||(!authReturn&&location.hash&&!location.hash.startsWith('#/')?location.hash.slice(1):null)}}

function stateFor(id){return routes.get(id)||{ecosystemRoute:true,app:id,view:id==='centro'?'home':id==='iris'?'summary':'dashboard',index:0}}

function recordRoute(id,route,replace=false){routes.set(id,route);if(id!==current||authPending)return;const state={ecosystemRoot:true,id,route,index:replace?index:++index};history[replace?'replaceState':'pushState'](state,'','/#/'+id+'/'+encodeURIComponent(route.view||'dashboard'))}

function moduleFromURL(url){const host=url.hostname;if(![location.hostname,'apps-personales-augus.spunkyghost17.chatgpt.site','centro-035-augus.spunkyghost17.chatgpt.site'].includes(host))return null;if(host.startsWith('centro-035-'))return 'centro';const path=url.pathname.replace(/^\//,'').replace(/\.html$/,'');return MODULES[path]?path:path==='index'||!path?'centro':null}

function prepareApp(id){if(!MODULES[id]||frames.has(id)||jobs.has(id))return;for(const [href,as]of [[MODULES[id].css,'style'],[MODULES[id].js,'script']]){if(document.querySelector('link[data-preload="'+href+'"]'))continue;const link=document.createElement('link');link.rel='preload';link.as=as;link.href=href;link.dataset.preload=href;document.head.append(link)}jobs.set(id,loadModule(id));jobs.get(id).catch(()=>jobs.delete(id))}

async function loadModule(id){const response=await fetch(MODULES[id].entry,{cache:'force-cache'});if(!response.ok)throw Error('No se pudo cargar '+names[id]);const template=await response.json();return template}

async function ensureFrame(id){const epoch=frameEpoch;if(frames.has(id))return frames.get(id);prepareApp(id);const template=await jobs.get(id);if(epoch!==frameEpoch)throw Error('La sesión cambió.');if(frames.has(id))return frames.get(id);const frame=document.createElement('iframe');frame.className='module';frame.title=names[id];frame.dataset.module=id;frame.hidden=true;frame.setAttribute('allow','fullscreen; autoplay; microphone');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');frames.set(id,frame);frame._ready=new Promise((resolve,reject)=>{frame._resolve=resolve;frame._reject=reject;frame._timeout=setTimeout(()=>reject(Error('No se pudo iniciar '+names[id])),20000)});frame.srcdoc=template.html;workspace.append(frame);await frame._ready;return frame}

async function openApp(id,{record=true}={}){if(!MODULES[id])return;const ticket=++transition,wasReady=frames.has(id);if(current!==id){frames.get(current)?.contentWindow.ecosystemDeactivate?.();if(current)lastUsed.set(current,Date.now())}current=id;lastUsed.set(id,Date.now());try{const saved=JSON.parse(vault.getItem(MODULE_KEYS[id])||'{}'),dark=saved.theme==='dark';window.EcosystemHost.theme(id,{dark,panel:dark?'#303845':'#fffdfa',bg:dark?'#222933':'#F3F0EA'})}catch{}if(record)recordRoute(id,stateFor(id));loading.hidden=true;try{const frame=await ensureFrame(id);if(ticket!==transition)return;for(const [key,other]of frames){other.hidden=key!==id;other.inert=key!==id}loading.hidden=true;frame.contentWindow.ecosystemReportTheme?.();frame.contentWindow.ecosystemReportOverlay?.();frame.contentWindow.ecosystemReportNavigation?.();document.title=names[id]+' · Nubo';frame.contentWindow.focus();}catch(error){if(ticket!==transition)return;loading.hidden=true;notice(error.message+' · Tocá para reintentar.');loading.innerHTML='<button id="retry">Reintentar abrir '+names[id]+'</button>';loading.hidden=false;document.getElementById('retry').onclick=()=>{frames.get(id)?.remove();frames.delete(id);jobs.delete(id);openApp(id,{record:false})}}}

// Unload apps that stayed hidden for a while (not the Pomodoro or a kitchen timer in progress).
const lastUsed=new Map();
function releaseIdleFrames(){for(const id of framesToRelease({ids:[...frames.keys()],current,lastUsed,activities})){const frame=frames.get(id);try{frame.contentWindow.ecosystemDeactivate?.()}catch{}frame.remove();frames.delete(id);lastUsed.delete(id)}}
setInterval(releaseIdleFrames,60000);
// Ecosystem search: an index of every app's saved data, rebuilt when something is saved (or after 5 s).
let searchCache=null;
function searchIndex(){if(!searchCache||Date.now()-searchCache.at>5000)searchCache={at:Date.now(),entries:buildSearchIndex(k=>vault.getItem(k))};return searchCache.entries}
const IRIS_FORMS={expenses:'expenseForm',incomes:'incomeForm',accounts:'accountForm',transfers:'transferForm',cards:'cardForm',cardPurchases:'cardPurchaseForm',services:'irisServiceForm',loans:'loanForm',goals:'goalForm'};
async function openResult(entry){
 if(!entry||!MODULES[entry.app])return;await openApp(entry.app);const w=frames.get(entry.app)?.contentWindow;if(!w)return;
 try{if(entry.view&&typeof w.go==='function')w.go(entry.view);if(entry.app==='iris')w[IRIS_FORMS[entry.kind]]?.(entry.id);else w.openRecord?.(entry.kind,entry.id)}catch(e){notice('No se pudo abrir: '+e.message)}
}
installTouchGuard(document);
// Digitize (camera → text on the phone → review → save in its app). Loaded the first time it is opened.
let scanner=null;
// AI (Claude through /api/ai): only with your nubo account signed in; the key never reaches the phone.
const localDay=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
async function aiToken(){
 if(!navigator.onLine)throw Error('Necesitás conexión para usar la IA.');
 if(!cloud.client)throw Error('Conectá tu cuenta de nubo para usar la IA.');
 const {data}=await cloud.client.auth.getSession();const token=data?.session?.access_token;if(!token)throw Error('Iniciá sesión en nubo para usar la IA.');return token;
}
// a request that never answers would leave the screen waiting: give up after 60 s
async function aiFetch(body,type){const token=await aiToken(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{const response=await fetch('/api/ai',{method:'POST',signal:controller.signal,headers:{'content-type':type,authorization:'Bearer '+token},body});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||'La IA no respondió.');return result}
 catch(e){if(e.name==='AbortError')throw Error('La IA tardó demasiado. Probá de nuevo.');throw e}finally{clearTimeout(timer)}}
const ai=payload=>aiFetch(JSON.stringify({...payload,today:localDay()}),'application/json');
// speech to text: one piece of a recording (≤ 4 MB) at a time
const aiAudio=blob=>aiFetch(blob,(blob.type||'audio/mp4').split(';')[0]);
async function aiAsk(question){
 const entries=aiContext(searchIndex(),question);
 const r=await ai({task:'ask',question,items:entries.map(e=>({app:e.appName,kind:e.label,title:e.title,subtitle:e.subtitle,amount:e.amount,currency:e.currency}))});
 return {answer:r.answer,results:r.refs.map(i=>entries[i]).filter(Boolean)};
}
// Tasks made elsewhere (lecta's AI) land in foco.
async function addTasks(list){const w=(await ensureFrame('organizador')).contentWindow;if(typeof w.ecosystemImport!=='function')throw Error('No se pudo abrir foco.');
 return list.map(t=>w.ecosystemImport('tasks',{title:String(t.title).slice(0,240),description:t.description||'',date:t.date||localDay(),priority:t.priority||'Media',done:false,subtasks:[]}))}
let passwords=null;
async function openPasswords(){try{if(!passwords){const {createVaultScreens}=await import('./vault.js');passwords=createVaultScreens({dialog,body,notify:message=>island.notify({title:'Contraseñas',message})})}await passwords.open()}catch(e){notice('No se pudo abrir Contraseñas: '+e.message)}}
async function openScanner(options){try{if(!scanner){const {createScanner}=await import('./scan.js');scanner=createScanner({dialog,body,ensureFrame,openResult,notify:()=>{}})}scanner.open(options)}catch(e){notice('No se pudo abrir el digitalizador: '+e.message)}}
// A Mercado Pago receipt (screenshot or shared image) read on the phone: the image never leaves it.
async function readReceipt(blob,onProgress){
 if(!blob||typeof blob.arrayBuffer!=='function'||!/^image\//.test(blob.type||'image/'))throw Error('Elegí una imagen del comprobante.');
 const [{readPages},{parseReceipt}]=await Promise.all([import('./scan.js'),import('./scan-parse.js')]);
 const bmp=await createImageBitmap(blob),k=Math.min(1,1800/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
 const ctx=c.getContext('2d');ctx.drawImage(bmp,0,0,c.width,c.height);bmp.close?.();
 // dark-mode screenshots: light text on black reads better inverted
 const img=ctx.getImageData(0,0,c.width,c.height),d=img.data;let sum=0;for(let i=0;i<d.length;i+=16)sum+=(d[i]*.3+d[i+1]*.59+d[i+2]*.11);
 if(sum/(d.length/16)<110){for(let i=0;i<d.length;i+=4){d[i]=255-d[i];d[i+1]=255-d[i+1];d[i+2]=255-d[i+2]}ctx.putImageData(img,0,0)}
 const text=await readPages([c],onProgress);const r=parseReceipt(text);
 if(!r.amount)throw Error('No encontré el monto en la imagen. Probá con una captura del comprobante completo.');
 return {...r,text};
}
window.EcosystemHost={guard:doc=>installTouchGuard(doc),cloud:()=>({client:cloud.client,user:cloud.user}),readReceipt,openScanner,openPasswords,act:async(app,action)=>{await openApp(app);frames.get(app)?.contentWindow.ecosystemAction?.(action)},ai,aiAsk,aiAudio,addTasks,scanURL:async key=>(await import('./scan-store.js')).scanURL(key),
 putMedia:async blob=>(await import('./scan-store.js')).putScan(blob,'media'),getMedia:async key=>(await import('./scan-store.js')).getMedia(key),removeMedia:async key=>(await import('./scan-store.js')).removeMedia(key),search:(query,limit)=>search(searchIndex(),query,limit),openResult,theme(id,colors){if(current!==id)return;document.documentElement.style.setProperty('--edge',colors.panel);document.documentElement.style.background=colors.panel;document.documentElement.style.setProperty('--surface',colors.bg);document.documentElement.style.colorScheme=colors.dark?'dark':'light';document.documentElement.dataset.theme=colors.dark?'dark':'light';localStorage.setItem('nubo-shell-theme',colors.dark?'dark':'light');if(statusHold)statusColor=colors.panel;else themeMeta().content=colors.panel},notify(id,text){island.notify({title:names[id],message:text,accent:{centro:'#e1dace',iris:'#b9ccdf','mi-espacio':'#afd4bd',journal:'#d0bedf',organizador:'#D1AF83'}[id]})},activity:updateActivity,overlay(id,blocked){if(id===current){island.suspend("module-overlay",blocked);document.documentElement.dataset.moduleOverlay=blocked?"open":"closed"}},navigation:(id,source)=>mobileNav.sync(id,source),openMobile:()=>mobile.open(),timer:value=>mobile.timer(value),openShortcuts,owner:()=>vault.owner,getItem:key=>vault.getItem(key),setItem:(key,value)=>{searchCache=null;return vault.setItem(key,value)},removeItem:key=>{searchCache=null;return vault.removeItem(key)},keys:()=>vault.keys(),initialRoute:stateFor,moduleFromURL,switchApp:id=>openHome(id),prepareApp,back:()=>{if(index>0)history.back();else if(current!=='centro')openApp('centro')},route:(id,route,replace)=>recordRoute(id,route,replace||!history.state?.ecosystemRoot),ready(id){const frame=frames.get(id);if(frame){frame.contentWindow.ecosystemViewport?.(frameViewport(frame,viewport.current()));clearTimeout(frame._timeout);frame._resolve()}},moduleError(id,message){console.error('Error en '+id+': '+message)},openAccount};

window.addEventListener('popstate',event=>{if(!event.state?.ecosystemRoot)return;index=event.state.index;routes.set(event.state.id,event.state.route);openApp(event.state.id,{record:false}).then(()=>frames.get(event.state.id)?.contentWindow.ecosystemRestore?.(event.state.route))});

async function refreshCloud(){await cloud.flush();if(dialog.open||[...frames.values()].some(f=>f.contentDocument?.querySelector('dialog[open],#focusStage')))return;await cloud.refresh()}
window.addEventListener('online',refreshCloud);window.addEventListener('focus',refreshCloud);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCloud()});

function downloadBackup(){const url=URL.createObjectURL(new Blob([JSON.stringify(vault.export(),null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='ecosistema-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

function action(label,callback,primary=false){const b=document.createElement('button');b.textContent=label;b.classList.toggle('primary',primary);b.onclick=async()=>{b.disabled=true;try{await callback()}catch(e){notice(e.message)}finally{b.disabled=false}};return b}

function p(text,cls=''){const e=document.createElement('p');e.textContent=text;e.className=cls;return e}

function paintAccount(){if(body.querySelector('form')?.contains(document.activeElement))return;body.replaceChildren(p(cloud.status,'status'));if(!CONFIG.url||!CONFIG.key)body.append(p('La conexión con Supabase todavía no está configurada. Podés trabajar y guardar una copia mientras tanto.','muted'));else if(cloud.user){body.append(p(cloud.user.email||'Sesión iniciada'),action('Sincronizar ahora',async()=>{await cloud.flush();await cloud.refresh()}),action('Cerrar sesión',async()=>{await mobile.detach();const {error}=await cloud.client.auth.signOut();if(error)throw error}));for(const [id]of cloud.conflicts){const box=document.createElement('section');box.append(p(names[id]+': hay dos versiones. Descargá una copia antes de elegir.'),action('Conservar la de este dispositivo',()=>cloud.resolve(id,'local')),action('Usar la versión de la nube',()=>cloud.resolve(id,'remote')));body.append(box)}body.append(action('Importar mis datos previos de este dispositivo',async()=>{const guest=new Vault(localStorage),data=guest.export();vault.validateBackup(data);if(!confirm('Se reemplazarán los espacios incluidos por tu copia local previa. ¿Continuar?'))return;downloadBackup();vault.import(data);resetFrames();await cloud.flush()}));}else{const form=document.createElement('form');form.innerHTML='<label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><button class="primary" type="submit">Entrar</button>';form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{const {error}=await cloud.client.auth.signInWithPassword({email:form.elements.email.value,password:form.elements.password.value});if(error)throw Error('No se pudo entrar. Revisá el correo y la contraseña.')}catch(error){notice(error.message)}finally{submit.disabled=false}};body.append(form,action('Crear una cuenta',async()=>{if(!form.reportValidity())return;const {error}=await cloud.client.auth.signUp({email:form.elements.email.value,password:form.elements.password.value,options:{emailRedirectTo:location.origin+'/'} });if(error)throw Error('No se pudo crear la cuenta. Reintentá en un momento.');notice('Revisá tu correo para confirmar la cuenta, si se solicita.')}));}

 body.append(document.createElement('hr'),action('Descargar copia de todos mis espacios',downloadBackup));if(diagnostics){const d=document.createElement('details'),sm=document.createElement('summary'),pre=document.createElement('pre');sm.textContent='Medidas de pantalla (diagnóstico)';const m=viewport.metrics();pre.style.cssText='white-space:pre-wrap;font:12px/1.5 monospace;margin:8px 0 0';pre.textContent='Pantalla '+m.screen+' · DPR '+m.dpr+'\nVentana (innerHeight) '+m.layout+'\nVisible '+m.visible+' · desplazamiento '+m.offset+'\nSafe area ↑'+m.insetTop+' ↓'+m.insetBottom+'\nDespeje aplicado abajo '+m.clearance+'\nBarra Y '+m.nav+'\nApp instalada '+(m.standalone?'sí':'no')+'\nVersión: 12';d.append(sm,pre);body.append(d)}const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.onchange=async()=>{try{const selected=file.files[0];if(!selected)return;if(selected.size>20_000_000)throw Error('La copia es demasiado grande.');const data=JSON.parse(await selected.text());vault.validateBackup(data);if(!confirm('Se reemplazarán los espacios incluidos en la copia. Primero se descargará tu estado actual. ¿Continuar?'))return;downloadBackup();vault.import(data);resetFrames();notice('Copia importada.');cloud.flush()}catch(e){notice(e.message)}};body.append(action('Importar una copia',()=>file.click()),file,p('Tus datos locales están separados por cuenta. Al cambiar de servidor, importá una copia para llevarlos con vos.','muted'));}

function openShortcuts(){dialog.querySelector("h2").textContent="Atajos de iPhone";dialog.dataset.view="shortcuts";body.replaceChildren(p('En Atajos de iPhone, agregá la acción Abrir URL y pegá uno de estos enlaces. Abren el formulario; vos revisás y guardás el registro.'));for(const [key,item]of Object.entries(SHORTCUTS)){const label=document.createElement('label');label.textContent=item.label;const input=document.createElement('input');input.readOnly=true;input.value=location.origin+'/#/'+item.app+'/'+item.view+'?action='+key;label.append(input);body.append(label,action('Copiar enlace de '+item.label.toLowerCase(),async()=>{await navigator.clipboard.writeText(input.value);notice('Enlace copiado')}))}body.append(p('Los avisos animados funcionan con la app abierta. Las notificaciones con la app cerrada y la isla dinámica del sistema requieren una conexión adicional.','muted'));dialog.showModal()}

// Hidden screen measurements: tap the window title 5 times within 3 s to show them (until the app restarts).
let diagnostics=false,titleTaps=[];
dialog.querySelector('h2').addEventListener('click',()=>{if(dialog.dataset.view!=='account')return;const now=Date.now();titleTaps=[...titleTaps.filter(t=>now-t<3000),now];if(titleTaps.length>=5&&!diagnostics){diagnostics=true;titleTaps=[];paintAccount()}});
function openAccount(){dialog.querySelector("h2").textContent="Tu cuenta y tus datos";dialog.dataset.view="account";paintAccount();dialog.showModal()}

document.getElementById('closeAccount').onclick=()=>dialog.close();
new MutationObserver(()=>island.suspend('account',dialog.open)).observe(dialog,{attributes:true,attributeFilter:['open']});
document.addEventListener('visibilitychange',()=>island.suspend('background',document.hidden));

const initial=parseURL();if(initial.view)routes.set(initial.id,{...stateFor(initial.id),view:decodeURIComponent(initial.view)});current=initial.id;recordRoute(current,stateFor(current),true);openApp(current,{record:false}).then(()=>{if(initialShortcut){routes.set(initialShortcut.app,{...stateFor(initialShortcut.app),view:initialShortcut.view});openApp(initialShortcut.app,{record:false}).then(()=>frames.get(initialShortcut.app)?.contentWindow.ecosystemAction?.(initialShortcut.action))}});cloud.init().finally(()=>{authPending=false;if(authReturn)recordRoute(current,stateFor(current),true)});

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));


window.addEventListener('hashchange',async()=>{if(authPending||history.state?.ecosystemRoot)return;const shortcut=shortcutFromHash(location.hash),target=shortcut||parseURL();if(!target.id&&!shortcut)return;const id=shortcut?.app||target.id;if(target.view)routes.set(id,{...stateFor(id),view:target.view});const pending=openApp(id,{record:false});recordRoute(id,stateFor(id),true);await pending;frames.get(id)?.contentWindow.ecosystemRestore?.(stateFor(id));if(shortcut)frames.get(id)?.contentWindow.ecosystemAction?.(shortcut.action)});

setInterval(()=>{
 try{const s=JSON.parse(vault.getItem(MODULE_KEYS.organizador)||'{}'),now=Date.now();const event=(s.records?.events||[]).filter(e=>e.date&&e.time).map(e=>({...e,at:Date.parse(e.date+'T'+e.time+':00-03:00')})).filter(e=>e.at>=now&&e.at-now<=900000).sort((a,b)=>a.at-b.at)[0];
 updateActivity(event?{id:'event:'+event.id,title:'En '+Math.ceil((event.at-now)/60000)+' min',message:event.title,app:'organizador',view:'events',priority:-1}:null,'event');}catch{}
},15000);



// Fetch the other spaces after startup without executing their timers or side effects.
const preloadSpaces=()=>{for(const id of Object.keys(MODULES))prepareApp(id)};
if('requestIdleCallback' in window)requestIdleCallback(preloadSpaces,{timeout:2500});else setTimeout(preloadSpaces,1500);
