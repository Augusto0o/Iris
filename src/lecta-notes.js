// lecta · notes like Personal OS (a searchable list with notebooks, excerpts and thumbnails; an editor with more
// formats, check boxes, photos, word count and autosave) and Enlaces: links you save with tags.
(()=>{
'use strict';
if(typeof noteForm!=='function'||typeof R!=='function')return;
const host=()=>parent.EcosystemHost;
const norm=t=>String(t??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const plain=html=>String(html||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const tagsOf=t=>String(t||'').split(',').map(x=>x.trim()).filter(Boolean);
const MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function when(iso){const d=new Date(iso||'');if(isNaN(d))return '';const now=new Date(),days=Math.floor((new Date(now.toDateString())-new Date(d.toDateString()))/864e5);
 if(days<=0)return 'Hoy';if(days===1)return 'Ayer';if(days<7)return 'Hace '+days+' días';return d.getDate()+' '+MONTHS[d.getMonth()]+(d.getFullYear()!==now.getFullYear()?' '+d.getFullYear():'')}
if(typeof ICONS==='object'){ICONS.link||='<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>';ICONS.star||='<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'}

// ---- Notes list ------------------------------------------------------------------------------------------------
const view={q:'',book:'all',sort:'recent'};
function noteRows(){let rows=R('notes').filter(n=>!n.deletedAt&&!n.archived);
 if(view.book==='favorites')rows=rows.filter(n=>n.favorite);else if(view.book==='ideas')rows=rows.filter(n=>n.notebook==='Ideas'||tagsOf(n.tags).map(norm).includes('idea'));else if(view.book!=='all')rows=rows.filter(n=>(n.notebook||'Personal')===view.book);
 const q=norm(view.q).trim();if(q)rows=rows.filter(n=>q.split(/\s+/).every(w=>norm(n.title+' '+plain(n.body)+' '+n.tags+' '+n.notebook).includes(w)));
 const at=n=>n.updatedAt||n.createdAt||n.date||'';
 return rows.sort(view.sort==='az'?(a,b)=>String(a.title).localeCompare(String(b.title),'es'):view.sort==='old'?(a,b)=>String(at(a)).localeCompare(String(at(b))):(a,b)=>(b.favorite-a.favorite)||String(at(b)).localeCompare(String(at(a))))}
function noteCardPlus(n){const text=plain(n.body),scan=/data-scan="([^"]+)"/.exec(n.body||'')?.[1],tags=tagsOf(n.tags).filter(t=>norm(t)!=='idea').slice(0,3),idea=n.notebook==='Ideas'||tagsOf(n.tags).map(norm).includes('idea');
 const checks=(text.match(/☐/g)||[]).length,done=(text.match(/☑/g)||[]).length;
 return `<article class="nt-card${idea?' idea':''}" onclick="noteForm('${n.id}')"><div class="nt-copy"><div class="nt-meta"><span>${esc(idea?'Idea':n.notebook||'Personal')}</span><span>${esc(when(n.updatedAt||n.date))}</span>${checks+done?`<span>☑ ${done}/${checks+done}</span>`:''}</div>
  <h3>${esc(n.title||'Sin título')}</h3>${text&&text!==n.title?`<p>${esc(text.slice(0,180))}</p>`:''}${tags.length?`<div class="nt-tags">${tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}</div>
  ${scan?`<img class="nt-thumb" data-scan="${scan}" alt="">`:''}<button type="button" class="nt-star${n.favorite?' on':''}" aria-label="${n.favorite?'Quitar de favoritas':'Marcar como favorita'}" onclick="event.stopPropagation();toggleFavorite('${n.id}')">${icon('star')}</button></article>`}
function notesList(){const rows=noteRows();return rows.length?rows.map(noteCardPlus).join(''):`<div class="empty"><span class="tile">${icon('note')}</span><h3>${view.q?'No encontramos notas':'Todavía no hay notas acá'}</h3><p>${view.q?'Probá con otra palabra.':'Escribí la primera: una idea, un apunte o un diario.'}</p><button onclick="noteForm()">${icon('plus')}Nueva nota</button></div>`}
function notesPage(){const all=R('notes').filter(n=>!n.deletedAt&&!n.archived),books=[...new Set(all.map(n=>n.notebook||'Personal'))].filter(b=>b!=='Ideas').sort((a,b)=>a.localeCompare(b,'es'));
 const count=k=>k==='all'?all.length:k==='favorites'?all.filter(n=>n.favorite).length:k==='ideas'?all.filter(n=>n.notebook==='Ideas'||tagsOf(n.tags).map(norm).includes('idea')).length:all.filter(n=>(n.notebook||'Personal')===k).length;
 const chips=[['all','Todas'],['favorites','Favoritas'],['ideas','Ideas'],...books.map(b=>[b,b])].filter(([k])=>k==='all'||count(k));
 return head('Notas','Todo lo que escribís, en un solo lugar.','noteForm()','Nueva nota')+`<div class="nt-bar"><label class="nt-search"><span>${icon('search')}</span><input id="ntQuery" type="search" placeholder="Buscar en tus notas" value="${esc(view.q)}" autocomplete="off"></label>
  <select id="ntSort" aria-label="Ordenar"><option value="recent">Recientes</option><option value="old">Más antiguas</option><option value="az">A–Z</option></select></div>
  <div class="nt-chips" role="tablist">${chips.map(([k,l])=>`<button type="button" role="tab" aria-selected="${view.book===k}" onclick="lectaNotebook(${esc(JSON.stringify(k))})">${esc(l)} <span>${count(k)}</span></button>`).join('')}</div>
  <div class="nt-list" id="ntList">${notesList()}</div>`}
window.lectaNotebook=k=>{view.book=k;render()};
document.addEventListener('input',e=>{if(e.target?.id==='ntQuery'){view.q=e.target.value;const list=document.getElementById('ntList');if(list)list.innerHTML=notesList()}});
document.addEventListener('change',e=>{if(e.target?.id==='ntSort'){view.sort=e.target.value;const list=document.getElementById('ntList');if(list)list.innerHTML=notesList()}});

// ---- Editor: more formats, check boxes, photos, word count and autosave ---------------------------------------
const MORE=[['underline','Subrayado','<u>U</u>'],['strikeThrough','Tachado','<s>S</s>'],['insertOrderedList','Lista numerada','1.'],['check','Casilla','☐'],['photo','Foto','📷']];
function insertHTML(html){document.execCommand('insertHTML',false,html)}
const noteFormBefore=noteForm;
noteForm=function(id){
 noteFormBefore(id);const form=document.getElementById('noteForm'),bar=form?.querySelector('.editor-toolbar'),ed=document.getElementById('noteEditor');if(!bar||!ed)return;
 let current=id||null,timer=0,dirty=false;const n=current?record('notes',current):null;
 for(const [cmd,label,txt] of MORE){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.innerHTML=txt;b.onmousedown=e=>e.preventDefault();
  b.onclick=()=>{ed.focus();if(cmd==='check'){insertHTML('<div>☐ </div>');changed()}else if(cmd==='photo')pick.click();else{document.execCommand(cmd,false,null);changed()}};bar.append(b)}
 // photos go to the media store; the note keeps a reference (like scanned pages)
 const pick=document.createElement('input');pick.type='file';pick.accept='image/*';pick.hidden=true;form.append(pick);
 pick.onchange=async()=>{const file=pick.files?.[0];pick.value='';if(!file)return;try{const img=await createImageBitmap(file,{imageOrientation:'from-image'});const k=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',.82)),key=await host().putMedia(blob);ed.focus();insertHTML(`<p><img data-scan="${key}" alt="Foto"></p><p><br></p>`);changed()}catch{notify('No se pudo agregar la foto.')}};
 // tap a box to tick it
 ed.addEventListener('click',e=>{const pos=document.caretRangeFromPoint?.(e.clientX,e.clientY);const node=pos?.startContainer;if(!node||node.nodeType!==3)return;const t=node.textContent;
  for(const i of [pos.startOffset,pos.startOffset-1]){if(t[i]==='☐'||t[i]==='☑'){node.textContent=t.slice(0,i)+(t[i]==='☐'?'☑':'☐')+t.slice(i+1);changed();return}}});
 ed.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const sel=getSelection(),line=sel.anchorNode?.textContent||'';if(/^\s*[☐☑]/.test(line)&&line.replace(/[☐☑\s]/g,'')){setTimeout(()=>{insertHTML('☐ ')},0)}});
 const foot=document.createElement('div');foot.className='nt-foot';ed.after(foot);
 const count=()=>{const words=(ed.innerText.match(/\S+/g)||[]).length;foot.innerHTML=`<span>${words} ${words===1?'palabra':'palabras'}</span><span id="ntSaved">${current?'Guardado automático':'Se guarda solo'}</span>`};
 const gather=()=>{const d=new FormData(form),related=document.getElementById('clearRelations')?.dataset.clear==='yes'?[]:[...((current&&record('notes',current)?.related)||n?.related||[])];
  if(d.get('related')&&!related.includes(d.get('related')))related.push(d.get('related'));
  let title=String(d.get('title')||'').trim();if(!title){const first=ed.innerText.trim().split('\n')[0];title=first.slice(0,120)}
  return {title,body:cleanRich(ed.innerHTML),notebook:String(d.get('notebook')||'').trim(),date:d.get('date'),tags:String(d.get('tags')||'').trim(),favorite:d.get('favorite')==='on',related}};
 function changed(){dirty=true;count();clearTimeout(timer);timer=setTimeout(autosave,1500)}
 function autosave(){if(!document.getElementById('noteForm'))return;const v=gather();if(!v.title)return;try{const saved=storeRecord('notes',v,current||undefined);current=current||saved?.id||null;persist();dirty=false;const s=document.getElementById('ntSaved');if(s)s.textContent='Guardado ✓'}catch(err){const s=document.getElementById('ntSaved');if(s)s.textContent=err.message}}
 ed.addEventListener('input',changed);form.addEventListener('input',e=>{if(e.target!==ed)changed()});form.addEventListener('change',changed);
 // the Guardar button saves the same note autosave created (never a second copy)
 form.onsubmit=e=>{e.preventDefault();clearTimeout(timer);try{const v=gather();if(!v.title)throw Error('Ingresá un título de hasta 240 caracteres.');storeRecord('notes',v,current||undefined);closeModal();save('Nota guardada')}catch(err){notify(err.message)}};
 const modal=document.getElementById('modal'),onClose=()=>{modal.removeEventListener('close',onClose);clearTimeout(timer);if(dirty)autosave();render()};modal.addEventListener('close',onClose);
 count();
};

// ---- Enlaces ---------------------------------------------------------------------------------------------------
S.records.links||=[];if(Array.isArray(APP?.collections)&&!APP.collections.includes('links'))APP.collections.push('links');
if(Array.isArray(APP?.nav)&&!APP.nav.some(n=>n[0]==='links'))APP.nav.push(['links','Enlaces','link']); // in Más: the bottom bar keeps Inicio, Notas and Biblioteca
schemas.links={singular:'enlace',plural:'Enlaces',icon:'link',fields:[['url','Enlace','url',{required:true}],['title','Título'],['tags','Etiquetas'],['note','Nota','textarea']],
 validate:v=>{let u;try{u=new URL(v.url)}catch{throw Error('Pegá un enlace válido (https://…).')}if(!['http:','https:'].includes(u.protocol))throw Error('El enlace tiene que empezar con http o https.');if(String(v.title||'').length>240||String(v.tags||'').length>300||String(v.note||'').length>4000)throw Error('Revisá el título, las etiquetas y la nota.')}};
const linkView={q:'',tag:''};
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return ''}};
const titleFrom=u=>{try{const x=new URL(u),last=decodeURIComponent(x.pathname.split('/').filter(Boolean).pop()||'').replace(/[-_]+/g,' ').replace(/\.\w+$/,'').trim();return last&&!/^\d+$/.test(last)?last[0].toUpperCase()+last.slice(1):hostOf(u)}catch{return u}};
function linkRows(){let rows=R('links').filter(l=>!l.deletedAt);if(linkView.tag)rows=rows.filter(l=>tagsOf(l.tags).map(norm).includes(norm(linkView.tag)));
 const q=norm(linkView.q).trim();if(q)rows=rows.filter(l=>q.split(/\s+/).every(w=>norm([l.title,l.url,l.tags,l.note].join(' ')).includes(w)));
 return rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
function linksList(){const rows=linkRows();return rows.length?rows.map(l=>{const h=hostOf(l.url);return `<article class="lnk-card"><a class="lnk-main" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="lnk-tile">${esc((h[0]||'?').toUpperCase())}</span><span class="lnk-copy"><strong>${esc(l.title||titleFrom(l.url))}</strong><small>${esc(h)}${l.createdAt?' · '+esc(when(l.createdAt)):''}</small>${l.note?`<em>${esc(String(l.note).slice(0,140))}</em>`:''}</span></a>
  <div class="lnk-foot"><div class="nt-tags">${tagsOf(l.tags).map(t=>`<button type="button" onclick="lectaLinkTag(${esc(JSON.stringify(t))})">#${esc(t)}</button>`).join('')}</div><button type="button" class="iconbtn ghost" aria-label="Editar enlace" onclick="lectaLink('${l.id}')">${icon('edit')}</button><button type="button" class="iconbtn ghost danger" aria-label="Eliminar enlace" onclick="removeRecord('links','${l.id}')">${icon('trash')}</button></div></article>`}).join('')
 :`<div class="empty"><span class="tile">${icon('link')}</span><h3>${linkView.q||linkView.tag?'No hay enlaces con eso':'Guardá tu primer enlace'}</h3><p>Artículos, videos, recetas, lugares… con etiquetas para encontrarlos después.</p><button onclick="lectaLink()">${icon('plus')}Guardar enlace</button></div>`}
function linksPage(){const tags=[...new Map(R('links').filter(l=>!l.deletedAt).flatMap(l=>tagsOf(l.tags)).map(t=>[norm(t),t])).values()].sort((a,b)=>a.localeCompare(b,'es'));
 return head('Enlaces','Guardá lo que querés leer, ver o volver a encontrar, con etiquetas.','lectaLink()','Guardar enlace')+`<div class="nt-bar"><label class="nt-search"><span>${icon('search')}</span><input id="lnkQuery" type="search" placeholder="Buscar en tus enlaces" value="${esc(linkView.q)}" autocomplete="off"></label></div>
  ${tags.length?`<div class="nt-chips"><button type="button" aria-selected="${!linkView.tag}" onclick="lectaLinkTag('')">Todos</button>${tags.map(t=>`<button type="button" aria-selected="${norm(linkView.tag)===norm(t)}" onclick="lectaLinkTag(${esc(JSON.stringify(t))})">#${esc(t)}</button>`).join('')}</div>`:''}
  <div class="lnk-list" id="lnkList">${linksList()}</div>`}
window.lectaLinkTag=t=>{linkView.tag=linkView.tag&&norm(linkView.tag)===norm(t)?'':t;render()};
document.addEventListener('input',e=>{if(e.target?.id==='lnkQuery'){linkView.q=e.target.value;const list=document.getElementById('lnkList');if(list)list.innerHTML=linksList()}});
window.lectaLink=(id,prefill='')=>{const l=id?record('links',id):null,all=[...new Set(R('links').flatMap(x=>tagsOf(x.tags)))].sort((a,b)=>a.localeCompare(b,'es')).slice(0,24);
 openModal(l?'Editar enlace':'Guardar enlace',`<form class="form" id="linkForm"><label>Enlace<span class="lnk-url"><input name="url" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" required placeholder="https://…" value="${esc(l?.url||prefill)}"><button type="button" id="lnkPaste">Pegar</button></span></label>
  <label>Título<input name="title" maxlength="240" value="${esc(l?.title||'')}" placeholder="Se completa con el enlace si lo dejás vacío"></label>
  <label>Etiquetas, separadas por comas<input name="tags" maxlength="300" value="${esc(l?.tags||'')}" placeholder="leer, receta, viaje"></label>
  ${all.length?`<div class="nt-tags lnk-suggest">${all.map(t=>`<button type="button" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>`:''}
  <label>Nota<textarea name="note" rows="3" maxlength="4000" placeholder="Por qué lo guardás">${esc(l?.note||'')}</textarea></label>
  <div class="form-actions"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Guardar</button></div></form>`);
 const f=document.getElementById('linkForm');
 f.querySelector('#lnkPaste').onclick=async()=>{try{const t=(await navigator.clipboard.readText()).trim();if(t)f.url.value=t}catch{notify('Tocá el campo y pegá desde el menú.')}};
 f.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{const list=tagsOf(f.tags.value);if(!list.map(norm).includes(norm(b.dataset.tag)))list.push(b.dataset.tag);f.tags.value=list.join(', ')});
 f.onsubmit=e=>{e.preventDefault();try{const d=new FormData(f);let url=String(d.get('url')).trim();if(url&&!/^https?:\/\//i.test(url))url='https://'+url;
  storeRecord('links',{url,title:String(d.get('title')||'').trim()||titleFrom(url),tags:tagsOf(d.get('tags')).join(', '),note:String(d.get('note')||'').trim()},id);closeModal();save('Enlace guardado')}catch(err){notify(err.message)}}};

// ---- Documentos: papers scanned as they are (DNI, warranties, prescriptions…), every page kept as an image ------
if(typeof ICONS==='object')ICONS.file||='<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>';
S.records.documents||=[];if(Array.isArray(APP?.collections)&&!APP.collections.includes('documents'))APP.collections.push('documents');
if(Array.isArray(APP?.nav)&&!APP.nav.some(n=>n[0]==='documents'))APP.nav.push(['documents','Documentos','file']);
schemas.documents={singular:'documento',plural:'Documentos',icon:'file',fields:[['title','Nombre','text',{required:true}],['tags','Etiquetas']],
 validate:v=>{if(!String(v.title||'').trim()||String(v.title).length>160)throw Error('Poné un nombre de hasta 160 caracteres.');if(!Array.isArray(v.pages)||!v.pages.length||v.pages.length>60||v.pages.some(k=>typeof k!=='string'||!/^[\w-]{1,80}$/.test(k)))throw Error('El documento no tiene páginas válidas.');if(String(v.text||'').length>60000||String(v.tags||'').length>200)throw Error('Revisá las etiquetas.')}};
const docView={q:''};
function docRows(){let rows=R('documents').filter(d=>!d.deletedAt);const q=norm(docView.q).trim();if(q)rows=rows.filter(d=>q.split(/\s+/).every(w=>norm([d.title,d.tags,d.text].join(' ')).includes(w)));return rows.sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')))}
function docsList(){const rows=docRows();return rows.length?`<div class="doc-grid">${rows.map(d=>`<button type="button" class="doc-card" onclick="lectaDocument('${d.id}')"><span class="doc-thumb"><img data-scan="${esc(d.pages[0])}" alt=""><b>${d.pages.length}</b></span><strong>${esc(d.title)}</strong><small>${esc(when(d.createdAt||d.date))}${d.tags?' · '+esc(tagsOf(d.tags).slice(0,2).map(t=>'#'+t).join(' ')):''}</small></button>`).join('')}</div>`
 :`<div class="empty"><span class="tile">${icon('file')}</span><h3>${docView.q?'No hay documentos con eso':'Guardá tu primer documento'}</h3><p>DNI, garantías, recetas, papeles del auto… escaneados como en Notas del iPhone, con todas sus páginas.</p><button onclick="lectaScanDocument()">${icon('plus')}Escanear documento</button></div>`}
function docsPage(){return head('Documentos','Papeles escaneados tal cual, para tenerlos siempre a mano.','lectaScanDocument()','Escanear')+`<div class="nt-bar"><label class="nt-search"><span>${icon('search')}</span><input id="docQuery" type="search" placeholder="Buscar por nombre, etiqueta o texto" value="${esc(docView.q)}" autocomplete="off"></label></div><div id="docList">${docsList()}</div>`}
document.addEventListener('input',e=>{if(e.target?.id==='docQuery'){docView.q=e.target.value;const l=document.getElementById('docList');if(l)l.innerHTML=docsList()}});
window.lectaScanDocument=()=>host().openScanner({types:['document']});
window.lectaDocument=id=>{const d=record('documents',id);if(!d)return;
 openModal(d.title,`<div class="doc-view"><p class="small">${d.pages.length} ${d.pages.length===1?'página':'páginas'} · ${esc(when(d.createdAt||d.date))}${d.tags?' · '+esc(tagsOf(d.tags).map(t=>'#'+t).join(' ')):''}</p>
  <div class="doc-pages">${d.pages.map((k,i)=>`<figure><img data-scan="${esc(k)}" alt="Página ${i+1}"><figcaption>${i+1}</figcaption></figure>`).join('')}</div>
  ${d.text?`<details class="doc-text"><summary>Texto leído</summary><p>${esc(d.text).replace(/\n/g,'<br>')}</p></details>`:''}
  <form class="form" id="docForm"><label>Nombre<input name="title" maxlength="160" required value="${esc(d.title)}"></label><label>Etiquetas<input name="tags" maxlength="200" value="${esc(d.tags||'')}"></label></form>
  <div class="actions doc-actions"><button type="button" class="primary" id="docShare">Compartir</button><button type="button" id="docSave">Guardar cambios</button><button type="button" class="danger" id="docDelete">Eliminar</button></div></div>`,true);
 const f=document.getElementById('docForm');
 document.getElementById('docSave').onclick=()=>{try{storeRecord('documents',{...d,title:f.title.value.trim(),tags:tagsOf(f.tags.value).join(', ')},id);closeModal();save('Documento guardado')}catch(err){notify(err.message)}};
 document.getElementById('docDelete').onclick=()=>{closeModal();removeRecord('documents',id)};
 document.getElementById('docShare').onclick=async()=>{try{const files=[];for(const [i,k] of d.pages.entries()){const b=await host().getMedia(k);if(b)files.push(new File([b],`${d.title.replace(/[^\w áéíóúñ-]+/gi,'').trim()||'documento'}-${i+1}.jpg`,{type:b.type||'image/jpeg'}))}
  if(!files.length)throw Error('No se encontraron las páginas en este teléfono.');if(navigator.canShare?.({files}))await navigator.share({files,title:d.title});else{const a=document.createElement('a');a.href=URL.createObjectURL(files[0]);a.download=files[0].name;a.click()}}catch(err){if(err?.name!=='AbortError')notify(err.message||'No se pudo compartir.')}}};

if(typeof openRecord==='function'){const openBefore=openRecord;openRecord=function(type,id){if(type==='documents'){window.lectaDocument(id);return}return openBefore(type,id)}}
const markupBefore=appMarkup;
appMarkup=function(v){if(v==='notes')return notesPage();if(v==='links')return linksPage();if(v==='documents')return docsPage();return markupBefore(v)};
// a link handed to nubo as …#/journal/links?guardar=https://… opens ready to save
try{const m=/[?&]guardar=([^&]+)/.exec(parent.location.hash||'');if(m)setTimeout(()=>{go('links');window.lectaLink(null,decodeURIComponent(m[1]))},400)}catch{}
try{render()}catch{}
})();
