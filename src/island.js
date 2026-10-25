// Web activity capsule; one visible notice at a time, independent of iOS ActivityKit.
export function createIsland({navigate,document:doc=document,clock=globalThis}){
 const el=doc.createElement('section');el.id='activityIsland';el.hidden=true;el.setAttribute('aria-label','Actividad del ecosistema');
 const tap=doc.createElement('button'),mark=doc.createElement('span'),copy=doc.createElement('span'),title=doc.createElement('strong'),message=doc.createElement('span'),close=doc.createElement('button'),control=doc.createElement('button');
 tap.className='island-content';mark.className='island-mark';mark.textContent='✓';copy.className='island-copy';message.className='island-message';copy.append(title,message);tap.append(mark,copy);close.className='island-close';close.textContent='×';close.setAttribute('aria-label','Cerrar aviso');control.className='island-action';control.hidden=true;el.append(tap,close,control);doc.body.append(el);
 const live=doc.createElement('span');live.className='sr-only';live.setAttribute('role','status');doc.body.append(live);
 let transient=null,activity=null,timer=null,hiddenActivity=false,startY=null;const queue=[],blocks=new Set();
 const key=v=>v.key||[v.title,v.message].join('|');
 function stop(){if(timer!==null)clock.clearTimeout(timer);timer=null}
 function schedule(){stop();if(transient&&!blocks.size)timer=clock.setTimeout(dismiss,Math.max(4500,Math.min(transient.duration||4500,15000)))}
 function draw(){const value=transient||(!hiddenActivity&&activity);el.hidden=blocks.size>0||!value;if(el.hidden)return;title.textContent=value.title;message.textContent=value.message||'';mark.textContent=value.kind==='timer'?'◷':'✓';el.dataset.kind=value.kind||'notice';tap.onclick=()=>{if(value.app)navigate(value.app,value.view);if(transient)dismiss()};tap.disabled=!value.app;control.hidden=!value.action;control.textContent=value.action?.label||'';control.onclick=()=>{value.action?.run();if(transient)dismiss()};}
 function advance(){transient=queue.shift()||null;if(transient&&!blocks.size)live.textContent=transient.title+'. '+(transient.message||'');schedule();draw()}
 function dismiss(){if(transient){stop();advance()}else{hiddenActivity=true;draw()}}
 close.onclick=dismiss;el.addEventListener('pointerdown',e=>startY=e.clientY);el.addEventListener('pointerup',e=>{if(startY!==null&&e.clientY-startY < -24)dismiss();startY=null});el.addEventListener('pointercancel',()=>startY=null);
 return {notify(value){if(!value?.title)return;const duplicate=[transient,...queue].find(v=>v&&key(v)===key(value));if(duplicate){Object.assign(duplicate,value);draw();return}queue.push({...value});if(!transient)advance()},activity(value){if(!activity||activity.id!==value?.id)hiddenActivity=false;activity=value;draw()},suspend(reason,blocked){const was=blocks.size>0;if(blocked)blocks.add(reason);else blocks.delete(reason);if(blocks.size)stop();else if(was){if(transient)live.textContent=transient.title+'. '+(transient.message||'');schedule()}draw()},clear(){stop();queue.length=0;transient=null;activity=null;hiddenActivity=false;live.textContent='';draw()}};
}
