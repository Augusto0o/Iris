// nubo · Mi inicio: widgets like the iPhone's, with real data from every app (numio, domo, lecta, foco), read from
// the same storage the apps use. Small or wide, ordered by dragging, added from a gallery; live timers.
(()=>{
'use strict';
if(typeof homeWidgets!=='function'||typeof state==='undefined')return;
const host=()=>parent.EcosystemHost;
const BRAND={nubo:['/brand/nubo-light.svg','/brand/nubo-dark.svg'],numio:['/brand/numio-light.svg','/brand/numio-dark.svg'],domo:['/brand/domo-light.svg','/brand/domo-dark.svg'],lecta:['/brand/lecta-light.svg','/brand/lecta-dark.svg'],foco:['/brand/foco-light.svg','/brand/foco-dark.svg']};
const mark=b=>`<img class="nw-mark" alt="" src="${BRAND[b][document.body.classList.contains('dark')?1:0]}">`;
const KEYS={numio:'iris03',domo:'ecosistema03-space',lecta:'ecosistema03-journal',foco:'ecosistema03-organizer'};
const read=b=>{try{return JSON.parse(host().getItem(KEYS[b])||'{}')||{}}catch{return {}}};
const recs=(b,k)=>{const d=read(b);return (b==='numio'?d[k]:d.records?.[k])||[]};
const day=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const money=n=>'$ '+Math.round(n).toLocaleString('es-AR');
const clock=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
const e=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const open=(app,view)=>`parent.EcosystemHost.openResult({app:'${app}',view:'${view}'})`;

// ---- data ---------------------------------------------------------------------------------------------------
function tasksToday(){const t=day();return recs('foco','tasks').filter(x=>!x.done&&!x.deletedAt&&(!x.date||x.date<=t)).sort((a,b)=>String(a.date||'9').localeCompare(String(b.date||'9'))||({Alta:0,Media:1,Baja:2}[a.priority]??1)-({Alta:0,Media:1,Baja:2}[b.priority]??1))}
function events(){const t=day(),now=new Date(),hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
 return recs('foco','events').filter(x=>!x.deletedAt&&x.date&&(x.date>t||x.date===t&&(!x.time||(x.endTime||x.time)>=hm))).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,4)}
function habits(){const t=day();const list=recs('foco','habits').filter(h=>!h.deletedAt);return {list,done:list.filter(h=>(h.logs||[]).includes(t))}}
function focus(){const d=read('foco'),t=d.timer||{},left=t.running?Math.max(0,(t.endAt-Date.now())/1000):t.remaining||0;
 const minutes=(d.records?.sessions||[]).filter(s=>s.date===day()).reduce((a,s)=>a+(+s.minutes||0),0);return {t,left,minutes,active:!!(t.running||t.id)}}
function spend(){const d=read('numio'),m=day().slice(0,7),prev=(()=>{const x=new Date();x.setDate(1);x.setMonth(x.getMonth()-1);return day(x).slice(0,7)})();
 const ars=x=>(x.currency||'ARS')==='ARS',sum=(list,mm)=>list.filter(x=>ars(x)&&String(x.date||'').startsWith(mm)).reduce((a,x)=>a+(+x.amount||0),0);
 const exp=d.expenses||[],cats={};for(const x of exp)if(ars(x)&&String(x.date||'').startsWith(m))cats[x.category||'Otros']=(cats[x.category||'Otros']||0)+(+x.amount||0);
 return {now:sum(exp,m),before:sum(exp,prev),income:sum(d.incomes||[],m),cats:Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,3)}}
function bills(){const m=day().slice(0,7),paid=recs('domo','homePayments').filter(p=>p.period===m).map(p=>String(p.name||'').toLowerCase()),today=new Date().getDate();
 const list=recs('domo','services').filter(s=>!s.deletedAt&&!paid.some(n=>n.includes(String(s.name).toLowerCase()))).sort((a,b)=>(a.day||31)-(b.day||31));
 return {list,total:list.reduce((a,s)=>a+(+s.amount||0),0),late:list.filter(s=>(s.day||31)<today).length}}
function kitchen(){return (read('domo').kitchenTimers||[]).map(t=>({...t,left:t.paused?t.remaining:Math.max(0,(t.endAt-Date.now())/1000)}))}
function lastNote(){return recs('lecta','notes').filter(n=>!n.deletedAt).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]}
function toWatch(){return recs('lecta','library').filter(r=>r.kind==='Película'&&r.status!=='Terminado'&&!r.deletedAt).slice(-6).reverse()}
const plain=h=>String(h||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

// ---- widgets ------------------------------------------------------------------------------------------------
const W={
 actions:{name:'Accesos rápidos',brand:'nubo',sizes:['wide'],desc:'Anotá un gasto, una tarea o una nota, escaneá o abrí tus contraseñas.',
  html:()=>`<div class="nw-actions">${[['iris','expense','Gasto','<path d="M12 5v14M5 12h14"/>'],['organizador','task','Tarea','<path d="m5 12 4.5 4.5L19 7"/>'],['journal','note','Nota','<path d="M5 19h14M7 15l9-9 2 2-9 9H7z"/>']].map(([a,act,l,p])=>`<button type="button" onclick="parent.EcosystemHost.act('${a}','${act}')"><svg viewBox="0 0 24 24">${p}</svg>${l}</button>`).join('')}<button type="button" onclick="parent.EcosystemHost.openScanner()"><svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10"/></svg>Escanear</button><button type="button" onclick="parent.EcosystemHost.openPasswords()"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg>Claves</button></div>`},
 tasks:{name:'Tareas de hoy',brand:'foco',sizes:['small','wide'],desc:'Lo que tenés pendiente para hoy y lo atrasado.',go:open('organizador','tasks'),
  html:size=>{const l=tasksToday(),late=l.filter(t=>t.date&&t.date<day()).length;return `<div class="nw-big">${l.length}</div><p class="nw-sub">${l.length===1?'tarea pendiente':'tareas pendientes'}${late?` · <b>${late} atrasada${late>1?'s':''}</b>`:''}</p>${size==='wide'&&l.length?`<ul class="nw-list">${l.slice(0,3).map(t=>`<li><i class="nw-dot ${t.priority==='Alta'?'hi':''}"></i>${e(t.title)}</li>`).join('')}</ul>`:''}`}},
 agenda:{name:'Agenda',brand:'foco',sizes:['wide','small'],desc:'Tus próximos eventos.',go:open('organizador','calendar'),
  html:size=>{const l=events(),t=day();if(!l.length)return `<div class="nw-big nw-soft">Libre</div><p class="nw-sub">No tenés eventos próximos.</p>`;const lbl=x=>x.date===t?'Hoy':new Date(x.date+'T12:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric'});
   return size==='small'?`<div class="nw-when">${lbl(l[0])}${l[0].time?' · '+e(l[0].time):''}</div><div class="nw-title">${e(l[0].title)}</div><p class="nw-sub">${l.length>1?'y '+(l.length-1)+' más':e(l[0].place||'')}</p>`
    :`<ul class="nw-events">${l.slice(0,3).map(x=>`<li><span>${lbl(x)}<b>${e(x.time||'Todo el día')}</b></span><strong>${e(x.title)}</strong></li>`).join('')}</ul>`}},
 habits:{name:'Hábitos',brand:'foco',sizes:['small','wide'],desc:'Cuántos hábitos cumpliste hoy.',go:open('organizador','habits'),
  html:size=>{const h=habits(),p=h.list.length?h.done.length/h.list.length:0;return `<div class="nw-ring" style="--p:${p}"><span>${h.done.length}/${h.list.length}</span></div><p class="nw-sub">${h.list.length?(h.done.length===h.list.length?'¡Todo hecho hoy!':'hábitos de hoy'):'Agregá tu primer hábito'}</p>${size==='wide'?`<div class="nw-chips">${h.list.slice(0,4).map(x=>`<span class="${(x.logs||[]).includes(day())?'on':''}">${e(x.name)}</span>`).join('')}</div>`:''}`}},
 focus:{name:'Concentración',brand:'foco',sizes:['small','wide'],desc:'Tu Pomodoro en curso y los minutos de hoy.',go:open('organizador','focus'),
  html:()=>{const f=focus();return f.active?`<div class="nw-big" data-live="focus">${clock(f.left)}</div><p class="nw-sub">${f.t.mode==='break'?'Descanso':'Concentración'}${f.t.running?'':' · en pausa'}</p>`
   :`<div class="nw-big">${f.minutes}<small> min</small></div><p class="nw-sub">concentrado hoy</p>`}},
 spend:{name:'Gastos del mes',brand:'numio',sizes:['small','wide'],desc:'Cuánto gastaste este mes y en qué.',go:open('iris','expenses'),
  html:size=>{const s=spend(),diff=s.before?Math.round((s.now-s.before)/s.before*100):null;return `<div class="nw-big nw-money">${money(s.now)}</div><p class="nw-sub">${diff===null?'este mes':`${diff>0?'+':''}${diff}% que el mes pasado`}</p>${size==='wide'&&s.cats.length?`<div class="nw-bars">${s.cats.map(([c,v])=>`<div><span>${e(c)}</span><i style="--w:${s.now?v/s.now:0}"></i><b>${money(v)}</b></div>`).join('')}</div>`:''}`}},
 bills:{name:'Servicios',brand:'domo',sizes:['small','wide'],desc:'Lo que falta pagar este mes en tu casa.',go:open('mi-espacio','services'),
  html:size=>{const b=bills();if(!b.list.length)return `<div class="nw-big nw-soft">Al día</div><p class="nw-sub">No hay servicios pendientes este mes.</p>`;
   return `<div class="nw-big nw-money">${money(b.total)}</div><p class="nw-sub">${b.list.length} por pagar${b.late?` · <b>${b.late} vencido${b.late>1?'s':''}</b>`:''}</p>${size==='wide'?`<ul class="nw-list">${b.list.slice(0,3).map(s=>`<li><i class="nw-dot ${(s.day||31)<new Date().getDate()?'hi':''}"></i>${e(s.name)}<span>día ${e(s.day||'—')}</span></li>`).join('')}</ul>`:''}`}},
 kitchen:{name:'Cocina',brand:'domo',sizes:['small','wide'],desc:'Tus temporizadores de cocina en curso.',go:open('mi-espacio','recipes'),
  html:size=>{const k=kitchen();if(!k.length)return `<div class="nw-big nw-soft">—</div><p class="nw-sub">Sin temporizadores</p>`;
   return size==='small'?`<div class="nw-big" data-live="kitchen" data-id="${e(k[0].id)}">${k[0].done?'¡Listo!':clock(k[0].left)}</div><p class="nw-sub">${e(k[0].label)}${k.length>1?' · +'+(k.length-1):''}</p>`
    :`<ul class="nw-events">${k.slice(0,3).map(t=>`<li><span>${e(t.label)}</span><strong data-live="kitchen" data-id="${e(t.id)}">${t.done?'¡Listo!':clock(t.left)}</strong></li>`).join('')}</ul>`}},
 note:{name:'Última nota',brand:'lecta',sizes:['wide','small'],desc:'La nota que escribiste más recientemente.',go:open('journal','notes'),
  html:()=>{const n=lastNote();return n?`<div class="nw-title">${e(n.title||'Sin título')}</div><p class="nw-sub nw-excerpt">${e(plain(n.body).slice(0,160))}</p>`:`<div class="nw-title">Todavía no hay notas</div><p class="nw-sub">Tocá para escribir la primera.</p>`}},
 watch:{name:'Para ver',brand:'lecta',sizes:['wide'],desc:'Las películas que guardaste para ver.',go:open('journal','movies'),
  html:()=>{const l=toWatch();return l.length?`<div class="nw-posters">${l.slice(0,5).map(r=>`<span>${r.cover?`<img src="${e(r.cover)}" alt="" loading="lazy" onerror="this.remove()">`:''}<small>${e(r.name)}</small></span>`).join('')}</div>`:`<div class="nw-title">Nada guardado</div><p class="nw-sub">Las películas con «Quiero ver» aparecen acá.</p>`}},
};
const DEFAULT=[['actions','wide'],['tasks','small'],['spend','small'],['agenda','wide'],['bills','small'],['habits','small'],['watch','wide']];
const board=()=>{if(!Array.isArray(state.nuboWidgets))state.nuboWidgets=DEFAULT.map(([k,size])=>({k,size}));return state.nuboWidgets.filter(w=>W[w.k])};
let editing=false;
function widget(w){const d=W[w.k],size=d.sizes.includes(w.size)?w.size:d.sizes[0];let inner='';try{inner=d.html(size)}catch{inner='<p class="nw-sub">No se pudo leer.</p>'}
 const tag=d.go&&!editing?'button':'div';
 return `<${tag} ${tag==='button'?`type="button" onclick="${d.go}"`:''} class="nw nw-${size} nw-k-${w.k}" data-w="${w.k}">${editing?`<span class="nw-edit"><button type="button" class="nw-remove" onclick="nuboWidget.remove('${w.k}')" aria-label="Quitar ${e(d.name)}">−</button>${d.sizes.length>1?`<button type="button" class="nw-size" onclick="nuboWidget.size('${w.k}')" aria-label="Cambiar tamaño">${size==='wide'?'Chico':'Ancho'}</button>`:''}</span>`:''}
  <div class="nw-head">${mark(d.brand)}<span>${e(d.name)}</span></div><div class="nw-body">${inner}</div></${tag}>`}
function boardHTML(){const list=board();return `<div class="nw-board${editing?' editing':''}" id="nuboBoard">${list.map(widget).join('')}${editing?`<button type="button" class="nw-add" onclick="nuboWidget.gallery()">+ Agregar widget</button>`:''}${!list.length&&!editing?`<button type="button" class="nw-add" onclick="nuboWidget.edit(true)">+ Agregar widgets</button>`:''}</div>`}
homeWidgets=boardHTML;
if(typeof homeHeading==='function')homeHeading=()=>`<div class="nw-heading"><h2>Mi inicio</h2><button type="button" class="nw-editbtn" onclick="nuboWidget.edit(${!editing})">${editing?'Listo':'Editar'}</button></div>`;
// the hero line uses foco's real tasks and events
if(typeof pendingSummary==='function')pendingSummary=()=>{const n=tasksToday().length;return n+(n===1?' tarea pendiente':' tareas pendientes')};
if(typeof todayEventSummary==='function')todayEventSummary=()=>{const n=recs('foco','events').filter(x=>x.date===day()).length;return n+(n===1?' evento hoy':' eventos hoy')};
customize=()=>{closeModal?.();if(typeof go==='function'&&view!=='home')go('home');nuboWidget.edit(true)};
const repaint=()=>{const el=document.getElementById('nuboBoard');if(el){el.outerHTML=boardHTML();bindDrag()}const head=document.querySelector('.nw-heading');if(head)head.outerHTML=homeHeading()};
window.nuboWidget={
 edit(on){editing=!!on;repaint();if(!on)save?.()},
 remove(k){state.nuboWidgets=board().filter(w=>w.k!==k);repaint();save?.()},
 size(k){const w=board().find(x=>x.k===k),s=W[k].sizes;w.size=s[(s.indexOf(w.size)+1)%s.length];repaint();save?.()},
 add(k){if(!board().some(w=>w.k===k))state.nuboWidgets.push({k,size:W[k].sizes[0]});closeModal?.();repaint();save?.()},
 gallery(){const have=board().map(w=>w.k),free=Object.keys(W).filter(k=>!have.includes(k));
  const was=editing;editing=false;const cards=free.map(k=>[k,widget({k,size:W[k].sizes[0]}).replace(/onclick="[^"]*"/g,'')]);editing=was;
  modal('Agregar widget',free.length?`<div class="nw-gallery">${cards.map(([k,card])=>`<div class="nw-option"><span class="nw-preview" inert>${card}</span><span class="nw-option-copy"><strong>${e(W[k].name)}</strong><small>${e(W[k].desc)}</small></span><button type="button" class="primary" onclick="nuboWidget.add('${k}')">Agregar</button></div>`).join('')}</div>`:'<p>Ya tenés todos los widgets en tu inicio.</p>')}};
// drag to reorder while editing (hold and move)
function bindDrag(){const el=document.getElementById('nuboBoard');if(!el||!editing)return;let drag=null;
 el.onpointerdown=ev=>{const w=ev.target.closest('.nw');if(!w||ev.target.closest('.nw-edit'))return;drag={w,id:ev.pointerId,x:ev.clientX,y:ev.clientY,moved:false};w.setPointerCapture(ev.pointerId)};
 el.onpointermove=ev=>{if(!drag||ev.pointerId!==drag.id)return;const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<8)return;ev.preventDefault();drag.moved=true;drag.w.classList.add('dragging');drag.w.style.transform=`translate(${dx}px,${dy}px)`;
  const over=document.elementsFromPoint(ev.clientX,ev.clientY).find(n=>n.classList?.contains('nw')&&n!==drag.w);if(over){const list=board(),a=list.findIndex(w=>w.k===drag.w.dataset.w),b=list.findIndex(w=>w.k===over.dataset.w);if(a>=0&&b>=0&&a!==b){const [x]=list.splice(a,1);list.splice(b,0,x);state.nuboWidgets=list;
   const r=drag.w.getBoundingClientRect();(a<b?over.after(drag.w):over.before(drag.w));const r2=drag.w.getBoundingClientRect();drag.x+=r2.left-r.left;drag.y+=r2.top-r.top;drag.w.style.transform=`translate(${ev.clientX-drag.x}px,${ev.clientY-drag.y}px)`}}};
 el.onpointerup=el.onpointercancel=()=>{if(!drag)return;drag.w.classList.remove('dragging');drag.w.style.transform='';const moved=drag.moved;drag=null;if(moved)save?.()}}
// live: timers every second, the rest when the data changes
let sig='';setInterval(()=>{if(document.hidden||typeof view==='undefined'||view!=='home')return;
 for(const n of document.querySelectorAll('[data-live=focus]')){const f=focus();n.textContent=clock(f.left)}
 for(const n of document.querySelectorAll('[data-live=kitchen]')){const t=kitchen().find(x=>x.id===n.dataset.id);if(t)n.textContent=t.done||!t.left?'¡Listo!':clock(t.left)}
 if(editing)return;const now=Object.values(KEYS).map(k=>(host().getItem(k)||'').length).join('|')+'|'+day();if(now!==sig){const first=!sig;sig=now;if(!first)repaint()}},1000);
try{render()}catch{}
})();
// Ajustes: Contraseñas lives here too
(()=>{if(typeof settings!=='function')return;const before=settings;settings=function(...a){const r=before(...a);const form=document.getElementById('settingsForm');if(form&&!document.getElementById('nwVault')){const box=document.createElement('div');box.id='nwVault';box.className='nw-setting';
 box.innerHTML='<div><h3>Contraseñas</h3><p class="small">Tus claves cifradas en este teléfono, con Face ID.</p></div><button type="button" onclick="closeModal();parent.EcosystemHost.openPasswords()">Abrir</button>';form.parentElement.append(box)}return r}})();
