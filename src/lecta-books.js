// lecta · Libros: "Leyendo ahora" with your progress always in sight (update it in two taps), and "Leer gratis":
// public-domain books (Project Gutenberg, through /api/book) that you read inside the app, offline once opened,
// with your place saved. They can also go to Apple Books as EPUB.
(()=>{
'use strict';
if(typeof mediaPage!=='function'||typeof mediaItems!=='function')return;
const host=()=>parent.EcosystemHost;
const BOOK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5.5C4.5 4 8 4 12 6.5 16 4 19.5 4 22 5.5V19c-2.5-1.5-6-1.5-10 1-4-2.5-7.5-2.5-10-1z"/><path d="M12 6.5V20"/></svg>';
const pct=r=>r.pages?Math.min(100,Math.round((+r.currentPage||0)/r.pages*100)):Math.min(100,Math.max(0,+r.progress||0));
let free={q:'',lang:'es',busy:false,items:null,error:''};

// ---- progress ------------------------------------------------------------------------------------------------
window.lectaProgress=id=>{const r=record('library',id);if(!r)return;const pages=+r.pages||0;
 openModal('Tu avance',`<form class="form rd-progress" id="progressForm"><div class="rd-book">${r.cover?`<img src="${esc(r.cover)}" alt="">`:`<span class="tile">${icon('book')}</span>`}<div><strong>${esc(r.name)}</strong><small>${esc(r.author||'')}</small></div></div>
  ${pages?`<label>Página actual de ${pages}<input name="page" type="number" inputmode="numeric" min="0" max="${pages}" value="${+r.currentPage||0}"></label><input name="slider" type="range" min="0" max="${pages}" value="${+r.currentPage||0}" aria-label="Página">
   <div class="rd-quick">${[5,10,25,50].map(n=>`<button type="button" data-add="${n}">+${n}</button>`).join('')}</div>`
  :`<label>Avance<input name="slider" type="range" min="0" max="100" value="${pct(r)}" aria-label="Porcentaje leído"></label><p class="rd-pct"><b>${pct(r)}</b>%</p><label>¿Cuántas páginas tiene? (opcional)<input name="pages" type="number" inputmode="numeric" min="0" max="100000" placeholder="Para contar por página"></label>`}
  <div class="form-actions"><button type="button" data-done>Lo terminé</button><button class="primary">Guardar</button></div></form>`);
 const f=document.getElementById('progressForm'),sync=v=>{if(pages){f.page.value=v;f.slider.value=v}else{f.slider.value=v;f.querySelector('.rd-pct b').textContent=v}};
 f.slider.oninput=()=>sync(f.slider.value);if(pages)f.page.oninput=()=>{f.slider.value=f.page.value};
 f.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>sync(Math.min(pages,(+f.page.value||0)+(+b.dataset.add))));
 const store=(patch)=>{storeRecord('library',{...r,...patch,updatedAt:new Date().toISOString()},id);closeModal();save('Avance guardado')};
 f.querySelector('[data-done]').onclick=()=>store({status:'Terminado',progress:100,currentPage:pages||r.currentPage||0,finishedOn:today()});
 f.onsubmit=e=>{e.preventDefault();if(pages){const p=Math.max(0,Math.min(pages,+f.page.value||0));store({currentPage:p,progress:Math.round(p/pages*100),status:p>=pages?'Terminado':p>0?'En curso':r.status})}
  else{const v=+f.slider.value||0,extra=+f.pages?.value||0;store({progress:v,status:v>=100?'Terminado':v>0?'En curso':r.status,...(extra?{pages:extra,currentPage:Math.round(extra*v/100)}:{})})}}};
const reading=()=>mediaItems('books').filter(r=>r.status==='En curso').sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
const readingMarkup=()=>{const l=reading();if(!l.length)return '';return `<section class="rd-now"><h2>Leyendo ahora</h2><div class="rd-strip">${l.map(r=>`<article class="rd-card"><button type="button" class="rd-cover" onclick="${r.gutenbergId?`lectaRead(${r.gutenbergId},'${r.id}')`:`lectaProgress('${r.id}')`}">${r.cover?`<img src="${esc(r.cover)}" alt="" loading="lazy">`:`<span>${esc(r.name)}</span>`}</button>
  <div class="rd-copy"><strong>${esc(r.name)}</strong><small>${r.pages?`Página ${+r.currentPage||0} de ${r.pages}`:esc(r.author||'')}</small><div class="progress"><span style="width:${pct(r)}%"></span></div><div class="rd-actions"><button type="button" onclick="lectaProgress('${r.id}')">${pct(r)}% · Actualizar</button>${r.gutenbergId?`<button type="button" class="primary" onclick="lectaRead(${r.gutenbergId},'${r.id}')">Seguir leyendo</button>`:''}</div></div></article>`).join('')}</div></section>`};

// ---- free books -----------------------------------------------------------------------------------------------
const freeMarkup=()=>`<section class="card rd-free"><div class="sectionhead"><h2>${BOOK}Leer gratis</h2></div><p class="small">Clásicos de dominio público (Project Gutenberg): se leen acá, sin conexión una vez abiertos, o en Apple Books.</p>
 <form class="rd-search" onsubmit="event.preventDefault();lectaFreeSearch()"><input id="rdQuery" value="${esc(free.q)}" placeholder="Cervantes, Quiroga, Austen…" autocomplete="off" enterkeyhint="search"><button class="primary" ${free.busy?'disabled':''}>${free.busy?'Buscando…':'Buscar'}</button></form>
 <div class="rd-langs">${[['es','Español'],['en','Inglés'],['all','Todos']].map(([k,l])=>`<button type="button" class="${free.lang===k?'active':''}" onclick="lectaFreeLang('${k}')">${l}</button>`).join('')}</div>
 ${free.error?`<p class="ai-error small">${esc(free.error)}</p>`:''}
 ${free.items?free.items.length?`<div class="rd-results">${free.items.map((b,i)=>`<article class="rd-result"><button type="button" class="rd-cover" onclick="lectaRead(${b.id})"><img src="${esc(b.cover)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:${esc(JSON.stringify(b.title.slice(0,40)))}}))"></button><strong>${esc(b.title)}</strong><small>${esc(b.author)}</small><div class="rd-actions"><button type="button" class="primary" onclick="lectaRead(${b.id})">Leer</button><button type="button" onclick="lectaFreeSave(${i})">Guardar</button></div></article>`).join('')}</div>`:'<p class="small">No encontré libros gratis con eso. Probá con el autor o el título original.</p>':''}</section>`;
window.lectaFreeLang=k=>{free.lang=k;if(free.q)lectaFreeSearch();else render()};
window.lectaFreeSearch=async()=>{const q=document.getElementById('rdQuery')?.value.trim()||'';if(q.length<2)return;free={...free,q,busy:true,error:''};render();
 try{const r=await catalogJSON('/api/book?'+new URLSearchParams({q,lang:free.lang}));free={...free,busy:false,items:r.books||[]}}catch(e){free={...free,busy:false,items:null,error:'La biblioteca gratuita no respondió. Probá en un rato.'}}render()};
function saveFree(b,extra={}){const old=mediaItems('books').find(r=>r.gutenbergId===b.id);if(old)return old;
 return storeRecord('library',{name:b.title,kind:'Libro',author:b.author||'',cover:b.cover||'',url:'https://www.gutenberg.org/ebooks/'+b.id,gutenbergId:b.id,status:'Por empezar',progress:0,notes:'',rating:0,year:'',genre:'',favorite:false,...extra})}
window.lectaFreeSave=i=>{const b=free.items?.[i];if(!b)return;saveFree(b);save('Guardado en tus libros')};

// ---- the reader ------------------------------------------------------------------------------------------------
const CHUNK=120;
async function textOf(id,rec){if(rec?.bookText){try{const blob=await host().getMedia(rec.bookText);if(blob)return {text:await blob.text()}}catch{}}
 const data=await catalogJSON('/api/book?id='+id);let key='';try{key=await host().putMedia(new Blob([data.text],{type:'text/plain'}))}catch{}return {...data,key}}
window.lectaRead=async(id,recordId)=>{let rec=recordId?record('library',recordId):mediaItems('books').find(r=>r.gutenbergId===id);
 openModal('Leyendo','<p class="ai-status">Abriendo el libro…</p>',true);const modal=document.getElementById('modal');modal.classList.add('rd-full');
 let data;try{data=await textOf(id,rec)}catch(e){document.getElementById('modalBody').innerHTML=`<p class="ai-error">No se pudo abrir el libro. ${esc(e.message||'')}</p>`;return}
 if(!rec){const b=free.items?.find(x=>x.id===id)||{id,title:data.title||'Libro',author:data.author||'',cover:`https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`};rec=saveFree(b,{status:'En curso'});persist()}
 if(data.key&&!rec.bookText){rec.bookText=data.key;persist()}
 const paras=data.text.split(/\n\s*\n/).map(p=>p.replace(/\s*\n\s*/g,' ').trim()).filter(Boolean),total=paras.length;
 let shown=0,size=+(S.prefs.readerSize||18);const start=Math.min(total-1,Math.max(0,+rec.readPos||0));
 document.getElementById('modalBody').innerHTML=`<div class="rd-reader"><div class="rd-bar"><button type="button" class="rd-round" aria-label="Volver" onclick="closeModal()">‹</button><div class="rd-title"><strong>${esc(rec.name)}</strong><small id="rdPct">${pct(rec)}%</small></div><button type="button" class="rd-round" aria-label="Letra más chica" data-size="-1">A−</button><button type="button" class="rd-round" aria-label="Letra más grande" data-size="1">A+</button></div>
  <div class="rd-text" id="rdText" style="font-size:${size}px"></div><div class="rd-more" id="rdMore"></div>
  <p class="rd-foot small">Libro de dominio público de <a href="https://www.gutenberg.org/ebooks/${id}" target="_blank" rel="noopener">Project Gutenberg</a> · <a href="https://www.gutenberg.org/ebooks/${id}.epub3.images" target="_blank" rel="noopener">Abrir en Apple Books (EPUB)</a></p></div>`;
 const box=document.getElementById('rdText'),scroller=document.getElementById('modalBody');
 const more=n=>{const end=Math.min(total,shown+n),frag=document.createDocumentFragment();for(let i=shown;i<end;i++){const p=document.createElement('p');p.dataset.i=i;p.textContent=paras[i];frag.append(p)}box.append(frag);shown=end;if(shown>=total)document.getElementById('rdMore')?.remove()};
 more(Math.max(CHUNK,start+CHUNK));requestAnimationFrame(()=>{const el=box.querySelector(`[data-i="${start}"]`);if(el)scroller.scrollTop=el.offsetTop-80});
 const io=new IntersectionObserver(([e])=>{if(e.isIntersecting)more(CHUNK)},{root:scroller,rootMargin:'1200px'});const sentinel=document.getElementById('rdMore');if(sentinel)io.observe(sentinel);
 let timer=0;scroller.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>{const top=scroller.scrollTop+90;let cur=0;for(const p of box.children){if(p.offsetTop>top)break;cur=+p.dataset.i}
  const progress=Math.max(1,Math.round(cur/Math.max(1,total-1)*100));const label=document.getElementById('rdPct');if(label)label.textContent=progress+'%';
  if(cur!==rec.readPos){rec.readPos=cur;rec.progress=progress;if(rec.status==='Por empezar')rec.status='En curso';if(progress>=100)rec.status='Terminado';rec.updatedAt=new Date().toISOString();persist()}},400)},{passive:true});
 document.querySelectorAll('.rd-bar [data-size]').forEach(b=>b.onclick=()=>{size=Math.max(14,Math.min(28,size+(+b.dataset.size)*2));S.prefs.readerSize=size;box.style.fontSize=size+'px';persist()});
 const off=()=>{modal.classList.remove('rd-full');io.disconnect();modal.removeEventListener('close',off);try{render()}catch{}};modal.addEventListener('close',off)};

// ---- where it shows -------------------------------------------------------------------------------------------
const pageBefore=mediaPage;mediaPage=function(type){const html=pageBefore(type);if(type!=='books')return html;const holder=document.createElement('div');holder.innerHTML=html;
 const anchor=holder.querySelector('.ai-reco')||holder.querySelector('.pagehead');const t=document.createElement('template');t.innerHTML=readingMarkup()+freeMarkup();if(anchor)anchor.after(t.content);else holder.prepend(t.content);return holder.innerHTML};
if(typeof mediaCard==='function'){const cardBefore=mediaCard;mediaCard=function(type,r){const html=cardBefore(type,r);if(type!=='books')return html;
 const extra=`<div class="rd-actions rd-card-actions"><button type="button" onclick="lectaProgress('${r.id}')">Actualizar avance</button>${r.gutenbergId?`<button type="button" class="primary" onclick="lectaRead(${r.gutenbergId},'${r.id}')">Leer</button>`:''}</div>`;
 return html.replace(/<\/article>\s*$/,extra+'</article>')}}
try{render()}catch{}
})();
