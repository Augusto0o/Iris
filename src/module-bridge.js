// Loaded before every retained module. The root owns navigation and user-scoped storage.
const host=parent.EcosystemHost,moduleId=document.documentElement.dataset.module;
if(!host)throw Error('Abrí el Ecosistema desde su pantalla principal.');
const vault={getItem:key=>host.getItem(String(key)),setItem:(key,value)=>host.setItem(String(key),String(value)),removeItem:key=>host.removeItem(String(key)),clear(){for(const key of host.keys())host.removeItem(key)},key:index=>host.keys()[index]??null,get length(){return host.keys().length}};
Object.defineProperty(window,'localStorage',{value:vault});
const nativeReplace=history.replaceState.bind(history);
nativeReplace(host.initialRoute(moduleId)||null,'');
history.pushState=function(state){host.route(moduleId,state,false)};
history.replaceState=function(state){host.route(moduleId,state,true)};
history.back=()=>host.back();
Object.defineProperty(history,'state',{get:()=>host.initialRoute(moduleId)||null});
const originalIDBOpen=indexedDB.open.bind(indexedDB),originalIDBDelete=indexedDB.deleteDatabase.bind(indexedDB),owner=host.owner();
indexedDB.open=(name,version)=>version===undefined?originalIDBOpen('ecosystem:'+owner+':'+name):originalIDBOpen('ecosystem:'+owner+':'+name,version);
indexedDB.deleteDatabase=name=>originalIDBDelete('ecosystem:'+owner+':'+name);
window.addEventListener('error',e=>host.moduleError(moduleId,e.message));
document.addEventListener('click',e=>{const link=e.target.closest?.('a[href]');if(!link)return;const href=link.getAttribute('href');if(!href||href.startsWith('#')||link.hasAttribute('download'))return;const url=new URL(href,parent.location.origin),id=host.moduleFromURL(url);if(id){e.preventDefault();e.stopImmediatePropagation();host.switchApp(id)}},true);
window.addEventListener('pagehide',()=>{if(typeof cancelAppHold==='function')cancelAppHold()});
