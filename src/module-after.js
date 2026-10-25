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

 launchApplication=function(page){const map={expenses:'iris',space:'mi-espacio',notes:'journal',tasks:'organizador'};if(map[page]){closeModal();parent.EcosystemHost.switchApp(map[page])}};

 const oldGo=go;go=function(v){const apps={expenses:'iris',space:'mi-espacio',notes:'journal',tasks:'organizador'};if(apps[v]){parent.EcosystemHost.switchApp(apps[v]);return}oldGo(v);parent.EcosystemHost.route('centro',{ecosystemRoute:true,app:'centro',view:v},false)};

 // Centro's previous app links now open the corresponding internal section.

 const centroRender=render;render=function(){centroRender();document.querySelectorAll('[onclick]').forEach(button=>{const call=button.getAttribute('onclick')||'';const match=/^openApp\(['"]([^'"]+)['"]\)/.exec(call);if(match){const map={iris:'iris',organizer:'organizador',space:'mi-espacio',journal:'journal'};if(map[match[1]])button.onclick=()=>parent.EcosystemHost.switchApp(map[match[1]])}})};

}



// The parent owns the iOS status-area color, even though screens are retained.

window.ecosystemReportTheme=()=>{const c=getComputedStyle(document.body),dark=document.body.classList.contains('dark');document.documentElement.dataset.ecosystemTheme=dark?'dark':'light';document.documentElement.style.setProperty('--ecosystem-edge',c.getPropertyValue('--panel'));parent.EcosystemHost.theme(moduleId,{dark,panel:c.getPropertyValue('--panel').trim(),bg:c.getPropertyValue('--bg').trim()})};

new MutationObserver(window.ecosystemReportTheme).observe(document.body,{attributes:true,attributeFilter:['class','data-app']});window.ecosystemReportTheme();

const retainedNotify=notify;notify=function(text,undo=false){if(undo||document.getElementById('modal')?.open||typeof persistenceProblem!=='undefined'&&persistenceProblem||typeof saveFailed!=='undefined'&&saveFailed)return retainedNotify(text,undo);parent.EcosystemHost.notify(moduleId,String(text))};

window.ecosystemAction=action=>{if(moduleId==='iris'&&['expense','income'].includes(action))movementForm(action==='income'?'incomes':'expenses');else if(moduleId==='journal'&&action==='note')noteForm();else if(moduleId==='organizador'&&action==='task')taskForm()};

if(moduleId==='organizador'){

 let lastPushTimer=null;
 const reportFocus=()=>{const t=ensureTimer();if(t.running&&t.id){lastPushTimer=t.id;parent.EcosystemHost.timer({id:'timer:'+t.id,due:t.endAt})}else if(lastPushTimer){if(t.remaining>0)parent.EcosystemHost.timer({id:'timer:'+lastPushTimer,due:null});lastPushTimer=null;}parent.EcosystemHost.activity((t.running||t.id)&&!document.getElementById('focusStage')?{id:t.id,title:t.mode==='break'?'Descanso':'Concentración',message:timerDisplay()+' · Volver al Pomodoro',kind:'timer',app:'organizador',view:'focus',action:{label:t.running?'Pausar':'Seguir',run:()=>toggleTimer()}}:null)};

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
 const kitchenReport=()=>{
  const t=S.kitchenTimer;if(!t){parent.EcosystemHost.activity(null,'kitchen');return}
  const remaining=Math.max(0,Math.ceil((t.endAt-Date.now())/1000));
  if(!remaining){S.kitchenTimer=null;persist();parent.EcosystemHost.activity(null,'kitchen');notify('Terminó el temporizador de cocina');return}
  parent.EcosystemHost.timer({id:'timer:'+t.id,due:t.endAt,kind:'recipe'});
  parent.EcosystemHost.activity({id:t.id,title:'En la cocina',message:Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0'),kind:'timer',app:'mi-espacio',view:'recipes',priority:1,action:{label:'Cancelar',run:()=>{parent.EcosystemHost.timer({id:'timer:'+t.id,due:null,kind:'recipe'});S.kitchenTimer=null;persist();kitchenReport()}}},'kitchen');
 };
 function kitchenForm(){openModal('Temporizador de cocina','<form id="kitchenTimerForm" class="form"><label>Minutos<input name="minutes" type="number" inputmode="numeric" min="1" max="240" value="10" required></label><button class="primary">Iniciar temporizador</button><button type="button" onclick="closeModal()">Cancelar</button></form>');document.getElementById('kitchenTimerForm').onsubmit=e=>{e.preventDefault();const minutes=Number(e.target.elements.minutes.value);if(!Number.isFinite(minutes)||minutes<1||minutes>240)return;if(S.kitchenTimer)parent.EcosystemHost.timer({id:'timer:'+S.kitchenTimer.id,due:null,kind:'recipe'});S.kitchenTimer={id:crypto.randomUUID(),endAt:Date.now()+minutes*60000};persist();closeModal();kitchenReport()}}
 const kitchenRender=render;render=function(...args){const result=kitchenRender(...args);if(screen==='recipes'){const button=document.createElement('button');button.textContent='Temporizador de cocina';button.style.marginBottom='16px';button.onclick=kitchenForm;document.getElementById('content')?.prepend(button)}return result};
 setInterval(kitchenReport,1000);kitchenReport();render();
}
window.ecosystemViewport=({bottom,keyboard})=>{document.documentElement.style.setProperty('--host-safe-bottom',bottom+'px');document.documentElement.dataset.keyboard=keyboard?'open':'closed'};
document.documentElement.dataset.hostNavigation='true';
window.ecosystemReportNavigation=()=>{const source=document.getElementById(moduleId==='centro'?'nav':moduleId==='iris'?'mobileIris':'mobileNav');if(source)parent.EcosystemHost.navigation(moduleId,source)};
const navigationSource=document.getElementById(moduleId==='centro'?'nav':moduleId==='iris'?'mobileIris':'mobileNav');
if(navigationSource)new MutationObserver(window.ecosystemReportNavigation).observe(navigationSource,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-current']});
window.ecosystemReportNavigation();
parent.EcosystemHost.ready(moduleId);



