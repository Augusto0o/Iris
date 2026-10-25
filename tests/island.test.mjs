import test from 'node:test';import assert from 'node:assert/strict';
import {createIsland} from '../src/island.js';import {shortcutFromHash} from '../src/shortcuts.js';
class Element{constructor(){this.children=[];this.dataset={};this.events={}}append(...nodes){this.children.push(...nodes)}setAttribute(){}addEventListener(name,fn){this.events[name]=fn}}
test('A confirmation temporarily replaces a timer; dismissal and account reset keep activity private',()=>{
 const body=new Element(),doc={body,createElement:()=>new Element()},timers=new Map();let next=0,route;const clock={setTimeout(fn){timers.set(++next,fn);return next},clearTimeout(id){timers.delete(id)}};
 const island=createIsland({document:doc,clock,navigate:(...v)=>route=v}),el=body.children[0],tap=el.children[0],close=el.children[1];
 island.activity({id:'session1',kind:'timer',title:'Focus',app:'organizador',view:'focus'});assert.equal(el.hidden,false);tap.onclick();assert.deepEqual(route,['organizador','focus']);
 island.notify({title:'Saved',message:'A note'});assert.equal(el.dataset.kind,'notice');assert.equal(timers.size,1);close.onclick();assert.equal(el.dataset.kind,'timer');
 close.onclick();assert.equal(el.hidden,true);island.activity({id:'session1',title:'Focus'});assert.equal(el.hidden,true);island.activity({id:'session2',title:'New session'});assert.equal(el.hidden,false);
 island.notify({title:'Private'});island.clear();assert.equal(el.hidden,true);assert.equal(timers.size,0);
});
test('Shortcut links only accept supported actions, without creating records',()=>{
 assert.deepEqual(shortcutFromHash('#/iris/summary?action=expense'),{action:'expense',app:'iris',view:'summary',label:'Registrar gasto'});
 for(const action of ['__proto__','constructor','delete','https://outside.example'])assert.equal(shortcutFromHash('#/iris/summary?action='+action),null);
 assert.equal(shortcutFromHash('#/centro/home'),null);assert.equal(shortcutFromHash('#/journal/notes?action=note').app,'journal');
});

test('Notices are queued and deduplicated; modal suspension preserves them until visible',()=>{
 const body=new Element(),doc={body,createElement:()=>new Element()},timers=new Map();let next=0;
 const clock={setTimeout(fn){timers.set(++next,fn);return next},clearTimeout(id){timers.delete(id)}};
 const island=createIsland({document:doc,clock,navigate(){}}),el=body.children[0],title=el.children[0].children[1].children[0],close=el.children[1];
 island.activity({id:'timer',title:'Focus'});island.notify({title:'Uno'});island.notify({title:'Dos'});island.notify({title:'Dos'});
 assert.equal(title.textContent,'Uno');assert.equal(timers.size,1);
 island.suspend('modal',true);island.suspend('background',true);assert.equal(el.hidden,true);assert.equal(timers.size,0);
 island.suspend('modal',false);assert.equal(el.hidden,true);island.suspend('background',false);assert.equal(title.textContent,'Uno');assert.equal(timers.size,1);
 close.onclick();assert.equal(title.textContent,'Dos');close.onclick();assert.equal(title.textContent,'Focus');assert.equal(timers.size,0);
 island.notify({title:'Private'});island.notify({title:'Also private'});island.clear();assert.equal(el.hidden,true);assert.equal(timers.size,0);
});
test('A timer action runs without navigating or dismissing the ongoing activity',()=>{
 const body=new Element(),doc={body,createElement:()=>new Element()};let calls=0;
 const island=createIsland({document:doc,navigate(){throw Error('Unexpected navigation')}}),el=body.children[0];
 island.activity({id:'timer',title:'Focus',action:{label:'Pausar',run:()=>calls++}});el.children[2].onclick();assert.equal(calls,1);assert.equal(el.hidden,false);
});
