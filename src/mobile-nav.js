// Mobile navigation lives in the top-level document so iOS cannot anchor it to an iframe viewport.
export function createMobileNav({names,current,switchApp,document:doc=document,clock=globalThis}){
 const nav=doc.createElement('nav');nav.id='hostMobileNav';nav.setAttribute('aria-label','Navegación principal');doc.body.append(nav);
 const picker=doc.createElement('div');picker.id='hostAppPicker';picker.hidden=true;picker.setAttribute('role','listbox');picker.setAttribute('aria-label','Cambiar de app');doc.body.append(picker);
 let timer=null,pointer=null,opened=false,selected=null;
 const icons={iris:'numio','mi-espacio':'domo',journal:'lecta',organizador:'foco'};
 const mark=id=>icons[id]?'<img alt="" src="/brand/'+icons[id]+'-'+(doc.documentElement.dataset.theme==='dark'?'dark':'light')+'.svg">':'<img alt="" src="/icon.svg">';
 function cancel(){clock.clearTimeout(timer);timer=null;pointer=null;opened=false;selected=null;picker.hidden=true;nav.querySelector('[aria-haspopup]')?.setAttribute('aria-expanded','false')}
 function track(e){selected=null;for(const item of picker.querySelectorAll('[data-app]')){const r=item.getBoundingClientRect(),hit=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top-18&&e.clientY<=r.bottom+16;item.classList.toggle('selected',hit);if(hit)selected=item.dataset.app}}
 function reveal(){opened=true;picker.hidden=false;nav.querySelector('[aria-haspopup]')?.setAttribute('aria-expanded','true')}
 function switchButton(){const b=doc.createElement('button');b.innerHTML=mark(current())+'<span>'+names[current()]+'</span>';b.setAttribute('aria-label','Cambiar de app. Mantené presionado y deslizá.');b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');b.className='host-app-switch';
  b.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();cancel();pointer=e.pointerId;b.setPointerCapture(e.pointerId);timer=clock.setTimeout(reveal,350)};
  b.onpointermove=e=>{if(e.pointerId===pointer&&opened){e.preventDefault();track(e)}};
  b.onpointerup=e=>{if(e.pointerId!==pointer)return;e.preventDefault();if(opened)track(e);const target=selected;cancel();if(target)switchApp(target)};
  b.addEventListener('selectstart',e=>e.preventDefault());b.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});b.onpointercancel=cancel;b.onlostpointercapture=cancel;b.oncontextmenu=e=>e.preventDefault();b.onclick=e=>e.preventDefault();
  b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!opened)reveal()}else if(e.key==='Escape')cancel();else if(opened&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const items=[...picker.querySelectorAll('[data-app]')],i=items.findIndex(x=>x.dataset.app===selected),next=(i+(e.key==='ArrowRight'?1:-1)+items.length)%items.length;selected=items[next].dataset.app;items.forEach((x,j)=>x.classList.toggle('selected',j===next))}};
  b.onkeyup=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();const target=selected;cancel();if(target)switchApp(target)}};return b;
 }
 return {sync(id,source){if(id!==current()||!source)return;cancel();nav.replaceChildren();for(const original of [...source.children].filter(e=>e.tagName==='BUTTON'&&!e.classList.contains('app-switch-trigger')).slice(0,4)){const b=doc.createElement('button');b.innerHTML=original.innerHTML;b.className=original.className;b.onclick=()=>original.click();for(const key of ['aria-label','aria-current','title'])if(original.hasAttribute(key))b.setAttribute(key,original.getAttribute(key));nav.append(b)}nav.append(switchButton());picker.replaceChildren();for(const [app,name]of Object.entries(names)){const item=doc.createElement('div');item.dataset.app=app;item.setAttribute('role','option');item.innerHTML=mark(app);const label=doc.createElement('span');label.textContent=name;item.append(label);picker.append(item)}nav.hidden=false},hide(){cancel();nav.hidden=true},cancel};
}
