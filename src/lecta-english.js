// lecta · Inglés, better: lessons made by the AI for your level (they open in the same lesson player), a tutor to
// talk with (by voice or text, with gentle corrections), and your English diary corrected by the AI, whose new
// words go to your vocabulary review.
(()=>{
'use strict';
if(typeof englishHome!=='function'||typeof ORIGINAL_LESSONS==='undefined')return;
const host=()=>parent.EcosystemHost;
const SPARK='<svg class="ai-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';
const MIC='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const SPEAK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
S.prefs.aiLessons=Array.isArray(S.prefs.aiLessons)?S.prefs.aiLessons:[];
for(const l of S.prefs.aiLessons)if(!ORIGINAL_LESSONS.some(x=>x.id===l.id))ORIGINAL_LESSONS.push(l);
const SCENES=[['Charla libre','Free conversation about my day'],['Restaurante','Ordering food at a restaurant'],['Viaje','At the airport and the hotel'],['Trabajo','A job interview'],['Reunión','A work meeting with a client'],['Médico','At the doctor'],['Compras','Shopping and returns']];
let pane=null,chatBusy=false,lessonBusy=false;

// ---- new lesson with the AI --------------------------------------------------------------------------------
window.englishAILesson=async()=>{if(lessonBusy)return;const topic=document.getElementById('enTopic')?.value.trim()||'';lessonBusy=true;render();
 try{const l=await host().ai({task:'lesson',level:englishLevel(),topic});const lesson={...l,id:'ai-'+englishLevel().toLowerCase()+'-'+Date.now().toString(36),level:englishLevel(),ai:true};
  ORIGINAL_LESSONS.push(lesson);S.prefs.aiLessons=[...S.prefs.aiLessons,lesson].slice(-30);persist();lessonBusy=false;startEnglishLesson(lesson.id)}
 catch(e){lessonBusy=false;render();notify(e.message||'No se pudo armar la lección.')}};

// ---- tutor --------------------------------------------------------------------------------------------------
const chat=()=>S.prefs.englishChat||={scene:SCENES[0][0],messages:[]};
function chatMarkup(){const c=chat();return `<section class="card en-chat"><div class="en-scenes">${SCENES.map(([k])=>`<button type="button" class="${c.scene===k?'active':''}" onclick="englishScene('${k}')">${k}</button>`).join('')}</div>
 <div class="en-thread" id="enThread">${c.messages.length?c.messages.map((m,i)=>m.role==='assistant'?`<div class="en-msg tutor"><p lang="en">${esc(m.content)}</p>${m.es?`<details><summary>Traducción</summary><p>${esc(m.es)}</p></details>`:''}<button type="button" class="en-say" aria-label="Escuchar" onclick="speakEnglish(${esc(JSON.stringify(m.content))})">${SPEAK}</button></div>`
  :`<div class="en-msg me"><p lang="en">${esc(m.content)}</p>${m.fix?`<p class="en-fix"><b>Mejor:</b> <span lang="en">${esc(m.fix)}</span>${m.why?` · ${esc(m.why)}`:''}</p>`:''}</div>`).join(''):`<p class="small">Elegí una situación y escribí o hablá en inglés. Te respondo a tu nivel (${englishLevel()}) y te corrijo con suavidad.</p>`}
  ${chatBusy?'<div class="en-msg tutor"><p class="ai-status">Escribiendo…</p></div>':''}</div>
 <form class="en-input" onsubmit="event.preventDefault();englishSend()"><button type="button" class="en-mic" aria-label="Hablar en inglés" onclick="englishListen(this)">${MIC}</button><input id="enText" lang="en" autocomplete="off" autocapitalize="sentences" placeholder="Write in English…"><button class="primary" ${chatBusy?'disabled':''}>Enviar</button></form>
 ${c.messages.length?`<button type="button" class="ghost small" onclick="englishResetChat()">Empezar de nuevo</button>`:''}</section>`}
window.englishScene=k=>{const c=chat();if(c.scene!==k){c.scene=k;c.messages=[];persist()}render();if(!c.messages.length)englishSend(true)};
window.englishResetChat=()=>{chat().messages=[];persist();render()};
window.englishSend=async(start=false)=>{if(chatBusy)return;const c=chat(),input=document.getElementById('enText'),text=start?'':String(input?.value||'').trim();if(!start&&!text)return;
 if(text)c.messages.push({role:'user',content:text});chatBusy=true;render();
 try{const scene=SCENES.find(s=>s[0]===c.scene)?.[1]||c.scene;const r=await host().ai({task:'tutor',level:englishLevel(),scene,messages:c.messages.map(m=>({role:m.role,content:m.content}))});
  const mine=[...c.messages].reverse().find(m=>m.role==='user');if(mine&&r.fix&&text)Object.assign(mine,{fix:r.fix,why:r.why});
  c.messages.push({role:'assistant',content:r.reply,es:r.es});c.messages=c.messages.slice(-30);persist();chatBusy=false;render();if(S.prefs.englishAutoSpeak!==false)speakEnglish(r.reply)}
 catch(e){chatBusy=false;render();notify(e.message||'No se pudo hablar con la IA.')}
 setTimeout(()=>{const t=document.getElementById('enThread');if(t)t.scrollTop=t.scrollHeight;document.getElementById('enText')?.focus({preventScroll:true})},30)};
window.englishListen=btn=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){notify('Tu navegador no reconoce la voz. Escribí la frase.');return}
 const rec=new R();rec.lang='en-US';rec.interimResults=true;btn.classList.add('on');const input=document.getElementById('enText');
 rec.onresult=e=>{input.value=[...e.results].map(r=>r[0].transcript).join(' ');if(e.results[e.results.length-1].isFinal){rec.stop()}};
 rec.onend=()=>{btn.classList.remove('on');if(input.value.trim())englishSend()};rec.onerror=()=>btn.classList.remove('on');try{rec.start()}catch{btn.classList.remove('on')}};

// ---- diary corrected by the AI -------------------------------------------------------------------------------
window.englishCorrect=async id=>{const w=record('englishWriting',id);if(!w)return;
 openModal('Corrección de «'+(w.name||'tu texto')+'»','<p class="ai-status">'+SPARK+'Corrigiendo…</p>',true);
 try{const r=await host().ai({task:'correct',text:w.text,level:englishLevel()});if(!document.getElementById('modal').open)return;
  document.getElementById('modalBody').innerHTML=`<div class="en-correct">${r.praise?`<p class="en-praise">${esc(r.praise)}</p>`:''}<section><h3>Texto corregido${r.level?` · nivel ${esc(r.level)}`:''}</h3><p lang="en" class="en-corrected">${esc(r.corrected)}</p><button type="button" class="ghost" onclick="speakEnglish(${esc(JSON.stringify(r.corrected))})">${SPEAK}Escuchar</button></section>
   ${r.mistakes.length?`<section><h3>Errores</h3><ul class="en-mistakes">${r.mistakes.map(m=>`<li><s lang="en">${esc(m.wrong)}</s> → <b lang="en">${esc(m.right)}</b><small>${esc(m.why)}</small></li>`).join('')}</ul></section>`:''}
   ${r.better.length?`<section><h3>Sonaría más natural</h3>${r.better.map(b=>`<p lang="en">${esc(b)}</p>`).join('')}</section>`:''}
   ${r.words.length?`<section><h3>Palabras para tu repaso</h3><ul class="en-words">${r.words.map(x=>`<li><b lang="en">${esc(x.en)}</b> · ${esc(x.es)}</li>`).join('')}</ul></section>`:''}
   <div class="actions"><button type="button" class="primary" id="enKeep">Guardar en la entrada${r.words.length?' y sumar las palabras':''}</button><button type="button" onclick="closeModal()">Cerrar</button></div></div>`;
  document.getElementById('enKeep').onclick=()=>{storeRecord('englishWriting',{...w,corrected:r.corrected,notes:[w.notes,'Corrección: '+r.mistakes.map(m=>m.wrong+' → '+m.right).join('; ')].filter(Boolean).join('\n').slice(0,4000)},id);
   for(const x of r.words)if(!R('vocabulary').some(v=>String(v.term).toLowerCase()===x.en.toLowerCase()))storeRecord('vocabulary',{term:x.en,meaning:x.es,example:x.example||'',topic:'Inglés · mi diario',nextReview:today()});
   closeModal();save(r.words.length?'Corrección guardada y '+r.words.length+' palabras para repasar':'Corrección guardada')}}
 catch(e){document.getElementById('modalBody').innerHTML=`<p class="ai-error">${esc(e.message||'No se pudo corregir.')}</p>`}};

// ---- the page ------------------------------------------------------------------------------------------------
const homeBefore=englishHome;
englishHome=function(){let html=homeBefore();const holder=document.createElement('div');holder.innerHTML=html;
 const filters=holder.querySelector('.filters');if(filters){const b=document.createElement('button');b.textContent='Conversar';b.className=pane==='chat'?'active':'';b.setAttribute('onclick',"englishChatPane()");filters.append(b);if(pane==='chat')filters.querySelectorAll('button').forEach(x=>{if(x!==b)x.classList.remove('active')})}
 if(pane==='chat'){[...holder.children].forEach(n=>{if(n!==filters&&!n.matches('.pagehead,.collection-toolbar'))n.remove()});const t=document.createElement('template');t.innerHTML=chatMarkup();holder.append(t.content);return holder.innerHTML}
 if(englishPane==='lessons'){const hero=holder.querySelector('.hero');const t=document.createElement('template');
  t.innerHTML=`<section class="card en-ai"><div><strong>${SPARK}Lección nueva con IA</strong><p class="small">Una lección a tu nivel (${englishLevel()}) sobre lo que quieras: vocabulario, gramática, diálogo para escuchar, preguntas y frases para decir en voz alta.</p></div><form class="en-input" onsubmit="event.preventDefault();englishAILesson()"><input id="enTopic" maxlength="120" placeholder="Tema (opcional): pedir un aumento, el clima…"><button class="primary" ${lessonBusy?'disabled':''}>${lessonBusy?'Armando…':'Crear'}</button></form></section>`;
  (hero||filters)?.after(t.content);
  for(const card of holder.querySelectorAll('.record-card')){const btn=card.querySelector('button[onclick^="startEnglishLesson"]');const id=/startEnglishLesson\('([^']+)'\)/.exec(btn?.getAttribute('onclick')||'')?.[1];if(id?.startsWith('ai-')){const tag=card.querySelector('.tag');if(tag)tag.textContent+=' · IA'}}}
 if(englishPane==='writing')for(const card of holder.querySelectorAll('.record-card')){const edit=card.querySelector('[onclick*="englishWriting"]');const id=/'englishWriting','([^']+)'/.exec(card.innerHTML)?.[1];if(!id)continue;
  const w=record('englishWriting',id);const b=document.createElement('button');b.className='en-fixbtn';b.innerHTML=SPARK+(w?.corrected?'Ver otra corrección':'Corregir con IA');b.setAttribute('onclick',`englishCorrect('${id}')`);card.append(b);
  if(w?.corrected){const p=document.createElement('p');p.className='small en-corrected';p.lang='en';p.textContent='✓ '+w.corrected.slice(0,220);card.querySelector('.media-description')?.after(p)}}
 return holder.innerHTML};
window.englishChatPane=()=>{pane='chat';render();if(!chat().messages.length)englishSend(true)};
// leaving the chat when another tab is chosen
document.addEventListener('click',e=>{const b=e.target.closest?.('.filters button');if(b&&!/englishChatPane/.test(b.getAttribute('onclick')||''))pane=null},true);
try{render()}catch{}
})();
