import {easing} from './motion.js';
// Mobile navigation lives in the top-level document so iOS cannot anchor it to an iframe viewport.
export function createMobileNav({names,current,switchApp,document:doc=document,clock=globalThis}){
 const nav=doc.createElement('nav');nav.id='hostMobileNav';nav.setAttribute('aria-label','Navegación principal');doc.body.append(nav);
 const picker=doc.createElement('div');picker.id='hostAppPicker';picker.hidden=true;picker.setAttribute('role','listbox');picker.setAttribute('aria-label','Cambiar de app');doc.body.append(picker);
 let timer=null,pointer=null,opened=false,selected=null,origin=null,anims=[],shape=null,closing=null;
 const motion=()=>!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const icons={iris:'numio','mi-espacio':'domo',journal:'lecta',organizador:'foco'};
 const BRAND={nubo:['/brand/nubo-light.svg','/brand/nubo-dark.svg'],numio:['/brand/numio-light.svg','/brand/numio-dark.svg'],domo:['/brand/domo-light.svg','/brand/domo-dark.svg'],lecta:['/brand/lecta-light.svg','/brand/lecta-dark.svg'],foco:['/brand/foco-light.svg','/brand/foco-dark.svg']}; // full paths: the build turns them into inline images
 const mark=id=>'<img alt="" src="'+(BRAND[icons[id]]||BRAND.nubo)[doc.documentElement.dataset.theme==='dark'?1:0]+'">';
 // Closing with `animate` plays the opening backwards: the pill shrinks back into the Apps button.
 function cancel({animate=false}={}){const wasOpen=opened&&!picker.hidden;clock.clearTimeout(timer);timer=null;pointer=null;origin=null;anims.forEach(a=>a.cancel());anims=[];closing?.cancel();closing=null;
  nav.querySelector('.pressing')?.classList.remove('pressing');opened=false;selected=null;nav.querySelector('[aria-haspopup]')?.setAttribute('aria-expanded','false');
  if(animate&&wasOpen&&shape&&motion()&&typeof picker.animate==='function'){
   const out=picker.animate([{transform:'none',clipPath:shape.end,opacity:1},{transform:shape.start.transform,clipPath:shape.start.clipPath,opacity:.2}],{duration:230,easing:'cubic-bezier(.45,0,.75,.25)',fill:'forwards'});
   for(const x of picker.children)x.animate([{opacity:1},{opacity:0,transform:'scale(.6)'}],{duration:140,easing:'ease-in',fill:'forwards'});
   closing=out;out.onfinish=()=>{if(closing!==out)return;closing=null;picker.hidden=true;picker.classList.remove('morphing');picker.getAnimations?.({subtree:true}).forEach(a=>{if(!a.animationName)a.cancel()});picker.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'))};return}
  picker.classList?.remove('morphing');picker.getAnimations?.({subtree:true}).forEach(a=>{if(!a.animationName)a.cancel()});picker.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));picker.hidden=true}
 // Instagram-style: slide sideways and the nearest icon is picked. Releasing without moving cancels.
 function track(e){selected=null;const items=[...picker.querySelectorAll('[data-app]')],box=picker.getBoundingClientRect();
  const moved=origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>=12,inside=e.clientX>=box.left-32&&e.clientX<=box.right+32&&e.clientY>=box.top-70;
  let best=null,dist=Infinity;if(moved&&inside)for(const item of items){const r=item.getBoundingClientRect(),d=Math.abs(e.clientX-(r.left+r.width/2));if(d<dist){dist=d;best=item}}
  for(const item of items)item.classList.toggle('selected',item===best);if(best)selected=best.dataset.app}
 // The pill is pulled out of the Apps button as a liquid drop, then its icons pop in.
 function reveal(){opened=true;picker.hidden=false;const button=nav.querySelector('[aria-haspopup]');button?.setAttribute('aria-expanded','true');button?.classList.remove('pressing');
  if(!motion()||!button?.getBoundingClientRect||typeof picker.animate!=='function')return;
  // Same physics as the island: the pill is born as a circle on the Apps button and springs out to full width.
  const from=button.getBoundingClientRect(),to=picker.getBoundingClientRect();if(!to.width)return;
  const w=to.width,h=to.height,d=Math.min(h,44),cx=Math.min(w-d/2,Math.max(d/2,from.x+from.width/2-to.x)),dy=(from.y+from.height/2)-(to.y+h/2),v=(h-d)/2;
  picker.classList.add('morphing');
  shape={start:{transform:`translateY(${dy.toFixed(1)}px) scale(.9)`,clipPath:`inset(${v}px ${(w-cx-d/2).toFixed(1)}px ${v}px ${(cx-d/2).toFixed(1)}px round ${d/2}px)`},end:`inset(0px 0px 0px 0px round ${h/2}px)`};
  // a slightly bouncier spring than before, so the pill overshoots a touch and settles like a drop
  anims=[picker.animate([shape.start,{transform:'none',clipPath:shape.end}],{duration:460,easing:easing(.7),fill:'backwards'})];
  // the icons bud off one after another, starting next to the button
  const items=[...picker.children];items.forEach((x,i)=>{const r=x.getBoundingClientRect(),shift=(from.x+from.width/2)-(r.left+r.width/2);
   anims.push(x.animate([{opacity:0,transform:`translateX(${(shift*.35).toFixed(1)}px) scale(.3)`},{opacity:1,transform:'none'}],{duration:420,delay:30+(items.length-1-i)*32,easing:easing(.58),fill:'backwards'}))});
 }
 function switchButton(){const b=doc.createElement('button');b.innerHTML=mark(current())+'<span>Apps</span>'; /* manual: the switcher button is always called Apps */b.setAttribute('aria-label','Cambiar de app. Mantené presionado y deslizá.');b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');b.className='host-app-switch';
  b.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();cancel();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};b.setPointerCapture(e.pointerId);b.classList.add('pressing');timer=clock.setTimeout(reveal,300)};
  b.onpointermove=e=>{if(e.pointerId===pointer&&opened){e.preventDefault();track(e)}};
  b.onpointerup=e=>{if(e.pointerId!==pointer)return;e.preventDefault();if(opened)track(e);const target=selected;cancel({animate:true});if(target)switchApp(target)};
  b.addEventListener('selectstart',e=>e.preventDefault());b.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});b.onpointercancel=cancel;b.onlostpointercapture=cancel;b.oncontextmenu=e=>e.preventDefault();b.onclick=e=>e.preventDefault();
  b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!opened)reveal()}else if(e.key==='Escape')cancel({animate:true});else if(opened&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const items=[...picker.querySelectorAll('[data-app]')],i=items.findIndex(x=>x.dataset.app===selected),next=(i+(e.key==='ArrowRight'?1:-1)+items.length)%items.length;selected=items[next].dataset.app;items.forEach((x,j)=>x.classList.toggle('selected',j===next))}};
  b.onkeyup=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();const target=selected;cancel({animate:true});if(target)switchApp(target)}};return b;
 }
 return {sync(id,source){if(id!==current()||!source)return;cancel();nav.replaceChildren();for(const original of [...source.children].filter(e=>e.tagName==='BUTTON'&&!e.classList.contains('app-switch-trigger')).slice(0,4)){const b=doc.createElement('button');b.innerHTML=original.innerHTML;b.className=original.className;b.onclick=()=>original.click();for(const key of ['aria-label','aria-current','title'])if(original.hasAttribute(key))b.setAttribute(key,original.getAttribute(key));nav.append(b)}nav.append(switchButton());picker.replaceChildren();for(const [app,name]of Object.entries(names)){const item=doc.createElement('div');item.dataset.app=app;item.setAttribute('role','option');if(app===id){item.classList.add('current');item.setAttribute('aria-selected','true')}item.innerHTML=mark(app);const label=doc.createElement('span');label.textContent=name;item.append(label);picker.append(item)}nav.hidden=false},hide(){cancel();nav.hidden=true},cancel};
}
