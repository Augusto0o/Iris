// Captures a set of screens to compare before/after a CSS change: node tests/ui/snapshot.mjs <dir>
import {serve,open,closeBrowser} from './harness.mjs';
const dir=process.argv[2];if(!dir)throw Error('dir?');
const server=await serve();const shots=[];
const freeze=p=>p.addStyleTag({content:'*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}'});
async function shot(p,name){await p.waitForTimeout(250);await p.screenshot({path:dir+'/'+name+'.png'});shots.push(name)}
for(const theme of ['light','dark']){
 for(const mode of ['opaque','translucent-short']){
  const a=await open(server.url,{mode,theme});const p=a.page;await p.waitForTimeout(800);
  await p.evaluate(()=>{const f=[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden);if(f.contentDocument.body.classList.contains('dark')){}});
  await shot(p,`${theme}-${mode}-home`);
  if(mode==='opaque'){
   for(const id of ['iris','mi-espacio','journal','organizador']){await p.evaluate(i=>window.EcosystemHost.switchApp(i),id);await p.waitForTimeout(1300);if(theme==='dark')await p.evaluate(()=>{for(const f of document.querySelectorAll('iframe.module'))f.contentDocument?.body.classList.add('dark')});await shot(p,`${theme}-app-${id}`)}
   await p.evaluate(()=>window.EcosystemHost.switchApp('centro'));await p.waitForTimeout(1000);
   const b=await p.locator('#hostMobileNav .host-app-switch').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.waitForTimeout(900);await shot(p,`${theme}-picker`);
   const it=await p.$$eval('#hostAppPicker [data-app]',e=>e.map(x=>{const r=x.getBoundingClientRect();return r.x+r.width/2}));await p.mouse.move(it[2],b.y+b.height/2,{steps:5});await p.waitForTimeout(500);await shot(p,`${theme}-picker-select`);
   await p.evaluate(()=>document.getElementById('hostMobileNav').querySelector('.host-app-switch').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true})));await p.mouse.up();await p.waitForTimeout(400);
   await p.evaluate(()=>window.EcosystemHost.notify('centro','Preferencias guardadas'));await p.waitForTimeout(2200);await shot(p,`${theme}-notice`);
   await p.evaluate(()=>document.querySelector('#activityIsland .island-close').click());await p.waitForTimeout(1600);
   await p.evaluate(()=>window.EcosystemHost.activity({id:'t',title:'Concentración',message:'25:00 · Volver al Pomodoro',kind:'timer',due:null,action:{label:'Pausar',run(){}}},'snap'));await p.waitForTimeout(1500);await shot(p,`${theme}-compact`);
   await p.click('#activityIsland .island-content');await p.waitForTimeout(1200);await shot(p,`${theme}-expanded`);
   await p.evaluate(()=>window.EcosystemHost.openAccount());await p.waitForTimeout(500);await shot(p,`${theme}-account`);
  }
  await a.close();
 }
}
await closeBrowser();await server.close();console.log(shots.length+' capturas');
