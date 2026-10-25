import {createMobileNav} from './mobile-nav.js';
import {installViewport} from './viewport.js';
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

const island=createIsland({navigate:async(id,view)=>{routes.set(id,{...stateFor(id),view});await openApp(id);frames.get(id)?.contentWindow.ecosystemRestore?.(stateFor(id))}});

const authReturn=/(?:[?#&])(?:access_token|refresh_token|code|error_description)=/.test(location.href);let authPending=authReturn;

let current=null,index=0,transition=0,frameEpoch=0,noticeTimer;const frames=new Map(),jobs=new Map(),routes=new Map();

function notice(text){const el=document.getElementById('notice');el.textContent=text;el.hidden=false;island.suspend('root-notice',true);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.hidden=true;island.suspend('root-notice',false)},5000)}

const vault=new Vault(localStorage,(key)=>cloud.changed(key));vault.importLegacy();

function resetFrames(){mobileNav.hide();activities.clear();island.clear();frameEpoch++;for(const frame of frames.values()){frame.contentWindow.ecosystemDeactivate?.();frame.remove()}frames.clear();jobs.clear();transition++;if(current)openApp(current,{record:false})}

let previousCloudStatus='';
const cloud=new CloudSync(vault,CONFIG,{status(text){if(previousCloudStatus.includes('pendiente')&&text==='Todo sincronizado')island.notify({key:'cloud-saved',title:'Sincronizado',message:'Tus cambios están guardados en la nube.'});previousCloudStatus=text;if(dialog.open&&dialog.dataset.view==="account")paintAccount()},owner:resetFrames,reload:resetFrames});

const mobile=createMobile({cloud,config:CONFIG,dialog,body,vault});
const mobileNav=createMobileNav({names,current:()=>current,switchApp:id=>openApp(id)});
const viewport=installViewport({onChange:value=>{for(const frame of frames.values())frame.contentWindow.ecosystemViewport?.(value)}});

function parseURL(){const match=location.hash.match(/^#\/([^/?]+)(?:\/([^/?]+))?/);const path=location.pathname.replace(/^\//,'').replace(/\.html$/,'');const id=match?.[1]||path;return {id:MODULES[id]?id:'centro',view:match?.[2]||(!authReturn&&location.hash&&!location.hash.startsWith('#/')?location.hash.slice(1):null)}}

function stateFor(id){return routes.get(id)||{ecosystemRoute:true,app:id,view:id==='centro'?'home':id==='iris'?'summary':'dashboard',index:0}}

function recordRoute(id,route,replace=false){routes.set(id,route);if(id!==current||authPending)return;const state={ecosystemRoot:true,id,route,index:replace?index:++index};history[replace?'replaceState':'pushState'](state,'','/#/'+id+'/'+encodeURIComponent(route.view||'dashboard'))}

function moduleFromURL(url){const host=url.hostname;if(![location.hostname,'apps-personales-augus.spunkyghost17.chatgpt.site','centro-035-augus.spunkyghost17.chatgpt.site'].includes(host))return null;if(host.startsWith('centro-035-'))return 'centro';const path=url.pathname.replace(/^\//,'').replace(/\.html$/,'');return MODULES[path]?path:path==='index'||!path?'centro':null}

function prepareApp(id){if(!MODULES[id]||frames.has(id)||jobs.has(id))return;for(const [href,as]of [[MODULES[id].css,'style'],[MODULES[id].js,'script']]){if(document.querySelector('link[data-preload="'+href+'"]'))continue;const link=document.createElement('link');link.rel='preload';link.as=as;link.href=href;link.dataset.preload=href;document.head.append(link)}jobs.set(id,loadModule(id));jobs.get(id).catch(()=>jobs.delete(id))}

async function loadModule(id){const response=await fetch(MODULES[id].entry,{cache:'force-cache'});if(!response.ok)throw Error('No se pudo cargar '+names[id]);const template=await response.json();return template}

async function ensureFrame(id){const epoch=frameEpoch;if(frames.has(id))return frames.get(id);prepareApp(id);const template=await jobs.get(id);if(epoch!==frameEpoch)throw Error('La sesión cambió.');if(frames.has(id))return frames.get(id);const frame=document.createElement('iframe');frame.className='module';frame.title=names[id];frame.dataset.module=id;frame.hidden=true;frame.setAttribute('allow','fullscreen; autoplay; microphone');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');frames.set(id,frame);frame._ready=new Promise((resolve,reject)=>{frame._resolve=resolve;frame._reject=reject;frame._timeout=setTimeout(()=>reject(Error('No se pudo iniciar '+names[id])),20000)});frame.srcdoc=template.html;workspace.append(frame);await frame._ready;return frame}

async function openApp(id,{record=true}={}){if(!MODULES[id])return;const ticket=++transition,wasReady=frames.has(id);if(current!==id)frames.get(current)?.contentWindow.ecosystemDeactivate?.();current=id;try{const saved=JSON.parse(vault.getItem(MODULE_KEYS[id])||'{}'),dark=saved.theme==='dark';window.EcosystemHost.theme(id,{dark,panel:dark?'#303845':'#fffdfa',bg:dark?'#222933':'#F3F0EA'})}catch{}if(record)recordRoute(id,stateFor(id));loading.hidden=true;try{const frame=await ensureFrame(id);if(ticket!==transition)return;for(const [key,other]of frames){other.hidden=key!==id;other.inert=key!==id}loading.hidden=true;frame.contentWindow.ecosystemReportTheme?.();frame.contentWindow.ecosystemReportOverlay?.();frame.contentWindow.ecosystemReportNavigation?.();document.title=names[id]+' · Nubo';frame.contentWindow.focus();}catch(error){if(ticket!==transition)return;loading.hidden=true;notice(error.message+' · Tocá para reintentar.');loading.innerHTML='<button id="retry">Reintentar abrir '+names[id]+'</button>';loading.hidden=false;document.getElementById('retry').onclick=()=>{frames.get(id)?.remove();frames.delete(id);jobs.delete(id);openApp(id,{record:false})}}}

window.EcosystemHost={theme(id,colors){if(current!==id)return;document.documentElement.style.setProperty('--edge',colors.panel);document.documentElement.style.background=colors.panel;document.documentElement.style.setProperty('--surface',colors.bg);document.documentElement.style.colorScheme=colors.dark?'dark':'light';document.documentElement.dataset.theme=colors.dark?'dark':'light';localStorage.setItem('nubo-shell-theme',colors.dark?'dark':'light');document.querySelector('meta[name=theme-color]').content=colors.panel},notify(id,text){island.notify({title:names[id],message:text})},activity:updateActivity,overlay(id,blocked){if(id===current){island.suspend("module-overlay",blocked);document.documentElement.dataset.moduleOverlay=blocked?"open":"closed"}},navigation:(id,source)=>mobileNav.sync(id,source),openMobile:()=>mobile.open(),timer:value=>mobile.timer(value),openShortcuts,owner:()=>vault.owner,getItem:key=>vault.getItem(key),setItem:(key,value)=>vault.setItem(key,value),removeItem:key=>vault.removeItem(key),keys:()=>vault.keys(),initialRoute:stateFor,moduleFromURL,switchApp:id=>openApp(id),prepareApp,back:()=>{if(index>0)history.back();else if(current!=='centro')openApp('centro')},route:(id,route,replace)=>recordRoute(id,route,replace||!history.state?.ecosystemRoot),ready(id){const frame=frames.get(id);if(frame){frame.contentWindow.ecosystemViewport?.(viewport.current());clearTimeout(frame._timeout);frame._resolve()}},moduleError(id,message){console.error('Error en '+id+': '+message)},openAccount};

window.addEventListener('popstate',event=>{if(!event.state?.ecosystemRoot)return;index=event.state.index;routes.set(event.state.id,event.state.route);openApp(event.state.id,{record:false}).then(()=>frames.get(event.state.id)?.contentWindow.ecosystemRestore?.(event.state.route))});

async function refreshCloud(){await cloud.flush();if(dialog.open||[...frames.values()].some(f=>f.contentDocument?.querySelector('dialog[open],#focusStage')))return;await cloud.refresh()}
window.addEventListener('online',refreshCloud);window.addEventListener('focus',refreshCloud);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCloud()});

function downloadBackup(){const url=URL.createObjectURL(new Blob([JSON.stringify(vault.export(),null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='ecosistema-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

function action(label,callback,primary=false){const b=document.createElement('button');b.textContent=label;b.classList.toggle('primary',primary);b.onclick=async()=>{b.disabled=true;try{await callback()}catch(e){notice(e.message)}finally{b.disabled=false}};return b}

function p(text,cls=''){const e=document.createElement('p');e.textContent=text;e.className=cls;return e}

function paintAccount(){if(body.querySelector('form')?.contains(document.activeElement))return;body.replaceChildren(p(cloud.status,'status'));if(!CONFIG.url||!CONFIG.key)body.append(p('La conexión con Supabase todavía no está configurada. Podés trabajar y guardar una copia mientras tanto.','muted'));else if(cloud.user){body.append(p(cloud.user.email||'Sesión iniciada'),action('Sincronizar ahora',async()=>{await cloud.flush();await cloud.refresh()}),action('Cerrar sesión',async()=>{await mobile.detach();const {error}=await cloud.client.auth.signOut();if(error)throw error}));for(const [id]of cloud.conflicts){const box=document.createElement('section');box.append(p(names[id]+': hay dos versiones. Descargá una copia antes de elegir.'),action('Conservar la de este dispositivo',()=>cloud.resolve(id,'local')),action('Usar la versión de la nube',()=>cloud.resolve(id,'remote')));body.append(box)}body.append(action('Importar mis datos previos de este dispositivo',async()=>{const guest=new Vault(localStorage),data=guest.export();vault.validateBackup(data);if(!confirm('Se reemplazarán los espacios incluidos por tu copia local previa. ¿Continuar?'))return;downloadBackup();vault.import(data);resetFrames();await cloud.flush()}));}else{const form=document.createElement('form');form.innerHTML='<label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><button class="primary" type="submit">Entrar</button>';form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{const {error}=await cloud.client.auth.signInWithPassword({email:form.elements.email.value,password:form.elements.password.value});if(error)throw Error('No se pudo entrar. Revisá el correo y la contraseña.')}catch(error){notice(error.message)}finally{submit.disabled=false}};body.append(form,action('Crear una cuenta',async()=>{if(!form.reportValidity())return;const {error}=await cloud.client.auth.signUp({email:form.elements.email.value,password:form.elements.password.value,options:{emailRedirectTo:location.origin+'/'} });if(error)throw Error('No se pudo crear la cuenta. Reintentá en un momento.');notice('Revisá tu correo para confirmar la cuenta, si se solicita.')}));}

 body.append(document.createElement('hr'),action('Descargar copia de todos mis espacios',downloadBackup));const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.onchange=async()=>{try{const selected=file.files[0];if(!selected)return;if(selected.size>20_000_000)throw Error('La copia es demasiado grande.');const data=JSON.parse(await selected.text());vault.validateBackup(data);if(!confirm('Se reemplazarán los espacios incluidos en la copia. Primero se descargará tu estado actual. ¿Continuar?'))return;downloadBackup();vault.import(data);resetFrames();notice('Copia importada.');cloud.flush()}catch(e){notice(e.message)}};body.append(action('Importar una copia',()=>file.click()),file,p('Tus datos locales están separados por cuenta. Al cambiar de servidor, importá una copia para llevarlos con vos.','muted'));}

function openShortcuts(){dialog.querySelector("h2").textContent="Atajos de iPhone";dialog.dataset.view="shortcuts";body.replaceChildren(p('En Atajos de iPhone, agregá la acción Abrir URL y pegá uno de estos enlaces. Abren el formulario; vos revisás y guardás el registro.'));for(const [key,item]of Object.entries(SHORTCUTS)){const label=document.createElement('label');label.textContent=item.label;const input=document.createElement('input');input.readOnly=true;input.value=location.origin+'/#/'+item.app+'/'+item.view+'?action='+key;label.append(input);body.append(label,action('Copiar enlace de '+item.label.toLowerCase(),async()=>{await navigator.clipboard.writeText(input.value);notice('Enlace copiado')}))}body.append(p('Los avisos animados funcionan con la app abierta. Las notificaciones con la app cerrada y la isla dinámica del sistema requieren una conexión adicional.','muted'));dialog.showModal()}

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
