// UI checks with iPhone geometry. Run after `npm run build`: npm run test:ui
import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {serve,open,launch,closeBrowser} from './harness.mjs';

let server;
before(async()=>{server=await serve()});
after(async()=>{await closeBrowser();await server.close()});

const nav=page=>page.evaluate(()=>{const n=document.getElementById('hostMobileNav'),r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,pad:parseFloat(getComputedStyle(n).paddingBottom),vh:innerHeight}});

test('Bottom bar: reaches the screen edge and clears the home indicator in every status-bar mode',async()=>{
 for(const [mode,pad] of [['opaque',34],['translucent-short',8],['translucent-full',34]]){
  const app=await open(server.url,{mode});
  const n=await nav(app.page);
  assert.equal(Math.round(n.bottom),n.vh,mode+': bar ends at the bottom of the page');
  assert.equal(n.pad,pad,mode+': home-indicator clearance');
  assert.deepEqual(app.errors,[]);await app.close();
 }
});

test('No horizontal scrolling in the shell or in any of the five apps',async()=>{
 const app=await open(server.url);
 for(const id of ['centro','iris','mi-espacio','journal','organizador']){
  await app.page.evaluate(i=>window.EcosystemHost.switchApp(i),id);await app.page.waitForTimeout(1200);
  const o=await app.page.evaluate(()=>{const d=[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentDocument.documentElement;return {shell:document.documentElement.scrollWidth-innerWidth,app:d.scrollWidth-d.clientWidth}});
  assert.ok(o.shell<=0&&o.app<=1,id+': overflow '+JSON.stringify(o));
 }
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Text fields are at least 16 px so iOS never zooms on focus',async()=>{
 const app=await open(server.url);
 for(const id of ['centro','iris','mi-espacio','journal','organizador']){
  await app.page.evaluate(i=>window.EcosystemHost.switchApp(i),id);await app.page.waitForTimeout(900);
  const small=await app.page.evaluate(()=>{const d=[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentDocument;return [...d.querySelectorAll('input,select,textarea')].filter(i=>parseFloat(getComputedStyle(i).fontSize)<16).map(i=>i.id||i.name||i.type)});
  assert.deepEqual(small,[],id);
 }
 await app.close();
});

test('Account dialog stays below the status bar and its close button can be tapped',async()=>{
 const app=await open(server.url,{mode:'translucent-short'});
 const d=await app.page.evaluate(()=>{window.EcosystemHost.openAccount();const dl=document.getElementById('account'),c=document.getElementById('closeAccount').getBoundingClientRect();return {top:dl.getBoundingClientRect().top,hit:document.elementFromPoint(c.x+c.width/2,c.y+c.height/2)?.id}});
 assert.ok(d.top>=62+8,'dialog top '+d.top);assert.equal(d.hit,'closeAccount');
 await app.close();
});

test('App switcher: compact round pill inside the screen; sliding picks the nearest app',async()=>{
 const app=await open(server.url);const p=app.page;
 const b=await p.locator('#hostMobileNav .host-app-switch').boundingBox();
 await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.waitForTimeout(500);
 const pill=await p.evaluate(()=>{const r=document.getElementById('hostAppPicker').getBoundingClientRect();return {left:r.left,right:r.right,h:r.height,radius:getComputedStyle(document.getElementById('hostAppPicker')).borderRadius}});
 assert.ok(pill.left>=0&&pill.right<=402,'pill inside the screen');assert.ok(pill.h<=80);assert.equal(pill.radius,'999px');
 const items=await p.$$eval('#hostAppPicker [data-app]',e=>e.map(x=>{const r=x.getBoundingClientRect();return {app:x.dataset.app,x:r.x+r.width/2}}));
 await p.mouse.move(items[1].x,b.y+b.height/2,{steps:6});await p.waitForTimeout(200);
 assert.equal(await p.$eval('#hostAppPicker .selected',e=>e.dataset.app),items[1].app);
 await p.mouse.up();await p.waitForTimeout(1500);
 assert.ok((await p.evaluate(()=>location.hash)).startsWith('#/'+items[1].app));
 await app.close();
});

test('Island: small notice that leaves on time despite per-second updates; compact timer; centred icon',async()=>{
 const app=await open(server.url);const p=app.page;
 await p.evaluate(()=>{setInterval(()=>window.EcosystemHost.activity(null,'ui-test'),1000);window.EcosystemHost.notify('centro','Preferencias guardadas')});
 await p.waitForTimeout(1600);
 const card=await p.evaluate(()=>{const r=document.getElementById('activityIsland').getBoundingClientRect();return {w:r.width,h:r.height,left:r.left,right:r.right}});
 assert.ok(card.w<=340&&card.h<=60&&card.left>=0&&card.right<=402,'notice card '+JSON.stringify(card));
 await p.waitForTimeout(5200);assert.equal(await p.evaluate(()=>document.getElementById('activityIsland').hidden),true,'notice left by itself');
 await p.evaluate(()=>window.EcosystemHost.activity({id:'t',title:'Concentración',message:'25:00 · Volver al Pomodoro',kind:'timer',due:Date.now()+1500000},'ui-test2'));
 await p.waitForTimeout(1400);
 const pill=await p.evaluate(()=>{const e=document.getElementById('activityIsland'),m=e.querySelector('.island-mark').getBoundingClientRect(),s=e.querySelector('.island-mark svg').getBoundingClientRect();return {w:e.getBoundingClientRect().width,size:e.dataset.size,dx:Math.abs(m.x+m.width/2-(s.x+s.width/2)),dy:Math.abs(m.y+m.height/2-(s.y+s.height/2))}});
 assert.equal(pill.size,'compact');assert.ok(pill.w<=160,'pill width '+pill.w);assert.ok(pill.dx<.5&&pill.dy<.5,'icon centred');
 assert.deepEqual(app.errors,[]);await app.close();
});

test('An open window keeps the screen behind it still',async()=>{
 const app=await open(server.url);const p=app.page;
 const cdp=await app.ctx.newCDPSession(p);
 const drag=async(x,y1,y2)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y1}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y1+(y2-y1)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(300)};
 const top=()=>p.evaluate(()=>Math.round([...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentDocument.scrollingElement.scrollTop));
 await p.evaluate(()=>{[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentDocument.scrollingElement.scrollTop=200;window.EcosystemHost.openAccount()});await p.waitForTimeout(300);
 const before=await top();await drag(8,700,250);assert.equal(await top(),before);
 await app.close();
});

test('Hidden apps idle for 10 minutes are unloaded and reopen with their screen',async()=>{
 const app=await open(server.url,{clock:true});const p=app.page;
 for(const id of ['iris','journal','centro']){await p.evaluate(i=>window.EcosystemHost.switchApp(i),id);await p.waitForTimeout(1200)}
 const before=await p.evaluate(()=>document.querySelectorAll('iframe.module').length);
 await p.clock.fastForward(11*60*1000);await p.clock.runFor(61000);await p.waitForTimeout(300);
 const after=await p.evaluate(()=>[...document.querySelectorAll('iframe.module')].map(f=>f.dataset.module));
 assert.ok(before>=3,'three apps were open');assert.deepEqual(after,['centro'],'only the open app stays loaded');
 await p.evaluate(()=>window.EcosystemHost.switchApp('iris'));await p.waitForTimeout(2500);
 const reopened=await p.evaluate(()=>{const f=[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden);return {id:f.dataset.module,hash:location.hash,body:!!f.contentDocument.body.children.length}});
 assert.equal(reopened.id,'iris');assert.ok(reopened.body);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Search in nubo finds records from every app and opens them where they live',async()=>{
 const app=await open(server.url);const p=app.page;
 await p.evaluate(()=>{
  const H=window.EcosystemHost,read=k=>JSON.parse(H.getItem(k)||'null');
  const org=read('ecosistema03-organizer')||{app:'organizer',version:1,records:{},trash:[],prefs:{}};org.records.tasks=[{id:'t-ui',title:'Pagar electricidad de noviembre',date:'2026-11-05',priority:'Alta',done:false,subtasks:[]}];H.setItem('ecosistema03-organizer',JSON.stringify(org));
  const jr=read('ecosistema03-journal')||{app:'journal',version:1,records:{},trash:[],prefs:{}};jr.records.notes=[{id:'n-ui',title:'Ideas tienda',body:'<p>Envíos a Córdoba y electricidad del local</p>',date:'2026-10-25'}];H.setItem('ecosistema03-journal',JSON.stringify(jr));
 });
 await p.reload();await p.waitForFunction(()=>[...document.querySelectorAll('iframe.module')].some(f=>!f.hidden&&f.contentDocument?.getElementById('search')));await p.waitForTimeout(800);
 const frame=p.frameLocator('iframe.module:not([hidden])');
 await frame.locator('#search').fill('electricidad');await p.waitForTimeout(400);
 const titles=await frame.locator('.search-result strong').allTextContents();
 assert.deepEqual(titles,['Pagar electricidad de noviembre','Ideas tienda']);
 await frame.locator('.filter-bar button',{hasText:'lecta'}).click();await p.waitForTimeout(200);
 assert.deepEqual(await frame.locator('.search-result strong').allTextContents(),['Ideas tienda']);
 await frame.locator('.filter-bar button',{hasText:'Todo'}).click();await frame.locator('.search-result').first().click();await p.waitForTimeout(2500);
 const opened=await p.evaluate(()=>{const f=[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden),d=f.contentDocument.querySelector('dialog[open]');return {app:f.dataset.module,dialog:!!d,value:d?.querySelector('input[name=title]')?.value}});
 assert.deepEqual(opened,{app:'organizador',dialog:true,value:'Pagar electricidad de noviembre'});
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Screen measurements are hidden until the account title is tapped 5 times',async()=>{
 const app=await open(server.url);const p=app.page;
 await p.evaluate(()=>window.EcosystemHost.openAccount());await p.waitForTimeout(300);
 const has=()=>p.evaluate(()=>[...document.querySelectorAll('#accountBody summary')].some(s=>s.textContent.includes('Medidas de pantalla')));
 assert.equal(await has(),false);
 for(let i=0;i<5;i++)await p.click('#account h2');await p.waitForTimeout(200);
 assert.equal(await has(),true);
 await app.close();
});

test('Keyboard open: the app keeps its full height (no empty area when iOS pans to the field)',async()=>{
 const app=await open(server.url);const p=app.page;
 const r=await p.evaluate(async()=>{
  const vv=window.visualViewport;Object.defineProperty(vv,'height',{configurable:true,get:()=>460});vv.dispatchEvent(new Event('resize'));
  await new Promise(r=>setTimeout(r,100));
  return {body:document.body.getBoundingClientRect().height,keyboard:document.documentElement.dataset.keyboard,nav:getComputedStyle(document.getElementById('hostMobileNav')).display};
 });
 assert.deepEqual(r,{body:812,keyboard:'open',nav:'none'});
 await app.close();
});

test('foco immersive stage: scene swatches, round controls and a ring that advances',async()=>{
 const app=await open(server.url,{hash:'#/organizador/focus'});const p=app.page;await p.waitForTimeout(1200);
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";
 const errors=[];await p.evaluate(`${W}.addEventListener('error',e=>window.__stageErrors=(window.__stageErrors||[]).concat(e.message))`);
 await p.evaluate(`${W}.openFocusStage()`);await p.waitForTimeout(500);
 const f=p.frameLocator('iframe.module:not([hidden])');
 assert.deepEqual(await f.locator('.ns-scene span').allTextContents(),['Espacio','Bosque','Océano','Lluvia','Fogata']);
 await f.locator('.ns-scene[data-scene=forest]').click();await p.waitForTimeout(200);
 assert.equal(await f.locator('#focusStage').getAttribute('data-scene'),'forest');
 assert.equal(await f.locator('.ns-scene.selected').getAttribute('data-scene'),'forest');
 assert.equal(await f.locator('#nsToggle').getAttribute('aria-label'),'Comenzar');
 await f.locator('#nsToggle').click();await p.waitForTimeout(2300);
 assert.equal(await f.locator('#nsToggle').getAttribute('aria-label'),'Pausar');
 const off=Number(await f.locator('#nsBar').evaluate(e=>e.style.strokeDashoffset));assert.ok(off<1&&off>.99,'ring advanced: '+off);
 assert.equal(await f.locator('#nsNext').evaluate(e=>getComputedStyle(e).visibility),'hidden');
 await f.locator('#nsToggle').click();await p.waitForTimeout(200);assert.equal(await f.locator('#nsToggle').getAttribute('aria-label'),'Comenzar');
 await f.locator('#focusStage header button[aria-label="Salir de pantalla completa"]').click();await p.waitForTimeout(300);
 assert.equal(await f.locator('#focusStage').count(),0);
 assert.deepEqual(await p.evaluate('window.__stageErrors||[]'),[]);assert.deepEqual(app.errors,[]);await app.close();
});

test('Digitize: a photographed bill is read on the device and saved in numio',async()=>{
 const app=await open(server.url);const p=app.page;
 // a slightly tilted bill on a dark table, like a real photo
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1300;c.height=1000;const x=c.getContext('2d');x.fillStyle='#2b2723';x.fillRect(0,0,1300,1000);
  x.translate(150,130);x.rotate(.03);x.fillStyle='#f4efe4';x.fillRect(0,0,1000,700);x.fillStyle='#222';
  [['bold 44px sans-serif','EDENOR S.A.'],['30px sans-serif','Periodo: 10/2026'],['30px sans-serif','Consumo 230 kWh   $ 31.200,00'],['bold 34px sans-serif','TOTAL A PAGAR $ 45.000,50'],['30px sans-serif','Vencimiento 05/11/2026']].forEach(([f,t],i)=>{x.font=f;x.fillText(t,70,110+i*90)});
  return c.toDataURL('image/png').split(',')[1]});
 const f=p.frameLocator('iframe.module:not([hidden])');
 await f.locator('#scanLaunch').click();await p.locator('.scan-type',{hasText:'Pago de servicio'}).click();
 await p.waitForSelector('#account[data-view=scan-live] video');await p.locator('.live-gallery input').setInputFiles({name:'boleta.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 // crop: the sheet is found by itself, then the page is straightened and cleaned
 await p.waitForSelector('.scan-crop canvas');await p.locator('[data-act=next]').click();
 await p.waitForSelector('[data-mode=document][aria-checked=true]');await p.locator('[data-act=use]').click();
 await p.waitForSelector('.scan-form',{timeout:120000});
 const v=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.scan-form [name]')].map(e=>[e.name,e.value])));
 assert.equal(v.amount,'45000.5');assert.equal(v.period,'2026-10');assert.match(v.text,/^Edenor/);
 await p.locator('.scan-form .primary').click();await p.waitForSelector('.scan-open');
 const saved=await p.evaluate(()=>JSON.parse(window.EcosystemHost.getItem('iris03')).expenses.map(e=>[e.text,e.amount,e.category]));
 assert.deepEqual(saved,[['Edenor · octubre 2026',45000.5,'Servicios']]);
 // the cropped photo is kept in lecta › Escaneos, as a reference to the image store
 const kept=await p.evaluate(()=>JSON.parse(window.EcosystemHost.getItem('ecosistema03-journal')).records.notes.find(n=>n.notebook==='Escaneos'));
 assert.match(kept.title,/^Boleta · Edenor/);const key=/data-scan="([^"]+)"/.exec(kept.body)?.[1];assert.ok(key,'note keeps the scan');
 assert.match(await p.evaluate(k=>EcosystemHost.scanURL(k),key),/^blob:/);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('foco ambient sound: one audio context, scenes crossfade, closing releases it',async()=>{
 const app=await open(server.url,{hash:'#/organizador/focus'});const p=app.page;await p.waitForTimeout(1200);
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";
 const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);
 assert.equal(await run('typeof nuboFocusSound.voice'),'function');
 await run('openFocusStage();setFocusScene("forest")');await p.waitForTimeout(300);
 if(!(await run('!!S.prefs.focusSound')))await run('toggleFocusSound()');await p.waitForTimeout(400);
 assert.equal(await run('focusAudio&&focusAudio.scene'),'forest');
 await run('window.__ctx=focusAudio.ctx');
 await p.frameLocator('iframe.module:not([hidden])').locator('#nsToggle').click();await p.waitForTimeout(1500);
 assert.ok(await run('focusAudio.gain.gain.value')>.05,'fades in while the timer runs');
 await run('setFocusScene("rain")');await p.waitForTimeout(300);
 assert.equal(await run('focusAudio.scene'),'rain');assert.equal(await run('focusAudio.ctx===window.__ctx'),true);
 await run('closeFocusStage()');await p.waitForTimeout(900);
 assert.equal(await run('focusAudio'),null);assert.equal(await run('window.__ctx.state'),'closed');
 await run('S.prefs.focusSound=false;persist()');
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Dictation: a mic inside the focused field writes what you say',async()=>{
 const app=await open(server.url);const p=app.page;
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";
 // Chromium's recogniser needs Google's servers: replace it with one that "hears" a phrase.
 await p.evaluate(`${W}.eval(${JSON.stringify(`window.SpeechRecognition=window.webkitSpeechRecognition=class{start(){setTimeout(()=>{this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:'pagar la luz'}],{isFinal:false})]});setTimeout(()=>{this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:'pagar la luz'}],{isFinal:true})]});this.onend?.()},500)},80)}stop(){this.onend?.()}}`)})`);
 const f=p.frameLocator('iframe.module:not([hidden])');const input=f.locator('header .search input').first();
 await input.click();await p.waitForTimeout(100);
 const mic=f.locator('#dictate');assert.equal(await mic.isVisible(),true);
 const [ib,mb]=[await input.boundingBox(),await mic.boundingBox()];assert.ok(mb.x+mb.width<=ib.x+ib.width+1&&mb.x>ib.x+ib.width/2,'mic sits at the right end of the field');
 await mic.click();await p.waitForTimeout(60);
 await p.waitForTimeout(140);assert.equal(await f.locator('#dictateLive').textContent(),'pagar la luz');
 await p.waitForTimeout(600);assert.equal(await input.inputValue(),'Pagar la luz');
 assert.equal(await input.evaluate(e=>e===document.activeElement),true,'the field keeps focus');
 assert.equal(await f.locator('#dictateLive').isVisible(),false);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Keyboard: a window fits the visible area and scrolls to the field; the page behind does not move',async()=>{
 const app=await open(server.url,{hash:'#/organizador/habits'});const p=app.page;await p.waitForTimeout(900);
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";
 const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);
 await run("edit('habits')");await p.waitForTimeout(400);
 const field=await run("(()=>{const d=document.querySelector('dialog[open]');const t=[...d.querySelectorAll('textarea,input[type=text],input:not([type])')].pop();t.focus();return !!t})()");assert.ok(field);
 await run("scrollTo(0,300)");
 // what the shell sends when the keyboard is up: 400 px visible, panned 120 px down
 await run("ecosystemViewport({bottom:0,keyboard:true,visible:400,top:120})");await p.waitForTimeout(250);
 const r=await run("(()=>{const d=document.querySelector('dialog[open]').getBoundingClientRect(),f=document.activeElement.getBoundingClientRect();return {top:d.top,bottom:d.bottom,ft:f.top,fb:f.bottom,y:scrollY}})()");
 assert.ok(r.top>=120&&r.bottom<=520+1,'window inside the visible area: '+JSON.stringify(r));
 assert.ok(r.ft>=r.top&&r.fb<=r.bottom,'focused field visible: '+JSON.stringify(r));
 assert.equal(r.y,0,'page behind stays put');
 await run("ecosystemViewport({bottom:34,keyboard:false,visible:812,top:0});closeModal()");
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Digitize from each app: domo offers service bills, contracts and documents; foco its list',async()=>{
 const app=await open(server.url,{hash:'#/mi-espacio/dashboard'});const p=app.page;await p.waitForTimeout(900);
 const f=p.frameLocator('iframe.module:not([hidden])');
 await f.locator('#scanApp').click();await p.waitForTimeout(600);
 assert.deepEqual(await p.locator('#account .scan-type strong').allTextContents(),['Boleta de servicio','Contrato','Documento']);
 await p.locator('#closeAccount').click();await p.waitForTimeout(200);
 await p.evaluate(()=>EcosystemHost.switchApp('organizador'));await p.waitForTimeout(1500);
 await p.frameLocator('iframe.module:not([hidden])').locator('#scanApp').click();await p.waitForTimeout(600);
 assert.deepEqual(await p.locator('#account .scan-type strong').allTextContents(),['Documento','Lista de tareas']);
 await p.locator('.scan-type',{hasText:'Lista de tareas'}).click();await p.waitForTimeout(600);
 assert.equal(await p.locator('#account h2').textContent(),'Lista de tareas');
 assert.equal(await p.locator('#account [data-act=cancel]').textContent(),'Cancelar');
 await p.locator('#account [data-act=cancel]').click();await p.waitForTimeout(200);assert.equal(await p.locator('#account .scan-type').count(),2,'back to the choice');
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Digitize like Notes: live camera with auto/manual, filters, pages that pile up and can be fixed',async()=>{
 const app=await open(server.url);const p=app.page;
 const f=p.frameLocator('iframe.module:not([hidden])');
 await f.locator('#scanLaunch').click();await p.locator('.scan-type',{hasText:'Contrato'}).click();
 await p.waitForSelector('#account[data-view=scan-live] video');await p.waitForFunction(()=>document.querySelector('#account video').videoWidth>0);
 const r=await p.locator('#account').boundingBox();assert.ok(r.x<=1&&r.y<=1&&r.width>=400,'full screen: '+JSON.stringify(r));
 assert.equal(await p.locator('.live [data-act=filter]').textContent(),'Documento');
 await p.locator('.live [data-act=filter]').click();assert.equal(await p.locator('.live [data-act=filter]').textContent(),'Color');
 await p.locator('.live [data-act=auto]').click();assert.equal(await p.locator('.live [data-act=auto]').textContent(),'Manual');
 // manual shot: when no sheet is found you set the corners, then it joins the pile
 await p.locator('.live-shutter').click();
 await p.waitForSelector('.scan-crop canvas, .live-thumb:not([hidden])');
 if(await p.locator('.scan-crop canvas').count()){await p.locator('[data-act=next]').click();await p.locator('[data-act=use]').click()}
 await p.waitForSelector('.live-thumb:not([hidden])');assert.equal(await p.locator('.live-thumb span').textContent(),'1');assert.equal(await p.locator('.live-save').textContent(),'Guardar (1)');
 await p.locator('.live-thumb').click();await p.waitForSelector('.scan-pages');assert.equal(await p.locator('.scan-page').count(),1);
 await p.locator('[data-act=more]').click();await p.waitForSelector('#account[data-view=scan-live] video');
 await p.locator('.live [data-act=auto]').click();await p.locator('.live [data-act=cancel]').click();await p.waitForTimeout(200);
 assert.equal(await p.evaluate(()=>document.querySelector('#account video')?.srcObject?.active??false),false,'camera released');
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Round 7: documents, kitchen timers, ending a focus session, passwords, real widgets and the note caret',async()=>{
 const app=await open(server.url);const p=app.page;
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);
 const f=()=>p.frameLocator('iframe.module:not([hidden])');
 // a scanned document from the gallery lands in lecta › Documentos with its page
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=700;const x=c.getContext('2d');x.fillStyle='#333';x.fillRect(0,0,900,700);x.fillStyle='#f7f4ec';x.fillRect(120,80,660,540);x.fillStyle='#222';x.font='bold 40px sans-serif';x.fillText('GARANTÍA',200,200);return c.toDataURL('image/png').split(',')[1]});
 await f().locator('#scanLaunch').click();await p.locator('.scan-type',{hasText:'Documento'}).click();await p.waitForSelector('#account[data-view=scan-live] video');
 await p.locator('.live-gallery input').setInputFiles({name:'g.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await p.waitForSelector('.scan-crop canvas');await p.locator('[data-act=next]').click();await p.locator('[data-act=use]').click();
 await p.waitForSelector('.live-thumb:not([hidden])');await p.locator('.live-save').click();
 await p.waitForSelector('.scan-form [name=title]');await p.fill('.scan-form [name=title]','Garantía heladera');await p.locator('.scan-form [name=read]').uncheck();await p.locator('.scan-form .primary').click();
 await p.waitForSelector('.scan-open, .scan-error:not([hidden])');assert.equal(await p.locator('.scan-error:not([hidden])').count(),0,'saved without errors');
 await p.locator('.scan-open').click();await p.waitForTimeout(1200);
 await f().locator('.doc-view').waitFor({timeout:15000});assert.match(await f().locator('.doc-view').textContent(),/1 página/);await run('closeModal()');
 assert.equal(await f().locator('.doc-card strong').first().textContent(),'Garantía heladera');
 assert.match(await f().locator('.doc-thumb img').first().getAttribute('src')||'',/^blob:/);
 await f().locator('.doc-card').first().click();await p.waitForTimeout(200);assert.equal(await f().locator('.doc-pages img').count(),1);await run('closeModal()');
 // kitchen timers: two at once, pause, +1 and cancel
 await p.evaluate(()=>EcosystemHost.switchApp('mi-espacio'));await p.waitForTimeout(1500);await run("go('recipes')");await p.waitForTimeout(300);
 await run("kitchenTimer.start('Fideos',540);kitchenTimer.start('Huevos',300)");await p.waitForTimeout(300);
 assert.equal(await f().locator('.kt-row').count(),2);
 const id=await run("S.kitchenTimers[0].id");await run(`kitchenTimer.pause('${id}')`);assert.equal(await run("S.kitchenTimers[0].paused"),true);
 await run(`kitchenTimer.add('${id}',60)`);assert.ok(await run("S.kitchenTimers[0].remaining")>=590);
 await f().locator('.kt-row').first().locator('.kt-cancel').click();await p.waitForTimeout(200);assert.equal(await run("S.kitchenTimers.length"),1);
 // foco: the immersive stage can end the session
 await p.evaluate(()=>EcosystemHost.switchApp('organizador'));await p.waitForTimeout(1500);
 await run("go('focus');toggleTimer();openFocusStage()");await p.waitForTimeout(400);assert.equal(await run("ensureTimer().running"),true);
 await f().locator('#nsEnd').click();await p.waitForTimeout(200);
 assert.equal(await run("!!document.getElementById('focusStage')||ensureTimer().running||!!ensureTimer().id"),false);
 await run("storeRecord('tasks',{title:'Pagar el seguro',date:today(),priority:'Alta',done:false,subtasks:[]});save('ok')");
 // passwords: create the vault, save one, lock, wrong and right master password
 await p.evaluate(()=>EcosystemHost.openPasswords());await p.waitForSelector('#vaultSetup');
 await p.fill('#vaultSetup [name=a]','caballo-azul-2026');await p.fill('#vaultSetup [name=b]','caballo-azul-2026');await p.click('#vaultSetup .primary');await p.waitForSelector('.vault-list',{timeout:30000});
 await p.click('[data-a=new]');await p.fill('#vaultItem [name=title]','Netflix');await p.click('[data-a=gen]');const pass=await p.inputValue('#vaultItem [name=password]');assert.equal(pass.length,20);
 await p.click('#vaultItem .primary');await p.waitForSelector('.vault-detail');await p.click('.vault-back');await p.click('[data-a=lock]');await p.waitForSelector('#vaultUnlock');
 const stored=await p.evaluate(()=>new Promise(ok=>{const r=indexedDB.open('nubo-vault');r.onsuccess=()=>{const g=r.result.transaction('vault').objectStore('vault').getAll();g.onsuccess=()=>ok(JSON.stringify(g.result))}}));
 assert.ok(!stored.includes('Netflix')&&!stored.includes(pass),'nothing readable is stored');
 await p.fill('#vaultUnlock [name=m]','otra-cosa-123');await p.click('#vaultUnlock .primary');await p.waitForSelector('.vault-error:not([hidden])',{timeout:30000});
 await p.fill('#vaultUnlock [name=m]','caballo-azul-2026');await p.click('#vaultUnlock .primary');await p.waitForSelector('.vault-row',{timeout:30000});
 assert.equal(await p.locator('.vault-row strong').first().textContent(),'Netflix');
 await p.locator('#closeAccount').click();
 // nubo's widgets read the real data of the apps
 await p.evaluate(()=>EcosystemHost.switchApp('centro'));await p.waitForTimeout(1500);
 assert.match(await f().locator('.nw-k-tasks').textContent(),/1\s*tarea pendiente/);
 assert.match(await f().locator('.hero').textContent(),/1 tarea pendiente/);
 await run("nuboWidget.edit(true)");await f().locator('.nw-k-spend .nw-remove').click({force:true});assert.equal(await f().locator('.nw-k-spend').count(),0);
 await run("nuboWidget.gallery()");await f().locator('.nw-option',{hasText:'Cocina'}).locator('.primary').click();await p.waitForTimeout(200);assert.match(await run("document.querySelector('#nuboBoard .nw-k-kitchen')?.textContent||''"),/Huevos/);await run("nuboWidget.edit(false)");
 // the note editor: focusing an empty note with the keyboard up keeps the title and the caret in view
 await p.evaluate(()=>EcosystemHost.switchApp('journal'));await p.waitForTimeout(1500);await run("noteForm()");await p.waitForTimeout(300);
 await run("document.documentElement.dataset.keyboard='open';document.getElementById('noteEditor').focus()");await p.waitForTimeout(250);
 assert.equal(await run("document.querySelector('.nte-page').scrollTop"),0);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Round 8: numio balance, can I spend, subscriptions; books progress and free reader; English tutor; quiet notices; graph reasons',async()=>{
 const app=await open(server.url);const p=app.page;
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);const f=()=>p.frameLocator('iframe.module:not([hidden])');
 const m=new Date().toISOString().slice(0,7);
 await p.evaluate(()=>EcosystemHost.switchApp('iris'));await p.waitForTimeout(1500);
 await run(`state.incomes.push({id:'i1',text:'Sueldo',amount:900000,date:'${m}-01',category:'Sueldo',method:'Transferencia',accountId:'legacy'});state.expenses.push({id:'e1',text:'Super',amount:200000,date:'${m}-01',category:'Supermercado',method:'Efectivo',accountId:'legacy'});save();go('plan')`);await p.waitForTimeout(300);
 assert.equal(await f().locator('h1').first().textContent(),'Balance');
 assert.match(await f().locator('.np-big').textContent(),/\$\s?610\.000/,'900.000 − 200.000 − 10 % de ahorro');
 await f().locator('#npCheck input:visible').first().fill('800000');await f().locator('#npCheck .primary').click();await p.waitForTimeout(200);
 assert.match(await f().locator('.np-verdict').textContent(),/No conviene/);
 await run("go('subscriptions')");await p.waitForTimeout(200);await f().locator('.finance-actions .primary').click();await p.waitForTimeout(200);
 await f().locator('.np-presets [data-n=Netflix]').click();await f().locator('#subForm input:visible').nth(1).fill('12000');await f().locator('#subForm .primary').click();await p.waitForTimeout(200);
 assert.equal(await run("state.subscriptions.length"),1);assert.match(await f().locator('.np-subs').textContent(),/Netflix/);
 // plain confirmations no longer pop up; problems still do
 const before=await p.locator('#activityIsland:not([hidden])').count();await run("notify('Guardado')");await p.waitForTimeout(300);
 assert.equal(await p.locator('#activityIsland .island-message',{hasText:'Guardado'}).count(),0);
 await run("notify('No se pudo guardar el gasto.')");await p.waitForTimeout(400);assert.ok(await p.locator('#activityIsland',{hasText:'No se pudo'}).count()>=1);
 // lecta: reading progress and a free book read inside the app
 await p.evaluate(()=>EcosystemHost.switchApp('journal'));await p.waitForTimeout(1500);
 await run(`catalogJSON=async u=>u.startsWith('/api/book?id')?({id:2000,title:'Don Quijote',author:'Cervantes',text:Array.from({length:300},(_,i)=>'Párrafo '+(i+1)).join('\\n\\n')}):u.startsWith('/api/book')?({books:[{id:2000,title:'Don Quijote',author:'Miguel de Cervantes',cover:'',languages:['es']}]}):({results:[],docs:[]});
  storeRecord('library',{name:'Rayuela',kind:'Libro',author:'Cortázar',status:'En curso',pages:600,currentPage:140,progress:23,notes:'',rating:0,favorite:false});save();go('books')`);await p.waitForTimeout(300);
 assert.match(await f().locator('.rd-now').textContent(),/Rayuela.*Página 140 de 600/);
 await f().locator('.rd-now .rd-actions button').first().click();await p.waitForTimeout(200);await f().locator('#progressForm [data-add="50"]').click();await f().locator('#progressForm .primary').click();await p.waitForTimeout(200);
 assert.equal(await run("R('library').find(r=>r.name==='Rayuela').currentPage"),190);
 await f().locator('#rdQuery').fill('quijote');await f().locator('.rd-search .primary').click();await p.waitForTimeout(300);
 await f().locator('.rd-result .primary').first().click();await f().locator('.rd-text p').first().waitFor();
 assert.equal(await f().locator('.rd-text p').first().textContent(),'Párrafo 1');
 assert.equal(await run("!!R('library').find(r=>r.gutenbergId===2000&&r.bookText)"),true,'saved with its text, for offline reading');await run('closeModal()');
 // English: the tutor answers and corrects
 await p.evaluate(()=>{EcosystemHost.ai=async b=>b.task==='tutor'?{reply:'Nice! What did you do there?',es:'¡Bien! ¿Qué hiciste ahí?',fix:'I went to the office yesterday.',why:'Pasado de go: went.'}:{}});
 await run("speakEnglish=()=>{};go('english');englishChatPane()");await p.waitForTimeout(300);await f().locator('#enText').fill('I go to the office yesterday');await f().locator('.en-input .primary').click();await p.waitForTimeout(400);
 assert.match(await f().locator('.en-fix').first().textContent(),/I went to the office yesterday/);
 // graph: shared genre and director become hubs, and each link says why
 await run(`for(const [t,a,g] of [['Dune','Denis Villeneuve','Ciencia ficción'],['Blade Runner 2049','Denis Villeneuve','Ciencia ficción'],['Moon','Duncan Jones','Ciencia ficción']])storeRecord('library',{name:t,kind:'Película',author:a,genre:g,status:'Terminado',progress:100,notes:'',rating:4,favorite:false});save()`);
 const rel=await run("JSON.stringify(lectaKnowledge().nodes.filter(n=>n.hub).map(n=>n.title))");assert.match(rel,/Ciencia ficción/);assert.match(rel,/Denis Villeneuve/);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('numio puts card closings and renewals in the iPhone Calendar',async()=>{
 const app=await open(server.url);const p=app.page;
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);
 await p.evaluate(()=>EcosystemHost.switchApp('iris'));await p.waitForTimeout(1500);
 await run("state.cards.push({id:'vi',name:'Visa ICBC',currency:'ARS',limit:3000000,closeDay:24,dueDay:5});state.subscriptions.push({id:'n',name:'Netflix',amount:12000,currency:'ARS',cycle:'mensual',day:28,remindDays:1,active:true});save()");
 const ics=await run(`new Promise(ok=>{const orig=URL.createObjectURL;URL.createObjectURL=b=>{b.text().then(ok);return orig.call(URL,b)};numioCalendar()})`);
 assert.match(ics,/SUMMARY:Cierra Visa ICBC/);assert.match(ics,/RRULE:FREQ=MONTHLY;BYMONTHDAY=24/);assert.match(ics,/SUMMARY:Vence Visa ICBC/);assert.match(ics,/SUMMARY:Netflix/);assert.match(ics,/BEGIN:VALARM/);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Switching apps lands on the home of the app, not where you left it',async()=>{
 const app=await open(server.url,{hash:'#/journal/notes'});const p=app.page;await p.waitForTimeout(900);
 const view=()=>p.evaluate(()=>[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentDocument.querySelector('.pagehead h1, h1')?.textContent);
 const notes=await view();
 await p.evaluate(()=>EcosystemHost.switchApp('organizador'));await p.waitForTimeout(1200);
 await p.evaluate(()=>EcosystemHost.switchApp('journal'));await p.waitForTimeout(900);
 assert.notEqual(await view(),notes,'left the notes view');assert.equal(await p.evaluate(()=>location.hash),'#/journal/dashboard');
 assert.deepEqual(app.errors,[]);await app.close();
});

test('AI: nubo search answers from your records; lecta recommends and saves',async()=>{
 const app=await open(server.url);const p=app.page;
 await p.evaluate(()=>{EcosystemHost.aiAsk=async q=>({answer:'Pagaste $ 45.000 de luz.',results:EcosystemHost.search('Electricidad',1)});
  EcosystemHost.ai=async b=>({items:[{title:'Nueve reinas',creator:'Fabián Bielinsky',year:'2000',why:'Estafas y vueltas de tuerca.'}]})});
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";
 const f=p.frameLocator('iframe.module:not([hidden])');
 await f.locator('header .search input').first().fill('cuanto pague de luz');await p.waitForTimeout(500);
 await f.locator('.ai-ask').click();await p.waitForTimeout(300);
 assert.match(await f.locator('.ai-answer').textContent(),/Pagaste \$ 45\.000 de luz\./);
 await p.evaluate(()=>EcosystemHost.switchApp('journal'));await p.waitForTimeout(1200);
 // movies: the AI picks land in "Para vos" with cover and synopsis, and open the full card
 await p.evaluate(`${W}.eval("go('movies');catalogJSON=async u=>u.startsWith('/api/movie')?({poster:'https://image.tmdb.org/t/p/w500/nr.jpg',synopsis:'Dos estafadores se conocen en una estación de servicio y, en un solo día, intentan vender una plancha de estampillas falsas.',providers:[{name:'Netflix',logo:'',kind:'stream'},{name:'Apple TV',logo:'',kind:'rent'}],link:'https://www.justwatch.com/ar/pelicula/nueve-reinas',tmdb:true,checked:true,runtime:114}):({results:[]})")`);await p.waitForTimeout(400);
 await p.evaluate(()=>{EcosystemHost.ai=async b=>b.task==='about'?{summary:'Un día en Buenos Aires.\nTensa y con humor.',forWho:'Para quien disfruta los engaños bien armados.',mood:['tensa','porteña']}:({items:[{title:'Nueve reinas',original:'Nueve reinas',creator:'Fabián Bielinsky',year:'2000',genre:'Policial',synopsis:'Dos estafadores se cruzan en Buenos Aires y arman el golpe de su vida.',why:'Estafas y vueltas de tuerca.'}]})});
 const g=p.frameLocator('iframe.module:not([hidden])');
 assert.ok((await g.locator('.ai-ask').boundingBox()).height<=44,'the AI bar is small');
 await g.locator('#aiWish-movies').fill('algo de estafas');await g.locator('[data-reco=movies] .ai-go').click();await p.waitForTimeout(500);
 assert.match(await g.locator('[data-reco=movies]').textContent(),/1 nueva en «✨ Para vos»/);
 const seed=await p.evaluate(`${W}.eval("JSON.stringify(DISCOVERY_SEEDS.find(r=>r.ai))")`).then(JSON.parse);
 assert.equal(seed.name,'Nueve reinas');assert.equal(seed.genre,'Para vos');assert.equal(seed.cover,'https://image.tmdb.org/t/p/w500/nr.jpg');assert.match(seed.synopsis,/plancha de estampillas/);
 assert.ok(await g.locator('.film-poster-card',{hasText:'Nueve reinas'}).count()>=1,'shows up in the discovery grid');
 await g.locator('.film-poster-card',{hasText:'Nueve reinas'}).first().locator('.film-poster-button').click();await p.waitForTimeout(300);
 assert.match(await g.locator('#modalBody').textContent(),/estampillas/);assert.match(await g.locator('#modalBody').textContent(),/Policial/);
 assert.match(await g.locator('.ai-why').textContent(),/vueltas de tuerca/);
 // where to watch it in Argentina, and the spoiler-free summary
 await p.waitForTimeout(200);assert.match(await g.locator('#movieWhere').textContent(),/Incluida en.*Netflix.*Alquiler.*Apple TV/);
 await g.locator('.ai-about-btn').click();await p.waitForTimeout(200);
 assert.match(await g.locator('.ai-about-body').textContent(),/Un día en Buenos Aires.*Para quién/);
 // "Quiero ver" saves it and closes the sheet
 await g.locator('.movie-actions .primary').click();await p.waitForTimeout(300);
 assert.equal(await p.evaluate(`${W}.document.getElementById('modal').open`),false);
 assert.equal(await p.evaluate(`${W}.eval("R('library').some(r=>r.name==='Nueve reinas'&&r.status==='Por empezar')")`),true);
 await g.locator('.ai-clear').click();await p.waitForTimeout(200);assert.doesNotMatch(await g.locator('[data-reco=movies]').textContent(),/nueva/);
 // books come back as covers that open a sheet
 await p.evaluate(()=>{EcosystemHost.ai=async b=>({items:[{title:'Rayuela',creator:'Julio Cortázar',year:'1963',synopsis:'Una novela que se puede leer en distinto orden.',why:'Porque te gustan los cuentos.'}]})});
 await p.evaluate(`${W}.eval("go('books');catalogJSON=async u=>({docs:[{cover_i:42,first_publish_year:1963}]})")`);await p.waitForTimeout(300);
 await g.locator('[data-reco=books] .ai-go').click();await p.waitForTimeout(500);
 assert.equal(await g.locator('.ai-book').count(),1);assert.match(await g.locator('.ai-book').textContent(),/Rayuela/);
 await g.locator('.ai-book').click();await p.waitForTimeout(200);assert.match(await g.locator('#modalBody').textContent(),/distinto orden/);
 await g.locator('#modalBody .primary').click();await p.waitForTimeout(200);
 assert.equal(await p.evaluate(`${W}.eval("R('library').some(r=>r.name==='Rayuela'&&r.kind==='Libro'&&/openlibrary/.test(r.cover))")`),true);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('lecta: knowledge graph, related notes, AI on a note, ideas and a map from a text',async()=>{
 const app=await open(server.url,{hash:'#/journal/notes'});const p=app.page;await p.waitForTimeout(900);
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";
 const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);
 await run(`for(const [t,b,tags] of [['Huerta en el balcón','Plantar tomates y albahaca en macetas, riego por goteo','huerta, plantas'],['Riego por goteo','Comprar manguera y goteros para la huerta en el balcón','huerta'],['Libro de cocina','Recetas con tomates y albahaca de la huerta','cocina'],['Viaje a Mendoza','Bodegas, montaña y vino','viajes']])storeRecord('notes',{title:t,body:'<p>'+b+'</p>',notebook:'Personal',tags,date:'2026-10-20',favorite:false,related:[]});save('ok')`);
 const g=await run("(()=>{const k=lectaKnowledge();return {n:k.nodes.length,e:k.edges.length,why:k.edges.map(e=>e.why.join('/')).join(' | ')}})()");
 assert.ok(g.n>=4&&g.e>=2,JSON.stringify(g));assert.match(g.why,/etiqueta «huerta»/);assert.match(g.why,/menciona/);
 const f=p.frameLocator('iframe.module:not([hidden])');
 await f.locator('.lk-tools button',{hasText:'Grafo'}).click();await p.waitForTimeout(500);
 assert.equal(await f.locator('h1').first().textContent(),'Grafo de conocimiento');
 assert.ok(await f.locator('.lk-node').count()>=4);
 const node=f.locator('.lk-node',{hasText:'Riego por goteo'});const b=await node.boundingBox();await p.mouse.click(b.x+b.width/2,b.y+6);await p.waitForTimeout(200);
 assert.match(await f.locator('#lkPanel').textContent(),/Huerta en el balcón/);
 // a note shows what it is related to, and the AI works on its text
 await p.evaluate(()=>{EcosystemHost.ai=async b=>b.task==='transform'?{text:'Plantar tomates y albahaca.'}:b.task==='tasks'?{tasks:[{title:'Comprar goteros',date:'',priority:'Media'}]}:{title:'Huerta',nodes:[{id:'n1',text:'Huerta',parent:''},{id:'n2',text:'Riego',parent:'n1'}]}});
 await run("noteForm(R('notes').find(n=>n.title==='Huerta en el balcón').id)");await p.waitForTimeout(300);
 assert.match(await f.locator('.lk-related-box').textContent(),/Riego por goteo/);
 await f.locator('.nte-ai').click();await f.locator('.lk-ai-menu [data-act=summary]').click();await p.waitForTimeout(200);
 assert.match(await f.locator('.lk-ai-text').textContent(),/Plantar tomates/);
 await f.locator('#lkAiResult [data-do=below]').click();assert.match(await f.locator('#noteEditor').innerHTML(),/<h2>Resumen<\/h2>/);
 await f.locator('.nte-ai').click();await f.locator('.lk-ai-menu [data-act=tasks]').click();await p.waitForTimeout(200);
 await f.locator('#lkTasksGo').click();await p.waitForTimeout(1500);
 assert.equal(await p.evaluate(()=>JSON.parse(EcosystemHost.getItem('ecosistema03-organizer')).records.tasks.some(t=>t.title==='Comprar goteros')),true);
 await run('closeModal()');
 // quick idea and a map from a text
 await run("lectaIdea()");await f.locator('#ideaForm textarea').fill('Armar un compost en casa');await f.locator('#ideaForm .primary').click();await p.waitForTimeout(200);
 assert.equal(await run("R('notes').some(n=>n.notebook==='Ideas'&&/idea/.test(n.tags)&&n.title==='Armar un compost en casa')"),true);
 await run("lectaTextMap('La huerta necesita riego y sol')");await f.locator('#textMapGo').click();await p.waitForTimeout(300);
 await f.locator('#textMapGo').click();await p.waitForTimeout(300);
 assert.equal(await run("R('maps').some(m=>m.name==='Huerta'&&m.nodes.length===2)"),true);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('lecta: notes list and editor, links with tags, drawing tools and long recordings',async()=>{
 const app=await open(server.url,{hash:'#/journal/notes'});const p=app.page;await p.waitForTimeout(900);
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";
 const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);const f=p.frameLocator('iframe.module:not([hidden])');
 // notes: autosave keeps one note, check boxes tick, search filters
 await run("noteForm()");await p.waitForTimeout(300);
 await f.locator('#noteForm [name=title]').fill('Compras');await f.locator('#noteEditor').click();
 // full screen like Personal OS: date, optional title, the capsule with the style picker and the AI button
 assert.equal(await f.locator('#modal').evaluate(d=>d.classList.contains('nt-full')),true);
 const box=await f.locator('#modal').boundingBox();assert.ok(box.width>=400&&box.height>=760,JSON.stringify(box));
 assert.equal(await f.locator('#noteForm [name=title]').getAttribute('placeholder'),'Título (opcional)');
 assert.match(await f.locator('.nte-date').textContent(),/ de \w+ de 20\d\d/);
 assert.ok(await f.locator('.nte-cap .nte-style').isVisible()&&await f.locator('.nte-ai').isVisible());
 await f.locator('.nte-style').click();await f.locator('.nte-styles [data-style=check]').click();await p.keyboard.type('Yerba');await p.waitForTimeout(1900);
 assert.equal(await run("R('notes').filter(n=>n.title==='Compras').length"),1,'autosaved once');
 await f.locator('.nte-top [aria-label=Volver]').click();await p.waitForTimeout(300);
 assert.equal(await run("R('notes').filter(n=>n.title==='Compras').length"),1,'closing did not duplicate');
 // a note without a title takes its first line; the "…" sheet keeps notebook, tags and favourite
 await run("noteForm()");await p.waitForTimeout(300);await f.locator('#noteEditor').click();await p.keyboard.type('Llamar a Juan');
 await f.locator('.nte-top [aria-label="Más opciones"]').click();assert.ok(await f.locator('.nte-sheet [name=tags]').isVisible());
 await f.locator('.nte-sheet [name=tags]').fill('llamadas');await f.locator('.nte-sheet-actions button',{hasText:'Listo'}).click();
 await f.locator('.nte-top [aria-label=Volver]').click();await p.waitForTimeout(300);
 assert.equal(await run("R('notes').some(n=>n.title==='Llamar a Juan'&&n.tags==='llamadas')"),true);
 assert.match(await run("R('notes').find(n=>n.title==='Compras').body"),/☐ ?Yerba/);
 assert.ok((await f.locator('.nt-card h3').allTextContents()).includes('Compras'));
 await f.locator('#ntQuery').fill('nada que coincida');await p.waitForTimeout(100);assert.equal(await f.locator('.nt-card').count(),0);
 await f.locator('#ntQuery').fill('');
 // links
 await run("go('links')");await p.waitForTimeout(200);await run("lectaLink()");
 await f.locator('#linkForm [name=url]').fill('elpais.com/recetas/milanesas-de-berenjena');await f.locator('#linkForm [name=tags]').fill('receta, cocina');
 await f.locator('#linkForm .primary').click();await p.waitForTimeout(300);
 assert.deepEqual(await run("R('links').map(l=>[l.url,l.title,l.tags])"),[['https://elpais.com/recetas/milanesas-de-berenjena','Milanesas de berenjena','receta, cocina']]);
 await f.locator('.nt-chips button',{hasText:'#cocina'}).click();await p.waitForTimeout(100);assert.equal(await f.locator('.lnk-card').count(),1);
 assert.equal((await p.evaluate(()=>EcosystemHost.search('berenjena',5))).map(e=>e.kind).join(),'links');
 // drawing: a held square snaps to a rectangle; undo/redo; saved with its shapes
 await run("drawingForm()");await p.waitForTimeout(300);
 const c=await f.locator('#drawingCanvas').boundingBox();const P=(x,y)=>[c.x+c.width*x,c.y+c.height*y];
 await p.mouse.move(...P(.2,.2));await p.mouse.down();for(const [x,y] of [[.5,.2],[.8,.2],[.8,.4],[.8,.6],[.5,.6],[.2,.6],[.2,.4],[.2,.22]])await p.mouse.move(...P(x,y),{steps:6});
 await p.waitForTimeout(800);await p.mouse.up();
 await f.locator('[data-tool=arrow]').click();await p.mouse.move(...P(.3,.8));await p.mouse.down();await p.mouse.move(...P(.7,.85),{steps:5});await p.mouse.up();
 const kinds=()=>run("JSON.stringify(document.getElementById('drawingForm')&&0)");
 await f.locator('[data-act=undo]').click();await f.locator('[data-act=redo]').click();
 await f.locator('#drawingForm [name=name]').fill('Plano');await f.locator('#drawingForm .primary').click();await p.waitForTimeout(300);
 const d=await run("(()=>{const r=R('drawings').find(r=>r.name==='Plano');return {kinds:r.shapes.map(s=>s.t),png:/^data:image\\/png/.test(r.image)}})()");
 assert.deepEqual(d,{kinds:['rect','arrow'],png:true});
 // recordings: up to an hour, kept in the media store
 await run("go('recordings')");await p.waitForTimeout(200);assert.match(await f.locator('.pagehead p').textContent(),/una hora/);
 await run("recordingForm()");await p.waitForTimeout(200);assert.match(await f.locator('#recState').textContent(),/60 minutos/);
 const key=await p.evaluate(()=>EcosystemHost.putMedia(new Blob([new Uint8Array(2000)],{type:'audio/mp4'})));
 await run(`closeModal();storeRecord('recordings',{name:'Clase',audio:'',media:'${key}',duration:3725});save()`);await p.waitForTimeout(400);
 assert.equal(await f.locator('.record-card .tag').first().textContent(),'1:02:05');
 assert.match(await f.locator('audio[data-parts]').first().getAttribute('src')||'',/^blob:/);
 // speech to text, then a note from it
 await p.evaluate(()=>{EcosystemHost.aiAudio=async blob=>({text:'Mañana llamar al plomero. Comprar yerba.'})});
 await f.locator('.record-card button',{hasText:'Pasar a texto'}).click();await p.waitForTimeout(500);
 assert.match(await run("R('recordings').find(r=>r.name==='Clase').transcript"),/llamar al plomero/);
 await f.locator('.record-card button',{hasText:'Convertir en nota'}).click();await p.waitForTimeout(400);
 assert.equal(await run("R('notes').some(n=>n.title==='Clase'&&n.notebook==='Grabaciones')"),true);
 assert.deepEqual(app.errors,[]);await app.close();
});

// ---- numio · Vaquitas: armar una juntada y un viaje, dividir de varias formas, marcar pagos, anotar tu parte, link público
const SHOTS=process.env.VQ_SHOTS;

test('Vaquitas: juntada con partes iguales y porcentajes, pagos marcados y tu parte en numio',async()=>{
 const app=await open(server.url);const p=app.page;
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);const f=()=>p.frameLocator('iframe.module:not([hidden])');
 const noScroll=async label=>assert.equal(await run('document.scrollingElement.scrollWidth<=document.scrollingElement.clientWidth'),true,'sin scroll horizontal: '+label);
 await p.evaluate(()=>EcosystemHost.switchApp('iris'));await p.waitForTimeout(1500);
 assert.equal(await run("IRIS_NAV.some(n=>n[0]==='vaquitas')"),true,'está en el menú de secciones');
 await run("go('vaquitas')");await p.waitForTimeout(300);
 assert.match(await f().locator('.vq-empty h2').textContent(),/Todavía no armaste ninguna vaquita/);
 if(SHOTS)await p.screenshot({path:SHOTS+'/1-vacio.png'});
 // new juntada
 await f().locator('.vq-cta').first().click();await p.waitForTimeout(200);
 await f().locator('#vqNew [name=title]').fill('Asado del sábado');await f().locator('#vqNew [name=me]').fill('Franco');await f().locator('#vqNew [name=names]').fill('Juli, Tomi');
 if(SHOTS)await p.screenshot({path:SHOTS+'/2-nueva.png'});
 await f().locator('#vqNew .primary').click();await p.waitForTimeout(400);
 assert.equal(await f().locator('.vq-title').textContent(),'Asado del sábado');
 assert.equal(await f().locator('.vq-people li').count(),3);
 // Carne $30.000 que pagué yo, entre los tres; mi parte va a numio
 const before=await run('state.expenses.length');
 await f().locator('.vq-fab').click();await p.waitForTimeout(200);
 await f().locator('#vqExp [name=title]').fill('Carne');await f().locator('#vqExp label:has([name=amount]) input[data-number-editor]').fill('30000');
 assert.match(await f().locator('.vq-split-hint').textContent(),/10\.000 cada uno/);
 assert.match(await f().locator('.vq-mine-amount').textContent(),/10\.000/);
 if(SHOTS)await p.screenshot({path:SHOTS+'/3-gasto.png'});
 await f().locator('#vqExp .primary').click();await p.waitForTimeout(400);
 assert.equal(await run('state.expenses.length'),before+1);
 assert.equal(await run("JSON.stringify((({amount,method,text})=>({amount,method,text}))(state.expenses.at(-1)))"),JSON.stringify({amount:10000,method:'Vaquita',text:'Carne · Asado del sábado'}));
 assert.ok(await run("!!state.vq.expenses.find(e=>e.title==='Carne').numioTxn"),'queda vinculado al movimiento de numio');
 // Bebida $6.000 que pagó Juli, por porcentaje 50/25/25
 await f().locator('.vq-fab').click();await p.waitForTimeout(200);
 await f().locator('#vqExp [name=title]').fill('Bebida');await f().locator('#vqExp label:has([name=amount]) input[data-number-editor]').fill('6000');
 await f().locator('#vqExp [name=payer]').selectOption({label:'Juli'});
 await f().locator('#vqExp .vq-modes label',{hasText:'%'}).click();await p.waitForTimeout(100);
 const pct=f().locator('#vqExp .vq-split-row input[data-number-editor]');
 await pct.nth(0).fill('50');await pct.nth(1).fill('25');await pct.nth(2).fill('20');
 assert.match(await f().locator('.vq-split-hint').textContent(),/suman 95%/);
 await pct.nth(2).fill('25');assert.match(await f().locator('.vq-split-hint').textContent(),/Cierra justo/);
 await f().locator('#vqExp [name=toNumio]').uncheck();
 await f().locator('#vqExp .primary').click();await p.waitForTimeout(400);
 // Franco puso 30.000, le toca 13.000 → recibe 17.000. Juli pone 5.500, Tomi 11.500.
 const t=await f().locator('.vq-transfers li').allTextContents();
 assert.equal(t.length,2);assert.match(t[0],/Tomi.*Franco.*11\.500/s);assert.match(t[1],/Juli.*Franco.*5\.500/s);
 assert.match(await f().locator('.vq-hero').textContent(),/Te deben\s*\$\s?17\.000/);
 await noScroll('detalle');
 if(SHOTS)await p.screenshot({path:SHOTS+'/4-detalle.png',fullPage:false});
 if(SHOTS){await run("document.scrollingElement.scrollTo(0,9999)");await p.waitForTimeout(200);await p.screenshot({path:SHOTS+'/5-detalle-abajo.png'});await run("document.scrollingElement.scrollTo(0,0)")}
 // Tomi transfirió: queda una sola, y deshacer la vuelve a poner
 await f().locator('.vq-transfers .vq-paid').first().click();await p.waitForTimeout(400);
 assert.equal(await f().locator('.vq-transfers li').count(),1);
 assert.match(await f().locator('.vq-paid-list').textContent(),/Tomi → Franco/);
 await f().locator('.vq-paid-list .vq-x').click();await p.waitForTimeout(400);assert.equal(await f().locator('.vq-transfers li').count(),2);
 await f().locator('.vq-transfers .vq-paid').first().click();await f().locator('.vq-transfers .vq-paid').first().click();await p.waitForTimeout(500);
 assert.match(await f().locator('.vq-done').textContent(),/Están todos al día/);
 // alias de Franco
 await f().locator('.vq-people li button').first().click();await p.waitForTimeout(200);await f().locator('#vqPerson [name=alias]').fill('franco.mp');await f().locator('#vqPerson .primary').click();await p.waitForTimeout(300);
 assert.equal(await run('ecosystemVaquitas.state.data.participants[0].aliasCbu'),'franco.mp');
 // WhatsApp lleva el resumen
 await run("window.__opened=[];parent.open=(u)=>{window.__opened.push(u)}");await f().locator('.vq-wa').click();
 const wa=decodeURIComponent((await run('window.__opened[0]')).split('text=')[1]);assert.match(wa,/\*Asado del sábado\*/);assert.match(wa,/¡Estamos todos al día!/);
 // cerrar
 await f().locator('.vq-nav .vq-icon').click();await p.waitForTimeout(200);await f().locator('#vqClose').click();await p.waitForTimeout(200);await f().locator('#vqDo').click();await p.waitForTimeout(400);
 assert.match(await f().locator('.vq-note').textContent(),/cerrada/);assert.equal(await f().locator('.vq-fab').count(),0,'cerrada: no se cargan gastos');
 await f().locator('.vq-back').click();await p.waitForTimeout(300);
 assert.match(await f().locator('.vq-caption').last().textContent(),/Cerradas/);
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Vaquitas: un viaje con una vaquita por cosa, gastos sueltos y por partes',async()=>{
 const app=await open(server.url,{theme:'dark'});const p=app.page;
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);const f=()=>p.frameLocator('iframe.module:not([hidden])');
 await p.evaluate(()=>EcosystemHost.switchApp('iris'));await p.waitForTimeout(1500);await run("state.theme='dark';save();go('vaquitas')");await p.waitForTimeout(300);
 await f().locator('.vq-cta').first().click();await p.waitForTimeout(200);
 await f().locator('#vqNew .vq-seg label',{hasText:'Viaje'}).click();
 assert.equal(await f().locator('#vqNew .vq-dates').isVisible(),true);
 await f().locator('#vqNew [name=title]').fill('Panaholma');await f().locator('#vqNew [name=startsOn]').fill('2026-11-06');await f().locator('#vqNew [name=endsOn]').fill('2026-11-08');
 await f().locator('#vqNew [name=me]').fill('Augusto');await f().locator('#vqNew [name=names]').fill('Fabri\nLeo');
 await f().locator('#vqNew .primary').click();await p.waitForTimeout(400);
 assert.match(await f().locator('.vq-kind').textContent(),/Viaje · 6 nov – 8 nov/);
 // vaquita "Nafta" solo entre Augusto y Fabri
 await f().locator('.vq-h2row .vq-ghost',{hasText:'Nueva'}).click();await p.waitForTimeout(200);
 await f().locator('#vqVaq [name=title]').fill('Nafta');await f().locator('#vqVaq .vq-pick-chips label',{hasText:'Leo'}).click();assert.equal(await f().locator('#vqVaq .vq-pick-chips label',{hasText:'Leo'}).locator('input').isChecked(),false);
 await f().locator('#vqVaq .primary').click();await p.waitForTimeout(400);
 assert.equal(await f().locator('.vq-title').textContent(),'Nafta');
 await f().locator('.vq-fab').click();await p.waitForTimeout(200);
 assert.equal(await f().locator('#vqExp [name=vaquita]').inputValue()!=='',true,'el gasto va a la vaquita abierta');
 assert.equal(await f().locator('#vqExp .vq-split-row').count(),2);
 await f().locator('#vqExp [name=title]').fill('YPF');await f().locator('#vqExp label:has([name=amount]) input[data-number-editor]').fill('40000');await f().locator('#vqExp [name=payer]').selectOption({label:'Fabri'});
 await f().locator('#vqExp .primary').click();await p.waitForTimeout(400);
 assert.match(await f().locator('.vq-transfers').textContent(),/Augusto.*Fabri.*20\.000/s);
 // volver al viaje: gasto suelto (peaje) por partes, Leo cuenta doble
 await f().locator('.vq-back').click();await p.waitForTimeout(300);
 await f().locator('.vq-loose').click();await p.waitForTimeout(300);
 await f().locator('.vq-fab').click();await p.waitForTimeout(200);
 await f().locator('#vqExp [name=title]').fill('Peaje');await f().locator('#vqExp label:has([name=amount]) input[data-number-editor]').fill('4000');
 await f().locator('#vqExp .vq-modes label',{hasText:'Partes'}).click();await p.waitForTimeout(100);
 await f().locator('#vqExp .vq-split-row',{hasText:'Leo'}).locator('input[data-number-editor]').fill('2');
 assert.match(await f().locator('.vq-split-hint').textContent(),/4 partes/);
 await f().locator('#vqExp [name=toNumio]').uncheck();await f().locator('#vqExp .primary').click();await p.waitForTimeout(400);
 const t=(await f().locator('.vq-transfers li').allTextContents()).join('|');
 assert.match(t,/Leo.*Augusto.*2\.000/s);assert.match(t,/Fabri.*Augusto.*1\.000/s);
 await f().locator('.vq-back').click();await p.waitForTimeout(300);
 assert.match(await f().locator('.vq-hero-row').textContent(),/44\.000.*1.*3/s,'total del viaje, 1 vaquita, 3 transferencias');
 assert.equal(await run('document.scrollingElement.scrollWidth<=document.scrollingElement.clientWidth'),true);
 if(SHOTS){await p.screenshot({path:SHOTS+'/6-viaje-oscuro.png'});await run("document.scrollingElement.scrollTo(0,9999)");await p.waitForTimeout(200);await p.screenshot({path:SHOTS+'/7-viaje-abajo.png'})}
 // sacar a alguien con gastos no se puede
 await f().locator('.vq-people li button',{hasText:'Leo'}).click();await p.waitForTimeout(200);
 assert.equal(await f().locator('#vqRemove').isDisabled(),true);await run('closeModal()');
 assert.deepEqual(app.errors,[]);await app.close();
});

test('Link público /v/: se ve sin cuenta, con quién le pasa a quién y el alias',async()=>{
 const ctx=await (await launch()).newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{window.__vqShared={group:{id:'g',kind:'juntada',title:'Asado',status:'open'},
  participants:[{id:'a',name:'Franco',aliasCbu:'franco.mp'},{id:'b',name:'Juli'},{id:'c',name:'Tomi'}],vaquitas:[],
  expenses:[{id:'e',vaquitaId:null,title:'Carne',amount:30000,payerId:'a',splitMode:'equal',spentOn:'2026-10-31',shares:[{participantId:'a'},{participantId:'b'},{participantId:'c'}]}],payments:[]}});
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(server.url+'/v.html?t=0123456789abcdef01234567');await p.waitForSelector('h1');
 assert.equal(await p.locator('h1').textContent(),'Asado');
 const text=await p.locator('main').textContent();
 assert.match(text,/Juli le pasa a Franco/);assert.match(text,/franco\.mp/);assert.match(text,/10\.000/);assert.match(text,/solo para ver/);
 assert.equal(await p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),true);
 if(SHOTS)await p.screenshot({path:SHOTS+'/8-publico.png'});
 assert.deepEqual(errors,[]);await ctx.close();
});

test('Comprobante de Mercado Pago: se lee en el teléfono y completa el gasto (y en una vaquita)',async()=>{
 // a screenshot like Mercado Pago's transfer receipt
 const ctx=await (await launch()).newContext({viewport:{width:390,height:700},deviceScaleFactor:2});const rp=await ctx.newPage();
 await rp.setContent(`<body style="margin:0;font:16px -apple-system,Helvetica,Arial,sans-serif;background:#fff;color:#111"><div style="padding:28px 24px">
  <p style="font-size:15px;color:#555">Comprobante de transferencia</p><p style="font-size:15px">Viernes, 25 de octubre de 2026, a las 14:32 hs</p>
  <p style="font-size:44px;font-weight:700;margin:18px 0">$ 12.300</p><p>Motivo: Varios</p>
  <p style="color:#555;margin-top:22px">De</p><p style="font-weight:600">Franco Augusto</p><p style="color:#555">Mercado Pago</p>
  <p style="color:#555;margin-top:18px">Para</p><p style="font-weight:600">Juan Pérez</p><p style="color:#555">Banco Galicia</p>
  <p style="color:#555;margin-top:22px">Número de operación de Mercado Pago</p><p style="font-weight:600">89123456789</p></div></body>`);
 const png=await rp.screenshot();await ctx.close();
 const app=await open(server.url);const p=app.page;
 const W="[...document.querySelectorAll('iframe.module')].find(f=>!f.hidden).contentWindow";const run=js=>p.evaluate(`${W}.eval(${JSON.stringify(js)})`);const f=()=>p.frameLocator('iframe.module:not([hidden])');
 await p.evaluate(()=>EcosystemHost.switchApp('iris'));await p.waitForTimeout(1500);
 await run('expenseForm()');await p.waitForTimeout(300);
 await f().locator('#expenseForm .vq-receipt input[type=file]').setInputFiles({name:'comprobante.png',mimeType:'image/png',buffer:png});
 await f().locator('#expenseForm .vq-receipt-state',{hasText:'Listo'}).waitFor({timeout:90000});
 assert.equal(await f().locator('#expenseForm [name=text]').inputValue(),'Transferencia a Juan Pérez');
 assert.equal(await run("document.querySelector('#expenseForm [name=amount]').value"),'12300');
 assert.equal(await f().locator('#expenseForm [name=date]').inputValue(),'2026-10-25');
 assert.match(await f().locator('#expenseForm [name=account]').inputValue(),/89123456789/);
 assert.equal(await f().locator('#expenseForm [name=method] option:checked').textContent(),'Transferencia');
 await run('closeModal()');
 // the same receipt inside a vaquita fills the expense and is remembered (no double loading)
 await run(`(async()=>{const st=ecosystemVaquitas.store();window.__g=await st.createGroup({kind:'juntada',title:'Regalo',meName:'Franco',names:['Juan Pérez']})})()`);
 await run("go('vaquitas')");await p.waitForTimeout(300);await run('vqOpen(window.__g)');await p.waitForTimeout(400);
 await f().locator('.vq-fab').click();await p.waitForTimeout(300);
 await f().locator('#vqExp .vq-receipt input[type=file]').setInputFiles({name:'comprobante.png',mimeType:'image/png',buffer:png});
 await f().locator('#vqExp .vq-receipt-state',{hasText:'Listo'}).waitFor({timeout:90000});
 assert.equal(await f().locator('#vqExp [name=title]').inputValue(),'Juan Pérez');
 await f().locator('#vqExp [name=toNumio]').uncheck();await f().locator('#vqExp .primary').click();await p.waitForTimeout(500);
 assert.equal(await run("state.vq.expenses.find(e=>e.groupId===window.__g).receiptRef"),'89123456789');
 assert.deepEqual(app.errors,[]);await app.close();
});
