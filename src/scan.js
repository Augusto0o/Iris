// Digitize: photograph a service bill, a contract, a drawing or written text; it is read on the phone
// (Tesseract, no server), you review it and it is saved in the app it belongs to. Loaded only when opened.
import {parseBill,parseContract,parseText,parseTaskLines,toNoteHtml,escapeHtml as esc} from './scan-parse.js';
import {detectDocument,findDocument,quadArea,outputSize,warp,enhance,rotate90} from './scan-crop.js';
import {putScan,canvasBlob} from './scan-store.js';

const TYPES=[
 {id:'bill',title:'Pago de servicio',desc:'Una boleta o comprobante. Se registra en numio.',app:'iris',mark:'numio',multiple:false,ocr:true},
 {id:'home-bill',title:'Boleta de servicio',desc:'Luz, gas, agua, internet… Se registra como pago en domo › Servicios.',app:'mi-espacio',mark:'domo',multiple:false,ocr:true},
 {id:'contract',title:'Contrato',desc:'Una o varias páginas. Se guarda en domo › Vivienda.',app:'mi-espacio',mark:'domo',multiple:true,ocr:true},
 {id:'drawing',title:'Dibujo',desc:'Un dibujo en papel, con el fondo limpio. Va a lecta › Dibujos.',app:'journal',mark:'lecta',multiple:false,ocr:false},
 {id:'text',title:'Texto',desc:'Apuntes, cartas o páginas. Se transcribe a una nota de lecta.',app:'journal',mark:'lecta',multiple:true,ocr:true},
 {id:'statement',title:'Resumen de tarjeta',desc:'El PDF del resumen o una foto: cierre, vencimiento, total y consumos. Va a numio › Tarjetas.',app:'iris',mark:'numio',multiple:true,ocr:true,pdf:true},
 {id:'document',title:'Documento',desc:'DNI, garantías, recetas médicas, papeles… Se guarda tal cual, con todas sus páginas, en lecta › Documentos.',app:'journal',mark:'lecta',multiple:true,ocr:false,keep:true},
 {id:'tasks',title:'Lista de tareas',desc:'Una lista escrita: cada renglón se vuelve una tarea en foco.',app:'organizador',mark:'foco',multiple:true,ocr:true},
];
// text inside a PDF (card statements), with Mozilla's PDF.js, loaded only when needed
const isTextFile=f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name);
const fileText=f=>pdfText(f);
async function pdfText(file){const url='/pdf/pdf.min.mjs',lib=await import(/* the build copies it */url);lib.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';
 const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
 for(let i=1;i<=Math.min(doc.numPages,12);i++){const page=await doc.getPage(i),c=await page.getTextContent();let line='',lastY=null;
  for(const it of c.items){const y=Math.round(it.transform?.[5]??0);if(lastY!==null&&Math.abs(y-lastY)>3){out.push(line.trim());line=''}line+=(line&&!line.endsWith(' ')?' ':'')+it.str;lastY=y}out.push(line.trim())}
 return out.filter(Boolean).join('\n')}
const FILTERS=[['document','Documento'],['color','Color'],['gray','Gris'],['bw','Blanco y negro'],['photo','Foto']];
const look=(img,mode)=>{if(mode!=='photo')enhance(img,mode)};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const MONTH_NAMES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const periodLabel=p=>/^\d{4}-\d{2}$/.test(p||'')?MONTH_NAMES[+p.slice(5)-1]+' '+p.slice(0,4):'';

// ---- Images -----------------------------------------------------------------------------------------------
async function loadImage(file){
 try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch{}
 const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();return img}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
}
function toCanvas(img,max){
 const w=img.width||img.naturalWidth,h=img.height||img.naturalHeight,k=Math.min(1,max/Math.max(w,h));
 const c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c;
}
const lum=(d,i)=>.299*d[i]+.587*d[i+1]+.114*d[i+2];
function percentile(data,p){const hist=new Uint32Array(256);let n=0;for(let i=0;i<data.length;i+=16){hist[Math.round(lum(data,i))]++;n++}let acc=0;for(let v=0;v<256;v++){acc+=hist[v];if(acc>=n*p)return v}return 255}
// Grey and stretched contrast: Tesseract reads photos of paper much better this way.
export function prepareForReading(canvas){
 const ctx=canvas.getContext('2d'),img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data;
 // the ink is the darkest thing on a page even when there is little of it; edges and shadows are not
 const lo=percentile(d,.001),hi=Math.max(lo+1,percentile(d,.99));
 for(let i=0;i<d.length;i+=4){const v=Math.max(0,Math.min(255,(lum(d,i)-lo)*255/(hi-lo)));d[i]=d[i+1]=d[i+2]=v}
 ctx.putImageData(img,0,0);return canvas;
}
// Paper turns white and the strokes keep their colour.
export function cleanDrawing(source,clean=true){
 const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d');ctx.drawImage(source,0,0);
 if(!clean)return c;
 const img=ctx.getImageData(0,0,c.width,c.height),d=img.data,paper=Math.max(60,percentile(d,.8));
 for(let i=0;i<d.length;i+=4){const ink=Math.max(0,Math.min(1,(paper-lum(d,i))/(paper*.55)-.08));const k=Math.min(1,ink*1.25);for(let j=0;j<3;j++)d[i+j]=Math.round(255-k*(255-d[i+j]*.85))}
 ctx.putImageData(img,0,0);return c;
}
// The page you keep goes to the scan store (IndexedDB) as a JPEG.
function sized(canvas,max=1800){const k=Math.min(1,max/Math.max(canvas.width,canvas.height));if(k>=1)return canvas;const c=document.createElement('canvas');c.width=Math.round(canvas.width*k);c.height=Math.round(canvas.height*k);c.getContext('2d').drawImage(canvas,0,0,c.width,c.height);return c}
const canvasOf=img=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').putImageData(img instanceof ImageData?img:new ImageData(img.data,img.width,img.height),0,0);return c};
function pngWithin(canvas,limit=2_900_000){let c=canvas,url=c.toDataURL('image/png');while(url.length>limit&&c.width>300){const n=document.createElement('canvas');n.width=Math.round(c.width*.8);n.height=Math.round(c.height*.8);n.getContext('2d').drawImage(c,0,0,n.width,n.height);c=n;url=c.toDataURL('image/png')}return url}

// ---- Reader (Tesseract, served from /ocr: worker, engine and Spanish data) --------------------------------------
let workerPromise=null;
async function reader(onProgress){
 if(!workerPromise)workerPromise=(async()=>{
  const mod=await import('tesseract.js/dist/tesseract.esm.min.js'),createWorker=mod.createWorker||mod.default?.createWorker;
  return createWorker('spa',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',gzip:true,workerBlobURL:false,logger:m=>reader.listener?.(m)});
 })().catch(e=>{workerPromise=null;throw e});
 reader.listener=onProgress;return workerPromise;
}
export async function releaseReader(){const p=workerPromise;workerPromise=null;if(p)try{(await p).terminate()}catch{}}
export async function readPages(canvases,onProgress){
 const worker=await reader(m=>onProgress?.({phase:m.status,progress:m.progress}));const out=[];
 for(let i=0;i<canvases.length;i++){reader.listener=m=>{if(m.status==='recognizing text')onProgress?.({phase:'reading',page:i+1,pages:canvases.length,progress:m.progress})};
  const copy=document.createElement('canvas');copy.width=canvases[i].width;copy.height=canvases[i].height;copy.getContext('2d').drawImage(canvases[i],0,0);
  const {data}=await worker.recognize(prepareForReading(copy));out.push(data.text.trim())}
 return out.join('\n\n');
}

// ---- Dialog ---------------------------------------------------------------------------------------------------
export function createScanner({dialog,body,ensureFrame,openResult,notify}){
 const title=t=>{dialog.querySelector('h2').textContent=t};
 const el=html=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content};
 const BRAND={nubo:['/brand/nubo-light.svg','/brand/nubo-dark.svg'],numio:['/brand/numio-light.svg','/brand/numio-dark.svg'],domo:['/brand/domo-light.svg','/brand/domo-dark.svg'],lecta:['/brand/lecta-light.svg','/brand/lecta-dark.svg'],foco:['/brand/foco-light.svg','/brand/foco-dark.svg']},mark=(m,dark)=>`<img class="scan-mark" alt="" src="${(BRAND[m]||BRAND.nubo)[dark?1:0]}">`;
 const dark=()=>document.documentElement.dataset.theme==='dark';
 let job=0,list=TYPES,scans=[];

 // `types` narrows the choice to what the app that opened it keeps (domo: service bills and contracts…).
 function open({types}={}){list=types?.length?TYPES.filter(t=>types.includes(t.id)):TYPES;if(!list.length)list=TYPES;dialog.dataset.view='scan';if(!dialog.open)dialog.showModal();if(list.length===1)live(list[0]);else chooseType()}
 const back=()=>{if(list.length===1){job++;dialog.close()}else chooseType()},again=()=>list.length===1?live(list[0]):chooseType();
 function chooseType(){
  job++;stopLive();title('Digitalizar');
  body.replaceChildren(el(`<p class="muted">Sacá una foto con buena luz y el papel derecho. Se lee en tu teléfono: nada sale de él.</p><div class="scan-types">${list.map(t=>`<button type="button" class="scan-type" data-type="${t.id}">${mark(t.mark,dark())}<span><strong>${t.title}</strong><small>${t.desc}</small></span></button>`).join('')}</div>`));
  body.querySelectorAll('.scan-type').forEach(b=>b.onclick=()=>live(TYPES.find(t=>t.id===b.dataset.type)));
 }
 function capture(type,why=''){
  stopLive();title(type.title);
  body.replaceChildren(el(`${why?`<p class="status">${esc(why)}</p>`:''}<p class="muted">${type.multiple?'Podés sumar varias páginas: se leen en orden.':'Una foto alcanza.'}</p>
   <div class="scan-pick"><label class="scan-file primary-like"><input type="file" accept="image/*" capture="environment" ${type.multiple?'multiple':''}><span>Sacar foto</span></label>
   <label class="scan-file"><input type="file" accept="${type.pdf?'application/pdf,image/*':'image/*'}" ${type.multiple?'multiple':''}><span>${type.pdf?'Elegir PDF o foto':'Elegir de la galería'}</span></label></div>
   <button type="button" class="scan-back">${list.length===1?'Cancelar':'Volver'}</button>`));
  body.querySelector('.scan-back').onclick=back;
  body.querySelectorAll('input[type=file]').forEach(i=>i.onchange=async()=>{if(!i.files?.length)return;const files=[...i.files],pdf=files.find(isTextFile);
   if(pdf&&type.pdf){const mine=++job;progress('Leyendo el archivo…',.2);try{const text=await fileText(pdf);if(mine!==job)return;if(text.trim().length<40)return failed(type,'Ese archivo no tiene texto (es una imagen). Probá con una foto o captura.');byText(type,text)}catch(x){failed(type,'No se pudo leer el archivo: '+(x?.message||x))}return}
   process(type,files)});
 }
 // ---- Crop: move the corners, then choose how the page looks --------------------------------------------
 let lastEdit=null;
 function cropStep(source,index,total,defaultMode,startQuad){return new Promise(resolve=>{const mine=job;
  let quad=startQuad?startQuad.map(p=>({...p})):detectDocument(source.getContext('2d').getImageData(0,0,source.width,source.height));
  const page=total>1?`Página ${index+1} de ${total} · `:'';
  body.replaceChildren(el(`<p class="muted">${page}Mové las esquinas hasta los bordes de la hoja.</p><div class="scan-crop"><canvas aria-label="Recorte de la foto"></canvas></div>
   <div class="scan-row"><button type="button" data-act="auto">Detectar hoja</button><button type="button" data-act="full">Toda la foto</button></div>
   <div class="actions"><button type="button" class="primary" data-act="next">Siguiente</button><button type="button" class="scan-back">Cancelar</button></div>`));
  body.querySelector('.scan-back').onclick=()=>{resolve(null);back()};
  const view=body.querySelector('.scan-crop canvas'),ctx=view.getContext('2d'),dpr=Math.min(3,window.devicePixelRatio||1);
  const cssW=Math.max(200,body.clientWidth||320),k=Math.min(cssW/source.width,(innerHeight*.5)/source.height),cw=Math.round(source.width*k),ch=Math.round(source.height*k);
  view.style.width=cw+'px';view.style.height=ch+'px';view.width=Math.round(cw*dpr);view.height=Math.round(ch*dpr);
  let drag=-1,finger=null;
  const draw=()=>{ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);ctx.drawImage(source,0,0,cw,ch);
   const pts=quad.map(p=>({x:p.x*k,y:p.y*k}));
   ctx.fillStyle='rgba(16,18,23,.5)';ctx.beginPath();ctx.rect(0,0,cw,ch);ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fill('evenodd');
   ctx.strokeStyle='#5b9dff';ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
   for(const [i,p] of pts.entries()){ctx.beginPath();ctx.arc(p.x,p.y,i===drag?13:10,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.95)';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#5b9dff';ctx.stroke()}
   // loupe above the finger, so the corner you are moving stays visible
   if(drag>=0&&finger){const p=pts[drag],r=44,lx=Math.min(cw-r-4,Math.max(r+4,p.x)),ly=p.y-r-34<r+4?p.y+r+34:p.y-r-34,z=2.5;
    ctx.save();ctx.beginPath();ctx.arc(lx,ly,r,0,Math.PI*2);ctx.clip();ctx.fillStyle='#111';ctx.fillRect(lx-r,ly-r,2*r,2*r);
    ctx.drawImage(source,quad[drag].x-r/(k*z),quad[drag].y-r/(k*z),2*r/(k*z),2*r/(k*z),lx-r,ly-r,2*r,2*r);
    ctx.strokeStyle='#5b9dff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(lx-8,ly);ctx.lineTo(lx+8,ly);ctx.moveTo(lx,ly-8);ctx.lineTo(lx,ly+8);ctx.stroke();ctx.restore();
    ctx.beginPath();ctx.arc(lx,ly,r,0,Math.PI*2);ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke()}};
  const at=e=>{const r=view.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
  view.onpointerdown=e=>{const p=at(e);let best=-1,dist=40;quad.forEach((q,i)=>{const d=Math.hypot(q.x*k-p.x,q.y*k-p.y);if(d<dist){dist=d;best=i}});if(best<0)return;e.preventDefault();drag=best;finger=p;view.setPointerCapture(e.pointerId);draw()};
  view.onpointermove=e=>{if(drag<0)return;e.preventDefault();const p=at(e);finger=p;quad[drag]={x:Math.max(0,Math.min(source.width,p.x/k)),y:Math.max(0,Math.min(source.height,p.y/k))};draw()};
  view.onpointerup=view.onpointercancel=()=>{drag=-1;finger=null;draw()};
  body.querySelector('[data-act=auto]').onclick=()=>{quad=detectDocument(source.getContext('2d').getImageData(0,0,source.width,source.height));draw()};
  body.querySelector('[data-act=full]').onclick=()=>{quad=[{x:0,y:0},{x:source.width,y:0},{x:source.width,y:source.height},{x:0,y:source.height}];draw()};
  body.querySelector('[data-act=next]').onclick=()=>{if(mine===job){lastEdit={quad:quad.map(p=>({...p})),mode:defaultMode};lookStep(source,quad,page,defaultMode,resolve,()=>cropStep(source,index,total,defaultMode,quad).then(resolve))}};
  draw();
 })}
 function lookStep(source,quad,page,mode,resolve,again){
  const size=outputSize(quad,1800),flat=document.createElement('canvas');flat.width=size.width;flat.height=size.height;
  const fctx=flat.getContext('2d'),straight=warp(source.getContext('2d').getImageData(0,0,source.width,source.height),quad,fctx.createImageData(size.width,size.height));
  let base=straight;
  const MODES=FILTERS;
  body.replaceChildren(el(`<p class="muted">${page}Elegí cómo queda la página.</p><div class="scan-crop"><canvas aria-label="Página enderezada"></canvas></div>
   <div class="scan-row scan-modes" role="radiogroup" aria-label="Aspecto">${MODES.map(([m,l])=>`<button type="button" role="radio" data-mode="${m}">${l}</button>`).join('')}<button type="button" data-act="rotate" aria-label="Girar 90°">Girar</button></div>
   <div class="actions"><button type="button" class="primary" data-act="use">Usar esta página</button><button type="button" data-act="again">Volver a recortar</button></div>`));
  const view=body.querySelector('.scan-crop canvas'),cssW=Math.max(200,body.clientWidth||320);
  const paint=()=>{const k=Math.min(1,cssW/base.width,(innerHeight*.5)/base.height),w=Math.max(1,Math.round(base.width*k)),h=Math.max(1,Math.round(base.height*k));
   const small=document.createElement('canvas');small.width=w;small.height=h;const sctx=small.getContext('2d');sctx.drawImage(canvasOf(base),0,0,w,h);
   const img=sctx.getImageData(0,0,w,h);look(img,mode);view.width=w;view.height=h;view.style.width=w+'px';view.getContext('2d').putImageData(img,0,0);
   for(const b of body.querySelectorAll('[data-mode]')){b.setAttribute('aria-checked',String(b.dataset.mode===mode));b.classList.toggle('selected',b.dataset.mode===mode)}};
  for(const b of body.querySelectorAll('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode;paint()};
  body.querySelector('[data-act=rotate]').onclick=()=>{base=rotate90(base,(w,h)=>new ImageData(w,h));if(lastEdit)lastEdit.turns=(lastEdit.turns||0)+1;paint()};
  body.querySelector('[data-act=again]').onclick=again;
  body.querySelector('[data-act=use]').onclick=()=>{const full=new ImageData(new Uint8ClampedArray(base.data),base.width,base.height);look(full,mode);if(lastEdit)lastEdit.mode=mode;resolve(canvasOf(full))};
  paint();
 }
 function progress(text,value){
  let box=body.querySelector('.scan-progress');
  if(!box){body.replaceChildren(el(`<div class="scan-progress" role="status"><p></p><div class="scan-bar"><i></i></div></div>`));box=body.querySelector('.scan-progress')}
  box.querySelector('p').textContent=text;box.querySelector('i').style.width=Math.round((value??0)*100)+'%';
 }
 async function process(type,files){
  const mine=++job;stopLive();
  try{
   progress('Preparando '+(files.length>1?'las imágenes':'la imagen')+'…',.05);
   const images=[];for(const f of files)images.push(await loadImage(f));
   if(mine!==job)return;
   // like the iPhone: each page is cropped to the sheet and straightened before reading
   const pages=[];for(let i=0;i<images.length;i++){const page=await cropStep(toCanvas(images[i],2000),i,images.length,type.ocr||type.id==='document'?'document':'color');if(mine!==job||!page)return;pages.push(page)}
   await usePages(type,pages,mine);
  }catch(e){if(mine===job)failed(type,'No se pudo leer la imagen: '+(e?.message||e)+'. Si es la primera vez, necesitás conexión para descargar el lector.')}
 }
 async function usePages(type,pages,mine){
  try{
   scans=[];if(type.ocr)for(const p of pages){try{scans.push(await putScan(await canvasBlob(sized(p),'image/jpeg',.8)))}catch{}}
   if(type.id==='document')return reviewDocument(pages,mine);
   if(!type.ocr)return reviewDrawing(pages[0]);
   progress('Leyendo el texto…',.1);
   const text=await readPages(pages,p=>{if(mine!==job)return;
    if(p.phase==='reading')progress(pages.length>1?`Leyendo la página ${p.page} de ${p.pages}…`:'Leyendo el texto…',.15+.85*((p.page-1+p.progress)/p.pages));
    else progress('Preparando el lector (la primera vez tarda un poco)…',.05+.1*(p.progress||0))});
   if(mine!==job)return;
   if(!text.trim()){failed(type,'No encontré texto en la foto. Probá con más luz, más cerca y el papel derecho.');return}
   if(type.id==='statement')return reviewStatement(text);
   if(type.id==='bill')return reviewBill(text);
   if(type.id==='home-bill')return reviewHomeBill(text);
   if(type.id==='tasks')return reviewTasks(text);
   if(type.id==='contract')return reviewContract(text);
   return reviewText(text);
  }catch(e){if(mine===job)failed(type,'No se pudo leer la imagen: '+(e?.message||e)+'. Si es la primera vez, necesitás conexión para descargar el lector.')}
 }
 // ---- Live camera, like Notes on the iPhone: the sheet is outlined while you aim, it shoots by itself when the
 // phone is still (or with the button), pages pile up in the corner, and you can fix any of them before saving.
 let cam=null;
 function stopLive(){if(!cam)return;cam.running=false;clearTimeout(cam.timer);cam.stream?.getTracks().forEach(t=>t.stop());cam=null;if(dialog.dataset.view==='scan-live')dialog.dataset.view='scan'}
 dialog.addEventListener('close',stopLive);
 function flatten(source,quad,mode,turns=0){const size=outputSize(quad,1800),c=document.createElement('canvas');c.width=size.width;c.height=size.height;const x=c.getContext('2d');
  let img=warp(source.getContext('2d').getImageData(0,0,source.width,source.height),quad,x.createImageData(size.width,size.height));for(let i=0;i<turns%4;i++)img=rotate90(img,(w,h)=>new ImageData(w,h));look(img,mode);return canvasOf(img)}
 async function live(type){
  if(!navigator.mediaDevices?.getUserMedia)return capture(type);
  stopLive();const mine=++job;title(type.title);
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}}})}
  catch{if(mine===job)capture(type,'No se pudo usar la cámara. Podés sacar la foto o elegirla de tus fotos.');return}
  if(mine!==job){stream.getTracks().forEach(t=>t.stop());return}
  let autoShot=true;try{autoShot=localStorage.getItem('nubo-scan-auto')!=='off'}catch{}
  const state=cam={stream,running:true,timer:0,pages:[],mode:type.ocr||type.id==='document'?'document':'color'};
  dialog.dataset.view='scan-live';
  body.replaceChildren(el(`<div class="live">
   <div class="live-top"><button type="button" class="live-btn" data-act="cancel">Cancelar</button><div class="live-top-r"><button type="button" class="live-btn" data-act="filter"></button><button type="button" class="live-btn" data-act="auto"></button></div></div>
   <div class="live-view"><video playsinline muted autoplay></video><canvas class="live-overlay" aria-hidden="true"></canvas><p class="live-hint" role="status">Buscando un documento…</p><div class="live-flash"></div></div>
   <div class="live-bottom"><div class="live-left"><button type="button" class="live-thumb" data-act="review" hidden aria-label="Ver las páginas"><img alt=""><span>0</span></button><label class="live-gallery" data-act="gallery">${type.pdf?'PDF o fotos':'Fotos'}<input type="file" accept="${type.pdf?'application/pdf,image/*':'image/*'}" ${type.multiple?'multiple':''}></label></div>
    <button type="button" class="live-shutter" data-act="shot" aria-label="Sacar foto"><i></i></button>
    <div class="live-right"><button type="button" class="live-save" data-act="save" hidden>Guardar</button></div></div></div>`));
  const root=body.querySelector('.live'),video=root.querySelector('video'),overlay=root.querySelector('.live-overlay'),hint=root.querySelector('.live-hint'),octx=overlay.getContext('2d');
  const paintTop=()=>{root.querySelector('[data-act=filter]').textContent=FILTERS.find(f=>f[0]===state.mode)[1];root.querySelector('[data-act=auto]').textContent=autoShot?'Automático':'Manual';root.querySelector('[data-act=auto]').classList.toggle('on',autoShot)};paintTop();
  const paintPages=()=>{const n=state.pages.length,t=root.querySelector('.live-thumb');t.hidden=!n;root.querySelector('.live-gallery').hidden=!!n;root.querySelector('.live-save').hidden=!n;
   if(n){const last=state.pages.at(-1).canvas,s=document.createElement('canvas'),k=120/Math.max(last.width,last.height);s.width=Math.round(last.width*k);s.height=Math.round(last.height*k);s.getContext('2d').drawImage(last,0,0,s.width,s.height);t.querySelector('img').src=s.toDataURL('image/jpeg',.7);t.querySelector('span').textContent=n;root.querySelector('.live-save').textContent=`Guardar (${n})`}};
  // what the camera sees, small, several times a second
  const small=document.createElement('canvas'),sctx=small.getContext('2d',{willReadFrequently:true});let shown=null,seen=null,still=0,lastShot=0,busy=false;
  const box=()=>{const r=video.getBoundingClientRect(),vw=video.videoWidth||1,vh=video.videoHeight||1,k=Math.min(r.width/vw,r.height/vh);return {k,x:(r.width-vw*k)/2,y:(r.height-vh*k)/2,w:r.width,h:r.height}};
  function drawOverlay(progress=0){const b=box(),dpr=Math.min(3,devicePixelRatio||1);if(overlay.width!==Math.round(b.w*dpr)){overlay.width=Math.round(b.w*dpr);overlay.height=Math.round(b.h*dpr)}
   octx.setTransform(dpr,0,0,dpr,0,0);octx.clearRect(0,0,b.w,b.h);if(!shown)return;const pts=shown.map(p=>({x:b.x+p.x*b.k,y:b.y+p.y*b.k}));
   octx.beginPath();pts.forEach((p,i)=>i?octx.lineTo(p.x,p.y):octx.moveTo(p.x,p.y));octx.closePath();octx.fillStyle=`rgba(10,132,255,${.16+.16*progress})`;octx.fill();octx.lineWidth=2.5;octx.strokeStyle='#0a84ff';octx.lineJoin='round';octx.stroke()}
  function tick(){if(!state.running||mine!==job)return;
   if(video.readyState>=2&&!busy){const vw=video.videoWidth,vh=video.videoHeight,k=360/Math.max(vw,vh);small.width=Math.round(vw*k);small.height=Math.round(vh*k);sctx.drawImage(video,0,0,small.width,small.height);
    const r=findDocument(sctx.getImageData(0,0,small.width,small.height)),ok=r.found&&quadArea(r.quad)>small.width*small.height*.1;
    const q=ok?r.quad.map(p=>({x:p.x/k,y:p.y/k})):null,diag=Math.hypot(vw,vh);
    if(q&&seen&&Math.max(...q.map((p,i)=>Math.hypot(p.x-seen[i].x,p.y-seen[i].y)))<diag*.03)still++;else still=0;
    seen=q;shown=q?(shown?shown.map((p,i)=>({x:p.x*.45+q[i].x*.55,y:p.y*.45+q[i].y*.55})):q):null;
    const need=6,ready=autoShot&&q&&Date.now()-lastShot>1800;
    hint.textContent=!q?'Buscando un documento…':autoShot?(still>=2?'Mantené el teléfono quieto…':'Acercate o centrá la hoja'):'Tocá el botón para sacar la foto';
    drawOverlay(ready?Math.min(1,still/need):0);
    if(ready&&still>=need){still=0;shoot(false)}}
   state.timer=setTimeout(tick,150)}
  function grab(){const vw=video.videoWidth,vh=video.videoHeight,k=Math.min(1,2200/Math.max(vw,vh)),c=document.createElement('canvas');c.width=Math.round(vw*k);c.height=Math.round(vh*k);c.getContext('2d').drawImage(video,0,0,c.width,c.height);return {c,k}}
  function flash(){const f=root.querySelector('.live-flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');try{navigator.vibrate?.(15)}catch{}}
  async function add(source,quad){const canvas=flatten(source,quad,state.mode);state.pages.push({source,quad,mode:state.mode,turns:0,canvas});paintPages();if(!type.multiple)await save()}
  async function shoot(manual){if(busy||!video.videoWidth)return;busy=true;lastShot=Date.now();try{const {c,k}=grab();flash();
    const q=shown&&seen?seen.map(p=>({x:p.x*k,y:p.y*k})):null;
    if(q)await add(c,q);
    else if(manual){state.running=false;const page=await cropStep(c,state.pages.length,0,state.mode);if(mine!==job)return;if(page&&lastEdit){state.pages.push({source:c,quad:lastEdit.quad,mode:lastEdit.mode,turns:lastEdit.turns||0,canvas:page});if(!type.multiple)return save()}resume()}}
   finally{busy=false}}
  function resume(){if(mine!==job)return;body.replaceChildren(root);dialog.dataset.view='scan-live';state.running=true;paintPages();video.play().catch(()=>{});tick()}
  async function save(){if(!state.pages.length)return;const pages=state.pages.map(p=>p.canvas);stopLive();await usePages(type,pages,mine)}
  // the pages so far: open one to fix its corners, filter or rotation, or delete it
  function review(){state.running=false;dialog.dataset.view='scan';
   body.replaceChildren(el(`<p class="muted">${state.pages.length} ${state.pages.length===1?'página':'páginas'}. Tocá una para corregir el recorte, el aspecto o girarla.</p><div class="scan-pages">${state.pages.map((p,i)=>`<div class="scan-page"><button type="button" data-edit="${i}" aria-label="Editar la página ${i+1}"></button><span>${i+1}</span><button type="button" class="scan-page-del" data-del="${i}" aria-label="Borrar la página ${i+1}">×</button></div>`).join('')}</div>
    <div class="actions"><button type="button" class="primary" data-act="save">Guardar</button><button type="button" data-act="more">${type.multiple?'Seguir escaneando':'Volver a sacar'}</button></div>`));
   body.querySelectorAll('[data-edit]').forEach(b=>{const c=state.pages[+b.dataset.edit].canvas,t=document.createElement('canvas'),k=240/Math.max(c.width,c.height);t.width=Math.round(c.width*k);t.height=Math.round(c.height*k);t.getContext('2d').drawImage(c,0,0,t.width,t.height);b.append(t);
    b.onclick=async()=>{const i=+b.dataset.edit,p=state.pages[i],out=await cropStep(p.source,i,state.pages.length,p.mode,p.quad);if(mine!==job)return;if(out&&lastEdit)state.pages[i]={...p,quad:lastEdit.quad,mode:lastEdit.mode,canvas:out};review()}});
   body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{state.pages.splice(+b.dataset.del,1);if(state.pages.length)review();else{if(!type.multiple)state.pages=[];resume()}});
   body.querySelector('[data-act=save]').onclick=save;
   body.querySelector('[data-act=more]').onclick=()=>{if(!type.multiple)state.pages=[];resume()}}
  root.querySelector('[data-act=cancel]').onclick=()=>{stopLive();back()};
  root.querySelector('[data-act=filter]').onclick=()=>{const i=FILTERS.findIndex(f=>f[0]===state.mode);state.mode=FILTERS[(i+1)%FILTERS.length][0];paintTop()};
  root.querySelector('[data-act=auto]').onclick=()=>{autoShot=!autoShot;try{localStorage.setItem('nubo-scan-auto',autoShot?'on':'off')}catch{}still=0;paintTop()};
  root.querySelector('[data-act=shot]').onclick=()=>shoot(true);
  root.querySelector('[data-act=review]').onclick=review;
  root.querySelector('[data-act=save]').onclick=save;
  // photos from the gallery: each one goes through the corners, like a manual shot
  root.querySelector('.live-gallery input').onchange=async e=>{const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;state.running=false;clearTimeout(state.timer);
   const pdf=files.find(isTextFile);if(pdf&&type.pdf){stopLive();progress('Leyendo el archivo…',.2);try{const text=await fileText(pdf);if(mine!==job)return;if(text.trim().length<40)return failed(type,'Ese archivo no tiene texto (es una imagen). Probá con una foto o captura.');return byText(type,text)}catch(x){return failed(type,'No se pudo leer el archivo: '+(x?.message||x))}}
   try{for(const [i,f] of files.entries()){const c=toCanvas(await loadImage(f),2000),page=await cropStep(c,i,files.length,state.mode);if(mine!==job||!cam)return;if(!page||!lastEdit)break;
     state.pages.push({source:c,quad:lastEdit.quad,mode:lastEdit.mode,turns:lastEdit.turns||0,canvas:page})}
    if(state.pages.length&&!type.multiple)return save();resume()}catch{resume();hint.textContent='No se pudo abrir esa imagen.'}};
  video.srcObject=stream;video.play().catch(()=>{});
  tick();
 }
 function failed(type,message){body.replaceChildren(el(`<p class="status">${esc(message)}</p><div class="actions"><button type="button" class="primary scan-retry">Probar otra foto</button>${list.length===1?'':'<button type="button" class="scan-back">Elegir otro tipo</button>'}</div>`));body.querySelector('.scan-retry').onclick=()=>live(type);body.querySelector('.scan-back').onclick=back}
 const readBlock=text=>`<details class="scan-read"><summary>Texto leído</summary><textarea readonly rows="8">${esc(text)}</textarea></details>`;
 const keepBlock=where=>scans.length?`<label class="scan-check"><input type="checkbox" name="keepScan" checked> ${where}</label>`:'';
 const scanHtml=()=>scans.map(key=>`<p><img data-scan="${key}" alt="Escaneo"></p>`).join('');
 // a copy of the scanned page in lecta › Escaneos, with the text that was read
 async function keepCopy(v,title,text){if(v.keepScan!=='on'||!scans.length)return;const w=await frameWindow('journal');
  w.ecosystemImport('notes',{title:title.slice(0,240),notebook:'Escaneos',date:today(),tags:'escaneo',favorite:false,body:scanHtml()+toNoteHtml(parseText(text).paragraphs),related:[]})}
 function form(html,onSave){
  body.replaceChildren(el(`<form class="scan-form">${html}<p class="scan-error danger" hidden></p><div class="actions"><button class="primary">Guardar</button><button type="button" class="scan-back">Cancelar</button></div></form>`));
  const f=body.querySelector('form');body.querySelector('.scan-back').onclick=back;
  f.onsubmit=async e=>{e.preventDefault();const err=f.querySelector('.scan-error');err.hidden=true;const button=f.querySelector('.primary');button.disabled=true;
   try{await onSave(Object.fromEntries(new FormData(f)))}catch(x){err.textContent=x?.message||String(x);err.hidden=false}finally{button.disabled=false}};
 }
 async function frameWindow(app){const frame=await ensureFrame(app);return frame.contentWindow}
 function done(app,label,entry){
  title('Listo');
  body.replaceChildren(el(`<p class="status">${esc(label)}</p><div class="actions"><button type="button" class="primary scan-open">Ver en ${{iris:'numio','mi-espacio':'domo',journal:'lecta',organizador:'foco'}[app]}</button><button type="button" class="scan-again">Digitalizar otro</button></div>`));
  body.querySelector('.scan-open').onclick=()=>{dialog.close();openResult(entry)};body.querySelector('.scan-again').onclick=again;
  notify?.(label);
 }

 async function reviewBill(text){
  const w=await frameWindow('iris'),fin=w.ecosystemFinance?.()||{accounts:[],services:[]},bill=parseBill(text,{services:fin.services});
  if(!fin.accounts.length){failed(TYPES[0],'Primero creá una cuenta en numio para registrar pagos.');return}
  form(`<label>Servicio<select name="serviceId"><option value="">Otro · registrar como gasto</option>${fin.services.map(s=>`<option value="${esc(s.id)}" ${s.id===bill.serviceId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
   <label>Descripción<input name="text" maxlength="120" value="${esc((bill.provider||'Servicio')+(bill.period?' · '+periodLabel(bill.period):''))}"></label>
   <div class="scan-pair"><label>Importe<input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" required value="${bill.amount??''}"></label><label>Período<input name="period" type="month" required value="${bill.period||today().slice(0,7)}"></label></div>
   <div class="scan-pair"><label>Fecha de pago<input name="date" type="date" required value="${today()}"></label><label>Cuenta<select name="accountId">${fin.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.currency)}</option>`).join('')}</select></label></div>
   <label>Medio<select name="method">${['Transferencia','Débito automático','Tarjeta de débito','Billetera virtual','Efectivo'].map(m=>`<option>${m}</option>`).join('')}</select></label>
   ${bill.due?`<p class="muted">Vencimiento leído: ${bill.due.split('-').reverse().join('/')}</p>`:''}${keepBlock('Guardar la foto de la boleta en lecta › Escaneos')}${readBlock(text)}`,
   async v=>{await keepCopy(v,'Boleta · '+v.text,text);const r=w.ecosystemImportBill({serviceId:v.serviceId||null,period:v.period,amount:Number(v.amount),date:v.date,accountId:v.accountId,method:v.method,text:v.text});
    done('iris',v.serviceId?'Pago registrado en numio.':'Gasto registrado en numio.',{app:'iris',kind:r.kind,id:r.id})});
 }
 async function reviewHomeBill(text){
  const w=await frameWindow('mi-espacio'),home=w.ecosystemHome?.()||{services:[]},bill=parseBill(text,{services:home.services});
  const known=home.services.find(s=>s.id===bill.serviceId);
  form(`<label>Servicio<select name="serviceId"><option value="">Nuevo servicio</option>${home.services.map(s=>`<option value="${esc(s.id)}" ${s.id===bill.serviceId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
   <label class="scan-new-service" ${known?'hidden':''}>Nombre del servicio<input name="name" maxlength="120" value="${esc(bill.provider||'Servicio')}"></label>
   <div class="scan-pair"><label>Importe<input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" required value="${bill.amount??''}"></label><label>Período<input name="period" type="month" required value="${bill.period||today().slice(0,7)}"></label></div>
   <div class="scan-pair"><label>Fecha de pago<input name="date" type="date" required value="${today()}"></label><label>Medio<select name="method">${['Transferencia','Débito automático','Efectivo','Tarjeta'].map(m=>`<option>${m}</option>`).join('')}</select></label></div>
   ${bill.due?`<p class="muted">Vencimiento leído: ${bill.due.split('-').reverse().join('/')}</p>`:''}${keepBlock('Guardar la foto de la boleta en lecta › Escaneos')}${readBlock(text)}`,
   async v=>{await keepCopy(v,'Boleta · '+((v.name||'').trim()||home.services.find(s=>s.id===v.serviceId)?.name||'Servicio')+' · '+periodLabel(v.period),text);const r=w.ecosystemImportHomeBill({serviceId:v.serviceId||null,name:(v.name||'').trim(),period:v.period,amount:Number(v.amount),date:v.date,method:v.method,due:bill.due});
    done('mi-espacio','Pago registrado en domo › Servicios.',{app:'mi-espacio',kind:'services',id:r.id,view:'services'})});
  const pick=body.querySelector('[name=serviceId]'),extra=body.querySelector('.scan-new-service');pick.onchange=()=>{extra.hidden=!!pick.value};
 }
 function reviewTasks(text){
  const lines=parseTaskLines(text);
  form(`<label>Tareas (una por renglón)<textarea name="lines" rows="10">${esc(lines.join('\n'))}</textarea></label>
   <div class="scan-pair"><label>Fecha<input name="date" type="date" value="${today()}"></label><label>Prioridad<select name="priority">${['Media','Alta','Baja'].map(p=>`<option>${p}</option>`).join('')}</select></label></div>${keepBlock('Guardar la foto de la lista en lecta › Escaneos')}${readBlock(text)}`,
   async v=>{await keepCopy(v,'Lista de tareas · '+today().split('-').reverse().join('/'),text);const items=String(v.lines).split('\n').map(l=>l.trim()).filter(Boolean);if(!items.length)throw Error('No quedó ninguna tarea.');
    const w=await frameWindow('organizador');let first=null;
    for(const title of items){const id=w.ecosystemImport('tasks',{title:title.slice(0,240),description:'',date:v.date,priority:v.priority,done:false,subtasks:[]});first??=id}
    done('organizador',items.length===1?'Tarea guardada en foco.':items.length+' tareas guardadas en foco.',{app:'organizador',kind:'tasks',id:first,view:'tasks'})});
 }
 async function reviewContract(text){
  const c=parseContract(text);
  form(`<label>Vivienda o contrato<input name="name" maxlength="120" required value="${esc(c.name)}"></label>
   <label>Dirección<input name="address" maxlength="160" value="${esc(c.address)}"></label>
   <div class="scan-pair"><label>Inicio<input name="start" type="date" value="${c.start}"></label><label>Fin<input name="end" type="date" value="${c.end}"></label></div>
   <div class="scan-pair"><label>Alquiler mensual<input name="rent" type="number" min="0" step="0.01" value="${c.rent}"></label><label>Expensas<input name="expenses" type="number" min="0" step="0.01" value="${c.expenses}"></label></div>
   <div class="scan-pair"><label>Depósito<input name="deposit" type="number" min="0" step="0.01" value="${c.deposit}"></label><label>Día de pago<input name="day" type="number" min="1" max="31" step="1" value="${c.day}"></label></div>
   <label>Contacto de administración<input name="contact" maxlength="120"></label>
   <label>Texto del contrato<textarea name="notes" rows="8">${esc(text)}</textarea></label>${keepBlock('Guardar las páginas escaneadas en lecta › Escaneos')}`,
   async v=>{await keepCopy(v,'Contrato · '+v.name.trim(),v.notes);const w=await frameWindow('mi-espacio');
    const id=w.ecosystemImport('contracts',{name:v.name.trim(),address:v.address.trim(),start:v.start,end:v.end,rent:Number(v.rent)||0,expenses:Number(v.expenses)||0,deposit:Number(v.deposit)||0,day:Math.round(Number(v.day))||10,contact:v.contact.trim(),notes:v.notes.trim()});
    done('mi-espacio','Contrato guardado en domo › Vivienda.',{app:'mi-espacio',kind:'contracts',id,view:'contracts'})});
 }
 function reviewText(text){
  const t=parseText(text);
  form(`<label>Título<input name="title" maxlength="240" required value="${esc(t.title)}"></label>
   <div class="scan-pair"><label>Cuaderno<input name="notebook" maxlength="80" value="Digitalizado"></label><label>Fecha<input name="date" type="date" value="${today()}"></label></div>
   <label>Texto<textarea name="body" rows="10">${esc(t.paragraphs.join('\n\n'))}</textarea></label>${keepBlock('Guardar también la imagen dentro de la nota')}`,
   async v=>{const w=await frameWindow('journal'),paras=parseText(v.body).paragraphs;
    const id=w.ecosystemImport('notes',{title:v.title.trim(),notebook:v.notebook.trim()||'Digitalizado',date:v.date,tags:'digitalizado',favorite:false,body:(v.keepScan==='on'?scanHtml():'')+toNoteHtml(paras),related:[]});
    done('journal','Nota guardada en lecta.',{app:'journal',kind:'notes',id,view:'notes'})});
 }
 // a card statement: the AI turns its text into data; you confirm the card and what to update
 async function reviewStatement(text){progress('Entendiendo el resumen…',.6);let data;
  try{data=await window.EcosystemHost.ai({task:'statement',text})}catch(x){return failed(TYPES.find(t=>t.id==='statement'),'No se pudo leer el resumen: '+(x?.message||x))}
  const w=await frameWindow('iris'),cards=w.ecosystemCards?.()||[];
  const guess=cards.find(c=>data.card&&c.name.toLowerCase().split(/\s+/).some(word=>word.length>2&&data.card.toLowerCase().includes(word)))||cards[0];
  const f=d=>d?d.split('-').reverse().join('/'):'—',m=n=>n?'$ '+Number(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  if(!cards.length){failed(TYPES.find(t=>t.id==='statement'),'Primero agregá la tarjeta en numio › Tarjetas.');return}
  form(`<p class="muted">${esc(data.card||'Tarjeta')}${data.last4?' · terminada en '+esc(data.last4):''}</p>
   <div class="scan-facts"><span>Cierre<b>${f(data.closing)}</b></span><span>Vencimiento<b>${f(data.due)}</b></span><span>Total<b>${m(data.total)}</b></span>${data.totalUSD?`<span>En dólares<b>US$ ${Number(data.totalUSD).toLocaleString('es-AR')}</b></span>`:''}<span>Mínimo<b>${m(data.minimum)}</b></span>${data.nextClosing?`<span>Próximo cierre<b>${f(data.nextClosing)}</b></span>`:''}</div>
   <label>Tarjeta<select name="cardId">${cards.map(c=>`<option value="${esc(c.id)}" ${c===guess?'selected':''}>${esc(c.name)} · ${esc(c.currency)}</option>`).join('')}</select></label>
   <label class="scan-check"><input type="checkbox" name="updateDays" checked> Actualizar los días de cierre y vencimiento de la tarjeta</label>
   <label class="scan-check"><input type="checkbox" name="addItems" ${data.items.length?'checked':''}> Agregar los consumos que falten (${data.items.length} en el resumen)</label>
   ${data.items.length?`<details class="scan-read"><summary>Ver consumos</summary><ul class="scan-items">${data.items.slice(0,60).map(i=>`<li><span>${esc(f(i.date))} · ${esc(i.text)}${i.installment?' · cuota '+esc(i.installment):''}</span><b>${i.currency==='USD'?'US$ ':'$ '}${Number(i.amount).toLocaleString('es-AR')}</b></li>`).join('')}</ul></details>`:''}`,
   async v=>{const r=w.ecosystemStatement(data,{cardId:v.cardId,updateDays:v.updateDays==='on',addItems:v.addItems==='on'});
    done('iris',`Resumen de ${r.card} guardado${r.added?` y ${r.added} consumo${r.added>1?'s':''} agregado${r.added>1?'s':''}`:''}.`,{app:'iris',view:'expenses'})})}
 const byText=(type,text)=>reviewStatement(text);
 // a document as it is (every page as an image); reading its text is optional and only makes it searchable
 function reviewDocument(pages,mine){
  const d=today().split('-').reverse().join('/');
  form(`<label>Nombre<input name="title" maxlength="160" required value="Documento del ${d}" autocomplete="off"></label>
   <label>Etiquetas, separadas por comas<input name="tags" maxlength="200" placeholder="dni, garantía, salud…"></label>
   <label class="scan-check"><input type="checkbox" name="read" checked> Leer el texto para poder buscarlo</label>
   <div class="scan-pages">${pages.map((_,i)=>`<div class="scan-page"><span class="scan-page-img" data-i="${i}"></span><span>${i+1}</span></div>`).join('')}</div>`,
   async v=>{progress('Guardando '+(pages.length>1?'las páginas':'la página')+'…',.1);const keys=[];
    for(const p of pages)keys.push(await putScan(await canvasBlob(sized(p,2000),'image/jpeg',.85),'doc'));
    let text='';if(v.read==='on'){try{text=await readPages(pages,p=>{if(mine===job&&p.phase==='reading')progress(`Leyendo la página ${p.page} de ${p.pages}…`,.2+.8*((p.page-1+p.progress)/p.pages))})}catch{}}
    const w=await frameWindow('journal');
    const id=w.ecosystemImport('documents',{title:v.title.trim()||'Documento',tags:String(v.tags||'').split(',').map(t=>t.trim()).filter(Boolean).join(', '),pages:keys,text:text.trim().slice(0,60000),date:today()});
    done('journal',`Documento guardado en lecta › Documentos (${keys.length} ${keys.length===1?'página':'páginas'}).`,{app:'journal',kind:'documents',id,view:'documents'})});
  body.querySelectorAll('.scan-page-img').forEach(box=>{const c=pages[+box.dataset.i],t=document.createElement('canvas'),k=240/Math.max(c.width,c.height);t.width=Math.round(c.width*k);t.height=Math.round(c.height*k);t.getContext('2d').drawImage(c,0,0,t.width,t.height);box.append(t)});
 }
 function reviewDrawing(source){
  form(`<label>Nombre<input name="name" maxlength="100" required value="Dibujo del ${today().split('-').reverse().join('/')}"></label>
   <label class="scan-check"><input type="checkbox" name="clean" checked> Limpiar el fondo del papel</label>
   <div class="scan-preview"><canvas></canvas></div>`,
   async v=>{const image=pngWithin(cleanDrawing(source,v.clean==='on')),w=await frameWindow('journal');
    const id=w.ecosystemImport('drawings',{name:v.name.trim(),image});
    done('journal','Dibujo guardado en lecta › Dibujos.',{app:'journal',kind:'drawings',id,view:'drawings'})});
  const preview=body.querySelector('.scan-preview canvas'),paint=()=>{const c=cleanDrawing(source,body.querySelector('[name=clean]').checked);preview.width=c.width;preview.height=c.height;preview.getContext('2d').drawImage(c,0,0)};
  body.querySelector('[name=clean]').onchange=paint;paint();
 }
 dialog.addEventListener('close',()=>{if(dialog.dataset.view==='scan'){job++;setTimeout(()=>{if(!dialog.open)releaseReader()},60000)}});
 return {open};
}
