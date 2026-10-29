// lecta · the note editor like Personal OS: a full-screen page with round buttons on top (back, undo, redo, read,
// more), the date, a big optional title and the text; a floating capsule at the bottom with the style picker
// ("Cuerpo"), bold and italic, photo, drawing, dictation and the AI button. Runs after lecta-notes and lecta-plus,
// so it only rearranges what they built (autosave, check boxes, photos, AI actions and related notes keep working).
(()=>{
'use strict';
if(typeof noteForm!=='function')return;
const host=()=>parent.EcosystemHost;
const SVG=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const I={
 back:SVG('<path d="M15 5l-7 7 7 7"/>'),undo:SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),redo:SVG('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
 read:SVG('<path d="M2 5.5C4.5 4 8 4 12 6.5 16 4 19.5 4 22 5.5V19c-2.5-1.5-6-1.5-10 1-4-2.5-7.5-2.5-10-1z"/><path d="M12 6.5V20"/>'),more:SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
 image:SVG('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>'),pen:SVG('<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>'),
 mic:SVG('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),spark:'<svg viewBox="0 0 24 24" aria-hidden="true" class="nte-fill"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>',
 down:SVG('<path d="m7 10 5 5 5-5"/>'),trash:SVG('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),check:SVG('<path d="m5 12 5 5 9-10"/>'),x:SVG('<path d="M6 6l12 12M18 6 6 18"/>')};
const STYLES=[['h2','Título','nte-s-h2'],['h3','Subtítulo','nte-s-h3'],['p','Cuerpo',''],['blockquote','Cita','nte-s-quote'],['ul','Lista con viñetas',''],['ol','Lista numerada',''],['check','Casillas',''],['pre','Monoespaciado','nte-s-mono'],['u','Subrayado',''],['s','Tachado','']];
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const longDate=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||'');return m?`${+m[3]} de ${MONTHS[+m[2]-1]} de ${m[1]}`:''};
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function btn(cls,label,html,fn){const b=el('button',cls,html);b.type='button';b.setAttribute('aria-label',label);b.onmousedown=e=>e.preventDefault();if(fn)b.onclick=fn;return b}

const before=noteForm;
noteForm=function(id){
 before(id);
 const modal=document.getElementById('modal'),form=document.getElementById('noteForm'),ed=document.getElementById('noteEditor');if(!modal||!form||!ed||form.dataset.nte)return;
 form.dataset.nte='1';modal.classList.add('nt-full');form.classList.add('nt-editor');
 const title=form.querySelector('[name=title]'),dateInput=form.querySelector('[name=date]'),oldBar=form.querySelector('.editor-toolbar'),aiTool=form.querySelector('.lk-ai-tool'),aiMenu=form.querySelector('.lk-ai-menu'),aiResult=document.getElementById('lkAiResult'),foot=form.querySelector('.nt-foot'),related=form.querySelector('.lk-related-box'),actions=form.querySelector('.form-actions');
 title.removeAttribute('required');title.placeholder='Título (opcional)';title.setAttribute('aria-label','Título');title.setAttribute('enterkeyhint','next');title.closest('label')?.replaceWith(title);
 ed.dataset.placeholder='Escribí lo que quieras…';
 const changed=()=>ed.dispatchEvent(new Event('input',{bubbles:true}));
 const sync=()=>ed.classList.toggle('is-empty',!ed.textContent.trim()&&!ed.querySelector('img,li,hr'));
 ed.addEventListener('input',sync);sync();
 title.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ed.focus()}});

 // top: back · undo · redo · read · more
 const top=el('div','nte-top'),right=el('div','nte-top-right');
 const close=()=>{closeModal()};
 top.append(btn('nte-round','Volver',I.back,close),right);
 right.append(btn('nte-round','Deshacer',I.undo,()=>{ed.focus();document.execCommand('undo');changed()}),btn('nte-round','Rehacer',I.redo,()=>{ed.focus();document.execCommand('redo');changed()}),
  btn('nte-round','Leer',I.read,()=>{closeModal();setTimeout(()=>{const n=id?record('notes',id):R('notes').filter(n=>!n.deletedAt).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0];if(n)readNote(n.id)},60)}),
  btn('nte-round','Más opciones',I.more,()=>toggleSheet()));

 // the page: date, title, text
 const page=el('div','nte-page'),date=el('button','nte-date');date.type='button';const paintDate=()=>{date.textContent=longDate(dateInput?.value)||'Sin fecha'};paintDate();date.onclick=()=>toggleSheet();dateInput?.addEventListener('change',paintDate);
 page.append(date,title,ed);if(aiResult)page.append(aiResult);if(foot)page.append(foot);if(related)page.append(related);

 // "…": notebook, date, tags, favourite, relations, delete
 const sheet=el('div','nte-sheet');sheet.hidden=true;const sheetHead=el('div','nte-sheet-head','<strong>Detalles de la nota</strong>');sheetHead.append(btn('nte-round small','Cerrar',I.x,()=>toggleSheet(false)));sheet.append(sheetHead);
 const wrapField=oldBar?.parentElement!==form?oldBar?.parentElement:null;if(wrapField){wrapField.classList.add('nte-hidden');wrapField.querySelector(':scope>label')?.remove()}
 for(const node of [...form.children])if(node!==wrapField&&node!==actions&&!node.matches?.('datalist,input[type=file]'))sheet.append(node);
 const sheetActions=el('div','nte-sheet-actions');
 sheetActions.append(btn('nte-pill','Listo','Listo',()=>toggleSheet(false)));
 if(id)sheetActions.append(btn('nte-pill danger','Mover a la papelera',I.trash+'Papelera',()=>{closeModal();setTimeout(()=>removeRecord('notes',id),0)}));
 sheet.append(sheetActions);
 function toggleSheet(on=sheet.hidden){sheet.hidden=!on;form.classList.toggle('nte-sheet-open',on);if(on){styles.hidden=true;if(aiMenu)aiMenu.hidden=true}}

 // the capsule
 const dock=el('div','nte-dock'),cap=el('div','nte-cap'),styleBtn=btn('nte-style','Estilo de texto','<span>Cuerpo</span>'+I.down);
 const styles=el('div','nte-styles');styles.hidden=true;styles.setAttribute('role','menu');
 styles.innerHTML=STYLES.map(([k,l,c])=>`<button type="button" role="menuitem" data-style="${k}" class="${c}">${l}</button>`).join('');
 styles.onmousedown=e=>e.preventDefault();
 styles.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>{applyStyle(b.dataset.style);styles.hidden=true});
 styleBtn.onclick=()=>{styles.hidden=!styles.hidden;if(aiMenu)aiMenu.hidden=true};
 function applyStyle(k){ed.focus();if(k==='ul')document.execCommand('insertUnorderedList');else if(k==='ol')document.execCommand('insertOrderedList');else if(k==='check')document.execCommand('insertHTML',false,'<div>☐ </div>');
  else if(k==='u')document.execCommand('underline');else if(k==='s')document.execCommand('strikeThrough');else document.execCommand('formatBlock',false,k==='p'?'div':k);changed();paintStyle()}
 function paintStyle(){const s=getSelection();let n=s.anchorNode;if(!n||!ed.contains(n))return;n=n.nodeType===3?n.parentElement:n;let name='Cuerpo';
  for(let e=n;e&&e!==ed;e=e.parentElement){const t=e.tagName;if(t==='H2'){name='Título';break}if(t==='H3'){name='Subtítulo';break}if(t==='BLOCKQUOTE'){name='Cita';break}if(t==='PRE'){name='Monoespaciado';break}if(t==='UL'){name='Viñetas';break}if(t==='OL'){name='Numerada';break}}
  styleBtn.querySelector('span').textContent=name;
  cap.querySelector('[data-fmt=bold]')?.classList.toggle('on',document.queryCommandState('bold'));cap.querySelector('[data-fmt=italic]')?.classList.toggle('on',document.queryCommandState('italic'))}
 document.addEventListener('selectionchange',paintStyle);
 const bold=btn('nte-tool','Negrita','<b>B</b>',()=>{ed.focus();document.execCommand('bold');changed();paintStyle()});bold.dataset.fmt='bold';
 const italic=btn('nte-tool','Cursiva','<i>I</i>',()=>{ed.focus();document.execCommand('italic');changed();paintStyle()});italic.dataset.fmt='italic';
 const photo=btn('nte-tool','Agregar foto',I.image,()=>{const b=oldBar?.querySelector('[aria-label=Foto]');if(b)b.click()});
 const pen=btn('nte-tool','Dibujar',I.pen,()=>sketch());
 const mic=btn('nte-tool','Dictar',I.mic,()=>dictate());
 cap.append(styleBtn,el('span','nte-sep'),bold,italic,el('span','nte-sep'),photo,pen,mic);
 const ai=aiTool||btn('','IA','');ai.className='nte-ai';ai.innerHTML=I.spark;ai.setAttribute('aria-label','Pedirle algo a la IA');
 const aiClick=ai.onclick;ai.onclick=e=>{styles.hidden=true;aiClick?.call(ai,e)};
 dock.append(styles);if(aiMenu){aiMenu.classList.add('nte-ai-menu');dock.append(aiMenu)}dock.append(cap,ai);
 if(oldBar)oldBar.hidden=true;if(actions)actions.hidden=true;
 form.prepend(top);top.after(page);form.append(sheet,dock);
 page.addEventListener('pointerdown',()=>{styles.hidden=true;if(aiMenu)aiMenu.hidden=true});

 // ---- dictation: record → the AI writes it where the cursor is (like Personal OS: "0:12 · · · · · 🗑 ✓") ----
 let rec=null,savedRange=null;
 function keepCaret(){const s=getSelection();savedRange=s.rangeCount&&ed.contains(s.getRangeAt(0).commonAncestorContainer)?s.getRangeAt(0).cloneRange():null}
 mic.onpointerdown=keepCaret;
 async function dictate(){if(rec)return;if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){notify('Este navegador no deja grabar audio.');return}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch{notify('Permití el micrófono para dictar.');return}
  const type=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported?.(t)),recorder=new MediaRecorder(stream,type?{mimeType:type,audioBitsPerSecond:48000}:undefined),chunks=[];
  const ctx=new (window.AudioContext||window.webkitAudioContext)(),an=ctx.createAnalyser();an.fftSize=256;ctx.createMediaStreamSource(stream).connect(an);const buf=new Uint8Array(an.frequencyBinCount);
  const bar=el('div','nte-rec',`<span class="nte-rec-time">0:00</span><span class="nte-rec-dots">${'<i></i>'.repeat(9)}</span>`);
  const cancel=btn('nte-round small','Descartar',I.trash,()=>finish(false)),ok=btn('nte-round small ok','Listo',I.check,()=>finish(true));bar.append(cancel,ok);
  cap.hidden=true;ai.hidden=true;dock.append(bar);const t0=Date.now();
  const levels=Array(9).fill(0),dots=[...bar.querySelectorAll('.nte-rec-dots i')];
  rec={stream,recorder,ctx,bar,timer:setInterval(()=>{const s=(Date.now()-t0)/1000;bar.querySelector('.nte-rec-time').textContent=fmt(s);if(s>=180)rec.finish(true);
   an.getByteFrequencyData(buf);levels.shift();levels.push(Math.min(1,buf.reduce((a,b)=>a+b,0)/buf.length/90));dots.forEach((d,i)=>d.style.transform=`scaleY(${1+levels[i]*5})`)},120)};
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start();
  async function finish(keep){if(!rec||rec.done)return;rec.done=true;clearInterval(rec.timer);const stopped=new Promise(r=>recorder.onstop=r);try{recorder.stop()}catch{}await stopped;stream.getTracks().forEach(t=>t.stop());ctx.close?.();
   if(!keep||!chunks.length){end();return}
   bar.innerHTML='<span class="nte-rec-time">Pasando a texto…</span>';
   try{const r=await host().aiAudio(new Blob(chunks,{type:recorder.mimeType||type||'audio/mp4'})),text=String(r?.text||'').trim();if(!text)throw Error('No se entendió el audio.');
    ed.focus();const s=getSelection();if(savedRange){s.removeAllRanges();s.addRange(savedRange)}else{const r2=document.createRange();r2.selectNodeContents(ed);r2.collapse(false);s.removeAllRanges();s.addRange(r2)}
    document.execCommand('insertText',false,text+' ');changed()}catch(e){notify(e.message||'No se pudo pasar a texto.')}
   end()}
  function end(){bar.remove();cap.hidden=false;ai.hidden=false;rec=null}
  rec.finish=finish}

 // ---- drawing: a sheet over the note; "Listo" puts the drawing in the text ----
 function sketch(){keepCaret();const pad=el('div','nte-sketch'),bar=el('div','nte-sketch-bar'),cv=el('canvas');pad.append(bar,cv);form.append(pad);
  const colors=['#1f2328','#e5484d','#3e63dd','#30a46c','#f5a524'];let color=colors[0],size=3,eraser=false;const strokes=[];let cur=null;
  bar.innerHTML=`<button type="button" class="nte-pill" data-k="cancel">Cancelar</button><span class="nte-sketch-tools">${colors.map(c=>`<button type="button" class="nte-dot" data-c="${c}" style="--c:${c}" aria-label="Color"></button>`).join('')}<button type="button" class="nte-tool" data-k="size" aria-label="Grosor">●</button><button type="button" class="nte-tool" data-k="erase" aria-label="Borrador">⌫</button><button type="button" class="nte-tool" data-k="undo" aria-label="Deshacer">${I.undo}</button></span><button type="button" class="nte-pill primary" data-k="done">Listo</button>`;
  const dpr=Math.min(3,devicePixelRatio||1),ctx=cv.getContext('2d');
  function fit(){const r=cv.getBoundingClientRect();cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);paint()}
  function paint(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.lineCap=ctx.lineJoin='round';
   for(const s of strokes){ctx.globalCompositeOperation=s.erase?'destination-out':'source-over';ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.beginPath();s.pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(s.pts.length===1)ctx.lineTo(s.pts[0][0]+.1,s.pts[0][1]);ctx.stroke()}ctx.globalCompositeOperation='source-over'}
  const pt=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
  cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);cur={color,size:eraser?size*5:size*(e.pointerType==='pen'?Math.max(.4,e.pressure*1.6):1),erase:eraser,pts:[pt(e)]};strokes.push(cur);paint()};
  cv.onpointermove=e=>{if(!cur)return;for(const ev of e.getCoalescedEvents?.()||[e])cur.pts.push(pt(ev));paint()};
  cv.onpointerup=cv.onpointercancel=()=>{cur=null};
  const paintBar=()=>{bar.querySelectorAll('[data-c]').forEach(b=>b.classList.toggle('on',!eraser&&b.dataset.c===color));bar.querySelector('[data-k=erase]').classList.toggle('on',eraser);bar.querySelector('[data-k=size]').style.fontSize=(6+size*2)+'px'};
  bar.onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.c){color=b.dataset.c;eraser=false}else if(b.dataset.k==='size')size=size>=6?2:size+2;else if(b.dataset.k==='erase')eraser=!eraser;else if(b.dataset.k==='undo'){strokes.pop();paint()}
   else if(b.dataset.k==='cancel'){pad.remove();return}else if(b.dataset.k==='done'){if(!strokes.length){pad.remove();return}
    const xs=strokes.flatMap(s=>s.pts.map(p=>p[0])),ys=strokes.flatMap(s=>s.pts.map(p=>p[1])),m=12,x0=Math.max(0,Math.min(...xs)-m),y0=Math.max(0,Math.min(...ys)-m),x1=Math.min(cv.width/dpr,Math.max(...xs)+m),y1=Math.min(cv.height/dpr,Math.max(...ys)+m);
    const out=el('canvas'),k=2;out.width=Math.round((x1-x0)*k);out.height=Math.round((y1-y0)*k);const o=out.getContext('2d');o.fillStyle='#fff';o.fillRect(0,0,out.width,out.height);o.drawImage(cv,x0*dpr,y0*dpr,(x1-x0)*dpr,(y1-y0)*dpr,0,0,out.width,out.height);
    try{const blob=await new Promise(ok=>out.toBlob(ok,'image/png')),key=await host().putMedia(blob);pad.remove();ed.focus();const s=getSelection();if(savedRange){s.removeAllRanges();s.addRange(savedRange)}
     document.execCommand('insertHTML',false,`<p><img data-scan="${key}" alt="Dibujo"></p><p><br></p>`);changed()}catch{notify('No se pudo guardar el dibujo.')}return}paintBar()};
  requestAnimationFrame(fit);paintBar()}

 const onClose=()=>{modal.removeEventListener('close',onClose);modal.classList.remove('nt-full');document.removeEventListener('selectionchange',paintStyle);if(rec)rec.finish(false)};
 modal.addEventListener('close',onClose);
 if(!id)setTimeout(()=>title.focus({preventScroll:true}),250);
};
})();
