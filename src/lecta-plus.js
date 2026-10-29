// lecta · ideas from Personal OS: knowledge graph, "Relacionado" under each note, AI on the text you write
// (summarise, explain, fix, rewrite, translate, key ideas, tasks for foco, a map), quick ideas and a map from
// any text. Classic script, loaded only in lecta after module-after.js; it uses the app's own functions.
(()=>{
'use strict';
if(typeof R!=='function'||typeof noteForm!=='function')return;
const host=()=>parent.EcosystemHost;
const SPARK='<svg class="ai-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';
const norm=t=>String(t??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const plainText=html=>String(html||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
const STOP=new Set('porque cuando donde desde hasta sobre entre tambien despues antes mientras aunque siempre nunca todos todas otros otras ellos ellas nosotros ustedes tengo tiene tienen hacer hecho puede pueden quiero quiere estoy estaba estan sigue mucho mucha muchos muchas algun alguna algunos algunas cosas cosa esto esta este estos estas ese esa esos esas aquel solo sola cada nada todo toda poco mismo misma otra otro pero como para segun hacia sino entonces ademas luego mejor menos mayor menor bien parte forma manera tiempo veces aqui alli ahora hola gracias'.split(' '));
const KIND={tag:['Etiqueta','#8f96a3'],genre:['Género','#8f96a3'],person:['Autor','#8f96a3'],link:['Enlace','#c46f3a'],note:['Nota','#7d6b91'],idea:['Idea','#c9973d'],map:['Mapa','#3f8a6b'],book:['Libro','#4b6fa6'],movie:['Película','#b25a5a'],music:['Música','#8a5aa8'],quote:['Frase','#5a8a8a'],item:['Biblioteca','#6b7380']};

// ---- Knowledge: what is connected to what ------------------------------------------------------------------
function items(){
 const out=[];
 for(const n of R('notes')){if(n.deletedAt||n.archived)continue;const tags=String(n.tags||'').split(',').map(t=>norm(t).trim()).filter(Boolean);
  out.push({key:'notes:'+n.id,type:'notes',id:n.id,kind:tags.includes('idea')||n.notebook==='Ideas'?'idea':'note',title:n.title||'Sin título',text:n.title+' '+plainText(n.body),tags,related:n.related||[]})}
 for(const m of R('maps'))if(!m.deletedAt)out.push({key:'maps:'+m.id,type:'maps',id:m.id,kind:'map',title:m.name,text:m.name+' '+(m.nodes||[]).map(x=>x.text).join(' '),tags:[],related:[]});
 for(const r of R('library')){if(r.deletedAt)continue;const kind=['Libro','PDF'].includes(r.kind)?'book':r.kind==='Película'?'movie':r.kind==='Música'?'music':'item';
  out.push({key:'library:'+r.id,type:'library',id:r.id,kind,title:r.name,text:[r.name,r.notes].filter(Boolean).join(' '),tags:[],related:[],genre:String(r.genre||'').trim(),author:String(r.author||'').trim()})}
 for(const l of R('links'))if(!l.deletedAt){const tags=String(l.tags||'').split(',').map(t=>norm(t).trim()).filter(Boolean);out.push({key:'links:'+l.id,type:'links',id:l.id,kind:'link',title:l.title||l.url,text:[l.title,l.note,l.tags].filter(Boolean).join(' '),tags,related:[]})}
 for(const q of R('quotes'))if(!q.deletedAt)out.push({key:'quotes:'+q.id,type:'quotes',id:q.id,kind:'quote',title:(q.author?q.author+': ':'')+String(q.text||'').slice(0,60),text:[q.text,q.author,q.context,q.meaning].filter(Boolean).join(' '),tags:[],related:[]});
 return out;
}
function keywords(text){const count=new Map();for(const w of norm(text).split(/[^a-z0-9ñ]+/)){if(w.length<5||STOP.has(w)||/^\d+$/.test(w))continue;const k=w.length>6?w.replace(/(es|s)$/,''):w;count.set(k,(count.get(k)||0)+1)}
 return [...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k])=>k)}
// Links: by hand ("Vincular") · one mentions the other's title · shared topic words. Shared tags, genres and
// authors become a small hub (#huerta, Ciencia ficción, Christopher Nolan): one line each instead of a tangle,
// and every line knows why it is there.
function knowledge(){
 const list=items(),byKey=new Map(list.map(i=>[i.key,i])),edges=new Map(),hubs=new Map();
 const link=(a,b,weight,why)=>{if(a===b)return;const k=a<b?a+'|'+b:b+'|'+a,e=edges.get(k);if(e){e.weight+=weight;if(!e.why.includes(why))e.why.push(why)}else edges.set(k,{a:a<b?a:b,b:a<b?b:a,weight,why:[why]})};
 for(const i of list){i.words=keywords(i.text);i.normText=norm(i.text);i.normTitle=norm(i.title).trim()}
 for(const i of list)for(const r of i.related){const other=byKey.get('notes:'+r);if(other)link(i.key,other.key,4,'las vinculaste')}
 const group=(kind,label,members,why)=>{if(members.length<2)return;const key=kind+':'+norm(label);hubs.set(key,{key,kind,title:label,hub:true,count:members.length,why});for(const m of members)link(m.key,key,2,why)};
 const by=(get)=>{const m=new Map();for(const i of list)for(const v of [].concat(get(i)||[])){const k=norm(v).trim();if(!k)continue;if(!m.has(k))m.set(k,{label:v,items:[]});m.get(k).items.push(i)}return m};
 for(const [,g] of by(i=>i.tags.filter(t=>t!=='idea')))group('tag','#'+g.label,g.items,'etiqueta «'+g.label+'»');
 for(const [,g] of by(i=>i.genre))group('genre',g.label,g.items,'mismo género: '+g.label);
 for(const [,g] of by(i=>i.author))group('person',g.label,g.items,'de '+g.label);
 for(const i of list){if(i.normTitle.length<5)continue;for(const j of list)if(j!==i&&j.normText.includes(i.normTitle))link(i.key,j.key,3,(j.title.length>30?j.title.slice(0,29)+'…':j.title)+' menciona «'+i.title.slice(0,40)+'»')}
 for(let x=0;x<list.length;x++)for(let y=x+1;y<list.length;y++){const a=list[x],b=list[y],shared=a.words.filter(w=>b.words.includes(w));
  if(shared.length>=2&&shared.length/Math.min(a.words.length||1,b.words.length||1)>=.2)link(a.key,b.key,shared.length>=4?2:1,'hablan de '+shared.slice(0,3).join(', '))}
 // keep the strongest links of each item so the picture stays readable
 const all=[...edges.values()].sort((a,b)=>b.weight-a.weight),degree=new Map(),kept=[];
 for(const e of all){if((degree.get(e.a)||0)>=7&&(degree.get(e.b)||0)>=7&&!hubs.has(e.a)&&!hubs.has(e.b))continue;kept.push(e);degree.set(e.a,(degree.get(e.a)||0)+1);degree.set(e.b,(degree.get(e.b)||0)+1)}
 const nodes=[...list,...hubs.values()];for(const h of hubs.values())byKey.set(h.key,h);
 return {nodes,edges:kept,byKey,items:list};
}
window.lectaKnowledge=knowledge;
// what an item is related to, and why: direct links, plus everything that shares one of its hubs
function relatedTo(key,limit=8,g=knowledge()){const out=new Map(),add=(k,why,w)=>{const it=g.byKey.get(k);if(!it||it.hub||k===key)return;const o=out.get(k)||{item:it,why:[],w:0};for(const y of why)if(!o.why.includes(y))o.why.push(y);o.w+=w;out.set(k,o)};
 for(const e of g.edges){if(e.a!==key&&e.b!==key)continue;const other=e.a===key?e.b:e.a,hub=g.byKey.get(other);
  if(hub?.hub){for(const f of g.edges)if((f.a===other||f.b===other)&&f.a!==key&&f.b!==key)add(f.a===other?f.b:f.a,[hub.why],1.5)}else add(other,e.why,e.weight)}
 return [...out.values()].sort((a,b)=>b.w-a.w).slice(0,limit)}
function openItem(type,id){closeModal?.();if(type==='notes')noteForm(id);else if(type==='maps')mapForm(id);else if(type==='links'&&window.lectaLink)window.lectaLink(id);else edit(type,id)}
window.lectaOpen=(type,id)=>setTimeout(()=>openItem(type,id),0);
const relatedMarkup=(key,g)=>{const rows=relatedTo(key,8,g);if(!rows.length)return `<p class="small">Todavía no hay nada conectado. Usá etiquetas, mencioná otras notas o vinculalas a mano.</p>`;
 return `<div class="lk-related">${rows.map(({item,why})=>`<button type="button" class="lk-row" onclick="lectaOpen('${item.type}','${item.id}')"><i style="background:${KIND[item.kind][1]}"></i><span><strong>${esc(item.title)}</strong><small>${esc(KIND[item.kind][0])}</small><em class="lk-why">${esc(why.map(w=>w[0].toUpperCase()+w.slice(1)).join(' · '))}</em></span></button>`).join('')}</div>`};

// ---- Graph view ---------------------------------------------------------------------------------------------
function untangle(g,pos,w,h){const box=v=>({w:Math.min(140,Math.max(36,(v.hub?v.title.length*6.2+18:Math.min(22,v.title.length)*5.6))),h:v.hub?22:30});
 const B=g.nodes.map(box);for(let it=0;it<80;it++){let moved=0;for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++){const a=pos[i],b=pos[j],ox=(B[i].w+B[j].w)/2-Math.abs(a.x-b.x),oy=(B[i].h+B[j].h)/2-Math.abs(a.y-b.y);
  if(ox>0&&oy>0){moved++;if(ox<oy){const d=(a.x<b.x?-1:1)*ox/2;a.x+=d;b.x-=d}else{const d=(a.y<b.y?-1:1)*oy/2;a.y+=d;b.y-=d}}}if(!moved)break}
 return pos}
function layout(g,w,h){
 const n=g.nodes.length,pos=g.nodes.map((_,i)=>{const a=i/n*Math.PI*2*2.4,r=Math.min(w,h)*.38*Math.sqrt((i+1)/n);return {x:w/2+Math.cos(a)*r,y:h/2+Math.sin(a)*r,vx:0,vy:0}});
 const idx=new Map(g.nodes.map((v,i)=>[v.key,i])),links=g.edges.map(e=>[idx.get(e.a),idx.get(e.b),e.weight]);
 const k=Math.sqrt(w*h/Math.max(1,n))*.7;
 for(let step=0;step<260;step++){const t=1-step/260;
  for(let i=0;i<n;i++){const p=pos[i];for(let j=i+1;j<n;j++){const q=pos[j];let dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy||.01;if(d2>k*k*16)continue;const f=k*k/d2*.6;p.vx+=dx*f;p.vy+=dy*f;q.vx-=dx*f;q.vy-=dy*f}}
  for(const [a,b,wt] of links){const p=pos[a],q=pos[b],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||.01,f=(d-k*.9)/d*.05*Math.min(3,wt);p.vx+=dx*f;p.vy+=dy*f;q.vx-=dx*f;q.vy-=dy*f}
  for(const p of pos){p.vx+=(w/2-p.x)*.006;p.vy+=(h/2-p.y)*.006;const sp=Math.hypot(p.vx,p.vy),cap=12*t+1;if(sp>cap){p.vx*=cap/sp;p.vy*=cap/sp}p.x+=p.vx;p.y+=p.vy;p.vx*=.55;p.vy*=.55}}
 untangle(g,pos,w,h);
 // fit everything inside the frame, with room for the labels
 const m=22,mx=26,xs=pos.map(p=>p.x),ys=pos.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),f=Math.min((w-2*mx)/Math.max(1,x1-x0),(h-2*m-14)/Math.max(1,y1-y0),1.6);
 for(const p of pos){p.x=mx+(p.x-x0)*f+((w-2*mx)-(x1-x0)*f)/2;p.y=m+(p.y-y0)*f+((h-2*m-14)-(y1-y0)*f)/2}
 return pos;
}
let graphState=null;
function graphPage(){
 const g=knowledge(),connected=new Set(g.edges.flatMap(e=>[e.a,e.b]).filter(k=>!g.byKey.get(k)?.hub));
 const counts=Object.keys(KIND).filter(k=>!['tag','genre','person'].includes(k)).map(k=>[k,g.items.filter(n=>n.kind===k).length]).filter(([,c])=>c);
 return head('Grafo de conocimiento','Cómo se conecta lo que guardaste: notas, ideas, mapas, libros, películas, música y frases.')+
  (g.items.length<2?section('Todavía hay poco para conectar',empty('Guardá algunas notas','Las conexiones aparecen solas cuando comparten etiquetas, temas o se mencionan entre sí.',"noteForm()",'Nueva nota','network')):
  `<section class="card lk-graph-card"><div class="lk-legend">${counts.map(([k,c])=>`<span><i style="background:${KIND[k][1]}"></i>${KIND[k][0]} ${c}</span>`).join('')}</div>
   <div class="lk-graph" id="lkGraph" data-connected="${connected.size}"><svg id="lkSvg" role="img" aria-label="Grafo de conocimiento"></svg>
    <div class="lk-zoom"><button type="button" aria-label="Acercar" onclick="lectaZoom(1.3)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg></button><button type="button" aria-label="Alejar" onclick="lectaZoom(1/1.3)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button><button type="button" aria-label="Volver a centrar" onclick="lectaZoom(0)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div></div>
   <div id="lkPanel" class="lk-panel"><p class="small">Tocá un punto para ver con qué se conecta y por qué. Los grises agrupan lo que comparte etiqueta, género o autor. Con dos dedos movés y acercás.</p></div>
   <p class="small">${connected.size} de ${g.items.length} cosas guardadas están conectadas.</p></section>`);
}
function drawGraph(){
 const svg=document.getElementById('lkSvg');if(!svg)return;const box=document.getElementById('lkGraph'),rect=box.getBoundingClientRect(),w=Math.round(rect.width)||340,h=Math.round(rect.height)||420;
 // draw again (centred) if the box changes size, e.g. once the page settles or the phone turns
 if(!box._ro&&window.ResizeObserver){let last=w;box._ro=new ResizeObserver(([e])=>{const nw=Math.round(e.contentRect.width);if(Math.abs(nw-last)>12){last=nw;drawGraph()}});box._ro.observe(box)}
 const g=knowledge(),pos=layout(g,w,h),idx=new Map(g.nodes.map((v,i)=>[v.key,i])),deg=new Map();for(const e of g.edges){deg.set(e.a,(deg.get(e.a)||0)+1);deg.set(e.b,(deg.get(e.b)||0)+1)}
 const NS='http://www.w3.org/2000/svg';svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.innerHTML='';const world=document.createElementNS(NS,'g');svg.append(world);
 const lines=g.edges.map(e=>{const a=pos[idx.get(e.a)],b=pos[idx.get(e.b)],l=document.createElementNS(NS,'line');l.setAttribute('x1',a.x);l.setAttribute('y1',a.y);l.setAttribute('x2',b.x);l.setAttribute('y2',b.y);l.setAttribute('vector-effect','non-scaling-stroke');l.setAttribute('class','lk-edge'+(g.byKey.get(e.a)?.hub||g.byKey.get(e.b)?.hub?' to-hub':''));l.style.strokeWidth=String(Math.min(3,.6+e.weight*.4));world.append(l);return {e,l}});
 const short=t=>t.length>20?t.slice(0,19)+'…':t;
 // each node keeps its size on screen when zooming (its inner group is counter-scaled in apply)
 const dots=g.nodes.map((v,i)=>{const p=pos[i],d=deg.get(v.key)||0,r=v.hub?4.5:4+Math.min(6,d*1.1),c=document.createElementNS(NS,'g');c.setAttribute('class','lk-node');c.setAttribute('transform',`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);c.dataset.key=v.key;
  const label=short(v.title);
  if(v.hub){c.classList.add('hub');c.innerHTML=`<g class="lk-in"><circle class="lk-hit" r="14"/><rect x="-4.5" y="-4.5" width="9" height="9" rx="2.5" transform="rotate(45)"/><text y="${r+12}">${esc(label)}</text></g>`}
  else c.innerHTML=`<g class="lk-in"><circle class="lk-hit" r="16"/><circle class="lk-dot" r="${r}" fill="${KIND[v.kind][1]}"/><text y="${r+12}">${esc(label)}</text></g>`;
  world.append(c);return {v,c,p,r,deg:d,w:label.length*(v.hub?5.6:6.1)+8,inner:c.firstChild,text:c.querySelector('text')}});
 graphState={svg,world,w,h,scale:1,x:0,y:0,g,lines,dots,sel:null,near:new Set()};apply();
 const labels=document.createElementNS(NS,'g');labels.setAttribute('class','lk-labels');world.append(labels);
 const select=key=>{labels.innerHTML='';for(const {e,l} of lines){const on=e.a===key||e.b===key;l.classList.toggle('on',on);
   if(on&&!g.byKey.get(e.a)?.hub&&!g.byKey.get(e.b)?.hub){const a=pos[idx.get(e.a)],b=pos[idx.get(e.b)],t=document.createElementNS(NS,'text');t.setAttribute('x',((a.x+b.x)/2).toFixed(1));t.setAttribute('y',((a.y+b.y)/2-3).toFixed(1));const why=e.why[0];t.textContent=why.length>28?why.slice(0,27)+'…':why;labels.append(t)}}const near=new Set(g.edges.filter(e=>e.a===key||e.b===key).flatMap(e=>[e.a,e.b]));
  for(const {v,c} of dots){c.classList.toggle('dim',!!key&&!near.has(v.key)&&v.key!==key);c.classList.toggle('sel',v.key===key)}
  graphState.sel=key;graphState.near=key?near:new Set();apply();
  const item=g.byKey.get(key),panel=document.getElementById('lkPanel');if(!item){panel.innerHTML='<p class="small">Tocá un punto para ver con qué se conecta y por qué.</p>';return}
  if(item.hub){const members=g.edges.filter(e=>e.a===key||e.b===key).map(e=>g.byKey.get(e.a===key?e.b:e.a)).filter(Boolean);
   panel.innerHTML=`<div class="lk-head"><span class="tag">${KIND[item.kind][0]}</span><h3>${esc(item.title)}</h3></div><p class="small">${members.length} cosas comparten ${esc(item.why)}.</p><div class="lk-related">${members.map(m=>`<button type="button" class="lk-row" onclick="lectaOpen('${m.type}','${m.id}')"><i style="background:${KIND[m.kind][1]}"></i><span><strong>${esc(m.title)}</strong><small>${esc(KIND[m.kind][0])}</small></span></button>`).join('')}</div>`;return}
  panel.innerHTML=`<div class="lk-head"><span class="tag" style="background:${KIND[item.kind][1]}22;color:${KIND[item.kind][1]}">${KIND[item.kind][0]}</span><h3>${esc(item.title)}</h3><button type="button" class="primary" onclick="lectaOpen('${item.type}','${item.id}')">Abrir</button></div><p class="small lk-why-intro">Se conecta con:</p>${relatedMarkup(key,g)}`};
 // pan with one finger, pinch with two (the app blocks the page zoom, not this)
 const pts=new Map();let start=null,moved=false;
 svg.onpointerdown=e=>{if(e.pointerType!=='touch')svg.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;start={x:graphState.x,y:graphState.y,scale:graphState.scale,pts:new Map(pts),target:e.target.closest?.('.lk-node')}};
 svg.onpointermove=e=>{if(!pts.has(e.pointerId)||!start)return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const r=svg.getBoundingClientRect(),k=w/r.width;
  if(pts.size===1){if(e.pointerType==='touch'){if(Math.hypot(e.clientX-[...start.pts.values()][0].x,e.clientY-[...start.pts.values()][0].y)>8)moved=true;return}const [p]=pts.values(),[s0]=start.pts.values();if(!s0)return;const dx=(p.x-s0.x)*k,dy=(p.y-s0.y)*k;if(Math.hypot(dx,dy)>6)moved=true;graphState.x=start.x+dx;graphState.y=start.y+dy}
  else if(pts.size===2&&start.pts.size===2){moved=true;const [a,b]=[...pts.values()],[a0,b0]=[...start.pts.values()],f=Math.hypot(a.x-b.x,a.y-b.y)/Math.max(10,Math.hypot(a0.x-b0.x,a0.y-b0.y));
   const cx=((a0.x+b0.x)/2-r.left)*k,cy=((a0.y+b0.y)/2-r.top)*k,ns=Math.max(.4,Math.min(4,start.scale*f));graphState.x=cx-(cx-start.x)*ns/start.scale;graphState.y=cy-(cy-start.y)*ns/start.scale;graphState.scale=ns}
  apply()};
 svg.onpointerup=svg.onpointercancel=e=>{pts.delete(e.pointerId);if(!pts.size){if(!moved)select(start?.target?.dataset.key||null);start=null}else start={x:graphState.x,y:graphState.y,scale:graphState.scale,pts:new Map(pts)}};
 svg.onwheel=e=>{e.preventDefault();window.lectaZoom(e.deltaY<0?1.15:1/1.15)};
}
function apply(){const s=graphState;if(!s)return;s.world.setAttribute('transform',`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) scale(${s.scale.toFixed(3)})`);
 // labels: same size on screen at any zoom; show the ones that fit without touching, the selection and the busiest first
 const k=1/s.scale,inv=`scale(${k.toFixed(4)})`,taken=[],fits=b=>!taken.some(t=>b.x0<t.x1&&b.x1>t.x0&&b.y0<t.y1&&b.y1>t.y0);
 const rank=d=>(d.v.key===s.sel?1e6:0)+(s.near.has(d.v.key)?1e5:0)+(d.v.hub?d.deg*2:d.deg*3)+(d.v.hub?0:1);
 for(const d of s.dots){d.inner.setAttribute('transform',inv);const x=d.p.x*s.scale+s.x,y=d.p.y*s.scale+s.y;taken.push({x0:x-d.r,x1:x+d.r,y0:y-d.r,y1:y+d.r})}
 for(const d of [...s.dots].sort((a,b)=>rank(b)-rank(a))){const x=d.p.x*s.scale+s.x,y=d.p.y*s.scale+s.y,b={x0:x-d.w/2,x1:x+d.w/2,y0:y+d.r+1,y1:y+d.r+15};
  const inside=b.x0>2&&b.x1<s.w-2&&b.y1<s.h-2&&y>0;const show=inside&&(rank(d)>=1e5||fits(b));d.text.style.display=show?'':'none';if(show)taken.push(b)}
 for(const t of s.svg.querySelectorAll('.lk-labels text'))t.setAttribute('font-size',(9*k).toFixed(2))}
window.lectaZoom=f=>{const s=graphState;if(!s)return;if(!f){s.scale=1;s.x=0;s.y=0}else{const ns=Math.max(.4,Math.min(4,s.scale*f));s.x=s.w/2-(s.w/2-s.x)*ns/s.scale;s.y=s.h/2-(s.h/2-s.y)*ns/s.scale;s.scale=ns}apply()};

// ---- Quick idea and a map from any text ----------------------------------------------------------------------
window.lectaIdea=()=>{openModal('Nueva idea',`<form class="form" id="ideaForm"><label>Tu idea<textarea name="text" rows="4" maxlength="4000" required placeholder="Lo que se te ocurrió, como sale"></textarea></label><label>Etiquetas, separadas por comas<input name="tags" maxlength="200"></label><div class="form-actions"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Guardar idea</button></div></form>`);
 document.getElementById('ideaForm').onsubmit=e=>{e.preventDefault();const d=new FormData(e.target),text=String(d.get('text')).trim();if(!text)return;const first=text.split(/\n|(?<=[.!?])\s/)[0].slice(0,120);
  storeRecord('notes',{title:first,body:text.split(/\n+/).map(p=>'<p>'+esc(p)+'</p>').join(''),notebook:'Ideas',tags:['idea',...String(d.get('tags')||'').split(',').map(t=>t.trim()).filter(Boolean)].join(', '),date:typeof today==='function'?today():new Date().toISOString().slice(0,10),favorite:false,related:[]});
  closeModal();save('Idea guardada')}};
const MAP_KINDS=[['mental','Mapa mental'],['conceptual','Mapa conceptual'],['flujo','Flujo de pasos']];
window.lectaTextMap=(text='',title='')=>{openModal('Mapa desde un texto',`<form class="form" id="textMapForm"><label>Texto<textarea name="text" rows="7" maxlength="12000" required placeholder="Pegá o escribí un texto: apuntes, un artículo, un plan…">${esc(text)}</textarea></label>
  <label>Tipo<select name="kind">${MAP_KINDS.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label><div id="textMapResult"></div>
  <div class="form-actions"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary" id="textMapGo">${SPARK}Armar con IA</button></div></form>`,true);
 const form=document.getElementById('textMapForm');let made=null;
 form.onsubmit=async e=>{e.preventDefault();const go=document.getElementById('textMapGo'),out=document.getElementById('textMapResult');
  if(made){try{storeRecord('maps',{name:made.title,nodes:made.nodes});closeModal();save('Mapa guardado');if(typeof screen!=='undefined'&&screen!=='maps')goLecta('maps')}catch(err){out.innerHTML=`<p class="small ai-error">${esc(err.message)}</p>`}return}
  const d=new FormData(form);go.disabled=true;go.textContent='Armando…';out.innerHTML='';
  try{const r=await host().ai({task:'map',text:String(d.get('text')),kind:String(d.get('kind'))});if(!r.nodes?.length)throw Error('La IA no devolvió un mapa. Probá con otro texto.');
   made={title:title||r.title,nodes:r.nodes};out.innerHTML=`<section class="card"><h3 style="margin-top:0">${esc(made.title)}</h3>${mapVisual(made.nodes)}</section>`;go.disabled=false;go.textContent='Guardar mapa'}
  catch(err){out.innerHTML=`<p class="small ai-error">${esc(err.message)}</p>`;go.disabled=false;go.innerHTML=SPARK+'Armar con IA'}}};
const goLecta=v=>{go(v);try{host().route('journal',{ecosystemRoute:true,app:'journal',view:v},false)}catch{}};

// ---- AI on the note you are writing ---------------------------------------------------------------------------
const ACTIONS=[['summary','Resumir'],['explain','Explicar'],['fix','Corregir'],['rewrite','Reformular'],['english','Traducir al inglés'],['spanish','Traducir al español'],['ideas','Ideas clave'],['tasks','Convertir en tareas'],['map','Hacer un mapa']];
let savedRange=null;
function editorText(){const ed=document.getElementById('noteEditor');if(!ed)return {text:'',range:null};const sel=getSelection();
 const range=savedRange&&ed.contains(savedRange.commonAncestorContainer)&&!savedRange.collapsed?savedRange:null;return {text:(range?range.toString():ed.innerText).trim(),range}}
async function runAction(action){
 const box=document.getElementById('lkAiResult'),{text,range}=editorText();if(!box)return;
 if(text.length<3){box.innerHTML='<p class="small ai-error">Escribí o seleccioná un texto primero.</p>';return}
 if(action==='map'){const title=document.querySelector('#noteForm [name=title]')?.value||'';closeModal();setTimeout(()=>window.lectaTextMap(text,title),0);return}
 box.innerHTML=`<p class="small">${SPARK}Pensando…</p>`;
 try{
  if(action==='tasks'){const r=await host().ai({task:'tasks',text});if(!r.tasks?.length)throw Error('No encontré tareas en el texto.');
   box.innerHTML=`<div class="lk-ai-box"><strong>Tareas para foco</strong>${r.tasks.map((t,i)=>`<label class="checklabel"><input type="checkbox" data-task="${i}" checked> ${esc(t.title)}${t.date?` <span class="small">· ${t.date.split('-').reverse().join('/')}</span>`:''}</label>`).join('')}<div class="actions"><button type="button" class="primary" id="lkTasksGo">Crear en foco</button><button type="button" onclick="this.closest('.lk-ai-box').remove()">Descartar</button></div></div>`;
   document.getElementById('lkTasksGo').onclick=async()=>{const pick=r.tasks.filter((_,i)=>box.querySelector(`[data-task="${i}"]`)?.checked);if(!pick.length)return;
    try{await host().addTasks(pick);box.innerHTML=`<p class="small">${pick.length===1?'Tarea creada':pick.length+' tareas creadas'} en foco.</p>`}catch(err){box.innerHTML=`<p class="small ai-error">${esc(err.message)}</p>`}};return}
  const r=await host().ai({task:'transform',action,text});if(!r.text)throw Error('La IA no devolvió texto.');
  box.innerHTML=`<div class="lk-ai-box"><strong>${esc(ACTIONS.find(a=>a[0]===action)[1])}</strong><div class="lk-ai-text">${r.text.split(/\n+/).map(p=>'<p>'+esc(p)+'</p>').join('')}</div>
   <div class="actions">${range?'<button type="button" class="primary" data-do="replace">Reemplazar selección</button>':['fix','rewrite','english','spanish'].includes(action)?'<button type="button" class="primary" data-do="all">Reemplazar todo</button>':''}<button type="button" data-do="below">Agregar al final</button><button type="button" data-do="copy">Copiar</button><button type="button" data-do="close">Descartar</button></div></div>`;
  const html=r.text.split(/\n+/).map(p=>'<p>'+esc(p)+'</p>').join(''),ed=document.getElementById('noteEditor');
  box.querySelectorAll('[data-do]').forEach(b=>b.onclick=async()=>{const what=b.dataset.do;
   if(what==='replace'&&range){const sel=getSelection();sel.removeAllRanges();sel.addRange(range);document.execCommand('insertText',false,r.text)}
   else if(what==='all')ed.innerHTML=html;
   else if(what==='below')ed.insertAdjacentHTML('beforeend',(action==='summary'?'<h2>Resumen</h2>':action==='ideas'?'<h2>Ideas clave</h2>':'')+html);
   else if(what==='copy'){try{await navigator.clipboard.writeText(r.text);b.textContent='Copiado'}catch{}return}
   box.innerHTML=''})}
 catch(err){box.innerHTML=`<p class="small ai-error">${esc(err.message)}</p>`}
}
const noteFormBefore=noteForm;
noteForm=function(id){
 noteFormBefore(id);const form=document.getElementById('noteForm'),bar=form?.querySelector('.editor-toolbar');if(!bar)return;
 const b=document.createElement('button');b.type='button';b.className='lk-ai-tool';b.setAttribute('aria-label','IA');b.innerHTML=SPARK+'IA';
 b.onmousedown=b.onpointerdown=e=>{e.preventDefault();const sel=getSelection();savedRange=sel.rangeCount?sel.getRangeAt(0).cloneRange():null};
 const menu=document.createElement('div');menu.className='lk-ai-menu';menu.hidden=true;menu.innerHTML=ACTIONS.map(([k,l])=>`<button type="button" data-act="${k}">${l}</button>`).join('');
 b.onclick=()=>{menu.hidden=!menu.hidden};menu.onmousedown=e=>e.preventDefault();
 menu.querySelectorAll('[data-act]').forEach(x=>x.onclick=()=>{menu.hidden=true;runAction(x.dataset.act)});
 const result=document.createElement('div');result.id='lkAiResult';bar.append(b);bar.after(menu);menu.after(result);
 if(id){const rel=document.createElement('section');rel.className='lk-related-box';rel.innerHTML=`<h3>Relacionado</h3>${relatedMarkup('notes:'+id)}`;form.querySelector('.form-actions')?.before(rel)}
};

// ---- Where to find it: Notas gets Ideas, Mapa desde un texto and the graph; the graph is its own page ----------
const markupBefore=appMarkup;
appMarkup=function(v){
 if(v==='graph')return graphPage();
 const html=markupBefore(v);if(v!=='notes'&&v!=='dashboard'&&v!=='maps')return html;
 const holder=document.createElement('div');holder.innerHTML=html;const headEl=holder.querySelector('.pagehead');
 const tools=document.createElement('div');tools.className='lk-tools';
 tools.innerHTML=`<button type="button" onclick="lectaIdea()"><span class="lk-dot" style="background:${KIND.idea[1]}"></span>Nueva idea</button><button type="button" onclick="lectaTextMap()">${SPARK}Mapa desde un texto</button><button type="button" onclick="lectaGraph()"><span class="lk-dot" style="background:${KIND.map[1]}"></span>Grafo de conocimiento</button>`;
 if(headEl)headEl.after(tools);else holder.prepend(tools);return holder.innerHTML;
};
window.lectaGraph=()=>goLecta('graph');
const renderBefore=render;
render=function(){renderBefore();if(typeof screen!=='undefined'&&screen==='graph'&&!searchQuery)requestAnimationFrame(drawGraph)};
try{render()}catch{}
})();
