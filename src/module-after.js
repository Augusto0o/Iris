appDestination=function(id){return id};

endAppHold=function(e){if(appHoldPointer!==null&&e.pointerId!==appHoldPointer)return;e.preventDefault();if(appHoldOpened)trackQuickAppGesture(e);const id=appHoverTarget?.dataset.destination;cancelAppHold();if(id)parent.EcosystemHost.switchApp(id)};

appSwitchKeyUp=function(e){if(e.key!==appHoldKey)return;e.preventDefault();const id=appHoverTarget?.dataset.destination;cancelAppHold();if(id)parent.EcosystemHost.switchApp(id)};

const originalQuickSelect=selectQuickApp;

selectQuickApp=function(link,x){originalQuickSelect(link,x);if(link)parent.EcosystemHost.prepareApp(link.dataset.destination)};

const originalSettings=settings;

settings=function(...args){
 originalSettings(...args);
 const content=document.getElementById('modalBody');if(!content)return;
 document.getElementById('modalTitle').textContent='Configuración';
 const original=document.createElement('div');original.className='settings-preferences';while(content.firstChild)original.append(content.firstChild);
 const identity=document.createElement('div');identity.className='settings-identity';identity.innerHTML='<span class="settings-symbol">'+icon('settings')+'</span><div><strong>Tu espacio, a tu manera</strong><p>Apariencia, preferencias y datos.</p></div>';
 const group=document.createElement('section');group.className='settings-links';
 function row(title,description,symbol,run){const glyph=symbol==='user'?'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>':'<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';const button=document.createElement('button');button.className='settings-row';button.innerHTML='<span class="settings-symbol">'+glyph+'</span><span><strong>'+title+'</strong><small>'+description+'</small></span>';button.onclick=()=>{closeModal();run()};group.append(button)}
 row('Cuenta y sincronización','Sesión, copia de seguridad y datos','user',()=>parent.EcosystemHost.openAccount());
 row('Notificaciones y atajos','Recordatorios y acciones desde tu iPhone','bell',()=>parent.EcosystemHost.openMobile());
 content.append(identity,group,original);

 // Present selects as compact choice cards while preserving the original form submit.
 const theme=original.querySelector('select[name="theme"]');
 if(theme){const choices=document.createElement('div');choices.className='settings-choice';for(const option of theme.options){const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.setAttribute('aria-pressed',String(theme.value===option.value));button.onclick=()=>{theme.value=option.value;choices.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===button)))};choices.append(button)}theme.hidden=true;theme.after(choices)}
};

window.ecosystemDeactivate=()=>{if(typeof cancelAppHold==='function')cancelAppHold();if(document.getElementById('modal')?.open)closeModal();if(typeof closeFocusStage==='function')closeFocusStage();document.querySelectorAll('audio,video').forEach(e=>e.pause());document.querySelectorAll('iframe').forEach(e=>{if(e.src.includes('youtube'))e.remove()})};

window.ecosystemRestore=route=>{dispatchEvent(new PopStateEvent('popstate',{state:route}));if(moduleId==='centro'&&route?.view){view=route.view;render()}};

if(moduleId==='centro'){

 // Digitize from nubo: a camera button beside the search bar.
 {const bar=document.querySelector('header .search');if(bar&&!document.getElementById('scanLaunch')){const b=document.createElement('button');b.id='scanLaunch';b.type='button';b.className='scan-launch';b.setAttribute('aria-label','Digitalizar con la cámara');b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';b.onclick=()=>parent.EcosystemHost.openScanner();bar.after(b)}}

 // The search bar looks in every app (numio, domo, lecta, foco) and opens the record where it lives.
 const BRAND={nubo:['/brand/nubo-light.svg','/brand/nubo-dark.svg'],numio:['/brand/numio-light.svg','/brand/numio-dark.svg'],domo:['/brand/domo-light.svg','/brand/domo-dark.svg'],lecta:['/brand/lecta-light.svg','/brand/lecta-dark.svg'],foco:['/brand/foco-light.svg','/brand/foco-dark.svg']},BRAND_MARK=(m,dark)=>(BRAND[m]||BRAND.nubo)[dark==='dark'?1:0];
 const MARKS={iris:'numio','mi-espacio':'domo',journal:'lecta',organizador:'foco'};
 let ecosystemResults=[],ecosystemAI={q:null};
 searchMarkup=function(){
  const all=query?parent.EcosystemHost.search(query,120):[],apps=[['all','Todo'],...Object.entries(MARKS)];
  ecosystemResults=all.filter(e=>searchFilter==='all'||e.app===searchFilter);
  if(!apps.some(([k])=>k===searchFilter))searchFilter='all';
  const dark=document.body.classList.contains('dark')?'dark':'light';
  const filters=apps.map(([key,label])=>`<button class="${searchFilter===key?'selected':''}" aria-pressed="${searchFilter===key}" onclick="filterSearch('${key}')">${label}${query?' · '+(key==='all'?all.length:all.filter(e=>e.app===key).length):''}</button>`).join('');
  const row=(e,call)=>`<button class="search-result" onclick="${call}"><span class="tile search-mark" style="background:center/contain no-repeat url('${BRAND_MARK(MARKS[e.app],dark)}')"></span><span class="result-copy"><strong>${esc(e.title)}</strong><span class="small">${esc(e.subtitle.slice(0,180))}</span></span>${e.amount!==undefined?`<span class="amount">${cash(e.amount,e.currency||'ARS')}</span>`:''}${icon('right')}</button>`;
  const ai=!query?'':ecosystemAI.q!==query?`<button class="ai-ask" onclick="askEcosystemAI()"><svg class=\"ai-spark\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z\"/></svg><span>Preguntarle a la IA: “${esc(query)}”</span></button>`
   :`<section class="card ai-answer" aria-live="polite"><h2><svg class=\"ai-spark\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z\"/></svg>IA</h2>${ecosystemAI.loading?'<p class="small">Pensando…</p>':ecosystemAI.error?`<p class="small">${esc(ecosystemAI.error)}</p><button class="textbtn" onclick="askEcosystemAI()">Reintentar</button>`:`<p>${esc(ecosystemAI.answer||'Sin respuesta.')}</p>${ecosystemAI.results.length?`<div class="search-results">${ecosystemAI.results.map((e,i)=>row(e,`openEcosystemAI(${i})`)).join('')}</div>`:''}`}</section>`;
  const rows=ecosystemResults.map((e,i)=>`<button class="search-result" onclick="openEcosystemResult(${i})"><span class="tile search-mark" style="background:center/contain no-repeat url('${BRAND_MARK(MARKS[e.app],dark)}')"></span><span class="result-copy"><strong>${esc(e.title)}</strong><span class="small">${esc(e.subtitle.slice(0,180))}</span></span>${e.amount!==undefined?`<span class="amount">${cash(e.amount,e.currency||'ARS')}</span>`:''}${icon('right')}</button>`).join('');
  return `<h1>Buscar</h1><p>En numio, domo, lecta y foco a la vez.</p><div class="filter-bar" aria-label="Filtrar por app">${filters}</div>${ai}${!query?`<section class="card"><span class="tile">${icon('search')}</span><h2 style="margin:14px 0 6px">¿Qué querés encontrar?</h2><p>Buscá por nombre, importe, categoría o el contenido de tus notas y tareas.</p></section>`:`<p class="small" role="status" style="margin-bottom:12px">${ecosystemResults.length} ${ecosystemResults.length===1?'resultado':'resultados'} para “${esc(query)}”</p><section class="card search-results">${rows||`<div class="empty"><h3>No encontramos coincidencias</h3><p>Probá con otra palabra o cambiá el filtro.</p><button class="textbtn" onclick="clearSearch()">Limpiar búsqueda</button></div>`}</section>`}`;
 };
 window.openEcosystemResult=i=>{const e=ecosystemResults[i];if(e)parent.EcosystemHost.openResult(e)};
 // Ask in your own words ("¿cuánto gasté en luz este año?"): Claude answers from your records and links them.
 window.askEcosystemAI=async()=>{const q=query;ecosystemAI={q,loading:true,results:[]};render();
  try{const r=await parent.EcosystemHost.aiAsk(q);if(ecosystemAI.q===q)ecosystemAI={q,answer:r.answer,results:r.results}}
  catch(e){if(ecosystemAI.q===q)ecosystemAI={q,error:e.message,results:[]}}
  if(query===q)render()};
 window.openEcosystemAI=i=>{const e=ecosystemAI.results?.[i];if(e)parent.EcosystemHost.openResult(e)};

 launchApplication=function(page){const map={expenses:'iris',space:'mi-espacio',notes:'journal',tasks:'organizador'};if(map[page]){closeModal();parent.EcosystemHost.switchApp(map[page])}};

 const oldGo=go;go=function(v){const apps={expenses:'iris',space:'mi-espacio',notes:'journal',tasks:'organizador'};if(apps[v]){parent.EcosystemHost.switchApp(apps[v]);return}oldGo(v);parent.EcosystemHost.route('centro',{ecosystemRoute:true,app:'centro',view:v},false)};

 // Centro's previous app links now open the corresponding internal section.

 const centroRender=render;render=function(){centroRender();document.querySelectorAll('[onclick]').forEach(button=>{const call=button.getAttribute('onclick')||'';const match=/^openApp\(['"]([^'"]+)['"]\)/.exec(call);if(match){const map={iris:'iris',organizer:'organizador',space:'mi-espacio',journal:'journal'};if(map[match[1]])button.onclick=()=>parent.EcosystemHost.switchApp(map[match[1]])}})};

}



// The parent owns the iOS status-area color, even though screens are retained.

window.ecosystemReportTheme=()=>{const c=getComputedStyle(document.body),dark=document.body.classList.contains('dark');document.documentElement.dataset.ecosystemTheme=dark?'dark':'light';document.documentElement.style.setProperty('--ecosystem-edge',c.getPropertyValue('--panel'));parent.EcosystemHost.theme(moduleId,{dark,panel:c.getPropertyValue('--panel').trim(),bg:c.getPropertyValue('--bg').trim()})};

new MutationObserver(window.ecosystemReportTheme).observe(document.body,{attributes:true,attributeFilter:['class','data-app']});window.ecosystemReportTheme();

// Only what matters reaches the island: problems, finished timers, reminders. Plain confirmations ("Guardado",
// "Nota guardada"…) stay silent (what changed on screen is the confirmation); undo offers keep the app's own toast.
const IMPORTANT=/no se pudo|no pudo|error|fall|revis|inválid|incorrect|no se encontr|falta|complet[áa]|ingres[áa]|eleg[íi]|venc|recordatorio|¡listo|termin[óo] el|sin conexión|demasiado|permit|no hay|ya (está|figura|existe|ten)|no se (puede|permite)/i;
window.ecosystemImportant=t=>IMPORTANT.test(String(t||''));
const retainedNotify=notify;notify=function(text,undo=false){const t=String(text||'');if(undo||typeof persistenceProblem!=='undefined'&&persistenceProblem||typeof saveFailed!=='undefined'&&saveFailed)return retainedNotify(t,undo);
 if(!IMPORTANT.test(t))return;if(document.getElementById('modal')?.open)return retainedNotify(t,undo);parent.EcosystemHost.notify(moduleId,t)};

window.ecosystemAction=action=>{if(moduleId==='iris'&&['expense','income'].includes(action))movementForm(action==='income'?'incomes':'expenses');else if(moduleId==='journal'&&action==='note')noteForm();else if(moduleId==='organizador'&&action==='task')taskForm()};

if(moduleId==='organizador'){

 let lastPushTimer=null;
 const reportFocus=()=>{const t=ensureTimer();if(t.running&&t.id){lastPushTimer=t.id;parent.EcosystemHost.timer({id:'timer:'+t.id,due:t.endAt})}else if(lastPushTimer){if(t.remaining>0)parent.EcosystemHost.timer({id:'timer:'+lastPushTimer,due:null});lastPushTimer=null;}parent.EcosystemHost.activity((t.running||t.id)&&!document.getElementById('focusStage')?{id:t.id,title:t.mode==='break'?'Descanso':'Concentración',message:timerDisplay()+' · Volver al Pomodoro',due:t.running?t.endAt:null,kind:'timer',app:'organizador',view:'focus',action:t.running?{label:'Pausar',run:()=>toggleTimer()}:{label:'Terminar',run:()=>{resetTimer();reportFocus()}}}:null)};

 setInterval(reportFocus,1000);const retainedToggle=toggleTimer;toggleTimer=function(...args){const result=retainedToggle(...args);reportFocus();return result};reportFocus();

}

// Keep parent notices out of modal forms, immersive timers and undo/error toasts.
window.ecosystemReportOverlay=()=>{
 const toast=document.getElementById('toast');
 const toastVisible=toast&&!toast.hidden&&!toast.classList.contains('hidden')&&getComputedStyle(toast).display!=='none';
 parent.EcosystemHost.overlay(moduleId,!!document.querySelector('dialog[open],#focusStage')||!!toastVisible);
};
new MutationObserver(window.ecosystemReportOverlay).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class','hidden','style']});
window.ecosystemReportOverlay();
if(moduleId==='mi-espacio'){
 // Kitchen timers: several at once with a name, presets, pause, +1 min and cancel; they ring when done.
 const host=parent.EcosystemHost,list=()=>S.kitchenTimers||=[];
 if(S.kitchenTimer){list().push({id:S.kitchenTimer.id,label:'Cocina',endAt:S.kitchenTimer.endAt,total:Math.max(60,Math.round((S.kitchenTimer.endAt-Date.now())/1000)),paused:false,remaining:0});S.kitchenTimer=null;persist()}
 const left=t=>t.paused?t.remaining:Math.max(0,Math.ceil((t.endAt-Date.now())/1000));
 const clock=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
 const push=t=>host.timer({id:'timer:'+t.id,due:t.paused||t.done?null:t.endAt,kind:'recipe'});
 let ctx=null,ring=null;
 function alarm(on){if(!on){clearInterval(ring);ring=null;return}if(ring)return;try{ctx||=new (window.AudioContext||window.webkitAudioContext)();ctx.resume?.()}catch{}
  const beep=()=>{if(!ctx)return;const t0=ctx.currentTime;for(const [d,f] of [[0,880],[.18,880],[.36,1175]]){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(0,t0+d);g.gain.linearRampToValueAtTime(.25,t0+d+.02);g.gain.exponentialRampToValueAtTime(.001,t0+d+.16);o.connect(g).connect(ctx.destination);o.start(t0+d);o.stop(t0+d+.18)}try{navigator.vibrate?.([200,100,200])}catch{}};
  beep();let n=0;ring=setInterval(()=>{beep();if(++n>40)alarm(false)},1500)}
 function report(){const all=list();let changed=false;
  for(const t of all)if(!t.done&&!t.paused&&left(t)===0){t.done=true;changed=true;notify('¡Listo! '+t.label)}
  if(changed)persist();alarm(all.some(t=>t.done));
  const next=all.filter(t=>!t.done).sort((a,b)=>left(a)-left(b))[0],done=all.find(t=>t.done);
  const show=done||next;
  if(!show){host.activity(null,'kitchen')}
  else host.activity({id:show.id,title:done?'¡Listo! '+show.label:show.label,message:done?'Tocá para apagar':clock(left(show))+(all.length>1?' · '+all.length+' temporizadores':''),due:show.paused||done?null:show.endAt,kind:'timer',app:'mi-espacio',view:'recipes',priority:1,
   action:done?{label:'Apagar',run:()=>stop(show.id)}:{label:'Cancelar',run:()=>stop(show.id)}},'kitchen');
  for(const t of all){const row=document.querySelector(`[data-kt="${t.id}"]`);if(!row)continue;const s=left(t);row.querySelector('.kt-time').textContent=t.done?'¡Listo!':clock(s);row.style.setProperty('--p',String(t.done?1:1-s/Math.max(1,t.total)));row.classList.toggle('done',!!t.done);row.classList.toggle('paused',!!t.paused)}}
 function start(label,seconds){const t={id:crypto.randomUUID(),label:label||'Temporizador',total:seconds,endAt:Date.now()+seconds*1000,paused:false,remaining:0};list().push(t);persist();push(t);try{ctx||=new (window.AudioContext||window.webkitAudioContext)();ctx.resume?.()}catch{}render();report()}
 function stop(id){const all=list(),t=all.find(x=>x.id===id);if(!t)return;host.timer({id:'timer:'+t.id,due:null,kind:'recipe'});all.splice(all.indexOf(t),1);persist();render();report()}
 window.kitchenTimer={start,stop,
  pause(id){const t=list().find(x=>x.id===id);if(!t||t.done)return;if(t.paused){t.endAt=Date.now()+t.remaining*1000;t.paused=false}else{t.remaining=left(t);t.paused=true}persist();push(t);render();report()},
  add(id,sec=60){const t=list().find(x=>x.id===id);if(!t)return;if(t.done){t.done=false;t.endAt=Date.now()+sec*1000;t.total=sec}else if(t.paused)t.remaining+=sec;else t.endAt+=sec*1000;t.total+=t.done?0:sec;persist();push(t);render();report()}};
 const PRESETS=[1,3,5,8,10,12,15,20,30,45,60];
 function kitchenForm(){let minutes=10,seconds=0;
  openModal('Nuevo temporizador',`<form id="kitchenTimerForm" class="form kt-form"><label>Para qué<input name="label" maxlength="40" placeholder="Fideos, horno, huevos…" autocomplete="off"></label>
   <div class="kt-presets">${PRESETS.map(m=>`<button type="button" data-min="${m}" class="${m===10?'on':''}">${m<60?m+' min':'1 h'}</button>`).join('')}</div>
   <div class="kt-custom"><label>Minutos<input name="minutes" type="number" inputmode="numeric" min="0" max="240" value="10"></label><label>Segundos<input name="seconds" type="number" inputmode="numeric" min="0" max="59" value="0"></label></div>
   <div class="form-actions"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Empezar</button></div></form>`);
  const f=document.getElementById('kitchenTimerForm');
  f.querySelectorAll('[data-min]').forEach(b=>b.onclick=()=>{f.minutes.value=b.dataset.min;f.seconds.value=0;f.querySelectorAll('[data-min]').forEach(x=>x.classList.toggle('on',x===b))});
  f.onsubmit=e=>{e.preventDefault();const total=Math.min(240*60,Math.max(0,(+f.minutes.value||0)*60+(+f.seconds.value||0)));if(total<5){notify('Elegí al menos 5 segundos.');return}closeModal();start(f.label.value.trim(),total)}}
 window.kitchenTimerForm=kitchenForm;
 const card=()=>{const all=list();return `<section class="card kt-card"><div class="kt-head"><h2>Temporizadores</h2><button type="button" class="primary kt-new" onclick="kitchenTimerForm()">${icon('plus')}Nuevo</button></div>
  ${all.length?all.map(t=>`<div class="kt-row" data-kt="${t.id}"><div class="kt-copy"><strong>${esc(t.label)}</strong><span class="kt-time">${t.done?'¡Listo!':clock(left(t))}</span><i class="kt-bar"></i></div>
   <div class="kt-actions">${t.done?`<button type="button" class="primary" onclick="kitchenTimer.stop('${t.id}')">Apagar</button><button type="button" onclick="kitchenTimer.add('${t.id}',60)">+1 min</button>`:`<button type="button" onclick="kitchenTimer.add('${t.id}',60)" aria-label="Sumar un minuto">+1</button><button type="button" onclick="kitchenTimer.pause('${t.id}')" aria-label="${t.paused?'Seguir':'Pausar'}">${t.paused?'▶':'❚❚'}</button><button type="button" class="kt-cancel" onclick="kitchenTimer.stop('${t.id}')" aria-label="Cancelar ${esc(t.label)}">✕</button>`}</div></div>`).join(''):'<p class="small">Poné uno o varios a la vez: suenan y te avisan aunque estés en otra app.</p>'}</section>`};
 const kitchenRender=render;render=function(...args){const result=kitchenRender(...args);if(screen==='recipes'){const t=document.createElement('template');t.innerHTML=card();document.getElementById('content')?.prepend(t.content)}return result};
 setInterval(report,1000);report();render();
}
window.ecosystemViewport=({bottom,keyboard,visible,top})=>{const root=document.documentElement;root.style.setProperty('--host-safe-bottom',bottom+'px');root.dataset.keyboard=keyboard?'open':'closed';
 if(visible)root.style.setProperty('--kb-visible',visible+'px');root.style.setProperty('--kb-top',Math.max(0,top||0)+'px');if(keyboard)setTimeout(revealFocused,60)};
// Keyboard and windows: with the keyboard up a window fits the visible area (CSS: --kb-top/--kb-visible) and scrolls
// inside itself to the field being edited. The page behind never moves: iOS scrolls it anyway to reveal the field,
// which pushed windows too high or left a white area under them.
let pageLock={x:scrollX,y:scrollY};
const openWindow=()=>document.querySelector('dialog[open],#focusStage');
addEventListener('scroll',()=>{if(openWindow()){if(scrollX!==pageLock.x||scrollY!==pageLock.y)scrollTo(pageLock.x,pageLock.y)}else pageLock={x:scrollX,y:scrollY}},{passive:true});
// What has to stay visible: the caret when writing in a long text (an editor or textarea scrolls itself), else the field.
function caretRect(el){
 if(el.isContentEditable){const sel=getSelection();if(sel.rangeCount&&el.contains(sel.anchorNode)){const r=sel.getRangeAt(0).cloneRange();r.collapse(false);
  let box=r.getClientRects()[0]||r.getBoundingClientRect();if(!box||(!box.height&&!box.top)){const node=sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement;const nb=node?.getBoundingClientRect();
   // an empty line has no caret box: measure that line (the caret is at its start), never the whole editor's bottom
   if(nb){const line=parseFloat(getComputedStyle(node).lineHeight)||26,child=node.nodeType===1&&sel.anchorOffset<node.childNodes.length?node.childNodes[sel.anchorOffset]:null,cb=child?.getBoundingClientRect?.();
    const top=cb&&cb.height?cb.top:node===el||!node.textContent.trim()?nb.top:Math.max(nb.top,nb.bottom-line);box={top,bottom:top+line,height:line}}}
  if(box&&box.height)return {top:box.top,bottom:box.bottom}}}
 const r=el.getBoundingClientRect();
 if(el.tagName==='TEXTAREA'&&el.scrollHeight>el.clientHeight+4){const line=parseFloat(getComputedStyle(el).lineHeight)||22,atEnd=el.selectionEnd>=el.value.length-1;
  return atEnd?{top:r.bottom-line-8,bottom:r.bottom}:{top:r.top,bottom:Math.min(r.bottom,r.top+line*3)}}
 return {top:r.top,bottom:Math.min(r.bottom,r.top+Math.max(44,Math.min(r.height,160)))};
}
function revealFocused(){const el=document.activeElement,win=el?.closest?.('dialog[open]');if(!win||document.documentElement.dataset.keyboard!=='open')return;
 // every scrolling box between the caret and the window (the editor itself, then the window body) brings it into view
 for(let n=el.isContentEditable||el.tagName==='TEXTAREA'?el:el.parentElement,guard=0;n&&guard<12;n=n.parentElement,guard++){
  const s=getComputedStyle(n);if(/(auto|scroll)/.test(s.overflowY)&&n.scrollHeight>n.clientHeight+1){
   const b=n.getBoundingClientRect(),c=caretRect(el);
   if(c.bottom>b.bottom-14)n.scrollTop+=c.bottom-b.bottom+36;else if(c.top<b.top+10)n.scrollTop-=b.top-c.top+28}
  if(n===win)break}
}
let revealQueued=false;const queueReveal=()=>{if(revealQueued)return;revealQueued=true;requestAnimationFrame(()=>{revealQueued=false;revealFocused()})};
document.addEventListener('input',queueReveal);document.addEventListener('keyup',queueReveal);document.addEventListener('selectionchange',queueReveal);
document.addEventListener('focusin',()=>setTimeout(revealFocused,80));
document.documentElement.dataset.hostNavigation='true';
window.ecosystemReportNavigation=()=>{const source=document.getElementById(moduleId==='centro'?'nav':moduleId==='iris'?'mobileIris':'mobileNav');if(source)parent.EcosystemHost.navigation(moduleId,source)};
const navigationSource=document.getElementById(moduleId==='centro'?'nav':moduleId==='iris'?'mobileIris':'mobileNav');
if(navigationSource)new MutationObserver(window.ecosystemReportNavigation).observe(navigationSource,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});
window.ecosystemReportNavigation();
parent.EcosystemHost.guard?.(document);
// Digitizer: the shell saves scanned records through the app itself, so the app's own state stays in sync.
if(typeof storeRecord==='function'&&typeof save==='function'&&typeof schemas!=='undefined'){window.ecosystemImport=(type,value)=>{if(S.records&&!Array.isArray(S.records[type]))S.records[type]=[]; // a collection an add-on creates may not exist yet
 const r=storeRecord(type,value);save('Guardado');return r.id}}
// domo: a service bill becomes a payment of that service (a new service is created when it is not on the list yet).
if(moduleId==='mi-espacio'&&typeof storeHomePayment==='function'){
 window.ecosystemHome=()=>({services:R('services').filter(s=>!s.archived&&!s.deletedAt).map(s=>({id:s.id,name:s.name,provider:s.provider,amount:s.amount}))});
 window.ecosystemImportHomeBill=({serviceId,name,period,amount,date,method,due})=>{
  let id=serviceId;
  if(!id){const day=/^\d{4}-\d{2}-(\d{2})$/.exec(due||'');id=storeRecord('services',{name:name||'Servicio',provider:name||'',amount:Number(amount)||0,day:day?+day[1]:10,method:method||'Transferencia',reference:'',notes:''}).id}
  storeHomePayment('services',id,{period,amount:Number(amount),date,method:method||'',notes:'Digitalizado'});save('Guardado');return {kind:'services',id};
 };
}
// Digitize from each app, with the kinds of paper that app keeps.
{const KINDS={iris:['bill','statement','document'],'mi-espacio':['home-bill','contract','document'],journal:['text','drawing','document'],organizador:['tasks','document']}[moduleId];
 const CAMERA='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
 const place=()=>{if(!KINDS||document.getElementById('scanApp'))return;const b=document.createElement('button');b.id='scanApp';b.type='button';b.className='scan-launch scan-app';b.innerHTML=CAMERA;
  b.setAttribute('aria-label','Digitalizar con la cámara');b.onclick=()=>parent.EcosystemHost.openScanner({types:KINDS});
  const actions=document.querySelector('.topbar .top-actions');
  if(moduleId!=='iris'&&actions){actions.prepend(b);return}
  const brand=document.querySelector('aside .brand');if(brand){brand.parentElement.classList.add('scan-row');brand.after(b)}};
 if(KINDS){place();new MutationObserver(place).observe(document.body,{childList:true,subtree:true})}}
if(moduleId==='iris'){
 window.ecosystemFinance=()=>({accounts:state.accounts.filter(a=>!a.archived).map(a=>({id:a.id,name:a.name,currency:a.currency})),services:(state.services||[]).filter(s=>!s.archived).map(s=>({id:s.id,name:s.name,amount:s.amount,currency:s.currency}))});
 window.ecosystemImportBill=({serviceId,period,amount,date,accountId,method,text})=>{
  if(serviceId){storeIrisServicePayment(serviceId,{period,amount,date,source:'account:'+accountId,method});save();return {kind:'services',id:serviceId}}
  const account=getAccount(accountId);if(!account)throw Error('Elegí una cuenta.');if(!text||!(amount>0))throw Error('Revisá la descripción y el importe.');
  const v={id:crypto.randomUUID(),text:String(text).slice(0,120),amount:cents(amount)/100,method:method||'Transferencia',category:'Servicios',accountId,currency:account.currency,date,account:'',who:''};
  state.expenses.push(v);save();return {kind:'expenses',id:v.id};
 };
}
// Long-text fields grow with their content (they start at two lines).
document.addEventListener('input',e=>{const t=e.target;if(t?.tagName==='TEXTAREA'&&t.closest('#modalBody label')){t.style.height='auto';t.style.height=Math.min(240,t.scrollHeight+2)+'px'}});
// Density is always compact (the choice was removed from Configuración).
try{if(typeof S!=='undefined'&&S&&typeof persist==='function'&&S.density!=='compact'){S.density='compact';persist();render()}}catch{}
try{if(typeof state!=='undefined'&&state&&typeof save==='function'&&state.compact!==true){state.compact=true;save();render()}}catch{}
// lecta · scanned pages inside notes: kept as <img data-scan="id"> (the image lives in IndexedDB) and shown here.
if(moduleId==='journal'&&typeof cleanRich==='function'){
 const cleanBefore=cleanRich;
 cleanRich=function(html){const keys=[];
  const marked=String(html||'').replace(/<img\b[^>]*\bdata-scan="((?:scan|media)-[\w-]{6,64})"[^>]*>/gi,(m,key)=>{keys.push(key);return '⁣SCAN'+(keys.length-1)+'⁣'});
  return cleanBefore(marked).replace(/⁣SCAN(\d+)⁣/g,(m,i)=>keys[+i]?`<img class="note-scan" data-scan="${keys[+i]}" alt="Escaneo">`:'')};
 if(typeof schemas!=='undefined'&&schemas.notes)try{render()}catch{}
 const show=()=>{for(const img of document.querySelectorAll('img[data-scan]:not([src])')){img.setAttribute('src','data:,');parent.EcosystemHost.scanURL(img.dataset.scan).then(url=>{if(url)img.src=url;else img.alt='Imagen no disponible en este dispositivo'})}};
 new MutationObserver(show).observe(document.body,{childList:true,subtree:true});show();
}
// lecta · recommendations with AI. A small "ask the AI" bar on books, movies and music. Movies and music land in
// the discovery catalogue (the "✨ Para vos" chip) with cover, synopsis and trailer like the built-in picks;
// books come back as covers you can open and save.
if(moduleId==='journal'&&typeof mediaPage==='function'&&typeof mediaItems==='function'){
 const reco={},KIND={books:'Libro',movies:'Película',music:'Música'},HINT={books:'un libro corto para el verano',movies:'algo corto y para reírme',music:'algo tranquilo para trabajar'};
 const SPARK='<svg class="ai-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';
 const SEEDS=typeof DISCOVERY_SEEDS!=='undefined'&&Array.isArray(DISCOVERY_SEEDS)?DISCOVERY_SEEDS:null,FOR_YOU='Para vos';
 const n=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const addSeeds=list=>{if(!SEEDS)return;for(const it of [...list].reverse())if(!SEEDS.some(x=>x.id===it.id))SEEDS.unshift(it)};
 if(SEEDS){S.prefs.aiDiscovery=Array.isArray(S.prefs.aiDiscovery)?S.prefs.aiDiscovery:[];addSeeds(S.prefs.aiDiscovery)}
 const keep=()=>{if(SEEDS)S.prefs.aiDiscovery=S.prefs.aiDiscovery.map(x=>SEEDS.find(s=>s.id===x.id)||x)};
 // ---- one film's poster, Spanish synopsis and platforms in Argentina (/api/movie: TMDB, Apple, Wikipedia) ----
 const infoJobs=new Map(),WEEK=7*864e5;S.prefs.movieInfo=S.prefs.movieInfo&&typeof S.prefs.movieInfo==='object'?S.prefs.movieInfo:{};
 const infoKey=r=>n(r.original||r.name)+'|'+(r.year||'');
 function movieInfo(r){const key=infoKey(r),cached=S.prefs.movieInfo[key];if(cached&&cached.source&&Date.now()-cached.at<WEEK)return Promise.resolve(cached);
  if(!infoJobs.has(key))infoJobs.set(key,catalogJSON('/api/movie?'+new URLSearchParams({title:r.name||'',original:r.original||'',year:r.year||''})).then(d=>{
   const v={at:Date.now(),source:d.source||'open',poster:d.poster||'',synopsis:d.synopsis||'',providers:Array.isArray(d.providers)?d.providers.slice(0,16):[],link:d.link||'',search:d.search||'',tmdb:!!d.tmdb,checked:!!d.checked,runtime:d.runtime||0};
   const keys=Object.keys(S.prefs.movieInfo);if(keys.length>80)for(const k of keys.sort((a,b)=>S.prefs.movieInfo[a].at-S.prefs.movieInfo[b].at).slice(0,keys.length-80))delete S.prefs.movieInfo[k];
   S.prefs.movieInfo[key]=v;return v}).catch(()=>{infoJobs.delete(key);return null}));
  return infoJobs.get(key)}
 const realOf=id=>SEEDS?.find(s=>s.id===id)||record('library',id);
 function applyInfo(r,info){if(!r||!info)return false;let changed=false;
  // TMDB's poster is the film's own: it replaces guesses from Wikipedia (e.g. «Ratatouille» the dish)
  if(info.poster&&(info.source==='tmdb'&&r.cover!==info.poster&&!r.coverChosen||!r.cover||(typeof brokenMovieCovers!=='undefined'&&brokenMovieCovers.has(r.cover)))){r.cover=info.poster;changed=true}
  if(info.synopsis&&info.synopsis.length>60&&!r.officialSynopsis){r.aiSynopsis||=r.ai?r.synopsis:'';r.synopsis=info.synopsis;r.officialSynopsis=true;changed=true}
  return changed}
 // covers for any film still without one (AI picks, saved films, search results)
 if(typeof ensureMovieAssets==='function'){const ensureBefore=ensureMovieAssets;ensureMovieAssets=async function(rows){await ensureBefore(rows);
  const missing=(rows||[]).filter(r=>r&&(!r.tmdbChecked||!r.cover||(typeof brokenMovieCovers!=='undefined'&&brokenMovieCovers.has(r.cover))));
  if(missing.length){let dirty=false;await Promise.all(missing.map(async r=>{const info=await movieInfo(r);if(info)r.tmdbChecked=true;if(applyInfo(r,info)){dirty=true;const real=realOf(r.id);if(real&&real!==r){applyInfo(real,info);real.tmdbChecked=true}}}));if(dirty){keep();persist()}}}
  // every poster on the movies screen (Para ver, diary, lists, search), not only the recommendations
  const renderPosters=render;let posterPass=0;render=function(...a){const out=renderPosters(...a);if(screen==='movies'){const pass=++posterPass;setTimeout(()=>{if(pass!==posterPass)return;
   const ids=[...new Set([...document.querySelectorAll('[onclick^="showMovieDetail("]')].map(b=>/showMovieDetail\('([^']+)'\)/.exec(b.getAttribute('onclick'))?.[1]).filter(Boolean))];
   const rows=ids.map(id=>realOf(id)||resolveMovie(id)).filter(Boolean);if(!rows.length)return;
   ensureMovieAssets(rows).then(()=>{if(pass!==posterPass||screen!=='movies')return;for(const id of ids){const r=resolveMovie(id);if(!r?.cover)continue;for(const b of document.querySelectorAll(`[onclick="showMovieDetail('${CSS.escape(id)}')"]`)){const box=b.querySelector('.film-poster-image,.movie-tile-head');const img=box?.querySelector('img');if(box&&(!img||img.getAttribute('src')!==r.cover)){const holder=box.classList.contains('film-poster-image')?box:null;if(holder)holder.innerHTML=moviePosterMarkup(r)}}}})},120)}return out}}
 const toSeed=(type,it)=>({id:'ai-'+(type==='movies'?'movie':'music')+'-'+n(it.title).replace(/ /g,'-').slice(0,40)+(it.year?'-'+it.year:''),type,name:it.title,original:it.original||'',author:it.creator||'',year:it.year||'',genre:FOR_YOU,realGenre:it.genre||'',
  synopsis:it.synopsis||'',why:it.why||'',cover:it.cover||'',url:it.url||'',previewUrl:it.previewUrl||'',ai:true});
 // music: cover and preview from Apple's catalogue (the one lecta already uses)
 async function enrichSong(it){try{const term=encodeURIComponent([it.original||it.title,it.creator].filter(Boolean).join(' '));
   const data=await catalogJSON(`https://itunes.apple.com/search?term=${term}&entity=song&limit=6&country=AR`),rows=data?.results||[],t=n(it.original||it.title),t2=n(it.title);
   const best=rows.find(r=>[n(r.trackName),n(r.collectionName),n(r.artistName)].some(x=>x&&(x===t||x===t2||x.startsWith(t)||x.startsWith(t2))))||rows[0];if(!best)return it;
   return {...it,cover:String(best.artworkUrl100||'').replace(/\/\d+x\d+bb\./,'/600x600bb.'),url:best.trackViewUrl||best.collectionViewUrl||'',previewUrl:best.previewUrl||''}}catch{return it}}
 // books: cover from Open Library
 async function enrichBook(it){try{const data=await catalogJSON('https://openlibrary.org/search.json?'+new URLSearchParams({title:it.original||it.title,author:it.creator||'',limit:'3',fields:'title,cover_i,first_publish_year,key'}));
   const d=(data?.docs||[]).find(d=>d.cover_i);return d?{...it,cover:`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,year:it.year||String(d.first_publish_year||'')}:it}catch{return it}}
 const bookShelf=type=>{const items=reco[type]?.items||[];if(!items.length)return '';
  return `<div class="ai-shelf">${items.map((it,i)=>`<button type="button" class="ai-book" onclick="openEcosystemBook(${i})" aria-label="Ver ${esc(it.title)}"><span class="ai-book-cover">${it.cover?`<img src="${esc(it.cover)}" alt="" loading="lazy" onerror="this.remove()">`:''}<span>${esc(it.title)}</span></span><strong>${esc(it.title)}</strong><small>${esc(it.creator||it.year||'')}${it.saved?' · Guardado':''}</small></button>`).join('')}</div>`};
 const card=type=>{const r=reco[type]||{},status=r.error?`<span class="ai-error">${esc(r.error)}</span>`:r.loading?'Buscando recomendaciones…':r.done?`${r.done} ${r.done===1?'nueva':'nuevas'} en «✨ ${FOR_YOU}». Tocá una portada.`:r.items?.length?'Tocá un libro para ver de qué trata.':'';
  return `<section class="ai-reco${r.loading?' is-loading':''}" data-reco="${type}"><form class="ai-ask" onsubmit="event.preventDefault();askEcosystemReco('${type}')">${SPARK}<input id="aiWish-${type}" maxlength="300" enterkeyhint="search" autocomplete="off" placeholder="Pedile a la IA: ${HINT[type]}" value="${esc(r.wish||'')}" aria-label="Qué querés que te recomiende la IA"><button type="submit" class="ai-go" ${r.loading?'disabled':''} aria-label="Recomendar">${r.loading?'<span class="ai-dots"><i></i><i></i><i></i></span>':icon('right')}</button></form>${status?`<p class="ai-status">${status}${r.items||r.error||r.done?`<button type="button" class="ai-clear" onclick="closeEcosystemReco('${type}')">Cerrar</button>`:''}</p>`:''}${type==='books'||!SEEDS?bookShelf(type):''}</section>`};
 const pageBeforeAI=mediaPage;mediaPage=function(type){const html=pageBeforeAI(type).replace('No hay más opciones en esta selección inicial. Buscá un título arriba.','✨ Buscando más recomendaciones para vos…');if(!KIND[type])return html;const holder=document.createElement('div');holder.innerHTML=html;
  const head=holder.querySelector('.pagehead,.cinema-page>h1');const t=document.createElement('template');t.innerHTML=card(type);if(head)head.after(t.content);else holder.prepend(t.content);
  const chips=holder.querySelector('.cinema-genres');if(type==='movies'&&chips&&SEEDS?.some(r=>r.ai&&r.type==='movies')){let open=false;try{open=cinemaRecsOpened}catch{}
   const on=open&&discoveryGenre.movies===FOR_YOU,b=document.createElement('button');b.setAttribute('aria-pressed',String(on));if(on)b.className='active';b.setAttribute('onclick',`cinemaChooseGenre('${FOR_YOU}')`);b.textContent='✨ '+FOR_YOU;chips.prepend(b)}
  return holder.innerHTML};
 if(typeof resolveMovie==='function'){const resolveBefore=resolveMovie;resolveMovie=function(id){const r=resolveBefore(id);return r?.ai&&r.realGenre?{...r,genre:r.realGenre}:r}}
 window.closeEcosystemReco=type=>{reco[type]={};render()};
 window.askEcosystemReco=async type=>{const wish=document.getElementById('aiWish-'+type)?.value.trim()||'';document.activeElement?.blur?.();reco[type]={...reco[type],wish,loading:true,error:''};render();
  try{const saved=mediaItems(type).map(r=>({title:r.name,creator:r.author,status:mediaStatus(type,r.status),rating:r.rating}));
   const r=await parent.EcosystemHost.ai({task:'recommend',kind:type,saved,wish});if(!r.items?.length)throw Error('La IA no devolvió recomendaciones. Probá de nuevo.');
   if(SEEDS&&type!=='books'){const seeds=(await Promise.all(r.items.map(it=>type==='music'?enrichSong(it):it))).map(it=>toSeed(type,it));
    if(type==='movies')await Promise.all(seeds.map(async s=>applyInfo(s,await Promise.race([movieInfo(s),new Promise(ok=>setTimeout(ok,6000))]))));
    addSeeds(seeds);S.prefs.aiDiscovery=[...seeds,...S.prefs.aiDiscovery.filter(x=>!seeds.some(s=>s.id===x.id))].slice(0,40);
    if(Array.isArray(S.prefs.dismissedDiscovery))S.prefs.dismissedDiscovery=S.prefs.dismissedDiscovery.filter(id=>!seeds.some(s=>s.id===id));
    try{discoveryTab[type]='discover';discoveryGenre[type]=FOR_YOU;discoveryOffset[type]=0}catch{}
    try{if(type==='movies')cinemaRecsOpened=true}catch{}
    persist();reco[type]={wish,done:seeds.length};render();
    setTimeout(()=>document.querySelector('.cinema-genres,.film-poster-grid,.discovery-grid,.film-genres,.discovery-cards')?.scrollIntoView({behavior:'smooth',block:'start'}),60)}
   else{reco[type]={wish,items:r.items};render();reco[type].items=await Promise.all(r.items.map(enrichBook));if(screen==='books')render()}}
  catch(e){reco[type]={...reco[type],loading:false,error:e.message||'No se pudo pedir a la IA.'};render()}};
 // ---- never run out: on the last page of a genre, the AI brings more of that genre (movies and music) ----
 const asked=new Map();
 async function refill(type,genre){const key=type+'|'+genre,last=asked.get(key)||0;if(Date.now()-last<120000)return;asked.set(key,Date.now());
  try{const saved=mediaItems(type).map(r=>({title:r.name,creator:r.author,status:mediaStatus(type,r.status),rating:r.rating}));
   const exclude=SEEDS.filter(r=>r.type===type).map(r=>r.name);
   const label=genre==='all'||genre===FOR_YOU?'':genre;
   const r=await parent.EcosystemHost.ai({task:'recommend',kind:type,saved,exclude,wish:label?`Que sean del género ${label}.`:'Variado, distinto de lo anterior.'});
   let seeds=(await Promise.all((r.items||[]).map(it=>type==='music'?enrichSong(it):it))).map(it=>({...toSeed(type,it),genre:label||FOR_YOU}));
   seeds=seeds.filter(s=>!SEEDS.some(x=>x.id===s.id||n(x.name)===n(s.name)));if(!seeds.length)return;
   if(type==='movies')await Promise.all(seeds.map(async s=>applyInfo(s,await Promise.race([movieInfo(s),new Promise(ok=>setTimeout(ok,6000))]))));
   for(const s of seeds)SEEDS.push(s);S.prefs.aiDiscovery=[...S.prefs.aiDiscovery,...seeds].slice(-80);persist();if(screen===type)render()}catch{asked.set(key,Date.now()-90000)}}
 if(typeof discoveryItems==='function'&&SEEDS){const itemsBefore=discoveryItems;discoveryItems=function(type){const rows=itemsBefore(type);if(type==='movies'||type==='music'){try{
   const genre=discoveryGenre[type],dismissed=S.prefs.dismissedDiscovery||[],pool=SEEDS.filter(r=>r.type===type&&(genre==='all'||r.genre===genre)&&!dismissed.includes(r.id)&&!(type==='movies'?savedMovie(r):savedDiscoveryItem?.(r)));
   const pages=Math.max(1,Math.ceil(pool.length/4)),page=(discoveryOffset[type]||0)%pages;if(rows.length<4||page>=pages-1)refill(type,genre)}catch{}}return rows}}
 // ---- "Resumen sin spoilers" (AI) for films and books ----
 S.prefs.aboutWorks=S.prefs.aboutWorks&&typeof S.prefs.aboutWorks==='object'?S.prefs.aboutWorks:{};
 const aboutHTML=a=>`${String(a.summary||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('')}${a.forWho?`<p class="ai-forwho"><strong>Para quién:</strong> ${esc(a.forWho)}</p>`:''}${a.mood?.length?`<div class="ai-mood">${a.mood.map(m=>`<span>${esc(m)}</span>`).join('')}</div>`:''}`;
 async function about(kind,r,box){const key=kind+'|'+n(r.original||r.name)+'|'+(r.year||''),cached=S.prefs.aboutWorks[key];
  if(cached){box.innerHTML=aboutHTML(cached);return}
  box.innerHTML='<p class="ai-status">Pensando un resumen sin spoilers…</p>';
  try{const a=await parent.EcosystemHost.ai({task:'about',kind,title:r.name,original:r.original||'',creator:r.author||'',year:r.year||'',synopsis:r.synopsis||''});
   if(!a.summary)throw Error('La IA no devolvió el resumen.');const ks=Object.keys(S.prefs.aboutWorks);if(ks.length>40)delete S.prefs.aboutWorks[ks[0]];S.prefs.aboutWorks[key]=a;persist();if(box.isConnected)box.innerHTML=aboutHTML(a)}
  catch(e){if(box.isConnected)box.innerHTML=`<p class="ai-status"><span class="ai-error">${esc(e.message||'No se pudo pedir a la IA.')}</span></p>`}}
 const aboutBlock=(kind,id)=>`<section class="cinema-about ai-about"><button type="button" class="ai-about-btn" onclick="ecosystemAbout('${kind}','${esc(id)}',this)">${SPARK}Resumen sin spoilers</button><div class="ai-about-body"></div></section>`;
 window.ecosystemAbout=(kind,id,btn)=>{const r=kind==='libro'?reco.books?.items?.[+id]:resolveMovie(id);const box=btn.parentElement.querySelector('.ai-about-body');if(!r||!box)return;btn.hidden=true;about(kind,r,box)};
 window.openEcosystemBook=i=>{const it=reco.books?.items?.[i];if(!it)return;
  openModal(it.title,`<div class="cinema-detail ai-book-detail"><div class="cinema-film-hero"><span class="cinema-cover">${it.cover?`<img src="${esc(it.cover)}" alt="Tapa de ${esc(it.title)}">`:`<span class="movie-asset-fallback">${icon('book')}</span>`}</span><div><h2>${esc(it.title)}</h2><p class="small">${[it.creator,it.year,it.genre].filter(Boolean).map(esc).join(' · ')}</p></div></div>${it.why?`<p class="ai-why">${SPARK}${esc(it.why)}</p>`:''}<section class="cinema-about"><h3>Sinopsis</h3><p>${esc(it.synopsis||'Todavía no hay una sinopsis.')}</p></section>${aboutBlock('libro',String(i))}<div class="actions movie-actions"><button class="primary" ${it.saved?'disabled':''} onclick="saveEcosystemReco('books',${i});closeModal()">${icon('plus')}${it.saved?'Guardado':'Quiero leer'}</button></div></div>`,true);document.getElementById('modal')?.classList.add('cinema-sheet')};
 window.saveEcosystemReco=(type,i)=>{const it=reco[type]?.items?.[i];if(!it||it.saved)return;
  storeRecord('library',{name:it.title,kind:KIND[type],author:it.creator,year:it.year,genre:it.genre||'',cover:it.cover||'',synopsis:it.synopsis||'',status:'Por empezar',progress:0,notes:it.why?'Recomendado por la IA: '+it.why:'Recomendado por la IA'});
  it.saved=true;save('Guardado')};
 // ---- film sheet: better synopsis, "Resumen sin spoilers", where to watch it in Argentina; "Quiero ver" closes it ----
 const KINDS={stream:'Incluida en',free:'Gratis',rent:'Alquiler',buy:'Compra'};
 const whereHTML=(info,r)=>{if(!info)return `<h3>Dónde verla en Argentina</h3><p class="cinema-quiet">No se pudo consultar ahora.</p><a class="ai-jw" href="https://www.justwatch.com/ar/buscar?q=${encodeURIComponent(r.name)}" target="_blank" rel="noopener">Buscar en JustWatch</a>`;
  const groups=['stream','free','rent','buy'].map(k=>[k,info.providers.filter(p=>p.kind===k)]).filter(([,l])=>l.length);
  const short=n=>String(n).replace(/ Amazon Channel$| Apple TV Channel$/,'').replace(/ Store$/,'').replace(/^Amazon Video$/,'Prime Video');
  const chips=l=>`<div class="ai-providers">${l.map(p=>`<span class="ai-provider" title="${esc(p.name)}"><span class="ai-provider-logo">${p.logo?`<img src="${esc(p.logo)}" alt="" loading="lazy">`:esc(p.name.slice(0,1))}</span><small>${esc(short(p.name))}</small></span>`).join('')}</div>`;
  return `<h3>Dónde verla en Argentina</h3>${groups.length?groups.map(([k,l])=>`<p class="ai-provider-label">${KINDS[k]}</p>${chips(l)}`).join(''):`<p class="cinema-quiet">${info.tmdb&&info.checked?'Por ahora no está en plataformas de Argentina.':'Fijate en JustWatch en qué plataforma está.'}</p>`}<a class="ai-jw" href="${esc(info.link||info.search)}" target="_blank" rel="noopener">${groups.length?'Ver todas las opciones':'Buscar en JustWatch'}</a>${info.tmdb?'<p class="ai-credit">Datos de JustWatch vía TMDB</p>':''}`};
 if(typeof showMovieDetail==='function'){const sheetBefore=showMovieDetail;showMovieDetail=function(id){sheetBefore(id);const r=resolveMovie(id),detail=document.querySelector('.cinema-detail');if(!r||!detail||detail.dataset.film!==id)return;
  const syn=detail.querySelector('.cinema-about');
  const extra=document.createElement('template');extra.innerHTML=`${r.why?`<p class="ai-why">${SPARK}${esc(r.why)}</p>`:''}${aboutBlock('película',id)}<section class="cinema-about ai-where" id="movieWhere"><h3>Dónde verla en Argentina</h3><p class="cinema-quiet" role="status">Buscando plataformas…</p></section>`;
  const nodes=[...extra.content.children];if(syn){if(r.why)syn.before(nodes.shift());syn.after(...nodes)}else detail.append(...nodes);
  movieInfo(r).then(info=>{if(!document.querySelector(`.cinema-detail[data-film="${CSS.escape(id)}"]`))return;const where=document.getElementById('movieWhere');if(where)where.innerHTML=whereHTML(info,r);
   const real=realOf(id);if(applyInfo(real,info)){keep();persist()}applyInfo(r,info);
   const p=detail.querySelector('.cinema-about p');if(p&&info?.synopsis&&info.synopsis.length>60)p.textContent=r.synopsis;
   if(info?.runtime){const meta=detail.querySelector('.cinema-film-hero .small');if(meta&&!/min/.test(meta.textContent))meta.textContent+=` · ${info.runtime} min`}
   const cover=detail.querySelector('.cinema-film-hero .cinema-cover');if(cover&&r.cover&&!cover.querySelector('img'))cover.innerHTML=moviePosterMarkup(r)})}}
 if(typeof wantMovie==='function'){const wantBefore=wantMovie;wantMovie=function(id){wantBefore(id);if(document.getElementById('modal')?.open&&document.querySelector('.cinema-detail'))closeModal()}}
 try{render()}catch{} // the first screen was drawn before this wrapper existed
}
// Dictation: a microphone inside the text field you are writing in (Web Speech API, Spanish from Argentina).
(()=>{
 const Rec=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
 const writable=el=>!!el&&!el.disabled&&!el.readOnly&&(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&/^(text|search)$/.test(el.type||'text'))||el.isContentEditable)&&!el.closest('[data-no-dictation]');
 const MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
 let field=null,rec=null,target=null,btn=null,live=null,hideTimer=0;
 const say=text=>{try{parent.EcosystemHost.notify(moduleId,text)}catch{}};
 function ui(){if(btn)return;btn=document.createElement('button');btn.type='button';btn.id='dictate';btn.hidden=true;btn.innerHTML=MIC;btn.setAttribute('aria-label','Dictar');
  live=document.createElement('div');live.id='dictateLive';live.hidden=true;live.setAttribute('aria-live','polite');document.body.append(btn,live);
  btn.addEventListener('pointerdown',e=>e.preventDefault()); // keeps the field focused (and the keyboard up)
  btn.addEventListener('mousedown',e=>e.preventDefault());btn.addEventListener('click',()=>rec?stop():start())}
 function place(){if(!btn||btn.hidden||!field)return;const r=field.getBoundingClientRect(),size=34,tall=field.tagName!=='INPUT';
  const bottom=Math.min(r.bottom,innerHeight-8);let top=tall?bottom-size-6:r.top+(r.height-size)/2;top=Math.max(r.top+4,top);
  btn.style.left=Math.round(r.right-size-6)+'px';btn.style.top=Math.round(top)+'px';
  if(!live.hidden){live.style.left=Math.max(8,Math.round(r.left))+'px';live.style.top=Math.max(8,Math.round(top-40))+'px'}
  btn.style.visibility=r.bottom<0||r.top>innerHeight?'hidden':'visible'}
 function show(el){if(!Rec())return;ui();clearTimeout(hideTimer);if(field&&field!==el)field.classList.remove('has-dictation');field=el;el.classList.add('has-dictation');btn.hidden=false;paint();place()}
 function hide(){if(rec)stop();field?.classList.remove('has-dictation');field=null;if(btn){btn.hidden=true;live.hidden=true}}
 function paint(){if(!btn)return;btn.classList.toggle('on',!!rec);btn.setAttribute('aria-label',rec?'Dejar de dictar':'Dictar');btn.setAttribute('aria-pressed',String(!!rec))}
 function insert(el,text){text=text.replace(/\s+/g,' ').trim();if(!text)return;
  const value=el.isContentEditable?'':el.value,startAt=el.isContentEditable?0:el.selectionStart??value.length,endAt=el.isContentEditable?0:el.selectionEnd??startAt,before=el.isContentEditable?(getSelection()?.anchorNode?.textContent||'').slice(0,getSelection()?.anchorOffset||0):value.slice(0,startAt);
  if(!before.trim()||/[.!?¡¿]\s*$/.test(before))text=text[0].toLocaleUpperCase('es')+text.slice(1);
  const piece=(before&&!/\s$/.test(before)?' ':'')+text;
  if(el.isContentEditable){el.focus();document.execCommand('insertText',false,piece)}
  else{el.setRangeText(piece,startAt,endAt,'end');el.dispatchEvent(new Event('input',{bubbles:true}))}}
 function start(){const R=Rec();if(!R||!field)return;target=field;
  try{rec=new R()}catch{say('No se pudo iniciar el dictado. Usá el micrófono del teclado.');return}
  rec.lang='es-AR';rec.interimResults=true;rec.continuous=true;rec.maxAlternatives=1;
  rec.onresult=e=>{let done='',heard='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)done+=t;else heard+=t}
   if(done)insert(target,done);live.textContent=heard;live.hidden=!heard;place()};
  rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed')say('Permití el micrófono para dictar, o usá el del teclado.');else if(!['no-speech','aborted'].includes(e.error))say('No se pudo dictar. Probá de nuevo.')};
  rec.onend=()=>{rec=null;live.hidden=true;paint()};
  try{rec.start();paint()}catch{rec=null;paint();say('No se pudo iniciar el dictado.')}}
 function stop(){try{rec?.stop()}catch{}}
 document.addEventListener('focusin',e=>{if(writable(e.target))show(e.target)});
 document.addEventListener('focusout',e=>{if(e.target!==field)return;hideTimer=setTimeout(()=>{if(document.activeElement!==field)hide()},150)});
 for(const ev of ['scroll','resize'])addEventListener(ev,place,{capture:true,passive:true});
 document.addEventListener('input',e=>{if(e.target===field)place()});
 window.ecosystemDictation={start,stop,insert,get listening(){return !!rec}};
})();
parent.EcosystemHost.ready(moduleId);



