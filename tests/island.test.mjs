import test from 'node:test';import assert from 'node:assert/strict';
import {createIsland} from '../src/island.js';import {shortcutFromHash} from '../src/shortcuts.js';
class Element{constructor(){this.children=[];this.dataset={};this.events={}}append(...nodes){this.children.push(...nodes)}setAttribute(){}addEventListener(name,fn){this.events[name]=fn}}
test('Shortcut links only accept supported actions, without creating records',()=>{
 assert.deepEqual(shortcutFromHash('#/iris/summary?action=expense'),{action:'expense',app:'iris',view:'summary',label:'Registrar gasto'});
 for(const action of ['__proto__','constructor','delete','https://outside.example'])assert.equal(shortcutFromHash('#/iris/summary?action='+action),null);
 assert.equal(shortcutFromHash('#/centro/home'),null);assert.equal(shortcutFromHash('#/journal/notes?action=note').app,'journal');
});


function setup(navigate=()=>{}){
 const body=new Element(),doc={body,createElement:()=>new Element()},timers=new Map();let next=0;
 const clock={setTimeout(fn,ms){timers.set(++next,{fn,ms});return next},clearTimeout(id){timers.delete(id)}};
 const island=createIsland({document:doc,clock,navigate});const dock=body.children.find(n=>n.id==='islandDock'),el=dock.children[0],bubble=dock.children[1];
 const tap=el.children[0],title=tap.children[1].children[0],close=el.children[1],action=el.children[2];
 const fire=ms=>{for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.fn()}};
 return {island,el,bubble,tap,title,close,action,timers,fire};
}
test('Without a live activity, notices pop in as expanded cards, queue and deduplicate',()=>{
 const {island,el,title,close,timers}=setup();
 island.notify({title:'Uno'});island.notify({title:'Dos'});island.notify({title:'Dos'});
 assert.equal(el.hidden,false);assert.equal(el.dataset.size,'expanded');assert.equal(title.textContent,'Uno');assert.equal(timers.size,1);
 close.onclick();assert.equal(title.textContent,'Dos');close.onclick();assert.equal(el.hidden,true);assert.equal(timers.size,0);
});
test('A live activity is a compact pill: tap expands, tap again navigates and collapses, auto-collapse after 6 s',()=>{
 let route;const {island,el,tap,timers,fire}=setup((...v)=>route=v);
 island.activity({id:'s1',kind:'timer',title:'Focus',message:'18:42',app:'organizador',view:'focus'});
 assert.equal(el.hidden,false);assert.equal(el.dataset.size,'compact');assert.equal(tap.disabled,false);
 tap.onclick();assert.equal(el.dataset.size,'expanded');assert.equal(route,undefined);
 tap.onclick();assert.deepEqual(route,['organizador','focus']);assert.equal(el.dataset.size,'compact');
 tap.onclick();assert.equal(el.dataset.size,'expanded');fire(6000);assert.equal(el.dataset.size,'compact');
});
test('Notices wait in the bubble behind a live activity; the bubble swaps what is in front',()=>{
 const {island,el,bubble,title,close,timers}=setup();
 island.activity({id:'s1',kind:'timer',title:'Focus',message:'18:42'});
 island.notify({title:'Guardado'});island.notify({title:'Sincronizado'});
 assert.equal(title.textContent,'Focus');assert.equal(bubble.hidden,false);assert.equal(bubble.children[1].textContent,'2');
 bubble.onclick();assert.equal(title.textContent,'Guardado');assert.equal(el.dataset.size,'expanded');assert.equal(bubble.dataset.kind,'timer');
 bubble.onclick();assert.equal(title.textContent,'Focus');assert.equal(bubble.dataset.kind,'notice');
 close.onclick();assert.equal(title.textContent,'Guardado');close.onclick();assert.equal(title.textContent,'Sincronizado');close.onclick();assert.equal(el.hidden,true);assert.equal(bubble.hidden,true); // a paused activity closes for good
});
test('Waiting notices expire quietly; urgent notices pop over the activity',()=>{
 const {island,bubble,title,fire}=setup();
 island.activity({id:'s1',kind:'timer',title:'Focus'});island.notify({title:'Guardado'});assert.equal(bubble.hidden,false);
 fire(4500);assert.equal(bubble.hidden,true);assert.equal(title.textContent,'Focus');
 island.notify({title:'Error al sincronizar',urgent:true});assert.equal(title.textContent,'Error al sincronizar');assert.equal(bubble.dataset.kind,'timer');
});
test('Swiping up a running activity minimizes it; a tap brings it back; × closes it for good',()=>{
 const {island,el,close,tap}=setup();const due=Date.now()+60000;
 const swipeUp=()=>{el.events.pointerdown({button:0,pointerId:1,clientY:100,timeStamp:0});el.events.pointermove({pointerId:1,clientY:40,timeStamp:40});el.events.pointerup({pointerId:1,clientY:40,timeStamp:50})};
 island.activity({id:'s1',title:'Focus',message:'24:00',due});swipeUp();assert.equal(el.hidden,false);assert.equal(el.dataset.size,'mini');
 island.activity({id:'s1',title:'Focus',message:'23:59',due});assert.equal(el.dataset.size,'mini');
 tap.onclick();assert.equal(el.dataset.size,'compact');
 tap.onclick();close.onclick();assert.equal(el.hidden,true);
 island.activity({id:'s1',title:'Focus',message:'23:58',due});assert.equal(el.hidden,true); // still running: stays closed
 island.activity({id:'s1',title:'Focus',message:'Pausado',due:null});assert.equal(el.hidden,false); // paused: shows again
 island.activity({id:'s1',title:'Focus',message:'23:50',due});assert.equal(el.hidden,false); // resumed: still visible
 island.activity({id:'s2',title:'Nueva sesión',due});assert.equal(el.dataset.size,'compact');
 island.activity(null);assert.equal(el.hidden,true);island.clear();assert.equal(el.hidden,true);
});
test('With a deadline the island keeps time itself',async()=>{
 const {liveText}=await import('../src/island.js');
 assert.equal(liveText({message:'25:00 · Volver al Pomodoro',due:1_000_000+90_500},1_000_000),'1:31 · Volver al Pomodoro');
 assert.equal(liveText({message:'Pausado · Volver',due:null}),'Pausado · Volver');
 assert.equal(liveText({message:'0:01',due:5},10),'0:00');
});
test('Suspension (modal, background) hides the island and keeps notices until visible',()=>{
 const {island,el,title,timers}=setup();
 island.notify({title:'Uno'});island.suspend('modal',true);island.suspend('background',true);assert.equal(el.hidden,true);assert.equal(timers.size,0);
 island.suspend('modal',false);assert.equal(el.hidden,true);island.suspend('background',false);assert.equal(title.textContent,'Uno');assert.equal(timers.size,1);
});
test('An activity action runs without navigating or hiding the activity',()=>{
 let calls=0;const {island,el,action,tap}=setup(()=>{throw Error('Unexpected navigation')});
 island.activity({id:'timer',title:'Focus',action:{label:'Pausar',run:()=>calls++}});tap.onclick();action.onclick();assert.equal(calls,1);assert.equal(el.hidden,false);
});
test('A ticking activity keeps the same pill (no re-entry every second)',()=>{
 const {island,el,title,tap}=setup();
 island.activity({id:'s1',kind:'timer',title:'Focus',message:'24:50 · Volver'});const msg=tap.children[1].children[1];
 assert.equal(msg.textContent,'24:50');island.activity({id:'s1',kind:'timer',title:'Focus',message:'24:49 · Volver'});assert.equal(msg.textContent,'24:49');assert.equal(el.dataset.size,'compact');
});
test('Updates every second do not restart a notice countdown (it still leaves on time)',()=>{
 const {island,el,timers,fire}=setup();
 island.notify({key:'cloud-saved',title:'Sincronizado',message:'Tus cambios están guardados en la nube.'});
 const first=[...timers.keys()][0];
 for(let i=0;i<10;i++)island.activity(null); // foco reports "no timer" every second
 assert.deepEqual([...timers.keys()],[first]);
 fire(4500);assert.equal(el.hidden,true);
});
test('A finished or paused activity can be closed for good and returns when it runs again',()=>{
 const {island,el,close,tap}=setup();
 island.activity({id:'s1',kind:'timer',title:'Concentración',message:'25:00',due:null});
 close.onclick();assert.equal(el.hidden,true);
 island.activity({id:'s1',kind:'timer',title:'Concentración',message:'25:00',due:null});assert.equal(el.hidden,true); // foco keeps reporting it
 island.activity({id:'s1',kind:'timer',title:'Concentración',message:'24:59',due:Date.now()+60000});assert.equal(el.hidden,false);
 close.onclick();assert.equal(el.hidden,true); // × closes it even while it runs
});
