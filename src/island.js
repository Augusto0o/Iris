// Web activity island (independent of iOS ActivityKit).
//
// Behaviour (ideas from SmartIsland, re-implemented here; motion from expo-dynamic-notifications, MIT):
// - A live activity (Pomodoro, kitchen timer) is a compact pill. Tap or pull down to expand it into a card
//   with its actions; it collapses again after a few seconds, or with a swipe up.
// - A short notice pops in as a card, unless a live activity is running: then it waits in a small round
//   bubble beside the pill instead of taking its place. Tapping the bubble swaps what is in front.
//   Notices marked `urgent` always pop in front.
// - Enter: a drop falls from the top, becomes a pill and stretches into the card; content fades in from blur.
//   Exit runs the same path backwards. The island follows the finger and is dismissed by distance or speed.
import {easing,SPRING,TIMING} from './motion.js';
import {createGoo} from './goo.js';

const COLLAPSE_AFTER=6000;
const ICON={
 timer:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25"/><path d="M12 7.6V12l2.9 1.9"/></svg>',
 notice:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.2 12.6 3.7 3.7 7.9-8.6"/></svg>'
};
const clockText=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
// With a deadline the island keeps time itself, so the counter never depends on a hidden app being awake.
export function liveText(value,now=Date.now()){
 const full=value?.message||'';if(!value?.due)return full;
 const rest=full.split(' · ').slice(1).join(' · ');return clockText(value.due-now)+(rest?' · '+rest:'');
}

export function createIsland({navigate,document:doc=document,clock=globalThis,statusBar=()=>{}}){
 const make=(tag,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;return n};
 const dock=make('div');dock.id='islandDock';
 const el=make('section');el.id='activityIsland';el.hidden=true;el.setAttribute('aria-label','Actividad del ecosistema');
 const tap=make('button','island-content'),mark=make('span','island-mark'),copy=make('span','island-copy'),title=make('strong'),message=make('span','island-message'),close=make('button','island-close'),control=make('button','island-action');
 mark.innerHTML=ICON.notice;copy.append(title,message);tap.append(mark,copy);close.textContent='×';close.setAttribute('aria-label','Cerrar aviso');control.hidden=true;el.append(tap,close,control);
 const bubble=make('button','island-bubble'),bubbleMark=make('span','island-mark'),badge=make('span','island-badge');bubble.id='islandBubble';bubble.hidden=true;bubble.append(bubbleMark,badge);
 // Soft blur over the top of the app while a notice card is in front (as in the reference).
 const veil=make('div');veil.id='islandVeil';veil.setAttribute('aria-hidden','true');
 dock.append(el,bubble);doc.body.append(veil,dock);
 const live=make('span','sr-only');live.setAttribute('role','status');doc.body.append(live);

 let transient=null,activity=null,minimized=false,expanded=false,timer=null,timerFor=null,exiting=false,goo,collapseTimer=null,shownKey=null,generation=0,suppressClick=false;
 const queue=[],blocks=new Set();
 const key=v=>v.key||[v.title,v.message].join('|');
 let dismissedAs=null;
 const stateOf=v=>v?(v.id||v.title)+(v.due?':run':':idle'):null;
 const running=()=>activity&&stateOf(activity)!==dismissedAs?activity:null;
 const holding=()=>!!running()&&!minimized; // an activity in full view keeps short notices waiting
 const front=()=>transient||running();
 const duration=v=>Math.max(4500,Math.min(v?.duration||4500,15000));
 const announce=v=>{if(v&&!blocks.size)live.textContent=v.title+'. '+(v.message||'')};

 // ---- timers -------------------------------------------------------------------------------------------
 function stop(){if(timer!==null)clock.clearTimeout(timer);timer=null;timerFor=null}
 function stopCollapse(){if(collapseTimer!==null)clock.clearTimeout(collapseTimer);collapseTimer=null}
 // The countdown belongs to one notice: other updates (the Pomodoro reports every second) must not restart it.
 function schedule(){
  if(blocks.size){stop();return}
  const target=transient||(queue.length&&holding()?queue[0]:null);
  if(target&&target===timerFor&&timer!==null)return;
  stop();if(!target)return;timerFor=target;
  timer=clock.setTimeout(target===transient?()=>{timer=null;timerFor=null;dismiss()}:()=>{timer=null;timerFor=null;queue.shift();schedule();draw()},duration(target)); // waiting notices expire quietly
 }
 function scheduleCollapse(){stopCollapse();if(expanded&&!transient&&!blocks.size)collapseTimer=clock.setTimeout(()=>{collapseTimer=null;expanded=false;draw()},COLLAPSE_AFTER)}

 // ---- motion -------------------------------------------------------------------------------------------
 const win=doc.defaultView||globalThis;
 const animates=()=>typeof el.animate==='function'&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const rect=()=>{const r=el.getBoundingClientRect?.();return r?{w:r.width,h:r.height}:{w:0,h:0}};
 const radius=size=>size==='expanded'?'28px':'999px';
 const parts=()=>[tap,close,control].filter(n=>!n.hidden);
 function cancelMotion(){for(const n of [el,...parts()])n.getAnimations?.().forEach(a=>a.cancel())}
 function reveal(delay,ms=SPRING.reveal.duration){
  if(!animates())return;
  for(const n of parts())n.animate([{opacity:0,transform:'scale(.92)'},{opacity:1,transform:'none'}],{duration:ms,delay,easing:easing(SPRING.reveal.ratio),fill:'backwards'});
 }
 const ISLAND='#050505';
 const gooey=()=>{if(goo===undefined)goo=createGoo(doc);return goo};
 const edge=()=>{const top=parseFloat(win.getComputedStyle?.(doc.documentElement).getPropertyValue('--app-top'))||0;return top>0?top-14:0};
 // With an opaque status bar the page starts below it; paint the band black only while the drop moves.
 const bridge=on=>{if(edge()===0)statusBar(on)}; // bottom of the real island when the page runs under the status bar
 function grow(size,w,h){
  const pill=size==='expanded'?[{offset:.32,maxWidth:'none',width:Math.min(126,w)+'px',height:'37px',borderRadius:'999px'}]:[];
  el.animate([{maxWidth:'none',width:'36px',height:'36px',borderRadius:'999px',opacity:1},...pill,{maxWidth:'none',width:w+'px',height:h+'px',borderRadius:radius(size),opacity:1}],{duration:size==='expanded'?640:520,easing:easing(1,'cubic-bezier(.25,1,.5,1)')});
  reveal(size==='expanded'?220:120,520);
 }
 function enter(size){
  el.hidden=false;el.dataset.size=size;exiting=false;if(!animates())return;
  cancelMotion();el.style.opacity='';
  const g=gooey(),box=el.getBoundingClientRect();
  if(g&&box.width){
   const mine=generation,{width:w,height:h}=box;
   el.style.opacity='0';
   const fall=520;bridge(true);
   g.drop({x:box.left+w/2,top:edge(),toY:box.top+18,toR:18,fromColor:ISLAND,toColor:win.getComputedStyle(el).backgroundColor},fall);
   // The card takes over just before the drop lands, so there is never an empty frame.
   win.setTimeout(()=>{if(mine!==generation)return;el.style.opacity='';grow(size,w,h);g.fadeOut(160)},fall*.8);
   win.setTimeout(()=>{if(mine===generation)bridge(false)},fall+80);
   return;
  }
  const {w,h}=rect(),dot=37,pillW=Math.min(126,w),pillH=Math.min(dot,h);
  const from={maxWidth:'none',width:dot+'px',height:dot+'px',borderRadius:'999px',transform:'translateY(-14px) scale(.4)',opacity:0};
  if(size==='expanded'){
   const total=Math.round(TIMING.enterExpand/.25);
   el.animate([{...from,easing:'cubic-bezier(.3,0,.1,1)'},{offset:.25,maxWidth:'none',width:pillW+'px',height:pillH+'px',borderRadius:'999px',transform:'none',opacity:1,easing:easing(SPRING.expand.ratio)},{maxWidth:'none',width:w+'px',height:h+'px',borderRadius:radius(size),transform:'none',opacity:1}],{duration:total});
   reveal(TIMING.enterReveal);
  }else{
   el.animate([from,{maxWidth:'none',width:w+'px',height:h+'px',borderRadius:'999px',transform:'none',opacity:1}],{duration:SPRING.drop.duration,easing:easing(SPRING.drop.ratio)});
   reveal(180);
  }
 }
 function morph(size,update){
  const before=rect(),wasSize=el.dataset.size;el.dataset.size=size;update?.();
  if(!animates()||el.hidden)return;
  const after=rect();if(Math.abs(before.w-after.w)<1&&Math.abs(before.h-after.h)<1&&!update)return;
  const spring=SPRING.morph;
  el.getAnimations?.().forEach(a=>a.cancel());
  el.animate([{width:before.w+'px',height:before.h+'px',maxWidth:'none',borderRadius:radius(wasSize)},{width:after.w+'px',height:after.h+'px',maxWidth:'none',borderRadius:radius(size)}],{duration:spring.duration,easing:easing(spring.ratio,'cubic-bezier(.25,1,.5,1)')});
  // Content stays readable: a short fade only, no blur and no hidden phase.
  if(animates())for(const n of parts())n.animate([{opacity:.35},{opacity:1}],{duration:200,easing:'ease-out',fill:'backwards'});
 }
 function exit(){
  if(exiting)return; // already leaving: a second call would restart it (closed, opened, closed)
  exiting=true;const mine=++generation;
  if(!animates()){el.hidden=true;exiting=false;el.style&&(el.style.translate='');return}
  const g=gooey(),box=el.getBoundingClientRect(),lifted=parseFloat((el.style.translate||'0px 0px').split(' ')[1])||0;
  if(g&&box.width&&lifted>-8){
   const {width:w,height:h}=box,cardColor=win.getComputedStyle(el).backgroundColor;
   for(const n of parts())n.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'});
   const pill=el.dataset.size==='expanded'?[{offset:.5,maxWidth:'none',width:Math.min(126,w)+'px',height:'37px',borderRadius:'999px'}]:[];
   const a=el.animate([{maxWidth:'none',width:w+'px',height:h+'px',borderRadius:radius(el.dataset.size)},...pill,{maxWidth:'none',width:'36px',height:'36px',borderRadius:'999px'}],{duration:420,delay:60,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
   a.onfinish=()=>{
    if(mine!==generation)return;el.style.opacity='0';bridge(true);
    g.rise({x:box.left+w/2,top:edge(),toY:box.top+18+lifted,toR:18,fromColor:ISLAND,toColor:cardColor}).then(ok=>{
     bridge(false);if(!ok||mine!==generation)return;el.hidden=true;el.style.opacity='';el.style.translate='';exiting=false;cancelMotion();
    });
   };
   return;
  }
  const {w,h}=rect(),lift=el.style?.translate||'0px 0px';
  for(const n of parts())n.animate([{opacity:1},{opacity:0}],{duration:SPRING.fade.duration*.6,fill:'forwards'});
  const a=el.animate([{maxWidth:'none',width:w+'px',height:h+'px',translate:lift,opacity:1},{offset:.45,maxWidth:'none',width:Math.min(126,w)+'px',height:'37px',borderRadius:'999px',translate:lift,opacity:1},{width:'37px',height:'37px',borderRadius:'999px',translate:'0px -14px',transform:'scale(.4)',opacity:0}],{duration:SPRING.collapse.duration,delay:TIMING.exitCollapse,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  a.onfinish=()=>{if(mine!==generation)return;el.hidden=true;el.style.translate='';exiting=false;cancelMotion()};
 }
 function bubbleShow(show){
  if(show===!bubble.hidden)return;
  if(show){bubble.hidden=false;if(animates())bubble.animate([{opacity:0,transform:'scale(.3)'},{opacity:1,transform:'none'}],{duration:SPRING.drop.duration*.7,easing:easing(SPRING.drop.ratio)})}
  else if(animates()){const a=bubble.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.3)'}],{duration:260,easing:'ease-in',fill:'forwards'});a.onfinish=()=>{bubble.hidden=true;a.cancel()}}
  else bubble.hidden=true;
 }

 // ---- rendering ----------------------------------------------------------------------------------------
 function content(value){
  title.textContent=value.title;const full=liveText(value);message.textContent=el.dataset.size==='expanded'?full:full.split(' · ')[0]; // the pill keeps only the essential part (e.g. the time)
  message.title=full;
  const kind=value.kind==='timer'?'timer':'notice';if(mark.dataset.icon!==kind){mark.innerHTML=ICON[kind];mark.dataset.icon=kind}el.dataset.kind=value.kind||'notice';
  if(value.accent)el.style?.setProperty?.('--island-accent',value.accent);else el.style?.removeProperty?.('--island-accent');
  control.hidden=!value.action;control.textContent=value.action?.label||'';
  tap.disabled=!value.app&&!(value===running()&&!expanded);
  tap.setAttribute('aria-label',el.dataset.size==='mini'?'Mostrar '+value.title:value.title+(full?', '+full:''));
  tap.setAttribute('aria-expanded',String(el.dataset.size==='expanded'));
 }
 function draw(){
  const value=blocks.size?null:front();
  const size=!value?el.dataset.size||'compact':value===transient||expanded?'expanded':minimized?'mini':'compact';
  // The bubble carries whatever is not in front: waiting notices, or the activity behind a notice.
  const behind=!value?null:value===transient?running():queue.length?queue[0]:null;
  if(behind){const bk=behind===running()?'timer':'notice';if(bubbleMark.dataset.icon!==bk){bubbleMark.innerHTML=ICON[bk];bubbleMark.dataset.icon=bk}badge.textContent=behind===running()?'':(queue.length>1?String(queue.length):'');bubble.dataset.kind=behind===running()?'timer':'notice';bubble.setAttribute('aria-label',behind===running()?'Volver a '+behind.title:queue.length+(queue.length===1?' aviso en espera':' avisos en espera'))}
  veil.dataset.on=String(!!value&&value===transient);dock.dataset.bubble=String(!!behind);bubbleShow(!!behind);
  if(!value){shownKey=null;if(!el.hidden)exit();return}
  const k=value===transient?'n#'+key(value):'a#'+(value.id||value.title);
  if(el.hidden||generation&&shownKey===null){goo?.hide();bridge(false);generation++;shownKey=k;el.dataset.size=size;content(value);enter(size);return}
  if(k!==shownKey){shownKey=k;morph(size,()=>content(value));return}
  if(el.dataset.size!==size){morph(size,()=>content(value));return} // update the text first so the target size is measured right
  content(value);
 }

 // ---- state changes ------------------------------------------------------------------------------------
 function advance(){
  transient=null;
  if(!holding()&&queue.length)transient=queue.shift();
  else{const urgent=queue.findIndex(v=>v.urgent);if(urgent>=0)transient=queue.splice(urgent,1)[0]}
  announce(transient);schedule();draw();
 }
 function dismiss(){if(transient){stop();advance();return}
  // Paused or finished: close it for good. It comes back by itself when it starts running again.
  if(running()&&!running().due){closeActivity();return}
  // A running activity is never thrown away: it shrinks to a small round button that brings it back.
  if(running()){minimized=true;expanded=false;stopCollapse();if(queue.length)advance();else{schedule();draw()}}}
 function setExpanded(value){if(transient||!running())return;expanded=value;if(value)minimized=false;draw();scheduleCollapse()}
 function swap(){
  if(transient&&running()){queue.unshift(transient);transient=null;schedule();draw();return}
  if(!transient&&queue.length){transient=queue.shift();announce(transient);schedule();draw()}
 }

 tap.onclick=()=>{
  const value=front();if(!value)return;
  if(value===running()&&!transient&&minimized){minimized=false;draw();return}
  if(value===running()&&!transient&&!expanded){setExpanded(true);return}
  if(value.app)navigate(value.app,value.view);
  if(transient)dismiss();else setExpanded(false);
 };
 // × closes for good, even while it runs (it comes back on pause/resume or a new session). Swiping up only minimizes a running one.
 function closeActivity(){dismissedAs=stateOf(activity);minimized=false;expanded=false;stopCollapse();if(queue.length)advance();else{schedule();draw()}}
 close.onclick=()=>{if(transient)dismiss();else if(running())closeActivity()};
 control.onclick=()=>{const value=front();value?.action?.run();if(transient)dismiss();else scheduleCollapse()};
 bubble.onclick=swap;

 // ---- drag: follows the finger, dismissed by distance or speed, springs back otherwise --------------------
 let drag=null;
 el.addEventListener('pointerdown',e=>{if(e.button>0)return;drag={id:e.pointerId,y:e.clientY,t:e.timeStamp,dy:0,v:0,moved:false}});
 el.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;const dy=e.clientY-drag.y,dt=Math.max(1,e.timeStamp-drag.t);
  drag.v=(dy-drag.dy)/dt*1000;drag.dy=dy;drag.t=e.timeStamp;
  if(!drag.moved&&Math.abs(dy)>6){drag.moved=true;el.setPointerCapture?.(e.pointerId);cancelMotion()}
  if(drag.moved&&el.style)el.style.translate='0px '+(dy<0?dy:dy*.25).toFixed(1)+'px';
 });
 const release=e=>{
  if(!drag||e.pointerId!==drag.id)return;const {dy,v,moved}=drag;drag=null;if(!moved)return;
  suppressClick=true;clock.setTimeout(()=>suppressClick=false,0);
  const up=dy<=TIMING.swipeDistance||v<=TIMING.swipeVelocity;
  if(up){if(transient)dismiss();else{springBack();if(expanded)setExpanded(false);else dismiss()}return} // a notice flies away; the activity returns to its place and shrinks
  if(dy>=TIMING.expandDistance&&!transient&&running()&&minimized){minimized=false;draw()}
  else if(dy>=TIMING.expandDistance&&!transient&&running()&&!expanded)setExpanded(true);
  springBack();
 };
 function springBack(){
  const from=el.style?.translate;if(!from)return;
  if(animates())el.animate([{translate:from},{translate:'0px 0px'}],{duration:SPRING.drag.duration,easing:easing(SPRING.drag.ratio)});
  el.style.translate='';
 }
 el.addEventListener('pointerup',release);
 let tickId=null;
 function ticker(){
  const need=!!activity?.due&&typeof clock.setInterval==='function';
  if(need&&tickId===null)tickId=clock.setInterval(()=>{if(activity&&front()===activity&&!el.hidden&&!blocks.size)content(activity)},1000);
  else if(!need&&tickId!==null){clock.clearInterval(tickId);tickId=null}
 }
 el.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.id){drag=null;springBack()}});
 el.addEventListener('click',e=>{if(suppressClick){e.stopPropagation?.();e.preventDefault?.()}},true);

 return {
  notify(value){
   if(!value?.title)return;
   const duplicate=[transient,...queue].find(v=>v&&key(v)===key(value));
   if(duplicate){Object.assign(duplicate,value);draw();return}
   const item={...value};
   if(!transient&&(!holding()||item.urgent)){transient=item;announce(item);schedule();draw();return}
   if(item.urgent&&transient&&!transient.urgent){queue.unshift(transient);transient=item;announce(item);schedule();draw();return}
   queue.push(item);if(!transient)schedule();draw();
  },
  activity(value){
   if(!activity||activity.id!==value?.id){minimized=false;expanded=false;stopCollapse()}
   if(dismissedAs&&stateOf(value)!==dismissedAs)dismissedAs=null; // any change (pause, resume, new session) brings it back
   activity=value;ticker();
   if(!holding()&&!transient&&queue.length){advance();return}
   schedule();draw();
  },
  suspend(reason,blocked){
   const was=blocks.size>0;if(blocked)blocks.add(reason);else blocks.delete(reason);
   if(blocks.size){stop();stopCollapse()}else if(was){announce(transient);schedule();scheduleCollapse()}
   draw();
  },
  clear(){stop();stopCollapse();queue.length=0;transient=null;activity=null;dismissedAs=null;minimized=false;expanded=false;ticker();live.textContent='';draw()},
  state:()=>({front:transient?'notice':running()?'activity':null,size:el.dataset.size,waiting:queue.length,bubble:!bubble.hidden,minimized})
 };
}
