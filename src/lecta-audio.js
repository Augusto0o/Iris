// lecta · recordings up to an hour, with pause and a level meter, and speech to text. The audio goes to the
// phone's media store (IndexedDB, through nubo), in parts of ~3.5 MB so each one can be turned into text by the
// AI (Groq's Whisper through /api/ai). The player goes from one part to the next by itself.
(()=>{
'use strict';
if(typeof recordingForm!=='function'||typeof schemas==='undefined'||!schemas.recordings)return;
const host=()=>parent.EcosystemHost,MAX=60*60*1000,PART=3_400_000;
const KEY=/^(scan|media)-[\w-]{6,64}$/;
// old recordings keep their audio inline; new ones keep references to the media store
const validateBefore=schemas.recordings.validate;
schemas.recordings.validate=(v,old)=>{if(KEY.test(v.media||'')){if(!String(v.name||'').trim())throw Error('Poné un título.');if(v.transcript&&String(v.transcript).length>200000)throw Error('El texto es demasiado largo.');return}return validateBefore(v,old)};
const clock=ms=>{const s=Math.floor(ms/1000);return (s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s/60)%60).padStart(s>=3600?2:1,'0')+':'+String(s%60).padStart(2,'0')};
let rec=null; // {stream,recorder,type,parts:[Blob],chunks,bytes,started,paused,elapsed,timer,meter,ctx,done,finishing}
const busy=new Map(); // recording id → what is happening ("Pasando a texto… 2 de 4")
function stopAll(){if(!rec)return;clearInterval(rec.timer);cancelAnimationFrame(rec.meter);try{rec.ctx?.close()}catch{}rec.stream?.getTracks().forEach(t=>t.stop())}
function elapsed(){return rec?rec.elapsed+(rec.paused||!rec.started?0:Date.now()-rec.started):0}
function paint(){const st=document.getElementById('recState'),t=document.getElementById('recTime'),main=document.getElementById('recMain'),pause=document.getElementById('recPause'),save=document.getElementById('saveAudio');if(!t)return;
 const state=!rec?'idle':rec.done?'done':rec.recorder?.state==='recording'?'rec':rec.recorder?.state==='paused'?'paused':'idle';
 t.textContent=clock(state==='done'?rec.elapsed:elapsed());main.dataset.state=state;main.setAttribute('aria-label',state==='rec'||state==='paused'?'Terminar la grabación':'Grabar');main.disabled=state==='done';
 pause.hidden=!(state==='rec'||state==='paused');pause.textContent=state==='paused'?'Seguir':'Pausa';
 st.textContent={idle:'Tocá el círculo para grabar. Hasta 60 minutos.',rec:'Grabando…',paused:'En pausa',done:'Lista para guardar.'}[state];save.disabled=state==='rec'||state==='paused'}
// one MediaRecorder per part: when a part reaches ~3.5 MB it closes and the next one starts on the same microphone
function nextPart(){const r=rec,recorder=new MediaRecorder(r.stream,r.type?{mimeType:r.type,audioBitsPerSecond:64000}:undefined),chunks=[];r.recorder=recorder;r.bytes=0;
 recorder.ondataavailable=e=>{if(!e.data?.size)return;chunks.push(e.data);r.bytes+=e.data.size;if(r.bytes>PART&&recorder.state==='recording'&&!r.finishing){r.rolling=true;recorder.stop()}};
 recorder.onstop=()=>{if(rec!==r)return;if(chunks.length)r.parts.push(new Blob(chunks,{type:recorder.mimeType||r.type||'audio/mp4'}));
  if(r.rolling&&!r.finishing){r.rolling=false;nextPart();return}
  r.elapsed=elapsed();r.started=0;r.done=true;stopAll();
  const prev=document.getElementById('audioPreview');if(prev)prev.innerHTML=`<audio controls src="${URL.createObjectURL(r.parts[0])}"></audio>${r.parts.length>1?`<p class="small">Se guardó en ${r.parts.length} partes; se reproducen seguidas.</p>`:''}`;paint()};
 recorder.start(1000)} // a chunk every second: nothing is lost if the phone interrupts
async function start(){
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('Este navegador no permite grabar audio.');return}
 try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  if(!document.getElementById('audioForm')){stream.getTracks().forEach(t=>t.stop());return}
  const type=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported?.(t));
  rec={stream,type,parts:[],started:Date.now(),paused:false,elapsed:0,done:false,finishing:false};nextPart();
  rec.timer=setInterval(()=>{paint();if(elapsed()>=MAX)finish()},250);
  try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),src=ctx.createMediaStreamSource(stream),an=ctx.createAnalyser();an.fftSize=256;src.connect(an);rec.ctx=ctx;
   const data=new Uint8Array(an.frequencyBinCount),bar=document.getElementById('recLevel');
   const tick=()=>{if(!rec||rec.ctx!==ctx)return;an.getByteTimeDomainData(data);let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v-128));if(bar)bar.style.setProperty('--l',String(Math.min(1,peak/70)));rec.meter=requestAnimationFrame(tick)};tick()}catch{}
  paint();
 }catch{notify('No se pudo usar el micrófono. Revisá el permiso.')}
}
function finish(){const r=rec?.recorder;if(r&&r.state!=='inactive'){rec.finishing=true;if(r.state==='paused')r.resume();r.stop()}}
function togglePause(){const r=rec?.recorder;if(!r)return;if(r.state==='recording'){r.pause();rec.elapsed=elapsed();rec.paused=true}else if(r.state==='paused'){r.resume();rec.paused=false;rec.started=Date.now()}paint()}
// the app calls this when the window closes: a recording in progress is dropped
stopRecording=function(cancel=false){if(!rec)return;if(cancel){const r=rec;rec=null;if(r.recorder&&r.recorder.state!=='inactive'){r.recorder.onstop=null;try{r.recorder.stop()}catch{}}clearInterval(r.timer);cancelAnimationFrame(r.meter);try{r.ctx?.close()}catch{}r.stream?.getTracks().forEach(t=>t.stop())}else finish()};
window.stopRecording=stopRecording;

// ---- speech to text --------------------------------------------------------------------------------------------
async function partsOf(r){if(Array.isArray(r.parts)&&r.parts.length)return r.parts;if(r.media)return [r.media];return []}
async function blobOf(key){return key.startsWith('data:')?await (await fetch(key)).blob():await host().getMedia(key)}
window.lectaTranscribe=async id=>{const r=record('recordings',id);if(!r||busy.has(id))return;
 const keys=await partsOf(r),list=keys.length?keys:r.audio?[r.audio]:[];if(!list.length){notify('Esta grabación no tiene audio en este dispositivo.');return}
 const texts=[];try{
  for(let i=0;i<list.length;i++){busy.set(id,list.length>1?`Pasando a texto… parte ${i+1} de ${list.length}`:'Pasando a texto…');render();
   const blob=await blobOf(list[i]);if(!blob)throw Error('Falta una parte del audio en este dispositivo.');
   if(blob.size>4_300_000)throw Error('Esta grabación es de antes y es muy larga para pasarla a texto de una vez. Las nuevas se dividen solas.');
   texts.push((await host().aiAudio(blob)).text||'')}
  const transcript=texts.join(' ').replace(/\s+/g,' ').trim();busy.delete(id);
  storeRecord('recordings',{...record('recordings',id),transcript:transcript||'(no se entendió nada)'},id);save(transcript?'Texto listo':'No se entendió el audio')}
 catch(err){busy.delete(id);render();notify(err.message)}};
const paragraphs=t=>String(t).split(/(?<=[.!?])\s+/).reduce((out,s)=>{const last=out.at(-1);if(last&&last.length<320)out[out.length-1]=last+' '+s;else out.push(s);return out},[]);
window.lectaRecordingNote=id=>{const r=record('recordings',id);if(!r?.transcript)return;
 const n=storeRecord('notes',{title:r.name,body:paragraphs(r.transcript).map(p=>'<p>'+esc(p)+'</p>').join(''),notebook:'Grabaciones',tags:'grabación',date:typeof today==='function'?today():new Date().toISOString().slice(0,10),favorite:false,related:[]});
 save('Nota creada');setTimeout(()=>noteForm(n.id),0)};
window.lectaRecordingTasks=async id=>{const r=record('recordings',id);if(!r?.transcript||busy.has(id))return;busy.set(id,'Buscando tareas…');render();
 try{const out=await host().ai({task:'tasks',text:r.transcript});busy.delete(id);if(!out.tasks?.length){render();notify('No encontré tareas en la grabación.');return}
  await host().addTasks(out.tasks);render();notify(out.tasks.length===1?'1 tarea creada en foco.':out.tasks.length+' tareas creadas en foco.')}
 catch(err){busy.delete(id);render();notify(err.message)}};

recordingForm=function(id){
 const r=record('recordings',id);rec=null;
 openModal(r?'Grabación':'Nueva grabación',`<form class="form" id="audioForm"><label>Título<input name="name" maxlength="100" required value="${esc(r?.name||'')}" placeholder="Una idea, una clase, una reunión…"></label>
  ${r?'':`<div class="rec-box"><button type="button" class="rec-main" id="recMain" data-state="idle" aria-label="Grabar"><i></i></button><div class="rec-info"><strong id="recTime">0:00</strong><span class="rec-level" id="recLevel"><i></i></span><span class="small" id="recState"></span></div><button type="button" id="recPause" hidden>Pausa</button></div>
  <label class="checklabel"><input type="checkbox" name="toText" checked>Pasar a texto al guardar</label>`}
  <div id="audioPreview" class="rec-preview"></div>
  <div class="form-actions"><button type="button" onclick="closeModal()">Cancelar</button><button id="saveAudio" class="primary">Guardar</button></div></form>`);
 const prev=document.getElementById('audioPreview');
 if(r){const first=r.parts?.[0]||r.media;if(first)host().scanURL(first).then(u=>{prev.innerHTML=u?`<audio controls src="${u}"></audio>`:'<p class="small">El audio no está en este dispositivo.</p>'});else if(r.audio)prev.innerHTML=`<audio controls src="${r.audio}"></audio>`}
 else{document.getElementById('recMain').onclick=()=>{const s=rec?.recorder?.state;if(s==='recording'||s==='paused')finish();else if(!rec?.done)start()};document.getElementById('recPause').onclick=togglePause;paint()}
 document.getElementById('audioForm').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.target),name=String(d.get('name')).trim(),btn=document.getElementById('saveAudio');
  try{if(rec&&!rec.done&&rec.recorder?.state!=='inactive')throw Error('Terminá la grabación antes de guardar.');
   if(r){storeRecord('recordings',{...r,name},id);closeModal();save('Grabación guardada');return}
   if(!rec?.parts?.length)throw Error('Primero grabá algo.');btn.disabled=true;const keys=[];for(const p of rec.parts)keys.push(await host().putMedia(p));
   const saved=storeRecord('recordings',{name,audio:'',media:keys[0],parts:keys,duration:Math.round(rec.elapsed/1000),mime:rec.parts[0].type,transcript:''});
   rec=null;closeModal();save('Grabación guardada');if(d.get('toText')==='on')window.lectaTranscribe(saved.id)}catch(err){btn.disabled=false;notify(err.message)}};
};
// the list: length, the text when there is one, and what to do with it
const markupBefore=appMarkup;
appMarkup=function(v){if(v!=='recordings')return markupBefore(v);const rows=R('recordings').filter(r=>!r.deletedAt).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 return head('Grabaciones','Capturá una idea con tu voz. Hasta una hora, y pasala a texto.','recordingForm()','Nueva grabación')+(rows.length?`<div class="record-grid">${rows.map(r=>{const parts=r.parts?.length?r.parts:r.media?[r.media]:[],doing=busy.get(r.id);
  return `<article class="card record-card"><div class="sectionhead"><h2>${esc(r.name)}</h2>${r.duration?`<span class="tag">${clock(r.duration*1000)}</span>`:''}</div>
  ${parts.length?`<audio controls preload="none" data-parts="${parts.join(',')}"></audio>`:r.audio?`<audio controls preload="none" src="${r.audio}"></audio>`:''}<p class="small">${esc(String(r.createdAt||'').slice(0,10).split('-').reverse().join('/'))}${parts.length>1?' · '+parts.length+' partes':''}</p>
  ${doing?`<p class="small rec-busy">${esc(doing)}</p>`:r.transcript?`<details class="rec-text"><summary>Texto</summary><p>${esc(r.transcript)}</p></details>`:''}
  <div class="actions">${doing?'':r.transcript?`<button onclick="lectaRecordingNote('${r.id}')">Convertir en nota</button><button onclick="lectaRecordingTasks('${r.id}')">Sacar tareas</button>`:`<button class="primary" onclick="lectaTranscribe('${r.id}')">Pasar a texto</button>`}<button onclick="recordingForm('${r.id}')">Renombrar</button><button class="iconbtn ghost danger" onclick="removeRecord('recordings','${r.id}')" aria-label="Eliminar grabación">${icon('trash')}</button></div></article>`}).join('')}</div>`
  :section('Tu voz, guardada',empty('Grabá tu primera idea','Hasta 60 minutos, con pausa, y después pasala a texto.','recordingForm()','Grabar','mic')))};
// players: the first part loads when shown; at the end of a part the next one plays
const show=()=>{for(const a of document.querySelectorAll('audio[data-parts]:not([data-ready])')){a.dataset.ready='1';const parts=a.dataset.parts.split(',').filter(Boolean);let i=0;
  const load=(play)=>host().scanURL(parts[i]).then(u=>{if(!u)return;a.src=u;if(play)a.play().catch(()=>{})});load(false);
  a.addEventListener('ended',()=>{if(i<parts.length-1){i++;load(true)}else if(i){i=0;load(false)}})}};
new MutationObserver(show).observe(document.body,{childList:true,subtree:true});
try{render()}catch{}
})();
